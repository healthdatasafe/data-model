const assert = require('assert');
const AjvDraft04 = require('ajv-draft-04');
const addFormats = require('ajv-formats');

// Document kinds (4.17.0, site-agents#36 A9): a `file/xds-v1` document's class and first type by kind, from the CH Term
// ConceptMap. See documentation/DOCUMENTS.md § Document kinds.

// CH Term 3.4.0 (2026-06-10, active), read 2026-11-18 from
// https://fhir.ch/ig/ch-term/ConceptMap-DocumentEntryClassCodeToDocumentEntryTypeCode.json and the two value sets.
const CONCEPT_MAP = {
  371531000: ['371530004', '371529009', '371532007', '419891008'],
  721927009: ['419891008'],
  721963009: ['721965002', '721966001', '2161000195103', '419891008'],
  422735006: ['373942005', '371535009', '721912009', '736378000', '419891008'],
  371525003: ['371526002', '4241000179101', '371528001', '4201000179104', '900000000000471006', '787148009', '419891008'],
  734163000: ['737427001', '773130005', '736055001', '761931002', '419891008'],
  440545006: ['761938008', '765492005', '419891008'],
  184216000: ['722446000', '41000179103', '419891008'],
  371537001: ['419891008'],
  371538006: ['419891008'],
  722160009: ['419891008'],
  722216001: ['419891008'],
  772790007: ['419891008'],
  405624007: ['772786005', '419891008'],
  417319006: ['445300006', '445418005', '419891008', '82291000195104'],
  2171000195109: ['419891008'],
  419891008: ['419891008']
};
const CLASS_CODES = Object.keys(CONCEPT_MAP);
const TYPE_CODES = [...new Set(Object.values(CONCEPT_MAP).flat())];
// listed by the value sets under the Swiss edition, http://snomed.info/sct/2011000195101
const SWISS_EXTENSION = ['2171000195109', '2161000195103', '82291000195104'];

