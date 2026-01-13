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

export const IMAGE_TYPES = [
  'image/png',
  'image/jpg', 
  'image/jpeg',
  'image/webp'
];

export const VIDEO_TYPES = [
  'video/mov',
  'video/mp4',
  'video/avi',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm'
];

/**
 * Determine if a file type is an image
 */
export const isImageType = (mimeType: string): boolean => {
  return IMAGE_TYPES.includes(mimeType);
};

/**
 * Determine if a file type is a video
 */
export const isVideoType = (mimeType: string): boolean => {
  return VIDEO_TYPES.includes(mimeType);
};

/**
 * Get the appropriate folder path for a file type
 */
export const getFileTypeFolder = (mimeType: string): string => {
  if (isImageType(mimeType)) {
    return 'images';
  } else if (isVideoType(mimeType)) {
    return 'videos';
  }
  return 'files'; // fallback for other types
};