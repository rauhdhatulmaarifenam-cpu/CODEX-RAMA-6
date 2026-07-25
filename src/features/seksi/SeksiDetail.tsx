import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useSeksiDetail } from './api';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';
import { ExportMenu } from '../../components/ExportMenu';
import { exportSingleToDocx, exportSingleToPdf } from '../export/exporters';
import { ArrowLeft, Pencil } from 'lucide-react';
import { SeksiForm } from './SeksiForm';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useRealtime } from '../../hooks/useRealtime';

export function SeksiDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const isEdit = search.get('edit') === '1';

  useRealtime('guru_seksi', id ? [['seksi-anggota', id]] : []);

  const { data, isLoading } = useSeksiDetail(id);

  // Guru anggota seksi ini via tabel penghubung guru_seksi
  const { data: guruAnggota } = useQuery({
    queryKey: ['seksi-anggota', id],
    enabled: !!id,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('guru_seksi')
        .select('guru_id, guru:guru_id(id,nama_lengkap)')
        .eq('seksi_id', id!);
      if (error) throw error;
      return rows?.map((gs: any) => gs.guru).filter(Boolean) ?? [];
    },
  });

  if (isEdit) return <SeksiForm />;
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data) return <div className="p-8 text-center">Seksi tidak ditemukan</div>;

  const fields = [
    { label: 'Nama Seksi', value: data.nama_seksi },
    { label: 'Deskripsi',  value: data.deskripsi },
    { label: 'Pembina',    value: (data as any).pembina?.nama_lengkap || '-' },
  ];

  const handleExport = async (type: 'docx' | 'pdf') => {
    if (type === 'docx') await exportSingleToDocx('seksi', data.id, fields, `Profil Seksi - ${data.nama_seksi}`);
    else await exportSingleToPdf('seksi', data.id, fields, `Profil Seksi - ${data.nama_seksi}`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/seksi')} leftIcon={<ArrowLeft className="w-4 h-4" />}>Kembali</Button>
        <div className="flex gap-2">
          <ExportMenu onExport={handleExport as any} single />
          <Button onClick={() => navigate(`/seksi/${id}?edit=1`)} leftIcon={<Pencil className="w-4 h-4" />}>Edit</Button>
        </div>
      </div>

      <Card>
        <h1 className="font-heading text-2xl font-bold">{data.nama_seksi}</h1>
        <p className="text-sm text-text-secondary mt-1">{data.deskripsi || 'Tidak ada deskripsi'}</p>

        <div className="grid grid-cols-1 gap-3 mt-6">
          {fields.map(f => (
            <div key={f.label} className="border-b border-border/40 pb-3">
              <div className="text-xs text-text-secondary uppercase">{f.label}</div>
              <div className="text-sm font-medium mt-1">{String(f.value || '-')}</div>
            </div>
          ))}
        </div>

        {/* Guru Anggota — dari tabel guru_seksi */}
        <div className="mt-8">
          <h3 className="font-semibold mb-2">Guru Anggota ({guruAnggota?.length ?? 0})</h3>
          <div className="border border-border/60 rounded-xl divide-y divide-border/60 max-h-60 overflow-y-auto">
            {guruAnggota?.length ? (
              guruAnggota.map((g: any) => (
                <div key={g.id} className="px-3 py-2 text-sm">{g.nama_lengkap}</div>
              ))
            ) : (
              <div className="p-3 text-sm text-text-secondary">Tidak ada guru</div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