describe('[DKND] Document kinds', () => {
  const { documentKinds, checkDocumentKindsTable, RECORD_ARTIFACT } = require('../src/documentKinds');
  const { eventTypesById } = require('../src/eventTypes');
  const { itemsById } = require('../src/items');
  const kinds = Object.entries(documentKinds.kinds);

  it('[DKND-1] every kind not deprecated is a pair of the ConceptMap (17 classes, 29 types)', () => {
    assert.strictEqual(CLASS_CODES.length, 17);
    assert.strictEqual(TYPE_CODES.length, 29);
    for (const [key, kind] of kinds) {
      if (kind.deprecated) continue;
      assert.ok(CONCEPT_MAP[kind.class.code]?.includes(kind.type.code), `${key}: ${kind.class.code} → ${kind.type.code}`);
    }
  });

  it('[DKND-2] every pair of the ConceptMap is a kind', () => {
    const pairs = new Set(kinds.filter(([, k]) => !k.deprecated).map(([, k]) => `${k.class.code}|${k.type.code}`));
    const expected = Object.entries(CONCEPT_MAP).flatMap(([cls, types]) => types.map(type => `${cls}|${type}`));
    assert.strictEqual(expected.length, 45);
    assert.deepStrictEqual(expected.filter(p => !pairs.has(p)), [], 'pairs without a kind');
    assert.strictEqual(pairs.size, expected.length);
    assert.ok(kinds.some(([, k]) => k.type.code === RECORD_ARTIFACT));
  });

  it('[DKND-3] a Swiss-extension concept carries the Swiss edition, no other does', () => {
    for (const [key, kind] of kinds) {
      for (const coding of [kind.class, kind.type]) {
        const swiss = SWISS_EXTENSION.includes(coding.code);
        assert.strictEqual(coding.version, swiss ? 'http://snomed.info/sct/2011000195101' : undefined, `${key} ${coding.code}`);
      }
    }
  });

  it('[DKND-4] each kind makes valid file/xds-v1 content (draft-04, as the cores)', () => {
    const ajv = new AjvDraft04({ strict: false, allErrors: true, coerceTypes: false, validateFormats: true, logger: false });
    addFormats(ajv);
    const validate = ajv.compile(eventTypesById('file/xds-v1'));
    for (const [key, kind] of [...kinds, ...Object.entries(documentKinds.detailKinds)]) {
      const type = kind.detail ? [kind.type, kind.detail] : [kind.type];
      assert.ok(validate({ class: kind.class, type, title: kind.label.en, language: 'en' }), `${key}: ${JSON.stringify(validate.errors)}`);
    }
  });

  it('[DKND-5] the types the document item translates to LOINC are kinds', () => {
    const translated = Object.keys(itemsById.document.fhir.code.translate).map(k => k.split('|'));
    const types = new Set(kinds.map(([, k]) => k.type.code));
    for (const [system, code] of translated) {
      assert.strictEqual(system, 'http://snomed.info/sct');
      assert.ok(types.has(code), code);
    }
  });

  it('[DKND-6] refuses kinds their codes or labels cannot tell apart, and a code with two Codings', () => {
    const copy = () => JSON.parse(JSON.stringify(documentKinds));
    const label = { en: 'Twin', fr: 'Jumeau' };
    const twinType = copy();
    twinType.kinds.twin = { ...twinType.kinds['laboratory-report'], label };
    assert.throws(() => checkDocumentKindsTable(twinType), /cannot be told apart/);
    const twinClass = copy();
    twinClass.kinds.twin = { ...twinClass.kinds.consent, label };
    assert.throws(() => checkDocumentKindsTable(twinClass), /cannot be told apart/);
    const drift = copy();
    drift.kinds['pathology-report'].class.display = 'Procedure report';
    assert.throws(() => checkDocumentKindsTable(drift), /another Coding/);
    const twinLabel = copy();
    twinLabel.kinds['progress-report'].label.de = 'konsultationsbericht';
    assert.throws(() => checkDocumentKindsTable(twinLabel), /share the de label/);
    const otherSystem = copy();
    otherSystem.kinds['imaging-order'].type.system = 'urn:oid:2.16.840.1.113883.6.96';
    assert.throws(() => checkDocumentKindsTable(otherSystem), /invalid/);
    assert.doesNotThrow(() => checkDocumentKindsTable(copy()));
  });

  it('[DKND-8] a detail kind has the codes of one of kinds, and its own detail (4.32.0)', () => {
    const copy = () => JSON.parse(JSON.stringify(documentKinds));
    assert.deepStrictEqual(Object.keys(documentKinds.detailKinds), ['menstrual-cycle-chart']);
    const chart = documentKinds.detailKinds['menstrual-cycle-chart'];
    const plain = documentKinds.kinds['other-patient-record'];
    assert.deepStrictEqual([chart.class, chart.type], [plain.class, plain.type]);
    assert.deepStrictEqual(chart.detail, { system: 'https://hds.ngo/fhir/CodeSystem/document-kind', code: 'menstrual-cycle-chart', display: 'Menstrual cycle chart' });
    const refused = (change, error) => {
      const table = copy();
      change(table.detailKinds['menstrual-cycle-chart'], table);
      assert.throws(() => checkDocumentKindsTable(table), error);
    };
    refused((k, table) => { delete table.kinds['other-patient-record']; }, /no kind has the same class and type/);
    refused((k, table) => { k.type = table.kinds['laboratory-report'].type; }, /no kind has the same class and type/);
    refused((k) => { k.detail.code = 'cycle-chart'; }, /not its key/);
    refused((k) => { k.detail.display = 'Chart'; }, /not its English label/);
    refused((k) => { delete k.detail; }, /invalid/);
    refused((k) => { k.detail.system = 'http://snomed.info/sct'; }, /invalid/);
    refused((k, table) => { k.label = table.kinds.consent.label; }, /share the en label/);
    refused((k, table) => { table.kinds['menstrual-cycle-chart'] = table.kinds.consent; delete table.kinds.consent; }, /both kinds and detailKinds/);
    refused((k, table) => { table.kinds['other-patient-record'].detail = k.detail; }, /invalid/);
    const none = copy();
    delete none.detailKinds;
    assert.doesNotThrow(() => checkDocumentKindsTable(none));
  });

  it('[DKND-9] a reader of `kinds` alone offers no detail kind, and reads one as the kind it shares codes with', () => {
    const { kinds: published, detailKinds } = require('../src/documentKinds').toBePublished()[0].content;
    for (const [key, { class: cls, type }] of Object.entries(detailKinds)) {
      assert.strictEqual(published[key], undefined);
      const same = Object.entries(published).filter(([, k]) => k.type.code === type.code && k.class.code === cls.code).map(([k]) => k);
      assert.strictEqual(same.length, 1, key);
    }
    assert.deepStrictEqual(Object.values(published).filter(k => k.detail), []);
  });

  it('[DKND-7] is published in the pack', () => {
    const [file] = require('../src/documentKinds').toBePublished();
    assert.strictEqual(file.includeInPack, 'documentKinds');
    assert.strictEqual(file.content.source.version, '3.4.0');
  });
});
