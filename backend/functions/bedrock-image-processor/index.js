import { BedrockDataAutomationRuntimeClient, InvokeDataAutomationCommand } from '@aws-sdk/client-bedrock-data-automation-runtime';
import { createClient } from '@supabase/supabase-js';

const bedrockClient = new BedrockDataAutomationRuntimeClient({
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
  const { bucket, s3Key, userId, filename, fileId, fileSize } = jobData;
  
  console.log(`Processing image job for file: ${filename}, user: ${userId}`);
  
  let jobRecord = null;
  let processingJobRecord = null;
  
  try {
    const inputS3Uri = `s3://${bucket}/${s3Key}`;
    
    // 1. Check if there is an existing job for this file. If yes, upsert to processing. If not, create new with status processing.
    const { data: existingJobs } = await supabase
      .from('jobs')
      .select('*')
      .eq('file_id', fileId)
      .eq('job_type', 'image_processing')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (existingJobs && existingJobs.length > 0) {
      // Update existing job to processing
      const { data: updatedJob, error: updateError } = await supabase
        .from('jobs')
        .update({
          status: 'processing'
        })
        .eq('id', existingJobs[0].id)
        .select()
        .single();
      
      if (updateError) {
        console.error('Error updating existing job:', updateError);
        throw new Error(`Failed to update existing job: ${updateError.message}`);
      }
      
      jobRecord = updatedJob;
      console.log(`Updated existing job record to processing: ${jobRecord.id}`);
    } else {
      // Create new job with status processing
      const { data: newJob, error: jobError } = await supabase
        .from('jobs')
        .insert({
          file_id: fileId,
          user_id: userId,
          job_type: 'image_processing',
          status: 'processing',
          metadata: {
            original_filename: filename,
            file_size: fileSize,
            s3_bucket: bucket,
            s3_key: s3Key
          }
        })
        .select()
        .single();
      
      if (jobError) {
        console.error('Error creating job record:', jobError);
        throw new Error(`Failed to create job record: ${jobError.message}`);
      }
      
      jobRecord = newJob;
      console.log(`Created new job record with status processing: ${jobRecord.id}`);
    }
    
    // 2. Check if there is an existing processing job for this file. If yes, update to processing. If not, create new with status processing.
    const { data: existingProcessingJobs } = await supabase
      .from('processing_jobs')
      .select('*')
      .eq('file_id', fileId)
      .eq('processing_type', 'logo_detection')
      .order('created_at', { ascending: false })
      .limit(1);
    
    if (existingProcessingJobs && existingProcessingJobs.length > 0) {
      // Update existing processing job to processing
      const { data: updatedProcessingJob, error: updateError } = await supabase
        .from('processing_jobs')
        .update({
          status: 'processing',
          started_at: new Date().toISOString()
        })
        .eq('id', existingProcessingJobs[0].id)
        .select()
        .single();
      
      if (updateError) {
        console.error('Error updating existing processing job:', updateError);
        throw new Error(`Failed to update existing processing job: ${updateError.message}`);
      }
      
      processingJobRecord = updatedProcessingJob;
      console.log(`Updated existing processing job to processing: ${processingJobRecord.id}`);
    } else {
      // Create new processing job with status processing
      const { data: newProcessingJob, error: processingJobError } = await supabase
        .from('processing_jobs')
        .insert({
          job_id: jobRecord.id,
          file_id: fileId,
          user_id: userId,
          processing_type: 'logo_detection',
          status: 'processing',
          input_s3_uri: inputS3Uri,
          output_s3_uri: null, // Not needed for sync API
          started_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (processingJobError) {
        console.error('Error creating processing job record:', processingJobError);
        throw new Error(`Failed to create processing job record: ${processingJobError.message}`);
      }
      
      processingJobRecord = newProcessingJob;
      console.log(`Created new processing job with status processing: ${processingJobRecord.id}`);
    }
    
    // 3. Kick off Bedrock Data Automation job
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
    
    // 5. Save results to processing_job_results (just in metadata)
    await saveBedrockResults(jobRecord.id, processingJobRecord.id, fileId, bedrockResponse);
    
    // 6. Update both job and processing_job to completed
    await updateJobStatus(jobRecord.id, 'completed');
    await updateProcessingJobStatus(processingJobRecord.id, 'completed');
    
    console.log(`Successfully completed processing for job: ${jobRecord.id}`);
    
  } catch (error) {
    console.error(`Error processing image job:`, error);
    
    // 4. If there is an error with BDA, update both processing job and job records with status failed
    if (jobRecord) {
      await updateJobStatus(jobRecord.id, 'failed', error.message);
    }
    
    if (processingJobRecord) {
      await updateProcessingJobStatus(processingJobRecord.id, 'failed', error.message);
    }
    
    throw error;
  }
}

async function updateJobStatus(jobId, status, errorMessage = null) {
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
    .from('jobs')
    .update(updateData)
    .eq('id', jobId);
  
  if (error) {
    console.error('Error updating job status:', error);
    throw new Error(`Failed to update job status: ${error.message}`);
  }
  
  console.log(`Updated job ${jobId} status to: ${status}`);
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

async function saveBedrockResults(jobId, processingJobId, fileId, bedrockResponse) {
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