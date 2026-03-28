---
description: "All UI must use a component system design so changes reflect everywhere the component is used."
globs: "*.blade.php,*.vue,*.tsx,*.jsx,*.dart"
alwaysApply: true
---

# Rule 7: Component-Based UI Design

When designing any UI:

- **Use a component system** — every UI element must be a reusable component.
- Changes to a component must be reflected everywhere it is used.
- In this project, that means:
  - **Livewire**: Use Blade components and Flux UI (`<flux:*>`) components.
  - **Flutter**: Use widget composition with shared theme.
  - **General**: Extract repeated UI patterns into components immediately — do not inline.
- Before creating a new component, check if an existing one can be reused or extended.
- Component naming must be consistent with existing conventions (check sibling components).
