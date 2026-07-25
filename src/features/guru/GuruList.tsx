import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGuruList, deleteGuru } from './api';
import { useSeksiList } from '../seksi/api';
import { TableWrapper, TableHeader, TableHead, TableBody, TableCell } from '../../components/Table';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { TableSkeleton } from '../../components/Skeleton';
import { Search, Plus, Trash2, Eye, Clock, Pencil, BarChart2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { toast } from 'sonner';
import { ExportMenu } from '../../components/ExportMenu';
import { exportToXlsx, exportToMarkdown, exportToPdf } from '../export/exporters';
import { fetchAllGuru, fetchKelasWaliByGuruIds } from './api';
import { formatTanggalDenganUsia } from '../../lib/dateUtils';
import { motion } from 'framer-motion';
import { useRealtime } from '../../hooks/useRealtime';
import { Modal } from '../../components/Modal';
import { useQueryClient } from '@tanstack/react-query';

export function GuruList() {
  const [search, setSearch] = useState('');
  const [seksiFilter, setSeksiFilter] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { canDelete } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useRealtime('guru',       [['guru']]);
  useRealtime('guru_seksi', [['guru']]);

  const { data, isLoading } = useGuruList({ search, seksiId: seksiFilter || undefined });
  const { data: seksiData } = useSeksiList();

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error, queued } = await deleteGuru(deleteId);
    if (error) toast.error(error.message);
    else { toast.success(queued ? 'Dihapus offline' : 'Guru dihapus'); qc.invalidateQueries({ queryKey: ['guru'] }); }
    setDeleteId(null);
  };

  const handleExport = async (type: 'xlsx' | 'md' | 'pdf') => {
    const tid = toast.loading('Memuat seluruh data guru...');
    try {
      const allData = await fetchAllGuru({
        search:   search   || undefined,
        seksiId:  seksiFilter || undefined,
      });
      const kelasWaliMap = await fetchKelasWaliByGuruIds(allData.map((g: any) => g.id));
      toast.dismiss(tid);
      const cols = [
        { key: 'nama_lengkap',       header: 'Nama' },
        { key: 'nip',                header: 'NIP' },
        { key: 'tanggal_lahir_usia', header: 'Tgl Lahir (Usia)' },
        { key: 'seksi_nama',         header: 'Seksi' },
        { key: 'kelas_wali_nama',    header: 'Wali Kelas di' },
        { key: 'status',             header: 'Status' },
      ];
      const mapped = allData.map((g: any) => ({
        ...g,
        nip:                g.nip || '-',
        tanggal_lahir_usia: formatTanggalDenganUsia(g.tanggal_lahir),
        seksi_nama:         g.guru_seksi?.map((gs: any) => gs.seksi?.nama_seksi).filter(Boolean).join('; ') || '-',
        kelas_wali_nama:    kelasWaliMap[g.id]?.join('; ') || '-',
      }));
      if (type === 'xlsx')    exportToXlsx('guru', 'semua', mapped, cols);
      else if (type === 'md') exportToMarkdown('guru', 'semua', mapped, cols);
      else                    exportToPdf('guru', 'semua', mapped, cols);
    } catch (e: any) {
      toast.dismiss(tid);
      toast.error('Gagal memuat data ekspor: ' + (e?.message || 'Error tidak diketahui'));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Guru</h1>
          <p className="text-sm text-text-secondary">{data?.count || 0} guru</p>
        </div>
        <div className="flex gap-2">
          <ExportMenu onExport={handleExport as any} />
          <Button variant="secondary" onClick={() => navigate('/guru/laporan')} leftIcon={<BarChart2 className="w-4 h-4" />}>Lihat Laporan</Button>
          <Button onClick={() => navigate('/guru/baru')} leftIcon={<Plus className="w-4 h-4" />}>Tambah Guru</Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari guru/NIP..." className="input-field pl-10" />
        </div>
        <select value={seksiFilter} onChange={e => setSeksiFilter(e.target.value)} className="input-field lg:w-48">
          <option value="">Semua Seksi</option>
          {seksiData?.data.map(s => <option key={s.id} value={s.id}>{s.nama_seksi}</option>)}
        </select>
      </div>

      {isLoading ? <TableSkeleton /> : !data?.data.length ? (
        <EmptyState title="Belum ada guru" actionLabel="Tambah Guru" onAction={() => navigate('/guru/baru')} />
      ) : (
        <TableWrapper>
          <TableHeader>
            <TableHead>Nama</TableHead>
            <TableHead>NIP</TableHead>
            <TableHead>Tgl Lahir (Usia)</TableHead>
            <TableHead>Seksi</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Aksi</TableHead>
          </TableHeader>
          <TableBody>
            {data.data.map((g: any, i: number) => (
              <motion.tr
                key={g.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="hover:bg-background/60"
              >
                <TableCell className="font-medium">
                  {g.nama_lengkap}
                  {g._pendingSync && <Clock className="w-3 h-3 inline ml-1 text-amber-600" />}
                </TableCell>
                <TableCell className="tabular-nums">{g.nip || '-'}</TableCell>
                <TableCell className="tabular-nums text-text-secondary text-xs whitespace-nowrap">
                  {formatTanggalDenganUsia((g as any).tanggal_lahir)}
                </TableCell>
                <TableCell>
                  {g.guru_seksi?.map((gs: any) => gs.seksi?.nama_seksi).filter(Boolean).join(', ') || '-'}
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs ${g.status === 'aktif' ? 'bg-emerald-50 text-emerald-700' : 'bg-border text-text-secondary'}`}>
                    {g.status}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/guru/${g.id}`)}><Eye className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/guru/${g.id}?edit=1`)}><Pencil className="w-4 h-4" /></Button>
                    {canDelete && <Button variant="ghost" size="sm" onClick={() => setDeleteId(g.id)} className="text-danger"><Trash2 className="w-4 h-4" /></Button>}
                  </div>
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </TableWrapper>
      )}

      <Modal open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} title="Hapus Guru">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">Yakin hapus guru ini?</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button variant="danger" onClick={handleDelete}>Hapus</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
