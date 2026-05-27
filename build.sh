#!/usr/bin/env bash
# Build standalone LinkToNotes app via PyInstaller.
# Output: dist/LinkToNotes.app (macOS) or dist/LinkToNotes/ (Win/Linux)
#
# Usage:  ./build.sh
# Requires: project venv at .venv with all requirements.txt deps + pyinstaller installed.

set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -d .venv ]]; then
  echo "error: .venv not found. Create it and pip install -r requirements.txt first." >&2
  exit 1
fi

# shellcheck disable=SC1091
source .venv/bin/activate

pip show pyinstaller >/dev/null 2>&1 || pip install pyinstaller

rm -rf build dist

pyinstaller --noconfirm LinkToNotes.spec

echo
echo "Build complete."
if [[ -d dist/LinkToNotes.app ]]; then
  du -sh dist/LinkToNotes.app
  echo "macOS bundle: dist/LinkToNotes.app"
else
  du -sh dist/LinkToNotes
  echo "App folder: dist/LinkToNotes/"
fi
