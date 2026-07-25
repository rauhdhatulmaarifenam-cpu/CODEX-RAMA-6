import { supabase } from './supabaseClient';

export const FOTO_BUCKET = 'foto-profil';
const SIGNED_URL_TTL = 3600; // 1 jam

/**
 * Upload file foto ke bucket foto-profil.
 * Mengembalikan path storage (bukan URL publik) untuk disimpan ke database.
 *
 * @param file      File gambar yang akan diunggah
 * @param prefix    Prefix path, misal 'santri' atau 'guru'
 * @returns         Path file di storage, contoh: "santri/1720000000000.jpg"
 */
export async function uploadFoto(file: File, prefix: string): Promise<string> {
  const ext  = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${prefix}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage.from(FOTO_BUCKET).upload(path, file, {
    upsert:      false,
    contentType: file.type,
  });
  if (error) throw new Error(`Upload foto gagal: ${error.message}`);
  return path;
}

/**
 * Buat signed URL sementara dari path yang tersimpan di database.
 * URL berlaku selama expiresIn detik (default 1 jam).
 *
 * @param path       Path file di storage, dari kolom foto_url
 * @param expiresIn  Durasi validitas URL dalam detik
 * @returns          Signed URL sementara
 */
export async function getSignedUrl(path: string, expiresIn = SIGNED_URL_TTL): Promise<string> {
  const { data, error } = await supabase.storage
    .from(FOTO_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    throw new Error(`Gagal membuat signed URL: ${error?.message ?? 'No URL returned'}`);
  }
  return data.signedUrl;
}

/**
 * Hapus file dari storage berdasarkan path.
 * Tidak melempar error jika file tidak ditemukan (idempoten).
 */
export async function deleteFoto(path: string): Promise<void> {
  // remove() tidak error jika file tidak ada — aman untuk kasus race condition
  await supabase.storage.from(FOTO_BUCKET).remove([path]);
}

/** Validasi file sebelum upload: tipe dan ukuran */
export function validateFotoFile(file: File): string | null {
  const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const MAX_MB  = 2;
  if (!ALLOWED.includes(file.type)) {
    return 'Tipe file harus JPG, PNG, atau WebP';
  }
  if (file.size > MAX_MB * 1024 * 1024) {
    return `Ukuran file maksimal ${MAX_MB} MB`;
  }
  return null;
}
