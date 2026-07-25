import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { mutateWithQueue } from '../../lib/offlineQueue';
import type { Santri } from '../../types';

export const SANTRI_KEY = 'santri';

export function useSantriList(params?: {
  search?: string;
  kelasId?: string;
  status?: string;
  page?: number;
  perPage?: number;
}) {
  return useQuery({
    queryKey: [SANTRI_KEY, params],
    queryFn: async () => {
      let query = supabase
        .from('santri')
        .select('*, kelas:kelas_id(id,nama_kelas)', { count: 'exact' })
        // Urutan berlapis: nama_lengkap utama, id sebagai penentu urutan kedua yang unik
        // agar Postgres tidak mengacak baris dengan nama sama antar halaman.
        .order('nama_lengkap')
        .order('id');

      if (params?.search) query = query.or(`nama_lengkap.ilike.%${params.search}%,nis.ilike.%${params.search}%`);
      if (params?.kelasId) query = query.eq('kelas_id', params.kelasId);
      if (params?.status)  query = query.eq('status', params.status);
      if (params?.page && params?.perPage) {
        const from = (params.page - 1) * params.perPage;
        query = query.range(from, from + params.perPage - 1);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data as Santri[], count: count ?? 0 };
    },
  });
}

/**
 * Ambil SEMUA santri yang sesuai filter tanpa paginasi — untuk keperluan ekspor.
 */
export async function fetchAllSantri(params?: {
  search?: string;
  kelasId?: string;
  status?: string;
}) {
  let query = supabase
    .from('santri')
    .select('*, kelas:kelas_id(id,nama_kelas)')
    .order('nama_lengkap')
    .order('id');

  if (params?.search) query = query.or(`nama_lengkap.ilike.%${params.search}%,nis.ilike.%${params.search}%`);
  if (params?.kelasId) query = query.eq('kelas_id', params.kelasId);
  if (params?.status)  query = query.eq('status', params.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data as Santri[]) ?? [];
}

export function useSantriDetail(id?: string) {
  return useQuery({
    queryKey: [SANTRI_KEY, id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('santri')
        .select('*, kelas:kelas_id(*)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as Santri;
    },
  });
}

export async function createSantri(payload: Partial<Santri>) {
  const { data: { user } } = await supabase.auth.getUser();
  const toInsert = { ...payload, created_by: user?.id, id: payload.id || crypto.randomUUID() };
  return mutateWithQueue({ table: 'santri', operation: 'insert', payload: toInsert });
}

export async function updateSantri(id: string, payload: Partial<Santri>) {
  const { id: _id, ...rest } = payload as any;
  return mutateWithQueue({ table: 'santri', operation: 'update', id, payload: rest });
}

export async function deleteSantri(id: string) {
  return mutateWithQueue({ table: 'santri', operation: 'delete', id, payload: { id } });
}
