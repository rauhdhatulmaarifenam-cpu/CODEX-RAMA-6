import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSantriDetail, createSantri, updateSantri } from './api';
import { useKelasList } from '../kelas/api';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { FotoAvatar } from '../../components/FotoAvatar';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { uploadFoto, deleteFoto, validateFotoFile } from '../../lib/storage';
import { ImagePlus, X } from 'lucide-react';

const schema = z.object({
  nis:              z.string().optional().nullable(),
  nama_lengkap:     z.string().min(3, 'Minimal 3 karakter'),
  jenis_kelamin:    z.enum(['L', 'P']).nullable().optional(),
  tempat_lahir:     z.string().optional().nullable(),
  tanggal_lahir:    z.string().optional().nullable(),
  alamat:           z.string().optional().nullable(),
  nama_wali:        z.string().optional().nullable(),
  no_telepon_wali:  z.string().optional().nullable(),
  kelas_id:         z.string().optional().nullable(),
  status:           z.enum(['aktif', 'lulus', 'keluar', 'pindah']),
  tanggal_masuk:    z.string().optional().nullable(),
  catatan:          z.string().optional().nullable(),
});

type FormData = z.infer<typeof schema>;

export function SantriForm() {
  const { id } = useParams();
  const isEdit = !!id && id !== 'baru';
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [fotoFile,    setFotoFile]    = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: existing }  = useSantriDetail(isEdit ? id : undefined);
  const { data: kelasData } = useKelasList();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'aktif' },
  });

  useEffect(() => {
    if (existing) {
      reset({
        nis:             existing.nis,
        nama_lengkap:    existing.nama_lengkap,
        jenis_kelamin:   existing.jenis_kelamin,
        tempat_lahir:    existing.tempat_lahir,
        tanggal_lahir:   existing.tanggal_lahir,
        alamat:          existing.alamat,
        nama_wali:       existing.nama_wali,
        no_telepon_wali: existing.no_telepon_wali,
        kelas_id:        existing.kelas_id,
        status:          existing.status,
        tanggal_masuk:   existing.tanggal_masuk,
        catatan:         existing.catatan,
      });
    }
  }, [existing, reset]);

  // Bersihkan object URL saat komponen unmount atau file berganti
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

  const onSubmit = async (data: FormData) => {
    try {
      let foto_url: string | undefined = undefined;

      // Upload foto baru jika dipilih
      if (fotoFile) {
        try {
          const newPath = await uploadFoto(fotoFile, 'santri');
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
        nis:             data.nis             || null,
        kelas_id:        data.kelas_id        || null,
        tempat_lahir:    data.tempat_lahir    || null,
        tanggal_lahir:   data.tanggal_lahir   || null,
        alamat:          data.alamat          || null,
        nama_wali:       data.nama_wali       || null,
        no_telepon_wali: data.no_telepon_wali || null,
        tanggal_masuk:   data.tanggal_masuk   || null,
        catatan:         data.catatan         || null,
      };
      if (foto_url !== undefined) payload.foto_url = foto_url;

      if (isEdit) {
        const { error, queued } = await updateSantri(id!, payload);
        if (error) throw error;
        toast.success(queued ? 'Disimpan offline, menunggu sinkron' : 'Santri diperbarui');
      } else {
        const { error, queued } = await createSantri(payload);
        if (error) throw error;
        toast.success(queued ? 'Disimpan offline, menunggu sinkron' : 'Santri ditambahkan');
      }
      qc.invalidateQueries({ queryKey: ['santri'] });
      navigate('/santri');
    } catch (e: any) {
      toast.error(e.message || 'Gagal menyimpan');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-bold">{isEdit ? 'Edit Santri' : 'Tambah Santri'}</h1>
        <p className="text-sm text-text-secondary">Lengkapi data santri dengan benar</p>
      </div>

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
                  id="santri-foto-input"
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
            {/* NIS */}
            <div>
              <label className="block text-sm font-medium mb-2">
                NIS <span className="text-text-secondary font-normal">(opsional, unik jika diisi)</span>
              </label>
              <input {...register('nis')} className="input-field" placeholder="Kosongkan jika belum ada" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Nama Lengkap *</label>
              <input {...register('nama_lengkap')} className="input-field" placeholder="Muhammad Ahmad" />
              {errors.nama_lengkap && <p className="text-xs text-danger mt-1">{errors.nama_lengkap.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Jenis Kelamin</label>
              <select {...register('jenis_kelamin')} className="input-field">
                <option value="">Pilih</option>
                <option value="L">Laki-laki</option>
                <option value="P">Perempuan</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <select {...register('status')} className="input-field">
                <option value="aktif">Aktif</option>
                <option value="lulus">Lulus</option>
                <option value="keluar">Keluar</option>
                <option value="pindah">Pindah</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Tempat Lahir</label>
              <input {...register('tempat_lahir')} className="input-field" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Tanggal Lahir</label>
              <input type="date" {...register('tanggal_lahir')} className="input-field" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Kelas</label>
              <select {...register('kelas_id')} className="input-field">
                <option value="">Tidak ada kelas</option>
                {kelasData?.data.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Nama Wali</label>
              <input {...register('nama_wali')} className="input-field" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">No Telepon Wali</label>
              <input {...register('no_telepon_wali')} className="input-field" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Tanggal Masuk</label>
              <input type="date" {...register('tanggal_masuk')} className="input-field" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Alamat</label>
              <textarea {...register('alamat')} rows={2} className="input-field" />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Catatan</label>
              <textarea {...register('catatan')} rows={3} className="input-field" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-border/60">
            <Button type="button" variant="secondary" onClick={() => navigate('/santri')}>Batal</Button>
            <Button type="submit" loading={isSubmitting}>{isEdit ? 'Simpan perubahan' : 'Tambah santri'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
