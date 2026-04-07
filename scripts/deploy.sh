#!/usr/bin/env bash
# Deploy to gh-pages.
set -euo pipefail

scriptsFolder=$(cd $(dirname "$0"); pwd)
cd "$scriptsFolder/.."

MAIN_BRANCH="main"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "$MAIN_BRANCH" ]; then
  echo "ERROR: Deploy only allowed from '$MAIN_BRANCH' (current: $BRANCH)."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Working tree is not clean."
  git status --short
  exit 1
fi

if [ ! -d dist/.git ]; then
  echo "ERROR: dist/ is not a gh-pages checkout. Run 'npm run setup' first."
  exit 1
fi

COMMIT_SHORT="$(git rev-parse --short HEAD)"
COMMIT_FULL="$(git rev-parse HEAD)"
echo "Deploying commit $COMMIT_SHORT ..."

echo "Building..."
npm run build
echo "Build OK."

# Merge commit info into version.json (build.js already wrote publicationDate + files).
BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
node -e "
  const fs = require('fs');
  const p = 'dist/version.json';
  const v = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : {};
  v.commit = '$COMMIT_FULL';
  v.commitShort = '$COMMIT_SHORT';
  v.branch = '$MAIN_BRANCH';
  v.buildDate = '$BUILD_DATE';
  fs.writeFileSync(p, JSON.stringify(v, null, 2));
"
git -C dist add -A
if git -C dist diff --cached --quiet; then
  echo "No changes in dist/ — nothing to deploy."
  exit 0
fi
git -C dist commit -m "deploy $COMMIT_SHORT ($COMMIT_FULL)"
git -C dist push

echo "Deployed $COMMIT_SHORT to gh-pages."
