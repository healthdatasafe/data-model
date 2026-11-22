const assert = require('assert');

// 4.29.0 (plan 128, reading coverage package 7): total PSA and spot urine creatinine. See documentation/BLOOD-CHEMISTRY.md.

describe('[LAB429] total PSA and urine creatinine', () => {
  const { itemsById, findItemForEvent } = require('../src/items');
  const streams = require('../src/streams');
  const PSA = 'body-blood-serum-psa-total';
  const UCR = 'body-urine-chemistry-creatinine';

  it('[LAB429-1] each item sits on its own stream under its specimen (key = streamId)', () => {
    assert.strictEqual(streams.streamsById[PSA].parentId, 'body-blood-serum');
    assert.strictEqual(streams.streamsById['body-urine-chemistry'].parentId, 'body-urine');
    assert.deepStrictEqual(streams.streamsById['body-urine-chemistry'].label, { en: 'Urine chemistry', fr: 'Chimie urinaire' });
    assert.strictEqual(streams.streamsById[UCR].parentId, 'body-urine-chemistry');
    for (const key of [PSA, UCR]) {
      assert.strictEqual(itemsById[key].streamId, key);
      assert.strictEqual(itemsById[key].type, 'number');
    }
  });

  it('[LAB429-2] urine creatinine options: mg/dL first, mmol/L second, each with its spot-urine code', () => {
    const options = itemsById[UCR].variations.eventType.options.map((o) => [o.value, o.loinc]);
    assert.deepStrictEqual(options, [['concentration/mg-dl', '2161-8'], ['concentration/mmol-l', '14683-7']]);
    assert.strictEqual(itemsById[PSA].eventType, 'concentration/ug-l');
  });

  it('[LAB429-3] the codes are the spot and total concepts, never a timed collection or free PSA', () => {
    assert.deepStrictEqual(itemsById[PSA].references, { snomed: ['63476009'], loinc: ['2857-1'] });
    assert.deepStrictEqual(itemsById[UCR].references, { snomed: ['271260009'], loinc: ['2161-8', '14683-7'] });
    const owned = Object.values(itemsById).flatMap((i) => [...(i.references?.loinc || []), ...(i.references?.loincMethod || [])]);
    for (const code of ['10886-0', '12841-3', '2162-6', '14684-5', '20624-3', '25886-3']) assert.ok(!owned.includes(code), code);
  });

  it('[LAB429-4] an event resolves to its item; serum and urine creatinine stay apart', () => {
    assert.strictEqual(findItemForEvent('concentration/ug-l', PSA), itemsById[PSA]);
    assert.strictEqual(findItemForEvent('concentration/mmol-l', UCR), itemsById[UCR]);
    assert.strictEqual(findItemForEvent('concentration/mg-dl', UCR), itemsById[UCR]);
    assert.strictEqual(findItemForEvent('concentration/umol-l', 'body-blood-serum-creatinine'), itemsById['body-blood-serum-creatinine']);
    const f = itemsById[UCR].unitConversions.factors[0];
    assert.strictEqual(Math.round(10 / f.molarMass * 10000) / 10000, f.factor);
  });
});
