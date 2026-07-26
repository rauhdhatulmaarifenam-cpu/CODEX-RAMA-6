import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSantriList } from './api';
import { useKelasList } from '../kelas/api';
import { TableWrapper, TableHeader, TableHead, TableBody, TableCell } from '../../components/Table';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { TableSkeleton } from '../../components/Skeleton';
import { Search, Plus, Trash2, Eye, Clock, Pencil, BarChart2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { deleteSantri } from './api';
import { toast } from 'sonner';
import { ExportMenu } from '../../components/ExportMenu';
import { exportToXlsx, exportToMarkdown, exportToPdf } from '../export/exporters';
import { fetchAllSantri } from './api';
import { formatTanggalDenganUsia } from '../../lib/dateUtils';
import { motion } from 'framer-motion';
import { useRealtime } from '../../hooks/useRealtime';
import { Modal } from '../../components/Modal';
import { useQueryClient } from '@tanstack/react-query';

export function SantriList() {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [kelasFilter, setKelasFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 20;
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { canDelete } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useRealtime('santri', [['santri']]);

  const { data, isLoading } = useSantriList({
    search: debouncedSearch,
    kelasId: kelasFilter || undefined,
    status:  statusFilter || undefined,
    page,
    perPage,
  });
  const { data: kelasData } = useKelasList();

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error, queued } = await deleteSantri(deleteId);
    if (error) toast.error(error.message || 'Gagal hapus');
    else {
      toast.success(queued ? 'Dihapus (offline, menunggu sinkron)' : 'Berhasil dihapus');
      qc.invalidateQueries({ queryKey: ['santri'] });
    }
    setDeleteId(null);
  };

  const handleExport = async (type: 'xlsx' | 'md' | 'pdf') => {
    const tid = toast.loading('Memuat seluruh data santri...');
    try {
      const allData = await fetchAllSantri({
        search: debouncedSearch,
        kelasId: kelasFilter || undefined,
        status:  statusFilter  || undefined,
      });
      toast.dismiss(tid);
      const cols = [
        { key: 'nis',           header: 'NIS' },
        { key: 'nama_lengkap',  header: 'Nama Lengkap' },
        { key: 'jenis_kelamin', header: 'JK' },
        { key: 'tanggal_lahir_usia', header: 'Tgl Lahir (Usia)' },
        { key: 'status',        header: 'Status' },
        { key: 'kelas',         header: 'Kelas' },
      ];
      const mapped = allData.map(r => ({
        ...r,
        nis:   r.nis || '-',
        kelas: (r as any).kelas?.nama_kelas || '-',
        tanggal_lahir_usia: formatTanggalDenganUsia(r.tanggal_lahir),
      }));
      // Label filter yang enak dibaca (kosong = tidak ada filter aktif)
      const kelasNama = kelasFilter
        ? (kelasData?.data.find(k => k.id === kelasFilter)?.nama_kelas ?? '')
        : '';
      const statusLabel = statusFilter
        ? statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)
        : '';
      const konteks = [kelasNama, statusLabel].filter(Boolean).join(' ');
      if (type === 'xlsx')    exportToXlsx('santri', konteks, mapped, cols);
      else if (type === 'md') exportToMarkdown('santri', konteks, mapped, cols);
      else                    exportToPdf('santri', konteks, mapped, cols);
    } catch (e: any) {
      toast.dismiss(tid);
      toast.error('Gagal memuat data ekspor: ' + (e?.message || 'Error tidak diketahui'));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold">Santri</h1>
          <p className="text-sm text-text-secondary">{data?.count ?? 0} total santri • halaman {page}</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportMenu onExport={handleExport as any} />
          <Button variant="secondary" onClick={() => navigate('/santri/laporan')} leftIcon={<BarChart2 className="w-4 h-4" />}>Lihat Laporan</Button>
          <Button onClick={() => navigate('/santri/baru')} leftIcon={<Plus className="w-4 h-4" />}>Tambah Santri</Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama atau NIS..." className="input-field pl-10" />
        </div>
        <select value={kelasFilter} onChange={e => setKelasFilter(e.target.value)} className="input-field lg:w-48">
          <option value="">Semua Kelas</option>
          {kelasData?.data.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input-field lg:w-40">
          <option value="">Semua Status</option>
          <option value="aktif">Aktif</option>
          <option value="lulus">Lulus</option>
          <option value="keluar">Keluar</option>
          <option value="pindah">Pindah</option>
        </select>
      </div>

      {isLoading ? <TableSkeleton rows={8} /> : !data?.data.length ? (
        <EmptyState
          title="Belum ada santri"
          description="Tambah santri pertama untuk memulai pengelolaan data."
          actionLabel="Tambah Santri"
          onAction={() => navigate('/santri/baru')}
        />
      ) : (
        <>
          <TableWrapper>
            <TableHeader>
              <TableHead>NIS</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>JK</TableHead>
              <TableHead>Tgl Lahir (Usia)</TableHead>
              <TableHead>Kelas</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aksi</TableHead>
            </TableHeader>
            <TableBody>
              {data.data.map((s, idx) => (
                <motion.tr
                  key={s.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="hover:bg-background/60"
                >
                  <TableCell className="tabular-nums font-medium">
                    {s.nis || '-'}
                    {s._pendingSync && <Clock className="w-3 h-3 inline ml-1 text-amber-600" />}
                  </TableCell>
                  <TableCell>{s.nama_lengkap}</TableCell>
                  <TableCell>{s.jenis_kelamin || '-'}</TableCell>
                  <TableCell className="tabular-nums text-text-secondary text-xs whitespace-nowrap">
                    {formatTanggalDenganUsia((s as any).tanggal_lahir)}
                  </TableCell>
                  <TableCell>{(s as any).kelas?.nama_kelas || '-'}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${s.status === 'aktif' ? 'bg-emerald-50 text-emerald-700' : 'bg-border text-text-secondary'}`}>
                      {s.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/santri/${s.id}`)}><Eye className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/santri/${s.id}?edit=1`)}><Pencil className="w-4 h-4" /></Button>
                      {canDelete && (
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(s.id)} className="text-danger hover:bg-red-50">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </TableWrapper>

          <div className="flex items-center justify-between pt-2">
            <div className="text-sm text-text-secondary">Menampilkan {data.data.length} dari {data.count}</div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Sebelumnya</Button>
              <Button variant="secondary" size="sm" disabled={data.data.length < perPage} onClick={() => setPage(p => p + 1)}>Berikutnya</Button>
            </div>
          </div>
        </>
      )}

      <Modal open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)} title="Hapus Santri" description="Tindakan ini tidak bisa dibatalkan.">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">Yakin ingin menghapus santri ini?</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteId(null)}>Batal</Button>
            <Button variant="danger" onClick={handleDelete}>Hapus permanen</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
