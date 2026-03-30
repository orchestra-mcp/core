-- ==========================================================================
-- Shared Documents — enables desktop "Share" feature
-- Users can share markdown documents via public/private/team links
-- ==========================================================================

CREATE TABLE IF NOT EXISTS shared_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    created_by UUID NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    file_type TEXT DEFAULT 'generic',
    visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('public', 'private', 'team')),
    share_token TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE,
    password_hash TEXT,
    expires_at TIMESTAMPTZ,
    view_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX idx_shared_documents_token ON shared_documents(share_token);
CREATE INDEX idx_shared_documents_slug ON shared_documents(slug);
CREATE INDEX idx_shared_documents_org ON shared_documents(organization_id);
CREATE INDEX idx_shared_documents_created_by ON shared_documents(created_by);
CREATE INDEX idx_shared_documents_visibility ON shared_documents(visibility);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shared_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_shared_documents_updated_at
    BEFORE UPDATE ON shared_documents
    FOR EACH ROW
    EXECUTE FUNCTION update_shared_documents_updated_at();

-- ==========================================================================
-- Row Level Security
-- ==========================================================================

ALTER TABLE shared_documents ENABLE ROW LEVEL SECURITY;

-- Public documents viewable by anyone (including anonymous)
CREATE POLICY "Public documents viewable by anyone" ON shared_documents
    FOR SELECT USING (visibility = 'public');

-- Team documents viewable by org members
CREATE POLICY "Team documents viewable by org members" ON shared_documents
    FOR SELECT USING (
        visibility = 'team' AND
        organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    );

-- Private documents viewable by anyone who has the token (handled at app layer)
-- We allow SELECT for private docs so the app can look them up by token
CREATE POLICY "Private documents viewable by token" ON shared_documents
    FOR SELECT USING (visibility = 'private');

-- Creators can manage (insert, update, delete) their own documents
CREATE POLICY "Creators can manage their documents" ON shared_documents
    FOR ALL USING (created_by = auth.uid());

-- ==========================================================================
-- Increment view count function (callable via RPC)
-- ==========================================================================

CREATE OR REPLACE FUNCTION increment_shared_document_views(doc_token TEXT)
RETURNS void AS $$
BEGIN
    UPDATE shared_documents
    SET view_count = view_count + 1
    WHERE share_token = doc_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
