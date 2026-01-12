import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { deleteFileFromS3, validateUserAccess } from '@/utils/s3/operations';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all files without sorting (sorting will be done client-side)
    const { data: files, error } = await supabase
      .from('files')
      .select('*')
      .order('created_at', { ascending: false }) as any; // Default order for consistency

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ files });

  } catch (error) {
    console.error('Fetch files error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id');

    if (!fileId) {
      return NextResponse.json({ error: 'File ID required' }, { status: 400 });
    }

    // Get file info first
    const { data: file, error: fetchError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .single() as { data: any, error: any };

    if (fetchError || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Validate required S3 fields
    if (!file.s3_key || !file.s3_bucket) {
      return NextResponse.json({ error: 'File storage information missing' }, { status: 500 });
    }

    // Validate user access to the S3 key
    if (!validateUserAccess(user.id, file.s3_key)) {
      return NextResponse.json({ error: 'Unauthorized access to file' }, { status: 403 });
    }

    // Delete from S3 first
    try {
      await deleteFileFromS3(file.s3_key);
    } catch (s3Error) {
      console.error('S3 deletion error:', s3Error);
      return NextResponse.json({ 
        error: 'Failed to delete file from storage' 
      }, { status: 500 });
    }

    // Only delete from database if S3 deletion was successful
    const { error: dbError } = await supabase
      .from('files')
      .delete()
      .eq('id', fileId);

    if (dbError) {
      console.error('Database deletion error after successful S3 deletion:', dbError);
      return NextResponse.json({ 
        error: 'File deleted from storage but database cleanup failed' 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete file error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}