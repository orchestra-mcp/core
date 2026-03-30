-- =============================================================================
-- Notifications table for Orchestra MCP
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    organization_id UUID,
    type TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    body TEXT,
    action_url TEXT,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE notifications IS 'User notifications delivered via Supabase Realtime';
COMMENT ON COLUMN notifications.type IS 'info | success | warning | error | task_assigned | task_completed | agent_online | agent_offline | mention | system';

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_created ON notifications(user_id, created_at DESC);

-- Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications"
    ON notifications FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users update own notifications"
    ON notifications FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users delete own notifications"
    ON notifications FOR DELETE
    USING (user_id = auth.uid());

-- Service role can insert notifications (from Go MCP server / Edge Functions)
CREATE POLICY "Service role inserts notifications"
    ON notifications FOR INSERT
    WITH CHECK (true);

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
