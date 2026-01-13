-- Complete Processing System Migration (Idempotent)
-- This migration can be run multiple times safely

-- Create enums if they don't exist
DO $$ BEGIN
    CREATE TYPE job_type AS ENUM ('image_processing', 'video_processing');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE processing_job_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE result_type AS ENUM ('logo_detection', 'video_frame_logo_detection', 'video_summary');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create jobs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_id UUID NOT NULL,
    user_id UUID NOT NULL,
    job_type job_type NOT NULL,
    status job_status NOT NULL DEFAULT 'pending',
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Add foreign key constraints if they don't exist
DO $$ BEGIN
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_file_id_fkey 
        FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create processing_jobs table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.processing_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID NOT NULL,
    file_id UUID NOT NULL,
    user_id UUID NOT NULL,
    processing_type TEXT NOT NULL,
    status processing_job_status NOT NULL DEFAULT 'pending',
    bedrock_job_arn TEXT,
    bedrock_job_name TEXT,
    input_s3_uri TEXT NOT NULL,
    output_s3_uri TEXT NOT NULL,
    frame_index INTEGER,
    frame_timestamp DECIMAL,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraints for processing_jobs
DO $$ BEGIN
    ALTER TABLE public.processing_jobs ADD CONSTRAINT processing_jobs_job_id_fkey 
        FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE public.processing_jobs ADD CONSTRAINT processing_jobs_file_id_fkey 
        FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE public.processing_jobs ADD CONSTRAINT processing_jobs_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create processing_job_results table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.processing_job_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID NOT NULL,
    file_id UUID NOT NULL,
    processing_job_id UUID,
    result_type result_type NOT NULL,
    confidence_score DECIMAL(5,4),
    bounding_box JSONB,
    detected_text TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key constraints for processing_job_results
