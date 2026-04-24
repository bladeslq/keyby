const { createClient: supabaseClient } = require('@supabase/supabase-js')

let client = null

function createClient() {
  if (!client) {
    client = supabaseClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  }
  return client
}

module.exports = { createClient }
