-- ============================================================
-- Codex — RAMA 6 — Migration v3
-- Tambah kolom `kategori` pada tabel kelas
-- Update constraint `tingkat` agar menerima 5 nilai
-- Tambah constraint pasangan kategori↔tingkat yang valid
-- Migrasi data eksisting: baris bertingkat Ula/Wustha/Ulya → kategori = 'Mondok'
--
-- AMAN: tidak menghapus kolom atau data.
-- Jalankan seluruh file ini di Supabase SQL Editor dalam satu batch.
-- ============================================================

-- 1. Tambah kolom kategori (nullable, constraint hanya dua nilai yang diizinkan)
alter table kelas
  add column if not exists kategori text
    check (kategori in ('Mondok', 'Non Mondok'));

-- 2. Hapus constraint lama pada tingkat (jika ada)
alter table kelas drop constraint if exists kelas_tingkat_check;

-- 3. Tambah ulang constraint tingkat dengan 5 nilai yang valid
alter table kelas
  add constraint kelas_tingkat_check
    check (tingkat in ('Ula', 'Wustha', 'Ulya', 'TPA', 'Biasa'));

-- 4. Tambah constraint pasangan kategori↔tingkat
--    Aturan:
--      - kategori IS NULL  → tingkat harus IS NULL
--      - kategori Mondok   → tingkat boleh NULL atau Ula/Wustha/Ulya
--      - kategori Non Mondok → tingkat boleh NULL atau TPA/Biasa
alter table kelas drop constraint if exists kelas_kategori_tingkat_check;
alter table kelas
  add constraint kelas_kategori_tingkat_check check (
    (kategori is null     and tingkat is null)
    or
    (kategori = 'Mondok'     and (tingkat is null or tingkat in ('Ula','Wustha','Ulya')))
    or
    (kategori = 'Non Mondok' and (tingkat is null or tingkat in ('TPA','Biasa')))
  );

-- 5. Migrasi data eksisting
--    Baris yang sudah punya tingkat Ula/Wustha/Ulya → isi kategori = 'Mondok'
--    Baris dengan tingkat kosong → biarkan kategori NULL (sudah memenuhi constraint)
update kelas
  set kategori = 'Mondok'
  where tingkat in ('Ula','Wustha','Ulya')
    and kategori is null;

-- (Tidak ada baris yang perlu diisi 'Non Mondok' secara otomatis karena
--  nilai TPA/Biasa belum mungkin ada di data lama.)

-- 6. Tambahkan kolom ke realtime (tidak diperlukan khusus, tabel sudah ada di publikasi)
-- Selesai.
