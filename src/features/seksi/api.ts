import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { mutateWithQueue } from '../../lib/offlineQueue';
import type { Seksi } from '../../types';

export function useSeksiList(params?: { search?: string }) {
  return useQuery({
    queryKey: ['seksi', params],
    queryFn: async () => {
      let q = supabase.from('seksi').select('*, pembina:pembina_id(id,nama_lengkap,nickname)', { count: 'exact' }).order('nama_seksi');
      if (params?.search) q = q.ilike('nama_seksi', `%${params.search}%`);
      const { data, error, count } = await q;
      if (error) throw error;
      return { data: data as Seksi[], count: count ?? 0 };
    }
  });
}

export function useSeksiDetail(id?: string) {
  return useQuery({
    queryKey: ['seksi', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('seksi').select('*, pembina:pembina_id(*)').eq('id', id).single();
      if (error) throw error;
      return data as Seksi;
    }
  });
}

export async function createSeksi(payload: Partial<Seksi>) {
  const { data: { user } } = await supabase.auth.getUser();
  const toInsert = { ...payload, created_by: user?.id, id: payload.id || crypto.randomUUID() };
  return mutateWithQueue({ table: 'seksi', operation: 'insert', payload: toInsert });
}
export async function updateSeksi(id: string, payload: Partial<Seksi>) {
  const { id: _id, ...rest } = payload as any;
  return mutateWithQueue({ table: 'seksi', operation: 'update', id, payload: rest });
}
export async function deleteSeksi(id: string) {
  return mutateWithQueue({ table: 'seksi', operation: 'delete', id, payload: { id } });
}

/**
 * Ambil SEMUA seksi beserta daftar guru anggotanya — untuk keperluan ekspor.
 * Guru anggota diambil dari tabel penghubung guru_seksi secara terpisah
 * lalu digabungkan di sisi client.
 */
export async function fetchAllSeksiWithGuru(params?: { search?: string }) {
  let q = supabase
    .from('seksi')
    .select('*, pembina:pembina_id(id,nama_lengkap,nickname)')
    .order('nama_seksi');
  if (params?.search) q = q.ilike('nama_seksi', `%${params.search}%`);

  const [{ data: seksiData, error }, { data: gsData, error: gsError }] = await Promise.all([
    q,
    supabase
      .from('guru_seksi')
      .select('seksi_id, guru:guru_id(id,nama_lengkap)')
      .order('seksi_id'),
  ]);
  if (error) throw error;
  if (gsError) throw gsError;

  // Kelompokkan nama guru berdasarkan seksi_id
  const guruBySeksi: Record<string, string[]> = {};
  (gsData ?? []).forEach((gs: any) => {
    if (!guruBySeksi[gs.seksi_id]) guruBySeksi[gs.seksi_id] = [];
    if (gs.guru?.nama_lengkap) guruBySeksi[gs.seksi_id].push(gs.guru.nama_lengkap);
  });

  return (seksiData ?? []).map((s: any) => ({
    ...s,
    _guru_anggota: guruBySeksi[s.id] ?? [],
  }));
}
