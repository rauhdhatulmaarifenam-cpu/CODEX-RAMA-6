# DOKUMEN FULLSOURCE — Codex — RAMA 6

**Sistem Manajemen Pesantren Raudhatul Ma'arif 6**
Tanggal update: 22 Juli 2026
Versi: 2.1.1 — Fix realtime sinkronisasi Dashboard lintas halaman

---

## DAFTAR ISI
1. Ringkasan Eksekutif
2. Arsitektur & Tech Stack
3. Struktur Database & RLS
4. Autentikasi Nickname+Seed
5. Matriks Hak Akses
6. Modul & Routing
7. Offline-First & Sinkronisasi
8. Ekspor Data
9. UI/UX Design System
10. PWA
11. Struktur Folder Lengkap
12. Penjelasan Tiap File Source (Full)
13. Deployment Netlify
14. Checklist Verifikasi
15. Langkah Bootstrap Awal
16. Pengembangan Lanjutan

---

## 1. Ringkasan Eksekutif

Aplikasi internal pondok untuk kolaborasi guru mengelola santri, kelas, guru, seksi secara realtime. Didesain mobile-first, offline-capable (last-write-wins best-effort), 3 role, ekspor client-side, PWA installable, deploy Netlify, backend Supabase.

**Perubahan v2.1** (di atas v2.0):
- Kolom `kategori` ditambahkan ke tabel `kelas` (Mondok / Non Mondok / kosong)
- Kolom `tingkat` diperluas menjadi 6 nilai: Ula, Wustha, Ulya, TPA, Remaja, Dewasa
- Constraint DB `kelas_kategori_tingkat_check` memastikan pasangan kategori↔tingkat selalu valid
- Migrasi aman (`supabase-migration-v3.sql`): baris lama bertingkat Ula/Wustha/Ulya otomatis diisi `kategori = 'Mondok'`
- Form Kelas: dua dropdown berurutan — pilih Kategori terlebih dahulu, Tingkat menyesuaikan dan nonaktif sebelum Kategori dipilih; ganti Kategori akan reset Tingkat
- Daftar dan Detail Kelas: Kategori dan Tingkat ditampilkan sebagai badge warna terpisah (hijau untuk Mondok, biru untuk Non Mondok)
- Ekspor xlsx/pdf/md di Kelas kini mencantumkan kolom Kategori dan Tingkat secara terpisah
- Ekspor docx/pdf per-record di KelasDetail mencantumkan field Kategori dan Tingkat

**Perubahan v2.0**:
- Relasi guru↔seksi diubah dari 1-to-1 menjadi many-to-many via tabel `guru_seksi`
- Relasi kelas↔wali_kelas diubah dari 1-to-1 menjadi many-to-many via tabel `kelas_wali`
- Field `mata_pelajaran` dihapus total dari tabel guru dan semua UI
- Field `seksi_id` dihapus total dari tabel santri dan semua UI
- NIS santri dibuat opsional (nullable), unik hanya jika diisi (partial unique index)
- Tingkat kelas dari isian bebas menjadi pilihan tetap: Ula, Wustha, Ulya
- ExportMenu diperbaiki dari `absolute` ke `fixed` dengan `getBoundingClientRect`, tidak terpotong di layar kecil
- Semua fungsi ekspor di `exporters.ts` kini memanggil `toast.success` saat berhasil dan `toast.error` saat gagal
- Dashboard: seluruh kartu ringkasan kini bisa ditekan dan mengarah ke tab yang sesuai
- SeksiDetail: bagian Santri Anggota dihapus, Guru Anggota kini mengambil data dari `guru_seksi`

---

## 2. Arsitektur & Tech Stack

```
Browser (React Vite SPA)
 ├─ Tailwind + Framer Motion (UI)
 ├─ TanStack Query (cache + realtime invalidation)
 ├─ React Hook Form + Zod (validasi)
 ├─ IndexedDB (idb-keyval) offline queue
 ├─ Export (xlsx, docx, jspdf v4 + jspdf-autotable v5, md string)
 ├─ vite-plugin-pwa (service worker asset cache)
 └─ Supabase JS Client
        ├─ Auth (email sintetis)
        ├─ Postgres + RLS
        └─ Realtime (postgres_changes)
```

**Dependencies utama**: React 18, Vite 5, TS 5.6, Tailwind 3, Framer Motion 11, React Router v6, TanStack Query v5, RHF v7+Zod, Supabase JS v2, sonner, idb-keyval, xlsx, docx, jspdf@4.2.1, jspdf-autotable@5.0.8, lucide-react, vite-plugin-pwa.

**Catatan**: jsPDF v3 dan ke bawah diblokir firewall Replit. Gunakan jsPDF v4+ (sudah diverifikasi berjalan).

---

## 3. Struktur Database (Supabase Postgres)

File skema lengkap: `supabase-schema.sql` (instalasi baru)
File migrasi dari v1: `supabase-migration-v2.sql`

### ER Ringkas (v2)
```
profiles 1──* seksi.pembina_id
profiles 1──1 auth.users

seksi ←──── guru_seksi ────► guru   (many-to-many)
kelas ←──── kelas_wali ────► guru   (many-to-many)
kelas 1──* santri.kelas_id
```

### ENUM
- `role_type`: guru, guru_super, super_admin
- `account_status`: aktif, nonaktif
- `gender_type`: L, P
- `santri_status_type`: aktif, lulus, keluar, pindah
- `TingkatType` (TypeScript): Ula, Wustha, Ulya (check constraint di DB, bukan ENUM)

### Tabel

