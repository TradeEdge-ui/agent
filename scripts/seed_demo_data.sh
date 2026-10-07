#!/usr/bin/env bash
# Loads the fictional demo account (demo@brightpathstudio.com / DemoPass123!).
# Usage: ./scripts/seed_demo_data.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/../backend"

cd "$BACKEND_DIR"
if [ ! -d ".venv" ]; then
  echo "No virtualenv found at backend/.venv -- run the installation steps in README.md first."
  exit 1
fi

source .venv/bin/activate
python -m scripts.seed_demo_data
