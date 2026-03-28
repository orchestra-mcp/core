---
description: "DOD: task is not done until tests pass, documentation is written in /docs/, and code quality checks pass."
globs: "*"
alwaysApply: true
---

# Rule 6: Definition of Done (DOD)

A task is NOT done until ALL of the following are met:

## 1. Tests Pass

Write tests appropriate to the language and framework:

- **PHP/Laravel**: Pest tests (`php artisan test --compact`)
- **Go**: `go test ./... -v -race`
- **Rust**: `cargo test`
- **JavaScript/Node**: `npm test` or `npx vitest`
- **Flutter**: `flutter test`

Tests must be written BEFORE marking the task as complete. Run the tests and confirm they pass.

## 2. Documentation Created

After every plan completion, create documentation in `/docs/`:

```
/docs/
  {plan-name}/              # Subfolder matching the plan
    {feature-name}.md       # One file per feature
```

Each feature doc must include:

- **Overview** — what the feature does
- **How to Use** — usage examples, API endpoints, commands
- **How to Develop** — where the code lives, how to extend it
- **How It Works** — internal architecture, data flow

Write for a technical audience — clear, scannable, no fluff.

## 3. Code Quality

- Code formatted per project standards (e.g., `vendor/bin/pint --dirty --format agent` for PHP).
- No security vulnerabilities introduced.
- Follows existing project conventions.
