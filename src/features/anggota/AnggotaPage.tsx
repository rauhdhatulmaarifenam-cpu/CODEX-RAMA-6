import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { TableWrapper, TableHeader, TableHead, TableBody, TableCell } from '../../components/Table';
import { Button } from '../../components/Button';
import { TableSkeleton } from '../../components/Skeleton';
import { Search, Shield, Trash2, AlertTriangle, KeyRound } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { toast } from 'sonner';
import type { Profile } from '../../types';
import { useAuth } from '../auth/AuthContext';

export function AnggotaPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Profile | null>(null);
  const [actionType, setActionType] = useState<'role'|'status'|'delete'|null>(null);
  const [newRole, setNewRole] = useState<string>('guru');
  const qc = useQueryClient();
  const { profile: currentUser } = useAuth();

  // ── Reset Seed state ────────────────────────────────────────
  const [resetTarget,   setResetTarget]   = useState<Profile | null>(null);
  const [resetSeedVal,  setResetSeedVal]  = useState('');
  const [resetConfirm,  setResetConfirm]  = useState('');
  const [resetLoading,  setResetLoading]  = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['profiles', search],
    queryFn: async () => {
      let q = supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (search) q = q.or(`nama_lengkap.ilike.%${search}%,nickname.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data as Profile[];
    }
  });

  const handleRoleChange = async () => {
    if (!selected) return;
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', selected.id);
    if (error) toast.error(error.message);
    else { toast.success('Role diperbarui'); qc.invalidateQueries({ queryKey: ['profiles'] }); setActionType(null); setSelected(null); }
  };

  const handleStatusToggle = async () => {
    if (!selected) return;
    const newStatus = selected.status === 'aktif' ? 'nonaktif' : 'aktif';
    const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', selected.id);
    if (error) toast.error(error.message);
    else { toast.success(`Akun ${newStatus === 'aktif' ? 'diaktifkan' : 'dinonaktifkan'}`); qc.invalidateQueries({ queryKey: ['profiles'] }); setActionType(null); setSelected(null); }
  };

  const handleDelete = async () => {
    if (!selected) return;
    const { error } = await supabase.from('profiles').delete().eq('id', selected.id);
    if (error) toast.error(error.message);
    else { toast.success('Akun dihapus'); qc.invalidateQueries({ queryKey: ['profiles'] }); setActionType(null); setSelected(null); }
  };

  const handleResetSeed = async () => {
    if (!resetTarget) return;
    if (resetSeedVal.length < 6) {
      toast.error('Seed minimal 6 karakter');
      return;
    }
    if (resetSeedVal !== resetConfirm) {
      toast.error('Konfirmasi seed tidak cocok');
      return;
    }
    setResetLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-guru-seed', {
        body: { userId: resetTarget.id, newSeed: resetSeedVal },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Seed @${resetTarget.nickname} berhasil direset`);
      setResetTarget(null);
      setResetSeedVal('');
      setResetConfirm('');
    } catch (e: any) {
      toast.error(e.message || 'Gagal mereset seed');
    } finally {
      setResetLoading(false);
    }
  };

  const closeReset = () => {
    setResetTarget(null);
    setResetSeedVal('');
    setResetConfirm('');
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2"><Shield className="w-6 h-6 text-primary" /> Kelola Anggota</h1>
        <p className="text-sm text-text-secondary">Hanya super admin yang bisa mengakses halaman ini. Kelola role, status, dan hapus akun.</p>
      </div>

      <div className="relative max-w-md">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nickname atau nama..." className="input-field pl-10" />
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900 flex gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
        <div>Pastikan ada minimal 2 Super Admin aktif sebelum menurunkan peran atau menonaktifkan salah satunya. Sistem akan menolak jika Super Admin terakhir dihapus atau dinonaktifkan.</div>
      </div>

      {isLoading ? <TableSkeleton /> : (
        <TableWrapper>
          <TableHeader>
            <TableHead>Nickname</TableHead>
            <TableHead>Nama Lengkap</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Tgl Join</TableHead>
            <TableHead>Aksi</TableHead>
          </TableHeader>
          <TableBody>
            {data?.map(p => (
              <tr key={p.id} className="hover:bg-background/60">
                <TableCell className="font-medium">@{p.nickname}</TableCell>
                <TableCell>{p.nama_lengkap}</TableCell>
                <TableCell><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${p.role==='super_admin' ? 'bg-purple-50 text-purple-700 border border-purple-200' : p.role==='guru_super' ? 'bg-blue-50 text-blue-700' : 'bg-border text-text-secondary'}`}>{p.role}</span></TableCell>
                <TableCell><span className={`px-2 py-1 rounded-full text-xs ${p.status==='aktif'?'bg-emerald-50 text-emerald-700':'bg-red-50 text-danger'}`}>{p.status}</span></TableCell>
                <TableCell className="text-xs text-text-secondary">{new Date(p.created_at).toLocaleDateString('id-ID')}</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    <Button variant="secondary" size="sm" onClick={() => { setSelected(p); setNewRole(p.role); setActionType('role'); }}>Role</Button>
                    <Button variant="secondary" size="sm" onClick={() => { setSelected(p); setActionType('status'); }} disabled={currentUser?.id===p.id && p.role==='super_admin'}>{p.status==='aktif'?'Nonaktifkan':'Aktifkan'}</Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      title="Reset Seed"
                      onClick={() => { setResetTarget(p); setResetSeedVal(''); setResetConfirm(''); }}
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-danger hover:bg-red-50" onClick={() => { setSelected(p); setActionType('delete'); }}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </TableCell>
              </tr>
            ))}
          </TableBody>
        </TableWrapper>
      )}

      {/* Role Modal */}
      <Modal open={actionType==='role'} onOpenChange={o=>!o&&setActionType(null)} title="Ubah Role" description={`Ubah role untuk ${selected?.nama_lengkap} (@${selected?.nickname})`}>
        <div className="space-y-4">
          <select value={newRole} onChange={e=>setNewRole(e.target.value)} className="input-field">
            <option value="guru">Guru</option>
            <option value="guru_super">Guru Super (bisa hapus data)</option>
            <option value="super_admin">Super Admin (full akses)</option>
          </select>
          <p className="text-xs text-text-secondary">Anda bisa memberikan peran Super Admin ke beberapa akun sekaligus tanpa mengubah peran Anda sendiri.</p>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={()=>setActionType(null)}>Batal</Button><Button onClick={handleRoleChange}>Simpan role</Button></div>
        </div>
      </Modal>

      {/* Status Modal */}
      <Modal open={actionType==='status'} onOpenChange={o=>!o&&setActionType(null)} title={`${selected?.status==='aktif'?'Nonaktifkan':'Aktifkan'} Akun`}>
        <div className="space-y-4">
          <p className="text-sm">Yakin ingin {selected?.status==='aktif'?'menonaktifkan':'mengaktifkan'} akun <strong>{selected?.nama_lengkap}</strong>? {selected?.status==='aktif' ? 'Akun nonaktif akan otomatis logout dan tidak bisa login.' : ''}</p>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={()=>setActionType(null)}>Batal</Button><Button variant={selected?.status==='aktif'?'danger':'primary'} onClick={handleStatusToggle}>{selected?.status==='aktif'?'Nonaktifkan':'Aktifkan'}</Button></div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal open={actionType==='delete'} onOpenChange={o=>!o&&setActionType(null)} title="Hapus Akun Permanen" description="Tindakan ini sangat berbahaya dan tidak bisa dibatalkan.">
        <div className="space-y-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-danger">
            Anda akan menghapus akun <strong>{selected?.nama_lengkap} (@{selected?.nickname})</strong> secara permanen. Semua data profil yang terkait akan terhapus. Penghapusan akan ditolak jika ini adalah satu-satunya Super Admin aktif.
          </div>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={()=>setActionType(null)}>Batal</Button><Button variant="danger" onClick={handleDelete}>Hapus permanen</Button></div>
        </div>
      </Modal>

      {/* Reset Seed Modal */}
      <Modal
        open={!!resetTarget}
        onOpenChange={o => !o && closeReset()}
        title="Reset Seed"
        description={`Ganti seed login untuk @${resetTarget?.nickname} (${resetTarget?.nama_lengkap}). Pengguna harus login ulang setelah ini.`}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Seed Baru <span className="text-text-secondary font-normal">(min. 6 karakter)</span></label>
            <input
              type="password"
              value={resetSeedVal}
              onChange={e => setResetSeedVal(e.target.value)}
              className="input-field"
              placeholder="Masukkan seed baru"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Konfirmasi Seed Baru</label>
            <input
              type="password"
              value={resetConfirm}
              onChange={e => setResetConfirm(e.target.value)}
              className="input-field"
              placeholder="Ulangi seed baru"
              autoComplete="new-password"
            />
            {resetConfirm && resetSeedVal !== resetConfirm && (
              <p className="text-xs text-danger mt-1">Seed tidak cocok</p>
            )}
          </div>
          <p className="text-xs text-text-secondary">
            Seed disetel ulang menggunakan Edge Function yang berjalan di server Supabase.
            Nilai seed baru tidak disimpan di kode maupun log frontend.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeReset} disabled={resetLoading}>Batal</Button>
            <Button
              onClick={handleResetSeed}
              loading={resetLoading}
              disabled={!resetSeedVal || resetSeedVal !== resetConfirm}
            >
              Reset Seed
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
