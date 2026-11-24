const assert = require('node:assert/strict');
const { LOCALES, checkLocales, forEachText, localise, converterSidecars, checkPublished, checkConsentLabels } = require('../src/l10n');

const entry = (en, text) => ({ en, text, reviewedBy: 'reviewer', reviewedOn: '2026-11-24' });
const paths = (content) => { const out = []; forEachText(content, (node, at) => out.push(at)); return out; };

describe('[L10N] Translations added at build', () => {
  it('[L10N1] adds a reviewed text, leaves the source as it is', () => {
    const src = { a: { label: { en: 'Weight', fr: 'Poids' } } };
    const out = localise('items.json', src, { 'pt-BR': { 'items.json': { 'a/label': entry('Weight', 'Peso') } } });
    assert.deepEqual(out, { a: { label: { en: 'Weight', fr: 'Poids', 'pt-BR': 'Peso' } } });
    assert.deepEqual(src, { a: { label: { en: 'Weight', fr: 'Poids' } } });
  });

  it('[L10N2] an option is named by its value, whatever its place; 1, "1" and null stay apart', () => {
    const options = [{ value: 1, label: { en: 'a' } }, { value: '1', label: { en: 'b' } }, { value: null, label: { en: 'c' } }];
    assert.deepEqual(paths({ options }), ['options[value=1]/label', 'options[value="1"]/label', 'options[value=null]/label']);
    const locales = { it: { f: { 'options[value=1]/label': entry('a', 'A') } } };
    assert.equal(localise('f', { options: [...options].reverse() }, locales).options[2].label.it, 'A');
  });

  it('[L10N3] two entries with one value are refused, a dot or a slash in a key is safe', () => {
    assert.throws(() => paths([{ value: 1, label: { en: 'a' } }, { value: 1, label: { en: 'b' } }]), /two entries/);
    assert.deepEqual(paths({ 'a.b/c~d': { en: 'x' } }), ['a.b~1c~0d']);
  });

  it('[L10N4] a changed English, a path that matches nothing, a text already in the definitions: the build fails', () => {
    const l = (at, e) => ({ it: { f: { [at]: e } } });
    assert.throws(() => localise('f', { a: { en: 'new' } }, l('a', entry('old', 'x'))), /the English changed/);
    assert.throws(() => localise('f', { a: { en: 'a' } }, l('b', entry('a', 'x'))), /no such text: b/);
    assert.throws(() => localise('f', { a: { en: 'a', it: 'y' } }, l('a', entry('a', 'x'))), /already in the definitions/);
  });

  it('[L10N5] only reviewed, non-empty texts of a known locale', () => {
    const ok = entry('a', 'x');
    const check = (e, locale = 'it', held = []) => checkLocales({ [locale]: { f: { a: e } } }, held);
    assert.doesNotThrow(() => check(ok));
    assert.throws(() => check({ ...ok, reviewedBy: undefined }), /reviewedBy is missing/);
    assert.throws(() => check({ ...ok, text: ' ' }), /text is missing/);
    assert.throws(() => check({ ...ok, reviewedOn: 'today' }), /YYYY-MM-DD/);
    assert.throws(() => check(ok, 'de'), /is not one of/);
    const held = [{ file: 'f', path: 'a', reason: 'licensed questionnaire' }];
    assert.throws(() => check(ok, 'it', held), /licensed questionnaire/);
    assert.doesNotThrow(() => check({ ...ok, official: 'EuroQol, Italian EQ-5D-5L' }, 'it', held));
  });

  it('[L10N6] a frozen converter pack is not touched: its texts go to a sidecar', () => {
    const pack = { methods: [{ id: 'm', label: { en: 'Two-day' } }] };
    const name = 'converters/x/pack-v1.json';
    const locales = { 'pt-BR': { [name]: { 'methods[id="m"]/label': entry('Two-day', 'Dois dias') } } };
    assert.equal(localise(name, pack, locales), pack);
    assert.deepEqual(converterSidecars([{ fileName: name, content: pack }], locales), {
      'converters/x/l10n-pt-BR.json': { locale: 'pt-BR', packs: { 'pack-v1.json': { 'methods[id="m"]/label': 'Dois dias' } } }
    });
  });

  it('[L10N8] two streams that read the same on a consent screen are refused', () => {
    const streams = [{ id: 'a', name: 'A', label: { en: 'Blood', it: 'Sangue' } }, { id: 'b', name: 'B', label: { en: 'Bleeding', it: 'sangue' } }];
    assert.throws(() => checkConsentLabels(streams, {}, { it: {} }), /streams a and b/);
    assert.doesNotThrow(() => checkConsentLabels(streams, {}, { pt: {} }));
    const nested = [{ id: 'a', name: 'A', label: { en: 'Blood', it: 'Sangue' }, children: [{ id: 'c', name: 'C', label: { en: 'Other', it: 'Altro' } }] },
      { id: 'b', name: 'B', label: { en: 'Urine', it: 'Urina' }, children: [{ id: 'd', name: 'D', label: { en: 'Other', it: 'Altro' } }] }];
    assert.doesNotThrow(() => checkConsentLabels(nested, {}, { it: {} }));
    const items = { x: { streamId: 'a', label: { en: 'X', it: 'Urina' } } };
    assert.throws(() => checkConsentLabels(nested, items, { it: {} }), /streams a and b/);
  });

  it('[L10N9] a child with no text in the locale is read in English as a whole, as hds-fhir-js does', () => {
    const streams = [{ id: 'a', name: 'A', label: { en: 'Blood', it: 'Sangue' }, children: [{ id: 'c', name: 'C', label: { en: 'Other' } }] },
      { id: 'b', name: 'B', label: { en: 'x', it: 'Blood › Other' } }];
    assert.throws(() => checkConsentLabels(streams, {}, { it: {} }), /streams c and b/);
  });

  it('[L10N10] a file or a held text that is not published fails the build', () => {
    const published = [{ fileName: 'items.json', content: { a: { label: { en: 'A' } } } }];
    assert.doesNotThrow(() => checkPublished(published, { it: { 'items.json': {} } }, [{ file: 'items.json', path: 'a/label' }]));
    assert.throws(() => checkPublished(published, { it: { 'itms.json': {} } }, []), /no published file itms.json/);
    assert.throws(() => checkPublished(published, {}, [{ file: 'items.json', path: 'b/label' }]), /has no text b\/label/);
  });

  it('[L10N7] every locale code is a locale code', () => {
    for (const l of LOCALES) assert.match(l, /^[a-z]{2}(-[A-Z]{2})?$/);
  });
});
