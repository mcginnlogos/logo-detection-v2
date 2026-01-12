import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types_db';

type Client = SupabaseClient<Database>;

export const getFiles = async (supabase: Client, sortBy: string = 'newest') => {
  let query = supabase
    .from('files')
    .select('*') as any;

  // Apply sorting
  switch (sortBy) {
    case 'oldest':
      query = query.order('created_at', { ascending: true });
      break;
    case 'a-z':
      query = query.order('original_name', { ascending: true });
      break;
    case 'z-a':
      query = query.order('original_name', { ascending: false });
      break;
    case 'newest':
    default:
      query = query.order('created_at', { ascending: false });
      break;
  }

  return query;
};

export const getFileById = async (supabase: Client, fileId: string) => {
  return supabase
    .from('files')
    .select('*')
    .eq('id', fileId)
    .single() as any;
};

export const deleteFileById = async (supabase: Client, fileId: string) => {
  return supabase
    .from('files')
    .delete()
    .eq('id', fileId);
};

export const createFile = async (supabase: Client, fileData: {
  user_id: string;
  name: string;
  original_name: string;
  size: number;
  mime_type: string;
  s3_bucket: string;
  s3_key: string;
}) => {
  return supabase
    .from('files')
    .insert(fileData as any)
    .select()
    .single();
};