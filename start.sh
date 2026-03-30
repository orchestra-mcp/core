#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
DOCKER_DIR="$ROOT/docker"
MCP_DIR="$ROOT/mcp-server"
WEB_DIR="$ROOT/web"
DESKTOP_DIR="$ROOT/desktop"
LOG_DIR="$ROOT/.logs"

mkdir -p "$LOG_DIR"

# ── Options ──
RUN_DESKTOP=false
RUN_LARAVEL=false

while getopts "dwh" opt; do
    case $opt in
        d) RUN_DESKTOP=true ;;
        w) RUN_LARAVEL=true ;;
        h)
            echo "Usage: ./start.sh [-d] [-w]"
            echo ""
            echo "  Default:  Supabase Docker + Go MCP Server + Orchestra Studio"
            echo "  -d        Also start Desktop app (Tauri/Rust)"
            echo "  -w        Also start Laravel web app (composer dev)"
            echo ""
            exit 0
            ;;
        *) echo "Unknown option: -$opt. Use -h for help."; exit 1 ;;
    esac
done

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log() { echo -e "${CYAN}[orchestra]${NC} $1"; }
ok()  { echo -e "${GREEN}[orchestra]${NC} $1"; }
warn(){ echo -e "${YELLOW}[orchestra]${NC} $1"; }
err() { echo -e "${RED}[orchestra]${NC} $1"; }

# Track PIDs for cleanup
PIDS=()

cleanup() {
    echo ""
    log "Shutting down all services..."
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    cd "$DOCKER_DIR" && docker compose stop 2>/dev/null || true
    ok "All services stopped."
}
trap cleanup EXIT INT TERM

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 0. Kill conflicting processes & free ports
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log "Cleaning up conflicting processes..."

# Stop local PostgreSQL if running (conflicts with Docker postgres on 5432)
if command -v brew &>/dev/null; then
    brew services stop postgresql@14 2>/dev/null || true
    brew services stop postgresql@15 2>/dev/null || true
    brew services stop postgresql@16 2>/dev/null || true
    brew services stop postgresql 2>/dev/null || true
fi
if command -v pg_isready &>/dev/null && pg_isready -q 2>/dev/null; then
    warn "Local PostgreSQL is running — stopping it..."
    pg_ctl stop -D /opt/homebrew/var/postgresql@14 2>/dev/null || true
    pg_ctl stop -D /opt/homebrew/var/postgres 2>/dev/null || true
fi

# Kill anything on our ports (including 5432 for postgres)
for PORT_NUM in 5432 8000 8080 8082 9997 9999 54321 54323; do
    PID=$(lsof -ti :$PORT_NUM 2>/dev/null || true)
    if [ -n "$PID" ]; then
        warn "Port $PORT_NUM in use (PID: $PID) — killing..."
        kill -9 $PID 2>/dev/null || true
    fi
done

# Force stop any existing Docker Supabase containers (keep volumes to preserve data)
cd "$DOCKER_DIR"
docker compose down --remove-orphans 2>/dev/null || true
cd "$ROOT"

ok "Ports cleared."

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. Load environment
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log "Loading environment from docker/.env..."
while IFS= read -r line; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
        key="${line%%=*}"
        value="${line#*=}"
        export "$key=$value"
    fi
done < "$DOCKER_DIR/.env"

export SUPABASE_URL="http://localhost:8000"
export SUPABASE_SERVICE_KEY="$SERVICE_ROLE_KEY"
export JWT_SECRET="$JWT_SECRET"
export PORT="${MCP_PORT:-9999}"
export DATABASE_URL="postgresql://supabase_admin:${POSTGRES_PASSWORD}@localhost:54322/postgres"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. Start Supabase Docker
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Ensure Docker is running
if docker info > /dev/null 2>&1; then
    ok "Docker is ready."
else
    log "Docker not running — starting Docker Desktop..."
    open -a Docker 2>/dev/null || true
    for i in $(seq 1 30); do
        docker info > /dev/null 2>&1 && { ok "Docker is ready."; break; }
        [ "$i" -eq 30 ] && { err "Docker daemon not responding after 60s."; exit 1; }
        sleep 2
    done
fi

log "Starting Supabase Docker services..."
cd "$DOCKER_DIR"
docker compose up -d --remove-orphans 2>&1 | tail -5

# Wait for DB
log "Waiting for database..."
for i in $(seq 1 60); do
    if docker compose exec -T db pg_isready -U supabase_admin -h localhost -q 2>/dev/null; then
        ok "Database is ready."
        break
    fi
    [ "$i" -eq 60 ] && { err "Database failed to start after 60s"; exit 1; }
    sleep 1
done

