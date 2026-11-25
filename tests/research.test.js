const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const AjvDraft04 = require('ajv-draft-04');
const addFormats = require('ajv-formats');

// HDS research relationship: the `hds-research` tree on the person's account, research/topics-v1 and its vocabulary.
// See documentation/RESEARCH.md.

describe('[RES] Research relationship', () => {
  const { itemsById } = require('../src/items');
  const streams = require('../src/streams');
  const { eventTypesById } = require('../src/eventTypes');
  const { vocabulariesById, resolveEnum } = require('../src/vocabularies');

  describe('[RES-STR] hds-research', () => {
    it('[RES-STR-1] a root with exactly the two children, and no item anywhere in it', () => {
      const root = streams.streamsById['hds-research'];
      assert.ok(root, 'hds-research must exist');
      assert.strictEqual(root.parentId, null);
      assert.ok(streams.roots.find((r) => r.id === 'hds-research'));
      assert.deepStrictEqual(root.children.map((c) => c.id), ['hds-research-eligibility', 'hds-research-topics']);
      for (const c of root.children) {
        assert.strictEqual(streams.streamsById[c.id].parentId, 'hds-research');
        assert.ok(!c.children || c.children.length === 0, `${c.id} has no child`);
      }
      const ids = new Set(['hds-research', 'hds-research-eligibility', 'hds-research-topics']);
      const on = Object.entries(itemsById).filter(([, i]) => ids.has(i.streamId)).map(([k]) => k);
      assert.deepStrictEqual(on, [], 'no item in the research tree');
    });

    it('[RES-STR-2] localised names in en and fr; the root says what it holds and that sharing all never includes it', () => {
      for (const id of ['hds-research', 'hds-research-eligibility', 'hds-research-topics']) {
        assert.doesNotThrow(() => streams.checkLocalisedNames(streams.streamsById[id]), id);
      }
      const root = streams.streamsById['hds-research'];
      assert.match(root.description.en, /none of your health records/);
      assert.match(root.description.en, /Never included when you share all your data/);
      assert.match(root.description.fr, /aucun de vos dossiers de santé/);
      assert.match(root.description.fr, /Jamais inclus quand vous partagez toutes vos données/);
    });

    it('[RES-STR-3] the root is explicitGrantOnly, its children carry no marker of their own', () => {
      assert.strictEqual(streams.streamsById['hds-research'].explicitGrantOnly, true);
      for (const id of ['hds-research-eligibility', 'hds-research-topics']) {
        assert.strictEqual(streams.streamsById[id].explicitGrantOnly, undefined, id);
      }
    });
  });

  for (const [flavour, make] of [
    ['draft-04 (the cores)', () => new AjvDraft04({ strict: false, allErrors: true, coerceTypes: false, validateFormats: true, logger: false })],
    ['draft-07', () => new Ajv({ strict: false, allErrors: true, coerceTypes: false, logger: false })]
  ]) {
    describe(`[RES-ET] research/topics-v1, ${flavour}`, () => {
      let validate;
      before(() => {
        const ajv = make();
        addFormats(ajv);
        validate = ajv.compile(eventTypesById('research/topics-v1'));
      });

      it('[RES-ET-1] accepts no topic, one, and several distinct ones', () => {
        assert.ok(validate({ topics: [] }), JSON.stringify(validate.errors));
        assert.ok(validate({ topics: ['sleep'] }), JSON.stringify(validate.errors));
        assert.ok(validate({ topics: ['cardiovascular', 'reproductive-health', 'physical-activity'] }), JSON.stringify(validate.errors));
      });

      it('[RES-ET-2] refuses a missing list, an unknown or repeated topic, free text and extra fields', () => {
        assert.ok(!validate({}));
        assert.ok(!validate({ topics: ['astrology'] }));
        assert.ok(!validate({ topics: ['sleep', 'sleep'] }));
        assert.ok(!validate({ topics: 'sleep' }));
        assert.ok(!validate({ topics: ['sleep'], note: 'free text' }));
        assert.ok(!validate({ topics: [{ key: 'sleep' }] }));
      });

      it('[RES-ET-3] uses no if/then (the cores compile draft-04)', () => {
        assert.ok(!/"(if|then|else)"/.test(JSON.stringify(eventTypesById('research/topics-v1'))));
      });
    });
  }

  for (const [flavour, make] of [
    ['draft-04 (the cores)', () => new AjvDraft04({ strict: false, allErrors: true, coerceTypes: false, validateFormats: true, logger: false })],
    ['draft-07', () => new Ajv({ strict: false, allErrors: true, coerceTypes: false, logger: false })]
  ]) {
    describe(`[RES-AL] research alert kinds, ${flavour}`, () => {
      const { hdsResearchAlert } = require('../src/schemas/researchAlert');
      let validate;
      before(() => {
        validate = make().compile(hdsResearchAlert);
      });

      it('[RES-AL-1] accepts each kind with its one id', () => {
        assert.ok(validate({ kind: 'research-invitation', studyId: 'study-xyz' }), JSON.stringify(validate.errors));
        assert.ok(validate({ kind: 'research-eligibility-request', requestId: 'req-2026-001' }), JSON.stringify(validate.errors));
      });

      it('[RES-AL-2] refuses a missing or foreign id, an unknown kind, text, dates and extra fields', () => {
        assert.ok(!validate({ kind: 'research-invitation' }));
        assert.ok(!validate({ kind: 'research-invitation', requestId: 'req-1' }));
        assert.ok(!validate({ kind: 'research-eligibility-request', studyId: 's' }));
        assert.ok(!validate({ kind: 'eligibility-request', requestId: 'req-1' }));
        assert.ok(!validate({ kind: 'research-invitation', studyId: 'study xyz' }));
        assert.ok(!validate({ kind: 'research-invitation', studyId: 's'.repeat(65) }));
        assert.ok(!validate({ kind: 'research-invitation', studyId: 's', expiresAt: 1798761600 }));
        assert.ok(!validate({ kind: 'research-invitation', studyId: 's', title: 'Study XYZ' }));
      });

      it('[RES-AL-3] uses no if/then, const or $ref (the cores compile draft-04)', () => {
        assert.ok(!/"(if|then|else|const|\$ref)"/.test(JSON.stringify(hdsResearchAlert)));
      });
    });
  }

  describe('[RES-VOC] research-topic vocabulary', () => {
    it('[RES-VOC-0] keys are append-only: the published ones stay, in order (a rename or removal fails here)', () => {
      const published = ['cardiovascular', 'metabolic', 'mental-health', 'neurology', 'cancer', 'respiratory', 'reproductive-health', 'womens-health', 'pregnancy', 'sleep', 'nutrition', 'physical-activity', 'musculoskeletal', 'infectious-diseases', 'rare-diseases'];
      const keys = resolveEnum('research/topics-v1', 'topics');
      assert.deepStrictEqual(keys.slice(0, published.length), published);
    });

    it('[RES-VOC-1] labels every topic in en and fr, in the enum order, with no code', () => {
      const vocabulary = vocabulariesById['research-topic'];
      assert.ok(vocabulary, 'research-topic must exist');
      assert.deepStrictEqual(Object.keys(vocabulary.values), resolveEnum('research/topics-v1', 'topics'));
      for (const [key, value] of Object.entries(vocabulary.values)) {
        assert.ok(value.label.en && value.label.fr, key);
        assert.ok(!value.snomed && !value.fhir, `${key} is uncoded`);
      }
    });
  });

  describe('[RES-PACK] built pack.json', () => {
    let pack;
    before(() => {
      const packPath = path.join(__dirname, '../dist/pack.json');
      if (!fs.existsSync(packPath)) return; // npm run build has not run yet
      pack = JSON.parse(fs.readFileSync(packPath, 'utf-8'));
    });

    it('[RES-PACK-1] the pack carries the tree, the eventTypes, the vocabulary and the alert schema', function () {
      if (!pack) return this.skip();
      assert.ok(fs.existsSync(path.join(__dirname, '../dist/json-schemas/hds-research-alert.json')));
      assert.strictEqual(pack.streams.find((r) => r.id === 'hds-research').explicitGrantOnly, true);
      const root = pack.streams.find((r) => r.id === 'hds-research');
      assert.ok(root, 'hds-research root in pack');
      assert.deepStrictEqual(root.children.map((c) => c.id), ['hds-research-eligibility', 'hds-research-topics']);
      assert.ok(pack.eventTypes.types['research/topics-v1']);
      assert.ok(pack.eventTypes.types['research/eligibility-band-v1']);
      assert.ok(pack.vocabularies['research-topic']);
    });
  });
});
