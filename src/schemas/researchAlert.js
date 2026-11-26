// JSON Schema of the `content.hds` block of the research `notification/alert-cmc` kinds (research-invitation,
// research-eligibility-request), documentation/RESEARCH.md. Sent by HDS (`hds-research`) to a person who opted in.
// The cores do not validate `hds`, so writers and readers validate against this file: published as
// json-schemas/hds-research-alert.json, tested in tests/research.test.js. It validates the `hds` object only.
// Ids only: the person's app fetches the study or request by id. Portable subset (draft-04 and draft-07).

const ID = { type: 'string', maxLength: 64, pattern: '^[a-zA-Z0-9_-]+$' };

const hdsResearchAlert = {
  $id: 'https://model.datasafe.dev/json-schemas/hds-research-alert.json',
  title: 'HDS notification/alert-cmc content.hds, research kinds',
  description: 'The hds block of a research alert: a kind and one id, per study or per request, never per person; never a name, a date, a criterion or free text. See documentation/RESEARCH.md.',
  type: 'object',
  required: ['kind'],
  oneOf: [
    branch('research-invitation', 'HDS to person: an invitation to a study.', ['studyId'], {
      studyId: { ...ID, description: 'The study, as published by the research service.' }
    }),
    branch('research-eligibility-request', 'HDS to person: the eligibility test of a study.', ['requestId'], {
      requestId: { ...ID, description: 'The published eligibility request (json-schemas/hds-eligibility-request.json).' }
    })
  ]
};

function branch (kind, description, required, properties) {
  return {
    description: kind + ' (' + description + ')',
    type: 'object',
    additionalProperties: false,
    required: ['kind', ...required],
    properties: { kind: { type: 'string', enum: [kind] }, ...properties }
  };
}

function toBePublished () {
  return [
    { title: 'Json Schema notification/alert-cmc content.hds, research kinds', path: './json-schemas/', filename: 'hds-research-alert.json', type: 'json', content: hdsResearchAlert }
  ];
}

module.exports = {
  hdsResearchAlert,
  toBePublished
};
