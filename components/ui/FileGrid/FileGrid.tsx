'use client';

import { useState, useEffect } from 'react';
import { 
  List, 
  Calendar, 
  ArrowUpDown,
  Trash2,
  Eye,
  FileImage,
  FileVideo
} from 'lucide-react';

interface FileData {
  id: string;
  name: string;
  original_name: string;
  size: number;
  mime_type: string;
  storage_path: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface FileGridProps {
  refreshTrigger?: number;
}

type SortOption = 'newest' | 'oldest' | 'a-z' | 'z-a';

export default function FileGrid({ refreshTrigger }: FileGridProps) {
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/files');
      const data = await response.json();
      
      if (data.files) {
        // Filter to only show files with specific statuses in the UI
        const visibleFiles = data.files.filter((file: FileData) => 
          ['available', 'uploading', 'pending_upload'].includes(file.status)
        );
        setFiles(visibleFiles);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  };

  const sortFiles = (files: FileData[], sortOption: SortOption): FileData[] => {
    const sortedFiles = [...files];
    
    switch (sortOption) {
      case 'oldest':
        return sortedFiles.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'a-z':
        return sortedFiles.sort((a, b) => a.original_name.localeCompare(b.original_name));
      case 'z-a':
        return sortedFiles.sort((a, b) => b.original_name.localeCompare(a.original_name));
      case 'newest':
      default:
        return sortedFiles.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  };

  const deleteFile = async (fileId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;

    try {
      const response = await fetch(`/api/files?id=${fileId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setFiles(files.filter(file => file.id !== fileId));
        if (selectedFile?.id === fileId) {
          setSelectedFile(null);
          setPreviewUrl(null);
        }
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  const previewFile = async (file: FileData) => {
    setSelectedFile(file);
    setPreviewLoading(true);
    
    try {
      const response = await fetch(`/api/files/${file.id}/preview`);
      const data = await response.json();
      
      if (data.previewUrl) {
        setPreviewUrl(data.previewUrl);
      }
    } catch (error) {
      console.error('Error loading preview:', error);
    } finally {
      setPreviewLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isImage = (mimeType: string) => mimeType.startsWith('image/');
  const isVideo = (mimeType: string) => mimeType.startsWith('video/');

  useEffect(() => {
    fetchFiles();
  }, [refreshTrigger]);

  // Get sorted files for display
  const sortedFiles = sortFiles(files, sortBy);

  const sortOptions = [
    { value: 'newest', label: 'Newest First', icon: Calendar },
    { value: 'oldest', label: 'Oldest First', icon: Calendar },
    { value: 'a-z', label: 'A to Z', icon: ArrowUpDown },
    { value: 'z-a', label: 'Z to A', icon: ArrowUpDown },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {sortOptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {sortedFiles.length} file{sortedFiles.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <List className="w-4 h-4 text-zinc-500" />
          <span className="text-sm text-zinc-500 dark:text-zinc-400">List View</span>
        </div>
      </div>

      {sortedFiles.length === 0 ? (
        <div className="text-center py-12">
          <FileImage className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400">No files uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedFiles.map((file) => (
            <div
              key={file.id}
              className="flex items-center space-x-4 p-4 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => previewFile(file)}
            >
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                  {file.original_name}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {formatFileSize(file.size)} • {formatDate(file.created_at)}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    previewFile(file);
                  }}
                  className="p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteFile(file.id);
                  }}
                  className="p-2 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {selectedFile && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-lg max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
              <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
                {selectedFile.original_name}
              </h3>
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
                className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4">
              {previewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : previewUrl ? (
                <div className="max-h-[60vh] overflow-auto">
                  {isImage(selectedFile.mime_type) ? (
                    <img
                      src={previewUrl}
                      alt={selectedFile.original_name}
                      className="max-w-full h-auto rounded-lg"
                    />
                  ) : isVideo(selectedFile.mime_type) ? (
                    <>
                      {(selectedFile.mime_type === 'video/mpeg') && (
                        <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                          <p className="text-sm text-yellow-600 dark:text-yellow-400">
                            ⚠️ MPEG files cannot be previewed in the browser, but logo detection will work normally.
                          </p>
                        </div>
                      )}
                      <video
                        src={previewUrl}
                        controls
                        className="max-w-full h-auto rounded-lg"
                      >
                        Your browser does not support the video tag.
                      </video>
                    </>
                  ) : (
                    <p className="text-zinc-500 dark:text-zinc-400">
                      Preview not available for this file type.
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-zinc-500 dark:text-zinc-400">
                  Failed to load preview.
                </p>
              )}
              
              <div className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
                <p>Size: {formatFileSize(selectedFile.size)}</p>
                <p>Type: {selectedFile.mime_type}</p>
                <p>Uploaded: {formatDate(selectedFile.created_at)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}