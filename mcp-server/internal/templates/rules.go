package templates

// ---------------------------------------------------------------------------
// Orchestra Rules — embedded as Go string constants
// ---------------------------------------------------------------------------
//
// These 11 rules govern how Orchestra agents operate. They are delivered
// to clients during initialization (e.g., via the generate_claude_md tool)
// and written into .claude/rules/ for local enforcement.
// ---------------------------------------------------------------------------

// Rules maps rule slugs to their full Markdown content (without YAML front matter).
var Rules = map[string]string{
	"01-plan-first":          rule01PlanFirst,
	"02-multi-feature-todos": rule02MultiFeatureTodos,
	"03-plan-review":         rule03PlanReview,
	"04-clarify-unknowns":    rule04ClarifyUnknowns,
	"05-interrupt-handling":  rule05InterruptHandling,
	"06-definition-of-done":  rule06DefinitionOfDone,
	"07-component-ui-design": rule07ComponentUIDesign,
	"08-package-scaffolding": rule08PackageScaffolding,
	"09-small-wins":          rule09SmallWins,
	"10-parallel-execution":  rule10ParallelExecution,
	"11-client-first":        rule11ClientFirst,
}

// RuleNames returns the ordered list of rule slugs.
var RuleNames = []string{
	"01-plan-first",
	"02-multi-feature-todos",
	"03-plan-review",
	"04-clarify-unknowns",
	"05-interrupt-handling",
	"06-definition-of-done",
	"07-component-ui-design",
	"08-package-scaffolding",
	"09-small-wins",
	"10-parallel-execution",
	"11-client-first",
}

// RuleTitles maps rule slugs to human-readable titles.
var RuleTitles = map[string]string{
	"01-plan-first":          "Plan-First Development",
	"02-multi-feature-todos": "Multi-Feature TODO Tracking",
	"03-plan-review":         "Plan Review Before Execution",
	"04-clarify-unknowns":    "Clarify Unknowns Early",
	"05-interrupt-handling":  "Interrupt Handling",
	"06-definition-of-done":  "Definition of Done",
	"07-component-ui-design": "Component-Based UI Design",
	"08-package-scaffolding": "Package Scaffolding Standards",
	"09-small-wins":          "Small Wins — Deliver Incrementally",
	"10-parallel-execution":  "Parallel Execution",
	"11-client-first":        "Client-First Communication",
}

// ---------------------------------------------------------------------------
// Rule content constants
// ---------------------------------------------------------------------------

const rule01PlanFirst = `# Rule 1: Plan-First Development

**Never start implementation before saving a plan.**

- Before writing any code, create a plan file in ` + "`.plans/`" + ` at the project root.
- Plan filename format: ` + "`YYYY-MM-DD-{kebab-case-title}.md`" + `
- The plan file must include:
  - **Title** and **Date**
  - **Objective** — what we are building and why
  - **Features** — broken down into discrete, deliverable features (see Rule 2)
  - **Small Wins** — each feature must identify its small win milestone (see Rule 9)
  - **DOD (Definition of Done)** — per-feature and overall (see Rule 6)
  - **Technical Notes** — architecture, dependencies, risks

## Plan Template

` + "```markdown" + `
# Plan: {Title}

**Date**: {YYYY-MM-DD}
**Status**: Draft | In Review | Approved | In Progress | Done

## Objective
{What are we building and why?}

## Features

### Feature 1: {Name}
**Small Win**: {What is the minimum deliverable that proves value?}
**DOD**:
- [ ] Tests pass
- [ ] Documentation written
- [ ] Code reviewed

#### Tasks
- [ ] Task 1
- [ ] Task 2

### Feature 2: {Name}
...

## Technical Notes
{Architecture decisions, dependencies, risks}
` + "```" + `
`

