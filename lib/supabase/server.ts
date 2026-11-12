import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

export function createSupabaseServerClient(
  getToken: () => Promise<string | null>,
) {
  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    accessToken: getToken,
  });
}

export function createSupabaseAdminClient() {
  return createClient(env.supabaseUrl, env.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
