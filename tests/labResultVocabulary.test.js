const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

// Curated codes of a qualitative lab result (4.50.0, plan 128 SUB-E L7 § A): the vocabulary `lab-result`, a vocabulary of
// codes for lab-result/coded-v1 valueCodes, with its scales and the rank of `crosses`; and the urine test-strip LOINC
// codes. See documentation/BLOOD-CHEMISTRY.md § Qualitative results: curated result codes.

const { vocabulariesById, addVocabulary, resolveCoding } = require('../src/vocabularies');
const { eventTypesById } = require('../src/eventTypes');
const { itemsById } = require('../src/items');

const KEY = 'lab-result';
const SNOMED = {
  negative: '260385009',
  trace: '260405006',
  'plus-1': '260347006',
  'plus-2': '260348001',
  'plus-3': '260349009',
  'plus-4': '260350009',
  positive: '10828004',
  detected: '260373001',
  'not-detected': '260415000',
  absent: '2667000',
  present: '52101004'
};
const SCALES = {
  presence: { values: ['negative', 'positive'] },
  detection: { values: ['not-detected', 'detected'] },
  crosses: { ranked: true, values: ['negative', 'trace', 'plus-1', 'plus-2', 'plus-3', 'plus-4'] },
  occurrence: { values: ['absent', 'present'] }
};
const STRIP = {
  '5799-2': 'qualitative',
  '5802-4': 'qualitative',
  '20454-5': 'qualitative',
  '25428-4': 'qualitative',
  '2514-8': 'qualitative',
  '5794-3': 'qualitative',
  '5770-3': 'qualitative',
  '5818-0': 'qualitative',
  '5803-2': 'numeric, `unit` `[pH]`',
  '5811-5': 'numeric, `unit` `1`'
};

const fresh = () => [{}, {}];

