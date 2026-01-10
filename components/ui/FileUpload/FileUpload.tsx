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
}

const MAX_FILE_SIZE = getMaxFileSizeBytes();
const ALLOWED_TYPES = ALLOWED_FILE_TYPES;

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);
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

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadResults([]);

    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.results) {
        setUploadResults(data.results);
        
        // Check if any uploads were successful
        const hasSuccessfulUploads = data.results.some((result: UploadResult) => result.success);
        if (hasSuccessfulUploads && onUploadComplete) {
          onUploadComplete();
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadResults([{
        name: 'Upload failed',
        error: 'Network error occurred'
      }]);
    } finally {
      setIsUploading(false);
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
          accept={ALLOWED_FILE_EXTENSIONS.join(',')}
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
              Supports PNG, JPG, JPEG, WEBP, MOV, MP4, AVI, MKV, WEBM (max {maxSizeMB}MB each)
            </p>
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