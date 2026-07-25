# Instruksi Pengembangan Aplikasi — Codex — RAMA 6

> Brief teknis lengkap. Ini seluruh spesifikasi yang harus diimplementasikan — ikuti persis, terutama bagian struktur database, RLS, dan aturan hak akses (itu lapisan keamanan utama, bukan sekadar UI).

## 0. Asumsi

1. **Seksi** = bidang/departemen organisasi pesantren (mis. Keamanan, Kebersihan, Ibadah, Bahasa), punya pembina (guru) dan anggota.
2. **"Seed"** = istilah internal untuk password. Secara teknis tetap password biasa di Supabase Auth.
3. Sign up dibuka bebas untuk calon guru, langsung aktif dengan role default `'guru'`. Akun pertama di-upgrade manual jadi `super_admin` lewat SQL editor setelah deploy.
4. Sinkronisasi offline bersifat *best-effort* (last-write-wins), bukan conflict resolution penuh — lihat bagian 8.

---

## 1. Ringkasan Proyek

PWA internal untuk pondok pesantren **Raudhatul Ma'arif 6**, dipakai guru-guru untuk mengelola data santri, kelas, guru, dan seksi secara kolaboratif dan realtime, dengan tiga tingkat kewenangan (bagian 5). Mayoritas pengguna mengakses lewat HP dengan koneksi yang kadang tidak stabil — app harus tetap bisa dipakai saat offline dan sinkron otomatis saat online kembali.

---

## 2. Tech Stack Wajib

| Layer | Pilihan | Catatan |
|---|---|---|
| Frontend | React + Vite + TypeScript | SPA, bukan Next.js |
| Styling | Tailwind CSS | Ikuti design tokens bagian 9 |
| Animasi | Framer Motion | Ringan, lihat bagian 9 |
| Routing | React Router v6 | |
| Data fetching/cache | TanStack Query | Dipadukan realtime invalidation |
| Form & validasi | React Hook Form + Zod | |
| State auth global | React Context (atau Zustand) | |
| Backend | Supabase (Postgres + Auth + Realtime) | |
| Hosting | Netlify | |
| Ikon | lucide-react | |
| Toast | sonner | |
| PWA | vite-plugin-pwa | |
| Offline queue | idb-keyval (atau Dexie.js) | Antrian mutasi di IndexedDB |
| Export XLSX | xlsx (SheetJS) | |
| Export DOCX | docx (dolanmiu/docx) | |
| Export PDF | jspdf + jspdf-autotable | |
| Export MD | — (generate string manual) | Tidak butuh library |

Stack inti di atas wajib — jangan diganti framework besarnya.

---

## 3. Struktur Database (Supabase / PostgreSQL)

### 3.1 Entity Relationship (ringkas)

- `profiles` — akun login (1:1 `auth.users`), punya `role` (3 tingkat) & `status`.
- `seksi` — punya `pembina_id` → `profiles`.
- `guru` — punya `seksi_id` → `seksi`, opsional `user_id` → `profiles`.
- `kelas` — punya `wali_kelas_id` → `guru`.
- `santri` — punya `kelas_id` → `kelas`, opsional `seksi_id` → `seksi`.

### 3.2 SQL Schema

