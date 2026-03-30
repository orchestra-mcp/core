# Request: Studio UI Round 3 Fixes

**Date**: 2026-03-28 19:00
**Status**: Pending
**Context**: Fixing Studio pages to match Supabase design patterns

## Issues Found (via browser screenshots)

### 1. Orchestra Logs page doesn't match PostgREST logs

- PostgREST logs: search bar + chart + simple rows + "Load older" footer + "Explore via query"
- Orchestra logs: custom tabs (All/Go MCP/Laravel/Orchestra) + custom table (TIME/SERVICE/LEVEL/MESSAGE/CONTEXT)
- They should use the SAME Supabase log viewer components
- Reference: http://localhost:8082/project/default/logs/postgrest-logs
- Current: http://localhost:8082/project/default/logs/orchestra-logs

### 2. Agent Detail page issues

- Stats all show 0 (queries still broken for individual agent stats)
- Tabs (Overview/Activity/Tasks/Skills/Sessions) don't use Supabase underlined tab pattern
- Title area layout doesn't match Supabase detail page patterns
- No PageSection spacing
- Reference: compare with any Supabase detail/settings page

### 3. Tokens toolbar buttons glued to table

- Filter input + API Docs + CLI Docs + Generate buttons sit directly on the table header
- Should be separated toolbar row between PageHeader and table (like Access Tokens page)
- Reference: http://localhost:8082/account/tokens (Access Tokens page)
- Current: http://localhost:8082/project/default/orchestra/tokens

## Browser Screenshots Taken

- PostgREST logs reference: ss_7794edurp
- Orchestra logs current: ss_6301s2to1
- Agent detail current: ss_9338nq5hz
- Tokens zoomed (buttons glued): zoom of header area
- Access Tokens reference: ss_2626v1h5s
