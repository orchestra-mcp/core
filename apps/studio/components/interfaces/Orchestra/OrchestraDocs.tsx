import { useParams } from 'common'
import { BookOpen, Code, FileText, Layers, Rocket, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, cn, Input, Skeleton } from 'ui'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocEntry {
  slug: string
  title: string
  category: string
  content: string
  updated_at?: string
}

interface DocCategory {
  id: string
  label: string
  icon: React.ReactNode
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOC_CATEGORIES: DocCategory[] = [
  { id: 'platform', label: 'Platform Docs', icon: <Rocket size={14} /> },
  { id: 'api', label: 'API Reference', icon: <Code size={14} /> },
  { id: 'developer', label: 'Developer Guide', icon: <BookOpen size={14} /> },
  { id: 'architecture', label: 'Architecture', icon: <Layers size={14} /> },
]

// ---------------------------------------------------------------------------
// Built-in docs content (fallback when API is unavailable)
// ---------------------------------------------------------------------------

const BUILT_IN_DOCS: DocEntry[] = [
  {
    slug: 'getting-started',
    title: 'Getting Started',
    category: 'platform',
    content: `# Getting Started with Orchestra MCP

Orchestra MCP turns Claude AI into a 24/7 autonomous company operating system.

## Quick Start

1. **Register** at the Orchestra MCP web portal
2. **Get your MCP token** from Dashboard > Tokens
3. **Connect Claude Code** by adding the token to \`.mcp.json\`

## Configuration

\`\`\`json
{
  "mcpServers": {
    "orchestra": {
      "type": "sse",
      "url": "https://your-instance.orchestra-mcp.com/mcp/sse",
      "headers": {
        "Authorization": "Bearer orch_live_xxxx..."
      }
    }
  }
}
\`\`\`

After connecting, you should see all 55+ MCP tools available in Claude.`,
  },
  {
    slug: 'agents',
    title: 'Agents',
    category: 'platform',
    content: `# Agents

Agents are AI workers that perform tasks within the Orchestra MCP platform. Each agent has a role, set of skills, and memory scope.

## Agent Lifecycle

- **Created** -- An agent is defined with a name, role, and skills
- **Online** -- The agent is actively connected and processing tasks
- **Busy** -- The agent is working on a specific task
- **Offline** -- The agent is not connected

## Tools

| Tool | Description |
|------|-------------|
| \`agent_create\` | Create a new agent with role and skills |
| \`agent_list\` | List all agents in the project |
| \`agent_get\` | Get agent details including memory |
| \`agent_update\` | Update agent configuration |
| \`agent_delete\` | Remove an agent |`,
  },
  {
    slug: 'tokens',
    title: 'Tokens & Auth',
    category: 'platform',
    content: `# Tokens & Authentication

Orchestra MCP uses token-based authentication for all MCP connections.

## Token Types

- **Live tokens** (\`orch_live_\`) -- For production use
- **Test tokens** (\`orch_test_\`) -- For development and testing

## Creating Tokens

Navigate to **Dashboard > Tokens** and click "Create Token". Tokens are shown only once -- save them securely.

## Token Scoping

Each token is scoped to a user and organization. Tokens inherit the permissions of the user who created them.`,
  },
  {
    slug: 'tools-reference',
    title: 'MCP Tools Reference',
    category: 'api',
    content: `# MCP Tools Reference

Orchestra MCP provides 55+ tools organized into categories.

## Categories

### Agents
\`agent_create\`, \`agent_list\`, \`agent_get\`, \`agent_update\`, \`agent_delete\`

### Tasks
\`task_create\`, \`task_list\`, \`task_get\`, \`task_update\`, \`task_complete\`, \`task_assign\`, \`task_block\`, \`task_transition\`, \`task_get_next\`

### Memory
\`memory_store\`, \`memory_search\`, \`memory_list\`, \`memory_delete\`

### Sessions
\`session_start\`, \`session_heartbeat\`, \`session_end\`, \`session_list\`

### Activity
\`activity_log\`, \`activity_list\`

### Decisions
\`decision_log\`, \`decision_list\`, \`decision_search\`

### Projects
\`project_create\`, \`project_list\`, \`project_get\`, \`project_progress\`, \`project_link_repo\`

### Notes
\`note_create\`, \`note_list\`, \`note_get\`, \`note_update\`, \`note_delete\`

### Specs
\`spec_create\`, \`spec_list\`, \`spec_get\`, \`spec_update\`

### Exports
\`export_markdown\`, \`export_docx\`, \`export_xlsx\`, \`export_csv\`, \`export_pdf\`, \`export_pptx\`, \`export_diagram\``,
  },
  {
    slug: 'mcp-protocol',
    title: 'MCP Protocol',
    category: 'api',
    content: `# MCP Protocol

Orchestra MCP implements the [Model Context Protocol](https://modelcontextprotocol.io) (2025-11-25 spec).

## Connection

Connect via Server-Sent Events (SSE):

\`\`\`
GET /mcp/sse
Authorization: Bearer orch_live_xxxx...
Accept: text/event-stream
\`\`\`

## Supported Clients

- Claude Code (CLI)
- Claude Desktop
- Claude.ai (Web)
- Claude Mobile
- Any MCP-compatible client

## Transport

The server supports SSE (Server-Sent Events) transport with JSON-RPC 2.0 messages.`,
  },
  {
    slug: 'local-development',
    title: 'Local Development Setup',
    category: 'developer',
    content: `# Local Development Setup

## Prerequisites

- Docker & Docker Compose
- Node.js 22+ with pnpm
- Go 1.26+
- PHP 8.5+ with Composer

## Quick Start

\`\`\`bash
# Clone the repository
git clone https://github.com/orchestra-mcp/core.git
cd core

# Start infrastructure
cd docker && cp .env.example .env && docker compose up -d

# Install dependencies
pnpm install

# Start Studio
pnpm dev:studio
# Studio at http://localhost:8082
\`\`\`

## Services

| Service | Port | Description |
|---------|------|-------------|
| PostgreSQL | 5432 | Database |
| Studio | 8082 | Admin panel |
| GoTrue | 9999 | Auth |
| MCP Server | 8080 | Go MCP server |
| Laravel | 8000 | Web app |`,
  },
  {
    slug: 'database-schema',
    title: 'Database Schema',
    category: 'architecture',
    content: `# Database Schema

Orchestra MCP uses PostgreSQL with pgvector for vector-based memory search.

## Core Tables

- \`organizations\` -- Multi-tenant organization support
- \`users\` -- User accounts linked to auth
- \`mcp_tokens\` -- API tokens for MCP connections
- \`agents\` -- AI agent definitions
- \`tasks\` -- Task management
- \`memories\` -- Agent memory with vector embeddings
- \`agent_sessions\` -- Active session tracking
- \`activity_log\` -- Audit trail
- \`decisions\` -- Architectural decision records
- \`specs\` -- Technical specifications
- \`notes\` -- Markdown notes
- \`projects\` -- Project management

## Vector Search

Memory entries use pgvector for semantic similarity search:

\`\`\`sql
SELECT * FROM memories
ORDER BY embedding <=> $1
LIMIT 10;
\`\`\``,
  },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OrchestraDocs() {
  const { ref: projectRef } = useParams()
  const [docs, setDocs] = useState<DocEntry[]>(BUILT_IN_DOCS)
  const [selectedDoc, setSelectedDoc] = useState<DocEntry | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  // ─── Attempt to fetch docs from API ───────────────────────────

  useEffect(() => {
    async function fetchDocs() {
      if (!projectRef) return
      setLoading(true)
      try {
        const response = await fetch(`/api/projects/${projectRef}/orchestra/docs`)
        if (response.ok) {
          const data = await response.json()
          if (Array.isArray(data) && data.length > 0) {
            setDocs(data)
          }
        }
      } catch {
        // API not available -- use built-in docs
      } finally {
        setLoading(false)
      }
    }
    fetchDocs()
  }, [projectRef])

  // ─── Auto-select first doc ────────────────────────────────────

  useEffect(() => {
    if (docs.length > 0 && !selectedDoc) {
      setSelectedDoc(docs[0])
    }
  }, [docs, selectedDoc])

  // ─── Filtering ─────────────────────────────────────────────────

  const filteredDocs = useMemo(() => {
    let result = docs
    if (activeCategory) {
      result = result.filter((d) => d.category === activeCategory)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.slug.toLowerCase().includes(q) ||
          d.content.toLowerCase().includes(q)
      )
    }
    return result
  }, [docs, activeCategory, searchQuery])

  const groupedDocs = useMemo(() => {
    const groups: Record<string, DocEntry[]> = {}
    for (const cat of DOC_CATEGORIES) {
      groups[cat.id] = []
    }
    for (const doc of filteredDocs) {
      if (groups[doc.category]) {
        groups[doc.category].push(doc)
      }
    }
    return groups
  }, [filteredDocs])

  // ─── TOC extraction from selected doc content ─────────────────

  const toc = useMemo(() => {
    if (!selectedDoc) return []
    const headingRegex = /^(#{2,3})\s+(.+)$/gm
    const entries: { level: number; text: string; id: string }[] = []
    let match
    while ((match = headingRegex.exec(selectedDoc.content)) !== null) {
      const level = match[1].length
      const text = match[2]
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
      entries.push({ level, text, id })
    }
    return entries
  }, [selectedDoc])

  const handleSelectDoc = useCallback((doc: DocEntry) => {
    setSelectedDoc(doc)
  }, [])

  // ─── Render ────────────────────────────────────────────────────

  return (
    <div className="flex gap-0 -mx-6 -mt-4">
      {/* Left Sidebar -- Categories & Doc List */}
      <aside className="w-60 shrink-0 border-r border-default py-4">
        {/* Search */}
        <div className="px-4 pb-4">
          <Input
            size="small"
            icon={<Search size={14} />}
            placeholder="Search docs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Category filters */}
        <div className="px-2 pb-3 flex flex-wrap gap-1">
          <Button
            type={activeCategory === null ? 'primary' : 'default'}
            size="tiny"
            onClick={() => setActiveCategory(null)}
          >
            All
          </Button>
          {DOC_CATEGORIES.map((cat) => (
            <Button
              key={cat.id}
              type={activeCategory === cat.id ? 'primary' : 'default'}
              size="tiny"
              onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
              icon={cat.icon}
            >
              {cat.label}
            </Button>
          ))}
        </div>

        {/* Doc List */}
        <div className="overflow-y-auto max-h-[calc(100vh-280px)]">
          {loading ? (
            <div className="px-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            DOC_CATEGORIES.map((cat) => {
              const catDocs = groupedDocs[cat.id] || []
              if (catDocs.length === 0) return null
              return (
                <div key={cat.id} className="mb-2">
                  <div className="px-4 py-1.5 flex items-center gap-2 text-foreground-lighter">
                    {cat.icon}
                    <span className="text-xs font-medium uppercase tracking-wider">
                      {cat.label}
                    </span>
                  </div>
                  {catDocs.map((doc) => (
                    <button
                      key={doc.slug}
                      onClick={() => handleSelectDoc(doc)}
                      className={cn(
                        'flex w-full items-center gap-2 px-6 py-1.5 text-left text-sm transition-colors',
                        selectedDoc?.slug === doc.slug
                          ? 'bg-surface-200 text-foreground font-medium'
                          : 'text-foreground-light hover:bg-surface-100 hover:text-foreground'
                      )}
                    >
                      <FileText size={13} className="shrink-0 text-foreground-muted" />
                      <span className="truncate">{doc.title}</span>
                    </button>
                  ))}
                </div>
              )
            })
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 min-w-0 py-4 px-8">
        {selectedDoc ? (
          <div className="flex gap-6">
            {/* Markdown content */}
            <div className="flex-1 min-w-0 prose prose-sm prose-invert max-w-none">
              <MarkdownRenderer content={selectedDoc.content} />
            </div>

            {/* Right sidebar -- Table of Contents */}
            {toc.length > 0 && (
              <nav className="w-48 shrink-0 hidden xl:block">
                <div className="sticky top-6">
                  <h4 className="text-xs font-medium text-foreground-lighter uppercase tracking-wider mb-3">
                    On this page
                  </h4>
                  <ul className="space-y-1.5">
                    {toc.map((item) => (
                      <li key={item.id}>
                        <a
                          href={`#${item.id}`}
                          className={cn(
                            'block text-xs text-foreground-lighter hover:text-foreground transition-colors truncate',
                            item.level === 3 && 'pl-3'
                          )}
                        >
                          {item.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </nav>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20">
            <BookOpen size={40} className="text-foreground-muted mb-4" />
            <h2 className="text-lg font-semibold text-foreground">Documentation</h2>
            <p className="mt-1 text-sm text-foreground-lighter">
              Select a document from the sidebar to begin reading.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Simple Markdown Renderer (uses rehype for Studio context)
// Imports react-markdown which is already a dep in Studio
// ---------------------------------------------------------------------------

function MarkdownRenderer({ content }: { content: string }) {
  // Use dynamic import pattern or lazy, but for simplicity, render with
  // a basic approach that works within Studio's existing deps
  const [ReactMarkdown, setReactMarkdown] = useState<any>(null)

  useEffect(() => {
    // Dynamically import react-markdown (already available in Studio)
    import('react-markdown').then((mod) => {
      setReactMarkdown(() => mod.default)
    })
  }, [])

  if (!ReactMarkdown) {
    // Fallback: render as pre-formatted text while loading
    return <pre className="whitespace-pre-wrap text-sm text-foreground-light">{content}</pre>
  }

  return (
    <ReactMarkdown
      components={{
        h1: ({ children, ...props }: any) => (
          <h1 className="text-2xl font-bold text-foreground mb-4 pb-2 border-b border-default" {...props}>
            {children}
          </h1>
        ),
        h2: ({ children, ...props }: any) => {
          const id =
            typeof children === 'string'
              ? children
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-|-$/g, '')
              : undefined
          return (
            <h2 id={id} className="text-xl font-semibold text-foreground mt-8 mb-3" {...props}>
              {children}
            </h2>
          )
        },
        h3: ({ children, ...props }: any) => {
          const id =
            typeof children === 'string'
              ? children
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, '-')
                  .replace(/^-|-$/g, '')
              : undefined
          return (
            <h3 id={id} className="text-lg font-medium text-foreground mt-6 mb-2" {...props}>
              {children}
            </h3>
          )
        },
        p: ({ children, ...props }: any) => (
          <p className="text-sm text-foreground-light leading-relaxed mb-3" {...props}>
            {children}
          </p>
        ),
        a: ({ children, href, ...props }: any) => (
          <a
            href={href}
            className="text-brand-link hover:underline"
            target="_blank"
            rel="noopener noreferrer"
            {...props}
          >
            {children}
          </a>
        ),
        code: ({ className: cn, children, ...props }: any) => {
          const isBlock = cn?.includes('language-')
          if (isBlock) {
            return (
              <code
                className={`${cn ?? ''} block rounded-lg bg-surface-100 border border-default p-4 text-xs font-mono overflow-x-auto text-foreground-light`}
                {...props}
              >
                {children}
              </code>
            )
          }
          return (
            <code
              className="bg-surface-200 text-foreground px-1.5 py-0.5 rounded text-xs font-mono"
              {...props}
            >
              {children}
            </code>
          )
        },
        pre: ({ children, ...props }: any) => (
          <pre className="mb-4" {...props}>
            {children}
          </pre>
        ),
        ul: ({ children, ...props }: any) => (
          <ul className="list-disc list-inside text-sm text-foreground-light space-y-1 mb-3 ml-2" {...props}>
            {children}
          </ul>
        ),
        ol: ({ children, ...props }: any) => (
          <ol className="list-decimal list-inside text-sm text-foreground-light space-y-1 mb-3 ml-2" {...props}>
            {children}
          </ol>
        ),
        li: ({ children, ...props }: any) => (
          <li className="text-sm text-foreground-light" {...props}>
            {children}
          </li>
        ),
        table: ({ children, ...props }: any) => (
          <div className="mb-4 overflow-x-auto">
            <table className="w-full text-sm border border-default rounded-lg" {...props}>
              {children}
            </table>
          </div>
        ),
        thead: ({ children, ...props }: any) => (
          <thead className="bg-surface-100" {...props}>
            {children}
          </thead>
        ),
        th: ({ children, ...props }: any) => (
          <th className="px-3 py-2 text-left text-xs font-medium text-foreground-lighter border-b border-default" {...props}>
            {children}
          </th>
        ),
        td: ({ children, ...props }: any) => (
          <td className="px-3 py-2 text-xs text-foreground-light border-b border-default" {...props}>
            {children}
          </td>
        ),
        blockquote: ({ children, ...props }: any) => (
          <blockquote className="border-l-2 border-brand pl-4 text-sm text-foreground-lighter italic mb-3" {...props}>
            {children}
          </blockquote>
        ),
        hr: (props: any) => <hr className="border-default my-6" {...props} />,
        strong: ({ children, ...props }: any) => (
          <strong className="font-semibold text-foreground" {...props}>
            {children}
          </strong>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
