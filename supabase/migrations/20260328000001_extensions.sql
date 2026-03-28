-- 20260328000001_extensions.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Organization plans
DO $$ BEGIN
    CREATE TYPE org_plan AS ENUM ('free', 'pro', 'team', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Team roles
DO $$ BEGIN
    CREATE TYPE team_role AS ENUM ('owner', 'admin', 'member', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Agent types
DO $$ BEGIN
    CREATE TYPE agent_type AS ENUM ('person', 'ai');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Task types
DO $$ BEGIN
    CREATE TYPE task_type AS ENUM ('epic', 'feature', 'task', 'bug', 'subtask');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Task status
DO $$ BEGIN
    CREATE TYPE task_status AS ENUM (
        'backlog', 'todo', 'in_progress', 'blocked',
        'in_review', 'done', 'cancelled'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Task priority
DO $$ BEGIN
    CREATE TYPE task_priority AS ENUM ('critical', 'high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Memory source
DO $$ BEGIN
    CREATE TYPE memory_source AS ENUM (
        'conversation', 'task', 'decision', 'document',
        'code_review', 'meeting', 'learning', 'spec'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Other enums
DO $$ BEGIN CREATE TYPE project_status AS ENUM ('active', 'archived', 'paused'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE agent_status AS ENUM ('active', 'inactive', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE session_status AS ENUM ('active', 'idle', 'blocked', 'offline'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE spec_status AS ENUM ('draft', 'review', 'approved', 'archived'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE skill_proficiency AS ENUM ('basic', 'standard', 'expert'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE dependency_type AS ENUM ('blocks', 'relates_to'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Global updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