```sql
-- ENUM types
create type role_type as enum ('guru', 'guru_super', 'super_admin');
create type account_status as enum ('aktif', 'nonaktif');
create type gender_type as enum ('L', 'P');
create type santri_status_type as enum ('aktif', 'lulus', 'keluar', 'pindah');

-- profiles: akun login aplikasi
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text unique not null,
  nama_lengkap text not null,
  role role_type not null default 'guru',
  status account_status not null default 'aktif',
  no_telepon text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index idx_profiles_nickname_lower on profiles (lower(nickname));

-- seksi
create table seksi (
  id uuid primary key default gen_random_uuid(),
  nama_seksi text not null,
  deskripsi text,
  pembina_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);

-- guru
create table guru (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references profiles(id) on delete set null,
  nama_lengkap text not null,
  nip text,
  jenis_kelamin gender_type,
  tempat_lahir text,
  tanggal_lahir date,
  alamat text,
  no_telepon text,
  mata_pelajaran text,
  seksi_id uuid references seksi(id) on delete set null,
  status account_status not null default 'aktif',
  foto_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);
create index idx_guru_seksi on guru(seksi_id);

-- kelas
create table kelas (
  id uuid primary key default gen_random_uuid(),
  nama_kelas text not null,
  tingkat text,
  tahun_ajaran text,
  wali_kelas_id uuid references guru(id) on delete set null,
  kapasitas int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);
create index idx_kelas_wali on kelas(wali_kelas_id);

-- santri
create table santri (
  id uuid primary key default gen_random_uuid(),
  nis text unique not null,
  nama_lengkap text not null,
  jenis_kelamin gender_type,
  tempat_lahir text,
  tanggal_lahir date,
  alamat text,
  nama_wali text,
  no_telepon_wali text,
  kelas_id uuid references kelas(id) on delete set null,
  seksi_id uuid references seksi(id) on delete set null,
  status santri_status_type not null default 'aktif',
  tanggal_masuk date,
  foto_url text,
  catatan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);
create index idx_santri_kelas on santri(kelas_id);
create index idx_santri_seksi on santri(seksi_id);

-- auto-update updated_at
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger trg_updated_profiles before update on profiles for each row execute function set_updated_at();
create trigger trg_updated_seksi before update on seksi for each row execute function set_updated_at();
create trigger trg_updated_guru before update on guru for each row execute function set_updated_at();
create trigger trg_updated_kelas before update on kelas for each row execute function set_updated_at();
create trigger trg_updated_santri before update on santri for each row execute function set_updated_at();
```

### 3.3 Row Level Security (RLS)

```sql
alter table profiles enable row level security;
alter table seksi enable row level security;
alter table guru enable row level security;
alter table kelas enable row level security;
alter table santri enable row level security;

create or replace function is_active_user()
returns boolean language sql security definer stable as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'aktif');
$$;

create or replace function is_super_admin()
returns boolean language sql security definer stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'super_admin' and status = 'aktif');
$$;

create or replace function can_delete_data()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('guru_super','super_admin') and status = 'aktif'
  );
$$;

-- PROFILES
create policy "profiles_select" on profiles for select using (is_active_user() or is_super_admin());
create policy "profiles_insert_self" on profiles for insert with check (id = auth.uid());
create policy "profiles_update_own" on profiles for update using (id = auth.uid());
create policy "profiles_update_admin" on profiles for update using (is_super_admin());
create policy "profiles_delete_admin" on profiles for delete using (is_super_admin());

-- Hanya super admin yang boleh ubah role/status siapa pun (termasuk grant guru_super/super_admin ke orang lain)
create or replace function prevent_privilege_escalation()
returns trigger language plpgsql security definer as $$
begin
  if (new.role is distinct from old.role or new.status is distinct from old.status)
     and not is_super_admin() then
    raise exception 'Hanya super admin yang boleh mengubah role atau status akun';
  end if;
  return new;
end;
$$;
create trigger trg_prevent_privilege_escalation
  before update on profiles for each row execute function prevent_privilege_escalation();

-- Proteksi: jangan sampai super admin terakhir hilang (demote atau nonaktif)
create or replace function prevent_last_super_admin_removal()
returns trigger language plpgsql security definer as $$
declare admin_count int;
begin
  if old.role = 'super_admin'
     and (new.role is distinct from 'super_admin' or new.status = 'nonaktif') then
    select count(*) into admin_count
    from profiles where role = 'super_admin' and status = 'aktif' and id <> old.id;
    if admin_count = 0 then
      raise exception 'Tidak bisa menghapus/menonaktifkan super admin terakhir. Tunjuk super admin lain dulu.';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_prevent_last_super_admin
  before update on profiles for each row execute function prevent_last_super_admin_removal();

-- Proteksi sama untuk hard-delete akun
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

-- SEKSI / GURU / KELAS / SANTRI: semua active user CRUD, delete hanya guru_super & super_admin
create policy "seksi_select" on seksi for select using (is_active_user());
create policy "seksi_insert" on seksi for insert with check (is_active_user());
create policy "seksi_update" on seksi for update using (is_active_user());
create policy "seksi_delete" on seksi for delete using (can_delete_data());

create policy "guru_select" on guru for select using (is_active_user());
create policy "guru_insert" on guru for insert with check (is_active_user());
create policy "guru_update" on guru for update using (is_active_user());
create policy "guru_delete" on guru for delete using (can_delete_data());

create policy "kelas_select" on kelas for select using (is_active_user());
create policy "kelas_insert" on kelas for insert with check (is_active_user());
create policy "kelas_update" on kelas for update using (is_active_user());
create policy "kelas_delete" on kelas for delete using (can_delete_data());

create policy "santri_select" on santri for select using (is_active_user());
create policy "santri_insert" on santri for insert with check (is_active_user());
create policy "santri_update" on santri for update using (is_active_user());
create policy "santri_delete" on santri for delete using (can_delete_data());
```