- **profiles**: id uuid FK auth.users cascade, nickname text unique lower-indexed, nama_lengkap, role, status, no_telepon, avatar_url, timestamps
- **seksi**: id uuid PK, nama_seksi, deskripsi, pembina_id FK profiles set null, timestamps, created_by
- **guru**: id uuid PK, user_id unique FK profiles set null, nama_lengkap, nip (opsional), jenis_kelamin, tempat/tgl lahir, alamat, no_telepon, status, foto_url, timestamps, created_by. **Tidak ada mata_pelajaran. Tidak ada seksi_id.**
- **guru_seksi**: id PK, guru_id FK guru cascade, seksi_id FK seksi cascade, created_at. UNIQUE(guru_id, seksi_id). Index pada keduanya.
- **kelas**: id PK, nama_kelas, `kategori` text check ('Mondok','Non Mondok'), `tingkat` text check ('Ula','Wustha','Ulya','TPA','Remaja','Dewasa'), tahun_ajaran, kapasitas, timestamps, created_by. **Tidak ada wali_kelas_id.** Constraint `kelas_kategori_tingkat_check`: (NULL,NULL) OR (Mondok,NULL|Ula|Wustha|Ulya) OR (Non Mondok,NULL|TPA|Remaja|Dewasa).
- **kelas_wali**: id PK, kelas_id FK kelas cascade, guru_id FK guru cascade, created_at. UNIQUE(kelas_id, guru_id). Index pada keduanya.
- **santri**: id PK, nis text nullable (partial unique index where nis is not null), nama_lengkap, jk, tempat/tgl lahir, alamat, nama_wali, no_telp_wali, kelas_id FK kelas set null, status, tanggal_masuk, foto_url, catatan, timestamps, created_by. **Tidak ada seksi_id.**

### RLS
Enable RLS semua tabel. Functions security definer stable:
- `is_active_user()`: exists profiles id=auth.uid() status aktif
- `is_super_admin()`: role super_admin aktif
- `can_delete_data()`: role in (guru_super, super_admin) aktif

Policies seksi/guru/guru_seksi/kelas/kelas_wali/santri: select/insert/update if is_active_user(), delete if can_delete_data().

### Realtime
`alter publication supabase_realtime add table ...` untuk semua tabel termasuk guru_seksi dan kelas_wali.

---

## 4. Autentikasi Nickname+Seed

File: `src/lib/nicknameToEmail.ts`, `src/features/auth/AuthContext.tsx`, `LoginPage.tsx`, `SignupPage.tsx`

