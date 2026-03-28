import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Cron: Session Cleanup
 *
 * Calls the cleanup_stale_sessions() database function to mark
 * agent sessions as 'disconnected' when their last heartbeat
 * exceeds the staleness threshold.
 *
 * Intended to run on a schedule (e.g. every 5 minutes via pg_cron
 * or Supabase cron triggers).
 */
Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const { error } = await supabase.rpc('cleanup_stale_sessions')

  if (error) {
    console.error('Session cleanup failed:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  const cleanedAt = new Date().toISOString()
  console.log(`Session cleanup completed at ${cleanedAt}`)

  return new Response(
    JSON.stringify({ success: true, cleaned_at: cleanedAt }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  )
})
