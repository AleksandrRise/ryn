#!/bin/bash
# Wrapper script for ryn dev with hot-reload
cd "$(dirname "$0")"

# Load environment variables (including XAI_API_KEY) from .env if present
if [ -f ".env" ]; then
  set -a
  # shellcheck source=/dev/null
  . ".env"
  set +a
fi

DEV_PORT=3000

# Start Next.js dev server with HMR (uses script from package.json)
pnpm dev &
NEXT_PID=$!

# Ensure cleanup on exit
cleanup() {
  if ps -p $NEXT_PID >/dev/null 2>&1; then
    kill $NEXT_PID
  fi
}
trap cleanup EXIT

# Wait for dev server to be ready (uses npx wait-on if available, else curl loop)
if command -v npx >/dev/null 2>&1; then
  npx wait-on "http://localhost:${DEV_PORT}" --timeout 60000 || true
else
  for i in $(seq 1 60); do
    if curl -s "http://localhost:${DEV_PORT}" >/dev/null 2>&1; then break; fi
    sleep 1
  done
fi

pnpm tauri dev
