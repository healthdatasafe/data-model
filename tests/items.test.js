const assert = require('assert');

describe('[ITMX] Items', () => {
  it('[ITMS] items loads correctly', async () => {
    require('../src/items');
  });
});

describe('[ITMP] repeatable value validation', () => {
  const { checkItem } = require('../src/schemas/items');

  function itemWith (repeatable) {
    return {
      version: 'v1',
      label: { en: 'Test' },
      description: { en: 'Test' },
      streamId: 'test-stream',
      eventType: 'note/txt',
      type: 'text',
      repeatable
    };
  }

  it('[ITMP-1] accepts the named values', () => {
    for (const v of ['once', 'any', 'unlimited']) checkItem(itemWith(v));
  });

  it('[ITMP-2] accepts ISO-8601 durations', () => {
    for (const v of ['P1D', 'P1W', 'P1M', 'P1Y', 'PT12H']) checkItem(itemWith(v));
  });

  it('[ITMP-3] rejects an invented value', () => {
    // `many` was proposed in site-agents#9; it is not a legal value. Before this
    // schema constraint it passed validation and then matched no consumer branch.
    assert.throws(() => checkItem(itemWith('many')));
  });

  it('[ITMP-4] rejects the pre-ISO legacy spellings', () => {
    for (const v of ['daily', 'once-per-day', 'none']) {
      assert.throws(() => checkItem(itemWith(v)), /./, `${v} must be rejected`);
    }
  });
});

describe('[ITMK] item properties (B-2026-10-05-12)', () => {
  const fs = require('fs');
  const path = require('path');
  const YAML = require('yaml');
  const { checkItem } = require('../src/schemas/items');

  const base = {
    version: 'v1',
    label: { en: 'Test' },
    description: { en: 'Test' },
    streamId: 'test-stream',
    eventType: 'note/txt',
    type: 'text',
    repeatable: 'any'
  };

  it('[ITMK-1] refuses an unknown top-level property, naming the item and the key', () => {
    assert.throws(() => checkItem({ ...base, refrences: { snomed: '1' } }, 'test-item'),
      /Item "test-item" has unknown properties: refrences/);
  });

  it('[ITMK-2] accepts references as lists of codes only, and referenceRange', () => {
    checkItem({ ...base, references: { snomed: ['1'], loinc: ['2', '3'], icf: ['d450'] } });
    checkItem({ ...base, referenceRange: null });
    checkItem({ ...base, referenceRange: { source: 'WHO-2021', lowerLimit: 0.3, upperLimit: null, units: 'ratio', population: 'p' } });
    assert.throws(() => checkItem({ ...base, references: { snomed: 1 } }));
    // one code is still a list: a bare string, an empty list or an empty code is refused
    assert.throws(() => checkItem({ ...base, references: { snomed: '1' } }), /must be array/);
    assert.throws(() => checkItem({ ...base, references: { loinc: [] } }), /fewer than 1 items/);
    assert.throws(() => checkItem({ ...base, references: { loinc: [''] } }), /fewer than 1 characters/);
  });

  it('[ITMK-2b] every item lists its references as arrays (B2), and symptom-pain-severity no longer cites the 0-10 score 72514-3 (B1)', () => {
    const { itemsById } = require('../src/items');
    for (const [key, item] of Object.entries(itemsById)) {
      for (const [system, codes] of Object.entries(item.references || {})) {
        assert.ok(Array.isArray(codes), `${key} references.${system} is not an array`);
      }
    }
    assert.ok(!itemsById['symptom-pain-severity'].references.loinc.includes('72514-3'));
  });

  it('[ITMK-3] a schema error reads as text, not [object Object]', () => {
    assert.throws(() => checkItem({ ...base, repeatable: 'many' }, 'test-item'),
      (err) => err.message.startsWith('Item "test-item" is invalid: ') && !err.message.includes('[object Object]'));
  });

  it('[ITMK-4] the README item example passes the schema', () => {
    const readme = fs.readFileSync(path.join(__dirname, '../README.md'), 'utf8');
    const block = readme.split('## Item Definition Format')[1].match(/```yaml\n([\s\S]*?)```/)[1];
    const [[key, item]] = Object.entries(YAML.parse(block));
    checkItem(item, key);
    assert.ok(!(item.eventType && item.variations), 'the example must not mix eventType and variations');
  });
});

