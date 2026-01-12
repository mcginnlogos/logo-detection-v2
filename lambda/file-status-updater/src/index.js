import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export const handler = async (event) => {
  console.log('SQS Event received:', JSON.stringify(event, null, 2));
  
  const results = [];
  
  for (const record of event.Records) {
    try {
      // Parse the S3 event from SQS message body
      const s3Event = JSON.parse(record.body);
      console.log('Parsed S3 event:', JSON.stringify(s3Event, null, 2));
      
      // Check if s3Event has Records array
      if (!s3Event.Records || !Array.isArray(s3Event.Records)) {
        console.error('Invalid S3 event structure:', s3Event);
        throw new Error('S3 event does not contain Records array');
      }
      
      // Process each S3 record in the event
      for (const s3Record of s3Event.Records) {
        const result = await processS3Event(s3Record);
        results.push({
          messageId: record.messageId,
          eventName: s3Record.eventName,
          s3Key: s3Record.s3.object.key,
          status: 'success',
          result
        });
      }
      
    } catch (error) {
      console.error('Error processing SQS record:', error);
      console.error('Record body:', record.body);
      results.push({
        messageId: record.messageId,
        status: 'error',
        error: error.message
      });
      
      // Re-throw to trigger SQS retry mechanism
      throw error;
    }
  }
  
  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Processed SQS records',
      results
    })
  };
};

async function processS3Event(record) {
  const eventName = record.eventName;
  const bucketName = record.s3.bucket.name;
  const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));
  
  console.log(`Processing ${eventName} for ${objectKey}`);
  
  // Skip test events
  if (eventName === 's3:TestEvent' || eventName === 'TestEvent') {
    console.log('Skipping S3 test event');
    return { action: 'skipped', eventName };
  }
  
  // Extract user ID and filename from S3 key (users/{userId}/filename)
  const keyParts = objectKey.split('/');
  if (keyParts.length < 3 || keyParts[0] !== 'users') {
    throw new Error(`Invalid S3 key format: ${objectKey}`);
  }
  
  const userId = keyParts[1];
  const fileName = keyParts.slice(2).join('/'); // Handle nested paths
  
  // Handle both formats: "s3:ObjectCreated:Put" and "ObjectCreated:Put"
  if (eventName.includes('ObjectCreated')) {
    return await handleFileCreated(bucketName, objectKey, userId, fileName);
  } else if (eventName.includes('ObjectRemoved')) {
    return await handleFileDeleted(bucketName, objectKey, userId, fileName);
  } else {
    console.log(`Ignoring event: ${eventName}`);
    return { action: 'ignored', eventName };
  }
}

async function handleFileCreated(bucketName, objectKey, userId, fileName) {
  console.log(`File created: ${objectKey} for user ${userId}`);
  
  // Update file status to 'available' where s3_key matches
  const { data, error } = await supabase
    .from('files')
    .update({ 
      status: 'available',
      updated_at: new Date().toISOString()
    })
    .eq('s3_key', objectKey)
    .eq('user_id', userId)
    .select();
  
  if (error) {
    throw new Error(`Failed to update file status: ${error.message}`);
  }
  
  if (!data || data.length === 0) {
    console.warn(`No file record found for S3 key: ${objectKey}`);
    return { action: 'no_record_found', s3Key: objectKey };
  }
  
  console.log(`Updated ${data.length} file record(s) to 'available'`);
  return { 
    action: 'status_updated', 
    status: 'available', 
    fileId: data[0].id,
    recordsUpdated: data.length 
  };
}

async function handleFileDeleted(bucketName, objectKey, userId, fileName) {
  console.log(`File deleted: ${objectKey} for user ${userId}`);
  
  // Update file status to 'deleted' where s3_key matches
  const { data, error } = await supabase
    .from('files')
    .update({ 
      status: 'deleted',
      updated_at: new Date().toISOString()
    })
    .eq('s3_key', objectKey)
    .eq('user_id', userId)
    .select();
  
  if (error) {
    throw new Error(`Failed to update file status: ${error.message}`);
  }
  
  if (!data || data.length === 0) {
    console.warn(`No file record found for deleted S3 key: ${objectKey}`);
    return { action: 'no_record_found', s3Key: objectKey };
  }
  
  console.log(`Updated ${data.length} file record(s) to 'deleted'`);
  return { 
    action: 'status_updated', 
    status: 'deleted', 
    fileId: data[0].id,
    recordsUpdated: data.length 
  };
}