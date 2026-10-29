// Add the current SMART scope grant table to definitions/fhir/scopes.lock.json (npm run fhir:lock).
// The lock records every stream a published grant reaches (each grant root and its subtree) with its pair, its parent
// and its items. It never removes anything; the build fails if a locked stream is removed, re-parented, given another
// pair, loses an item, or gains an item or stream the "reviewed" list does not acknowledge. Run it before releasing a new
// mapping, and commit the lock with the change.
const fs = require('fs');
const { itemsById, fhirScopes } = require('../src/items'); // loading runs every check, the current lock included
const { readLock, lockEntries, mergeLock, LOCK_FILE_PATH } = require('../src/fhir');

const before = readLock();
const after = mergeLock(before, lockEntries(itemsById, fhirScopes));
let added = 0;
for (const [id, e] of Object.entries(after.streams)) {
  const was = before.streams[id];
  if (was == null) {
    console.log(`+ ${id} (${e.pair}, parent ${e.parent}): ${e.items.join(', ') || 'no item'}`);
    added++;
    continue;
  }
  for (const key of e.items.filter((k) => !was.items.includes(k))) {
    console.log(`+ ${id}: item ${key}`);
    added++;
  }
}
fs.writeFileSync(LOCK_FILE_PATH, JSON.stringify(after, null, 2) + '\n', 'utf8');
console.log(added === 0 ? 'fhir scope lock: up to date' : `fhir scope lock: ${added} entr${added === 1 ? 'y' : 'ies'} added`);
