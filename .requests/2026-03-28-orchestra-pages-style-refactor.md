# Request: Refactor Orchestra Pages to Use Native Supabase Studio Components

**Date**: 2026-03-28 11:30
**Status**: Pending
**Priority**: High

## Problem

The Orchestra pages (Dashboard, Agents, Tokens, Logs) use custom components that don't match the native Supabase Studio design. White cards, squished tabs, inconsistent spacing.

## Pages to Refactor

1. `/project/[ref]/orchestra/index.tsx` — Dashboard
2. `/project/[ref]/orchestra/agents.tsx` — Agents
3. `/project/[ref]/orchestra/tokens.tsx` — Tokens
4. `/project/[ref]/orchestra/logs.tsx` — Logs

## What to Change

- Use Supabase's `ScaffoldContainer`, `ScaffoldSection` for page layout (like Auth pages)
- Use `Table` from `ui` with proper dark theme (like Table Editor)
- Use native `Tabs` component with underline variant (like Database/Auth sidebar tabs)
- Use `Badge` with proper status colors matching existing Studio badges
- Use `MetricCard` from `ui-patterns` for dashboard stats
- Use `NoSearchResults` for empty states
- Match existing page styles: Auth Users, Database Tables, Edge Functions

## Reference Pages (match their style)

- `/project/[ref]/auth/users` — Table with users
- `/project/[ref]/database/tables` — Table editor
- `/project/[ref]/functions` — Function list with badges
- `/project/[ref]/settings/general` — Settings cards
