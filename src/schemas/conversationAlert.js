// JSON Schema of the `content.hds` block of the `notification/alert-cmc` kinds of a conversation (task-status,
// notice, question, proposed-values, answer), documentation/CONVERSATION.md and CUSTOM-FIELDS-AND-SYSTEM.md.
// The alert type is upstream-owned (the CMC plugin's) and the cores do not validate `hds`, so writers, third
// parties included, validate against this file: published as json-schemas/hds-conversation-alert.json, tested in
// tests/conversation.test.js. It validates the `hds` object only, not the alert envelope.
// Portable subset: compiles under draft-04 (the cores) and draft-07, so no const, not, if/then/else or $ref.

const ID = { type: 'string', maxLength: 64, pattern: '^[a-zA-Z0-9_-]+$' };
const CODE = { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{0,63}$' };
const COUNT = { type: 'integer', minimum: 0 };

const STATUSES = ['received', 'reading', 'on-hold', 'awaiting-answers', 'done', 'error'];

const hdsConversationAlert = {
  $id: 'https://model.datasafe.dev/json-schemas/hds-conversation-alert.json',
  title: 'HDS notification/alert-cmc content.hds, conversation kinds',
  description: 'The hds block of a conversation alert: kinds, event ids, codes and counts only, never a value, a printed line, a name, a date, an item key or a stream id. The ids point into the relationship\'s own child of conversation-items, or at a document shared in it. See documentation/CONVERSATION.md.',
  type: 'object',
  required: ['kind'],
  oneOf: [
    branch('task-status', 'contact to person: the state of the work on one document. Alerts are immutable: the state is the latest by alert time, attempt breaking a tie.', ['about', 'status', 'attempt'], {
      about: { ...ID, description: 'The event id of the document.' },
      status: { type: 'string', enum: STATUSES, description: 'on-hold (4.33.0): the contact has the document and cannot work on it now.' },
      attempt: { description: 'Attempt on this document, from 1: a label and a tie-break, never the order (a restarted contact may not know the last one).', type: 'integer', minimum: 1 },
      counts: {
        description: 'Counts only, never what was counted.',
        type: 'object',
        additionalProperties: false,
        properties: { proposed: COUNT, questions: COUNT, keptAside: COUNT, dropped: COUNT }
      },
      errorCode: { ...CODE, description: 'With status error: a code, never a message.' }
    }),
    branch('notice', 'contact to person: a message the app renders from its code. Never free text.', ['code'], {
      code: CODE,
      about: { ...ID, description: 'The event id of the document, when the notice is about one.' }
    }),
    branch('question', 'contact to person: a question event was written on the received child.', ['eventId', 'about'], {
      eventId: { ...ID, description: 'The id of the question event (message/hds-conversation-v1) on the person\'s account.' },
      about: { ...ID, description: 'The event id of the document the question is about.' }
    }),
    branch('proposed-values', 'contact to person: proposed-value (or proposed-document) events for one document were written on the received child. A wake-up only: the person\'s app lists the child by about, never trusts count.', ['about', 'count'], {
      about: { ...ID, description: 'The event id of the document.' },
      count: { description: 'How many proposed-value and proposed-document events were written for it in this batch.', type: 'integer', minimum: 1 }
    }),
    branch('answer', 'person to contact: an answer event was written on the sent child.', ['eventId', 'inReplyTo', 'about'], {
      eventId: { ...ID, description: 'The id of the answer event (message/hds-conversation-v1) on the person\'s account.' },
      inReplyTo: { ...ID, description: 'The id of the question or proposed-value event it answers.' },
      about: { ...ID, description: 'The event id of the document.' }
    })
  ]
};

function branch (kind, description, required, properties) {
  return {
    description: kind + ' (' + description + ')',
    type: 'object',
    additionalProperties: false,
    required: ['kind', ...required],
    properties: { kind: { type: 'string', enum: [kind] }, ...properties }
  };
}

function toBePublished () {
  return [
    { title: 'Json Schema notification/alert-cmc content.hds, conversation kinds', path: './json-schemas/', filename: 'hds-conversation-alert.json', type: 'json', content: hdsConversationAlert }
  ];
}

module.exports = {
  hdsConversationAlert,
  STATUSES,
  toBePublished
};
