# Codex — RAMA 6 — Raudhatul Ma'arif 6

PWA internal untuk pondok pesantren Raudhatul Ma'arif 6. Dipakai guru-guru untuk mengelola data santri, kelas, guru, seksi secara kolaboratif realtime dengan 3 tingkat kewenangan, offline-first.

## Stack

- React 18 + Vite + TypeScript
- Tailwind CSS + Framer Motion
- React Router v6, TanStack Query v5
- React Hook Form + Zod
- Supabase (Postgres + Auth + Realtime)
- PWA: vite-plugin-pwa (autoUpdate)
- Offline queue: idb-keyval
- Export: SheetJS xlsx, docx, jspdf

## How to Run

```bash
npm run dev
```

Runs on port **5000**. The `Start application` workflow handles this automatically.

## Required Secrets

Set in Replit Secrets:

| Key | Description |
|-----|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Supabase public anon key |

## Auth

Login uses **nickname + seed** (no email/OAuth). The first super admin must be bootstrapped via SQL in the Supabase dashboard. See README.md for the full Supabase schema and RLS setup.

## Project Structure

```
src/
  components/   Shared UI components
  features/     Feature modules (santri, kelas, guru, seksi, anggota, auth, dashboard, export, agent, aktivitas)
  hooks/        Custom hooks (useRealtime)
  lib/          Utilities (supabaseClient, offlineQueue, storage, etc.)
  types/        TypeScript types
```

## Deploy

Originally configured for Netlify (`netlify.toml`, `public/_redirects`). Build command: `npm run build`, publish dir: `dist`. Set the same two env vars in the target platform.

## User Preferences

- Keep existing project structure and stack — do not restructure or migrate.
