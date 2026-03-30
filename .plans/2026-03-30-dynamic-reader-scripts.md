# Plan: Dynamic Reader Scripts from Database

**Date**: 2026-03-30
**Status**: Draft

## Objective

Move reader scripts (the JS that scrapes each platform — Gmail, WhatsApp, Slack, etc.) from hardcoded `handler.js` into the `twin_domains` database table. The extension fetches scripts from the API and executes them dynamically. This allows updating scrapers without rebuilding/redeploying the extension.

## Features

### Feature 1: Database Migration — Add `reader_script` Column

**Small Win**: WhatsApp reader script stored in DB and queryable via SQL.
**DOD**:
- [ ] Migration adds `reader_script` TEXT column to `twin_domains`
- [ ] All existing reader scripts from `handler.js` seeded into DB
- [ ] Migration applied successfully

#### Tasks
- [ ] Create migration `20260330000007_twin_domains_reader_scripts.sql`
- [ ] Add `reader_script` TEXT column (nullable — not all domains need scripts)
- [ ] INSERT/UPDATE each domain's reader script from current `handler.js` READERS object
- [ ] Apply migration via Supabase

### Feature 2: Go API — Return Scripts in `/twin/domains`

**Small Win**: API response includes `reader_script` field for each domain.
**DOD**:
- [ ] `/twin/domains` returns `reader_script` in JSON response
- [ ] Scripts returned as strings ready for execution
- [ ] Tested with curl

#### Tasks
- [ ] Update `DomainRow` struct in `server.go` to include `ReaderScript`
- [ ] Update SQL query in `HandleDomains` to select `reader_script`
- [ ] Update JSON response to include `reader_script`
- [ ] Rebuild Go binary and test

### Feature 3: Extension — Execute Dynamic Scripts

**Small Win**: Extension uses DB scripts instead of hardcoded READERS, WhatsApp works.
**DOD**:
- [ ] Extension fetches and caches reader scripts from API
- [ ] `doRead()` executes the dynamic script instead of hardcoded READERS
- [ ] Fallback to hardcoded READERS if API script is null/empty
- [ ] WhatsApp read works end-to-end with DB script

#### Tasks
- [ ] Update `loadDomains()` in popup.js to cache scripts alongside domain metadata
- [ ] Update `doRead()` in handler.js to use dynamic script from API
- [ ] Keep hardcoded READERS as fallback for offline/error cases
- [ ] Test WhatsApp, Gmail, GitHub readers work from DB scripts

## Technical Notes

- Scripts stored as plain JS function bodies (the content inside `() => { ... }`)
- Extension uses `new Function(scriptBody)()` or wraps in an IIFE for execution
- Cache scripts in `chrome.storage.session` alongside domain metadata (same 5-min TTL)
- Security: scripts come from our own API, not user input — safe to execute
- The `reader_script` column is TEXT with no size limit for complex scrapers
