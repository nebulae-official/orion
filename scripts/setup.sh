#!/usr/bin/env bash
set -euo pipefail

echo "==> Checking prerequisites..."

# Go
if ! command -v go &>/dev/null; then
  echo "ERROR: go not found. Install Go 1.24+ from https://go.dev/dl/"
  exit 1
fi
GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
echo "  go $GO_VERSION"

# Python
if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 not found. Install Python 3.13+ from https://python.org"
  exit 1
fi
PY_VERSION=$(python3 --version | awk '{print $2}')
echo "  python $PY_VERSION"

# Node
if ! command -v node &>/dev/null; then
  echo "ERROR: node not found. Install Node.js 22 LTS from https://nodejs.org"
  exit 1
fi
NODE_VERSION=$(node --version)
echo "  node $NODE_VERSION"

echo ""
echo "==> Installing Go dependencies..."
go mod download

echo ""
echo "==> Installing dashboard dependencies..."
(cd dashboard && npm ci)

echo ""
echo "==> Installing Python service dependencies..."
if ! command -v uv &>/dev/null; then
  echo "WARNING: uv not found. Install uv from https://docs.astral.sh/uv/"
  echo "  Skipping Python service dependency installation."
else
  for svc in scout director media editor pulse publisher; do
    echo "  Installing $svc dependencies..."
    (cd services/$svc && uv sync)
  done
fi

echo ""
echo "==> Copying .env.example -> .env (if not exists)..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "  Created .env"
else
  echo "  .env already exists, skipping"
fi

echo ""
echo "Setup complete. Run 'make run' to start the gateway."
