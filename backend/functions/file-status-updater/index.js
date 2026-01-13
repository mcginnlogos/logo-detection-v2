import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export const handler = async (event) => {
  console.log('File Status Updater received event:', JSON.stringify(event, null, 2));
  
  const { bucket, s3Key, userId, filename, fileSize, routeType } = event;
  
  try {
    // Check if this is a delete event
    const isDeleteEvent = routeType && routeType.includes('DELETE');
    
    if (isDeleteEvent) {
      // Handle delete event - update file status to 'deleted'
      const { data: updatedFile, error: updateError } = await supabase
        .from('files')
        .update({
          status: 'deleted'
        })
        .eq('user_id', userId)
        .eq('s3_key', s3Key)
        .select()
        .single();
      
      if (updateError) {
        console.error('Error updating file to deleted status:', updateError);
        throw new Error(`Failed to update file to deleted status: ${updateError.message}`);
      }
      
      if (!updatedFile) {
        console.warn(`No file found to delete for s3Key: ${s3Key}, userId: ${userId}`);
        return {
          statusCode: 200,
          message: 'No file found to delete (may have already been deleted)',
          userId: userId,
          s3Key: s3Key
        };
      }
      
      console.log(`Updated file to deleted status: ${updatedFile.id}`);
      
      return {
        statusCode: 200,
        message: 'File status updated to deleted successfully',
        fileId: updatedFile.id,
        status: updatedFile.status,
        userId: userId,
        filename: filename,
        s3Key: s3Key
      };
    }
    
    // Handle upload event (existing logic)
    // Update the file status in Supabase
    // First, try to find the file record by s3_key or filename
    const { data: existingFiles, error: findError } = await supabase
      .from('files')
      .select('*')
      .eq('user_id', userId)
      .eq('s3_key', s3Key)
      .limit(1);
    
    if (findError) {
      console.error('Error finding file:', findError);
      throw new Error(`Failed to find file: ${findError.message}`);
    }
    
    let fileRecord;
    
    if (existingFiles && existingFiles.length > 0) {
      // Update existing file record
      const { data: updatedFile, error: updateError } = await supabase
        .from('files')
        .update({
          status: 'available'
        })
        .eq('id', existingFiles[0].id)
        .select()
        .single();
      
      if (updateError) {
        console.error('Error updating file:', updateError);
        throw new Error(`Failed to update file: ${updateError.message}`);
      }
      
      fileRecord = updatedFile;
      console.log(`Updated existing file record: ${fileRecord.id}`);
      
    } else {
      // Create new file record if it doesn't exist
      const { data: newFile, error: createError } = await supabase
        .from('files')
        .insert({
          user_id: userId,
          name: filename,
          original_name: filename,
          s3_key: s3Key,
          s3_bucket: bucket,
          size: fileSize,
          mime_type: getMimeTypeFromFilename(filename),
          status: 'available',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating file:', createError);
        throw new Error(`Failed to create file: ${createError.message}`);
      }
      
      fileRecord = newFile;
      console.log(`Created new file record: ${fileRecord.id}`);
    }
    
    return {
      statusCode: 200,
      message: 'File status updated successfully',
      fileId: fileRecord.id,
      status: fileRecord.status,
      userId: userId,
      filename: filename,
      s3Key: s3Key
    };
    
  } catch (error) {
    console.error('File status update failed:', error);
       
    throw error;
  }
};

/**
 * Get MIME type from filename extension
 */
function getMimeTypeFromFilename(filename) {
  const extension = filename.toLowerCase().split('.').pop();
  
  const mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'webm': 'video/webm'
  };
  
  return mimeTypes[extension] || 'application/octet-stream';
}