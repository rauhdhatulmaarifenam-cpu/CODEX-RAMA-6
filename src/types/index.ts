export type RoleType = 'guru' | 'guru_super' | 'super_admin';
export type AccountStatus = 'aktif' | 'nonaktif';
export type GenderType = 'L' | 'P';
export type SantriStatusType = 'aktif' | 'lulus' | 'keluar' | 'pindah';
export type KategoriType = 'Mondok' | 'Non Mondok';
export type TingkatMondok = 'Ula' | 'Wustha' | 'Ulya';
export type TingkatNonMondok = 'TPA' | 'Remaja' | 'Dewasa';
export type TingkatType = TingkatMondok | TingkatNonMondok;

export const TINGKAT_BY_KATEGORI: Record<KategoriType, readonly TingkatType[]> = {
  Mondok:       ['Ula', 'Wustha', 'Ulya'],
  'Non Mondok': ['TPA', 'Remaja', 'Dewasa'],
};

export interface Profile {
  id: string;
  nickname: string;
  nama_lengkap: string;
  role: RoleType;
  status: AccountStatus;
  no_telepon?: string | null;
  avatar_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Seksi {
  id: string;
  nama_seksi: string;
  deskripsi?: string | null;
  pembina_id?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  pembina?: Profile | null;
  _pendingSync?: boolean;
}

export interface GuruSeksiEntry {
  seksi_id: string;
  seksi?: Pick<Seksi, 'id' | 'nama_seksi'> | null;
}

export interface Guru {
  id: string;
  user_id?: string | null;
  nama_lengkap: string;
  nip?: string | null;
  jenis_kelamin?: GenderType | null;
  tempat_lahir?: string | null;
  tanggal_lahir?: string | null;
  alamat?: string | null;
  no_telepon?: string | null;
  status: AccountStatus;
  foto_url?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  guru_seksi?: GuruSeksiEntry[];
  _pendingSync?: boolean;
}

export interface KelasWaliEntry {
  guru_id: string;
  guru?: { id: string; nama_lengkap: string } | null;
}

export interface Kelas {
  id: string;
  nama_kelas: string;
  kategori?: KategoriType | null;
  tingkat?: TingkatType | string | null;
  tahun_ajaran?: string | null;
  kapasitas?: number | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  kelas_wali?: KelasWaliEntry[];
  _pendingSync?: boolean;
}

export interface Santri {
  id: string;
  nis?: string | null;
  nama_lengkap: string;
  jenis_kelamin?: GenderType | null;
  tempat_lahir?: string | null;
  tanggal_lahir?: string | null;
  alamat?: string | null;
  nama_wali?: string | null;
  no_telepon_wali?: string | null;
  kelas_id?: string | null;
  status: SantriStatusType;
  tanggal_masuk?: string | null;
  foto_url?: string | null;
  catatan?: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  kelas?: Kelas | null;
  _pendingSync?: boolean;
}

export interface OfflineQueueItem {
  localId: string;
  table: 'santri' | 'kelas' | 'guru' | 'seksi' | 'guru_seksi' | 'kelas_wali';
  operation: 'insert' | 'update' | 'delete';
  payload: any;
  createdAt: string;
  status: 'pending' | 'failed';
  error?: string;
}

export interface DashboardStats {
  totalSantri: number;
  totalGuru: number;
  totalKelas: number;
  totalSeksi: number;
  santriAktif: number;
  santriPerKelas: { nama_kelas: string; count: number }[];
}
