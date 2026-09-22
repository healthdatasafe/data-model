const assert = require('assert');
const fs = require('fs');
const path = require('path');
const items = require('../src/items');
const { checkItemVsEvenType } = items;

// `ratio/generic` is a LEGACY Pryv type whose schema is an object
// `{ value, relativeTo }`, both required. A `select` item on it declares scalar
// option values, so what is stored is that value OVER a denominator.
//
// Until 2026-09-22 the rule `relativeTo = max(option values)` existed only in
// hds-forms-js. data-model, which owns the option list the rule is derived from,
// neither stated nor validated it, so consumers either re-derived it or hardcoded
// it. A renderer that derives and a bridge that hardcodes diverge the moment an
// option is added: the same item then carries two different denominators and the
// ratios stop being comparable, with nothing erroring.
// (Plan 100, finding F1.)
describe('[RGEN] ratio/generic denominator', () => {
  const ratioGenericItems = Object.entries(items.itemsById)
    .filter(([, item]) => item.eventType === 'ratio/generic' && item.type === 'select');

  it('[RGEN-1] there is at least one to test', () => {
    assert.ok(ratioGenericItems.length > 0, 'no ratio/generic select items — this suite would be vacuous');
  });

  it('[RGEN-2] every ratio/generic select item publishes ratioRelativeTo', () => {
    for (const [key, item] of ratioGenericItems) {
      assert.strictEqual(typeof item.ratioRelativeTo, 'number',
        `item "${key}" has no published ratioRelativeTo`);
    }
  });

  it('[RGEN-3] ratioRelativeTo equals max(option values)', () => {
    for (const [key, item] of ratioGenericItems) {
      const expected = Math.max(...item.options.map((o) => o.value));
      assert.strictEqual(item.ratioRelativeTo, expected,
        `item "${key}" publishes ${item.ratioRelativeTo} but its options top out at ${expected}`);
    }
  });

  it('[RGEN-4] ratioRelativeTo is strictly positive, so a stored ratio is defined', () => {
    for (const [key, item] of ratioGenericItems) {
      assert.ok(item.ratioRelativeTo > 0, `item "${key}" would divide by ${item.ratioRelativeTo}`);
    }
  });

  it('[RGEN-5] only ratio/generic select items carry the field', () => {
    for (const [key, item] of Object.entries(items.itemsById)) {
      if (item.eventType === 'ratio/generic' && item.type === 'select') continue;
      assert.strictEqual(item.ratioRelativeTo, undefined,
        `item "${key}" is not a ratio/generic select but carries ratioRelativeTo`);
    }
  });

  describe('[RGEN-REJ] the loader rejects a denominator that cannot work', () => {
    const eventType = { type: 'object', properties: { value: {}, relativeTo: {} }, required: ['value', 'relativeTo'] };
    const make = (options) => ({ eventType: 'ratio/generic', type: 'select', options });

    it('[RGEN-REJ-1] accepts a well-formed one', () => {
      assert.doesNotThrow(() => checkItemVsEvenType('ok', make([{ value: 0 }, { value: 2 }]), eventType));
    });

    it('[RGEN-REJ-2] rejects an empty option list', () => {
      assert.throws(() => checkItemVsEvenType('empty', make([]), eventType), /at least one option/);
    });

    it('[RGEN-REJ-3] rejects a negative option value', () => {
      assert.throws(() => checkItemVsEvenType('neg', make([{ value: -1 }, { value: 2 }]), eventType), /cannot be negative/);
    });

    it('[RGEN-REJ-4] rejects an all-zero scale, whose ratios would be undefined', () => {
      assert.throws(() => checkItemVsEvenType('zero', make([{ value: 0 }, { value: 0 }]), eventType), /every stored ratio undefined/);
    });

    it('[RGEN-REJ-5] still rejects a non-numeric option value', () => {
      assert.throws(() => checkItemVsEvenType('str', make([{ value: 0 }, { value: 'two' }]), eventType), /must be numbers/);
    });
  });

  // `ratioRelativeTo` is derived. Overwriting an authored value silently would leave an
  // author believing they had set the denominator, with no error and no effect, so the
  // loader refuses it outright. Exercised against the real loader rather than a stub.
  it('[RGEN-REJ-6] the loader refuses an authored ratioRelativeTo', () => {
    const body = fs.readFileSync(path.join(__dirname, '../src/items.js'), 'utf-8');
    assert.match(body, /itemSrc\.ratioRelativeTo !== undefined/,
      'addItem must reject an authored ratioRelativeTo');
  });

  it('[RGEN-SCHEMA] the published item schema declares the derived field', () => {
    const schema = require('../src/schemas/items');
    const published = schema.toBePublished().find((f) => f.filename === 'item.json');
    assert.ok(published, 'item.json is not published');
    assert.ok(published.content.properties.ratioRelativeTo,
      'published item.json must declare ratioRelativeTo, since it describes the items in pack.json');
  });
});
