import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { AuthProvider } from './features/auth/AuthContext';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './features/auth/LoginPage';
import { SignupPage } from './features/auth/SignupPage';
import { Toaster } from 'sonner';
import { processQueue, setupOfflineListeners, getPendingQueue } from './lib/offlineQueue';
import { WifiOff } from 'lucide-react';

// ─── Lazy-loaded feature pages ────────────────────────────────────────────────
// Setiap fitur jadi chunk terpisah; browser hanya mengunduh chunk
// yang dibutuhkan, bukan seluruh bundle sekaligus.
const DashboardPage  = lazy(() => import('./features/dashboard/DashboardPage').then(m => ({ default: m.DashboardPage })));

const SantriList     = lazy(() => import('./features/santri/SantriList').then(m => ({ default: m.SantriList })));
const SantriDetail   = lazy(() => import('./features/santri/SantriDetail').then(m => ({ default: m.SantriDetail })));
const SantriForm     = lazy(() => import('./features/santri/SantriForm').then(m => ({ default: m.SantriForm })));
const SantriLaporan  = lazy(() => import('./features/santri/SantriLaporan').then(m => ({ default: m.SantriLaporan })));

const KelasList      = lazy(() => import('./features/kelas/KelasList').then(m => ({ default: m.KelasList })));
const KelasDetail    = lazy(() => import('./features/kelas/KelasDetail').then(m => ({ default: m.KelasDetail })));
const KelasForm      = lazy(() => import('./features/kelas/KelasForm').then(m => ({ default: m.KelasForm })));
const KelasLaporan   = lazy(() => import('./features/kelas/KelasLaporan').then(m => ({ default: m.KelasLaporan })));

const GuruList       = lazy(() => import('./features/guru/GuruList').then(m => ({ default: m.GuruList })));
const GuruDetail     = lazy(() => import('./features/guru/GuruDetail').then(m => ({ default: m.GuruDetail })));
const GuruForm       = lazy(() => import('./features/guru/GuruForm').then(m => ({ default: m.GuruForm })));
const GuruLaporan    = lazy(() => import('./features/guru/GuruLaporan').then(m => ({ default: m.GuruLaporan })));

const SeksiList      = lazy(() => import('./features/seksi/SeksiList').then(m => ({ default: m.SeksiList })));
const SeksiDetail    = lazy(() => import('./features/seksi/SeksiDetail').then(m => ({ default: m.SeksiDetail })));
const SeksiForm      = lazy(() => import('./features/seksi/SeksiForm').then(m => ({ default: m.SeksiForm })));
const SeksiLaporan   = lazy(() => import('./features/seksi/SeksiLaporan').then(m => ({ default: m.SeksiLaporan })));

const AnggotaPage    = lazy(() => import('./features/anggota/AnggotaPage').then(m => ({ default: m.AnggotaPage })));
const AgentPage      = lazy(() => import('./features/agent/AgentPage').then(m => ({ default: m.AgentPage })));
const AktivitasPage  = lazy(() => import('./features/aktivitas/AktivitasPage').then(m => ({ default: m.AktivitasPage })));
const ProfilePage    = lazy(() => import('./features/auth/ProfilePage').then(m => ({ default: m.ProfilePage })));
// ─────────────────────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60,
    }
  }
});

function OfflineManager() {
  const qc = useQueryClient();
  const [failedItems, setFailedItems] = useState<any[]>([]);

  useEffect(() => {
    const run = async () => {
      const q = await getPendingQueue();
      const fails = q.filter(i => i.status === 'failed');
      setFailedItems(fails);
    };

    const process = async () => {
      await processQueue((item, success) => {
        if (success) {
          qc.invalidateQueries({ queryKey: [item.table] });
        }
      });
      run();
    };

    setupOfflineListeners(process);
    process();
    run();

    const interval = setInterval(run, 5000);
    window.addEventListener('offline-queue-updated', run as any);
    return () => {
      clearInterval(interval);
      window.removeEventListener('offline-queue-updated', run as any);
    };
  }, [qc]);

  if (failedItems.length === 0) return null;
  return (
    <div className="fixed bottom-20 lg:bottom-6 right-4 left-4 lg:left-auto lg:w-96 bg-surface rounded-2xl shadow-soft-lg border border-red-200 p-4 z-50">
      <div className="flex gap-2">
        <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-danger">
          <WifiOff className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm">Gagal sinkron {failedItems.length} perubahan</div>
          <div className="text-xs text-text-secondary mt-1">
            Beberapa perubahan offline tidak bisa dikirim. Coba kirim ulang, atau hubungi admin jika masalah berlanjut.
          </div>
          <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
            {failedItems.map((it: any) => {
              const namaModul: Record<string, string> = { santri: 'Santri', kelas: 'Kelas', guru: 'Guru', seksi: 'Seksi', guru_seksi: 'Relasi Guru-Seksi', kelas_wali: 'Wali Kelas' };
              const namaAksi: Record<string, string>  = { insert: 'Tambah', update: 'Ubah', delete: 'Hapus' };
              return (
                <div key={it.localId} className="text-xs bg-background rounded-lg p-2">
                  <div className="font-medium">{namaModul[it.table] ?? it.table} — {namaAksi[it.operation] ?? it.operation}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={async () => { await processQueue(); }} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white">Coba lagi</button>
            <button onClick={() => setFailedItems([])} className="text-xs px-3 py-1.5 rounded-lg bg-background border">Tutup</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Toaster position="top-right" richColors closeButton />
          <OfflineManager />
          <Routes>
            <Route path="/login"  element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />

              <Route path="santri"         element={<SantriList />} />
              <Route path="santri/laporan" element={<SantriLaporan />} />
              <Route path="santri/baru"    element={<SantriForm />} />
              <Route path="santri/:id"     element={<SantriDetail />} />

              <Route path="kelas"         element={<KelasList />} />
              <Route path="kelas/laporan" element={<KelasLaporan />} />
              <Route path="kelas/baru"    element={<KelasForm />} />
              <Route path="kelas/:id"     element={<KelasDetail />} />

              <Route path="guru"         element={<GuruList />} />
              <Route path="guru/laporan" element={<GuruLaporan />} />
              <Route path="guru/baru"    element={<GuruForm />} />
              <Route path="guru/:id"     element={<GuruDetail />} />

              <Route path="seksi"         element={<SeksiList />} />
              <Route path="seksi/laporan" element={<SeksiLaporan />} />
              <Route path="seksi/baru"    element={<SeksiForm />} />
              <Route path="seksi/:id"     element={<SeksiDetail />} />

              <Route path="anggota"   element={<ProtectedRoute superAdminOnly><AnggotaPage /></ProtectedRoute>} />
              <Route path="agent"     element={<ProtectedRoute superAdminOnly><AgentPage /></ProtectedRoute>} />
              <Route path="aktivitas" element={<ProtectedRoute superAdminOnly><AktivitasPage /></ProtectedRoute>} />
              <Route path="profil"    element={<ProfilePage />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
