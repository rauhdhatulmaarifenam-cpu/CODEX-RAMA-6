import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKelasList, deleteKelas } from './api';
import { TableWrapper, TableHeader, TableHead, TableBody, TableCell } from '../../components/Table';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { TableSkeleton } from '../../components/Skeleton';
import { Search, Plus, Trash2, Eye, Clock, Pencil, BarChart2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { toast } from 'sonner';
import { ExportMenu } from '../../components/ExportMenu';
import { exportToXlsx, exportToMarkdown, exportToPdf, EntityDetail } from '../export/exporters';
import { fetchAllKelas, fetchSantriGroupedByKelasId } from './api';
import { motion } from 'framer-motion';
import { useRealtime } from '../../hooks/useRealtime';
import { Modal } from '../../components/Modal';
import { useQueryClient } from '@tanstack/react-query';

// ─── badge helpers ─────────────────────────────────────────────────────────────
export function KategoriBadge({ value }: { value?: string | null }) {
  if (!value) return null;
  const isMondok = value === 'Mondok';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
      isMondok
        ? 'bg-emerald-100 text-emerald-800'
        : 'bg-indigo-100 text-indigo-700'
    }`}>
      {value}
    </span>
  );
}

export function TingkatBadge({ value, kategori }: { value?: string | null; kategori?: string | null }) {
  if (!value) return null;
  const isMondok = kategori === 'Mondok';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
      isMondok
        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        : 'bg-indigo-50 text-indigo-600 border border-indigo-200'
    }`}>
      {value}
    </span>
  );
}
// ───────────────────────────────────────────────────────────────────────────────

export function KelasList() {
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { canDelete } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useRealtime('kelas',      [['kelas']]);
  useRealtime('kelas_wali', [['kelas']]);

  const { data, isLoading } = useKelasList({ search });

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error, queued } = await deleteKelas(deleteId);
    if (error) toast.error(error.message);
    else { toast.success(queued ? 'Dihapus offline' : 'Kelas dihapus'); qc.invalidateQueries({ queryKey: ['kelas'] }); }
    setDeleteId(null);
  };

  const handleExport = async (type: 'xlsx' | 'md' | 'pdf') => {
    const tid = toast.loading('Memuat seluruh data kelas...');
    try {
      const [allData, santriGrouped] = await Promise.all([
        fetchAllKelas({ search }),
        fetchSantriGroupedByKelasId(),
      ]);
      toast.dismiss(tid);

      const mapped = allData.map((k: any) => ({
        ...k,
        kategori:       k.kategori     || '-',
        tingkat:        k.tingkat      || '-',
        tahun_ajaran:   k.tahun_ajaran || '-',
        kapasitas:      k.kapasitas    || '-',
        wali_nama:      k.kelas_wali?.map((kw: any) => kw.guru?.nama_lengkap).filter(Boolean).join('; ') || '-',
        santri_anggota: santriGrouped[k.id]?.join('\n') || '-',
      }));

      if (type === 'xlsx') {
        const cols = [
          { key: 'nama_kelas',     header: 'Nama Kelas' },
          { key: 'kategori',       header: 'Kategori' },
          { key: 'tingkat',        header: 'Tingkat' },
          { key: 'tahun_ajaran',   header: 'Tahun Ajaran' },
          { key: 'wali_nama',      header: 'Wali Kelas' },
          { key: 'kapasitas',      header: 'Kapasitas' },
          { key: 'santri_anggota', header: 'Daftar Santri Anggota' },
        ];
        exportToXlsx('kelas', 'semua', mapped, cols, ['santri_anggota']);
      } else {
        // MD / PDF: tabel ringkasan (tanpa kolom anggota) + rincian per kelas
        const summaryCols = [
          { key: 'nama_kelas',   header: 'Nama Kelas' },
          { key: 'kategori',     header: 'Kategori' },
          { key: 'tingkat',      header: 'Tingkat' },
          { key: 'tahun_ajaran', header: 'Tahun Ajaran' },
          { key: 'wali_nama',    header: 'Wali Kelas' },
          { key: 'kapasitas',    header: 'Kapasitas' },
        ];
        const entityDetails: EntityDetail[] = mapped.map((k: any) => ({
          name: k.nama_kelas,
          members: santriGrouped[k.id] ?? [],
        }));
        if (type === 'md') exportToMarkdown('kelas', 'semua', mapped, summaryCols, entityDetails);
        else               exportToPdf('kelas', 'semua', mapped, summaryCols, entityDetails);
      }
    } catch (e: any) {
      toast.dismiss(tid);
      toast.error('Gagal memuat data ekspor: ' + (e?.message || 'Error tidak diketahui'));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Kelas</h1>
          <p className="text-sm text-text-secondary">{data?.count || 0} kelas</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu onExport={handleExport as any} />
          <Button variant="secondary" onClick={() => navigate('/kelas/laporan')} leftIcon={<BarChart2 className="w-4 h-4" />}>Lihat Laporan</Button>
          <Button onClick={() => navigate('/kelas/baru')} leftIcon={<Plus className="w-4 h-4" />}>Tambah Kelas</Button>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari kelas..." className="input-field pl-10" />
        </div>
      </div>

      {isLoading ? <TableSkeleton /> : !data?.data.length ? (
        <EmptyState title="Belum ada kelas" actionLabel="Tambah Kelas" onAction={() => navigate('/kelas/baru')} />
      ) : (
        <TableWrapper>
          <TableHeader>
            <TableHead>Nama Kelas</TableHead>
            <TableHead>Kategori &amp; Tingkat</TableHead>
            <TableHead>Tahun Ajaran</TableHead>
            <TableHead>Wali Kelas</TableHead>
            <TableHead>Kapasitas</TableHead>
            <TableHead>Aksi</TableHead>
          </TableHeader>
          <TableBody>
            {data.data.map((k: any, i: number) => (
              <motion.tr
                key={k.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="hover:bg-background/60"
              >
                <TableCell className="font-medium">
                  {k.nama_kelas}
                  {k._pendingSync && <Clock className="w-3 h-3 inline ml-1 text-amber-600" />}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <KategoriBadge value={k.kategori} />
                    <TingkatBadge  value={k.tingkat} kategori={k.kategori} />
                    {!k.kategori && !k.tingkat && <span className="text-text-secondary text-xs">-</span>}
                  </div>
                </TableCell>
                <TableCell>{k.tahun_ajaran || '-'}</TableCell>
                <TableCell>
                  {k.kelas_wali?.map((kw: any) => kw.guru?.nama_lengkap).filter(Boolean).join(', ') || '-'}
                </TableCell>
                <TableCell>{k.kapasitas || '-'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/kelas/${k.id}`)}><Eye className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/kelas/${k.id}?edit=1`)}><Pencil className="w-4 h-4" /></Button>
                    {canDelete && (
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(k.id)} className="text-danger">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </TableWrapper>
      )}

      <Modal open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} title="Hapus Kelas">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">Yakin hapus kelas ini? Santri di kelas ini akan kehilangan referensi kelas.</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button variant="danger" onClick={handleDelete}>Hapus</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
