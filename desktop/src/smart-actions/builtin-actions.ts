// Orchestra Desktop -- Built-in Smart Actions
//
// These ship with the app and can be disabled but not deleted.

import type { SmartAction } from './types'

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

export const BUILTIN_ACTIONS: SmartAction[] = [
  // ── Git ────────────────────────────────────────────────
  {
    id: 'builtin-git-status',
    name: 'Git Status',
    description: 'Show current git status of the workspace',
    icon: '\uD83D\uDD00',
    category: 'Git',
    steps: [{ id: uid(), type: 'shell', shell: 'git status', label: 'git status' }],
    enabled: true,
    builtin: true,
  },
  {
    id: 'builtin-git-commit',
    name: 'Git Commit',
    description: 'Stage all changes and commit with a message',
    icon: '\u2714\uFE0F',
    category: 'Git',
    steps: [
      {
        id: uid(),
        type: 'prompt',
        prompt: 'Enter commit message:',
        label: 'Ask for commit message',
      },
      {
        id: uid(),
        type: 'shell',
        shell: 'git add -A && git commit -m "{{input}}"',
        label: 'git add + commit',
      },
    ],
    enabled: true,
    builtin: true,
  },
  {
    id: 'builtin-git-push',
    name: 'Git Push',
    description: 'Push commits to the remote repository',
    icon: '\uD83D\uDE80',
    category: 'Git',
    steps: [{ id: uid(), type: 'shell', shell: 'git push', label: 'git push' }],
    enabled: true,
    builtin: true,
  },
  {
    id: 'builtin-git-pull',
    name: 'Git Pull',
    description: 'Pull latest changes from the remote',
    icon: '\u2B07\uFE0F',
    category: 'Git',
    steps: [{ id: uid(), type: 'shell', shell: 'git pull', label: 'git pull' }],
    enabled: true,
    builtin: true,
  },
  {
    id: 'builtin-git-log',
    name: 'Git Log (recent)',
    description: 'Show last 15 commits in short format',
    icon: '\uD83D\uDCDC',
    category: 'Git',
    steps: [
      {
        id: uid(),
        type: 'shell',
        shell: 'git log --oneline -15',
        label: 'git log --oneline',
      },
    ],
    enabled: true,
    builtin: true,
  },

  // ── Build / Run ────────────────────────────────────────
  {
    id: 'builtin-run-tests',
    name: 'Run Tests',
    description: 'Auto-detect test runner and execute tests',
    icon: '\uD83E\uDDEA',
    category: 'Build',
    steps: [
      {
        id: uid(),
        type: 'shell',
        shell: [
          'if [ -f "go.mod" ]; then go test ./... -v -count=1;',
          'elif [ -f "Cargo.toml" ]; then cargo test;',
          'elif [ -f "package.json" ]; then npm test;',
          'elif [ -f "artisan" ]; then php artisan test --compact;',
          'elif [ -f "pubspec.yaml" ]; then flutter test;',
          'else echo "No test framework detected"; fi',
        ].join(' '),
        label: 'Auto-detect and run tests',
      },
    ],
    enabled: true,
    builtin: true,
  },
  {
    id: 'builtin-format-code',
    name: 'Format Code',
    description: 'Auto-detect formatter and format the project',
    icon: '\u2728',
    category: 'Build',
    steps: [
      {
        id: uid(),
        type: 'shell',
        shell: [
          'if [ -f "go.mod" ]; then gofmt -w .;',
          'elif [ -f "Cargo.toml" ]; then cargo fmt;',
          'elif [ -f "package.json" ]; then npx prettier --write .;',
          'elif [ -f "artisan" ]; then vendor/bin/pint;',
          'else echo "No formatter detected"; fi',
        ].join(' '),
        label: 'Auto-detect and format',
      },
    ],
    enabled: true,
    builtin: true,
  },
  {
    id: 'builtin-build',
    name: 'Build Project',
    description: 'Auto-detect build system and run build',
    icon: '\uD83D\uDCE6',
    category: 'Build',
    steps: [
      {
        id: uid(),
        type: 'shell',
        shell: [
          'if [ -f "go.mod" ]; then go build ./...;',
          'elif [ -f "Cargo.toml" ]; then cargo build;',
          'elif [ -f "package.json" ]; then npm run build;',
          'elif [ -f "pubspec.yaml" ]; then flutter build;',
          'else echo "No build system detected"; fi',
        ].join(' '),
        label: 'Auto-detect and build',
      },
    ],
    enabled: true,
    builtin: true,
  },
  {
    id: 'builtin-deploy',
    name: 'Deploy',
    description: 'Run deploy script if it exists',
    icon: '\uD83C\uDF10',
    category: 'Build',
    steps: [
      {
        id: uid(),
        type: 'shell',
        shell: [
          'if [ -f "deploy.sh" ]; then bash deploy.sh;',
          'elif [ -f "bin/deploy" ]; then bash bin/deploy;',
          'elif grep -q \'"deploy"\' package.json 2>/dev/null; then npm run deploy;',
          'else echo "No deploy script found"; fi',
        ].join(' '),
        label: 'Run deploy script',
      },
    ],
    enabled: true,
    builtin: true,
  },

  // ── MCP ────────────────────────────────────────────────
  {
    id: 'builtin-mcp-connect',
    name: 'Test MCP Connection',
    description: 'Test connection to the MCP server',
    icon: '\u26A1',
    category: 'MCP',
    steps: [
      {
        id: uid(),
        type: 'command',
        command: 'mcp_test_connection',
        args: { server_url: '', token: '' },
        label: 'Test MCP connection',
      },
    ],
    enabled: true,
    builtin: true,
  },

  // ── Templates ──────────────────────────────────────────
  {
    id: 'builtin-create-agent',
    name: 'Create Agent',
    description: 'Create a new .claude/agents/ markdown file',
    icon: '\uD83E\uDD16',
    category: 'Template',
    steps: [
      {
        id: uid(),
        type: 'prompt',
        prompt: 'Agent filename (e.g. my-agent):',
        label: 'Ask agent name',
      },
      {
        id: uid(),
        type: 'file',
        filePath: '.claude/agents/{{input}}.md',
        content: [
          '# Agent: {{input}}',
          '',
          '## Role',
          '',
          'Describe what this agent does.',
          '',
          '## Capabilities',
          '',
          '- Capability 1',
          '- Capability 2',
          '',
          '## Instructions',
          '',
          'Detailed instructions for the agent.',
          '',
        ].join('\n'),
        label: 'Create agent file',
      },
    ],
    enabled: true,
    builtin: true,
  },
  {
    id: 'builtin-create-skill',
    name: 'Create Skill',
    description: 'Create a new .claude/skills/ directory with prompt.md',
    icon: '\u26A1',
    category: 'Template',
    steps: [
      {
        id: uid(),
        type: 'prompt',
        prompt: 'Skill name (e.g. my-skill):',
        label: 'Ask skill name',
      },
      {
        id: uid(),
        type: 'shell',
        shell: 'mkdir -p ".claude/skills/{{input}}"',
        label: 'Create skill directory',
      },
      {
        id: uid(),
        type: 'file',
        filePath: '.claude/skills/{{input}}/prompt.md',
        content: [
          '# Skill: {{input}}',
          '',
          '## Description',
          '',
          'What this skill does.',
          '',
          '## When to activate',
          '',
          'Conditions that trigger this skill.',
          '',
          '## Instructions',
          '',
          'Step-by-step instructions.',
          '',
        ].join('\n'),
        label: 'Create skill prompt.md',
      },
    ],
    enabled: true,
    builtin: true,
  },
  {
    id: 'builtin-create-rule',
    name: 'Create Rule',
    description: 'Create a new .claude/rules/ markdown file',
    icon: '\uD83D\uDCCF',
    category: 'Template',
    steps: [
      {
        id: uid(),
        type: 'prompt',
        prompt: 'Rule number and name (e.g. 12-my-rule):',
        label: 'Ask rule name',
      },
      {
        id: uid(),
        type: 'file',
        filePath: '.claude/rules/{{input}}.md',
        content: [
          '# Rule: {{input}}',
          '',
          '## Description',
          '',
          'What this rule enforces.',
          '',
          '## Requirements',
          '',
          '- Requirement 1',
          '- Requirement 2',
          '',
        ].join('\n'),
        label: 'Create rule file',
      },
    ],
    enabled: true,
    builtin: true,
  },
]
