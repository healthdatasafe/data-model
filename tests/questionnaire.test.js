const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const hdsTypes = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../definitions/eventTypes/eventTypes-hds.json'), 'utf-8')
);

const requestSchema = hdsTypes.types['questionnaire/request-v1'];
const answerSchema = hdsTypes.types['questionnaire/answer-v1'];

const ajv = new Ajv({ strict: false, allowUnionTypes: true });
const validateRequest = ajv.compile(requestSchema);
const validateAnswer = ajv.compile(answerSchema);

function validRequest () {
  return {
    title: { en: 'Pregnancy intake' },
    questions: {
      'progesterone-life': {
        label: { en: 'Did you take Progesterone in your life?' },
        itemRef: 'medication-intake-coded',
        params: { drug: { codes: [{ system: 'ATC', code: 'G03DA04' }] } },
        scope: { type: 'ever' },
        subField: {
          type: 'select-segmented',
          label: { en: 'Trimester' },
          options: [
            { value: 'T1', label: { en: 'T1' } },
            { value: 'T2', label: { en: 'T2' } },
            { value: 'T3', label: { en: 'T3' } },
            { value: 9, label: { en: 'Unknown' } }
          ]
        }
      },
      'weight-week': {
        label: { en: 'Body weight in past week' },
        itemRef: 'body-weight',
        scope: { type: 'latest', withinDays: 7 }
      },
      'cycle-recent': {
        label: { en: 'Your last cycle (≤60 days)' },
        itemRef: 'fertility-cycles-start',
        scope: { type: 'window', withinDays: 60 }
      }
    }
  };
}

function validAnswer () {
  return {
    requestEventId: 'evt-q-abc',
    answers: {
      'progesterone-life': {
        status: 'answered',
        references: ['evt-prog-intake-xyz'],
        qualifier: 'T2'
      },
      'weight-week': {
        status: 'answered',
        references: ['evt-bw-2026-06-14']
      },
      'cycle-recent': { status: 'no' },
      sensitive: { status: 'declined', reason: 'privacy' },
      forgotten: { status: 'unknown' }
    }
  };
}