Jalankan seluruh script 3.2 dan 3.3 di **Supabase SQL Editor**, bukan lewat kode frontend.

---

## 4. Sistem Autentikasi (Nickname + Seed)

### 4.1 Konversi nickname → email sintetis

```ts
function nicknameToEmail(nickname: string): string {
  const slug = nickname.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${slug}@santri.rm6.internal`;
}
```

### 4.2 Alur Sign Up

1. Form: nickname, nama lengkap, seed, konfirmasi seed.
2. Cek nickname belum dipakai (query `profiles` pakai `lower(nickname)`).
3. `supabase.auth.signUp({ email: nicknameToEmail(nickname), password: seed })`.
4. Insert row `profiles` (id = user id, nickname, nama_lengkap, role default `'guru'`, status `'aktif'`).
5. Auto-login → redirect dashboard.

### 4.3 Setting wajib di Supabase Dashboard

Authentication → Providers → Email → matikan **"Confirm email"**.

### 4.4 Login & bootstrap super admin pertama

- Login: nickname + seed → convert ke email sintetis → `signInWithPassword`.
- Setelah deploy, daftar akun pertama lewat sign up biasa, lalu jalankan sekali di SQL Editor:
  ```sql
  update profiles set role = 'super_admin' where lower(nickname) = 'nickname_pertama';
  ```

### 4.5 Halaman "Anggota" (khusus super admin)

- List semua `profiles`: nickname, nama, role, status, tanggal join.
- Aksi: ubah role (guru / guru_super / super_admin — bisa grant super_admin ke orang lain tanpa melepas role sendiri, sistem mendukung banyak super admin sekaligus), aktifkan/nonaktifkan akun, opsional hard-delete dengan dialog konfirmasi tegas.
- Sistem akan menolak (lewat trigger DB, bukan cuma UI) kalau aksi tersebut menghilangkan super admin aktif terakhir.
- Akun berstatus `nonaktif` otomatis di-signout kalau mencoba login atau saat sesi berjalan (cek `profiles.status` setelah login).

---

## 5. Peran & Hak Akses

| Aksi | Guru | Guru Super | Super Admin |
|---|---|---|---|
| Lihat data santri/kelas/guru/seksi | ✅ | ✅ | ✅ |
| Tambah/edit data | ✅ | ✅ | ✅ |
| **Hapus** data santri/kelas/guru/seksi | ❌ | ✅ | ✅ |
| Ekspor data (docx/xlsx/md/pdf) | ✅ | ✅ | ✅ |
| Lihat daftar akun pengguna | ✅ (read-only) | ✅ (read-only) | ✅ |
| Aktifkan/nonaktifkan/pecat akun | ❌ | ❌ | ✅ |
| Ubah role akun lain (grant guru_super/super_admin) | ❌ | ❌ | ✅ |
| Edit profil sendiri | ✅ | ✅ | ✅ |

Ditegakkan dua lapis: RLS di database (utama, tidak bisa dibypass dari browser) + disabled/hidden UI di frontend (untuk UX).

---

## 6. Modul Aplikasi & Halaman

Routes:

- `/login`, `/signup` — publik
- `/dashboard` — ringkasan angka
- `/santri` — list + search + filter (kelas, status) + pagination; `/santri/baru`, `/santri/:id`
- `/kelas` — list; `/kelas/baru`, `/kelas/:id` (termasuk daftar santri di kelas itu)
- `/guru` — list; `/guru/baru`, `/guru/:id`
- `/seksi` — list; `/seksi/baru`, `/seksi/:id` (termasuk anggota seksi)
- `/anggota` — khusus super admin (lihat 4.5)
- `/profil` — edit profil sendiri

Setiap modul CRUD butuh:

1. **List view**: tabel/card responsif, search, filter, pagination, loading skeleton, empty state, tombol **Ekspor**.
2. **Form create/edit**: modal/halaman, validasi Zod, toast sukses/gagal, jalan lewat wrapper offline-aware (bagian 8).
3. **Detail view**: semua field + relasi, tombol **Ekspor** per-record.
4. **Delete**: dialog konfirmasi eksplisit; tombol/aksi ini hanya aktif untuk role `guru_super` dan `super_admin` (untuk `guru`, sembunyikan atau disable dengan tooltip penjelasan).
5. **Realtime**: subscribe `postgres_changes`, invalidate query React Query saat ada perubahan dari user lain.

---

## 7. Ekspor Data (DOCX, XLSX, MD, PDF)

- Semua generation di sisi client (browser), tanpa backend tambahan.
- `.xlsx` → SheetJS (`xlsx`). `.docx` → `docx` (dolanmiu). `.pdf` → `jspdf` + `jspdf-autotable`. `.md` → generate string manual. Trigger download via Blob + `URL.createObjectURL`.
- **List view** tiap modul: ekspor data yang sedang tampil/terfilter → pilihan XLSX (tabel penuh), MD (daftar ringkas), PDF (laporan siap cetak).
- **Detail view** per-record: ekspor satu record sebagai DOCX (profil individu) atau PDF (kartu profil).
- Semua role boleh ekspor (tidak dibatasi seperti hak hapus).
- Nama file otomatis: `{modul}_{konteks}_{tanggal}.{ext}`, mis. `santri_kelas-1a_2026-07-20.xlsx`.

---

## 8. Mode Offline & Sinkronisasi Otomatis

Guru harus tetap bisa CRUD saat koneksi jelek/offline, dan perubahannya otomatis terkirim begitu online kembali.

### 8.1 Arsitektur

- Semua operasi tulis (create/update/delete) **wajib** lewat satu wrapper terpusat, misal `mutateWithQueue({ table, operation, payload })`:
  1. Kalau online → coba jalankan langsung ke Supabase.
  2. Kalau gagal karena network error, atau `navigator.onLine === false` → simpan entry ke IndexedDB (pakai `idb-keyval`/Dexie): `{ localId, table, operation, payload, createdAt, status: 'pending' }`.
  3. Update cache React Query secara optimistic, tandai record dengan `_pendingSync: true` untuk ditampilkan di UI (badge kecil "menunggu sinkron").
- **ID dibuat di client**: untuk `insert`, generate UUID pakai `crypto.randomUUID()` di frontend sebelum kirim — supaya record yang dibuat offline sudah punya ID final, tidak perlu remapping setelah sinkron.
- **Replay queue**:
  - Trigger di event `window.addEventListener('online', processQueue)`.
  - Juga cek queue saat app pertama kali dibuka, dan fallback polling tiap beberapa menit (event `online` browser kadang tidak akurat).
  - Proses **FIFO per record** (urutan operasi ke record yang sama harus konsisten — create dulu baru update).
  - Sukses → hapus dari queue, invalidate query terkait.
  - Gagal (mis. konflik, record sudah dihapus user lain) → **jangan** dihapus/didiamkan otomatis. Tampilkan notifikasi jelas ke guru terkait, biarkan dia retry atau putuskan manual.
- **Indikator UI**: banner persisten kalau queue tidak kosong, mis. "Sedang offline — 3 perubahan menunggu sinkronisasi", berubah warna/ikon saat semua tersinkron.
- Ini best-effort sync (last-write-wins default) — bukan conflict-resolution penuh; itu keterbatasan yang diketahui, di luar scope fase ini.

---

## 9. Desain UI/UX & Animasi

Ini alat kerja harian, bukan landing page — prioritas: cepat dibaca, enak di HP, terasa rapi & tepercaya, bukan dashboard generik ungu-gradient.

### 9.1 Design tokens

- **Warna** — primary `#0B5D4C` (emerald tua), primary-dark `#08453A` (hover/active), aksen emas `#C9A227` (dipakai terbatas: badge status, garis pemisah tipis), background `#FAF8F3`, surface card `#FFFFFF`, teks utama `#1F2A28`, teks sekunder `#6B7280`, border `#E5E1D8`, danger `#B3261E`, success `#2F9E44`.
- **Tipografi** — heading: "Fraunces" (serif berkarakter, secukupnya: judul halaman, header/login). Body/UI: "Plus Jakarta Sans" (form, tabel, navigasi). Angka (NIS/NIP) pakai tabular-nums.
- **Layout** — sidebar kiri collapsible di desktop, bottom nav 4 ikon utama di mobile + hamburger untuk sisanya, card `rounded-2xl` shadow lembut (naik tipis saat hover), grid spacing kelipatan 8px.
- **Signature element** — pola geometris islami tipis (girih, opacity ~5–8%) di panel login & footer sidebar saja — jangan diulang di semua layar.

