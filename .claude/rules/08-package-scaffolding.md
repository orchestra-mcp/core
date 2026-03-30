---
description: 'New packages must include README, .github workflows, issue templates, and proper directory structure.'
globs: 'packages/**'
alwaysApply: true
---

# Rule 8: Package Scaffolding Standards

When building a new package, it **must** include:

```
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
```

- The `README.md` must include: description, installation, configuration, usage examples, and testing instructions.
- CI workflow must run tests on push and PR.
- Issue templates must exist for bugs and feature requests.
