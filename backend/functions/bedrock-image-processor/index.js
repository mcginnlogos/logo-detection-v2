import { BedrockDataAutomationRuntimeClient, InvokeDataAutomationCommand } from '@aws-sdk/client-bedrock-data-automation-runtime';
import { SFNClient, SendTaskSuccessCommand } from '@aws-sdk/client-sfn';
import { createClient } from '@supabase/supabase-js';

const bedrockClient = new BedrockDataAutomationRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

const sfnClient = new SFNClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export const handler = async (event) => {
  console.log('Bedrock Image Processor received event:', JSON.stringify(event, null, 2));
  
  // Process each SQS record
  for (const record of event.Records) {
    try {
      const messageBody = JSON.parse(record.body);
      await processImageJob(messageBody);
    } catch (error) {
      console.error('Error processing SQS record:', error);
      throw error; // This will cause the message to be retried or sent to DLQ
    }
  }
  
  return {
    statusCode: 200,
    message: 'Successfully processed all messages'
  };
};

async function processImageJob(jobData) {
  const { bucket, s3Key, userId, filename, fileId, fileSize, jobId, taskToken, frameNumber, frameTimestamp } = jobData;
  
  console.log(`Processing image job for file: ${filename}, user: ${userId}, jobId: ${jobId}`);
  if (frameNumber) {
    console.log(`Processing video frame ${frameNumber} at timestamp ${frameTimestamp}s`);
  }
  
  if (!jobId) {
    const error = new Error('jobId is required in the message');
    console.error(error);
    throw error;
  }
  
  if (!taskToken) {
    const error = new Error('taskToken is required in the message');
    console.error(error);
    throw error;
  }
  
  let processingJobRecord = null;
  
  try {
    const inputS3Uri = `s3://${bucket}/${s3Key}`;
    
    // 1. Create processing job record with status processing
    const processingJobData = {
      job_id: jobId,
      file_id: fileId,
      user_id: userId,
      processing_type: 'logo_detection',
      status: 'processing',
      input_s3_uri: inputS3Uri,
      started_at: new Date().toISOString()
    };
    
    // Add frame metadata if this is a video frame
    if (frameNumber !== undefined) {
      processingJobData.frame_index = frameNumber;
      processingJobData.frame_timestamp = frameTimestamp;
    }
    
    const { data: newProcessingJob, error: processingJobError } = await supabase
      .from('processing_jobs')
      .insert(processingJobData)
      .select()
      .single();
    
    if (processingJobError) {
      console.error('Error creating processing job record:', processingJobError);
      throw new Error(`Failed to create processing job record: ${processingJobError.message}`);
    }
    
    processingJobRecord = newProcessingJob;
    console.log(`Created processing job with status processing: ${processingJobRecord.id}`);
    
    // 2. Kick off Bedrock Data Automation job
    console.log(`Invoking Bedrock Data Automation synchronously`);
    console.log(`Input: ${inputS3Uri}`);
    console.log(`Project ARN: ${process.env.BEDROCK_PROJECT_ARN}`);
    console.log(`Profile ARN: ${process.env.BEDROCK_PROFILE_ARN}`);
    
    const invokeCommand = new InvokeDataAutomationCommand({
      inputConfiguration: {
        s3Uri: inputS3Uri
      },
      dataAutomationConfiguration: {
        dataAutomationProjectArn: process.env.BEDROCK_PROJECT_ARN,
        stage: 'LIVE'
      },
      dataAutomationProfileArn: process.env.BEDROCK_PROFILE_ARN
    });
    
    const bedrockResponse = await bedrockClient.send(invokeCommand);
    console.log(`Bedrock response received:`, JSON.stringify(bedrockResponse, null, 2));
    
    // 3. Save results to processing_job_results
    await saveBedrockResults(jobId, processingJobRecord.id, fileId, bedrockResponse, frameNumber, frameTimestamp);
    
    // 4. Update processing_job status to completed
    await updateProcessingJobStatus(processingJobRecord.id, 'completed');
    
    console.log(`Successfully completed processing for job: ${jobId}`);
    
    // 5. Signal Step Function that task completed successfully
    const taskSuccessCommand = new SendTaskSuccessCommand({
      taskToken: taskToken,
      output: JSON.stringify({
        statusCode: 200,
        message: 'Processing completed successfully',
        jobId: jobId,
        processingJobId: processingJobRecord.id
      })
    });
    
    await sfnClient.send(taskSuccessCommand);
    console.log(`Sent task success to Step Function for job: ${jobId}`);
    
  } catch (error) {
    console.error(`Error processing image job:`, error);
    
    // Update processing job status to failed
    if (processingJobRecord) {
      await updateProcessingJobStatus(processingJobRecord.id, 'failed', error.message);
    }
    
    // DO NOT send SendTaskFailure - let SQS retry the message
    // After 15 retries, message goes to DLQ and Step Function will timeout
    console.log(`Error occurred, throwing to trigger SQS retry. Attempt will be retried up to 15 times.`);
    
    throw error;
  }
}

async function updateProcessingJobStatus(processingJobId, status, errorMessage = null) {
  const updateData = {
    status
  };
  
  if (status === 'completed' || status === 'failed') {
    updateData.completed_at = new Date().toISOString();
  }
  
  if (errorMessage) {
    updateData.error_message = errorMessage;
  }
  
  const { error } = await supabase
    .from('processing_jobs')
    .update(updateData)
    .eq('id', processingJobId);
  
  if (error) {
    console.error('Error updating processing job status:', error);
    throw new Error(`Failed to update processing job status: ${error.message}`);
  }
  
  console.log(`Updated processing job ${processingJobId} status to: ${status}`);
}

async function saveBedrockResults(jobId, processingJobId, fileId, bedrockResponse, frameIndex = null, frameTimestamp = null) {
  console.log(`Saving Bedrock results for job: ${jobId}`);
  
  try {
    // Save the entire Bedrock response in metadata
    const resultRecord = {
      job_id: jobId,
      file_id: fileId,
      processing_job_id: processingJobId,
      result_type: 'logo_detection',
      metadata: {
        bedrock_response: bedrockResponse,
        processed_at: new Date().toISOString()
      }
    };
    
    // Add frame metadata if provided
    if (frameIndex !== null && frameIndex !== undefined) {
      resultRecord.frame_index = frameIndex;
    }
    
    if (frameTimestamp !== null && frameTimestamp !== undefined) {
      resultRecord.frame_timestamp = frameTimestamp;
    }
    
    const { error } = await supabase
      .from('processing_job_results')
      .insert(resultRecord);
    
    if (error) {
      console.error('Error storing processing results:', error);
      throw new Error(`Failed to store processing results: ${error.message}`);
    }
    
    console.log(`Stored processing results for job: ${jobId}`);
    
  } catch (error) {
    console.error('Error saving Bedrock results:', error);
    throw error;
  }
}