### 9.2 Motion (Framer Motion) — ringan

- Transisi halaman: fade + translate-y 8px, 200ms ease-out.
- List data: `staggerChildren` ~0.03s, item fade + slide-up 4px.
- Modal: scale 0.96→1 + fade, spring lembut, backdrop fade.
- Tombol: `whileTap={{scale:0.97}}`, hover naik tipis + shadow membesar.
- Sidebar item aktif: shared-element highlight (`layoutId`).
- Toast: slide-in kanan atas + fade.
- Banner offline/pending-sync: slide-down halus, bukan animasi mencolok.
- Hormati `prefers-reduced-motion`.

---

## 10. Spesifikasi PWA

- `vite-plugin-pwa`, strategi `autoUpdate`.
- `manifest.json`: name "Codex — RAMA 6 — Raudhatul Ma'arif 6", short_name "Codex RAMA 6", theme_color `#0B5D4C`, background_color `#FAF8F3`, display `standalone`, icon 192x192 & 512x512 (termasuk maskable).
- Cache asset statis untuk load cepat & installable.
- IndexedDB offline queue (bagian 8) berjalan independen dari service worker cache asset — dua mekanisme berbeda, jangan dicampur.
- Tombol/prompt "Install aplikasi" yang natural.

---

## 11. Struktur Folder Proyek (usulan)

