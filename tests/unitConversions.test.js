const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const AjvDraft04 = require('ajv-draft-04');
const addFormats = require('ajv-formats');

// Lab units (site-agents#20, #21): SI units as `variations.eventType` options, stored as printed,
// and per-item factors for read-side comparison only. Rules in documentation/BLOOD-CHEMISTRY.md
// § Units and § Unit conversions.

const { itemsById, checkUnitConversions } = require('../src/items');
const { eventTypesById } = require('../src/eventTypes');
const { toBePublished: itemSchemaFiles } = require('../src/schemas/items');

const HDS_PATH = path.join(__dirname, '../definitions/eventTypes/eventTypes-hds.json');
const LEGACY_PATH = path.join(__dirname, '../definitions/eventTypes/eventTypes-legacy.json');

const C = (u) => 'concentration/' + u;

// The first slice: item → [unit it had, SI unit added]. The first option stays the unit the item
// had, so a reader that takes the first option keeps today's behaviour.
const SLICE = {
  'body-blood-serum-calcium': ['mg-dl', 'mmol-l'],
  'body-blood-serum-cholesterol-total': ['mg-dl', 'mmol-l'],
  'body-blood-serum-cholesterol-hdl': ['mg-dl', 'mmol-l'],
  'body-blood-serum-cholesterol-ldl': ['mg-dl', 'mmol-l'],
  'body-blood-serum-triglycerides': ['mg-dl', 'mmol-l'],
  'body-blood-serum-creatinine': ['mg-dl', 'umol-l'],
  'body-blood-serum-estradiol': ['pg-ml', 'pmol-l'],
  'body-blood-serum-progesterone': ['ug-l', 'nmol-l'],
  'body-blood-serum-testosterone-total': ['ng-dl', 'nmol-l'],
  'body-blood-serum-testosterone-free': ['pg-ml', 'pmol-l'],
  'body-blood-serum-androstenedione': ['ng-dl', 'nmol-l'],
  'body-blood-serum-17-oh-progesterone': ['ng-dl', 'nmol-l'],
  'body-blood-serum-dhea-s': ['mcg-dl', 'umol-l'],
  'body-blood-serum-cortisol': ['mcg-dl', 'nmol-l'],
  'body-blood-serum-free-t4': ['ng-dl', 'pmol-l'],
  'body-blood-serum-free-t3': ['pg-ml', 'pmol-l'],
  'body-blood-serum-total-t3': ['ng-dl', 'nmol-l'],
  'body-blood-serum-reverse-t3': ['ng-dl', 'nmol-l'],
  'body-blood-serum-vitamin-d-25oh': ['ug-l', 'nmol-l'],
  'body-blood-serum-vitamin-d-125oh': ['pg-ml', 'pmol-l'],
  'body-blood-serum-vitamin-b12': ['pg-ml', 'pmol-l'],
  'body-blood-serum-folate': ['ug-l', 'nmol-l'],
  'body-blood-serum-amh': ['ug-l', 'pmol-l'],
  'body-blood-serum-insulin-fasting': ['uiu-ml', 'pmol-l'],
  'body-blood-serum-prolactin': ['ug-l', 'uiu-ml']
};

// Pairs that must never carry a factor (site-agents#21): assay- or calibrator-dependent.
const EXCLUDED = {
  'body-blood-serum-insulin-fasting': [C('uiu-ml'), C('pmol-l')],
  'body-blood-serum-prolactin': [C('ug-l'), C('uiu-ml')]
};

// Units defined by an international standard rather than by mass or amount of substance.
const IU_UNITS = [C('uiu-ml'), C('iu-l'), C('iu-ml'), C('u-ml')];

// Concentration per litre: grams per litre for mass units, moles per litre for molar units.
const PER_LITRE = {
  [C('g-dl')]: ['mass', 10],
  [C('g-l')]: ['mass', 1],
  [C('mg-dl')]: ['mass', 1e-2],
  [C('mg-l')]: ['mass', 1e-3],
  [C('mcg-dl')]: ['mass', 1e-5],
  [C('ug-l')]: ['mass', 1e-6],
  [C('ng-dl')]: ['mass', 1e-8],
  [C('pg-ml')]: ['mass', 1e-9],
  [C('mmol-l')]: ['molar', 1e-3],
  [C('umol-l')]: ['molar', 1e-6],
  [C('nmol-l')]: ['molar', 1e-9],
  [C('pmol-l')]: ['molar', 1e-12]
};

