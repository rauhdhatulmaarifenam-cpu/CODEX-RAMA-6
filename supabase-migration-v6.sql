-- ============================================================
-- Codex — RAMA 6 — Migration v6
-- Tiga perubahan:
--   1. Aktifkan kembali RLS pada tabel profiles
--   2. Pastikan semua policy profiles masih ada persis seperti aslinya
--   3. Trigger otomatis buat profil saat pengguna baru terdaftar
--
-- AMAN untuk data yang sudah ada:
--   • ALTER TABLE ... ENABLE ROW LEVEL SECURITY tidak mengubah baris apapun.
--   • Setiap CREATE POLICY dibungkus IF NOT EXISTS — hanya buat yang hilang.
--   • Trigger ON INSERT auth.users hanya berjalan untuk pendaftaran BARU,
--     tidak menyentuh profil yang sudah ada.
--   • ON CONFLICT (id) DO NOTHING pada INSERT di trigger — idempotent,
--     aman dijalankan ulang.
--
-- Jalankan seluruh file ini di Supabase SQL Editor dalam satu batch.
-- ============================================================

-- ─── 1. Aktifkan kembali RLS pada tabel profiles ─────────────
-- Idempotent: sudah aktif = tidak ada perubahan.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


-- ─── 2. Pastikan semua policy profiles ada ───────────────────
-- Masing-masing dibungkus DO block untuk CREATE IF NOT EXISTS
-- karena PostgreSQL tidak mendukung "CREATE POLICY IF NOT EXISTS" secara langsung.

-- profiles_select
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_select'
  ) THEN
    CREATE POLICY "profiles_select" ON public.profiles
      FOR SELECT USING (is_active_user() OR is_super_admin());
  END IF;
END $$;

-- profiles_insert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_insert'
  ) THEN
    CREATE POLICY "profiles_insert" ON public.profiles
      FOR INSERT WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- profiles_update_own
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update_own'
  ) THEN
    CREATE POLICY "profiles_update_own" ON public.profiles
      FOR UPDATE USING (id = auth.uid());
  END IF;
END $$;

-- profiles_update_admin
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_update_admin'
  ) THEN
    CREATE POLICY "profiles_update_admin" ON public.profiles
      FOR UPDATE USING (is_super_admin());
  END IF;
END $$;

-- profiles_delete_admin
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'profiles_delete_admin'
  ) THEN
    CREATE POLICY "profiles_delete_admin" ON public.profiles
      FOR DELETE USING (is_super_admin());
  END IF;
END $$;


-- ─── 3. Trigger otomatis buat profil saat pendaftaran baru ───
-- Fungsi ini berjalan AFTER INSERT ON auth.users dengan SECURITY DEFINER
-- (melewati RLS) sehingga INSERT ke profiles selalu berhasil dari sisi server.
--
-- Garansi keamanan:
--   • role selalu dipaksa 'guru'   — tidak bisa diubah lewat metadata frontend.
--   • status selalu dipaksa 'aktif' — tidak bisa diubah lewat metadata frontend.
--   • Kalau nickname kosong (user dibuat manual via SQL/admin tanpa metadata),
--     trigger diam-diam diabaikan (RETURN NEW tanpa INSERT).
--   • ON CONFLICT (id) DO NOTHING — aman jika profil sudah ada.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nickname     text;
  v_nama_lengkap text;
BEGIN
  v_nickname     := trim(NEW.raw_user_meta_data->>'nickname');
  v_nama_lengkap := trim(NEW.raw_user_meta_data->>'nama_lengkap');

  -- Lewati jika nickname kosong (akun dibuat tanpa metadata, misal via dashboard)
  IF v_nickname IS NULL OR v_nickname = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (id, nickname, nama_lengkap, role, status)
  VALUES (
    NEW.id,
    v_nickname,
    COALESCE(NULLIF(v_nama_lengkap, ''), v_nickname),
    'guru',    -- role SELALU 'guru', tidak bisa di-override dari metadata frontend
    'aktif'    -- status SELALU 'aktif', tidak bisa di-override dari metadata frontend
  )
  ON CONFLICT (id) DO NOTHING;  -- idempotent: profil sudah ada = tidak ada perubahan

  RETURN NEW;
END;
$$;

-- Hapus dan buat ulang trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- DIAGNOSTIK: Akun auth.users tanpa baris profiles terkait
-- Jalankan SELECT di bawah ini secara TERPISAH di SQL Editor
-- (READ ONLY — tidak mengubah data apapun) untuk memeriksa apakah
-- ada percobaan sign up lama yang gagal membuat profil.
-- Laporkan hasilnya sebelum mengambil tindakan apapun.
-- ============================================================
/*
SELECT
  au.id,
  au.email,
  au.raw_user_meta_data->>'nickname'     AS nickname_meta,
  au.raw_user_meta_data->>'nama_lengkap' AS nama_meta,
  au.created_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL
ORDER BY au.created_at DESC;
*/
