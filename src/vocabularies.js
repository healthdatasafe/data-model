const YAML = require('yaml');
const fs = require('fs');
const path = require('path');

const { eventTypesById } = require('./eventTypes');
const { checkVocabulary } = require('./schemas/vocabularies');

const vocabulariesPath = path.join(__dirname, '../definitions/vocabularies');

// Labels and code mappings of eventType enum values (3.46.0, documentation/MEDICATION.md § Vocabularies).
// The eventType enum is the contract; a vocabulary is pinned to it here, at load time, so the two cannot drift.

const vocabulariesById = {};

module.exports = {
  vocabulariesById,
  addVocabulary,
  resolveEnum,
  toBePublished
};

// field "eventType path" → vocabulary key, so a field is labelled by one vocabulary only
const boundFields = {};

for (const file of fs.readdirSync(vocabulariesPath).sort()) {
  if (!file.endsWith('.yaml')) continue;
  const content = YAML.parse(fs.readFileSync(path.join(vocabulariesPath, file), 'utf8'));
  for (const [key, vocabulary] of Object.entries(content)) addVocabulary(key, vocabulary);
}

/**
 * The enum of a field: `path` is dotted through object `properties`; an array field resolves to its `items`.
 * @returns {Array<string>|null}
 */
function resolveEnum (eventType, fieldPath) {
  let node = eventTypesById(eventType);
  if (node == null) return null;
  for (const segment of fieldPath.split('.')) {
    node = node.properties?.[segment];
    if (node == null) return null;
  }
  if (node.type === 'array') node = node.items;
  if (node?.type !== 'string' || !Array.isArray(node.enum)) return null;
  return node.enum;
}

function addVocabulary (key, vocabularySrc, registry = vocabulariesById, bound = boundFields) {
  const vocabulary = structuredClone(vocabularySrc);
  checkVocabulary(vocabulary, key);
  if (registry[key]) throw new Error(`Vocabulary "${key}" is defined twice`);
  const values = Object.keys(vocabulary.values);
  for (const { eventType, path: fieldPath } of vocabulary.binds) {
    const field = `${eventType} ${fieldPath}`;
    const enumValues = resolveEnum(eventType, fieldPath);
    if (enumValues == null) throw new Error(`Vocabulary "${key}" binds ${field}, which is not a string enum (or an array of one) in the eventTypes`);
    if (JSON.stringify(enumValues) !== JSON.stringify(values)) {
      throw new Error(`Vocabulary "${key}" values [${values}] differ from the enum of ${field} [${enumValues}] (same values, same order)`);
    }
    if (bound[field]) throw new Error(`Vocabulary "${key}" binds ${field}, already bound by "${bound[field]}"`);
    bound[field] = key;
  }
  registry[key] = vocabulary;
  return vocabulary;
}

function toBePublished () {
  return [{
    title: 'Vocabularies dictionnary',
    path: './',
    filename: 'vocabularies.json',
    type: 'json',
    content: vocabulariesById,
    includeInPack: 'vocabularies'
  }];
}