```
src/
  components/       # Button, Card, Modal, Table, Toast, Skeleton, EmptyState, OfflineBanner
  features/
    auth/
    santri/
    kelas/
    guru/
    seksi/
    anggota/        # khusus super admin
    dashboard/
    export/         # exportToXlsx, exportToDocx, exportToPdf, exportToMarkdown
  lib/
    supabaseClient.ts
    nicknameToEmail.ts
    offlineQueue.ts   # mutateWithQueue, processQueue
  routes/
  hooks/
  types/
  styles/
public/
  manifest.json
  icons/
```

---

## 12. Environment Variables

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

**Jangan pernah** menaruh `service_role key` di kode frontend — hanya `anon key`, keamanan ditegakkan lewat RLS.

---

## 13. Deployment ke Netlify

1. Build command: `npm run build`, publish directory: `dist`.
2. Set kedua env var di atas lewat Netlify dashboard.
3. `public/_redirects`:
   ```
   /*  /index.html  200
   ```
4. Opsional `netlify.toml`:
   ```toml
   [build]
     command = "npm run build"
     publish = "dist"

   [[redirects]]
     from = "/*"
     to = "/index.html"
     status = 200
   ```

---

## 14. Batasan (Non-goals Fase Ini)

- Tidak pakai Google/OAuth pihak ketiga — hanya nickname + seed via Supabase Auth.
- Tidak membangun modul keuangan/pembayaran SPP.
- Tidak membangun AI agent sekarang (bagian 15) — cukup siapkan agar mudah ditambah nanti.
- Sinkronisasi offline best-effort (last-write-wins), bukan conflict-resolution penuh.

---

## 15. Catatan Pengembangan Lanjutan (AI Agent — Fase Berikutnya)

Pisahkan semua operasi data ke service functions per modul (mis. `features/santri/api.ts`), dipanggil lewat `mutateWithQueue`. Nanti tinggal buat modul baru (`features/agent/`) yang memanggil service functions yang sama, tanpa bongkar ulang kode CRUD yang sudah ada.

---

## 16. Checklist Deliverables

- [ ] Schema + RLS (3 role) + trigger proteksi super admin terakhir berjalan di Supabase
- [ ] Sign up & login nickname+seed berfungsi, email confirmation dimatikan
- [ ] Super admin pertama berhasil di-bootstrap via SQL
- [ ] CRUD penuh santri/kelas/guru/seksi sesuai matrix hak akses (bagian 5)
- [ ] Grant/cabut role (guru/guru_super/super_admin) berfungsi, bisa multi super admin
- [ ] Realtime sync antar user terbukti jalan
- [ ] Halaman "Anggota" — super admin bisa nonaktifkan/pecat & ubah role
- [ ] Ekspor XLSX/MD/PDF dari list view, DOCX/PDF dari detail view — semua role
- [ ] Offline queue: CRUD saat offline tersimpan lokal, otomatis replay saat online, ada indikator UI, gagal-sync dinotifikasi (tidak silent)
- [ ] UI mengikuti design tokens & motion bagian 9
- [ ] PWA installable (manifest + service worker aktif)
- [ ] Deploy sukses di Netlify dengan `_redirects` terpasang
