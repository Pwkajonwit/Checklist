import { createClient } from '@supabase/supabase-js'

/**
 * Supabase client ที่ใช้ service role key (bypass RLS)
 * ใช้ใน API Routes (server-side) เท่านั้น — ห้ามนำไปใช้ฝั่ง client
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      '[supabase/service] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    )
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
