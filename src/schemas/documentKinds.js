const Ajv = require('ajv');

// The document-kind table (definitions/documentKinds.yaml, documentation/DOCUMENTS.md § Document kinds): each kind's
// class and first type for a `file/xds-v1` document, as SNOMED CT Codings from the CH Term value sets. The schema
// checks the shape; src/documentKinds.js checks what it cannot (one kind per pair, one Coding per class code).

module.exports = {
  checkDocumentKinds,
  toBePublished
};

const SNOMED = 'http://snomed.info/sct';

const label = {
  type: 'object',
  required: ['en', 'fr'],
  properties: {
    en: { type: 'string', minLength: 1 },
    fr: { type: 'string', minLength: 1 },
    de: { type: 'string', minLength: 1 },
    it: { type: 'string', minLength: 1 },
    es: { type: 'string', minLength: 1 },
    pt: { type: 'string', minLength: 1 },
    'pt-BR': { type: 'string', minLength: 1 }
  },
  additionalProperties: false
};

// The Coding a writer copies into `file/xds-v1` content as it is: `version` only for a Swiss-extension concept
const coding = {
  type: 'object',
  required: ['system', 'code', 'display'],
  additionalProperties: false,
  properties: {
    system: { const: SNOMED },
    version: { const: `${SNOMED}/2011000195101` },
    code: { type: 'string', pattern: '^[1-9][0-9]{5,17}$' },
    display: { type: 'string', minLength: 1 }
  }
};

// The second entry of a document's `type` (4.32.0), for a kind no CH Term row names; its code is the kind's key
const detail = {
  type: 'object',
  required: ['system', 'code', 'display'],
  additionalProperties: false,
  properties: {
    system: { const: 'https://hds.ngo/fhir/CodeSystem/document-kind' },
    code: { type: 'string', pattern: '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' },
    display: { type: 'string', minLength: 1 }
  }
};

const uri = { type: 'string', pattern: '^https?://' };

const kindProperties = {
  label,
  description: label,
  class: coding,
  type: coding,
  // the writer's default for which printed date is the event time: the care reported, or `creation`
  timeBasis: { enum: ['service', 'creation'] },
  // the documents stream a document of this kind is filed under by default; none: it stays on the root
  stream: { type: 'string', pattern: '^documents(-[a-z0-9]+)+$' },
  // a pair a later CH Term release dropped: kept, so a stored document still reads back, never offered
  deprecated: { const: true }
};
const kindKey = { pattern: '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' };

const documentKindsSchema = {
  $id: 'https://model.datasafe.dev/json-schemas/documentKinds.json',
  title: 'HDS document kinds',
  type: 'object',
  required: ['source', 'kinds'],
  additionalProperties: false,
  properties: {
    source: {
      type: 'object',
      required: ['conceptMap', 'classCodes', 'typeCodes', 'version'],
      additionalProperties: false,
      properties: {
        conceptMap: uri,
        classCodes: uri,
        typeCodes: uri,
        version: { type: 'string', minLength: 1 }
      }
    },
    kinds: {
      type: 'object',
      minProperties: 1,
      propertyNames: kindKey,
      additionalProperties: {
        type: 'object',
        required: ['label', 'description', 'class', 'type', 'timeBasis'],
        additionalProperties: false,
        properties: kindProperties
      }
    },
    // kinds no CH Term row names (4.32.0), in a section an earlier reader does not see
    detailKinds: {
      type: 'object',
      propertyNames: kindKey,
      additionalProperties: {
        type: 'object',
        required: ['label', 'description', 'class', 'type', 'detail', 'timeBasis'],
        additionalProperties: false,
        properties: { ...kindProperties, detail }
      }
    }
  }
};

const ajv = new Ajv({ allErrors: true });
const validateDocumentKinds = ajv.compile(documentKindsSchema);

function checkDocumentKinds (documentKinds) {
  if (!validateDocumentKinds(documentKinds)) {
    throw new Error(`Document kinds are invalid: ${ajv.errorsText(validateDocumentKinds.errors, { dataVar: 'documentKinds' })}`);
  }
}

function toBePublished () {
  return [{
    title: 'Json Schema Document kinds',
    path: './json-schemas/',
    filename: 'documentKinds.json',
    type: 'json',
    content: documentKindsSchema
  }];
}
