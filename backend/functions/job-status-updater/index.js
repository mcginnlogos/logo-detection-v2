import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export const handler = async (event) => {
  console.log('Job Status Updater received event:', JSON.stringify(event, null, 2));
  
  const { jobId, status, action, bucket, s3Key, userId, filename, fileSize, fileId } = event;
  
  try {
    // If action is 'create', create a new job record
    if (action === 'create') {
      const { data: newJob, error: jobError } = await supabase
        .from('jobs')
        .insert({
          file_id: fileId,
          user_id: userId,
          job_type: 'image_processing',
          status: status || 'processing',
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
      
      console.log(`Created job record with status ${newJob.status}: ${newJob.id}`);
      
      return {
        ...event,  // Pass through all input fields
        statusCode: 200,
        message: 'Job created successfully',
        jobId: newJob.id,
        status: newJob.status
      };
    }
    
    // If action is 'update', update existing job record
    if (action === 'update') {
      if (!jobId) {
        throw new Error('jobId is required for update action');
      }
      
      if (!status) {
        throw new Error('status is required for update action');
      }
      
      const updateData = {
        status
      };
      
      // Add completed_at timestamp if status is completed or failed
      if (status === 'completed' || status === 'failed') {
        updateData.completed_at = new Date().toISOString();
      }
      
      const { data: updatedJob, error: updateError } = await supabase
        .from('jobs')
        .update(updateData)
        .eq('id', jobId)
        .select()
        .single();
      
      if (updateError) {
        console.error('Error updating job status:', updateError);
        throw new Error(`Failed to update job status: ${updateError.message}`);
      }
      
      console.log(`Updated job ${jobId} to status ${status}`);
      
      return {
        ...event,  // Pass through all input fields
        statusCode: 200,
        message: 'Job status updated successfully',
        jobId: updatedJob.id,
        status: updatedJob.status
      };
    }
    
    throw new Error('Invalid action. Must be "create" or "update"');
    
  } catch (error) {
    console.error('Job status update failed:', error);
    throw error;
  }
};