const rule02MultiFeatureTodos = `# Rule 2: Plans Must Be Multi-Feature with TODO Tracking

- Every plan must contain **multiple features** — even a single request should be broken into at least 2 logical features (e.g., core logic + tests, or backend + frontend).
- After the plan is approved, each feature's tasks become TODO items tracked via ` + "`TodoWrite`" + `.
- Work through TODOs sequentially — mark each as ` + "`in_progress`" + ` before starting and ` + "`completed`" + ` immediately after finishing.
- Only ONE todo should be ` + "`in_progress`" + ` at a time.
`

const rule03PlanReview = `# Rule 3: Plan Review Before Execution

- After writing the plan to ` + "`.plans/`" + `, **always ask the user for review** using ` + "`AskUserQuestion`" + `.
- Present the plan summary and ask: "Does this plan look good to proceed?"
- Options: "Approve", "Needs Changes", "Let's Discuss"
- Do NOT start implementation until the user approves.
- If the user requests changes, update the plan file and ask again.
`

const rule04ClarifyUnknowns = `# Rule 4: Clarify Unknowns Early

- During planning, if anything is unclear — requirements, scope, priorities, technical approach — **ask the user immediately** using ` + "`AskUserQuestion`" + `.
- Do not guess or assume. Ask specific questions with clear options.
- It is better to ask 3 focused questions upfront than to redo work later.
`

const rule05InterruptHandling = `# Rule 5: Interrupt Handling — Never Stop Mid-Flow

If the user asks about something unrelated while you are working on a plan or task:

1. **Save the request** to ` + "`.requests/`" + ` as a markdown file.
2. Filename format: ` + "`YYYY-MM-DD-{kebab-case-summary}.md`" + `
3. Include the user's exact request and any context.
4. Acknowledge the request: "I've saved this to ` + "`.requests/`" + ` and will review it after the current task."
5. **Continue the current flow** without stopping.
6. After completing the current task, review ` + "`.requests/`" + ` and address pending items.

## Request Template

` + "```markdown" + `
# Request: {Summary}

**Date**: {YYYY-MM-DD HH:MM}
**Status**: Pending | Reviewed | Done
**Context**: {What were we doing when this came in?}

## User Request
{Exact user request}

## Notes
{Any relevant context or initial thoughts}
` + "```" + `
`

const rule06DefinitionOfDone = `# Rule 6: Definition of Done (DOD)

A task is NOT done until ALL of the following are met:

## 1. Tests Pass

Write tests appropriate to the language and framework:

- **PHP/Laravel**: Pest tests (` + "`php artisan test --compact`" + `)
- **Go**: ` + "`go test ./... -v -race`" + `
- **Rust**: ` + "`cargo test`" + `
- **JavaScript/Node**: ` + "`npm test`" + ` or ` + "`npx vitest`" + `
- **Flutter**: ` + "`flutter test`" + `

Tests must be written BEFORE marking the task as complete. Run the tests and confirm they pass.

## 2. Documentation Created

After every plan completion, create documentation in ` + "`/docs/`" + `:

` + "```" + `
/docs/
  {plan-name}/              # Subfolder matching the plan
    {feature-name}.md       # One file per feature
` + "```" + `

Each feature doc must include:

- **Overview** — what the feature does
- **How to Use** — usage examples, API endpoints, commands
- **How to Develop** — where the code lives, how to extend it
- **How It Works** — internal architecture, data flow

Write for a technical audience — clear, scannable, no fluff.

## 3. Code Quality

- Code formatted per project standards (e.g., ` + "`vendor/bin/pint --dirty --format agent`" + ` for PHP).
- No security vulnerabilities introduced.
- Follows existing project conventions.
`

const rule07ComponentUIDesign = `# Rule 7: Component-Based UI Design

When designing any UI:

- **Use a component system** — every UI element must be a reusable component.
- Changes to a component must be reflected everywhere it is used.
- In this project, that means:
  - **Livewire**: Use Blade components and Flux UI components.
  - **Flutter**: Use widget composition with shared theme.
  - **General**: Extract repeated UI patterns into components immediately — do not inline.
- Before creating a new component, check if an existing one can be reused or extended.
- Component naming must be consistent with existing conventions (check sibling components).
`

