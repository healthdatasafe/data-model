const Ajv = require('ajv');

// A vocabulary labels the values of one or more eventType enums and carries their code mappings
// (definitions/vocabularies/*.yaml, documentation/MEDICATION.md § Vocabularies, ALLERGY.md § Reactions). The schema checks the shape;
// src/vocabularies.js checks what it cannot: each bound field exists and its enum equals the vocabulary's values; each
// Coding field of `codings` exists and every value carries its code; every scale lists values of the vocabulary only.

module.exports = {
  checkVocabulary,
  toBePublished
};

const localizedEnFr = {
  type: 'object',
  required: ['en', 'fr'],
  properties: {
    en: { type: 'string', minLength: 1 },
    fr: { type: 'string', minLength: 1 },
    es: { type: 'string', minLength: 1 },
    de: { type: 'string', minLength: 1 },
    it: { type: 'string', minLength: 1 },
    pt: { type: 'string', minLength: 1 },
    'pt-BR': { type: 'string', minLength: 1 }
  },
  additionalProperties: false
};

// A field path: object keys joined with dots (an array along the path resolves to its items).
const fieldPath = { type: 'string', pattern: '^[a-zA-Z][a-zA-Z0-9]*(\\.[a-zA-Z][a-zA-Z0-9]*)*$' };

// A value key: lowercase, a letter first, then letters, digits and dashes.
const valueKey = { type: 'string', pattern: '^[a-z][a-z0-9-]*$' };

// A vocabulary labels an enum (`binds`) or the codes of a Coding field (`codings`, 4.50.0): exactly one of the two.
const vocabularySchema = {
  $id: 'https://model.datasafe.dev/json-schemas/vocabulary.json',
  title: 'HDS vocabulary',
  type: 'object',
  required: ['values'],
  oneOf: [{ required: ['binds'] }, { required: ['codings'] }],
  additionalProperties: false,
  properties: {
    fhirElement: { type: 'string', minLength: 1 },
    // The Coding fields whose codes it labels (4.50.0): a writer codes them from its values, a reader labels them.
    codings: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['eventType', 'path', 'system'],
        additionalProperties: false,
        properties: {
          eventType: { type: 'string', minLength: 1 },
          path: fieldPath,
          system: { type: 'string', enum: ['http://snomed.info/sct'] }
        }
      }
    },
    // Closed answer sets of its values (4.50.0); in a `ranked` scale the order is the rank, lowest first.
    scales: {
      type: 'object',
      minProperties: 1,
      propertyNames: valueKey,
      additionalProperties: {
        type: 'object',
        required: ['values'],
        additionalProperties: false,
        properties: {
          ranked: { type: 'boolean' },
          values: { type: 'array', minItems: 2, uniqueItems: true, items: valueKey }
        }
      }
    },
    binds: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['eventType', 'path'],
        additionalProperties: false,
        properties: {
          eventType: { type: 'string', minLength: 1 },
          path: fieldPath
        }
      }
    },
    values: {
      type: 'object',
      minProperties: 1,
      propertyNames: valueKey,
      additionalProperties: {
        type: 'object',
        required: ['label'],
        additionalProperties: false,
        properties: {
          label: localizedEnFr,
          fhir: { type: 'string', minLength: 1 },
          snomed: { type: 'string', pattern: '^[1-9][0-9]{5,17}$' }
        }
      }
    }
  }
};

const ajv = new Ajv({ allErrors: true });
const validateVocabulary = ajv.compile(vocabularySchema);

function checkVocabulary (vocabulary, key) {
  if (!validateVocabulary(vocabulary)) {
    throw new Error(`Vocabulary "${key}" is invalid: ${ajv.errorsText(validateVocabulary.errors, { dataVar: key })}`);
  }
}

function toBePublished () {
  return [{
    title: 'Json Schema Vocabulary',
    path: './json-schemas/',
    filename: 'vocabulary.json',
    type: 'json',
    content: vocabularySchema
  }];
}