describe('[LABV] lab-result vocabulary (4.50.0)', () => {
  const voc = vocabulariesById[KEY];

  it('[LABV-1] the keys, in order, each with its SNOMED CT qualifier value (verified active, International 20260201)', () => {
    assert.ok(voc, 'lab-result must exist');
    assert.deepStrictEqual(Object.fromEntries(Object.entries(voc.values).map(([k, v]) => [k, v.snomed])), SNOMED);
    assert.strictEqual(new Set(Object.values(SNOMED)).size, Object.keys(SNOMED).length, 'one code per key');
  });

  it('[LABV-2] labels en, fr and es on every key; absent ≠ negative and detected ≠ positive stay distinct', () => {
    for (const [k, v] of Object.entries(voc.values)) {
      for (const l of ['en', 'fr', 'es']) assert.ok(typeof v.label[l] === 'string' && v.label[l].length > 0, `${k}.${l}`);
    }
    assert.notStrictEqual(voc.values.absent.snomed, voc.values.negative.snomed);
    assert.notStrictEqual(voc.values.detected.snomed, voc.values.positive.snomed);
    for (const n of [1, 2, 3, 4]) assert.deepStrictEqual(voc.values[`plus-${n}`].label, { en: `${n}+`, fr: `${n}+`, es: `${n}+` });
  });

  it('[LABV-3] a vocabulary of codes: lab-result/coded-v1 valueCodes, SNOMED CT, no binds', () => {
    assert.deepStrictEqual(voc.codings, [{ eventType: 'lab-result/coded-v1', path: 'valueCodes', system: 'http://snomed.info/sct' }]);
    assert.strictEqual(voc.binds, undefined);
    assert.ok(resolveCoding('lab-result/coded-v1', 'valueCodes'), 'valueCodes is an array of Codings');
    assert.strictEqual(resolveCoding('lab-result/coded-v1', 'valueText'), null);
    assert.strictEqual(resolveCoding('lab-result/coded-v1', 'analyte.label'), null);
    // every coding the vocabulary yields is valid in the eventType (no eventType change)
    const validate = new Ajv({ strict: false }).compile(eventTypesById('lab-result/coded-v1'));
    const analyte = { label: { en: 'Nitrite' }, codes: [{ system: 'http://loinc.org', code: '5802-4' }] };
    for (const [k, v] of Object.entries(voc.values)) {
      assert.ok(validate({ analyte, valueText: v.label.fr, valueCodes: [{ system: voc.codings[0].system, code: v.snomed }] }), k + ' ' + JSON.stringify(validate.errors));
    }
  });

  it('[LABV-4] the scales, and the rank of crosses from low to high; every key on a scale', () => {
    assert.deepStrictEqual(voc.scales, SCALES);
    const ranked = Object.entries(voc.scales).filter(([, s]) => s.ranked).map(([n]) => n);
    assert.deepStrictEqual(ranked, ['crosses'], 'only crosses is ranked');
    const rank = (k) => voc.scales.crosses.values.indexOf(k);
    const order = ['negative', 'trace', 'plus-1', 'plus-2', 'plus-3', 'plus-4'];
    for (let i = 1; i < order.length; i++) assert.ok(rank(order[i - 1]) < rank(order[i]), `${order[i - 1]} < ${order[i]}`);
    const onScale = new Set(Object.values(voc.scales).flatMap((s) => s.values));
    assert.deepStrictEqual([...onScale].sort(), Object.keys(voc.values).sort());
    for (const [k, v] of Object.entries(voc.values)) assert.strictEqual(v.rank, undefined, `${k}: the rank lives in the scale only`);
  });

  it('[LABV-5] the loader refuses binds and codings together or neither, a field that is not Codings, a missing or shared code, a scale off the values, a key on no scale, a field and system claimed twice, a key not lowercase', () => {
    const good = structuredClone(voc);
    assert.doesNotThrow(() => addVocabulary('t', good, ...fresh()));
    assert.throws(() => addVocabulary('t', { ...good, binds: [{ eventType: 'medication/basic', path: 'status' }] }, ...fresh()), /is invalid/);
    const { codings: _c, ...neither } = good;
    assert.throws(() => addVocabulary('t', neither, ...fresh()), /is invalid/);
    assert.throws(() => addVocabulary('t', { ...good, codes: good.codings }, ...fresh()), /is invalid/, 'the field is codings');
    assert.throws(() => addVocabulary('t', { ...good, codings: [{ ...good.codings[0], system: 'http://loinc.org' }] }, ...fresh()), /is invalid/);
    assert.throws(() => addVocabulary('t', { ...good, codings: [{ ...good.codings[0], path: 'valueText' }] }, ...fresh()), /not an array of Codings/);
    assert.throws(() => addVocabulary('t', { ...good, codings: [{ ...good.codings[0], eventType: 'lab-result/nope' }] }, ...fresh()), /not an array of Codings/);
    const [registry, bound] = fresh();
    addVocabulary('a', good, registry, bound);
    assert.throws(() => addVocabulary('b', good, registry, bound), /already bound by "a"/, 'one vocabulary per field and system');
    assert.deepStrictEqual(Object.keys(bound), ['lab-result/coded-v1 valueCodes http://snomed.info/sct']);
    const upper = structuredClone(good); upper.values['Plus-5'] = { label: { en: '5+', fr: '5+' }, snomed: '260350010' };
    assert.throws(() => addVocabulary('t', upper, ...fresh()), /is invalid/);
    const cross = structuredClone(good); cross.values['1+'] = cross.values['plus-1']; delete cross.values['plus-1'];
    assert.throws(() => addVocabulary('t', cross, ...fresh()), /is invalid/, 'a key starts with a letter');
    assert.throws(() => addVocabulary('t', { ...good, scales: { ...good.scales, crosses: { ranked: true, values: ['negative', '1+'] } } }, ...fresh()), /is invalid/);
    const noCode = structuredClone(good); delete noCode.values.trace.snomed;
    assert.throws(() => addVocabulary('t', noCode, ...fresh()), /has no snomed code/);
    const shared = structuredClone(good); shared.values.absent.snomed = shared.values.negative.snomed;
    assert.throws(() => addVocabulary('t', shared, ...fresh()), /share the snomed code/);
    assert.throws(() => addVocabulary('t', { ...good, scales: { ...good.scales, x: { values: ['negative', 'weak'] } } }, ...fresh()), /lists "weak"/);
    assert.throws(() => addVocabulary('t', { ...good, scales: { presence: good.scales.presence } }, ...fresh()), /on no scale/);
    assert.throws(() => addVocabulary('t', { ...good, scales: { x: { values: ['negative'] } } }, ...fresh()), /is invalid/);
    assert.throws(() => addVocabulary('t', { ...good, scales: { x: { values: ['negative', 'negative'] } } }, ...fresh()), /is invalid/);
    assert.throws(() => addVocabulary('t', { ...good, scales: { x: { values: ['negative', 'trace'], ranked: 'yes' } } }, ...fresh()), /is invalid/);
    assert.throws(() => addVocabulary('t', { ...good, scales: { Crosses: good.scales.crosses } }, ...fresh()), /is invalid/);
  });

  it('[LABV-DOC-1] BLOOD-CHEMISTRY.md lists exactly the keys, codes and scales', () => {
    const doc = fs.readFileSync(path.join(__dirname, '../documentation/BLOOD-CHEMISTRY.md'), 'utf8');
    const start = doc.indexOf('### Qualitative results: curated result codes (4.50.0)');
    assert.ok(start > 0);
    const section = doc.slice(start, doc.indexOf('### Moving a result to its item', start));
    const rows = [...section.matchAll(/^\| `([a-z0-9-]+)` \| [^|]+ \| `(\d+)` [^|]+ \| ([^|]+) \|$/gm)];
    assert.deepStrictEqual(Object.fromEntries(rows.map((r) => [r[1], r[2]])), SNOMED);
    for (const [, k, , scales] of rows) {
      for (const [name, s] of Object.entries(SCALES)) assert.strictEqual(scales.includes(name), s.values.includes(k), `${k} on ${name}`);
    }
    // the rank is a position, not a number: the doc pins the order only
    assert.doesNotMatch(section, /rank \d/);
    const flat = section.replace(/\s+/g, ' ');
    assert.ok(flat.includes('lowest first (negative, trace, 1+, 2+, 3+, 4+)'));
    assert.ok(flat.includes('A rank is the position in the pack being read: it orders two results and is never stored or exported. A ranked scale may gain a value at any position. A scale is never renamed, never loses a value, and `ranked` never changes.'));
    assert.ok(flat.includes('The crosses codes assert a four-cross scale'));
    assert.ok(flat.includes('a reader must not derive one'));
    assert.match(section, /It is a\s+vocabulary, not a content field/);
    assert.match(section, /`valueText` = the cell\s+exactly as printed/);
  });

  it('[LABV-LOINC-1] the urine test-strip codes: ten, valid check digits, each once, none owned by an item', () => {
    const doc = fs.readFileSync(path.join(__dirname, '../documentation/BLOOD-CHEMISTRY.md'), 'utf8');
    const start = doc.indexOf('Urine test strip (*bandelette urinaire*), 4.50.0');
    assert.ok(start > 0);
    const section = doc.slice(start, doc.indexOf('**Consent.**', start));
    const rows = [...section.matchAll(/^\| [^|]+ \| ([^|]+) \| `(\d{3,5}-\d)` \|$/gm)].map((m) => [m[2], m[1].trim()]);
    assert.deepStrictEqual(Object.fromEntries(rows), STRIP);
    const owned = new Map();
    for (const [key, item] of Object.entries(itemsById)) {
      for (const c of [...(item.references?.loinc || []), ...(item.references?.loincMethod || [])]) owned.set(c, key);
    }
    for (const c of Object.keys(STRIP)) {
      const m = /^(\d+)-(\d)$/.exec(c);
      let sum = 0;
      m[1].split('').map(Number).reverse().forEach((d, i) => { if (i % 2 === 0) { const x = d * 2; sum += x > 9 ? x - 9 : x; } else sum += d; });
      assert.strictEqual((10 - (sum % 10)) % 10, Number(m[2]), `${c}: check digit`);
      assert.ok(!owned.has(c), `${c} is owned by ${owned.get(c)}`);
    }
  });

  describe('[LABV-PACK] built pack.json', () => {
    let pack;
    before(() => {
      const packPath = path.join(__dirname, '../dist/pack.json');
      if (fs.existsSync(packPath)) pack = JSON.parse(fs.readFileSync(packPath, 'utf-8'));
    });

    it('[LABV-PACK-1] the pack carries the vocabulary with its codes and scales, and the published schema accepts it', function () {
      if (!pack || !pack.vocabularies?.[KEY]) return this.skip(); // pack built before this change
      // the pack's labels carry the locale texts of definitions/l10n too (B-2026-11-28-6)
      const { loadLocales, localise } = require('../src/l10n');
      assert.deepStrictEqual(pack.vocabularies[KEY], localise('vocabularies.json', vocabulariesById, loadLocales().locales)[KEY]);
      const schemaPath = path.join(__dirname, '../dist/json-schemas/vocabulary.json');
      if (fs.existsSync(schemaPath)) {
        const validate = new Ajv({ strict: false }).compile(JSON.parse(fs.readFileSync(schemaPath, 'utf-8')));
        for (const [k, v] of Object.entries(pack.vocabularies)) assert.ok(validate(v), k + ' ' + JSON.stringify(validate.errors));
      }
    });
  });
});
