const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const AjvDraft04 = require('ajv-draft-04');

// Her other names (4.47.0, plan 128 SUB-F L6): the explicitGrantOnly root other-names, the item other-name and the
// eventType contact/other-name-v1. See documentation/PROFILE.md § Other names and CONVERSATION.md R3.

const { eventTypesById } = require('../src/eventTypes');
const streams = require('../src/streams');
const { itemsById } = require('../src/items');

const ROOT = 'other-names';
const KEY = 'other-name';
const ET = 'contact/other-name-v1';
const USES = ['official', 'usual', 'maiden', 'old', 'nickname'];
const FLAVOURS = [
  ['draft-04 (the cores)', () => new AjvDraft04({ strict: false, allErrors: true, coerceTypes: false, logger: false })],
  ['draft-07', () => new Ajv({ strict: false, allErrors: true, coerceTypes: false, logger: false })]
];

describe('[ONM] other names', () => {
  describe('[ONM-STR] the other-names root', () => {
    it('[ONM-STR-1] a root marked explicitGrantOnly, not under profile, with no child, named for consent screens', () => {
      const root = streams.streamsById[ROOT];
      assert.ok(root, 'other-names exists');
      assert.strictEqual(root.parentId, null);
      assert.ok(streams.roots.find((r) => r.id === ROOT), 'a root');
      assert.strictEqual(root.explicitGrantOnly, true);
      assert.ok(!root.children || root.children.length === 0);
      assert.ok(!ROOT.startsWith('profile'), 'not named under profile\'s prefix');
      assert.ok(!streams.getAncestorsById(ROOT).includes('profile'), 'a grant on profile never reaches it');
      assert.strictEqual(root.label.en, root.name);
      assert.ok(root.label.fr && root.description.en && root.description.fr);
      // the consent-screen promise waits for the sweep of the production * accesses (PROFILE.md § Other names), as genetics did (3.43.1)
      for (const lang of ['en', 'fr', 'es']) assert.doesNotMatch(root.description[lang], /Never|Jamais|Nunca/, lang + ': no promise before the sweep');
    });

    it('[ONM-STR-2] the profile root keeps its children: no other name sits under profile', () => {
      const under = Object.entries(itemsById).filter(([, i]) => i.eventType === ET).map(([k, i]) => [k, i.streamId]);
      assert.deepStrictEqual(under, [[KEY, ROOT]]);
    });
  });

  describe('[ONM-ITM] the item', () => {
    it('[ONM-ITM-1] other-name: composite on the eventType, several at once, labelled en/fr/es, no fhir block', () => {
      const item = itemsById[KEY];
      assert.ok(item);
      assert.deepStrictEqual([item.streamId, item.eventType, item.type, item.repeatable], [ROOT, ET, 'composite', 'unlimited']);
      for (const t of [item.label, item.description]) assert.ok(t.en && t.fr && t.es);
      assert.deepStrictEqual(Object.keys(item.composite), ['given', 'family', 'use']);
      assert.deepStrictEqual(item.composite.use.options.map((o) => o.value), USES);
      for (const o of item.composite.use.options) assert.ok(o.label.en && o.label.fr && o.label.es, o.value);
      assert.strictEqual(item.fhir, undefined, 'Patient.name stays profile-name and profile-surname');
    });
  });

  for (const [flavour, make] of FLAVOURS) {
    describe(`[ONM-ET] ${ET}, ${flavour}`, () => {
      let validate;
      before(() => { validate = make().compile(eventTypesById(ET)); });

      it('[ONM-ET-1] accepts a given name, a family name, both, with or without each use', () => {
        for (const ok of [
          { family: 'MARTIN', use: 'maiden' },
          { given: 'Marie Anne' },
          { given: 'Marie', family: 'Dupont-Martin', use: 'official' },
          ...USES.map((use) => ({ family: 'X', use }))
        ]) {
          assert.ok(validate(ok), JSON.stringify(ok) + ' ' + JSON.stringify(validate.errors));
        }
      });

      it('[ONM-ET-2] refuses no name, an empty or long part, an unknown use, a free text, and extra fields', () => {
        for (const bad of [
          {},
          { use: 'usual' },
          { given: '' },
          { given: ' ' },
          { family: ' \t', use: 'maiden' },
          { family: '', use: 'old' },
          { family: 'x'.repeat(129) },
          { family: 'MARTIN', use: 'birth' },
          { family: 'MARTIN', use: 'temp' },
          { family: 'MARTIN', use: 'Maiden' },
          { family: 'MARTIN', text: 'Marie MARTIN' },
          { family: 'MARTIN', prefix: 'Dr' },
          { family: 'MARTIN', period: { end: '2019-06-01' } },
          { family: ['MARTIN'] },
          'Marie MARTIN',
          null
        ]) {
          assert.ok(!validate(bad), JSON.stringify(bad));
        }
      });
    });
  }

  describe('[ONM-SHAPE] shape, pinned', () => {
    it('[ONM-SHAPE-1] closed, one of given and family required, the FHIR use subset, in the portable subset', () => {
      const s = eventTypesById(ET);
      assert.strictEqual(s.additionalProperties, false);
      assert.deepStrictEqual(Object.keys(s.properties), ['given', 'family', 'use']);
      assert.deepStrictEqual(s.anyOf, [{ required: ['given'] }, { required: ['family'] }]);
      assert.deepStrictEqual(s.properties.use.enum, USES);
      assert.doesNotMatch(JSON.stringify(s), /"(if|then|else|const|not|\$ref)"/);
      for (const f of ['given', 'family']) assert.strictEqual(s.properties[f].pattern, '\\S', f + ': not blank');
    });
  });

  describe('[ONM-DOC] documentation', () => {
    it('[ONM-DOC-1] PROFILE.md, GENETICS.md and CONVERSATION.md name the root, the rule and the order before the first write', () => {
      const read = (f) => fs.readFileSync(path.join(__dirname, '../documentation', f), 'utf-8').replace(/\s+/g, ' ');
      const profile = read('PROFILE.md');
      assert.ok(profile.includes('## Other names (4.47.0)'));
      assert.ok(profile.includes('`{ streamId: \'other-names\', level: \'none\' }`'), 'the sweep before the first write');
      const [a, b, c] = ['**(a)**', '**(b)**', '**(c)**'].map((s) => profile.indexOf(s));
      assert.ok(a > 0 && a < b && b < c, 'minters, then the sweep, then the webapp');
      assert.ok(read('GENETICS.md').includes('**Five roots carry it:**'));
      const conv = read('CONVERSATION.md');
      assert.ok(conv.includes('`other-name` event of hers (`contact/other-name-v1`, on the `other-names` root'));
      assert.ok(conv.includes('A part that is empty after normalisation never matches.'));
    });
  });

  describe('[ONM-PACK] built pack.json', () => {
    let pack;
    before(() => {
      const packPath = path.join(__dirname, '../dist/pack.json');
      if (fs.existsSync(packPath)) pack = JSON.parse(fs.readFileSync(packPath, 'utf-8'));
    });

    it('[ONM-PACK-1] the pack carries the eventType, the item and the marked root', function () {
      if (!pack || !pack.items[KEY]) return this.skip(); // pack built before this change
      assert.ok(pack.eventTypes.types[ET]);
      assert.strictEqual(pack.items[KEY].streamId, ROOT);
      assert.strictEqual(pack.streams.find((r) => r.id === ROOT).explicitGrantOnly, true);
    });
  });
});
