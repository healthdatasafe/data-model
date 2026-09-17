const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const defsDir = path.resolve(__dirname, '../definitions/conversions');

// Each YAML file defines one category (e.g., mass, length, temperature)
// Format:
//   metric: <unit>      — unit for metric system
//   imperial: <unit>    — unit for imperial system
//   factors:
//     <from>:
//       <to>: <number>           — simple multiplier
//       <to>: [factor, offset]   — affine: value * factor + offset
const data = {};

for (const file of fs.readdirSync(defsDir).filter(f => f.endsWith('.yaml'))) {
  const category = path.basename(file, '.yaml');
  const content = YAML.parse(fs.readFileSync(path.join(defsDir, file), 'utf-8'));
  data[category] = {
    metric: content.metric,
    imperial: content.imperial,
    factors: content.factors
  };
}

module.exports = {
  toBePublished
};

function toBePublished () {
  return [{
    title: 'Unit conversions',
    path: './',
    filename: 'conversions.json',
    type: 'json',
    content: data,
    includeInPack: 'conversions'
  }];
}
