#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_ROOT="$(cd "$FRONTEND_ROOT/../portfolio-vista-backend" && pwd)"

if [[ ! -x "$FRONTEND_ROOT/scripts/deploy-frontend.sh" ]]; then
  echo "[deploy-all] ERROR: missing $FRONTEND_ROOT/scripts/deploy-frontend.sh" >&2
  exit 1
fi
if [[ ! -x "$BACKEND_ROOT/scripts/deploy-backend.sh" ]]; then
  echo "[deploy-all] ERROR: missing $BACKEND_ROOT/scripts/deploy-backend.sh" >&2
  exit 1
fi

INSTALL=false
for arg in "$@"; do
  case "$arg" in
    --install) INSTALL=true ;;
    -h|--help)
      cat <<'EOF'
Usage: scripts/deploy-all.sh [--install]

Deploys backend (build + PM2 restart) and frontend (build into docs/).

Options:
  --install   Run npm ci for both projects
EOF
      exit 0
      ;;
    *)
      echo "[deploy-all] ERROR: Unknown arg: $arg" >&2
      exit 2
      ;;
  esac
done

BACKEND_ARGS=()
FRONTEND_ARGS=()
if [[ "$INSTALL" == "true" ]]; then
  BACKEND_ARGS+=("--install")
  FRONTEND_ARGS+=("--install")
fi

echo "[deploy-all] Deploying backend…"
"$BACKEND_ROOT/scripts/deploy-backend.sh" "${BACKEND_ARGS[@]}"

echo "[deploy-all] Deploying frontend…"
"$FRONTEND_ROOT/scripts/deploy-frontend.sh" "${FRONTEND_ARGS[@]}"

echo "[deploy-all] Done."