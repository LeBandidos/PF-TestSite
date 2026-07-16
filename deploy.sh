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

echo "Deploying ${#FILES[@]} file(s) to $SFTP_HOST:$SFTP_PORT$REMOTE_ROOT/ over SFTP:"
printf '  %s\n' "${FILES[@]}"
echo

FAILED=()
for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "skip (not found locally): $f"
    continue
  fi
  echo -n "uploading $f ... "
  if curl -s -S --ftp-create-dirs \
      --user "${SFTP_USER}:${SFTP_PASSWORD}" \
      -T "$f" \
      "sftp://${SFTP_HOST}:${SFTP_PORT}${REMOTE_ROOT}/${f}"; then
    echo "done"
  else
    echo "FAILED"
    FAILED+=("$f")
  fi
done

echo
if [ "${#FAILED[@]}" -gt 0 ]; then
  echo "Completed with failures:"
  printf '  %s\n' "${FAILED[@]}"
  exit 1
fi
echo "All files deployed successfully."
git rev-parse HEAD > "$MARKER"
