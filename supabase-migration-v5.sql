-- ============================================================
-- Codex — RAMA 6 — Migration v5
-- Perubahan pilihan Tingkat Non Mondok: hapus 'Biasa', tambah 'Remaja' dan 'Dewasa'
--
-- Jalankan seluruh file ini di Supabase SQL Editor dalam satu batch.
-- ============================================================

-- ─── 1. Kosongkan baris yang tingkatnya 'Biasa' ──────────────
-- Nilai dikosongkan (NULL), BUKAN ditebak otomatis jadi Remaja atau Dewasa,
-- supaya admin dapat menentukan sendiri per kelas sesuai kondisi nyata.
-- Kalau tidak ada baris dengan tingkat = 'Biasa', pernyataan ini tidak berpengaruh.
UPDATE kelas
SET    tingkat = NULL
WHERE  tingkat = 'Biasa';

-- ─── 2. Perbarui check constraint kolom tingkat ───────────────
-- Hapus constraint lama yang masih mengizinkan 'Biasa'.
ALTER TABLE kelas
  DROP CONSTRAINT IF EXISTS kelas_tingkat_check;

-- Pasang constraint baru: 'Biasa' tidak lagi diterima.
ALTER TABLE kelas
  ADD CONSTRAINT kelas_tingkat_check
  CHECK (tingkat IN ('Ula', 'Wustha', 'Ulya', 'TPA', 'Remaja', 'Dewasa'));

-- ─── 3. Perbarui check constraint pasangan kategori↔tingkat ───
-- Hapus constraint lama.
ALTER TABLE kelas
  DROP CONSTRAINT IF EXISTS kelas_kategori_tingkat_check;

-- Pasang constraint baru:
--   • Kategori NULL  → tingkat harus NULL
--   • Mondok         → tingkat NULL, Ula, Wustha, atau Ulya
--   • Non Mondok     → tingkat NULL, TPA, Remaja, atau Dewasa  (Biasa tidak lagi valid)
ALTER TABLE kelas
  ADD CONSTRAINT kelas_kategori_tingkat_check CHECK (
    (kategori IS NULL     AND tingkat IS NULL)
    OR (kategori = 'Mondok'     AND (tingkat IS NULL OR tingkat IN ('Ula','Wustha','Ulya')))
    OR (kategori = 'Non Mondok' AND (tingkat IS NULL OR tingkat IN ('TPA','Remaja','Dewasa')))
  );
