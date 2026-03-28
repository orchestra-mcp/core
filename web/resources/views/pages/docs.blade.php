<x-layouts.docs>
    <h1 class="text-3xl font-bold text-white">Documentation</h1>
    <p class="mt-4 text-lg text-brand-text-secondary">Learn how to set up and use Orchestra MCP.</p>

    {{-- Getting Started --}}
    <section id="getting-started" class="mt-12">
        <h2 class="text-2xl font-bold text-white mb-6 pb-2 border-b border-brand-border">Getting Started</h2>

        <div class="space-y-8">
            <div>
                <h3 class="text-lg font-semibold text-white mb-3">1. Register an Account</h3>
                <p class="text-brand-text-secondary leading-relaxed mb-3">Create your Orchestra MCP account at <a href="{{ route('register') }}" class="text-brand-cyan hover:underline">orchestra-mcp.com/register</a>. You can sign up with email or GitHub OAuth.</p>
                <div class="bg-brand-card rounded-lg border border-brand-border p-4">
                    <p class="text-sm text-brand-text-secondary">After registration, you will be guided through onboarding to set up your organization and invite team members.</p>
                </div>
            </div>

            <div>
                <h3 class="text-lg font-semibold text-white mb-3">2. Get Your MCP Token</h3>
                <p class="text-brand-text-secondary leading-relaxed mb-3">Navigate to <strong class="text-white">Dashboard &rarr; Tokens</strong> and create a new MCP token. Copy the token -- it will only be shown once.</p>
                <div class="bg-brand-card rounded-lg border border-brand-border p-4 font-mono text-sm text-brand-cyan">
                    orch_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
                </div>
            </div>

            <div>
                <h3 class="text-lg font-semibold text-white mb-3">3. Connect Claude Code</h3>
                <p class="text-brand-text-secondary leading-relaxed mb-3">Add Orchestra MCP to your Claude Code configuration. Create or update <code class="text-brand-cyan bg-brand-card px-1.5 py-0.5 rounded text-sm">.mcp.json</code> in your project root:</p>
                <div class="bg-brand-card rounded-lg border border-brand-border p-4 font-mono text-sm text-brand-text overflow-x-auto">
