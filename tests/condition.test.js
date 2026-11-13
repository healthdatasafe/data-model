const assert = require('assert');
const Ajv = require('ajv');

// Coded conditions (plan 115 GAP H-6, 4.1.0): `condition/coded-v1` carries an optional clinical status and the item a
// duration block (time + duration = abatement). See documentation/CONDITION.md § status and abatement.

describe('[COND] condition-coded status and abatement', () => {
  const { itemsById } = require('../src/items');
  const { eventTypesById } = require('../src/eventTypes');
  const { readLock } = require('../src/fhir');

  const STATUSES = ['active', 'recurrence', 'relapse', 'inactive', 'remission', 'resolved'];
  const SELECTION = {
    condition: {
      label: { en: 'Endometriosis' },
      codes: [{ code: '129103003', system: 'SNOMED-CT', source: { key: 'SNOMED-CT-HDS' }, hdsId: 'S:SNOMED-CT/k:SNOMED-CT-HDS/C:129103003' }]
    }
  };
  let validate;
  before(() => {
    const ajv = new Ajv({ strict: false, allErrors: true });
    validate = ajv.compile(eventTypesById('condition/coded-v1'));
  });

  it('[COND-1] status is optional and one of the six FHIR condition-clinical codes', () => {
    assert.ok(validate(SELECTION), 'no status: the events written before 4.1.0');
    for (const status of STATUSES) assert.ok(validate({ ...SELECTION, status }), status);
    assert.ok(!validate({ ...SELECTION, status: 'ongoing' }), 'not a FHIR code');
    assert.ok(!validate({ ...SELECTION, status: null }), 'null is not "not stated"');
    const schema = eventTypesById('condition/coded-v1');
    assert.deepStrictEqual(schema.required, ['condition']);
    assert.deepStrictEqual(schema.properties.status.enum, STATUSES);
  });

  it('[COND-2] the duration block: optional, never null (no duration is abatement unknown, not ongoing)', () => {
    assert.deepStrictEqual(itemsById['condition-coded'].duration, { mandatory: false, canBeNull: false, maxSeconds: 100 * 365 * 86400 });
    for (const key of ['finding-coded', 'procedure-coded']) {
      assert.strictEqual(itemsById[key].duration, undefined, `${key}: a finding or a procedure has no abatement`);
    }
  });

  it('[COND-3] the fhir block, the scope entry and the lock are the 4.0.x ones', () => {
    const item = itemsById['condition-coded'];
    assert.strictEqual(item.eventType, 'condition/coded-v1');
    assert.deepStrictEqual(item.fhir.code, { from: 'datasource', field: 'condition' });
    assert.strictEqual(item.fhir.value, undefined);
    assert.deepStrictEqual(readLock().streams.condition, { pair: 'Condition|problem-list-item', parent: null, items: ['condition-coded'] });
  });
});
