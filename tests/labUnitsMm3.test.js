const assert = require('assert');
const fs = require('fs');
const path = require('path');

// site-agents#60: counts printed per mm³ (French reports) are counts per μL, stored as printed on
// concentration/count-ul, offered by the WBC, platelet and RBC items since 4.30.0. See BLOOD-CHEMISTRY.md § Units.

describe('[LAB60] counts per mm³ (site-agents#60)', () => {
  const { itemsById, findItemForEvent } = require('../src/items');
  const CBC = 'body-blood-cbc-';
  const FIRST = { wbc: 'concentration/megacount-ml', platelets: 'concentration/megacount-ml', rbc: 'concentration/gigacount-ml' };
  const FACTOR = { wbc: 1000, platelets: 1000, rbc: 1e6 };
  const FIRST_UCUM = { wbc: '10*6/mL', platelets: '10*6/mL', rbc: '10*9/mL' };
  const COUNT_UL_ITEMS = [
    'wbc', 'platelets', 'rbc', 'lymphocytes-count', 'neutrophils-count', 'neutrophils-segmented-count',
    'neutrophils-band-count', 'monocytes-count', 'eosinophils-count', 'basophils-count', 'reticulocytes-count'
  ].map((k) => CBC + k).sort();

  it('[LAB60-OPT-1] WBC, platelets and RBC keep their unit as option 1 and add /μL as option 2', () => {
    for (const [cell, first] of Object.entries(FIRST)) {
      const item = itemsById[CBC + cell];
      const options = item.variations.eventType.options;
      assert.deepStrictEqual(options.map((o) => o.value), [first, 'concentration/count-ul'], cell);
      assert.strictEqual(item.eventType, undefined, `${cell}: variations replace the item-level eventType`);
      assert.strictEqual(options[0].loinc, options[1].loinc, `${cell}: one count property, one code`);
      for (const o of options) assert.strictEqual(findItemForEvent(o.value, CBC + cell), item, `${cell} ${o.value}`);
    }
  });

  it('[LAB60-CNV-1] the factor to /μL is exact: × 1000 from 10⁹/L, × 10⁶ from 10¹²/L', () => {
    for (const [cell, first] of Object.entries(FIRST)) {
      const f = itemsById[CBC + cell].unitConversions.factors;
      assert.deepStrictEqual(f.map((x) => [x.from, x.to, x.factor]), [[first, 'concentration/count-ul', FACTOR[cell]]], cell);
    }
  });

  it('[LAB60-LBL-1] every /μL option says /mm³ too', () => {
    const withCountUl = Object.entries(itemsById)
      .filter(([, i]) => (i.variations?.eventType?.options || []).some((o) => o.value === 'concentration/count-ul'));
    assert.deepStrictEqual(withCountUl.map(([k]) => k).sort(), COUNT_UL_ITEMS);
    for (const [key, item] of withCountUl) {
      const o = item.variations.eventType.options.find((x) => x.value === 'concentration/count-ul');
      assert.strictEqual(o.label.en, '/μL (/mm³)', key);
      assert.strictEqual(o.label.fr, '/μL (/mm³)', key);
    }
  });

  it('[LAB60-FHIR-1] a count per μL exports in UCUM /uL, option 1 keeps its UCUM', () => {
    for (const cell of Object.keys(FIRST)) {
      const units = itemsById[CBC + cell].fhir.value.units;
      assert.strictEqual(units['concentration/count-ul'], '/uL', cell);
      assert.strictEqual(units[FIRST[cell]], FIRST_UCUM[cell], cell);
    }
  });
});

// site-agents#54 to #59: BLOOD-CHEMISTRY.md § Verified codes for frequent coded results. The codes must stay owned
// by no item, or the table would tell writers to code a result an item owns.

describe('[LAB54] verified codes table (site-agents#54 to #59)', () => {
  const { itemsById } = require('../src/items');

  function checkDigitOk (code) {
    const m = /^(\d+)-(\d)$/.exec(code);
    const digits = m[1].split('').map(Number).reverse();
    let sum = 0;
    digits.forEach((d, i) => {
      if (i % 2 === 0) { const x = d * 2; sum += x > 9 ? x - 9 : x; } else sum += d;
    });
    return (10 - (sum % 10)) % 10 === Number(m[2]);
  }

  it('[LAB54-TBL-1] 27 codes, valid check digits, each once, none owned by an item', () => {
    const doc = fs.readFileSync(path.join(__dirname, '../documentation/BLOOD-CHEMISTRY.md'), 'utf8');
    const start = doc.indexOf('### Verified codes for frequent coded results');
    assert.ok(start > 0, 'section present');
    const section = doc.slice(start, doc.indexOf('\n- **Ratios are written', start));
    const codes = [...section.matchAll(/`(\d{3,5}-\d)`/g)].map((m) => m[1]);
    assert.strictEqual(codes.length, 27);
    assert.strictEqual(new Set(codes).size, 27, 'each code once');
    const owned = new Map();
    for (const [key, item] of Object.entries(itemsById)) {
      for (const c of [...(item.references?.loinc || []), ...(item.references?.loincMethod || [])]) owned.set(c, key);
    }
    for (const c of codes) {
      assert.ok(checkDigitOk(c), `${c}: check digit`);
      assert.ok(!owned.has(c), `${c} is owned by ${owned.get(c)}`);
    }
  });
});