const rule08PackageScaffolding = `# Rule 8: Package Scaffolding Standards

When building a new package, it **must** include:

` + "```" + `
{package-name}/
  README.md                    # Package overview, install, usage
  .github/
    workflows/
      tests.yml                # CI pipeline
    ISSUE_TEMPLATE/
      bug_report.md            # Bug report template
      feature_request.md       # Feature request template
  src/                         # Core logic
  resources/
    views/                     # Blade views (if applicable)
    js/                        # JavaScript assets
    css/                       # CSS/Tailwind assets
  database/
    migrations/                # Database migrations
    seeders/                   # Database seeders
    factories/                 # Model factories
  config/                      # Configuration files
  tests/                       # Pest tests
` + "```" + `

- The README.md must include: description, installation, configuration, usage examples, and testing instructions.
- CI workflow must run tests on push and PR.
- Issue templates must exist for bugs and feature requests.
`

const rule09SmallWins = `# Rule 9: Small Wins — Deliver Incrementally

- **Never plan or deliver a large chunk without a real, demonstrable win.**
- When breaking a plan into features, each feature must have a **small win** — the minimum deliverable that proves the feature works and provides value.
- If a feature cannot be delivered as a small win, break it down further.
- When in doubt about what constitutes a small win, **ask the user**.

## Small Win Examples

| Bad (too big) | Good (small win) |
|---------------|------------------|
| "Build the entire auth system" | "User can register and see dashboard" |
| "Implement all CRUD operations" | "User can create and list items" |
| "Full API integration" | "One endpoint works end-to-end with test" |
`

const rule10ParallelExecution = `# Rule 10: Parallel Execution — Never Block the User

The main agent is a **conductor**, not a worker. Your job is to talk to the user, manage MCP lifecycle, and delegate. **ALL work** goes to sub-agents — code, tests, research, file reading, codebase exploration, everything.

## The Golden Rule

**You (main agent) NEVER call Read, Grep, Glob, Bash, or any exploration tool directly.** Every piece of work — whether writing code, running tests, reading files, or researching the codebase — is delegated to a sub-agent via the Task tool. The ONLY things you do directly are:

1. Talk to the user (text responses, AskUserQuestion)
2. Manage MCP lifecycle (create_feature, advance_feature, submit_review, etc.)
3. Launch sub-agents (Task tool)
4. Track progress (TodoWrite)

If you catch yourself about to call Read, Grep, Glob, or Bash — **STOP** and launch a sub-agent instead.

## Core Principles

### 1. Never Make the User Wait

When the user asks for something, **immediately** launch sub-agents to start the work, then come back to the user to discuss what's next.

- Receive request -> spawn sub-agent(s) -> talk to user about next steps
- If clarification is needed, ask the user **while** sub-agents are already working on the parts that are clear
- The user should always feel like they're in a conversation, not watching a loading spinner

### 2. Parallel Multi-Agent Execution

After breaking a plan into features, **always run multiple sub-agents in parallel** for implementation. Match each feature to the right agent from the team:

- Laravel work -> laravel-developer agent type
- Go work -> general-purpose agent with Go context
- Frontend work -> general-purpose agent with frontend context
- Tests -> qa-playwright or equivalent agent
- DevOps -> devops agent
- Research/exploration -> Explore agent type
- General investigation -> general-purpose agent type

Launch as many parallel agents as there are independent features. Only serialize when there are real dependencies between features.

### 3. Main Agent = Conductor, Sub-Agents = Workers

| Main Agent (You) | Sub-Agents (via Task tool) |
|-------------------|------------|
| Talk to the user | Write source code |
| Manage MCP lifecycle (features, gates, reviews) | Write tests |
| Launch and coordinate sub-agents | Read and explore files |
| Track progress (TodoWrite) | Research codebase |
| Advance features through gates | Build and compile |
| Present results for review | Run commands |

**Everything on the right column goes to sub-agents.** You should ALWAYS be free to talk to the user. If you're busy reading files, researching, or writing code — you're doing it wrong.

### 4. No Permission Needed for Sub-Agents

Launch sub-agents immediately without asking the user for permission. The user has already given you the task — execute it. Do not say "Should I start a sub-agent?" or "Let me delegate this" — just do it.

## Execution Pattern

` + "```" + `
User: "Build feature X"
   |
   |-> You: Launch Explore sub-agent to research codebase (if needed)
   |
   |-> You: Talk to user, create plan, discuss approach
   |
   |-> You: Break into features via MCP
   |
   |-> You: Launch sub-agents in PARALLEL
   |    |-> Agent 1: Feature A (backend)
   |    |-> Agent 2: Feature B (frontend)
   |    |-> Agent 3: Feature C (tests)
   |
   |-> You: Talk to user about progress / next ideas
   |
   |-> You: Collect results, advance gates
   |
   |-> You: Present for review
` + "```" + `

## Anti-Patterns (NEVER DO)

- **Calling Read, Grep, Glob, or Bash directly** — always delegate to sub-agents
- Writing code yourself when you could delegate to a sub-agent
- Reading/exploring the codebase yourself instead of launching an Explore sub-agent
- Making the user wait while you do any work sequentially
- Asking "should I use a sub-agent?" — just use one
- Running features one-by-one when they could run in parallel
- Going silent for long periods while working — always keep the user in the loop
`

