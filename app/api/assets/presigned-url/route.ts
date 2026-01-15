import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Database } from '@/types_db';

type FileRow = Database['public']['Tables']['files']['Row'];

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { fileId } = await request.json();

    if (!fileId) {
      return NextResponse.json({ error: 'File ID is required' }, { status: 400 });
    }

    // Fetch file from database to verify ownership
    const { data: file, error: fileError } = await supabase
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', user.id)
      .single<FileRow>();

    if (fileError || !file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Generate presigned URL (valid for 1 hour)
    const command = new GetObjectCommand({
      Bucket: file.s3_bucket,
      Key: file.s3_key,
    });

    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return NextResponse.json({ url: presignedUrl });

  } catch (error) {
    console.error('Generate presigned URL error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
