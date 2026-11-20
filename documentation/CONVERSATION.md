# Conversation: questions, proposed values and answers between a person and a contact

A contact (a doctor, a reading service such as the HDS Reader, a third party's service) talks with a person through
the standard conversation of a CMC relationship: the chat, the documents she shares, and the structured items this
page defines, questions, proposed values and her answers. This page is the **wire contract**: any counterparty
implements it, and any person's app renders it, without knowing who is on the other side. The person's app
dispatches on `hds.kind` and on `content.kind`, never on the contact's app code.

**Normative** (4.22.0). "MUST" and "never" bind writers; readers follow § Writers validate, readers dispatch.

## The principle: the conversation is standard, the content travels by reference

Anything that carries a value, a printed line or an identity is an **event on the person's account**, in a child of
`conversation-items` that only this contact is granted. What travels over CMC, and is therefore stored on both
accounts, is a **pointer**: a `notification/alert-cmc` whose `hds` block carries kinds, event ids, codes and counts
only. This is the `document-shared` pattern of [DOCUMENTS.md](DOCUMENTS.md#sharing-one-document-the-document-shares-root-3370)
applied to the rest of the conversation.

| Need | Mechanism |
|---|---|
| She sends a document or a picture | the existing document share: a `document-shares` child, `document-shared` / `document-unshared` alerts ([DOCUMENTS.md](DOCUMENTS.md#sharing-one-document-the-document-shares-root-3370)) |
| The contact reports the state of its work | alert `task-status` |
| The contact tells her something | alert `notice`: a code her app renders |
| The contact asks a question, with what she needs to answer it | a `question` event on the `received` child + alert `question` |
| The contact proposes values read from a document | `proposed-value` events on the `received` child + one alert `proposed-values` per batch |
| She answers | her app writes the values she confirmed, then an `answer` event on the `sent` child + alert `answer` |
| Typed text, both ways | `message/chat-cmc` (`features.chat` set at invite); never a value, a name or a date from the contact's side (§ Chat) |

**Her app writes the values.** The contact proposes; once she confirms, her own app writes each value event with her
token. The contact never holds a grant on a clinical stream, and no clinical stream id reaches its account.

## Where it lives: the `conversation-items` root

| | |
|---|---|
| Stream | `conversation-items` ("Conversation items"), a root, **`explicitGrantOnly`** ([GENETICS.md](GENETICS.md#explicitgrantonly)); its children are created by the person's app |
| Item | none, anywhere in the subtree |
| Stream key | `clientData.hdsConversationItems` on each child ([PROVENANCE.md](PROVENANCE.md)) |
| EventType | `message/hds-conversation-v1` (§ below) |
| Alerts | `task-status`, `notice`, `question`, `proposed-values`, `answer` ([CUSTOM-FIELDS-AND-SYSTEM.md](CUSTOM-FIELDS-AND-SYSTEM.md#a-conversation-notificationalert-cmc-kinds-4220)) |

**Why a marked root.** Proposed values hold what a document prints, and an `is-this-yours` question holds the name
and birth date it prints: a `*` grant (an assistant connected through MCP, a full export) must not read them, and a
grant on another root must not reach them. The person's app creates the root (with its model name) before the first
grant, as for `document-shares`.

**Two children per relationship, created by the person's app** when she accepts a contact that declares the
conversation (its invite), or before the contact's first item:

- `id` = `conv-` + 12 lowercase base36 characters: random, never derived from a name, never reused across
  relationships, even with the same contact. `name` = the id itself (the name must carry nothing).
- `clientData.hdsConversationItems = { relationship: <CMC relationship id>, direction: 'received' | 'sent' }`.

| `direction` | Holds | Contact's level | Written by |
|---|---|---|---|
| `received` | the contact's `question` and `proposed-value` events | `contribute` (it writes, and deletes under § Retention) | the contact only |
| `sent` | the person's `answer` events | `read` | the person's app only |

Granted by `consent/scope-update-cmc`, one child at a time, never the root. The contact cannot write an answer: it
holds `read` on `sent`.

**Labels.** Readers never show a child's name. They label it from `direction`, from the viewer's side:

| `direction` | Viewer | en | fr | es |
|---|---|---|---|---|
| `received` | the person | Received in conversations | Reçu dans les conversations | Recibido en las conversaciones |
| `received` | the contact | Items you send | Éléments que vous envoyez | Elementos que usted envía |
| `sent` | the person | Your answers | Vos réponses | Sus respuestas |
| `sent` | the contact | Answers shared with you | Réponses partagées avec vous | Respuestas compartidas con usted |

**When a relationship ends** (full revoke), the person's app deletes both children with `mergeEventsWithParent:
false`. The values she wrote stay: they are hers, on their items. A restore recreates streams but not accesses: her
app deletes a child whose relationship no longer exists.

## The flow, for one document

1. She shares a document (`document-shared`, `eventId` = the document's event id). The contact reads the event and its
   attachment by id.
2. The contact posts `task-status` (`received`, then `reading`, `attempt` from 1).
3. It writes its `proposed-value` events, then its `question` events, on `received`, each with `about` = the
   document's event id, and posts one `proposed-values` alert per batch and one `question` alert per question. Then
   `task-status` `awaiting-answers`, with `counts`.
4. Her app reads the events the alerts point at (§ R11), shows them, and she answers. For each value she confirms or
   corrects, her app writes the value event (§ Writing a value), then writes the `answer` on `sent`, listing what it
   wrote in `written`, then posts the `answer` alert.
5. The contact reads the answer, and posts `task-status` `done` once nothing waits.
6. Retention (§ R10) removes what is no longer needed, on both accounts.

A notice may come at any step; `no-result-found` ends the work on a document with no question (§ Notice and error codes).

## `message/hds-conversation-v1`

One event per item, on a child of `conversation-items`. `content.kind` discriminates; each kind is a closed object
(`additionalProperties: false`). Times are Unix seconds. Every event carries `about` (the document's event id) and
`clientData.related.<document event id>: true`.

| `kind` | Child | Written by | Content |
|---|---|---|---|
| `question` | `received` | the contact | `about`, `code`, `candidateId?`, `options?` (codes), `context?` (`identity?`, `dates?`, `anchor?`) |
| `proposed-value` | `received` | the contact | `about`, `candidateId`, `replaces?` (the candidateId it replaces), `printed` (`label`, `value`, `unit?`, `refRange?`, `flag?`, `section?`: the line as printed), `anchor?` (the shape of `hdsSourceAnchor`), `proposal?` (`itemKey`, `type`, `content`, `time?`, `clientData?`: the event proposed), `status` (`clear`, `check`, `unmapped`, `unit-missing`, `kept-aside`), `reason?`, `requestKey?`, `askOneByOne?`, `specimenImplied?`, `extraction` (`engine`, `engineVersion`, `kbVersion`, `backend`) |
| `answer` | `sent` | the person's app | `inReplyTo`, `about`, `action` (`confirm`, `correct`, `not-mine`, `skip`, `choose`, `request-item`, `duplicate`), `candidateIds?`, `option?`, `time?`, `timePrecision?` (`day`, `month`, `year`, `unknown`), `basis?` (`profile-match`), `written?` (`[{ candidateId, eventId }]`) |

`reason` is one of `no-item`, `unit-not-offered`, `no-coded-stream`, `timed-draw`, `implausible-value`,
`ambiguous-label`, `qualitative-result`, `derived-index`. `requestKey` is the key of the item request for a metric no
item holds yet, so a kept-aside value can be offered again once its item ships. `unmapped` and `kept-aside` are set
when the line is read, never after an answer (`unmapped`: the contact cannot say which metric it is; `kept-aside`: it
can, but no item holds it yet).

There is no job, summary or notice kind on the person's account: the state of the work and the notices are alerts
only (§ Alerts), and a kept-aside line is a `proposed-value` with `status: kept-aside`.

### Question codes

Bare codes are HDS's, listed here. A third party's own codes start with `x-<vendor>-`. In this version a code carries
no text, so an `x-` code is shown, not answerable: the fields that would let a third party label its own question
and options (`text`, `optionLabels`) are reserved for a later minor release. An unknown bare code (a newer model) is
shown, not answerable.

| `code` | `candidateId` | `options` | `context` | Allowed answers |
|---|---|---|---|---|
| `which-specimen` | MUST | MUST: specimen codes | none | `choose` (+ `option`), `skip` |
| `which-unit` | MUST | MUST: UCUM codes | none | `choose` (+ `option`), `skip` |
| `which-analyte` | MUST | MUST: item keys | none | `choose` (+ `option`), `skip` |
| `is-fasting` | MUST | MUST: exactly `yes`, `no` | none | `choose` (+ `option`), `skip` |
| `which-date` | MAY (absent: the whole document) | none | `dates?` | `confirm` (+ `timePrecision`, `time` unless `unknown`), `skip` |
| `is-this-yours` | none | none | `identity?`, `anchor?` | `confirm` (+ `basis?`), `not-mine`, `skip` |

- `context.identity` and `context.anchor` appear on `is-this-yours` only, `context.dates` on `which-date` only. The
  anchor points at where the identity block is printed, for her app's anchored view of her own copy of the document;
  one anchor cannot point at several dates, so an anchor per date is reserved for later.
- `which-date` is asked only when no sampling date is certain and at least one proposed value waits for a date.
  `is-this-yours` is asked only on doubt (the printed identity does not match her profile, or none is printed).
- A picked `day` from `context.dates` becomes `time` at 12:00 UTC with `timePrecision: day`
  ([PARTIAL-DATES.md](PARTIAL-DATES.md)).
- **An answer to a question writes no value.** The contact answers a `choose` on `which-specimen`, `which-unit` or
  `which-analyte` (and on `is-fasting` when fasting changes the item) with a new `proposed-value`, a new
  `candidateId` carrying `replaces` = the candidate the question was about, which she confirms like any other. Once a
  replacement exists, the replaced proposed value is shown as not confirmable. An answer to `which-date` or
  `is-this-yours` settles that question only.

### Answers, by what they answer

| The answer is to | `action` | With |
|---|---|---|
| a proposed value | `confirm`, `correct`, `skip`, `request-item` (a kept-aside or unmapped one), `duplicate` | `candidateIds`; `written` with `confirm` and `correct` |
| a `which-specimen`, `which-unit`, `which-analyte` or `is-fasting` question | `choose` | `option`, one of the question's `options`; `candidateIds` naming the question's `candidateId` |
| a `which-date` question | `confirm` | `timePrecision`, and `time` unless `timePrecision` is `unknown`; `candidateIds` naming the question's `candidateId` when it has one |
| an `is-this-yours` question | `confirm` or `not-mine` | `basis` only on an automatic `confirm` (§ R3) |

Any question or proposed value may be answered with `skip`, which settles nothing. `not-mine` is always about the
whole document and answers `is-this-yours` only. An answer whose `action` is not in this table for what it answers is
ignored: never a confirmation, never a `not-mine`.

**`correct`.** Her app writes the value as she corrected it (on any type and item the pack allows, § R9) with
`hdsExtraction.corrected: true`. The answer carries exactly one `candidateIds` entry and its `written` entry: the
contact learns that its reading was changed, never to what. Corrections stay on her account.

### What a writer MUST include

The schema cannot express conditions between fields, so writers check them before writing:

| When | The event MUST |
|---|---|
| any `answer` to a proposed value, or to a question with a `candidateId` | carry `candidateIds`, naming the answered value or the question's candidate |
| `answer` with `action: choose` | carry `option`, one of the question's `options` |
| `answer` with `confirm` or `correct` on a proposed value | carry `written`, one entry per candidate whose value her app wrote; `correct` covers exactly one candidate |
| `answer` with any other action, or to a question | carry no `written` |
| `answer` to a `which-date` question | carry `timePrecision`; `time` unless `timePrecision` is `unknown`, and then no `time` |
| `answer` with `basis` | be a `confirm` on an `is-this-yours` question (§ R3) |
| `question` | follow its row of § Question codes (`candidateId`, `options`, `context`) |
| `question` or `answer` with a `candidateId` | name a `proposed-value` of the same document on the same relationship's `received` child |
| `question` with `context.identity` or `context.anchor` | be `is-this-yours`; with `context.dates`, be `which-date` |
| `proposed-value` with `replaces` | name a proposed value of the same document on the same child, one the person answered a question about and that has no `written` entry |
| `proposed-value` with `status: kept-aside` or `unmapped` | carry `reason` |
| `proposal` with `time` | carry `clientData.hdsTimePrecision`; `unknown` only on a re-proposal after she answered `which-date` with `unknown` |

## Alerts

Five `notification/alert-cmc` kinds, defined in
[CUSTOM-FIELDS-AND-SYSTEM.md](CUSTOM-FIELDS-AND-SYSTEM.md#a-conversation-notificationalert-cmc-kinds-4220) with their
fixed titles and bodies. Their `hds` block is published as a JSON Schema,
`json-schemas/hds-conversation-alert.json` (source `src/schemas/conversationAlert.js`, draft-04 and draft-07): the
cores do not validate `hds`, so every writer validates against it.

| `hds.kind` | Direction | `hds` fields |
|---|---|---|
| `task-status` | contact → person | `about`, `status` (`received`, `reading`, `awaiting-answers`, `done`, `error`), `attempt` (from 1, a label), `counts?` (`proposed`, `questions`, `keptAside`, `dropped`), `errorCode?` (with `error`, MUST) |
| `notice` | contact → person | `code`, `about?` (a document event id) |
| `question` | contact → person | `eventId` (the question event), `about` |
| `proposed-values` | contact → person | `about`, `count` (from 1): a wake-up, her app lists the `received` child by `about` and never trusts `count` |
| `answer` | person → contact | `eventId` (the answer event), `inReplyTo`, `about` |

### Notice and error codes

Codes, never text. As for question codes, bare codes are HDS's and a third party's own start with `x-<vendor>-`; an
unknown code is shown with a generic text.

| `notice.code` | `about` | Meaning |
|---|---|---|
| `no-result-found` | the document | No result line could be read: nothing is proposed, no question is asked, the work ends `done` with zero counts. Not "not a lab report": a failed read of a lab scan has none either. |
| `typed-text-not-read` | none | The contact does not read typed text (§ Chat). At most one per relationship per 24 h. |

| `task-status.errorCode` | Meaning |
|---|---|
| `no-attachment` | The shared document has no attachment the contact can read. |
| `write-failed` | The contact could not write its items on the person's account. |

## Rules

**R1. Everything points at its document.** Every `message/hds-conversation-v1` event carries `about` and
`clientData.related.<about>: true`; every event id in content (`inReplyTo`, `written[].eventId`) is mirrored in
`clientData.related` ([PROVENANCE.md](PROVENANCE.md#clientdatarelatedeventid--a-link-to-another-event)).

**R2. The child decides who wrote it.** A `question` or `proposed-value` counts only on the relationship's `received`
child; an `answer` counts only on its `sent` child. A reader ignores any other kind found on a child, and any item of
this type outside the relationship's two children.

**R3. Nothing is written before an answer, and an answer binds to what was shown.**
- Her app writes a value only for a proposed value she answered with `confirm` or `correct`, and only once every
  `is-this-yours` question of the document has a `confirm` answer (when one was asked) and the value has a date (its
  `proposal.time`, or her answer to `which-date`). `not-mine` writes nothing from the document.
- A proposed value or a question that has an answer is never updated (R5 says when a re-read writes a new one).
- An answer covers `inReplyTo`, each of its `candidateIds`, and the question's `candidateId`. It is void when any event
  it covers was modified after the answer was created (that event's `modified` is later than the answer's
  `created`). Just before writing, her app re-reads what an answer covers and does not write if one changed since it
  was shown.
- A batch answer's `inReplyTo` is the first proposed value of the batch; its `candidateIds` lists every one, that one
  included.
- **`basis: profile-match`** (an answer her app gave without a tap): only with `confirm` on `is-this-yours`, and only
  when all hold after normalisation (case, accents, hyphens and spaces, order of given and family name): the full
  given name and the full family name both equal her profile's (an initial or a missing given name never matches),
  and `context.identity.birthDay` is present and equal to her profile's birth date. A profile without a birth date is
  never matched. At most one automatic answer per document; the card says "matched to your profile" and offers
  `not-mine` until the work is `done`; the latest `is-this-yours` answer wins. A `not-mine` after values were written:
  her app deletes them, from the `written` entries of the document's answers. An unknown `basis` is never a
  confirmation.

**R4. The state of the work is the latest `task-status`** of the document by alert `time`; `attempt` labels it and
breaks a tie, never orders it (the contact deletes its alert copies, R10, so after a restart it may not know the last
attempt). Alerts are immutable; a contact that restarts re-derives its pending work from the person's account (its
items on `received`, her answers on `sent`).

**R5. Idempotency is per `candidateId`.** The contact derives `candidateId` deterministically from the document, the
record and the proposal: the same on every re-read while the proposal is the same, a new one only when it differs
(PROVENANCE.md, "same source record, same key"). It is opaque, never parsed. On a re-read, an unanswered candidate is
written again in place; a candidate found in an answer's `written` is never proposed again (this is why her answers
stay on `sent`). An answer counts once per `candidateId`. The contact knows a candidate is written from
`answer.written`; her app knows it from the value's `sourceKey` (§ Writing a value).

**R6. Never over CMC.** No alert, no chat message of the contact and no alert `title` or `body` carries a value, a
printed line, a name, a birth date, a date of the document, an item key, a stream id or free text from a model. They
carry kinds, event ids, codes and counts. What the document prints is only on the person's account: in
`proposed-value.printed`, `question.context`, and the values her app writes.

**R7. Some lines never become items.** Identity fields, a practitioner's name, administrative and other non-clinical
lines, a printed interpretation, a result in a special category (genetics) the person has not asked for, and lines
about another person are dropped before anything is written, and only counted in `task-status.counts.dropped`, never
split by reason (a count per category would say that a genetic result exists). The printed name and birth date appear
only in `context.identity` of an `is-this-yours` question, copied verbatim from the document's text layer, never
produced or completed by a model; no other identity field (address, insurance or patient number, sex, age,
practitioner) is carried anywhere. `context.dates` carries dates and their labels only, never the birth date or a
person's name. Apps render both as plain text.

**R8. Writers validate, readers dispatch.** A writer validates every event against this type, and every alert's `hds`
against `hds-conversation-alert.json`, before writing. A reader never validates on read: it dispatches on `kind`,
reads the fields it knows, ignores the rest, and skips a kind it does not know. New kinds, fields and enum values are
additive (a minor release); a breaking change is a `-v2` type. A value a reader does not know falls back:

| Field | Unknown value is read as |
|---|---|
| `task-status.status` | in progress |
| `proposed-value.status` | shown, not confirmable |
| `reason` | a generic "not saved" |
| `question.code` (bare or `x-`) | shown, not answerable |
| `answer.action` | ignored by the contact, never a confirmation |
| `answer.basis` | never a confirmation |
| `context.dates[].role` | `other` |
| `proposal.clientData.hdsComparator` | the proposal is not confirmable |
| `timePrecision`, `proposal.clientData.hdsTimePrecision` | absent |
| `proposal.clientData.hdsInterpretation` | absent |
| `notice.code`, `task-status.errorCode` | a generic text |
| an option code (`question.options`) | not selectable |

**R9. The proposal is checked before it is shown, and before it is written.**
- Her app validates `proposal.content` against `proposal.type` from the pack, and checks that `proposal.itemKey` is an
  item of the pack on that type, whose `type` is neither `system` nor `attachments`, and whose stream is not under an
  `explicitGrantOnly` root. Unlike a reminder (`isEnterable`), an `imported` item is allowed: a value read from a
  document is an import, and coded lab results (`body-blood-coded`) are `imported`. A correction is checked the same
  way. A proposal that fails is shown as not confirmable.
- **The engine is bound to the relationship.** `extraction.engine` is self-declared, and it becomes the `<tool>` of the
  `sourceKey` and the `engine` of `hdsExtraction`. Her app accepts proposals only from a relationship whose app is
  vouched (catalogue, [APP-DESCRIPTION.md](APP-DESCRIPTION.md)) for that engine; in this version, `hds-reader` from the
  HDS Reader's relationship only. Proposals from any other relationship, or with another engine, are shown as not
  confirmable. This reads the contact's app identity as an authorisation check, not to choose how to render: every
  relationship's items render the same way.

**R10. Retention.** The items are the person's, on her account; the contact keeps nothing beyond the work on a
document. Deleted means deleted (twice), not only trashed.
- **On her account, the contact deletes** (it holds `contribute` on `received`), once the work on a document is `done`:
  the proposed values whose candidate is in an answer's `written`, those answered `skip`, `duplicate` or
  `request-item`, those replaced (`replaces`), and the questions answered. An `is-this-yours` question carrying
  `identity` is deleted on `not-mine`, on `document-unshared` and when the work is `done`, whatever else stays. A
  kept-aside value stays until she dismisses it or its item ships; offering it again means reading the document again
  (it must still be shared).
- **`not-mine`, `document-unshared` and a document gone win over everything above:** every item of that document is
  deleted, kept-aside values included.
- **Her answers** stay on `sent` until the relationship ends: they carry ids, codes and her date only.
- **On the contact's account**, the delivered copies of the conversation alerts and of her chat messages, and its own
  copies of what it sent, are deleted once the work they are about is `done`, at the latest 24 h after they arrived.
- **After a revoke**, her app deletes both children (§ Where it lives); the contact deletes everything it still holds
  about the relationship.

**R11. Pointers resolve only inside the relationship.** A `question` alert's `eventId` is read only on the
relationship's `received` child, an `answer` alert's only on its `sent` child, and every `about` only among the
documents shared in that relationship (its `document-shares` `shared` child) or covered by its grant. A pointer that
resolves elsewhere is ignored: an alert never makes her app show any other event of her account.

**R12. The alert's words are fixed and not rendered.** Every conversation alert carries the fixed `title` and `body`
of its kind (the CMC plugin requires both), never anything about the document. Her app renders from `hds.kind`, never
from `title` or `body`; no app shows them in a notification list or a push notification.

## Writing a value

Her app writes each confirmed value as an ordinary event on its item, with her token:

- `streamIds`: the item's stream; `type` and `content`: the proposal's, or her correction; `time` and
  `clientData.hdsTimePrecision`: `proposal.time` and its `hdsTimePrecision`, or, when the proposal has no `time`, the
  `time` and `timePrecision` of her `which-date` answer about it or about the whole document (PARTIAL-DATES.md; with
  `unknown`, no `time`: the value is written at its recording moment).
- `clientData.related.<document event id>: true`; `clientData.sourceKey` = `<engine>:document:<document event
  id>:<candidateId>` ([PROVENANCE.md](PROVENANCE.md#clientdatasourcekey--the-identity-of-an-imported-record)), so a
  retry finds it (`state: 'all'`; a trashed one is left trashed);
- the proposal's `clientData` keys (`hdsRefRange`, `hdsFlag`, `hdsInterpretation`, `hdsComparator`,
  `hdsTimePrecision`); `hdsSourceAnchor` = the proposed value's `anchor` when it has one; `hdsExtraction` = its
  `extraction` plus `confirmedBy: 'person'`, and `corrected: true` after a correction
  ([PROVENANCE.md](PROVENANCE.md#values-read-from-a-document-by-a-program)).

Order: re-read (R3), write the values (looking each `sourceKey` up first), write the `answer` with `written`, post the
`answer` alert. A retry after a failure finds the values by `sourceKey` and does not write them twice.

## Chat

`message/chat-cmc` stays plain text. `features.chat` is fixed at the invite, so a contact that wants it declares it
there. What she types is stored on the contact's account (inherent to CMC): her app shows a one-line notice under the
composer for a service contact. A service contact never puts a value, a name or a date in its own chat messages, and
sends no model free text; one that does not read typed text answers with the notice `typed-text-not-read` (at most
once per relationship per 24 h), and deletes what she typed within 24 h (R10).

## What a counterparty implements, at the minimum

1. An HDS account and a CMC invite that declares the conversation (`features.chat` as wanted) and, for proposals, a
   vouched app (R9).
2. Read a shared document by its event id on `document-shared`; stop and delete on `document-unshared` and on revoke.
3. Post `task-status` for every document it takes.
4. Write `proposed-value` and `question` events on the `received` child, validated against this type and following §
   What a writer MUST include, each followed by its alert, validated against `hds-conversation-alert.json`.
5. Read her answers on `sent`, and only there (R2); honour the binding and void rules (R3).
6. Never put a value, a name or a date in an alert or a chat message (R6, R12); resolve nothing outside the
   relationship (R11).
7. Delete as R10 says, on her account and on its own.

The person's app implements the rest: the children, the values it writes (§ Writing a value), the checks of R9, and
the rendering of every kind with its fallbacks (R8).

## Examples

A question with its context, on the `received` child:

```json
{
  "streamIds": ["conv-k3x9q2m7a1b0"],
  "type": "message/hds-conversation-v1",
  "content": {
    "kind": "question",
    "about": "ckq3w8n1x0001",
    "code": "is-this-yours",
    "context": {
      "identity": { "name": "DUPONT Marie", "birthDate": "14.03.1985", "birthDay": "1985-03-14" },
      "anchor": { "attachmentId": "ckq3w8n1x0001a", "page": 1, "bbox": [6, 8.2, 40, 4.5] }
    }
  },
  "clientData": { "related": { "ckq3w8n1x0001": true } }
}
```

A proposed value:

```json
{
  "streamIds": ["conv-k3x9q2m7a1b0"],
  "type": "message/hds-conversation-v1",
  "content": {
    "kind": "proposed-value",
    "about": "ckq3w8n1x0001",
    "candidateId": "c-3f9a1e0b",
    "printed": { "label": "Ferritine", "value": "48", "unit": "ng/mL", "refRange": "30 - 400" },
    "anchor": { "attachmentId": "ckq3w8n1x0001a", "page": 1, "bbox": [8.5, 41.2, 83, 2.1] },
    "proposal": {
      "itemKey": "body-blood-serum-ferritin",
      "type": "concentration/ug-l",
      "content": 48,
      "time": 1773316800,
      "clientData": { "hdsTimePrecision": "day", "hdsRefRange": { "lowerLimit": 30, "upperLimit": 400, "text": "30 - 400" } }
    },
    "status": "clear",
    "extraction": { "engine": "hds-reader", "engineVersion": "0.3.0", "kbVersion": "0.4.0", "backend": "text-layer" }
  },
  "clientData": { "related": { "ckq3w8n1x0001": true } }
}
```

Her answer, on the `sent` child, after her app wrote the value:

```json
{
  "streamIds": ["conv-p0w4e8r2t6y1"],
  "type": "message/hds-conversation-v1",
  "content": {
    "kind": "answer",
    "inReplyTo": "ckq3w8n1x0012",
    "about": "ckq3w8n1x0001",
    "action": "confirm",
    "candidateIds": ["c-3f9a1e0b"],
    "written": [{ "candidateId": "c-3f9a1e0b", "eventId": "ckq3w8n1x0020" }]
  },
  "clientData": { "related": { "ckq3w8n1x0001": true, "ckq3w8n1x0012": true, "ckq3w8n1x0020": true } }
}
```

The alerts of that flow, one per kind (written by the sender on its collectors stream; the words are the fixed ones
of [CUSTOM-FIELDS-AND-SYSTEM.md](CUSTOM-FIELDS-AND-SYSTEM.md#a-conversation-notificationalert-cmc-kinds-4220)):

```json
{
  "level": "info",
  "title": { "en": "Document update", "fr": "Suivi du document" },
  "body": { "en": "Your contact updated the status of a document.", "fr": "Votre contact a mis à jour l'état d'un document." },
  "code": "hds-task-status",
  "hds": { "kind": "task-status", "about": "ckq3w8n1x0001", "status": "awaiting-answers", "attempt": 1, "counts": { "proposed": 12, "questions": 1, "keptAside": 1, "dropped": 4 } }
}
```

```json
{
  "level": "info",
  "title": { "en": "Message", "fr": "Message" },
  "body": { "en": "Your contact sent you a message.", "fr": "Votre contact vous a envoyé un message." },
  "code": "hds-notice",
  "hds": { "kind": "notice", "code": "no-result-found", "about": "ckq3w8n1x0001" }
}
```

```json
{
  "level": "info",
  "title": { "en": "Question", "fr": "Question" },
  "body": { "en": "Your contact asks you a question.", "fr": "Votre contact vous pose une question." },
  "code": "hds-question",
  "hds": { "kind": "question", "eventId": "ckq3w8n1x0011", "about": "ckq3w8n1x0001" }
}
```

```json
{
  "level": "info",
  "title": { "en": "Proposed values", "fr": "Valeurs proposées" },
  "body": { "en": "Your contact proposes values read from a document. Please check them.", "fr": "Votre contact propose des valeurs lues dans un document. Merci de les vérifier." },
  "code": "hds-proposed-values",
  "hds": { "kind": "proposed-values", "about": "ckq3w8n1x0001", "count": 12 }
}
```

```json
{
  "level": "info",
  "title": { "en": "Answer", "fr": "Réponse" },
  "body": { "en": "The person answered.", "fr": "La personne a répondu." },
  "code": "hds-answer",
  "hds": { "kind": "answer", "eventId": "ckq3w8n1x0030", "inReplyTo": "ckq3w8n1x0012", "about": "ckq3w8n1x0001" }
}
```

## From `message/hds-reader-v1`

`message/hds-reader-v1` ([HDS-READER.md](HDS-READER.md)) is superseded: it stays in the pack so the demo events
written before 4.22.0 still validate, and no new writer uses it. No migration: the demo dialogues are deleted.

| reader-v1 | Now |
|---|---|
| `job`, `summary` | alert `task-status` (`counts`) |
| `notice` | alert `notice` |
| `reading` | `proposed-value` (+ `about`, `extraction`; without `confidence` and `kbEntries`) |
| `question`, `answer` | same names; `about` is the document's event id, a question names its candidate in `candidateId`; an answer carries no value and lists `written` |
| `access-request`, `access-result`, `written` | dropped: her app writes the values |
| `hds-reader-inbox`, `hds-reader-dialogue` | the document share, and the `conversation-items` children |

## Not in this version

- `text` and `optionLabels` on a question with an `x-` code (a third party's own question), reserved: plain text,
  `en` required, an option without a label not selectable.
- An anchor per candidate date (`context.dates[].anchor`), reserved.
- Corrected values to the contact (learning from corrections): a later opt-in.
- A contact answering typed text with a model.
- A per-relationship list of the items a contact may propose (R9 binds the engine only).

Tests: `tests/conversation.test.js` (`[CNV-*]`), under draft-04 (the cores) and draft-07.
