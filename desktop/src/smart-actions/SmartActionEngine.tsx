// Orchestra Desktop -- Smart Action Engine
//
// Executes smart action steps sequentially, collecting output.
// Supports: shell commands, Tauri commands, URL open, file write, user prompt.

import { invoke } from '@tauri-apps/api/core'
import { open as shellOpen } from '@tauri-apps/plugin-shell'

import type { ActionRunResult, SmartAction, SmartActionStep } from './types'

type OutputCallback = (partial: ActionRunResult) => void

/** Execute a smart action, calling onOutput with live progress updates */
export async function executeAction(
  action: SmartAction,
  workspacePath: string | null,
  promptCallback: (prompt: string) => Promise<string>,
  onOutput: OutputCallback
): Promise<ActionRunResult> {
  const result: ActionRunResult = {
    actionId: action.id,
    actionName: action.name,
    startedAt: new Date().toISOString(),
    status: 'running',
    output: '',
  }

  onOutput({ ...result })

  let userInput = '' // stores the last user prompt result for {{input}} substitution

  try {
    for (const step of action.steps) {
      // Resolve {{input}} placeholders
      const resolved = resolveInputPlaceholders(step, userInput)

      result.output += `\n--- Step: ${resolved.label || resolved.type} ---\n`
      onOutput({ ...result })

      switch (resolved.type) {
        case 'prompt': {
          const answer = await promptCallback(resolved.prompt ?? 'Enter value:')
          if (answer === '__CANCELLED__') {
            result.output += 'Action cancelled by user.\n'
            result.status = 'error'
            result.finishedAt = new Date().toISOString()
            onOutput({ ...result })
            return result
          }
          userInput = answer
          result.output += `Input: ${answer}\n`
          break
        }

        case 'shell': {
          const cmd = resolved.shell ?? ''
          result.output += `$ ${cmd}\n`
          onOutput({ ...result })

          try {
            const res = await invoke<{
              stdout: string
              stderr: string
              exit_code: number
              success: boolean
            }>('run_shell_command', {
              command: cmd,
              cwd: workspacePath,
            })

            if (res.stdout) result.output += res.stdout
            if (res.stderr) result.output += res.stderr
            result.exitCode = res.exit_code

            if (!res.success) {
              result.output += `\nExit code: ${res.exit_code}\n`
            }
          } catch (err) {
            result.output += `Error: ${String(err)}\n`
            result.status = 'error'
            result.finishedAt = new Date().toISOString()
            onOutput({ ...result })
            return result
          }
          break
        }

        case 'command': {
          const cmdName = resolved.command ?? ''
          result.output += `Invoke: ${cmdName}\n`
          onOutput({ ...result })

          try {
            const res = await invoke<unknown>(cmdName, resolved.args ?? {})
            result.output +=
              typeof res === 'string' ? res + '\n' : JSON.stringify(res, null, 2) + '\n'
          } catch (err) {
            result.output += `Error: ${String(err)}\n`
            result.status = 'error'
            result.finishedAt = new Date().toISOString()
            onOutput({ ...result })
            return result
          }
          break
        }

        case 'url': {
          const url = resolved.url ?? ''
          result.output += `Opening: ${url}\n`
          try {
            await shellOpen(url)
          } catch (err) {
            result.output += `Error opening URL: ${String(err)}\n`
          }
          break
        }

        case 'file': {
          let filePath = resolved.filePath ?? ''
          const content = resolved.content ?? ''

          // If path is relative, resolve against workspace
          if (filePath && !filePath.startsWith('/') && workspacePath) {
            filePath = `${workspacePath}/${filePath}`
          }

          result.output += `Writing: ${filePath}\n`
          onOutput({ ...result })

          try {
            await invoke('write_file', { path: filePath, content })
            result.output += `Created: ${filePath}\n`
          } catch (err) {
            result.output += `Error: ${String(err)}\n`
            result.status = 'error'
            result.finishedAt = new Date().toISOString()
            onOutput({ ...result })
            return result
          }
          break
        }
      }

      onOutput({ ...result })
    }

    result.status = 'success'
    result.finishedAt = new Date().toISOString()
    result.output += '\nDone.\n'
    onOutput({ ...result })
    return result
  } catch (err) {
    result.status = 'error'
    result.output += `\nUnexpected error: ${String(err)}\n`
    result.finishedAt = new Date().toISOString()
    onOutput({ ...result })
    return result
  }
}

/** Replace {{input}} in all string fields of a step */
function resolveInputPlaceholders(step: SmartActionStep, input: string): SmartActionStep {
  const replace = (s: string | undefined): string | undefined => {
    if (!s) return s
    return s.replace(/\{\{input\}\}/g, input)
  }

  return {
    ...step,
    shell: replace(step.shell),
    command: replace(step.command),
    url: replace(step.url),
    filePath: replace(step.filePath),
    content: replace(step.content),
    prompt: replace(step.prompt),
    label: replace(step.label),
  }
}
