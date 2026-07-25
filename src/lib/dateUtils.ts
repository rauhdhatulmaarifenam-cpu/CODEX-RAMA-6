/**
 * Fungsi bantu perhitungan usia dan format tanggal lahir.
 * Dipakai ulang di semua tempat yang menampilkan tanggal lahir Santri/Guru.
 */

/**
 * Hitung usia dari tanggal lahir dibandingkan hari ini.
 * Kembalikan null kalau tanggal lahir kosong atau tidak valid.
 */
export function hitungUsia(tanggalLahir?: string | null): number | null {
  if (!tanggalLahir?.trim()) return null;
  const lahir = new Date(tanggalLahir);
  if (isNaN(lahir.getTime())) return null;
  const today = new Date();
  let usia = today.getFullYear() - lahir.getFullYear();
  const selisihBulan = today.getMonth() - lahir.getMonth();
  if (selisihBulan < 0 || (selisihBulan === 0 && today.getDate() < lahir.getDate())) {
    usia--;
  }
  return usia >= 0 ? usia : null;
}

/**
 * Format tanggal lahir disertai usia dalam kurung.
 * Contoh: "2001-05-12 (24 tahun)"
 * Kalau tanggal kosong, kembalikan '-'.
 */
export function formatTanggalDenganUsia(tanggalLahir?: string | null): string {
  if (!tanggalLahir?.trim()) return '-';
  const usia = hitungUsia(tanggalLahir);
  if (usia === null) return tanggalLahir;
  return `${tanggalLahir} (${usia} tahun)`;
}
