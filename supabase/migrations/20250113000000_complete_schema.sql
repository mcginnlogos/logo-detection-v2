-- Complete Logo Detection Database Schema (Idempotent)
-- This migration can be run multiple times safely

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE pricing_type AS ENUM ('one_time', 'recurring');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE pricing_plan_interval AS ENUM ('day', 'week', 'month', 'year');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'unpaid', 'paused');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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
    CREATE TYPE result_type AS ENUM ('logo_detection', 'video_frame_logo_detection');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- USERS TABLE (Stripe Integration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
    full_name TEXT,
    avatar_url TEXT,
    billing_address JSONB,
    payment_method JSONB
);

-- ============================================================================
-- CUSTOMERS TABLE (Stripe Integration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.customers (
    id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
    stripe_customer_id TEXT
);

-- ============================================================================
-- PRODUCTS TABLE (Stripe Integration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    active BOOLEAN,
    name TEXT,
    description TEXT,
    image TEXT,
    metadata JSONB
);

-- ============================================================================
-- PRICES TABLE (Stripe Integration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.prices (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES products,
    active BOOLEAN,
    description TEXT,
    unit_amount BIGINT,
    currency TEXT CHECK (char_length(currency) = 3),
    type pricing_type,
    interval pricing_plan_interval,
    interval_count INTEGER,
    trial_period_days INTEGER,
    metadata JSONB
);

-- ============================================================================
-- SUBSCRIPTIONS TABLE (Stripe Integration)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    status subscription_status,
    metadata JSONB,
    price_id TEXT REFERENCES prices,
    quantity INTEGER,
    cancel_at_period_end BOOLEAN,
    created TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    current_period_start TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    current_period_end TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    ended_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    cancel_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    canceled_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    trial_start TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    trial_end TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- FILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    s3_bucket TEXT NOT NULL,
    s3_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('pending_upload', 'uploading', 'available', 'upload_failed', 'deleting', 'deleted', 'delete_failed')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- JOBS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    job_type job_type NOT NULL,
    status job_status NOT NULL DEFAULT 'pending',
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- ============================================================================
-- PROCESSING_JOBS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.processing_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    processing_type TEXT NOT NULL,
    status processing_job_status NOT NULL DEFAULT 'pending',
    input_s3_uri TEXT NOT NULL,
    frame_index INTEGER,
    frame_timestamp DECIMAL,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PROCESSING_JOB_RESULTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.processing_job_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    file_id UUID NOT NULL REFERENCES public.files(id) ON DELETE CASCADE,
    processing_job_id UUID REFERENCES public.processing_jobs(id) ON DELETE CASCADE,
    result_type result_type NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Files indexes
CREATE INDEX IF NOT EXISTS files_user_id_idx ON public.files(user_id);
CREATE INDEX IF NOT EXISTS files_created_at_idx ON public.files(created_at DESC);
CREATE INDEX IF NOT EXISTS files_name_idx ON public.files(name);
CREATE INDEX IF NOT EXISTS files_s3_bucket_idx ON public.files(s3_bucket);
CREATE INDEX IF NOT EXISTS files_s3_key_idx ON public.files(s3_key);
CREATE INDEX IF NOT EXISTS files_status_idx ON public.files(status);

-- Jobs indexes
CREATE INDEX IF NOT EXISTS jobs_user_id_idx ON public.jobs(user_id);
CREATE INDEX IF NOT EXISTS jobs_file_id_idx ON public.jobs(file_id);
CREATE INDEX IF NOT EXISTS jobs_status_idx ON public.jobs(status);
CREATE INDEX IF NOT EXISTS jobs_created_at_idx ON public.jobs(created_at DESC);

-- Processing jobs indexes
CREATE INDEX IF NOT EXISTS processing_jobs_job_id_idx ON public.processing_jobs(job_id);
CREATE INDEX IF NOT EXISTS processing_jobs_file_id_idx ON public.processing_jobs(file_id);
CREATE INDEX IF NOT EXISTS processing_jobs_user_id_idx ON public.processing_jobs(user_id);
CREATE INDEX IF NOT EXISTS processing_jobs_status_idx ON public.processing_jobs(status);

-- Processing job results indexes
CREATE INDEX IF NOT EXISTS processing_job_results_job_id_idx ON public.processing_job_results(job_id);
CREATE INDEX IF NOT EXISTS processing_job_results_file_id_idx ON public.processing_job_results(file_id);
CREATE INDEX IF NOT EXISTS processing_job_results_processing_job_id_idx ON public.processing_job_results(processing_job_id);
CREATE INDEX IF NOT EXISTS processing_job_results_result_type_idx ON public.processing_job_results(result_type);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, full_name, avatar_url)
    VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate job duration (only for jobs table with metadata)
CREATE OR REPLACE FUNCTION calculate_job_duration()
RETURNS TRIGGER AS $$
BEGIN
    -- Calculate duration when job is completed (only for jobs table)
    -- Jobs table doesn't have started_at, so we use created_at as the start time
    IF (NEW.status IN ('completed', 'failed') AND OLD.status != NEW.status AND NEW.created_at IS NOT NULL AND NEW.completed_at IS NOT NULL) THEN
        NEW.metadata = COALESCE(NEW.metadata, '{}'::jsonb) || 
                      jsonb_build_object('processing_duration_seconds', 
                                       EXTRACT(EPOCH FROM (NEW.completed_at - NEW.created_at)));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for files updated_at
DROP TRIGGER IF EXISTS update_files_updated_at ON public.files;
CREATE TRIGGER update_files_updated_at
    BEFORE UPDATE ON public.files
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for jobs updated_at
DROP TRIGGER IF EXISTS update_jobs_updated_at ON public.jobs;
CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger for jobs duration calculation
DROP TRIGGER IF EXISTS calculate_job_duration_trigger ON public.jobs;
CREATE TRIGGER calculate_job_duration_trigger
    BEFORE UPDATE ON public.jobs
    FOR EACH ROW EXECUTE FUNCTION calculate_job_duration();

-- Trigger for processing_jobs updated_at
DROP TRIGGER IF EXISTS update_processing_jobs_updated_at ON public.processing_jobs;
CREATE TRIGGER update_processing_jobs_updated_at
    BEFORE UPDATE ON public.processing_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processing_job_results ENABLE ROW LEVEL SECURITY;

-- Users policies
DROP POLICY IF EXISTS "Can view own user data." ON public.users;
CREATE POLICY "Can view own user data." ON public.users
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Can update own user data." ON public.users;
CREATE POLICY "Can update own user data." ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Products policies (public read-only)
DROP POLICY IF EXISTS "Allow public read-only access." ON public.products;
CREATE POLICY "Allow public read-only access." ON public.products
    FOR SELECT USING (true);

-- Prices policies (public read-only)
DROP POLICY IF EXISTS "Allow public read-only access." ON public.prices;
CREATE POLICY "Allow public read-only access." ON public.prices
    FOR SELECT USING (true);

-- Subscriptions policies
DROP POLICY IF EXISTS "Can only view own subs data." ON public.subscriptions;
CREATE POLICY "Can only view own subs data." ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- Files policies
DROP POLICY IF EXISTS "Users can view own files" ON public.files;
CREATE POLICY "Users can view own files" ON public.files
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own files" ON public.files;
CREATE POLICY "Users can insert own files" ON public.files
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own files" ON public.files;
CREATE POLICY "Users can update own files" ON public.files
    FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own files" ON public.files;
CREATE POLICY "Users can delete own files" ON public.files
    FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage files" ON public.files;
CREATE POLICY "Service role can manage files" ON public.files
    FOR ALL USING (auth.role() = 'service_role');

-- Jobs policies
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

-- Processing jobs policies
DROP POLICY IF EXISTS "Users can view their own processing jobs" ON public.processing_jobs;
CREATE POLICY "Users can view their own processing jobs" ON public.processing_jobs
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage processing jobs" ON public.processing_jobs;
CREATE POLICY "Service role can manage processing jobs" ON public.processing_jobs
    FOR ALL USING (auth.role() = 'service_role');

-- Processing job results policies
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

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT ON public.users TO authenticated;
GRANT INSERT, UPDATE ON public.users TO authenticated;

GRANT SELECT ON public.products TO authenticated;
GRANT SELECT ON public.prices TO authenticated;
GRANT SELECT ON public.subscriptions TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.files TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.jobs TO authenticated;
GRANT SELECT ON public.processing_jobs TO authenticated;
GRANT SELECT ON public.processing_job_results TO authenticated;

GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.customers TO service_role;
GRANT ALL ON public.products TO service_role;
GRANT ALL ON public.prices TO service_role;
GRANT ALL ON public.subscriptions TO service_role;
GRANT ALL ON public.files TO service_role;
GRANT ALL ON public.jobs TO service_role;
GRANT ALL ON public.processing_jobs TO service_role;
GRANT ALL ON public.processing_job_results TO service_role;

-- ============================================================================
-- REALTIME PUBLICATION
-- ============================================================================

DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE products, prices;
