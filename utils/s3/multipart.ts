import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, S3_BUCKET } from './client';

export const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks
export const MAX_CHUNKS = 100; // S3 allows up to 10,000 parts, we'll use 100 for simplicity

export interface MultipartUploadInit {
  uploadId: string;
  key: string;
  presignedUrls: string[];
}

/**
 * Initiate a multipart upload and generate presigned URLs for each part
 */
export async function initiateMultipartUpload(
  key: string,
  contentType: string,
  fileSize: number
): Promise<MultipartUploadInit> {
  // Calculate number of parts needed
  const numParts = Math.ceil(fileSize / CHUNK_SIZE);
  
  if (numParts > MAX_CHUNKS) {
    throw new Error(`File too large. Maximum ${MAX_CHUNKS} chunks allowed.`);
  }

  // Initiate multipart upload
  const createCommand = new CreateMultipartUploadCommand({
    Bucket: S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  const { UploadId } = await s3Client.send(createCommand);
  
  if (!UploadId) {
    throw new Error('Failed to initiate multipart upload');
  }

  // Generate presigned URLs for each part
  const presignedUrls: string[] = [];
  
  for (let partNumber = 1; partNumber <= numParts; partNumber++) {
    const uploadPartCommand = new UploadPartCommand({
      Bucket: S3_BUCKET,
      Key: key,
      UploadId,
      PartNumber: partNumber,
    });

    const presignedUrl = await getSignedUrl(s3Client, uploadPartCommand, {
      expiresIn: 3600, // 1 hour
    });

    presignedUrls.push(presignedUrl);
  }

  return {
    uploadId: UploadId,
    key,
    presignedUrls,
  };
}

/**
 * Complete a multipart upload
 */
export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: Array<{ PartNumber: number; ETag: string }>
): Promise<void> {
  const command = new CompleteMultipartUploadCommand({
    Bucket: S3_BUCKET,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: parts,
    },
  });

  await s3Client.send(command);
}

/**
 * Abort a multipart upload (cleanup on failure)
 */
export async function abortMultipartUpload(
  key: string,
  uploadId: string
): Promise<void> {
  const command = new AbortMultipartUploadCommand({
    Bucket: S3_BUCKET,
    Key: key,
    UploadId: uploadId,
  });

  await s3Client.send(command);
}
