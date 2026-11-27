const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const AjvDraft04 = require('ajv-draft-04');
const addFormats = require('ajv-formats');

// A conversation between a person and a contact (plan 128): the conversation-items root, the eventType
// message/hds-conversation-v1 and the hds block of the conversation alerts. See documentation/CONVERSATION.md.

const TYPE = 'message/hds-conversation-v1';
const keys = require('../src/schemas/clientDataKeys');
const alertSchemas = require('../src/schemas/conversationAlert');
const { eventTypesById } = require('../src/eventTypes');
const streams = require('../src/streams');
const { itemsById } = require('../src/items');
const legacy = require('../definitions/eventTypes/eventTypes-legacy.json');

const ALERT = alertSchemas.hdsConversationAlert;
const FLAVOURS = [
  ['draft-04 (the cores)', () => new AjvDraft04({ strict: false, allErrors: true, coerceTypes: false, validateFormats: true, logger: false })],
  ['draft-07', () => new Ajv({ strict: false, allErrors: true, coerceTypes: false, logger: false })]
];
const PORTABLE = /"(if|then|else|const|not|\$ref)"/;
const strip = (schema) => { const s = structuredClone(schema); delete s.description; delete s.$id; delete s.title; return s; };
const ID_RE = '^[a-zA-Z0-9_-]+$';

const DOC = 'ckq3w8n1x0001';
const GRID = 'ckq3w8n1x0002';
const TABLE = 'ckq3w8n1x0003';
const BOX = { eventId: GRID, attachmentId: 'ckq3w8n1x0002a', page: 1, bbox: [40.6, 22.4, 2.5, 12.9] };
const ANCHOR = { eventId: 'ckq3w8n1x0001', attachmentId: 'ckq3w8n1x0001a', page: 1, bbox: [8.5, 41.2, 83, 2.1] };
const EXTRACTION = { engine: 'hds-reader', engineVersion: '0.3.0', kbVersion: '0.4.0', backend: 'text-layer' };
const HDS_CODES = ['which-specimen', 'which-unit', 'which-analyte', 'which-date', 'is-fasting', 'is-this-yours', 'which-document-kind', 'which-document-date', 'which-row-date', 'which-column-date'];
const SPECIMENS = ['serum-plasma', 'whole-blood', 'citrated-plasma', 'rbc', 'urine', 'urine-24h', 'semen', 'csf', 'stool', 'saliva'];
const KIND = require('../src/documentKinds').documentKinds.kinds;

const branch = (s, k) => s.oneOf.find((b) => b.properties.kind.enum[0] === k);

// DOCUMENTS.md also holds JSON fragments (a kind's row): parse the blocks that are whole objects only.
function jsonBlocksLoose (file) {
  const text = fs.readFileSync(path.join(__dirname, '../documentation', file), 'utf-8');
  return [...text.matchAll(/```json\n([\s\S]*?)\n```/g)].flatMap((m) => { try { return [JSON.parse(m[1])]; } catch { return []; } });
}

function jsonBlocks (file) {
  const text = fs.readFileSync(path.join(__dirname, '../documentation', file), 'utf-8');
  return [...text.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => JSON.parse(m[1]));
}

const proposed = {
  kind: 'proposed-value',
  about: DOC,
  candidateId: 'c-3f9a1e0b',
  printed: { label: 'Ferritine', value: '48', unit: 'ng/mL', refRange: '30 - 400', flag: 'H', section: 'Biochimie' },
  anchor: ANCHOR,
  proposal: {
    itemKey: 'body-blood-serum-ferritin',
    type: 'concentration/ug-l',
    content: 48,
    time: 1773316800,
    clientData: { hdsTimePrecision: 'day', hdsRefRange: { lowerLimit: 30, upperLimit: 400, text: '30 - 400' }, hdsFlag: 'H', hdsInterpretation: 'H', hdsComparator: '<' }
  },
  status: 'clear',
  askOneByOne: false,
  extraction: EXTRACTION
};
const VALID = {
  question: [
    { kind: 'question', about: DOC, code: 'which-unit', candidateId: 'c-78', options: ['g/dL', 'g/L', 'mmol/L'] },
    { kind: 'question', about: DOC, code: 'is-fasting', candidateId: 'c-80', options: ['yes', 'no'] },
    { kind: 'question', about: DOC, code: 'which-date', context: { dates: [{ day: '2026-03-12', text: '12.03.2026', label: 'Prélèvement', role: 'sampling' }, { day: '2026-03-13', text: '13/03/26', role: 'report' }] } },
    { kind: 'question', about: DOC, code: 'which-date', candidateId: 'c-3f9a1e0b' },
    { kind: 'question', about: DOC, code: 'is-this-yours', context: { identity: { name: 'DUPONT Marie', birthDate: '14.03.1985', birthDay: '1985-03-14' }, anchor: ANCHOR } },
    { kind: 'question', about: DOC, code: 'is-this-yours' },
    { kind: 'question', about: DOC, code: 'x-acme-which-lab', candidateId: 'c-1' },
    { kind: 'question', about: DOC, code: 'which-specimen', candidateId: 'c-77', options: ['serum-plasma', 'whole-blood'] },
    { kind: 'question', about: DOC, code: 'which-document-kind', candidateId: 'd-1', options: ['laboratory-report', 'other'] },
    { kind: 'question', about: DOC, code: 'which-document-date', candidateId: 'd-1', context: { dates: [{ day: '2026-03-13', text: '13/03/26', label: 'Édité le', role: 'report' }] } },
    { kind: 'question', about: TABLE, code: 'which-column-date', context: { column: { index: 2 }, anchor: { eventId: TABLE, attachmentId: 'ckq3w8n1x0003a', page: 1, bbox: [52.1, 18.3, 11.4, 4.2] } } },
    { kind: 'question', about: GRID, code: 'which-row-date', context: { grid: { row: 2, column: 1 }, anchor: { ...BOX, bbox: [7.4, 22.4, 2.5, 12.9] } } }
  ],
  'proposed-value': [
    proposed,
    { kind: 'proposed-value', about: DOC, candidateId: 'c-77', printed: { label: 'Cholestérol HDL', value: '1,2', unit: 'mmol/l' }, status: 'kept-aside', reason: 'no-item', requestKey: 'serum-plasma|loinc:2085-9', extraction: EXTRACTION },
    { kind: 'proposed-value', about: DOC, candidateId: 'c-78', printed: { label: 'Hémoglobine', value: '13.5' }, anchor: { attachmentId: 'f2', page: 2 }, status: 'unit-missing', specimenImplied: true, extraction: { ...EXTRACTION, backend: 'ollama:qwen2.5vl:7b' } },
    { ...proposed, proposal: { itemKey: 'body-blood-coded', type: 'lab-result/coded-v1', content: { analyte: { label: { en: 'X' }, codes: [{ system: 'http://loinc.org', code: '2947-0' }] }, value: 140, unit: 'mmol/L' } } },
    { ...proposed, candidateId: 'c-78b', replaces: 'c-78', printed: { label: 'Hémoglobine', value: '13.5' }, proposal: { itemKey: 'body-blood-serum-ferritin', type: 'concentration/ug-l', content: 13.5 }, status: 'check' },
    { ...proposed, candidateId: 'c-79', printed: { ...proposed.printed, samplingTime: '08:30' }, anchor: { ...proposed.anchor, eventId: DOC } },
    // a table read per column on a picture (4.39.0): a value of column 2, once its day is hers and the one read
    { ...proposed, about: TABLE, candidateId: 'c-t2-1', column: { index: 2 }, anchor: { eventId: TABLE, attachmentId: 'ckq3w8n1x0003a', page: 1, bbox: [8.5, 30.1, 83, 2.1] } },
    // a dated grid (4.36.0): the parts of one box, a null content, a box not read
    { kind: 'proposed-value', about: GRID, candidateId: 'c-r1c14-a', printed: { label: '14', value: '10KL x2' }, anchor: BOX, grid: { row: 2, column: 14 }, proposal: { itemKey: 'body-vulva-mucus-inspect', type: 'vulva-mucus-inspect/9d-vector', content: { vectors: { stretchability: 1 }, source: { key: 'creighton', sourceData: '10KL', annotations: { frequency: 'X2' } } }, time: 1773316800, clientData: { hdsTimePrecision: 'day' } }, status: 'check', extraction: EXTRACTION },
    { kind: 'proposed-value', about: GRID, candidateId: 'c-r1c14-b', printed: { label: '14', value: 'P' }, anchor: BOX, grid: { row: 2, column: 14 }, proposal: { itemKey: 'fertility-cycles-peak-day', type: 'activity/plain', content: null, time: 1773316800, clientData: { hdsTimePrecision: 'day' } }, status: 'check', extraction: EXTRACTION },
    { kind: 'proposed-value', about: GRID, candidateId: 'c-r1c15', printed: { label: '15' }, anchor: { ...BOX, bbox: [43.1, 22.4, 2.5, 12.9] }, grid: { row: 2, column: 15 }, status: 'unmapped', reason: 'not-read', extraction: EXTRACTION }
  ],
  'proposed-document': [
    { kind: 'proposed-document', about: DOC, candidateId: 'd-5c2e9a14', proposal: { documentKind: 'laboratory-report', time: 1773316800, timePrecision: 'day' }, anchor: ANCHOR, status: 'clear', extraction: EXTRACTION },
    { kind: 'proposed-document', about: DOC, candidateId: 'd-1', proposal: { documentKind: 'laboratory-report' }, status: 'check' },
    { kind: 'proposed-document', about: DOC, candidateId: 'd-2', replaces: 'd-1', proposal: { time: 1772366400, timePrecision: 'month' }, status: 'check' }
  ],
  answer: [
    { kind: 'answer', inReplyTo: 'ckq3w8n1x0012', about: DOC, action: 'confirm', candidateIds: ['c-3f9a1e0b', 'c-79'], written: [{ candidateId: 'c-3f9a1e0b', eventId: 'ckq3w8n1x0020' }, { candidateId: 'c-79', eventId: 'ckq3w8n1x0021' }] },
    { kind: 'answer', inReplyTo: 'ckq3w8n1x0013', about: DOC, action: 'correct', candidateIds: ['c-3f9a1e0b'], written: [{ candidateId: 'c-3f9a1e0b', eventId: 'ckq3w8n1x0022' }] },
    { kind: 'answer', inReplyTo: 'ckq3w8n1x0014', about: DOC, action: 'choose', option: 'g/dL', candidateIds: ['c-78'] },
    { kind: 'answer', inReplyTo: 'ckq3w8n1x0015', about: DOC, action: 'not-mine' },
    { kind: 'answer', inReplyTo: 'ckq3w8n1x0015', about: DOC, action: 'confirm', basis: 'profile-match' },
    { kind: 'answer', inReplyTo: 'ckq3w8n1x0016', about: DOC, action: 'confirm', time: 1773316800, timePrecision: 'day' },
    { kind: 'answer', inReplyTo: 'ckq3w8n1x0016', about: DOC, action: 'confirm', timePrecision: 'unknown' },
    { kind: 'answer', inReplyTo: 'ckq3w8n1x0017', about: DOC, action: 'duplicate', candidateIds: ['c-3f9a1e0b'] },
    { kind: 'answer', inReplyTo: 'ckq3w8n1x0017', about: DOC, action: 'duplicate', candidateIds: ['c-3f9a1e0b', 'c-79'], basis: 'existing-value' },
    { kind: 'answer', inReplyTo: 'ckq3w8n1x0018', about: DOC, action: 'skip', candidateIds: ['c-77'] },
    { kind: 'answer', inReplyTo: 'ckq3w8n1x0019', about: DOC, action: 'skip', candidateIds: ['c-79'], note: 'I think this one was taken after lunch.' },
    { kind: 'answer', inReplyTo: 'ckq3w8n1x0024', about: DOC, action: 'confirm', candidateIds: ['d-5c2e9a14'], applied: ['time', 'kind'], note: 'The follow-up blood test.' },
    { kind: 'answer', inReplyTo: 'ckq3w8n1x0025', about: DOC, action: 'choose', option: 'laboratory-report', candidateIds: ['d-1'] },
    { kind: 'answer', inReplyTo: 'ckq3w8n1x0026', about: DOC, action: 'confirm', candidateIds: ['d-1'], time: 1773316800, timePrecision: 'day' },
    { kind: 'answer', inReplyTo: 'ckq3w8n1x0027', about: DOC, action: 'skip', candidateIds: ['d-2'], basis: 'not-pending' },
    { kind: 'answer', inReplyTo: 'ckq3w8n1x0028', about: GRID, action: 'confirm', time: 1773316800, timePrecision: 'day' },
    { kind: 'answer', inReplyTo: 'ckq3w8n1x0040', about: TABLE, action: 'confirm', time: 1773316800, timePrecision: 'day' }
  ]
};
const KINDS = Object.keys(VALID);