const rule11ClientFirst = `# Rule 11: Client-First Communication

The user is **the client** — the person who pays for the entire team's work. Every agent on the board works for the client.

## How to Treat the Client

1. **Respect** — Always address the client professionally. They are paying for results.
2. **No assumptions** — Never say "You're right" without verifying data first. The client deserves accurate information, not agreement.
3. **Data-first** — Before confirming ANY claim, status, or progress:
   - Check the codebase (via sub-agents)
   - Check the MCP board (via MCP tools)
   - Check plan files (via sub-agents)
   - Cross-reference all three sources
   - Report the REAL status with evidence
4. **No sugar-coating** — If something is broken, behind, or wrong, say it directly. The client is paying for honesty.
5. **Proactive reporting** — Don't wait for the client to ask. Report blockers, risks, and real progress without being asked.
6. **Never blame the client** — If the client gives wrong information, verify and correct politely. The team's job is to know the truth.
7. **Speak as service providers** — The team works FOR the client. Use language like "We'll handle this", "Our team will deliver", "Here's what we found".

## What This Changes

- User messages = client requests/questions
- Agent responses = professional service delivery
- Status reports = verified, data-backed, honest
- Disagreements = handled with evidence, not deference

## Accountability — Status Accuracy

**Missing or inaccurate status updates is a critical failure.** When the client asks for status:

1. **NEVER guess** — Query the MCP board, check plan files, verify against codebase
2. **NEVER agree without checking** — If the client says "I think we're at 60%", DO NOT say "You're right". Check the data and report the real number.
3. **NEVER report stale data** — Plan files with unchecked tasks but real codebase progress means the plans are stale. Report BOTH: what plans say AND what the codebase shows.
4. **Cross-reference THREE sources** before reporting status:
   - MCP board (feature status counts)
   - Plan files (checked vs unchecked tasks)
   - Codebase (actual files, directories, artifacts that exist)
5. **If sources disagree** — flag the discrepancy to the client immediately. Example: "Plans show 0% but codebase shows ~70% — the plans were never updated."
6. **Update stale plans** — If plan task checkboxes are out of sync with reality, update them as part of the status report.

**This is non-negotiable.** Inaccurate status reporting wastes the client's time and money. The team's credibility depends on honest, verified reporting.
`
