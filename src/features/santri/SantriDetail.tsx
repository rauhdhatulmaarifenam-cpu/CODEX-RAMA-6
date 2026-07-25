import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useSantriDetail } from './api';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Skeleton } from '../../components/Skeleton';
import { ExportMenu } from '../../components/ExportMenu';
import { exportSingleToDocx, exportSingleToPdf } from '../export/exporters';
import { ArrowLeft, Pencil } from 'lucide-react';
import { SantriForm } from './SantriForm';
import { FotoAvatar } from '../../components/FotoAvatar';

export function SantriDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const isEdit = search.get('edit') === '1';

  const { data, isLoading } = useSantriDetail(id);

  if (isEdit) return <SantriForm />;
  if (isLoading) return <div className="space-y-4"><Skeleton className="h-40 w-full" /></div>;
  if (!data) return <div className="p-8 text-center">Santri tidak ditemukan</div>;

  const fields = [
    { label: 'NIS',              value: data.nis || '-' },
    { label: 'Nama Lengkap',     value: data.nama_lengkap },
    { label: 'Jenis Kelamin',    value: data.jenis_kelamin === 'L' ? 'Laki-laki' : data.jenis_kelamin === 'P' ? 'Perempuan' : '-' },
    { label: 'Tempat, Tgl Lahir', value: `${data.tempat_lahir || '-'}${data.tanggal_lahir ? ', ' + data.tanggal_lahir : ''}` },
    { label: 'Alamat',           value: data.alamat },
    { label: 'Kelas',            value: (data as any).kelas?.nama_kelas || '-' },
    { label: 'Status',           value: data.status },
    { label: 'Nama Wali',        value: data.nama_wali },
    { label: 'No HP Wali',       value: data.no_telepon_wali },
    { label: 'Tanggal Masuk',    value: data.tanggal_masuk },
    { label: 'Catatan',          value: data.catatan },
  ];

  const handleExport = async (type: 'docx' | 'pdf') => {
    if (type === 'docx') await exportSingleToDocx('santri', data.id, fields, `Profil Santri - ${data.nama_lengkap}`);
    else await exportSingleToPdf('santri', data.id, fields, `Profil Santri - ${data.nama_lengkap}`, data.foto_url);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate('/santri')} leftIcon={<ArrowLeft className="w-4 h-4" />}>Kembali</Button>
        <div className="flex items-center gap-2">
          <ExportMenu onExport={handleExport as any} single />
          <Button onClick={() => navigate(`/santri/${id}?edit=1`)} leftIcon={<Pencil className="w-4 h-4" />}>Edit</Button>
        </div>
      </div>

      <Card>
        <div className="flex items-start gap-4 mb-2">
          <FotoAvatar path={(data as any).foto_url} nama={data.nama_lengkap} size="xl" />
          <div>
            <h1 className="font-heading text-2xl font-bold">{data.nama_lengkap}</h1>
            <p className="text-sm text-text-secondary">NIS: {data.nis || '-'} • {data.status}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {fields.map(f => (
            <div key={f.label} className="border-b border-border/40 pb-3">
              <div className="text-xs text-text-secondary uppercase tracking-wide">{f.label}</div>
              <div className="text-sm font-medium mt-1">{f.value || '-'}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
