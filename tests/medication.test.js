const assert = require('assert');
const Ajv = require('ajv');
const AjvDraft04 = require('ajv-draft-04');
const addFormats = require('ajv-formats');

// Medication model pass DM-4 (3.46.0): timing (timeOfDay / when / bounds) on the shared regimen, one intake's
// status + skipReason, stopReason on periods and prescriptions, the prescription status, the typed-name
// prescription, codes minItems 1 (B-2026-10-26-20) and the medication vocabularies. documentation/MEDICATION.md.

const { itemsById, findItemForEvent, itemsByStreamIdTypeId } = require('../src/items');
const { eventTypesById } = require('../src/eventTypes');
const { vocabulariesById, addVocabulary } = require('../src/vocabularies');

const INTAKE_TYPES = ['medication/basic', 'medication/coded-v1'];
const RX_TYPES = ['medication/prescription-v1', 'medication/prescription-basic-v1'];
const regimenOf = (type) => {
  const props = eventTypesById(type).properties;
  return props.intake || props.posology;
};
function stripDescriptions (node) {
  if (Array.isArray(node)) return node.map(stripDescriptions);
  if (node === null || typeof node !== 'object') return node;
  const out = {};
  for (const [k, v] of Object.entries(node)) if (k !== 'description') out[k] = stripDescriptions(v);
  return out;
}

// -- fixtures
const code = { code: 'N02BE01', system: 'ATC', source: { key: 'WHO' }, hdsId: 'S:ATC/k:WHO/C:N02BE01' };
const drug = { label: { en: 'Dafalgan 1 g' }, codes: [code] };
const regimen = { doseValue: 1, doseUnit: 'dose/tablet', route: 'oral', frequency: { times: 2, period: 1, periodUnit: 'd' } };
const intakeContent = (type, extra = {}) => type === 'medication/basic'
  ? { name: 'Dafalgan 1 g', ...extra }
  : { drug, ...extra };
const rxContent = (type, extra = {}) => type === 'medication/prescription-v1'
  ? { drug, ...extra }
  : { name: 'Dafalgan 1 g', ...extra };

