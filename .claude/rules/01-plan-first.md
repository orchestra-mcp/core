---
description: "Enforces plan-first development. Never start implementation before saving a plan to .plans/ directory."
globs: "*"
alwaysApply: true
---

# Rule 1: Plan-First Development

**Never start implementation before saving a plan.**

- Before writing any code, create a plan file in `.plans/` at the project root.
- Plan filename format: `YYYY-MM-DD-{kebab-case-title}.md`
- The plan file must include:
  - **Title** and **Date**
  - **Objective** — what we are building and why
  - **Features** — broken down into discrete, deliverable features (see Rule 2)
  - **Small Wins** — each feature must identify its small win milestone (see Rule 9)
  - **DOD (Definition of Done)** — per-feature and overall (see Rule 6)
  - **Technical Notes** — architecture, dependencies, risks

## Plan Template

```markdown
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
```
