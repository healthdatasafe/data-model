// Add the current SMART scope grant table to definitions/fhir/scopes.lock.json (npm run fhir:lock).
// Never removes an entry: the lock records every (pair, root) ever published, and the build fails
// if a locked root's subtree comes to hold any other pair. Run it before releasing a new mapping.
const fs = require('fs');
const { fhirScopes } = require('../src/items'); // loading runs every check, the current lock included
const { readLock, mergeLock, LOCK_FILE_PATH } = require('../src/fhir');

const before = readLock();
const after = mergeLock(before, fhirScopes);
let added = 0;
for (const [pair, roots] of Object.entries(after)) {
  for (const root of roots) {
    if (!(before[pair] || []).includes(root)) {
      console.log(`+ ${pair}: ${root}`);
      added++;
    }
  }
}
fs.writeFileSync(LOCK_FILE_PATH, JSON.stringify(after, null, 2) + '\n', 'utf8');
console.log(added === 0 ? 'fhir scope lock: up to date' : `fhir scope lock: ${added} root(s) added`);
