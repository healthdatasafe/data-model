// Add the current SMART scope grant table and scope classes to definitions/fhir/scopes.lock.json (npm run fhir:lock).
// The lock records every stream a published grant reaches (each grant root and its subtree) with its pair, its parent
// and its items, and every scope class key with the stream it reads and the day it was first locked. It never removes
// anything; the build fails if a locked stream is removed, re-parented, given another pair, loses an item, or gains an
// item or stream the "reviewed" list does not acknowledge, and if a locked class key is removed or reads another
// stream. Run it before releasing a new mapping or class, and commit the lock with the change.
const fs = require('fs');
const { itemsById, fhirScopes, fhirScopeClasses } = require('../src/items'); // loading runs every check, the current lock included
const { readLock, lockEntries, lockClassEntries, mergeLock, LOCK_FILE_PATH } = require('../src/fhir');

const before = readLock();
const today = new Date().toISOString().slice(0, 10);
const after = mergeLock(before, lockEntries(itemsById, fhirScopes), lockClassEntries(fhirScopeClasses, today));
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
for (const [key, e] of Object.entries(after.classes)) {
  if (before.classes[key] != null) continue;
  console.log(`+ class ${key}: stream ${e.stream}, since ${e.since}`);
  added++;
}
fs.writeFileSync(LOCK_FILE_PATH, JSON.stringify(after, null, 2) + '\n', 'utf8');
console.log(added === 0 ? 'fhir scope lock: up to date' : `fhir scope lock: ${added} entr${added === 1 ? 'y' : 'ies'} added`);
