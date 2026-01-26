import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia'
});

async function reportFrameUsage(userId, framesProcessed, currentJobId) {
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('id, price_id, current_period_start')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (!subscription) {
    // Free tier user
    const { error } = await supabase.rpc('increment_free_tier_usage', {
      user_id: userId,
      frames: framesProcessed
    });
    if (error) console.error('Error updating free tier usage:', error);
    return;
  }

  // Get plan limits from price
  const { data: price } = await supabase
    .from('prices')
    .select('product_id, frame_limit')
    .eq('id', subscription.price_id)
    .single();

  if (!price) return;

  const frameLimit = price.frame_limit || 0;

  // Find the metered price for this product
  const { data: meteredPrice } = await supabase
    .from('prices')
    .select('id')
    .eq('product_id', price.product_id)
    .eq('usage_type', 'metered')
    .eq('active', true)
    .single();

  if (!meteredPrice) {
    console.warn('No metered price configured for product:', price.product_id);
    return;
  }

  // Get metered item from Stripe subscription
  const stripeSubscription = await stripe.subscriptions.retrieve(subscription.id);
  const meteredItem = stripeSubscription.items.data.find(
    (item) => item.price.recurring?.usage_type === 'metered'
  );

  if (!meteredItem) {
    console.error('Metered item not found on subscription:', subscription.id);
    return;
  }

  // Get total frames used this billing period EXCLUDING current job
  const { count: totalFramesThisPeriod } = await supabase
    .from('processing_job_results')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .neq('job_id', currentJobId)
    .gte('created_at', new Date(subscription.current_period_start).toISOString());

  const currentFramesUsed = totalFramesThisPeriod || 0;
  const newTotalFrames = currentFramesUsed + framesProcessed;

  // Calculate overage frames to report
  let overageFrames = 0;
  if (newTotalFrames > frameLimit) {
    if (currentFramesUsed >= frameLimit) {
      // Already over limit, all new frames are overages
      overageFrames = framesProcessed;
    } else {
      // Crossing the limit, only count frames beyond limit
      overageFrames = newTotalFrames - frameLimit;
    }
  }

  if (overageFrames === 0) return;

  // Report only overage frames to Stripe
  await stripe.subscriptionItems.createUsageRecord(meteredItem.id, {
    quantity: overageFrames,
    timestamp: Math.floor(Date.now() / 1000),
    action: 'increment',
  });

  console.log(`Reported ${overageFrames} overage frames for user ${userId} (total: ${newTotalFrames}, limit: ${frameLimit})`);
}

export const handler = async (event) => {
  console.log('Job Status Updater received event:', JSON.stringify(event, null, 2));
  
  const { jobId, status, action, bucket, s3Key, userId, filename, fileSize, fileId, errorMessage, frameRate } = event;
  
  try {
    // If action is 'create', create a new job record
    if (action === 'create') {
      const jobMetadata = {
        original_filename: filename,
        file_size: fileSize,
        s3_bucket: bucket,
        s3_key: s3Key
      };
      
      // Add frame rate to metadata if provided (for videos)
      if (frameRate) {
        jobMetadata.frame_rate = frameRate;
      }
      
      const { data: newJob, error: jobError } = await supabase
        .from('jobs')
        .insert({
          file_id: fileId,
          user_id: userId,
          job_type: 'image_processing',
          status: status || 'processing',
          metadata: jobMetadata
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
      
      // Add error_message if provided
      if (errorMessage) {
        updateData.error_message = errorMessage;
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
      
      // Track frame usage when job completes
      if (status === 'completed' && userId) {
        try {
          // Count frames processed for this job
          const { count, error: countError } = await supabase
            .from('processing_job_results')
            .select('*', { count: 'exact', head: true })
            .eq('job_id', jobId);
          
          if (countError) {
            console.error('Error counting frames:', countError);
          } else if (count > 0) {
            await reportFrameUsage(userId, count, jobId);
          }
        } catch (usageError) {
          console.error('Error reporting frame usage:', usageError);
          // Don't fail the job update if usage tracking fails
        }
      }
      
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