describe('[ITMM] multi-select cardinality (site-agents#9 / #10)', () => {
  const { itemsById, checkItemVsEvenType } = require('../src/items');
  const { eventTypesById } = require('../src/eventTypes');

  const CASES = [
    ['profile-ethnicity', 'attributes/ethnicity', 'once'],
    ['fertility-tracking-method', 'fertility/tracking-method-v1', 'any']
  ];

  for (const [key, typeId, repeatable] of CASES) {
    it(`[ITMM-1:${key}] is a multi-select over an array eventType`, () => {
      const item = itemsById[key];
      assert.ok(item, `${key} must exist`);
      assert.equal(item.type, 'multi-select');
      const eventType = eventTypesById(typeId);
      assert.equal(eventType.type, 'array');
      assert.equal(eventType.uniqueItems, true);
      assert.ok(Array.isArray(eventType.items.enum), 'items.enum must exist');
    });

    it(`[ITMM-2:${key}] every option value is in the eventType items.enum`, () => {
      const item = itemsById[key];
      const eventType = eventTypesById(typeId);
      for (const o of item.options) {
        assert.ok(eventType.items.enum.includes(o.value), `${o.value} must be in items.enum`);
      }
      assert.equal(checkItemVsEvenType(key, item, eventType), true);
    });

    it(`[ITMM-3:${key}] repeatable is "${repeatable}"`, () => {
      // Cardinality and recurrence are orthogonal. Ethnicity is not time-varying, so
      // `once` (latest wins). Tracking-method IS time-varying and is the interpretive
      // key for dated cycle observations, so it must NOT be `once` — otherwise past
      // charts get re-read under whatever method is current.
      assert.equal(itemsById[key].repeatable, repeatable);
    });
  }

  it('[ITMM-7] the Hispanic question is answerable both ways (site-agents#11)', () => {
    // Without `not-hispanic-latino`, the ABSENCE of `hispanic-latino` is ambiguous
    // between "not Hispanic" and "didn't answer". This is the gap #11 actually had;
    // it is fixed additively rather than by splitting race from ethnicity.
    const values = itemsById['profile-ethnicity'].options.map(o => o.value);
    assert.ok(values.includes('hispanic-latino'));
    assert.ok(values.includes('not-hispanic-latino'));
  });

  it('[ITMM-8] the value set partitions cleanly for FHIR US Core (site-agents#11)', () => {
    // This is what makes the combined item mappable without splitting it: exactly
    // two values belong to the us-core-ethnicity axis, everything else is race.
    // If a future edit adds an ethnicity-axis value it must be added here too,
    // otherwise the boundary mapper would silently route it to race.
    const ETHNICITY_AXIS = ['hispanic-latino', 'not-hispanic-latino'];
    const values = eventTypesById('attributes/ethnicity').items.enum;
    const raceAxis = values.filter(v => !ETHNICITY_AXIS.includes(v));
    for (const v of ETHNICITY_AXIS) assert.ok(values.includes(v), `${v} must exist`);
    assert.deepEqual(raceAxis, [
      'american-indian-alaska-native',
      'asian',
      'black-african-american',
      'middle-eastern-north-african',
      'native-hawaiian-pacific-islander',
      'white',
      'other',
      'prefer-not-to-say'
    ]);
  });

  it('[ITMM-4] the "multiple" sentinel is gone from ethnicity', () => {
    // It recorded THAT several applied while losing WHICH — the degradation the
    // array shape exists to fix.
    const values = itemsById['profile-ethnicity'].options.map(o => o.value);
    assert.ok(!values.includes('multiple'), '"multiple" must be removed');
    assert.ok(!eventTypesById('attributes/ethnicity').items.enum.includes('multiple'));
  });

  it('[ITMM-5] a multi-select against a scalar eventType is rejected', () => {
    const item = { type: 'multi-select', options: [{ value: 'white' }] };
    assert.throws(
      () => checkItemVsEvenType('bad', item, { type: 'string', enum: ['white'] }),
      /must be an "array"/
    );
  });

  it('[ITMM-6] an option outside items.enum is rejected', () => {
    const item = { type: 'multi-select', options: [{ value: 'nope' }] };
    assert.throws(
      () => checkItemVsEvenType('bad', item, { type: 'array', items: { enum: ['white'] } }),
      /cannot be found in the eventType "items.enum"/
    );
  });
});

