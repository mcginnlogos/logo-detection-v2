import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

export const handler = async (event) => {
  console.log('Frame Cleanup received event:', JSON.stringify(event, null, 2));
  
  const { bucket, userId, fileId } = event;
  
  if (!bucket || !userId || !fileId) {
    console.warn('Missing required parameters for cleanup. Skipping.');
    return {
      statusCode: 200,
      message: 'Cleanup skipped - missing parameters'
    };
  }
  
  const framePrefix = `users/${userId}/frames/${fileId}/`;
  
  try {
    console.log(`Listing frames to delete at: s3://${bucket}/${framePrefix}`);
    
    // List all frames for this file
    const listCommand = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: framePrefix
    });
    
    const listResponse = await s3Client.send(listCommand);
    
    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      console.log('No frames found to delete');
      return {
        statusCode: 200,
        message: 'No frames to delete',
        deletedCount: 0
      };
    }
    
    console.log(`Found ${listResponse.Contents.length} frames to delete`);
    
    // Delete all frames
    const deleteCommand = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: listResponse.Contents.map(obj => ({ Key: obj.Key })),
        Quiet: true
      }
    });
    
    const deleteResponse = await s3Client.send(deleteCommand);
    
    const deletedCount = listResponse.Contents.length - (deleteResponse.Errors?.length || 0);
    
    console.log(`Successfully deleted ${deletedCount} frames`);
    
    if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
      console.warn('Some frames failed to delete:', deleteResponse.Errors);
    }
    
    return {
      statusCode: 200,
      message: 'Frame cleanup completed',
      deletedCount,
      errors: deleteResponse.Errors || []
    };
    
  } catch (error) {
    // Best effort - log error but don't fail
    console.error('Error during frame cleanup (non-fatal):', error);
    return {
      statusCode: 200,
      message: 'Frame cleanup failed but continuing',
      error: error.message
    };
  }
};
