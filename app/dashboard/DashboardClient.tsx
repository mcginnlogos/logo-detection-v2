'use client';

import { useState, useCallback } from 'react';
import { Upload, Film, Sparkles, FileVideo, Scan } from 'lucide-react';

interface DashboardClientProps {
  user: any;
}

export default function DashboardClient({ user }: DashboardClientProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<any[]>([]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('video/') || file.type.startsWith('image/')
    );
    if (files.length > 0) {
      console.log('Files dropped:', files);
      // TODO: Handle file upload
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      console.log('Files selected:', files);
      // TODO: Handle file upload
    }
  }, []);

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
                  {isDragging ? 'Drop your files here' : 'Drag & drop video or image files'}
                </p>
                <p className="text-sm text-muted-foreground">
                  or <span className="text-primary underline underline-offset-4">browse files</span>
                </p>
                <p className="text-xs text-muted-foreground/60 mt-4">
                  Supports MP4, MOV, AVI, WebM, PNG, JPG, JPEG • Max 500MB per file
                </p>
              </div>

              <input
                type="file"
                accept="video/*,image/*"
                multiple
                onChange={handleFileInput}
                className="absolute inset-0 opacity-0 cursor-pointer"
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
        {uploadedFiles.length === 0 && (
          <div className="text-center py-16 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-secondary/50 mb-4">
              <Scan className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <p className="text-muted-foreground">
              No files yet. Upload your first video or image to get started!
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
