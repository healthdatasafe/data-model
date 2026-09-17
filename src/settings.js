const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const defsFile = path.resolve(__dirname, '../definitions/settings/settings.yaml');
const content = YAML.parse(fs.readFileSync(defsFile, 'utf-8'));

// Build the settings map: { key: { eventType, default, type, options? } }
const data = {};
for (const [key, def] of Object.entries(content)) {
  data[key] = {
    eventType: def.eventType,
    default: def.default,
    type: def.type
  };
  if (def.options) data[key].options = def.options;
}

module.exports = {
  toBePublished
};

function toBePublished () {
  return [{
    title: 'User settings definitions',
    path: './',
    filename: 'settings.json',
    type: 'json',
    content: data,
    includeInPack: 'settings'
  }];
}
