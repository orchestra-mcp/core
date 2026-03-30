---
name: orch-migrate
description: Create and apply Orchestra MCP database migrations. Use when writing new migration files, applying migrations to local Supabase, or debugging migration issues.
---

# Orchestra MCP — Database Migrations

## Migration Location

All migrations live in `/supabase/migrations/`.

## Naming Convention

```
YYYYMMDDHHMMSS_description.sql
```

Example: `20260328000001_extensions.sql`

## Applying Migrations

### Apply all migrations (ordered by filename)

```bash
for f in supabase/migrations/*.sql; do
  echo "Applying: $(basename $f)"
  PGPASSWORD=<password> psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -f "$f" --single-transaction
done
```

### Apply single migration

```bash
PGPASSWORD=<password> psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -f supabase/migrations/<file>.sql --single-transaction
```

### Get password from Docker .env

```bash
source docker/.env && echo $POSTGRES_PASSWORD
```

## Migration Patterns

### Idempotent table creation

```sql
create table if not exists public.my_table (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

### Idempotent enum creation

```sql
DO $$ BEGIN
    CREATE TYPE my_enum AS ENUM ('a', 'b', 'c');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

### Updated_at trigger

```sql
CREATE TRIGGER on_my_table_updated BEFORE UPDATE ON public.my_table
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### RLS enable + policy

```sql
ALTER TABLE public.my_table ENABLE ROW LEVEL SECURITY;
CREATE POLICY my_table_access ON public.my_table
    FOR ALL USING (organization_id IN (SELECT public.user_org_ids()));
```

### pgvector index

```sql
CREATE INDEX idx_my_table_embedding ON public.my_table
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

## Existing Migrations (from PRD)

| #   | File                       | Content                                                            |
| --- | -------------------------- | ------------------------------------------------------------------ |
| 001 | extensions.sql             | Extensions (uuid-ossp, vector, pg_trgm, pgcrypto) + all enum types |
| 002 | profiles_organizations.sql | profiles, organizations, teams, team_members                       |
| 003 | mcp_tokens.sql             | mcp_tokens + validate_mcp_token() function                         |
| 004 | projects_agents_skills.sql | projects, skills, agents, agent_skills                             |
| 005 | workflows_tasks.sql        | workflows, tasks, task_dependencies                                |
| 006 | memory_activity.sql        | memories, activity_log, decisions, agent_sessions                  |
| 007 | notes_specs_github.sql     | notes, specs, github_connections, project_repos                    |
| 008 | rls_policies.sql           | RLS on all tables + policies                                       |
| 009 | functions.sql              | search_memory, search_decisions, get_team_activity, etc.           |
| 010 | realtime_seeds.sql         | Realtime publications + workflow_templates seed                    |

## Verification

After applying, check in Supabase Studio table editor or:

```bash
PGPASSWORD=<password> psql -h 127.0.0.1 -p 5432 -U postgres -d postgres -c "\dt public.*"
```
