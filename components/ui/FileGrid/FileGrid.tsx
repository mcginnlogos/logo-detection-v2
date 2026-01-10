'use client';

import { useState, useEffect } from 'react';
import { 
  Grid, 
  List, 
  SortAsc, 
  SortDesc, 
  Calendar, 
  ArrowUpDown,
  Trash2,
  Eye,
  Download,
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
  created_at: string;
  updated_at: string;
}

interface FileGridProps {
  refreshTrigger?: number;
}

type SortOption = 'newest' | 'oldest' | 'a-z' | 'z-a';
type ViewMode = 'grid' | 'list';

export default function FileGrid({ refreshTrigger }: FileGridProps) {
  const [files, setFiles] = useState<FileData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [thumbnailsLoading, setThumbnailsLoading] = useState<Record<string, boolean>>({});

  const fetchFiles = async () => {
    try {
      setLoading(true);
      // Fetch files without sorting - we'll sort client-side
      const response = await fetch('/api/files');
      const data = await response.json();
      
      if (data.files) {
        setFiles(data.files);
        // Load thumbnails for image files
        loadThumbnails(data.files);
      }
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadThumbnails = async (fileList: FileData[]) => {
    const imageFiles = fileList.filter(file => isImage(file.mime_type));
    const newThumbnails: Record<string, string> = {};
    const loadingStates: Record<string, boolean> = {};

    // Set loading states
    imageFiles.forEach(file => {
      loadingStates[file.id] = true;
    });
    setThumbnailsLoading(loadingStates);

    for (const file of imageFiles) {
      try {
        const response = await fetch(`/api/files/${file.id}/preview`);
        const data = await response.json();
        if (data.previewUrl) {
          newThumbnails[file.id] = data.previewUrl;
        }
      } catch (error) {
        console.error(`Error loading thumbnail for ${file.id}:`, error);
      } finally {
        setThumbnailsLoading(prev => {
          const newState = { ...prev };
          delete newState[file.id];
          return newState;
        });
      }
    }

    setThumbnails(prev => ({ ...prev, ...newThumbnails }));
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
        // Clean up thumbnail and loading state
        setThumbnails(prev => {
          const newThumbnails = { ...prev };
          delete newThumbnails[fileId];
          return newThumbnails;
        });
        setThumbnailsLoading(prev => {
          const newLoading = { ...prev };
          delete newLoading[fileId];
          return newLoading;
        });
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
  }, [refreshTrigger]); // Only refetch when refreshTrigger changes

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
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg ${
              viewMode === 'grid'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg ${
              viewMode === 'list'
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {sortedFiles.length === 0 ? (
        <div className="text-center py-12">
          <FileImage className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400">No files uploaded yet</p>
        </div>
      ) : (
        <>
          {/* File Grid/List */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {sortedFiles.map((file) => (
                <div
                  key={file.id}
                  className="group relative bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => previewFile(file)}
                >
                  <div className="aspect-square bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center overflow-hidden relative">
                    {isImage(file.mime_type) && thumbnails[file.id] ? (
                      <img
                        src={thumbnails[file.id]}
                        alt={file.original_name}
                        className="w-full h-full object-cover"
                      />
                    ) : isImage(file.mime_type) && thumbnailsLoading[file.id] ? (
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-zinc-400"></div>
                    ) : isImage(file.mime_type) ? (
                      <FileImage className="w-8 h-8 text-zinc-400" />
                    ) : isVideo(file.mime_type) ? (
                      <FileVideo className="w-8 h-8 text-zinc-400" />
                    ) : (
                      <FileImage className="w-8 h-8 text-zinc-400" />
                    )}
                  </div>
                  
                  <div className="p-3">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {file.original_name}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {formatFileSize(file.size)}
                    </p>
                  </div>

                  {/* Hover Actions */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        previewFile(file);
                      }}
                      className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                    >
                      <Eye className="w-4 h-4 text-white" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFile(file.id);
                      }}
                      className="p-2 bg-red-500/80 rounded-lg hover:bg-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {sortedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center space-x-4 p-4 bg-white dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => previewFile(file)}
                >
                  <div className="flex-shrink-0 w-10 h-10 bg-zinc-100 dark:bg-zinc-700 rounded overflow-hidden flex items-center justify-center">
                    {isImage(file.mime_type) && thumbnails[file.id] ? (
                      <img
                        src={thumbnails[file.id]}
                        alt={file.original_name}
                        className="w-full h-full object-cover"
                      />
                    ) : isImage(file.mime_type) && thumbnailsLoading[file.id] ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-zinc-400"></div>
                    ) : isImage(file.mime_type) ? (
                      <FileImage className="w-5 h-5 text-zinc-400" />
                    ) : isVideo(file.mime_type) ? (
                      <FileVideo className="w-5 h-5 text-zinc-400" />
                    ) : (
                      <FileImage className="w-5 h-5 text-zinc-400" />
                    )}
                  </div>
                  
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
        </>
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
                    <video
                      src={previewUrl}
                      controls
                      className="max-w-full h-auto rounded-lg"
                    >
                      Your browser does not support the video tag.
                    </video>
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