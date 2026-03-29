#!/bin/bash
# Orchestra MCP — Notification Hook
# Pushes Claude Code events to the Orchestra MCP server and shows desktop notifications.
# Installed by: orchestra init
#
# Environment variables:
#   ORCHESTRA_TOKEN    — MCP authentication token (required for server push)
#   ORCHESTRA_MCP_URL  — MCP server base URL (default: https://mcp.orchestra.dev)
#
# Claude Code hook environment:
#   HOOK_EVENT         — Event type (tool_call, tool_result, notification, etc.)
#   HOOK_TOOL_NAME     — Name of the tool that was called
#   HOOK_TOOL_INPUT    — JSON input to the tool
#   stdin              — May contain additional event data

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
TOKEN="${ORCHESTRA_TOKEN:-}"
MCP_URL="${ORCHESTRA_MCP_URL:-https://mcp.orchestra.dev}"
SOUNDS_DIR="$HOME/.orchestra/sounds"
LOG_FILE="$HOME/.orchestra/logs/hooks.log"

# ---------------------------------------------------------------------------
# Safety — never let this hook break Claude Code
# ---------------------------------------------------------------------------
trap 'exit 0' ERR

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# has_cmd — check whether a command is available on this system.
has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

# log_event — append a line to the local hook log (best-effort).
log_event() {
  local dir
  dir="$(dirname "$LOG_FILE")"
  if [ ! -d "$dir" ]; then
    mkdir -p "$dir" 2>/dev/null || true
  fi
  printf '%s  %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >> "$LOG_FILE" 2>/dev/null || true
}

# ---------------------------------------------------------------------------
# Collect event data
# ---------------------------------------------------------------------------
EVENT="${HOOK_EVENT:-${1:-unknown}}"
TOOL_NAME="${HOOK_TOOL_NAME:-${2:-}}"
TOOL_INPUT="${HOOK_TOOL_INPUT:-}"

# Read stdin if available (non-blocking, 1 second timeout).
STDIN_DATA=""
if [ ! -t 0 ]; then
  if has_cmd timeout; then
    STDIN_DATA="$(timeout 1 cat 2>/dev/null || true)"
  elif has_cmd gtimeout; then
    STDIN_DATA="$(gtimeout 1 cat 2>/dev/null || true)"
  else
    # macOS without coreutils — use read with a timeout.
    STDIN_DATA=""
    while IFS= read -r -t 1 line; do
      STDIN_DATA="${STDIN_DATA}${line}"$'\n'
    done 2>/dev/null || true
  fi
fi

# Build a human-readable summary for the desktop notification.
SUMMARY=""
case "$EVENT" in
  tool_call)
    SUMMARY="Tool called: ${TOOL_NAME:-unknown}"
    ;;
  tool_result)
    SUMMARY="Tool completed: ${TOOL_NAME:-unknown}"
    ;;
  notification)
    SUMMARY="${TOOL_NAME:-Orchestra notification}"
    ;;
  *)
    SUMMARY="Event: $EVENT"
    ;;
esac

log_event "$EVENT  $TOOL_NAME"

# ---------------------------------------------------------------------------
# 1. Push event to Orchestra MCP server (background, non-blocking)
# ---------------------------------------------------------------------------
push_to_server() {
  # Skip if no token configured.
  if [ -z "$TOKEN" ]; then
    return 0
  fi

  # Skip if curl is not available.
  if ! has_cmd curl; then
    return 0
  fi

  # Build JSON payload.
  local payload
  payload="$(cat <<EOJSON
{
  "event": "$EVENT",
  "tool_name": "$TOOL_NAME",
  "tool_input": $( [ -n "$TOOL_INPUT" ] && printf '%s' "$TOOL_INPUT" || printf '{}' ),
  "timestamp": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')",
  "machine_id": "$(hostname -s 2>/dev/null || echo 'unknown')",
  "stdin_data": $(printf '%s' "$STDIN_DATA" | head -c 4096 | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo '""')
}
EOJSON
)"

  # POST to the activity endpoint — 5 second timeout, silent failures.
  curl -s -S \
    --max-time 5 \
    --connect-timeout 3 \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$payload" \
    "${MCP_URL}/hooks/activity" \
    >/dev/null 2>&1 || true
}

# Run server push in the background so it never blocks Claude Code.
push_to_server &