const withConversions = () => Object.entries(itemsById).filter(([, i]) => i.unitConversions);
const eventTypesOf = (item) => item.variations?.eventType
  ? item.variations.eventType.options.map((o) => o.value)
  : [item.eventType];
const factorFor = (item, from, to) => {
  for (const f of item.unitConversions?.factors || []) {
    if (f.from === from && f.to === to) return f.factor;
    if (f.from === to && f.to === from) return 1 / f.factor;
  }
  return null;
};

describe('[UCNV] lab units: SI variations and conversion factors (site-agents#20, #21)', () => {
  describe('[UCNV-ET] concentration/pmol-l', () => {
    const hds = JSON.parse(fs.readFileSync(HDS_PATH, 'utf-8'));
    const legacy = JSON.parse(fs.readFileSync(LEGACY_PATH, 'utf-8'));

    it('[UCNV-ET-1] is an HDS type, a non-negative number, shown as pmol/L', () => {
      assert.ok(!legacy.types[C('pmol-l')], 'pryv owns no pmol/L type, so HDS adds it');
      assert.deepStrictEqual(hds.types[C('pmol-l')], { description: 'Picomoles per liter (pmol/L)', type: 'number', minimum: 0 });
      assert.strictEqual(hds.extras[C('pmol-l')].symbol, 'pmol/L');
    });

    it('[UCNV-ET-2] is no equivalent twin: every other molar type is a different scale', () => {
      const molar = Object.keys({ ...legacy.types, ...hds.types }).filter((t) => /^concentration\/[a-z]*mol-/.test(t));
      assert.deepStrictEqual(molar.sort(), [C('mmol-l'), C('nmol-l'), C('pmol-l'), C('umol-l')]);
      const scales = molar.map((t) => PER_LITRE[t][1]);
      assert.strictEqual(new Set(scales).size, scales.length);
    });

    it('[UCNV-ET-3] compiles and validates under draft-07 and ajv-draft-04 (the cores)', () => {
      const schema = hds.types[C('pmol-l')];
      const draft04 = new AjvDraft04({ strict: false, allErrors: true, coerceTypes: false, validateFormats: true, logger: false });
      addFormats(draft04);
      for (const ajv of [new Ajv({ strict: false, allErrors: true, logger: false }), draft04]) {
        const validate = ajv.compile(schema);
        assert.ok(validate(42.5));
        assert.ok(!validate(-1));
        assert.ok(!validate('42.5'));
      }
    });
  });

  describe('[UCNV-VAR] variations', () => {
    it('[UCNV-VAR-1] each slice item offers [its previous unit, the SI unit], in that order', () => {
      for (const [key, [was, si]] of Object.entries(SLICE)) {
        const item = itemsById[key];
        assert.ok(item, key);
        assert.strictEqual(item.eventType, undefined, `${key} declares variations, not eventType`);
        assert.deepStrictEqual(eventTypesOf(item), [C(was), C(si)], key);
      }
    });

    it('[UCNV-VAR-2] every variation eventType exists', () => {
      for (const [key, item] of Object.entries(itemsById)) {
        for (const t of eventTypesOf(item)) assert.ok(eventTypesById(t), `${key}: ${t}`);
      }
    });

    it('[UCNV-VAR-3] no number item with unit variations carries a display suffix (it would label every unit)', () => {
      const offenders = Object.entries(itemsById)
        .filter(([, i]) => i.type === 'number' && i.variations?.eventType && i.number?.display?.suffix)
        .map(([k]) => k);
      assert.deepStrictEqual(offenders, []);
    });
  });

  describe('[UCNV-FAC] factors', () => {
    it('[UCNV-FAC-1] every factor has a source, and both ends are eventTypes of its item', () => {
      assert.ok(withConversions().length > 0);
      for (const [key, item] of withConversions()) {
        const types = eventTypesOf(item);
        for (const f of item.unitConversions.factors || []) {
          assert.strictEqual(typeof f.source, 'string', key);
          assert.ok(f.source.trim().length > 0, `${key}: empty source`);
          assert.ok(types.includes(f.from) && types.includes(f.to), `${key}: ${f.from} → ${f.to}`);
        }
        for (const n of item.unitConversions.notConvertible || []) {
          assert.ok(n.reason.trim().length > 0, `${key}: empty reason`);
          assert.ok(types.includes(n.from) && types.includes(n.to), `${key}: ${n.from} ↔ ${n.to}`);
        }
      }
    });

    it('[UCNV-FAC-2] no factor for an excluded pair, and each one is marked not convertible', () => {
      for (const [key, [a, b]] of Object.entries(EXCLUDED)) {
        const item = itemsById[key];
        assert.strictEqual(factorFor(item, a, b), null, `${key} must not publish a factor`);
        const marked = (item.unitConversions?.notConvertible || [])
          .some((n) => (n.from === a && n.to === b) || (n.from === b && n.to === a));
        assert.ok(marked, `${key}: ${a} ↔ ${b} must be marked notConvertible`);
      }
      // No factor anywhere between an IU-based unit and a mass or molar one.
      for (const [key, item] of withConversions()) {
        for (const f of item.unitConversions.factors || []) {
          assert.ok(!(IU_UNITS.includes(f.from) !== IU_UNITS.includes(f.to)), `${key}: ${f.from} → ${f.to} crosses an IU unit`);
        }
      }
      // HbA1c NGSP ↔ IFCC is affine: the item offers no second unit, so no factor can exist.
      assert.strictEqual(itemsById['body-blood-hba1c'].unitConversions, undefined);
    });

    it('[UCNV-FAC-3] factors round-trip, in both directions', () => {
      for (const [key, item] of withConversions()) {
        for (const f of item.unitConversions.factors || []) {
          for (const v of [0.01, 1, 5.17, 200, 1234.5]) {
            const there = v * factorFor(item, f.from, f.to);
            const back = there * factorFor(item, f.to, f.from);
            assert.ok(Math.abs(back - v) <= v * 1e-12, `${key}: ${v} → ${there} → ${back}`);
          }
        }
      }
    });

    it('[UCNV-FAC-4] a factor with a molar mass matches it (to the 4 significant figures published)', () => {
      for (const [key, item] of withConversions()) {
        for (const f of item.unitConversions.factors || []) {
          if (f.molarMass == null) continue;
          const [fromKind, fromScale] = PER_LITRE[f.from];
          const [toKind, toScale] = PER_LITRE[f.to];
          assert.ok(fromKind !== toKind, `${key}: a molar mass relates a mass unit to a molar one`);
          const expected = fromKind === 'mass'
            ? fromScale / f.molarMass / toScale
            : fromScale * f.molarMass / toScale;
          assert.ok(Math.abs(f.factor / expected - 1) < 1e-3, `${key}: factor ${f.factor}, molar mass gives ${expected}`);
        }
      }
    });

    it('[UCNV-FAC-5] clinical anchor values convert as expected', () => {
      const anchors = [
        ['body-blood-serum-cholesterol-total', 200, 5.17],
        ['body-blood-serum-triglycerides', 150, 1.69],
        ['body-blood-serum-calcium', 10, 2.50],
        ['body-blood-serum-creatinine', 1, 88.4],
        ['body-blood-serum-estradiol', 100, 367],
        ['body-blood-serum-progesterone', 10, 31.8],
        ['body-blood-serum-testosterone-total', 500, 17.3],
        ['body-blood-serum-cortisol', 10, 276],
        ['body-blood-serum-free-t4', 1, 12.9],
        ['body-blood-serum-vitamin-d-25oh', 30, 74.9],
        ['body-blood-serum-vitamin-b12', 400, 295],
        ['body-blood-serum-folate', 10, 22.66],
        ['body-blood-serum-vitamin-d-125oh', 50, 120]
      ];
      for (const [key, conventional, si] of anchors) {
        const [was, to] = SLICE[key];
        const got = conventional * factorFor(itemsById[key], C(was), C(to));
        assert.ok(Math.abs(got / si - 1) < 0.005, `${key}: ${conventional} → ${got}, expected about ${si}`);
      }
    });

    it('[UCNV-FAC-6] figures checked against the usual SI tables: folate 2.266 (half-up from 2.2655), calcitriol 2.4 (not 2.6, which is cholecalciferol)', () => {
      const folate = itemsById['body-blood-serum-folate'];
      assert.strictEqual(factorFor(folate, C('ug-l'), C('nmol-l')), 2.266);
      const calcitriol = itemsById['body-blood-serum-vitamin-d-125oh'];
      assert.strictEqual(factorFor(calcitriol, C('pg-ml'), C('pmol-l')), 2.4);
    });

    it('[UCNV-FAC-7] fasting glucose (3.22.0, PRH request): 100 mg/dL ≈ 5.55 mmol/L, and 5.5 mmol/L ≈ 99.1 mg/dL', () => {
      const glucose = itemsById['body-blood-serum-glucose-fasting'];
      assert.strictEqual(factorFor(glucose, C('mg-dl'), C('mmol-l')), 0.05551);
      assert.ok(Math.abs(100 * factorFor(glucose, C('mg-dl'), C('mmol-l')) - 5.551) < 1e-9);
      assert.ok(Math.abs(5.5 * factorFor(glucose, C('mmol-l'), C('mg-dl')) / 99.08 - 1) < 0.001);
    });

    describe('[UCNV-REJ] the loader refuses', () => {
      const types = [C('mg-dl'), C('mmol-l')];
      const ok = { from: C('mg-dl'), to: C('mmol-l'), factor: 0.02586, source: 's' };

      it('[UCNV-REJ-1] accepts a well-formed block', () => {
        checkUnitConversions('t', { factors: [ok] }, types);
      });
      it('[UCNV-REJ-2] an end that is not an eventType of the item', () => {
        assert.throws(() => checkUnitConversions('t', { factors: [{ ...ok, to: C('umol-l') }] }, types), /not one of the item's eventTypes/);
      });
      it('[UCNV-REJ-3] a pair from a unit to itself', () => {
        assert.throws(() => checkUnitConversions('t', { factors: [{ ...ok, to: C('mg-dl') }] }, types), /both/);
      });
      it('[UCNV-REJ-4] a zero, negative or non-finite factor', () => {
        for (const factor of [0, -1, Infinity, NaN]) {
          assert.throws(() => checkUnitConversions('t', { factors: [{ ...ok, factor }] }, types), /above 0/);
        }
      });
      it('[UCNV-REJ-5] a pair declared twice: its reverse, or also as not convertible', () => {
        const reverse = { from: ok.to, to: ok.from, factor: 1 / ok.factor, source: 's' };
        assert.throws(() => checkUnitConversions('t', { factors: [ok, reverse] }, types), /more than once/);
        const marked = { from: ok.to, to: ok.from, reason: 'r' };
        assert.throws(() => checkUnitConversions('t', { factors: [ok], notConvertible: [marked] }, types), /more than once/);
      });
    });
  });

  describe('[UCNV-SCH] the published item schema', () => {
    const itemSchema = itemSchemaFiles().find((f) => f.filename === 'item.json').content;
    const block = itemSchema.properties.unitConversions;

    function validators () {
      const draft04 = new AjvDraft04({ strict: false, allErrors: true, coerceTypes: false, validateFormats: true, logger: false });
      addFormats(draft04);
      return [['draft-07', new Ajv({ strict: false, allErrors: true, logger: false })], ['draft-04', draft04]];
    }

    it('[UCNV-SCH-1] the unitConversions block compiles under both validators and accepts every item\'s block', () => {
      for (const [name, ajv] of validators()) {
        const validate = ajv.compile(block);
        for (const [key, item] of withConversions()) {
          assert.ok(validate(item.unitConversions), `${name} ${key}: ${ajv.errorsText(validate.errors)}`);
        }
      }
    });

    it('[UCNV-SCH-2] both validators refuse a factor without a source, and an unknown key', () => {
      for (const [name, ajv] of validators()) {
        const validate = ajv.compile(block);
        assert.ok(!validate({ factors: [{ from: 'a', to: 'b', factor: 2 }] }), `${name}: missing source`);
        assert.ok(!validate({ factors: [{ from: 'a', to: 'b', factor: 2, source: '' }] }), `${name}: empty source`);
        assert.ok(!validate({ factors: [], ratio: 2 }), `${name}: unknown key`);
      }
    });
  });

  describe('[UCNV-PACK] the block is in what readers download', () => {
    it('[UCNV-PACK-1] items.json and pack.json content carry it (in memory, as build.js assembles them)', () => {
      const [items] = require('../src/items').toBePublished();
      assert.strictEqual(items.includeInPack, 'items');
      const published = JSON.parse(JSON.stringify(items.content));
      for (const [key, item] of withConversions()) {
        assert.deepStrictEqual(published[key].unitConversions, item.unitConversions, key);
      }
    });

    it('[UCNV-PACK-2] the built dist/pack.json and dist/items.json carry it', () => {
      const read = (name) => {
        const p = path.join(__dirname, '../dist', name);
        return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf-8')) : null; // npm run build has not run yet
      };
      const pack = read('pack.json');
      const items = read('items.json');
      if (!pack || !items) return;
      for (const [key, item] of withConversions()) {
        assert.deepStrictEqual(pack.items[key].unitConversions, item.unitConversions, `pack.json ${key}`);
        assert.deepStrictEqual(items[key].unitConversions, item.unitConversions, `items.json ${key}`);
      }
      assert.ok(pack.eventTypes.types[C('pmol-l')], 'pack.json carries concentration/pmol-l');
    });
  });
});
