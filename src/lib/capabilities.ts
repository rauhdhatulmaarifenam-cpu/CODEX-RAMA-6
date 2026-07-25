/**
 * CAPABILITIES — Metadata seluruh operasi data Codex — RAMA 6
 *
 * Array ini mendaftarkan setiap fungsi CRUD yang tersedia di folder fitur
 * masing-masing modul (santri, kelas, guru, seksi, guru_seksi, kelas_wali).
 * Digunakan sebagai referensi oleh AI Agent pada fase berikutnya.
 * Tidak terhubung ke logika apapun yang berjalan saat ini.
 */

export interface CapabilityParam {
  nama: string;
  tipe: string;
  deskripsi: string;
  wajib: boolean;
}

export interface Capability {
  nama: string;
  tabel: string[];
  deskripsi: string;
  parameter: CapabilityParam[];
}

export const CAPABILITIES: Capability[] = [

  // ── SANTRI ─────────────────────────────────────────────────────────────────
  {
    nama: 'useSantriList',
    tabel: ['santri', 'kelas'],
    deskripsi: 'Mengambil daftar santri dengan dukungan pencarian teks, filter kelas, filter status, dan pagination.',
    parameter: [
      { nama: 'search',  tipe: 'string', deskripsi: 'Kata kunci pencarian nama atau NIS', wajib: false },
      { nama: 'kelasId', tipe: 'string', deskripsi: 'Filter berdasarkan UUID kelas', wajib: false },
      { nama: 'status',  tipe: 'string', deskripsi: 'Filter status: aktif | lulus | keluar | pindah', wajib: false },
      { nama: 'page',    tipe: 'number', deskripsi: 'Nomor halaman, default 1', wajib: false },
      { nama: 'perPage', tipe: 'number', deskripsi: 'Jumlah data per halaman, default 20', wajib: false },
    ],
  },
  {
    nama: 'useSantriDetail',
    tabel: ['santri', 'kelas'],
    deskripsi: 'Mengambil detail satu santri beserta data kelas terkait berdasarkan UUID.',
    parameter: [
      { nama: 'id', tipe: 'string', deskripsi: 'UUID santri', wajib: true },
    ],
  },
  {
    nama: 'createSantri',
    tabel: ['santri'],
    deskripsi: 'Membuat data santri baru. Mendukung offline queue jika tidak ada koneksi internet.',
    parameter: [
      {
        nama: 'payload', tipe: 'Partial<Santri>',
        deskripsi: 'Data santri: nama_lengkap (wajib), nis (opsional-unik), jenis_kelamin, tempat_lahir, tanggal_lahir, alamat, nama_wali, no_telepon_wali, kelas_id, status, tanggal_masuk, catatan',
        wajib: true,
      },
    ],
  },
  {
    nama: 'updateSantri',
    tabel: ['santri'],
    deskripsi: 'Memperbarui data santri yang sudah ada berdasarkan UUID. Mendukung offline queue.',
    parameter: [
      { nama: 'id',      tipe: 'string',         deskripsi: 'UUID santri yang akan diperbarui', wajib: true },
      { nama: 'payload', tipe: 'Partial<Santri>', deskripsi: 'Field santri yang ingin diubah',   wajib: true },
    ],
  },
  {
    nama: 'deleteSantri',
    tabel: ['santri'],
    deskripsi: 'Menghapus data santri secara permanen. Hanya dapat dilakukan oleh guru_super atau super_admin.',
    parameter: [
      { nama: 'id', tipe: 'string', deskripsi: 'UUID santri yang akan dihapus', wajib: true },
    ],
  },

  // ── KELAS ──────────────────────────────────────────────────────────────────
  {
    nama: 'useKelasList',
    tabel: ['kelas', 'kelas_wali', 'guru'],
    deskripsi: 'Mengambil daftar semua kelas beserta relasi wali kelas dari tabel junction kelas_wali.',
    parameter: [
      { nama: 'search', tipe: 'string', deskripsi: 'Kata kunci pencarian nama kelas', wajib: false },
    ],
  },
  {
    nama: 'useKelasDetail',
    tabel: ['kelas', 'kelas_wali', 'guru'],
    deskripsi: 'Mengambil detail satu kelas beserta semua wali kelas yang terelasi.',
    parameter: [
      { nama: 'id', tipe: 'string', deskripsi: 'UUID kelas', wajib: true },
    ],
  },
  {
    nama: 'syncKelasWali',
    tabel: ['kelas_wali'],
    deskripsi: 'Menyinkronkan relasi wali kelas pada tabel junction: hapus semua entri lama lalu insert entri baru. Dipanggil otomatis oleh createKelas dan updateKelas.',
    parameter: [
      { nama: 'kelasId', tipe: 'string',   deskripsi: 'UUID kelas', wajib: true },
      { nama: 'guruIds', tipe: 'string[]', deskripsi: 'Array UUID guru yang menjadi wali kelas', wajib: true },
    ],
  },
  {
    nama: 'createKelas',
    tabel: ['kelas', 'kelas_wali'],
    deskripsi: 'Membuat data kelas baru sekaligus menyinkronkan relasi wali kelas. Mendukung offline queue untuk data kelas.',
    parameter: [
      { nama: 'payload',  tipe: 'Partial<Kelas>', deskripsi: 'Data kelas: nama_kelas (wajib), kategori (Mondok|Non Mondok), tingkat, tahun_ajaran, kapasitas', wajib: true },
      { nama: 'waliIds',  tipe: 'string[]',       deskripsi: 'Array UUID guru yang menjadi wali kelas', wajib: true },
    ],
  },
  {
    nama: 'updateKelas',
    tabel: ['kelas', 'kelas_wali'],
    deskripsi: 'Memperbarui data kelas dan opsional menyinkronkan ulang relasi wali kelas.',
    parameter: [
      { nama: 'id',      tipe: 'string',         deskripsi: 'UUID kelas yang akan diperbarui', wajib: true },
      { nama: 'payload', tipe: 'Partial<Kelas>', deskripsi: 'Field kelas yang ingin diubah',    wajib: true },
      { nama: 'waliIds', tipe: 'string[]',       deskripsi: 'Array UUID guru wali kelas baru (opsional, jika ingin diubah)', wajib: false },
    ],
  },
  {
    nama: 'deleteKelas',
    tabel: ['kelas'],
    deskripsi: 'Menghapus data kelas secara permanen. Santri yang berada di kelas ini akan kehilangan referensi kelas (set null).',
    parameter: [
      { nama: 'id', tipe: 'string', deskripsi: 'UUID kelas yang akan dihapus', wajib: true },
    ],
  },

  // ── GURU ───────────────────────────────────────────────────────────────────
  {
    nama: 'useGuruList',
    tabel: ['guru', 'guru_seksi', 'seksi'],
    deskripsi: 'Mengambil daftar semua guru beserta relasi seksi dari tabel junction guru_seksi. Mendukung filter seksi dan status.',
    parameter: [
      { nama: 'search',  tipe: 'string', deskripsi: 'Kata kunci pencarian nama atau NIP guru', wajib: false },
      { nama: 'seksiId', tipe: 'string', deskripsi: 'Filter berdasarkan UUID seksi',            wajib: false },
      { nama: 'status',  tipe: 'string', deskripsi: 'Filter status: aktif | nonaktif',           wajib: false },
    ],
  },
  {
    nama: 'useGuruDetail',
    tabel: ['guru', 'guru_seksi', 'seksi'],
    deskripsi: 'Mengambil detail satu guru beserta semua seksi yang diikutinya.',
    parameter: [
      { nama: 'id', tipe: 'string', deskripsi: 'UUID guru', wajib: true },
    ],
  },
  {
    nama: 'syncGuruSeksi',
    tabel: ['guru_seksi'],
    deskripsi: 'Menyinkronkan relasi guru-seksi pada tabel junction: hapus semua entri lama lalu insert entri baru. Dipanggil otomatis oleh createGuru dan updateGuru.',
    parameter: [
      { nama: 'guruId',   tipe: 'string',   deskripsi: 'UUID guru', wajib: true },
      { nama: 'seksiIds', tipe: 'string[]', deskripsi: 'Array UUID seksi yang diikuti guru ini', wajib: true },
    ],
  },
  {
    nama: 'createGuru',
    tabel: ['guru', 'guru_seksi'],
    deskripsi: 'Membuat data guru baru sekaligus menyinkronkan relasi seksi. Mendukung offline queue untuk data guru.',
    parameter: [
      {
        nama: 'payload', tipe: 'Partial<Guru>',
        deskripsi: 'Data guru: nama_lengkap (wajib), nip (opsional), jenis_kelamin, tempat_lahir, tanggal_lahir, alamat, no_telepon, status, foto_url',
        wajib: true,
      },
      { nama: 'seksiIds', tipe: 'string[]', deskripsi: 'Array UUID seksi yang diikuti guru ini', wajib: true },
    ],
  },
  {
    nama: 'updateGuru',
    tabel: ['guru', 'guru_seksi'],
    deskripsi: 'Memperbarui data guru dan opsional menyinkronkan ulang relasi seksi.',
    parameter: [
      { nama: 'id',       tipe: 'string',        deskripsi: 'UUID guru yang akan diperbarui', wajib: true  },
      { nama: 'payload',  tipe: 'Partial<Guru>', deskripsi: 'Field guru yang ingin diubah',    wajib: true  },
      { nama: 'seksiIds', tipe: 'string[]',      deskripsi: 'Array UUID seksi baru (opsional, jika relasi seksi ingin diubah)', wajib: false },
    ],
  },
  {
    nama: 'deleteGuru',
    tabel: ['guru'],
    deskripsi: 'Menghapus data guru secara permanen. Entri relasi di tabel guru_seksi akan ikut terhapus (cascade).',
    parameter: [
      { nama: 'id', tipe: 'string', deskripsi: 'UUID guru yang akan dihapus', wajib: true },
    ],
  },

  // ── SEKSI ──────────────────────────────────────────────────────────────────
  {
    nama: 'useSeksiList',
    tabel: ['seksi', 'guru'],
    deskripsi: 'Mengambil daftar semua seksi beserta data pembina (join ke tabel guru sebagai pembina).',
    parameter: [
      { nama: 'search', tipe: 'string', deskripsi: 'Kata kunci pencarian nama seksi', wajib: false },
    ],
  },
  {
    nama: 'useSeksiDetail',
    tabel: ['seksi', 'guru'],
    deskripsi: 'Mengambil detail satu seksi beserta data pembina.',
    parameter: [
      { nama: 'id', tipe: 'string', deskripsi: 'UUID seksi', wajib: true },
    ],
  },
  {
    nama: 'createSeksi',
    tabel: ['seksi'],
    deskripsi: 'Membuat data seksi baru. Mendukung offline queue.',
    parameter: [
      {
        nama: 'payload', tipe: 'Partial<Seksi>',
        deskripsi: 'Data seksi: nama_seksi (wajib), deskripsi (opsional), pembina_id (UUID guru pembina, opsional)',
        wajib: true,
      },
    ],
  },
  {
    nama: 'updateSeksi',
    tabel: ['seksi'],
    deskripsi: 'Memperbarui data seksi berdasarkan UUID. Mendukung offline queue.',
    parameter: [
      { nama: 'id',      tipe: 'string',         deskripsi: 'UUID seksi yang akan diperbarui', wajib: true },
      { nama: 'payload', tipe: 'Partial<Seksi>', deskripsi: 'Field seksi yang ingin diubah',    wajib: true },
    ],
  },
  {
    nama: 'deleteSeksi',
    tabel: ['seksi'],
    deskripsi: 'Menghapus data seksi secara permanen.',
    parameter: [
      { nama: 'id', tipe: 'string', deskripsi: 'UUID seksi yang akan dihapus', wajib: true },
    ],
  },

  // ── GURU_SEKSI (junction) ──────────────────────────────────────────────────
  {
    nama: 'syncGuruSeksi',
    tabel: ['guru_seksi'],
    deskripsi: '(Fungsi junction) Mengelola tabel many-to-many antara guru dan seksi: replace-all strategy untuk satu guru_id tertentu.',
    parameter: [
      { nama: 'guruId',   tipe: 'string',   deskripsi: 'UUID guru', wajib: true },
      { nama: 'seksiIds', tipe: 'string[]', deskripsi: 'Array UUID seksi baru yang menggantikan relasi lama', wajib: true },
    ],
  },

  // ── KELAS_WALI (junction) ──────────────────────────────────────────────────
  {
    nama: 'syncKelasWali',
    tabel: ['kelas_wali'],
    deskripsi: '(Fungsi junction) Mengelola tabel many-to-many antara kelas dan guru wali: replace-all strategy untuk satu kelas_id tertentu.',
    parameter: [
      { nama: 'kelasId', tipe: 'string',   deskripsi: 'UUID kelas', wajib: true },
      { nama: 'guruIds', tipe: 'string[]', deskripsi: 'Array UUID guru wali baru yang menggantikan relasi lama', wajib: true },
    ],
  },
];
