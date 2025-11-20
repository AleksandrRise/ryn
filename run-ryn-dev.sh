#!/bin/bash
# Wrapper script for ryn dev - permission granted to THIS script persists
cd "$(dirname "$0")"

# Load environment variables (including XAI_API_KEY) from .env if present
if [ -f ".env" ]; then
  set -a
  # shellcheck source=/dev/null
  . ".env"
  set +a
fi

pnpm tauri dev
