'use client';

import { useState, useCallback, useEffect } from 'react';
import { Upload, Film, Sparkles, FileVideo, Scan, Loader2, Eye } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

interface Job {
  id: string;
  file_id: string;
  job_type: string;
  status: string;
  error_message: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

interface Asset {
  id: string;
  user_id: string;
  name: string;
  original_name: string;
  size: number;
  mime_type: string;
  s3_bucket: string;
  s3_key: string;
  status: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  jobs: Job[];
}

interface AssetsClientProps {
  user: any;
}

export default function AssetsClient({ user }: AssetsClientProps) {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const [showFrameRateModal, setShowFrameRateModal] = useState(false);
  const [pendingVideoFiles, setPendingVideoFiles] = useState<File[]>([]);
  const [pendingImageFiles, setPendingImageFiles] = useState<File[]>([]);
  const [frameRate, setFrameRate] = useState(5); // Default 5 fps

  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

  // Fetch presigned URL for a file
  const fetchPresignedUrl = async (fileId: string): Promise<string | null> => {
    try {
      const response = await fetch('/api/assets/presigned-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.url;
      }
      return null;
    } catch (error) {
      console.error('Error fetching presigned URL:', error);
      return null;
    }
  };

  // Fetch assets from API
  const fetchAssets = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/assets');
      if (response.ok) {
        const data = await response.json();
        setAssets(data.assets || []);
        // Don't fetch presigned URLs here - let the useEffect handle visible assets only
      } else {
        console.error('Failed to fetch assets');
      }
    } catch (error) {
      console.error('Error fetching assets:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch assets on mount
  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Subscribe to realtime changes on jobs table
  useEffect(() => {
    const supabase = createClient();
    
    // Get current user to filter realtime events
    const setupRealtimeSubscription = async () => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        console.warn('No user found for realtime subscription');
        return null;
      }

      // Subscribe to UPDATE events only - we only care about completion
      const channel = supabase
        .channel('jobs-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE', // Only listen to UPDATE events
            schema: 'public',
            table: 'jobs',
            filter: `user_id=eq.${currentUser.id}`
          },
          (payload) => {
            const newRecord = payload.new as Job;
            const oldRecord = payload.old as Job;
            
            // Only update if job status changed to 'completed'
            if (newRecord.status === 'completed' && oldRecord.status !== 'completed') {
              console.log('Job completed, updating asset in place:', newRecord);
              
              // Update the specific asset's job without refetching
              setAssets(prevAssets => {
                return prevAssets.map(asset => {
                  // Check if this asset has this job
                  if (asset.id === newRecord.file_id) {
                    // Check if job already exists in the array
                    const jobExists = asset.jobs.some(job => job.id === newRecord.id);
                    
                    if (jobExists) {
                      // Update existing job
                      return {
                        ...asset,
                        jobs: asset.jobs.map(job => 
                          job.id === newRecord.id ? newRecord : job
                        )
                      };
                    } else {
                      // Add new job to the array
                      return {
                        ...asset,
                        jobs: [...asset.jobs, newRecord]
                      };
                    }
                  }
                  return asset;
                });
              });
            }
          }
        )
        .subscribe();

      return channel;
    };

    let channelPromise = setupRealtimeSubscription();

    // Cleanup subscription on unmount
    return () => {
      channelPromise.then(channel => {
        if (channel) {
          supabase.removeChannel(channel);
        }
      });
    };
  }, []);

  // Separate assets into processing and library
  const processingAssets = assets.filter(asset => 
    !asset.jobs || asset.jobs.length === 0 || 
    asset.jobs.some(job => job.status === 'pending' || job.status === 'processing')
  );
  
  const libraryAssets = assets.filter(asset => 
    asset.jobs && asset.jobs.length > 0 &&
    asset.jobs.every(job => job.status === 'completed' || job.status === 'failed')
  );

  // Pagination for library assets
  const totalPages = Math.ceil(libraryAssets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLibraryAssets = libraryAssets.slice(startIndex, endIndex);

  // Reset to page 1 if current page is out of bounds
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  // Fetch presigned URLs for visible assets only (processing + current page)
  useEffect(() => {
    const fetchVisiblePresignedUrls = async () => {
      const visibleAssets = [...processingAssets, ...paginatedLibraryAssets];
      
      // Only fetch URLs for assets we don't already have
      const assetsNeedingUrls = visibleAssets.filter(asset => !previewUrls[asset.id]);
      
      if (assetsNeedingUrls.length === 0) return;
      
      const urlPromises = assetsNeedingUrls.map(async (asset: Asset) => {
        const url = await fetchPresignedUrl(asset.id);
        return { id: asset.id, url };
      });
      
      const urlResults = await Promise.all(urlPromises);
      
      const newUrls: Record<string, string> = {};
      urlResults.forEach(({ id, url }) => {
        if (url) {
          newUrls[id] = url;
        }
      });
      
      if (Object.keys(newUrls).length > 0) {
        setPreviewUrls(prev => ({ ...prev, ...newUrls }));
      }
    };
    
    fetchVisiblePresignedUrls();
  }, [currentPage, processingAssets.length, paginatedLibraryAssets.length]);

  // Multipart upload function - returns the file data if successful
  const uploadFileMultipart = async (file: File, videoFrameRate?: number): Promise<{ fileId: string; fileName: string; fileSize: number; mimeType: string } | null> => {
    try {
      // Step 1: Initiate multipart upload
      const initiateResponse = await fetch('/api/files/initiate-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          fileSize: file.size,
          mimeType: file.type,
          frameRate: videoFrameRate, // Pass frame rate for videos
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
      
      // Return file data so we can add it to state
      return {
        fileId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type
      };

    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;

    // Separate videos and images
    const videoFiles = files.filter(f => f.type.startsWith('video/'));
    const imageFiles = files.filter(f => f.type.startsWith('image/'));

    // If there are videos, show frame rate modal and wait for user confirmation
    if (videoFiles.length > 0) {
      setPendingVideoFiles(videoFiles);
      setPendingImageFiles(imageFiles); // Store images too, don't upload yet
      setShowFrameRateModal(true);
      return;
    }

    // If only images, upload immediately
    if (imageFiles.length > 0) {
      await processUpload(imageFiles, undefined);
    }
  };

  const processUpload = async (files: File[], videoFrameRate?: number) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Get current user for creating the asset
      const supabase = createClient();
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        console.error('No user found');
        return;
      }

      // Upload files in parallel
      const uploadPromises = files.map(async (file) => {
        const isVideo = file.type.startsWith('video/');
        const uploadResult = await uploadFileMultipart(file, isVideo ? videoFrameRate : undefined);
        
        // If upload succeeded, add the file to state immediately
        if (uploadResult) {
          // Fetch the complete file data from the API to get all fields
          const response = await fetch(`/api/assets?fileId=${uploadResult.fileId}`);
          if (response.ok) {
            const data = await response.json();
            const newAsset = data.assets?.[0];
            
            if (newAsset) {
              // Add the new asset to the beginning of the list
              // The useEffect will automatically fetch its presigned URL
              setAssets(prevAssets => [newAsset, ...prevAssets]);
            }
          }
        }
      });
      
      await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isUploading) {
      setIsDragging(true);
    }
  }, [isUploading]);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (isUploading) return;

    const files = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('video/') || file.type.startsWith('image/')
    );
    
    if (files.length > 0) {
      uploadFiles(files);
    }
  }, [isUploading, uploadFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (isUploading) return;

    const files = e.target.files ? Array.from(e.target.files) : [];
    const validFiles = files.filter(
      file => file.type.startsWith('video/') || file.type.startsWith('image/')
    );
    
    if (validFiles.length > 0) {
      uploadFiles(validFiles);
    }
    
    // Reset the input value so the same file can be selected again
    e.target.value = '';
  }, [isUploading, uploadFiles]);

  // File preview component
  const FilePreview = ({ asset, url }: { asset: Asset; url?: string }) => {
    const isVideo = asset.mime_type.startsWith('video/');
    const isImage = asset.mime_type.startsWith('image/');
    const [isHovered, setIsHovered] = useState(false);

    if (!url) {
      return (
        <div className="aspect-video bg-secondary/50 flex items-center justify-center relative">
          <FileVideo className="w-12 h-12 text-muted-foreground/30" />
          <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/60 text-xs text-white">
            {isVideo ? 'Video' : 'Image'}
          </div>
        </div>
      );
    }

    if (isImage) {
      return (
        <div className="aspect-video bg-secondary/50 relative overflow-hidden">
          <Image
            src={url}
            alt={asset.original_name}
            fill
            className="object-cover"
            unoptimized
          />
          <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/60 text-xs text-white">
            Image
          </div>
        </div>
      );
    }

    if (isVideo) {
      const isUnsupportedFormat = asset.mime_type === 'video/mpeg';
      
      return (
        <div 
          className="aspect-video bg-secondary/50 relative overflow-hidden"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {isUnsupportedFormat && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
              <div className="text-center p-4">
                <p className="text-yellow-400 text-sm font-medium mb-1">⚠️ Preview Unavailable</p>
                <p className="text-white text-xs">MPEG format not supported in browser</p>
              </div>
            </div>
          )}
          <video
            src={`${url}#t=0.001`}
            className="w-full h-full object-cover"
            preload="metadata"
            muted
            loop
            playsInline
            ref={(video) => {
              if (video) {
                if (isHovered && !isUnsupportedFormat) {
                  video.play().catch(() => {});
                } else {
                  video.pause();
                  video.currentTime = 0;
                }
              }
            }}
          />
          <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/60 text-xs text-white">
            Video
          </div>
        </div>
      );
    }

    return (
      <div className="aspect-video bg-secondary/50 flex items-center justify-center relative">
        <FileVideo className="w-12 h-12 text-muted-foreground/30" />
        <div className="absolute bottom-2 right-2 px-2 py-1 rounded bg-black/60 text-xs text-white">
          {isVideo ? 'Video' : 'Image'}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-6 py-8">
        {/* Hero section */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">AI-Powered Logo Detection</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Detect Logos in Your <span className="text-gradient">Videos</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload your videos and let our AI analyze them frame by frame, 
            detecting and tracking brand logos with precision.
          </p>
        </div>

        {/* Upload zone */}
        <div className="max-w-2xl mx-auto mb-16 animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <div
            onDragEnter={handleDragIn}
            onDragLeave={handleDragOut}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`relative group cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-300 bg-card/50 backdrop-blur-sm ${
              isDragging
                ? 'border-primary glow-primary-intense scale-[1.02]'
                : 'border-border hover:border-primary/50 hover:glow-primary'
            }`}
          >
            <label className="flex flex-col items-center justify-center gap-6 p-12 cursor-pointer">
              <div className={`relative p-6 rounded-2xl transition-all duration-300 bg-secondary/50 ${
                isDragging ? 'scale-110' : 'group-hover:scale-105'
              }`}>
                <Upload className={`w-12 h-12 transition-colors duration-300 ${
                  isDragging ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
                }`} />
                <div className="absolute -top-2 -right-2">
                  <Film className="w-5 h-5 text-primary animate-float" />
                </div>
                <div className="absolute -bottom-1 -left-1">
                  <FileVideo className="w-4 h-4 text-primary/60" />
                </div>
              </div>

              <div className="text-center space-y-2">
                <p className="text-lg font-medium text-foreground">
                  {isUploading 
                    ? 'Uploading...' 
                    : isDragging 
                      ? 'Drop your files here' 
                      : 'Drag & drop video or image files'}
                </p>
                <p className="text-sm text-muted-foreground">
                  or <span className="text-primary underline underline-offset-4">browse files</span>
                </p>
                <p className="text-xs text-muted-foreground/60 mt-4">
                  Supports MP4, MOV, MPEG, PNG, JPG, JPEG • Max 500MB per file
                </p>
                {isUploading && uploadProgress > 0 && (
                  <div className="mt-4">
                    <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {Math.round(uploadProgress)}%
                    </p>
                  </div>
                )}
              </div>

              <input
                type="file"
                accept="video/*,image/*"
                multiple
                onChange={handleFileInput}
                disabled={isUploading}
                className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
            </label>

            {isDragging && (
              <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                <div className="absolute inset-0 bg-primary/5" />
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-scan" />
              </div>
            )}
          </div>
        </div>

        {/* Empty state */}
        {!isLoading && assets.length === 0 && (
          <div className="text-center py-16 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-secondary/50 mb-4">
              <Scan className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <p className="text-muted-foreground">
              No files yet. Upload your first video or image to get started!
            </p>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="text-center py-16">
            <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading your assets...</p>
          </div>
        )}

        {/* Processing section */}
        {!isLoading && processingAssets.length > 0 && (
          <div className="mb-12 animate-fade-in">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
              <h2 className="text-xl font-semibold text-foreground">Processing</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {processingAssets.map((asset) => (
                <div 
                  key={asset.id} 
                  className="group relative rounded-xl overflow-hidden bg-card border border-border hover:border-primary/50 transition-all duration-300 animate-fade-in"
                >
                  <div className="relative">
                    <FilePreview asset={asset} url={previewUrls[asset.id]} />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="font-medium text-foreground truncate mb-1">{asset.original_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(asset.size / (1024 * 1024)).toFixed(2)} MB
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1 bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 animate-pulse" style={{ width: '60%' }} />
                      </div>
                      <span className="text-xs text-orange-500">
                        {!asset.jobs || asset.jobs.length === 0 
                          ? 'Queued...' 
                          : asset.jobs[0]?.status === 'processing' 
                            ? 'Detecting logos...' 
                            : 'Pending...'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Asset Library section */}
        {!isLoading && libraryAssets.length > 0 && (
          <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-6">
              <Film className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Asset Library</h2>
              <span className="text-sm text-muted-foreground">({libraryAssets.length} {libraryAssets.length === 1 ? 'asset' : 'assets'})</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {paginatedLibraryAssets.map((asset) => {
                const hasCompletedJob = asset.jobs.some(job => job.status === 'completed');
                
                return (
                  <div key={asset.id} className="group relative rounded-xl overflow-hidden bg-card border border-border hover:border-primary/50 transition-all">
                    <FilePreview asset={asset} url={previewUrls[asset.id]} />
                    <div className="p-4">
                      <p className="font-medium text-foreground truncate mb-1">{asset.original_name}</p>
                      <p className="text-xs text-muted-foreground mb-2">
                        {(asset.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                      
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          {asset.jobs[0]?.status === 'completed' && (
                            <div className="flex items-center gap-1 text-xs text-green-500">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                              <span>Completed</span>
                            </div>
                          )}
                          {asset.jobs[0]?.status === 'failed' && (
                            <div className="flex items-center gap-1 text-xs text-red-500">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                              <span>Failed</span>
                            </div>
                          )}
                        </div>
                        
                        {hasCompletedJob && (
                          <button
                            onClick={() => router.push(`/assets/${asset.id}/details`)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-xs font-medium"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            Results
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>
                
                <div className="flex items-center gap-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    // Show first page, last page, current page, and pages around current
                    const showPage = page === 1 || 
                                    page === totalPages || 
                                    (page >= currentPage - 1 && page <= currentPage + 1);
                    
                    const showEllipsis = (page === currentPage - 2 && currentPage > 3) ||
                                        (page === currentPage + 2 && currentPage < totalPages - 2);
                    
                    if (showEllipsis) {
                      return <span key={page} className="px-2 text-muted-foreground">...</span>;
                    }
                    
                    if (!showPage) return null;
                    
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-10 h-10 rounded-lg transition-all ${
                          currentPage === page
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-foreground hover:bg-secondary/80'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Frame Rate Modal */}
      {showFrameRateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full animate-fade-in">
            <h3 className="text-xl font-semibold text-foreground mb-4">
              Select Frame Rate
            </h3>
            <p className="text-sm text-muted-foreground mb-6">
              Choose how many frames per second to extract from your video{pendingVideoFiles.length > 1 ? 's' : ''} for logo detection.
              Higher frame rates provide more detailed analysis but take longer to process and consume additional credits.
              {pendingImageFiles.length > 0 && (
                <span className="block mt-2 font-medium">
                  {pendingImageFiles.length} image{pendingImageFiles.length > 1 ? 's' : ''} will also be uploaded.
                </span>
              )}
            </p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Frame Rate
                </label>
                <select
                  value={frameRate}
                  onChange={(e) => setFrameRate(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="0.5">0.5 FPS - 1 frame every 2 seconds (Very Sparse)</option>
                  <option value="1">1 FPS - 1 frame per second (Recommended)</option>
                  <option value="2">2 FPS - 1 frame every 0.5 seconds</option>
                  <option value="5">5 FPS - 1 frame every 0.2 seconds (Detailed)</option>
                  <option value="10">10 FPS - 1 frame every 0.1 seconds</option>
                  <option value="15">15 FPS - High detail</option>
                  <option value="30">30 FPS - Maximum detail (Expensive)</option>
                </select>
              </div>
              
              <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                <p className="text-xs text-muted-foreground">
                  <strong className="text-foreground">Tip:</strong> 1 FPS works well for most videos. 
                  Higher frame rates provide more detail but increase processing time and cost.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowFrameRateModal(false);
                  setPendingVideoFiles([]);
                  setPendingImageFiles([]);
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  setShowFrameRateModal(false);
                  // Upload all pending files (videos with frame rate, images without)
                  const allFiles = [...pendingVideoFiles, ...pendingImageFiles];
                  await processUpload(allFiles, frameRate);
                  setPendingVideoFiles([]);
                  setPendingImageFiles([]);
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
              >
                Start Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
