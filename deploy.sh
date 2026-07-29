#!/usr/bin/env bash
# Deploy changed files to the live host over SFTP using credentials from .env.
# Usage:
#   ./deploy.sh                 # uploads files changed since the last successful deploy
#                                # (tracked in .deploy-marker); falls back to HEAD~1..HEAD
#                                # the first time there's no marker yet
#   ./deploy.sh HEAD~3          # uploads files changed since a given ref
#   ./deploy.sh file1 file2 ... # uploads an explicit file list (paths relative to repo root)
#
# Requires: curl built with sftp support (curl --version | grep sftp), git, and a .env
# file (gitignored) with SFTP_HOST / SFTP_PORT / SFTP_USER / SFTP_PASSWORD / SFTP_REMOTE_ROOT.

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

if [ ! -f .env ]; then
  echo "Error: .env not found. Copy your SFTP credentials into .env first." >&2
  exit 1
fi

# Load .env (KEY=VALUE per line) without echoing values anywhere.
set -a
source .env
set +a

: "${SFTP_HOST:?SFTP_HOST missing in .env}"
: "${SFTP_PORT:?SFTP_PORT missing in .env}"
: "${SFTP_USER:?SFTP_USER missing in .env}"
: "${SFTP_PASSWORD:?SFTP_PASSWORD missing in .env}"
: "${SFTP_REMOTE_ROOT:?SFTP_REMOTE_ROOT missing in .env}"

REMOTE_ROOT="${SFTP_REMOTE_ROOT%/}"
MARKER=".deploy-marker"

# Figure out which files to upload.
if [ "$#" -eq 0 ]; then
  if [ -f "$MARKER" ]; then
    FROM_REF="$(cat "$MARKER")"
  else
    FROM_REF="HEAD~1"
  fi
  mapfile -t FILES < <(git diff --name-only --diff-filter=ACMR "$FROM_REF" HEAD)
elif [ "$#" -eq 1 ] && git rev-parse --verify --quiet "$1" >/dev/null; then
  mapfile -t FILES < <(git diff --name-only --diff-filter=ACMR "$1" HEAD)
else
  FILES=("$@")
fi

if [ "${#FILES[@]}" -eq 0 ]; then
  echo "Nothing to deploy — no changed files found."
  exit 0
fi

EXISTING_FILES=()
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    EXISTING_FILES+=("$f")
  else
    echo "skip (not found locally): $f"
  fi
done

if [ "${#EXISTING_FILES[@]}" -eq 0 ]; then
  echo "Nothing to deploy — no changed files found locally."
  exit 0
fi

echo "Deploying ${#EXISTING_FILES[@]} file(s) to $SFTP_HOST:$SFTP_PORT$REMOTE_ROOT/ over SFTP:"
printf '  %s\n' "${EXISTING_FILES[@]}"
echo

# Uses Node (ssh2-sftp-client) instead of curl: curl's bundled libssh2 fails
# to negotiate a key exchange algorithm with this host's SSH server.
#
# MSYS2_ENV_CONV_EXCL is needed under Git Bash on Windows: its runtime rewrites
# POSIX-looking env vars into Windows paths when launching a native .exe, so
# node.exe would otherwise see SFTP_REMOTE_ROOT as "C:/Program Files/Git/public"
# and hang trying to mkdir that tree on the remote host. Harmless elsewhere.
MSYS2_ENV_CONV_EXCL='SFTP_REMOTE_ROOT' node deploy.mjs "${EXISTING_FILES[@]}"
DEPLOY_STATUS=$?

if [ "$DEPLOY_STATUS" -ne 0 ]; then
  exit "$DEPLOY_STATUS"
fi
git rev-parse HEAD > "$MARKER"
