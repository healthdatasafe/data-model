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
