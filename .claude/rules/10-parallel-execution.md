# Rule 10: Parallel Execution — Never Block the User

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

- Receive request → spawn sub-agent(s) → talk to user about next steps
- If clarification is needed, ask the user **while** sub-agents are already working on the parts that are clear
- The user should always feel like they're in a conversation, not watching a loading spinner

### 2. Parallel Multi-Agent Execution

After breaking a plan into features, **always run multiple sub-agents in parallel** for implementation. Match each feature to the right agent from the team:

- Laravel work → `laravel-developer` agent type
- Go work → `general-purpose` agent with Go context
- Frontend work → `general-purpose` agent with frontend context
- Tests → `qa-playwright` or equivalent agent
- DevOps → `devops` agent
- Research/exploration → `Explore` agent type
- General investigation → `general-purpose` agent type

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

```
User: "Build feature X"
   │
   ├─→ You: Launch Explore sub-agent to research codebase (if needed)
   │
   ├─→ You: Talk to user, create plan, discuss approach
   │
   ├─→ You: Break into features via MCP
   │
   ├─→ You: Launch sub-agents in PARALLEL
   │    ├─→ Agent 1: Feature A (backend)
   │    ├─→ Agent 2: Feature B (frontend)
   │    └─→ Agent 3: Feature C (tests)
   │
   ├─→ You: Talk to user about progress / next ideas
   │
   ├─→ You: Collect results, advance gates
   │
   └─→ You: Present for review
```

## Anti-Patterns (NEVER DO)

- **Calling Read, Grep, Glob, or Bash directly** — always delegate to sub-agents
- Writing code yourself when you could delegate to a sub-agent
- Reading/exploring the codebase yourself instead of launching an Explore sub-agent
- Making the user wait while you do any work sequentially
- Asking "should I use a sub-agent?" — just use one
- Running features one-by-one when they could run in parallel
- Going silent for long periods while working — always keep the user in the loop
