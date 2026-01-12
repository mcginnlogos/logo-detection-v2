import { createClient } from '@/utils/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { generatePresignedUrl, validateUserAccess } from '@/utils/s3/operations';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: fileId } = await params;

    // Get file info
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

    // Generate presigned URL for S3 file
    let previewUrl: string;
    try {
      previewUrl = await generatePresignedUrl(file.s3_key, 3600); // 1 hour expiry
    } catch (s3Error) {
      console.error('S3 presigned URL error:', s3Error);
      return NextResponse.json({ error: 'Failed to generate preview URL' }, { status: 500 });
    }

    return NextResponse.json({ 
      file,
      previewUrl 
    });

  } catch (error) {
    console.error('Preview error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}