**Konversi**:
```ts
function nicknameToEmail(nickname: string): string {
  const slug = nickname.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${slug}@santri.rm6.internal`;
}
```

**Alur Sign Up**: form nickname+seed → cek unique ilike → signUp Supabase → insert profiles role guru aktif → auto login.

**Login**: nickname+seed → convert email → signInWithPassword → fetchProfile → cek status aktif.

**Supabase Setting**: Auth > Providers > Email > matikan Confirm email.

**Bootstrap super admin pertama**:
```sql
update profiles set role='super_admin' where lower(nickname)='nickname_pertama';
```

---

## 5. Matriks Hak Akses

| Aksi | Guru | Guru Super | Super Admin |
|---|---|---|---|
| Lihat data santri/kelas/guru/seksi | ✅ | ✅ | ✅ |
| Tambah/edit | ✅ | ✅ | ✅ |
| Hapus | ❌ | ✅ | ✅ |
| Ekspor XLSX/MD/PDF/DOCX | ✅ | ✅ | ✅ |
| Kelola akun (Halaman Anggota) | ❌ | ❌ | ✅ |
| Ubah role | ❌ | ❌ | ✅ |
| Edit profil sendiri | ✅ | ✅ | ✅ |

Enforcement 2 lapis: RLS (utama) + disabled/hidden UI. `useAuth().canDelete` = role guru_super/super_admin.

---

## 6. Modul & Routing

Routes (React Router v6 SPA, Netlify _redirects 200):
- `/login`, `/signup` publik
- `/dashboard` ringkasan angka — **kartu dapat diklik, navigasi ke tab terkait**
- `/santri` list + search + filter kelas/status + pagination; detail + form create/edit
- `/kelas` list; detail (+ daftar santri); form tingkat select Ula/Wustha/Ulya, multi-select wali
- `/guru` list; detail (+ daftar wali kelas); form multi-select seksi (bukan dropdown tunggal)
- `/seksi` list; detail (guru anggota via guru_seksi, santri anggota **dihapus**)
- `/santri/laporan` laporan visual santri — bar chart per kelas, donut chart status, tabel lengkap
- `/kelas/laporan` laporan visual kelas — bar chart jumlah santri, donut chart kategori, tabel lengkap
- `/guru/laporan` laporan visual guru — bar chart per seksi (many-to-many), donut chart status aktif, tabel
- `/seksi/laporan` laporan visual seksi — bar chart anggota guru per seksi, tabel lengkap
- `/anggota` khusus super_admin — kelola role, status, hapus akun; tombol Reset Seed per baris
- `/aktivitas` khusus super_admin — riwayat perubahan data, realtime, paginasi
- `/agent` khusus super_admin; placeholder "Segera Hadir"; muncul di nav hanya jika role pengguna `super_admin`
- `/profil` edit profil sendiri

---

## 7. Offline-First & Sinkronisasi

File: `src/lib/offlineQueue.ts`

Sama seperti v1, dengan tambahan tabel `guru_seksi` dan `kelas_wali` di type `OfflineQueueItem['table']`.

**Catatan penting**: Sync junction table (`guru_seksi` dan `kelas_wali`) dilakukan secara langsung (tidak via offline queue). Jika sedang offline saat submit form guru/kelas, relasi seksi/wali tidak akan tersinkron hingga koneksi kembali dan user submit ulang.

Arsitektur offline queue tidak berubah dari v1 (IndexedDB, processQueue FIFO, banner UI, etc).

---

## 8. Ekspor Data

File: `src/features/export/exporters.ts`

Semua client-side tanpa backend. Library: SheetJS xlsx, docx, **jsPDF v4 + jspdf-autotable v5** (bukan pdfmake).

**Perubahan v2**:
- Setiap fungsi ekspor membungkus logika dalam try/catch
- Saat berhasil: `toast.success('File XXX berhasil diunduh')`
- Saat gagal: `toast.error('Gagal ekspor XXX: ' + pesan_error)`
- PDF menggunakan warna brand: header tabel primary #0B5D4C, garis aksen #C9A227, alternate row #FAF8F3

**Kolom ekspor yang berubah**:
- Guru: tidak ada kolom Mapel, kolom Seksi diisi dari `guru_seksi` (join, gabungan nama)
- Kelas: kolom Wali Kelas diisi dari `kelas_wali` (join, gabungan nama)
- Santri: tidak ada kolom Seksi

---

## 9. UI/UX Design System

Tidak berubah dari v1 kecuali:

**ExportMenu.tsx** (diperbaiki v2):
- Posisi menu dari `absolute right-0 top-full` → `fixed` dengan koordinat dihitung via `getBoundingClientRect` pada trigger button
- Konstanta: `MENU_W = 224px` (w-56), `MENU_H` diestimasi per mode (88px single, 128px list), `MARGIN = 8px`
- `useEffect` dipasang listener `scroll` (capture: true) dan `resize` saat menu terbuka, dihapus saat menu tutup
- Menu tidak lagi terpotong di layar kecil atau saat posisi scroll

**DashboardPage.tsx** (diperbaiki v2):
- Setiap kartu ringkasan memiliki `onClick={() => navigate(href)}` dan `cursor-pointer`
- Total Santri → `/santri`, Total Guru → `/guru`, Total Kelas → `/kelas`, Total Seksi → `/seksi`

---

## 10. PWA

Tidak berubah dari v1.

---

## 11. Struktur Folder Lengkap

```
/
├── public/
│   ├── _redirects
│   └── icons/
├── src/
│   ├── components/
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── EmptyState.tsx
│   │   ├── ExportMenu.tsx        ← diperbaiki: fixed positioning
│   │   ├── GlobalRealtimeSync.tsx ← BARU v2.1.1: langganan realtime global untuk Dashboard
│   │   ├── Layout.tsx            ← diubah v2.1.1: render GlobalRealtimeSync
│   │   ├── Modal.tsx
│   │   ├── OfflineBanner.tsx
│   │   ├── Skeleton.tsx
│   │   └── Table.tsx
│   ├── features/
│   │   ├── auth/
│   │   ├── anggota/
│   │   ├── dashboard/
│   │   │   └── DashboardPage.tsx ← diperbaiki: kartu navigable, realtime dipindah ke GlobalRealtimeSync (v2.1.1)
│   │   ├── export/
│   │   │   └── exporters.ts      ← diperbaiki: toast sukses/error, jsPDF v4
│   │   ├── guru/
│   │   │   ├── api.ts            ← diubah: guru_seksi junction
│   │   │   ├── GuruDetail.tsx    ← diubah: hapus mata_pelajaran, tambah wali kelas
│   │   │   ├── GuruForm.tsx      ← diubah: hapus mata_pelajaran, multi-select seksi
│   │   │   └── GuruList.tsx      ← diubah: hapus kolom Mapel
│   │   ├── kelas/
│   │   │   ├── api.ts            ← diubah: kelas_wali junction
│   │   │   ├── KelasDetail.tsx   ← diubah: multi wali kelas
│   │   │   ├── KelasForm.tsx     ← diubah: tingkat select, multi-select wali
│   │   │   └── KelasList.tsx     ← diubah: tampil multi wali
│   │   ├── santri/
│   │   │   ├── api.ts            ← diubah: hapus seksi_id dari query
│   │   │   ├── SantriDetail.tsx  ← diubah: hapus field Seksi
│   │   │   ├── SantriForm.tsx    ← diubah: hapus seksi, NIS opsional
│   │   │   └── SantriList.tsx    ← diubah: hapus seksi filter
│   │   └── seksi/
│   │       ├── api.ts
│   │       ├── SeksiDetail.tsx   ← diubah: hapus santri anggota, guru via guru_seksi
│   │       ├── SeksiForm.tsx
│   │       └── SeksiList.tsx
│   ├── hooks/
│   │   └── useRealtime.ts
│   ├── lib/
│   │   ├── cn.ts
│   │   ├── nicknameToEmail.ts
│   │   ├── offlineQueue.ts
│   │   └── supabaseClient.ts
│   ├── types/
│   │   └── index.ts              ← diubah: GuruSeksiEntry, KelasWaliEntry, TingkatType
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── supabase-schema.sql           ← diperbarui: struktur v2 tanpa kolom lama
├── supabase-migration-v2.sql     ← BARU: migrasi aman dari v1 ke v2
├── netlify.toml
├── .env.example
└── DOKUMEN-FULLSOURCE-CODEX-RAMA6.md
```

---

## 12. Penjelasan Tiap File Source (Full)

### Config & Entry
Tidak berubah dari v1.

### Types (`src/types/index.ts`)
- `KategoriType`: `'Mondok' | 'Non Mondok'`
- `TingkatMondok`: `'Ula' | 'Wustha' | 'Ulya'`
- `TingkatNonMondok`: `'TPA' | 'Remaja' | 'Dewasa'`
- `TingkatType`: `TingkatMondok | TingkatNonMondok`
- `TINGKAT_BY_KATEGORI`: konstanta `Record<KategoriType, readonly TingkatType[]>` — map kategori ke opsi tingkat yang valid; digunakan form dan UI
- `Kelas.kategori`: `KategoriType | null` (ditambahkan di v2.1)
- `GuruSeksiEntry`: `{ seksi_id: string; seksi?: Pick<Seksi, 'id'|'nama_seksi'>|null }`
- `KelasWaliEntry`: `{ guru_id: string; guru?: { id: string; nama_lengkap: string }|null }`
- `Guru`: dihapus `mata_pelajaran`, dihapus `seksi_id`, ditambah `guru_seksi?: GuruSeksiEntry[]`
- `Kelas`: dihapus `wali_kelas_id`, dihapus relasi `wali_kelas`, ditambah `kelas_wali?: KelasWaliEntry[]`
- `Santri`: dihapus `seksi_id`, dihapus relasi `seksi`, `nis` menjadi `string | null`
- `OfflineQueueItem['table']`: ditambah `'guru_seksi' | 'kelas_wali'`

### Guru Feature

**`guru/api.ts`**:
- `GURU_SELECT = '*, guru_seksi(seksi_id, seksi:seksi_id(id,nama_seksi))'`
- `useGuruList`: filter seksi dilakukan client-side via `guru_seksi?.some(gs => gs.seksi_id === params.seksiId)`
- `useGuruDetail`: sama dengan select di atas, single
- `syncGuruSeksi(guruId, seksiIds[])`: delete all lama + insert baru
- `createGuru(payload, seksiIds[])`: mutateWithQueue insert + syncGuruSeksi jika online
- `updateGuru(id, payload, seksiIds?)`: mutateWithQueue update + syncGuruSeksi jika online dan seksiIds diberikan
- `deleteGuru(id)`: tidak berubah

**`GuruForm.tsx`**:
- Skema Zod: dihapus `mata_pelajaran`, dihapus `seksi_id`
- State terpisah `seksiIds: string[]` dikelola di luar react-hook-form
- UI: chip checkbox `<label className="...border-primary bg-primary/10...">` per seksi, bisa pilih banyak
- NIP berlabel "(opsional)"
- Submit: `createGuru(payload, seksiIds)` / `updateGuru(id!, payload, seksiIds)`
- useEffect: load `existing.guru_seksi?.map(gs => gs.seksi_id)` ke state

**`GuruList.tsx`**:
- Kolom tabel: Nama, NIP, Seksi (multiple), Status, Aksi — **tidak ada kolom Mapel**
- Kolom ekspor: nama_lengkap, nip, seksi_nama (join), status
- Seksi ditampilkan: `g.guru_seksi?.map(gs => gs.seksi?.nama_seksi).filter(Boolean).join(', ') || '-'`
- Tambahkan `useRealtime('guru_seksi', [['guru']])` agar update seksi otomatis

**`GuruDetail.tsx`**:
- fields array: dihapus Mata Pelajaran, Seksi diambil dari `guru_seksi` (join nama)
- Query tambahan `kelas_wali` untuk menampilkan "Wali Kelas di" (list kelas)
- `useRealtime('guru_seksi', ...)` dan `useRealtime('kelas_wali', ...)`

### Kelas Feature

**`kelas/api.ts`**:
- `KELAS_SELECT = '*, kelas_wali(guru_id, guru:guru_id(id,nama_lengkap))'`
- `useKelasList` / `useKelasDetail`: select dengan kelas_wali join
- `syncKelasWali(kelasId, guruIds[])`: delete all lama + insert baru
- `createKelas(payload, waliIds[])`: mutateWithQueue + syncKelasWali jika online
- `updateKelas(id, payload, waliIds?)`: mutateWithQueue + syncKelasWali jika online

**`KelasForm.tsx`**:
- State: `kategori: KategoriType | ''`, `tingkat: string`, `waliIds: string[]`
- Skema Zod hanya untuk `nama_kelas`, `tahun_ajaran`, `kapasitas` — kategori & tingkat dikelola via state sendiri
- **Dua dropdown berurutan**:
  1. Dropdown Kategori → pilihan: Mondok, Non Mondok
  2. Dropdown Tingkat → opsi dari `TINGKAT_BY_KATEGORI[kategori]`, **disabled** jika kategori belum dipilih
- `handleKategoriChange(val)`: set kategori baru + **reset tingkat ke `''`** agar pilihan tidak keliru
- `useEffect`: load `existing.kategori` + `existing.tingkat` + `existing.kelas_wali?.map(kw => kw.guru_id)` ke state
- Submit payload: `{ ...formData, kategori: kategori||null, tingkat: tingkat||null, ... }`

**`KelasList.tsx`**:
- Komponen `KategoriBadge({ value })`: badge emerald untuk Mondok, indigo untuk Non Mondok (di-export dari file ini)
- Komponen `TingkatBadge({ value, kategori })`: badge dengan border, warna mengikuti kategori
- Kolom tabel: "Kategori & Tingkat" menampilkan kedua badge berdampingan
- Ekspor (xlsx/md/pdf) kini punya **dua kolom terpisah**: `kategori` (header 'Kategori') dan `tingkat` (header 'Tingkat')
- `useRealtime('kelas_wali', [['kelas']])`

**`KelasDetail.tsx`**:
- Import `KategoriBadge`, `TingkatBadge` dari `./KelasList`
- Header card menampilkan dua badge kategori + tingkat
- `fields` array mencantumkan label 'Kategori' dan 'Tingkat' secara terpisah; sel label tersebut me-render badge, bukan teks polos
- `exportFields` terpisah (tanpa badge, teks plain) untuk fungsi `exportSingleToDocx` dan `exportSingleToPdf`
- `useRealtime('kelas_wali', [['kelas', id]])`

### Santri Feature

**`santri/api.ts`**:
- `select('*, kelas:kelas_id(id,nama_kelas)')` — **tidak ada seksi join**
- Detail: `select('*, kelas:kelas_id(*)')` — **tidak ada seksi join**

**`SantriForm.tsx`**:
- Import `useSeksiList` dihapus
- Skema Zod: `nis: z.string().optional().nullable()` — tidak ada min(3), tidak wajib
- Field Seksi dihapus seluruhnya dari form
- NIS berlabel "(opsional, unik jika diisi)"

**`SantriDetail.tsx`**:
- fields array: dihapus field Seksi
- NIS ditampilkan: `data.nis || '-'`

**`SantriList.tsx`**:
- Tidak ada filter seksi
- Kolom ekspor: nis, nama_lengkap, jk, status, kelas — **tidak ada seksi**

### Seksi Feature

**`SeksiDetail.tsx`**:
- Query guru anggota diubah dari `supabase.from('guru').select().eq('seksi_id', id)` menjadi `supabase.from('guru_seksi').select('guru_id, guru:guru_id(id,nama_lengkap)').eq('seksi_id', id)`
- Bagian "Santri Anggota" **dihapus seluruhnya** dari UI dan query
- `useRealtime('guru_seksi', [['seksi-anggota', id]])`

### Dashboard Feature

**`DashboardPage.tsx`** (diperbaiki v2.1.1):
- Import `useNavigate`
- `const navigate = useNavigate()`
- cards array memiliki field `href`: `/santri`, `/guru`, `/kelas`, `/seksi`
- `<motion.div onClick={() => navigate(c.href)} className="cursor-pointer">`
- **Bug fix v2.1.1**: `useRealtime` dihapus dari komponen ini. Invalidasi query `['dashboard']` kini ditangani oleh `GlobalRealtimeSync` di Layout, sehingga langganan tetap aktif di semua halaman.
- **`staleTime: 0`** ditambahkan pada query dashboard agar selalu refetch saat halaman Dashboard dibuka kembali.

**`src/components/GlobalRealtimeSync.tsx`** (baru v2.1.1):
- Komponen tanpa render (`return null`) yang di-mount di dalam `Layout`
- Membuka 6 channel Supabase Realtime: `santri`, `guru`, `kelas`, `seksi`, `guru_seksi`, `kelas_wali`
- Setiap event `*` (INSERT/UPDATE/DELETE) pada tabel tersebut memanggil `qc.invalidateQueries({ queryKey: ['dashboard'] })`
- Channel name: `global-dashboard-sync-{table}`
- Cleanup: `supabase.removeChannel` untuk semua channel saat komponen unmount (logout / session berakhir)

### Export Feature

**`exporters.ts`**:
- Import: `import { toast } from 'sonner'`
- Setiap fungsi (exportToXlsx, exportToMarkdown, exportToPdf, exportSingleToDocx, exportSingleToPdf) dibungkus try/catch
- Sukses: `toast.success('File XXX berhasil diunduh')`
- Gagal: `toast.error('Gagal ekspor XXX: ' + e?.message)`

### ExportMenu Component

**`ExportMenu.tsx`**:
- `const triggerRef = useRef<HTMLDivElement>(null)` pada wrapper div (bukan Button)
- `const [menuStyle, setMenuStyle] = useState<{top:number;left:number}>({top:0,left:0})`
- `recalc()`: `getBoundingClientRect()` pada trigger, hitung `top = r.bottom + 8`, `left = r.right - MENU_W`, clamp ke viewport (`MARGIN = 8`)
- `useEffect` saat `open=true`: panggil recalc(), pasang `scroll` (capture:true) dan `resize` listener, cleanup saat tutup
- Menu: `style={{ position:'fixed', top:menuStyle.top, left:menuStyle.left, width:MENU_W, zIndex:40 }}`
- **Tidak ada `absolute` untuk posisi menu**

---

## 13. Deployment Netlify

Sama dengan v1. Tambahan untuk v2:
- Setelah deploy, jalankan `supabase-migration-v2.sql` di Supabase SQL Editor production
- Verifikasi tabel `guru_seksi` dan `kelas_wali` terbuat dengan benar
- Test ekspor PDF pastikan toast muncul setelah download

---

## 14. Checklist Verifikasi

- [x] `mata_pelajaran` tidak ada di folder `src/` (grep bersih)
- [x] Tabel `guru_seksi` ada di `supabase-migration-v2.sql` dan `supabase-schema.sql`
- [x] Tabel `kelas_wali` ada di `supabase-migration-v2.sql` dan `supabase-schema.sql`
- [x] `ExportMenu.tsx` tidak menggunakan `absolute` untuk posisi menu (grep bersih)
- [x] `exporters.ts` memanggil `toast.success` dan `toast.error` di setiap fungsi ekspor
- [x] `DashboardPage.tsx` memiliki `onClick` dan `navigate` di kartu ringkasan
- [x] Build `vite build` sukses tanpa error (2468 modules, ✓)
- [x] Kolom `kategori` ada di `supabase-migration-v3.sql` (alter table add column if not exists)
- [x] Constraint `kelas_kategori_tingkat_check` ada di `supabase-migration-v3.sql` dan `supabase-schema.sql`
- [x] Migrasi data: baris lama Ula/Wustha/Ulya otomatis diisi `kategori = 'Mondok'`
- [x] `KelasForm.tsx` punya dua dropdown berurutan dengan `handleKategoriChange` yang reset tingkat
- [x] Dropdown Tingkat di-`disabled` saat kategori belum dipilih
- [x] `TINGKAT_BY_KATEGORI` di `types/index.ts` memetakan Kategori → opsi Tingkat yang valid
- [x] `KategoriBadge` dan `TingkatBadge` dirender di tabel KelasList dan di KelasDetail
- [x] Ekspor kelas (xlsx/md/pdf) punya kolom Kategori dan Tingkat terpisah
- [x] Ekspor docx/pdf per-record di KelasDetail mencantumkan field Kategori dan Tingkat
- [x] Build `vite build` sukses (2469 modules ✓) setelah semua perubahan v2.1
- [x] Tingkat kelas 6 opsi: Ula, Wustha, Ulya, TPA, Remaja, Dewasa (dikelompokkan per kategori)
- [x] NIS santri opsional, label "(opsional, unik jika diisi)"
- [x] NIP guru berlabel "(opsional)"
- [x] GuruForm menggunakan chip checkbox multi-select untuk seksi
- [x] KelasForm menggunakan chip checkbox multi-select untuk wali kelas
- [x] SeksiDetail hanya tampilkan Guru Anggota, tidak ada Santri Anggota
- [x] GuruDetail menampilkan daftar kelas wali
- [x] Realtime subscription guru_seksi dan kelas_wali ditambahkan di komponen terkait
- [x] supabase-schema.sql diperbarui sesuai struktur v2
- [x] Tidak ada teks catatan developer yang tampil di UI produk (lihat catatan pembersihan di bawah)
- [x] DOKUMEN ini mencerminkan kode yang sudah benar-benar ditulis
- [x] **v2.1.1**: `GlobalRealtimeSync.tsx` di-mount di `Layout.tsx` — langganan realtime Dashboard aktif di semua halaman
- [x] **v2.1.1**: `useRealtime` dihapus dari `DashboardPage.tsx`
- [x] **v2.1.1**: `staleTime: 0` pada query `['dashboard']` — selalu refetch saat halaman dibuka
- [x] **v2.1.1**: Build `vite build` sukses (2470 modules ✓) setelah perbaikan bug
- [x] **v2.2.0**: `src/lib/capabilities.ts` — 22 entri CRUD metadata untuk AI agent (nama, tabel[], deskripsi, parameter[])
- [x] **v2.2.0**: `src/features/agent/AgentPage.tsx` — halaman placeholder super_admin
- [x] **v2.2.0**: Route `/agent` (ProtectedRoute superAdminOnly) ditambahkan ke App.tsx
- [x] **v2.2.0**: Nav item "AI Agent" di Layout.tsx muncul berdasarkan role `super_admin` saja
- [x] **v2.3.0**: Hapus `VITE_AI_AGENT_ENABLED` — visibilitas menu AI Agent bergantung pada role saja, bukan env var
- [x] **v2.2.0**: `SantriLaporan.tsx` — recharts bar + donut + tabel; tombol "Lihat Laporan" di SantriList
- [x] **v2.2.0**: `KelasLaporan.tsx` — recharts bar + donut + tabel; tombol "Lihat Laporan" di KelasList
- [x] **v2.2.0**: `GuruLaporan.tsx` — recharts bar + donut + tabel; tombol "Lihat Laporan" di GuruList
- [x] **v2.2.0**: `SeksiLaporan.tsx` — recharts bar + tabel; tombol "Lihat Laporan" di SeksiList
- [x] **v2.2.0**: Routes `/santri/laporan`, `/kelas/laporan`, `/guru/laporan`, `/seksi/laporan` di App.tsx
- [x] **v2.2.0**: Build `vite build` sukses (3064 modules ✓) setelah semua perubahan v2.2.0
- [x] **v2.4.0**: `supabase/functions/reset-guru-seed/index.ts` — Edge Function memverifikasi role dari tabel `profiles` sebelum memakai service role key
- [x] **v2.4.0**: `AnggotaPage.tsx` — tombol Reset Seed per baris, dialog seed baru + konfirmasi, memanggil `supabase.functions.invoke`
- [x] **v2.4.0**: `supabase-migration-v4.sql` — bucket `foto-profil` (public=false), RLS storage, tabel `activity_log`, trigger `log_activity()` SECURITY DEFINER
- [x] **v2.4.0**: `activity_log` hanya punya policy SELECT — tidak ada policy INSERT/UPDATE/DELETE dari aplikasi
- [x] **v2.4.0**: `src/lib/storage.ts` — helper uploadFoto, getSignedUrl, deleteFoto, validateFotoFile
- [x] **v2.4.0**: `src/components/FotoAvatar.tsx` — komponen display foto via signed URL
- [x] **v2.4.0**: `SantriForm.tsx` + `GuruForm.tsx` — input foto, pratinjau, upload saat submit, hapus foto lama saat ganti
- [x] **v2.4.0**: `SantriDetail.tsx` + `GuruDetail.tsx` — foto profil tampil via FotoAvatar (signed URL)
- [x] **v2.4.0**: `src/features/aktivitas/AktivitasPage.tsx` — halaman riwayat, paginasi, realtime
- [x] **v2.4.0**: Route `/aktivitas` (ProtectedRoute superAdminOnly) + nav item "Riwayat Aktivitas" (icon History, super_admin only)
- [x] **v2.4.0**: Build `vite build` sukses (3067 modules ✓) setelah semua perubahan v2.4.0

---

## 15. Langkah Bootstrap Awal

**Instalasi Baru (v2)**:
1. Buat project Supabase baru
2. Jalankan `supabase-schema.sql` di SQL Editor
3. Auth > Email > disable Confirm email
4. Set env vars di `.env` lokal & Netlify
5. `npm install && npm run dev`
6. Buka /signup, daftar akun pertama
7. `update profiles set role='super_admin' where lower(nickname)='...';`

**Upgrade dari v1**:
1. Jalankan `supabase-migration-v2.sql` di SQL Editor
2. Deploy kode v2 baru
3. Data relasi lama (guru.seksi_id, kelas.wali_kelas_id) sudah otomatis dimigrasikan

---

## 16. Pengembangan Lanjutan

Semua operasi data ada di `features/*/api.ts`. Modul `features/agent/` sudah ada sebagai placeholder. Untuk mengaktifkan AI agent:
1. Implementasi logika di `AgentPage.tsx` menggunakan `CAPABILITIES` dari `src/lib/capabilities.ts`
2. `capabilities.ts` sudah mendefinisikan 22 entri CRUD (santri, kelas, guru, seksi, relasi) lengkap dengan `nama`, `tabel[]`, `deskripsi` (Bahasa Indonesia), dan `parameter[]`
3. Menu AI Agent di sidebar otomatis muncul untuk semua pengguna dengan role `super_admin` — tidak ada env var flag

Junction tables `guru_seksi` dan `kelas_wali` tersedia untuk queries relasi. Laporan visual per modul sudah tersedia di route `/*/laporan` menggunakan `recharts`.

---

---

## 17. AI Agent Foundation (v2.2.0)

### `src/lib/capabilities.ts`
- Export: `CAPABILITIES: Capability[]` — array 22 entri pure metadata (tidak ada runtime dependency)
- Setiap entri: `{ nama: string; tabel: string[]; deskripsi: string; parameter: string[] }`
- Cakupan: semua operasi CRUD — santri (tambah/edit/hapus/cari/filter), kelas (tambah/edit/hapus/cari/filter/wali), guru (tambah/edit/hapus/cari/filter/seksi), seksi (tambah/edit/hapus/cari), relasi guru_seksi dan kelas_wali (tambah/hapus)
- Dirancang sebagai "tool manifest" untuk AI agent — bisa dipakai sebagai OpenAI function schema atau Anthropic tool list

### `src/features/agent/AgentPage.tsx`
- Route: `/agent` (ProtectedRoute superAdminOnly)
- UI placeholder dengan icon Bot dan pesan "Segera Hadir"
- Nav item di Layout hanya muncul saat env flag true DAN role super_admin

---

## 18. Laporan Visual (v2.2.0)

Library: `recharts` (instalasi: `npm i recharts`). Semua halaman laporan read-only, tidak ada aksi edit/hapus.

### `src/features/santri/SantriLaporan.tsx`
- Data: query `['santri']` + `['kelas']`
- Bar chart: jumlah santri per kelas (BarChart horizontal)
- Donut chart: distribusi status (`aktif` / `lulus` / `keluar` / `pindah`) via PieChart + innerRadius
- Tabel lengkap: NIS, Nama, Kelas, Status, Tanggal Lahir, Jenis Kelamin, Alamat

### `src/features/kelas/KelasLaporan.tsx`
- Data: query `['kelas']` + `['santri']`
- Bar chart: jumlah santri per kelas
- Donut chart: distribusi kategori kelas (`Mondok` / `Non Mondok` / `Tanpa Kategori`)
- Tabel lengkap: Nama Kelas, Kategori, Tingkat, Jumlah Santri, Wali Kelas

### `src/features/guru/GuruLaporan.tsx`
- Data: query `['guru']` + `['seksi']` + `['guru_seksi']`
- Bar chart: jumlah guru per seksi (many-to-many — satu guru bisa di banyak seksi)
- Donut chart: distribusi status guru (`aktif` / `nonaktif`)
- Tabel lengkap: NIP, Nama, Status, Seksi (gabungan), Jabatan

### `src/features/seksi/SeksiLaporan.tsx`
- Data: query `['seksi']` + `['guru_seksi']` + `['guru']`
- Bar chart: jumlah anggota guru per seksi
- Tabel lengkap: Nama Seksi, Deskripsi, Jumlah Guru Anggota

### Tombol "Lihat Laporan"
Ditambahkan di toolbar kanan setiap halaman list (sebelum tombol Tambah), dengan `variant="secondary"` dan icon `BarChart2`.

---

## 19. Reset Seed Guru (v2.4.0)

### `supabase/functions/reset-guru-seed/index.ts` (Edge Function — Deno)
Fungsi ini berjalan sepenuhnya di server Supabase, bukan di frontend.

**Alur verifikasi (kritis):**
1. Baca `Authorization` header dari request
2. Buat Supabase client menggunakan **token pemanggil sendiri** (anon key + JWT dari header)
3. Panggil `auth.getUser()` untuk memvalidasi token — jika kedaluwarsa atau palsu, tolak (401)
4. Query tabel `profiles` menggunakan client pemanggil untuk membaca `role` dan `status` — **tidak mempercayai klaim di JWT**, hanya percaya database
5. Jika `role !== 'super_admin'` atau `status !== 'aktif'` → tolak (403) dengan pesan jelas
6. Baru setelah verifikasi lulus: gunakan `SUPABASE_SERVICE_ROLE_KEY` (dari Supabase Secrets) untuk membuat admin client
7. Panggil `adminClient.auth.admin.updateUserById(userId, { password: newSeed })`

**⚠️ WAJIB dilakukan secara manual oleh pengelola sistem:**
- Deploy: `supabase functions deploy reset-guru-seed` via CLI, atau via Supabase Dashboard > Edge Functions
- Set secret: Supabase Dashboard > Edge Functions > reset-guru-seed > Secrets → tambahkan `SUPABASE_SERVICE_ROLE_KEY`
- **Nilai service role key TIDAK BOLEH ditulis di kode, .env, atau file manapun dalam proyek ini**

### `src/features/anggota/AnggotaPage.tsx` — tombol Reset Seed
- Tombol ikon `KeyRound` di kolom aksi setiap baris (AnggotaPage sudah super_admin only)
- Membuka `Modal` dengan dua input password: "Seed Baru" dan "Konfirmasi Seed Baru"
- Validasi: minimal 6 karakter, kedua input harus cocok — tombol "Reset Seed" disabled jika tidak terpenuhi
- Memanggil `supabase.functions.invoke('reset-guru-seed', { body: { userId, newSeed } })`
- Toast sukses/gagal sesuai hasil; loading state saat menunggu respons

---

## 20. Upload Foto Profil (v2.4.0)

### Bucket Storage
- Nama: `foto-profil`, dibuat via `supabase-migration-v4.sql`
- `public = false` — **tidak bisa diakses via URL langsung**; hanya bisa via signed URL
- File size limit: 2 MB; tipe yang diizinkan: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`
- RLS policies: pengguna aktif (`status = 'aktif'`) boleh INSERT, SELECT, UPDATE, DELETE

