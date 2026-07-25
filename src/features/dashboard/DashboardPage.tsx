import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/Card';
import { Users, GraduationCap, UserCheck, Layers, TrendingUp, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export function DashboardPage() {
  const navigate = useNavigate();

  // Langganan realtime untuk invalidasi query ['dashboard'] dipindahkan ke
  // GlobalRealtimeSync (di-mount di Layout) agar tetap aktif di semua halaman.
  // staleTime: 0 memastikan query selalu refetch saat halaman ini dibuka kembali.

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard'],
    staleTime: 0,
    queryFn: async () => {
      const [santri, guru, kelas, seksi] = await Promise.all([
        supabase.from('santri').select('id,status,kelas_id', { count: 'exact' }),
        supabase.from('guru').select('id', { count: 'exact' }),
        supabase.from('kelas').select('id,nama_kelas', { count: 'exact' }),
        supabase.from('seksi').select('id', { count: 'exact' }),
      ]);

      if (santri.error) throw santri.error;

      const perKelasMap = new Map<string, number>();
      santri.data?.forEach(s => {
        if (s.kelas_id) perKelasMap.set(s.kelas_id, (perKelasMap.get(s.kelas_id) || 0) + 1);
      });

      const kelasNames = new Map(kelas.data?.map(k => [k.id, k.nama_kelas]) || []);
      const perKelas = Array.from(perKelasMap.entries()).map(([kelasId, count]) => ({
        kelasId,
        nama_kelas: kelasNames.get(kelasId) || kelasId.slice(0, 8),
        count,
      }));

      return {
        totalSantri: santri.count ?? 0,
        totalGuru:   guru.count   ?? 0,
        totalKelas:  kelas.count  ?? 0,
        totalSeksi:  seksi.count  ?? 0,
        santriAktif: santri.data?.filter(s => s.status === 'aktif').length ?? 0,
        perKelas,
      };
    },
  });

  const cards = [
    { label: 'Total Santri', value: stats?.totalSantri ?? 0, sub: `${stats?.santriAktif ?? 0} aktif`,    icon: Users,         color: 'bg-emerald-50 text-primary',  href: '/santri' },
    { label: 'Total Guru',   value: stats?.totalGuru   ?? 0, sub: 'pengajar aktif',                      icon: UserCheck,     color: 'bg-blue-50 text-blue-600',    href: '/guru'   },
    { label: 'Total Kelas',  value: stats?.totalKelas  ?? 0, sub: 'ruang belajar',                       icon: GraduationCap, color: 'bg-amber-50 text-amber-600',  href: '/kelas'  },
    { label: 'Total Seksi',  value: stats?.totalSeksi  ?? 0, sub: 'bidang organisasi',                   icon: Layers,        color: 'bg-purple-50 text-purple-600', href: '/seksi'  },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold">Dashboard</h1>
        <p className="text-text-secondary mt-1">Ringkasan data pesantren Raudhatul Ma'arif 6</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => navigate(c.href)}
            className="cursor-pointer"
          >
            <Card hoverable>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm text-text-secondary">{c.label}</div>
                  <div className="text-3xl font-bold mt-2 font-heading">{isLoading ? '—' : c.value}</div>
                  <div className="text-xs text-text-secondary mt-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> {c.sub}
                  </div>
                </div>
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${c.color}`}>
                  <c.icon className="w-5 h-5" />
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Distribusi Santri per Kelas</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-40 animate-pulse bg-border/30 rounded-xl" />
            ) : (
              <div className="space-y-3">
                {stats?.perKelas.length === 0 ? (
                  <div className="py-10 text-center text-text-secondary flex flex-col items-center gap-2">
                    <AlertCircle className="w-6 h-6" />
                    Belum ada data santri per kelas
                  </div>
                ) : (
                  stats?.perKelas.map(item => {
                    const max = Math.max(...(stats?.perKelas.map(p => p.count) || [1]));
                    const pct = max ? (item.count / max) * 100 : 0;
                    return (
                      <div key={item.kelasId} className="flex items-center gap-3">
                        <div className="w-28 text-sm font-medium truncate">{item.nama_kelas}</div>
                        <div className="flex-1 h-2 bg-background rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6 }}
                            className="h-full bg-primary rounded-full"
                          />
                        </div>
                        <div className="w-10 text-sm tabular-nums text-right">{item.count}</div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Aktivitas & Info</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
              <div className="font-semibold text-primary">Realtime Aktif</div>
              <div className="text-text-secondary text-xs mt-1">Perubahan data dari guru lain akan muncul otomatis tanpa refresh.</div>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
              <div className="font-semibold text-amber-800">Mode Offline</div>
              <div className="text-text-secondary text-xs mt-1">Saat koneksi jelek, data tetap bisa ditambah/edit. Akan tersinkron otomatis saat online.</div>
            </div>
            <div className="text-xs text-text-secondary pt-2 border-t border-border/60">
              Tip: install PWA dari browser untuk akses cepat di homescreen.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