describe('[MED] Medication model pass (DM-4, 3.46.0)', () => {
  const validators = {
    'draft-07': new Ajv({ strict: false, allErrors: true, logger: false }),
    'draft-04': (() => {
      const ajv = new AjvDraft04({ strict: false, allErrors: true, coerceTypes: false, validateFormats: true, logger: false });
      addFormats(ajv);
      return ajv;
    })()
  };

  describe('[MED-TIM] the shared regimen', () => {
    it('[MED-TIM-1] the four regimen copies are equal, descriptions aside; the two posology copies byte-equal', () => {
      const ref = stripDescriptions(regimenOf('medication/prescription-v1'));
      for (const type of [...INTAKE_TYPES, ...RX_TYPES]) {
        assert.deepStrictEqual(stripDescriptions(regimenOf(type)), ref, type);
      }
      assert.deepStrictEqual(regimenOf('medication/prescription-basic-v1'), regimenOf('medication/prescription-v1'));
    });

    it('[MED-TIM-2] timing fields and tim-10 on every regimen', () => {
      for (const type of [...INTAKE_TYPES, ...RX_TYPES]) {
        const r = regimenOf(type);
        assert.deepStrictEqual(Object.keys(r.properties),
          ['doseValue', 'doseUnit', 'route', 'frequency', 'asNeeded', 'note', 'timeOfDay', 'when', 'bounds'], type);
        assert.deepStrictEqual(r.not, { required: ['timeOfDay', 'when'] }, type);
        assert.strictEqual(r.properties.when.items.enum.length, 19, type);
      }
    });

    it('[MED-TIM-3] no $ref anywhere in the medication types (cores compile each type alone)', () => {
      for (const type of [...INTAKE_TYPES, ...RX_TYPES]) {
        assert.ok(!JSON.stringify(eventTypesById(type)).includes('"$ref":'), type);
      }
    });
  });

  describe('[MED-RXB] medication-prescription-basic', () => {
    const item = itemsById['medication-prescription-basic'];

    it('[MED-RXB-1] resolves on its own (stream, eventType), beside the coded twin', () => {
      assert.ok(item);
      assert.strictEqual(item.streamId, 'medication-prescription');
      assert.strictEqual(item.eventType, 'medication/prescription-basic-v1');
      assert.strictEqual(findItemForEvent('medication/prescription-basic-v1', 'medication-prescription'), item);
      assert.strictEqual(findItemForEvent('medication/prescription-v1', 'medication-prescription'), itemsById['medication-prescription-coded']);
      const owners = Object.entries(itemsByStreamIdTypeId).filter(([, i]) => i === item).map(([k]) => k);
      assert.deepStrictEqual(owners, ['medication-prescription:medication/prescription-basic-v1']);
    });

    it('[MED-RXB-2] a point event, localized, and its posology form is the intake form', () => {
      assert.strictEqual(item.duration, undefined);
      assert.ok(item.label.fr && item.description.fr && item.composite.name.label.fr && item.composite.posology.label.fr);
      assert.deepStrictEqual(item.composite.posology.composite, itemsById['medication-intake-basic'].composite.intake.composite);
    });
  });

  describe('[MED-LBL] medication-intake-basic labels (DM-4 §7)', () => {
    const item = itemsById['medication-intake-basic'];

    it('[MED-LBL-1] every composite label carries en and fr', () => {
      const walk = (composite, at) => {
        for (const [k, f] of Object.entries(composite)) {
          assert.ok(f.label.en && f.label.fr, `${at}${k}`);
          for (const o of f.options || []) assert.ok(o.label.en && o.label.fr, `${at}${k}=${o.value}`);
          if (f.composite) walk(f.composite, `${at}${k}.`);
        }
      };
      walk(item.composite, '');
    });

    it('[MED-LBL-2] every dose unit the eventType allows is offered, mass/g included', () => {
      const offered = item.composite.intake.composite.doseUnit.options.map((o) => o.value).sort();
      const allowed = [...eventTypesById('medication/basic').properties.intake.properties.doseUnit.enum].sort();
      assert.deepStrictEqual(offered, allowed);
      assert.ok(offered.includes('mass/g'));
    });
  });

  describe('[MED-VOC] vocabularies', () => {
    const expected = {
      'medication-when': ['medication/basic intake.when', 'medication/coded-v1 intake.when', 'medication/prescription-v1 posology.when', 'medication/prescription-basic-v1 posology.when'],
      'medication-intake-status': ['medication/basic status', 'medication/coded-v1 status'],
      'medication-skip-reason': ['medication/basic skipReason', 'medication/coded-v1 skipReason'],
      'medication-stop-reason': ['medication/basic stopReason', 'medication/coded-v1 stopReason', 'medication/prescription-v1 stopReason', 'medication/prescription-basic-v1 stopReason'],
      'medication-prescription-status': ['medication/prescription-v1 status', 'medication/prescription-basic-v1 status']
    };

    it('[MED-VOC-1] each vocabulary binds the expected fields, and its values are their enum', () => {
      assert.deepStrictEqual(Object.keys(vocabulariesById).sort(), Object.keys(expected).sort());
      for (const [key, fields] of Object.entries(expected)) {
        const v = vocabulariesById[key];
        assert.deepStrictEqual(v.binds.map((b) => `${b.eventType} ${b.path}`), fields, key);
        for (const b of v.binds) {
          let node = eventTypesById(b.eventType);
          for (const s of b.path.split('.')) node = node.properties[s];
          const enumValues = node.type === 'array' ? node.items.enum : node.enum;
          assert.deepStrictEqual(Object.keys(v.values), enumValues, `${key} ${b.eventType} ${b.path}`);
        }
        for (const [value, def] of Object.entries(v.values)) assert.ok(def.label.en && def.label.fr, `${key}.${value}`);
      }
    });

    it('[MED-VOC-2] FHIR EventTiming codes for when, 1:1', () => {
      const fhir = Object.entries(vocabulariesById['medication-when'].values).map(([k, v]) => `${k}=${v.fhir}`);
      assert.deepStrictEqual(fhir, [
        'waking=WAKE', 'morning=MORN', 'noon=NOON', 'afternoon=AFT', 'evening=EVE', 'night=NIGHT', 'bedtime=HS',
        'meal=C', 'before-meal=AC', 'after-meal=PC',
        'breakfast=CM', 'before-breakfast=ACM', 'after-breakfast=PCM',
        'lunch=CD', 'before-lunch=ACD', 'after-lunch=PCD',
        'dinner=CV', 'before-dinner=ACV', 'after-dinner=PCV'
      ]);
      assert.strictEqual(new Set(fhir.map((p) => p.split('=')[1])).size, 19);
    });

    it('[MED-VOC-3] SNOMED CT codes as decided (verified active, International 20260201)', () => {
      const snomed = (key) => Object.fromEntries(Object.entries(vocabulariesById[key].values).filter(([, v]) => v.snomed).map(([k, v]) => [k, v.snomed]));
      assert.deepStrictEqual(snomed('medication-skip-reason'),
        { forgot: '1303576005', 'side-effects': '182897004', unavailable: '242990004', declined: '182895007' });
      assert.deepStrictEqual(snomed('medication-stop-reason'),
        { 'medical-advice': '182840001', 'side-effects': '395009001', ineffective: '395007004' });
      assert.deepStrictEqual(snomed('medication-intake-status'), { skipped: '1269470004' });
    });

    it('[MED-VOC-4] FHIR status codes (MedicationRequest R4 and R5; MedicationAdministration)', () => {
      const fhir = (key) => Object.fromEntries(Object.entries(vocabulariesById[key].values).map(([k, v]) => [k, v.fhir]));
      assert.deepStrictEqual(fhir('medication-prescription-status'), { active: 'active', stopped: 'stopped', completed: 'completed' });
      assert.deepStrictEqual(fhir('medication-intake-status'), { taken: 'completed', skipped: 'not-done' });
    });

    it('[MED-VOC-5] the loader refuses a vocabulary that drifts from its enum, or binds a field twice', () => {
      const good = vocabulariesById['medication-prescription-status'];
      const fresh = () => [{}, {}];
      const reordered = { ...good, values: { stopped: good.values.stopped, active: good.values.active, completed: good.values.completed } };
      assert.throws(() => addVocabulary('t', reordered, ...fresh()), /differ from the enum/);
      const extra = { ...good, values: { ...good.values, 'on-hold': { label: { en: 'On hold', fr: 'En pause' } } } };
      assert.throws(() => addVocabulary('t', extra, ...fresh()), /differ from the enum/);
      assert.throws(() => addVocabulary('t', { ...good, binds: [{ eventType: 'medication/basic', path: 'intake.note' }] }, ...fresh()), /not a string enum/);
      assert.throws(() => addVocabulary('t', { ...good, binds: [{ eventType: 'medication/nope', path: 'status' }] }, ...fresh()), /not a string enum/);
      const noFr = { ...good, values: { ...good.values, active: { label: { en: 'Active' } } } };
      assert.throws(() => addVocabulary('t', noFr, ...fresh()), /is invalid/);
      const [registry, bound] = fresh();
      addVocabulary('a', good, registry, bound);
      assert.throws(() => addVocabulary('b', good, registry, bound), /already bound by "a"/);
    });
  });

  describe('[MED-AJV] contents, under both validators', () => {
    for (const [flavour, ajv] of Object.entries(validators)) {
      const compile = (type) => ajv.compile(eventTypesById(type));
      const ok = (validate, content, msg) => assert.ok(validate(content), `${msg}: ${JSON.stringify(validate.errors)}`);
      const ko = (validate, content, msg) => assert.ok(!validate(content), msg);

      it(`[MED-TIM-4-${flavour}] timeOfDay, when, bounds`, () => {
        for (const type of [...INTAKE_TYPES, ...RX_TYPES]) {
          const v = compile(type);
          const key = INTAKE_TYPES.includes(type) ? 'intake' : 'posology';
          const make = INTAKE_TYPES.includes(type) ? intakeContent : rxContent;
          const withRegimen = (r) => make(type, { [key]: { ...regimen, ...r } });
          ok(v, withRegimen({ timeOfDay: ['08:00', '20:00'] }), `${type} timeOfDay`);
          ok(v, withRegimen({ when: ['before-breakfast'] }), `${type} when`);
          ok(v, withRegimen({ bounds: { duration: 7, durationUnit: 'd' } }), `${type} bounds duration`);
          ok(v, withRegimen({ bounds: { start: '2026-11-04', end: '2026-11-11' } }), `${type} bounds period`);
          ok(v, withRegimen({ bounds: { end: '2026-12-12' } }), `${type} bounds end only`);
          ko(v, withRegimen({ timeOfDay: ['08:00'], when: ['morning'] }), `${type} timeOfDay + when (tim-10)`);
          for (const t of ['8:00', '24:00', '08:60', '08:00:00']) ko(v, withRegimen({ timeOfDay: [t] }), `${type} timeOfDay ${t}`);
          ko(v, withRegimen({ timeOfDay: [] }), `${type} empty timeOfDay`);
          ko(v, withRegimen({ timeOfDay: ['08:00', '08:00'] }), `${type} duplicate timeOfDay`);
          ko(v, withRegimen({ when: ['MORN'] }), `${type} FHIR code verbatim`);
          ko(v, withRegimen({ when: ['morning.early'] }), `${type} when refinement`);
          ko(v, withRegimen({ bounds: { duration: 7 } }), `${type} duration without unit (tim-1)`);
          ko(v, withRegimen({ bounds: { durationUnit: 'd' } }), `${type} unit without duration`);
          ko(v, withRegimen({ bounds: { duration: 7, durationUnit: 'd', end: '2026-12-12' } }), `${type} duration + end`);
          ko(v, withRegimen({ bounds: { duration: 0, durationUnit: 'd' } }), `${type} zero course`);
          ko(v, withRegimen({ bounds: { start: '04.11.2026' } }), `${type} start not a date`);
        }
      });

      it(`[MED-ST-1-${flavour}] one intake: taken, skipped with a reason`, () => {
        for (const type of INTAKE_TYPES) {
          const v = compile(type);
          ok(v, intakeContent(type, { status: 'taken' }), `${type} taken`);
          ok(v, intakeContent(type, { status: 'skipped' }), `${type} skipped, no reason`);
          ok(v, intakeContent(type, { status: 'skipped', skipReason: 'forgot', intake: { doseValue: 1, doseUnit: 'dose/tablet' } }), `${type} skipped (forgot)`);
          ko(v, intakeContent(type, { skipReason: 'forgot' }), `${type} reason without status`);
          ko(v, intakeContent(type, { status: 'taken', skipReason: 'forgot' }), `${type} reason on a taken dose`);
          ko(v, intakeContent(type, { status: 'skipped', skipReason: 'lazy' }), `${type} unknown reason`);
          ko(v, intakeContent(type, { status: 'not-done' }), `${type} FHIR status verbatim`);
        }
      });

      it(`[MED-STOP-1-${flavour}] a period with stopReason; prescription status`, () => {
        for (const type of INTAKE_TYPES) {
          const v = compile(type);
          ok(v, intakeContent(type, { intake: regimen, stopReason: 'side-effects' }), `${type} period stopped`);
          ko(v, intakeContent(type, { stopReason: 'bored' }), `${type} unknown stop reason`);
        }
        for (const type of RX_TYPES) {
          const v = compile(type);
          ok(v, rxContent(type, { posology: regimen, status: 'active' }), `${type} active`);
          ok(v, rxContent(type, { status: 'completed', statusChanged: '2026-11-04' }), `${type} completed`);
          ok(v, rxContent(type, { status: 'stopped', statusChanged: '2026-11-04', stopReason: 'medical-advice' }), `${type} stopped`);
          ko(v, rxContent(type, { status: 'ended' }), `${type} R5 ended is not stored`);
          ko(v, rxContent(type, { statusChanged: '2026-11-04' }), `${type} statusChanged alone`);
          ko(v, rxContent(type, { stopReason: 'medical-advice' }), `${type} stopReason without status`);
          ko(v, rxContent(type, { status: 'completed', stopReason: 'medical-advice' }), `${type} stopReason on a completed order`);
          ko(v, rxContent(type, { status: 'active', stopReason: 'medical-advice' }), `${type} stopReason on an active order`);
          ko(v, rxContent(type, { status: 'stopped', statusChanged: '4 Nov 2026' }), `${type} statusChanged not a date`);
        }
      });

      it(`[MED-RXB-3-${flavour}] a -basic prescription`, () => {
        const v = compile('medication/prescription-basic-v1');
        ok(v, { name: 'Levothyrox 50 µg', posology: { doseValue: 1, doseUnit: 'dose/tablet', when: ['before-breakfast'], bounds: { duration: 3, durationUnit: 'mo' } } }, 'typed prescription');
        ok(v, { name: 'Levothyrox 50 µg' }, 'name only');
        ko(v, { name: '' }, 'empty name');
        ko(v, { posology: regimen }, 'no name');
        ko(v, { drug }, 'a coded drug is prescription-v1');
      });

      it(`[MED-CODES-1-${flavour}] codes: [] rejected on both coded types (B-2026-10-26-20)`, () => {
        for (const type of ['medication/coded-v1', 'medication/prescription-v1']) {
          const v = compile(type);
          ko(v, { drug: { label: { en: 'Typed name' }, codes: [] } }, `${type} codes: []`);
          ok(v, { drug }, `${type} one code`);
          ok(v, { drug: { ...drug, codes: [code, { code: '161', system: 'RxNorm', source: { key: 'NLM' }, hdsId: 'S:RxNorm/k:NLM/C:161' }] } }, `${type} two codes`);
        }
      });

      it(`[MED-COMPAT-${flavour}] every pre-3.46.0 shape still validates`, () => {
        const basic = compile('medication/basic');
        ok(basic, { name: 'Aspirin' }, 'basic, name only');
        ok(basic, { name: 'Aspirin', intake: { doseValue: 500, doseUnit: 'mass/mg', route: 'oral' } }, 'basic, a dose');
        ok(basic, { name: 'Aspirin', intake: { ...regimen, asNeeded: true, note: '2 tablets in the morning' } }, 'basic, a period');
        ok(basic, { name: 'Iron', intake: { doseValue: 1, doseUnit: 'mass/g' } }, 'basic, mass/g');
        const coded = compile('medication/coded-v1');
        ok(coded, { drug: { ...drug, description: { en: 'Paracetamol 1 g tablet' } }, intake: regimen }, 'coded');
        const rx = compile('medication/prescription-v1');
        ok(rx, { drug, posology: { ...regimen, note: 'take with food' } }, 'prescription');
      });
    }
  });
});