describe('[QSTX] questionnaire request/answer event pair (Plan 71)', () => {
  describe('[QST-REG] eventTypes registry', () => {
    it('[QST-REG-1] questionnaire/request-v1 is registered as object requiring questions', () => {
      assert.ok(requestSchema, 'questionnaire/request-v1 must exist');
      assert.strictEqual(requestSchema.type, 'object');
      assert.deepStrictEqual(requestSchema.required, ['questions']);
    });

    it('[QST-REG-2] questionnaire/answer-v1 is registered as object requiring requestEventId + answers', () => {
      assert.ok(answerSchema, 'questionnaire/answer-v1 must exist');
      assert.strictEqual(answerSchema.type, 'object');
      assert.deepStrictEqual(answerSchema.required.sort(), ['answers', 'requestEventId']);
    });

    it('[QST-REG-3] request schema enforces Pryv path grammar on question keys', () => {
      const pattern = requestSchema.properties.questions.propertyNames.pattern;
      assert.strictEqual(pattern, '^[a-zA-Z0-9_-]+$');
    });

    it('[QST-REG-4] answer schema enforces the same path grammar on answer keys', () => {
      const pattern = answerSchema.properties.answers.propertyNames.pattern;
      assert.strictEqual(pattern, '^[a-zA-Z0-9_-]+$');
    });
  });

  describe('[QST-REQ] request schema validation', () => {
    it('[QST-REQ-1] a valid request passes', () => {
      assert.strictEqual(validateRequest(validRequest()), true, JSON.stringify(validateRequest.errors));
    });

    it('[QST-REQ-2] missing questions fails', () => {
      const r = validRequest();
      delete r.questions;
      assert.strictEqual(validateRequest(r), false);
    });

    it('[QST-REQ-3] empty questions map fails (minProperties 1)', () => {
      const r = validRequest();
      r.questions = {};
      assert.strictEqual(validateRequest(r), false);
    });

    it('[QST-REQ-4] question key with colon fails (Pryv path grammar)', () => {
      const r = validRequest();
      r.questions['has:colon'] = r.questions['weight-week'];
      delete r.questions['weight-week'];
      assert.strictEqual(validateRequest(r), false);
    });

    it('[QST-REQ-5] question key with dot fails', () => {
      const r = validRequest();
      r.questions['has.dot'] = r.questions['weight-week'];
      delete r.questions['weight-week'];
      assert.strictEqual(validateRequest(r), false);
    });

    it('[QST-REQ-6] question without itemRef fails', () => {
      const r = validRequest();
      delete r.questions['weight-week'].itemRef;
      assert.strictEqual(validateRequest(r), false);
    });

    it('[QST-REQ-7] question without scope fails', () => {
      const r = validRequest();
      delete r.questions['weight-week'].scope;
      assert.strictEqual(validateRequest(r), false);
    });

    it('[QST-REQ-8] scope.type ever forbids withinDays', () => {
      const r = validRequest();
      r.questions['progesterone-life'].scope = { type: 'ever', withinDays: 7 };
      assert.strictEqual(validateRequest(r), false);
    });

    it('[QST-REQ-9] scope.type window requires withinDays', () => {
      const r = validRequest();
      r.questions['cycle-recent'].scope = { type: 'window' };
      assert.strictEqual(validateRequest(r), false);
    });

    it('[QST-REQ-10] scope.type latest requires withinDays', () => {
      const r = validRequest();
      r.questions['weight-week'].scope = { type: 'latest' };
      assert.strictEqual(validateRequest(r), false);
    });

    it('[QST-REQ-11] scope.type range rejected (reserved for future)', () => {
      const r = validRequest();
      r.questions['cycle-recent'].scope = { type: 'range', from: '2026-01-01', to: '2026-06-15' };
      assert.strictEqual(validateRequest(r), false);
    });

    it('[QST-REQ-12] subField with unknown type fails', () => {
      const r = validRequest();
      r.questions['progesterone-life'].subField = { type: 'dropdown' };
      assert.strictEqual(validateRequest(r), false);
    });

    it('[QST-REQ-13] additional property at root rejected', () => {
      const r = validRequest();
      r.bogusRoot = 1;
      assert.strictEqual(validateRequest(r), false);
    });

    it('[QST-REQ-14] additional property on a question rejected', () => {
      const r = validRequest();
      r.questions['weight-week'].bogusField = 1;
      assert.strictEqual(validateRequest(r), false);
    });

    it('[QST-REQ-15] withinDays = 0 rejected (exclusiveMinimum)', () => {
      const r = validRequest();
      r.questions['weight-week'].scope = { type: 'latest', withinDays: 0 };
      assert.strictEqual(validateRequest(r), false);
    });
  });

  describe('[QST-ANS] answer schema validation', () => {
    it('[QST-ANS-1] a valid answer (all statuses) passes', () => {
      assert.strictEqual(validateAnswer(validAnswer()), true, JSON.stringify(validateAnswer.errors));
    });

    it('[QST-ANS-2] missing requestEventId fails', () => {
      const a = validAnswer();
      delete a.requestEventId;
      assert.strictEqual(validateAnswer(a), false);
    });

    it('[QST-ANS-3] empty requestEventId fails', () => {
      const a = validAnswer();
      a.requestEventId = '';
      assert.strictEqual(validateAnswer(a), false);
    });

    it('[QST-ANS-4] missing answers map fails', () => {
      const a = validAnswer();
      delete a.answers;
      assert.strictEqual(validateAnswer(a), false);
    });

    it('[QST-ANS-5] empty answers map passes (all questions unanswered)', () => {
      const a = validAnswer();
      a.answers = {};
      assert.strictEqual(validateAnswer(a), true, JSON.stringify(validateAnswer.errors));
    });

    it('[QST-ANS-6] answered without references fails', () => {
      const a = validAnswer();
      delete a.answers['progesterone-life'].references;
      assert.strictEqual(validateAnswer(a), false);
    });

    it('[QST-ANS-7] answered with empty references fails (minItems 1)', () => {
      const a = validAnswer();
      a.answers['progesterone-life'].references = [];
      assert.strictEqual(validateAnswer(a), false);
    });

    it('[QST-ANS-8] no carrying references fails (additionalProperties false on no)', () => {
      const a = validAnswer();
      a.answers['cycle-recent'] = { status: 'no', references: ['evt-x'] };
      assert.strictEqual(validateAnswer(a), false);
    });

    it('[QST-ANS-9] unknown carrying references fails', () => {
      const a = validAnswer();
      a.answers['forgotten'] = { status: 'unknown', references: ['evt-x'] };
      assert.strictEqual(validateAnswer(a), false);
    });

    it('[QST-ANS-10] declined with reason passes', () => {
      const a = validAnswer();
      a.answers['sensitive'] = { status: 'declined', reason: 'I prefer not to' };
      assert.strictEqual(validateAnswer(a), true);
    });

    it('[QST-ANS-11] declined without reason passes (reason optional)', () => {
      const a = validAnswer();
      a.answers['sensitive'] = { status: 'declined' };
      assert.strictEqual(validateAnswer(a), true);
    });

    it('[QST-ANS-12] declined with references fails', () => {
      const a = validAnswer();
      a.answers['sensitive'] = { status: 'declined', references: ['evt-x'] };
      assert.strictEqual(validateAnswer(a), false);
    });

    it('[QST-ANS-13] unknown status enum value fails', () => {
      const a = validAnswer();
      a.answers['weight-week'].status = 'maybe';
      assert.strictEqual(validateAnswer(a), false);
    });

    it('[QST-ANS-14] answer key with colon fails (Pryv path grammar)', () => {
      const a = validAnswer();
      a.answers['has:colon'] = { status: 'no' };
      assert.strictEqual(validateAnswer(a), false);
    });

    it('[QST-ANS-15] additionalProperties at root rejected', () => {
      const a = validAnswer();
      a.bogus = 1;
      assert.strictEqual(validateAnswer(a), false);
    });

    it('[QST-ANS-16] qualifier accepted as string / number / object', () => {
      const a = validAnswer();
      a.answers['progesterone-life'].qualifier = 'T1';
      assert.strictEqual(validateAnswer(a), true);
      a.answers['progesterone-life'].qualifier = 9;
      assert.strictEqual(validateAnswer(a), true);
      a.answers['progesterone-life'].qualifier = { custom: true };
      assert.strictEqual(validateAnswer(a), true);
    });

    it('[QST-ANS-17] answered with references but additional unknown field fails', () => {
      const a = validAnswer();
      a.answers['progesterone-life'].extra = 1;
      assert.strictEqual(validateAnswer(a), false);
    });
  });
});
