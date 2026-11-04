const assert = require('assert');
const Ajv = require('ajv');
const AjvDraft04 = require('ajv-draft-04');
const addFormats = require('ajv-formats');

// Fertility-intake asks: the self-reported cycle regularity (site-agents#39) and the untimed insulin twin of the
// fasting item (site-agents#40 part 1) in 3.44.0; the recalled time trying to conceive (site-agents#38) in 3.45.0.

describe('[FIN] Fertility-intake items (3.44.0, 3.45.0)', () => {
  const { itemsById, findItemForEvent } = require('../src/items');
  const streams = require('../src/streams');
  const { eventTypesById } = require('../src/eventTypes');

  describe('[FIN-REG] fertility-cycles-regularity (site-agents#39)', () => {
    const item = itemsById['fertility-cycles-regularity'];

    it('[FIN-REG-1] a select on its own enum, beside the recalled averages', () => {
      assert.strictEqual(item.type, 'select');
      assert.strictEqual(item.eventType, 'fertility/cycle-regularity-v1');
      assert.strictEqual(findItemForEvent(item.eventType, item.streamId), item);
      assert.strictEqual(streams.streamsById[item.streamId].parentId, 'fertility-cycles');
      assert.ok(item.label.fr && item.description.fr);
    });

    it('[FIN-REG-2] the options are exactly the eventType enum; "not sure" is not one', () => {
      const values = item.options.map((o) => o.value);
      assert.deepStrictEqual(values, ['regular', 'irregular', 'no-periods']);
      assert.deepStrictEqual(eventTypesById(item.eventType).enum, values);
      assert.ok(!values.some((v) => /sure|unknown/.test(v)));
    });

    it('[FIN-REG-3] one dated event per answer, and no fhir block (no-periods stays uncoded)', () => {
      assert.strictEqual(item.repeatable, 'any');
      assert.strictEqual(item.fhir, undefined);
    });
  });

  describe('[FIN-INS] body-blood-serum-insulin (site-agents#40)', () => {
    const item = itemsById['body-blood-serum-insulin'];
    const fasting = itemsById['body-blood-serum-insulin-fasting'];

    it('[FIN-INS-1] the same two units as the fasting item, in the same order', () => {
      const units = (i) => i.variations.eventType.options.map((o) => o.value);
      assert.deepStrictEqual(units(item), units(fasting));
      assert.strictEqual(streams.streamsById[item.streamId].parentId, 'body-blood-serum');
    });

    it('[FIN-INS-2] untimed LOINC codes, none shared with the fasting item', () => {
      assert.deepStrictEqual(item.variations.eventType.options.map((o) => o.loinc), ['20448-7', '14796-7']);
      for (const code of item.references.loinc) assert.ok(!fasting.references.loinc.includes(code), code);
    });

    it('[FIN-INS-3] never convertible between its units, and no factor', () => {
      assert.strictEqual(item.unitConversions.factors, undefined);
      assert.deepStrictEqual(item.unitConversions.notConvertible.map((p) => [p.from, p.to]),
        [['concentration/uiu-ml', 'concentration/pmol-l']]);
    });

    it('[FIN-INS-5] the fhir block codes each unit with its option code; the fasting twin stays unmapped', () => {
      const codings = item.fhir.code.codings;
      for (const { value, loinc } of item.variations.eventType.options) assert.strictEqual(codings[value].code, loinc, value);
      assert.strictEqual(item.fhir.category, 'laboratory');
      assert.strictEqual(fasting.fhir, undefined);
    });

    it('[FIN-INS-4] each unit resolves to its own item, untimed and fasting apart', () => {
      for (const { value } of item.variations.eventType.options) {
        assert.strictEqual(findItemForEvent(value, 'body-blood-serum-insulin'), item);
        assert.strictEqual(findItemForEvent(value, 'body-blood-serum-insulin-fasting'), fasting);
      }
    });
  });

  describe('[FIN-TTC] fertility-ttc-duration (site-agents#38, 3.45.0)', () => {
    const item = itemsById['fertility-ttc-duration'];

    it('[FIN-TTC-1] a select on its own enum, a sibling of fertility-ttc-tta', () => {
      assert.strictEqual(item.type, 'select');
      assert.strictEqual(item.eventType, 'fertility/ttc-duration-v1');
      assert.strictEqual(findItemForEvent(item.eventType, item.streamId), item);
      assert.strictEqual(streams.streamsById[item.streamId].parentId, 'fertility');
      assert.ok(!streams.isDescendantOf('fertility-ttc-duration', 'fertility-ttc-tta'), 'a grant on the intention must not cover the duration');
      assert.ok(!streams.isDescendantOf('fertility-ttc-tta', 'fertility-ttc-duration'));
    });

    it('[FIN-TTC-2] bands and a break, exactly the eventType enum', () => {
      const values = item.options.map((o) => o.value);
      assert.deepStrictEqual(values, ['less-than-6-months', '6-12-months', '1-2-years', 'more-than-2-years', 'on-break']);
      assert.deepStrictEqual(eventTypesById(item.eventType).enum, values);
      assert.ok(item.label.fr && item.description.fr && item.options.every((o) => o.label.fr));
    });

    it('[FIN-TTC-3] one dated event per answer, no fhir block, the intention item unchanged', () => {
      assert.strictEqual(item.repeatable, 'any');
      assert.strictEqual(item.fhir, undefined);
      assert.strictEqual(itemsById['fertility-ttc-tta'].eventType, 'ratio/generic');
    });
  });

  describe('[FIN-AJV] contents validate under both validators', () => {
    const validators = {
      'draft-07': new Ajv({ strict: false, allErrors: true, logger: false }),
      'draft-04': (() => {
        const ajv = new AjvDraft04({ strict: false, allErrors: true, coerceTypes: false, validateFormats: true, logger: false });
        addFormats(ajv);
        return ajv;
      })()
    };
    for (const [flavour, ajv] of Object.entries(validators)) {
      it(`[FIN-AJV-${flavour}] fertility/cycle-regularity-v1`, () => {
        const validate = ajv.compile(eventTypesById('fertility/cycle-regularity-v1'));
        for (const v of ['regular', 'irregular', 'no-periods']) assert.ok(validate(v), v);
        for (const v of ['not-sure', '', null, ['regular'], 1]) assert.ok(!validate(v), JSON.stringify(v));
        const ttc = ajv.compile(eventTypesById('fertility/ttc-duration-v1'));
        for (const v of ['less-than-6-months', 'on-break']) assert.ok(ttc(v), v);
        for (const v of [6, '6 months', null, ['on-break']]) assert.ok(!ttc(v), JSON.stringify(v));
      });
    }
  });
});
