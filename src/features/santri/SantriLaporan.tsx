import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { ArrowLeft, Users } from 'lucide-react';
import { Button } from '../../components/Button';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

// ── Brand palette ────────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  aktif:  '#0B5D4C',
  lulus:  '#C9A227',
  keluar: '#5B7FA6',
  pindah: '#4A9E87',
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

export function SantriLaporan() {
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['laporan', 'santri'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('santri')
        .select('id, nis, nama_lengkap, jenis_kelamin, status, tanggal_masuk, kelas:kelas_id(id, nama_kelas)')
        .order('nama_lengkap');
      if (error) throw error;
      return (data as any[]) ?? [];
    },
    staleTime: 0,
  });

  // Bar: santri per kelas
  const perKelasData = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(s => {
      const nm = s.kelas?.nama_kelas ?? 'Tanpa Kelas';
      m.set(nm, (m.get(nm) ?? 0) + 1);
    });
    return [...m.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  // Donut: status
  const statusData = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(s => m.set(s.status, (m.get(s.status) ?? 0) + 1));
    return [...m.entries()].map(([name, value]) => ({ name, value }));
  }, [rows]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate('/santri')}
        leftIcon={<ArrowLeft className="w-4 h-4" />}>
        Kembali ke Daftar Santri
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
              <Users className="w-4 h-4" /> Laporan Data Santri
            </span>
            <p className="text-sm text-text-secondary">{formatTgl(now)}</p>
            <p className="text-sm font-semibold text-primary">
              {isLoading ? '—' : `${rows.length} santri terdaftar`}
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
                {/* Bar: per kelas */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-4">
                    Jumlah Santri per Kelas
                  </h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={perKelasData}
                      margin={{ top: 4, right: 8, left: 0, bottom: 72 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E1D8" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-38} textAnchor="end" interval={0} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={28} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: any) => [v, 'Santri']} />
                      <Bar dataKey="value" name="Santri" radius={[4, 4, 0, 0]}>
                        {perKelasData.map((_, i) => (
                          <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Donut: status */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-text-secondary mb-4">
                    Proporsi Status Santri
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
                  Daftar Lengkap Santri
                </h3>
                <div className="overflow-x-auto rounded-xl border border-border/60">
                  <table className="w-full text-sm min-w-[620px]">
                    <thead>
                      <tr className="bg-primary text-white text-left">
                        {['No', 'NIS', 'Nama Lengkap', 'JK', 'Kelas', 'Status', 'Tgl Masuk'].map(h => (
                          <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((s, i) => (
                        <tr key={s.id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#FAF8F3]'}>
                          <td className="px-4 py-2.5 tabular-nums text-text-secondary">{i + 1}</td>
                          <td className="px-4 py-2.5 tabular-nums text-text-secondary">{s.nis ?? '-'}</td>
                          <td className="px-4 py-2.5 font-medium">{s.nama_lengkap}</td>
                          <td className="px-4 py-2.5">{s.jenis_kelamin ?? '-'}</td>
                          <td className="px-4 py-2.5">
                            {s.kelas?.nama_kelas ?? <span className="italic text-text-secondary">Tanpa kelas</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                              ${s.status === 'aktif' ? 'bg-emerald-100 text-emerald-800' : 'bg-border/60 text-text-secondary'}`}>
                              {s.status}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 tabular-nums text-text-secondary">
                            {s.tanggal_masuk
                              ? new Date(s.tanggal_masuk).toLocaleDateString('id-ID')
                              : '-'}
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
