import { 
  PutObjectCommand, 
  DeleteObjectCommand, 
  GetObjectCommand,
  HeadObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, S3_BUCKET } from './client';
import { getFileTypeFolder } from '../file-config';

/**
 * Generate S3 key with user ID and file type folder prefix
 */
export function generateS3Key(userId: string, filename: string, mimeType: string): string {
  const folder = getFileTypeFolder(mimeType);
  return `users/${userId}/${folder}/${filename}`;
}

/**
 * Upload file to S3
 */
export async function uploadFileToS3(
  userId: string,
  filename: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<{ key: string; bucket: string }> {
  const key = generateS3Key(userId, filename, contentType);
  
  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
    Metadata: {
      userId: userId,
      originalName: filename,
      uploadedAt: new Date().toISOString(),
    },
  });

  await s3Client.send(command);
  
  return { key, bucket: S3_BUCKET };
}

/**
 * Delete file from S3
 */
export async function deleteFileFromS3(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  await s3Client.send(command);
}

/**
 * Generate presigned URL for file access
 */
export async function generatePresignedUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  return await getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * Check if file exists in S3
 */
export async function fileExistsInS3(key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    });
    
    await s3Client.send(command);
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound') {
      return false;
    }
    throw error;
  }
}

/**
 * Validate that user can access the S3 key (RLS enforcement)
 */
export function validateUserAccess(userId: string, s3Key: string): boolean {
  const expectedPrefix = `users/${userId}/`;
  return s3Key.startsWith(expectedPrefix);
}