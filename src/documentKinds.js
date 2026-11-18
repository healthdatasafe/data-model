const YAML = require('yaml');
const fs = require('fs');
const path = require('path');

const { checkDocumentKinds } = require('./schemas/documentKinds');

// Document kinds (4.17.0, documentation/DOCUMENTS.md § Document kinds): a `file/xds-v1` document's class and type
// by kind, one kind per pair of the CH Term ConceptMap DocumentEntryClassCodeToDocumentEntryTypeCode.

const RECORD_ARTIFACT = '419891008';

const documentKinds = loadDocumentKinds(path.join(__dirname, '../definitions/documentKinds.yaml'));

module.exports = {
  documentKinds,
  checkDocumentKindsTable,
  RECORD_ARTIFACT,
  toBePublished
};

function loadDocumentKinds (file) {
  // JSON round trip: YAML aliases become plain copies, so a consumer editing one Coding never edits another
  const table = JSON.parse(JSON.stringify(YAML.parse(fs.readFileSync(file, 'utf8'))));
  checkDocumentKindsTable(table);
  return table;
}

/**
 * What the schema cannot check. A kind is found from a document's codes: by its type, or by its class when the type
 * is Record artifact. So a type other than Record artifact is in one kind only, a class in one Record-artifact kind
 * only, and a code has one Coding wherever it appears. A person picks a kind by its label, so no two kinds share one.
 */
function checkDocumentKindsTable (table) {
  checkDocumentKinds(table);
  const byType = {};
  const byArtifactClass = {};
  const codingByCode = {};
  const byLabel = {};
  for (const [key, kind] of Object.entries(table.kinds)) {
    for (const [lang, text] of Object.entries(kind.label)) {
      const id = `${lang}|${text.toLowerCase()}`;
      if (byLabel[id]) throw new Error(`Document kinds "${byLabel[id]}" and "${key}" share the ${lang} label "${text}"`);
      byLabel[id] = key;
    }
    for (const coding of [kind.class, kind.type]) {
      const seen = codingByCode[coding.code];
      if (seen && JSON.stringify(seen.coding) !== JSON.stringify(coding)) {
        throw new Error(`Document kind "${key}": code ${coding.code} has another Coding in "${seen.key}"`);
      }
      codingByCode[coding.code] ??= { key, coding };
    }
    const index = kind.type.code === RECORD_ARTIFACT ? byArtifactClass : byType;
    const code = kind.type.code === RECORD_ARTIFACT ? kind.class.code : kind.type.code;
    if (index[code]) throw new Error(`Document kinds "${index[code]}" and "${key}" cannot be told apart by their codes`);
    index[code] = key;
  }
}

function toBePublished () {
  return [{
    title: 'Document kinds',
    path: './',
    filename: 'documentKinds.json',
    type: 'json',
    content: documentKinds,
    includeInPack: 'documentKinds'
  }];
}
