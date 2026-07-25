import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useGuruDetail, createGuru, updateGuru } from './api';
import { useSeksiList } from '../seksi/api';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { FotoAvatar } from '../../components/FotoAvatar';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { uploadFoto, deleteFoto, validateFotoFile } from '../../lib/storage';
import { ImagePlus, X } from 'lucide-react';

const schema = z.object({
  nama_lengkap:  z.string().min(3, 'Minimal 3 karakter'),
  nip:           z.string().optional().nullable(),
  jenis_kelamin: z.enum(['L', 'P']).nullable().optional(),
  tempat_lahir:  z.string().optional().nullable(),
  tanggal_lahir: z.string().optional().nullable(),
  alamat:        z.string().optional().nullable(),
  no_telepon:    z.string().optional().nullable(),
  status:        z.enum(['aktif', 'nonaktif']),
});

type FormData = z.infer<typeof schema>;

export function GuruForm() {
  const { id } = useParams();
  const isEdit = !!id && id !== 'baru';
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [seksiIds, setSeksiIds] = useState<string[]>([]);
  const [fotoFile,    setFotoFile]    = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: existing }  = useGuruDetail(isEdit ? id : undefined);
  const { data: seksiData } = useSeksiList();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'aktif' },
  });

  useEffect(() => {
    if (existing) {
      reset({
        nama_lengkap:  existing.nama_lengkap,
        nip:           existing.nip,
        jenis_kelamin: existing.jenis_kelamin,
        tempat_lahir:  existing.tempat_lahir,
        tanggal_lahir: existing.tanggal_lahir,
        alamat:        existing.alamat,
        no_telepon:    existing.no_telepon,
        status:        existing.status,
      });
      setSeksiIds(existing.guru_seksi?.map((gs: any) => gs.seksi_id) ?? []);
    }
  }, [existing, reset]);

  // Bersihkan object URL saat unmount atau file berganti
  useEffect(() => {
    return () => { if (fotoPreview) URL.revokeObjectURL(fotoPreview); };
  }, [fotoPreview]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const errMsg = validateFotoFile(file);
    if (errMsg) { toast.error(errMsg); return; }
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const clearFoto = () => {
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoFile(null);
    setFotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const toggleSeksi = (seksiId: string) => {
    setSeksiIds(prev =>
      prev.includes(seksiId) ? prev.filter(s => s !== seksiId) : [...prev, seksiId]
    );
  };

  const onSubmit = async (data: FormData) => {
    try {
      let foto_url: string | undefined = undefined;

      // Upload foto baru jika dipilih
      if (fotoFile) {
        try {
          const newPath = await uploadFoto(fotoFile, 'guru');
          // Hapus foto lama jika ada (edit mode)
          if (isEdit && existing?.foto_url) {
            await deleteFoto(existing.foto_url);
          }
          foto_url = newPath;
        } catch (uploadErr: any) {
          toast.error(uploadErr.message || 'Gagal mengunggah foto');
          return;
        }
      }

      const payload: any = {
        ...data,
        nip:           data.nip           || null,
        tempat_lahir:  data.tempat_lahir  || null,
        tanggal_lahir: data.tanggal_lahir || null,
        alamat:        data.alamat        || null,
        no_telepon:    data.no_telepon    || null,
      };
      if (foto_url !== undefined) payload.foto_url = foto_url;

      if (isEdit) {
        const { error, queued } = await updateGuru(id!, payload, seksiIds);
        if (error) throw error;
        toast.success(queued ? 'Disimpan offline' : 'Data guru diperbarui');
      } else {
        const { error, queued } = await createGuru(payload, seksiIds);
        if (error) throw error;
        toast.success(queued ? 'Ditambahkan offline' : 'Guru ditambahkan');
      }
      qc.invalidateQueries({ queryKey: ['guru'] });
      navigate('/guru');
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="font-heading text-2xl font-bold">{isEdit ? 'Edit Guru' : 'Tambah Guru'}</h1>
      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

          {/* ── Foto Profil ─────────────────────────────────── */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Foto Profil <span className="text-text-secondary font-normal">(opsional, maks 2 MB, JPG/PNG/WebP)</span>
            </label>
            <div className="flex items-center gap-4">
              {fotoPreview ? (
                <div className="relative">
                  <img src={fotoPreview} alt="Pratinjau" className="w-[60px] h-20 rounded-2xl object-cover border border-border/60" />
                  <button
                    type="button"
                    onClick={clearFoto}
                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-danger text-white flex items-center justify-center shadow"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                isEdit && existing?.foto_url
                  ? (
                    <div className="relative">
                      <FotoAvatar path={existing.foto_url} size="lg" />
                      <span className="absolute -bottom-1 -right-1 text-xs bg-background border border-border/60 rounded px-1 text-text-secondary">Saat ini</span>
                    </div>
                  )
                  : <div className="w-[60px] h-20 rounded-2xl border-2 border-dashed border-border flex items-center justify-center text-text-secondary"><ImagePlus className="w-7 h-7" /></div>
              )}
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                  id="guru-foto-input"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  leftIcon={<ImagePlus className="w-4 h-4" />}
                >
                  {fotoPreview || (isEdit && existing?.foto_url) ? 'Ganti Foto' : 'Pilih Foto'}
                </Button>
                {fotoFile && (
                  <span className="text-xs text-text-secondary">{fotoFile.name} ({(fotoFile.size/1024).toFixed(0)} KB)</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nama Lengkap */}
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-2 block">Nama Lengkap *</label>
              <input {...register('nama_lengkap')} className="input-field" />
              {errors.nama_lengkap && <p className="text-xs text-danger mt-1">{errors.nama_lengkap.message}</p>}
            </div>

            {/* NIP */}
            <div>
              <label className="text-sm font-medium mb-2 block">NIP <span className="text-text-secondary font-normal">(opsional)</span></label>
              <input {...register('nip')} className="input-field" placeholder="Kosongkan jika tidak ada" />
            </div>

            {/* Jenis Kelamin */}
            <div>
              <label className="text-sm font-medium mb-2 block">Jenis Kelamin</label>
              <select {...register('jenis_kelamin')} className="input-field">
                <option value="">Pilih</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>

            {/* Tempat Lahir */}
            <div>
              <label className="text-sm font-medium mb-2 block">Tempat Lahir</label>
              <input {...register('tempat_lahir')} className="input-field" />
            </div>

            {/* Tanggal Lahir */}
            <div>
              <label className="text-sm font-medium mb-2 block">Tanggal Lahir</label>
              <input type="date" {...register('tanggal_lahir')} className="input-field" />
            </div>

            {/* No Telepon */}
            <div>
              <label className="text-sm font-medium mb-2 block">No Telepon</label>
              <input {...register('no_telepon')} className="input-field" />
            </div>

            {/* Status */}
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <select {...register('status')} className="input-field">
                <option value="aktif">Aktif</option>
                <option value="nonaktif">Nonaktif</option>
              </select>
            </div>

            {/* Alamat */}
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-2 block">Alamat</label>
              <textarea {...register('alamat')} rows={2} className="input-field" />
            </div>

            {/* Seksi — multi-select via chip checkboxes */}
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-2 block">
                Seksi <span className="text-text-secondary font-normal">(boleh pilih lebih dari satu)</span>
              </label>
              {!seksiData?.data.length ? (
                <p className="text-sm text-text-secondary">Belum ada seksi yang dibuat</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {seksiData.data.map(s => (
                    <label
                      key={s.id}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm cursor-pointer select-none transition-colors ${
                        seksiIds.includes(s.id)
                          ? 'border-primary bg-primary/10 text-primary font-medium'
                          : 'border-border hover:border-primary/50 text-text-primary'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={seksiIds.includes(s.id)}
                        onChange={() => toggleSeksi(s.id)}
                      />
                      {s.nama_seksi}
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border/60">
            <Button type="button" variant="secondary" onClick={() => navigate('/guru')}>Batal</Button>
            <Button type="submit" loading={isSubmitting}>Simpan</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
