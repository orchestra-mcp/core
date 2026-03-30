# Request: Enable Pro/Platform Features in Self-Hosted Studio

**Date**: 2026-03-28 09:40
**Status**: Pending
**Context**: Working on Phase 2 (Auth & Onboarding)

## User Request

Enable all Supabase Pro/Platform features in self-hosted Orchestra Studio:

- Multi-org management (projects, teams, billing, org settings)
- Database backups (scheduled, PITR, restore)
- Auth full configuration (all sub-pages)
- Storage analytics, vectors, S3
- Realtime settings
- Observability full build
- Remove all "Upgrade to Pro" gates

## Notes

- 504 IS_PLATFORM checks across 196 files
- Most auth config pages already work — just need "Upgrade to Pro" text removed
- Multi-org needs platform API stubs built
- Backups need pg_dump integration
- No public fork exists that enables all features
- Will tackle after Phase 2 completion
