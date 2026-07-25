import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { History, User } from 'lucide-react';
import { TableWrapper, TableHeader, TableHead, TableBody, TableCell } from '../../components/Table';
import { TableSkeleton } from '../../components/Skeleton';
import { useRealtime } from '../../hooks/useRealtime';

const PER_PAGE = 30;

const TABLE_LABEL: Record<string, string> = {
  santri: 'Santri',
  guru:   'Guru',
  kelas:  'Kelas',
  seksi:  'Seksi',
};

const ACTION_META: Record<string, { label: string; cls: string }> = {
  insert: { label: 'Tambah', cls: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  update: { label: 'Ubah',   cls: 'bg-blue-50   text-blue-700   border border-blue-200'   },
  delete: { label: 'Hapus',  cls: 'bg-red-50    text-danger     border border-red-200'    },
};

function formatWaktu(iso: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export function AktivitasPage() {
  const [page, setPage] = useState(1);
  const qc = useQueryClient();

  // Realtime: invalidate saat ada aktivitas baru
  useRealtime('activity_log', [['activity_log']]);

  const { data, isLoading } = useQuery({
    queryKey: ['activity_log', page],
    queryFn: async () => {
      const from = (page - 1) * PER_PAGE;
      const { data, error, count } = await supabase
        .from('activity_log')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, from + PER_PAGE - 1);
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
    staleTime: 0,
  });

  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PER_PAGE));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <History className="w-6 h-6 text-primary" /> Riwayat Aktivitas
        </h1>
        <p className="text-sm text-text-secondary">
          Semua perubahan data dicatat otomatis. Catatan tidak bisa diedit atau dihapus oleh siapapun lewat aplikasi.
        </p>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : (
        <>
          <TableWrapper>
            <TableHeader>
              <TableHead>Waktu</TableHead>
              <TableHead>Pengguna</TableHead>
              <TableHead>Aksi</TableHead>
              <TableHead>Modul</TableHead>
              <TableHead>Data</TableHead>
            </TableHeader>
            <TableBody>
              {data?.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-text-secondary text-sm">
                    Belum ada aktivitas yang tercatat.
                  </td>
                </tr>
              ) : (
                data?.rows.map(row => {
                  const meta = ACTION_META[row.action] ?? { label: row.action, cls: 'bg-border text-text-secondary' };
                  return (
                    <tr key={row.id} className="hover:bg-background/60">
                      <TableCell className="text-xs text-text-secondary whitespace-nowrap">
                        {formatWaktu(row.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                          <span className="text-sm font-medium">@{row.actor_nickname}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${meta.cls}`}>
                          {meta.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {TABLE_LABEL[row.table_name] ?? row.table_name}
                      </TableCell>
                      <TableCell className="text-sm font-medium">
                        {row.record_label ?? <span className="text-text-secondary">—</span>}
                      </TableCell>
                    </tr>
                  );
                })
              )}
            </TableBody>
          </TableWrapper>

          {/* Paginasi */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">
                {data?.count ?? 0} aktivitas total
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-background transition-colors"
                >
                  ← Sebelumnya
                </button>
                <span className="px-3 py-1.5 text-text-secondary">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg border border-border disabled:opacity-40 hover:bg-background transition-colors"
                >
                  Berikutnya →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
