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
  'video/mp4',                // MP4 - Most common
  'video/mov',                // MOV - Apple/professional
  'video/quicktime',          // MOV alternate MIME
  'video/mpeg'                // MPEG/MPG - Broadcast standard
];

export const ALLOWED_FILE_EXTENSIONS = [
  '.png',
  '.jpg', 
  '.jpeg',
  '.mp4',
  '.mov',
  '.mpg',
  '.mpeg'
];

export const IMAGE_TYPES = [
  'image/png',
  'image/jpg', 
  'image/jpeg'
];

export const VIDEO_TYPES = [
  'video/mp4',
  'video/mov',
  'video/quicktime',
  'video/mpeg'
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
 * Check if video format is not supported by browsers
 */
export const isUnsupportedVideoFormat = (mimeType: string): boolean => {
  return mimeType === 'video/mpeg';
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