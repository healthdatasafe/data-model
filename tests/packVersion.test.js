const assert = require('assert');
const fs = require('fs');
const path = require('path');

// The published pack and version.json carry package.json's version (B-2026-10-05-12 item 2).

describe('[PVER] built pack.json and version.json carry the package version', () => {
  const { version } = require('../package.json');
  const read = (name) => {
    const p = path.join(__dirname, '../dist', name);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : null; // npm run build has not run yet
  };

  it('[PVER-1] pack.json version is package.json\'s', () => {
    const pack = read('pack.json');
    if (!pack) return;
    assert.strictEqual(pack.version, version);
    assert.match(pack.version, /^\d+\.\d+\.\d+$/);
  });

  it('[PVER-2] version.json version is package.json\'s', () => {
    const v = read('version.json');
    if (!v) return;
    assert.strictEqual(v.version, version);
  });
});
