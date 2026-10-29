const assert = require('assert');
const items = require('../src/items');
const { checkItemVsEvenType, checkRatioRelativeTo } = items;

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
//
// A `type: number` item on it (data-model 3.33.0, INR) has no options: it AUTHORS
// `ratioRelativeTo`, a fixed denominator, and the typed value is the numerator.
// (Plan 114 Q8.)
describe('[RGEN] ratio/generic denominator', () => {
  const ratioGenericItems = Object.entries(items.itemsById)
    .filter(([, item]) => item.eventType === 'ratio/generic' && item.type === 'select');
  const ratioGenericNumbers = Object.entries(items.itemsById)
    .filter(([, item]) => item.eventType === 'ratio/generic' && item.type === 'number');

  it('[RGEN-1] there is at least one to test', () => {
    assert.ok(ratioGenericItems.length > 0, 'no ratio/generic select items — this suite would be vacuous');
    assert.ok(ratioGenericNumbers.length > 0, 'no ratio/generic number items — [RGEN-NUM] would be vacuous');
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
    for (const [key, item] of [...ratioGenericItems, ...ratioGenericNumbers]) {
      assert.ok(item.ratioRelativeTo > 0, `item "${key}" would divide by ${item.ratioRelativeTo}`);
    }
  });

  it('[RGEN-5] select: derived; number: authored; nobody else carries the field', () => {
    for (const [key, item] of Object.entries(items.itemsById)) {
      if (item.eventType === 'ratio/generic' && (item.type === 'select' || item.type === 'number')) {
        assert.strictEqual(typeof item.ratioRelativeTo, 'number', `item "${key}" has no ratioRelativeTo`);
        continue;
      }
      assert.strictEqual(item.ratioRelativeTo, undefined,
        `item "${key}" is not a ratio/generic select or number but carries ratioRelativeTo`);
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

  // An authored `ratioRelativeTo` anywhere but a number item on ratio/generic is refused: on a
  // select it would be silently overwritten by the derived value, leaving an author believing
  // they had set the denominator, with no error and no effect.
  it('[RGEN-REJ-6] the loader refuses an authored ratioRelativeTo except on a ratio/generic number', () => {
    assert.throws(() => checkRatioRelativeTo('sel', { type: 'select', eventType: 'ratio/generic', ratioRelativeTo: 8 }), /only a "number" item/);
    assert.throws(() => checkRatioRelativeTo('num', { type: 'number', eventType: 'ratio/proportion', ratioRelativeTo: 1 }), /only a "number" item/);
    assert.throws(() => checkRatioRelativeTo('txt', { type: 'text', eventType: 'ratio/generic', ratioRelativeTo: 1 }), /only a "number" item/);
    assert.doesNotThrow(() => checkRatioRelativeTo('inr', { type: 'number', eventType: 'ratio/generic', ratioRelativeTo: 1 }));
    assert.doesNotThrow(() => checkRatioRelativeTo('none', { type: 'select', eventType: 'ratio/generic' }));
  });

  describe('[RGEN-NUM] a number item on ratio/generic authors its denominator', () => {
    const eventType = { type: 'object', properties: { value: {}, relativeTo: {} }, required: ['value', 'relativeTo'] };
    const make = (ratioRelativeTo) => ({ eventType: 'ratio/generic', type: 'number', ...(ratioRelativeTo === undefined ? {} : { ratioRelativeTo }) });

    it('[RGEN-NUM-1] accepts the INR shape', () => {
      assert.doesNotThrow(() => checkItemVsEvenType('inr', make(1), eventType));
    });

    it('[RGEN-NUM-2] rejects one without ratioRelativeTo', () => {
      assert.throws(() => checkItemVsEvenType('none', make(), eventType), /must declare "ratioRelativeTo" > 0/);
    });

    it('[RGEN-NUM-3] rejects 0, -1, Infinity, NaN and "1"', () => {
      for (const bad of [0, -1, Infinity, NaN, '1']) {
        assert.throws(() => checkItemVsEvenType('bad', make(bad), eventType), /must declare "ratioRelativeTo" > 0/, String(bad));
      }
    });

    it('[RGEN-NUM-4] rejects a ratio/generic number item with variations', () => {
      const variationItem = { type: 'number', variations: { eventType: { options: [{ value: 'ratio/generic' }] } } };
      assert.throws(() => checkItemVsEvenType('var', variationItem, eventType), /should be a "number"/);
      assert.throws(() => checkRatioRelativeTo('var', { ...variationItem, ratioRelativeTo: 1 }), /only a "number" item/);
    });

    it('[RGEN-NUM-5] the built pack carries ratioRelativeTo: 1 on body-blood-coagulation-inr', () => {
      const inr = items.itemsById['body-blood-coagulation-inr'];
      assert.ok(inr, 'body-blood-coagulation-inr is missing');
      assert.strictEqual(inr.type, 'number');
      assert.strictEqual(inr.eventType, 'ratio/generic');
      assert.strictEqual(inr.ratioRelativeTo, 1);
      assert.deepStrictEqual(inr.references.loinc, ['6301-6']);
    });
  });

  it('[RGEN-SCHEMA] the published item schema declares the field', () => {
    const schema = require('../src/schemas/items');
    const published = schema.toBePublished().find((f) => f.filename === 'item.json');
    assert.ok(published, 'item.json is not published');
    assert.ok(published.content.properties.ratioRelativeTo,
      'published item.json must declare ratioRelativeTo, since it describes the items in pack.json');
  });
});
