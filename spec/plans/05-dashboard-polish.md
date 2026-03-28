# Plan 05: Laravel Dashboard & Polish (Phase 5)

**Duration:** Days 19-24
**Depends on:** Plan 02 (Auth), Plan 03 (MCP Server)
**Goal:** Production-ready web presence + admin panel

---

## Tasks

### 5.1 Dashboard Home
- [ ] `DashboardController@index` — main dashboard view
- [ ] Livewire `ConnectionStatus` — live MCP connection indicator (checks agent_sessions)
- [ ] Livewire `UsageStats` — tasks count, agents count, memory usage vs plan limits
- [ ] Livewire `RecentActivity` — activity feed with agent/project filters
- [ ] Dashboard cards styled per Filament reference (clean, rounded, shadow)

### 5.2 Token Management
- [ ] Full token management page (`/dashboard/tokens`)
- [ ] Livewire `TokenList` — table with name, prefix, last used, usage count, created at
- [ ] Livewire `CreateToken` — modal with name input, shows token once
- [ ] Revoke token action with confirmation
- [ ] Token scopes display

### 5.3 Team Management
- [ ] Team page (`/dashboard/team`)
- [ ] Livewire `MemberList` — table of team members with roles
- [ ] Livewire `InviteMember` — invite by email with role selection
- [ ] Role management: owner, admin, member, viewer
- [ ] Remove member action (owner/admin only)

### 5.4 Landing Page (SEO-optimized)
- [ ] Hero section with gradient treatment (Laravel.com reference)
- [ ] "Turn Claude into your 24/7 company OS" headline
- [ ] Feature grid: MCP tools, team sync, agent memory, task management (Supabase.com reference)
- [ ] Code block showing connection config
- [ ] CTA: "Get Started Free"
- [ ] SEO meta tags, Open Graph image from `arts/og-image.png`
- [ ] Responsive design (mobile-first)

### 5.5 Pricing Page
- [ ] Plan comparison table (Free, Pro $29, Team $99, Enterprise)
- [ ] Feature breakdown per plan
- [ ] Stripe Checkout integration for Pro and Team
- [ ] "Contact Sales" for Enterprise
- [ ] Plan limits clearly displayed
- [ ] Pricing table styled per Supabase.com reference

### 5.6 Documentation Pages
- [ ] Docs layout with sidebar navigation (`docs.blade.php`)
- [ ] Getting Started guide (register -> token -> connect Claude)
- [ ] Tools Reference (list of all MCP tools with params)
- [ ] Self-Hosted guide
- [ ] API Reference
- [ ] Clean docs layout per Inertia.js reference
- [ ] Code syntax highlighting

### 5.7 Billing Management
- [ ] Livewire `SubscriptionManager` — current plan, usage, upgrade/downgrade
- [ ] Stripe Customer Portal link for payment method management
- [ ] Usage breakdown: tasks this month, memory used, active agents
- [ ] Plan limit warnings (approaching limits)

### 5.8 Settings Page
- [ ] Profile settings: name, avatar, timezone, language (en/ar)
- [ ] Organization settings: name, logo, description
- [ ] GitHub connection management
- [ ] Danger zone: delete account, leave organization

### 5.9 Studio Custom Pages
- [ ] Dashboard Overview — active connections, tasks/day chart, revenue, system health
- [ ] Organizations — list all orgs, change plans, set limits, view members
- [ ] MCP Tokens — all active tokens with usage stats, revoke action
- [ ] Agents Monitor — list agents, current status, recent activity per agent
- [ ] Active Sessions — live view via Realtime subscription
- [ ] Activity Feed — global activity stream with filters
- [ ] Billing — Stripe subscription data, usage per org
- [ ] Feature Flags — toggle features per org

### 5.10 Studio Navigation Update
- [ ] Restructure sidebar per PRD Section 8.3
- [ ] Add Orchestra section: Organizations, Tokens, Agents, Sessions, Activity, Workflows
- [ ] Keep existing sections: Database, Auth, Storage, Edge Functions, Realtime, API
- [ ] Add Billing section
- [ ] Add Settings section with Feature Flags and System Health

---

## Acceptance Criteria
- Dashboard shows live connection status, usage stats, recent activity
- Token CRUD works end-to-end
- Team invite and management works
- Landing page is responsive, SEO-optimized, professionally designed
- Pricing page shows all plans with Stripe checkout
- Docs cover getting started, tools reference, self-hosting
- Studio has all custom pages with Orchestra branding
