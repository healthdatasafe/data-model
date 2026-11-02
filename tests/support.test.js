const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const AjvDraft04 = require('ajv-draft-04');
const addFormats = require('ajv-formats');

// HDS support channel (plan 117): the `hds-support` consent anchor on the person's account, and the
// conversation state on the group's account. See documentation/SUPPORT.md.

describe('[SUPP] Support channel (plan 117)', () => {
  const { itemsById } = require('../src/items');
  const streams = require('../src/streams');
  const { eventTypesById } = require('../src/eventTypes');

  describe('[SUPP-STR] hds-support', () => {
    it('[SUPP-STR-1] hds-support is a root with no children and no item', () => {
      const root = streams.streamsById['hds-support'];
      assert.ok(root, 'hds-support must exist');
      assert.strictEqual(root.parentId, null);
      assert.ok(streams.roots.find((r) => r.id === 'hds-support'));
      assert.ok(!root.children || root.children.length === 0);
      const on = Object.entries(itemsById).filter(([, i]) => i.streamId === 'hds-support').map(([k]) => k);
      assert.deepStrictEqual(on, [], 'no item on hds-support');
    });

    it('[SUPP-STR-2] its names say, in en and fr, that it holds no data', () => {
      const root = streams.streamsById['hds-support'];
      assert.match(root.name, /no data/);
      assert.match(root.label.en, /no data/);
      assert.match(root.label.fr, /aucune donnée/);
      assert.match(root.description.en, /none of your data/);
      assert.match(root.description.fr, /aucune de vos données/);
    });

    it('[SUPP-STR-3] the loader checks localised stream names: { en, fr } non-empty, label.en is name', () => {
      const { checkLocalisedNames } = streams;
      const ok = { id: 's', name: 'Name', label: { en: 'Name', fr: 'Nom' }, description: { en: 'D', fr: 'D' } };
      assert.doesNotThrow(() => checkLocalisedNames(ok));
      assert.doesNotThrow(() => checkLocalisedNames({ id: 's', name: 'Name' }), 'both are optional');
      assert.throws(() => checkLocalisedNames({ ...ok, label: 'Name' }), /label must be an object/);
      assert.throws(() => checkLocalisedNames({ ...ok, label: null }), /label must be an object/);
      assert.throws(() => checkLocalisedNames({ ...ok, label: { en: 'Name' } }), /label\.fr/);
      assert.throws(() => checkLocalisedNames({ ...ok, description: { en: '', fr: 'D' } }), /description\.en/);
      assert.throws(() => checkLocalisedNames({ ...ok, label: { en: 'Other', fr: 'Nom' } }), /label\.en must equal name/);
      assert.doesNotThrow(() => checkLocalisedNames(streams.streamsById['hds-support']));
    });
  });

  for (const [flavour, make] of [
    ['draft-04 (the cores)', () => new AjvDraft04({ strict: false, allErrors: true, coerceTypes: false, validateFormats: true, logger: false })],
    ['draft-07', () => new Ajv({ strict: false, allErrors: true, coerceTypes: false, logger: false })]
  ]) {
    describe(`[SUPP-ET] support/conversation-v1, ${flavour}`, () => {
      let validate;
      const claim = { membershipAccessId: 'cmhxyz0000000abcdefghijk', username: 'alice', host: 'ch1.datasafe.dev', displayName: 'Alice', at: 1793000000.1 };

      before(() => {
        const ajv = make();
        addFormats(ajv);
        validate = ajv.compile(eventTypesById('support/conversation-v1'));
      });

      it('[SUPP-ET-1] accepts a minimal and a full state', () => {
        assert.ok(validate({ userSlug: 'bob--us1-datasafe-dev', status: 'new' }), JSON.stringify(validate.errors));
        for (const status of ['new', 'open', 'closed']) {
          assert.ok(validate({ userSlug: 'bob--us1-datasafe-dev', status }), status);
        }
        assert.ok(validate({
          userSlug: 'bob-2--ch1-backloop-dev',
          status: 'open',
          claimedBy: claim,
          notify: { consentAt: 1793000000 }
        }), JSON.stringify(validate.errors));
        assert.ok(validate({ userSlug: 'bob--us1-datasafe-dev', status: 'open', notify: { consentAt: 1793000000, sentAt: 1793000100 } }), JSON.stringify(validate.errors));
        assert.ok(validate({ userSlug: 'bob--us1-datasafe-dev', status: 'open', claimedBy: { ...claim, displayName: 'A'.repeat(40) } }), '40 characters');
        const { displayName, ...noName } = claim;
        assert.ok(validate({ userSlug: 'bob--us1-datasafe-dev', status: 'open', claimedBy: { ...noName, host: 'demo.backloop.dev:4443' } }), JSON.stringify(validate.errors));
      });

      it('[SUPP-ET-2] rejects a missing required field, an unknown status and extra fields', () => {
        assert.ok(!validate({ status: 'new' }));
        assert.ok(!validate({ userSlug: 'bob--us1-datasafe-dev' }));
        assert.ok(!validate({ userSlug: 'bob--us1-datasafe-dev', status: 'pending' }));
        assert.ok(!validate({ userSlug: 'bob--us1-datasafe-dev', status: 'new', note: 'free text' }));
        assert.ok(!validate({ userSlug: 'bob--us1-datasafe-dev', status: 'new', claimedBy: { ...claim, role: 'lead' } }));
        assert.ok(!validate({ userSlug: 'bob--us1-datasafe-dev', status: 'new', claimedBy: null }), 'a released claim is absent, not null');
        assert.ok(!validate({ userSlug: 'bob--us1-datasafe-dev', status: 'new', locale: 'fr' }), 'no locale in v1');
        for (const key of ['membershipAccessId', 'username', 'host', 'at']) {
          const { [key]: _, ...partial } = claim;
          assert.ok(!validate({ userSlug: 'bob--us1-datasafe-dev', status: 'open', claimedBy: partial }), 'claimedBy without ' + key);
        }
      });

      it('[SUPP-ET-3] the slug, the display name and the account identifiers are constrained', () => {
        for (const userSlug of ['bob', 'Bob--us1-datasafe-dev', 'bob--us1.datasafe.dev', '--us1-datasafe-dev', 'bob--', '', 'a--b--c', '-bob--h', 'a---b--c', 'b'.repeat(320) + '--x']) {
          assert.ok(!validate({ userSlug, status: 'new' }), `userSlug ${JSON.stringify(userSlug)}`);
        }
        for (const bad of [
          { username: 'Alice' }, { username: '' }, { host: 'https://ch1.datasafe.dev' }, { at: -1 }, { membershipAccessId: '' },
          { displayName: '' }, { displayName: 'Dr: Alice' }, { displayName: 'Alice\nBob' }, { displayName: 'A'.repeat(41) }
        ]) {
          assert.ok(!validate({ userSlug: 'bob--us1-datasafe-dev', status: 'open', claimedBy: { ...claim, ...bad } }), JSON.stringify(bad));
        }
      });

      it('[SUPP-ET-4] notify carries times only, never the address', () => {
        const base = { userSlug: 'bob--us1-datasafe-dev', status: 'open' };
        assert.ok(!validate({ ...base, notify: { email: 'bob@example.org', consentAt: 1 } }), 'the address lives in the support service only');
        assert.ok(!validate({ ...base, notify: { sentAt: 2 } }), 'consentAt is required');
        assert.ok(!validate({ ...base, notify: { consentAt: -1 } }));
        assert.ok(!validate({ ...base, notify: { consentAt: 1, name: 'Bob' } }), 'closed');
        assert.ok(!/email/.test(Object.keys(eventTypesById('support/conversation-v1').properties.notify.properties).join(' ')));
      });

      it('[SUPP-ET-5] uses no if/then (the cores compile draft-04)', () => {
        const text = JSON.stringify(eventTypesById('support/conversation-v1'));
        assert.ok(!/"(if|then|else)"/.test(text));
      });
    });
  }

  describe('[SUPP-PACK] built pack.json', () => {
    let pack;

    before(() => {
      const packPath = path.join(__dirname, '../dist/pack.json');
      if (!fs.existsSync(packPath)) return; // npm run build has not run yet
      pack = JSON.parse(fs.readFileSync(packPath, 'utf-8'));
    });

    it('[SUPP-PACK-1] the pack carries the stream, with its localised names, and the eventType', () => {
      if (!pack) return;
      const root = pack.streams.find((r) => r.id === 'hds-support');
      assert.ok(root, 'hds-support root in pack');
      assert.ok(root.label.fr && root.description.fr);
      assert.ok(pack.eventTypes.types['support/conversation-v1']);
    });
  });
});
