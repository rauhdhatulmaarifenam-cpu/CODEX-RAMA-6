# Codex — RAMA 6

PWA manajemen internal untuk Pondok Pesantren Raudhatul Ma'arif 6. Dipakai guru-guru untuk mengelola data santri, kelas, guru, dan seksi secara kolaboratif realtime, dengan 3 tingkat kewenangan, offline-first.

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript
- **Styling**: Tailwind CSS + Framer Motion
- **Routing**: React Router v6
- **Data Fetching**: TanStack Query v5
- **Forms**: React Hook Form + Zod
- **Backend**: Supabase (Postgres + Auth + Realtime)
- **PWA**: vite-plugin-pwa (autoUpdate, service worker)
- **Offline**: idb-keyval (offline queue, FIFO per record)
- **Export**: SheetJS xlsx, docx, jspdf + jspdf-autotable

## How to Run

```bash
npm run dev   # dev server on port 5000
npm run build # production build to dist/
```

The workflow "Start application" runs `npm run dev` automatically.

## Required Environment Secrets

Set these in Replit Secrets (not `.env` file):

| Secret | Description |
|---|---|
| `VITE_SUPABASE_URL` | Supabase Project URL (https://xxx.supabase.co) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/public key |

Add them via the Secrets panel (lock icon in sidebar), then restart the "Start application" workflow.

## First-Time Setup (Supabase)

1. Buka Supabase Dashboard → SQL Editor, jalankan isi `supabase-schema.sql`
2. Matikan **Confirm email**: Authentication → Providers → Email → Confirm email: OFF
3. Bootstrap super admin pertama:
   ```sql
   UPDATE profiles SET role='super_admin' WHERE lower(nickname)='adminpertama';
   ```

## Auth Flow

Login pakai nickname + password (seed). Email sintetis dibuat otomatis di `src/lib/nicknameToEmail.ts`.

## Key Source Directories

```
src/
  features/
    santri/     – CRUD santri + paginasi + ekspor lengkap
    guru/       – CRUD guru + seksi junction + ekspor lengkap
    kelas/      – CRUD kelas + wali kelas + ekspor dengan daftar santri
    seksi/      – CRUD seksi + guru anggota + ekspor dengan daftar guru
    export/     – exporters.ts: xlsx, markdown, pdf list & single record
    auth/       – AuthContext, login, signup
    dashboard/  – halaman utama + statistik
  lib/
    dateUtils.ts    – hitungUsia(), formatTanggalDenganUsia() — dipakai di semua list & detail
    supabaseClient  – inisialisasi Supabase
    offlineQueue    – mutateWithQueue + FIFO replay
    storage         – upload/signed URL foto profil
  components/     – Button, Card, Table, Modal, ExportMenu, dll
```

## Pagination (Santri)

Query paginasi Santri menggunakan urutan berlapis:
```ts
.order('nama_lengkap').order('id')
```
`id` sebagai penentu urutan kedua memastikan Postgres menghasilkan urutan deterministik antar halaman. Setiap baris tabel menggunakan `key={s.id}` (bukan index array).

## Export

Semua ekspor daftar (xlsx/pdf/md) mengambil **seluruh data** dari Supabase terlepas dari paginasi:
- Santri: `fetchAllSantri()` dengan filter aktif
- Guru: `fetchAllGuru()` + `fetchKelasWaliByGuruIds()` untuk data wali kelas lengkap
- Kelas: `fetchAllKelas()` + `fetchSantriGroupedByKelasId()` untuk daftar santri per kelas
- Seksi: `fetchAllSeksiWithGuru()` untuk daftar guru anggota per seksi

Ekspor detail per record (docx/pdf) menyertakan data relasi lengkap (santri di kelas, guru di seksi, wali kelas untuk guru).

## User Preferences

- Komentar dan pesan UI dalam Bahasa Indonesia
- Pertahankan struktur direktori per-fitur (features/xxx/)
- Jangan ubah field tanggal lahir menjadi field usia — hitung usia secara otomatis di sisi tampilan
