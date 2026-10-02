const assert = require('assert');
const fs = require('fs');
const path = require('path');
const AjvDraft04 = require('ajv-draft-04');
const addFormats = require('ajv-formats');

// Connector status (site-agents#19): one `system` item on a `sync-status` root, one
// `role: context` leaf per connector, one closed eventType. See documentation/SYNC-STATUS.md.

const LEAVES = [
  'sync-status-mira',
  'sync-status-tempdrop',
  'sync-status-femm',
  'sync-status-ryb',
  'sync-status-cyclefeminin',
  'sync-status-healthkit'
];

describe('[SYNC] Connector status — sync-status (site-agents#19)', () => {
  const { itemsById, findItemForEvent, checkItemVsEvenType } = require('../src/items');
  const streams = require('../src/streams');
  const { eventTypesById } = require('../src/eventTypes');
  const { checkItem } = require('../src/schemas/items');

  describe('[SYNC-ITM] item', () => {
    it('[SYNC-ITM-1] sync-status loads as a system item on its own root', () => {
      const item = itemsById['sync-status'];
      assert.ok(item, 'sync-status must exist');
      assert.strictEqual(item.type, 'system');
      assert.strictEqual(item.streamId, 'sync-status');
      assert.strictEqual(item.eventType, 'sync-status/connector-v1');
      assert.strictEqual(item.repeatable, 'once');
      assert.ok(item.label.fr && item.description.fr, 'label and description are localised');
    });

    it('[SYNC-ITM-2] a system item over a non-object eventType is rejected', () => {
      const item = { type: 'system' };
      for (const eventType of [{ type: 'string' }, { type: 'number' }, { type: 'array', items: {} }]) {
        assert.throws(
          () => checkItemVsEvenType('bad-system', item, eventType),
          /type "system" the matching eventType must be an "object"/
        );
      }
    });

    it('[SYNC-ITM-3] a system item over an object eventType passes', () => {
      const item = itemsById['sync-status'];
      assert.strictEqual(checkItemVsEvenType('sync-status', item, eventTypesById('sync-status/connector-v1')), true);
    });

    it('[SYNC-ITM-4] `system` is an item type but never a composite field type', () => {
      const base = {
        version: 'v1',
        label: { en: 'Test' },
        description: { en: 'Test' },
        streamId: 'test-stream',
        eventType: 'test/object',
        repeatable: 'once'
      };
      checkItem({ ...base, type: 'system' });
      assert.throws(() => checkItem({
        ...base,
        type: 'composite',
        composite: { status: { label: { en: 'Status' }, type: 'system' } }
      }));
    });
  });

  describe('[SYNC-STR] streams', () => {
    it('[SYNC-STR-1] sync-status is a root', () => {
      assert.ok(streams.roots.find((r) => r.id === 'sync-status'), 'sync-status must be a root');
      assert.strictEqual(streams.streamsById['sync-status'].parentId, null);
    });

    it('[SYNC-STR-2] one context leaf per catalogue connector, and nothing else', () => {
      const root = streams.streamsById['sync-status'];
      assert.deepStrictEqual(root.children.map((c) => c.id), LEAVES);
      for (const leaf of root.children) {
        assert.strictEqual(leaf.role, 'context', `${leaf.id} must be role: context`);
        assert.strictEqual(leaf.parentId, 'sync-status');
        assert.ok(!leaf.children, `${leaf.id} must be a leaf`);
        // The leaf name is what a consent screen shows when an app requests that leaf alone,
        // so it must make sense without its parent.
        assert.match(leaf.name, / connection status$/, `${leaf.id} name must stand alone`);
      }
    });

    it('[SYNC-STR-3] every leaf resolves to the sync-status item (D3 walk-up)', () => {
      for (const leaf of LEAVES) {
        const item = findItemForEvent('sync-status/connector-v1', leaf);
        assert.ok(item, `${leaf} must resolve`);
        assert.strictEqual(item, itemsById['sync-status']);
      }
    });
  });

  describe('[SYNC-ET] sync-status/connector-v1', () => {
    let validate;

    before(() => {
      // Validate under the cores' flavour (ajv-draft-04): the schema must stay in the portable subset.
      const ajv = new AjvDraft04({ strict: false, allErrors: true, coerceTypes: false, validateFormats: true, logger: false });
      addFormats(ajv);
      validate = ajv.compile(eventTypesById('sync-status/connector-v1'));
    });

    it('[SYNC-ET-1] accepts a minimal and a full status', () => {
      assert.ok(validate({ status: 'active' }), JSON.stringify(validate.errors));
      assert.ok(validate({
        status: 'error',
        connectedAt: 1759300000,
        lastRunAt: 1759390000,
        lastSuccessAt: 1759380000,
        syncedUntil: 1759379000,
        lastError: { class: 'upstream', code: 'mira-http-503', at: 1759390000 }
      }), JSON.stringify(validate.errors));
      for (const status of ['active', 'needs-reauth', 'error', 'disconnected']) {
        assert.ok(validate({ status }), status);
      }
    });

    it('[SYNC-ET-2] rejects an unknown status, a missing status and extra fields', () => {
      assert.ok(!validate({ status: 'paused' }));
      assert.ok(!validate({}));
      assert.ok(!validate({ status: 'active', note: 'free text' }));
      assert.ok(!validate({ status: 'error', lastError: { class: 'auth', at: 1, message: 'x' } }));
    });

    it('[SYNC-ET-3] lastError needs class and at, and code is an operator code, never partner text', () => {
      assert.ok(!validate({ status: 'error', lastError: { class: 'auth' } }));
      assert.ok(!validate({ status: 'error', lastError: { class: 'network', at: 1 } }));
      for (const code of ['Token expired', 'HTTP_401', '-leading-dash', 'a'.repeat(65), '']) {
        assert.ok(!validate({ status: 'error', lastError: { class: 'auth', code, at: 1 } }), `code ${JSON.stringify(code)} must be rejected`);
      }
      assert.ok(validate({ status: 'error', lastError: { class: 'auth', code: 'a'.repeat(64), at: 1 } }));
    });

    it('[SYNC-ET-4] uses no if/then (the cores compile draft-04)', () => {
      const text = JSON.stringify(eventTypesById('sync-status/connector-v1'));
      assert.ok(!/"(if|then|else)"/.test(text));
    });

    it('[SYNC-ET-5] sync-status/bridge stays open and points at the new type', () => {
      const bridge = eventTypesById('sync-status/bridge');
      assert.ok(bridge);
      assert.strictEqual(bridge.additionalProperties, undefined);
      assert.match(bridge.description, /sync-status\/connector-v1/);
    });
  });

  describe('[SYNC-PACK] built pack.json', () => {
    let pack;

    before(() => {
      const packPath = path.join(__dirname, '../dist/pack.json');
      if (!fs.existsSync(packPath)) return; // npm run build has not run yet
      pack = JSON.parse(fs.readFileSync(packPath, 'utf-8'));
    });

    it('[SYNC-PACK-1] the pack carries the item, the stream tree and the eventType', () => {
      if (!pack) return;
      assert.strictEqual(pack.items['sync-status']?.type, 'system');
      const root = pack.streams.find((r) => r.id === 'sync-status');
      assert.ok(root, 'sync-status root in pack');
      assert.deepStrictEqual(root.children.map((c) => c.id), LEAVES);
      assert.ok(pack.eventTypes.types['sync-status/connector-v1']);
    });
  });
});
