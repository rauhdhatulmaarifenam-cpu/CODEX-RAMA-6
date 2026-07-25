-- ============================================================
-- Codex — RAMA 6 — Full Database Schema (v2)
-- Untuk instalasi baru. Untuk upgrade dari v1, gunakan supabase-migration-v2.sql.
-- Jalankan seluruh file ini di Supabase SQL Editor dalam satu batch.
-- ============================================================

-- ENUM types
create type role_type          as enum ('guru', 'guru_super', 'super_admin');
create type account_status     as enum ('aktif', 'nonaktif');
create type gender_type        as enum ('L', 'P');
create type santri_status_type as enum ('aktif', 'lulus', 'keluar', 'pindah');

-- ─── profiles ────────────────────────────────────────────────
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  nickname     text unique not null,
  nama_lengkap text not null,
  role         role_type      not null default 'guru',
  status       account_status not null default 'aktif',
  no_telepon   text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index idx_profiles_nickname_lower on profiles (lower(nickname));

-- ─── seksi ───────────────────────────────────────────────────
create table seksi (
  id          uuid primary key default gen_random_uuid(),
  nama_seksi  text not null,
  deskripsi   text,
  pembina_id  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references profiles(id)
);

-- ─── guru ────────────────────────────────────────────────────
-- Tidak ada mata_pelajaran, tidak ada seksi_id (relasi many-to-many via guru_seksi)
create table guru (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid unique references profiles(id) on delete set null,
  nama_lengkap text not null,
  nip          text,          -- opsional
  jenis_kelamin gender_type,
  tempat_lahir text,
  tanggal_lahir date,
  alamat       text,
  no_telepon   text,
  status       account_status not null default 'aktif',
  foto_url     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references profiles(id)
);

-- ─── guru_seksi (junction many-to-many) ──────────────────────
create table guru_seksi (
  id         uuid primary key default gen_random_uuid(),
  guru_id    uuid not null references guru(id)  on delete cascade,
  seksi_id   uuid not null references seksi(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(guru_id, seksi_id)
);
create index idx_guru_seksi_guru  on guru_seksi(guru_id);
create index idx_guru_seksi_seksi on guru_seksi(seksi_id);

-- ─── kelas ───────────────────────────────────────────────────
-- Tidak ada wali_kelas_id (relasi many-to-many via kelas_wali)
-- kategori: Mondok | Non Mondok
-- tingkat: Ula/Wustha/Ulya (Mondok) atau TPA/Remaja/Dewasa (Non Mondok)
-- constraint pasangan memastikan nilai konsisten
create table kelas (
  id           uuid primary key default gen_random_uuid(),
  nama_kelas   text not null,
  kategori     text check (kategori in ('Mondok', 'Non Mondok')),
  tingkat      text check (tingkat in ('Ula', 'Wustha', 'Ulya', 'TPA', 'Remaja', 'Dewasa')),
  tahun_ajaran text,
  kapasitas    int,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references profiles(id),
  -- pasangan kategori↔tingkat selalu valid
  constraint kelas_kategori_tingkat_check check (
    (kategori is null and tingkat is null)
    or (kategori = 'Mondok'     and (tingkat is null or tingkat in ('Ula','Wustha','Ulya')))
    or (kategori = 'Non Mondok' and (tingkat is null or tingkat in ('TPA','Remaja','Dewasa')))
  )
);

-- ─── kelas_wali (junction many-to-many) ──────────────────────
create table kelas_wali (
  id         uuid primary key default gen_random_uuid(),
  kelas_id   uuid not null references kelas(id) on delete cascade,
  guru_id    uuid not null references guru(id)  on delete cascade,
  created_at timestamptz not null default now(),
  unique(kelas_id, guru_id)
);
create index idx_kelas_wali_kelas on kelas_wali(kelas_id);
create index idx_kelas_wali_guru  on kelas_wali(guru_id);

-- ─── santri ──────────────────────────────────────────────────
-- nis nullable dan unik (partial unique index), tidak ada seksi_id
create table santri (
  id               uuid primary key default gen_random_uuid(),
  nis              text,          -- opsional, unik jika diisi (partial index di bawah)
  nama_lengkap     text not null,
  jenis_kelamin    gender_type,
  tempat_lahir     text,
  tanggal_lahir    date,
  alamat           text,
  nama_wali        text,
  no_telepon_wali  text,
  kelas_id         uuid references kelas(id) on delete set null,
  status           santri_status_type not null default 'aktif',
  tanggal_masuk    date,
  foto_url         text,
  catatan          text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references profiles(id)
);
-- NIS unik hanya jika diisi (multiple NULL diperbolehkan)
create unique index idx_santri_nis_unique on santri(nis) where nis is not null;
create index idx_santri_kelas on santri(kelas_id);

-- ─── updated_at trigger ──────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on profiles for each row execute function set_updated_at();
create trigger trg_seksi_updated_at    before update on seksi    for each row execute function set_updated_at();
create trigger trg_guru_updated_at     before update on guru     for each row execute function set_updated_at();
create trigger trg_kelas_updated_at    before update on kelas    for each row execute function set_updated_at();
create trigger trg_santri_updated_at   before update on santri   for each row execute function set_updated_at();

-- ─── RLS helper functions ─────────────────────────────────────
create or replace function is_active_user()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from profiles where id = auth.uid() and status = 'aktif'
  );
