# ADR: Export Engine

**Date:** 2026-03-28
**Author:** Bassem Fouad Ghali, Software Architect
**Status:** Proposed
**Reviewers:** Youssef Amr El-Tawil (CTO), Ahmad Hazem El-Naggar (Tech Leader)

---

## Context

Orchestra MCP provides rich project management data — tasks, specs, decisions, activity logs, agent assignments, workflow states — that users need to export into portable document formats for stakeholder reports, compliance audits, and offline reference. The Export Engine is a set of MCP tools that convert structured data into Markdown, DOCX, Excel/CSV, PDF, and PPTX files, with optional Mermaid diagram rendering.

The Go MCP server (`mcp-server/`) currently runs as a statically compiled binary inside a minimal `alpine:3.21` Docker image. The Dockerfile produces a container with no runtime dependencies beyond `ca-certificates`. Every architectural decision below must be evaluated against this constraint: any binary dependency added to the export pipeline inflates the image and introduces a new failure surface.

This ADR covers six decisions that shape the Export Engine's design.

---

## 1. File Storage Strategy

### Problem

Export tools produce files on disk. The MCP server runs in a Docker container where `/tmp` is ephemeral — files are lost on container restart, redeployment, or scaling events. We need a storage strategy that balances simplicity for the initial implementation with a clear path to production-grade persistence.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **A: `/tmp` only (ephemeral)** | Zero dependencies, zero config. Works immediately. No external service needed. | Files lost on restart. No sharing across container replicas. No durability guarantees. |
| **B: Supabase Storage (persistent)** | Durable, S3-compatible. Signed URLs for secure access. Works across replicas. Already part of the Docker stack. | Requires Supabase Storage API integration. Upload latency. Adds network dependency to the export path. |
| **C: Docker volume mount** | Persistent across restarts. Simple ops. No external API. | Requires `docker-compose.yml` changes. Does not work in multi-replica deployments. Operators must manage the volume. |

### Recommendation: Option A now, roadmap to Option B

Start with `/tmp` as the sole storage location. This lets us ship the Export Engine without any infrastructure changes. The export tools return the local file path; the caller reads the file via the `Read` tool or equivalent.

**TTL-based cleanup:** A goroutine (not a cron job — the MCP server is a single Go binary, not a systemd-managed service) runs on a `time.Ticker` every 30 minutes and deletes files in the export output directory older than 24 hours:

```go
// cleanup runs in a background goroutine started at server init.
func startExportCleanup(dir string, maxAge time.Duration) {
    ticker := time.NewTicker(30 * time.Minute)
    go func() {
        for range ticker.C {
            entries, _ := os.ReadDir(dir)
            cutoff := time.Now().Add(-maxAge)
            for _, e := range entries {
                info, err := e.Info()
                if err != nil || info.ModTime().After(cutoff) {
                    continue
                }
                os.RemoveAll(filepath.Join(dir, e.Name()))
            }
        }
    }()
}
```

**Base directory:** `/tmp/orchestra-exports/`. Configurable via `EXPORT_DIR` environment variable for operators who want to point it at a mounted volume (bridging to Option C without code changes).

**Roadmap to Option B:** When multi-replica or durable export links are required, the export tools upload to Supabase Storage after writing locally and return a signed URL instead of a file path. The local file remains for TTL-based cache. This is an additive change — the export pipeline writes to disk first in all cases; the upload step is optional and toggled by the presence of `SUPABASE_STORAGE_BUCKET` in the environment.

### Trade-offs Accepted

- Files are lost on restart. This is acceptable because exports are on-demand artifacts, not source-of-truth data. The user can re-export at any time.
- Single-replica limitation. Acceptable for the initial deployment model (single MCP server container).

---

## 2. Security & Access Control

### Problem

