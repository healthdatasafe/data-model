const Ajv = require('ajv');

// A vocabulary labels the values of one or more eventType enums and carries their code mappings
// (definitions/vocabularies/*.yaml, documentation/MEDICATION.md § Vocabularies). The schema checks the shape;
// src/vocabularies.js checks what it cannot: each bound field exists and its enum equals the vocabulary's values.

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
    es: { type: 'string', minLength: 1 }
  },
  additionalProperties: false
};

const vocabularySchema = {
  $id: 'https://model.datasafe.dev/json-schemas/vocabulary.json',
  title: 'HDS vocabulary',
  type: 'object',
  required: ['binds', 'values'],
  additionalProperties: false,
  properties: {
    fhirElement: { type: 'string', minLength: 1 },
    binds: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['eventType', 'path'],
        additionalProperties: false,
        properties: {
          eventType: { type: 'string', minLength: 1 },
          path: { type: 'string', pattern: '^[a-zA-Z][a-zA-Z0-9]*(\\.[a-zA-Z][a-zA-Z0-9]*)*$' }
        }
      }
    },
    values: {
      type: 'object',
      minProperties: 1,
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