describe('[ITMC] Composite↔eventType validation (B-2026-06-12-1)', () => {
  const { itemsById, checkItemVsEvenType } = require('../src/items');
  const { eventTypesById } = require('../src/eventTypes');

  it('[ITMC1] medication-intake-basic nests dose fields under "intake"', () => {
    const item = itemsById['medication-intake-basic'];
    assert.ok(item, 'medication-intake-basic must exist');
    assert.deepEqual(Object.keys(item.composite), ['name', 'intake']);
    assert.equal(item.composite.intake.type, 'composite');
    assert.deepEqual(
      Object.keys(item.composite.intake.composite),
      ['doseValue', 'doseUnit', 'route', 'frequency', 'asNeeded', 'note']
    );
  });

  it('[ITMC1b] intake frequency / asNeeded are spelled exactly as prescription posology (site-agents#31)', () => {
    const posology = eventTypesById('medication/prescription-v1').properties.posology.properties;
    for (const type of ['medication/basic', 'medication/coded-v1']) {
      const intake = eventTypesById(type).properties.intake.properties;
      assert.deepEqual(intake.frequency, posology.frequency, `${type} intake.frequency`);
      assert.deepEqual(intake.asNeeded, posology.asNeeded, `${type} intake.asNeeded`);
      assert.equal(intake.note.type, 'string', `${type} intake.note`);
    }
  });

  it('[ITMC2] valid nested composite passes the check', () => {
    const item = itemsById['medication-intake-basic'];
    const eventType = eventTypesById('medication/basic');
    assert.equal(checkItemVsEvenType('medication-intake-basic', item, eventType), true);
  });

  it('[ITMC3] flat composite (the original bug shape) is rejected', () => {
    const eventType = eventTypesById('medication/basic');
    const flat = {
      type: 'composite',
      composite: {
        name: { label: { en: 'Name' }, type: 'text' },
        doseValue: { label: { en: 'Dose' }, type: 'number', canBeNull: true }
      }
    };
    assert.throws(
      () => checkItemVsEvenType('flat-medication', flat, eventType),
      /field "doseValue" has no matching property/
    );
  });

  it('[ITMC4] composite select value outside the eventType enum is rejected', () => {
    const eventType = eventTypesById('medication/basic');
    const badEnum = {
      type: 'composite',
      composite: {
        name: { label: { en: 'Name' }, type: 'text' },
        intake: {
          label: { en: 'Intake' },
          type: 'composite',
          canBeNull: true,
          composite: {
            doseUnit: {
              label: { en: 'Unit' },
              type: 'select',
              canBeNull: true,
              options: [{ value: 'tablet', label: { en: 'Tablet' } }]
            }
          }
        }
      }
    };
    assert.throws(
      () => checkItemVsEvenType('bad-enum-medication', badEnum, eventType),
      /select value "tablet" is not in the eventType enum/
    );
  });
});

describe('[ITMA] Urine hormone key rename (Plan 83)', () => {
  const { itemsById, findItemForEvent } = require('../src/items');

  // The FSH/hCG/PdG/E3G items were renamed to body-urine-hormones-*. The old keys were kept as
  // deprecated aliases through the migration window (Phase 5) and removed in Phase 6 once every
  // consumer moved. The rename never changed streamId+eventType, so no stored event referenced the
  // item key — removing the aliases orphans nothing.
  const RENAMED = [
    ['fertility-hormone-fsh', 'body-urine-hormones-fsh', 'concentration/iu-l'],
    ['fertility-hormone-hcg', 'body-urine-hormones-hcg', 'concentration/iu-l'],
    ['fertility-hormone-pdg', 'body-urine-hormones-pdg', 'concentration/iu-l'],
    ['fertility-hormone-e3g', 'body-urine-hormones-e3g', 'concentration/ug-l']
  ];

  it('[ITMA-1] the old alias keys are gone', () => {
    for (const [oldKey] of RENAMED) {
      assert.ok(!itemsById[oldKey], `${oldKey} should have been removed in Phase 6`);
    }
  });

  it('[ITMA-2] the active replacement resolves and is not deprecated', () => {
    for (const [, newKey, eventType] of RENAMED) {
      assert.ok(itemsById[newKey], `${newKey} must exist`);
      assert.ok(!itemsById[newKey].deprecated, `${newKey} must be active`);
      assert.equal(itemsById[newKey].eventType, eventType, `${newKey} eventType`);
    }
  });

  it('[ITMA-3] findItemForEvent resolves each pair to its active item', () => {
    for (const [, newKey] of RENAMED) {
      const item = itemsById[newKey];
      const found = findItemForEvent(item.eventType, item.streamId);
      assert.strictEqual(found, itemsById[newKey], `${item.streamId}:${item.eventType} must resolve to ${newKey}`);
    }
  });

  it('[ITMA-4] fertility-hormone-lh is KEPT — old mg/L LH events still resolve to it', () => {
    // Not an alias: LH was mis-typed concentration/mg-l; the active body-urine-hormones-lh uses
    // iu-l, so the pair differs. Historical mg-l events must still find the deprecated item.
    const lh = findItemForEvent('concentration/mg-l', 'body-urine-hormones-lh');
    assert.strictEqual(lh, itemsById['fertility-hormone-lh']);
    assert.equal(itemsById['fertility-hormone-lh'].deprecated, true);
    const lhNew = findItemForEvent('concentration/iu-l', 'body-urine-hormones-lh');
    assert.strictEqual(lhNew, itemsById['body-urine-hormones-lh']);
  });
});