Exported files may contain sensitive project data — task descriptions, spec content, decision rationale, agent communications. If file paths are predictable (e.g., `/tmp/orchestra-exports/org-123/2026-03-28/report.pdf`), an attacker who gains filesystem access or guesses the path structure could read another organization's exports.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **A: Predictable paths (`org_id/date/name`)** | Human-readable. Easy to debug. Findable via `ls`. | Enumerable. If a path traversal vulnerability exists, cross-tenant access is trivial. |
| **B: Randomized paths (UUID per export)** | Non-enumerable. Cross-tenant guessing is infeasible (128-bit UUID space). | Harder to debug manually. Requires a lookup to associate a file with its export request. |
| **C: Hybrid (`org_id/UUID/name`)** | Org-scoped directories for operational visibility. UUID subdirectory prevents cross-request collision and guessing. | Slightly deeper path nesting. |

### Recommendation: Option C (Hybrid)

The file path structure is:

```
/tmp/orchestra-exports/{org_id}/{uuid}/{filename}
```

Example:
```
/tmp/orchestra-exports/550e8400-e29b-41d4-a716-446655440000/a1b2c3d4-e5f6-7890-abcd-ef1234567890/sprint-report.pdf
```

**Rationale:**

1. **Org-scoped directories** allow operators to inspect and clean up exports per tenant. The `org_id` prefix also enables per-org disk quotas in a future iteration.

2. **UUID subdirectory** per export request makes paths non-enumerable. Even if an attacker knows the `org_id`, they cannot guess the UUID. This is defense-in-depth — the primary access control is the MCP auth middleware that validates the caller's token and org membership before any tool executes.

3. **Human-readable filename** (e.g., `sprint-report.pdf`) preserves usability when the file is downloaded or shared.

**Additional controls:**

- The export tool handler extracts `org_id` from the authenticated context (`auth.OrgIDFromContext(ctx)`) and uses it to build the path. The caller cannot specify a different org_id.
- File paths returned by the tool are validated on read to ensure they fall within the expected base directory (preventing path traversal via `../`).
- When Supabase Storage is enabled (future), signed URLs include an expiry (default 1 hour) and are scoped to the org's storage bucket prefix.

---

## 3. Concurrency & File Collisions

### Problem

Multiple users in the same organization (or multiple agents on behalf of the same user) could trigger exports simultaneously. If two exports produce a file with the same name in the same directory, one overwrites the other.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **A: UUID suffix on filename** | Simple. `report-a1b2c3d4.pdf`. | Filename becomes ugly. Does not prevent collisions on the directory level. |
| **B: Atomic temp file + rename** | Safe against partial writes. Standard POSIX pattern. | Still needs unique naming to prevent rename collisions. Two-step operation. |
| **C: Per-request subdirectory** | Complete isolation. Each export gets its own UUID directory. No collision possible regardless of filename. Cleanup is trivial (delete the directory). | Slightly deeper nesting (already chosen in Section 2). |

### Recommendation: Option C (Per-request subdirectory) — already decided

The hybrid path structure from Section 2 (`{org_id}/{uuid}/{filename}`) gives each export request its own directory keyed by a UUID generated at request time. This eliminates file collisions entirely without any locking or atomic rename logic.

**Implementation detail:** Within a single export request that produces multiple files (e.g., a report plus embedded diagrams), all files are written into the same request subdirectory. The directory is created with `os.MkdirAll` at the start of the export handler. If two exports for the same org run concurrently, they write to different UUID subdirectories — no coordination needed.

