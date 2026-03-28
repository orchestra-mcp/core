#!/bin/bash
set -euo pipefail

# ============================================================
# Orchestra MCP — Fresh Ubuntu 24.04 Server Setup
# Run as root: curl -fsSL https://orchestra-mcp.dev/install | bash
# Or: sudo bash setup.sh
# ============================================================

ORCHESTRA_DIR="/opt/orchestra"
LOG_FILE="/var/log/orchestra-setup.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[ORCHESTRA]${NC} $1" | tee -a "$LOG_FILE"; }
warn() { echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"; }
err() { echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"; exit 1; }

# ── Check root ──
[[ $EUID -ne 0 ]] && err "This script must be run as root (sudo bash setup.sh)"

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════╗"
echo "║         Orchestra MCP — Server Setup             ║"
echo "║         Fresh Ubuntu 24.04 Installation          ║"
echo "╚══════════════════════════════════════════════════╝"
echo -e "${NC}"

mkdir -p "$(dirname $LOG_FILE)"
echo "Setup started at $(date)" > "$LOG_FILE"

# ============================================================
# 1. System Updates & Base Packages
# ============================================================
log "Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

log "Installing base packages..."
apt-get install -y -qq \
    curl wget git unzip zip \
    build-essential gcc g++ make \
    software-properties-common apt-transport-https \
    ca-certificates gnupg lsb-release \
    supervisor cron jq htop \
    ufw fail2ban

# ============================================================
# 2. Firewall
# ============================================================
log "Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (Caddy redirect)
ufw allow 443/tcp   # HTTPS (Caddy)
ufw --force enable

# ============================================================
# 3. Docker
# ============================================================
log "Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    apt-get install -y -qq docker-compose-plugin
fi
log "Docker version: $(docker --version)"

# ============================================================
# 4. Caddy
# ============================================================
log "Installing Caddy..."
if ! command -v caddy &> /dev/null; then
    apt-get install -y debian-keyring debian-archive-keyring
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq
    apt-get install -y -qq caddy
    systemctl stop caddy  # We manage via supervisor
    systemctl disable caddy
fi
mkdir -p /var/log/caddy
log "Caddy version: $(caddy version)"

# ============================================================
# 5. PHP 8.3 + Extensions
# ============================================================
log "Installing PHP 8.3..."
if ! command -v php &> /dev/null || ! php -v | grep -q "8.3"; then
    add-apt-repository -y ppa:ondrej/php
    apt-get update -qq
    apt-get install -y -qq \
        php8.3-fpm php8.3-cli \
        php8.3-pgsql php8.3-mbstring php8.3-xml php8.3-curl \
        php8.3-zip php8.3-bcmath php8.3-intl php8.3-gd \
        php8.3-redis php8.3-tokenizer php8.3-fileinfo
fi

# Configure PHP-FPM
sed -i 's/;cgi.fix_pathinfo=1/cgi.fix_pathinfo=0/' /etc/php/8.3/fpm/php.ini
sed -i 's/upload_max_filesize = .*/upload_max_filesize = 50M/' /etc/php/8.3/fpm/php.ini
sed -i 's/post_max_size = .*/post_max_size = 50M/' /etc/php/8.3/fpm/php.ini
sed -i 's/memory_limit = .*/memory_limit = 256M/' /etc/php/8.3/fpm/php.ini

systemctl restart php8.3-fpm
log "PHP version: $(php -v | head -1)"

# ============================================================
# 6. Composer
# ============================================================
log "Installing Composer..."
if ! command -v composer &> /dev/null; then
    curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
fi
log "Composer version: $(composer --version | head -1)"

# ============================================================
# 7. Node.js 20 LTS
# ============================================================
log "Installing Node.js 20..."
if ! command -v node &> /dev/null || ! node -v | grep -q "v20"; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
    npm install -g pnpm
fi
log "Node version: $(node -v)"
log "pnpm version: $(pnpm -v)"

# ============================================================
# 8. Go 1.22
# ============================================================
log "Installing Go 1.22..."
if ! command -v go &> /dev/null; then
    GO_VERSION="1.22.5"
    wget -q "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" -O /tmp/go.tar.gz
    rm -rf /usr/local/go
    tar -C /usr/local -xzf /tmp/go.tar.gz
    rm /tmp/go.tar.gz
    echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile
    export PATH=$PATH:/usr/local/go/bin
fi
log "Go version: $(go version)"

# ============================================================
# 9. Redis
# ============================================================
log "Installing Redis..."
if ! command -v redis-server &> /dev/null; then
    apt-get install -y -qq redis-server
    sed -i 's/supervised no/supervised systemd/' /etc/redis/redis.conf
    systemctl enable redis-server
    systemctl restart redis-server
fi
log "Redis version: $(redis-server --version | head -1)"

# ============================================================
# 10. Create Directory Structure
# ============================================================
log "Creating directory structure..."
mkdir -p "$ORCHESTRA_DIR"/{caddy,supabase,mcp-server,web,deploy,shared,logs}
mkdir -p /var/log/orchestra

# ============================================================
# 11. Generate Secrets
# ============================================================
log "Generating secrets..."
SHARED_ENV="$ORCHESTRA_DIR/shared/.env"

generate_secret() {
    openssl rand -hex "$1"
}

generate_jwt_key() {
    openssl rand -base64 48 | tr -d '\n'
}

if [ ! -f "$SHARED_ENV" ]; then
    cat > "$SHARED_ENV" << EOF
# ============================================================
# Orchestra MCP — Shared Secrets
# Generated at $(date)
# DO NOT COMMIT THIS FILE
# ============================================================

# PostgreSQL
POSTGRES_PASSWORD=$(generate_secret 32)

# Supabase JWT
JWT_SECRET=$(generate_jwt_key)

# Generate anon and service keys with:
# npx supabase-key generate --jwt-secret=<JWT_SECRET>
# Set these after generating:
ANON_KEY=
SERVICE_ROLE_KEY=

# Laravel
APP_KEY=base64:$(openssl rand -base64 32)

# Stripe
STRIPE_KEY=
STRIPE_SECRET=
STRIPE_WEBHOOK_SECRET=

# GitHub OAuth (for user login)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Google OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Embedding API
EMBEDDING_PROVIDER=openai
EMBEDDING_API_KEY=
EMBEDDING_MODEL=text-embedding-3-small

# SMTP (for emails)
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM_ADDRESS=hello@orchestra-mcp.dev
MAIL_FROM_NAME="Orchestra MCP"

# Domain
DOMAIN=orchestra-mcp.dev
EOF

    chmod 600 "$SHARED_ENV"
    log "Secrets generated at $SHARED_ENV"
    warn "You MUST edit $SHARED_ENV and fill in missing values (API keys, OAuth, etc.)"
else
    warn "Secrets file already exists at $SHARED_ENV — skipping generation"
fi

# ============================================================
# 12. Create Supervisor Configs
# ============================================================
log "Creating supervisor configs..."

cat > /etc/supervisor/conf.d/caddy.conf << 'EOF'
[program:caddy]
command=/usr/bin/caddy run --config /opt/orchestra/caddy/Caddyfile
directory=/opt/orchestra/caddy
autostart=true
autorestart=true
stdout_logfile=/var/log/caddy/stdout.log
stderr_logfile=/var/log/caddy/stderr.log
EOF

cat > /etc/supervisor/conf.d/orchestra-mcp.conf << 'EOF'
[program:orchestra-mcp]
command=/opt/orchestra/mcp-server/orchestra-mcp
directory=/opt/orchestra/mcp-server
environment=PORT="3001"
autostart=true
autorestart=true
stdout_logfile=/var/log/orchestra/mcp.log
stderr_logfile=/var/log/orchestra/mcp-error.log
EOF

cat > /etc/supervisor/conf.d/laravel-worker.conf << 'EOF'
[program:laravel-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /opt/orchestra/web/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
numprocs=2
stdout_logfile=/var/log/orchestra/worker.log
stderr_logfile=/var/log/orchestra/worker-error.log
EOF

cat > /etc/supervisor/conf.d/laravel-scheduler.conf << 'EOF'
[program:laravel-scheduler]
command=/bin/bash -c "while true; do php /opt/orchestra/web/artisan schedule:run --verbose --no-interaction >> /var/log/orchestra/scheduler.log 2>&1; sleep 60; done"
autostart=true
autorestart=true
stdout_logfile=/dev/null
stderr_logfile=/var/log/orchestra/scheduler-error.log
EOF

supervisorctl reread
supervisorctl update

# ============================================================
# 13. Create Caddyfile
# ============================================================
log "Creating Caddyfile..."
cat > "$ORCHESTRA_DIR/caddy/Caddyfile" << 'CADDYFILE'
{
    email admin@orchestra-mcp.dev
}

orchestra-mcp.dev {
    log {
        output file /var/log/caddy/access.log {
            roll_size 100mb
            roll_keep 5
        }
        format json
    }

    encode gzip zstd

    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        Referrer-Policy "strict-origin-when-cross-origin"
        X-XSS-Protection "1; mode=block"
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        -Server
    }

    # ── Go MCP Server ──
    handle /mcp* {
        reverse_proxy localhost:3001
    }

    # ── Supabase API Gateway (Kong) ──
    handle /rest/v1/* {
        reverse_proxy localhost:54321
    }

    handle /auth/v1/* {
        reverse_proxy localhost:54321
    }

    handle /realtime/v1/* {
        reverse_proxy localhost:54321 {
            header_up Upgrade {http.request.header.Upgrade}
            header_up Connection {http.request.header.Connection}
        }
    }

    handle /storage/v1/* {
        reverse_proxy localhost:54321
    }

    handle /functions/v1/* {
        reverse_proxy localhost:54321
    }

    handle /ingest/* {
        reverse_proxy localhost:54321
    }

    # ── Supabase Studio (Deep Fork) ──
    handle /studio* {
        reverse_proxy localhost:54323
    }

    # ── Laravel Static Assets ──
    handle /build/* {
        root * /opt/orchestra/web/public
        file_server
        header Cache-Control "public, max-age=31536000, immutable"
    }

    handle /favicon.ico {
        root * /opt/orchestra/web/public
        file_server
    }

    handle /robots.txt {
        root * /opt/orchestra/web/public
        file_server
    }

    handle /sitemap.xml {
        root * /opt/orchestra/web/public
        file_server
    }

    # ── Laravel (catch-all) ──
    handle {
        root * /opt/orchestra/web/public
        php_fastcgi unix//run/php/php8.3-fpm.sock
        file_server
    }
}
CADDYFILE

# ============================================================
# Summary
# ============================================================
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Setup Complete!                          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Installed:${NC}"
echo "  Docker:   $(docker --version 2>/dev/null | cut -d' ' -f3 || echo 'N/A')"
echo "  Caddy:    $(caddy version 2>/dev/null || echo 'N/A')"
echo "  PHP:      $(php -v 2>/dev/null | head -1 | cut -d' ' -f2 || echo 'N/A')"
echo "  Go:       $(go version 2>/dev/null | cut -d' ' -f3 || echo 'N/A')"
echo "  Node:     $(node -v 2>/dev/null || echo 'N/A')"
echo "  Redis:    $(redis-server --version 2>/dev/null | cut -d' ' -f3 | tr -d 'v=' || echo 'N/A')"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Edit secrets:        nano $SHARED_ENV"
echo "  2. Clone Supabase:      cd $ORCHESTRA_DIR/supabase && git clone <your-fork>"
echo "  3. Configure Supabase:  cp .env.example docker/.env && edit"
echo "  4. Start Supabase:      cd docker && docker compose up -d"
echo "  5. Apply migrations:    psql -f migrations/*.sql"
echo "  6. Clone Laravel app:   cd $ORCHESTRA_DIR/web && git clone <repo> ."
echo "  7. Clone MCP server:    cd $ORCHESTRA_DIR/mcp-server && git clone <repo> ."
echo "  8. Run deploy.sh:       bash $ORCHESTRA_DIR/deploy/deploy.sh"
echo ""
log "Full log saved to $LOG_FILE"
