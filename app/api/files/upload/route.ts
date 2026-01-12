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
        
        // Get S3 bucket name from environment
        const s3Bucket = process.env.AWS_S3_BUCKET!;
        const s3Key = `users/${user.id}/${uniqueFileName}`;

        // Save file metadata to database with pending_upload status
        const { data: dbData, error: dbError } = await (supabase
          .from('files') as any)
          .insert({
            user_id: user.id,
            name: uniqueFileName,
            original_name: file.name,
            size: file.size,
            mime_type: file.type,
            s3_bucket: s3Bucket,
            s3_key: s3Key,
            status: 'pending_upload'
          })
          .select()
          .single();

        if (dbError) {
          uploadResults.push({
            name: file.name,
            error: `Database save failed: ${dbError.message}`
          });
          continue;
        }

        // Update status to uploading
        const { error: statusError } = await (supabase
          .from('files') as any)
          .update({ status: 'uploading', updated_at: new Date().toISOString() })
          .eq('id', dbData.id);

        if (statusError) {
          console.error('Failed to update status to uploading:', statusError);
        }

        // Convert file to buffer
        const fileBuffer = Buffer.from(await file.arrayBuffer());

        // Upload to S3 (don't await - let it happen async)
        uploadFileToS3(user.id, uniqueFileName, fileBuffer, file.type)
          .then(() => {
            console.log(`S3 upload completed for file: ${uniqueFileName}`);
            // Lambda will update status to 'available' via S3 event
          })
          .catch(async (s3Error) => {
            console.error('S3 upload failed:', s3Error);
            // Update status to upload_failed
            await (supabase
              .from('files') as any)
              .update({ 
                status: 'upload_failed', 
                error_message: s3Error.message,
                updated_at: new Date().toISOString() 
              })
              .eq('id', dbData.id);
          });

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