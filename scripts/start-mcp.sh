#!/bin/bash
# Start the Orchestra MCP server with correct env vars from Docker config
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
DOCKER_ENV="${ROOT_DIR}/docker/.env"

if [ ! -f "$DOCKER_ENV" ]; then
  echo "Error: docker/.env not found"
  exit 1
fi

PW=$(grep "^POSTGRES_PASSWORD=" "$DOCKER_ENV" | head -1 | cut -d= -f2)
SERVICE_KEY=$(grep "^SERVICE_ROLE_KEY=" "$DOCKER_ENV" | head -1 | cut -d= -f2)
ANON_KEY=$(grep "^ANON_KEY=" "$DOCKER_ENV" | head -1 | cut -d= -f2)

export DATABASE_URL="postgresql://postgres:${PW}@127.0.0.1:54322/postgres?sslmode=disable"
export SUPABASE_URL="http://localhost:8000"
export SUPABASE_SERVICE_KEY="${SERVICE_KEY}"
export SUPABASE_ANON_KEY="${ANON_KEY}"
export PORT="${PORT:-3001}"

echo "Starting Orchestra MCP Server..."
echo "  Database: 127.0.0.1:54322"
echo "  Supabase: localhost:8000"
echo "  Port: ${PORT}"

cd "${ROOT_DIR}/mcp-server"
exec go run ./cmd/server
