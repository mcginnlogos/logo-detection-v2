# File Upload System

This document describes the file upload system implementation for the application.

## Features

- **Drag & Drop Upload**: Users can drag files directly onto the upload area
- **File Explorer**: Click to browse and select files from the file system
- **Multiple File Upload**: Upload multiple files simultaneously
- **File Type Validation**: Supports images (.png, .jpg, .jpeg, .webp) and videos (.mov, .mp4, .avi, .mkv, .webm)
- **File Size Limit**: Configurable via `NEXT_PUBLIC_MAX_FILE_SIZE_MB` environment variable (defaults to 10MB)
- **User Isolation**: Files are stored with user ID prefix for security
- **Row Level Security (RLS)**: Database and storage policies ensure users can only access their own files
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
    storage_path TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Storage Structure

Files are stored in Supabase Storage with the following structure:
```
user-files/
├── {user_id}/
│   ├── {timestamp}_{random}.{ext}
│   └── {timestamp}_{random}.{ext}
```

### API Endpoints

- `POST /api/files/upload` - Upload multiple files
- `GET /api/files?sortBy={option}` - Fetch user's files with sorting
- `DELETE /api/files?id={fileId}` - Delete a specific file
- `GET /api/files/{id}/preview` - Get signed URL for file preview

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

### Storage Policies

Storage policies ensure users can only:
- Upload files to their own folder (`{user_id}/`)
- Access files in their own folder
- Delete files from their own folder

### File Validation

- File type validation on both client and server
- File size validation (configurable via `NEXT_PUBLIC_MAX_FILE_SIZE_MB` environment variable)
- Unique filename generation to prevent conflicts

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
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_MAX_FILE_SIZE_MB` (optional, defaults to 10MB)

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