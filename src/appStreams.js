const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const defsFile = path.resolve(__dirname, '../definitions/appStreams.yaml');
const content = YAML.parse(fs.readFileSync(defsFile, 'utf-8'));

// An empty definitions file yields null, and this loader hands `content` straight to the pack
// writer, so without this guard the build would publish `"appStreams": null` and say nothing.
// Every other loader here indexes into its parsed content and so fails on its own; this one does
// not. js-yaml returned `undefined` for a zero-byte file, which JSON.stringify refused and the
// build died loudly -- switching to `yaml` (which returns null) would have turned that into a
// silent bad publish, and deploy.sh does not run the test suite that would otherwise catch it.
if (content === null || typeof content !== 'object') {
  throw new Error(`appStreams definitions are empty or not a mapping: ${defsFile}`);
}

module.exports = {
  toBePublished
};

function toBePublished () {
  return [{
    title: 'App stream definitions',
    path: './',
    filename: 'appStreams.json',
    type: 'json',
    content,
    includeInPack: 'appStreams'
  }];
}
