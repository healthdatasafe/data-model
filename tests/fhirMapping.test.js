const assert = require('assert');

describe('[FHIR] item fhir blocks (plan 115)', () => {
  const { itemsById, checkFhirMapping, checkFhirSubtrees } = require('../src/items');
  const { checkItem } = require('../src/schemas/items');

  const weight = () => structuredClone(itemsById['body-weight']);

  it('[FHIR-1] the mapped items load and keep their blocks', () => {
    for (const k of ['body-weight', 'body-blood-pressure', 'lifestyle-tobacco-smoking', 'condition-coded', 'wellbeing-self-rated-health']) {
      assert.ok(itemsById[k].fhir, `${k} has no fhir block`);
    }
  });

  it('[FHIR-2] the schema refuses a label instead of a canonical system URI, and unknown keys', () => {
    const item = weight();
    item.fhir.code.system = 'loinc';
    assert.throws(() => checkItem(item, 'w'), /pattern/);
    const item2 = weight();
    item2.fhir.extra = 1;
    assert.throws(() => checkItem(item2, 'w'), /additional properties/);
  });

  it('[FHIR-3] quantity units must cover exactly the item eventTypes', () => {
    const item = weight();
    delete item.fhir.value.units['mass/lb'];
    assert.throws(() => checkFhirMapping('w', item, ['mass/kg', 'mass/lb']), /missing \[mass\/lb\]/);
    const item2 = weight();
    item2.fhir.value.units['mass/g'] = 'g';
    assert.throws(() => checkFhirMapping('w', item2, ['mass/kg', 'mass/lb']), /unknown \[mass\/g\]/);
  });

  it('[FHIR-4] coded options must match the item options', () => {
    const item = structuredClone(itemsById['lifestyle-tobacco-smoking']);
    delete item.fhir.value.options.current;
    assert.throws(() => checkFhirMapping('s', item, [item.eventType]), /missing \[current\]/);
  });

  it('[FHIR-5] components and split keys must be composite fields', () => {
    const item = structuredClone(itemsById['body-blood-pressure']);
    item.fhir.split.pulse = item.fhir.split.rate;
    assert.throws(() => checkFhirMapping('bp', item, [item.eventType]), /split "pulse" is not a composite field/);
  });

  it('[FHIR-6] refuses an unknown category and an Observation without code', () => {
    const item = weight();
    item.fhir.category = 'vital-sign';
    assert.throws(() => checkFhirMapping('w', item, ['mass/kg', 'mass/lb']), /unknown category "vital-sign"/);
    const item2 = weight();
    delete item2.fhir.code;
    assert.throws(() => checkFhirMapping('w', item2, ['mass/kg', 'mass/lb']), /needs a "code"/);
  });

  it('[FHIR-7] the subtree invariant refuses a mapped parent whose subtree spans another pair', () => {
    const parent = structuredClone(itemsById['body-temperature-basal']);
    const child = structuredClone(itemsById['body-temperature-basal-disturbance']);
    const obs = (category) => ({ resourceType: 'Observation', category, code: { system: 'http://loinc.org', code: '1' }, value: { kind: 'scaled', multiplier: 1 }, profiles: {} });
    parent.fhir = obs('vital-signs');
    child.fhir = obs('survey');
    assert.throws(() => checkFhirSubtrees({ parent, child }), /stream "body-temperature-basal" carries mapped items but its subtree spans/);
    child.fhir = obs('vital-signs');
    checkFhirSubtrees({ parent, child });
  });
});
