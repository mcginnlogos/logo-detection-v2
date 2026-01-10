/**
 * File upload configuration utilities
 */

export const getMaxFileSizeMB = (): number => {
  return parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB || '10');
};

export const getMaxFileSizeBytes = (): number => {
  return getMaxFileSizeMB() * 1024 * 1024;
};

export const ALLOWED_FILE_TYPES = [
  'image/png',
  'image/jpg', 
  'image/jpeg',
  'image/webp',
  'video/mov',
  'video/mp4',
  'video/avi',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm'
];

export const ALLOWED_FILE_EXTENSIONS = [
  '.png',
  '.jpg', 
  '.jpeg',
  '.webp',
  '.mov',
  '.mp4',
  '.avi',
  '.mkv',
  '.webm'
];