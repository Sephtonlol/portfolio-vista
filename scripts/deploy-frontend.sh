#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$FRONTEND_ROOT"

if [[ ! -f package.json ]]; then
  echo "[deploy-frontend] ERROR: package.json not found in $FRONTEND_ROOT" >&2
  exit 1
fi

echo "[deploy-frontend] Frontend root: $FRONTEND_ROOT"

INSTALL=false
for arg in "$@"; do
  case "$arg" in
    --install) INSTALL=true ;;
    -h|--help)
      cat <<'EOF'
Usage: scripts/deploy-frontend.sh [--install]

Builds the Angular frontend into ./docs for static hosting.

Options:
  --install   Run npm ci before building (recommended on fresh servers)
EOF
      exit 0
      ;;
    *)
      echo "[deploy-frontend] ERROR: Unknown arg: $arg" >&2
      exit 2
      ;;
  esac
done

if [[ "$INSTALL" == "true" || ! -d node_modules ]]; then
  echo "[deploy-frontend] Installing dependencies (npm ci)…"
  npm ci
fi

# Preserve deployment-only files/folders that Angular build may wipe.
TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "$TMP_DIR"; }
trap cleanup EXIT

preserve_path() {
  local rel="$1"
  if [[ -e "$FRONTEND_ROOT/docs/$rel" ]]; then
    mkdir -p "$TMP_DIR/$(dirname "$rel")"
    cp -a "$FRONTEND_ROOT/docs/$rel" "$TMP_DIR/$rel"
  fi
}

preserve_path "CNAME"
# Optional extra assets you currently keep under docs/ (not emitted by Angular build by default)
preserve_path "assets/quiz-app"
preserve_path "assets/stimuliz"
preserve_path "media"

echo "[deploy-frontend] Building (npm run build:docs)…"
npm run build:docs

restore_path() {
  local rel="$1"
  if [[ -e "$TMP_DIR/$rel" ]]; then
    mkdir -p "$FRONTEND_ROOT/docs/$(dirname "$rel")"
    rm -rf "$FRONTEND_ROOT/docs/$rel" || true
    cp -a "$TMP_DIR/$rel" "$FRONTEND_ROOT/docs/$rel"
  fi
}

restore_path "CNAME"
restore_path "assets/quiz-app"
restore_path "assets/stimuliz"
restore_path "media"

echo "[deploy-frontend] Done. Output in $FRONTEND_ROOT/docs"