describe('[ITMR] Reproductive stage (site-agents#7)', () => {
  const { itemsById, findItemForEvent } = require('../src/items');
  const { eventTypesById } = require('../src/eventTypes');

  const STAGES = [
    'premenopausal', 'perimenopausal', 'postmenopausal', 'surgical-menopause',
    'primary-ovarian-insufficiency', 'pregnant', 'postpartum', 'lactating'
  ];

  it('[ITMR-1] profile-reproductive-stage exists on attributes/reproductive-stage', () => {
    const item = itemsById['profile-reproductive-stage'];
    assert.ok(item, 'profile-reproductive-stage must exist');
    assert.equal(item.streamId, 'profile-reproductive-stage');
    assert.equal(item.eventType, 'attributes/reproductive-stage');
    assert.equal(item.type, 'select');
    assert.ok(!item.deprecated, 'must be active');
  });

  it('[ITMR-2] it is a dated, repeatable attribute — not set-once', () => {
    // Reproductive stage is time-varying (STRAW+10 progression), so it must NOT be repeatable:once.
    assert.notEqual(itemsById['profile-reproductive-stage'].repeatable, 'once');
  });

  it('[ITMR-3] every option value is a valid STRAW+10 stage in the eventType enum', () => {
    const item = itemsById['profile-reproductive-stage'];
    const eventType = eventTypesById('attributes/reproductive-stage');
    assert.ok(eventType && Array.isArray(eventType.enum), 'eventType enum must exist');
    const values = item.options.map(o => o.value);
    assert.deepEqual(values, STAGES);
    for (const v of values) assert.ok(eventType.enum.includes(v), `${v} must be in the eventType enum`);
  });

  it('[ITMR-4] findItemForEvent resolves the pair to this item', () => {
    const found = findItemForEvent('attributes/reproductive-stage', 'profile-reproductive-stage');
    assert.strictEqual(found, itemsById['profile-reproductive-stage']);
  });
});

describe('[ITMV] Vital signs, daily activity totals, regimen caps (site-agents#25, #30, #32)', () => {
  const { itemsById, findItemForEvent } = require('../src/items');

  const PAIRS = {
    'body-heart-rate': ['body-heart-rate', 'frequency/bpm'],
    'body-oxygen-saturation': ['body-oxygen-saturation', 'ratio/proportion'],
    'body-temperature': ['body-temperature', 'temperature/c'],
    'activity-steps': ['activity-steps', 'count/steps'],
    'activity-distance-walking-running': ['activity-distance-walking-running', 'length/m'],
    'activity-duration-active': ['activity-duration-active', 'time/s']
  };

  it('[ITMV-1] each new item owns its streamId:eventType pair', () => {
    for (const [key, [streamId, eventType]] of Object.entries(PAIRS)) {
      const item = itemsById[key];
      assert.ok(item, `${key} must exist`);
      assert.equal(item.streamId, streamId);
      assert.equal(item.eventType, eventType);
      assert.equal(findItemForEvent(eventType, streamId), item, key);
    }
  });

  it('[ITMV-2] a basal temperature still resolves to body-temperature-basal', () => {
    assert.equal(findItemForEvent('temperature/c', 'body-temperature-basal'), itemsById['body-temperature-basal']);
    assert.equal(findItemForEvent('temperature/c', 'body-temperature'), itemsById['body-temperature']);
  });

  it('[ITMV-3] daily totals are one-day periods, one per day', () => {
    for (const key of ['activity-steps', 'activity-distance-walking-running', 'activity-duration-active']) {
      const item = itemsById[key];
      assert.equal(item.repeatable, 'P1D', key);
      assert.equal(item.duration.mandatory, true, key);
      assert.equal(item.duration.canBeNull, false, key);
    }
  });

  it('[ITMV-4] regimen items allow 50 years; fertility caps are untouched', () => {
    for (const key of ['treatment-basic', 'treatment-coded', 'medication-intake-basic', 'medication-intake-coded']) {
      assert.equal(itemsById[key].duration.maxSeconds, 50 * 365 * 86400, key);
    }
  });
});
