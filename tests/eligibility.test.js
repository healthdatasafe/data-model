const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const AjvDraft04 = require('ajv-draft-04');

// The eligibility test of a study : the request schema and research/eligibility-band-v1.
// See documentation/ELIGIBILITY.md.

const { hdsEligibilityRequest } = require('../src/schemas/eligibilityRequest');
const { eventTypesById } = require('../src/eventTypes');
const { itemsById } = require('../src/items');

const TYPE = 'research/eligibility-band-v1';
const FLAVOURS = [
  ['draft-04 (the cores)', () => new AjvDraft04({ strict: false, allErrors: true, coerceTypes: false, logger: false })],
  ['draft-07', () => new Ajv({ strict: false, allErrors: true, coerceTypes: false, logger: false })]
];
const PORTABLE = /"(if|then|else|const|not|\$ref)"/;
const strip = (schema) => { const s = structuredClone(schema); delete s.description; delete s.$id; delete s.title; return s; };

const [example, scoreExample] = [...fs.readFileSync(path.join(__dirname, '../documentation/ELIGIBILITY.md'), 'utf-8')
  .matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => JSON.parse(m[1]));

const edit = (f) => { const r = structuredClone(example); f(r); return r; };
const rule = (v) => edit((r) => { r.criteria[0].rule = v; });
const answer = (v) => edit((r) => { r.criteria[2].question.answer = v; });
const L = { en: 'x', fr: 'x' };

const VALID = [
  example,
  rule({ op: 'exists', itemKey: 'body-weight' }),
  rule({ op: 'exists', itemKey: 'body-weight', withinDays: 30 }),
  rule({ op: 'range', itemKey: 'body-weight', eventType: 'mass/kg', max: 90 }),
  rule({ op: 'count', itemKey: 'body-weight', min: 3, withinDays: 90 }),
  rule({ op: 'in', itemKey: 'lifestyle-tobacco-smoking', values: ['never', 'former'] }),
  answer({ type: 'choice', options: [{ value: 'a', label: L }, { value: 'b', label: L }], met: ['a'] }),
  answer({ type: 'date', withinDays: 30 }),
  answer({ type: 'date', minYears: 2 }),
  edit((r) => { r.title.de = 'Test'; })
];

const INVALID = {
  'two criteria': edit((r) => { r.criteria.pop(); }),
  'no weight': edit((r) => { delete r.criteria[0].weight; }),
  'weight 0': edit((r) => { r.criteria[0].weight = 0; }),
  'weight 101': edit((r) => { r.criteria[0].weight = 101; }),
  'weight 1.5': edit((r) => { r.criteria[0].weight = 1.5; }),
  'neither rule nor question': edit((r) => { delete r.criteria[0].rule; }),
  'label without fr': edit((r) => { delete r.criteria[0].label.fr; }),
  'blank label': edit((r) => { r.criteria[0].label.en = ' '; }),
  'unknown field': edit((r) => { r.script = 'x'; }),
  'unknown version': edit((r) => { r.version = 2; }),
  'unknown operator': rule({ op: 'script', itemKey: 'body-weight' }),
  'code in a rule': rule({ op: 'exists', itemKey: 'body-weight', code: 'x' }),
  'range without bounds': rule({ op: 'range', itemKey: 'body-weight', eventType: 'mass/kg' }),
  'range without a unit': rule({ op: 'range', itemKey: 'body-weight', min: 3 }),
  'in without values': rule({ op: 'in', itemKey: 'lifestyle-tobacco-smoking', values: [] }),
  'boolean operator': rule({ op: 'boolean', itemKey: 'lifestyle-tobacco-smoking', value: true }),
  'age without bounds': rule({ op: 'age', itemKey: 'profile-date-of-birth' }),
  'free text answer': answer({ type: 'text' }),
  'number without bounds': answer({ type: 'number' }),
  'one option': answer({ type: 'choice', options: [{ value: 'a', label: L }], met: ['a'] }),
  'date without condition': answer({ type: 'date' })
};

describe('[ELIG] eligibility test', () => {
  for (const [name, make] of FLAVOURS) {
    it('[ELIG-REQ-1] request schema, ' + name, () => {
      const validate = make().compile(strip(hdsEligibilityRequest));
      VALID.forEach((r, i) => assert.ok(validate(r), i + ' ' + JSON.stringify(validate.errors)));
      for (const [label, r] of Object.entries(INVALID)) assert.ok(!validate(r), label);
    });

    it('[ELIG-TYPE-1] ' + TYPE + ' is closed: request and band only, ' + name, () => {
      const validate = make().compile(strip(eventTypesById(TYPE)));
      assert.ok(validate(scoreExample), JSON.stringify(validate.errors));
      for (const band of ['0-49', '50-100']) assert.ok(validate({ requestId: 'r', band }));
      for (const bad of [{ requestId: 'r' }, { band: '0-49' }, { requestId: 'r', band: '25-49' }, { requestId: 'r', band: 33 }, { requestId: 'r', score: 33 },
        { requestId: 'r', band: '0-49', score: 12 }, { requestId: 'r', band: '0-49', criteria: {} }, { requestId: 'a b', band: '0-49' }]) {
        assert.ok(!validate(bad), JSON.stringify(bad));
      }
    });
  }

  it('[ELIG-REQ-2] portable subset', () => {
    assert.ok(!PORTABLE.test(JSON.stringify(hdsEligibilityRequest)));
    assert.ok(!PORTABLE.test(JSON.stringify(eventTypesById(TYPE))));
  });

  it('[ELIG-REQ-3] the items and types of the documented example exist', () => {
    for (const c of example.criteria.filter((x) => x.rule)) {
      const item = itemsById[c.rule.itemKey];
      assert.ok(item, c.rule.itemKey);
      if (c.rule.eventType) assert.ok(item.variations.eventType.options.some((o) => o.value === c.rule.eventType));
    }
  });

  it('[ELIG-TYPE-2] no item uses the type', () => {
    assert.ok(!JSON.stringify(itemsById).includes(TYPE));
  });
});
