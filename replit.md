# Codex — RAMA 6 — Raudhatul Ma'arif 6

PWA internal untuk pondok pesantren Raudhatul Ma'arif 6. Dipakai guru-guru untuk mengelola data santri, kelas, guru, seksi secara kolaboratif realtime.

## Stack

- React 18 + Vite + TypeScript
- Tailwind CSS + Framer Motion
- React Router v6, TanStack Query v5
- React Hook Form + Zod
- Supabase (Postgres + Auth + Realtime)
- PWA: vite-plugin-pwa + IndexedDB offline queue
- Export: SheetJS xlsx, docx, jspdf

## Cara Menjalankan

```bash
npm run dev   # dev server di port 5000
npm run build # production build
```

## Environment Variables (Secrets)

| Key | Keterangan |
|-----|-----------|
| `VITE_SUPABASE_URL` | URL project Supabase |
| `VITE_SUPABASE_ANON_KEY` | Anon key Supabase (bukan service_role) |

## Setup Database Supabase

Jalankan SQL berikut di Supabase SQL Editor secara berurutan:
1. `supabase-schema.sql` — schema utama, RLS, trigger
2. `supabase-migration-v2.sql` — migrasi v2
3. `supabase-migration-v3.sql` — migrasi v3

Lalu di Supabase Dashboard → Authentication → Providers → Email: **matikan Confirm email**.

## Auth Flow

Login menggunakan nickname + seed (bukan email asli). Email sintetis dibuat otomatis:
`nickname → {slug}@santri.rm6.internal`

Bootstrap super admin pertama dilakukan via SQL (lihat README.md).

## Role & Hak Akses

- **super_admin** — akses penuh termasuk halaman Anggota (grant/cabut role)
- **admin** — CRUD santri, kelas, guru, seksi
- **guru** — lihat data, ekspor

## Offline Queue

Mutasi yang gagal (offline) disimpan di IndexedDB dan di-replay otomatis saat online kembali.

## Deploy

Awalnya dirancang untuk Netlify. `public/_redirects` sudah ada untuk SPA routing.
Di Replit, jalankan workflow **Start application** (`npm run dev`).
