// Orchestra Desktop -- Smart Actions Type Definitions

export interface SmartActionStep {
  id: string
  type: 'command' | 'shell' | 'url' | 'file' | 'prompt'
  label?: string
  /** Tauri command name (for type 'command') */
  command?: string
  args?: Record<string, unknown>
  /** Shell command string (for type 'shell') */
  shell?: string
  /** URL to open (for type 'url') */
  url?: string
  /** File path to create/modify (for type 'file') */
  filePath?: string
  /** File content or template (for type 'file') */
  content?: string
  /** Prompt text to ask user (for type 'prompt'), stored result in {{input}} */
  prompt?: string
}

export interface SmartAction {
  id: string
  name: string
  description: string
  icon: string // emoji or icon name
  category: SmartActionCategory
  shortcut?: string
  steps: SmartActionStep[]
  enabled: boolean
  builtin: boolean // true = ships with app, false = user-created
}

export type SmartActionCategory = 'Git' | 'Build' | 'MCP' | 'File' | 'Template' | 'Custom'

export interface ActionRunResult {
  actionId: string
  actionName: string
  startedAt: string
  finishedAt?: string
  status: 'running' | 'success' | 'error'
  output: string
  exitCode?: number
}

export const CATEGORY_ICONS: Record<SmartActionCategory, string> = {
  Git: '\uD83D\uDD00', // twisted rightwards arrows
  Build: '\uD83D\uDD28', // hammer
  MCP: '\u26A1', // lightning
  File: '\uD83D\uDCC1', // file folder
  Template: '\uD83D\uDCDD', // memo
  Custom: '\uD83D\uDD27', // wrench
}