# ---------------------------------------------------------------------------
# 2. Desktop notification (best-effort, platform-specific)
# ---------------------------------------------------------------------------
show_notification() {
  local title="Orchestra MCP"
  local message="$SUMMARY"

  # macOS — use osascript (AppleScript).
  if [ "$(uname -s)" = "Darwin" ] && has_cmd osascript; then
    osascript -e "display notification \"$message\" with title \"$title\"" 2>/dev/null || true
    return 0
  fi

  # Linux — use notify-send (common on GNOME, KDE, etc.).
  if has_cmd notify-send; then
    notify-send "$title" "$message" --expire-time=3000 2>/dev/null || true
    return 0
  fi

  # No notification system available — skip silently.
  return 0
}

show_notification

# ---------------------------------------------------------------------------
# 3. Notification sound (macOS only, optional)
# ---------------------------------------------------------------------------
play_sound() {
  # Only macOS with afplay.
  if [ "$(uname -s)" != "Darwin" ] || ! has_cmd afplay; then
    return 0
  fi

  # Look for a sound file matching the event type, then fall back to default.
  local sound_file=""

  if [ -f "$SOUNDS_DIR/${EVENT}.aiff" ]; then
    sound_file="$SOUNDS_DIR/${EVENT}.aiff"
  elif [ -f "$SOUNDS_DIR/${EVENT}.mp3" ]; then
    sound_file="$SOUNDS_DIR/${EVENT}.mp3"
  elif [ -f "$SOUNDS_DIR/${EVENT}.wav" ]; then
    sound_file="$SOUNDS_DIR/${EVENT}.wav"
  elif [ -f "$SOUNDS_DIR/default.aiff" ]; then
    sound_file="$SOUNDS_DIR/default.aiff"
  elif [ -f "$SOUNDS_DIR/default.mp3" ]; then
    sound_file="$SOUNDS_DIR/default.mp3"
  elif [ -f "$SOUNDS_DIR/default.wav" ]; then
    sound_file="$SOUNDS_DIR/default.wav"
  fi

  if [ -n "$sound_file" ]; then
    # Play in background, low volume, never block.
    afplay -v 0.5 "$sound_file" 2>/dev/null &
  fi
}

play_sound

# ---------------------------------------------------------------------------
# 4. Voice notification (text-to-speech)
# ---------------------------------------------------------------------------
# macOS: Uses `say` with a human-like voice (Samantha)
# Linux: Uses `espeak` or `spd-say` for machine voice
# Controlled via ~/.orchestra/config.json: {"voice_enabled": true, "voice_name": "Samantha"}

CONFIG_FILE="$HOME/.orchestra/config.json"

is_voice_enabled() {
  # Default: voice is ON
  if [ ! -f "$CONFIG_FILE" ]; then
    return 0
  fi
  # Check if voice_enabled is explicitly set to false
  if has_cmd python3; then
    local val
    val="$(python3 -c "import json; c=json.load(open('$CONFIG_FILE')); print(c.get('voice_enabled', True))" 2>/dev/null || echo "True")"
    [ "$val" = "True" ] || [ "$val" = "true" ]
  else
    # No python3 — default to enabled
    return 0
  fi
}

get_voice_name() {
  if [ -f "$CONFIG_FILE" ] && has_cmd python3; then
    python3 -c "import json; c=json.load(open('$CONFIG_FILE')); print(c.get('voice_name', 'Samantha'))" 2>/dev/null || echo "Samantha"
  else
    echo "Samantha"
  fi
}

# Only speak for important events, not every tool call
should_speak() {
  case "$EVENT" in
    task_completed|task_blocked|meeting_started|feature_complete|deploy_*)
      return 0 ;;
    notification)
      return 0 ;;
    tool_result)
      # Only speak for specific tool completions
      case "$TOOL_NAME" in
        task_complete|task_block|report_generate|init)
          return 0 ;;
        *)
          return 1 ;;
      esac
      ;;
    *)
      return 1 ;;
  esac
}

speak_notification() {
  if ! is_voice_enabled; then
    return 0
  fi

  if ! should_speak; then
    return 0
  fi

  local text="$SUMMARY"

  # macOS — use `say` with human-like voice
  if [ "$(uname -s)" = "Darwin" ] && has_cmd say; then
    local voice
    voice="$(get_voice_name)"
    say -v "$voice" "$text" 2>/dev/null &
    return 0
  fi

  # Linux — try spd-say (Speech Dispatcher) first, then espeak
  if has_cmd spd-say; then
    spd-say "$text" 2>/dev/null &
    return 0
  fi

  if has_cmd espeak; then
    espeak "$text" 2>/dev/null &
    return 0
  fi

  # No TTS available — skip silently
  return 0
}

speak_notification

# ---------------------------------------------------------------------------
# Done — exit immediately. Background jobs (server push, sound, voice) will
# finish on their own. We must never block Claude Code.
# ---------------------------------------------------------------------------
exit 0
