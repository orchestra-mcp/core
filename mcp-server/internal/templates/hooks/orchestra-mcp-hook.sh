#!/bin/bash
# Orchestra MCP — Master Hook Router
# Routes Claude Code hook events to the appropriate Orchestra sub-hook.
# Installed by: orchestra init
#
# Usage:
#   This script is registered as the Claude Code hook handler. It receives
#   events from Claude Code and dispatches them to specialised sub-hooks
#   in the same directory.
#
# Arguments / Environment:
#   $1             — Event type (tool_call, tool_result, notification, browser_*, etc.)
#   $2..           — Additional arguments passed through to sub-hooks
#   HOOK_EVENT     — Claude Code sets this to the event type
#   HOOK_TOOL_NAME — Claude Code sets this to the tool name
#   HOOK_TOOL_INPUT— Claude Code sets this to the tool input JSON
#   stdin          — May contain additional event data from Claude Code

set -euo pipefail

# ---------------------------------------------------------------------------
# Safety — this master hook must never break Claude Code under any condition.
# ---------------------------------------------------------------------------
trap 'exit 0' ERR

# ---------------------------------------------------------------------------
# Resolve hook directory (where this script and sub-hooks live).
# ---------------------------------------------------------------------------
HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"

# ---------------------------------------------------------------------------
# Determine the event type.
# Prefer the explicit argument; fall back to the HOOK_EVENT env var.
# ---------------------------------------------------------------------------
EVENT="${1:-${HOOK_EVENT:-unknown}}"

# Export event data so sub-hooks can access it via environment.
export HOOK_EVENT="$EVENT"
export HOOK_TOOL_NAME="${HOOK_TOOL_NAME:-${2:-}}"
export HOOK_TOOL_INPUT="${HOOK_TOOL_INPUT:-}"

# ---------------------------------------------------------------------------
# Route to the appropriate sub-hook.
#
# Routing rules:
#   - notification, tool_call, tool_result  -> notify.sh (background)
#   - browser_*                             -> browser.sh (foreground — may return data)
#   - session_*                             -> session.sh (background)
#   - Everything else                       -> notify.sh (background, catch-all)
#
# Background (&) is used for hooks that do not need to return data to Claude
# Code. Foreground is used when the hook result may feed back into the agent.
# All sub-hook stderr is suppressed so errors never leak to Claude Code.
# ---------------------------------------------------------------------------

# Helper: run a sub-hook if it exists and is executable.
run_hook() {
  local hook_script="$1"
  shift
  if [ -x "$hook_script" ]; then
    "$hook_script" "$@"
  elif [ -f "$hook_script" ]; then
    # File exists but is not executable — run via bash.
    bash "$hook_script" "$@"
  fi
  # If the file does not exist, silently skip.
}

case "$EVENT" in
  # -----------------------------------------------------------------------
  # Notification events — fire and forget (background).
  # -----------------------------------------------------------------------
  notification|tool_call|tool_result)
    run_hook "$HOOK_DIR/notify.sh" "$@" 2>/dev/null &
    ;;

  # -----------------------------------------------------------------------
  # Browser events — foreground because they may return data to Claude Code.
  # -----------------------------------------------------------------------
  browser_*)
    run_hook "$HOOK_DIR/browser.sh" "$@" 2>/dev/null
    ;;

  # -----------------------------------------------------------------------
  # Session lifecycle events — background tracking.
  # -----------------------------------------------------------------------
  session_start|session_end|session_heartbeat)
    run_hook "$HOOK_DIR/session.sh" "$@" 2>/dev/null &
    ;;

  # -----------------------------------------------------------------------
  # Catch-all — forward unknown events to notify (background).
  # -----------------------------------------------------------------------
  *)
    run_hook "$HOOK_DIR/notify.sh" "$@" 2>/dev/null &
    ;;
esac

# ---------------------------------------------------------------------------
# Exit immediately — background sub-hooks will finish on their own.
# We intentionally do NOT wait for them. They handle their own timeouts
# (curl --max-time, afplay, etc.) and must never block Claude Code.
# ---------------------------------------------------------------------------
exit 0
