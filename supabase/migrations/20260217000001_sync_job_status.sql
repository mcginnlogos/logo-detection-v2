-- Sync job_status enum with complete_schema
-- Production has old enum, this updates it to match

ALTER TABLE public.jobs ALTER COLUMN status DROP DEFAULT;

ALTER TYPE public.job_status RENAME TO job_status__old_version_to_be_dropped;

CREATE TYPE public.job_status AS ENUM ('pending', 'processing', 'completed', 'failed');

ALTER TABLE public.jobs ALTER COLUMN status TYPE public.job_status USING status::text::public.job_status;

ALTER TABLE public.jobs ALTER COLUMN status SET DEFAULT 'pending'::public.job_status;

DROP TYPE public.job_status__old_version_to_be_dropped;
