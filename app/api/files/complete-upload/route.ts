import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { completeMultipartUpload, abortMultipartUpload } from '@/utils/s3/multipart';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { fileId, uploadId, key, parts } = body;

    // Validate inputs
    if (!fileId || !uploadId || !key || !parts) {
      return NextResponse.json(
        { error: 'Missing required fields: fileId, uploadId, key, parts' },
        { status: 400 }
      );
    }

    // Verify file belongs to user
    const { data: fileRecord, error: fileError } = await (supabase
      .from('files') as any)
      .select('*')
      .eq('id', fileId)
      .eq('user_id', user.id)
      .single();

    if (fileError || !fileRecord) {
      return NextResponse.json(
        { error: 'File not found or access denied' },
        { status: 404 }
      );
    }

    try {
      // Complete the multipart upload
      await completeMultipartUpload(key, uploadId, parts);

      return NextResponse.json({
        success: true,
        fileId,
        message: 'Upload completed successfully',
      });

    } catch (s3Error) {
      console.error('S3 complete upload error:', s3Error);

      // Try to abort the multipart upload
      try {
        await abortMultipartUpload(key, uploadId);
      } catch (abortError) {
        console.error('Failed to abort multipart upload:', abortError);
      }

      // Update file status to failed
      await (supabase
        .from('files') as any)
        .update({ 
          status: 'upload_failed',
          error_message: s3Error instanceof Error ? s3Error.message : 'Upload failed',
          updated_at: new Date().toISOString() 
        })
        .eq('id', fileId);

      return NextResponse.json(
        { error: 'Failed to complete upload' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Complete upload error:', error);
    return NextResponse.json(
      { error: 'Failed to complete upload' },
      { status: 500 }
    );
  }
}
