#!/bin/bash
# Wrapper script for ryn dev - permission granted to THIS script persists
cd "$(dirname "$0")"
pnpm tauri dev