# Fix ALL role passwords (including supabase_admin itself)
log "Syncing database role passwords..."
docker compose exec -T db bash -c "psql -U supabase_admin -h localhost -d postgres -c \
  \"ALTER ROLE supabase_admin WITH PASSWORD '$POSTGRES_PASSWORD'; \
   ALTER ROLE supabase_auth_admin WITH PASSWORD '$POSTGRES_PASSWORD'; \
   ALTER ROLE authenticator WITH PASSWORD '$POSTGRES_PASSWORD'; \
   ALTER ROLE supabase_storage_admin WITH PASSWORD '$POSTGRES_PASSWORD'; \
   ALTER ROLE supabase_replication_admin WITH PASSWORD '$POSTGRES_PASSWORD'; \
   ALTER ROLE supabase_read_only_user WITH PASSWORD '$POSTGRES_PASSWORD';\"" \
  > /dev/null 2>&1 && ok "Role passwords synced." || warn "Role sync skipped (fresh volumes — passwords already correct)."

# Restart password-dependent services
docker compose restart auth rest storage supavisor analytics 2>/dev/null &

# Wait for auth + rest
log "Waiting for Auth + REST..."
for i in $(seq 1 45); do
    AUTH_OK=$(docker compose ps auth --format '{{.Status}}' 2>/dev/null | grep -c "healthy" || true)
    REST_OK=$(docker compose ps rest --format '{{.Status}}' 2>/dev/null | grep -c "Up" || true)
    if [ "$AUTH_OK" -ge 1 ] && [ "$REST_OK" -ge 1 ]; then
        ok "Auth + REST are healthy."
        break
    fi
    [ "$i" -eq 45 ] && warn "Some services still starting (continuing anyway)..."
    sleep 2
done

cd "$ROOT"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2b. Create or find admin user
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ADMIN_EMAIL="admin@orchestra-mcp.dev"
ADMIN_PASSWORD="orchestra-admin-2026"
KONG_URL="http://localhost:8000"

log "Checking admin user..."

# Check if admin exists via GoTrue admin API
ADMIN_CHECK=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "apikey: $SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    "$KONG_URL/auth/v1/admin/users?page=1&per_page=1" 2>/dev/null || echo "000")