const VALID_ALERTS = [
  { kind: 'task-status', about: DOC, status: 'received', attempt: 1 },
  { kind: 'task-status', about: DOC, status: 'on-hold', attempt: 1 },
  { kind: 'task-status', about: DOC, status: 'awaiting-answers', attempt: 1, counts: { proposed: 12, questions: 1, keptAside: 2, dropped: 3 } },
  { kind: 'task-status', about: GRID, status: 'awaiting-answers', attempt: 1, counts: { proposed: 140, questions: 6, notRead: 11 } },
  { kind: 'task-status', about: DOC, status: 'error', attempt: 2, errorCode: 'x-acme-scanner-offline' },
  { kind: 'notice', code: 'no-result-found', about: DOC },
  { kind: 'notice', code: 'typed-text-not-read' },
  { kind: 'notice', code: 'several-sampling-dates', about: DOC },
  { kind: 'notice', code: 'columns-not-read', about: TABLE },
  { kind: 'notice', code: 'several-result-columns', about: DOC },
  { kind: 'notice', code: 'lines-may-be-missing', about: TABLE },
  { kind: 'notice', code: 'grid-not-located', about: GRID },
  { kind: 'notice', code: 'kind-not-read', about: GRID },
  { kind: 'notice', code: 'note-not-read', about: DOC },
  { kind: 'notice', code: 'ready' },
  { kind: 'task-status', about: DOC, status: 'error', attempt: 1, errorCode: 'reading-failed' },
  { kind: 'question', eventId: 'ckq3w8n1x0011', about: DOC },
  { kind: 'proposed-values', about: DOC, count: 12 },
  { kind: 'answer', eventId: 'ckq3w8n1x0030', inReplyTo: 'ckq3w8n1x0012', about: DOC }
];
const ALERT_KINDS = ['task-status', 'notice', 'question', 'proposed-values', 'answer'];

