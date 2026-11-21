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
const ANCHOR = { attachmentId: 'ckq3w8n1x0001a', page: 1, bbox: [8.5, 41.2, 83, 2.1] };
const EXTRACTION = { engine: 'hds-reader', engineVersion: '0.3.0', kbVersion: '0.4.0', backend: 'text-layer' };
const HDS_CODES = ['which-specimen', 'which-unit', 'which-analyte', 'which-date', 'is-fasting', 'is-this-yours'];

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
    { kind: 'question', about: DOC, code: 'x-acme-which-lab', candidateId: 'c-1' }
  ],
  'proposed-value': [
    proposed,
    { kind: 'proposed-value', about: DOC, candidateId: 'c-77', printed: { label: 'Cholestérol HDL', value: '1,2', unit: 'mmol/l' }, status: 'kept-aside', reason: 'no-item', requestKey: 'serum-plasma|loinc:2085-9', extraction: EXTRACTION },
    { kind: 'proposed-value', about: DOC, candidateId: 'c-78', printed: { label: 'Hémoglobine', value: '13.5' }, anchor: { attachmentId: 'f2', page: 2 }, status: 'unit-missing', specimenImplied: true, extraction: { ...EXTRACTION, backend: 'ollama:qwen2.5vl:7b' } },
    { ...proposed, proposal: { itemKey: 'body-blood-coded', type: 'lab-result/coded-v1', content: { analyte: { label: { en: 'X' }, codes: [{ system: 'http://loinc.org', code: '2947-0' }] }, value: 140, unit: 'mmol/L' } } },
    { ...proposed, candidateId: 'c-78b', replaces: 'c-78', printed: { label: 'Hémoglobine', value: '13.5' }, proposal: { itemKey: 'body-blood-serum-ferritin', type: 'concentration/ug-l', content: 13.5 }, status: 'check' }
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
    { kind: 'answer', inReplyTo: 'ckq3w8n1x0018', about: DOC, action: 'skip', candidateIds: ['c-77'] }
  ]
};
const KINDS = Object.keys(VALID);

