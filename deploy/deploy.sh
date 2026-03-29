#!/bin/bash
set -euo pipefail

# ============================================================
# Orchestra MCP — Deploy Script
# Run after setup.sh for initial deploy and subsequent updates
# Usage: sudo bash deploy.sh [--skip-migrations] [--skip-build]
# ============================================================

ORCHESTRA_DIR="/opt/orchestra"
SHARED_ENV="$ORCHESTRA_DIR/shared/.env"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

SKIP_MIGRATIONS=false
SKIP_BUILD=false
for arg in "$@"; do
    case $arg in
        --skip-migrations) SKIP_MIGRATIONS=true ;;
        --skip-build) SKIP_BUILD=true ;;
    esac
done

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║         Orchestra MCP — Deploy                   ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Verify secrets exist ──
[ ! -f "$SHARED_ENV" ] && err "Secrets file not found at $SHARED_ENV. Run setup.sh first."
source "$SHARED_ENV"

# ============================================================
# 1. Supabase
# ============================================================
log "Checking Supabase..."
cd "$ORCHESTRA_DIR/supabase/docker"

if ! docker compose ps | grep -q "running"; then
    log "Starting Supabase..."
    docker compose up -d
    sleep 10  # Wait for PostgreSQL to be ready
else
    log "Supabase already running"
fi

# ── Apply migrations ──
if [ "$SKIP_MIGRATIONS" = false ]; then
    log "Applying database migrations..."
    MIGRATIONS_DIR="$ORCHESTRA_DIR/supabase/migrations"
    
    if [ -d "$MIGRATIONS_DIR" ] && [ "$(ls -A $MIGRATIONS_DIR/*.sql 2>/dev/null)" ]; then
        for migration in "$MIGRATIONS_DIR"/*.sql; do
            filename=$(basename "$migration")
            log "  Applying: $filename"
            PGPASSWORD="$POSTGRES_PASSWORD" psql \
                -h 127.0.0.1 -p 5432 -U postgres -d postgres \
                -f "$migration" \
                --single-transaction \
                2>&1 | tail -5 || warn "Migration $filename had warnings (may already be applied)"
        done
        log "Migrations complete"
    else
        warn "No migration files found in $MIGRATIONS_DIR"
    fi
fi

# ============================================================
# 2. Go MCP Server
# ============================================================
log "Building Go MCP server..."
cd "$ORCHESTRA_DIR/mcp-server"

if [ -f "go.mod" ]; then
    export PATH=$PATH:/usr/local/go/bin
    
    if [ "$SKIP_BUILD" = false ]; then
        go build -o orchestra-mcp ./cmd/server
        log "Go MCP server built successfully"
    fi
    
    # Restart via supervisor
    supervisorctl restart orchestra-mcp 2>/dev/null || warn "MCP server not yet in supervisor"
else
    warn "Go MCP server not found — skipping"
fi

# ============================================================
# 3. Laravel
# ============================================================
log "Deploying Laravel..."
cd "$ORCHESTRA_DIR/web"

if [ -f "composer.json" ]; then
    # Install/update dependencies
    log "  Installing PHP dependencies..."
    composer install --no-dev --optimize-autoloader --no-interaction 2>&1 | tail -3

    # Generate env if not exists
    if [ ! -f ".env" ]; then
        cp .env.example .env 2>/dev/null || true
        
        # Inject shared secrets into Laravel .env
        cat >> .env << EOF

# ── Auto-injected from shared secrets ──
APP_KEY=${APP_KEY:-}
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=postgres
DB_USERNAME=postgres
DB_PASSWORD=${POSTGRES_PASSWORD:-}

REDIS_HOST=127.0.0.1
REDIS_PORT=6379

SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=${ANON_KEY:-}
SUPABASE_SERVICE_KEY=${SERVICE_ROLE_KEY:-}
SUPABASE_JWT_SECRET=${JWT_SECRET:-}

STRIPE_KEY=${STRIPE_KEY:-}
STRIPE_SECRET=${STRIPE_SECRET:-}
STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET:-}

GITHUB_CLIENT_ID=${GITHUB_CLIENT_ID:-}
GITHUB_CLIENT_SECRET=${GITHUB_CLIENT_SECRET:-}

MAIL_MAILER=smtp
MAIL_HOST=${MAIL_HOST:-}
MAIL_PORT=${MAIL_PORT:-587}
MAIL_USERNAME=${MAIL_USERNAME:-}
MAIL_PASSWORD=${MAIL_PASSWORD:-}
MAIL_FROM_ADDRESS=${MAIL_FROM_ADDRESS:-}
MAIL_FROM_NAME="${MAIL_FROM_NAME:-Orchestra MCP}"
EOF
        log "  Laravel .env created from shared secrets"
    fi

    # Build assets
    if [ "$SKIP_BUILD" = false ]; then
        if [ -f "package.json" ]; then
            log "  Building frontend assets..."
            npm install --silent 2>&1 | tail -1
            npm run build 2>&1 | tail -3
        fi
    fi

    # Laravel optimizations
    log "  Optimizing Laravel..."
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
    php artisan migrate --force 2>/dev/null || true  # Laravel's own migrations (sessions, jobs)
    
    # Set permissions
    chown -R www-data:www-data storage bootstrap/cache
    chmod -R 775 storage bootstrap/cache

    # Restart workers
    php artisan queue:restart 2>/dev/null || true
    supervisorctl restart laravel-worker 2>/dev/null || warn "Laravel worker not in supervisor"
    
    log "Laravel deployed successfully"
else
    warn "Laravel project not found — skipping"
fi

# ============================================================
# 4. Restart Services
# ============================================================
log "Restarting services..."

# PHP-FPM
systemctl restart php8.4-fpm

# Caddy
supervisorctl restart caddy 2>/dev/null || caddy reload --config "$ORCHESTRA_DIR/caddy/Caddyfile" 2>/dev/null || warn "Caddy not ready"

# ============================================================
# 5. Health Checks
# ============================================================
log "Running health checks..."
sleep 3

# Check Supabase
if curl -sf http://localhost:54321/rest/v1/ -H "apikey: ${ANON_KEY:-test}" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Supabase API"
else
    echo -e "  ${RED}✗${NC} Supabase API"
fi

# Check Studio
if curl -sf http://localhost:54323 > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Supabase Studio"
else
    echo -e "  ${YELLOW}○${NC} Supabase Studio (may not be running yet)"
fi

# Check Go MCP
if curl -sf http://localhost:3001/mcp/health > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Go MCP Server"
else
    echo -e "  ${YELLOW}○${NC} Go MCP Server (may not be built yet)"
fi

# Check Laravel
if curl -sf http://localhost:8000 > /dev/null 2>&1 || curl -sf http://localhost > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Laravel"
else
    echo -e "  ${YELLOW}○${NC} Laravel (check PHP-FPM)"
fi

# Check Redis
if redis-cli ping > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} Redis"
else
    echo -e "  ${RED}✗${NC} Redis"
fi

echo ""
echo -e "${GREEN}Deploy complete!${NC} $(date)"
echo ""
echo -e "  Site:    https://${DOMAIN:-orchestra-mcp.dev}"
echo -e "  Studio:  https://${DOMAIN:-orchestra-mcp.dev}/studio"
echo -e "  MCP:     https://${DOMAIN:-orchestra-mcp.dev}/mcp"
echo -e "  API:     https://${DOMAIN:-orchestra-mcp.dev}/rest/v1/"
echo ""
