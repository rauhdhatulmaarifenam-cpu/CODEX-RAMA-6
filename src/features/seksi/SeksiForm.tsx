import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSeksiDetail, createSeksi, updateSeksi } from './api';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';

const schema = z.object({
  nama_seksi: z.string().min(2),
  deskripsi: z.string().optional().nullable(),
  pembina_id: z.string().optional().nullable(),
});

type FormData = z.infer<typeof schema>;

export function SeksiForm(){
  const { id } = useParams(); const isEdit=!!id && id!=='baru'; const navigate=useNavigate(); const qc=useQueryClient();
  const { data: existing } = useSeksiDetail(isEdit?id:undefined);
  const { data: profiles } = useQuery({
    queryKey:['profiles','pembina'],
    queryFn: async ()=>{ const {data,error}=await supabase.from('profiles').select('id,nama_lengkap,nickname').eq('status','aktif').order('nama_lengkap'); if(error) throw error; return data; }
  });
  const { register, handleSubmit, reset, formState:{isSubmitting} } = useForm<FormData>({ resolver: zodResolver(schema) });
  useEffect(()=>{ if(existing) reset({ nama_seksi: existing.nama_seksi, deskripsi: existing.deskripsi, pembina_id: existing.pembina_id }); },[existing,reset]);
  const onSubmit=async (data:FormData)=>{ try{ const payload={...data, deskripsi:data.deskripsi||null, pembina_id:data.pembina_id||null}; if(isEdit){ const {error,queued}=await updateSeksi(id!,payload); if(error) throw error; toast.success(queued?'Disimpan offline':'Diperbarui'); } else { const {error,queued}=await createSeksi(payload); if(error) throw error; toast.success(queued?'Ditambahkan offline':'Ditambahkan'); } qc.invalidateQueries({queryKey:['seksi']}); navigate('/seksi'); }catch(e:any){ toast.error(e.message); } };
  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="font-heading text-2xl font-bold">{isEdit?'Edit Seksi':'Tambah Seksi'}</h1>
      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div><label className="text-sm font-medium mb-2 block">Nama Seksi *</label><input {...register('nama_seksi')} className="input-field" placeholder="Keamanan / Kebersihan / Bahasa"/></div>
          <div><label className="text-sm font-medium mb-2 block">Deskripsi</label><textarea {...register('deskripsi')} rows={3} className="input-field" placeholder="Tugas dan tanggung jawab seksi..."/></div>
          <div><label className="text-sm font-medium mb-2 block">Pembina</label><select {...register('pembina_id')} className="input-field"><option value="">Tidak ada pembina</option>{profiles?.map(p=><option key={p.id} value={p.id}>{p.nama_lengkap} (@{p.nickname})</option>)}</select></div>
          <div className="flex justify-end gap-2 pt-4 border-t border-border/60"><Button type="button" variant="secondary" onClick={()=>navigate('/seksi')}>Batal</Button><Button type="submit" loading={isSubmitting}>Simpan</Button></div>
        </form>
      </Card>
    </div>
  );
}
