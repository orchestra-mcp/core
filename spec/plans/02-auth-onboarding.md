# Plan 02: Auth & Onboarding (Phase 2)

**Duration:** Days 4-7
**Depends on:** Plan 01 (Infrastructure)
**Goal:** User can register, create company, get MCP token, see connection instructions

---

## Tasks

### 2.1 Laravel Auth (Blade + Livewire 4)
- [ ] Create `LoginController` with Blade views
- [ ] Create `RegisterController` with Blade views
- [ ] Registration form: full_name, email, password, confirm_password
- [ ] Login form: email, password, "Login with GitHub" button
- [ ] Guest layout (`guest.blade.php`) with Orchestra branding
- [ ] Dashboard layout (`dashboard.blade.php`) with sidebar navigation
- [ ] Password reset flow (forgot-password, email link, reset form)

### 2.2 Supabase Auth Sync Service
- [ ] Create `SupabaseAuthService` — REST client for GoTrue Admin API
- [ ] On Laravel register: create user in Supabase GoTrue via Admin API
- [ ] Store `supabase_user_id` (UUID) on Laravel User model
- [ ] Supabase trigger auto-creates `profiles` row
- [ ] On Laravel login: generate Supabase JWT using `JWT_SECRET`
- [ ] Store JWT in Laravel session for Supabase API calls
- [ ] Create `SupabaseService` — REST client for Supabase PostgREST

### 2.3 GitHub OAuth
- [ ] Register GitHub OAuth App (callback: `/auth/callback/github`)
- [ ] Implement `SupabaseAuthController@callback` for GitHub
- [ ] On GitHub callback: create/login Laravel user + sync to Supabase
- [ ] Store GitHub username on profiles

### 2.4 Onboarding Flow (3-step Livewire wizard)
- [ ] `EnsureOnboarded` middleware — redirects to `/onboarding/company` if not onboarded
- [ ] Step 1 — Company Setup (`CompanySetup.php` Livewire):
  - Company name, slug (auto-generated), description
  - Creates `organizations` row + default `teams` row
  - Creates `team_members` row (owner role)
- [ ] Step 2 — Team Setup (`TeamSetup.php` Livewire):
  - Invite team members by email (optional, can skip)
  - Sets up additional team structure
- [ ] Step 3 — Connect Claude (`ConnectClaude.php` Livewire):
  - Auto-generates first MCP token
  - Shows connection instructions with copy-paste config
  - Shows `.mcp.json` config and `CLAUDE.md` snippet
  - Mark `profiles.onboarding_completed = true`

### 2.5 MCP Token Generation
- [ ] Create `TokenService`:
  - Generate token: `orch_` + 32 random hex chars
  - Store SHA-256 hash in `mcp_tokens.token_hash`
  - Store display prefix `orch_xxxxxxxx` in `token_prefix`
  - Return plain token only once (on creation)
- [ ] Livewire `CreateToken` component — modal with token name input
- [ ] Livewire `TokenList` component — list tokens with revoke action
- [ ] Token display page: show plain token with "copy" button, warn "won't be shown again"

### 2.6 Studio Auth Integration
- [ ] Modify Studio `_app.tsx` (or equivalent) to check for Supabase JWT
- [ ] If no JWT: redirect to `/studio/login`
- [ ] Studio login: authenticate via Supabase GoTrue API
- [ ] After auth: check `profiles.is_admin = true`
- [ ] If not admin: show "Access Denied" page
- [ ] If admin: load full Studio interface

### 2.7 Studio Branding Overhaul
- [ ] Replace Supabase logo with `arts/logo.svg` / `arts/logo-dark.svg`
- [ ] Replace favicon with `arts/icon.svg`
- [ ] Update color palette from `arts/colors.css`
- [ ] Update typography from `arts/fonts/`
- [ ] Change app name to "Orchestra Studio"
- [ ] Update title bar to "Orchestra Studio — Admin"

---

## Acceptance Criteria
- User registers at `/register`, profile created in both Laravel and Supabase
- User logs in at `/login`, session + Supabase JWT created
- GitHub OAuth login works end-to-end
- Onboarding wizard creates org, team, first MCP token
- Token displayed once with copy button, listed on dashboard
- Studio accessible at `/studio` with Orchestra branding, admin-only
