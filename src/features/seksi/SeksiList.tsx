import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSeksiList, deleteSeksi } from './api';
import { TableWrapper, TableHeader, TableHead, TableBody, TableCell } from '../../components/Table';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { TableSkeleton } from '../../components/Skeleton';
import { Search, Plus, Trash2, Eye, Clock, Pencil, BarChart2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { toast } from 'sonner';
import { ExportMenu } from '../../components/ExportMenu';
import { exportToXlsx, exportToMarkdown, exportToPdf, EntityDetail } from '../export/exporters';
import { fetchAllSeksiWithGuru } from './api';
import { motion } from 'framer-motion';
import { useRealtime } from '../../hooks/useRealtime';
import { Modal } from '../../components/Modal';
import { useQueryClient } from '@tanstack/react-query';

export function SeksiList(){
  const [search,setSearch]=useState(''); const [deleteId,setDeleteId]=useState<string|null>(null);
  const {canDelete}=useAuth(); const navigate=useNavigate(); const qc=useQueryClient();
  useRealtime('seksi',[['seksi']]); const {data,isLoading}=useSeksiList({search});
  const handleDelete=async()=>{ if(!deleteId) return; const {error,queued}=await deleteSeksi(deleteId); if(error) toast.error(error.message); else {toast.success(queued?'Dihapus offline':'Dihapus'); qc.invalidateQueries({queryKey:['seksi']});} setDeleteId(null); };
  const handleExport = async (type: 'xlsx' | 'md' | 'pdf') => {
    const tid = toast.loading('Memuat seluruh data seksi...');
    try {
      const allData = await fetchAllSeksiWithGuru({ search });
      toast.dismiss(tid);

      const mapped = allData.map((r: any) => ({
        ...r,
        pembina:     r.pembina?.nama_lengkap || r.pembina?.nickname || '-',
        deskripsi:   r.deskripsi || '-',
        anggota_guru: (r._guru_anggota as string[] | undefined)?.join('\n') || '-',
      }));

      if (type === 'xlsx') {
        const cols = [
          { key: 'nama_seksi',   header: 'Nama Seksi' },
          { key: 'deskripsi',    header: 'Deskripsi' },
          { key: 'pembina',      header: 'Pembina' },
          { key: 'anggota_guru', header: 'Guru Anggota' },
        ];
        exportToXlsx('seksi', 'semua', mapped, cols, ['anggota_guru']);
      } else {
        // MD / PDF: tabel ringkasan (tanpa kolom anggota) + rincian per seksi
        const summaryCols = [
          { key: 'nama_seksi', header: 'Nama Seksi' },
          { key: 'deskripsi',  header: 'Deskripsi' },
          { key: 'pembina',    header: 'Pembina' },
        ];
        const entityDetails: EntityDetail[] = allData.map((r: any) => ({
          name:    r.nama_seksi,
          members: (r._guru_anggota as string[] | undefined) ?? [],
        }));
        if (type === 'md') exportToMarkdown('seksi', 'semua', mapped, summaryCols, entityDetails);
        else               exportToPdf('seksi', 'semua', mapped, summaryCols, entityDetails);
      }
    } catch (e: any) {
      toast.dismiss(tid);
      toast.error('Gagal memuat data ekspor: ' + (e?.message || 'Error tidak diketahui'));
    }
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"><div><h1 className="font-heading text-2xl font-bold">Seksi</h1><p className="text-sm text-text-secondary">{data?.count||0} seksi</p></div><div className="flex gap-2"><ExportMenu onExport={handleExport as any}/><Button variant="secondary" onClick={()=>navigate('/seksi/laporan')} leftIcon={<BarChart2 className="w-4 h-4"/>}>Lihat Laporan</Button><Button onClick={()=>navigate('/seksi/baru')} leftIcon={<Plus className="w-4 h-4"/>}>Tambah Seksi</Button></div></div>
      <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari seksi..." className="input-field pl-10"/></div>
      {isLoading?<TableSkeleton/>:!data?.data.length?<EmptyState title="Belum ada seksi" actionLabel="Tambah Seksi" onAction={()=>navigate('/seksi/baru')}/>:(
        <TableWrapper><TableHeader><TableHead>Nama Seksi</TableHead><TableHead>Deskripsi</TableHead><TableHead>Pembina</TableHead><TableHead>Aksi</TableHead></TableHeader><TableBody>{data.data.map((s:any,i:number)=><motion.tr key={s.id} initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{delay:i*0.02}} className="hover:bg-background/60"><TableCell className="font-medium">{s.nama_seksi} {s._pendingSync && <Clock className="w-3 h-3 inline text-amber-600"/>}</TableCell><TableCell className="max-w-xs truncate">{s.deskripsi||'-'}</TableCell><TableCell>{s.pembina?.nama_lengkap||'-'}</TableCell><TableCell><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={()=>navigate(`/seksi/${s.id}`)}><Eye className="w-4 h-4"/></Button><Button variant="ghost" size="sm" onClick={()=>navigate(`/seksi/${s.id}?edit=1`)}><Pencil className="w-4 h-4"/></Button>{canDelete && <Button variant="ghost" size="sm" onClick={()=>setDeleteId(s.id)} className="text-danger"><Trash2 className="w-4 h-4"/></Button>}</div></TableCell></motion.tr>)}</TableBody></TableWrapper>
      )}
      <Modal open={!!deleteId} onOpenChange={o=>!o&&setDeleteId(null)} title="Hapus Seksi"><div className="space-y-4"><p className="text-sm text-text-secondary">Yakin hapus seksi ini? Data guru & santri terkait akan kehilangan referensi seksi.</p><div className="flex justify-end gap-2"><Button variant="secondary" onClick={()=>setDeleteId(null)}>Batal</Button><Button variant="danger" onClick={handleDelete}>Hapus</Button></div></div></Modal>
    </div>
  );
}
