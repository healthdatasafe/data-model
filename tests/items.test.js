const assert = require('assert');

describe('[ITMX] Items', () => {
  it('[ITMS] items loads correctly', async () => {
    require('../src/items');
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
      ['doseValue', 'doseUnit', 'route']
    );
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
