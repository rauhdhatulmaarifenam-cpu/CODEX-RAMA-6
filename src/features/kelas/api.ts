import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { mutateWithQueue } from '../../lib/offlineQueue';
import type { Kelas } from '../../types';

const KELAS_SELECT = '*, kelas_wali(guru_id, guru:guru_id(id,nama_lengkap))';

export function useKelasList(params?: { search?: string }) {
  return useQuery({
    queryKey: ['kelas', params],
    queryFn: async () => {
      let q = supabase.from('kelas').select(KELAS_SELECT, { count: 'exact' }).order('nama_kelas');
      if (params?.search) q = q.ilike('nama_kelas', `%${params.search}%`);
      const { data, error, count } = await q;
      if (error) throw error;
      return { data: data as Kelas[], count: count ?? 0 };
    },
  });
}

export function useKelasDetail(id?: string) {
  return useQuery({
    queryKey: ['kelas', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('kelas')
        .select(KELAS_SELECT)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as Kelas;
    },
  });
}

/** Sync kelas_wali junction: hapus semua lama, insert baru */
export async function syncKelasWali(kelasId: string, guruIds: string[]) {
  await supabase.from('kelas_wali').delete().eq('kelas_id', kelasId);
  if (guruIds.length > 0) {
    await supabase
      .from('kelas_wali')
      .insert(guruIds.map(gid => ({ kelas_id: kelasId, guru_id: gid })));
  }
}

export async function createKelas(payload: Partial<Kelas>, waliIds: string[] = []) {
  const { data: { user } } = await supabase.auth.getUser();
  const kelasId = payload.id || crypto.randomUUID();
  const toInsert = { ...payload, created_by: user?.id, id: kelasId };
  const result = await mutateWithQueue({ table: 'kelas', operation: 'insert', payload: toInsert });
  if (!result.queued && !result.error) {
    await syncKelasWali(kelasId, waliIds);
  }
  return result;
}

export async function updateKelas(id: string, payload: Partial<Kelas>, waliIds?: string[]) {
  const { id: _id, ...rest } = payload as any;
  const result = await mutateWithQueue({ table: 'kelas', operation: 'update', id, payload: rest });
  if (!result.queued && !result.error && waliIds !== undefined) {
    await syncKelasWali(id, waliIds);
  }
  return result;
}

export async function deleteKelas(id: string) {
  return mutateWithQueue({ table: 'kelas', operation: 'delete', id, payload: { id } });
}

/**
 * Ambil SEMUA kelas yang sesuai filter tanpa paginasi — untuk keperluan ekspor.
 */
export async function fetchAllKelas(params?: { search?: string }) {
  let q = supabase.from('kelas').select(KELAS_SELECT).order('nama_kelas');
  if (params?.search) q = q.ilike('nama_kelas', `%${params.search}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data as Kelas[]) ?? [];
}

/**
 * Ambil semua santri dan kelompokkan per kelas_id.
 * Dipakai saat ekspor kelas agar setiap baris kelas menyertakan daftar santri anggota.
 */
export async function fetchSantriGroupedByKelasId(): Promise<Record<string, string[]>> {
  const { data, error } = await supabase
    .from('santri')
    .select('id,nama_lengkap,nis,kelas_id')
    .order('nama_lengkap');
  if (error) throw error;
  const grouped: Record<string, string[]> = {};
  (data ?? []).forEach((s: any) => {
    if (!s.kelas_id) return;
    if (!grouped[s.kelas_id]) grouped[s.kelas_id] = [];
    const label = s.nis ? `${s.nama_lengkap} (${s.nis})` : s.nama_lengkap;
    grouped[s.kelas_id].push(label);
  });
  return grouped;
}