**Combined with Option B (atomic temp writes):** For individual file writes, the handler writes to a temp file (`filename.tmp`) within the request directory and renames it to the final name upon completion. This prevents a concurrent reader (e.g., the user's `Read` tool call) from seeing a partially written file.

```go
tmpPath := filepath.Join(requestDir, filename+".tmp")
f, err := os.Create(tmpPath)
// ... write content ...
f.Close()
os.Rename(tmpPath, filepath.Join(requestDir, filename))
```

---

## 4. Binary Dependencies for PDF/PPTX/Diagrams

### Problem

The current Docker image is ~15 MB (Alpine + static Go binary + `ca-certificates`). Rich document formats require rendering engines that can dramatically increase image size:

| Dependency | Size Impact | Purpose |
|------------|-------------|---------|
| Chromium (`chromedp`) | +300-400 MB | PDF rendering, Mermaid diagrams via headless browser |
| Node.js + `mermaid-cli` | +150-200 MB | Mermaid diagram rendering |
| `wkhtmltopdf` | +40-60 MB | PDF from HTML (single binary, no browser) |
| Python + `python-pptx` | +100-150 MB | PowerPoint generation |

A 15 MB image ballooning to 500+ MB is unacceptable for a tool that most users may not even use for export.

### Recommendations by Format

#### 4.1 Markdown & CSV — Pure Go (zero dependencies)

These are text-based formats. The Go standard library and `encoding/csv` handle them completely. No external dependencies.

**Implementation:** Direct string/template rendering in Go. No discussion needed.

#### 4.2 DOCX — `unioffice` (pure Go)

| Library | Language | License | Notes |
|---------|----------|---------|-------|
| `unioffice` | Go | AGPLv3 / Commercial | Full OOXML support. Maintained. Most mature Go DOCX library. |
| `go-docx` | Go | MIT | Lightweight but limited. No table styles, no images. |

**Recommendation: `unioffice`.**

`go-docx` cannot produce documents with tables, styled headings, or embedded images — all of which are required for project reports. `unioffice` is the only Go library with full OOXML support. The AGPL license is acceptable because the MCP server is a network service (not distributed as a binary to end users) and Orchestra's server code is not proprietary-licensed in a way that conflicts.

**If licensing becomes a concern:** Purchase the commercial license from UniDoc. The cost is negligible relative to the engineering time to build a DOCX writer from scratch or maintain a Python sidecar.

**Zero Docker impact.** Pure Go, compiled into the binary.

#### 4.3 Excel (XLSX) — `excelize` (pure Go)

| Library | Language | License | Notes |
|---------|----------|---------|-------|
| `excelize` | Go | BSD-3 | De facto standard Go Excel library. Active, well-documented. |

**Recommendation: `excelize`.** No alternatives worth considering. BSD license, pure Go, zero Docker impact.

#### 4.4 PDF — `goldmark` + `go-pdf` (pure Go, no headless browser)

| Approach | Size Impact | Rendering Quality | Complexity |
|----------|-------------|-------------------|------------|
| `chromedp` (headless Chrome) | +300-400 MB | Pixel-perfect | High (Chrome in Docker) |
| `wkhtmltopdf` | +40-60 MB | Good | Medium (single binary) |
| `goldmark` HTML + `go-pdf`/`gofpdf` | 0 MB | Acceptable | Medium (layout in Go) |
| `maroto` (Go PDF via `gofpdf`) | 0 MB | Good for structured reports | Low-Medium |

**Recommendation: `maroto` (v2) as the primary PDF engine.**

`maroto` is a pure-Go PDF library built on `gofpdf` that provides a high-level API for structured documents — headers, footers, tables, grids, images, page numbers. This maps directly to the export use case (project reports, sprint summaries, task lists). It does not require HTML rendering at all.

**Rationale for rejecting `chromedp`:** Adding Chromium to the Docker image is a ~25x increase in image size for a single feature. It also introduces a class of runtime failures (Chrome crashes, font rendering differences, memory spikes on large documents) that are disproportionate to the value delivered. The MCP server is a lightweight Go service, not a browser automation platform.

**Rationale for rejecting `wkhtmltopdf`:** While smaller than Chromium, it is a C++ binary that requires shared libraries (`libX11`, `libfreetype`, etc.) in the Alpine image. It is also effectively unmaintained (archived on GitHub).

**Trade-off accepted:** `maroto` cannot render arbitrary HTML or CSS. This means PDF exports will have a consistent, structured layout defined in Go code rather than a pixel-perfect reproduction of a web page. For project management reports, this is a feature, not a limitation — the layout is predictable and maintainable.

**Future escape hatch:** If pixel-perfect PDF rendering is later required (e.g., for branded marketing reports), add an optional `CHROMEDP_URL` environment variable pointing to an external Chrome instance (e.g., `browserless/chrome` sidecar). The export tool detects this and delegates PDF rendering to the remote browser. Zero impact on the base Docker image.

#### 4.5 PPTX — `unioffice` (pure Go)

| Library | Language | License | Notes |
|---------|----------|---------|-------|
| `unioffice` | Go | AGPLv3 / Commercial | PPTX support via the same library as DOCX. |
| `go-pptx` | Go | MIT | Very early stage, limited features. |
| `python-pptx` sidecar | Python | MIT | Mature, full-featured. Requires Python runtime. |

**Recommendation: `unioffice`.**

Since we already depend on `unioffice` for DOCX (Section 4.2), using it for PPTX adds no new dependencies. It supports slides, text boxes, images, and basic layouts — sufficient for generating presentation decks from project data.

**Rationale for rejecting `python-pptx` sidecar:** A Python sidecar introduces an entirely separate runtime, package manager (`pip`), and deployment artifact into a Go-native service. The operational complexity (health checks, version pinning, IPC protocol, error propagation) is not justified when a pure-Go solution exists.

#### 4.6 Diagrams (Mermaid) — Pre-rendered SVG via `mermaid-cli` in CI, not in the MCP server

| Approach | Size Impact | Rendering Quality | Complexity |
|----------|-------------|-------------------|------------|
| `mermaid-cli` in Docker | +150-200 MB (Node.js + Puppeteer) | Perfect | High |
| `chromedp` + Mermaid JS | +300-400 MB | Perfect | High |
| External API (e.g., `mermaid.ink`) | 0 MB | Good | Low (network dependency) |
| SVG-only (no rasterization) | 0 MB | Vector (scales) | Low |

**Recommendation: Two-tier approach.**

**Tier 1 (default): Embed Mermaid source as code blocks + use `mermaid.ink` for SVG.**

The export tool includes Mermaid diagram definitions as fenced code blocks in Markdown and DOCX. For formats that support images (PDF, PPTX), it calls the public `mermaid.ink` API (`https://mermaid.ink/svg/{base64}`) to fetch rendered SVGs and embeds them.

```go
func renderMermaidSVG(definition string) ([]byte, error) {
    encoded := base64.URLEncoding.EncodeToString([]byte(definition))
    resp, err := http.Get("https://mermaid.ink/svg/" + encoded)
    // ...
}
```

**Tier 2 (self-hosted, optional): `MERMAID_SERVICE_URL` environment variable.**

For air-gapped deployments or high-volume usage, operators can deploy a self-hosted Mermaid rendering service (a small Node.js container running `mermaid-cli` as an HTTP server) and point the MCP server at it via `MERMAID_SERVICE_URL`. This keeps the rendering dependency out of the MCP server image entirely.

**Rationale:** Mermaid rendering requires a JavaScript runtime and a browser engine. There is no pure-Go Mermaid parser. Rather than bloating the MCP server image, we externalize this dependency. The `mermaid.ink` public API is a reasonable default — it is free, fast, and maintained by the Mermaid project. Self-hosting is the escape hatch.

**Trade-off accepted:** Network dependency for diagram rendering. If `mermaid.ink` is unreachable (or `MERMAID_SERVICE_URL` is not configured in an air-gapped environment), the export tool falls back to embedding the raw Mermaid source as a code block with a note: `"[Diagram could not be rendered — Mermaid source below]"`.

### Summary: Docker Image Impact

| Format | Library/Approach | Additional Image Size |
|--------|-----------------|----------------------|
| Markdown | Go stdlib | 0 MB |
| CSV | Go `encoding/csv` | 0 MB |
| DOCX | `unioffice` | 0 MB (compiled in) |
| XLSX | `excelize` | 0 MB (compiled in) |
| PDF | `maroto` v2 | 0 MB (compiled in) |
| PPTX | `unioffice` | 0 MB (compiled in) |
| Diagrams | `mermaid.ink` API / external sidecar | 0 MB |

**Total additional Docker image size: 0 MB.** The image remains a static Go binary on Alpine. All document generation is pure Go. Diagram rendering is externalized.

---

## 5. Size Limits & Memory

### Problem

A large project export — hundreds of tasks, dozens of diagrams, full spec content — could consume significant memory. The Go MCP server processes multiple concurrent requests. An unbounded export could OOM the container or starve other requests.

### Recommendations

#### 5.1 Content Size Limits

| Parameter | Default Limit | Configurable Via |
|-----------|---------------|------------------|
| Max tasks per export | 500 | `EXPORT_MAX_TASKS` |
| Max specs per export | 50 | `EXPORT_MAX_SPECS` |
| Max diagrams per export | 20 | `EXPORT_MAX_DIAGRAMS` |
| Max total content size (pre-render) | 10 MB | `EXPORT_MAX_CONTENT_BYTES` |
| Max output file size | 50 MB | `EXPORT_MAX_OUTPUT_BYTES` |

When a limit is exceeded, the export tool returns an error explaining which limit was hit and suggesting filters (e.g., "Export contains 723 tasks. Maximum is 500. Use `project_id` or `status` filters to narrow the scope.").

#### 5.2 Memory Management Strategy

1. **Stream, don't buffer.** Write output to the file directly rather than building the entire document in memory. `maroto` (PDF), `excelize` (XLSX), and `unioffice` (DOCX/PPTX) all support streaming writes to `io.Writer`.

2. **Process data in pages.** Fetch tasks from Supabase in pages of 50 (`limit=50&offset=N`), render each page into the document, then fetch the next. The peak memory usage is proportional to one page of data plus the document writer's internal buffers — not the total export size.

3. **Diagram rendering is sequential.** Each Mermaid diagram is fetched, embedded, and then the response body is discarded before the next diagram is requested. This prevents accumulating all SVGs in memory simultaneously.

4. **Goroutine-scoped memory.** Each export runs in its own goroutine (as part of the MCP tool handler). If the export panics due to memory pressure, the `recover()` in the tool handler catches it and returns an error result. Other concurrent requests are unaffected.

#### 5.3 Request Timeout

Export operations are bound by a context timeout of 5 minutes (`context.WithTimeout`). This prevents runaway exports from holding resources indefinitely. The timeout is configurable via `EXPORT_TIMEOUT_SECONDS`.

---

## 6. File Delivery

### Problem

After the export tool generates a file, how does the caller (typically an AI agent in Claude Code) access it? The MCP protocol returns JSON responses — it cannot stream binary file content natively.

### Options Considered

| Option | Pros | Cons |
|--------|------|------|
| **A: Return file path** | Simple. Caller reads via `Read` tool. Works immediately with Claude Code. | Only works when caller has filesystem access (same machine or mounted volume). Does not work for Claude.ai web/mobile. |
| **B: Return base64 inline** | Self-contained. No filesystem access needed. | Doubles the payload size. Impractical for files > 1 MB. Violates MCP best practices for large content. |
| **C: Upload to Supabase Storage, return signed URL** | Production-grade. Works across all clients. Secure (expiring URLs). Durable. | Requires Supabase Storage integration. Upload latency. More complex error handling. |
| **D: Serve via HTTP endpoint on MCP server** | Direct download URL. No external storage needed. | Requires adding a new HTTP route, session-scoped file access, and auth for the download endpoint. Stateful. |

### Recommendation: Start with A, roadmap to C

**Phase 1 (now): Option A — return file path.**

The export tool returns a JSON result containing the file path and metadata:

```json
{
  "status": "success",
  "format": "pdf",
  "file_path": "/tmp/orchestra-exports/550e8400.../a1b2c3d4.../sprint-report.pdf",
  "file_size_bytes": 245760,
  "page_count": 12,
  "generated_at": "2026-03-28T15:30:00Z"
}
```

The caller (Claude Code) reads the file using the filesystem `Read` tool or a shell command. This works because Claude Code runs on the same machine as the MCP server (or has access to the same filesystem via the Docker socket).

**Why this is sufficient for now:** The primary Orchestra MCP client is Claude Code, which has full filesystem access. The export tool is most valuable in this context — an agent generates a report and immediately reads it or passes the path to the user.

**Phase 2 (future): Option C — Supabase Storage with signed URLs.**

When Claude.ai web/mobile support is required (where the client cannot read local files), the export tool uploads the file to Supabase Storage and returns a signed URL with a configurable expiry (default 1 hour):

```json
{
  "status": "success",
  "format": "pdf",
  "file_path": "/tmp/orchestra-exports/550e8400.../a1b2c3d4.../sprint-report.pdf",
  "download_url": "https://supabase.orchestra.example/storage/v1/object/sign/exports/550e8400.../sprint-report.pdf?token=...",
  "url_expires_at": "2026-03-28T16:30:00Z",
  "file_size_bytes": 245760
}
```

The local file path is still returned (for Claude Code callers), and the signed URL is additionally provided (for web/mobile callers). The caller uses whichever is appropriate.

**Why not Option D:** Adding an HTTP download endpoint to the MCP server introduces statefulness (the server must remember which files exist and who can access them), session-scoped auth (the MCP session token is not an HTTP bearer token for arbitrary endpoints), and a new attack surface. It duplicates what Supabase Storage already provides. Not worth the complexity.

**Why not Option B:** A 10 MB PDF base64-encoded becomes ~13.3 MB of JSON payload. MCP tool results are not designed for this. It works for tiny files but creates a bad precedent. Better to have a clean separation between the tool result (metadata) and the file content (read separately).

---

## 7. New MCP Tools

### 7.1 `export_document`

The primary export tool. Generates a document from project data in the requested format.

```
export_document(
    format: "markdown" | "docx" | "xlsx" | "csv" | "pdf" | "pptx",
    type: "sprint_report" | "project_summary" | "task_list" | "spec_document" | "decision_log" | "activity_report" | "custom",
    project_id?: UUID,
    filters?: {
        status?: string,
        assigned_agent_id?: UUID,
        assigned_user_id?: UUID,
        date_from?: string,
        date_to?: string,
        labels?: string[]
    },
    options?: {
        include_diagrams?: boolean,
        include_metadata?: boolean,
        title?: string,
        subtitle?: string
    }
)
```

**Returns:**
```json
{
  "status": "success",
  "format": "pdf",
  "type": "sprint_report",
  "file_path": "/tmp/orchestra-exports/{org_id}/{uuid}/sprint-report.pdf",
  "file_size_bytes": 245760,
  "records_included": {
    "tasks": 47,
    "specs": 3,
    "decisions": 12,
    "diagrams": 4
  },
  "generated_at": "2026-03-28T15:30:00Z"
}
```

### 7.2 `export_list`

Lists recent exports for the current organization. Useful for re-downloading or checking export history within the TTL window.

```
export_list(
    limit?: integer
)
```

**Returns:** Array of export metadata (path, format, type, size, timestamp). Reads from a lightweight in-memory registry (not persisted — lost on restart, which is acceptable given the ephemeral nature of the files).

---

## 8. Go Implementation Files

```
mcp-server/internal/tools/
    export.go              # export_document + export_list tool handlers
    export_renderers.go    # Format-specific renderers (Markdown, DOCX, XLSX, CSV, PDF, PPTX)
    export_templates.go    # Report type templates (sprint_report, project_summary, etc.)
    export_diagrams.go     # Mermaid rendering (mermaid.ink client, SVG embedding)
    export_cleanup.go      # TTL-based background cleanup goroutine
```

Registration in `main.go`:
```go
tools.RegisterExportTools(registry, dbClient)
slog.Info("registered export tools")
```

---

## 9. Decision Summary

| # | Decision | Recommendation | Key Rationale |
|---|----------|---------------|---------------|
| 1 | File Storage | `/tmp` now, Supabase Storage later | Zero infrastructure cost to start. Exports are ephemeral by nature. |
| 2 | Security & Access | Hybrid paths: `{org_id}/{uuid}/{filename}` | Org-scoped for ops visibility, UUID for non-enumerability, auth middleware for access control. |
| 3 | Concurrency | Per-request UUID subdirectory + atomic writes | Complete isolation. No locking. No filename collisions. |
| 4 | Binary Dependencies | All pure Go (`unioffice`, `excelize`, `maroto`). Diagrams via external API. | Docker image stays at ~15 MB. Zero runtime dependencies added. |
| 5 | Size Limits | 500 tasks, 20 diagrams, 10 MB content, 5 min timeout | Prevents OOM. Streaming writes keep memory bounded. |
| 6 | File Delivery | Return file path now, signed URL later | Matches current client (Claude Code). Clean upgrade path to web/mobile. |

### New Go Dependencies

```
github.com/unidoc/unioffice     # DOCX + PPTX (AGPLv3 / Commercial)
github.com/xuri/excelize/v2     # XLSX (BSD-3)
github.com/johnfercher/maroto/v2 # PDF (MIT)
github.com/yuin/goldmark         # Markdown parsing (MIT) — if needed for Markdown-to-PDF
```

### Risks

| Risk | Mitigation |
|------|-----------|
| `unioffice` AGPL license concerns | Purchase commercial license if distributing binaries. Network service use is typically AGPL-safe. Legal review recommended before GA. |
| `mermaid.ink` API availability | Graceful fallback to code blocks. Self-hosted option via `MERMAID_SERVICE_URL`. |
| Large exports causing memory pressure | Streaming writes, per-page data fetching, configurable limits, request timeouts. |
| File path traversal attacks | `org_id` from auth context (not user input). Path validation against base directory. |
| `/tmp` disk exhaustion | TTL cleanup (24h). Configurable `EXPORT_DIR` for volume-backed storage. Monitor disk usage via health endpoint. |

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `EXPORT_DIR` | `/tmp/orchestra-exports` | Base directory for export files |
| `EXPORT_MAX_TASKS` | `500` | Max tasks per export |
| `EXPORT_MAX_SPECS` | `50` | Max specs per export |
| `EXPORT_MAX_DIAGRAMS` | `20` | Max diagrams per export |
| `EXPORT_MAX_CONTENT_BYTES` | `10485760` (10 MB) | Max pre-render content size |
| `EXPORT_MAX_OUTPUT_BYTES` | `52428800` (50 MB) | Max output file size |
| `EXPORT_TTL_HOURS` | `24` | Hours before cleanup deletes files |
| `EXPORT_TIMEOUT_SECONDS` | `300` | Max seconds per export operation |
| `MERMAID_SERVICE_URL` | `https://mermaid.ink` | Mermaid rendering service URL |
| `SUPABASE_STORAGE_BUCKET` | (unset) | Enables Supabase Storage upload when set |

### Dockerfile Changes

**None required for Phase 1.** All rendering is pure Go. The Dockerfile remains unchanged:

```dockerfile
FROM golang:1.26-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o orchestra-mcp ./cmd/server

FROM alpine:3.21
RUN apk --no-cache add ca-certificates
COPY --from=builder /app/orchestra-mcp /usr/local/bin/
EXPOSE 3001
CMD ["orchestra-mcp"]
```

This is the single most important outcome of the architecture decisions above. By choosing pure-Go libraries for every format and externalizing diagram rendering, the Docker image remains minimal and the deployment model stays simple.
