import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useKelasDetail, createKelas, updateKelas } from './api';
import { useGuruList } from '../guru/api';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { TINGKAT_BY_KATEGORI, type KategoriType } from '../../types';

const KATEGORI_OPTIONS: KategoriType[] = ['Mondok', 'Non Mondok'];

const schema = z.object({
  nama_kelas:   z.string().min(2, 'Minimal 2 karakter'),
  tahun_ajaran: z.string().optional().nullable(),
  kapasitas:    z.coerce.number().optional().nullable(),
});

type FormData = z.infer<typeof schema>;

export function KelasForm() {
  const { id } = useParams();
  const isEdit = !!id && id !== 'baru';
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [waliIds,  setWaliIds]  = useState<string[]>([]);
  const [kategori, setKategori] = useState<KategoriType | ''>('');
  const [tingkat,  setTingkat]  = useState<string>('');

  const { data: existing } = useKelasDetail(isEdit ? id : undefined);
  const { data: guruData } = useGuruList({ status: 'aktif' });

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (existing) {
      reset({
        nama_kelas:   existing.nama_kelas,
        tahun_ajaran: existing.tahun_ajaran,
        kapasitas:    existing.kapasitas,
      });
      setKategori((existing.kategori as KategoriType) || '');
      setTingkat(existing.tingkat || '');
      setWaliIds(existing.kelas_wali?.map((kw: any) => kw.guru_id) ?? []);
    }
  }, [existing, reset]);

  // Reset tingkat ketika kategori berubah
  const handleKategoriChange = (val: KategoriType | '') => {
    setKategori(val);
    setTingkat('');   // reset pilihan tingkat sebelumnya
  };

  const toggleWali = (guruId: string) => {
    setWaliIds(prev =>
      prev.includes(guruId) ? prev.filter(g => g !== guruId) : [...prev, guruId]
    );
  };

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        ...data,
        kategori:     kategori   || null,
        tingkat:      tingkat    || null,
        tahun_ajaran: data.tahun_ajaran || null,
        kapasitas:    data.kapasitas    || null,
      };
      if (isEdit) {
        const { error, queued } = await updateKelas(id!, payload, waliIds);
        if (error) throw error;
        toast.success(queued ? 'Disimpan offline' : 'Kelas diperbarui');
      } else {
        const { error, queued } = await createKelas(payload, waliIds);
        if (error) throw error;
        toast.success(queued ? 'Ditambahkan offline' : 'Kelas ditambahkan');
      }
      qc.invalidateQueries({ queryKey: ['kelas'] });
      navigate('/kelas');
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan');
    }
  };

  const tingkatOptions = kategori ? TINGKAT_BY_KATEGORI[kategori] : [];

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="font-heading text-2xl font-bold">{isEdit ? 'Edit Kelas' : 'Tambah Kelas'}</h1>
      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nama Kelas */}
          <div>
            <label className="text-sm font-medium mb-2 block">Nama Kelas *</label>
            <input {...register('nama_kelas')} className="input-field" placeholder="Contoh: 1A - Al-Fatih" />
            {errors.nama_kelas && <p className="text-xs text-danger mt-1">{errors.nama_kelas.message}</p>}
          </div>

          {/* Kategori + Tingkat — dua dropdown berurutan */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Kategori</label>
              <select
                value={kategori}
                onChange={e => handleKategoriChange(e.target.value as KategoriType | '')}
                className="input-field"
              >
                <option value="">Pilih kategori</option>
                {KATEGORI_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Tingkat</label>
              <select
                value={tingkat}
                onChange={e => setTingkat(e.target.value)}
                className="input-field disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!kategori}
              >
                <option value="">Pilih tingkat</option>
                {tingkatOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Tahun Ajaran + Kapasitas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Tahun Ajaran</label>
              <input {...register('tahun_ajaran')} className="input-field" placeholder="2024/2025" />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Kapasitas</label>
              <input type="number" {...register('kapasitas')} className="input-field" />
            </div>
          </div>

          {/* Wali Kelas — multi-select chip */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              Wali Kelas <span className="text-text-secondary font-normal">(boleh lebih dari satu)</span>
            </label>
            {!guruData?.data.length ? (
              <p className="text-sm text-text-secondary">Belum ada guru aktif</p>
            ) : (
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                {guruData.data.map((g: any) => (
                  <label
                    key={g.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer select-none transition-colors ${
                      waliIds.includes(g.id)
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border hover:border-primary/50 text-text-primary'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={waliIds.includes(g.id)}
                      onChange={() => toggleWali(g.id)}
                    />
                    {g.nama_lengkap}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border/60">
            <Button type="button" variant="secondary" onClick={() => navigate('/kelas')}>Batal</Button>
            <Button type="submit" loading={isSubmitting}>Simpan</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
