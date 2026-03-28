# Request: Use Official Supabase Laravel Package

**Date**: 2026-03-28 10:45
**Status**: Pending
**Context**: Fixing auth/UUID mismatch issues between Laravel users and Supabase auth.users

## User Request
Replace the custom auth sync (SupabaseAuthService, manual UUID management) with the official Supabase Laravel package for authentication. This would:
- Use Supabase GoTrue as the primary auth provider
- Eliminate the dual-user-system problem (Laravel users table vs auth.users)
- Use auth.users UUIDs natively — no more integer/UUID mismatch
- Simplify the auth flow across Laravel + Studio + Go MCP server

## Package
- `supabase/auth-laravel` or check https://github.com/supabase/auth-helpers
- Search for latest official Laravel integration

## Why
The current architecture has Laravel's `users` table with integer IDs and Supabase's `auth.users` with UUIDs. Every query to Orchestra tables (organizations, mcp_tokens, team_members) needs UUID conversion. This causes constant bugs. Using Supabase as the sole auth provider eliminates this entirely.