<pre class="whitespace-pre">{
  "mcpServers": {
    "orchestra": {
      "type": "sse",
      "url": "https://your-instance.orchestra-mcp.com/mcp/sse",
      "headers": {
        "Authorization": "Bearer orch_live_xxxx..."
      }
    }
  }
}</pre>
                </div>
                <p class="mt-3 text-brand-text-secondary text-sm">Restart Claude Code and you should see 55 MCP tools available.</p>
            </div>
        </div>
    </section>

    {{-- MCP Tools Reference --}}
    <section id="tools-reference" class="mt-16">
        <h2 class="text-2xl font-bold text-white mb-6 pb-2 border-b border-brand-border">MCP Tools Reference</h2>
        <p class="text-brand-text-secondary mb-8">Orchestra MCP provides 55 tools across 11 categories. All tools follow the MCP protocol and are accessible through any MCP-compatible client.</p>

        <div class="space-y-8">
            {{-- Agents --}}
            <div>
                <h3 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-brand-cyan"></span>
                    Agents
                </h3>
                <div class="bg-brand-card rounded-lg border border-brand-border divide-y divide-brand-border">
                    <div class="px-4 py-3 flex justify-between items-start">
                        <div><code class="text-brand-cyan text-sm">create_agent</code><p class="text-xs text-brand-text-secondary mt-1">Create a new AI agent with role, skills, and memory scope</p></div>
                    </div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">list_agents</code><p class="text-xs text-brand-text-secondary mt-1">List all agents in the current project or organization</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">get_agent</code><p class="text-xs text-brand-text-secondary mt-1">Get details of a specific agent including memory and activity</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">update_agent</code><p class="text-xs text-brand-text-secondary mt-1">Update agent configuration, role, or skills</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">delete_agent</code><p class="text-xs text-brand-text-secondary mt-1">Remove an agent and optionally archive its memory</p></div>
                </div>
            </div>

            {{-- Tasks --}}
            <div>
                <h3 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-brand-purple"></span>
                    Tasks
                </h3>
                <div class="bg-brand-card rounded-lg border border-brand-border divide-y divide-brand-border">
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">create_task</code><p class="text-xs text-brand-text-secondary mt-1">Create a task with title, description, assignee, and priority</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">list_tasks</code><p class="text-xs text-brand-text-secondary mt-1">List tasks with filters for status, assignee, and project</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">update_task</code><p class="text-xs text-brand-text-secondary mt-1">Update task status, assignee, priority, or description</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">complete_task</code><p class="text-xs text-brand-text-secondary mt-1">Mark a task as complete with optional completion notes</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">delete_task</code><p class="text-xs text-brand-text-secondary mt-1">Delete a task (soft delete with audit trail)</p></div>
                </div>
            </div>

            {{-- Projects --}}
            <div>
                <h3 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-brand-cyan"></span>
                    Projects
                </h3>
                <div class="bg-brand-card rounded-lg border border-brand-border divide-y divide-brand-border">
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">create_project</code><p class="text-xs text-brand-text-secondary mt-1">Create a new project with name, description, and settings</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">list_projects</code><p class="text-xs text-brand-text-secondary mt-1">List all accessible projects in the organization</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">get_project</code><p class="text-xs text-brand-text-secondary mt-1">Get full project details including stats and recent activity</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">update_project</code><p class="text-xs text-brand-text-secondary mt-1">Update project settings, name, or description</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">archive_project</code><p class="text-xs text-brand-text-secondary mt-1">Archive a project (preserves all data, hides from active list)</p></div>
                </div>
            </div>

            {{-- Memory --}}
            <div>
                <h3 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-brand-purple"></span>
                    Memory
                </h3>
                <div class="bg-brand-card rounded-lg border border-brand-border divide-y divide-brand-border">
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">store_memory</code><p class="text-xs text-brand-text-secondary mt-1">Store a memory entry with content, tags, and vector embedding</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">search_memory</code><p class="text-xs text-brand-text-secondary mt-1">Semantic search across memory entries using vector similarity</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">list_memories</code><p class="text-xs text-brand-text-secondary mt-1">List memory entries with tag and date filters</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">delete_memory</code><p class="text-xs text-brand-text-secondary mt-1">Delete a specific memory entry</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">clear_memory</code><p class="text-xs text-brand-text-secondary mt-1">Clear all memory for a specific scope (agent, project, or session)</p></div>
                </div>
            </div>

            {{-- Activity --}}
            <div>
                <h3 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-brand-cyan"></span>
                    Activity
                </h3>
                <div class="bg-brand-card rounded-lg border border-brand-border divide-y divide-brand-border">
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">log_activity</code><p class="text-xs text-brand-text-secondary mt-1">Log an activity event with type, description, and metadata</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">list_activities</code><p class="text-xs text-brand-text-secondary mt-1">List activity feed with filters for type, agent, and project</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">get_activity</code><p class="text-xs text-brand-text-secondary mt-1">Get details of a specific activity entry</p></div>
                </div>
            </div>

            {{-- Decisions --}}
            <div>
                <h3 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-brand-purple"></span>
                    Decisions
                </h3>
                <div class="bg-brand-card rounded-lg border border-brand-border divide-y divide-brand-border">
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">log_decision</code><p class="text-xs text-brand-text-secondary mt-1">Log an architectural decision with rationale and alternatives</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">list_decisions</code><p class="text-xs text-brand-text-secondary mt-1">List all decisions for a project or organization</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">get_decision</code><p class="text-xs text-brand-text-secondary mt-1">Get full decision details including discussion and outcome</p></div>
                </div>
            </div>

            {{-- Sessions --}}
            <div>
                <h3 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-brand-cyan"></span>
                    Sessions
                </h3>
                <div class="bg-brand-card rounded-lg border border-brand-border divide-y divide-brand-border">
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">create_session</code><p class="text-xs text-brand-text-secondary mt-1">Start a new session with context and goals</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">resume_session</code><p class="text-xs text-brand-text-secondary mt-1">Resume an existing session with full context restoration</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">end_session</code><p class="text-xs text-brand-text-secondary mt-1">End a session and persist final state to memory</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">list_sessions</code><p class="text-xs text-brand-text-secondary mt-1">List sessions for the current user or agent</p></div>
                </div>
            </div>

            {{-- Notes --}}
            <div>
                <h3 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-brand-purple"></span>
                    Notes
                </h3>
                <div class="bg-brand-card rounded-lg border border-brand-border divide-y divide-brand-border">
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">create_note</code><p class="text-xs text-brand-text-secondary mt-1">Create a note with markdown content, tags, and links</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">list_notes</code><p class="text-xs text-brand-text-secondary mt-1">List notes with tag, search, and date filters</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">update_note</code><p class="text-xs text-brand-text-secondary mt-1">Update note content, tags, or links</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">delete_note</code><p class="text-xs text-brand-text-secondary mt-1">Delete a note (soft delete)</p></div>
                </div>
            </div>

            {{-- Skills & Workflows --}}
            <div>
                <h3 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-brand-cyan"></span>
                    Skills & Workflows
                </h3>
                <div class="bg-brand-card rounded-lg border border-brand-border divide-y divide-brand-border">
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">create_feature</code><p class="text-xs text-brand-text-secondary mt-1">Create a feature workflow with gates and review checkpoints</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">advance_feature</code><p class="text-xs text-brand-text-secondary mt-1">Advance a feature through its workflow gates</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">submit_review</code><p class="text-xs text-brand-text-secondary mt-1">Submit a code review for a feature at a gate</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">list_features</code><p class="text-xs text-brand-text-secondary mt-1">List all features with status and gate progress</p></div>
                </div>
            </div>

            {{-- Specs --}}
            <div>
                <h3 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-brand-purple"></span>
                    Specs
                </h3>
                <div class="bg-brand-card rounded-lg border border-brand-border divide-y divide-brand-border">
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">create_spec</code><p class="text-xs text-brand-text-secondary mt-1">Create a technical specification with versioning</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">list_specs</code><p class="text-xs text-brand-text-secondary mt-1">List all specs for a project</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">update_spec</code><p class="text-xs text-brand-text-secondary mt-1">Update a spec (creates a new version)</p></div>
                </div>
            </div>

            {{-- GitHub --}}
            <div>
                <h3 class="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-brand-cyan"></span>
                    GitHub
                </h3>
                <div class="bg-brand-card rounded-lg border border-brand-border divide-y divide-brand-border">
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">connect_repo</code><p class="text-xs text-brand-text-secondary mt-1">Connect a GitHub repository to the project</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">create_pr</code><p class="text-xs text-brand-text-secondary mt-1">Create a pull request with description and reviewers</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">generate_claude_md</code><p class="text-xs text-brand-text-secondary mt-1">Generate a CLAUDE.md file for the connected repository</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">list_repos</code><p class="text-xs text-brand-text-secondary mt-1">List connected GitHub repositories</p></div>
                    <div class="px-4 py-3"><code class="text-brand-cyan text-sm">sync_repo</code><p class="text-xs text-brand-text-secondary mt-1">Sync repository metadata and branch information</p></div>
                </div>
            </div>
        </div>
    </section>

    {{-- Self-Hosting --}}
    <section id="self-hosting" class="mt-16">
        <h2 class="text-2xl font-bold text-white mb-6 pb-2 border-b border-brand-border">Self-Hosting</h2>

        <div class="space-y-8">
            <div>
                <h3 class="text-lg font-semibold text-white mb-3">Docker Setup</h3>
                <p class="text-brand-text-secondary leading-relaxed mb-3">Orchestra MCP can be self-hosted using Docker Compose. Clone the repository and start the services:</p>
                <div class="bg-brand-card rounded-lg border border-brand-border p-4 font-mono text-sm text-brand-text overflow-x-auto">
