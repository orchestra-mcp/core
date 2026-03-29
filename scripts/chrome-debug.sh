#!/usr/bin/env bash
# =============================================================================
# chrome-debug.sh — Launch Chrome with CDP (Chrome DevTools Protocol) debugging
# =============================================================================
#
# WHAT IS CDP?
#   Chrome DevTools Protocol (CDP) exposes a WebSocket interface that allows
#   external programs to inspect, control, and automate a running Chrome
#   instance — the same protocol DevTools itself uses.
#
# WHY IS IT NEEDED?
#   Orchestra MCP browser tools connect to your real Chrome session via CDP.
#   This lets the Go MCP server interact with pages you already have open,
#   including authenticated sessions, cookies, and local storage — without
#   needing a separate headless browser.
#
# USAGE
#   ./scripts/chrome-debug.sh                Start Chrome with CDP on port 9222
#   ./scripts/chrome-debug.sh --check        Check if CDP is already active
#   ./scripts/chrome-debug.sh --stop         Kill the Chrome debug process
#   ./scripts/chrome-debug.sh --port 9333    Use a custom CDP port
#   ./scripts/chrome-debug.sh --use-existing-profile
#                                            Use your default Chrome profile
#                                            (instead of the isolated debug profile)
#
# ALTERNATIVE (manual)
#   Open Chrome yourself with:
#     /Applications/Google Chrome.app/Contents/MacOS/Google Chrome \
#       --remote-debugging-port=9222
#
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
CDP_PORT=9222
DEBUG_PROFILE_DIR="$HOME/.chrome-debug"
USE_EXISTING_PROFILE=false
ACTION="start"   # start | stop | check

# ---------------------------------------------------------------------------
# Color helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()    { printf "${CYAN}[info]${NC}  %s\n" "$*"; }
ok()      { printf "${GREEN}[ok]${NC}    %s\n" "$*"; }
warn()    { printf "${YELLOW}[warn]${NC}  %s\n" "$*"; }
err()     { printf "${RED}[error]${NC} %s\n" "$*" >&2; }

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --stop)
            ACTION="stop"
            shift
            ;;
        --check)
            ACTION="check"
            shift
            ;;
        --port)
            CDP_PORT="${2:?'--port requires a value'}"
            shift 2
            ;;
        --use-existing-profile)
            USE_EXISTING_PROFILE=true
            shift
            ;;
        -h|--help)
            # Print the header doc block (lines 2-31)
            sed -n '2,31p' "$0" | sed 's/^# \?//'
            exit 0
            ;;
        *)
            err "Unknown option: $1"
            err "Usage: $0 [--check | --stop] [--port PORT] [--use-existing-profile]"
            exit 1
            ;;
    esac
done

# ---------------------------------------------------------------------------
# Detect OS & locate Chrome binary
# ---------------------------------------------------------------------------
detect_chrome() {
    local os
    os="$(uname -s)"

    case "$os" in
        Darwin)
            # macOS — check standard install location
            local mac_chrome="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
            if [[ -x "$mac_chrome" ]]; then
                CHROME_BIN="$mac_chrome"
            else
                # Try Homebrew cask alternate location
                local brew_chrome="$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
                if [[ -x "$brew_chrome" ]]; then
                    CHROME_BIN="$brew_chrome"
                fi
            fi

            # Default profile location on macOS
            DEFAULT_PROFILE_DIR="$HOME/Library/Application Support/Google/Chrome"
            ;;
        Linux)
            # Linux — try common binary names on PATH
            if command -v google-chrome &>/dev/null; then
                CHROME_BIN="$(command -v google-chrome)"
            elif command -v google-chrome-stable &>/dev/null; then
                CHROME_BIN="$(command -v google-chrome-stable)"
            elif command -v chromium-browser &>/dev/null; then
                CHROME_BIN="$(command -v chromium-browser)"
            elif command -v chromium &>/dev/null; then
                CHROME_BIN="$(command -v chromium)"
            fi

            # Default profile location on Linux
            DEFAULT_PROFILE_DIR="$HOME/.config/google-chrome"
            ;;
        *)
            err "Unsupported OS: $os (only macOS and Linux are supported)"
            exit 1
            ;;
    esac

    if [[ -z "${CHROME_BIN:-}" ]]; then
        err "Chrome not found."
        err "macOS: expected at /Applications/Google Chrome.app"
        err "Linux: expected google-chrome or chromium-browser on PATH"
        exit 1
    fi

    info "Chrome binary: $CHROME_BIN"
}

# ---------------------------------------------------------------------------
# Check if CDP is already responding
# ---------------------------------------------------------------------------
cdp_is_active() {
    curl -sf "http://localhost:${CDP_PORT}/json/version" >/dev/null 2>&1
}

cdp_version_info() {
    curl -sf "http://localhost:${CDP_PORT}/json/version" 2>/dev/null
}

cdp_ws_url() {
    curl -sf "http://localhost:${CDP_PORT}/json/version" 2>/dev/null \
        | grep -o '"webSocketDebuggerUrl":"[^"]*"' \
        | cut -d'"' -f4
}

