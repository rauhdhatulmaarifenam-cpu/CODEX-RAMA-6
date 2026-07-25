import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useGuruDetail } from './api';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';
import { ExportMenu } from '../../components/ExportMenu';
import { exportSingleToDocx, exportSingleToPdf } from '../export/exporters';
import { ArrowLeft, Pencil } from 'lucide-react';
import { GuruForm } from './GuruForm';
import { FotoAvatar } from '../../components/FotoAvatar';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useRealtime } from '../../hooks/useRealtime';

export function GuruDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const isEdit = search.get('edit') === '1';

  useRealtime('guru_seksi', id ? [['guru', id]] : []);
  useRealtime('kelas_wali', id ? [['kelas_wali_guru', id]] : []);

  const { data, isLoading } = useGuruDetail(id);

  // Kelas-kelas di mana guru ini menjadi wali kelas
  const { data: waliKelas } = useQuery({
    queryKey: ['kelas_wali_guru', id],
    enabled: !!id,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('kelas_wali')
        .select('kelas_id, kelas:kelas_id(id,nama_kelas,tingkat)')
        .eq('guru_id', id!);
      if (error) throw error;
      return rows ?? [];
    },
  });

  if (isEdit) return <GuruForm />;
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data) return <div className="p-8 text-center">Guru tidak ditemukan</div>;

  const seksiNama = data.guru_seksi
    ?.map((gs: any) => gs.seksi?.nama_seksi)
    .filter(Boolean)
    .join(', ') || '-';

  const fields = [
    { label: 'Nama Lengkap',  value: data.nama_lengkap },
    { label: 'NIP',           value: data.nip },
    { label: 'Jenis Kelamin', value: data.jenis_kelamin === 'L' ? 'Laki-laki' : data.jenis_kelamin === 'P' ? 'Perempuan' : '-' },
    { label: 'Status',        value: data.status },
    { label: 'Tempat Lahir',  value: data.tempat_lahir },
    { label: 'Tanggal Lahir', value: data.tanggal_lahir },
    { label: 'Alamat',        value: data.alamat },
    { label: 'No Telepon',    value: data.no_telepon },
    { label: 'Seksi',         value: seksiNama },
  ];

  const handleExport = async (type: 'docx' | 'pdf') => {
    if (type === 'docx') await exportSingleToDocx('guru', data.id, fields, `Profil Guru - ${data.nama_lengkap}`);
    else await exportSingleToPdf('guru', data.id, fields, `Profil Guru - ${data.nama_lengkap}`, data.foto_url);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/guru')} leftIcon={<ArrowLeft className="w-4 h-4" />}>Kembali</Button>
        <div className="flex gap-2">
          <ExportMenu onExport={handleExport as any} single />
          <Button onClick={() => navigate(`/guru/${id}?edit=1`)} leftIcon={<Pencil className="w-4 h-4" />}>Edit</Button>
        </div>
      </div>

      <Card>
        <div className="flex items-start gap-4 mb-2">
          <FotoAvatar path={data.foto_url} nama={data.nama_lengkap} size="xl" />
          <div>
            <h1 className="font-heading text-2xl font-bold">{data.nama_lengkap}</h1>
            <p className="text-sm text-text-secondary">{data.nip || 'Tanpa NIP'} • {data.status}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {fields.map(f => (
            <div key={f.label} className="border-b border-border/40 pb-3">
              <div className="text-xs text-text-secondary uppercase tracking-wide">{f.label}</div>
              <div className="text-sm font-medium mt-1">{String(f.value || '-')}</div>
            </div>
          ))}
        </div>

        {/* Wali Kelas */}
        {waliKelas && waliKelas.length > 0 && (
          <div className="mt-8">
            <h3 className="font-heading font-semibold mb-3">Wali Kelas di ({waliKelas.length})</h3>
            <div className="border border-border/60 rounded-xl divide-y divide-border/60">
              {waliKelas.map((wk: any) => (
                <div key={wk.kelas_id} className="px-4 py-2.5 flex justify-between text-sm">
                  <span className="font-medium">{wk.kelas?.nama_kelas}</span>
                  <span className="text-text-secondary">{wk.kelas?.tingkat || '-'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
