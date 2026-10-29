const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const AjvDraft04 = require('ajv-draft-04');

// Care encounters and providers (site-agents#24, plan 114 Q25-Q30): the `encounter` root, three composite items,
// `encounter/visit-v1`, `provider/practitioner-v1` and `provider/organization-v1`. See documentation/ENCOUNTER.md.

describe('[ENC] care encounters and providers', () => {
  const { itemsById, findItemForEvent, checkItemVsEvenType, fhirScopes } = require('../src/items');
  const { checkItem } = require('../src/schemas/items');
  const streams = require('../src/streams');
  const { eventTypesById } = require('../src/eventTypes');
  const { computeFhirScopes, readLock, lockEntries, mergeLock, UNMAPPED } = require('../src/fhir');

  const VISIT = 'encounter/visit-v1';
  const PRACTITIONER = 'provider/practitioner-v1';
  const ORGANIZATION = 'provider/organization-v1';
  const ITEMS = {
    'encounter-visit': VISIT,
    'encounter-provider-person': PRACTITIONER,
    'encounter-provider-organization': ORGANIZATION
  };
  const STREAMS = {
    encounter: null,
    'encounter-visit': 'encounter',
    'encounter-provider': 'encounter',
    'encounter-provider-person': 'encounter-provider',
    'encounter-provider-organization': 'encounter-provider'
  };
  const KINDS = ['consultation', 'hospital-stay', 'emergency', 'day-case', 'teleconsultation', 'home-visit', 'other'];
  const ROLES = ['attender', 'referrer', 'consultant', 'admitter', 'discharger'];

  const GLN = 'urn:oid:2.51.1.3';
  const ZSR = 'urn:oid:2.16.756.5.30.1.123.100.2.1.1';
  const UIDB = 'urn:oid:2.16.756.5.35';
  const BER = 'urn:oid:2.16.756.5.45';
  // Identifier values are not checked by the schema: these are shapes, not real numbers.
  const gln = () => ({ system: GLN, value: '7601000000001' });
  const zsr = () => ({ system: ZSR, value: 'A123456' });
  const cardiology = () => ({ system: 'http://snomed.info/sct', code: '394579002', display: 'Cardiology' });

  const fullVisit = () => ({
    kind: 'hospital-stay',
    specialty: cardiology(),
    reason: 'Chest pain',
    notes: 'Admitted through the emergency department',
    participants: [
      { eventId: 'ckprac0001', name: 'Dr méd. Anne Muller', role: 'attender' },
      { name: 'Dr Paul Martin', role: 'referrer' },
      { eventId: 'ckprac_0002' }
    ],
    serviceProvider: { eventId: 'ckorg0001', name: 'HUG, Service de cardiologie' }
  });
  const fullPractitioner = () => ({
    name: 'Dr méd. Anne Muller',
    given: 'Anne Marie',
    family: 'Muller',
    specialties: [
      { system: 'urn:oid:2.16.756.5.30.1.127.3.5', code: '1025', display: 'Cardiology' },
      { system: 'urn:oid:2.16.756.5.30.1.127.3.5', code: '1040', display: 'General medical practitioner' }
    ],
    identifiers: [gln(), zsr()],
    organizations: [{ eventId: 'ckorg0001', name: 'HUG' }, { name: 'Cabinet privé' }]
  });
  const fullOrganization = () => ({
    name: 'HUG, Service de cardiologie',
    identifiers: [gln(), zsr(), { system: UIDB, value: 'CHE123456789' }, { system: BER, value: 'A12345678' }]
  });

  describe('[ENC-STR] streams', () => {
    it('[ENC-STR-1] one root, two leaves under encounter-provider; neither the root nor encounter-provider holds an item', () => {
      for (const [id, parent] of Object.entries(STREAMS)) {
        assert.ok(streams.streamsById[id], `${id} exists`);
        assert.strictEqual(streams.streamsById[id].parentId, parent, `${id} under ${parent}`);
      }
      assert.ok(streams.roots.find((r) => r.id === 'encounter'), 'encounter is a root');
      assert.strictEqual(streams.streamsById.encounter.name, 'Care encounters and providers');
      for (const id of ['encounter', 'encounter-provider']) {
        const on = Object.entries(itemsById).filter(([, i]) => i.streamId === id).map(([k]) => k);
        assert.deepStrictEqual(on, [], `no item on ${id}`);
      }
      const subtree = Object.keys(STREAMS);
      const inside = Object.entries(itemsById).filter(([, i]) => subtree.includes(i.streamId)).map(([k]) => k).sort();
      assert.deepStrictEqual(inside, Object.keys(ITEMS).sort(), 'the three items are the only ones in the subtree');
    });
  });

  describe('[ENC-ITM] items', () => {
    it('[ENC-ITM-1] three composite items, key = streamId; kind options equal the eventType enum, in order', () => {
      for (const [key, eventType] of Object.entries(ITEMS)) {
        const item = itemsById[key];
        assert.ok(item, key);
        assert.doesNotThrow(() => checkItem(item, key), key);
        assert.strictEqual(item.type, 'composite', key);
        assert.strictEqual(item.eventType, eventType, key);
        assert.strictEqual(item.streamId, key, key);
        assert.strictEqual(item.repeatable, 'unlimited', key);
        assert.ok(item.label.fr && item.description.fr, `${key} is localised`);
        assert.strictEqual(findItemForEvent(eventType, key), item, `${key} resolves`);
        assert.strictEqual(checkItemVsEvenType(key, item, eventTypesById(eventType)), true, key);
        assert.strictEqual(item.fhir, undefined, `${key}: no fhir block yet`);
        assert.strictEqual(item.references, undefined, `${key}: no references`);
      }
      const visit = itemsById['encounter-visit'];
      assert.deepStrictEqual(Object.keys(visit.composite), ['kind', 'reason', 'notes']);
      assert.deepStrictEqual(visit.composite.kind.options.map((o) => o.value), KINDS);
      assert.deepStrictEqual(eventTypesById(VISIT).properties.kind.enum, KINDS);
      assert.strictEqual(visit.composite.kind.canBeNull, undefined, 'kind is required');
      assert.ok(visit.composite.kind.options.every((o) => o.label.en && o.label.fr), 'kind options localised');
      assert.strictEqual(visit.composite.reason.canBeNull, true);
      assert.strictEqual(visit.composite.notes.canBeNull, true);
      // null is an ongoing stay; an unknown end is no duration (ENCOUNTER.md § Period and status)
      assert.deepStrictEqual(visit.duration, { mandatory: false, canBeNull: true, maxSeconds: 31536000 });
      for (const key of ['encounter-provider-person', 'encounter-provider-organization']) {
        assert.deepStrictEqual(Object.keys(itemsById[key].composite), ['name'], key);
        assert.strictEqual(itemsById[key].composite.name.canBeNull, undefined, `${key}: name is required`);
        assert.strictEqual(itemsById[key].duration, undefined, key);
      }
    });
  });

  for (const [flavour, make] of [
    ['draft-04 (the cores)', () => new AjvDraft04({ strict: false, allErrors: true, coerceTypes: false, logger: false })],
    ['draft-07', () => new Ajv({ strict: false, allErrors: true, coerceTypes: false, logger: false })]
  ]) {
    describe(`[ENC-ET] eventTypes under ${flavour}`, () => {
      const validators = {};
      before(() => {
        for (const t of [VISIT, PRACTITIONER, ORGANIZATION]) validators[t] = make().compile(eventTypesById(t));
      });
      const ok = (t, c, why) => assert.ok(validators[t](c), `${t} ${why}: ${JSON.stringify(validators[t].errors)}`);
      const ko = (t, c, why) => assert.ok(!validators[t](c), `${t} ${why}: accepted`);

      it('[ENC-ET-1] encounter/visit-v1: accepts a bare kind and a full visit, refuses malformed ones', () => {
        const v = (extra) => ({ kind: 'consultation', ...extra });
        for (const kind of KINDS) ok(VISIT, { kind }, kind);
        ok(VISIT, fullVisit(), 'full');
        for (const role of ROLES) ok(VISIT, v({ participants: [{ name: 'x', role }] }), role);
        ok(VISIT, v({ participants: [{ eventId: 'ck1' }] }), 'participant by id only');
        ok(VISIT, v({ participants: [{ name: 'Dr X' }] }), 'participant by name only');
        ok(VISIT, v({ serviceProvider: { name: 'HUG' } }), 'serviceProvider by name only');
        ok(VISIT, v({ serviceProvider: { eventId: 'ckorg0001' } }), 'serviceProvider by id only');
        ok(VISIT, v({ specialty: { system: 'http://snomed.info/sct', version: '2024-12', code: '394579002' } }), 'specialty with version, no display');

        ko(VISIT, {}, 'no kind');
        ko(VISIT, { kind: 'inpatient' }, 'unknown kind');
        ko(VISIT, v({ status: 'finished' }), 'status is derived, never stored (closed)');
        ko(VISIT, v({ providerIds: ['ck1'] }), 'the draft shape is gone');
        ko(VISIT, v({ specialty: { system: 'http://snomed.info/sct' } }), 'specialty without code');
        ko(VISIT, v({ specialty: { system: 'SNOMED', code: '1' } }), 'specialty system not a URI');
        ko(VISIT, v({ specialty: { ...cardiology(), userSelected: true } }), 'specialty is closed');
        ko(VISIT, v({ reason: '' }), 'empty reason');
        ko(VISIT, v({ notes: '' }), 'empty notes');
        ko(VISIT, v({ participants: [] }), 'empty participants');
        ko(VISIT, v({ participants: { name: 'x' } }), 'participants is an array');
        ko(VISIT, v({ participants: [{}] }), 'participant with nothing');
        ko(VISIT, v({ participants: [{ role: 'attender' }] }), 'participant with neither eventId nor name');
        ko(VISIT, v({ participants: [{ eventId: 'ck.1' }] }), 'eventId outside the related path grammar');
        ko(VISIT, v({ participants: [{ eventId: 'ck 1', name: 'x' }] }), 'eventId with a space');
        ko(VISIT, v({ participants: [{ eventId: '' }] }), 'empty eventId');
        ko(VISIT, v({ participants: [{ name: '' }] }), 'empty name');
        ko(VISIT, v({ participants: [{ name: 'x', role: 'author' }] }), 'unknown role');
        ko(VISIT, v({ participants: [{ name: 'x', role: { code: 'ATND' } }] }), 'role is the enum, not a Coding');
        ko(VISIT, v({ participants: [{ name: 'x', specialty: cardiology() }] }), 'a participant is closed');
        ko(VISIT, v({ serviceProvider: {} }), 'serviceProvider with nothing');
        ko(VISIT, v({ serviceProvider: { eventId: 'a/b' } }), 'serviceProvider eventId pattern');
        ko(VISIT, v({ serviceProvider: { name: 'x', identifiers: [gln()] } }), 'serviceProvider is closed');
        ko(VISIT, v({ serviceProvider: [{ name: 'x' }] }), 'serviceProvider is one object');
      });

      it('[ENC-ET-2] provider/practitioner-v1: accepts minimal and full practitioners, refuses malformed ones', () => {
        const p = (extra) => ({ name: 'Dr X', ...extra });
        ok(PRACTITIONER, { name: 'Dr méd. Anne Muller' }, 'minimal');
        ok(PRACTITIONER, fullPractitioner(), 'full');
        ok(PRACTITIONER, p({ specialties: [cardiology()] }), 'a practiceSetting code is accepted');
        ok(PRACTITIONER, p({ identifiers: [zsr(), { system: ZSR, value: 'B654321' }] }), 'two ZSR numbers');
        ok(PRACTITIONER, p({ organizations: [{ eventId: 'ckorg0001' }] }), 'organization by id only');

        ko(PRACTITIONER, {}, 'no name');
        ko(PRACTITIONER, { name: '' }, 'empty name');
        ko(PRACTITIONER, { given: 'Anne', family: 'Muller' }, 'given and family without name');
        ko(PRACTITIONER, p({ kind: 'practitioner' }), 'no kind (closed)');
        ko(PRACTITIONER, p({ given: '' }), 'empty given');
        ko(PRACTITIONER, p({ specialties: [{ system: 'urn:oid:2.16.756.5.30.1.127.3.5' }] }), 'specialty without code');
        ko(PRACTITIONER, p({ specialties: [] }), 'empty specialties');
        ko(PRACTITIONER, p({ specialties: cardiology() }), 'specialties is an array');
        ko(PRACTITIONER, p({ specialties: [{ ...cardiology(), userSelected: true }] }), 'a specialty is closed');
        ko(PRACTITIONER, p({ specialty: cardiology() }), 'the single specialty is gone (Q33)');
        ko(PRACTITIONER, p({ identifiers: [] }), 'empty identifiers');
        ko(PRACTITIONER, p({ identifiers: [{ value: '7601000000001' }] }), 'identifier without system');
        ko(PRACTITIONER, p({ identifiers: [{ system: 'GLN', value: '7601000000001' }] }), 'identifier system not a URI');
        ko(PRACTITIONER, p({ identifiers: [{ system: GLN }] }), 'identifier without value');
        ko(PRACTITIONER, p({ identifiers: [{ system: GLN, value: '' }] }), 'empty identifier value');
        ko(PRACTITIONER, p({ identifiers: [{ ...gln(), type: 'GLN' }] }), 'identifier is closed');
        ko(PRACTITIONER, p({ identifiers: [gln(), gln()] }), 'duplicate identifier');
        ko(PRACTITIONER, p({ organizations: [] }), 'empty organizations');
        ko(PRACTITIONER, p({ organizations: [{}] }), 'organization with neither eventId nor name');
        ko(PRACTITIONER, p({ organizations: [{ eventId: 'bad id' }] }), 'organization eventId pattern');
        ko(PRACTITIONER, p({ organizationId: 'ckorg0001' }), 'the draft single organizationId is gone');
      });

      it('[ENC-ET-3] provider/organization-v1: accepts a name and the four CH identifiers, refuses practitioner fields', () => {
        const o = (extra) => ({ name: 'HUG', ...extra });
        ok(ORGANIZATION, { name: 'HUG' }, 'minimal');
        ok(ORGANIZATION, fullOrganization(), 'GLN, ZSR, UIDB and BER');

        ko(ORGANIZATION, {}, 'no name');
        ko(ORGANIZATION, { identifiers: [gln()] }, 'identifiers without name');
        ko(ORGANIZATION, o({ specialty: cardiology() }), 'no specialty (closed): a department is its own organization');
        ko(ORGANIZATION, o({ given: 'x' }), 'no given');
        ko(ORGANIZATION, o({ family: 'x' }), 'no family');
        ko(ORGANIZATION, o({ organizations: [{ name: 'x' }] }), 'no organizations');
        ko(ORGANIZATION, o({ identifiers: [{ value: 'CHE123456789' }] }), 'identifier without system');
        ko(ORGANIZATION, o({ identifiers: [{ system: 'UIDB', value: 'CHE123456789' }] }), 'identifier system not a URI');
      });
    });
  }

  describe('[ENC-ET-SHAPE] shared shapes and the portable subset', () => {
    const strip = (schema) => { const s = structuredClone(schema); delete s.description; return s; };
    const xds = () => eventTypesById('file/xds-v1').properties;

    it('[ENC-ET-4] each specialty is file/xds-v1 practiceSetting, description aside; identifiers are one shape', () => {
      assert.deepStrictEqual(strip(eventTypesById(VISIT).properties.specialty), strip(xds().practiceSetting), 'visit');
      assert.deepStrictEqual(strip(eventTypesById(PRACTITIONER).properties.specialties.items), strip(xds().practiceSetting), 'practitioner');
      assert.strictEqual(eventTypesById(PRACTITIONER).properties.specialty, undefined, 'practitioner: specialties only (Q33)');
      assert.deepStrictEqual(strip(eventTypesById(PRACTITIONER).properties.identifiers), strip(eventTypesById(ORGANIZATION).properties.identifiers));
      assert.strictEqual(eventTypesById(ORGANIZATION).properties.specialty, undefined);
    });

    it('[ENC-ET-5] every new event id field has the related path pattern, and every reference is { eventId?, name? } with one required', () => {
      const v = eventTypesById(VISIT).properties;
      const refs = [v.participants.items, v.serviceProvider, eventTypesById(PRACTITIONER).properties.organizations.items];
      for (const ref of refs) {
        assert.strictEqual(ref.properties.eventId.pattern, '^[a-zA-Z0-9_-]+$');
        assert.deepStrictEqual(ref.anyOf, [{ required: ['eventId'] }, { required: ['name'] }]);
        assert.strictEqual(ref.additionalProperties, false);
      }
      assert.deepStrictEqual(v.participants.items.properties.role.enum, ROLES);
    });

    it('[ENC-ET-6] the descriptions cite the CH Core identifier systems', () => {
      const p = eventTypesById(PRACTITIONER).properties.identifiers.description;
      for (const s of [GLN, ZSR]) assert.ok(p.includes(s), `practitioner ${s}`);
      const o = eventTypesById(ORGANIZATION).properties.identifiers.description;
      for (const s of [GLN, ZSR, UIDB, BER]) assert.ok(o.includes(s), `organization ${s}`);
    });

    it('[ENC-ET-7] closed, and no if/then/else/const/not/$ref (the cores compile draft-04)', () => {
      for (const t of [VISIT, PRACTITIONER, ORGANIZATION]) {
        assert.strictEqual(eventTypesById(t).additionalProperties, false, t);
        assert.ok(!/"(if|then|else|const|not|\$ref)"/.test(JSON.stringify(eventTypesById(t))), t);
      }
    });

    it('[ENC-ET-8] file/xds-v1 names the target types of its ids', () => {
      assert.ok(xds().authors.items.properties.eventId.description.includes(PRACTITIONER));
      assert.ok(xds().authors.items.properties.eventId.description.includes(ORGANIZATION));
      assert.ok(xds().encounterId.description.includes(VISIT));
    });
  });

  describe('[ENC-FHIR] SMART scopes', () => {
    const subtree = Object.keys(STREAMS);
    const coding = (code) => ({ system: 'http://example.org/encounter-test', code, display: code });
    const withBlocks = (blocks) => {
      const items = structuredClone(itemsById);
      for (const [key, b] of Object.entries(blocks)) {
        items[key] = { ...(items[key] ?? {}), ...b };
      }
      return items;
    };
    const mapped = (resourceType, code) => ({ fhir: { resourceType, code: coding(code), profiles: {} } });

    it('[ENC-FHIR-1] fhirScopes and the lock are unchanged: no encounter stream is granted or locked', () => {
      const without = Object.fromEntries(Object.entries(itemsById).filter(([k]) => !ITEMS[k]));
      assert.deepStrictEqual(computeFhirScopes(without).grants, fhirScopes, 'the three items do not change the grant table');
      for (const roots of Object.values(fhirScopes)) {
        for (const s of roots) assert.ok(!subtree.includes(s), `${s} is granted`);
      }
      const lock = readLock();
      for (const s of subtree) assert.strictEqual(lock.streams[s], undefined, `${s} is locked`);
      assert.deepStrictEqual(mergeLock(lock, lockEntries(itemsById, fhirScopes)), lock, 'npm run fhir:lock is a no-op');
      const { subtree: pairs } = computeFhirScopes(itemsById);
      assert.deepStrictEqual([...pairs.get('encounter')], [UNMAPPED]);
    });

    it('[ENC-FHIR-2] Encounter, Practitioner and Organization blocks on the three leaves grant one leaf each, with no violation', () => {
      const items = withBlocks({
        'encounter-visit': mapped('Encounter', 'v'),
        'encounter-provider-person': mapped('Practitioner', 'p'),
        'encounter-provider-organization': mapped('Organization', 'o')
      });
      const { grants, violations } = computeFhirScopes(items);
      assert.deepStrictEqual(violations, []);
      assert.deepStrictEqual(grants.Encounter, ['encounter-visit']);
      assert.deepStrictEqual(grants.Practitioner, ['encounter-provider-person']);
      assert.deepStrictEqual(grants.Organization, ['encounter-provider-organization']);
    });

    it('[ENC-FHIR-3] the layouts Q25 declined would over-grant: an item on the root, one provider item for both kinds', () => {
      const onRoot = withBlocks({
        'encounter-visit': mapped('Encounter', 'v'),
        x: { streamId: 'encounter', ...mapped('Encounter', 'x') }
      });
      assert.ok(computeFhirScopes(onRoot).violations.some((v) => v.startsWith('stream "encounter" ')), 'item on the root');
      const oneProvider = withBlocks({
        'encounter-provider-person': mapped('Practitioner', 'p'),
        'encounter-provider-organization': mapped('Organization', 'o'),
        y: { streamId: 'encounter-provider', ...mapped('Practitioner', 'y') }
      });
      assert.ok(computeFhirScopes(oneProvider).violations.some((v) => v.startsWith('stream "encounter-provider" ')), 'one provider item');
    });
  });

  describe('[ENC-PACK] built pack.json', () => {
    let pack;
    before(() => {
      const packPath = path.join(__dirname, '../dist/pack.json');
      if (!fs.existsSync(packPath)) return;
      pack = JSON.parse(fs.readFileSync(packPath, 'utf-8'));
    });

    it('[ENC-PACK-1] the pack carries the eventTypes, the root and the items', function () {
      if (!pack || !pack.items['encounter-visit']) return this.skip(); // pack built before this change
      for (const t of [VISIT, PRACTITIONER, ORGANIZATION]) assert.ok(pack.eventTypes.types[t], t);
      for (const key of Object.keys(ITEMS)) assert.strictEqual(pack.items[key].type, 'composite', key);
      assert.ok(pack.streams.find((r) => r.id === 'encounter'), 'encounter root in pack');
    });
  });
});
