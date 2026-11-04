const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const AjvDraft04 = require('ajv-draft-04');

// Genetic test results (site-agents#37): the `genetics` root with its `explicitGrantOnly` marker, the imported item
// `genetics-variant` and `genetic-variant/coded-v1`. See documentation/GENETICS.md.

describe('[GEN] genetic test results', () => {
  const { itemsById, findItemForEvent, checkItemVsEvenType, fhirScopes } = require('../src/items');
  const { checkItem } = require('../src/schemas/items');
  const streams = require('../src/streams');
  const { eventTypesById } = require('../src/eventTypes');
  const { computeFhirScopes, readLock, lockEntries, mergeLock, UNMAPPED } = require('../src/fhir');

  const ET = 'genetic-variant/coded-v1';
  const KEY = 'genetics-variant';
  const STREAMS = { genetics: null, 'genetics-variant': 'genetics' };
  const RESULTS = ['present', 'absent', 'indeterminate', 'no-call'];
  const ZYGOSITIES = ['homozygous', 'heterozygous', 'hemizygous', 'homoplasmic', 'heteroplasmic'];

  const HGNC = 'http://www.genenames.org/geneId';
  const HGVS = 'http://varnomen.hgvs.org';
  const DBSNP = 'http://www.ncbi.nlm.nih.gov/projects/SNP';
  const CLINVAR = 'http://www.ncbi.nlm.nih.gov/clinvar';
  const mthfr = () => ({ label: 'MTHFR', codes: [{ system: HGNC, code: 'HGNC:7436', display: 'MTHFR' }] });
  const c677t = () => ({
    label: 'C677T',
    codes: [
      { system: HGVS, code: 'NM_005957.5:c.665C>T' },
      { system: DBSNP, code: 'rs1801133' },
      { system: CLINVAR, code: '3520' }
    ]
  });
  const minimal = () => ({ gene: mthfr(), variant: { label: 'C677T' }, result: 'present' });
  const full = () => ({
    gene: mthfr(),
    variant: c677t(),
    result: 'present',
    zygosity: 'homozygous',
    resultText: 'C677T homozygote (T/T)',
    method: 'Real-time PCR',
    laboratory: { eventId: 'ckorg0001', name: 'Laboratoire Exemple SA' },
    notes: 'Interpret with plasma homocysteine.'
  });

  describe('[GEN-STR] streams and the marker', () => {
    it('[GEN-STR-1] one root, one leaf; the root holds no item; genetics-variant is the only item in the subtree', () => {
      for (const [id, parent] of Object.entries(STREAMS)) {
        assert.ok(streams.streamsById[id], `${id} exists`);
        assert.strictEqual(streams.streamsById[id].parentId, parent, `${id} under ${parent}`);
      }
      assert.ok(streams.roots.find((r) => r.id === 'genetics'), 'genetics is a root');
      assert.strictEqual(streams.streamsById.genetics.name, 'Genetic test results');
      assert.strictEqual(streams.streamsById['genetics-variant'].name, 'Tested gene variants');
      const onRoot = Object.entries(itemsById).filter(([, i]) => i.streamId === 'genetics').map(([k]) => k);
      assert.deepStrictEqual(onRoot, [], 'no item on genetics');
      const inside = Object.entries(itemsById).filter(([, i]) => i.streamId in STREAMS).map(([k]) => k);
      assert.deepStrictEqual(inside, [KEY]);
    });

    it('[GEN-STR-2] the root carries explicitGrantOnly and consent-screen names; no other stream carries the marker', () => {
      const root = streams.streamsById.genetics;
      assert.strictEqual(root.explicitGrantOnly, true);
      assert.strictEqual(root.label.en, root.name);
      assert.ok(root.label.fr && root.description.en && root.description.fr, 'localised for consent screens');
      const marked = Object.values(streams.streamsById).filter((s) => s.explicitGrantOnly !== undefined).map((s) => s.id);
      assert.deepStrictEqual(marked, ['genetics'], 'the marker is on the genetics root only');
    });

    it('[GEN-STR-3] explicitGrantOnly is a boolean, on a root only', () => {
      const { checkExplicitGrantOnly } = streams;
      assert.doesNotThrow(() => checkExplicitGrantOnly({ id: 'r', explicitGrantOnly: true }, null));
      assert.doesNotThrow(() => checkExplicitGrantOnly({ id: 'r', explicitGrantOnly: false }, null));
      assert.doesNotThrow(() => checkExplicitGrantOnly({ id: 'c' }, 'r'));
      assert.throws(() => checkExplicitGrantOnly({ id: 'r', explicitGrantOnly: 'yes' }, null), /must be a boolean/);
      assert.throws(() => checkExplicitGrantOnly({ id: 'r', explicitGrantOnly: 1 }, null), /must be a boolean/);
      assert.throws(() => checkExplicitGrantOnly({ id: 'c', explicitGrantOnly: true }, 'r'), /on a root only/);
      assert.throws(() => checkExplicitGrantOnly({ id: 'c', explicitGrantOnly: false }, 'r'), /on a root only/);
    });
  });

  describe('[GEN-ITM] item', () => {
    it('[GEN-ITM-1] genetics-variant is imported, key = streamId, localised, no references and no fhir block', () => {
      const item = itemsById[KEY];
      assert.ok(item);
      assert.doesNotThrow(() => checkItem(item, KEY));
      assert.strictEqual(item.type, 'imported');
      assert.strictEqual(item.eventType, ET);
      assert.strictEqual(item.streamId, KEY);
      assert.strictEqual(item.repeatable, 'unlimited');
      assert.ok(item.label.fr && item.label.es && item.description.fr && item.description.es, 'localised');
      assert.ok(item.devNotes, 'devNotes');
      assert.strictEqual(item.references, undefined);
      assert.strictEqual(item.fhir, undefined);
      assert.strictEqual(findItemForEvent(ET, KEY), item);
      assert.strictEqual(findItemForEvent(ET, 'body-blood-coded'), null, 'a genetic result elsewhere resolves to none');
      assert.strictEqual(checkItemVsEvenType(KEY, item, eventTypesById(ET)), true);
    });
  });

  for (const [flavour, make] of [
    ['draft-04 (the cores)', () => new AjvDraft04({ strict: false, allErrors: true, coerceTypes: false, logger: false })],
    ['draft-07', () => new Ajv({ strict: false, allErrors: true, coerceTypes: false, logger: false })]
  ]) {
    describe(`[GEN-ET] ${ET} under ${flavour}`, () => {
      let validate;
      before(() => { validate = make().compile(eventTypesById(ET)); });
      const ok = (c, why) => assert.ok(validate(c), `${why}: ${JSON.stringify(validate.errors)}`);
      const ko = (c, why) => assert.ok(!validate(c), `${why}: accepted`);
      const g = (extra) => ({ ...minimal(), ...extra });

      it('[GEN-ET-1] accepts a minimal and a full result, every result and zygosity', () => {
        ok(minimal(), 'minimal');
        ok(full(), 'full');
        for (const result of RESULTS) ok(g({ result }), result);
        for (const zygosity of ZYGOSITIES) ok(g({ zygosity }), zygosity);
        ok(g({ result: 'absent', zygosity: 'homozygous' }), 'zygosity with absent: advisory, not enforced');
        ok(g({ variant: c677t() }), 'variant with HGVS, dbSNP and ClinVar');
        ok(g({ gene: { label: 'MTHFR', codes: [{ system: HGNC, version: '2026-11', code: 'HGNC:7436' }] } }), 'gene coding with version, no display');
        ok(g({ laboratory: { name: 'Lab' } }), 'laboratory by name only');
        ok(g({ laboratory: { eventId: 'ck_org-1' } }), 'laboratory by id only');
      });

      it('[GEN-ET-2] refuses malformed results', () => {
        for (const field of ['gene', 'variant', 'result']) {
          const c = minimal();
          delete c[field];
          ko(c, `no ${field}`);
        }
        ko(g({ result: 'detected' }), 'unknown result');
        ko(g({ result: 'heterozygous' }), 'zygosity is not a result');
        ko(g({ zygosity: 'compound-heterozygous' }), 'compound heterozygosity is out of scope');
        ko(g({ gene: { label: 'MTHFR' } }), 'gene without codes');
        ko(g({ gene: { label: 'MTHFR', codes: [] } }), 'gene with empty codes');
        ko(g({ gene: { codes: mthfr().codes } }), 'gene without label');
        ko(g({ gene: { ...mthfr(), label: '' } }), 'empty gene label');
        ko(g({ gene: { label: 'MTHFR', codes: [{ system: 'HGNC', code: '7436' }] } }), 'gene system not a URI');
        ko(g({ gene: { label: 'MTHFR', codes: [{ system: HGNC }] } }), 'gene coding without code');
        ko(g({ gene: { label: 'MTHFR', codes: [{ system: HGNC, code: 'HGNC:7436', hdsId: 'x' }] } }), 'a Coding is closed');
        ko(g({ gene: { ...mthfr(), hgnc: 'HGNC:7436' } }), 'gene is closed');
        ko(g({ variant: {} }), 'variant without label');
        ko(g({ variant: { label: 'C677T', codes: [] } }), 'variant with empty codes');
        ko(g({ variant: { label: 'C677T', rsid: 'rs1801133' } }), 'variant is closed');
        ko(g({ variant: 'C677T' }), 'variant is an object');
        ko(g({ resultText: '' }), 'empty resultText');
        ko(g({ method: '' }), 'empty method');
        ko(g({ notes: '' }), 'empty notes');
        ko(g({ laboratory: {} }), 'laboratory with nothing');
        ko(g({ laboratory: { eventId: 'a.b' } }), 'laboratory eventId outside the related path grammar');
        ko(g({ laboratory: { name: 'Lab', gln: '7601000000001' } }), 'laboratory is closed');
        ko(g({ phase: 'cis' }), 'closed: no phase between variants');
      });
    });
  }

  describe('[GEN-ET-SHAPE] shared shapes and the portable subset', () => {
    const strip = (schema) => JSON.parse(JSON.stringify(schema, (k, v) => (k === 'description' ? undefined : v)));
    const props = () => eventTypesById(ET).properties;

    it('[GEN-ET-3] each Coding is the lab-result/coded-v1 valueCodes Coding; laboratory is the encounter serviceProvider shape', () => {
      const coding = strip(eventTypesById('lab-result/coded-v1').properties.valueCodes.items);
      assert.deepStrictEqual(strip(props().gene.properties.codes.items), coding, 'gene');
      assert.deepStrictEqual(strip(props().variant.properties.codes.items), coding, 'variant');
      assert.deepStrictEqual(strip(props().laboratory), strip(eventTypesById('encounter/visit-v1').properties.serviceProvider));
    });

    it('[GEN-ET-4] closed, and no if/then/else/const/not/$ref (the cores compile draft-04)', () => {
      const et = eventTypesById(ET);
      assert.strictEqual(et.additionalProperties, false);
      assert.ok(!/"(if|then|else|const|not|\$ref)"/.test(JSON.stringify(et)));
    });

    it('[GEN-ET-5] the descriptions cite the verified LOINC codes and the code systems', () => {
      const p = props();
      assert.ok(p.result.description.includes('69548-6') && p.result.description.includes('LL1971-2'));
      for (const la of ['LA9633-4', 'LA9634-2', 'LA11884-6', 'LA18198-4']) assert.ok(p.result.description.includes(la), la);
      assert.ok(p.zygosity.description.includes('53034-5') && p.zygosity.description.includes('LL381-5'));
      for (const la of ['LA6705-3', 'LA6706-1', 'LA6707-9', 'LA6704-6', 'LA6703-8']) assert.ok(p.zygosity.description.includes(la), la);
      assert.ok(p.gene.description.includes('48018-6') && p.gene.description.includes(HGNC));
      for (const s of ['81252-9', '48004-6', HGVS, DBSNP, CLINVAR]) assert.ok(p.variant.description.includes(s), s);
    });
  });

  describe('[GEN-FHIR] SMART scopes', () => {
    it('[GEN-FHIR-1] no SMART scope reaches the genetics root; the grant table and the lock are unchanged', () => {
      const without = Object.fromEntries(Object.entries(itemsById).filter(([k]) => k !== KEY));
      assert.deepStrictEqual(computeFhirScopes(without).grants, fhirScopes, 'the item does not change the grant table');
      for (const granted of Object.values(fhirScopes)) {
        for (const s of granted) assert.ok(!(s in STREAMS), `${s} is granted`);
      }
      const lock = readLock();
      for (const s of Object.keys(STREAMS)) assert.strictEqual(lock.streams[s], undefined, `${s} is locked`);
      assert.deepStrictEqual(mergeLock(lock, lockEntries(itemsById, fhirScopes)), lock, 'npm run fhir:lock is a no-op');
      assert.deepStrictEqual([...computeFhirScopes(itemsById).subtree.get('genetics')], [UNMAPPED]);
    });
  });

  describe('[GEN-PACK] built pack.json', () => {
    let pack;
    before(() => {
      const packPath = path.join(__dirname, '../dist/pack.json');
      if (!fs.existsSync(packPath)) return;
      pack = JSON.parse(fs.readFileSync(packPath, 'utf-8'));
    });

    it('[GEN-PACK-1] the pack carries the eventType, the item and the marked root', function () {
      if (!pack || !pack.items[KEY]) return this.skip(); // pack built before this change
      assert.ok(pack.eventTypes.types[ET]);
      assert.strictEqual(pack.items[KEY].type, 'imported');
      const root = pack.streams.find((r) => r.id === 'genetics');
      assert.ok(root, 'genetics root in pack');
      assert.strictEqual(root.explicitGrantOnly, true);
      assert.strictEqual(root.children[0].explicitGrantOnly, undefined);
    });
  });
});
