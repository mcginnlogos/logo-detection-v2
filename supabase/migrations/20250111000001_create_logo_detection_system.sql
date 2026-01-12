-- Create enums for job status
CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- Create logo detection jobs table
CREATE TABLE IF NOT EXISTS public.logo_detection_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
    status job_status DEFAULT 'pending' NOT NULL,
    sqs_message_id TEXT, -- SQS message ID for tracking
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create logo detections results table
CREATE TABLE IF NOT EXISTS public.logo_detections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES public.logo_detection_jobs(id) ON DELETE CASCADE,
    logo_name TEXT NOT NULL,
    confidence_score DECIMAL(5,4) NOT NULL, -- 0.0000 to 1.0000
    bounding_box JSONB NOT NULL, -- {x, y, width, height} normalized coordinates
    detection_metadata JSONB, -- Additional metadata from Bedrock
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.logo_detection_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logo_detections ENABLE ROW LEVEL SECURITY;

-- RLS policies for logo_detection_jobs
CREATE POLICY "Users can view own logo detection jobs" ON public.logo_detection_jobs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own logo detection jobs" ON public.logo_detection_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all logo detection jobs" ON public.logo_detection_jobs
    FOR ALL USING (auth.role() = 'service_role');

-- RLS policies for logo_detections
CREATE POLICY "Users can view own logo detections" ON public.logo_detections
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.logo_detection_jobs j 
            WHERE j.id = logo_detections.job_id AND j.user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage all logo detections" ON public.logo_detections
    FOR ALL USING (auth.role() = 'service_role');

-- Create indexes for performance
CREATE INDEX logo_detection_jobs_user_id_idx ON public.logo_detection_jobs(user_id);
CREATE INDEX logo_detection_jobs_status_idx ON public.logo_detection_jobs(status);
CREATE INDEX logo_detection_jobs_file_id_idx ON public.logo_detection_jobs(file_id);
CREATE INDEX logo_detection_jobs_created_at_idx ON public.logo_detection_jobs(created_at);
CREATE INDEX logo_detection_jobs_sqs_message_id_idx ON public.logo_detection_jobs(sqs_message_id);

CREATE INDEX logo_detections_job_id_idx ON public.logo_detections(job_id);
CREATE INDEX logo_detections_logo_name_idx ON public.logo_detections(logo_name);
CREATE INDEX logo_detections_confidence_score_idx ON public.logo_detections(confidence_score);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_logo_detection_jobs_updated_at 
    BEFORE UPDATE ON public.logo_detection_jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();