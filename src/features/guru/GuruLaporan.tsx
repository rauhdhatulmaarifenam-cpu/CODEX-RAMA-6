import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { ArrowLeft, UserCheck } from 'lucide-react';
import { Button } from '../../components/Button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

// ── Brand palette ────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  aktif:    '#0B5D4C',
  nonaktif: '#C9A227',
};
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

export function GuruLaporan() {
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);

  const { data: guruRows = [], isLoading } = useQuery({
    queryKey: ['laporan', 'guru'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('guru')
        .select('id, nama_lengkap, nip, jenis_kelamin, status, guru_seksi(seksi_id, seksi:seksi_id(id, nama_seksi))')
        .order('nama_lengkap');
      if (error) throw error;
      return (data as any[]) ?? [];
    },
    staleTime: 0,
  });

  // Bar: guru per seksi (one guru can count in multiple seksi)
  const perSeksiData = useMemo(() => {
    const m = new Map<string, number>();
    guruRows.forEach(g => {
      g.guru_seksi?.forEach((gs: any) => {
        const nm = gs.seksi?.nama_seksi ?? 'Tanpa Seksi';
        m.set(nm, (m.get(nm) ?? 0) + 1);
      });
    });
    return [...m.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [guruRows]);

  // Donut: status
  const statusData = useMemo(() => {
    const m = new Map<string, number>();
    guruRows.forEach(g => m.set(g.status, (m.get(g.status) ?? 0) + 1));
    return [...m.entries()].map(([name, value]) => ({ name, value }));
  }, [guruRows]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate('/guru')}
        leftIcon={<ArrowLeft className="w-4 h-4" />}>
        Kembali ke Daftar Guru
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
              <UserCheck className="w-4 h-4" /> Laporan Data Guru
            </span>
            <p className="text-sm text-text-secondary">{formatTgl(now)}</p>
            <p className="text-sm font-semibold text-primary">
              {isLoading ? '—' : `${guruRows.length} guru terdaftar`}
            </p>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-10">
          {isLoading ? (
            <div className="h-64 animate-pulse bg-border/20 rounded-xl" />
          ) : (
            <>
              {/* ── Grafik ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Bar: guru per seksi */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-4">
                    Jumlah Guru per Seksi
                  </h3>
                  <p className="text-xs text-text-secondary mb-3 -mt-2">
                    Satu guru dapat terhitung di lebih dari satu seksi.
                  </p>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={perSeksiData}
                      margin={{ top: 4, right: 8, left: 0, bottom: 72 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E1D8" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-38} textAnchor="end" interval={0} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [v, 'Guru']} />
                      <Bar dataKey="value" name="Guru" radius={[4, 4, 0, 0]}>
                        {perSeksiData.map((_, i) => (
                          <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Donut: status */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-4">
                    Proporsi Status Guru
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="42%" innerRadius={64} outerRadius={96}
                        paddingAngle={3} dataKey="value" nameKey="name">
                        {statusData.map((e, i) => (
                          <Cell key={e.name} fill={STATUS_COLOR[e.name] ?? BAR_COLORS[i % BAR_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any, n: any) => [v, n]} />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '4px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* ── Tabel ── */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-4">
                  Daftar Lengkap Guru
                </h3>
                <div className="overflow-x-auto rounded-xl border border-border/60">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead>
                      <tr className="bg-primary text-white text-left">
                        {['No', 'Nama Lengkap', 'NIP', 'Seksi', 'Status'].map(h => (
                          <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {guruRows.map((g: any, i: number) => (
                        <tr key={g.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAF8F3]'}>
                          <td className="px-4 py-2.5 tabular-nums text-text-secondary">{i + 1}</td>
                          <td className="px-4 py-2.5 font-medium">{g.nama_lengkap}</td>
                          <td className="px-4 py-2.5 tabular-nums text-text-secondary">{g.nip ?? '-'}</td>
                          <td className="px-4 py-2.5 text-text-secondary">
                            {g.guru_seksi?.map((gs: any) => gs.seksi?.nama_seksi).filter(Boolean).join(', ') || '-'}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                              ${g.status === 'aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-border/60 text-text-secondary'}`}>
                              {g.status}
                            </span>
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
