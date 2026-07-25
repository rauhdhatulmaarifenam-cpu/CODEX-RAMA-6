import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, Users, GraduationCap, UserCheck,
  Layers, Users2, LogOut, Menu, X,
  Download, Settings, Search,
  Shield,
  BookOpen,
  Bot,
  History,
} from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import { OfflineBanner } from './OfflineBanner';
import { GlobalRealtimeSync } from './GlobalRealtimeSync';
import { cn } from '../lib/cn';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/santri', label: 'Santri', icon: Users },
  { path: '/kelas', label: 'Kelas', icon: GraduationCap },
  { path: '/guru', label: 'Guru', icon: UserCheck },
  { path: '/seksi', label: 'Seksi', icon: Layers },
  { path: '/anggota',   label: 'Anggota',           icon: Users2,  roles: ['super_admin'] as const },
  { path: '/aktivitas', label: 'Riwayat Aktivitas', icon: History, roles: ['super_admin'] as const },
  { path: '/agent',     label: 'AI Agent',          icon: Bot,     roles: ['super_admin'] as const },
];

export function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollYRef = useRef(0);
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const canShow = (item: typeof navItems[number]) => {
    if (!item.roles) return true;
    if (!profile) return false;
    return (item.roles as readonly string[]).includes(profile.role);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  // Close sidebar on mobile when navigating
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Kunci scroll body saat drawer terbuka.
  // Teknik position:fixed + top negatif adalah satu-satunya cara yang bekerja
  // secara konsisten di iOS Safari — overflow:hidden pada body diabaikan oleh
  // Safari ketika dokumen sudah punya scroll position aktif.
  useEffect(() => {
    if (sidebarOpen) {
      scrollYRef.current = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollYRef.current}px`;
      document.body.style.width = '100%';
    } else {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollYRef.current);
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-[280px] shrink-0 flex-col bg-surface border-r border-border/60 sticky top-0 h-screen">
        <div className="h-[64px] px-6 flex items-center gap-3 border-b border-border/60">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white font-heading font-bold">RM6</div>
          <div>
            <div className="font-heading font-bold text-[15px] leading-none">Codex — RAMA 6</div>
            <div className="text-[11px] text-text-secondary tracking-wide">Raudhatul Ma'arif 6</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.filter(canShow).map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative',
                isActive ? 'bg-primary text-white shadow-sm' : 'text-text-secondary hover:text-text-primary hover:bg-background'
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* Islam pattern footer */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 islamic-pattern opacity-30" />
          <div className="relative p-4 border-t border-border/60">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                {profile?.nama_lengkap?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{profile?.nama_lengkap}</div>
                <div className="text-xs text-text-secondary flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  {profile?.role === 'super_admin' ? 'Super Admin' : profile?.role === 'guru_super' ? 'Guru Super' : 'Guru'} • {profile?.status}
                </div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => navigate('/profil')} className="btn-secondary text-xs py-2">
                <Settings className="w-4 h-4" /> Profil
              </button>
              <button onClick={handleLogout} className="btn-ghost text-xs py-2 border border-border rounded-xl">
                <LogOut className="w-4 h-4" /> Keluar
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay — portal ke document.body agar fixed positioning
          benar-benar terhadap viewport, bukan terhadap ancestor yang mungkin
          memiliki transform aktif (termasuk motion.div page-transition). */}
      {createPortal(
        <>
          {/* Backdrop */}
          <div
            className={`lg:hidden fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity ${
              sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={() => setSidebarOpen(false)}
          />
          {/* Panel drawer */}
          <motion.aside
            initial={false}
            animate={{ x: sidebarOpen ? 0 : -320 }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="lg:hidden fixed inset-y-0 left-0 z-50 w-[300px] overflow-hidden bg-surface border-r border-border/60 flex flex-col"
          >
            <div className="h-[64px] px-6 flex items-center justify-between border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white font-heading font-bold">RM6</div>
                <div>
                  <div className="font-heading font-bold text-[15px] leading-none">Codex — RAMA 6</div>
                  <div className="text-[11px] text-text-secondary">Raudhatul Ma'arif 6</div>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-xl hover:bg-background"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 py-4 px-3 space-y-1">
              {navItems.filter(canShow).map(item => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium',
                    isActive ? 'bg-primary text-white' : 'text-text-secondary hover:text-text-primary hover:bg-background'
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              ))}
            </div>
            <div className="shrink-0 p-4 border-t border-border/60">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                  {profile?.nama_lengkap?.charAt(0)?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{profile?.nama_lengkap}</div>
                  <div className="text-xs text-text-secondary">{profile?.role}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => { navigate('/profil'); setSidebarOpen(false); }} className="btn-secondary text-xs py-2">
                  <Settings className="w-4 h-4" /> Profil
                </button>
                <button onClick={handleLogout} className="btn-ghost text-xs py-2 border rounded-xl">
                  <LogOut className="w-4 h-4" /> Keluar
                </button>
              </div>
            </div>
          </motion.aside>
        </>,
        document.body
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile Topbar */}
        <header className="lg:hidden h-[64px] bg-surface border-b border-border/60 flex items-center justify-between px-4 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl hover:bg-background">
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-heading font-bold">Codex — RAMA 6</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
            {profile?.nama_lengkap?.charAt(0)?.toUpperCase()}
          </div>
        </header>

        <GlobalRealtimeSync />
        <OfflineBanner />

        <main className="flex-1 p-4 lg:p-8 max-w-[1400px] w-full mx-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </main>

        {/* Mobile Bottom Nav — disembunyikan sepenuhnya saat drawer terbuka */}
        <nav className={`lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-surface/90 backdrop-blur-xl border-t border-border/60 px-2 py-2 ${sidebarOpen ? 'invisible pointer-events-none' : ''}`}>
          <div className="grid grid-cols-5 gap-1">
            {navItems.slice(0, 4).filter(canShow).map(item => (
              <NavLink key={item.path} to={item.path} className={({ isActive }) => cn('flex flex-col items-center justify-center py-2 rounded-xl text-[11px] font-medium', isActive ? 'text-primary bg-primary/10' : 'text-text-secondary')}>
                <item.icon className="w-5 h-5 mb-1" />
                {item.label}
              </NavLink>
            ))}
            <NavLink to="/seksi" className={({ isActive }) => cn('flex flex-col items-center justify-center py-2 rounded-xl text-[11px] font-medium', isActive ? 'text-primary bg-primary/10' : 'text-text-secondary')}>
              <Layers className="w-5 h-5 mb-1" />
              Seksi
            </NavLink>
          </div>
        </nav>
        <div className="lg:hidden h-[72px]" /> {/* spacer for bottom nav */}
      </div>
    </div>
  );
}
