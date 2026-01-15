import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if fetching a specific file
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');

    if (fileId) {
      // Fetch single file with its jobs
      const { data: file, error: fileError } = await supabase
        .from('files')
        .select(`
          *,
          jobs (
            id,
            file_id,
            job_type,
            status,
            error_message,
            metadata,
            created_at,
            updated_at,
            completed_at
          )
        `)
        .eq('id', fileId)
        .eq('user_id', user.id)
        .single();

      if (fileError) {
        console.error('Fetch file error:', fileError);
        return NextResponse.json({ error: fileError.message }, { status: 500 });
      }

      return NextResponse.json({ assets: file ? [file] : [] });
    }

    // Fetch all files with their associated jobs
    const { data: files, error: filesError } = await supabase
      .from('files')
      .select(`
        *,
        jobs (
          id,
          file_id,
          job_type,
          status,
          error_message,
          metadata,
          created_at,
          updated_at,
          completed_at
        )
      `)
      .eq('user_id', user.id)
      .in('status', ['pending_upload', 'uploading', 'available', 'upload_failed', 'deleting'])
      .order('created_at', { ascending: false });

    if (filesError) {
      console.error('Fetch assets error:', filesError);
      return NextResponse.json({ error: filesError.message }, { status: 500 });
    }

    return NextResponse.json({ assets: files || [] });

  } catch (error) {
    console.error('Fetch assets error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
