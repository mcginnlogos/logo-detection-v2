import { SFNClient, StartExecutionCommand } from '@aws-sdk/client-sfn';

const sfnClient = new SFNClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

// Step Function ARNs - will be populated via environment variables
const STEP_FUNCTIONS = {
  // Both IMAGE_UPLOAD and IMAGE_DELETE use the same Step Function
  IMAGE_UPLOAD: process.env.IMAGE_PROCESSING_STATE_MACHINE_ARN,
  IMAGE_DELETE: process.env.IMAGE_PROCESSING_STATE_MACHINE_ARN,
  VIDEO_UPLOAD: process.env.VIDEO_UPLOAD_STATE_MACHINE_ARN,
  VIDEO_DELETE: process.env.VIDEO_UPLOAD_STATE_MACHINE_ARN, // Future: same workflow for video
  FRAME_PROCESSING: process.env.FRAME_PROCESSING_STATE_MACHINE_ARN,
  RESULT_PROCESSING: process.env.RESULT_PROCESSING_STATE_MACHINE_ARN
};

/**
 * Parse S3 key to extract userId and determine routing
 * Expected format: users/{userId}/images/filename.jpg or users/{userId}/videos/filename.mp4
 */
function parseS3Key(s3Key, eventName) {
  console.log('Parsing S3 key:', s3Key, 'for event:', eventName);
  
  const parts = s3Key.split('/');
  
  if (parts.length < 4 || parts[0] !== 'users') {
    throw new Error(`Invalid S3 key format: ${s3Key}. Expected: users/{userId}/{images|videos}/filename.ext`);
  }
  
  const userId = parts[1];
  const category = parts[2];
  const filename = parts[3];
  
  let routeType;
  
  // Determine route type based on category and event type
  if (category === 'images') {
    if (eventName.startsWith('ObjectCreated')) {
      routeType = 'IMAGE_UPLOAD';
    } else if (eventName.startsWith('ObjectRemoved')) {
      routeType = 'IMAGE_DELETE';
    }
  } else if (category === 'videos') {
    if (eventName.startsWith('ObjectCreated')) {
      routeType = 'VIDEO_UPLOAD';
    } else if (eventName.startsWith('ObjectRemoved')) {
      routeType = 'VIDEO_DELETE';
    }
  } else {
    throw new Error(`Unsupported category: ${category}. Only 'images' and 'videos' are supported.`);
  }
  
  if (!routeType) {
    throw new Error(`Unsupported event type: ${eventName} for category: ${category}`);
  }
  
  return {
    userId,
    category,
    filename,
    routeType,
    fullPath: s3Key,
    isDeleteEvent: eventName.startsWith('ObjectRemoved')
  };
}

/**
 * Start Step Function execution
 */
async function startStepFunction(stateMachineArn, input, executionName) {
  const command = new StartExecutionCommand({
    stateMachineArn,
    input: JSON.stringify(input),
    name: executionName
  });
  
  const response = await sfnClient.send(command);
  console.log(`Started Step Function execution: ${response.executionArn}`);
  return response;
}

export const handler = async (event) => {
  console.log('S3 Event Router received event:', JSON.stringify(event, null, 2));
  
  const results = [];
  
  try {
    // Process each S3 record
    for (const record of event.Records) {
      const bucket = record.s3.bucket.name;
      const s3Key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
      const eventName = record.eventName;
      const eventTime = record.eventTime;
      
      console.log(`Processing S3 event: ${eventName} for ${s3Key} in bucket ${bucket}`);
      
      try {
        // Parse the S3 key to determine routing
        const routeInfo = parseS3Key(s3Key, eventName);
        
        // Get the appropriate Step Function ARN
        // Note: Both IMAGE_UPLOAD and IMAGE_DELETE use the same Step Function
        // The routeType is passed to the Step Function to determine the action
        const stateMachineArn = STEP_FUNCTIONS[routeInfo.routeType];
        
        if (!stateMachineArn) {
          console.warn(`No Step Function configured for route type: ${routeInfo.routeType}`);
          results.push({
            s3Key,
            status: 'skipped',
            reason: `No Step Function configured for ${routeInfo.routeType}`
          });
          continue;
        }
        
        // Prepare input for Step Function
        const stepFunctionInput = {
          bucket,
          s3Key,
          eventName,
          eventTime,
          userId: routeInfo.userId,
          category: routeInfo.category,
          filename: routeInfo.filename,
          routeType: routeInfo.routeType,
          // For delete events, fileSize and etag might be 0 or undefined
          fileSize: record.s3.object.size || 0,
          etag: record.s3.object.eTag || null
        };
        
        // Create unique execution name
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const executionName = `${routeInfo.routeType}-${routeInfo.userId}-${timestamp}`;
        
        // Start Step Function execution
        const execution = await startStepFunction(
          stateMachineArn,
          stepFunctionInput,
          executionName
        );
        
        results.push({
          s3Key,
          status: 'started',
          routeType: routeInfo.routeType,
          executionArn: execution.executionArn,
          userId: routeInfo.userId
        });
        
      } catch (error) {
        console.error(`Error processing S3 key ${s3Key}:`, error);
        results.push({
          s3Key,
          status: 'error',
          error: error.message
        });
      }
    }
    
    console.log('S3 Event Router results:', JSON.stringify(results, null, 2));
    
    return {
      statusCode: 200,
      processedRecords: results.length,
      results
    };
    
  } catch (error) {
    console.error('S3 Event Router failed:', error);
    throw error;
  }
};