import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Cron: Agent Trigger
 *
 * Scans for tasks in 'todo' status that have an assigned agent
 * and logs trigger events to the activity_log. This acts as the
 * entry point for automated agent task execution.
 *
 * Picks up to 10 tasks per invocation, ordered by priority.
 * Intended to run on a schedule (e.g. every minute via pg_cron
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

  // Fetch pending tasks that have an assigned agent
  const { data: tasks, error: fetchError } = await supabase
    .from('tasks')
    .select('id, title, assigned_agent_id, project_id, organization_id, priority')
    .eq('status', 'todo')
    .not('assigned_agent_id', 'is', null)
    .order('priority', { ascending: true })
    .limit(10)

  if (fetchError) {
    console.error('Failed to fetch pending tasks:', fetchError)
    return new Response(
      JSON.stringify({ error: fetchError.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  if (!tasks || tasks.length === 0) {
    return new Response(
      JSON.stringify({ triggered: 0 }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  let triggered = 0

  for (const task of tasks) {
    const { error: logError } = await supabase.from('activity_log').insert({
      organization_id: task.organization_id,
      action: 'agent_triggered',
      summary: `Auto-triggered task: ${task.title}`,
      task_id: task.id,
      agent_id: task.assigned_agent_id,
      details: {
        project_id: task.project_id,
        priority: task.priority,
        triggered_at: new Date().toISOString(),
      },
    })

    if (logError) {
      console.error(`Failed to log trigger for task ${task.id}:`, logError)
      continue
    }

    triggered++
  }

  console.log(`Agent trigger: ${triggered}/${tasks.length} tasks triggered`)

  return new Response(
    JSON.stringify({ triggered, total_pending: tasks.length }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  )
})
