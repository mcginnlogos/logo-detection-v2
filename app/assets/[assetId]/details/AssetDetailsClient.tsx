'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, ArrowLeft, Loader2 } from 'lucide-react';
import Image from 'next/image';
import VideoAnalytics from '@/components/ui/VideoAnalytics';
import ExportDropdown from '@/components/ui/ExportDropdown';
import { calculateLogoPresence, LogoDetection as AnalyticsLogoDetection, exportToCSV, exportToJSON } from '@/utils/logo-analytics';

interface ProcessingJobResult {
  id: string;
  job_id: string;
  file_id: string;
  processing_job_id: string;
  result_type: string;
  metadata: {
    processed_at: string;
    bedrock_response: {
      outputSegments: Array<{
        standardOutput: string; // This is a JSON string that needs to be parsed
      }>;
      semanticModality: string;
    };
  };
  frame_index: number | null;
  frame_timestamp: number | null;
  created_at: string;
}

interface LogoDetection {
  id: string;
  type: string;
  confidence: number;
  name: string;
  locations: Array<{
    bounding_box: {
      left: number;
      top: number;
      width: number;
      height: number;
    };
  }>;
}

interface ParsedImageData {
  summary: string;
  logos: LogoDetection[];
}

interface ParsedOutput {
  image: ParsedImageData;
  statistics: {
    logo_count: number;
  };
  metadata: {
    semantic_modality: string;
    image_width_pixels: number;
    image_height_pixels: number;
    image_encoding: string;
    s3_bucket: string;
    s3_key: string;
  };
}

