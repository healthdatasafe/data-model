const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

describe('[FHIR] item fhir blocks (plan 115)', () => {
  const { itemsById, fhirScopes, toBePublished } = require('../src/items');
  const { checkItem, toBePublished: schemasToBePublished } = require('../src/schemas/items');
  const { checkFhirMapping, checkFhirScopes, computeFhirScopes, readLock, mergeLock, fhirMapping, UNMAPPED, PATIENT_ELEMENTS } = require('../src/fhir');

  const MAPPED = ['body-weight', 'body-blood-pressure', 'body-heart-rate', 'lifestyle-tobacco-smoking', 'condition-coded', 'wellbeing-general-health'];
  const item = (k) => structuredClone(itemsById[k]);
  const eventTypesOf = (it) => it.variations?.eventType ? it.variations.eventType.options.map((o) => o.value) : [it.eventType];
  const check = (it, key = 'x') => checkFhirMapping(key, it, eventTypesOf(it));
  const coding = (code, system = 'http://loinc.org') => ({ system, code, display: `display ${code}` });

  describe('[FHIR-ITEM] the shipped blocks', () => {
    it('[FHIR-ITEM-1] the mapped items load and keep their blocks; the VAS slider is unmapped', () => {
      for (const k of MAPPED) assert.ok(itemsById[k].fhir, `${k} has no fhir block`);
      assert.strictEqual(itemsById['wellbeing-self-rated-health'].fhir, undefined);
    });

    it('[FHIR-ITEM-2] wellbeing-general-health: 5 levels, higher is better, LOINC answers on every option', () => {
      const gh = itemsById['wellbeing-general-health'];
      assert.strictEqual(gh.eventType, 'ratio/proportion');
      assert.deepStrictEqual(gh.options.map((o) => [o.value, o.label.en]), [[1, 'Excellent'], [0.75, 'Very good'], [0.5, 'Good'], [0.25, 'Fair'], [0, 'Poor']]);
      assert.deepStrictEqual(gh.fhir.code, { system: 'http://loinc.org', code: '61577-3', display: 'In general, would you say your health is [PROMIS]' });
      // keyed by String(option value): 1.0 is "1", 0.0 is "0"
      assert.deepStrictEqual(Object.fromEntries(Object.entries(gh.fhir.value.options).map(([k, c]) => [k, c.code])),
        { 1: 'LA9206-9', 0.75: 'LA13913-1', 0.5: 'LA8967-7', 0.25: 'LA8968-5', 0: 'LA8969-3' });
      assert.strictEqual(gh.fhir.profiles.ips, undefined, 'no IPS profile: base resource');
    });

    it('[FHIR-ITEM-3] condition-coded takes its code from the datasource selection and has no value', () => {
      const c = itemsById['condition-coded'].fhir;
      assert.deepStrictEqual(c.code, { from: 'datasource', field: 'condition' });
      assert.strictEqual(c.value, undefined);
    });

    it('[FHIR-ITEM-4] the Patient is assembled from profile items; the other profile items stay unmapped', () => {
      const elements = Object.fromEntries(Object.entries(itemsById).filter(([, it]) => it.fhir?.element != null).map(([k, it]) => [k, it.fhir.element]));
      assert.deepStrictEqual(elements, {
        'profile-addresscountry': 'address.country',
        'profile-date-of-birth': 'birthDate',
        'profile-name': 'name.given',
        'profile-surname': 'name.family',
        'profile-sex': 'gender'
      });
      for (const k of ['profile-birthcountry', 'profile-ethnicity', 'profile-avatar', 'profile-display-name', 'profile-reproductive-stage']) {
        assert.strictEqual(itemsById[k].fhir, undefined, `${k} is mapped`);
      }
      assert.deepStrictEqual(Object.fromEntries(Object.entries(itemsById['profile-sex'].fhir.value.options).map(([k, c]) => [k, c.code])), { male: 'male', female: 'female' });
    });

    it('[FHIR-ITEM-5] import-only codings: 55284-4 on blood pressure, the finer US Core smoking answers on `current`, survey and encounter-diagnosis categories', () => {
      const bp = itemsById['body-blood-pressure'].fhir;
      assert.deepStrictEqual(bp.alsoMatch, [{ system: 'http://loinc.org', code: '55284-4', display: 'Blood pressure systolic and diastolic' }]);
      const smoke = itemsById['lifestyle-tobacco-smoking'].fhir;
      assert.deepStrictEqual(Object.keys(smoke.value.alsoMatch), ['current']);
      assert.deepStrictEqual(smoke.value.alsoMatch.current.map((c) => [c.code, c.display]), [
        ['449868002', 'Smokes tobacco daily'],
        ['428041000124106', 'Occasional tobacco smoker'],
        ['428071000124103', 'Heavy tobacco smoker'],
        ['428061000124105', 'Light tobacco smoker']
      ]);
      assert.deepStrictEqual(smoke.alsoMatchCategories, ['survey']);
      assert.deepStrictEqual(itemsById['condition-coded'].fhir.alsoMatchCategories, ['encounter-diagnosis']);
    });

    it('[FHIR-ITEM-6] body-heart-rate: 8867-4 in /min, the same code the blood-pressure split renders the pulse with', () => {
      const hr = itemsById['body-heart-rate'].fhir;
      assert.deepStrictEqual(hr.code, { system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' });
      assert.deepStrictEqual(hr.value, { kind: 'quantity', units: { 'frequency/bpm': '/min' } });
      assert.deepStrictEqual(hr.code, itemsById['body-blood-pressure'].fhir.split.rate.code);
      assert.deepStrictEqual(hr.profiles, itemsById['body-blood-pressure'].fhir.split.rate.profiles);
    });
  });

  describe('[FHIR-SCH] the schema', () => {
    it('[FHIR-SCH-1] refuses a label instead of a canonical system URI, a coding without display, and unknown keys', () => {
      const a = item('body-weight');
      a.fhir.code.system = 'loinc';
      assert.throws(() => checkItem(a, 'w'), /pattern/);
      const b = item('body-weight');
      delete b.fhir.code.display;
      assert.throws(() => checkItem(b, 'w'), /display/);
      const c = item('body-weight');
      c.fhir.extra = 1;
      assert.throws(() => checkItem(c, 'w'), /additional properties/);
    });

    it('[FHIR-SCH-2] discriminates by value kind: a field of another kind is refused', () => {
      const a = item('body-weight');
      a.fhir.value.options = { 1: coding('1') };
      assert.throws(() => checkItem(a, 'w'), /additional properties/);
      const b = item('lifestyle-tobacco-smoking');
      b.fhir.value.units = { x: 'kg' };
      assert.throws(() => checkItem(b, 's'), /additional properties/);
      const c = item('body-blood-pressure');
      c.fhir.value.units = { x: 'kg' };
      assert.throws(() => checkItem(c, 'bp'), /additional properties/);
      const d = item('body-weight');
      delete d.fhir.value.units;
      assert.throws(() => checkItem(d, 'w'), /units/);
    });

    it('[FHIR-SCH-3] removed shapes are refused: scaled, datasource-codes, split pair, null profile, empty unit', () => {
      const a = item('wellbeing-general-health');
      a.fhir.value = { kind: 'scaled', multiplier: 100 };
      assert.throws(() => checkItem(a, 'gh'), /allowed values/);
      const b = item('condition-coded');
      b.fhir.value = { kind: 'datasource-codes', field: 'condition' };
      assert.throws(() => checkItem(b, 'c'), /allowed values/);
      const c = item('body-blood-pressure');
      c.fhir.split.rate.category = 'vital-signs';
      assert.throws(() => checkItem(c, 'bp'), /additional properties/);
      const d = item('wellbeing-general-health');
      d.fhir.profiles.ips = null;
      assert.throws(() => checkItem(d, 'gh'), /must be string/);
      const e = item('body-weight');
      e.fhir.value.units['mass/kg'] = '';
      assert.throws(() => checkItem(e, 'w'), /fewer than 1 characters/);
    });

    it('[FHIR-SCH-4] a code source is `{ from: datasource, field }` and nothing else', () => {
      const a = item('condition-coded');
      a.fhir.code.from = 'content';
      assert.throws(() => checkItem(a, 'c'), /allowed values/);
      const b = item('condition-coded');
      b.fhir.code.display = 'x';
      assert.throws(() => checkItem(b, 'c'), /additional properties/);
    });

    it('[FHIR-SCH-5] a companion block holds companionOf only', () => {
      const a = item('body-temperature-basal');
      a.fhir = { companionOf: 'body-weight' };
      checkItem(a, 't');
      a.fhir.category = 'vital-signs';
      assert.throws(() => checkItem(a, 't'), /additional properties/);
    });

    it('[FHIR-SCH-7] a Patient element block holds resourceType, element and value only; the element list is the checker\'s', () => {
      const a = item('profile-name');
      a.fhir.element = 'name.prefix';
      assert.throws(() => checkItem(a, 'n'), /allowed values/);
      const b = item('profile-name');
      b.fhir.category = 'demographics';
      assert.throws(() => checkItem(b, 'n'), /additional properties/);
      const c = item('profile-name');
      c.fhir.profiles = {};
      assert.throws(() => checkItem(c, 'n'), /additional properties/);
      const d = item('profile-name');
      d.fhir.resourceType = 'Practitioner';
      assert.throws(() => checkItem(d, 'n'), /allowed values/);
      const [, defsSchema] = schemasToBePublished().map((f) => f.content);
      assert.deepStrictEqual(defsSchema.definitions.fhirElement.properties.element.enum, Object.keys(PATIENT_ELEMENTS));
    });

    it('[FHIR-SCH-6] round trip: every published item validates against the published schema, compiled afresh', () => {
      const [itemSchema, defsSchema] = schemasToBePublished().map((f) => JSON.parse(JSON.stringify(f.content)));
      const ajv = new Ajv({ schemas: [itemSchema, defsSchema], allowUnionTypes: true });
      const validate = ajv.getSchema(itemSchema.$id);
      const published = JSON.parse(JSON.stringify(toBePublished()[0].content));
      for (const [key, it] of Object.entries(published)) {
        assert.ok(validate(it), `${key}: ${ajv.errorsText(validate.errors)}`);
      }
    });
  });

  describe('[FHIR-MAP] the block agrees with its item', () => {
    it('[FHIR-MAP-1] quantity units cover exactly the item eventTypes, on number items only', () => {
      const a = item('body-weight');
      delete a.fhir.value.units['mass/lb'];
      assert.throws(() => check(a), /missing \[mass\/lb\]/);
      const b = item('body-weight');
      b.fhir.value.units['mass/g'] = 'g';
      assert.throws(() => check(b), /unknown \[mass\/g\]/);
      const c = item('wellbeing-general-health');
      c.fhir.value = { kind: 'quantity', units: { 'ratio/proportion': '1' } };
      assert.throws(() => check(c), /applies to "number" items only/);
    });

    it('[FHIR-MAP-2] coded options match the item options and codings are unique within the item', () => {
      const a = item('lifestyle-tobacco-smoking');
      delete a.fhir.value.options.current;
      assert.throws(() => check(a), /missing \[current\]/);
      const b = item('lifestyle-tobacco-smoking');
      b.fhir.value.options.current = b.fhir.value.options.former;
      assert.throws(() => check(b), /appears more than once/);
    });

    it('[FHIR-MAP-3] coded is refused on a multi-select', () => {
      const ms = Object.entries(itemsById).find(([, it]) => it.type === 'multi-select');
      assert.ok(ms, 'the model has a multi-select item');
      const it = structuredClone(ms[1]);
      it.fhir = { resourceType: 'Observation', category: 'survey', code: coding('1'), value: { kind: 'coded', options: {} }, profiles: {} };
      for (const o of it.options) it.fhir.value.options[String(o.value)] = coding(String(o.value));
      assert.throws(() => check(it), /multi-select is not supported/);
    });

    it('[FHIR-MAP-4] category is required for Observation and Condition, and checked against its resourceType table', () => {
      const a = item('body-weight');
      a.fhir.category = 'vital-sign';
      assert.throws(() => check(a), /unknown Observation category "vital-sign"/);
      const b = item('body-weight');
      delete b.fhir.category;
      assert.throws(() => check(b), /needs a "category"/);
      const c = item('body-weight');
      c.fhir.category = 'problem-list-item';
      assert.throws(() => check(c), /unknown Observation category/);
      const d = item('condition-coded');
      d.fhir.category = 'health-concern';
      check(d);
      d.fhir.category = 'vital-signs';
      assert.throws(() => check(d), /unknown Condition category/);
    });

    it('[FHIR-MAP-5] split and component fields are numeric composite fields, never both', () => {
      const a = item('body-blood-pressure');
      a.fhir.split.pulse = a.fhir.split.rate;
      assert.throws(() => check(a), /split "pulse" is not a composite field/);
      const b = item('body-blood-pressure');
      b.fhir.value.components.rate = { code: coding('8867-4'), unit: '/min' };
      assert.throws(() => check(b), /both a component and a split/);
      const c = item('body-blood-pressure');
      c.composite.rate.type = 'text';
      assert.throws(() => check(c), /must be a numeric composite field/);
    });

    it('[FHIR-MAP-6] every composite field is mapped or listed in ignore', () => {
      const a = item('body-blood-pressure');
      delete a.fhir.split;
      assert.throws(() => check(a), /composite field "rate" is neither mapped nor listed in "ignore"/);
      a.fhir.ignore = ['rate'];
      check(a);
      a.fhir.ignore = ['rate', 'systolic'];
      assert.throws(() => check(a), /both mapped and ignored/);
      a.fhir.ignore = ['rate', 'mean'];
      assert.throws(() => check(a), /ignore "mean" is not a composite field/);
    });

    it('[FHIR-MAP-7] a split code differs from the parent code and components', () => {
      const a = item('body-blood-pressure');
      a.fhir.split.rate.code = a.fhir.value.components.systolic.code;
      assert.throws(() => check(a), /appears more than once/);
    });

    it('[FHIR-MAP-8] Condition rules: no value, a datasource source must name a datasource field', () => {
      const a = item('condition-coded');
      a.fhir.value = { kind: 'coded', options: { x: coding('x') } };
      assert.throws(() => check(a), /a Condition has no value\[x\]/);
      const b = item('condition-coded');
      b.fhir.code.field = 'notes';
      assert.throws(() => check(b), /does not hold a datasets-service "codes" array|is not a content property/);
      const c = item('condition-coded');
      c.fhir.code.field = 'nothing';
      assert.throws(() => check(c), /is not a content property of eventType "condition\/coded-v1"/);
      const d = item('condition-coded');
      delete d.fhir.code;
      assert.throws(() => checkItem(d, 'c'), /required property 'code'/);
    });

    it('[FHIR-MAP-9] a datasource source on a non-datasource item is refused', () => {
      const a = item('body-weight');
      a.fhir = { resourceType: 'Observation', category: 'vital-signs', code: { from: 'datasource', field: 'x' }, profiles: {} };
      assert.throws(() => check(a), /datasource code source needs an item with exactly one eventType|is not a content property/);
      const b = item('wellbeing-general-health');
      b.fhir = { resourceType: 'Observation', category: 'survey', code: { from: 'datasource', field: 'x' }, profiles: {} };
      assert.throws(() => check(b), /is not a content property/);
    });

    it('[FHIR-MAP-10] alsoMatch: static code only, and not a repeat of the code', () => {
      const a = item('body-weight');
      a.fhir.alsoMatch.push(a.fhir.code);
      assert.throws(() => check(a), /appears more than once/);
      const b = item('condition-coded');
      b.fhir.alsoMatch = [coding('1')];
      assert.throws(() => check(b), /"alsoMatch" applies to a static code only/);
    });

    it('[FHIR-MAP-11] a Patient element takes an item of its type, and the content as written unless coded', () => {
      const a = item('profile-name');
      a.fhir.element = 'birthDate';
      assert.throws(() => check(a), /element "birthDate" takes a "date" item; item type is "text"/);
      const b = item('profile-date-of-birth');
      b.fhir.value = { kind: 'coded', options: { x: coding('x') } };
      assert.throws(() => check(b), /takes the content as written; remove "value"/);
      const c = item('profile-sex');
      delete c.fhir.value;
      assert.throws(() => check(c), /needs value.kind "coded"/);
      const d = item('profile-ethnicity');
      d.fhir = { resourceType: 'Patient', element: 'gender' };
      assert.throws(() => check(d), /takes a "select" item; item type is "multi-select"/);
    });

    it('[FHIR-MAP-12] gender: one administrative-gender coding per option, with its official display', () => {
      const a = item('profile-sex');
      a.fhir.value.options.female = { system: 'http://hl7.org/fhir/administrative-gender', code: 'female', display: 'Woman' };
      assert.throws(() => check(a), /option "female": .* is not a code of http:\/\/hl7.org\/fhir\/administrative-gender with its display/);
      const b = item('profile-sex');
      b.fhir.value.options.female = { system: 'http://snomed.info/sct', code: '248152002', display: 'Female' };
      assert.throws(() => check(b), /is not a code of/);
      const c = item('profile-sex');
      c.fhir.value.options.female = c.fhir.value.options.male;
      assert.throws(() => check(c), /appears more than once/);
      const d = item('profile-sex');
      delete d.fhir.value.options.female;
      assert.throws(() => check(d), /missing \[female\]/);
      const e = item('profile-sex');
      e.options.push({ value: 'not-stated', label: { en: 'Not stated' } });
      e.fhir.value.options['not-stated'] = { system: 'http://hl7.org/fhir/administrative-gender', code: 'unknown', display: 'Unknown' };
      check(e);
      const f = item('profile-sex');
      f.fhir.value.alsoMatch = { female: [{ system: 'http://hl7.org/fhir/administrative-gender', code: 'other', display: 'Other' }] };
      checkItem(f, 'sex');
      assert.throws(() => check(f), /takes no value.alsoMatch/);
    });

    it('[FHIR-MAP-13] value.alsoMatch: per option, keys are options, codings unique across options and alsoMatch, coded only', () => {
      const ok = item('lifestyle-tobacco-smoking');
      check(ok);
      const a = item('lifestyle-tobacco-smoking');
      a.fhir.value.alsoMatch.sometimes = [coding('1', 'http://snomed.info/sct')];
      assert.throws(() => check(a), /value.alsoMatch "sometimes" is not an option of the block/);
      const b = item('lifestyle-tobacco-smoking');
      b.fhir.value.alsoMatch.former = [b.fhir.value.options.never];
      assert.throws(() => check(b), /value.options and value.alsoMatch: the coding http:\/\/snomed.info\/sct\|266919005 appears more than once/);
      const c = item('lifestyle-tobacco-smoking');
      c.fhir.value.alsoMatch.former = [c.fhir.value.alsoMatch.current[0]];
      assert.throws(() => check(c), /appears more than once/);
      const d = item('body-weight');
      d.fhir.value.alsoMatch = { 'mass/kg': [coding('1')] };
      assert.throws(() => checkItem(d, 'w'), /additional properties/);
      const e = item('lifestyle-tobacco-smoking');
      e.fhir.value.alsoMatch.current = [];
      assert.throws(() => checkItem(e, 's'), /fewer than 1 items/);
      const g = item('lifestyle-tobacco-smoking');
      delete g.fhir.value.alsoMatch.current[0].display;
      assert.throws(() => checkItem(g, 's'), /display/);
    });

    it('[FHIR-MAP-14] alsoMatchCategories: known keys of the resourceType table, never the block\'s own, refused without a table', () => {
      const a = item('lifestyle-tobacco-smoking');
      a.fhir.alsoMatchCategories = ['surveys'];
      assert.throws(() => check(a), /alsoMatchCategories: unknown Observation category "surveys"/);
      const b = item('lifestyle-tobacco-smoking');
      b.fhir.alsoMatchCategories = ['social-history'];
      assert.throws(() => check(b), /"social-history" is the block's own category/);
      const c = item('condition-coded');
      c.fhir.alsoMatchCategories = ['survey'];
      assert.throws(() => check(c), /unknown Condition category "survey"/);
      const d = item('lifestyle-tobacco-smoking');
      d.fhir.alsoMatchCategories = ['survey', 'survey'];
      assert.throws(() => checkItem(d, 's'), /duplicate items/);
      const e = item('profile-name');
      e.fhir.alsoMatchCategories = ['survey'];
      assert.throws(() => checkItem(e, 'n'), /additional properties/);
    });

    it('[FHIR-MAP-15] the resource code\'s alsoMatch never repeats a component or split code', () => {
      const a = item('body-blood-pressure');
      a.fhir.alsoMatch.push(a.fhir.split.rate.code);
      assert.throws(() => check(a), /code, components and split codes: the coding http:\/\/loinc.org\|8867-4 appears more than once/);
    });
  });

  describe('[FHIR-SCOPE] the SMART scope grant table', () => {
    const obs = (category, code = '1') => ({ resourceType: 'Observation', category, code: coding(code), value: { kind: 'quantity', units: { 'mass/kg': 'kg' } }, profiles: {} });
    const it_ = (streamId, fhir, extra = {}) => ({ streamId, ...(fhir ? { fhir } : {}), ...extra });
    const tree = [
      { id: 'body', children: [{ id: 'body-a', children: [{ id: 'body-a-flag' }] }, { id: 'body-b' }] },
      { id: 'mood' }
    ];
    const run = (items, lock = {}) => checkFhirScopes(items, { roots: tree, lock });

    it('[FHIR-SCOPE-1] grants the maximal subtree roots holding one pair', () => {
      const grants = run({ a: it_('body-a', obs('vital-signs', 'a')), f: it_('body-a-flag', obs('vital-signs', 'f')), b: it_('body-b', obs('vital-signs', 'b')) });
      assert.deepStrictEqual(grants, { 'Observation|vital-signs': ['body'] });
    });

    it('[FHIR-SCOPE-2] a root that carries no item descends into its children', () => {
      const grants = run({ a: it_('body-a', obs('vital-signs', 'a')), b: it_('body-b', obs('survey', 'b')), m: it_('mood') });
      assert.deepStrictEqual(grants, { 'Observation|survey': ['body-b'], 'Observation|vital-signs': ['body-a'] });
    });

    it('[FHIR-SCOPE-3] a mapped parent with an unmapped child fails, with another pair too', () => {
      assert.throws(() => run({ a: it_('body-a', obs('vital-signs')), f: it_('body-a-flag') }), /stream "body-a" carries a mapped or companion item but its subtree spans \(unmapped\), Observation\|vital-signs/);
      assert.throws(() => run({ a: it_('body-a', obs('vital-signs', 'a')), f: it_('body-a-flag', obs('survey', 'f')) }), /spans Observation\|survey, Observation\|vital-signs/);
    });

    it('[FHIR-SCOPE-4] unmapped streams are never granted and do not fail on their own', () => {
      const { grants, violations } = computeFhirScopes({ a: it_('body-a'), f: it_('body-a-flag', obs('vital-signs')) }, tree);
      assert.deepStrictEqual(grants, { 'Observation|vital-signs': ['body-a-flag'] });
      assert.deepStrictEqual(violations, []);
    });

    it('[FHIR-SCOPE-5] deprecated items count: with their mapping, or as unmapped', () => {
      assert.throws(() => run({ a: it_('body-a', obs('vital-signs')), old: it_('body-a', null, { deprecated: true }) }), /\(unmapped\)/);
      // body-b carries no item, so body's whole subtree holds one pair
      const grants = run({ a: it_('body-a', obs('vital-signs', 'a')), old: it_('body-a-flag', obs('vital-signs', 'o'), { deprecated: true }) });
      assert.deepStrictEqual(grants, { 'Observation|vital-signs': ['body'] });
    });

    it('[FHIR-SCOPE-6] a companion counts as its parent\'s pair', () => {
      const grants = run({ a: it_('body-a', obs('vital-signs')), f: it_('body-a-flag', { companionOf: 'a' }), b: it_('body-b') });
      assert.deepStrictEqual(grants, { 'Observation|vital-signs': ['body-a'] });
    });

    it('[FHIR-SCOPE-7] a companion needs a mapped parent and a stream inside the parent\'s subtree', () => {
      assert.throws(() => run({ a: it_('body-a'), f: it_('body-a-flag', { companionOf: 'a' }) }), /the parent must carry a mapping/);
      assert.throws(() => run({ f: it_('body-a-flag', { companionOf: 'nope' }) }), /no such item/);
      assert.throws(() => run({ a: it_('body-a-flag', obs('vital-signs')), f: it_('body-a', { companionOf: 'a' }) }), /is not inside the parent's stream subtree/);
      assert.throws(() => run({ a: it_('body-a', obs('vital-signs')), c: it_('body-a-flag', { companionOf: 'a' }), d: it_('body-a-flag', { companionOf: 'c' }) }), /the parent must carry a mapping/);
    });

    it('[FHIR-SCOPE-8] the lock: a widened root fails, a new root passes, a vanished root fails', () => {
      const lock = { 'Observation|vital-signs': ['body-a'] };
      assert.throws(() => run({ f: it_('body-a-flag', obs('survey', 'f')) }, { 'Observation|vital-signs': ['body-a-flag'] }), /"body-a-flag" was published as a grant root of Observation\|vital-signs; its subtree now also holds Observation\|survey/);
      assert.throws(() => run({ a: it_('body-a', obs('vital-signs', 'a')), b: it_('body-b') }, { 'Observation|vital-signs': ['body'] }), /"body" was published .* now also holds \(unmapped\)/);
      const grants = run({ a: it_('body-a', obs('vital-signs', 'a')), b: it_('body-b', obs('survey', 'b')) }, lock);
      assert.deepStrictEqual(grants, { 'Observation|survey': ['body-b'], 'Observation|vital-signs': ['body-a'] });
      assert.throws(() => run({ a: it_('body-a', obs('vital-signs')) }, { 'Observation|vital-signs': ['gone'] }), /"gone" .* is no longer a stream/);
    });

    it('[FHIR-SCOPE-12] Patient elements: a bare scope key, one active item per element, never a companion parent', () => {
      const el = (element) => ({ resourceType: 'Patient', element });
      const grants = run({ a: it_('body-a', el('name.given')), f: it_('body-a-flag', el('name.family')), b: it_('body-b') });
      assert.deepStrictEqual(grants, { Patient: ['body-a'] });
      assert.throws(() => run({ a: it_('body-a', el('gender')), b: it_('body-b', el('gender')) }), /fhir import key Patient\.gender is claimed by both "a" and "b"/);
      run({ a: it_('body-a', el('gender')), b: it_('body-b', el('gender'), { deprecated: true }) });
      assert.throws(() => run({ a: it_('body-a', el('gender')), f: it_('body-a-flag', { companionOf: 'a' }) }), /the parent is a Patient element/);
      assert.throws(() => run({ a: it_('body-a', el('gender')), f: it_('body-a-flag') }), /spans \(unmapped\), Patient/);
    });

    it('[FHIR-SCOPE-9] mergeLock adds and never removes', () => {
      const merged = mergeLock({ 'Observation|survey': ['x'] }, { 'Observation|survey': ['y'], 'Condition|problem-list-item': ['c'] });
      assert.deepStrictEqual(merged, { 'Condition|problem-list-item': ['c'], 'Observation|survey': ['x', 'y'] });
    });

    it('[FHIR-SCOPE-10] import keys are unique across active items', () => {
      assert.throws(() => run({ a: it_('body-a', obs('vital-signs', 'same')), b: it_('body-b', obs('vital-signs', 'same')) }), /claimed by both "a" and "b"/);
      const withAlso = obs('vital-signs', 'b');
      withAlso.alsoMatch = [coding('a')];
      assert.throws(() => run({ a: it_('body-a', obs('vital-signs', 'a')), b: it_('body-b', withAlso) }), /claimed by both/);
      run({ a: it_('body-a', obs('vital-signs', 'same')), b: it_('body-b', obs('vital-signs', 'same'), { deprecated: true }) });
    });

    it('[FHIR-SCOPE-13] datasource import keys are per category the block accepts; a split code is no import key', () => {
      const { checkFhirImportKeys } = require('../src/fhir');
      const ds = (category, also) => ({ resourceType: 'Condition', category, ...(also ? { alsoMatchCategories: also } : {}), code: { from: 'datasource', field: 'x' }, profiles: {} });
      checkFhirImportKeys({ a: { fhir: ds('problem-list-item') }, b: { fhir: ds('health-concern') } });
      assert.throws(() => checkFhirImportKeys({ a: { fhir: ds('problem-list-item') }, b: { fhir: ds('problem-list-item') } }), /Condition\|problem-list-item from datasource is claimed by both "a" and "b"/);
      assert.throws(() => checkFhirImportKeys({ a: { fhir: ds('problem-list-item', ['encounter-diagnosis']) }, b: { fhir: ds('encounter-diagnosis') } }), /Condition\|encounter-diagnosis from datasource is claimed by both/);
      // the heart-rate item claims 8867-4; the blood-pressure split renders with it and still loads
      assert.strictEqual(itemsById['body-heart-rate'].fhir.code.code, itemsById['body-blood-pressure'].fhir.split.rate.code.code);
      checkFhirImportKeys(itemsById);
    });

    it('[FHIR-SCOPE-11] the model\'s table, every grant root in the committed lock (run npm run fhir:lock)', () => {
      assert.deepStrictEqual(fhirScopes, {
        'Condition|problem-list-item': ['condition'],
        'Observation|social-history': ['lifestyle-tobacco-smoking'],
        'Observation|survey': ['wellbeing-general-health'],
        'Observation|vital-signs': ['body-blood-pressure', 'body-heart-rate', 'body-weight'],
        Patient: ['profile-address', 'profile-date-of-birth', 'profile-name', 'profile-sex']
      });
      assert.deepStrictEqual(mergeLock(readLock(), fhirScopes), readLock(), 'a grant root is missing from definitions/fhir/scopes.lock.json');
      assert.ok(!JSON.stringify(fhirScopes).includes(UNMAPPED));
    });
  });

  describe('[FHIR-PACK] what readers download', () => {
    it('[FHIR-PACK-1] the pack carries fhirScopes and fhirMapping (in memory, as build.js assembles them)', () => {
      const byPack = Object.fromEntries(toBePublished().filter((f) => f.includeInPack).map((f) => [f.includeInPack, f.content]));
      assert.deepStrictEqual(byPack.fhirScopes, fhirScopes);
      const m = byPack.fhirMapping;
      assert.strictEqual(m.formatVersion, 1);
      assert.strictEqual(m.fhirVersion, '4.0.1');
      assert.deepStrictEqual(m.flavours, { us: 'hl7.fhir.us.core#6.1.0', ips: 'hl7.fhir.uv.ips#2.0.1', ch: 'ch.fhir.ig.ch-core#6.0.0' });
      assert.deepStrictEqual(Object.keys(m.categories.Observation), ['vital-signs', 'social-history', 'survey', 'laboratory', 'exam', 'imaging', 'procedure', 'therapy', 'activity']);
      assert.deepStrictEqual(Object.keys(m.categories.Condition), ['problem-list-item', 'encounter-diagnosis', 'health-concern']);
      assert.strictEqual(m.systems['SNOMED-CT'], 'http://snomed.info/sct');
      assert.strictEqual(m.systems['ICD-10'], 'http://hl7.org/fhir/sid/icd-10');
      assert.strictEqual(fhirMapping, m);
    });

    it('[FHIR-PACK-2] the built dist/pack.json carries them', () => {
      const p = path.join(__dirname, '../dist/pack.json');
      if (!fs.existsSync(p)) return; // npm run build has not run yet
      const pack = JSON.parse(fs.readFileSync(p, 'utf-8'));
      assert.deepStrictEqual(pack.fhirScopes, fhirScopes);
      assert.strictEqual(pack.fhirMapping.formatVersion, 1);
    });
  });
});
