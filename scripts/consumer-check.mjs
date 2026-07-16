// Consumer contract check — load the freshly-built pack through REAL hds-lib.
//
// Why this exists: data-model and hds-lib each carry their OWN implementation of the
// `streamId:eventType` index. They drifted once — data-model published rename-aliases
// its own loader accepted but hds-lib's rejected, and every consumer threw on first
// `itemsDefs` access (site-agents#3). data-model's own test suite cannot catch this: it
// validates its loader against its definitions, never the PUBLISHED pack against a
// DIFFERENT loader. This script is that missing check, run pre-publish by deploy.sh.
//
// It deliberately uses the real published consumer (an ephemeral hds-lib install), not a
// reimplementation — a copy of the loader would just drift again, which is the bug.
//
// Usage: node scripts/consumer-check.mjs <abs-path-to-pack.json> <abs-path-to-hds-lib-dir>
// Exits non-zero (aborting the deploy) if the pack fails to load or is empty.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const [, , packPath, hdsLibDir] = process.argv;
if (!packPath || !hdsLibDir) {
  console.error('consumer-check: usage: consumer-check.mjs <pack.json> <hds-lib-dir>');
  process.exit(2);
}

function fail (msg) {
  console.error(`consumer-check: FAIL — ${msg}`);
  process.exit(1);
}

let HDSModel;
try {
  ({ HDSModel } = await import(pathToFileURL(join(hdsLibDir, 'js/index.js')).href));
} catch (e) {
  fail(`could not load hds-lib from ${hdsLibDir}: ${e.message}`);
}

const pack = JSON.parse(readFileSync(packPath, 'utf8'));

const model = new HDSModel('file://local-pack');
try {
  model.loadFromObject(pack); // freezes + indexes; cheap
} catch (e) {
  fail(`hds-lib rejected the pack on load: ${e.message}`);
}

// The exact calls that threw in site-agents#3 — building the streamId:eventType index
// is lazy, so the throw only surfaces here, on first access.
let items;
try {
  items = model.itemsDefs.getAll();
  model.itemsDefs.getAllActive();
} catch (e) {
  fail(`hds-lib threw building the itemsDefs index: ${e.message}`);
}

if (!items || items.length === 0) {
  fail('itemsDefs.getAll() returned no items — the pack is empty or malformed');
}

// Resolve a real event through the index — exercises forEvent / the alias contract on
// whatever the pack actually ships, so a broken deprecated-alias pair is caught here too.
const sample = items.find((i) => !i.isDeprecated && i.data?.eventType && Array.isArray(i.data?.streamIds ? i.data.streamIds : [i.data.streamId]));
if (sample) {
  const streamId = sample.data.streamId;
  const eventType = sample.data.eventType;
  try {
    const resolved = model.itemsDefs.forEvent({ streamIds: [streamId], type: eventType });
    if (!resolved) fail(`forEvent found no itemDef for a pack item (${streamId}:${eventType})`);
  } catch (e) {
    fail(`forEvent threw resolving ${streamId}:${eventType}: ${e.message}`);
  }
}

const hdsLibVersion = JSON.parse(readFileSync(join(hdsLibDir, 'package.json'), 'utf8')).version;
console.log(`consumer-check: OK — ${items.length} items load in hds-lib ${hdsLibVersion}`);
