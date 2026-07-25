import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { mutateWithQueue } from '../../lib/offlineQueue';
import type { Guru } from '../../types';

const GURU_SELECT = '*, guru_seksi(seksi_id, seksi:seksi_id(id,nama_seksi))';

export function useGuruList(params?: { search?: string; seksiId?: string; status?: string }) {
  return useQuery({
    queryKey: ['guru', params],
    queryFn: async () => {
      let q = supabase.from('guru').select(GURU_SELECT, { count: 'exact' }).order('nama_lengkap');
      if (params?.search) q = q.or(`nama_lengkap.ilike.%${params.search}%,nip.ilike.%${params.search}%`);
      if (params?.status) q = q.eq('status', params.status);
      const { data, error, count } = await q;
      if (error) throw error;

      let result = (data as Guru[]) ?? [];
      let total = count ?? 0;

      // Filter by seksi client-side (junction table, tidak bisa server-side langsung)
      if (params?.seksiId) {
        result = result.filter(g =>
          (g.guru_seksi as any[])?.some((gs: any) => gs.seksi_id === params.seksiId)
        );
        total = result.length;
      }

      return { data: result, count: total };
    },
  });
}

export function useGuruDetail(id?: string) {
  return useQuery({
    queryKey: ['guru', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guru')
        .select(GURU_SELECT)
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as Guru;
    },
  });
}

/** Sync guru_seksi junction: hapus semua lama, insert baru */
export async function syncGuruSeksi(guruId: string, seksiIds: string[]) {
  await supabase.from('guru_seksi').delete().eq('guru_id', guruId);
  if (seksiIds.length > 0) {
    await supabase
      .from('guru_seksi')
      .insert(seksiIds.map(sid => ({ guru_id: guruId, seksi_id: sid })));
  }
}

export async function createGuru(payload: Partial<Guru>, seksiIds: string[] = []) {
  const { data: { user } } = await supabase.auth.getUser();
  const guruId = payload.id || crypto.randomUUID();
  const toInsert = { ...payload, created_by: user?.id, id: guruId };
  const result = await mutateWithQueue({ table: 'guru', operation: 'insert', payload: toInsert });
  if (!result.queued && !result.error) {
    await syncGuruSeksi(guruId, seksiIds);
  }
  return result;
}

export async function updateGuru(id: string, payload: Partial<Guru>, seksiIds?: string[]) {
  const { id: _id, ...rest } = payload as any;
  const result = await mutateWithQueue({ table: 'guru', operation: 'update', id, payload: rest });
  if (!result.queued && !result.error && seksiIds !== undefined) {
    await syncGuruSeksi(id, seksiIds);
  }
  return result;
}

export async function deleteGuru(id: string) {
  return mutateWithQueue({ table: 'guru', operation: 'delete', id, payload: { id } });
}

/**
 * Ambil SEMUA guru yang sesuai filter tanpa paginasi — untuk keperluan ekspor.
 */
export async function fetchAllGuru(params?: {
  search?: string;
  seksiId?: string;
  status?: string;
}) {
  let q = supabase.from('guru').select(GURU_SELECT).order('nama_lengkap').order('id');
  if (params?.search) q = q.or(`nama_lengkap.ilike.%${params.search}%,nip.ilike.%${params.search}%`);
  if (params?.status)  q = q.eq('status', params.status);
  const { data, error } = await q;
  if (error) throw error;
  let result = (data as Guru[]) ?? [];
  if (params?.seksiId) {
    result = result.filter(g =>
      (g.guru_seksi as any[])?.some((gs: any) => gs.seksi_id === params.seksiId)
    );
  }
  return result;
}

/**
 * Ambil peta guru_id → nama kelas tempat guru menjadi wali.
 * Dipakai untuk melengkapi data ekspor guru.
 */
export async function fetchKelasWaliByGuruIds(
  guruIds: string[]
): Promise<Record<string, string[]>> {
  if (guruIds.length === 0) return {};
  const { data, error } = await supabase
    .from('kelas_wali')
    .select('guru_id, kelas:kelas_id(id,nama_kelas)')
    .in('guru_id', guruIds);
  if (error) throw error;
  const grouped: Record<string, string[]> = {};
  (data ?? []).forEach((row: any) => {
    if (!grouped[row.guru_id]) grouped[row.guru_id] = [];
    if (row.kelas?.nama_kelas) grouped[row.guru_id].push(row.kelas.nama_kelas);
  });
  return grouped;
}
