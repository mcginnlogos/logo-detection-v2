import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getMaxFileSizeBytes, ALLOWED_FILE_TYPES } from '@/utils/file-config';
import { generateS3Key } from '@/utils/s3/operations';
import { initiateMultipartUpload } from '@/utils/s3/multipart';

const MAX_FILE_SIZE = getMaxFileSizeBytes();

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { filename, fileSize, mimeType } = body;

    // Validate inputs
    if (!filename || !fileSize || !mimeType) {
      return NextResponse.json(
        { error: 'Missing required fields: filename, fileSize, mimeType' },
        { status: 400 }
      );
    }

    // Validate file size
    if (fileSize > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds maximum allowed size` },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: `File type ${mimeType} not allowed` },
        { status: 400 }
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = filename.split('.').pop();
    const uniqueFileName = `${timestamp}_${randomString}.${fileExtension}`;

    // Generate S3 key
    const s3Bucket = process.env.AWS_S3_BUCKET!;
    const s3Key = generateS3Key(user.id, uniqueFileName, mimeType);

    // Create file record in database
    const { data: fileRecord, error: dbError } = await (supabase
      .from('files') as any)
      .insert({
        user_id: user.id,
        name: uniqueFileName,
        original_name: filename,
        size: fileSize,
        mime_type: mimeType,
        s3_bucket: s3Bucket,
        s3_key: s3Key,
        status: 'uploading',
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: `Failed to create file record: ${dbError.message}` },
        { status: 500 }
      );
    }

    // Initiate multipart upload
    const multipartUpload = await initiateMultipartUpload(
      s3Key,
      mimeType,
      fileSize
    );

    return NextResponse.json({
      fileId: fileRecord.id,
      uploadId: multipartUpload.uploadId,
      key: multipartUpload.key,
      presignedUrls: multipartUpload.presignedUrls,
      chunkSize: 5 * 1024 * 1024, // 5MB
    });

  } catch (error) {
    console.error('Initiate upload error:', error);
    return NextResponse.json(
      { error: 'Failed to initiate upload' },
      { status: 500 }
    );
  }
}
