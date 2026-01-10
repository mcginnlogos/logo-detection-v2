'use client';

import { useState } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { useEffect } from 'react';
import FileUpload from '@/components/ui/FileUpload/FileUpload';
import FileGrid from '@/components/ui/FileGrid/FileGrid';
import { getMaxFileSizeMB } from '@/utils/file-config';

export default function FilesPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error || !user) {
        redirect('/signin');
        return;
      }
      
      setUser(user);
      setLoading(false);
    };

    checkAuth();
  }, []);

  const handleUploadComplete = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="bg-black min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="bg-black min-h-screen">
      <div className="max-w-6xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">
            Files
          </h1>
          <p className="text-zinc-400">
            Upload and manage your files. Supports images and videos up to {getMaxFileSizeMB()}MB each.
          </p>
        </div>

        <div className="space-y-8">
          {/* File Upload Section */}
          <div className="bg-zinc-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              Upload Files
            </h2>
            <FileUpload onUploadComplete={handleUploadComplete} />
          </div>

          {/* File Grid Section */}
          <div className="bg-zinc-900 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              Your Files
            </h2>
            <FileGrid refreshTrigger={refreshTrigger} />
          </div>
        </div>
      </div>
    </div>
  );
}