describe('[CNV] conversation', () => {
  describe('[CNV-STR] the conversation-items root', () => {
    it('[CNV-STR-1] is a root marked explicitGrantOnly, with no children in the model, named for consent screens', () => {
      const root = streams.streamsById['conversation-items'];
      assert.ok(root, 'conversation-items must exist');
      assert.strictEqual(root.parentId, null);
      assert.strictEqual(root.explicitGrantOnly, true);
      assert.ok(!root.children || root.children.length === 0, 'its children are created by the person\'s app');
      assert.ok(streams.roots.find((r) => r.id === 'conversation-items'));
      assert.strictEqual(root.label.en, root.name);
      assert.ok(root.label.fr && root.description.en && root.description.fr);
    });

    it('[CNV-STR-2] no item on the root', () => {
      const on = Object.entries(itemsById).filter(([, i]) => i.streamId === 'conversation-items').map(([k]) => k);
      assert.deepStrictEqual(on, []);
    });

    it('[CNV-STR-3] the Reader\'s v1 app tree is still not a model stream', () => {
      for (const id of ['hds-reader', 'hds-reader-inbox', 'hds-reader-dialogue', 'hds-reader-app']) {
        assert.strictEqual(streams.streamsById[id], undefined, id);
      }
    });
  });

  for (const [flavour, make] of FLAVOURS) {
    describe(`[CNV-ET] ${TYPE}, ${flavour}`, () => {
      let validate;

      before(() => {
        const ajv = make();
        addFormats(ajv);
        validate = ajv.compile(eventTypesById(TYPE));
      });

      it('[CNV-ET-1] accepts an item of every kind', () => {
        for (const [k, list] of Object.entries(VALID)) {
          for (const m of list) assert.ok(validate(m), `${k}: ${JSON.stringify(m)} ${JSON.stringify(validate.errors)}`);
        }
      });

      it('[CNV-ET-2] every kind is closed, and so is every object in it', () => {
        for (const [k, list] of Object.entries(VALID)) {
          assert.ok(!validate({ ...list[0], comment: 'free text' }), k);
          if (k !== 'answer') assert.ok(!validate({ ...list[0], note: 'free text' }), k + ': a note is hers, on an answer only');
          assert.ok(!validate({ ...list[0], text: { en: 'Is this right?' } }), k + ': no text in this version');
        }
        const pd = VALID['proposed-document'][0];
        for (const bad of [
          { ...pd, printed: { label: 'Date', value: '12.03.2026' } },
          { ...pd, proposal: { ...pd.proposal, title: 'Bilan sanguin' } },
          { ...pd, proposal: { ...pd.proposal, class: { system: 'http://snomed.info/sct', code: '371525003' } } },
          { ...pd, anchor: { ...ANCHOR, text: '12.03.2026' } },
          { ...pd, extraction: { ...EXTRACTION, confirmedBy: 'person' } }
        ]) {
          assert.ok(!validate(bad), JSON.stringify(bad));
        }
        const [, , dateQ, , idQ] = VALID.question;
        for (const bad of [
          { ...idQ, context: { ...idQ.context, address: 'Rue X 1' } },
          { ...idQ, context: { identity: { ...idQ.context.identity, insuranceNumber: '756.1234' } } },
          { ...idQ, context: { identity: { ...idQ.context.identity, sex: 'F' } } },
          { ...idQ, context: { printed: { label: 'Nom', value: 'DUPONT' } } },
          { ...dateQ, context: { dates: [{ day: '2026-03-12', text: '12.03.2026', person: 'Dr Martin' }] } },
          { ...idQ, context: { anchor: { ...ANCHOR, text: 'DUPONT' } } },
          { ...proposed, printed: { ...proposed.printed, ocr: 'Ferritine 48 ng/mL' } },
          { ...proposed, anchor: { ...ANCHOR, text: 'Ferritine' } },
          { ...proposed, proposal: { ...proposed.proposal, note: 'x' } },
          { ...proposed, proposal: { ...proposed.proposal, clientData: { hdsTimeText: 'spring 2019' } } },
          { ...proposed, extraction: { ...EXTRACTION, confirmedBy: 'person' } },
          { ...proposed, extraction: { ...EXTRACTION, prompt: 'Read the lab report' } },
          { ...VALID.answer[0], written: [{ candidateId: 'c-3f9a1e0b', eventId: 'ckq3w8n1x0020', value: 48 }] }
        ]) {
          assert.ok(!validate(bad), JSON.stringify(bad));
        }
      });

      it('[CNV-ET-3] a missing or unknown kind fails; the reader-v1 kinds are not kinds here', () => {
        assert.ok(!validate({}));
        for (const kind of ['text', 'chat', 'job', 'summary', 'notice', 'reading', 'access-request', 'access-result', 'written', 'Question']) {
          assert.ok(!validate({ kind, about: DOC, code: 'x' }), kind);
        }
        assert.ok(!validate({ ...proposed, kind: 'question' }), 'a proposed-value shape under another kind');
      });

      it('[CNV-ET-4] required fields per kind', () => {
        const { about: _a, ...qNoAbout } = VALID.question[0];
        assert.ok(!validate(qNoAbout), 'question without about');
        assert.ok(!validate({ kind: 'question', about: DOC }), 'question without code');
        for (const f of ['about', 'candidateId', 'printed', 'status', 'extraction']) {
          const { [f]: _, ...partial } = proposed;
          assert.ok(!validate(partial), 'proposed-value without ' + f);
        }
        for (const f of Object.keys(EXTRACTION)) {
          const { [f]: _, ...partial } = EXTRACTION;
          assert.ok(!validate({ ...proposed, extraction: partial }), 'extraction without ' + f);
        }
        for (const f of ['inReplyTo', 'about', 'action']) {
          const { [f]: _, ...partial } = VALID.answer[0];
          assert.ok(!validate(partial), 'answer without ' + f);
        }
        assert.ok(!validate({ ...proposed, printed: { value: '48' } }), 'printed without label');
        assert.ok(!validate({ ...proposed, printed: { label: 'X' } }), 'printed without value');
        assert.ok(!validate({ ...proposed, printed: { label: 'X' }, status: 'unmapped', reason: 'no-item' }), 'printed without value, another reason');
        const notRead = VALID['proposed-value'].at(-1);
        for (const grid of [{}, { row: 2 }, { column: 14 }, { row: 0, column: 1 }, { row: 1, column: 100 }, { row: 1.5, column: 1 }, { row: 2, column: 14, part: 'mucus' }]) {
          assert.ok(!validate({ ...notRead, grid }), 'grid ' + JSON.stringify(grid));
          assert.ok(!validate({ ...VALID.question.at(-1), context: { ...VALID.question.at(-1).context, grid } }), 'context.grid ' + JSON.stringify(grid));
        }
        const colQ = VALID.question.find((q) => q.code === 'which-column-date');
        const colV = VALID['proposed-value'].find((v) => v.column);
        for (const column of [{}, { index: 0 }, { index: 100 }, { index: 1.5 }, { index: 2, page: 1 }]) {
          assert.ok(!validate({ ...colV, column }), 'column ' + JSON.stringify(column));
          assert.ok(!validate({ ...colQ, context: { ...colQ.context, column } }), 'context.column ' + JSON.stringify(column));
        }
        for (const content of [null, 48, {}]) assert.ok(validate({ ...proposed, proposal: { ...proposed.proposal, content } }), 'proposal.content ' + JSON.stringify(content));
        const { content: _c, ...noContent } = proposed.proposal;
        assert.ok(!validate({ ...proposed, proposal: noContent }), 'proposal without content, null is written');
        assert.ok(!validate({ ...VALID.question[4], context: {} }), 'an empty context');
        assert.ok(!validate({ ...VALID.question[4], context: { identity: {} } }), 'an empty identity');
        assert.ok(!validate({ ...VALID.question[2], context: { dates: [] } }), 'no dates');
        assert.ok(!validate({ ...VALID.question[2], context: { dates: [{ day: '2026-03-12' }] } }), 'a date without its text');
        assert.ok(!validate({ ...VALID.answer[0], written: [] }), 'an empty written');
        assert.ok(!validate({ ...VALID.answer[0], written: [{ candidateId: 'c-1' }] }), 'written without eventId');
        const pd = VALID['proposed-document'][0];
        for (const f of ['about', 'candidateId', 'proposal', 'status']) {
          const { [f]: _, ...partial } = pd;
          assert.ok(!validate(partial), 'proposed-document without ' + f);
        }
        const { extraction: _e, anchor: _an, ...bare } = pd;
        assert.ok(validate(bare), 'proposed-document without extraction or anchor ' + JSON.stringify(validate.errors));
        assert.ok(!validate({ ...pd, proposal: {} }), 'an empty proposal');
        assert.ok(!validate({ ...pd, proposal: { time: 1773316800 } }), 'a time without its precision');
        assert.ok(!validate({ ...pd, proposal: { documentKind: 'other', timePrecision: 'day' } }), 'a precision without a time');
      });

      it('[CNV-ET-5] codes, ids, options and dates reject free text and values outside the lists', () => {
        const answer = { kind: 'answer', inReplyTo: 'ckq3w8n1x0016', about: DOC, action: 'confirm' };
        const q = VALID.question[0];
        for (const bad of [
          { ...q, code: 'Which unit is it?' },
          { ...q, code: 'X-acme-q' },
          { ...q, code: '-x' },
          { ...q, about: 'document' + ' ' },
          { ...q, about: 'x'.repeat(65) },
          { ...q, candidateId: 'Ferritine 48' },
          { ...q, options: ['grams per litre'] },
          { ...VALID.question[4], context: { identity: { birthDay: '14.03.1985' } } },
          { ...VALID.question[4], context: { identity: { name: 'x'.repeat(129) } } },
          { ...VALID.question[2], context: { dates: [{ day: '2026-3-12', text: '12.3.26' }] } },
          { ...VALID.question[2], context: { dates: [{ day: '2026-03-12', text: '12.03.26', role: 'birth' }] } },
          { ...VALID.question[2], context: { dates: Array(7).fill({ day: '2026-03-12', text: '12.03.26' }) } },
          { ...answer, inReplyTo: 'not an id' },
          { ...answer, action: 'choose', option: 'the second one' },
          { ...answer, action: 'correct', value: 4.8 },
          { ...answer, action: 'correct', eventType: 'concentration/ug-l' },
          { ...answer, action: 'correct', itemKey: 'body-blood-serum-ferritin' },
          { ...answer, basis: 'name-match' },
          { ...proposed, printed: { ...proposed.printed, time: '08:30' } },
          { ...proposed, printed: { ...proposed.printed, samplingTime: '8.30 am' } },
          { ...proposed, printed: { ...proposed.printed, samplingTime: '25:00' } },
          { ...proposed, printed: { ...proposed.printed, samplingTime: '8h30' } },
          { ...proposed, printed: { ...proposed.printed, samplingTime: 830 } },
          { ...proposed, anchor: { ...proposed.anchor, eventId: 'not an id' } },
          { ...answer, eventIds: ['ckq3w8n1x0020'] },
          { ...answer, candidateIds: ['Ferritine 48'] },
          { ...answer, time: '2026-03-12', timePrecision: 'day' },
          { ...answer, time: 1773316800, timePrecision: 'minute' },
          { ...answer, written: [{ candidateId: 'c-1', eventId: 'ck/../x' }] },
          { ...proposed, candidateId: 'Ferritine 48 ng/mL' },
          { ...proposed, replaces: 'Ferritine 48' },
          { ...q, options: ['x'.repeat(129)] },
          { ...answer, action: 'choose', option: 'x'.repeat(129) },
          { ...proposed, confidence: 0.92 },
          { ...proposed, kbEntries: ['alias.fr.ferritine'] },
          { ...proposed, requestKey: 'serum|label:fr:cholestérol hdl' },
          { ...proposed, reason: 'special-category' },
          { ...proposed, reason: 'other-person' },
          { ...proposed, status: 'written' },
          { ...proposed, proposal: { ...proposed.proposal, clientData: { hdsTimePrecision: 'approx' } } },
          { ...proposed, proposal: { ...proposed.proposal, content: '48' } },
          { ...proposed, extraction: { ...EXTRACTION, engine: 'HDS Reader' } },
          { ...proposed, extraction: { ...EXTRACTION, backend: 'read by Dr Martin' } },
          { ...answer, note: '' },
          { ...answer, note: 'x'.repeat(1001) },
          { ...answer, note: { en: 'yes' } },
          { ...answer, applied: ['date'] },
          { ...answer, applied: [] },
          { ...answer, applied: ['time', 'time'] },
          { ...answer, basis: 'pending' },
          { ...VALID['proposed-document'][0], proposal: { documentKind: 'Laboratory report' } },
          { ...VALID['proposed-document'][0], proposal: { documentKind: { system: 'http://snomed.info/sct', code: '4241000179101' } } },
          { ...VALID['proposed-document'][0], proposal: { documentKind: 'x'.repeat(65) } },
          { ...VALID['proposed-document'][0], proposal: { time: 1773316800, timePrecision: 'unknown' } },
          { ...VALID['proposed-document'][0], proposal: { time: 1773316800, timePrecision: 'approx' } },
          { ...VALID['proposed-document'][0], proposal: { time: '2026-03-12', timePrecision: 'day' } },
          { ...VALID['proposed-document'][0], status: 'unmapped' },
          { ...VALID['proposed-document'][0], status: 'kept-aside' },
          { ...VALID['proposed-document'][0], candidateId: 'Laboratory report' },
          { ...VALID['proposed-document'][0], about: 'not an id' }
        ]) {
          assert.ok(!validate(bad), JSON.stringify(bad));
        }
      });
    });

    describe(`[CNV-AL] the conversation alerts' hds block, ${flavour}`, () => {
      let validate, upstream;

      before(() => {
        const ajv = make();
        addFormats(ajv);
        validate = ajv.compile(ALERT);
        upstream = make().compile(legacy.types['notification/alert-cmc']);
      });

      it('[CNV-AL-1] accepts every kind', () => {
        for (const a of VALID_ALERTS) assert.ok(validate(a), JSON.stringify(a) + ' ' + JSON.stringify(validate.errors));
      });

      it('[CNV-AL-2] every kind is closed and carries no value, text, name, date, item key or stream id', () => {
        for (const a of VALID_ALERTS) {
          for (const extra of [{ value: 48 }, { label: 'Ferritine' }, { text: 'Please check' }, { name: 'DUPONT Marie' }, { date: '2026-03-12' }, { itemKey: 'body-weight' }, { streamId: 'conv-k3x9q2m7a1b0' }]) {
            assert.ok(!validate({ ...a, ...extra }), a.kind + ' ' + JSON.stringify(extra));
          }
        }
        assert.ok(!validate({ ...VALID_ALERTS[1], counts: { written: 3 } }), 'no written count: her app writes');
        assert.ok(!validate({ ...VALID_ALERTS[1], counts: { readings: 3 } }), 'no readings count');
        assert.ok(!validate({ ...VALID_ALERTS[1], counts: { notread: 3 } }), 'notRead, and no other spelling');
      });

      it('[CNV-AL-3] required fields, ids, codes and enums', () => {
        for (const bad of [
          {}, { kind: 'item-reminder', itemKey: 'body-weight' }, { kind: 'task-status', about: DOC, status: 'reading' },
          { kind: 'task-status', about: DOC, status: 'writing', attempt: 1 }, { kind: 'task-status', about: DOC, status: 'awaiting-access', attempt: 1 },
          { kind: 'task-status', about: DOC, status: 'reading', attempt: 0 }, { kind: 'task-status', about: DOC, status: 'error', attempt: 1, errorCode: 'Timeout reading Ferritine' },
          { kind: 'notice' }, { kind: 'notice', code: 'We could not read page 2' }, { kind: 'notice', code: 'x', about: 'Ferritine 48' },
          { kind: 'question', eventId: 'ckq3w8n1x0011' }, { kind: 'question', about: DOC }, { kind: 'question', eventId: 'x'.repeat(65), about: DOC },
          { kind: 'proposed-values', about: DOC }, { kind: 'proposed-values', about: DOC, count: 0 }, { kind: 'proposed-values', about: DOC, count: 1.5 },
          { kind: 'answer', eventId: 'ckq3w8n1x0030', about: DOC }, { kind: 'answer', eventId: 'ck/../x', inReplyTo: 'a', about: DOC }
        ]) {
          assert.ok(!validate(bad), JSON.stringify(bad));
        }
      });

      it('[CNV-AL-4] a full alert with each hds block is still accepted by the upstream notification/alert-cmc schema', () => {
        for (const hds of VALID_ALERTS) {
          const alert = { level: 'info', title: { en: 'T' }, body: { en: 'B' }, code: 'hds-' + hds.kind, hds };
          assert.ok(upstream(alert), JSON.stringify(upstream.errors));
        }
      });
    });
  }

  describe('[CNV-SHAPE] shapes, pinned', () => {
    const schema = eventTypesById(TYPE);
    const reader = eventTypesById('message/hds-reader-v1');

    it('[CNV-SHAPE-1] one closed branch per kind, discriminated by a one-value enum, in the portable subset', () => {
      for (const s of [schema, ALERT]) {
        assert.deepStrictEqual(s.required, ['kind']);
        assert.strictEqual(s.properties, undefined, 'no root properties');
        for (const b of s.oneOf) {
          assert.strictEqual(b.additionalProperties, false);
          assert.ok(b.required.includes('kind'));
          assert.strictEqual(b.properties.kind.enum.length, 1);
        }
        assert.ok(!PORTABLE.test(JSON.stringify(s)), 'no if/then/else/const/not/$ref (the cores compile draft-04)');
      }
      assert.deepStrictEqual(schema.oneOf.map((b) => b.properties.kind.enum[0]), KINDS);
      assert.deepStrictEqual(ALERT.oneOf.map((b) => b.properties.kind.enum[0]), ALERT_KINDS);
    });

    it('[CNV-SHAPE-2] every kind has exactly these fields, and these required', () => {
      const SHAPES = {
        question: [['kind', 'about', 'code'], ['kind', 'about', 'code', 'candidateId', 'options', 'context']],
        'proposed-value': [['kind', 'about', 'candidateId', 'printed', 'status', 'extraction'], ['kind', 'about', 'candidateId', 'replaces', 'printed', 'anchor', 'grid', 'column', 'proposal', 'status', 'reason', 'requestKey', 'askOneByOne', 'specimenImplied', 'extraction']],
        'proposed-document': [['kind', 'about', 'candidateId', 'proposal', 'status'], ['kind', 'about', 'candidateId', 'replaces', 'proposal', 'anchor', 'status', 'extraction']],
        answer: [['kind', 'inReplyTo', 'about', 'action'], ['kind', 'inReplyTo', 'about', 'action', 'candidateIds', 'option', 'time', 'timePrecision', 'basis', 'written', 'applied', 'note']]
      };
      const pdProposal = branch(schema, 'proposed-document').properties.proposal;
      assert.deepStrictEqual(Object.keys(pdProposal.properties), ['documentKind', 'time', 'timePrecision']);
      assert.deepStrictEqual(branch(schema, 'answer').properties.applied.items.enum, ['time', 'kind']);
      assert.strictEqual(pdProposal.minProperties, 1);
      assert.deepStrictEqual(pdProposal.dependencies, { time: ['timePrecision'], timePrecision: ['time'] });
      assert.deepStrictEqual(pdProposal.properties.timePrecision.enum, ['day', 'month', 'year']);
      assert.deepStrictEqual(branch(schema, 'proposed-document').properties.status.enum, ['clear', 'check']);
      const note = branch(schema, 'answer').properties.note;
      assert.deepStrictEqual([note.type, note.minLength, note.maxLength], ['string', 1, 1000]);
      for (const [k, [required, props]] of Object.entries(SHAPES)) {
        assert.deepStrictEqual(branch(schema, k).required, required, k + ' required');
        assert.deepStrictEqual(Object.keys(branch(schema, k).properties), props, k + ' properties');
      }
      const ctx = branch(schema, 'question').properties.context;
      assert.deepStrictEqual(Object.keys(ctx.properties), ['identity', 'dates', 'grid', 'column', 'anchor']);
      assert.deepStrictEqual([ctx.properties.column.required, Object.keys(ctx.properties.column.properties)], [['index'], ['index']]);
      assert.deepStrictEqual(strip(ctx.properties.column), strip(branch(schema, 'proposed-value').properties.column), 'a value\'s column is its question\'s');
      assert.deepStrictEqual(strip(ctx.properties.grid), strip(branch(schema, 'proposed-value').properties.grid));
      assert.deepStrictEqual(ctx.properties.grid.required, ['row', 'column']);
      assert.deepStrictEqual(Object.keys(ctx.properties.identity.properties), ['name', 'birthDate', 'birthDay']);
      assert.deepStrictEqual(ctx.properties.dates.items.required, ['day', 'text']);
      assert.deepStrictEqual(Object.keys(ctx.properties.dates.items.properties), ['day', 'text', 'label', 'role']);
      assert.deepStrictEqual(ctx.properties.dates.items.properties.role.enum, ['sampling', 'report', 'received', 'other']);
      const w = branch(schema, 'answer').properties.written.items;
      assert.deepStrictEqual(w.required, ['candidateId', 'eventId']);
      assert.deepStrictEqual(Object.keys(w.properties), ['candidateId', 'eventId']);
      const ALERT_SHAPES = {
        'task-status': [['kind', 'about', 'status', 'attempt'], ['kind', 'about', 'status', 'attempt', 'counts', 'errorCode']],
        notice: [['kind', 'code'], ['kind', 'code', 'about']],
        question: [['kind', 'eventId', 'about'], ['kind', 'eventId', 'about']],
        'proposed-values': [['kind', 'about', 'count'], ['kind', 'about', 'count']],
        answer: [['kind', 'eventId', 'inReplyTo', 'about'], ['kind', 'eventId', 'inReplyTo', 'about']]
      };
      for (const [k, [required, props]] of Object.entries(ALERT_SHAPES)) {
        assert.deepStrictEqual(branch(ALERT, k).required, required, 'alert ' + k + ' required');
        assert.deepStrictEqual(Object.keys(branch(ALERT, k).properties), props, 'alert ' + k + ' properties');
      }
      assert.deepStrictEqual(Object.keys(branch(ALERT, 'task-status').properties.counts.properties), ['proposed', 'questions', 'keptAside', 'dropped', 'notRead']);
    });

    it('[CNV-DOC-STATUS] the two pages list exactly the statuses of the schema', () => {
      const { STATUSES } = require('../src/schemas/conversationAlert');
      for (const [file, line] of [['CONVERSATION.md', /^\| `task-status` \| contact → person \| .*$/m], ['CUSTOM-FIELDS-AND-SYSTEM.md', /^- `status` is one of [^;]*;/m]]) {
        const text = line.exec(fs.readFileSync(path.join(__dirname, '../documentation', file), 'utf8'))[0];
        const list = file === 'CONVERSATION.md' ? /`status` \((.*?`error`)\)/.exec(text)[1] : text;
        assert.deepStrictEqual([...list.matchAll(/`([a-z-]+)`/g)].map((m) => m[1]).filter((c) => c !== 'status'), STATUSES, file);
      }
    });

    it('[CNV-SHAPE-3] every enum is exactly this list', () => {
      assert.deepStrictEqual(branch(schema, 'answer').properties.action.enum, ['confirm', 'correct', 'not-mine', 'skip', 'choose', 'request-item', 'duplicate']);
      assert.deepStrictEqual(branch(schema, 'answer').properties.timePrecision.enum, ['day', 'month', 'year', 'unknown']);
      assert.deepStrictEqual(branch(schema, 'answer').properties.basis.enum, ['profile-match', 'existing-value', 'not-pending']);
      assert.deepStrictEqual(branch(ALERT, 'task-status').properties.status.enum, ['received', 'reading', 'on-hold', 'awaiting-answers', 'done', 'error']);
      assert.strictEqual(branch(schema, 'question').properties.code.enum, undefined, 'an open code');
      const codeRe = new RegExp(branch(schema, 'question').properties.code.pattern);
      for (const c of [...HDS_CODES, 'x-acme-which-lab']) assert.ok(codeRe.test(c), c);
    });

    it('[CNV-SHAPE-4] the copies are the same definitions as their sources', () => {
      const pv = branch(schema, 'proposed-value').properties;
      const rd = branch(reader, 'reading').properties;
      for (const f of ['candidateId', 'status', 'requestKey', 'askOneByOne', 'specimenImplied']) {
        assert.deepStrictEqual(strip(pv[f]), strip(rd[f]), 'proposed-value.' + f + ' = reader-v1 reading.' + f);
      }
      // reason is reader-v1's plus not-read, proposal's content may be null (4.36.0)
      assert.deepStrictEqual(pv.reason.enum, [...rd.reason.enum, 'not-read']);
      const nonNull = strip(pv.proposal);
      assert.deepStrictEqual(nonNull.properties.content.type, ['number', 'object', 'null']);
      nonNull.properties.content.type.pop();
      assert.deepStrictEqual(nonNull, strip(rd.proposal), 'proposed-value.proposal = reader-v1 reading.proposal, null aside');
      // printed is reader-v1's plus the column's printed time (4.25.0), display only, and value optional (4.36.0, not-read)
      const { samplingTime, ...printedV1 } = strip(pv.printed).properties;
      assert.deepStrictEqual({ ...strip(pv.printed), required: ['label', 'value'], properties: printedV1 }, strip(rd.printed), 'proposed-value.printed = reader-v1 reading.printed + samplingTime');
      assert.deepStrictEqual(pv.printed.required, ['label']);
      assert.deepStrictEqual([samplingTime.type, samplingTime.maxLength, samplingTime.pattern], ['string', 5, '^([01][0-9]|2[0-3]):[0-5][0-9]$']);
      assert.deepStrictEqual(strip(pv.anchor), strip(keys.hdsSourceAnchor));
      assert.deepStrictEqual(strip(branch(schema, 'question').properties.context.properties.anchor), strip(keys.hdsSourceAnchor));
      assert.deepStrictEqual(Object.keys(pv.extraction.properties), ['engine', 'engineVersion', 'kbVersion', 'backend']);
      for (const f of Object.keys(pv.extraction.properties)) {
        assert.deepStrictEqual(strip(pv.extraction.properties[f]), strip(keys.hdsExtraction.properties[f]), 'extraction.' + f);
      }
      assert.deepStrictEqual(strip(pv.replaces), strip(pv.candidateId));
      // a proposed document reuses the proposed value's id, anchor and extraction shapes
      const pd = branch(schema, 'proposed-document').properties;
      for (const f of ['about', 'candidateId', 'replaces']) assert.deepStrictEqual(strip(pd[f]), strip(pv.candidateId), 'proposed-document.' + f);
      assert.deepStrictEqual(strip(pd.anchor), strip(keys.hdsSourceAnchor));
      assert.deepStrictEqual(strip(pd.extraction), strip(pv.extraction));
      const kindRe = new RegExp(pd.proposal.properties.documentKind.pattern);
      for (const k of Object.keys(KIND)) assert.ok(kindRe.test(k), 'a kind key is a proposal kind: ' + k);
      // Options are reader-v1's but up to 128 characters, so a which-analyte option holds any item key.
      const q = branch(schema, 'question').properties;
      const rq = branch(reader, 'question').properties;
      const widen = (s) => JSON.parse(JSON.stringify(strip(s)).replace('{1,64}', '{1,128}').replace(/"description":"[^"]*",?/g, ''));
      assert.deepStrictEqual(widen(q.options), widen(rq.options));
      assert.deepStrictEqual(strip(branch(schema, 'answer').properties.option), widen(branch(reader, 'answer').properties.option));
      assert.strictEqual(q.options.items.pattern, branch(schema, 'answer').properties.option.pattern);
      const optionRe = new RegExp(q.options.items.pattern);
      for (const k of Object.keys(itemsById)) assert.ok(optionRe.test(k), 'an item key is an option: ' + k);
      assert.strictEqual(pv.proposal.properties.itemKey.maxLength, 128);
      for (const f of ['action', 'candidateIds', 'time', 'timePrecision']) {
        assert.deepStrictEqual(strip(branch(schema, 'answer').properties[f].enum || branch(schema, 'answer').properties[f]), strip(branch(reader, 'answer').properties[f].enum || branch(reader, 'answer').properties[f]), 'answer.' + f + ' enum');
      }
      assert.deepStrictEqual(strip(branch(schema, 'answer').properties.candidateIds.items), strip(pv.candidateId));
      assert.deepStrictEqual(strip(branch(schema, 'answer').properties.written.items.properties.candidateId), strip(pv.candidateId));
    });

    it('[CNV-SHAPE-5] every event id, here and in the alerts, has the related path pattern and at most 64 characters', () => {
      const ids = [
        branch(schema, 'question').properties.about, branch(schema, 'question').properties.candidateId,
        branch(schema, 'proposed-value').properties.about, branch(schema, 'proposed-value').properties.replaces,
        branch(schema, 'proposed-document').properties.about, branch(schema, 'proposed-document').properties.replaces,
        branch(schema, 'answer').properties.inReplyTo, branch(schema, 'answer').properties.about,
        branch(schema, 'answer').properties.written.items.properties.eventId,
        ...ALERT.oneOf.flatMap((b) => ['about', 'eventId', 'inReplyTo'].filter((f) => b.properties[f]).map((f) => b.properties[f]))
      ];
      assert.strictEqual(ids.length, 17);
      for (const id of ids) {
        assert.strictEqual(id.pattern, ID_RE);
        assert.strictEqual(id.maxLength, 64);
      }
      assert.strictEqual(branch(ALERT, 'notice').properties.code.pattern, branch(schema, 'question').properties.code.pattern);
      assert.strictEqual(branch(ALERT, 'task-status').properties.errorCode.pattern, branch(reader, 'job').properties.errorCode.pattern);
    });

    it('[CNV-SHAPE-6] the alert schema is published with the pack, under json-schemas/', () => {
      const files = alertSchemas.toBePublished();
      assert.deepStrictEqual(files.map((f) => f.path + f.filename), ['./json-schemas/hds-conversation-alert.json']);
      assert.strictEqual(files[0].content, ALERT);
      assert.strictEqual(ALERT.$id, 'https://model.datasafe.dev/json-schemas/hds-conversation-alert.json');
      const built = path.join(__dirname, '../dist/json-schemas/hds-conversation-alert.json');
      if (fs.existsSync(path.join(__dirname, '../dist/pack.json')) && fs.existsSync(built)) {
        assert.deepStrictEqual(JSON.parse(fs.readFileSync(built, 'utf-8')), ALERT);
      }
    });
  });

  describe('[CNV-DOC] documented examples and the writer MUSTs', () => {
    const schema = eventTypesById(TYPE);
    const docs = jsonBlocks('CONVERSATION.md').filter((e) => e.type === TYPE);

    it('[CNV-DOC-1] the CONVERSATION.md examples are valid events, related-mirrored, and the proposal is valid against its type and item', () => {
      const validate = new AjvDraft04({ strict: false, logger: false }).compile(schema);
      assert.deepStrictEqual(docs.map((e) => e.content.kind), ['question', 'proposed-value', 'answer', 'answer', 'proposed-document', 'answer', 'question', 'proposed-value', 'proposed-value']);
      assert.strictEqual(docs[3].content.basis, 'existing-value', 'the automatic duplicate is documented');
      assert.strictEqual(docs[1].content.anchor.eventId, docs[1].content.about, 'a self-contained anchor names its document');
      for (const e of docs) {
        assert.ok(validate(e.content), JSON.stringify(validate.errors));
        assert.strictEqual(e.streamIds.length, 1);
        assert.match(e.streamIds[0], /^conv-[a-z0-9]{12}$/);
        const ids = [...new Set([e.content.about, e.content.inReplyTo, ...(e.content.written || []).map((w) => w.eventId)].filter(Boolean))];
        assert.deepStrictEqual(Object.keys(e.clientData.related).sort(), ids.sort(), 'every id in content is mirrored in related');
      }
      // the proposed document: a pack kind, on received; her confirmation lists the document itself, with her note
      const [pd, pdAnswer] = [docs[4].content, docs[5].content];
      assert.ok(KIND[pd.proposal.documentKind], 'a documentKinds key');
      assert.strictEqual(docs[4].streamIds[0], docs[0].streamIds[0], 'on the received child');
      assert.strictEqual(pdAnswer.written, undefined, 'never the document in written');
      assert.deepStrictEqual(pdAnswer.applied, ['time', 'kind']);
      assert.deepStrictEqual(pdAnswer.candidateIds, [pd.candidateId]);
      assert.ok(pdAnswer.note);
      // the proposals of a grid, null content included, are what her app would store
      for (const m of [...docs.map((e) => e.content), ...VALID['proposed-value']].filter((x) => x.grid && x.proposal)) {
        const v = new Ajv({ strict: false }).compile(eventTypesById(m.proposal.type));
        assert.ok(v(m.proposal.content), m.candidateId + ' ' + JSON.stringify(v.errors));
        const gridItem = itemsById[m.proposal.itemKey];
        assert.ok((gridItem.eventType ? [gridItem.eventType] : gridItem.variations.eventType.options.map((o) => o.value)).includes(m.proposal.type), m.proposal.itemKey);
        assert.deepStrictEqual([m.proposal.time % 86400, m.proposal.clientData.hdsTimePrecision], [43200, 'day'], m.candidateId);
      }
      const { proposal } = docs[1].content;
      const validateProposal = new Ajv({ strict: false }).compile(eventTypesById(proposal.type));
      assert.ok(validateProposal(proposal.content), JSON.stringify(validateProposal.errors));
      const item = itemsById[proposal.itemKey];
      const itemTypes = item.eventType ? [item.eventType] : item.variations.eventType.options.map((o) => o.value);
      assert.ok(itemTypes.includes(proposal.type), 'the item stores that type');
      assert.strictEqual(docs[0].streamIds[0], docs[1].streamIds[0], 'question and proposed value on the same received child');
      assert.notStrictEqual(docs[2].streamIds[0], docs[0].streamIds[0], 'the answer on the sent child');
    });

    it('[CNV-DOC-2] the writer MUSTs the schema cannot express hold on every documented and test example', () => {
      const ALLOWED = {
        'which-specimen': ['choose', 'skip'],
        'which-unit': ['choose', 'skip'],
        'which-analyte': ['choose', 'skip'],
        'is-fasting': ['choose', 'skip'],
        'which-date': ['confirm', 'skip'],
        'is-this-yours': ['confirm', 'not-mine', 'skip'],
        'which-document-kind': ['choose', 'skip'],
        'which-document-date': ['confirm', 'skip'],
        'which-row-date': ['confirm', 'skip'],
        'which-column-date': ['confirm', 'skip']
      };
      assert.deepStrictEqual(Object.keys(ALLOWED).sort(), [...HDS_CODES].sort());
      const messages = [...docs.map((e) => e.content), ...Object.values(VALID).flat()];
      const documentProposals = new Set(messages.filter((x) => x.kind === 'proposed-document').map((x) => x.candidateId));
      for (const m of messages.filter((x) => x.kind === 'question')) {
        if (m.code.startsWith('x-')) continue;
        assert.ok(ALLOWED[m.code], m.code);
        if (['which-specimen', 'which-unit', 'which-analyte', 'is-fasting', 'which-document-kind'].includes(m.code)) {
          assert.ok(m.candidateId && m.options?.length, m.code + ' carries candidateId and options');
          assert.strictEqual(m.context, undefined, m.code + ' carries no context');
        }
        if (m.code === 'is-fasting') assert.deepStrictEqual(m.options, ['yes', 'no']);
        if (m.code === 'which-specimen') for (const o of m.options) assert.ok(SPECIMENS.includes(o), 'a registered specimen code: ' + o);
        if (m.code === 'which-document-kind') {
          assert.ok(m.options.length >= 2 && m.options.length <= 8, '2 to 8 kinds');
          for (const o of m.options) assert.ok(KIND[o] && !KIND[o].deprecated, 'a kind key: ' + o);
        }
        if (m.code.startsWith('which-document-')) assert.ok(documentProposals.has(m.candidateId), m.code + ' names a proposed-document');
        if (['which-date', 'is-this-yours', 'which-document-date'].includes(m.code)) assert.strictEqual(m.options, undefined, m.code + ' has no options');
        if (m.code === 'is-this-yours') assert.strictEqual(m.candidateId, undefined);
        if (m.context?.identity) assert.strictEqual(m.code, 'is-this-yours', 'identity on is-this-yours only');
        if (m.context?.dates) assert.ok(['which-date', 'which-document-date'].includes(m.code), 'dates on the two date codes only');
        if (m.context?.anchor) assert.ok(['is-this-yours', 'which-row-date', 'which-column-date'].includes(m.code), 'a context anchor on these three only');
        if (m.context?.grid) assert.strictEqual(m.code, 'which-row-date', 'grid on which-row-date only');
        if (m.context?.column) assert.strictEqual(m.code, 'which-column-date', 'column on which-column-date only');
        if (m.code === 'which-column-date') {
          assert.deepStrictEqual(Object.keys(m.context).sort(), ['anchor', 'column'], 'its context is the column and its heading, only: no date a model read');
          assert.ok(m.context.anchor.bbox, 'with the heading\'s box');
          assert.strictEqual(m.candidateId ?? m.options, undefined, 'no candidate, no options');
          const about = messages.filter((x) => x.about === m.about);
          assert.ok(!about.some((x) => x.kind === 'question' && x.code === 'which-date'), 'no which-date on a table read per column');
          const values = about.filter((x) => x.kind === 'proposed-value');
          const answers = messages.filter((x) => x.kind === 'answer' && x.about === m.about && x.action === 'confirm' && !x.candidateIds);
          assert.ok(values.length > 0 && answers.length > 0, 'the fixtures hold a value and an answer of the table');
          for (const p of values) assert.ok(p.column && p.proposal?.time !== undefined, 'every value names its column and has its day');
          for (const a of answers) assert.deepStrictEqual([a.time % 86400, a.timePrecision], [43200, 'day'], 'a day at 12:00 UTC');
        }
        if (m.code === 'which-row-date') {
          assert.deepStrictEqual(Object.keys(m.context).sort(), ['anchor', 'grid'], 'its context is the box and its anchor, only');
          assert.ok(m.context.anchor.bbox, 'with its box');
          assert.strictEqual(m.candidateId ?? m.options, undefined, 'no candidate, no options');
          const about = messages.filter((x) => x.about === m.about);
          assert.ok(!about.some((x) => x.kind === 'question' && x.code === 'which-date'), 'no which-date on a dated grid');
          assert.ok(!about.some((x) => x.kind === 'proposed-value' && x.reason !== 'not-read' && x.proposal?.time === undefined), 'no value without its day');
          for (const p of about.filter((x) => x.kind === 'proposed-value')) assert.ok(p.grid, 'every box says where it is');
          for (const a of messages.filter((x) => x.kind === 'answer' && x.about === m.about && x.action === 'confirm' && !x.candidateIds)) {
            assert.deepStrictEqual([a.time % 86400, a.timePrecision], [43200, 'day'], 'a day at 12:00 UTC');
          }
        }
      }
      for (const m of messages.filter((x) => x.kind === 'proposed-document')) {
        assert.ok(KIND[m.proposal.documentKind ?? 'other'], 'a pack kind');
        if (m.proposal.time !== undefined) assert.strictEqual(m.proposal.time % 86400, 43200, 'at 12:00 UTC');
        if (m.replaces) assert.ok(documentProposals.has(m.replaces) && m.replaces !== m.candidateId, 'replaces a proposed-document');
      }
      for (const m of messages.filter((x) => x.kind === 'answer' && x.candidateIds?.some((c) => documentProposals.has(c)))) {
        assert.strictEqual(m.candidateIds.length, 1, 'one proposed document per answer');
        assert.strictEqual(m.written, undefined, 'a proposed document is never in written');
        if (m.applied) assert.ok(['confirm', 'correct'].includes(m.action), 'applied only on a confirm or correct of the proposed document');
        if (m.basis === 'not-pending') assert.strictEqual(m.action, 'skip');
        assert.ok(['confirm', 'correct', 'skip', 'choose'].includes(m.action), m.action);
      }
      const proposals = messages.filter((x) => x.kind === 'proposed-value');
      for (const m of proposals.filter((x) => x.replaces)) {
        assert.notStrictEqual(m.replaces, m.candidateId);
        assert.ok(proposals.some((p) => p.candidateId === m.replaces && p.about === m.about), 'replaces names a proposed value of the same document');
      }
      for (const m of messages.filter((x) => x.kind === 'answer')) {
        if (m.action === 'choose') assert.ok(m.option && m.candidateIds?.length === 1, 'choose carries option and the candidate');
        if (m.action === 'not-mine') assert.strictEqual(m.candidateIds, undefined, 'not-mine is document-level');
        if (m.action === 'correct') assert.ok(m.candidateIds?.length === 1 && m.written?.length === 1, 'correct covers one candidate, written');
        if (['correct', 'duplicate', 'request-item'].includes(m.action)) assert.ok(m.candidateIds, m.action + ' answers a proposed value');
        if (m.written) {
          assert.ok(['confirm', 'correct'].includes(m.action), 'written only with confirm or correct');
          for (const w of m.written) assert.ok(m.candidateIds.includes(w.candidateId), 'a written candidate is covered');
        }
        if (m.basis === 'profile-match') assert.ok(m.action === 'confirm' && !m.candidateIds && !m.written, 'profile-match only on an is-this-yours confirm');
        if (m.basis === 'existing-value') assert.ok(m.action === 'duplicate' && m.candidateIds?.length && !m.written, 'existing-value only on a duplicate of proposed values, writing nothing');
        if (m.applied) assert.ok(!m.written && m.candidateIds?.length === 1, 'applied: one proposed document, no written');
        if (m.timePrecision === 'unknown') assert.strictEqual(m.time, undefined, 'no time with unknown');
        else if (m.timePrecision) assert.strictEqual(typeof m.time, 'number');
      }
      // a self-contained anchor (4.25.0) names the item's own document; a legacy one (c-78) has none
      for (const m of messages) {
        const anchor = m.anchor ?? m.context?.anchor;
        if (anchor?.eventId !== undefined) assert.strictEqual(anchor.eventId, m.about, 'anchor.eventId = about');
      }
      assert.ok(messages.some((m) => (m.anchor ?? m.context?.anchor) !== undefined && (m.anchor ?? m.context?.anchor).eventId === undefined), 'a legacy anchor stays valid');
      for (const m of messages.filter((x) => x.kind === 'proposed-value')) {
        if (['kept-aside', 'unmapped'].includes(m.status)) assert.ok(m.reason, 'kept-aside / unmapped carries reason');
        if (m.reason === 'not-read') {
          assert.ok(m.status === 'unmapped' && m.anchor?.bbox && m.grid, 'not-read: unmapped, with its box');
          assert.deepStrictEqual([m.printed.value, m.proposal, m.requestKey], [undefined, undefined, undefined], 'not-read: nothing read');
        } else assert.ok(m.printed.value, 'a value read carries what is written');
        if (m.proposal?.time !== undefined) assert.ok(m.proposal.clientData?.hdsTimePrecision, 'a proposal with time carries hdsTimePrecision');
      }
      for (const a of VALID_ALERTS.filter((x) => x.kind === 'task-status' && x.status === 'error')) assert.ok(a.errorCode);
    });

    it('[CNV-DOC-3] the documented alerts are valid, upstream and here, and carry the fixed words of their kind', () => {
      const text = fs.readFileSync(path.join(__dirname, '../documentation/CUSTOM-FIELDS-AND-SYSTEM.md'), 'utf-8');
      const section = text.slice(text.indexOf('### A conversation: `notification/alert-cmc` kinds'));
      const words = {};
      for (const m of section.matchAll(/^\| `([a-z-]+)` \| ([^|]+) \/ ([^|]+) \| ([^|]+?) \/ ([^|]+?) \|$/gm)) {
        words[m[1]] = { title: { en: m[2].trim(), fr: m[3].trim() }, body: { en: m[4].trim(), fr: m[5].trim() } };
      }
      assert.deepStrictEqual(Object.keys(words), ALERT_KINDS, 'one row of fixed words per kind');
      const alerts = [...jsonBlocks('CUSTOM-FIELDS-AND-SYSTEM.md'), ...jsonBlocks('CONVERSATION.md')].filter((a) => ALERT_KINDS.includes(a.hds?.kind));
      assert.deepStrictEqual([...new Set(alerts.map((a) => a.hds.kind))].sort(), [...ALERT_KINDS].sort(), 'one documented alert per kind at least');
      const ajv = new AjvDraft04({ strict: false, logger: false });
      const validate = ajv.compile(ALERT);
      const upstream = new AjvDraft04({ strict: false, logger: false }).compile(legacy.types['notification/alert-cmc']);
      for (const a of alerts) {
        assert.ok(validate(a.hds), JSON.stringify(validate.errors));
        assert.ok(upstream(a), JSON.stringify(upstream.errors));
        assert.strictEqual(a.level, 'info');
        assert.strictEqual(a.code, 'hds-' + a.hds.kind);
        assert.strictEqual(a.ackRequired, undefined);
        assert.deepStrictEqual({ title: a.title, body: a.body }, words[a.hds.kind]);
      }
    });

    it('[CNV-DOC-9] the registered notice and error codes are exactly these, bare, and valid in their alert', () => {
      const text = fs.readFileSync(path.join(__dirname, '../documentation/CONVERSATION.md'), 'utf-8');
      const section = text.slice(text.indexOf('### Notice and error codes'), text.indexOf('## Rules'));
      const notices = [...section.matchAll(/^\| `([a-z0-9-]+)` \| (the document|none) \|/gm)].map((m) => [m[1], m[2]]);
      const errors = [...section.matchAll(/^\| `([a-z0-9-]+)` \| (?!the document \||none \|)[^|]+\|\s*$/gm)].map((m) => m[1]);
      // every code row is parsed: the rows starting with a code, less the two header rows
      const rows = section.split('\n').filter((l) => l.startsWith('| `')).length - 2;
      assert.strictEqual(notices.length + errors.length, rows, 'a table row matched neither pattern');
      assert.deepStrictEqual(notices, [['no-result-found', 'the document'], ['several-sampling-dates', 'the document'], ['several-result-columns', 'the document'], ['columns-not-read', 'the document'], ['lines-may-be-missing', 'the document'], ['grid-not-located', 'the document'], ['kind-not-read', 'the document'], ['typed-text-not-read', 'none'], ['note-not-read', 'the document'], ['ready', 'none']]);
      // the notices that end the work are the ones § The flow names, and each says so in its row (4.45.0). An ending
      // notice row MUST say "the work ends `done` with zero counts": a row that proposes and asks nothing and omits it fails here.
      const codeRows = section.split('\n').filter((l) => /^\| `[a-z0-9-]+` \| (the document|none) \|/.test(l));
      const ending = codeRows.filter((l) => l.includes('the work ends `done` with zero counts')).map((l) => l.match(/^\| `([a-z0-9-]+)`/)[1]);
      for (const l of codeRows) {
        if (/nothing is proposed, no question is asked/i.test(l)) assert.ok(l.includes('the work ends `done` with zero counts'), 'an ending row says so: ' + l.slice(0, 40));
      }
      const flowAt = text.indexOf('A notice may come at any step;');
      const flow = text.slice(flowAt, text.indexOf('(§ Notice and error codes)', flowAt));
      assert.deepStrictEqual(ending, ['no-result-found', 'several-sampling-dates', 'several-result-columns', 'grid-not-located', 'kind-not-read']);
      assert.deepStrictEqual([...flow.matchAll(/`([a-z0-9-]+)`/g)].map((m) => m[1]), ending, '§ The flow lists every ending notice');
      assert.deepStrictEqual(errors, ['no-attachment', 'write-failed', 'reading-failed']);
      const validate = new AjvDraft04({ strict: false, logger: false }).compile(ALERT);
      for (const [code, about] of notices) {
        assert.ok(!code.startsWith('x-'), code + ' is a bare HDS code');
        assert.ok(validate(about === 'none' ? { kind: 'notice', code } : { kind: 'notice', code, about: DOC }), JSON.stringify(validate.errors));
      }
      for (const errorCode of errors) assert.ok(validate({ kind: 'task-status', about: DOC, status: 'error', attempt: 1, errorCode }), JSON.stringify(validate.errors));
    });

    it('[CNV-DOC-5] no description says an answer to a question writes a value', () => {
      const answer = schema.oneOf.find((b) => b.properties.kind.enum[0] === 'answer');
      assert.match(answer.description, /An answer to a question \(choose included\) writes nothing/);
      assert.doesNotMatch(JSON.stringify(schema), /confirm, correct or choose/);
      assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../documentation/CONVERSATION.md'), 'utf-8'), /`choose`[^.]*\bwrites (?!no)/);
    });

    it('[CNV-DOC-6] the R9 allowlist is computable from the pack: the documented items in, system, attachments and marked roots out', () => {
      const rootOf = (id) => { let s = streams.streamsById[id]; while (s && s.parentId) s = streams.streamsById[s.parentId]; return s; };
      const allowed = new Set(Object.entries(itemsById)
        .filter(([, i]) => !['system', 'attachments'].includes(i.type) && !rootOf(i.streamId)?.explicitGrantOnly)
        .map(([k]) => k));
      assert.ok(allowed.size > 100);
      for (const k of ['body-blood-serum-ferritin', 'body-blood-coded', docs[1].content.proposal.itemKey]) assert.ok(allowed.has(k), k);
      for (const [k, i] of Object.entries(itemsById)) {
        if (['system', 'attachments'].includes(i.type) || rootOf(i.streamId)?.explicitGrantOnly) assert.ok(!allowed.has(k), k);
      }
      assert.ok(!allowed.has('genetics-variant') && !allowed.has('document'));
    });

    it('[CNV-DOC-7] the sourceKey her app builds is <engine>:document:<document event id>:<candidateId>, a PROVENANCE.md key', () => {
      const text = fs.readFileSync(path.join(__dirname, '../documentation/CONVERSATION.md'), 'utf-8');
      assert.ok(text.replace(/\s+/g, ' ').includes('`<engine>:document:<document event id>:<candidateId>`'));
      const { about, candidateId, extraction } = docs[1].content;
      const key = `${extraction.engine}:document:${about}:${candidateId}`;
      const [tool, kind, ...id] = key.split(':');
      assert.match(tool, new RegExp(keys.hdsExtraction.properties.engine.pattern));
      assert.strictEqual(kind, 'document');
      assert.strictEqual(id.join(':'), `${about}:${candidateId}`);
      assert.doesNotMatch(key, /\s/);
    });

    it('[CNV-DOC-8] the alert reading keys name only fields each kind has', () => {
      const text = fs.readFileSync(path.join(__dirname, '../documentation/CUSTOM-FIELDS-AND-SYSTEM.md'), 'utf-8');
      const section = text.slice(text.indexOf('### A conversation: `notification/alert-cmc` kinds'));
      const rows = [...section.matchAll(/^\| (`[a-z-]+`(?:, `[a-z-]+`)*) \| `\(([^)]+)\)`/gm)];
      const seen = [];
      for (const [, kindsCell, tuple] of rows) {
        for (const kind of kindsCell.match(/[a-z-]+/g)) {
          seen.push(kind);
          const props = ALERT.oneOf.find((b) => b.properties.kind.enum[0] === kind).properties;
          for (const f of tuple.split(',').map((s) => s.trim())) assert.ok(props[f], `${kind} has ${f}`);
        }
      }
      assert.deepStrictEqual(seen.sort(), [...ALERT_KINDS].sort());
    });

    it('[CNV-DOC-10] the specimen codes are registered, each with an en, fr and es label, and are valid options', () => {
      const text = fs.readFileSync(path.join(__dirname, '../documentation/CONVERSATION.md'), 'utf-8');
      const section = text.slice(text.indexOf('### Specimen codes'), text.indexOf('### Answers, by what they answer'));
      const rows = [...section.matchAll(/^\| `([a-z0-9-]+)` \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)];
      assert.deepStrictEqual(rows.map((r) => r[1]), SPECIMENS);
      for (const [, , en, fr, es] of rows) for (const l of [en, fr, es]) assert.ok(l.trim().length > 0);
      const optionRe = new RegExp(branch(schema, 'question').properties.options.items.pattern);
      for (const c of SPECIMENS) assert.ok(optionRe.test(c), c);
    });

    it('[CNV-DOC-11] the two document keys: schemas, and the DOCUMENTS.md and PROVENANCE.md examples', () => {
      for (const [, make] of FLAVOURS) {
        const ajv = make();
        const pending = ajv.compile(keys.hdsDocumentPending);
        for (const ok of [['time', 'kind'], ['kind'], ['time']]) assert.ok(pending(ok), JSON.stringify(ok));
        for (const bad of [[], ['time', 'time'], ['date'], ['time', 'kind', 'title'], 'time', { time: true }]) assert.ok(!pending(bad), JSON.stringify(bad));
        const values = ajv.compile(keys.hdsDocumentValues);
        for (const ok of [{}, { ckq3w8n1x0020: 'source', 'ckpz7r2m4-0_9': 'source' }]) assert.ok(values(ok), JSON.stringify(ok));
        for (const bad of [{ ckq3w8n1x0020: 'matched' }, { ckq3w8n1x0020: 'read' }, { ckq3w8n1x0020: true }, { 'ck.x': 'source' }, { ['x'.repeat(65)]: 'source' }, ['ckq3w8n1x0020'], { ckq3w8n1x0020: { role: 'source', value: 48 } }]) {
          assert.ok(!values(bad), JSON.stringify(bad));
        }
        assert.ok(!values(Object.fromEntries(Array.from({ length: 1001 }, (_, i) => ['e' + i, 'source']))), 'at most 1000 entries');
        const printedIn = ajv.compile(keys.hdsPrintedIn);
        for (const ok of [{}, { ckq3w8n1x0001: true }]) assert.ok(printedIn(ok), JSON.stringify(ok));
        for (const bad of [{ ckq3w8n1x0001: false }, { ckq3w8n1x0001: 'source' }, { 'ck.x': true }, ['ckq3w8n1x0001'], Object.fromEntries(Array.from({ length: 101 }, (_, i) => ['d' + i, true]))]) {
          assert.ok(!printedIn(bad), JSON.stringify(bad).slice(0, 80));
        }
      }
      assert.ok(!PORTABLE.test(JSON.stringify([keys.hdsDocumentPending, keys.hdsDocumentValues, keys.hdsPrintedIn])));
      const placeholder = jsonBlocksLoose('DOCUMENTS.md').find((e) => e.clientData?.hdsDocumentPending);
      assert.ok(placeholder, 'DOCUMENTS.md shows the placeholder');
      const other = KIND.other;
      assert.deepStrictEqual(placeholder.content.class, other.class, 'class of the kind other');
      assert.deepStrictEqual(placeholder.content.type[0], other.type, 'type of the kind other');
      assert.strictEqual(placeholder.clientData.hdsTimePrecision, undefined, 'no precision on a pending time');
      const validateDoc = new Ajv({ strict: false }).compile(eventTypesById('file/xds-v1'));
      assert.ok(validateDoc(placeholder.content), JSON.stringify(validateDoc.errors));
      const indexed = jsonBlocks('PROVENANCE.md').find((e) => e.clientData?.hdsDocumentValues);
      assert.ok(indexed, 'PROVENANCE.md shows the index');
      assert.ok(new Ajv({ strict: false }).validate(keys.hdsDocumentValues, indexed.clientData.hdsDocumentValues));
      assert.deepStrictEqual([...new Set(Object.values(indexed.clientData.hdsDocumentValues))], ['source'], 'source entries only');
      const printed = jsonBlocks('PROVENANCE.md').find((e) => e.clientData?.hdsPrintedIn);
      assert.ok(printed && new Ajv({ strict: false }).validate(keys.hdsPrintedIn, printed.clientData.hdsPrintedIn), 'PROVENANCE.md shows hdsPrintedIn');
      assert.strictEqual(printed.clientData.related, undefined, 'a matched value is not related to the document');
      const conv = fs.readFileSync(path.join(__dirname, '../documentation/CONVERSATION.md'), 'utf-8');
      assert.ok(conv.includes('never which event\n    or its value'), 'R3 keeps never which event');
    });

    it('[CNV-DOC-12] a document\'s date and kind: the document codes take no specimen, value or item key', () => {
      const text = fs.readFileSync(path.join(__dirname, '../documentation/CONVERSATION.md'), 'utf-8');
      for (const s of ['### A document\'s date and kind: `proposed-document` (4.26.0)', '## Writing a document\'s date and kind (4.26.0)', '### Her note (4.26.0)']) assert.ok(text.includes(s), s);
      const pd = branch(schema, 'proposed-document');
      assert.strictEqual(pd.properties.printed, undefined, 'nothing printed');
      assert.strictEqual(pd.properties.proposal.properties.content, undefined, 'no content: a key and a date');
    });

    it('[CNV-DOC-4] reader-v1 is marked superseded, and its schema is unchanged in shape', () => {
      const reader = eventTypesById('message/hds-reader-v1');
      assert.match(reader.description, /^SUPERSEDED by message\/hds-conversation-v1/);
      assert.deepStrictEqual(reader.oneOf.map((b) => b.properties.kind.enum[0]), ['job', 'notice', 'reading', 'question', 'answer', 'access-request', 'access-result', 'written', 'summary']);
      const doc = fs.readFileSync(path.join(__dirname, '../documentation/HDS-READER.md'), 'utf-8');
      assert.match(doc, /\*\*Superseded \(4\.22\.0\)\.\*\*/);
    });
  });

  describe('[CNV-PACK] built pack.json', () => {
    let pack;

    before(() => {
      const packPath = path.join(__dirname, '../dist/pack.json');
      if (!fs.existsSync(packPath)) return;
      pack = JSON.parse(fs.readFileSync(packPath, 'utf-8'));
    });

    it('[CNV-PACK-1] the pack carries the eventType and the marked root', function () {
      if (!pack || !pack.eventTypes.types[TYPE]) return this.skip(); // npm run build has not run since the change
      assert.ok(pack.eventTypes.types[TYPE]);
      const root = pack.streams.find((s) => s.id === 'conversation-items');
      assert.strictEqual(root.explicitGrantOnly, true);
    });
  });
});
