// Edge Function: reset-guru-seed
// Dirancang untuk dijalankan di Supabase Edge Runtime (Deno).
//
// PENTING — Sebelum fungsi ini bisa digunakan:
//   1. Deploy fungsi ini via Supabase CLI: supabase functions deploy reset-guru-seed
//      atau via Supabase Dashboard > Edge Functions > New Function.
//   2. Di Supabase Dashboard > Edge Functions > reset-guru-seed > Secrets,
//      tambahkan secret: SUPABASE_SERVICE_ROLE_KEY = <nilai service role key Anda>.
//      JANGAN pernah menuliskan nilai aslinya di sini atau di file manapun dalam proyek.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl      = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey  = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // ── Langkah 1: Verifikasi identitas pemanggil dengan token mereka sendiri ──
    // Gunakan anon key + token caller untuk memastikan token valid dan belum expired.
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth:   { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Token tidak valid atau sudah kedaluwarsa' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Langkah 2: Cek role & status dari tabel profiles (tidak percaya klaim token) ──
    // Token JWT bisa saja berisi klaim role yang sudah basi (dibuat sebelum role diubah).
    // Satu-satunya sumber kebenaran adalah tabel profiles di database.
    const { data: callerProfile, error: profileError } = await callerClient
      .from('profiles')
      .select('role, status')
      .eq('id', caller.id)
      .single();

    if (profileError || !callerProfile) {
      return new Response(
        JSON.stringify({ error: 'Tidak bisa memverifikasi profil pemanggil' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (callerProfile.role !== 'super_admin' || callerProfile.status !== 'aktif') {
      return new Response(
        JSON.stringify({ error: 'Akses ditolak: hanya super_admin aktif yang dapat mereset seed' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Langkah 3: Validasi body request ────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const { userId, newSeed } = body as { userId?: string; newSeed?: string };

    if (!userId || typeof userId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'userId wajib diisi' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!newSeed || typeof newSeed !== 'string' || newSeed.length < 6) {
      return new Response(
        JSON.stringify({ error: 'newSeed wajib diisi dan minimal 6 karakter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Pastikan super_admin tidak bisa me-reset akun super_admin lain via endpoint ini
    // (bisa diatur lebih ketat jika dibutuhkan — saat ini dibiarkan fleksibel)

    // ── Langkah 4: Gunakan service role untuk update password target ────────────
    // Service role hanya dipakai di sini, setelah verifikasi super_admin selesai.
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      password: newSeed,
    });

    if (updateError) {
      return new Response(
        JSON.stringify({ error: `Gagal mengubah seed: ${updateError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Seed berhasil direset' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message ?? 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
