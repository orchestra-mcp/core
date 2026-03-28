#!/bin/bash
# Usage: ./scripts/create-admin.sh --email=admin@example.com --password=yourpassword
# Creates an admin user in Supabase GoTrue + sets is_admin=true in profiles

set -euo pipefail

EMAIL=""
PASSWORD=""

for arg in "$@"; do
  case $arg in
    --email=*) EMAIL="${arg#*=}" ;;
    --password=*) PASSWORD="${arg#*=}" ;;
    *) echo "Usage: $0 --email=EMAIL --password=PASSWORD"; exit 1 ;;
  esac
done

if [ -z "$EMAIL" ] || [ -z "$PASSWORD" ]; then
  echo "Usage: $0 --email=EMAIL --password=PASSWORD"
  exit 1
fi

# Load env
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DOCKER_ENV="${SCRIPT_DIR}/../docker/.env"

if [ ! -f "$DOCKER_ENV" ]; then
  echo "Error: docker/.env not found"
  exit 1
fi

SERVICE_KEY=$(grep SERVICE_ROLE_KEY "$DOCKER_ENV" | head -1 | cut -d= -f2)
KONG_PORT=$(grep KONG_HTTP_PORT "$DOCKER_ENV" | head -1 | cut -d= -f2)
KONG_PORT=${KONG_PORT:-8000}

echo "Creating admin user: $EMAIL"

# Create user via GoTrue Admin API
RESPONSE=$(curl -s -X POST "http://localhost:${KONG_PORT}/auth/v1/admin/users" \
  -H "apikey: ${SERVICE_KEY}" \
  -H "Authorization: Bearer ${SERVICE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"email_confirm\":true}")

USER_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)

if [ -z "$USER_ID" ] || [ "$USER_ID" = "" ]; then
  echo "Error creating user:"
  echo "$RESPONSE"
  exit 1
fi

echo "User created: $USER_ID"

# Set is_admin=true
docker exec supabase-db psql -U supabase_admin -d postgres -c \
  "UPDATE public.profiles SET is_admin = true WHERE id = '${USER_ID}';" 2>&1

echo ""
echo "Admin user created successfully!"
echo "  Email:    $EMAIL"
echo "  Password: $PASSWORD"
echo "  User ID:  $USER_ID"
echo ""
echo "Login at: http://localhost:8082"
