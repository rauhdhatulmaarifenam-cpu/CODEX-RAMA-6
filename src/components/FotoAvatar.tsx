import { useEffect, useState } from 'react';
import { UserCircle } from 'lucide-react';
import { getSignedUrl } from '../lib/storage';

interface FotoAvatarProps {
  /** Path di Supabase Storage (dari kolom foto_url). Bukan URL publik. */
  path?: string | null;
  nama?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

// Rasio 3:4 (potret) — konsisten dengan kotak pas foto di PDF personal.
const sizeMap: Record<string, string> = {
  sm:  'w-6 h-8',
  md:  'w-9 h-12',
  lg:  'w-[60px] h-20',
  xl:  'w-[84px] h-28',
};

/**
 * Menampilkan foto profil dari Supabase Storage dengan signed URL sementara.
 * Jika path tidak ada atau gagal dimuat, tampilkan placeholder ikon.
 */
export function FotoAvatar({ path, nama, size = 'md', className = '' }: FotoAvatarProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) { setUrl(null); return; }
    let cancelled = false;
    getSignedUrl(path)
      .then(u => { if (!cancelled) setUrl(u); })
      .catch(() => { if (!cancelled) setUrl(null); });
    return () => { cancelled = true; };
  }, [path]);

  const base = `${sizeMap[size]} rounded-2xl object-cover flex-shrink-0 ${className}`;

  if (url) {
    return (
      <img
        src={url}
        alt={nama ?? 'Foto profil'}
        className={`${base} bg-background border border-border/60`}
      />
    );
  }

  return (
    <div className={`${base} bg-background border border-border/60 flex items-center justify-center`}>
      <UserCircle className="w-1/2 h-1/2 text-text-secondary" />
    </div>
  );
}
