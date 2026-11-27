const YAML = require('yaml');
const fs = require('fs');
const path = require('path');

const { eventTypesById } = require('./eventTypes');
const { checkVocabulary } = require('./schemas/vocabularies');

const vocabulariesPath = path.join(__dirname, '../definitions/vocabularies');

// Labels and code mappings of eventType enum values (3.46.0, documentation/MEDICATION.md § Vocabularies; allergy
// reaction severity, ALLERGY.md § Reactions).
// The eventType enum is the contract; a vocabulary is pinned to it here, at load time, so the two cannot drift.
// A vocabulary of codes (4.50.0, lab-result, BLOOD-CHEMISTRY.md § Qualitative results) labels a Coding field instead.

const vocabulariesById = {};

module.exports = {
  vocabulariesById,
  addVocabulary,
  resolveEnum,
  resolveCoding,
  toBePublished
};

// field "eventType path" → vocabulary key, so a field is labelled by one vocabulary only
const boundFields = {};

// the value key that holds the code of a `codings` system (4.50.0)
const CODE_KEY_OF_SYSTEM = { 'http://snomed.info/sct': 'snomed' };

for (const file of fs.readdirSync(vocabulariesPath).sort()) {
  if (!file.endsWith('.yaml')) continue;
  const content = YAML.parse(fs.readFileSync(path.join(vocabulariesPath, file), 'utf8'));
  for (const [key, vocabulary] of Object.entries(content)) addVocabulary(key, vocabulary);
}

/**
 * The enum of a field: `path` is dotted through object `properties`; an array, along the path (`reactions.severity`)
 * or at its end, resolves to its `items`.
 * @returns {Array<string>|null}
 */
function resolveEnum (eventType, fieldPath) {
  let node = eventTypesById(eventType);
  if (node == null) return null;
  for (const segment of fieldPath.split('.')) {
    if (node.type === 'array') node = node.items;
    node = node?.properties?.[segment];
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
  const fields = checkCodings(key, vocabulary);
  checkScales(key, vocabulary, values);
  for (const { eventType, path: fieldPath } of vocabulary.binds ?? []) {
    const field = `${eventType} ${fieldPath}`;
    const enumValues = resolveEnum(eventType, fieldPath);
    if (enumValues == null) throw new Error(`Vocabulary "${key}" binds ${field}, which is not a string enum (or an array of one) in the eventTypes`);
    if (JSON.stringify(enumValues) !== JSON.stringify(values)) {
      throw new Error(`Vocabulary "${key}" values [${values}] differ from the enum of ${field} [${enumValues}] (same values, same order)`);
    }
    fields.push(field);
  }
  for (const field of fields) {
    if (bound[field]) throw new Error(`Vocabulary "${key}" binds ${field}, already bound by "${bound[field]}"`);
  }
  for (const field of fields) bound[field] = key;
  registry[key] = vocabulary;
  return vocabulary;
}

/**
 * The Coding items of a field (4.50.0): `path` as in resolveEnum, ending on an array of objects with `system` and `code`.
 * @returns {object|null} the Coding schema
 */
function resolveCoding (eventType, fieldPath) {
  let node = eventTypesById(eventType);
  if (node == null) return null;
  for (const segment of fieldPath.split('.')) {
    if (node.type === 'array') node = node.items;
    node = node?.properties?.[segment];
    if (node == null) return null;
  }
  if (node.type !== 'array') return null;
  const coding = node.items;
  if (coding?.type !== 'object' || coding.properties?.system == null || coding.properties?.code == null) return null;
  return coding;
}

/**
 * A vocabulary of codes (4.50.0) names Coding fields, and every value carries a distinct code of each system.
 * @returns {Array<string>} the fields it claims, "eventType path system", one vocabulary per field and system
 */
function checkCodings (key, vocabulary) {
  const fields = [];
  for (const { eventType, path: fieldPath, system } of vocabulary.codings ?? []) {
    if (resolveCoding(eventType, fieldPath) == null) throw new Error(`Vocabulary "${key}" codings ${eventType} ${fieldPath}, which is not an array of Codings in the eventTypes`);
    fields.push(`${eventType} ${fieldPath} ${system}`);
    const codeKey = CODE_KEY_OF_SYSTEM[system];
    const seen = new Map();
    for (const [value, def] of Object.entries(vocabulary.values)) {
      if (def[codeKey] == null) throw new Error(`Vocabulary "${key}" value "${value}" has no ${codeKey} code, which ${eventType} ${fieldPath} needs`);
      if (seen.has(def[codeKey])) throw new Error(`Vocabulary "${key}" values "${seen.get(def[codeKey])}" and "${value}" share the ${codeKey} code ${def[codeKey]}`);
      seen.set(def[codeKey], value);
    }
  }
  return fields;
}

/** Every scale (4.50.0, never renamed, never loses a value, `ranked` never changes) lists values of the vocabulary only, and every value is on at least one scale. */
function checkScales (key, vocabulary, values) {
  if (vocabulary.scales == null) return;
  const onScale = new Set();
  for (const [scale, { values: list }] of Object.entries(vocabulary.scales)) {
    for (const value of list) {
      if (!values.includes(value)) throw new Error(`Vocabulary "${key}" scale "${scale}" lists "${value}", which is not one of its values`);
      onScale.add(value);
    }
  }
  const off = values.filter((v) => !onScale.has(v));
  if (off.length > 0) throw new Error(`Vocabulary "${key}" values [${off}] are on no scale`);
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
