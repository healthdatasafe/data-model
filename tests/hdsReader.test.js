const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const AjvDraft04 = require('ajv-draft-04');
const addFormats = require('ajv-formats');

// HDS Reader: the clientData keys on each value read from a document (hdsSourceAnchor, hdsExtraction) and the
// dialogue type message/hds-reader-v1. See documentation/PROVENANCE.md and documentation/HDS-READER.md.

const TYPE = 'message/hds-reader-v1';
const keys = require('../src/schemas/clientDataKeys');
const eventTypes = require('../src/eventTypes');
const { eventTypesById } = eventTypes;
const streams = require('../src/streams');
const { itemsById } = require('../src/items');

const FLAVOURS = [
  ['draft-04 (the cores)', () => new AjvDraft04({ strict: false, allErrors: true, coerceTypes: false, validateFormats: true, logger: false })],
  ['draft-07', () => new Ajv({ strict: false, allErrors: true, coerceTypes: false, logger: false })]
];
const PORTABLE = /"(if|then|else|const|not|\$ref)"/;
const strip = (schema) => { const s = structuredClone(schema); delete s.description; delete s.$id; delete s.title; return s; };
const KEY_SCHEMAS = { hdsSourceAnchor: keys.hdsSourceAnchor, hdsExtraction: keys.hdsExtraction, hdsSourceGrid: keys.hdsSourceGrid };

const EXTRACTION = { engine: 'hds-reader', engineVersion: '0.2.0', kbVersion: '0.4.0', backend: 'text-layer', confirmedBy: 'person' };
const ANCHOR = { attachmentId: 'ckq3w8n1x0001a', page: 1, bbox: [8.5, 41.2, 83, 2.1] };

/** The json code blocks of a documentation file, parsed. */
function jsonBlocks (file) {
  const text = fs.readFileSync(path.join(__dirname, '../documentation', file), 'utf-8');
  return [...text.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => JSON.parse(m[1]));
}