$$;

create or replace function is_super_admin()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'super_admin' and status = 'aktif'
  );
$$;

create or replace function can_delete_data()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role in ('guru_super','super_admin') and status = 'aktif'
  );
$$;

-- ─── Enable RLS ───────────────────────────────────────────────
alter table profiles  enable row level security;
alter table seksi     enable row level security;
alter table guru      enable row level security;
alter table guru_seksi enable row level security;
alter table kelas     enable row level security;
alter table kelas_wali enable row level security;
alter table santri    enable row level security;

-- ─── profiles RLS ────────────────────────────────────────────
create policy "profiles_select"       on profiles for select using (is_active_user() or is_super_admin());
create policy "profiles_insert"       on profiles for insert with check (id = auth.uid());
create policy "profiles_update_own"   on profiles for update using (id = auth.uid());
create policy "profiles_update_admin" on profiles for update using (is_super_admin());
create policy "profiles_delete_admin" on profiles for delete using (is_super_admin());

-- ─── seksi/guru/kelas/santri/guru_seksi/kelas_wali RLS ────────
create policy "seksi_select"  on seksi for select using (is_active_user());
create policy "seksi_insert"  on seksi for insert with check (is_active_user());
create policy "seksi_update"  on seksi for update using (is_active_user());
create policy "seksi_delete"  on seksi for delete using (can_delete_data());

create policy "guru_select"   on guru for select using (is_active_user());
create policy "guru_insert"   on guru for insert with check (is_active_user());
create policy "guru_update"   on guru for update using (is_active_user());
create policy "guru_delete"   on guru for delete using (can_delete_data());

create policy "guru_seksi_select" on guru_seksi for select using (is_active_user());
create policy "guru_seksi_insert" on guru_seksi for insert with check (is_active_user());
create policy "guru_seksi_update" on guru_seksi for update using (is_active_user());
create policy "guru_seksi_delete" on guru_seksi for delete using (can_delete_data());

create policy "kelas_select"  on kelas for select using (is_active_user());
create policy "kelas_insert"  on kelas for insert with check (is_active_user());
create policy "kelas_update"  on kelas for update using (is_active_user());
create policy "kelas_delete"  on kelas for delete using (can_delete_data());

create policy "kelas_wali_select" on kelas_wali for select using (is_active_user());
create policy "kelas_wali_insert" on kelas_wali for insert with check (is_active_user());
create policy "kelas_wali_update" on kelas_wali for update using (is_active_user());
create policy "kelas_wali_delete" on kelas_wali for delete using (can_delete_data());

create policy "santri_select" on santri for select using (is_active_user());
create policy "santri_insert" on santri for insert with check (is_active_user());
create policy "santri_update" on santri for update using (is_active_user());
create policy "santri_delete" on santri for delete using (can_delete_data());

-- ─── Privilege escalation protection triggers ─────────────────
create or replace function prevent_privilege_escalation()
returns trigger language plpgsql security definer as $$
begin
  if (new.role <> old.role or new.status <> old.status) then
    if not is_super_admin() then
      raise exception 'Hanya super admin yang boleh mengubah role atau status akun.';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_prevent_privilege_escalation
  before update on profiles for each row execute function prevent_privilege_escalation();

create or replace function prevent_last_super_admin_removal()
returns trigger language plpgsql security definer as $$
declare admin_count int;
begin
  if old.role = 'super_admin' and (new.role <> 'super_admin' or new.status = 'nonaktif') then
    select count(*) into admin_count
    from profiles where role = 'super_admin' and status = 'aktif' and id <> old.id;
    if admin_count = 0 then
      raise exception 'Tidak bisa menghapus atau menonaktifkan super admin terakhir.';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_prevent_last_super_admin_removal
  before update on profiles for each row execute function prevent_last_super_admin_removal();

create or replace function prevent_last_super_admin_delete()
returns trigger language plpgsql security definer as $$
declare admin_count int;
begin
  if old.role = 'super_admin' then
    select count(*) into admin_count
    from profiles where role = 'super_admin' and status = 'aktif' and id <> old.id;
    if admin_count = 0 then
      raise exception 'Tidak bisa menghapus super admin terakhir.';
    end if;
  end if;
  return old;
end;
$$;
create trigger trg_prevent_last_super_admin_delete
  before delete on profiles for each row execute function prevent_last_super_admin_delete();

-- ─── Profile insert defaults ──────────────────────────────────
create or replace function enforce_profile_insert_defaults()
returns trigger language plpgsql as $$
begin
  new.role   := 'guru';
  new.status := 'aktif';
  return new;
end;
$$;
create trigger trg_enforce_profile_insert_defaults
  before insert on profiles for each row execute function enforce_profile_insert_defaults();

-- ─── Enable realtime ─────────────────────────────────────────
alter publication supabase_realtime add table profiles;
alter publication supabase_realtime add table seksi;
alter publication supabase_realtime add table guru;
alter publication supabase_realtime add table guru_seksi;
alter publication supabase_realtime add table kelas;
alter publication supabase_realtime add table kelas_wali;
alter publication supabase_realtime add table santri;

-- ============================================================
-- Selesai. Untuk upgrade dari v1, jalankan supabase-migration-v2.sql saja.
-- ============================================================