<pre class="whitespace-pre">git clone https://github.com/orchestra-mcp/framework.git
cd framework
cp .env.example .env

# Start all services (PostgreSQL, GoTrue, MCP server)
docker compose up -d

# Run database migrations
docker compose exec app php artisan migrate --seed</pre>
                </div>
            </div>

            <div>
                <h3 class="text-lg font-semibold text-white mb-3">Migrations</h3>
                <p class="text-brand-text-secondary leading-relaxed mb-3">Database migrations create all required tables for organizations, users, tokens, agents, tasks, memory, and more:</p>
                <div class="bg-brand-card rounded-lg border border-brand-border p-4 font-mono text-sm text-brand-text overflow-x-auto">
<pre class="whitespace-pre">php artisan migrate        # Apply all migrations
php artisan migrate:status # Check migration status
php artisan db:seed        # Seed default data</pre>
                </div>
            </div>

            <div>
                <h3 class="text-lg font-semibold text-white mb-3">Configuration</h3>
                <p class="text-brand-text-secondary leading-relaxed mb-3">Key environment variables for self-hosted deployments:</p>
                <div class="bg-brand-card rounded-lg border border-brand-border divide-y divide-brand-border">
                    <div class="px-4 py-3 flex items-start gap-4">
                        <code class="text-brand-cyan text-sm shrink-0">APP_URL</code>
                        <span class="text-xs text-brand-text-secondary">Base URL of your Orchestra MCP instance</span>
                    </div>
                    <div class="px-4 py-3 flex items-start gap-4">
                        <code class="text-brand-cyan text-sm shrink-0">DB_CONNECTION</code>
                        <span class="text-xs text-brand-text-secondary">Database driver (pgsql recommended)</span>
                    </div>
                    <div class="px-4 py-3 flex items-start gap-4">
                        <code class="text-brand-cyan text-sm shrink-0">SUPABASE_URL</code>
                        <span class="text-xs text-brand-text-secondary">Your Supabase instance URL for auth and realtime</span>
                    </div>
                    <div class="px-4 py-3 flex items-start gap-4">
                        <code class="text-brand-cyan text-sm shrink-0">SUPABASE_KEY</code>
                        <span class="text-xs text-brand-text-secondary">Supabase service role key</span>
                    </div>
                    <div class="px-4 py-3 flex items-start gap-4">
                        <code class="text-brand-cyan text-sm shrink-0">GITHUB_CLIENT_ID</code>
                        <span class="text-xs text-brand-text-secondary">GitHub OAuth app client ID (for login and repo access)</span>
                    </div>
                    <div class="px-4 py-3 flex items-start gap-4">
                        <code class="text-brand-cyan text-sm shrink-0">STRIPE_KEY</code>
                        <span class="text-xs text-brand-text-secondary">Stripe publishable key (for billing, optional)</span>
                    </div>
                </div>
            </div>
        </div>
    </section>

    {{-- API Reference --}}
    <section id="api-reference" class="mt-16">
        <h2 class="text-2xl font-bold text-white mb-6 pb-2 border-b border-brand-border">API Reference</h2>

        <div class="space-y-8">
            <div>
                <h3 class="text-lg font-semibold text-white mb-3">MCP Protocol</h3>
                <p class="text-brand-text-secondary leading-relaxed mb-3">Orchestra MCP implements the <a href="https://modelcontextprotocol.io" class="text-brand-cyan hover:underline" target="_blank">Model Context Protocol</a> (MCP) specification. Clients connect via Server-Sent Events (SSE) for real-time bidirectional communication.</p>
            </div>

            <div>
                <h3 class="text-lg font-semibold text-white mb-3">SSE Endpoint</h3>
                <p class="text-brand-text-secondary leading-relaxed mb-3">Connect to the MCP SSE endpoint to establish a persistent connection:</p>
                <div class="bg-brand-card rounded-lg border border-brand-border p-4 font-mono text-sm text-brand-text overflow-x-auto">