if [ "$ADMIN_CHECK" = "200" ]; then
    # Search for existing admin by email
    ADMIN_EXISTS=$(curl -s \
        -H "apikey: $SERVICE_ROLE_KEY" \
        -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
        "$KONG_URL/auth/v1/admin/users?page=1&per_page=50" 2>/dev/null \
        | grep -o "\"email\":\"$ADMIN_EMAIL\"" || true)

    if [ -n "$ADMIN_EXISTS" ]; then
        ok "Admin user exists: $ADMIN_EMAIL"
    else
        log "Creating admin user..."
        CREATE_RESULT=$(curl -s \
            -H "apikey: $SERVICE_ROLE_KEY" \
            -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
            -H "Content-Type: application/json" \
            -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"Orchestra Admin\",\"is_admin\":true}}" \
            "$KONG_URL/auth/v1/admin/users" 2>/dev/null)

        if echo "$CREATE_RESULT" | grep -q '"id"'; then
            ADMIN_ID=$(echo "$CREATE_RESULT" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
            ok "Admin user created: $ADMIN_EMAIL (ID: $ADMIN_ID)"

            # Update auto-created profile to set is_admin=true
            curl -s -X PATCH \
                -H "apikey: $SERVICE_ROLE_KEY" \
                -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
                -H "Content-Type: application/json" \
                -H "Prefer: return=minimal" \
                -d "{\"full_name\":\"Orchestra Admin\",\"is_admin\":true}" \
                "$KONG_URL/rest/v1/profiles?id=eq.$ADMIN_ID" > /dev/null 2>&1 || true
        else
            warn "Admin creation response: $(echo "$CREATE_RESULT" | head -c 200)"
        fi
    fi
else
    warn "Auth service not ready yet (HTTP $ADMIN_CHECK) — skipping admin setup. Create manually later."
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. Start Go MCP Server
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log "Starting Go MCP Server on port $PORT..."
cd "$MCP_DIR"
./server > "$LOG_DIR/mcp-server.log" 2>&1 &
MCP_PID=$!
PIDS+=($MCP_PID)
cd "$ROOT"

sleep 2
if kill -0 $MCP_PID 2>/dev/null; then
    ok "MCP Server running (PID: $MCP_PID, port: $PORT)"
else
    err "MCP Server failed to start. Check $LOG_DIR/mcp-server.log"
    cat "$LOG_DIR/mcp-server.log" | tail -10
    exit 1
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. Start Orchestra Studio (Next.js)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log "Starting Orchestra Studio (Next.js)..."
cd "$ROOT"
npx turbo run dev --filter=studio > "$LOG_DIR/studio.log" 2>&1 &
STUDIO_PID=$!
PIDS+=($STUDIO_PID)

sleep 3
if kill -0 $STUDIO_PID 2>/dev/null; then
    ok "Studio starting (PID: $STUDIO_PID, port: 8082)"
else
    warn "Studio may have failed. Check $LOG_DIR/studio.log"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. Optional: Desktop App (-d)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ "$RUN_DESKTOP" = true ]; then
    log "Starting Orchestra Desktop (Tauri)..."
    cd "$DESKTOP_DIR"
    npx tauri dev > "$LOG_DIR/desktop.log" 2>&1 &
    DESKTOP_PID=$!
    PIDS+=($DESKTOP_PID)
    cd "$ROOT"

    sleep 3
    if kill -0 $DESKTOP_PID 2>/dev/null; then
        ok "Desktop app starting (PID: $DESKTOP_PID)"
    else
        warn "Desktop may have failed. Check $LOG_DIR/desktop.log"
    fi
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 6. Optional: Laravel Web App (-w)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if [ "$RUN_LARAVEL" = true ]; then
    log "Starting Laravel Web App..."
    cd "$WEB_DIR"

    # Install deps if needed
    [ ! -d "vendor" ] && composer install --no-interaction --quiet 2>/dev/null

    # Start Laravel dev server (FrankenPHP if available, else artisan serve)
    if [ -f "./frankenphp" ]; then
        php artisan octane:start --server=frankenphp --host=0.0.0.0 --port=8080 > "$LOG_DIR/laravel.log" 2>&1 &
    else
        php artisan serve --host=0.0.0.0 --port=8080 > "$LOG_DIR/laravel.log" 2>&1 &
    fi
    LARAVEL_PID=$!
    PIDS+=($LARAVEL_PID)
    cd "$ROOT"

    sleep 2
    if kill -0 $LARAVEL_PID 2>/dev/null; then
        ok "Laravel running (PID: $LARAVEL_PID, port: 8080)"
    else
        warn "Laravel may have failed. Check $LOG_DIR/laravel.log"
    fi
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 7. Print status
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  ${BOLD}Orchestra MCP Platform — All Services Running${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "  ${BOLD}Core:${NC}"
echo -e "    MCP Server:        ${CYAN}http://localhost:${PORT}${NC}"
echo -e "    Orchestra Studio:  ${CYAN}http://localhost:8082${NC}"
echo ""
echo -e "  ${BOLD}Supabase:${NC}"
echo -e "    API (Kong):        ${CYAN}http://localhost:8000${NC}"
echo -e "    Auth (GoTrue):     ${CYAN}http://localhost:8000/auth/v1${NC}"
echo -e "    REST (PostgREST):  ${CYAN}http://localhost:8000/rest/v1${NC}"
echo -e "    Storage:           ${CYAN}http://localhost:8000/storage/v1${NC}"
echo -e "    Database:          ${CYAN}postgresql://localhost:54322/postgres${NC}"
echo -e "    Inbucket (Email):  ${CYAN}http://localhost:9000${NC}"
echo ""

if [ "$RUN_DESKTOP" = true ]; then
    echo -e "  ${BOLD}Desktop:${NC}"
    echo -e "    Tauri App:         ${CYAN}Running (PID: $DESKTOP_PID)${NC}"
    echo -e "    MCP HTTP:          ${CYAN}http://localhost:9998/mcp${NC}"
    echo -e "    Twin WS Bridge:    ${CYAN}ws://localhost:9997/twin${NC}  ← Chrome extension"
    echo ""
fi

if [ "$RUN_LARAVEL" = true ]; then
    echo -e "  ${BOLD}Web App:${NC}"
    echo -e "    Laravel:           ${CYAN}http://localhost:8080${NC}"
    echo ""
fi

echo -e "  ${BOLD}Admin:${NC}"
echo -e "    Email:             ${CYAN}$ADMIN_EMAIL${NC}"
echo -e "    Password:          ${CYAN}$ADMIN_PASSWORD${NC}"
echo ""
echo -e "  ${BOLD}Logs:${NC}   ${YELLOW}$LOG_DIR/${NC}"
echo -e "  ${BOLD}Stop:${NC}   ${YELLOW}Ctrl+C${NC}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 8. Tail logs (foreground)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LOG_FILES=("$LOG_DIR/mcp-server.log" "$LOG_DIR/studio.log")
[ "$RUN_DESKTOP" = true ] && LOG_FILES+=("$LOG_DIR/desktop.log")
[ "$RUN_LARAVEL" = true ] && LOG_FILES+=("$LOG_DIR/laravel.log")

tail -f "${LOG_FILES[@]}" 2>/dev/null
