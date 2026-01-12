import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getMaxFileSizeMB, getMaxFileSizeBytes, ALLOWED_FILE_TYPES } from '@/utils/file-config';
import { uploadFileToS3 } from '@/utils/s3/operations';

const MAX_FILE_SIZE = getMaxFileSizeBytes();
const ALLOWED_TYPES = ALLOWED_FILE_TYPES;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const uploadResults = [];

    for (const file of files) {
      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        const maxSizeMB = getMaxFileSizeMB();
        uploadResults.push({
          name: file.name,
          error: `File size exceeds ${maxSizeMB}MB limit`
        });
        continue;
      }

      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        uploadResults.push({
          name: file.name,
          error: `File type ${file.type} not allowed`
        });
        continue;
      }

      try {
        // Generate unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const fileExtension = file.name.split('.').pop();
        const uniqueFileName = `${timestamp}_${randomString}.${fileExtension}`;
        
        // Convert file to buffer
        const fileBuffer = Buffer.from(await file.arrayBuffer());

        // Upload to S3
        const { key: s3Key, bucket: s3Bucket } = await uploadFileToS3(
          user.id,
          uniqueFileName,
          fileBuffer,
          file.type
        );

        // Save file metadata to database
        const { data: dbData, error: dbError } = await supabase
          .from('files')
          .insert({
            user_id: user.id,
            name: uniqueFileName,
            original_name: file.name,
            size: file.size,
            mime_type: file.type,
            s3_bucket: s3Bucket,
            s3_key: s3Key
          } as any)
          .select()
          .single();

        if (dbError) {
          // If database insert fails, clean up S3 file
          try {
            const { deleteFileFromS3 } = await import('@/utils/s3/operations');
            await deleteFileFromS3(s3Key);
          } catch (cleanupError) {
            console.error('Failed to cleanup S3 file after DB error:', cleanupError);
          }
          
          uploadResults.push({
            name: file.name,
            error: `Database save failed: ${dbError.message}`
          });
          continue;
        }

        uploadResults.push({
          name: file.name,
          success: true,
          file: dbData
        });

      } catch (error) {
        uploadResults.push({
          name: file.name,
          error: `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }

    return NextResponse.json({ results: uploadResults });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}