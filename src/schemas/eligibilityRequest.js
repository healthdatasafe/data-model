// JSON Schema of an eligibility request (documentation/ELIGIBILITY.md): what a study publishes and hds-lib evaluates on
// the person's device. Published as json-schemas/hds-eligibility-request.json, tested in tests/eligibility.test.js.
// Shape only: item keys, operators against their item, and the weights check are hds-lib
// researchEligibility.checkEligibilityRequest.
// Portable subset: compiles under draft-04 (the cores) and draft-07, so no const, not, if/then/else or $ref.

const ID = { type: 'string', maxLength: 64, pattern: '^[a-zA-Z0-9_-]+$' };
const ITEM = { type: 'string', maxLength: 128, pattern: '^[a-z0-9]+(-[a-z0-9]+)*$', description: 'Key of an HDS item.' };
const TEXT = {
  type: 'object',
  required: ['en', 'fr'],
  additionalProperties: { type: 'string' },
  properties: { en: { type: 'string', minLength: 1, pattern: '\\S' }, fr: { type: 'string', minLength: 1, pattern: '\\S' } }
};
const NUMBER = { type: 'number' };
const COUNT = { type: 'integer', minimum: 1 };
const BOOLEAN = { type: 'boolean' };

// with one closed branch per operator or answer type; `min` and `max`: at least one of them
const BOUNDED = (min, max) => [{ required: [min] }, { required: [max] }];

const rule = {
  description: 'What must hold in the account. Data, never code.',
  oneOf: [
    branch('op', 'exists', 'recorded, within the last N days when withinDays is set', ['itemKey'], { itemKey: ITEM, withinDays: COUNT }),
    branch('op', 'range', 'the latest number, read in eventType, is in the range', ['itemKey', 'eventType'], {
      itemKey: ITEM, eventType: { type: 'string', pattern: '^[a-z0-9-]+/[a-z0-9-]+$' }, min: NUMBER, max: NUMBER, withinDays: COUNT
    }, BOUNDED('min', 'max')),
    branch('op', 'count', 'at least min events, within the last N days when withinDays is set', ['itemKey', 'min'], { itemKey: ITEM, min: COUNT, withinDays: COUNT }),
    branch('op', 'in', 'the latest value of a select item is one of these options', ['itemKey', 'values'], {
      itemKey: ITEM,
      values: { type: 'array', minItems: 1, uniqueItems: true, items: { type: ['string', 'number'] } },
      withinDays: COUNT
    }),
    branch('op', 'age', 'whole years since a declared date, from the date of birth', ['itemKey'], { itemKey: ITEM, min: NUMBER, max: NUMBER }, BOUNDED('min', 'max'))
  ]
};

const answer = {
  description: 'How the question is answered, and the answers that meet the criterion. No free text.',
  oneOf: [
    branch('type', 'boolean', 'yes or no', ['met'], { met: BOOLEAN }),
    branch('type', 'number', 'a number', [], { unit: TEXT, min: NUMBER, max: NUMBER }, BOUNDED('min', 'max')),
    branch('type', 'choice', 'one option of a list', ['options', 'met'], {
      options: {
        type: 'array',
        minItems: 2,
        items: { type: 'object', additionalProperties: false, required: ['value', 'label'], properties: { value: { type: 'string', minLength: 1 }, label: TEXT } }
      },
      met: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', minLength: 1 } }
    }),
    branch('type', 'date', 'a date: within the last N days, or a number of whole years ago', [], { withinDays: COUNT, minYears: NUMBER, maxYears: NUMBER },
      [{ required: ['withinDays'] }, ...BOUNDED('minYears', 'maxYears')])
  ]
};

const hdsEligibilityRequest = {
  $id: 'https://model.datasafe.dev/json-schemas/hds-eligibility-request.json',
  title: 'HDS eligibility request',
  description: 'The eligibility test of a study, run on the person\'s device. See documentation/ELIGIBILITY.md.',
  type: 'object',
  additionalProperties: false,
  required: ['version', 'requestId', 'studyId', 'studyName', 'title', 'description', 'ethicsRef', 'expiresAt', 'criteria'],
  properties: {
    version: { type: 'integer', enum: [1], description: 'Version of this schema.' },
    requestId: ID,
    studyId: ID,
    studyName: TEXT,
    title: TEXT,
    description: TEXT,
    ethicsRef: { type: 'string', minLength: 1, description: 'Reference of the ethics approval.' },
    expiresAt: { type: 'number', description: 'Unix seconds.' },
    criteria: {
      type: 'array',
      minItems: 3,
      maxItems: 16,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'label', 'weight'],
        anyOf: [{ required: ['rule'] }, { required: ['question'] }],
        properties: {
          id: ID,
          label: TEXT,
          weight: { type: 'integer', minimum: 1, maximum: 100, description: 'Set by the requester. Score = weights of the criteria met / all weights.' },
          rule,
          question: {
            description: 'Asked only when the account has no data for the rule (or there is no rule). The answer stays on the device.',
            type: 'object',
            additionalProperties: false,
            required: ['text', 'answer'],
            properties: { text: TEXT, answer }
          }
        }
      }
    }
  }
};

function branch (key, value, description, required, properties, anyOf) {
  return {
    description: value + ' (' + description + ')',
    type: 'object',
    additionalProperties: false,
    required: [key, ...required],
    ...(anyOf ? { anyOf } : {}),
    properties: { [key]: { type: 'string', enum: [value] }, ...properties }
  };
}

function toBePublished () {
  return [
    { title: 'Json Schema HDS eligibility request', path: './json-schemas/', filename: 'hds-eligibility-request.json', type: 'json', content: hdsEligibilityRequest }
  ];
}

module.exports = { hdsEligibilityRequest, toBePublished };
