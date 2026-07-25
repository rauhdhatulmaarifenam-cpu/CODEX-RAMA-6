import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './features/auth/AuthContext';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { Layout } from './components/Layout';
import { LoginPage } from './features/auth/LoginPage';
import { SignupPage } from './features/auth/SignupPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { SantriList } from './features/santri/SantriList';
import { SantriDetail } from './features/santri/SantriDetail';
import { SantriForm } from './features/santri/SantriForm';
import { SantriLaporan } from './features/santri/SantriLaporan';
import { KelasList } from './features/kelas/KelasList';
import { KelasDetail } from './features/kelas/KelasDetail';
import { KelasForm } from './features/kelas/KelasForm';
import { KelasLaporan } from './features/kelas/KelasLaporan';
import { GuruList } from './features/guru/GuruList';
import { GuruDetail } from './features/guru/GuruDetail';
import { GuruForm } from './features/guru/GuruForm';
import { GuruLaporan } from './features/guru/GuruLaporan';
import { SeksiList } from './features/seksi/SeksiList';
import { SeksiDetail } from './features/seksi/SeksiDetail';
import { SeksiForm } from './features/seksi/SeksiForm';
import { SeksiLaporan } from './features/seksi/SeksiLaporan';
import { AnggotaPage } from './features/anggota/AnggotaPage';
import { AgentPage } from './features/agent/AgentPage';
import { AktivitasPage } from './features/aktivitas/AktivitasPage';
import { ProfilePage } from './features/auth/ProfilePage';
import { Toaster } from 'sonner';
import { useEffect, useState } from 'react';
import { processQueue, setupOfflineListeners, getPendingQueue } from './lib/offlineQueue';
import { useQueryClient } from '@tanstack/react-query';
import { WifiOff } from 'lucide-react';

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
        if (!success) {
          // keep failed
        } else {
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
    return () => { clearInterval(interval); window.removeEventListener('offline-queue-updated', run as any); };
  }, [qc]);

  if (failedItems.length === 0) return null;
  return (
    <div className="fixed bottom-20 lg:bottom-6 right-4 left-4 lg:left-auto lg:w-96 bg-surface rounded-2xl shadow-soft-lg border border-red-200 p-4 z-50">
      <div className="flex gap-2">
        <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center text-danger"><WifiOff className="w-4 h-4"/></div>
        <div className="flex-1">
          <div className="font-semibold text-sm">Gagal sinkron {failedItems.length} perubahan</div>
          <div className="text-xs text-text-secondary mt-1">Beberapa perubahan offline tidak bisa dikirim. Coba kirim ulang, atau hubungi admin jika masalah berlanjut.</div>
          <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
            {failedItems.map((it:any)=>{
              const namaModul: Record<string,string> = { santri:'Santri', kelas:'Kelas', guru:'Guru', seksi:'Seksi', guru_seksi:'Relasi Guru-Seksi', kelas_wali:'Wali Kelas' };
              const namaAksi: Record<string,string>  = { insert:'Tambah', update:'Ubah', delete:'Hapus' };
              return (
                <div key={it.localId} className="text-xs bg-background rounded-lg p-2">
                  <div className="font-medium">{namaModul[it.table] ?? it.table} — {namaAksi[it.operation] ?? it.operation}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={async ()=>{ await processQueue(); }} className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white">Coba lagi</button>
            <button onClick={()=>setFailedItems([])} className="text-xs px-3 py-1.5 rounded-lg bg-background border">Tutup</button>
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
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace/>} />
              <Route path="dashboard" element={<DashboardPage />} />

              <Route path="santri" element={<SantriList />} />
              <Route path="santri/laporan" element={<SantriLaporan />} />
              <Route path="santri/baru" element={<SantriForm />} />
              <Route path="santri/:id" element={<SantriDetail />} />

              <Route path="kelas" element={<KelasList />} />
              <Route path="kelas/laporan" element={<KelasLaporan />} />
              <Route path="kelas/baru" element={<KelasForm />} />
              <Route path="kelas/:id" element={<KelasDetail />} />

              <Route path="guru" element={<GuruList />} />
              <Route path="guru/laporan" element={<GuruLaporan />} />
              <Route path="guru/baru" element={<GuruForm />} />
              <Route path="guru/:id" element={<GuruDetail />} />

              <Route path="seksi" element={<SeksiList />} />
              <Route path="seksi/laporan" element={<SeksiLaporan />} />
              <Route path="seksi/baru" element={<SeksiForm />} />
              <Route path="seksi/:id" element={<SeksiDetail />} />

              <Route path="anggota" element={<ProtectedRoute superAdminOnly><AnggotaPage /></ProtectedRoute>} />
              <Route path="agent" element={<ProtectedRoute superAdminOnly><AgentPage /></ProtectedRoute>} />
              <Route path="aktivitas" element={<ProtectedRoute superAdminOnly><AktivitasPage /></ProtectedRoute>} />
              <Route path="profil" element={<ProfilePage />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
