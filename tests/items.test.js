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

describe('[ITMA] Deprecated rename aliases (Plan 83)', () => {
  const { itemsById, findItemForEvent } = require('../src/items');

  // Renaming an item key is breaking for consumers that reference it. Keeping the old key as a
  // deprecated alias — same streamId, same eventType — makes the rename non-breaking: forKey still
  // resolves it, so consumers migrate on their own schedule, while the active item owns the
  // storage-identity index so findItemForEvent stays unambiguous.
  const ALIASES = [
    ['fertility-hormone-fsh', 'body-urine-hormones-fsh'],
    ['fertility-hormone-hcg', 'body-urine-hormones-hcg'],
    ['fertility-hormone-pdg', 'body-urine-hormones-pdg'],
    ['fertility-hormone-e3g', 'body-urine-hormones-e3g']
  ];

  it('[ITMA-1] the old key still resolves, and is marked deprecated', () => {
    for (const [oldKey] of ALIASES) {
      assert.ok(itemsById[oldKey], `${oldKey} must stay resolvable for consumers pinned to it`);
      assert.equal(itemsById[oldKey].deprecated, true, `${oldKey} must be deprecated`);
    }
  });

  it('[ITMA-2] the alias is faithful — identical storage identity, so it emits identical events', () => {
    for (const [oldKey, newKey] of ALIASES) {
      assert.equal(itemsById[oldKey].streamId, itemsById[newKey].streamId, `${oldKey} streamId`);
      assert.equal(itemsById[oldKey].eventType, itemsById[newKey].eventType, `${oldKey} eventType`);
    }
  });

  it('[ITMA-3] the replacement is NOT deprecated', () => {
    for (const [, newKey] of ALIASES) {
      assert.ok(!itemsById[newKey].deprecated, `${newKey} must be active`);
    }
  });

  it('[ITMA-4] findItemForEvent resolves to the ACTIVE item, never the alias', () => {
    for (const [oldKey, newKey] of ALIASES) {
      const item = itemsById[newKey];
      const found = findItemForEvent(item.eventType, item.streamId);
      assert.strictEqual(found, itemsById[newKey], `${item.streamId}:${item.eventType} must resolve to ${newKey}, not ${oldKey}`);
    }
  });

  it('[ITMA-5] a deprecated item with its OWN pair still resolves (old LH events keep rendering)', () => {
    // fertility-hormone-lh was mis-typed mg/L; its replacement uses iu-l, so the pair differs and
    // events written under the old type must still find their item.
    const lh = findItemForEvent('concentration/mg-l', 'body-urine-hormones-lh');
    assert.strictEqual(lh, itemsById['fertility-hormone-lh']);
    const lhNew = findItemForEvent('concentration/iu-l', 'body-urine-hormones-lh');
    assert.strictEqual(lhNew, itemsById['body-urine-hormones-lh']);
  });
});
