const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const defsFile = path.resolve(__dirname, '../definitions/appStreams.yaml');
const content = yaml.load(fs.readFileSync(defsFile, 'utf-8'));

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