# ---------------------------------------------------------------------------
# ACTION: --check
# ---------------------------------------------------------------------------
do_check() {
    info "Checking CDP on port ${CDP_PORT}..."
    if cdp_is_active; then
        ok "Chrome CDP is active on port ${CDP_PORT}"
        echo ""
        printf "${BOLD}Version info:${NC}\n"
        cdp_version_info | python3 -m json.tool 2>/dev/null || cdp_version_info
        echo ""
        local ws
        ws="$(cdp_ws_url)"
        if [[ -n "$ws" ]]; then
            printf "${BOLD}WebSocket URL:${NC} %s\n" "$ws"
        fi
        exit 0
    else
        warn "Chrome CDP is NOT active on port ${CDP_PORT}"
        exit 1
    fi
}

# ---------------------------------------------------------------------------
# ACTION: --stop
# ---------------------------------------------------------------------------
do_stop() {
    info "Looking for Chrome processes with --remote-debugging-port=${CDP_PORT}..."

    local pids
    pids="$(pgrep -f "remote-debugging-port=${CDP_PORT}" 2>/dev/null || true)"

    if [[ -z "$pids" ]]; then
        warn "No Chrome debug process found on port ${CDP_PORT}"
        exit 0
    fi

    echo "$pids" | while read -r pid; do
        info "Killing PID $pid..."
        kill "$pid" 2>/dev/null || true
    done

    # Give it a moment, then verify
    sleep 1
    if cdp_is_active; then
        warn "CDP still responding — sending SIGKILL..."
        pgrep -f "remote-debugging-port=${CDP_PORT}" 2>/dev/null \
            | xargs kill -9 2>/dev/null || true
        sleep 1
    fi

    if cdp_is_active; then
        err "Failed to stop Chrome CDP on port ${CDP_PORT}"
        exit 1
    else
        ok "Chrome CDP stopped"
        exit 0
    fi
}

# ---------------------------------------------------------------------------
# ACTION: start (default)
# ---------------------------------------------------------------------------
do_start() {
    detect_chrome

    # If CDP is already running, just report and exit
    if cdp_is_active; then
        ok "Chrome CDP already active on port ${CDP_PORT}"
        echo ""
        printf "${BOLD}Version info:${NC}\n"
        cdp_version_info | python3 -m json.tool 2>/dev/null || cdp_version_info
        echo ""
        local ws
        ws="$(cdp_ws_url)"
        if [[ -n "$ws" ]]; then
            printf "${BOLD}WebSocket URL:${NC} %s\n" "$ws"
        fi
        exit 0
    fi

    # Determine user-data-dir
    local data_dir
    if [[ "$USE_EXISTING_PROFILE" == true ]]; then
        data_dir="$DEFAULT_PROFILE_DIR"
        warn "Using existing Chrome profile at: $data_dir"
        warn "This may conflict if Chrome is already running with this profile."
        warn "Close all other Chrome windows first, or use the default isolated profile."
    else
        data_dir="$DEBUG_PROFILE_DIR"
        info "Using isolated debug profile at: $data_dir"
    fi

    # Create profile dir if needed
    mkdir -p "$data_dir"

    info "Launching Chrome with CDP on port ${CDP_PORT}..."

    # Launch Chrome in background
    "$CHROME_BIN" \
        --remote-debugging-port="${CDP_PORT}" \
        --user-data-dir="$data_dir" \
        --no-first-run \
        --no-default-browser-check \
        >/dev/null 2>&1 &

    local chrome_pid=$!
    info "Chrome PID: $chrome_pid"

    # Wait for CDP to become available (up to 10 seconds)
    info "Waiting for CDP to become available..."
    local attempts=0
    local max_attempts=20
    while [[ $attempts -lt $max_attempts ]]; do
        if cdp_is_active; then
            break
        fi
        sleep 0.5
        attempts=$((attempts + 1))
    done

    if cdp_is_active; then
        echo ""
        ok "Chrome CDP is ready on port ${CDP_PORT}"
        echo ""
        printf "${BOLD}Version info:${NC}\n"
        cdp_version_info | python3 -m json.tool 2>/dev/null || cdp_version_info
        echo ""
        local ws
        ws="$(cdp_ws_url)"
        if [[ -n "$ws" ]]; then
            printf "${BOLD}WebSocket URL:${NC} %s\n" "$ws"
        fi
        echo ""
        info "Chrome is running in the background (PID $chrome_pid)."
        info "Use '$0 --stop' to terminate, or '$0 --check' to verify status."
    else
        err "Chrome launched but CDP did not respond within 10 seconds."
        err "Check if port ${CDP_PORT} is blocked or if Chrome failed to start."
        err "Try running Chrome manually:"
        err "  \"$CHROME_BIN\" --remote-debugging-port=${CDP_PORT} --user-data-dir=\"$data_dir\""
        exit 1
    fi
}

# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------
case "$ACTION" in
    check) do_check ;;
    stop)  do_stop  ;;
    start) do_start ;;
esac
