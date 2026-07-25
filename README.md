# Codex — RAMA 6 — Raudhatul Ma'arif 6

PWA internal untuk pondok pesantren Raudhatul Ma'arif 6. Dipakai guru-guru untuk mengelola data santri, kelas, guru, seksi secara kolaboratif realtime dengan 3 tingkat kewenangan, offline-first, dan siap deploy ke Netlify.

## Tech Stack
- React + Vite + TypeScript
- Tailwind CSS + Framer Motion
- React Router v6, TanStack Query
- React Hook Form + Zod
- Supabase (Postgres + Auth + Realtime)
- PWA: vite-plugin-pwa
- Offline queue: idb-keyval
- Export: SheetJS xlsx, docx, jspdf
- Icons: lucide-react, Toast: sonner

## Fitur Wajib Checklist
- [x] Schema + RLS 3 role + trigger proteksi super admin terakhir
- [x] Sign up & login nickname+seed, email confirmation mati
- [x] Bootstrap super admin pertama via SQL
- [x] CRUD santri/kelas/guru/seksi sesuai matrix hak akses
- [x] Grant/cabut role berfungsi multi super admin
- [x] Realtime sync (postgres_changes -> invalidate query)
- [x] Halaman Anggota super admin only
- [x] Ekspor XLSX/MD/PDF list view, DOCX/PDF detail view
- [x] Offline queue: wrapper mutateWithQueue, FIFO per record, auto replay saat online, indikator UI, notifikasi gagal-sync
- [x] UI design tokens + motion (Fraunces + Plus Jakarta Sans, primary #0B5D4C, accent #C9A227)
- [x] PWA installable (manifest + service worker)
- [x] Deploy ready Netlify + _redirects

## Setup Lokal

1. Clone & install
```bash
npm install
```

2. Buat `.env`
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```
JANGAN pakai service_role key di frontend.

3. Jalankan SQL di Supabase
- Buka Supabase Dashboard > SQL Editor
- Paste isi `supabase-schema.sql` > Run

4. Setting Auth Supabase
- Dashboard > Authentication > Providers > Email
- Matikan **Confirm email**

5. Dev
```bash
npm run dev
```

6. Build
```bash
npm run build
```

## Auth Flow (Nickname + Seed)

Email sintetis: `nicknameToEmail()` di `src/lib/nicknameToEmail.ts`
```ts
function nicknameToEmail(nickname: string){
  const slug = nickname.trim().toLowerCase().replace(/[^a-z0-9]/g,'');
  return `${slug}@santri.rm6.internal`;
}
```
- SignUp: cek nickname unik (ilike), signUp Supabase, insert profiles role default guru
- Login: convert nickname -> email sintetis -> signInWithPassword
- Bootstrap super admin pertama:
```sql
update profiles set role='super_admin' where lower(nickname)='adminpertama';
```

## RLS & Hak Akses Matrix
| Aksi | Guru | Guru Super | Super Admin |
|---|---|---|---|
| Lihat data | ✅ | ✅ | ✅ |
| Tambah/edit | ✅ | ✅ | ✅ |
| Hapus | ❌ | ✅ | ✅ |
| Ekspor | ✅ | ✅ | ✅ |
| Lihat daftar akun | read-only | read-only | ✅ |
| Aktifkan/nonaktif/pecat & ubah role | ❌ | ❌ | ✅ |

Ditegakkan dua lapis: RLS di DB (utama) + hidden/disabled UI.

Trigger proteksi:
- `prevent_privilege_escalation`: hanya super_admin boleh ubah role/status
- `prevent_last_super_admin_removal` & `prevent_last_super_admin_delete`: cegah hilangnya super_admin terakhir

## Struktur Folder
```
src/
  components/       # Button, Card, Modal, Table, Skeleton, EmptyState, OfflineBanner, Layout
  features/
    auth/           # AuthContext, Login, Signup, ProtectedRoute, Profile
    santri/         # api, List, Form, Detail
    kelas/          # api, List, Form, Detail
    guru/           # api, List, Form, Detail
    seksi/          # api, List, Form, Detail
    anggota/        # AnggotaPage (super_admin)
    dashboard/      # DashboardPage
    export/         # exportToXlsx, Docx, Pdf, Md
  lib/
    supabaseClient.ts
    nicknameToEmail.ts
    offlineQueue.ts # mutateWithQueue, processQueue
  hooks/            # useRealtime
  types/
public/
  _redirects
  icons/
```

## Offline & Sync

Wrapper terpusat:
```ts
mutateWithQueue({ table, operation, payload })
```
- Jika offline / network error -> simpan ke IndexedDB via idb-keyval `{localId, table, operation, payload, createdAt, status:'pending'}`
- ID dibuat di client via `crypto.randomUUID()` supaya tidak perlu remapping
- Optimistic update di React Query cache (ditandai `_pendingSync`)
- Replay queue:
  - Trigger `online` event + saat app open + polling 30 detik
  - FIFO per record, sukses hapus dari queue, gagal tampilkan notifikasi (tidak silent)
- UI: banner persisten + badge clock + panel failed items di kanan bawah

## Ekspor Data

Client-side semua, tanpa backend tambahan:
- List view: XLSX (full table), MD (ringkas), PDF (laporan)
- Detail view: DOCX (profil individu) & PDF (kartu)
- Nama file: `{modul}_{konteks}_{tanggal}.{ext}`

## Desain UI/UX

Tokens:
- primary #0B5D4C, primary-dark #08453A, accent #C9A227, bg #FAF8F3, surface #FFFFFF, text #1F2A28, secondary #6B7280, border #E5E1D8, danger #B3261E, success #2F9E44
- Heading: Fraunces, Body: Plus Jakarta Sans, angka tabular-nums
- Layout: sidebar collapsible desktop, bottom nav 4 ikon utama mobile + hamburger, card rounded-2xl shadow soft, spacing 8px multiple
- Signature: pola girih islami opacity 5-8% di login & footer sidebar

Motion Framer: fade+translate 8px 200ms, staggerChildren 0.03s, modal scale 0.96->1 spring, button whileTap 0.97, layoutId sidebar active, toast slide-in, banner slide-down, respect prefers-reduced-motion.

## PWA

- vite-plugin-pwa autoUpdate
- manifest.json: name "Codex — RAMA 6 — Raudhatul Ma'arif 6", short_name "Codex RAMA 6", theme #0B5D4C, bg #FAF8F3, display standalone, icons 192 & 512 maskable
- Cache asset statis, IndexedDB queue independen dari SW cache
- Tombol install natural (browser prompt)

## Deploy Netlify

1. Build command: `npm run build`, publish: `dist`
2. Set env var VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY di Netlify dashboard
3. `public/_redirects` sudah ada `/* /index.html 200`
4. Opsional `netlify.toml` included

## Pengembangan Lanjutan (AI Agent Fase Berikutnya)

Semua operasi data dipisah ke `features/*/api.ts` dipanggil via `mutateWithQueue`. Untuk agent, cukup buat modul baru `features/agent/` yang memanggil service functions yang sama tanpa bongkar CRUD.

## Batasan Fase Ini

- Tanpa Google/OAuth, hanya nickname+seed
- Tanpa modul keuangan SPP
- Tanpa AI agent sekarang (siap extend)
- Sync best-effort last-write-wins, bukan CRDT full

---
Made for pondok Raudhatul Ma'arif 6 • 2026
