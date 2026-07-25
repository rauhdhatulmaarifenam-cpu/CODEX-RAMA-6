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
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (error) {
      console.error('fetchProfile error', error);
      return null;
    }
    // Check if nonaktif
    if (data.status === 'nonaktif') {
      await supabase.auth.signOut();
      return null;
    }
    return data as Profile;
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const sessUser = data.session?.user ?? null;
      setUser(sessUser);
      if (sessUser) {
        const prof = await fetchProfile(sessUser.id);
        setProfile(prof);
        if (!prof) {
          await supabase.auth.signOut();
          setUser(null);
        }
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const sessUser = session?.user ?? null;
      setUser(sessUser);
      if (sessUser) {
        const prof = await fetchProfile(sessUser.id);
        setProfile(prof);
        if (!prof) {
          await supabase.auth.signOut();
          setUser(null);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signIn = async (nickname: string, seed: string) => {
    try {
      const email = nicknameToEmail(nickname);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password: seed });
      if (error) return { error };

      if (data.user) {
        const prof = await fetchProfile(data.user.id);
        if (!prof) {
          await supabase.auth.signOut();
          return { error: { message: 'Akun Anda telah dinonaktifkan. Hubungi super admin.' } };
        }
        setProfile(prof);
        setUser(data.user);
      }
      return { error: null };
    } catch (e: any) {
      return { error: e };
    }
  };

  const signUp = async (nickname: string, nama_lengkap: string, seed: string) => {
    try {
      // check nickname uniqueness (case-insensitive)
      const { data: existing } = await supabase.from('profiles').select('id').ilike('nickname', nickname).maybeSingle();
      // Actually use lower() index; simpler: query all? We'll try lowecasse eq via rpc? Use filter
      // We'll also check via lower(nickname) in query if possible, but ilike works for conflict prevention
      if (existing) {
        return { error: { message: 'Nickname sudah dipakai' } };
      }

      const email = nicknameToEmail(nickname);
      const { data, error } = await supabase.auth.signUp({ email, password: seed });
      if (error) return { error };

      if (!data.user) {
        return { error: { message: 'Gagal membuat akun' } };
      }

      // Insert profile
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        nickname: nickname.trim(),
        nama_lengkap: nama_lengkap.trim(),
        role: 'guru' as RoleType,
        status: 'aktif',
      });

      if (profileError) {
        // If profile insert fails, maybe delete auth user? Can't from client. Just return error
        return { error: profileError };
      }

      setUser(data.user);
      const prof = await fetchProfile(data.user.id);
      setProfile(prof);

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
  const canDelete = profile?.role === 'guru_super' || profile?.role === 'super_admin';

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
