const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const AjvDraft04 = require('ajv-draft-04');

// Lab results with no item of their own (site-agents#28): `lab-result/coded-v1`, one coded stream per specimen,
// item type `imported`; and the LOINC ownership checks. See documentation/BLOOD-CHEMISTRY.md.

describe('[LABC] Coded lab results', () => {
  const { itemsById, findItemForEvent, checkItemVsEvenType, checkLoincRefs } = require('../src/items');
  const { checkItem } = require('../src/schemas/items');
  const streams = require('../src/streams');
  const { eventTypesById } = require('../src/eventTypes');

  const loinc = (code) => ({ system: 'http://loinc.org', code });
  const hiv = () => ({ label: { en: 'HIV-1 RNA (viral load)' }, codes: [loinc('20447-9')] });
  const numeric = () => ({ analyte: hiv(), value: 20, unit: '{copies}/mL' });
  const qualitative = () => ({ analyte: { label: { en: 'HBsAg' }, codes: [loinc('5196-1')] }, valueText: 'negative' });

  const CODED = { 'body-blood-coded': 'body-blood', 'body-urine-coded': 'body-urine', 'body-csf-coded': 'body-csf' };

  for (const [flavour, make] of [
    ['draft-04 (the cores)', () => new AjvDraft04({ strict: false, allErrors: true, coerceTypes: false, logger: false })],
    ['draft-07', () => new Ajv({ strict: false, allErrors: true, coerceTypes: false, logger: false })]
  ]) {
    describe(`[LABC-ET] lab-result/coded-v1 under ${flavour}`, () => {
      let validate;
      before(() => { validate = make().compile(eventTypesById('lab-result/coded-v1')); });
      const ok = (c, why) => assert.ok(validate(c), `${why}: ${JSON.stringify(validate.errors)}`);
      const ko = (c, why) => assert.ok(!validate(c), why);

      it('[LABC-ET-1] accepts numeric, censored, qualitative, coded and semi-quantitative results', () => {
        ok(numeric(), 'numeric + unit');
        ok({ ...numeric(), comparator: '<' }, 'censored');
        for (const comparator of ['<', '<=', '>', '>=']) ok({ ...numeric(), comparator }, comparator);
        ok({ ...numeric(), unitText: 'copies/mL', notes: 'haemolysed sample' }, 'unitText and notes');
        ok({ ...numeric(), unit: '1' }, 'unitless');
        ok(qualitative(), 'valueText alone');
        ok({ ...qualitative(), valueCodes: [{ system: 'http://snomed.info/sct', code: '260385009', display: 'Negative' }] }, 'valueText + valueCodes');
        ok({ ...qualitative(), valueCodes: [{ system: 'http://snomed.info/sct', code: '260385009' }, { system: 'urn:oid:1.2.3', code: 'NEG' }] }, 'SNOMED + the lab code');
        ok({ ...numeric(), unit: '{index}', valueText: 'positive' }, 'semi-quantitative: value and valueText');
        ok({ analyte: { label: { en: 'X', fr: 'X', es: 'X' }, codes: [{ system: 'urn:oid:1.2.3', code: 'X1', version: '2', display: 'x', hdsId: 'x' }] }, valueText: 'x' }, 'non-LOINC system, full coding');
      });

      it('[LABC-ET-2] rejects malformed results', () => {
        const without = (k) => { const c = numeric(); delete c[k]; return c; };
        ko(without('analyte'), 'no analyte');
        ko({ ...numeric(), analyte: { ...hiv(), codes: [] } }, 'empty codes');
        ko({ ...numeric(), analyte: { ...hiv(), codes: [{ code: '20447-9' }] } }, 'a code without system');
        ko({ ...numeric(), analyte: { ...hiv(), codes: [{ system: 'LOINC', code: '20447-9' }] } }, 'system not a URI');
        ko({ ...numeric(), analyte: { ...hiv(), codes: [{ ...loinc('20447-9'), source: { key: 'x' } }] } }, 'no source on a coding');
        ko({ ...numeric(), analyte: { label: { fr: 'ARN VIH-1' }, codes: [loinc('20447-9')] } }, 'label without en');
        ko({ ...numeric(), analyte: { ...hiv(), label: { en: 'x', de: 'x' } } }, 'label: unknown language');
        ko({ ...numeric(), analyte: { ...hiv(), specimen: 'serum' } }, 'analyte is closed');
        ko(without('unit'), 'value without unit');
        ko({ analyte: hiv(), unit: 'mg/L', valueText: 'x' }, 'unit without value');
        ko({ ...qualitative(), unitText: 'mg/L' }, 'unitText without unit');
        ko({ ...qualitative(), comparator: '<' }, 'comparator without value');
        for (const comparator of ['=', '≤', '<<']) ko({ ...numeric(), comparator }, `comparator ${comparator}`);
        ko({ analyte: hiv() }, 'neither value nor valueText');
        ko({ ...numeric(), value: '20' }, 'value is a number');
        ko({ ...numeric(), valueCodes: [{ system: 'http://snomed.info/sct', code: '1' }] }, 'valueCodes without valueText');
        ko({ ...qualitative(), valueCodes: [{ system: 'http://snomed.info/sct', code: '1', note: 'x' }] }, 'a value coding is closed');
        ko({ ...qualitative(), valueCodes: [] }, 'valueCodes not empty');
        ko({ ...qualitative(), valueCodes: { system: 'http://snomed.info/sct', code: '1' } }, 'valueCodes is an array');
        ko({ ...numeric(), analyte: { ...hiv(), codes: [{ system: 'http://loinc.org', code: '' }] } }, 'empty code');
        for (const unit of ['µg/L', 'x10^9 /L', '', 'm'.repeat(65)]) ko({ ...numeric(), unit }, `unit ${unit}`);
        ko({ ...numeric(), comparitor: '<' }, 'unknown key');
        ko({ ...qualitative(), valueText: '' }, 'empty valueText');
      });
    });
  }

  it('[LABC-ET-3] uses no if/then/const and no $ref (the cores compile draft-04)', () => {
    const text = JSON.stringify(eventTypesById('lab-result/coded-v1'));
    assert.ok(!/"(if|then|else|const|\$ref)"/.test(text));
  });

  describe('[LABC-STR] streams', () => {
    it('[LABC-STR-1] one coded stream per specimen, body-csf under body', () => {
      for (const [id, parent] of Object.entries(CODED)) {
        assert.ok(streams.streamsById[id], `${id} exists`);
        assert.strictEqual(streams.streamsById[id].parentId, parent, `${id} under ${parent}`);
      }
      assert.strictEqual(streams.streamsById['body-csf'].parentId, 'body');
    });
  });

  describe('[LABC-ITM] items', () => {
    it('[LABC-ITM-1] each coded stream resolves to its item; a coded result elsewhere resolves to none', () => {
      for (const id of Object.keys(CODED)) {
        assert.strictEqual(findItemForEvent('lab-result/coded-v1', id), itemsById[id], id);
        assert.ok(itemsById[id], id);
      }
      assert.strictEqual(findItemForEvent('lab-result/coded-v1', 'body-blood-serum'), null);
      const imported = Object.entries(itemsById).filter(([, i]) => i.type === 'imported').map(([k]) => k).sort();
      assert.deepStrictEqual(imported, Object.keys(CODED).sort(), 'the three coded items are the only imported items');
    });

    it('[LABC-ITM-2] the three items pass the item checks', () => {
      for (const key of Object.keys(CODED)) {
        const item = itemsById[key];
        assert.doesNotThrow(() => checkItem(item, key), key);
        assert.strictEqual(item.type, 'imported');
        assert.strictEqual(item.repeatable, 'unlimited');
        assert.strictEqual(item.streamId, key);
        assert.ok(streams.streamsById[item.streamId], `${key} stream exists`);
        assert.strictEqual(item.eventType, 'lab-result/coded-v1');
        assert.ok(item.label.fr && item.label.es && item.description.fr && item.description.es, `${key} is localised`);
        assert.strictEqual(checkItemVsEvenType(key, item, eventTypesById('lab-result/coded-v1')), true);
      }
    });

    it('[LABC-ITM-3] an imported item needs an object eventType, and is not a composite field type', () => {
      const item = { ...itemsById['body-blood-coded'], eventType: 'note/txt' };
      assert.throws(() => checkItemVsEvenType('x', item, eventTypesById('note/txt')), /"imported".*"object"/);
      const base = { label: { en: 'x' }, description: { en: 'x' }, streamId: 'body-blood-coded', eventType: 'lab-result/coded-v1', version: 'v1', repeatable: 'unlimited' };
      assert.doesNotThrow(() => checkItem({ ...base, type: 'imported' }, 'x'));
      assert.throws(() => checkItem({ ...base, type: 'composite', composite: { result: { label: { en: 'Result' }, type: 'imported' } } }, 'x'));
    });
  });

  describe('[LABC-LOINC] LOINC codes asserted by items', () => {
    // Every code an item owns: `references.loinc` and the method codes of `references.loincMethod` (plan 114 Q21).
    const asserted = () => {
      const out = [];
      for (const [key, item] of Object.entries(itemsById)) {
        if (item.deprecated) continue;
        for (const code of [...(item.references?.loinc || []), ...(item.references?.loincMethod || [])]) out.push({ key, code });
      }
      return out;
    };

    it('[LABC-LOINC-1] no LOINC code is asserted by two active items, loinc and loincMethod together', () => {
      const owners = {};
      for (const { key, code } of asserted()) (owners[code] ??= []).push(key);
      const shared = Object.entries(owners).filter(([, keys]) => keys.length > 1);
      assert.deepStrictEqual(shared, [], 'codes with two owners');
    });

    it('[LABC-LOINC-2] every asserted LOINC code has a valid mod-10 check digit', () => {
      const valid = (code) => {
        if (!/^\d{1,7}-\d$/.test(code)) return false;
        const d = code.replace('-', '');
        let sum = 0;
        for (let i = 0; i < d.length; i++) {
          let n = Number(d[d.length - 1 - i]);
          if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
          sum += n;
        }
        return sum % 10 === 0;
      };
      assert.ok(valid('20447-9') && !valid('20447-8'), 'the check itself');
      // The five codes plan 44 asserted before LOINC verification were removed in 3.31.0 and 3.32.0
      // (B-2026-10-28-41): no exception is left.
      const options = [];
      for (const [key, item] of Object.entries(itemsById)) {
        for (const o of item.variations?.eventType?.options || []) if (o.loinc) options.push({ key, code: o.loinc });
      }
      const bad = [...asserted(), ...options].filter(({ code }) => !valid(code));
      assert.deepStrictEqual(bad, [], 'invalid LOINC codes');
    });

    describe('[LABC-LOINC-3] per-option codes and method codes (checkLoincRefs)', () => {
      const base = () => ({
        variations: { eventType: { options: [{ value: 'concentration/mg-dl', label: { en: 'mg/dL' } }, { value: 'concentration/mmol-l', label: { en: 'mmol/L' } }] } },
        references: { loinc: ['2345-7', '14749-6'] }
      });
      const withCodes = (a, b) => { const i = base(); i.variations.eventType.options[0].loinc = a; i.variations.eventType.options[1].loinc = b; return i; };

      it('[LABC-LOINC-3a] accepts one code per option, and null for a unit LOINC has no code for', () => {
        assert.doesNotThrow(() => checkLoincRefs('x', withCodes('2345-7', '14749-6')));
        const one = withCodes('2345-7', null); one.references.loinc = ['2345-7'];
        assert.doesNotThrow(() => checkLoincRefs('x', one), 'pmol/L of fasting insulin has no code');
        assert.doesNotThrow(() => checkLoincRefs('x', { variations: base().variations }), 'no LOINC at all');
      });

      it('[LABC-LOINC-3b] refuses an option code the item does not assert, and an asserted code no option stores', () => {
        assert.throws(() => checkLoincRefs('x', withCodes('2345-7', '1558-6')), /not in references\.loinc/);
        assert.throws(() => checkLoincRefs('x', withCodes('2345-7', '2345-7')), /14749-6 but no unit option stores it/);
        assert.throws(() => checkLoincRefs('x', { variations: withCodes('2345-7', null).variations }), /asserts none/);
      });

      it('[LABC-LOINC-3c] never inherits: each option of an item with LOINC states its code, even for one code', () => {
        assert.throws(() => checkLoincRefs('x', base()), /must state the code it stores/);
        assert.throws(() => checkLoincRefs('x', { references: { loinc: ['718-7'] }, variations: base().variations }), /must state the code it stores/);
        assert.throws(() => checkLoincRefs('x', withCodes('2345-7')), /must state/, 'a missing code is not null');
      });

      it('[LABC-LOINC-3d] refuses a code twice, a code in both lists, and two codes on a one-unit number item', () => {
        assert.throws(() => checkLoincRefs('x', { references: { loinc: ['718-7', '718-7'] } }), /twice/);
        assert.throws(() => checkLoincRefs('x', { references: { loinc: ['718-7'], loincMethod: ['718-7'] } }), /both/);
        assert.throws(() => checkLoincRefs('x', { type: 'number', references: { loinc: ['2345-7', '14749-6'] } }), /one unit/);
        assert.doesNotThrow(() => checkLoincRefs('x', { type: 'composite', references: { loinc: ['85354-9', '8480-6'] } }), 'a panel');
      });

      it('[LABC-LOINC-3e] two options share a code only if their units are of one kind', () => {
        const KINDS = [['molar', /^concentration\/(mmol|umol|nmol|pmol)-l$/], ['units', /^concentration\/(iu-l|uiu-ml|iu-ml|u-ml)$/],
          ['count', /^concentration\/(count-ul|count-ml|megacount-ml|gigacount-ml)$/], ['mass', /^concentration\//]];
        const kindOf = (et) => (KINDS.find(([, re]) => re.test(et)) || [et.split('/')[0]])[0];
        let shared = 0;
        for (const [key, item] of Object.entries(itemsById)) {
          const byCode = {};
          for (const o of item.variations?.eventType?.options || []) if (o.loinc) (byCode[o.loinc] ??= new Set()).add(kindOf(o.value));
          for (const [code, kinds] of Object.entries(byCode)) {
            assert.strictEqual(kinds.size, 1, `${key}: ${code} is stored by options of kinds ${[...kinds]}`);
            shared++;
          }
        }
        assert.ok(shared > 60, `${shared} option codes checked`);
        assert.strictEqual(kindOf('concentration/pmol-l'), 'molar');
        assert.strictEqual(kindOf('concentration/uiu-ml'), 'units');
        assert.strictEqual(kindOf('concentration/ug-l'), 'mass');
      });
    });
  });

  describe('[LABC-PACK] built pack.json', () => {
    let pack;
    before(() => {
      const packPath = path.join(__dirname, '../dist/pack.json');
      if (!fs.existsSync(packPath)) return;
      pack = JSON.parse(fs.readFileSync(packPath, 'utf-8'));
    });

    it('[LABC-PACK-1] the pack carries the eventType, the streams and the items', function () {
      if (!pack || !pack.items['body-blood-coded']) return this.skip(); // pack built before this change
      assert.ok(pack.eventTypes.types['lab-result/coded-v1']);
      for (const id of Object.keys(CODED)) assert.strictEqual(pack.items[id].type, 'imported', id);
      const body = pack.streams.find((r) => r.id === 'body');
      assert.ok(body.children.find((s) => s.id === 'body-csf'), 'body-csf in pack');
    });
  });
});
