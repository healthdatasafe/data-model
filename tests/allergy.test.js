const assert = require('assert');
const Ajv = require('ajv');
const AjvDraft04 = require('ajv-draft-04');

// Allergies and intolerances (plan 133, 4.21.0): `allergy/coded-v1` and `allergy/basic-v1`, the twins `allergy-coded`
// and `allergy-basic` on the `allergy` root, an `AllergyIntolerance` block under a bare scope key. See
// documentation/ALLERGY.md and FHIR-MAPPING.md § AllergyIntolerance.

describe('[ALG] allergies and intolerances', () => {
  const { itemsById, fhirScopes, checkItemVsEvenType } = require('../src/items');
  const { eventTypesById } = require('../src/eventTypes');
  const { datasourcesById } = require('../src/datasources');
  const { vocabulariesById, resolveEnum } = require('../src/vocabularies');
  const { streamsById } = require('../src/streams');
  const { checkItem } = require('../src/schemas/items');
  const { checkFhirMapping, checkFhirImportKeys, readLock, fhirMapping, ALLERGY_FIELDS, ALLERGY_REACTION_SEVERITIES } = require('../src/fhir');

  const TYPES = { 'allergy-coded': 'allergy/coded-v1', 'allergy-basic': 'allergy/basic-v1' };
  const ALLERGEN = {
    label: { en: 'Peanut' },
    hdsId: 'S:SNOMED-CT/k:SNOMED-CT-HDS/C:762952008',
    codes: [{ code: '762952008', system: 'SNOMED-CT', source: { key: 'SNOMED-CT-HDS' }, hdsId: 'S:SNOMED-CT/k:SNOMED-CT-HDS/C:762952008' }]
  };
  const CODED = { allergen: ALLERGEN, status: 'active' };
  const BASIC = { name: 'Peanut butter', status: 'active' };
  const FULL = {
    status: 'resolved',
    verificationStatus: 'confirmed',
    categories: ['food'],
    type: 'allergy',
    criticality: 'high',
    reactions: [{
      manifestations: [
        { label: { en: 'Anaphylaxis' }, codes: [{ code: '39579001', system: 'SNOMED-CT', hdsId: 'S:SNOMED-CT/k:SNOMED-CT-HDS/C:39579001' }] },
        { text: 'throat closing' }
      ],
      severity: 'severe',
      notes: 'At a restaurant'
    }],
    lastOccurrence: '2019-06',
    notes: 'Carries an auto-injector'
  };

  const flavours = {};
  before(() => {
    const draft07 = new Ajv({ strict: false, allErrors: true, logger: false });
    const draft04 = new AjvDraft04({ strict: false, allErrors: true, logger: false });
    for (const t of Object.values(TYPES)) {
      flavours[t] = [draft07.compile(eventTypesById(t)), draft04.compile(eventTypesById(t))];
    }
  });
  // valid under both flavours, or under neither
  const valid = (t, content) => {
    const [a, b] = flavours[t].map((v) => v(content));
    assert.strictEqual(a, b, `draft-07 and draft-04 disagree on ${JSON.stringify(content)}`);
    return a;
  };

  describe('[ALG-ET] the eventTypes', () => {
    it('[ALG-ET-1] status is required and one of active, inactive, resolved; the allergen (coded) or the name (basic) too', () => {
      assert.ok(valid('allergy/coded-v1', CODED));
      assert.ok(valid('allergy/basic-v1', BASIC));
      assert.ok(valid('allergy/coded-v1', { ...CODED, ...FULL }));
      assert.ok(valid('allergy/basic-v1', { ...BASIC, ...FULL }));
      assert.ok(!valid('allergy/coded-v1', { allergen: ALLERGEN }), 'no status: a writer states it');
      assert.ok(!valid('allergy/basic-v1', { name: 'x' }), 'no status');
      assert.ok(!valid('allergy/coded-v1', { status: 'active' }), 'no allergen');
      assert.ok(!valid('allergy/basic-v1', { status: 'active' }), 'no name');
      assert.ok(!valid('allergy/basic-v1', { ...BASIC, name: '' }), 'an empty name');
      assert.ok(!valid('allergy/coded-v1', { ...CODED, allergen: { ...ALLERGEN, label: {} } }), 'an allergen label without en');
      assert.ok(!valid('allergy/coded-v1', { ...CODED, allergen: { ...ALLERGEN, label: { en: '' } } }), 'an empty allergen label');
      for (const status of ['inactive', 'resolved']) assert.ok(valid('allergy/coded-v1', { ...CODED, status }), status);
      for (const status of ['refuted', 'entered-in-error', 'remission', null]) assert.ok(!valid('allergy/coded-v1', { ...CODED, status }), String(status));
      assert.deepStrictEqual(eventTypesById('allergy/coded-v1').required, ['allergen', 'status']);
      assert.deepStrictEqual(eventTypesById('allergy/basic-v1').required, ['name', 'status']);
    });

    it('[ALG-ET-2] verificationStatus is unconfirmed or confirmed; refuted and entered-in-error have no place', () => {
      for (const v of ['unconfirmed', 'confirmed']) assert.ok(valid('allergy/coded-v1', { ...CODED, verificationStatus: v }), v);
      for (const v of ['refuted', 'entered-in-error', 'presumed']) assert.ok(!valid('allergy/coded-v1', { ...CODED, verificationStatus: v }), v);
    });

    it('[ALG-ET-3] categories: at least one, unique, of the four FHIR codes; type and criticality their enums', () => {
      assert.ok(valid('allergy/coded-v1', { ...CODED, categories: ['food', 'medication', 'environment', 'biologic'] }));
      assert.ok(!valid('allergy/coded-v1', { ...CODED, categories: [] }), 'min 1 when present');
      assert.ok(!valid('allergy/coded-v1', { ...CODED, categories: ['food', 'food'] }), 'unique');
      assert.ok(!valid('allergy/coded-v1', { ...CODED, categories: ['drug'] }), 'not a FHIR code');
      assert.ok(!valid('allergy/coded-v1', { ...CODED, categories: 'food' }), 'an array');
      assert.ok(!valid('allergy/coded-v1', { ...CODED, type: 'sensitivity' }));
      assert.ok(valid('allergy/coded-v1', { ...CODED, criticality: 'unable-to-assess' }));
      assert.ok(!valid('allergy/coded-v1', { ...CODED, criticality: 'medium' }));
    });

    it('[ALG-ET-4] reactions: at least one manifestation each, every manifestation a text or a label', () => {
      const r = (reaction) => ({ ...CODED, reactions: [reaction] });
      assert.ok(valid('allergy/coded-v1', r({ manifestations: [{ text: 'hives' }] })));
      assert.ok(valid('allergy/coded-v1', r({ manifestations: [{ label: { en: 'Urticaria' } }] })));
      assert.ok(!valid('allergy/coded-v1', r({ manifestations: [] })), 'min 1');
      assert.ok(!valid('allergy/coded-v1', r({ severity: 'mild' })), 'manifestations required');
      assert.ok(!valid('allergy/coded-v1', r({ manifestations: [{ codes: ALLERGEN.codes }] })), 'codes alone: neither text nor label');
      assert.ok(!valid('allergy/coded-v1', r({ manifestations: [{ text: '' }] })), 'an empty text');
      assert.ok(!valid('allergy/coded-v1', r({ manifestations: [{ label: {} }] })), 'a label without en');
      assert.ok(!valid('allergy/coded-v1', r({ manifestations: [{ label: { en: 'x' }, codes: [{ code: '1', system: 'SNOMED-CT' }] }] })), 'a code needs its hdsId');
      assert.ok(!valid('allergy/coded-v1', r({ manifestations: [{ text: 'hives', codes: [{ code: '126485001', system: 'SNOMED-CT', hdsId: 'h' }] }] })), 'codes require a label');
      assert.ok(valid('allergy/coded-v1', r({ manifestations: [{ text: 'hives', label: { en: 'Urticaria' }, codes: [{ code: '126485001', system: 'SNOMED-CT', hdsId: 'h' }] }] })));
      assert.ok(!valid('allergy/coded-v1', r({ manifestations: [{ text: 'x' }], severity: 'fatal' })), 'severity enum');
      assert.ok(!valid('allergy/coded-v1', { ...CODED, reactions: [] }), 'min 1 when present');
    });

    it('[ALG-ET-5] lastOccurrence is a date at its precision; the allergen has at least one code, each with its hdsId', () => {
      for (const d of ['2019', '2019-06', '2019-06-14']) assert.ok(valid('allergy/coded-v1', { ...CODED, lastOccurrence: d }), d);
      for (const d of ['2019-06-14T10:00:00Z', '06/2019', '19', '', '2019-13-45', '2019-00', '2019-02-32']) assert.ok(!valid('allergy/coded-v1', { ...CODED, lastOccurrence: d }), d);
      assert.ok(!valid('allergy/coded-v1', { ...CODED, allergen: { ...ALLERGEN, codes: [] } }), 'no code: allergy-basic');
      assert.ok(!valid('allergy/coded-v1', { ...CODED, allergen: { ...ALLERGEN, codes: [{ code: '1', system: 'SNOMED-CT' }] } }), 'hdsId');
      assert.strictEqual(eventTypesById('allergy/coded-v1').properties.allergen.properties.product, undefined, 'never embeds drug.product');
    });

    it('[ALG-ET-6] the two eventTypes are identical but for allergen / name', () => {
      const shared = (t, own) => {
        const s = structuredClone(eventTypesById(t));
        delete s.properties[own];
        delete s.description;
        s.required = s.required.filter((k) => k !== own);
        return s;
      };
      assert.deepStrictEqual(shared('allergy/coded-v1', 'allergen'), shared('allergy/basic-v1', 'name'));
    });

    it('[ALG-ET-7] the datasource: allergen, from datasets-service, every value field declared on the selection', () => {
      const ds = datasourcesById.allergen;
      assert.strictEqual(ds.endpoint, 'datasets://allergen');
      assert.strictEqual(ds.resultKey, 'allergens');
      const declared = Object.keys(eventTypesById('allergy/coded-v1').properties.allergen.properties);
      for (const f of ds.valueFields) assert.ok(declared.includes(f), `allergen.${f}`);
    });

    it('[ALG-ET-8] the datasource manifestation, from datasets-service, every value field declared on a manifestation', () => {
      const ds = datasourcesById.manifestation;
      assert.strictEqual(ds.endpoint, 'datasets://manifestation');
      assert.strictEqual(ds.resultKey, 'manifestations');
      assert.deepStrictEqual(ds.valueFields, ['label', 'codes'], 'a new value field needs the eventType first');
      for (const t of Object.values(TYPES)) {
        const declared = Object.keys(eventTypesById(t).properties.reactions.items.properties.manifestations.items.properties);
        for (const f of ds.valueFields) assert.ok(declared.includes(f), `${t} manifestation.${f}`);
      }
    });

    it('[ALG-ET-9] the reaction severity labels: vocabulary allergy-reaction-severity, its FHIR code the stored value', () => {
      const voc = vocabulariesById['allergy-reaction-severity'];
      assert.strictEqual(voc.fhirElement, 'AllergyIntolerance.reaction.severity');
      assert.deepStrictEqual(Object.keys(voc.values), ALLERGY_REACTION_SEVERITIES);
      for (const [value, v] of Object.entries(voc.values)) {
        assert.strictEqual(v.fhir, value);
        assert.ok(v.label.en && v.label.fr, value);
      }
      assert.deepStrictEqual(voc.binds, Object.values(TYPES).map((eventType) => ({ eventType, path: 'reactions.severity' })));
      for (const t of Object.values(TYPES)) assert.deepStrictEqual(resolveEnum(t, 'reactions.severity'), ALLERGY_REACTION_SEVERITIES, t);
      assert.deepStrictEqual(resolveEnum('allergy/coded-v1', 'reactions.manifestations'), null, 'an array of objects is no enum');
    });
  });

  describe('[ALG-ITEM] the items', () => {
    it('[ALG-ITEM-1] two composite twins on the allergy root, unlimited, with no duration (time + duration reserved for an abatement)', () => {
      assert.strictEqual(streamsById.allergy.parentId, null);
      assert.deepStrictEqual(streamsById.allergy.label, { en: 'Allergies and intolerances', fr: 'Allergies et intolérances' });
      for (const [key, t] of Object.entries(TYPES)) {
        const item = itemsById[key];
        assert.deepStrictEqual([item.streamId, item.eventType, item.type, item.repeatable], ['allergy', t, 'composite', 'unlimited'], key);
        assert.strictEqual(item.duration, undefined, `${key}: a duration-free event`);
        assert.ok(item.label.fr && item.description.fr, `${key}: fr`);
        assert.strictEqual(item.composite.reactions, undefined, `${key}: reactions is not a form field`);
      }
      assert.deepStrictEqual(itemsById['allergy-coded'].composite.allergen, { label: { en: 'Allergen', fr: 'Allergène' }, type: 'datasource-search', datasource: 'allergen' });
      assert.strictEqual(itemsById['allergy-basic'].composite.name.type, 'text');
      assert.strictEqual(itemsById['allergy-coded'].composite.status.canBeNull, undefined, 'status is required on the form');
      assert.strictEqual(itemsById['allergy-coded'].composite.categories.type, 'multi-select');
    });

    it('[ALG-ITEM-2] one field set for both twins, but for allergen / name', () => {
      const shared = (key, own) => {
        const c = structuredClone(itemsById[key].composite);
        delete c[own];
        return c;
      };
      assert.deepStrictEqual(shared('allergy-coded', 'allergen'), shared('allergy-basic', 'name'));
      assert.deepStrictEqual(Object.keys(shared('allergy-coded', 'allergen')).sort(), Object.keys(ALLERGY_FIELDS).filter((k) => ALLERGY_FIELDS[k].field != null).sort());
    });

    it('[ALG-ITEM-3] a composite multi-select field needs an array eventType property holding its options; a datasource-search field a known datasource', () => {
      const et = eventTypesById('allergy/coded-v1');
      const item = () => structuredClone(itemsById['allergy-coded']);
      const a = item();
      a.composite.categories.options.push({ value: 'insect', label: { en: 'Insect' } });
      assert.throws(() => checkItemVsEvenType('a', a, et), /multi-select value "insect" is not in the eventType "items.enum"/);
      const b = item();
      b.composite.notes = { ...b.composite.categories };
      assert.throws(() => checkItemVsEvenType('b', b, et), /field "notes" is "multi-select" but the eventType property is not an array/);
      const c = item();
      c.composite.allergen.datasource = 'nope';
      assert.throws(() => checkItemVsEvenType('c', c, et), /must name a known "datasource" \(got "nope"\)/);
      const d = item();
      d.composite.notes.datasource = 'allergen';
      assert.throws(() => checkItemVsEvenType('d', d, et), /field "notes" names a "datasource" but is "text"/);
      const e = item();
      e.composite.status.type = 'datasource-search';
      assert.throws(() => checkItemVsEvenType('e', e, et), /field "status" is "datasource-search" but the eventType property is "string"/);
      const f = item();
      f.composite.categories.options.push({ value: 1, label: { en: 'One' } });
      assert.throws(() => checkItemVsEvenType('f', f, et), /field "categories" is "multi-select" and all option values must be strings/);
      const g = item();
      g.composite.allergen.options = [{ value: 'x', label: { en: 'X' } }];
      assert.throws(() => checkItemVsEvenType('g', g, et), /field "allergen" is "datasource-search" and takes no "options"/);
    });
  });

  describe('[ALG-FHIR] the AllergyIntolerance block', () => {
    const item = (k) => structuredClone(itemsById[k]);
    const check = (it, key = 'x') => checkFhirMapping(key, it, [it.eventType]);
    const profiles = {
      us: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance',
      ips: 'http://hl7.org/fhir/uv/ips/StructureDefinition/AllergyIntolerance-uv-ips'
    };

    it('[ALG-FHIR-1] a bare scope key on the allergy root, locked; no category table, so content categories are never a scope category', () => {
      assert.deepStrictEqual(itemsById['allergy-coded'].fhir, { resourceType: 'AllergyIntolerance', code: { from: 'datasource', field: 'allergen' }, profiles });
      assert.deepStrictEqual(itemsById['allergy-basic'].fhir, { resourceType: 'AllergyIntolerance', code: { from: 'text', field: 'name' }, profiles });
      assert.strictEqual(fhirMapping.categories.AllergyIntolerance, undefined, 'no category table: a bare scope key, for good');
      assert.deepStrictEqual(fhirScopes.AllergyIntolerance, ['allergy']);
      assert.deepStrictEqual(readLock().streams.allergy, { pair: 'AllergyIntolerance', parent: null, items: ['allergy-basic', 'allergy-coded'] });
      assert.deepStrictEqual(ALLERGY_REACTION_SEVERITIES, eventTypesById('allergy/coded-v1').properties.reactions.items.properties.severity.enum);
    });

    it('[ALG-FHIR-2] a datasource or text code, no category, no value, no split, no dosage, no duration', () => {
      for (const k of Object.keys(TYPES)) {
        checkItem(item(k), k);
        check(item(k), k);
      }
      const a = item('allergy-basic');
      a.fhir.code = { system: 'http://snomed.info/sct', code: '762952008', display: 'Peanut' };
      assert.throws(() => check(a), /an AllergyIntolerance takes its code from the content/);
      const b = item('allergy-basic');
      b.fhir.category = 'food';
      assert.throws(() => check(b), /resourceType "AllergyIntolerance" takes no category/);
      const c = item('allergy-basic');
      c.fhir.value = { kind: 'coded', options: { x: { system: 'http://x.org', code: 'x', display: 'x' } } };
      assert.throws(() => check(c), /AllergyIntolerance has no value\[x\]/);
      const d = item('allergy-basic');
      d.fhir.split = { notes: { code: { system: 'http://x.org', code: 'x', display: 'x' }, unit: '1', profiles: {} } };
      assert.throws(() => check(d), /AllergyIntolerance has no numeric field to split/);
      const e = item('allergy-basic');
      e.fhir.dosage = itemsById['medication-intake-basic'].fhir.dosage;
      assert.throws(() => check(e), /"dosage" applies to a MedicationStatement or MedicationRequest only/);
      const f = item('allergy-coded');
      f.duration = { mandatory: false, canBeNull: false };
      assert.throws(() => check(f), /an AllergyIntolerance item declares no "duration"/);
    });

    it('[ALG-FHIR-3] composite accounting: every field read by name is mapped; a stray field or a reactions field fails the build', () => {
      const a = item('allergy-basic');
      a.composite.extra = { label: { en: 'Extra' }, type: 'text', canBeNull: true };
      assert.throws(() => check(a), /composite field "extra" is neither mapped nor listed in "ignore"/);
      const b = item('allergy-coded');
      b.fhir.ignore = ['notes'];
      assert.throws(() => check(b), /field "notes" is both mapped and ignored/);
      const c = item('allergy-coded');
      c.composite.reactions = { label: { en: 'Reactions' }, type: 'text' };
      assert.throws(() => check(c), /composite field "reactions" is not a form field of an AllergyIntolerance item/);
      const d = item('allergy-coded');
      d.composite.categories.type = 'select';
      assert.throws(() => check(d), /composite field "categories" is not a multi-select field/);
      const e = item('allergy-basic');
      e.composite.status.type = 'text';
      assert.throws(() => check(e), /composite field "status" is not a select field/);
    });

    it('[ALG-FHIR-4] the eventType content read by name keeps its types and its enums; status stays required', () => {
      const et = eventTypesById('allergy/basic-v1');
      const mutate = (fn, re) => {
        const saved = structuredClone(et);
        try {
          fn(et);
          assert.throws(() => check(item('allergy-basic')), re);
        } finally {
          for (const k of Object.keys(et)) delete et[k];
          Object.assign(et, saved);
        }
      };
      mutate((t) => t.properties.status.enum.push('presumed'), /content property "status" .* the enum must be exactly active, inactive, resolved/);
      mutate((t) => t.properties.categories.items.enum.pop(), /content property "categories" .* the enum must be exactly/);
      mutate((t) => { t.properties.lastOccurrence.type = 'number'; }, /content property "lastOccurrence" .* is not of type string/);
      mutate((t) => { t.properties.reactions.type = 'object'; }, /content property "reactions" .* is not of type array/);
      mutate((t) => { t.properties.reactions.items.properties.severity.enum = ['mild']; }, /"reactions\[\]\.severity" enum must be exactly mild, moderate, severe/);
      mutate((t) => { t.required = ['name']; }, /must require "status"/);
      mutate((t) => { delete t.properties.status; }, /must declare the content property "status"/);
      check(item('allergy-basic'));
      const s = item('allergy-basic');
      s.composite.status.canBeNull = true;
      assert.throws(() => check(s), /composite field "status" cannot be null/);
    });

    it('[ALG-FHIR-5] import keys: one datasource-coded and one text-coded item for the bare key', () => {
      checkFhirImportKeys({ a: { fhir: item('allergy-coded').fhir }, b: { fhir: item('allergy-basic').fhir } });
      assert.throws(() => checkFhirImportKeys({ a: { fhir: item('allergy-basic').fhir }, b: { fhir: item('allergy-basic').fhir } }), /fhir import key AllergyIntolerance from text is claimed by both "a" and "b"/);
    });
  });
});
