import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { stripe } from '@/utils/stripe/config';

export async function GET() {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get active subscription
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('id, price_id, current_period_start')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single() as { data: { id: string; price_id: string; current_period_start: string } | null };

    if (!subscription) {
      // Free tier user
      const { data: userData } = await supabase
        .from('users')
        .select('free_tier_files_used, free_tier_files_limit')
        .eq('id', user.id)
        .single() as { data: { free_tier_files_used: number | null; free_tier_files_limit: number | null } | null };

      return NextResponse.json({
        framesUsed: 0,
        frameLimit: 0,
        filesUsed: userData?.free_tier_files_used || 0,
        filesLimit: userData?.free_tier_files_limit || 1,
        overageFrames: 0,
        isFreeUser: true
      });
    }

    // Get plan limits from price
    const { data: price } = await supabase
      .from('prices')
      .select('product_id, frame_limit')
      .eq('id', subscription.price_id)
      .single() as { data: { product_id: string | null; frame_limit: number | null } | null };

    if (!price) {
      return NextResponse.json({ error: 'Price not found' }, { status: 404 });
    }

    const frameLimit = price.frame_limit || 0;

    // Get total frames processed this billing period
    const { count: totalFrames } = await supabase
      .from('processing_job_results')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', new Date(subscription.current_period_start).toISOString());

    const framesUsed = totalFrames || 0;
    
    // Calculate overages (frames beyond the limit)
    const overageFrames = Math.max(0, framesUsed - frameLimit);

    return NextResponse.json({
      framesUsed,
      frameLimit,
      overageFrames,
      isFreeUser: false
    });

  } catch (error) {
    console.error('Usage stats error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
