import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { ArrowLeft, Layers } from 'lucide-react';
import { Button } from '../../components/Button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell,
} from 'recharts';

// ── Brand palette ────────────────────────────────────────────────────────────
const BAR_COLORS = ['#0B5D4C', '#1A8A6C', '#4A9E87', '#C9A227', '#E8C547', '#8B6914', '#5B7FA6'];

function formatTgl(d: Date) {
  return (
    d.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  );
}

const TOOLTIP_STYLE = {
  borderRadius: '0.75rem', border: '1px solid #E5E1D8',
  fontSize: '13px', background: '#fff',
};

export function SeksiLaporan() {
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);

  const { data: seksiRows = [], isLoading } = useQuery({
    queryKey: ['laporan', 'seksi'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('seksi')
        .select('id, nama_seksi, deskripsi, pembina:pembina_id(id, nama_lengkap), guru_seksi(guru_id)')
        .order('nama_seksi');
      if (error) throw error;
      return (data as any[]) ?? [];
    },
    staleTime: 0,
  });

  // Bar: anggota guru per seksi
  const perSeksiData = useMemo(() => {
    return seksiRows
      .map((s: any) => ({ name: s.nama_seksi, value: s.guru_seksi?.length ?? 0 }))
      .sort((a: any, b: any) => b.value - a.value);
  }, [seksiRows]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate('/seksi')}
        leftIcon={<ArrowLeft className="w-4 h-4" />}>
        Kembali ke Daftar Seksi
      </Button>

      <div className="bg-surface rounded-2xl border border-border/60 overflow-hidden shadow-sm">
        {/* ── KOP ── */}
        <div className="p-6 sm:p-10 text-center border-b border-border/60 bg-gradient-to-b from-primary/5 to-transparent">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white font-heading font-bold text-xl mx-auto mb-3">
            RM6
          </div>
          <p className="text-xs tracking-[0.2em] uppercase text-text-secondary">Pondok Pesantren</p>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold mt-0.5">Raudhatul Ma'arif 6</h1>
          <div className="mt-5 pt-4 border-t border-border/40 flex flex-col items-center gap-2">
            <span className="inline-flex items-center gap-2 bg-primary text-white px-4 py-1.5 rounded-full text-sm font-semibold">
              <Layers className="w-4 h-4" /> Laporan Data Seksi
            </span>
            <p className="text-sm text-text-secondary">{formatTgl(now)}</p>
            <p className="text-sm font-semibold text-primary">
              {isLoading ? '—' : `${seksiRows.length} seksi terdaftar`}
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-10">
          {isLoading ? (
            <div className="h-64 animate-pulse bg-border/20 rounded-xl" />
          ) : (
            <>
              {/* ── Grafik ── */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-4">
                  Jumlah Anggota Guru per Seksi
                </h3>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={perSeksiData}
                    margin={{ top: 4, right: 16, left: 0, bottom: 72 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E1D8" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-38} textAnchor="end" interval={0} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [v, 'Guru']} />
                    <Bar dataKey="value" name="Guru" radius={[4, 4, 0, 0]}>
                      {perSeksiData.map((_: any, i: number) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* ── Tabel ── */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-4">
                  Daftar Lengkap Seksi
                </h3>
                <div className="overflow-x-auto rounded-xl border border-border/60">
                  <table className="w-full text-sm min-w-[480px]">
                    <thead>
                      <tr className="bg-primary text-white text-left">
                        {['No', 'Nama Seksi', 'Deskripsi', 'Pembina', 'Jml Guru'].map(h => (
                          <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {seksiRows.map((s: any, i: number) => (
                        <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAF8F3]'}>
                          <td className="px-4 py-2.5 tabular-nums text-text-secondary">{i + 1}</td>
                          <td className="px-4 py-2.5 font-medium">{s.nama_seksi}</td>
                          <td className="px-4 py-2.5 text-text-secondary max-w-xs truncate">
                            {s.deskripsi ?? '-'}
                          </td>
                          <td className="px-4 py-2.5 text-text-secondary">
                            {(s.pembina as any)?.nama_lengkap ?? '-'}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums font-semibold text-primary">
                            {s.guru_seksi?.length ?? 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