DO $$ BEGIN
    ALTER TABLE public.processing_job_results ADD CONSTRAINT processing_job_results_job_id_fkey 
        FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE public.processing_job_results ADD CONSTRAINT processing_job_results_file_id_fkey 
        FOREIGN KEY (file_id) REFERENCES public.files(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE public.processing_job_results ADD CONSTRAINT processing_job_results_processing_job_id_fkey 
        FOREIGN KEY (processing_job_id) REFERENCES public.processing_jobs(id) ON DELETE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS jobs_user_id_idx ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS jobs_file_id_idx ON public.jobs(file_id);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON public.jobs(status);
CREATE INDEX IF NOT EXISTS jobs_created_at_idx ON public.jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS processing_jobs_job_id_idx ON public.processing_jobs(job_id);
CREATE INDEX IF NOT EXISTS processing_jobs_file_id_idx ON public.processing_jobs(file_id);
CREATE INDEX IF NOT EXISTS processing_jobs_user_id_idx ON public.processing_jobs(user_id);
CREATE INDEX IF NOT EXISTS processing_jobs_status_idx ON public.processing_jobs(status);
CREATE INDEX IF NOT EXISTS processing_jobs_bedrock_job_arn_idx ON public.processing_jobs(bedrock_job_arn);

CREATE INDEX IF NOT EXISTS processing_job_results_job_id_idx ON public.processing_job_results(job_id);
CREATE INDEX IF NOT EXISTS processing_job_results_file_id_idx ON public.processing_job_results(file_id);
CREATE INDEX IF NOT EXISTS processing_job_results_processing_job_id_idx ON public.processing_job_results(processing_job_id);
CREATE INDEX IF NOT EXISTS processing_job_results_result_type_idx ON public.processing_job_results(result_type);

-- Create or replace functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION calculate_job_duration()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate duration when job is completed
    IF (NEW.status IN ('completed', 'failed') AND OLD.status != NEW.status AND NEW.started_at IS NOT NULL) THEN
        NEW.metadata = COALESCE(NEW.metadata, '{}'::jsonb) || 
                      jsonb_build_object('processing_duration_seconds', 
                                       EXTRACT(EPOCH FROM (NEW.completed_at - NEW.started_at)));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers if they don't exist (drop first to ensure clean state)
DROP TRIGGER IF EXISTS update_jobs_updated_at ON public.jobs;
CREATE TRIGGER update_jobs_updated_at 
    BEFORE UPDATE ON public.jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_processing_jobs_updated_at ON public.processing_jobs;
CREATE TRIGGER update_processing_jobs_updated_at 
    BEFORE UPDATE ON public.processing_jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS calculate_processing_job_duration ON public.processing_jobs;
CREATE TRIGGER calculate_processing_job_duration
    BEFORE UPDATE ON public.processing_jobs
    FOR EACH ROW
    EXECUTE FUNCTION calculate_job_duration();

-- Create or replace views
CREATE OR REPLACE VIEW job_summary AS
SELECT 
    j.id,
    j.file_id,
    j.user_id,
    j.job_type,
    j.status,
    j.created_at,
    j.completed_at,
    f.original_name as file_name,
    f.mime_type,
    f.size as file_size,
    COUNT(pj.id) as processing_jobs_count,
    COUNT(pjr.id) as results_count,
    AVG(pjr.confidence_score) as avg_confidence_score
FROM public.jobs j
LEFT JOIN public.files f ON j.file_id = f.id
LEFT JOIN public.processing_jobs pj ON j.id = pj.job_id
LEFT JOIN public.processing_job_results pjr ON j.id = pjr.job_id
GROUP BY j.id, f.original_name, f.mime_type, f.size;

CREATE OR REPLACE VIEW user_processing_stats AS
SELECT 
    user_id,
    COUNT(*) as total_jobs,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_jobs,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_jobs,
    COUNT(*) FILTER (WHERE status IN ('pending', 'processing')) as active_jobs,
    COUNT(*) FILTER (WHERE job_type = 'image_processing') as image_jobs,
    COUNT(*) FILTER (WHERE job_type = 'video_processing') as video_jobs,
    MAX(created_at) as last_job_created
FROM public.jobs
GROUP BY user_id;

-- Enable RLS
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_job_results ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Users can view their own jobs" ON public.jobs;
CREATE POLICY "Users can view their own jobs" ON public.jobs
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own jobs" ON public.jobs;
CREATE POLICY "Users can insert their own jobs" ON public.jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own jobs" ON public.jobs;
CREATE POLICY "Users can update their own jobs" ON public.jobs
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage jobs" ON public.jobs;
CREATE POLICY "Service role can manage jobs" ON public.jobs
    FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can view their own processing jobs" ON public.processing_jobs;
CREATE POLICY "Users can view their own processing jobs" ON public.processing_jobs
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage processing jobs" ON public.processing_jobs;
CREATE POLICY "Service role can manage processing jobs" ON public.processing_jobs
    FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users can view their own results" ON public.processing_job_results;
CREATE POLICY "Users can view their own results" ON public.processing_job_results
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.jobs j 
            WHERE j.id = processing_job_results.job_id 
            AND j.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Service role can manage results" ON public.processing_job_results;
CREATE POLICY "Service role can manage results" ON public.processing_job_results
    FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions (these are idempotent)
GRANT SELECT ON public.jobs TO authenticated;
GRANT INSERT, UPDATE ON public.jobs TO authenticated;
GRANT SELECT ON public.processing_jobs TO authenticated;
GRANT SELECT ON public.processing_job_results TO authenticated;

GRANT ALL ON public.jobs TO service_role;
GRANT ALL ON public.processing_jobs TO service_role;
GRANT ALL ON public.processing_job_results TO service_role;

-- Grant access to views
GRANT SELECT ON job_summary TO authenticated;
GRANT SELECT ON user_processing_stats TO authenticated;
GRANT SELECT ON job_summary TO service_role;
GRANT SELECT ON user_processing_stats TO service_role;

-- Update existing logo_detection_jobs table if it exists (for backward compatibility)
DO $$ 
BEGIN
    -- Add new columns to logo_detection_jobs if they don't exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'logo_detection_jobs') THEN
        -- Add bedrock columns if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'logo_detection_jobs' AND column_name = 'bedrock_job_arn') THEN
            ALTER TABLE public.logo_detection_jobs ADD COLUMN bedrock_job_arn TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'logo_detection_jobs' AND column_name = 'bedrock_job_id') THEN
            ALTER TABLE public.logo_detection_jobs ADD COLUMN bedrock_job_id TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'logo_detection_jobs' AND column_name = 'input_s3_uri') THEN
            ALTER TABLE public.logo_detection_jobs ADD COLUMN input_s3_uri TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'logo_detection_jobs' AND column_name = 'output_s3_uri') THEN
            ALTER TABLE public.logo_detection_jobs ADD COLUMN output_s3_uri TEXT;
        END IF;
        
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'logo_detection_jobs' AND column_name = 'processing_duration_seconds') THEN
            ALTER TABLE public.logo_detection_jobs ADD COLUMN processing_duration_seconds INTEGER;
        END IF;
        
        -- Add indexes for logo_detection_jobs
        CREATE INDEX IF NOT EXISTS logo_detection_jobs_bedrock_job_arn_idx ON public.logo_detection_jobs(bedrock_job_arn);
        CREATE INDEX IF NOT EXISTS logo_detection_jobs_bedrock_job_id_idx ON public.logo_detection_jobs(bedrock_job_id);
    END IF;
END $$;