# File Upload System

This document describes the file upload system implementation for the application.

## Features

- **Drag & Drop Upload**: Users can drag files directly onto the upload area
- **File Explorer**: Click to browse and select files from the file system
- **Multiple File Upload**: Upload multiple files simultaneously
- **File Type Validation**: Supports images (.png, .jpg, .jpeg, .webp) and videos (.mov, .mp4, .avi, .mkv, .webm)
- **File Size Limit**: Configurable via `NEXT_PUBLIC_MAX_FILE_SIZE_MB` environment variable (defaults to 10MB)
- **User Isolation**: Files are stored with user ID prefix for security
- **Row Level Security (RLS)**: Database policies ensure users can only access their own files
- **S3 Storage**: Files are stored in AWS S3 with user-based access control
- **File Preview**: Click on files to preview images and videos
- **Sorting Options**: Sort by newest, oldest, A-Z, or Z-A
- **View Modes**: Grid or list view for file display
- **File Management**: Delete files with confirmation

## Architecture

### Database Schema

The `files` table stores metadata about uploaded files:

```sql
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    original_name TEXT NOT NULL,
    size BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    s3_bucket TEXT NOT NULL,    -- S3 bucket name
    s3_key TEXT NOT NULL,       -- S3 object key
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Storage Structure

Files are stored in AWS S3 with the following structure:
```
s3://bucket-name/
├── users/
│   ├── {user_id}/
│   │   ├── {timestamp}_{random}.{ext}
│   │   └── {timestamp}_{random}.{ext}
│   └── {another_user_id}/
│       ├── {timestamp}_{random}.{ext}
│       └── {timestamp}_{random}.{ext}
```

### API Endpoints

- `POST /api/files/upload` - Upload multiple files to S3
- `GET /api/files?sortBy={option}` - Fetch user's files with sorting
- `DELETE /api/files?id={fileId}` - Delete a specific file from S3 and database
- `GET /api/files/{id}/preview` - Get presigned URL for file preview

### Components

- `FileUpload` - Handles drag & drop and file selection
- `FileGrid` - Displays files in grid or list view with sorting and preview

## Security

### Row Level Security (RLS)

Database policies ensure users can only:
- View their own files
- Insert files with their user ID
- Update their own files
- Delete their own files

### S3 Access Control

S3 security is enforced through:
- **IAM Policies**: Application IAM user can only access `users/*` prefix
- **Key Validation**: Server-side validation ensures users can only access files with their user ID prefix
- **Presigned URLs**: Temporary access URLs with 1-hour expiry for file preview/download
- **CORS Configuration**: Proper CORS settings for web access

### File Validation

- File type validation on both client and server
- File size validation (configurable via `NEXT_PUBLIC_MAX_FILE_SIZE_MB` environment variable)
- Unique filename generation to prevent conflicts
- User ID prefix enforcement in S3 keys

## Usage

1. Navigate to `/files` page
2. Use the upload area to drag & drop files or click to browse
3. View uploaded files in grid or list mode
4. Sort files by date or name
5. Click files to preview
6. Delete files using the trash icon

## Configuration

### Environment Variables

Ensure these environment variables are set:

**Supabase (for authentication and database):**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**AWS S3 (for file storage):**
- `AWS_REGION` (e.g., us-east-1)
- `AWS_ACCESS_KEY_ID` (from CloudFormation stack output)
- `AWS_SECRET_ACCESS_KEY` (from CloudFormation stack output)
- `AWS_S3_BUCKET` (from CloudFormation stack output)

**File Upload:**
- `NEXT_PUBLIC_MAX_FILE_SIZE_MB` (optional, defaults to 10MB)

### AWS Infrastructure

Deploy the S3 infrastructure using the CloudFormation template:

```bash
aws cloudformation deploy \
  --template-file aws-infrastructure/s3-file-storage-stack.yaml \
  --stack-name logo-detection-file-storage-dev \
  --parameter-overrides EnvironmentName=dev \
  --capabilities CAPABILITY_IAM
```

After deployment, update your environment variables with the stack outputs:
- `AWS_ACCESS_KEY_ID`: Use the AccessKeyId output
- `AWS_SECRET_ACCESS_KEY`: Use the SecretAccessKey output  
- `AWS_S3_BUCKET`: Use the BucketName output

Example `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_MAX_FILE_SIZE_MB=10
```

### Storage Bucket

The system uses a storage bucket named `user-files`. This is created automatically by the migration.

## Migration

Run the migration to set up the database schema and storage policies:

```bash
npx supabase migration up
```

The migration file: `supabase/migrations/20250110000001_create_files_table.sql`