import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { nicknameToEmail } from '../../lib/nicknameToEmail';
import type { Profile, RoleType } from '../../types';

interface AuthContextType {
  user: any | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (nickname: string, seed: string) => Promise<{ error: any }>;
  signUp: (nickname: string, nama_lengkap: string, seed: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  isSuperAdmin: boolean;
  canDelete: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  // loading=true sampai sesi + profil selesai divalidasi sepenuhnya.
  // ProtectedRoute memblokir render children selama loading=true,
  // sehingga React Query tidak pernah menembak query sebelum sesi siap.
  const [loading, setLoading] = useState(true);

  /**
   * Ambil profil dari tabel profiles.
   * Mengembalikan null jika tidak ditemukan ATAU akun nonaktif.
   * Tidak memiliki efek samping (signOut ditangani oleh pemanggil).
   */
  const fetchProfile = async (userId: string): Promise<Profile | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) {
      console.error('fetchProfile error', error);
      return null;
    }
    if (data.status === 'nonaktif') return null;
    return data as Profile;
  };

  useEffect(() => {
    /**
     * Bergantung sepenuhnya pada onAuthStateChange untuk manajemen sesi.
     * Event pertama yang diterima adalah INITIAL_SESSION yang langsung
     * membawa state sesi saat ini dari localStorage.
     *
     * Pola kritis — setLoading(true) di awal setiap event:
     *   Ini memastikan ProtectedRoute memblokir rendering children (dan
     *   React Query di dalamnya) selama transisi auth berlangsung, termasuk
     *   tepat setelah sign up baru. Tanpa ini, query bisa menembak sebelum
     *   sesi benar-benar terdaftar di Supabase client, RLS mengembalikan
     *   hasil kosong, dan hasil kosong itu ter-cache oleh React Query.
     */
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const sessUser = session?.user ?? null;

        // Gate rendering hingga siklus penuh (session + profile) selesai.
        setLoading(true);
        setUser(sessUser);

        if (sessUser) {
          const prof = await fetchProfile(sessUser.id);
          setProfile(prof);
          if (!prof) {
            // Akun nonaktif atau profil tidak ditemukan — paksa sign out.
            await supabase.auth.signOut();
            setUser(null);
            setProfile(null);
          }
        } else {
          setProfile(null);
        }

        setLoading(false);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = async (nickname: string, seed: string) => {
    try {
      const email = nicknameToEmail(nickname);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: seed });
      if (error) return { error };

      // Periksa akun nonaktif sebelum redirect.
      // Jika nonaktif, fetchProfile mengembalikan null → paksa sign out
      // dan kembalikan pesan yang jelas ke LoginPage.
      if (data.user) {
        const prof = await fetchProfile(data.user.id);
        if (!prof) {
          await supabase.auth.signOut();
          return { error: { message: 'Akun Anda telah dinonaktifkan. Hubungi super admin.' } };
        }
      }

      // Update state (user, profile, loading) diurus oleh onAuthStateChange
      // yang terpicu oleh signInWithPassword di atas.
      return { error: null };
    } catch (e: any) {
      return { error: e };
    }
  };

  const signUp = async (nickname: string, nama_lengkap: string, seed: string) => {
    try {
      // Cek unik nickname (case-insensitive)
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .ilike('nickname', nickname)
        .maybeSingle();
      if (existing) {
        return { error: { message: 'Nickname sudah dipakai' } };
      }

      const email = nicknameToEmail(nickname);
      const { data, error } = await supabase.auth.signUp({
        email,
        password: seed,
        options: {
          // nickname dan nama_lengkap dikirim sebagai raw_user_meta_data.
          // Trigger on_auth_user_created di database membaca metadata ini
          // dan membuat baris profil otomatis di sisi server — role dan
          // status selalu dipaksa 'guru' / 'aktif' oleh trigger, tidak
          // bisa di-override dari sini.
          data: {
            nickname:     nickname.trim(),
            nama_lengkap: nama_lengkap.trim(),
          },
        },
      });
      if (error) return { error };
      if (!data.user) return { error: { message: 'Gagal membuat akun' } };

      // Profil sudah dibuat oleh trigger database (AFTER INSERT ON auth.users).
      // Update state (user, profile, loading) diurus oleh onAuthStateChange
      // yang terpicu oleh signUp di atas — tidak perlu setState manual di sini.
      return { error: null };
    } catch (e: any) {
      return { error: e };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const isSuperAdmin = profile?.role === 'super_admin';
  const canDelete    = profile?.role === 'guru_super' || profile?.role === 'super_admin';

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut, isSuperAdmin, canDelete }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
