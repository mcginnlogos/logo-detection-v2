import { 
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
 * Validate that user can access the S3 key (RLS enforcement)
 */
export function validateUserAccess(userId: string, s3Key: string): boolean {
  const expectedPrefix = `users/${userId}/`;
  return s3Key.startsWith(expectedPrefix);
}