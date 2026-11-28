const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const AjvDraft04 = require('ajv-draft-04');

// A professional's correction of one entry (4.43.0): the `entry-corrections` root, its `corr-` children resolved to
// it, the `type: system` item `entry-correction`, `correction/entry-v1` and the vocabulary `professional-role`.
// See documentation/CORRECTIONS.md.

describe('[COR] corrections of an entry', () => {
  const { itemsById, findItemForEvent, checkItemVsEvenType } = require('../src/items');
  const { checkItem } = require('../src/schemas/items');
  const streams = require('../src/streams');
  const { eventTypesById } = require('../src/eventTypes');
  const { vocabulariesById, resolveEnum } = require('../src/vocabularies');
  // the es texts are in definitions/l10n/es.json, each with its review mark (B-2026-11-28-9)
  const es = (file, at) => require('../src/l10n').loadLocales().locales.es[file]?.[at]?.text;

  const TYPE = 'correction/entry-v1';
  const ROOT = 'entry-corrections';
  const ITEM = 'entry-correction';
  const CHILD = 'corr-4k2m9x0q7a1b';
  const ROLES = ['physician', 'midwife', 'nurse', 'pharmacist', 'psychologist', 'dietitian', 'physiotherapist', 'health-educator', 'other'];
  // verified active in reference/snomed-db, International 20260201
  const SNOMED = {
    physician: '309343006',
    midwife: '309453006',
    nurse: '106292003',
    pharmacist: '46255001',
    psychologist: '59944000',
    dietitian: '159033005',
    physiotherapist: '36682004',
    'health-educator': '409974004'
  };

  describe('[COR-STR] the root and its children', () => {
    it('[COR-STR-1] is a root, not explicitGrantOnly, with no children in the model, named for consent screens', () => {
      const root = streams.streamsById[ROOT];
      assert.ok(root);
      assert.strictEqual(root.parentId, null);
      assert.strictEqual(root.explicitGrantOnly, undefined);
      assert.ok(!root.children || root.children.length === 0);
      assert.ok(root.label.en && root.label.fr && es('streamsTree.json', `[id="${ROOT}"]/label`));
      assert.ok(root.description.en && root.description.fr && es('streamsTree.json', `[id="${ROOT}"]/description`));
    });

    it('[COR-STR-2] no model stream is named like a child', () => {
      for (const id of Object.keys(streams.streamsById)) assert.ok(!/^corr-/.test(id), id);
    });
  });

  describe('[COR-ITM] the item', () => {
    it('[COR-ITM-1] entry-correction: system, on the root, correction/entry-v1', () => {
      const item = itemsById[ITEM];
      assert.doesNotThrow(() => checkItem(item, ITEM));
      assert.strictEqual(item.type, 'system');
      assert.strictEqual(item.streamId, ROOT);
      assert.strictEqual(item.eventType, TYPE);
      assert.strictEqual(item.repeatable, 'unlimited');
      assert.ok(item.label.fr && item.description.fr && es('items.json', `${ITEM}/label`) && es('items.json', `${ITEM}/description`));
      assert.strictEqual(checkItemVsEvenType(ITEM, item, eventTypesById(TYPE)), true);
      assert.strictEqual(item.fhir, undefined, 'not exported');
    });

    it('[COR-ITM-2] a corr- child resolves to the item; nothing else does', () => {
      assert.strictEqual(findItemForEvent(TYPE, ROOT), itemsById[ITEM]);
      assert.strictEqual(findItemForEvent(TYPE, CHILD), itemsById[ITEM]);
      for (const id of ['corr-4K2M9X0Q7A1B', 'corr-4k2m9x0q7a1', 'corr-4k2m9x0q7a1bc', 'share-4k2m9x0q7a1b', 'my-app-corrections', 'xcorr-4k2m9x0q7a1b']) {
        assert.strictEqual(findItemForEvent(TYPE, id), null, id);
      }
      assert.strictEqual(findItemForEvent('note/txt', CHILD), null, 'another type on a child');
    });

    it('[COR-ITM-4] the itemKey and corrected.type patterns take every item key and eventType of the pack, as a proposal does', () => {
      const props = eventTypesById(TYPE).properties;
      const keyRe = new RegExp(props.itemKey.pattern);
      const typeRe = new RegExp(props.corrected.properties.type.pattern);
      for (const key of Object.keys(itemsById)) assert.ok(keyRe.test(key) && key.length <= props.itemKey.maxLength, key);
      for (const item of Object.values(itemsById)) {
        const types = item.eventType ? [item.eventType] : item.variations.eventType.options.map((o) => o.value);
        for (const t of types) assert.ok(typeRe.test(t), `${item.key ?? ''} ${t}`);
      }
      const proposal = eventTypesById('message/hds-conversation-v1').oneOf.find((k) => k.properties?.proposal?.properties?.itemKey).properties.proposal;
      assert.strictEqual(props.itemKey.pattern, proposal.properties.itemKey.pattern);
      assert.strictEqual(props.corrected.properties.type.pattern, proposal.properties.type.pattern);
    });

    it('[COR-ITM-3] the only item on correction/entry-v1', () => {
      const on = Object.entries(itemsById).filter(([, i]) => i.eventType === TYPE || (i.variations?.eventType?.options || []).some((o) => o.value === TYPE));
      assert.deepStrictEqual(on.map(([k]) => k), [ITEM]);
    });
  });

  describe('[COR-VOC] the author\'s role', () => {
    it('[COR-VOC-1] professional-role labels the enum, in order, with SNOMED CT occupations', () => {
      const voc = vocabulariesById['professional-role'];
      assert.ok(voc);
      assert.deepStrictEqual(voc.binds, [{ eventType: TYPE, path: 'authorRole' }]);
      assert.deepStrictEqual(Object.keys(voc.values), ROLES);
      assert.deepStrictEqual(resolveEnum(TYPE, 'authorRole'), ROLES);
      for (const role of ROLES) {
        const v = voc.values[role];
        assert.ok(v.label.en && v.label.fr && es('vocabularies.json', `professional-role/values/${role}/label`), role);
        assert.strictEqual(v.snomed, SNOMED[role], role);
      }
      assert.strictEqual(voc.values.other.label.en, 'Other', 'neutral: also the label of an unknown role');
    });
  });

  const base = () => ({
    kind: 'change',
    authorRole: 'health-educator',
    itemKey: 'body-vulva-bleeding',
    entryId: 'ckq3w8n1x0042',
    entryModified: 1773320000.5,
    corrected: { type: 'ratio/proportion', content: 0 },
    comment: 'No bleeding on this day: the **stamp** on your photo is green.',
    about: 'ckq3w8n1x0001',
    replaces: 'ckq3w8n1x0099'
  });

  for (const [flavour, make] of [
    ['draft-04 (the cores)', () => new AjvDraft04({ strict: false, allErrors: true, coerceTypes: false, logger: false })],
    ['draft-07', () => new Ajv({ strict: false, allErrors: true, coerceTypes: false, logger: false })]
  ]) {
    describe(`[COR-ET] correction/entry-v1 under ${flavour}`, () => {
      let validate;
      before(() => { validate = make().compile(eventTypesById(TYPE)); });
      const ok = (c, why) => assert.ok(validate(c), `${why}: ${JSON.stringify(validate.errors)}`);
      const ko = (c, why) => assert.ok(!validate(c), `${why}: accepted`);

      it('[COR-ET-1] the three kinds', () => {
        ok(base(), 'a full change');
        ok({ kind: 'change', authorRole: 'physician', itemKey: 'body-weight', entryId: 'e1', entryModified: 1, corrected: { time: 1773316800, clientData: { hdsTimePrecision: 'day' } } }, 'a change of day only');
        ok({ kind: 'add', authorRole: 'midwife', itemKey: 'fertility-cycles-start', corrected: { type: 'activity/plain', content: null } }, 'an add');
        ok({ kind: 'remove', authorRole: 'other', itemKey: 'body-vulva-bleeding', entryId: 'e1', entryModified: 1 }, 'a remove');
      });

      it('[COR-ET-2] closed, and the required fields', () => {
        ko({ ...base(), original: 3 }, 'an unknown field');
        for (const f of ['kind', 'authorRole', 'itemKey']) {
          const c = base();
          delete c[f];
          ko(c, `without ${f}`);
        }
        ko({ ...base(), kind: 'replace' }, 'an unknown kind');
        ko({ ...base(), authorRole: 'teacher' }, 'an unknown role');
        ko({ ...base(), itemKey: 'Body_Weight' }, 'an item key out of pattern');
      });

      it('[COR-ET-3] ids are query paths', () => {
        for (const f of ['entryId', 'about', 'replaces']) {
          ko({ ...base(), [f]: 'a.b' }, `${f} with a dot`);
          ko({ ...base(), [f]: '' }, `${f} empty`);
        }
      });

      it('[COR-ET-4] corrected: type and content together, a closed clientData', () => {
        ko({ ...base(), corrected: { type: 'ratio/proportion' } }, 'a type without content');
        ko({ ...base(), corrected: { content: 0 } }, 'a content without type');
        ko({ ...base(), corrected: {} }, 'empty');
        ko({ ...base(), corrected: { clientData: { hdsBasis: 'manual' } } }, 'a clientData with neither type nor time');
        ko({ ...base(), corrected: { time: 1, clientData: {} } }, 'an empty clientData');
        ko({ ...base(), corrected: { time: 1, clientData: { hdsRefRange: { text: 'x' } } } }, 'a clientData key it does not hold');
        ko({ ...base(), corrected: { time: 1, clientData: { hdsTimePrecision: 'approx' } } }, 'an approx precision (needs hdsTimeText)');
        ok({ ...base(), corrected: { type: 'ratio/proportion', content: 0.5, clientData: { hdsComparator: '>' } } }, 'a comparator');
        ok({ ...base(), corrected: { type: 'temperature/c', content: 36.6, clientData: { hdsBasis: 'manual' } } }, 'a basis');
      });

      it('[COR-ET-5] comment: 1 to 4000 characters', () => {
        ko({ ...base(), comment: '' }, 'empty');
        ok({ ...base(), comment: 'x'.repeat(4000) }, '4000');
        ko({ ...base(), comment: 'x'.repeat(4001) }, '4001');
      });
    });
  }

  describe('[COR-DOC] the documentation', () => {
    const doc = fs.readFileSync(path.join(__dirname, '../documentation/CORRECTIONS.md'), 'utf8');
    const prov = fs.readFileSync(path.join(__dirname, '../documentation/PROVENANCE.md'), 'utf8');

    it('[COR-DOC-1] lists every role with its code, and indexes the two clientData keys', () => {
      for (const role of ROLES) assert.ok(doc.includes('`' + role + '`'), role);
      for (const code of Object.values(SNOMED)) assert.ok(doc.includes(code), code);
      assert.ok(prov.includes('`clientData.hdsEntryCorrections`'));
      assert.ok(prov.includes('`clientData.hdsTextFormat`'));
      assert.ok(prov.includes('`correction/entry-v1` `entryId`, `about` and `replaces`'), 'the related mirror list');
    });
  });
});
