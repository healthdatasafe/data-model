// JSON Schemas of the documented `clientData` keys that have a closed shape (documentation/PROVENANCE.md).
// Most keys are conventions defined in prose; these two are closed objects, so their shape is pinned here, tested
// (tests/hdsReader.test.js) and published as json-schemas/hds-source-anchor.json and json-schemas/hds-extraction.json.
// The eventType `message/hds-reader-v1` inlines the same shapes (no `$ref` in event type schemas, AGENTS.md), and a
// test pins each copy to the schema below.
// Portable subset: compiles under draft-04 (the cores) and draft-07, so no const, not, if/then/else or $ref. Compile
// the published files as draft-07, not 2020-12 (the tuple `items` array would mean something else there).

// Values of the lab and date keys documented in prose (BLOOD-CHEMISTRY.md, PARTIAL-DATES.md), for the copies
// that carry them in a closed shape (message/hds-reader-v1 `proposal.clientData`).
const enums = {
  hdsInterpretation: ['H', 'L', 'N', 'A', 'HH', 'LL'],
  hdsComparator: ['<', '<=', '>', '>='],
  hdsTimePrecision: ['minute', 'day', 'month', 'year', 'approx', 'unknown']
};

const hdsSourceAnchor = sourceAnchorSchema();
const hdsExtraction = extractionSchema();

module.exports = {
  hdsSourceAnchor,
  hdsExtraction,
  enums,
  toBePublished
};

function sourceAnchorSchema () {
  const percent = { type: 'number', minimum: 0, maximum: 100 };
  return {
    $id: 'https://model.datasafe.dev/json-schemas/hds-source-anchor.json',
    title: 'HDS clientData.hdsSourceAnchor',
    description: 'Where the value was printed in the source document (the file/xds-v1 event in clientData.related): the document, an attachment, a page and a box, nothing of what is printed there. Self-contained: whoever may read both the event and the document finds the zone from the anchor alone. See documentation/PROVENANCE.md.',
    type: 'object',
    additionalProperties: false,
    required: ['attachmentId', 'page'],
    properties: {
      eventId: {
        description: 'The id of the file/xds-v1 document event, the one clientData.related names (it stays there for queries). Absent on anchors written before 4.25.0: the document is then the one related names.',
        type: 'string',
        maxLength: 64,
        pattern: '^[a-zA-Z0-9_-]+$'
      },
      attachmentId: {
        description: 'The id of the document event\'s attachment (Pryv attachments[].id) the value was read from.',
        type: 'string',
        maxLength: 64,
        pattern: '^[a-zA-Z0-9_-]+$'
      },
      page: {
        description: 'Page number within that attachment, from 1 (an image is page 1).',
        type: 'integer',
        minimum: 1
      },
      bbox: {
        description: '[x, y, width, height] of the printed line the value was read from, in percent of the page as displayed (x and width of its width, y and height of its height), origin at the top left. Absent when the reader has no box it trusts.',
        type: 'array',
        items: [percent, percent, percent, percent],
        additionalItems: false,
        minItems: 4,
        maxItems: 4
      }
    }
  };
}

function extractionSchema () {
  return {
    $id: 'https://model.datasafe.dev/json-schemas/hds-extraction.json',
    title: 'HDS clientData.hdsExtraction',
    description: 'Which program read the value from a document, with which knowledge base and backend, and the role of who confirmed it. Ids and versions only: no document text, no prompt or model output, no name or account id. See documentation/PROVENANCE.md.',
    type: 'object',
    additionalProperties: false,
    required: ['engine', 'engineVersion', 'kbVersion', 'backend', 'confirmedBy'],
    properties: {
      engine: {
        description: 'Stable id of the reading program, lowercase (hds-reader); the <tool> of the sourceKey it writes.',
        type: 'string',
        maxLength: 64,
        pattern: '^[a-z][a-z0-9]*(-[a-z0-9]+)*$'
      },
      engineVersion: {
        description: 'The program\'s version, semver MAJOR.MINOR.PATCH with an optional pre-release.',
        type: 'string',
        maxLength: 64,
        pattern: '^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\\.[0-9A-Za-z-]+)*)?$'
      },
      kbVersion: {
        description: 'The version of the knowledge-base pack the program used, semver MAJOR.MINOR.PATCH.',
        type: 'string',
        maxLength: 32,
        pattern: '^(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)$'
      },
      backend: {
        description: 'Opaque id of the program\'s backend configuration record that read the printed line, never parsed (for example <runtime>:<model>, or text-layer when no backend ran). No spaces; never a URL, a host name, a device name or a user name.',
        type: 'string',
        minLength: 1,
        maxLength: 128,
        pattern: '^[A-Za-z0-9][A-Za-z0-9._:/+-]*$'
      },
      confirmedBy: {
        description: 'The role of who confirmed the value before it was written: person (the account holder, from her own app). Never a name or an account id.',
        type: 'string',
        enum: ['person']
      },
      corrected: {
        description: 'true when the person changed the value, the item or the unit before it was written. Absent otherwise.',
        type: 'boolean',
        enum: [true]
      }
    }
  };
}

function toBePublished () {
  return [
    { title: 'Json Schema clientData.hdsSourceAnchor', path: './json-schemas/', filename: 'hds-source-anchor.json', type: 'json', content: hdsSourceAnchor },
    { title: 'Json Schema clientData.hdsExtraction', path: './json-schemas/', filename: 'hds-extraction.json', type: 'json', content: hdsExtraction }
  ];
}
