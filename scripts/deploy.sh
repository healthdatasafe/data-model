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

# Reset dist/ to remote gh-pages HEAD so the deploy is idempotent regardless
# of any leftover local state (interrupted previous build, manual edits, etc.).
echo "Resetting dist/ to origin/gh-pages..."
git -C dist fetch origin gh-pages
git -C dist reset --hard origin/gh-pages
git -C dist clean -fdx -e .git

echo "Building..."
npm run build
echo "Build OK."

# Sanity-check build output before committing — a silent build failure that
# emptied dist/ but produced nothing must not be committed
# (broke demo-app.datasafe.dev on 2026-05-04, see _macro/_plans/_TEMP/_done/fix-demo-app-spa-404-loop.md).
if [ ! -s dist/index.html ]; then
  echo "ERROR: dist/index.html is missing or empty after build — refusing to deploy."
  exit 1
fi

# ── Consumer contract check ──────────────────────────────────────────────────
# data-model and hds-lib each carry their OWN `streamId:eventType` index. They
# drifted once: data-model published deprecated rename-aliases its own loader
# accepted but hds-lib's rejected, and every consumer threw on first `itemsDefs`
# access (site-agents#3). data-model's own suite can't see this — it tests its
# loader against its definitions, never the PUBLISHED pack against a DIFFERENT
# loader. So load the freshly-built pack through REAL hds-lib before publishing.
#
# An ephemeral install (not a devDependency) keeps the dependency direction one-way
# and always tests against current hds-lib. HDS_LIB_REF overrides the version tested.
HDS_LIB_REF="${HDS_LIB_REF:-github:healthdatasafe/hds-lib-js}"
echo "Consumer contract check (loading the pack through hds-lib: $HDS_LIB_REF)..."
CHECK_DIR="$(mktemp -d)"
trap 'rm -rf "$CHECK_DIR"' EXIT
if ! ( cd "$CHECK_DIR" && npm init -y >/dev/null 2>&1 && npm install --no-audit --no-fund --silent "$HDS_LIB_REF" >/dev/null 2>&1 ); then
  echo "ERROR: could not install hds-lib ($HDS_LIB_REF) for the consumer check — refusing to deploy."
  exit 1
fi
if ! node scripts/consumer-check.mjs "$PWD/dist/pack.json" "$CHECK_DIR/node_modules/hds-lib"; then
  echo "ERROR: the built pack does not load in hds-lib — refusing to deploy (see the failure above)."
  echo "       This is the site-agents#3 class of bug: a pack a consumer's loader rejects."
  exit 1
fi

# Bypass Jekyll on GitHub Pages so dotfiles + JSON are served verbatim.
touch dist/.nojekyll

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

echo "Pushed $COMMIT_SHORT to gh-pages."

# ── Publish verification ─────────────────────────────────────────────────────
# A push to gh-pages does NOT guarantee GitHub Pages republished. The `legacy`
# Pages build can error transiently (or queue), leaving model.datasafe.dev
# serving a stale build even though the push succeeded — the deploy then *looks*
# done but consumers keep reading old data (hit on 2026-07-06, Plan 77). So:
# poll the Pages build, retrigger on error, then confirm the live commit matches.
REPO_SLUG="healthdatasafe/data-model"
LIVE_URL="https://model.datasafe.dev/version.json"

if command -v gh >/dev/null 2>&1; then
  echo "Verifying GitHub Pages build..."
  built=""
  for attempt in $(seq 1 12); do
    status="$(gh api "repos/$REPO_SLUG/pages/builds/latest" --jq '.status' 2>/dev/null || echo unknown)"
    case "$status" in
      built) built=yes; break ;;
      errored) echo "  Pages build errored — retriggering..."; gh api -X POST "repos/$REPO_SLUG/pages/builds" >/dev/null 2>&1 || true ;;
      *) echo "  Pages build status: $status ($attempt/12)" ;;
    esac
    sleep 15
  done
  [ -n "$built" ] && echo "Pages build: built." \
    || echo "WARNING: Pages build did not reach 'built' — check https://github.com/$REPO_SLUG/deployments"
else
  echo "WARNING: gh CLI not found — cannot verify/retrigger the Pages build. Verify manually."
fi

# Confirm the live site actually serves this commit (Fastly cache may lag briefly).
echo "Confirming live commit at $LIVE_URL ..."
for attempt in $(seq 1 12); do
  live="$(curl -fsS "$LIVE_URL?_=$attempt$$" 2>/dev/null | grep -o '[0-9a-f]\{40\}' | head -1 || true)"
  if [ "$live" = "$COMMIT_FULL" ]; then
    echo "Deployed and LIVE: $COMMIT_SHORT verified at model.datasafe.dev ✓"
    exit 0
  fi
  echo "  live=${live:-none} (want $COMMIT_SHORT) ($attempt/12) — waiting..."
  sleep 15
done
echo "WARNING: live commit did not match $COMMIT_SHORT within timeout — model.datasafe.dev may still be propagating; re-check version.json before relying on it."
