-- 20260328000009_functions.sql

-- ── Vector memory search ──
CREATE OR REPLACE FUNCTION public.search_memory(
    query_embedding vector(1536),
    p_org_id UUID,
    match_count INT DEFAULT 10,
    match_threshold FLOAT DEFAULT 0.7,
    p_agent_id UUID DEFAULT NULL,
    p_project_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    summary TEXT,
    source memory_source,
    title TEXT,
    tags TEXT[],
    similarity FLOAT,
    created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id, m.content, m.summary, m.source, m.title, m.tags,
        1 - (m.embedding <=> query_embedding) AS similarity,
        m.created_at
    FROM public.memories m
    WHERE m.organization_id = p_org_id
        AND (p_agent_id IS NULL OR m.agent_id = p_agent_id)
        AND (p_project_id IS NULL OR m.project_id = p_project_id)
        AND 1 - (m.embedding <=> query_embedding) > match_threshold
        AND (m.expires_at IS NULL OR m.expires_at > now())
    ORDER BY m.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ── Search decisions ──
CREATE OR REPLACE FUNCTION public.search_decisions(
    query_embedding vector(1536),
    p_org_id UUID,
    match_count INT DEFAULT 5,
    p_project_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    decision TEXT,
    context TEXT,
    alternatives TEXT,
    outcome TEXT,
    similarity FLOAT,
    created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id, d.title, d.decision, d.context, d.alternatives, d.outcome,
        1 - (d.embedding <=> query_embedding) AS similarity,
        d.created_at
    FROM public.decisions d
    WHERE d.organization_id = p_org_id
        AND (p_project_id IS NULL OR d.project_id = p_project_id)
        AND d.embedding IS NOT NULL
    ORDER BY d.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ── Team activity summary ──
CREATE OR REPLACE FUNCTION public.get_team_activity(
    p_org_id UUID,
    p_hours INT DEFAULT 24
)
RETURNS TABLE (
    user_id UUID,
    total_actions BIGINT,
    tasks_completed BIGINT,
    tasks_started BIGINT,
    blockers BIGINT,
    last_action_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        al.user_id,
        COUNT(*) AS total_actions,
        COUNT(*) FILTER (WHERE al.action = 'completed') AS tasks_completed,
        COUNT(*) FILTER (WHERE al.action = 'started') AS tasks_started,
        COUNT(*) FILTER (WHERE al.action = 'blocked') AS blockers,
        MAX(al.created_at) AS last_action_at
    FROM public.activity_log al
    WHERE al.organization_id = p_org_id
        AND al.created_at > now() - (p_hours || ' hours')::INTERVAL
    GROUP BY al.user_id;
END;
$$;

-- ── Get next unblocked task by priority ──
CREATE OR REPLACE FUNCTION public.get_next_task(
    p_org_id UUID,
    p_agent_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_project_id UUID DEFAULT NULL
)
RETURNS SETOF public.tasks
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT t.*
    FROM public.tasks t
    WHERE t.organization_id = p_org_id
        AND t.status IN ('todo', 'backlog')
        AND (p_agent_id IS NULL OR t.assigned_agent_id = p_agent_id)
        AND (p_user_id IS NULL OR t.assigned_user_id = p_user_id)
        AND (p_project_id IS NULL OR t.project_id = p_project_id)
        AND NOT EXISTS (
            SELECT 1 FROM public.task_dependencies td
            JOIN public.tasks bt ON bt.id = td.depends_on_id
            WHERE td.task_id = t.id AND td.type = 'blocks'
            AND bt.status NOT IN ('done', 'cancelled')
        )
    ORDER BY
        CASE t.priority
            WHEN 'critical' THEN 0
            WHEN 'high' THEN 1
            WHEN 'medium' THEN 2
            WHEN 'low' THEN 3
        END,
        t.created_at ASC
    LIMIT 1;
END;
$$;

-- ── Project progress stats ──
CREATE OR REPLACE FUNCTION public.get_project_progress(p_project_id UUID)
RETURNS TABLE (
    total_tasks BIGINT,
    completed BIGINT,
    in_progress BIGINT,
    blocked BIGINT,
    backlog BIGINT,
    completion_pct FLOAT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) AS total_tasks,
        COUNT(*) FILTER (WHERE t.status = 'done') AS completed,
        COUNT(*) FILTER (WHERE t.status = 'in_progress') AS in_progress,
        COUNT(*) FILTER (WHERE t.status = 'blocked') AS blocked,
        COUNT(*) FILTER (WHERE t.status IN ('backlog', 'todo')) AS backlog,
        CASE WHEN COUNT(*) > 0
            THEN ROUND((COUNT(*) FILTER (WHERE t.status = 'done'))::NUMERIC / COUNT(*)::NUMERIC * 100, 1)
            ELSE 0
        END::FLOAT AS completion_pct
    FROM public.tasks t
    WHERE t.project_id = p_project_id;
END;
$$;

-- ── Stale session cleanup ──
CREATE OR REPLACE FUNCTION public.cleanup_stale_sessions()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.agent_sessions
    SET status = 'offline', ended_at = now()
    WHERE ended_at IS NULL
        AND last_heartbeat < now() - INTERVAL '10 minutes';
END;
$$;