<pre class="whitespace-pre">GET /mcp/sse
Authorization: Bearer orch_live_xxxx...
Accept: text/event-stream</pre>
                </div>
                <p class="mt-3 text-brand-text-secondary text-sm">The SSE endpoint returns a stream of events including tool results, notifications, and status updates.</p>
            </div>

            <div>
                <h3 class="text-lg font-semibold text-white mb-3">Token Authentication</h3>
                <p class="text-brand-text-secondary leading-relaxed mb-3">All API requests require a valid MCP token in the Authorization header. Tokens are scoped to a user and organization.</p>
                <div class="bg-brand-card rounded-lg border border-brand-border p-4 font-mono text-sm text-brand-text overflow-x-auto">
<pre class="whitespace-pre"># Create a token via the dashboard, then use it:
curl -H "Authorization: Bearer orch_live_xxxx..." \
     https://your-instance.orchestra-mcp.com/mcp/sse</pre>
                </div>
                <div class="mt-4 bg-brand-card rounded-lg border border-brand-border p-4">
                    <p class="text-sm text-brand-text-secondary"><strong class="text-white">Token prefixes:</strong> Live tokens use <code class="text-brand-cyan">orch_live_</code> and test tokens use <code class="text-brand-cyan">orch_test_</code>. Tokens can be revoked at any time from the dashboard.</p>
                </div>
            </div>
        </div>
    </section>
</x-layouts.docs>
