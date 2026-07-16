#!/usr/bin/env bash
# One command: push committed changes to GitHub, then deploy them to the live host.
# Run this yourself whenever you want to "push to filezilla" — it does not run on its own.
#
# Usage: ./ship.sh

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

echo "==> git push"
git push origin main

echo
echo "==> deploy to live host"
./deploy.sh
