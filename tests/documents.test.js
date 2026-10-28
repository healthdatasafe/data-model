const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const AjvDraft04 = require('ajv-draft-04');
const addFormats = require('ajv-formats');
const YAML = require('yaml');

// Medical documents (site-agents#23): a `documents` root and the eventType
// `file/xds-v1` carrying the XDS DocumentEntry metadata. Read markers for hds-webapp conversations:
// `settings/hds-webapp-read` on the webapp-settings app stream. See documentation/DOCUMENTS.md.

describe('[DOCS] Medical documents and read markers', () => {
  const { itemsById, findItemForEvent, checkItemVsEvenType } = require('../src/items');
  const { checkItem } = require('../src/schemas/items');
  const streams = require('../src/streams');
  const { eventTypesById } = require('../src/eventTypes');

  const coding = (code) => ({ system: 'http://snomed.info/sct', code });
  const minimal = () => ({ class: coding('371531000'), type: [coding('4241000179101')], title: 'Bilan sanguin', language: 'fr' });

  // The `document` item is canonical since 3.29.0; DOCUMENTS.md keeps its definition for writers' overloads, so it is
  // checked to stay identical to the published one.
  const planned = () => {
    const text = fs.readFileSync(path.join(__dirname, '../documentation/DOCUMENTS.md'), 'utf-8');
    const block = text.match(/```yaml\n([\s\S]*?)```/);
    assert.ok(block, 'DOCUMENTS.md carries the planned item');
    return YAML.parse(block[1]).document;
  };

  describe('[DOCS-ITM] item', () => {
    it('[DOCS-ITM-1] document is published (3.29.0), identical to its definition in DOCUMENTS.md, and resolves on documents', () => {
      const item = itemsById.document;
      assert.ok(item, 'document must exist');
      assert.deepStrictEqual(item, planned());
      assert.strictEqual(findItemForEvent('file/xds-v1', 'documents'), item);
    });

    it('[DOCS-ITM-2] the planned document item passes the item checks', () => {
      const item = planned();
      assert.doesNotThrow(() => checkItem(item, 'document'));
      assert.strictEqual(item.type, 'attachments');
      assert.strictEqual(item.streamId, 'documents');
      assert.strictEqual(item.eventType, 'file/xds-v1');
      assert.strictEqual(item.repeatable, 'any');
      assert.ok(item.label.fr && item.label.es && item.description.fr && item.description.es, 'label and description are localised');
      assert.strictEqual(checkItemVsEvenType('document', item, eventTypesById('file/xds-v1')), true);
    });

    it('[DOCS-ITM-3] an attachments item needs an eventType that requires an attachment', () => {
      const item = { ...planned(), eventType: 'note/txt' };
      assert.throws(() => checkItemVsEvenType('x', item, eventTypesById('note/txt')), /attachmentRequired/);
      assert.strictEqual(checkItemVsEvenType('x', { ...item, eventType: 'file/attached' }, eventTypesById('file/attached')), true);
    });

    it('[DOCS-ITM-4] attachments is an item type, not a composite field type', () => {
      const base = { label: { en: 'x' }, description: { en: 'x' }, streamId: 'documents', eventType: 'file/xds-v1', version: 'v1', repeatable: 'any' };
      assert.doesNotThrow(() => checkItem({ ...base, type: 'attachments' }, 'x'));
      assert.throws(() => checkItem({
        ...base,
        type: 'composite',
        composite: { scan: { label: { en: 'Scan' }, type: 'attachments' } }
      }, 'x'));
    });
  });

  describe('[DOCS-STR] stream', () => {
    it('[DOCS-STR-1] documents is a root with no children', () => {
      const root = streams.streamsById.documents;
      assert.ok(root, 'documents must exist');
      assert.strictEqual(root.parentId, null);
      assert.ok(streams.roots.find((r) => r.id === 'documents'));
      assert.ok(!root.children || root.children.length === 0);
    });
  });

  for (const [flavour, make] of [
    ['draft-04 (the cores)', () => new AjvDraft04({ strict: false, allErrors: true, coerceTypes: false, validateFormats: true, logger: false })],
    ['draft-07', () => new Ajv({ strict: false, allErrors: true, coerceTypes: false, logger: false })]
  ]) {
    describe(`[DOCS-ET] file/xds-v1 under ${flavour}`, () => {
      let validate;

      before(() => {
        const ajv = make();
        addFormats(ajv);
        validate = ajv.compile(eventTypesById('file/xds-v1'));
      });

      it('[DOCS-ET-1] accepts a minimal and a full document', () => {
        assert.ok(validate(minimal()), JSON.stringify(validate.errors));
        assert.ok(validate({
          ...minimal(),
          type: [coding('4241000179101'), { ...coding('371531000'), display: 'second coding' }],
          creation: '2026-10',
          status: 'current',
          supersedes: ['ckabc123'],
          // Shapes only: any coding fits each slot here, so the fixtures reuse the two codes above.
          authors: [{ name: 'Dr A. Martin', organization: 'Laboratoire Central', service: 'Hématologie', role: coding('371531000') }, { eventId: 'ckprov1' }],
          encounterId: 'ckenc1',
          practiceSetting: coding('371531000'),
          facilityType: coding('371531000'),
          format: coding('4241000179101'),
          event: [coding('4241000179101')],
          pages: 3
        }), JSON.stringify(validate.errors));
        for (const creation of ['2026', '2026-10-28', '2026-10-28T09:30Z', '2026-10-28T09:30:00Z', '2026-10-28T09:30:00.5+01:00']) {
          assert.ok(validate({ ...minimal(), creation }), creation);
        }
        for (const language of ['fr', 'de-CH', 'gsw', 'zh-Hant-TW', 'und']) {
          assert.ok(validate({ ...minimal(), language }), language);
        }
      });

      it('[DOCS-ET-2] rejects a missing required field and extra fields', () => {
        for (const field of ['class', 'type', 'title', 'language']) {
          const doc = minimal();
          delete doc[field];
          assert.ok(!validate(doc), `without ${field}`);
        }
        assert.ok(!validate({ ...minimal(), hdsScan: true }), 'no extra top-level field');
        assert.ok(!validate({ ...minimal(), class: { ...coding('371531000'), note: 'x' } }), 'no extra coding field');
        assert.ok(!validate({ ...minimal(), authors: [{ name: 'x', phone: '000' }] }), 'no extra author field');
        assert.ok(!validate({ ...minimal(), authors: [{}] }), 'an author needs a field');
      });

      it('[DOCS-ET-3] codings, title, dates and counts are constrained', () => {
        assert.ok(!validate({ ...minimal(), type: [] }), 'type needs one coding');
        assert.ok(!validate({ ...minimal(), class: [coding('371531000')] }), 'class is one coding');
        assert.ok(!validate({ ...minimal(), class: { system: 'http://snomed.info/sct' } }), 'a coding needs a code');
        assert.ok(!validate({ ...minimal(), class: { system: 'SNOMED-CT', code: '371531000' } }), 'a coding system is a URI');
        assert.ok(validate({ ...minimal(), class: { system: 'urn:oid:2.16.840.1.113883.6.96', code: '371531000' } }), 'an OID URN is a URI');
        assert.ok(validate({ ...minimal(), class: { ...coding('371531000'), version: 'http://snomed.info/sct/2011000195101' } }), 'a coding may name its version');
        assert.ok(!validate({ ...minimal(), class: { code: '371531000' } }), 'a coding needs a system');
        assert.ok(!validate({ ...minimal(), title: '' }), 'title not empty');
        assert.ok(!validate({ ...minimal(), status: 'deprecated' }), 'status enum');
        assert.ok(!validate({ ...minimal(), pages: 0 }), 'pages >= 1');
        assert.ok(!validate({ ...minimal(), pages: 2.5 }), 'pages is an integer');
        for (const creation of ['28.10.2026', 'October 2026', '2026-1', '2026-10-28T09:30', '2026-10-28T:::', '2026-13-45', '2026-10-28T25:00Z']) {
          assert.ok(!validate({ ...minimal(), creation }), creation);
        }
        for (const language of ['french', 'f', 'fr_CH']) {
          assert.ok(!validate({ ...minimal(), language }), language);
        }
      });
    });
  }

  it('[DOCS-ET-4] file/xds-v1 requires an attachment and uses no if/then (the cores compile draft-04)', () => {
    const type = eventTypesById('file/xds-v1');
    assert.strictEqual(type.attachmentRequired, true);
    assert.ok(!/"(if|then|else|const)"/.test(JSON.stringify(type)));
  });

  describe('[DOCS-READ] settings/hds-webapp-read', () => {
    let validate;

    before(() => {
      const ajv = new AjvDraft04({ strict: false, allErrors: true, coerceTypes: false, logger: false });
      validate = ajv.compile(eventTypesById('settings/hds-webapp-read'));
    });

    it('[DOCS-READ-1] holds a last-read time per contact id', () => {
      assert.ok(validate({}));
      assert.ok(validate({ v: 1, lastRead: { drandy: 1761645600.5, ckaccess123: 0 } }), JSON.stringify(validate.errors));
      assert.ok(!validate({ lastRead: { drandy: '2026-10-28' } }), 'a time is a number');
      assert.ok(!validate({ lastRead: { drandy: -1 } }), 'a time is not negative');
      assert.ok(!validate({ lastRead: [] }), 'lastRead is a map');
    });

    it('[DOCS-READ-2] is declared on the webapp-settings app stream notes', () => {
      const text = fs.readFileSync(path.join(__dirname, '../definitions/appStreams.yaml'), 'utf-8');
      assert.ok(text.includes('settings/hds-webapp-read'));
    });
  });

  describe('[DOCS-PACK] built pack.json', () => {
    let pack;

    before(() => {
      const packPath = path.join(__dirname, '../dist/pack.json');
      if (!fs.existsSync(packPath)) return; // npm run build has not run yet
      pack = JSON.parse(fs.readFileSync(packPath, 'utf-8'));
    });

    it('[DOCS-PACK-1] the pack carries the stream, the eventTypes and the item', function () {
      if (!pack || !pack.eventTypes.types['file/xds-v1']) return this.skip(); // pack built before this change
      assert.strictEqual(pack.items.document?.type, 'attachments');
      assert.ok(pack.streams.find((r) => r.id === 'documents'), 'documents root in pack');
      assert.ok(pack.eventTypes.types['file/xds-v1']);
      assert.ok(pack.eventTypes.types['settings/hds-webapp-read']);
    });
  });
});
