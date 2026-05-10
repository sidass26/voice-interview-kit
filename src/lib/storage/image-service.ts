import { createServerClient } from '../supabase/server';
import type { TripImage } from '../types';

const BUCKET = 'trip-images';

export async function uploadImageToStorage(
  file: File,
  sessionId: string
): Promise<Pick<TripImage, 'url' | 'storagePath'>> {
  const supabase = createServerClient();

  const ext = file.name.split('.').pop() ?? 'jpg';
  const storagePath = `${sessionId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  return { url: urlData.publicUrl, storagePath };
}

export async function uploadAuthorPhotoToStorage(
  file: File,
  email: string
): Promise<Pick<TripImage, 'url' | 'storagePath'>> {
  const supabase = createServerClient();

  const ext = file.name.split('.').pop() ?? 'jpg';
  const storagePath = `author-photos/${email.replace('@', '_at_')}.${ext}`;

  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: true });

  if (error) throw new Error(`Author photo upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

  return { url: urlData.publicUrl, storagePath };
}

export async function deleteFromStorage(storagePath: string): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) throw new Error(`Storage delete failed: ${error.message}`);
}
