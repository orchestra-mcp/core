---
description: 'Use the correct AI model per agent role to save tokens and avoid rate limits. Opus for planning, Sonnet for code, Haiku for lookups.'
globs: '*'
alwaysApply: true
---

# Rule 13: Model Selection — Right Model for Right Job

## Model Assignments

| Model | Cost | Use For | Agent Roles |
|-------|------|---------|-------------|
| **Opus** | $$$ | Planning, architecture, meetings, complex decisions, code review | CTO, CEO, COO, CAO, Tech Leader, Product Owner, Software Architect |
| **Sonnet** | $$ | Code writing, refactoring, tests, implementation, design specs | All developers, QA, Security, AI, AgentOps, Design, Project Manager |
| **Haiku** | $ | Status checks, lookups, formatting, documentation, simple queries | Technical Writer, Brand, Marketing, Sales, Community, status tools |

## Rules

1. **Never use Opus for implementation** — code writing, file modifications, test writing all use Sonnet
2. **Never use Opus for data retrieval** — status checks, list queries, context loading use Haiku
3. **Opus is reserved for** — architecture decisions, plan review, meeting facilitation, complex reasoning
4. **Agent model is stored in DB** — each agent has a `model` field (opus/sonnet/haiku)
5. **Orchestrator respects model** — when spawning an agent, use the model from their DB record
6. **Max 2 Sonnet agents simultaneously** — prevents rate limit (see Rule 10)
7. **Haiku agents don't count toward limit** — they're lightweight, run freely