const VALID_ALERTS = [
  { kind: 'task-status', about: DOC, status: 'received', attempt: 1 },
  { kind: 'task-status', about: DOC, status: 'awaiting-answers', attempt: 1, counts: { proposed: 12, questions: 1, keptAside: 2, dropped: 3 } },
  { kind: 'task-status', about: DOC, status: 'error', attempt: 2, errorCode: 'x-acme-scanner-offline' },
  { kind: 'notice', code: 'no-result-found', about: DOC },
  { kind: 'notice', code: 'typed-text-not-read' },
  { kind: 'notice', code: 'several-sampling-dates', about: DOC },
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
          assert.ok(!validate({ ...list[0], note: 'free text' }), k);
          assert.ok(!validate({ ...list[0], text: { en: 'Is this right?' } }), k + ': no text in this version');
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
        assert.ok(!validate({ ...proposed, printed: { label: 'X' } }), 'printed without value');
        assert.ok(!validate({ ...VALID.question[4], context: {} }), 'an empty context');
        assert.ok(!validate({ ...VALID.question[4], context: { identity: {} } }), 'an empty identity');
        assert.ok(!validate({ ...VALID.question[2], context: { dates: [] } }), 'no dates');
        assert.ok(!validate({ ...VALID.question[2], context: { dates: [{ day: '2026-03-12' }] } }), 'a date without its text');
        assert.ok(!validate({ ...VALID.answer[0], written: [] }), 'an empty written');
        assert.ok(!validate({ ...VALID.answer[0], written: [{ candidateId: 'c-1' }] }), 'written without eventId');
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
          { ...proposed, extraction: { ...EXTRACTION, backend: 'read by Dr Martin' } }
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
    const branch = (s, k) => s.oneOf.find((b) => b.properties.kind.enum[0] === k);

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
        'proposed-value': [['kind', 'about', 'candidateId', 'printed', 'status', 'extraction'], ['kind', 'about', 'candidateId', 'replaces', 'printed', 'anchor', 'proposal', 'status', 'reason', 'requestKey', 'askOneByOne', 'specimenImplied', 'extraction']],
        answer: [['kind', 'inReplyTo', 'about', 'action'], ['kind', 'inReplyTo', 'about', 'action', 'candidateIds', 'option', 'time', 'timePrecision', 'basis', 'written']]
      };
      for (const [k, [required, props]] of Object.entries(SHAPES)) {
        assert.deepStrictEqual(branch(schema, k).required, required, k + ' required');
        assert.deepStrictEqual(Object.keys(branch(schema, k).properties), props, k + ' properties');
      }
      const ctx = branch(schema, 'question').properties.context;
      assert.deepStrictEqual(Object.keys(ctx.properties), ['identity', 'dates', 'anchor']);
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
      assert.deepStrictEqual(Object.keys(branch(ALERT, 'task-status').properties.counts.properties), ['proposed', 'questions', 'keptAside', 'dropped']);
    });

    it('[CNV-SHAPE-3] every enum is exactly this list', () => {
      assert.deepStrictEqual(branch(schema, 'answer').properties.action.enum, ['confirm', 'correct', 'not-mine', 'skip', 'choose', 'request-item', 'duplicate']);
      assert.deepStrictEqual(branch(schema, 'answer').properties.timePrecision.enum, ['day', 'month', 'year', 'unknown']);
      assert.deepStrictEqual(branch(schema, 'answer').properties.basis.enum, ['profile-match']);
      assert.deepStrictEqual(branch(ALERT, 'task-status').properties.status.enum, ['received', 'reading', 'awaiting-answers', 'done', 'error']);
      assert.strictEqual(branch(schema, 'question').properties.code.enum, undefined, 'an open code');
      const codeRe = new RegExp(branch(schema, 'question').properties.code.pattern);
      for (const c of [...HDS_CODES, 'x-acme-which-lab']) assert.ok(codeRe.test(c), c);
    });

    it('[CNV-SHAPE-4] the copies are the same definitions as their sources', () => {
      const pv = branch(schema, 'proposed-value').properties;
      const rd = branch(reader, 'reading').properties;
      for (const f of ['candidateId', 'printed', 'proposal', 'status', 'reason', 'requestKey', 'askOneByOne', 'specimenImplied']) {
        assert.deepStrictEqual(strip(pv[f]), strip(rd[f]), 'proposed-value.' + f + ' = reader-v1 reading.' + f);
      }
      assert.deepStrictEqual(strip(pv.anchor), strip(keys.hdsSourceAnchor));
      assert.deepStrictEqual(strip(branch(schema, 'question').properties.context.properties.anchor), strip(keys.hdsSourceAnchor));
      assert.deepStrictEqual(Object.keys(pv.extraction.properties), ['engine', 'engineVersion', 'kbVersion', 'backend']);
      for (const f of Object.keys(pv.extraction.properties)) {
        assert.deepStrictEqual(strip(pv.extraction.properties[f]), strip(keys.hdsExtraction.properties[f]), 'extraction.' + f);
      }
      assert.deepStrictEqual(strip(pv.replaces), strip(pv.candidateId));
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
        branch(schema, 'answer').properties.inReplyTo, branch(schema, 'answer').properties.about,
        branch(schema, 'answer').properties.written.items.properties.eventId,
        ...ALERT.oneOf.flatMap((b) => ['about', 'eventId', 'inReplyTo'].filter((f) => b.properties[f]).map((f) => b.properties[f]))
      ];
      assert.strictEqual(ids.length, 15);
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
      assert.deepStrictEqual(docs.map((e) => e.content.kind), ['question', 'proposed-value', 'answer']);
      for (const e of docs) {
        assert.ok(validate(e.content), JSON.stringify(validate.errors));
        assert.strictEqual(e.streamIds.length, 1);
        assert.match(e.streamIds[0], /^conv-[a-z0-9]{12}$/);
        const ids = [e.content.about, e.content.inReplyTo, ...(e.content.written || []).map((w) => w.eventId)].filter(Boolean);
        assert.deepStrictEqual(Object.keys(e.clientData.related).sort(), ids.sort(), 'every id in content is mirrored in related');
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
        'is-this-yours': ['confirm', 'not-mine', 'skip']
      };
      const messages = [...docs.map((e) => e.content), ...Object.values(VALID).flat()];
      for (const m of messages.filter((x) => x.kind === 'question')) {
        if (m.code.startsWith('x-')) continue;
        assert.ok(ALLOWED[m.code], m.code);
        if (['which-specimen', 'which-unit', 'which-analyte', 'is-fasting'].includes(m.code)) {
          assert.ok(m.candidateId && m.options?.length, m.code + ' carries candidateId and options');
          assert.strictEqual(m.context, undefined, m.code + ' carries no context');
        }
        if (m.code === 'is-fasting') assert.deepStrictEqual(m.options, ['yes', 'no']);
        if (m.code === 'which-date' || m.code === 'is-this-yours') assert.strictEqual(m.options, undefined, m.code + ' has no options');
        if (m.code === 'is-this-yours') assert.strictEqual(m.candidateId, undefined);
        if (m.context?.identity) assert.strictEqual(m.code, 'is-this-yours', 'identity on is-this-yours only');
        if (m.context?.dates) assert.strictEqual(m.code, 'which-date', 'dates on which-date only');
        if (m.context?.anchor) assert.strictEqual(m.code, 'is-this-yours', 'a context anchor on is-this-yours only');
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
        if (m.basis) assert.ok(m.action === 'confirm' && !m.candidateIds && !m.written, 'basis only on an is-this-yours confirm');
        if (m.timePrecision === 'unknown') assert.strictEqual(m.time, undefined, 'no time with unknown');
        else if (m.timePrecision) assert.strictEqual(typeof m.time, 'number');
      }
      for (const m of messages.filter((x) => x.kind === 'proposed-value')) {
        if (['kept-aside', 'unmapped'].includes(m.status)) assert.ok(m.reason, 'kept-aside / unmapped carries reason');
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
      assert.deepStrictEqual(notices, [['no-result-found', 'the document'], ['several-sampling-dates', 'the document'], ['typed-text-not-read', 'none']]);
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
