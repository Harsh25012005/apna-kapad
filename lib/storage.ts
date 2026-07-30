import { File } from 'expo-file-system';
import { supabase } from './supabase';

export type BucketName = 'shop-logos' | 'design-photos';

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

function extensionOf(uri: string): string {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
  return ext && MIME_BY_EXT[ext] ? ext : 'jpg';
}

/**
 * Uploads a local image (from ImagePicker) to a shop-scoped folder in Supabase
 * Storage and returns its public URL.
 *
 * Files are stored at `<shop_id>/<name>.<ext>` — the storage RLS policies key
 * off that first path segment, so the folder prefix is what isolates shops.
 */
export async function uploadImage({
  bucket,
  shopId,
  localUri,
  fileName,
}: {
  bucket: BucketName;
  shopId: string;
  localUri: string;
  fileName: string;
}): Promise<string> {
  const ext = extensionOf(localUri);
  const path = `${shopId}/${fileName}.${ext}`;

  const bytes = await new File(localUri).arrayBuffer();

  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: MIME_BY_EXT[ext],
    upsert: true,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
