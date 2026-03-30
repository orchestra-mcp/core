---
description: 'Always ask the user to review the plan before starting implementation using AskUserQuestion.'
globs: '*'
alwaysApply: true
---

# Rule 3: Plan Review Before Execution

- After writing the plan to `.plans/`, **always ask the user for review** using `AskUserQuestion`.
- Present the plan summary and ask: "Does this plan look good to proceed?"
- Options: "Approve", "Needs Changes", "Let's Discuss"
- Do NOT start implementation until the user approves.
- If the user requests changes, update the plan file and ask again.
