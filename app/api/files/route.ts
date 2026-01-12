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

    // Fetch files excluding only deleted ones, filtered by user, ordered by creation date
    const { data: files, error } = await supabase
      .from('files')
      .select('*')
      .eq('user_id', user.id)     // Only user's files
      .in('status', ['pending_upload', 'uploading', 'available', 'upload_failed', 'deleting'])  // Include active statuses
      .order('created_at', { ascending: false }) as any;

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

    // Update status to deleting
    const { error: statusError } = await supabase
      .from('files')
      .update({ 
        status: 'deleting',
        updated_at: new Date().toISOString()
      })
      .eq('id', fileId);

    if (statusError) {
      return NextResponse.json({ 
        error: `Failed to update file status: ${statusError.message}` 
      }, { status: 500 });
    }

    // Delete from S3 (don't await - let it happen async)
    deleteFileFromS3(file.s3_key)
      .then(() => {
        console.log(`S3 deletion completed for file: ${file.s3_key}`);
        // Lambda will update status to 'deleted' via S3 event
      })
      .catch(async (s3Error) => {
        console.error('S3 deletion failed:', s3Error);
        // Update status to delete_failed
        await supabase
          .from('files')
          .update({ 
            status: 'delete_failed', 
            error_message: s3Error.message,
            updated_at: new Date().toISOString() 
          })
          .eq('id', fileId);
      });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete file error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}