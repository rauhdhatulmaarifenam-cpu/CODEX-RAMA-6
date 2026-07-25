import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useKelasDetail } from './api';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';
import { ExportMenu } from '../../components/ExportMenu';
import { exportSingleToDocx, exportSingleToPdf } from '../export/exporters';
import { ArrowLeft, Pencil } from 'lucide-react';
import { KelasForm } from './KelasForm';
import { KategoriBadge, TingkatBadge } from './KelasList';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { useRealtime } from '../../hooks/useRealtime';

export function KelasDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const isEdit = search.get('edit') === '1';

  useRealtime('kelas_wali', id ? [['kelas', id]] : []);

  const { data, isLoading } = useKelasDetail(id);

  const { data: santriInKelas } = useQuery({
    queryKey: ['santri', 'kelas', id],
    enabled: !!id,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('santri')
        .select('id,nis,nama_lengkap,status')
        .eq('kelas_id', id!)
        .order('nama_lengkap');
      if (error) throw error;
      return rows;
    },
  });

  if (isEdit) return <KelasForm />;
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!data) return <div className="p-8 text-center">Kelas tidak ditemukan</div>;

  const waliNama = data.kelas_wali
    ?.map((kw: any) => kw.guru?.nama_lengkap)
    .filter(Boolean)
    .join(', ') || '-';

  const fields = [
    { label: 'Nama Kelas',    value: data.nama_kelas },
    { label: 'Kategori',      value: data.kategori },
    { label: 'Tingkat',       value: data.tingkat },
    { label: 'Tahun Ajaran',  value: data.tahun_ajaran },
    { label: 'Wali Kelas',    value: waliNama },
    { label: 'Kapasitas',     value: data.kapasitas },
    { label: 'Jumlah Santri', value: santriInKelas?.length ?? 0 },
  ];

  // Fields untuk ekspor teks (docx/pdf) — tanpa badge, cukup teks
  const daftarSantriTeks = santriInKelas && santriInKelas.length > 0
    ? santriInKelas.map(s => `${s.nis || '-'} – ${s.nama_lengkap}`).join('; ')
    : 'Tidak ada santri';
  const exportFields = [
    { label: 'Nama Kelas',       value: data.nama_kelas },
    { label: 'Kategori',         value: data.kategori    || '-' },
    { label: 'Tingkat',          value: data.tingkat     || '-' },
    { label: 'Tahun Ajaran',     value: data.tahun_ajaran || '-' },
    { label: 'Wali Kelas',       value: waliNama },
    { label: 'Kapasitas',        value: data.kapasitas   ?? '-' },
    { label: 'Jumlah Santri',    value: santriInKelas?.length ?? 0 },
    { label: 'Daftar Santri',    value: daftarSantriTeks },
  ];

  const handleExport = async (type: 'docx' | 'pdf') => {
    if (type === 'docx') await exportSingleToDocx('kelas', data.id, exportFields, `Profil Kelas - ${data.nama_kelas}`);
    else await exportSingleToPdf('kelas', data.id, exportFields, `Profil Kelas - ${data.nama_kelas}`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/kelas')} leftIcon={<ArrowLeft className="w-4 h-4" />}>Kembali</Button>
        <div className="flex gap-2">
          <ExportMenu onExport={handleExport as any} single />
          <Button onClick={() => navigate(`/kelas/${id}?edit=1`)} leftIcon={<Pencil className="w-4 h-4" />}>Edit</Button>
        </div>
      </div>

      <Card>
        {/* Header dengan badge */}
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1">
            <h1 className="font-heading text-2xl font-bold">{data.nama_kelas}</h1>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <KategoriBadge value={data.kategori} />
              <TingkatBadge  value={data.tingkat} kategori={data.kategori} />
              {!data.kategori && !data.tingkat && (
                <span className="text-sm text-text-secondary">Belum ada kategori/tingkat</span>
              )}
            </div>
          </div>
          <p className="text-sm text-text-secondary self-end">{data.tahun_ajaran || '-'}</p>
        </div>

        {/* Field grid */}
        <div className="grid grid-cols-2 gap-4 mt-6">
          {fields.map(f => (
            <div key={f.label} className="border-b border-border/40 pb-3">
              <div className="text-xs text-text-secondary uppercase">{f.label}</div>
              <div className="text-sm font-medium mt-1">
                {/* Kategori dan Tingkat pakai badge, yang lain plain text */}
                {f.label === 'Kategori' ? (
                  f.value ? <KategoriBadge value={f.value as string} /> : <span>-</span>
                ) : f.label === 'Tingkat' ? (
                  f.value ? <TingkatBadge value={f.value as string} kategori={data.kategori} /> : <span>-</span>
                ) : (
                  String(f.value ?? '-')
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Daftar santri di kelas ini */}
        {santriInKelas && santriInKelas.length > 0 && (
          <div className="mt-8">
            <h3 className="font-heading font-semibold mb-3">Daftar Santri ({santriInKelas.length})</h3>
            <div className="border border-border/60 rounded-xl divide-y divide-border/60 max-h-80 overflow-y-auto">
              {santriInKelas.map(s => (
                <div key={s.id} className="px-4 py-2.5 flex justify-between text-sm">
                  <span className="tabular-nums text-text-secondary">{s.nis || '-'}</span>
                  <span className="font-medium">{s.nama_lengkap}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{s.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