### `src/lib/storage.ts`
| Fungsi | Deskripsi |
|---|---|
| `uploadFoto(file, prefix)` | Upload ke bucket, kembalikan path (bukan URL) |
| `getSignedUrl(path, expiresIn=3600)` | Buat signed URL valid 1 jam dari path |
| `deleteFoto(path)` | Hapus file (idempoten, tidak error jika tidak ada) |
| `validateFotoFile(file)` | Validasi tipe + ukuran, kembalikan pesan error atau null |

### `src/components/FotoAvatar.tsx`
Komponen display foto. Props: `path`, `nama`, `size` (sm/md/lg/xl), `className`.
- Jika `path` ada: fetch signed URL via `getSignedUrl`, tampilkan `<img>`
- Jika tidak ada atau gagal: tampilkan placeholder ikon `UserCircle`
- Signed URL di-fetch ulang saat `path` berubah; cancelled saat unmount (race condition safe)

### Form Santri & Guru
- Input foto di bagian atas form, sebelum field data
- Preview langsung via `URL.createObjectURL` sebelum upload
- Validasi client-side: tipe file + ukuran ≤ 2 MB via `validateFotoFile`
- Pada submit: upload dahulu → jika edit dan ada foto lama, hapus foto lama → masukkan path ke payload
- Tombol "Pilih Foto" / "Ganti Foto" tergantung kondisi existing foto

