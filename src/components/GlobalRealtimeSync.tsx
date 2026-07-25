/**
 * GlobalRealtimeSync
 *
 * Di-mount di dalam Layout sehingga selalu aktif sepanjang sesi login,
 * tidak peduli halaman mana yang sedang dibuka.
 *
 * Mendengarkan perubahan (INSERT / UPDATE / DELETE) pada 6 tabel yang
 * mempengaruhi statistik Dashboard, lalu menginvalidasi query key
 * ['dashboard'] agar DashboardPage selalu menampilkan angka terkini
 * saat dibuka — bahkan setelah mutasi dilakukan dari halaman lain.
 */

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

const DASHBOARD_TABLES = ['santri', 'guru', 'kelas', 'seksi', 'guru_seksi', 'kelas_wali'] as const;

export function GlobalRealtimeSync() {
  const qc = useQueryClient();

  useEffect(() => {
    const channels = DASHBOARD_TABLES.map(table =>
      supabase
        .channel(`global-dashboard-sync-${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
          qc.invalidateQueries({ queryKey: ['dashboard'] });
        })
        .subscribe()
    );

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, [qc]);

  return null;
}
