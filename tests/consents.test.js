const assert = require('assert');
const fs = require('fs');
const path = require('path');
const AjvDraft04 = require('ajv-draft-04');
const addFormats = require('ajv-formats');

// Account-level consent record (plan 91): one `system` item on a `consents` root, one closed,
// append-only eventType. See documentation/CONSENTS.md.

describe('[CONS] Consent record — consents (plan 91)', () => {
  const { itemsById, findItemForEvent, checkItemVsEvenType } = require('../src/items');
  const streams = require('../src/streams');
  const { eventTypesById } = require('../src/eventTypes');

  describe('[CONS-ITM] item', () => {
    it('[CONS-ITM-1] consent-record loads as an unlimited system item on its own root', () => {
      const item = itemsById['consent-record'];
      assert.ok(item, 'consent-record must exist');
      assert.strictEqual(item.type, 'system');
      assert.strictEqual(item.streamId, 'consents');
      assert.strictEqual(item.eventType, 'consent/record-v1');
      assert.strictEqual(item.repeatable, 'unlimited');
      assert.ok(item.label.fr && item.label.es && item.description.fr && item.description.es, 'label and description are localised');
      assert.strictEqual(checkItemVsEvenType('consent-record', item, eventTypesById('consent/record-v1')), true);
    });

    it('[CONS-ITM-2] an event on consents resolves to consent-record', () => {
      assert.strictEqual(findItemForEvent('consent/record-v1', 'consents'), itemsById['consent-record']);
    });
  });

  describe('[CONS-STR] stream', () => {
    it('[CONS-STR-1] consents is a root with no children', () => {
      const root = streams.streamsById.consents;
      assert.ok(root, 'consents must exist');
      assert.strictEqual(root.parentId, null);
      assert.ok(streams.roots.find((r) => r.id === 'consents'));
      assert.ok(!root.children || root.children.length === 0);
    });
  });

  describe('[CONS-ET] consent/record-v1', () => {
    let validate;

    before(() => {
      // Validate under the cores' flavour (ajv-draft-04): the schema must stay in the portable subset.
      const ajv = new AjvDraft04({ strict: false, allErrors: true, coerceTypes: false, validateFormats: true, logger: false });
      addFormats(ajv);
      validate = ajv.compile(eventTypesById('consent/record-v1'));
    });

    it('[CONS-ET-1] accepts a minimal and a full record', () => {
      assert.ok(validate({ documentId: 'health-processing', version: '1.0', action: 'given' }), JSON.stringify(validate.errors));
      assert.ok(validate({
        documentId: 'us-chd-consent',
        version: '1.0',
        action: 'given',
        locale: 'en-US',
        url: 'https://www.healthdatasafe.org/users/us-consumer-health-data-consent/',
        residence: { country: 'US', state: 'WA' },
        surface: 'sign-in',
        method: 'checkbox'
      }), JSON.stringify(validate.errors));
      for (const action of ['given', 'withdrawn', 'acknowledged', 'lapsed']) {
        assert.ok(validate({ documentId: 'privacy', version: '2.0.1', action }), action);
      }
      assert.ok(validate({ documentId: 'terms', version: '3', action: 'given', residence: { country: 'other' } }));
    });

    it('[CONS-ET-2] rejects a missing required field, an unknown action and extra fields', () => {
      assert.ok(!validate({ version: '1.0', action: 'given' }));
      assert.ok(!validate({ documentId: 'terms', action: 'given' }));
      assert.ok(!validate({ documentId: 'terms', version: '1.0' }));
      assert.ok(!validate({ documentId: 'terms', version: '1.0', action: 'declined' }));
      assert.ok(!validate({ documentId: 'terms', version: '1.0', action: 'given', note: 'free text' }));
      assert.ok(!validate({ documentId: 'terms', version: '1.0', action: 'given', surface: 'support' }));
      assert.ok(!validate({ documentId: 'terms', version: '1.0', action: 'given', surface: 're-consent' }));
      for (const surface of ['signup', 'sign-in', 'center']) {
        assert.ok(validate({ documentId: 'terms', version: '1.0', action: 'given', surface }), surface);
      }
    });

    it('[CONS-ET-3] identifiers and versions are constrained, never free text', () => {
      for (const documentId of ['Terms', 'terms of use', '-terms', 'a'.repeat(65), '']) {
        assert.ok(!validate({ documentId, version: '1.0', action: 'given' }), `documentId ${JSON.stringify(documentId)}`);
      }
      for (const version of ['v1', '1.0.0.0', '1.0-beta', '', 'latest']) {
        assert.ok(!validate({ documentId: 'terms', version, action: 'given' }), `version ${JSON.stringify(version)}`);
      }
      assert.ok(!validate({ documentId: 'terms', version: '1.0', action: 'given', url: 'www.healthdatasafe.org/users/terms/' }), 'url needs a scheme');
      for (const locale of ['EN', 'english', 'en_US', 'fr-ch']) {
        assert.ok(!validate({ documentId: 'terms', version: '1.0', action: 'given', locale }), `locale ${JSON.stringify(locale)}`);
      }
    });

    it('[CONS-ET-4] residence distinguishes only the United States, with a two-letter state', () => {
      const base = { documentId: 'us-chd-consent', version: '1.0', action: 'given' };
      assert.ok(!validate({ ...base, residence: {} }));
      assert.ok(!validate({ ...base, residence: { country: 'FR' } }));
      assert.ok(!validate({ ...base, residence: { country: 'US', state: 'Washington' } }));
      assert.ok(!validate({ ...base, residence: { country: 'US', state: 'wa' } }));
      assert.ok(!validate({ ...base, residence: { country: 'US', state: 'WA', city: 'Seattle' } }));
    });

    it('[CONS-ET-5] uses no if/then (the cores compile draft-04)', () => {
      const text = JSON.stringify(eventTypesById('consent/record-v1'));
      assert.ok(!/"(if|then|else)"/.test(text));
    });
  });

  describe('[CONS-PACK] built pack.json', () => {
    let pack;

    before(() => {
      const packPath = path.join(__dirname, '../dist/pack.json');
      if (!fs.existsSync(packPath)) return; // npm run build has not run yet
      pack = JSON.parse(fs.readFileSync(packPath, 'utf-8'));
    });

    it('[CONS-PACK-1] the pack carries the item, the stream and the eventType', () => {
      if (!pack) return;
      assert.strictEqual(pack.items['consent-record']?.type, 'system');
      assert.ok(pack.streams.find((r) => r.id === 'consents'), 'consents root in pack');
      assert.ok(pack.eventTypes.types['consent/record-v1']);
    });
  });
});
