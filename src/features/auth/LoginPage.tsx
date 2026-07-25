import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion } from 'framer-motion';
import { LogIn, Eye, EyeOff, BookOpen } from 'lucide-react';
import { useAuth } from './AuthContext';
import { Button } from '../../components/Button';
import { toast } from 'sonner';

const schema = z.object({
  nickname: z.string().min(3, 'Minimal 3 karakter').max(20, 'Maksimal 20 karakter'),
  seed: z.string().min(6, 'Seed minimal 6 karakter'),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [showSeed, setShowSeed] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    const { error } = await signIn(data.nickname, data.seed);
    if (error) {
      toast.error(error.message || 'Gagal login');
    } else {
      toast.success('Berhasil masuk');
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-background">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md">
          <div className="mb-8">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-white font-heading font-bold text-xl mb-4">RM6</div>
            <h1 className="font-heading text-3xl font-bold">Selamat datang</h1>
            <p className="text-text-secondary mt-2">Masuk dengan nickname dan seed Anda</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2">Nickname</label>
              <input {...register('nickname')} placeholder="contoh: ustadzahmad" className="input-field" autoFocus />
              {errors.nickname && <p className="text-xs text-danger mt-1">{errors.nickname.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Seed (password)</label>
              <div className="relative">
                <input {...register('seed')} type={showSeed ? 'text' : 'password'} placeholder="••••••••" className="input-field pr-10" />
                <button type="button" onClick={() => setShowSeed(!showSeed)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-secondary hover:text-text-primary">
                  {showSeed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.seed && <p className="text-xs text-danger mt-1">{errors.seed.message}</p>}
            </div>

            <Button type="submit" className="w-full" loading={isSubmitting} leftIcon={<LogIn className="w-4 h-4" />}>
              Masuk
            </Button>

            <p className="text-sm text-center text-text-secondary">
              Belum punya akun? <Link to="/signup" className="text-primary font-medium hover:underline">Daftar di sini</Link>
            </p>
          </form>


        </motion.div>
      </div>

      {/* Right - Branding */}
      <div className="hidden lg:flex flex-1 bg-primary relative overflow-hidden items-center justify-center p-12">
        {/* Islamic geometric pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="girih" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 100 50 L 50 100 L 0 50 Z" fill="none" stroke="white" strokeWidth="0.5" />
                <circle cx="50" cy="50" r="20" fill="none" stroke="white" strokeWidth="0.5" />
                <path d="M 0 0 L 100 100 M 100 0 L 0 100" fill="none" stroke="white" strokeWidth="0.3" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#girih)" />
          </svg>
        </div>
        <div className="relative z-10 text-white max-w-md">
          <BookOpen className="w-12 h-12 mb-6 opacity-90" />
          <h2 className="font-heading text-4xl font-bold leading-tight">Codex — RAMA 6<br/>Raudhatul Ma'arif 6</h2>
          <p className="mt-4 text-white/80 leading-relaxed">Sistem internal untuk mengelola data santri, kelas, guru, dan seksi secara kolaboratif dan realtime. Dirancang untuk tetap lancar bahkan dengan koneksi terbatas.</p>
          <div className="mt-8 grid grid-cols-2 gap-4 text-sm">
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <div className="font-semibold">Realtime</div>
              <div className="text-white/70 text-xs mt-1">Sinkron otomatis antar guru</div>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-xl p-4">
              <div className="font-semibold">Offline First</div>
              <div className="text-white/70 text-xs mt-1">Tetap bisa CRUD saat offline</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
