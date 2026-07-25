import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from './AuthContext';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabaseClient';

const schema = z.object({
  nama_lengkap: z.string().min(3),
  no_telepon: z.string().optional().nullable(),
});

type FormData = z.infer<typeof schema>;

export function ProfilePage(){
  const { profile, user } = useAuth();
  const { register, handleSubmit, formState:{isSubmitting} } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { nama_lengkap: profile?.nama_lengkap||'', no_telepon: profile?.no_telepon||'' }
  });

  const onSubmit = async (data:FormData)=>{
    const { error } = await supabase.from('profiles').update({ nama_lengkap: data.nama_lengkap, no_telepon: data.no_telepon||null }).eq('id', user.id);
    if(error) toast.error(error.message);
    else toast.success('Profil diperbarui');
  };

  if(!profile) return <div className="p-8">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div><h1 className="font-heading text-2xl font-bold">Profil Saya</h1><p className="text-sm text-text-secondary">Kelola informasi akun pribadi</p></div>
      <Card>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white text-xl font-bold">{profile.nama_lengkap.charAt(0).toUpperCase()}</div>
          <div><div className="font-semibold">{profile.nama_lengkap}</div><div className="text-sm text-text-secondary">@{profile.nickname} • {profile.role} • {profile.status}</div></div>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div><label className="text-sm font-medium mb-2 block">Nickname (tidak bisa diubah)</label><input value={profile.nickname} disabled className="input-field bg-background"/></div>
          <div><label className="text-sm font-medium mb-2 block">Nama Lengkap</label><input {...register('nama_lengkap')} className="input-field"/></div>
          <div><label className="text-sm font-medium mb-2 block">No Telepon</label><input {...register('no_telepon')} className="input-field"/></div>
          <div><label className="text-sm font-medium mb-2 block">Email internal</label><input value={`${profile.nickname.toLowerCase().replace(/[^a-z0-9]/g,'')}@santri.rm6.internal`} disabled className="input-field bg-background text-xs"/></div>
          <div className="flex justify-end pt-4 border-t border-border/60"><Button type="submit" loading={isSubmitting}>Simpan perubahan</Button></div>
        </form>
      </Card>
    </div>
  );
}
