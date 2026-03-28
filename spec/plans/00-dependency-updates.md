# Dependency Updates — PRD v2 to Latest (March 2026)

All versions below are the latest stable as of March 28, 2026.

| Technology | PRD Version | Latest Version | Notes |
|---|---|---|---|
| **Laravel** | 11 | **13.2.0** | Released March 17, 2026. Zero breaking changes from 12. AI SDK, passkeys, vector search built-in. Requires PHP 8.3+ |
| **PHP** | 8.3 | **8.5.4** | PHP 8.5 GA since Nov 2025. Property hooks, pipe operator. 8.3 still supported but 8.5 recommended |
| **Livewire** | 3 | **4.2.2** | Released Jan 14, 2026. Single-file components, Islands, 60% fewer DOM updates, PHP 8.4 property hooks |
| **Go** | 1.22 | **1.26.2** | Released Feb 10, 2026. Green Tea GC default, 30% less cgo overhead, generic self-referencing types |
| **Node.js** | 20 LTS | **24.14.1 LTS** | Node 24 Active LTS (Krypton). Node 20 EOL April 2026 |
| **Tailwind CSS** | 4 | **4.2.0** | Released Feb 19, 2026. Webpack plugin, new colors (mauve, olive, mist, taupe), logical properties |
| **Redis** | 7 | **8.6.1** | Released Feb 23, 2026 |
| **Caddy** | (unspecified) | **2.11.2** | Global DNS config, wildcard certs by default, ACME profiles |
| **Vite** | (unspecified) | **8.0.3** | Released March 12, 2026. Rolldown bundler (Rust), 10-30x faster builds |
| **pgvector** | (unspecified) | **0.8.2** | CVE fix, halfvec/sparsevec support, up to 64K bit dimensions |
| **PostgreSQL** | (via Supabase) | **18.3** | Released Feb 26, 2026 |
| **Alpine.js** | (via Livewire) | **3.x (latest)** | Smoother dialog handling, x-anchor improvements |
| **Supabase** | self-hosted | **v1.26.03** | March 2026 developer update. 14.8x faster object listing |
| **Docker Compose** | (unspecified) | **2.29+** | Already installed locally |

## Key Migration Notes

### Laravel 11 -> 13
- Laravel 12 (Feb 2025) and 13 (March 2026) both had zero breaking changes
- Laravel 13 includes built-in AI SDK, passkey auth, vector search (may reduce custom code needed)
- Requires PHP 8.3 minimum, PHP 8.4+ recommended for Livewire 4

### Livewire 3 -> 4
- Single-file components (`.blade.php` with `<?php ?>` block) — optional, can still use class-based
- Islands architecture for independent DOM regions
- New diffing algorithm reduces DOM updates by 60%
- Requires Laravel 12+ and PHP 8.4+

### PHP 8.3 -> 8.5
- Property hooks (8.4) — native getters/setters
- Pipe operator (8.5) — `$x |> fn()` syntax
- Asymmetric visibility (8.4) — `public private(set)`

### Go 1.22 -> 1.26
- Green Tea GC enabled by default — lower latency
- 30% reduced cgo overhead
- Generic self-referencing types

### Node.js 20 -> 24
- Node 20 EOL April 2026 — must upgrade
- Node 24 LTS active through April 2028

### Vite (implied) -> 8.0
- Rolldown (Rust-based bundler) replaces Rollup+esbuild
- 10-30x faster builds
- Full plugin backward compatibility

### setup.sh Updates Required
- Change `php8.3-*` to `php8.5-*`
- Change Go 1.22.5 to Go 1.26.2
- Change Node 20 to Node 24 LTS
- Update Redis 7 to Redis 8
