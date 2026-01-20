'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, X, AlertCircle, CheckCircle } from 'lucide-react';
import { getMaxFileSizeMB, getMaxFileSizeBytes, ALLOWED_FILE_TYPES, ALLOWED_FILE_EXTENSIONS } from '@/utils/file-config';

interface FileUploadProps {
  onUploadComplete?: () => void;
}

interface UploadResult {
  name: string;
  success?: boolean;
  error?: string;
  file?: any;
  progress?: number;
}

const MAX_FILE_SIZE = getMaxFileSizeBytes();
const ALLOWED_TYPES = ALLOWED_FILE_TYPES;
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSizeMB = getMaxFileSizeMB();

  const validateFiles = (files: FileList) => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    Array.from(files).forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: File size exceeds ${maxSizeMB}MB limit`);
        return;
      }
      
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: File type not supported`);
        return;
      }

      validFiles.push(file);
    });

    return { validFiles, errors };
  };

  const uploadFileMultipart = async (file: File): Promise<UploadResult> => {
    try {
      // Step 1: Initiate multipart upload
      const initiateResponse = await fetch('/api/files/initiate-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }),
      });

      if (!initiateResponse.ok) {
        const error = await initiateResponse.json();
        throw new Error(error.error || 'Failed to initiate upload');
      }

      const { fileId, uploadId, key, presignedUrls } = await initiateResponse.json();

      // Step 2: Upload chunks in parallel
      const chunks = Math.ceil(file.size / CHUNK_SIZE);
      const uploadPromises: Promise<{ PartNumber: number; ETag: string }>[] = [];

      for (let i = 0; i < chunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        const partNumber = i + 1;

        const uploadPromise = fetch(presignedUrls[i], {
          method: 'PUT',
          body: chunk,
        }).then(async (response) => {
          if (!response.ok) {
            throw new Error(`Failed to upload part ${partNumber}`);
          }
          const etag = response.headers.get('ETag');
          if (!etag) {
            throw new Error(`No ETag returned for part ${partNumber}`);
          }
          
          // Update progress
          setUploadProgress((prev) => Math.min(prev + (100 / chunks), 95));
          
          return {
            PartNumber: partNumber,
            ETag: etag.replace(/"/g, ''), // Remove quotes from ETag
          };
        });

        uploadPromises.push(uploadPromise);
      }

      const parts = await Promise.all(uploadPromises);

      // Step 3: Complete multipart upload
      const completeResponse = await fetch('/api/files/complete-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          uploadId,
          key,
          parts,
        }),
      });

      if (!completeResponse.ok) {
        const error = await completeResponse.json();
        throw new Error(error.error || 'Failed to complete upload');
      }

      setUploadProgress(100);

      return {
        name: file.name,
        success: true,
      };

    } catch (error) {
      console.error('Upload error:', error);
      return {
        name: file.name,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadResults([]);
    setUploadProgress(0);

    try {
      // Upload files sequentially to avoid overwhelming the browser
      const results: UploadResult[] = [];
      
      for (const file of files) {
        const result = await uploadFileMultipart(file);
        results.push(result);
        setUploadResults([...results]);
      }

      // Check if any uploads were successful
      const hasSuccessfulUploads = results.some((result) => result.success);
      if (hasSuccessfulUploads && onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadResults([{
        name: 'Upload failed',
        error: 'Network error occurred'
      }]);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    const { validFiles, errors } = validateFiles(files);

    if (errors.length > 0) {
      setUploadResults(errors.map(error => ({
        name: error.split(':')[0],
        error: error.split(':')[1]
      })));
    }

    if (validFiles.length > 0) {
      uploadFiles(validFiles);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const { validFiles, errors } = validateFiles(files);

    if (errors.length > 0) {
      setUploadResults(errors.map(error => ({
        name: error.split(':')[0],
        error: error.split(':')[1]
      })));
    }

    if (validFiles.length > 0) {
      uploadFiles(validFiles);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const clearResults = () => {
    setUploadResults([]);
  };

  return (
    <div className="w-full">
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
            : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600'
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".png,.jpg,.jpeg,.mp4,.mov,.mpg,.mpeg"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex flex-col items-center space-y-4">
          <div className={`p-4 rounded-full ${
            isDragOver 
              ? 'bg-blue-100 dark:bg-blue-900/30' 
              : 'bg-zinc-100 dark:bg-zinc-800'
          }`}>
            <Upload className={`w-8 h-8 ${
              isDragOver 
                ? 'text-blue-600 dark:text-blue-400' 
                : 'text-zinc-600 dark:text-zinc-400'
            }`} />
          </div>

          <div>
            <p className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
              {isUploading ? 'Uploading files...' : 'Drop files here or click to browse'}
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Supports PNG, JPG, JPEG, MP4, MOV, MPEG (max {maxSizeMB}MB each)
            </p>
            {isUploading && uploadProgress > 0 && (
              <div className="mt-3">
                <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 text-center">
                  {Math.round(uploadProgress)}%
                </p>
              </div>
            )}
          </div>
        </div>

        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-black/80 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {/* Upload Results */}
      {uploadResults.length > 0 && (
        <div className="mt-6 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
              Upload Results
            </h3>
            <button
              onClick={clearResults}
              className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {uploadResults.map((result, index) => (
              <div
                key={index}
                className={`flex items-center space-x-3 p-3 rounded-lg ${
                  result.success
                    ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800'
                    : 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800'
                }`}
              >
                {result.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                )}
                
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    result.success
                      ? 'text-green-900 dark:text-green-100'
                      : 'text-red-900 dark:text-red-100'
                  }`}>
                    {result.name}
                  </p>
                  {result.error && (
                    <p className="text-sm text-red-700 dark:text-red-300">
                      {result.error}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}