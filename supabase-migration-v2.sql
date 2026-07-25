-- ============================================================
-- Codex — RAMA 6 — Migration v2
-- Jalankan di Supabase SQL Editor setelah schema v1 sudah ada.
-- Aman dijalankan berulang (IF NOT EXISTS / IF EXISTS).
-- ============================================================

-- 1. Buat tabel penghubung guru_seksi (many-to-many)
create table if not exists guru_seksi (
  id         uuid primary key default gen_random_uuid(),
  guru_id    uuid not null references guru(id)  on delete cascade,
  seksi_id   uuid not null references seksi(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(guru_id, seksi_id)
);
create index if not exists idx_guru_seksi_guru  on guru_seksi(guru_id);
create index if not exists idx_guru_seksi_seksi on guru_seksi(seksi_id);

-- 2. Buat tabel penghubung kelas_wali (many-to-many)
create table if not exists kelas_wali (
  id         uuid primary key default gen_random_uuid(),
  kelas_id   uuid not null references kelas(id) on delete cascade,
  guru_id    uuid not null references guru(id)  on delete cascade,
  created_at timestamptz not null default now(),
  unique(kelas_id, guru_id)
);
create index if not exists idx_kelas_wali_kelas on kelas_wali(kelas_id);
create index if not exists idx_kelas_wali_guru  on kelas_wali(guru_id);

-- 3. Migrasi data relasi lama ke tabel penghubung baru
--    guru.seksi_id → guru_seksi
insert into guru_seksi (guru_id, seksi_id)
select id, seksi_id from guru where seksi_id is not null
on conflict (guru_id, seksi_id) do nothing;

--    kelas.wali_kelas_id → kelas_wali
insert into kelas_wali (kelas_id, guru_id)
select id, wali_kelas_id from kelas where wali_kelas_id is not null
on conflict (kelas_id, guru_id) do nothing;

-- 4. Hapus kolom lama dari guru
alter table guru drop column if exists mata_pelajaran;
alter table guru drop column if exists seksi_id;
drop index if exists idx_guru_seksi; -- indeks lama di tabel guru

-- 5. Hapus kolom wali_kelas_id dari kelas
alter table kelas drop column if exists wali_kelas_id;
drop index if exists idx_kelas_wali; -- indeks lama di tabel kelas

-- 6. Hapus seksi_id dari santri & jadikan NIS nullable+partial-unique
alter table santri drop column if exists seksi_id;
alter table santri alter column nis drop not null;
-- Hapus unique constraint lama, ganti dengan partial unique index
-- (multiple NULL diperbolehkan, tapi jika diisi harus unik)
alter table santri drop constraint if exists santri_nis_key;
drop index if exists santri_nis_key;
create unique index if not exists idx_santri_nis_unique on santri(nis) where nis is not null;

-- 7. Enable RLS pada tabel penghubung baru
alter table guru_seksi enable row level security;
alter table kelas_wali  enable row level security;

-- 8. RLS policies: guru_seksi
drop policy if exists "guru_seksi_select" on guru_seksi;
drop policy if exists "guru_seksi_insert" on guru_seksi;
drop policy if exists "guru_seksi_update" on guru_seksi;
drop policy if exists "guru_seksi_delete" on guru_seksi;
create policy "guru_seksi_select" on guru_seksi for select using (is_active_user());
create policy "guru_seksi_insert" on guru_seksi for insert with check (is_active_user());
create policy "guru_seksi_update" on guru_seksi for update using (is_active_user());
create policy "guru_seksi_delete" on guru_seksi for delete using (can_delete_data());

-- 9. RLS policies: kelas_wali
drop policy if exists "kelas_wali_select" on kelas_wali;
drop policy if exists "kelas_wali_insert" on kelas_wali;
drop policy if exists "kelas_wali_update" on kelas_wali;
drop policy if exists "kelas_wali_delete" on kelas_wali;
create policy "kelas_wali_select" on kelas_wali for select using (is_active_user());
create policy "kelas_wali_insert" on kelas_wali for insert with check (is_active_user());
create policy "kelas_wali_update" on kelas_wali for update using (is_active_user());
create policy "kelas_wali_delete" on kelas_wali for delete using (can_delete_data());

-- 10. Tambahkan ke realtime publication
alter publication supabase_realtime add table guru_seksi;
alter publication supabase_realtime add table kelas_wali;

-- ============================================================
-- Selesai. Kedua tabel lama relasi sudah dimigrasikan.
-- ============================================================