### Halaman Detail
`SantriDetail.tsx` dan `GuruDetail.tsx` menampilkan `FotoAvatar` ukuran `xl` di samping nama, di atas card.

---

## 21. Riwayat Aktivitas (v2.4.0)

### `supabase-migration-v4.sql` — skema database

**Tabel `activity_log`:**
| Kolom | Tipe | Keterangan |
|---|---|---|
| `id` | uuid PK | auto |
| `actor_id` | uuid FK → profiles | ON DELETE SET NULL |
| `actor_nickname` | text | salinan nickname saat kejadian |
| `table_name` | text | nama tabel yang berubah |
| `record_id` | uuid | id rekaman yang berubah |
| `action` | text CHECK ('insert','update','delete') | jenis operasi |
| `record_label` | text | salinan nama/judul rekaman saat kejadian |
| `created_at` | timestamptz | waktu kejadian |

**RLS activity_log:**
- `ENABLE ROW LEVEL SECURITY` ✓
- Policy SELECT: semua pengguna aktif boleh baca (untuk transparansi)
- **Tidak ada policy INSERT, UPDATE, atau DELETE** — hanya trigger dapat menulis

**Trigger `log_activity()` (SECURITY DEFINER):**
- Berjalan AFTER INSERT OR UPDATE OR DELETE pada: `santri`, `guru`, `kelas`, `seksi`
- `SECURITY DEFINER` memungkinkan INSERT ke `activity_log` meski tidak ada policy insert untuk user
- Ambil `actor_id` dari `auth.uid()` → lookup `nickname` dari profiles
- `record_label` disalin saat kejadian (tetap terbaca walau data asli sudah dihapus)
- Fallback nickname: `'system'` jika tidak ada sesi user (misal: migrasi script)

### `src/features/aktivitas/AktivitasPage.tsx`
- Route: `/aktivitas` (ProtectedRoute superAdminOnly)
- Nav item: "Riwayat Aktivitas" icon `History`, roles `['super_admin']`
- Query `activity_log` ORDER BY `created_at DESC`, 30 baris per halaman
- `staleTime: 0` — selalu fresh
- Realtime via `useRealtime('activity_log', [['activity_log']])` — baris baru muncul otomatis
- Kolom tabel: Waktu, Pengguna (@nickname), Aksi (badge berwarna), Modul, Data
- Badge aksi: Tambah (hijau), Ubah (biru), Hapus (merah)
- Paginasi dengan tombol Sebelumnya/Berikutnya + indikator halaman

---

*End of Dokumen Fullsource Codex — RAMA 6 v2.4.0*
