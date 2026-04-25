import { createClient as supabaseClient } from '@supabase/supabase-js'

let client = null

export function createClient() {
  if (!client) {
    client = supabaseClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  }
  return client
}
