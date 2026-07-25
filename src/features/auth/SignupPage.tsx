import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { UserPlus, Eye, EyeOff } from 'lucide-react';
import { useAuth } from './AuthContext';
import { Button } from '../../components/Button';
import { toast } from 'sonner';

const schema = z.object({
  nickname: z.string().min(3, 'Minimal 3 karakter').max(20).regex(/^[a-zA-Z0-9_]+$/, 'Hanya alfanumerik dan underscore'),
  nama_lengkap: z.string().min(3, 'Nama minimal 3 karakter'),
  seed: z.string().min(6, 'Minimal 6 karakter'),
  confirmSeed: z.string().min(6),
}).refine(d => d.seed === d.confirmSeed, { message: 'Seed tidak cocok', path: ['confirmSeed'] });

type FormData = z.infer<typeof schema>;

export function SignupPage() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [showSeed, setShowSeed] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    const { error } = await signUp(data.nickname, data.nama_lengkap, data.seed);
    if (error) {
      toast.error(error.message || 'Gagal daftar');
    } else {
      toast.success('Akun berhasil dibuat — langsung masuk');
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background islamic-pattern">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md bg-surface rounded-3xl shadow-soft-lg border border-border/60 p-8">
        <div className="mb-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-primary mx-auto flex items-center justify-center text-white font-heading font-bold text-xl">RM6</div>
          <div className="font-heading text-lg font-bold mt-4">Codex — RAMA 6</div>
          <div className="text-xs text-text-secondary mt-1">Raudhatul Ma'arif 6</div>
          <h1 className="font-heading text-2xl font-bold mt-3">Buat akun guru</h1>
          <p className="text-sm text-text-secondary mt-1">Isi data di bawah untuk membuat akun</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Nickname (unik)</label>
            <input {...register('nickname')} placeholder="ustadz_ahmad" className="input-field" />
            <p className="text-xs text-text-secondary mt-1">Dipakai untuk login, hanya huruf/angka/underscore</p>
            {errors.nickname && <p className="text-xs text-danger mt-1">{errors.nickname.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Nama lengkap</label>
            <input {...register('nama_lengkap')} placeholder="Ahmad Fauzi" className="input-field" />
            {errors.nama_lengkap && <p className="text-xs text-danger mt-1">{errors.nama_lengkap.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Seed (password)</label>
            <div className="relative">
              <input {...register('seed')} type={showSeed ? 'text' : 'password'} placeholder="minimal 6 karakter" className="input-field pr-10" />
              <button type="button" onClick={() => setShowSeed(!showSeed)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-secondary">
                {showSeed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.seed && <p className="text-xs text-danger mt-1">{errors.seed.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Konfirmasi seed</label>
            <input {...register('confirmSeed')} type={showSeed ? 'text' : 'password'} placeholder="ulang seed" className="input-field" />
            {errors.confirmSeed && <p className="text-xs text-danger mt-1">{errors.confirmSeed.message}</p>}
          </div>

          <Button type="submit" className="w-full" loading={isSubmitting} leftIcon={<UserPlus className="w-4 h-4" />}>
            Daftar
          </Button>

          <p className="text-sm text-center text-text-secondary">
            Sudah punya akun? <Link to="/login" className="text-primary font-medium hover:underline">Login</Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}
