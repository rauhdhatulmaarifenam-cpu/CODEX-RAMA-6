-- ============================================================
-- Codex — RAMA 6 — Migration v4
-- Fitur baru: bucket foto-profil + tabel activity_log + triggers
--
-- Jalankan seluruh file ini di Supabase SQL Editor dalam satu batch.
-- ============================================================

-- ─── 1. Storage Bucket: foto-profil (TIDAK publik) ──────────
-- public = false memastikan tidak ada akses langsung via URL publik.
-- File hanya bisa diakses via signed URL yang dibuat oleh aplikasi.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'foto-profil',
  'foto-profil',
  false,          -- << BUKAN publik
  2097152,        -- 2 MB maksimum per file
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies untuk storage.objects — khusus bucket foto-profil
-- Pengecekan pola sama dengan tabel lain: user aktif yang sudah login.

CREATE POLICY "foto-profil: pengguna aktif bisa upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'foto-profil'
  AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'aktif'
  )
);

CREATE POLICY "foto-profil: pengguna aktif bisa lihat"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'foto-profil'
  AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'aktif'
  )
);

CREATE POLICY "foto-profil: pengguna aktif bisa update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'foto-profil'
  AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'aktif'
  )
);

CREATE POLICY "foto-profil: pengguna aktif bisa hapus"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'foto-profil'
  AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'aktif'
  )
);

-- ─── 2. Tabel: activity_log ──────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id       uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  actor_nickname text        NOT NULL,
  table_name     text        NOT NULL,
  record_id      uuid        NOT NULL,
  action         text        NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  record_label   text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_actor      ON activity_log (actor_id);

-- Aktifkan RLS
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Semua pengguna aktif boleh BACA untuk transparansi
CREATE POLICY "activity_log: pengguna aktif bisa baca"
ON activity_log FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND status = 'aktif'
  )
);

-- TIDAK ADA policy INSERT, UPDATE, atau DELETE dari aplikasi.
-- Satu-satunya cara tulis adalah melalui trigger log_activity() di bawah
-- yang berjalan sebagai SECURITY DEFINER, sehingga catatan tidak bisa
-- dimanipulasi siapapun — termasuk super_admin — lewat aplikasi.

-- ─── 3. Trigger function: log_activity() ─────────────────────
-- SECURITY DEFINER: fungsi ini berjalan dengan hak pemilik (postgres),
-- bukan dengan hak pemanggil, sehingga bisa INSERT ke activity_log
-- meski tidak ada policy insert untuk authenticated users.
CREATE OR REPLACE FUNCTION log_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id       uuid;
  v_actor_nickname text;
  v_record_id      uuid;
  v_record_label   text;
  v_action         text;
BEGIN
  -- Tentukan jenis operasi
  IF    TG_OP = 'INSERT' THEN v_action := 'insert'; v_record_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN v_action := 'update'; v_record_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN v_action := 'delete'; v_record_id := OLD.id;
  END IF;

  -- Ambil identitas pemanggil dari auth.uid() → profiles
  v_actor_id := auth.uid();
  SELECT nickname INTO v_actor_nickname FROM profiles WHERE id = v_actor_id;
  -- Fallback jika dipanggil di luar sesi user (misal: migration script)
  IF v_actor_nickname IS NULL THEN
    v_actor_nickname := 'system';
  END IF;

  -- Tentukan label rekaman berdasarkan nama tabel
  -- Label ini disalin sekarang supaya log tetap terbaca walau data aslinya
  -- kelak dihapus.
  IF TG_OP = 'DELETE' THEN
    CASE TG_TABLE_NAME
      WHEN 'santri' THEN v_record_label := OLD.nama_lengkap;
      WHEN 'guru'   THEN v_record_label := OLD.nama_lengkap;
      WHEN 'kelas'  THEN v_record_label := OLD.nama_kelas;
      WHEN 'seksi'  THEN v_record_label := OLD.nama_seksi;
      ELSE               v_record_label := OLD.id::text;
    END CASE;
  ELSE
    CASE TG_TABLE_NAME
      WHEN 'santri' THEN v_record_label := NEW.nama_lengkap;
      WHEN 'guru'   THEN v_record_label := NEW.nama_lengkap;
      WHEN 'kelas'  THEN v_record_label := NEW.nama_kelas;
      WHEN 'seksi'  THEN v_record_label := NEW.nama_seksi;
      ELSE               v_record_label := NEW.id::text;
    END CASE;
  END IF;

  INSERT INTO activity_log (actor_id, actor_nickname, table_name, record_id, action, record_label)
  VALUES (v_actor_id, v_actor_nickname, TG_TABLE_NAME, v_record_id, v_action, v_record_label);

  RETURN NULL; -- AFTER trigger: nilai kembalian tidak dipakai
END;
$$;

-- ─── 4. Pasang trigger ke empat tabel yang dipantau ──────────
CREATE TRIGGER trg_log_santri
  AFTER INSERT OR UPDATE OR DELETE ON santri
  FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER trg_log_guru
  AFTER INSERT OR UPDATE OR DELETE ON guru
  FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER trg_log_kelas
  AFTER INSERT OR UPDATE OR DELETE ON kelas
  FOR EACH ROW EXECUTE FUNCTION log_activity();

CREATE TRIGGER trg_log_seksi
  AFTER INSERT OR UPDATE OR DELETE ON seksi
  FOR EACH ROW EXECUTE FUNCTION log_activity();
