const assert = require('assert');
const items = require('../src/items');
const { checkItemVsEvenType, itemsById } = items;

// A `select` over a plain numeric eventType. Before 3.12.0 the loader had no branch for
// this: string selects were handled, and `ratio/generic` and `ratio/proportion` each had
// their own special case, but anything else fell through to the catch-all throw. So the
// only way to offer named numeric answers was a bare `type: number` input.
//
// That is what left `fertility-test-opk` and `fertility-test-pregnancy` as free number
// boxes on a -1/0/1 scale whose eventType publishes no labels — nothing user-facing said
// what to enter. (B-2026-09-23-3.)
//
// The two ratio/* branches are special cases of this one, with their bounds implicit in
// the type. They are deliberately left in place and take precedence: they carry extra
// rules this branch does not (the derived denominator, the non-negative numerator).
describe('[NSEL] select on a numeric eventType', () => {
  const scale = { type: 'number', minimum: -1, maximum: 1 };
  const make = (options) => ({ eventType: 'test-result/scale', type: 'select', options });

  it('[NSEL-1] accepts options inside the eventType bounds', () => {
    assert.doesNotThrow(() => checkItemVsEvenType('ok', make([{ value: -1 }, { value: 0 }, { value: 1 }]), scale));
  });

  it('[NSEL-2] rejects an option below the eventType minimum', () => {
    assert.throws(() => checkItemVsEvenType('low', make([{ value: -2 }]), scale), /below the eventType minimum/);
  });

  it('[NSEL-3] rejects an option above the eventType maximum', () => {
    assert.throws(() => checkItemVsEvenType('high', make([{ value: 2 }]), scale), /above the eventType maximum/);
  });

  it('[NSEL-4] rejects a non-numeric option value', () => {
    assert.throws(() => checkItemVsEvenType('str', make([{ value: 'positive' }]), scale), /must be numbers/);
  });

  it('[NSEL-5] rejects an empty option list', () => {
    assert.throws(() => checkItemVsEvenType('empty', make([]), scale), /at least one option/);
  });

  it('[NSEL-6] rejects a select whose eventType is neither number nor string', () => {
    const objectType = { type: 'object', properties: {} };
    assert.throws(() => checkItemVsEvenType('obj', make([{ value: 1 }]), objectType), /must be a "number" or a "string"/);
  });

  it('[NSEL-7] a value of 0 is accepted, not treated as absent', () => {
    // 0 is "indeterminate" on this scale and is the value a falsy check would drop.
    assert.doesNotThrow(() => checkItemVsEvenType('zero', make([{ value: 0 }]), scale));
  });

  it('[NSEL-8] an eventType without bounds accepts any number', () => {
    const unbounded = { type: 'number' };
    assert.doesNotThrow(() => checkItemVsEvenType('free', make([{ value: -999 }, { value: 999 }]), unbounded));
  });

  // The ratio/* branches must keep their own stricter rules rather than being shadowed by the
  // generic one. This case covers `ratio/proportion`, whose [0, 1] bound is its own; the
  // `ratio/generic` side is covered by the existing [RGEN-REJ] tests, since the generic branch
  // would reject its object-typed eventType outright rather than silently accepting it.
  it('[NSEL-9] ratio/proportion still enforces its own [0, 1] bound', () => {
    const proportion = { type: 'number', minimum: 0, maximum: 1 };
    const item = { eventType: 'ratio/proportion', type: 'select', options: [{ value: 1.5 }] };
    assert.throws(() => checkItemVsEvenType('prop', item, proportion), /all options must be in \[0, 1\]/);
  });

  describe('[NSEL-PUB] the two published items', () => {
    for (const key of ['fertility-test-opk', 'fertility-test-pregnancy']) {
      it(`[NSEL-PUB] ${key} offers the three named results`, () => {
        const data = itemsById[key];
        assert.ok(data, `${key} must exist`);
        assert.strictEqual(data.type, 'select', `${key} must be a select, not a bare number input`);
        assert.strictEqual(data.eventType, 'test-result/scale');
        assert.deepStrictEqual(data.options.map((o) => o.value), [-1, 0, 1]);
        for (const option of data.options) {
          assert.ok(option.label.en, 'every option needs an English label');
          assert.ok(option.label.fr, 'every option needs a French label');
        }
      });
    }
  });
});