interface Job {
  id: string;
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

interface AssetDetailsClientProps {
  user: any;
  assetId: string;
}

export default function AssetDetailsClient({ user, assetId }: AssetDetailsClientProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [asset, setAsset] = useState<Asset | null>(null);
  const [allResults, setAllResults] = useState<ProcessingJobResult[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showBoundingBoxes, setShowBoundingBoxes] = useState(false);
  const [selectedLogo, setSelectedLogo] = useState<string | null>(null);

  const isVideo = asset?.mime_type.startsWith('video/');
  const isImage = asset?.mime_type.startsWith('image/');

  // Parse the standardOutput JSON from results
  const parseResultData = (result: ProcessingJobResult): ParsedOutput | null => {
    try {
      const standardOutput = result.metadata?.bedrock_response?.outputSegments?.[0]?.standardOutput;
      if (standardOutput) {
        return JSON.parse(standardOutput);
      }
    } catch (error) {
      console.error('Error parsing result data:', error);
    }
    return null;
  };

  // Get unique frames sorted by frame_index (for videos)
  const frames = allResults
    .filter(r => r.frame_index !== null)
    .sort((a, b) => (a.frame_index || 0) - (b.frame_index || 0))
    .reduce((acc, result) => {
      // Group by frame_index to avoid duplicates
      const existing = acc.find(r => r.frame_index === result.frame_index);
      if (!existing) {
        acc.push(result);
      }
      return acc;
    }, [] as ProcessingJobResult[]);

  // Get results for current frame (videos) or all results (images)
  const currentFrameResults = isVideo 
    ? allResults.filter(r => r.frame_index === frames[currentFrameIndex]?.frame_index)
    : allResults; // For images, show all results

  // Get all logos from current frame results
  const currentFrameLogos: Array<{ logo: LogoDetection; index: number }> = [];
  currentFrameResults.forEach(result => {
    const parsedData = parseResultData(result);
    if (parsedData?.image.logos) {
      parsedData.image.logos.forEach((logo, idx) => {
        currentFrameLogos.push({ logo, index: currentFrameLogos.length + 1 });
      });
    }
  });

  // Calculate logo analytics for videos
  const frameGapTolerance = parseInt(process.env.NEXT_PUBLIC_LOGO_FRAME_GAP_TOLERANCE || '1', 10);
  
  const logoAnalytics = useMemo(() => {
    if (!isVideo || allResults.length === 0) return null;

    const detections: AnalyticsLogoDetection[] = [];
    
    allResults.forEach(result => {
      const parsedData = parseResultData(result);
      if (parsedData?.image.logos && result.frame_index !== null && result.frame_timestamp !== null) {
        parsedData.image.logos.forEach(logo => {
          detections.push({
            id: logo.id,
            name: logo.name,
            confidence: logo.confidence,
            frameIndex: result.frame_index!,
            timestamp: Number(result.frame_timestamp),
          });
        });
      }
    });

    const presences = calculateLogoPresence(detections, frameGapTolerance);
    
    // Calculate video duration: last frame timestamp + average frame spacing
    const sortedResults = [...allResults].sort((a, b) => 
      (a.frame_timestamp || 0) - (b.frame_timestamp || 0)
    );
    
    let videoDuration = 0;
    if (sortedResults.length > 0) {
      const lastTimestamp = Number(sortedResults[sortedResults.length - 1].frame_timestamp || 0);
      
      // Calculate average frame spacing
      let avgSpacing = 0.033; // Default 30fps
      if (sortedResults.length > 1) {
        const spacings: number[] = [];
        for (let i = 1; i < sortedResults.length; i++) {
          const timeDiff = Number(sortedResults[i].frame_timestamp || 0) - Number(sortedResults[i - 1].frame_timestamp || 0);
          if (timeDiff > 0) {
            spacings.push(timeDiff);
          }
        }
        if (spacings.length > 0) {
          avgSpacing = spacings.reduce((sum, s) => sum + s, 0) / spacings.length;
        }
      }
      
      videoDuration = lastTimestamp + avgSpacing;
    }

    return {
      presences,
      videoDuration,
    };
  }, [allResults, isVideo]);

  const handleLogoClick = (logoName: string, timestamp: number) => {
    setSelectedLogo(logoName);
    
    // Find the frame closest to this timestamp
    const targetFrame = frames.findIndex(f => Number(f.frame_timestamp) >= timestamp);
    if (targetFrame !== -1) {
      setCurrentFrameIndex(targetFrame);
    }
    
    // Seek video
    if (videoRef.current) {
      videoRef.current.currentTime = timestamp;
    }
  };

  const handleExport = (format: 'csv' | 'json') => {
    const timestamp = new Date().toISOString().split('T')[0];
    const baseFilename = asset?.original_name.replace(/\.[^/.]+$/, '') || 'export';
    const filename = `${baseFilename}-logos-${timestamp}.${format}`;

    if (isVideo && logoAnalytics) {
      // Export video analytics
      if (format === 'csv') {
        exportToCSV(logoAnalytics.presences, filename);
      } else {
        exportToJSON(logoAnalytics.presences, filename);
      }
    } else if (isImage) {
      // Export image logos
      const logos = currentFrameLogos.map(({ logo }) => ({
        name: logo.name,
        confidence: logo.confidence,
        locations: logo.locations,
      }));

      if (format === 'csv') {
        const headers = ['Logo Name', 'Confidence', 'X Position', 'Y Position', 'Width', 'Height'];
        const rows = logos.flatMap(logo =>
          logo.locations.map(loc => [
            logo.name,
            (logo.confidence * 100).toFixed(1) + '%',
            (loc.bounding_box.left * 100).toFixed(1) + '%',
            (loc.bounding_box.top * 100).toFixed(1) + '%',
            (loc.bounding_box.width * 100).toFixed(1) + '%',
            (loc.bounding_box.height * 100).toFixed(1) + '%',
          ])
        );
        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const data = {
          filename: asset?.original_name,
          totalLogos: logos.length,
          logos: logos.map(logo => ({
            name: logo.name,
            confidence: logo.confidence,
            locations: logo.locations.map(loc => loc.bounding_box),
          })),
        };
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }
  };

  // Fetch asset and results
  const fetchAssetAndResults = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Fetch asset info
      const response = await fetch('/api/assets');
      if (response.ok) {
        const data = await response.json();
        const foundAsset = data.assets.find((a: Asset) => a.id === assetId);
        
        if (!foundAsset) {
          console.error('Asset not found');
          return;
        }

        setAsset(foundAsset);

        // Get completed job
        const completedJob = foundAsset.jobs.find((j: Job) => j.status === 'completed');
        
        if (completedJob) {
          // Fetch all processing job results for this job
          const resultsResponse = await fetch(
            `/api/processing-job-results?jobId=${completedJob.id}`
          );
          
          if (resultsResponse.ok) {
            const resultsData = await resultsResponse.json();
            setAllResults(resultsData.results || []);
          }
        }

        // Fetch presigned URL for the file
        const urlResponse = await fetch('/api/assets/presigned-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileId: assetId }),
        });
        
        if (urlResponse.ok) {
          const urlData = await urlResponse.json();
          setFileUrl(urlData.url);
        }
      }
    } catch (error) {
      console.error('Error fetching asset:', error);
    } finally {
      setIsLoading(false);
    }
  }, [assetId]);

  // Load asset on mount
  useEffect(() => {
    fetchAssetAndResults();
  }, [fetchAssetAndResults]);

  // Seek video to current frame timestamp
  useEffect(() => {
    if (videoRef.current && isVideo && frames.length > 0) {
      const currentFrame = frames[currentFrameIndex];
      if (currentFrame?.frame_timestamp !== null && currentFrame?.frame_timestamp !== undefined) {
        videoRef.current.currentTime = Number(currentFrame.frame_timestamp);
      }
    }
  }, [currentFrameIndex, frames, isVideo]);

  const handlePreviousFrame = () => {
    if (currentFrameIndex > 0) {
      setCurrentFrameIndex(currentFrameIndex - 1);
    }
  };

  const handleNextFrame = () => {
    if (currentFrameIndex < frames.length - 1) {
      setCurrentFrameIndex(currentFrameIndex + 1);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading asset details...</p>
        </div>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Asset not found</p>
        </div>
      </div>
    );
  }

  const currentFrame = frames[currentFrameIndex];

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row items-start justify-between gap-4">
          <div>
            <button
              onClick={() => router.push('/assets')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Assets
            </button>
            <h1 className="text-3xl font-bold text-foreground mb-2">{asset.original_name}</h1>
            <p className="text-muted-foreground">
              {(asset.size / (1024 * 1024)).toFixed(2)} MB • {asset.mime_type}
            </p>
          </div>
          <div className="sm:mt-8">
            <ExportDropdown onExport={handleExport} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Media viewer */}
          <div className="lg:col-span-2">
            <div className="rounded-xl overflow-hidden bg-card border border-border">
              {/* Media display */}
              <div className="aspect-video bg-secondary/50 relative">
                {fileUrl && isImage && (
                  <>
                    <Image
                      src={fileUrl}
                      alt={asset.original_name}
                      fill
                      className="object-contain"
                      unoptimized
                    />
                    {/* Bounding boxes for images */}
                    {showBoundingBoxes && currentFrameLogos.map(({ logo, index }) => (
                      logo.locations.map((location, locIdx) => (
                        <div
                          key={`${logo.id}-${locIdx}`}
                          className="absolute border-2 border-primary pointer-events-none"
                          style={{
                            left: `${location.bounding_box.left * 100}%`,
                            top: `${location.bounding_box.top * 100}%`,
                            width: `${location.bounding_box.width * 100}%`,
                            height: `${location.bounding_box.height * 100}%`,
                          }}
                        >
                          {/* Number badge */}
                          <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow-lg">
                            {index}
                          </div>
                        </div>
                      ))
                    ))}
                  </>
                )}
                {fileUrl && isVideo && (
                  <div className="relative w-full h-full">
                    <video
                      ref={videoRef}
                      src={fileUrl}
                      className="w-full h-full object-contain"
                      controls
                      preload="metadata"
                      playsInline
                    />
                    {/* Bounding boxes for videos */}
                    {showBoundingBoxes && currentFrameLogos.map(({ logo, index }) => (
                      logo.locations.map((location, locIdx) => (
                        <div
                          key={`${logo.id}-${locIdx}`}
                          className="absolute border-2 border-primary pointer-events-none"
                          style={{
                            left: `${location.bounding_box.left * 100}%`,
                            top: `${location.bounding_box.top * 100}%`,
                            width: `${location.bounding_box.width * 100}%`,
                            height: `${location.bounding_box.height * 100}%`,
                          }}
                        >
                          {/* Number badge */}
                          <div className="absolute -top-3 -left-3 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow-lg">
                            {index}
                          </div>
                        </div>
                      ))
                    ))}
                  </div>
                )}
                {!fileUrl && (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                  </div>
                )}
              </div>

              {/* Frame navigation for videos */}
              {isVideo && frames.length > 0 && (
                <div className="p-4 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <button
                      onClick={handlePreviousFrame}
                      disabled={currentFrameIndex === 0}
                      className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    
                    <div className="text-center">
                      <p className="text-sm font-medium text-foreground">
                        Frame {currentFrameIndex + 1} of {frames.length}
                      </p>
                      {currentFrame?.frame_timestamp !== null && currentFrame?.frame_timestamp !== undefined && (
                        <p className="text-xs text-muted-foreground">
                          {Number(currentFrame.frame_timestamp).toFixed(2)}s
                        </p>
                      )}
                    </div>

                    <button
                      onClick={handleNextFrame}
                      disabled={currentFrameIndex === frames.length - 1}
                      className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Frame progress bar */}
                  <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{
                        width: `${((currentFrameIndex + 1) / frames.length) * 100}%`,
                      }}
                    />
                  </div>

                  {/* Bounding box toggle */}
                  <div className="mt-3 flex items-center justify-center">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showBoundingBoxes}
                        onChange={(e) => setShowBoundingBoxes(e.target.checked)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-0"
                      />
                      <span className="text-sm text-muted-foreground">Show bounding boxes</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Bounding box toggle for images */}
              {isImage && (
                <div className="p-4 border-t border-border">
                  <div className="flex items-center justify-center">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showBoundingBoxes}
                        onChange={(e) => setShowBoundingBoxes(e.target.checked)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-0"
                      />
                      <span className="text-sm text-muted-foreground">Show bounding boxes</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Results panel */}
          <div className="lg:col-span-1 lg:self-start">
            <div className="rounded-xl bg-card border border-border p-6 max-h-[600px] lg:max-h-[600px] overflow-y-auto">
              <h2 className="text-xl font-semibold text-foreground mb-4">Detection Results</h2>
              
              {currentFrameResults.length > 0 ? (
                <div className="space-y-4">
                  {currentFrameResults.map((result) => {
                    const parsedData = parseResultData(result);
                    
                    if (!parsedData) {
                      return (
                        <div key={result.id} className="text-xs text-muted-foreground">
                          Unable to parse result data
                        </div>
                      );
                    }

                    // Track logo index across all results
                    let logoIndexCounter = 0;

                    return (
                      <div key={result.id} className="space-y-4">
                        {/* Image Summary */}
                        {parsedData.image.summary && (
                          <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                            <h3 className="text-sm font-semibold text-foreground mb-2">Scene Description</h3>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                              {parsedData.image.summary}
                            </p>
                          </div>
                        )}

                        {/* Logo Detections */}
                        {parsedData.image.logos && parsedData.image.logos.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h3 className="text-sm font-semibold text-foreground">
                                Detected Logos ({parsedData.statistics.logo_count})
                              </h3>
                            </div>
                            
                            {parsedData.image.logos.map((logo) => {
                              logoIndexCounter++;
                              const currentIndex = logoIndexCounter;
                              
                              return (
                                <div
                                  key={logo.id}
                                  className="p-4 rounded-lg bg-primary/10 border border-primary/20"
                                >
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <h4 className="text-sm font-medium text-foreground capitalize">
                                        {logo.name}
                                      </h4>
                                      <p className="text-xs text-muted-foreground mt-1">
                                        Confidence: {(logo.confidence * 100).toFixed(1)}%
                                      </p>
                                    </div>
                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                                      {currentIndex}
                                    </div>
                                  </div>
                                  
                                  {/* Bounding Box Info */}
                                  {logo.locations && logo.locations.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-primary/20">
                                      <p className="text-xs text-muted-foreground mb-2">Location:</p>
                                      {logo.locations.map((location, locIndex) => (
                                        <div key={locIndex} className="grid grid-cols-2 gap-2 text-xs">
                                          <div>
                                            <span className="text-muted-foreground">X: </span>
                                            <span className="font-medium text-foreground">
                                              {(location.bounding_box.left * 100).toFixed(1)}%
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground">Y: </span>
                                            <span className="font-medium text-foreground">
                                              {(location.bounding_box.top * 100).toFixed(1)}%
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground">Width: </span>
                                            <span className="font-medium text-foreground">
                                              {(location.bounding_box.width * 100).toFixed(1)}%
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-muted-foreground">Height: </span>
                                            <span className="font-medium text-foreground">
                                              {(location.bounding_box.height * 100).toFixed(1)}%
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* No Logos Found */}
                        {(!parsedData.image.logos || parsedData.image.logos.length === 0) && (
                          <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                            <p className="text-xs text-muted-foreground text-center">
                              No logos detected in this frame
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No detection results available for this {isVideo ? 'frame' : 'image'}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Video Analytics Section */}
        {isVideo && logoAnalytics && logoAnalytics.presences.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold text-foreground mb-6">Video Analytics</h2>
            <VideoAnalytics
              logoPresences={logoAnalytics.presences}
              videoDuration={logoAnalytics.videoDuration}
              onLogoClick={handleLogoClick}
              selectedLogo={selectedLogo}
            />
          </div>
        )}
      </main>
    </div>
  );
}