describe('[RDR] HDS Reader', () => {
  for (const [flavour, make] of FLAVOURS) {
    describe(`[RDR-KEY] clientData.hdsSourceAnchor and hdsExtraction, ${flavour}`, () => {
      let anchor, extraction;

      before(() => {
        const ajv = make();
        addFormats(ajv);
        anchor = ajv.compile(keys.hdsSourceAnchor);
        extraction = ajv.compile(keys.hdsExtraction);
      });

      it('[RDR-KEY-1] an anchor is an attachment and a page in it, with a box in page percent when the reader trusts one', () => {
        for (const a of [
          { attachmentId: 'f1', page: 1 }, ANCHOR, { attachmentId: 'a_B-9', page: 12, bbox: [0, 0, 100, 100] },
          { attachmentId: 'x'.repeat(64), page: 2, bbox: [0.01, 99.5, 50, 0.5] }
        ]) {
          assert.ok(anchor(a), JSON.stringify(a) + ' ' + JSON.stringify(anchor.errors));
        }
      });

      it('[RDR-KEY-2] an anchor rejects a bad attachment, page or box, and anything that could carry text', () => {
        const a = { attachmentId: 'f1' };
        for (const bad of [
          {}, { page: 1 }, { ...a }, { attachmentId: 'f 1', page: 1 }, { attachmentId: '', page: 1 }, { attachmentId: 'x'.repeat(65), page: 1 },
          { attachmentId: 'scan.pdf', page: 1 }, { ...a, page: 0 }, { ...a, page: 1.5 }, { ...a, page: '1' },
          { ...a, page: 1, bbox: [0, 0, 1] }, { ...a, page: 1, bbox: [0, 0, 1, 1, 1] }, { ...a, page: 1, bbox: [-1, 0, 1, 1] },
          { ...a, page: 1, bbox: [0, 0, 101, 1] }, { ...a, page: 1, bbox: ['0', 0, 1, 1] }, { ...a, page: 1, bbox: { x: 0, y: 0, w: 1, h: 1 } },
          { ...a, page: 1, text: 'Ferritine 48 ng/mL' }, { ...a, page: 1, line: 3 }, { ...a, page: 1, ocr: 'Ferritine' }, { ...a, page: 1, bbox: null }
        ]) {
          assert.ok(!anchor(bad), JSON.stringify(bad));
        }
      });

      it('[RDR-KEY-3] an extraction names the program, its versions, the backend and the role', () => {
        for (const e of [
          EXTRACTION,
          { ...EXTRACTION, engineVersion: '0.3.0-rc.1', corrected: true },
          { ...EXTRACTION, backend: 'ollama:qwen2.5vl:7b' },
          { ...EXTRACTION, backend: 'mlx:mlx-community/Qwen2.5-VL-7B-Instruct-4bit' }
        ]) {
          assert.ok(extraction(e), JSON.stringify(e) + ' ' + JSON.stringify(extraction.errors));
        }
      });

      it('[RDR-KEY-4] an extraction rejects a missing field, an extra one, and free text in any field', () => {
        for (const k of Object.keys(EXTRACTION)) {
          const { [k]: _, ...partial } = EXTRACTION;
          assert.ok(!extraction(partial), 'without ' + k);
        }
        for (const bad of [
          { prompt: 'Read the lab report' }, { output: '{"value":48}' }, { confirmedByName: 'Anna' }, { accountId: 'ckabc' },
          { confidence: 0.9 }, { printed: 'Ferritine 48' },
          { confirmedBy: 'practitioner' }, { confirmedBy: 'Dr Martin' }, { confirmedBy: 'expert' }, { confirmedBy: 'anna' }, { confirmedBy: '' },
          { corrected: false }, { corrected: 'yes' },
          { engine: 'HDS Reader' }, { engine: 'hds reader' }, { engine: '' },
          { engineVersion: 'latest' }, { engineVersion: '0.2' }, { kbVersion: '0.4' }, { kbVersion: '0.4.0-rc.1' },
          { backend: 'read by Dr Martin' }, { backend: '' }, { backend: 'ollama:model\nFerritine 48' }, { backend: 'x'.repeat(129) },
          { backend: 'anna@example.org' }
        ]) {
          assert.ok(!extraction({ ...EXTRACTION, ...bad }), JSON.stringify(bad));
        }
      });
    });
  }

  for (const [flavour, make] of FLAVOURS) {
    describe(`[RDR-GRID] clientData.hdsSourceGrid (4.51.0), ${flavour}`, () => {
      let grid;
      before(() => { grid = make().compile(keys.hdsSourceGrid); });

      it('[RDR-GRID-1] a box is a row and a column, each 1 to 99', () => {
        for (const g of [{ row: 1, column: 1 }, { row: 2, column: 14 }, { row: 99, column: 99 }]) assert.ok(grid(g), JSON.stringify(g) + ' ' + JSON.stringify(grid.errors));
      });

      it('[RDR-GRID-2] refuses a missing field, 0, a fraction, a string, above 99, and anything that could carry text or a date', () => {
        for (const bad of [
          {}, { row: 2 }, { column: 14 }, { row: 0, column: 1 }, { row: 1, column: 0 }, { row: 1.5, column: 1 }, { row: '2', column: 14 },
          { row: 100, column: 1 }, { row: 1, column: 100 }, { row: 2, column: 14, text: '10KL x2' }, { row: 2, column: 14, day: '2026-03-12' },
          { row: 2, column: 14, page: 1 }, [2, 14], null
        ]) {
          assert.ok(!grid(bad), JSON.stringify(bad));
        }
      });
    });
  }

  describe('[RDR-GRID-SHAPE] hdsSourceGrid, pinned', () => {
    it('[RDR-GRID-3] closed, portable, both required, the bounds of the proposed value\'s grid', () => {
      const s = keys.hdsSourceGrid;
      assert.strictEqual(s.additionalProperties, false);
      assert.ok(!PORTABLE.test(JSON.stringify(s)));
      assert.deepStrictEqual(Object.keys(s.properties), ['row', 'column']);
      assert.deepStrictEqual(s.required, ['row', 'column']);
      const pv = eventTypesById('message/hds-conversation-v1').oneOf.find((b) => b.properties.kind.enum[0] === 'proposed-value');
      // strip() removes the top-level description only: the nested row and column descriptions are compared too
      assert.deepStrictEqual(strip(s), strip(pv.properties.grid), 'the proposed value\'s grid, copied as it is');
      assert.deepStrictEqual(s.properties.row, pv.properties.grid.properties.row);
      assert.deepStrictEqual(s.properties.column, pv.properties.grid.properties.column);
      // only from grid: never the column of a table read per column (an object with an index, another shape)
      assert.deepStrictEqual(Object.keys(pv.properties.column.properties), ['index']);
      assert.ok(!keys.hdsSourceGrid.properties.index, 'column.index is never copied here');
    });

    it('[RDR-GRID-4] PROVENANCE.md indexes it and documents it; CONVERSATION.md § Writing a value writes it', () => {
      const prov = fs.readFileSync(path.join(__dirname, '../documentation/PROVENANCE.md'), 'utf-8');
      assert.ok(prov.includes('| `clientData.hdsSourceGrid` (4.51.0) | The box of a dated grid a value was read from: its row and column, nothing of what is written there | this page'));
      assert.ok(prov.includes('### `clientData.hdsSourceGrid` — the box of a dated grid (4.51.0)'));
      assert.ok(prov.indexOf('### `clientData.hdsSourceGrid`') > prov.indexOf('### `clientData.hdsSourceAnchor`'), 'after the anchor');
      const flat = prov.replace(/\s+/g, ' ');
      for (const s of [
        'With `hdsSourceAnchor`, never without it',
        'Removed with the anchor, and whenever the anchor is rewritten.',
        'A value from a table read per column (`column`, an index from the left) or dated per page carries none; `column` is never copied here.',
        'by the anchor\'s `eventId`, `attachmentId` and `page`, and `row`; a reader uses these ids even when it cannot read the document.',
        'A reader places a value by `row` and `column`, and shows its day from the event\'s `time`. The two may disagree after a correction of its `time`: the box stays, and a reader never derives a row\'s days from one value alone.',
        'A reader draws the values that carry it and lists the others without a box; it never infers a box from `time`.',
        'A reader reads `row` and `column` and ignores a field it does not know',
        'her `correct` answer before the value is written (the grid is still copied, with `hdsExtraction.corrected`), and applying a `correction/entry-v1` `change`'
      ]) assert.ok(flat.includes(s), s);
      assert.doesNotMatch(flat, /takes each day from the event's `time`/);
      const conv = fs.readFileSync(path.join(__dirname, '../documentation/CONVERSATION.md'), 'utf-8').replace(/\s+/g, ' ');
      assert.ok(conv.includes('`hdsSourceGrid` = the proposed value\'s `grid` when it has one and the anchor is written (4.51.0'));
      assert.ok(conv.includes('only from `grid`: a value from a table read per column (`column`, an index from the left) or dated per page carries none, and `column` is never copied there'));
      assert.ok(conv.includes('a contact writes `anchor` on every grid value'));
      const corr = fs.readFileSync(path.join(__dirname, '../documentation/CORRECTIONS.md'), 'utf-8').replace(/\s+/g, ' ');
      assert.ok(corr.includes('Applying a `change` keeps the entry\'s `hdsSourceGrid` (4.51.0,'));
      assert.ok(corr.includes('never derive a row\'s days from it'));
    });
  });

  describe('[RDR-KEY-SHAPE] the key schemas', () => {
    it('[RDR-KEY-5] are closed, in the portable subset, with exactly these fields', () => {
      for (const [k, s] of Object.entries(KEY_SCHEMAS)) {
        assert.strictEqual(s.additionalProperties, false, k);
        assert.ok(!PORTABLE.test(JSON.stringify(s)), k);
      }
      assert.deepStrictEqual(Object.keys(keys.hdsSourceAnchor.properties), ['eventId', 'attachmentId', 'page', 'bbox']);
      assert.deepStrictEqual(keys.hdsSourceAnchor.required, ['attachmentId', 'page']);
      assert.deepStrictEqual(Object.keys(keys.hdsExtraction.properties), ['engine', 'engineVersion', 'kbVersion', 'backend', 'confirmedBy', 'corrected']);
      assert.deepStrictEqual(keys.hdsExtraction.required, ['engine', 'engineVersion', 'kbVersion', 'backend', 'confirmedBy']);
      assert.deepStrictEqual(keys.hdsExtraction.properties.confirmedBy.enum, ['person']);
      assert.deepStrictEqual(keys.hdsExtraction.properties.corrected.enum, [true]);
    });

    it('[RDR-KEY-6] the PROVENANCE.md example carries valid keys', () => {
      const ajv = new Ajv({ strict: false });
      const examples = jsonBlocks('PROVENANCE.md').filter((e) => e.clientData?.hdsExtraction);
      assert.strictEqual(examples.length, 2, 'a value read from a text layer, and one read from a dated grid (4.51.0)');
      for (const e of examples) {
        assert.ok(ajv.validate(keys.hdsSourceAnchor, e.clientData.hdsSourceAnchor), JSON.stringify(ajv.errors));
        assert.ok(ajv.validate(keys.hdsExtraction, e.clientData.hdsExtraction), JSON.stringify(ajv.errors));
        assert.strictEqual(e.clientData.hdsSourceAnchor.eventId, Object.keys(e.clientData.related)[0], 'the anchor names the related document');
      }
      const gridded = examples.filter((e) => e.clientData.hdsSourceGrid);
      assert.strictEqual(gridded.length, 1);
      assert.ok(ajv.validate(keys.hdsSourceGrid, gridded[0].clientData.hdsSourceGrid), JSON.stringify(ajv.errors));
      assert.ok(gridded[0].clientData.hdsSourceAnchor, 'never without the anchor');
    });

    it('[RDR-KEY-7] the key schemas are published with the pack, under json-schemas/', () => {
      const files = keys.toBePublished();
      assert.deepStrictEqual(files.map((f) => f.path + f.filename), ['./json-schemas/hds-source-anchor.json', './json-schemas/hds-extraction.json', './json-schemas/hds-document-pending.json', './json-schemas/hds-document-values.json', './json-schemas/hds-printed-in.json', './json-schemas/hds-source-grid.json']);
      assert.strictEqual(files[5].content, keys.hdsSourceGrid);
      assert.strictEqual(files[0].content, keys.hdsSourceAnchor);
      assert.strictEqual(files[1].content, keys.hdsExtraction);
      assert.strictEqual(files[2].content, keys.hdsDocumentPending);
      assert.strictEqual(files[3].content, keys.hdsDocumentValues);
      assert.strictEqual(files[4].content, keys.hdsPrintedIn);
      for (const f of files) assert.strictEqual(f.content.$id, 'https://model.datasafe.dev/json-schemas/' + f.filename);
      if (fs.existsSync(path.join(__dirname, '../dist/pack.json'))) {
        for (const f of files) {
          const built = path.join(__dirname, '../dist/json-schemas', f.filename);
          assert.deepStrictEqual(JSON.parse(fs.readFileSync(built, 'utf-8')), f.content, f.filename);
        }
      }
    });
  });

  describe('[RDR-STR] streams', () => {
    // v1 placement, pending the production decision (HDS-READER.md § Before the first production write).
    it('[RDR-STR-1] the Reader\'s tree is the app\'s, not a model stream', () => {
      for (const id of ['hds-reader', 'hds-reader-inbox', 'hds-reader-dialogue', 'hds-reader-app']) {
        assert.strictEqual(streams.streamsById[id], undefined, id);
      }
    });
  });

  const job = { kind: 'job', status: 'reading', attempt: 1, engine: 'hds-reader', engineVersion: '0.2.0', kbVersion: '0.4.0' };
  const reading = {
    kind: 'reading',
    candidateId: 'c-3f9a1e0b',
    printed: { label: 'Ferritine', value: '48', unit: 'ng/mL', refRange: '30 - 400', flag: 'H', section: 'Biochimie' },
    anchor: ANCHOR,
    confidence: 0.92,
    proposal: {
      itemKey: 'body-blood-serum-ferritin',
      type: 'concentration/ug-l',
      content: 48,
      time: 1773316800,
      clientData: { hdsTimePrecision: 'day', hdsRefRange: { lowerLimit: 30, upperLimit: 400, text: '30 - 400' }, hdsFlag: 'H', hdsInterpretation: 'H', hdsComparator: '<' }
    },
    status: 'clear',
    kbEntries: ['alias.fr.ferritine'],
    askOneByOne: false
  };
  const VALID = {
    job: [
      job,
      { ...job, status: 'done', backend: 'ollama:qwen2.5vl:7b', counts: { readings: 12, questions: 1, written: 10, keptAside: 1, dropped: 4 } },
      { ...job, status: 'error', attempt: 3, errorCode: 'document-unreadable' }
    ],
    notice: [{ kind: 'notice', code: 'kept-aside-now-mapped', about: 'c-3f9a1e0b' }, { kind: 'notice', code: 'not-a-lab-report' }],
    reading: [
      reading,
      { kind: 'reading', candidateId: 'c-77', printed: { label: 'Cholestérol HDL', value: '1,2', unit: 'mmol/l' }, status: 'kept-aside', reason: 'no-item', requestKey: 'serum-plasma|loinc:2085-9' },
      { kind: 'reading', candidateId: 'c-78', printed: { label: 'Hémoglobine', value: '13.5' }, anchor: { attachmentId: 'f2', page: 2 }, status: 'unit-missing', specimenImplied: true },
      { ...reading, proposal: { ...reading.proposal, clientData: { hdsTimePrecision: 'unknown' } } },
      {
        ...reading,
        proposal: { itemKey: 'body-blood-coded', type: 'lab-result/coded-v1', content: { analyte: { label: { en: 'X' }, codes: [{ system: 'http://loinc.org', code: '2947-0' }] }, value: 140, unit: 'mmol/L' } }
      }
    ],
    question: [
      { kind: 'question', code: 'which-unit', about: 'c-78', options: ['g/dL', 'g/L', 'mmol/L'] },
      { kind: 'question', code: 'which-date', about: 'document' },
      { kind: 'question', code: 'is-this-yours', about: 'document' },
      { kind: 'question', code: 'is-fasting', about: 'c-80', options: ['yes', 'no'] }
    ],
    answer: [
      { kind: 'answer', inReplyTo: 'ckq3w8n1x0002', action: 'confirm', candidateIds: ['c-3f9a1e0b', 'c-79'] },
      { kind: 'answer', inReplyTo: 'ckq3w8n1x0003', action: 'choose', option: 'g/dL', candidateIds: ['c-78'] },
      { kind: 'answer', inReplyTo: 'ckq3w8n1x0004', action: 'correct', candidateIds: ['c-3f9a1e0b'], value: 4.8, eventType: 'concentration/ug-l', itemKey: 'body-blood-serum-ferritin' },
      { kind: 'answer', inReplyTo: 'ckq3w8n1x0005', action: 'not-mine' },
      { kind: 'answer', inReplyTo: 'ckq3w8n1x0006', action: 'duplicate', candidateIds: ['c-3f9a1e0b'] },
      { kind: 'answer', inReplyTo: 'ckq3w8n1x0009', action: 'confirm', time: 1773316800, timePrecision: 'day' },
      { kind: 'answer', inReplyTo: 'ckq3w8n1x0009', action: 'confirm', time: 1767268800, timePrecision: 'year' },
      { kind: 'answer', inReplyTo: 'ckq3w8n1x0009', action: 'confirm', timePrecision: 'unknown' }
    ],
    'access-request': [{ kind: 'access-request', streamIds: ['body-blood-serum', 'body-blood-cbc'], level: 'create-only' }],
    'access-result': [{ kind: 'access-result', inReplyTo: 'ckq3w8n1x0007', granted: false }],
    written: [{ kind: 'written', candidateId: 'c-3f9a1e0b', eventId: 'ckq3w8n1x0008' }],
    summary: [
      { kind: 'summary', written: 10 },
      { kind: 'summary', written: 10, keptAside: [{ candidateId: 'c-77', reason: 'no-item' }] }
    ]
  };
  const KINDS = Object.keys(VALID);

  for (const [flavour, make] of FLAVOURS) {
    describe(`[RDR-ET] ${TYPE}, ${flavour}`, () => {
      let validate;

      before(() => {
        const ajv = make();
        addFormats(ajv);
        validate = ajv.compile(eventTypesById(TYPE));
      });

      it('[RDR-ET-1] accepts a message of every kind', () => {
        for (const [k, list] of Object.entries(VALID)) {
          for (const m of list) assert.ok(validate(m), `${k}: ${JSON.stringify(m)} ${JSON.stringify(validate.errors)}`);
        }
      });

      it('[RDR-ET-2] every kind is closed: an extra field fails', () => {
        for (const [k, list] of Object.entries(VALID)) {
          assert.ok(!validate({ ...list[0], note: 'free text' }), k);
        }
        assert.ok(!validate({ ...reading, printed: { ...reading.printed, ocr: 'Ferritine 48 ng/mL' } }), 'printed');
        assert.ok(!validate({ ...reading, anchor: { ...ANCHOR, text: 'Ferritine' } }), 'anchor');
        assert.ok(!validate({ ...reading, proposal: { ...reading.proposal, note: 'x' } }), 'proposal');
        assert.ok(!validate({ ...reading, proposal: { ...reading.proposal, clientData: { hdsTimeText: 'spring 2019' } } }), 'proposal.clientData');
        assert.ok(!validate({ ...VALID.job[1], counts: { lines: 3 } }), 'counts');
        assert.ok(!validate({ kind: 'summary', written: 1, keptAside: [{ candidateId: 'c-77', reason: 'no-item', label: 'Cholestérol HDL' }] }), 'keptAside names no text');
        assert.ok(!validate({ kind: 'summary', written: 1, keptAside: [{ candidateId: 'c-77', reason: 'no-item', requestKey: 'serum-plasma|loinc:2085-9' }] }), 'requestKey is on the reading only');
      });

      it('[RDR-ET-3] a missing or unknown kind fails; there is no free-text kind', () => {
        assert.ok(!validate({}));
        assert.ok(!validate({ status: 'reading', attempt: 1, engine: 'hds-reader', engineVersion: '0.2.0', kbVersion: '0.4.0' }));
        for (const kind of ['text', 'message', 'chat', 'Job']) {
          assert.ok(!validate({ kind, text: 'is this right?' }), kind);
        }
        assert.ok(!validate({ ...job, kind: 'reading' }), 'a job shape under another kind');
      });

      it('[RDR-ET-4] required fields per kind', () => {
        assert.ok(!validate({ kind: 'job', status: 'reading', attempt: 1, engine: 'hds-reader', engineVersion: '0.2.0' }), 'job without kbVersion');
        assert.ok(!validate({ ...job, attempt: 0 }));
        assert.ok(!validate({ kind: 'reading', candidateId: 'c-1', status: 'clear' }), 'reading without printed');
        assert.ok(!validate({ kind: 'reading', candidateId: 'c-1', printed: { label: 'X' }, status: 'clear' }), 'printed without value');
        assert.ok(!validate({ kind: 'reading', candidateId: 'c-1', printed: { label: '', value: '1' }, status: 'clear' }), 'empty label');
        assert.ok(!validate({ kind: 'reading', candidateId: 'c-1', printed: { label: 'X', value: '' }, status: 'clear' }), 'empty value');
        assert.ok(!validate({ ...reading, anchor: { page: 1 } }), 'anchor without attachmentId');
        assert.ok(!validate({ ...reading, proposal: { itemKey: 'body-weight', content: 70 } }), 'proposal without type');
        assert.ok(!validate({ kind: 'question', code: 'which-unit' }), 'question without about');
        assert.ok(!validate({ kind: 'answer', action: 'confirm' }), 'answer without inReplyTo');
        assert.ok(!validate({ kind: 'access-request', streamIds: [], level: 'create-only' }));
        assert.ok(!validate({ kind: 'access-request', streamIds: ['body-blood'], level: 'contribute' }), 'create-only only');
        assert.ok(!validate({ kind: 'written', candidateId: 'c-1' }));
      });

      it('[RDR-ET-5] codes, ids, options and dates reject free text and values outside the lists', () => {
        const answer = { kind: 'answer', inReplyTo: 'ckq3w8n1x0009', action: 'confirm' };
        for (const bad of [
          { kind: 'notice', code: 'We could not read page 2' },
          { kind: 'notice', code: 'x', about: 'Ferritine 48' },
          { ...job, status: 'error', errorCode: 'Timeout reading Ferritine' },
          { kind: 'question', code: 'which-unit', about: 'c-1', options: ['grams per litre'] },
          { kind: 'question', code: 'what-is-this', about: 'c-1' },
          { ...answer, inReplyTo: 'not an id' },
          { ...answer, action: 'choose', option: 'the second one' },
          { ...answer, action: 'correct', value: '4,8' },
          { ...answer, candidateIds: ['Ferritine 48'] },
          { ...answer, time: '2026-03-12', timePrecision: 'day' },
          { ...answer, time: 1773316800, timePrecision: 'minute' },
          { ...answer, time: 1773316800, timePrecision: 'approx' },
          { ...answer, time: 1773316800, timePrecision: 'spring 2019' },
          { kind: 'written', candidateId: 'c-1', eventId: 'ck/../x' },
          { ...reading, candidateId: 'Ferritine 48 ng/mL' },
          { ...reading, requestKey: 'serum|label:fr:cholestérol hdl' },
          { ...reading, requestKey: 'serum|label:fr:hdl\u0007' },
          { ...reading, requestKey: 'serum|label:fr:hdl\u007f' },
          { ...reading, requestKey: 'serum|label:fr:hdl\u0085' },
          { ...reading, printed: { ...reading.printed, flag: 'H'.repeat(17) } },
          { ...reading, proposal: { ...reading.proposal, clientData: { hdsFlag: 'H'.repeat(17) } } },
          { ...reading, kbEntries: ['Ferritine alias'] },
          { ...reading, printed: { ...reading.printed, value: '4'.repeat(33) } },
          { ...reading, reason: 'special-category' },
          { ...reading, reason: 'other-person' },
          { ...reading, reason: 'not-clinical' },
          { ...reading, confidence: 1.2 },
          { ...reading, proposal: { ...reading.proposal, clientData: { hdsTimePrecision: 'approx' } } },
          { ...reading, proposal: { ...reading.proposal, clientData: { hdsTimePrecision: 'minute' } } },
          { ...reading, proposal: { ...reading.proposal, content: '48' } },
          { ...job, engine: 'HDS Reader' },
          { ...job, backend: 'read by Dr Martin' }
        ]) {
          assert.ok(!validate(bad), JSON.stringify(bad));
        }
      });
    });
  }

  describe('[RDR-ET-SHAPE] shape of message/hds-reader-v1, pinned', () => {
    const schema = eventTypesById(TYPE);
    const branch = (k) => schema.oneOf.find((b) => b.properties.kind.enum[0] === k);
    const PRECISIONS = ['day', 'month', 'year', 'unknown'];
    const REASONS = ['no-item', 'unit-not-offered', 'no-coded-stream', 'timed-draw', 'implausible-value', 'ambiguous-label', 'qualitative-result', 'derived-index'];

    it('[RDR-ET-6] one closed branch per kind, discriminated by a one-value enum, in the portable subset', () => {
      assert.ok(schema, TYPE + ' registered');
      assert.deepStrictEqual(schema.required, ['kind']);
      const kinds = schema.oneOf.map((b) => {
        assert.strictEqual(b.additionalProperties, false);
        assert.ok(b.required.includes('kind'));
        assert.strictEqual(b.properties.kind.enum.length, 1);
        return b.properties.kind.enum[0];
      });
      assert.deepStrictEqual(kinds, KINDS);
      assert.ok(!PORTABLE.test(JSON.stringify(schema)), 'no if/then/else/const/not/$ref (the cores compile draft-04)');
    });

    it('[RDR-ET-7] the inlined anchor and extraction fields are copies of the key schemas', () => {
      // reader-v1 is superseded and unchanged: its anchor is the key's shape before 4.25.0 (no eventId)
      const { eventId, ...before } = strip(keys.hdsSourceAnchor).properties;
      assert.deepStrictEqual(strip(branch('reading').properties.anchor).properties, before);
      assert.deepStrictEqual(strip(branch('reading').properties.anchor).required, keys.hdsSourceAnchor.required);
      for (const f of ['engine', 'engineVersion', 'kbVersion', 'backend']) {
        assert.deepStrictEqual(strip(branch('job').properties[f]), strip(keys.hdsExtraction.properties[f]), f);
      }
    });

    it('[RDR-ET-8] the event ids in content have the related path pattern', () => {
      for (const ref of [branch('answer').properties.inReplyTo, branch('access-result').properties.inReplyTo, branch('written').properties.eventId]) {
        assert.strictEqual(ref.pattern, '^[a-zA-Z0-9_-]+$');
      }
    });

    it('[RDR-ET-9] the HDS-READER.md example is a valid message, and its proposal valid against its type', () => {
      const ajv = new AjvDraft04({ strict: false, logger: false });
      const validate = ajv.compile(schema);
      const examples = jsonBlocks('HDS-READER.md').filter((e) => e.type === TYPE);
      assert.deepStrictEqual(examples.map((e) => e.content.kind), ['reading', 'question', 'answer']);
      for (const e of examples) assert.ok(validate(e.content), JSON.stringify(validate.errors));
      const content = examples[0].content;
      const validateProposal = new Ajv({ strict: false }).compile(eventTypesById(content.proposal.type));
      assert.ok(validateProposal(content.proposal.content), JSON.stringify(validateProposal.errors));
      const item = itemsById[content.proposal.itemKey];
      const itemTypes = item.eventType ? [item.eventType] : item.variations.eventType.options.map((o) => o.value);
      assert.ok(itemTypes.includes(content.proposal.type), 'the item stores that type');
    });

    it('[RDR-ET-15] the writer MUSTs the schema cannot express hold on every documented and test example', () => {
      // HDS-READER.md § Answers, by what they answer, and § What a writer MUST include.
      const ALLOWED = {
        'which-specimen': ['choose', 'skip'],
        'which-unit': ['choose', 'skip'],
        'which-analyte': ['choose', 'skip'],
        'is-fasting': ['choose', 'skip'],
        'which-date': ['confirm', 'skip'],
        'is-this-yours': ['confirm', 'not-mine', 'skip']
      };
      const docs = jsonBlocks('HDS-READER.md').filter((e) => e.type === TYPE).map((e) => e.content);
      const messages = [...docs, ...Object.values(VALID).flat()];
      for (const m of messages.filter((x) => x.kind === 'question')) {
        assert.ok(ALLOWED[m.code], m.code);
        if (m.code === 'which-date' || m.code === 'is-this-yours') assert.strictEqual(m.options, undefined, m.code + ' has no options');
        if (m.code === 'is-fasting') assert.deepStrictEqual(m.options, ['yes', 'no']);
      }
      const docQuestion = docs.find((x) => x.kind === 'question');
      const docAnswer = docs.find((x) => x.kind === 'answer');
      assert.ok(ALLOWED[docQuestion.code].includes(docAnswer.action), 'the documented answer fits its question');
      for (const m of messages.filter((x) => x.kind === 'answer')) {
        // choose answers a which-specimen / which-unit / which-analyte / is-fasting question, always about a candidate.
        if (m.action === 'choose') assert.ok(m.option && m.candidateIds?.length, 'choose carries option and the candidate');
        if (m.action === 'not-mine') assert.strictEqual(m.candidateIds, undefined, 'not-mine is document-level');
        if (m.action === 'correct') assert.ok(typeof m.value === 'number' && m.candidateIds, 'correct carries value and candidateIds');
        if (['correct', 'duplicate', 'request-item'].includes(m.action)) assert.ok(m.candidateIds, m.action + ' answers a reading');
        if (m.timePrecision === 'unknown') assert.strictEqual(m.time, undefined, 'no time with unknown');
        else if (m.timePrecision) assert.strictEqual(typeof m.time, 'number');
      }
      for (const m of messages.filter((x) => x.kind === 'reading')) {
        if (['kept-aside', 'unmapped'].includes(m.status)) assert.ok(m.reason, 'kept-aside / unmapped carries reason');
        if (m.proposal?.time !== undefined) assert.ok(m.proposal.clientData?.hdsTimePrecision, 'a proposal with time carries hdsTimePrecision');
      }
      for (const m of messages.filter((x) => x.kind === 'job' && x.status === 'error')) assert.ok(m.errorCode);
    });

    it('[RDR-ET-10] every enum is exactly this list', () => {
      assert.deepStrictEqual(branch('job').properties.status.enum, ['received', 'reading', 'awaiting-answers', 'awaiting-access', 'writing', 'done', 'error']);
      assert.deepStrictEqual(branch('reading').properties.status.enum, ['clear', 'check', 'unmapped', 'unit-missing', 'kept-aside']);
      assert.deepStrictEqual(branch('reading').properties.reason.enum, REASONS);
      assert.deepStrictEqual(branch('question').properties.code.enum, ['which-specimen', 'which-unit', 'which-analyte', 'which-date', 'is-fasting', 'is-this-yours']);
      assert.deepStrictEqual(branch('answer').properties.action.enum, ['confirm', 'correct', 'not-mine', 'skip', 'choose', 'request-item', 'duplicate']);
      assert.deepStrictEqual(branch('answer').properties.timePrecision.enum, PRECISIONS);
      assert.deepStrictEqual(branch('access-request').properties.level.enum, ['create-only']);
    });

    it('[RDR-ET-11] every kind has exactly these fields, and these required', () => {
      const SHAPES = {
        job: [['kind', 'status', 'attempt', 'engine', 'engineVersion', 'kbVersion'], ['kind', 'status', 'attempt', 'engine', 'engineVersion', 'kbVersion', 'backend', 'counts', 'errorCode']],
        notice: [['kind', 'code'], ['kind', 'code', 'about']],
        reading: [['kind', 'candidateId', 'printed', 'status'], ['kind', 'candidateId', 'printed', 'anchor', 'confidence', 'proposal', 'status', 'reason', 'requestKey', 'kbEntries', 'askOneByOne', 'specimenImplied']],
        question: [['kind', 'code', 'about'], ['kind', 'code', 'about', 'options']],
        answer: [['kind', 'inReplyTo', 'action'], ['kind', 'inReplyTo', 'action', 'candidateIds', 'option', 'value', 'eventType', 'itemKey', 'time', 'timePrecision']],
        'access-request': [['kind', 'streamIds', 'level'], ['kind', 'streamIds', 'level']],
        'access-result': [['kind', 'inReplyTo', 'granted'], ['kind', 'inReplyTo', 'granted']],
        written: [['kind', 'candidateId', 'eventId'], ['kind', 'candidateId', 'eventId']],
        summary: [['kind', 'written'], ['kind', 'written', 'keptAside']]
      };
      for (const [k, [required, props]] of Object.entries(SHAPES)) {
        assert.deepStrictEqual(branch(k).required, required, k + ' required');
        assert.deepStrictEqual(Object.keys(branch(k).properties), props, k + ' properties');
      }
      const r = branch('reading').properties;
      assert.deepStrictEqual(r.printed.required, ['label', 'value']);
      assert.deepStrictEqual(Object.keys(r.printed.properties), ['label', 'value', 'unit', 'refRange', 'flag', 'section']);
      assert.deepStrictEqual(r.proposal.required, ['itemKey', 'type', 'content']);
      assert.deepStrictEqual(Object.keys(r.proposal.properties), ['itemKey', 'type', 'content', 'time', 'clientData']);
      assert.deepStrictEqual(Object.keys(r.proposal.properties.clientData.properties), ['hdsRefRange', 'hdsFlag', 'hdsInterpretation', 'hdsComparator', 'hdsTimePrecision']);
      assert.deepStrictEqual(Object.keys(branch('job').properties.counts.properties), ['readings', 'questions', 'written', 'keptAside', 'dropped']);
      assert.deepStrictEqual(Object.keys(branch('summary').properties.keptAside.items.properties), ['candidateId', 'reason']);
    });

    it('[RDR-ET-12] a definition used in several kinds is the same everywhere', () => {
      const cand = strip(branch('reading').properties.candidateId);
      for (const c of [branch('written').properties.candidateId, branch('summary').properties.keptAside.items.properties.candidateId, branch('answer').properties.candidateIds.items]) {
        assert.deepStrictEqual(strip(c), cand);
      }
      assert.deepStrictEqual(branch('summary').properties.keptAside.items.properties.reason, branch('reading').properties.reason);
      assert.deepStrictEqual(branch('notice').properties.about, branch('question').properties.about);
      assert.deepStrictEqual(strip(branch('question').properties.options.items), strip(branch('answer').properties.option));
      assert.strictEqual(branch('reading').properties.requestKey.pattern, '^[^\\s\\u0000-\\u001f\\u007f-\\u009f]+$');
      assert.strictEqual(branch('reading').properties.printed.properties.flag.maxLength, 16);
      assert.strictEqual(branch('reading').properties.proposal.properties.clientData.properties.hdsFlag.maxLength, 16);
      const r = branch('reading').properties.proposal.properties;
      assert.strictEqual(r.itemKey.pattern, branch('answer').properties.itemKey.pattern);
      assert.strictEqual(r.type.pattern, branch('answer').properties.eventType.pattern);
    });

    it('[RDR-ET-13] the lab and date key values are the model\'s, minus minute and approx for dates', () => {
      const cd = branch('reading').properties.proposal.properties.clientData.properties;
      assert.deepStrictEqual(cd.hdsInterpretation.enum, keys.enums.hdsInterpretation);
      assert.deepStrictEqual(cd.hdsComparator.enum, keys.enums.hdsComparator);
      assert.deepStrictEqual(cd.hdsTimePrecision.enum, keys.enums.hdsTimePrecision.filter((p) => p !== 'minute' && p !== 'approx'));
      assert.deepStrictEqual(cd.hdsTimePrecision.enum, PRECISIONS);
      assert.deepStrictEqual(branch('answer').properties.timePrecision.enum, cd.hdsTimePrecision.enum);
      assert.deepStrictEqual(keys.enums.hdsTimePrecision, ['minute', 'day', 'month', 'year', 'approx', 'unknown']);
      assert.deepStrictEqual(keys.enums.hdsInterpretation, ['H', 'L', 'N', 'A', 'HH', 'LL']);
      assert.deepStrictEqual(keys.enums.hdsComparator, ['<', '<=', '>', '>=']);
    });

    it('[RDR-ET-14] every eventType id, item key and stream id of the model fits the patterns that name them', () => {
      const r = branch('reading').properties.proposal.properties;
      const typeRe = new RegExp(r.type.pattern);
      const itemRe = new RegExp(r.itemKey.pattern);
      const streamRe = new RegExp(branch('access-request').properties.streamIds.items.pattern);
      // The legacy mirror's one wildcard family (numset/*) is not a type an event carries.
      const types = Object.keys(eventTypes.toBePublished()[0].content.types).filter((t) => !t.endsWith('/*'));
      assert.ok(types.length > 400);
      for (const t of types) assert.ok(typeRe.test(t) && t.length <= r.type.maxLength, 'eventType ' + t);
      for (const k of Object.keys(itemsById)) assert.ok(itemRe.test(k) && k.length <= r.itemKey.maxLength, 'item ' + k);
      for (const s of Object.keys(streams.streamsById)) assert.ok(streamRe.test(s) && s.length <= 128, 'stream ' + s);
    });
  });

  describe('[RDR-PACK] built pack.json', () => {
    let pack;

    before(() => {
      const packPath = path.join(__dirname, '../dist/pack.json');
      if (!fs.existsSync(packPath)) return; // npm run build has not run yet
      pack = JSON.parse(fs.readFileSync(packPath, 'utf-8'));
    });

    it('[RDR-PACK-1] the pack carries the eventType', () => {
      if (!pack) return;
      assert.ok(pack.eventTypes.types[TYPE]);
    });
  });
});
