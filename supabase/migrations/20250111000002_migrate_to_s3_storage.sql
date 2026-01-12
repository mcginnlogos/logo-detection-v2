-- Migration to switch from Supabase Storage to S3
-- Remove Supabase Storage and update files table for S3

-- Drop all Supabase Storage policies
DROP POLICY IF EXISTS "Users can upload own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;

-- Remove the storage bucket
DELETE FROM storage.buckets WHERE id = 'user-files';

-- Update files table for S3
ALTER TABLE public.files 
ADD COLUMN IF NOT EXISTS s3_bucket TEXT NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS s3_key TEXT NOT NULL DEFAULT '';

-- Remove the default constraints after adding the columns
ALTER TABLE public.files ALTER COLUMN s3_bucket DROP DEFAULT;
ALTER TABLE public.files ALTER COLUMN s3_key DROP DEFAULT;

-- Create indexes on S3 fields
CREATE INDEX IF NOT EXISTS files_s3_bucket_idx ON public.files(s3_bucket);
CREATE INDEX IF NOT EXISTS files_s3_key_idx ON public.files(s3_key);

-- Update storage_path to be nullable since we're using s3_key now
ALTER TABLE public.files ALTER COLUMN storage_path DROP NOT NULL;