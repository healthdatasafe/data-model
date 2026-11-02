const YAML = require('yaml');
const fs = require('fs');
const path = require('path');
const streamsFilePath = path.join(__dirname, '../definitions/streams');

const roots = [];
const streamsById = {};

module.exports = {
  roots,
  streamsById,
  getRootOfById,
  getAncestorsById,
  isDescendantOf,
  checkLocalisedNames,
  toBePublished
};

function getRootOfById (id) {
  if (!streamsById[id]) {
    throw new Error(`Stream with id ${id} not found`);
  }
  let stream = streamsById[id];
  while (stream.parentId) {
    stream = streamsById[stream.parentId];
  }
  return stream;
}

/**
 * Returns the chain of stream ids walking up from `id` (inclusive) to the root.
 * `[id, parent, grandparent, ..., root]`. Throws if `id` is unknown.
 */
function getAncestorsById (id) {
  if (!streamsById[id]) {
    throw new Error(`Stream with id ${id} not found`);
  }
  const chain = [];
  let current = streamsById[id];
  while (current) {
    chain.push(current.id);
    current = current.parentId ? streamsById[current.parentId] : null;
  }
  return chain;
}

/**
 * True if `candidateId` is `ancestorId` itself or any descendant of `ancestorId`.
 * Used to validate context-via-substream: a context streamId must be the
 * itemDef's streamId or a descendant.
 */
function isDescendantOf (candidateId, ancestorId) {
  if (!streamsById[candidateId]) return false;
  if (!streamsById[ancestorId]) return false;
  return getAncestorsById(candidateId).includes(ancestorId);
}

// Load all YAML files from the streams directory

for (const file of fs.readdirSync(streamsFilePath)) {
  if (file.endsWith('.yaml')) {
    const filePath = path.join(streamsFilePath, file);
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const root = YAML.parse(fileContent);
    indexStreams(root, null);
    roots.push(root);
  }
}

function indexStreams (stream, parentId) {
  if (stream.id == null) throw new Error('missing id for stream: ' + JSON.stringify(stream));
  if (stream.name == null) throw new Error('missing name for stream: ' + JSON.stringify(stream));
  if (streamsById[stream.id] !== undefined) {
    throw new Error(`Stream with id ${stream.id} already exists, cannot add: ${JSON.stringify(stream)}`);
  }
  if (stream.parentId && parentId !== null) {
    console.log(`${stream.id} does not need parentId : ${stream.parentId}`);
  }
  checkLocalisedNames(stream);
  stream.parentId = parentId;
  streamsById[stream.id] = stream;
  if (stream.children) {
    for (const child of stream.children) {
      indexStreams(child, stream.id);
    }
  }
}

/**
 * Optional localised names of a stream, for consent screens (3.38.0): `label` and `description`, when present, are
 * `{ en, fr }` objects of non-empty strings, and `label.en` is the stream's `name` (the name it is created with).
 */
function checkLocalisedNames (stream) {
  for (const key of ['label', 'description']) {
    if (stream[key] === undefined) continue;
    const text = stream[key];
    if (text === null || typeof text !== 'object' || Array.isArray(text)) {
      throw new Error(`stream ${stream.id}: ${key} must be an object { en, fr }`);
    }
    for (const lang of ['en', 'fr']) {
      if (typeof text[lang] !== 'string' || text[lang].length === 0) {
        throw new Error(`stream ${stream.id}: ${key}.${lang} must be a non-empty string`);
      }
    }
  }
  if (stream.label !== undefined && stream.label.en !== stream.name) {
    throw new Error(`stream ${stream.id}: label.en must equal name`);
  }
}

function toBePublished () {
  return [{
    title: 'Streams Tree',
    path: './',
    filename: 'streamsTree.json',
    type: 'json',
    content: roots,
    includeInPack: 'streams'
  }];
}
