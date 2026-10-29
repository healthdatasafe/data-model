const assert = require('assert');

// The missing lab analytes of site-agents#27, release 1 (3.32.0): serum chemistry, CBC indices and extended
// differential, absolute counts on the cell's own stream, coagulation. See documentation/BLOOD-CHEMISTRY.md.

describe('[LAB27] lab analytes (site-agents#27)', () => {
  const { itemsById, findItemForEvent } = require('../src/items');
  const streams = require('../src/streams');

  const S = 'body-blood-serum-';
  const CBC = 'body-blood-cbc-';
  const COAG = 'body-blood-coagulation-';
  const NEW_STREAMS = {
    'body-blood-serum': [S + 'glucose-random', S + 'bilirubin-direct', S + 'lipase', S + 'amylase', S + 'phosphate',
      S + 'haptoglobin', S + 'igg', S + 'iga', S + 'igm', S + 'crp'],
    'body-blood-cbc': [CBC + 'mchc', CBC + 'mpv', CBC + 'reticulocytes', CBC + 'reticulocytes-immature-fraction',
      CBC + 'reticulocytes-hemoglobin', CBC + 'nucleated-rbc', CBC + 'neutrophils-segmented', CBC + 'neutrophils-band',
      CBC + 'myelocytes', CBC + 'metamyelocytes'],
    'body-blood-coagulation': [COAG + 'prothrombin-time', COAG + 'prothrombin-activity', COAG + 'aptt', COAG + 'fibrinogen',
      COAG + 'inr']
  };
  const CELLS = ['lymphocytes', 'neutrophils', 'neutrophils-segmented', 'neutrophils-band', 'monocytes', 'eosinophils',
    'basophils', 'reticulocytes'];

  it('[LAB27-ITM-1] the new streams sit under their panel, each with its item (key = streamId)', () => {
    assert.strictEqual(streams.streamsById['body-blood-coagulation'].parentId, 'body-blood');
    for (const [parent, ids] of Object.entries(NEW_STREAMS)) {
      for (const id of ids) {
        assert.strictEqual(streams.streamsById[id]?.parentId, parent, id);
        assert.strictEqual(itemsById[id]?.streamId, id, `${id} item`);
        assert.strictEqual(itemsById[id].type, 'number', id);
      }
    }
    assert.strictEqual(streams.streamsById['body-blood-serum'].name, 'Serum or plasma');
  });

  it('[LAB27-ITM-2] a count sits on its cell\'s stream: % and count resolve to their own item', () => {
    for (const cell of CELLS) {
      const stream = CBC + cell;
      const count = itemsById[`${stream}-count`];
      assert.ok(count, cell);
      assert.strictEqual(count.streamId, stream, `${cell}: key ≠ streamId`);
      assert.ok(!streams.streamsById[`${stream}-count`], `${cell}: the count adds no stream`);
      assert.strictEqual(findItemForEvent('ratio/proportion', stream), itemsById[stream], `${cell} %`);
      for (const et of ['concentration/megacount-ml', 'concentration/count-ul']) {
        assert.strictEqual(findItemForEvent(et, stream), count, `${cell} ${et}`);
      }
    }
    assert.strictEqual(findItemForEvent('concentration/gigacount-ml', CBC + 'reticulocytes'), itemsById[CBC + 'reticulocytes-count']);
    const lab = /^body-(blood|urine|semen)-/;
    const keyNotStream = Object.entries(itemsById)
      .filter(([k, i]) => lab.test(k) && !i.deprecated && k !== i.streamId).map(([k]) => k).sort();
    assert.deepStrictEqual(keyNotStream, CELLS.map((c) => `${CBC}${c}-count`).sort(),
      'the only lab items whose key is not their streamId (BLOOD-CHEMISTRY.md § Specimen is explicit)');
  });

  it('[LAB27-OPT-1] option 1 of every new multi-unit item (permanent)', () => {
    const first = (k) => itemsById[k].variations.eventType.options[0].value;
    const expected = {
      [S + 'glucose-random']: 'concentration/mg-dl',
      [S + 'bilirubin-direct']: 'concentration/mg-dl',
      [S + 'phosphate']: 'concentration/mg-dl',
      [S + 'haptoglobin']: 'concentration/mg-dl',
      [S + 'igg']: 'concentration/mg-dl',
      [S + 'iga']: 'concentration/mg-dl',
      [S + 'igm']: 'concentration/mg-dl',
      [S + 'crp']: 'concentration/mg-l',
      [CBC + 'mchc']: 'concentration/g-dl',
      [COAG + 'fibrinogen']: 'concentration/mg-dl'
    };
    for (const cell of CELLS) expected[`${CBC}${cell}-count`] = 'concentration/megacount-ml';
    for (const [k, et] of Object.entries(expected)) assert.strictEqual(first(k), et, k);
    assert.deepStrictEqual(itemsById[CBC + 'reticulocytes-count'].variations.eventType.options.map((o) => o.value),
      ['concentration/megacount-ml', 'concentration/count-ul', 'concentration/gigacount-ml']);
  });

  it('[LAB27-PCT-1] every ratio/percent item declares its suffix (the eventType has no symbol)', () => {
    const pct = Object.entries(itemsById).filter(([, i]) => i.eventType === 'ratio/percent');
    assert.deepStrictEqual(pct.map(([k]) => k).sort(), [CBC + 'nucleated-rbc', COAG + 'prothrombin-activity'].sort());
    for (const [k, i] of pct) {
      assert.ok(i.number?.display?.suffix?.en && i.number.display.suffix.fr, k);
      assert.strictEqual(i.number.display.multiplier, undefined, `${k}: stored as printed`);
    }
  });

  it('[LAB27-CNT-1] 10⁹/L is 1000 /μL', () => {
    for (const cell of CELLS) {
      const f = itemsById[`${CBC}${cell}-count`].unitConversions.factors
        .find((x) => x.from === 'concentration/megacount-ml' && x.to === 'concentration/count-ul');
      assert.strictEqual(f.factor, 1000, cell);
    }
  });

  it('[LAB27-LOINC-1] B-2026-10-28-41 and the SpO2 split: removed codes stay removed', () => {
    for (const k of ['function-mobility', 'function-self-care', 'function-usual-activities']) {
      assert.strictEqual(itemsById[k].references.loinc, undefined, k);
    }
    assert.deepStrictEqual(itemsById['body-oxygen-saturation'].references.loinc, ['59408-5']);
    assert.deepStrictEqual(itemsById['symptom-pain-severity'].references.loinc, ['38208-5']);
  });
});
