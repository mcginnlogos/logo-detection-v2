-- Add status and error_message columns to existing files table
ALTER TABLE public.files 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'available' 
CHECK (status IN ('pending_upload', 'uploading', 'available', 'upload_failed', 'deleting', 'deleted', 'delete_failed'));

ALTER TABLE public.files 
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Create index for status column
CREATE INDEX IF NOT EXISTS files_status_idx ON public.files(status);

-- Update existing files to 'available' status (since they're already uploaded)
UPDATE public.files 
SET status = 'available' 
WHERE status IS NULL OR status = 'available';