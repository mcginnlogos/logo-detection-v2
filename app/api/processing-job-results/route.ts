import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const processingJobId = searchParams.get('processingJobId');
    const jobId = searchParams.get('jobId');
    const frameIndex = searchParams.get('frameIndex');

    if (!processingJobId && !jobId) {
      return NextResponse.json({ error: 'Processing Job ID or Job ID is required' }, { status: 400 });
    }

    // Build query
    let query = supabase
      .from('processing_job_results')
      .select('*');

    if (processingJobId) {
      query = query.eq('processing_job_id', processingJobId);
    }

    if (jobId) {
      query = query.eq('job_id', jobId);
    }

    if (frameIndex !== null && frameIndex !== undefined) {
      query = query.eq('frame_index', parseInt(frameIndex));
    }

    // Order by frame_index if available
    query = query.order('frame_index', { ascending: true, nullsFirst: false });

    const { data: results, error } = await query;

    if (error) {
      console.error('Fetch processing job results error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ results: results || [] });

  } catch (error) {
    console.error('Fetch processing job results error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
