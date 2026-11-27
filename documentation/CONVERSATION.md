# Conversation: questions, proposed values and answers between a person and a contact

A contact (a doctor, a reading service such as the HDS Reader, a third party's service) talks with a person through
the standard conversation of a CMC relationship: the chat, the documents she shares, and the structured items this
page defines, questions, proposed values and her answers. This page is the **wire contract**: any counterparty
implements it, and any person's app renders it, without knowing who is on the other side. The person's app
dispatches on `hds.kind` and on `content.kind`, never on the contact's app code.

**Normative** (4.22.0; 4.26.0 adds a document's date and kind, her `note`, and the specimen codes; 4.27.0 the notice
`ready`; 4.33.0 the status `on-hold`; 4.36.0 a dated grid, § A dated grid; 4.39.0 a table read per column; 4.45.0 four
notice codes, § Notice and error codes; 4.47.0 her other names in the match (§ R3), an anchor per date, the notice
`pages-not-read`; 4.49.0 a document dated per page; 4.51.0 a written value's box). "MUST" and "never" bind writers; readers follow § Writers validate, readers dispatch.

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
| The contact proposes a document's date and kind (4.26.0) | a `proposed-document` event on the `received` child + alert `proposed-values` |
| She answers | her app writes the values she confirmed (or the document's date and kind), then an `answer` event on the `sent` child + alert `answer`; her comment, if she types one, is the answer's `note` |
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
| `received` | the contact's `question`, `proposed-value` and `proposed-document` events | `contribute` (it writes, and deletes under § Retention) | the contact only |
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

Before any document, once per relationship, a contact that reads documents may say it is ready (notice `ready`,
4.27.0).

1. She shares a document (`document-shared`, `eventId` = the document's event id). The contact reads the event and its
   attachment by id.
2. The contact posts `task-status` (`received`, then `reading`, `attempt` from 1).
3. It writes its `proposed-value` events (and a `proposed-document` when the document waits for its date or kind),
   then its `question` events, on `received`, each with `about` = the document's event id, and posts one `proposed-values` alert per batch and one `question` alert per question. Then
   `task-status` `awaiting-answers`, with `counts`.
4. Her app reads the events the alerts point at (§ R11), shows them, and she answers. For each value she confirms or
   corrects, her app writes the value event (§ Writing a value), then writes the `answer` on `sent`, listing what it
   wrote in `written`, then posts the `answer` alert.
5. The contact reads the answer, and posts `task-status` `done` once nothing waits.
6. Retention (§ R10) removes what is no longer needed, on both accounts.

A notice may come at any step; `no-result-found`, `several-sampling-dates`, `several-result-columns`,
`grid-not-located` and `kind-not-read` end the work on a document with no question (§ Notice and error codes).

**`on-hold` (4.33.0): the contact has the document and cannot work on it now, for a reason of its own.** She has nothing
to do. A contact that cannot start or go on posts `on-hold`, instead of `reading` (which says the work has started) or
after it, and only while no question or proposed value of the document waits for her answer: with one open it posts no
status, and the state stays `awaiting-answers`. Going on hold is not an attempt: `on-hold` carries the `attempt` of the
work it holds back, and the status that follows keeps it. It carries no `counts` and no `errorCode`. A later `task-status`
supersedes it (R4). A contact does not alternate `on-hold` and `reading` while it retries. It posts `on-hold` again at
least once per 24 h while it lasts (its own copy is deleted within 24 h, R10), and any current status at most twice per
24 h per document. A contact whose schema is older than 4.33.0 cannot write it and posts `received`.

## `message/hds-conversation-v1`

One event per item, on a child of `conversation-items`. `content.kind` discriminates; each kind is a closed object
(`additionalProperties: false`). Times are Unix seconds (`printed.samplingTime` is a printed time of day, display
only). Every event carries `about` (the document's event id) and
`clientData.related.<document event id>: true`.

| `kind` | Child | Written by | Content |
|---|---|---|---|
| `question` | `received` | the contact | `about`, `code`, `candidateId?`, `options?` (codes), `context?` (`identity?`, `dates?`, `grid?`, `column?`, `anchor?`) |
| `proposed-value` | `received` | the contact | `about`, `candidateId`, `replaces?` (the candidateId it replaces), `printed` (`label`, `value` (absent only with reason `not-read`, 4.36.0), `unit?`, `refRange?`, `flag?`, `section?`, `samplingTime?`: the line as printed; `samplingTime` is the time printed over the value's column, normalised to `HH:MM`, display only), `anchor?` (`hdsSourceAnchor`, with `eventId` = `about`), `grid?` (`row`, `column`, 4.36.0: § A dated grid), `column?` (`index`, 4.39.0: § A table read per column), `proposal?` (`itemKey`, `type`, `content`, `time?`, `clientData?`: the event proposed), `status` (`clear`, `check`, `unmapped`, `unit-missing`, `kept-aside`), `reason?`, `requestKey?`, `askOneByOne?`, `specimenImplied?`, `extraction` (`engine`, `engineVersion`, `kbVersion`, `backend`) |
| `proposed-document` (4.26.0) | `received` | the contact | `about`, `candidateId`, `replaces?`, `proposal` (at least one of `documentKind`, a `documentKinds` key, and `time` with `timePrecision`: `day`, `month`, `year`), `anchor?` (where the date is printed), `status` (`clear`, `check`), `extraction?` (§ A document's date and kind) |
| `answer` | `sent` | the person's app | `inReplyTo`, `about`, `action` (`confirm`, `correct`, `not-mine`, `skip`, `choose`, `request-item`, `duplicate`), `candidateIds?`, `option?`, `time?`, `timePrecision?` (`day`, `month`, `year`, `unknown`), `basis?` (`profile-match`, `existing-value`, `not-pending`), `written?` (`[{ candidateId, eventId }]`), `applied?` (`time`, `kind`: on a proposed document, 4.26.0), `note?` (plain text, at most 1000 characters, 4.26.0: § Her note) |

`reason` is one of `no-item`, `unit-not-offered`, `no-coded-stream`, `timed-draw`, `implausible-value`,
`ambiguous-label`, `qualitative-result`, `derived-index`, `not-read` (4.36.0, § A dated grid). `requestKey` is the key of the item request for a metric no
item holds yet, so a kept-aside value can be offered again once its item ships. `unmapped` and `kept-aside` are set
when the line is read, never after an answer (`unmapped`: the contact cannot say which metric it is, or, with `not-read`, what is written there; `kept-aside`: it
can, but no item holds it yet).

There is no job, summary or notice kind on the person's account: the state of the work and the notices are alerts
only (§ Alerts), and a kept-aside line is a `proposed-value` with `status: kept-aside`.

### A document's date and kind: `proposed-document` (4.26.0)

She may add a document without saying when it is from or what it is: her app then writes it as a placeholder, kind
`other`, at the moment she added it, with `clientData.hdsDocumentPending` naming the fields she has not confirmed
([DOCUMENTS.md](DOCUMENTS.md#a-document-waiting-for-its-date-and-kind-4260)). A contact she shares it with proposes
them in the conversation; she confirms in one tap.

- **Only onto a document waiting for it.** A contact writes a `proposed-document`, or asks `which-document-kind` or
  `which-document-date`, only while the document's `hdsDocumentPending` holds at least one field it proposes or asks
  about. A document added before 4.26.0, or by an app that does not write the flag, never gets one, so an older app
  never receives a kind it skips or a question it cannot answer.
- **What is proposed.** `proposal.documentKind` is a `documentKinds` key of the pack, never a Coding: her app copies the class
  and type from the pack, so nothing the contact writes reaches the document but a key and a date. `proposal.time` is
  the document's date as § Which date is a document's date of DOCUMENTS.md decides (for a lab report, `timeBasis:
  service`, the sampling day, the same day the values carry; its report date only as a fallback, with `status: check`),
  at 12:00 UTC at the start of its period with `timePrecision` (PARTIAL-DATES.md); never `unknown`: a contact that
  does not know the date proposes none, or asks `which-document-date`.
- **`status`.** `clear`: read with no doubt; `check`: one field is a fallback. Both need her tap: nothing changes on
  the document before her `confirm` or `correct` (R3).
- **`extraction` is optional.** A person (a doctor) may propose a date and a kind, and no vouching applies (R9): only
  a pack key and a date reach the document, on her tap.
- **One open at a time.** A contact keeps at most one unanswered `proposed-document` per document: it rewrites it in
  place while the proposal is the same candidate, or writes a new one with `replaces` and deletes the stale one at
  once (unlike a replaced proposed value, kept until `done`). Her app treats a `replaces` naming an item that is gone
  as normal.
- **A question fills what the proposal lacks.** `which-document-kind` (options: kind keys) and `which-document-date`
  (`context.dates`) name the `proposed-document` in `candidateId`; her answer supplies the missing field when she
  confirms it (§ Writing a document's date and kind). Neither triggers a re-proposal, and `which-date` stays the sampling
  day of values.
- **The first confirmation wins.** Her app applies a proposed field only while it is pending on the document: a field
  she set herself, or confirmed from another contact's proposal, is never overwritten by a contact.
- **It does not hold up the work.** A contact does not wait for an answer to a `proposed-document`, nor to the two
  document questions, to post `done`, and does not count them in `task-status.counts` (`proposed`, `questions`).
- **Answered** means: an answer whose `inReplyTo` is the `proposed-document` (a `which-document-date` answer that
  names it in `candidateIds` answers its question, not the proposal).
- **It may arrive after `done`.** Her app lists the `received` child on every `proposed-values` alert, whatever the
  task status.

### A dated grid (4.36.0)

A document that bears one box per day (a paper cycle chart: one row per cycle, one column per day). The contact proposes
what it read in a box as ordinary proposed values, and says which boxes it did not read, so that a box with writing never
looks like an empty day.

- **A box, its parts.** Every proposed value of a grid carries `grid`, its box: `row`, the grid's row on its page, from the top, from 1,
  every row of the printed grid counted, the empty ones too (from its lines, never from the rows read), and `column`, the box's
  printed column number (from the grid, never from a model). A contact that is not sure of a box's row and column (a grid it
  cannot find, a page cut above its first row) writes nothing from the document, no value, no `not-read`, no question, and sends
  the notice `grid-not-located` (4.45.0: a contact reads a dated-grid document whole or not at all; `no-result-found` before). A box that holds an observation, a bleeding and a mark is three candidates, one per `itemKey`, with the same `grid` and `anchor`. The record of R5 is the attachment, the page, `grid` and the
  `itemKey`. Her app orders, groups and names boxes from `grid`, never from `bbox`. A grid value without `anchor` loses its box on
  her record (`hdsSourceGrid` needs the anchor, 4.51.0): a contact writes `anchor` on every grid value. `printed.label` is the column number too, and
  `printed.value` the part as written ("10KL x2"); a text longer than `value` allows is never cut: the part is `not-read`.
- **`not-read`.** Status `unmapped`, reason `not-read`: the contact sees writing in this box and proposes nothing from it, or not
  from all of it (it cannot read it, reads nothing of that kind, or cannot date the row). It carries `printed.label`, `grid` and
  `anchor` (with `bbox`), no `printed.value`, no `proposal`, no `requestKey`. One per box at most. A box read in part has its
  proposed values and one `not-read` with the same `grid`: her app says part of it was not read. A box with no writing, or
  with only its date or its stamp, is none of them.
- **What she does with it.** `skip`, once she has seen it (a `request-item` from an older app is read as a `skip`). A value she types
  in from it is an entry of her own (no `hdsExtraction`, no engine `sourceKey`); it is not a `correct`, since nothing was proposed.
  It does not hold up the work, and stays after `done` like a kept-aside line, until she answers it (R10).
- **`counts.notRead`**: the proposed values with reason `not-read`, in neither `proposed` nor `keptAside`. `counts` are those of the
  reading: `proposed` also counts the values read that are proposed once their row is dated. Her app counts the items.
- **Nothing is proposed without its day.** The contact asks it, `which-row-date`, one question per row, with `context.grid` and
  `context.anchor` naming one box of the row: its first box with a written date, else its first with writing; the `bbox` covers the
  written date. She answers the day of that box, with its year, from her own document. The contact derives the other days
  from the columns (her app never computes a day) and proposes the row's values, each with `proposal.time` (12:00 UTC) and
  `hdsTimePrecision: day`, while the state is `awaiting-answers`, with their `proposed-values` alert and no new `task-status`. Before
  that answer only the row's `not-read` boxes exist. A row that continues the one above is not asked: it follows it.
- **Never a date for the whole document.** On a document with a `which-row-date`, the contact asks no `which-date`, and writes no
  value to confirm without `proposal.time`; her app takes a value's day from `proposal.time` only (§ Writing a value). A document's
  own date never dates a value.
- **A row not dated** (she answered `skip`, or the written dates do not follow her answer): the contact writes its boxes as
  `not-read` and no longer waits for that question; `done` waits for every other. While the question exists, a later `confirm` counts as a
  first answer: the contact deletes those `not-read` she has not answered and proposes the row. At `done` the question is deleted,
  answered or skipped (R10); after that she shares the document again.
- **She changes the day.** Until a value of the row is in a `written`, a later `confirm` replaces the earlier: the contact
  proposes the row again (other days, so other `candidateId`s) and deletes the row's earlier candidates that are not written. Once one is written, a later answer changes nothing; her
  app shows each value's own day, never the question's answer.
- **One candidate per record.** Before writing a candidate, the contact deletes the candidates of the same record under another
  `candidateId` that are not written, answered or not, and writes none for a record that has a `written` entry.

### A table read per column (4.39.0)

A picture of a cumulative report (one result column per sampling day) that the contact reads column by column. A model can
misread a column's date the same way twice, and nothing on the page tells it; so on a picture the person dates each column.

- **One question per column, `which-column-date`,** with `context.column` (`index`: the result column, from the left, from 1, the
  empty ones counted) and `context.anchor` with its `bbox`: the box of everything printed above that column, its heading. A
  column the contact has no heading box for is not asked, and not proposed. The question carries no date, and a date a model
  read is never offered without its box (`context.dates` is copied from a text layer, or with its anchor): she reads the day
  from the heading. She answers the day, with
  its year: `confirm` (+ `time` at 12:00 UTC, `timePrecision: day`), or `skip`. Two columns may have the same day.
- **Nothing of the column is proposed before her answer, and her day must be the day read.** Her answer and the model's reading
  are two readings of one heading. When her day is the day the contact read, it proposes the column's values, each with
  `column`, `proposal.time` = that day and `hdsTimePrecision: day`, each with its own status (`clear` allowed), while the state
  is `awaiting-answers`, with their `proposed-values` alert and no new `task-status`. When it is not, the column is not dated.
  `counts.proposed` counts the values read that are proposed once their column is dated.
- **Never a date for the whole document.** On a document with a `which-column-date`, the contact asks no `which-date`, and writes
  no value to confirm without `proposal.time`; her app takes a value's day from `proposal.time` only (§ Writing a value).
- **A column not dated** (she answered `skip`, or her day is not the day read): the contact proposes none of its values, sends
  the notice `columns-not-read` once for the document, and no longer waits for that question; `done` waits for every other.
  While the question exists, a later `confirm` counts as a first answer. At `done` the question is deleted, answered or skipped
  (R10).
- **She changes the day.** Until a value of the column is in a `written`, a later `confirm` replaces the earlier: the contact
  deletes the column's earlier candidates that are not written and proposes it again if the new day is the day read. Once one is
  written, a later answer changes nothing.
- **One candidate per record.** The record of R5 is the attachment, the page, `column.index`, the printed line (`section` and
  `label`) and the `itemKey`; before writing a candidate, the contact deletes the candidates of the same record under another
  `candidateId` that are not written, and writes none for a record that has a `written` entry.
- A report with a text layer is read per column from its text, with each column's printed day, and is never asked this.

### A document dated per page (4.49.0)

A document whose pages may be from different days (several reports scanned together, a picture per page) that the
contact reads page by page. A page with no day the contact holds certain is dated by the person, page by page.

- **One question per page, `which-page-date`,** for each page that holds result lines and has no day the contact holds
  certain, with `context.anchor` naming the page (`attachmentId`, `page`; `bbox` = the page's top band when the contact
  has it, else her app shows the whole page). The question carries no date: no date a model read, and no other page's
  date, is shown or offered. She gives the day, with its year: `confirm` (+ `time` at 12:00 UTC, `timePrecision: day`),
  or `skip`. A full day only; her app refuses a day later than today. Two pages may have the same day; each page is
  answered on its own. Her app answers `which-page-date` before any contact asks it (release order: hds-lib, forms and
  the webapp, then the engine).
- **Nothing of the page is proposed before her answer.** Then the contact proposes the page's values, each with `anchor`
  on that page, `proposal.time` = her day and `hdsTimePrecision: day`, while the state is `awaiting-answers`, with their
  `proposed-values` alert and no new `task-status`. Her answer dates the values anchored on that page only.
  `counts.proposed` counts the values read that are proposed once their page is dated; `counts.questions` counts each
  `which-page-date`.
- **Never a date for the whole document.** On a document with a `which-page-date`, the contact asks no `which-date`. A
  page whose day the contact holds certain (printed on it in its text layer, or a page it holds to continue such a page)
  has its values proposed with that day in `proposal.time`; any other page that holds result lines is asked. Her app
  takes a value's day from `proposal.time` only (§ Writing a value).
- **A page not dated** (she answered `skip`): the contact proposes none of its values, sends the notice `pages-not-read`
  once for the document, and no longer waits for that question; `done` waits for every other. While the question exists, a
  later `confirm` counts as a first answer. At `done` the question is deleted, answered or skipped (R10).
- **She changes the day.** Until a value of the page is in a `written`, a later `confirm` replaces the earlier: the contact
  deletes the page's candidates that are not written and proposes them again with the new day. Once one is written, a
  later answer changes nothing.
- **One candidate per record.** The record of R5 is the attachment, the page, the printed line (`section` and `label`)
  and the `itemKey`, never the day; before writing a candidate, the contact deletes the candidates of the same record
  under another `candidateId` that are not written, and writes none for a record that has a `written` entry.
- Never on a dated grid or a table read per column. `not-mine` stays the whole document's, on `is-this-yours` only.

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
| `which-document-kind` (4.26.0) | MUST: a `proposed-document` | MUST: 2 to 8 `documentKinds` keys | none | `choose` (+ `option`), `skip` |
| `which-document-date` (4.26.0) | MUST: a `proposed-document` | none | `dates?` | `confirm` (+ `timePrecision`, `time` unless `unknown`), `skip` |
| `which-row-date` (4.36.0) | none | none | MUST: `grid` and `anchor`, only | `confirm` (+ `time`, `timePrecision: day`), `skip` |
| `which-column-date` (4.39.0) | none | none | MUST: `column` and `anchor`, only | `confirm` (+ `time`, `timePrecision: day`), `skip` |
| `which-page-date` (4.49.0) | none | none | MUST: `anchor`, only | `confirm` (+ `time`, `timePrecision: day`), `skip` |

- `context.identity` appears on `is-this-yours` only, `context.anchor` on `is-this-yours`, `which-row-date`, `which-column-date`
  and `which-page-date` (4.49.0) only, `context.grid` on `which-row-date` only (4.36.0), `context.column` on `which-column-date` only (4.39.0), `context.dates` on
  `which-date` and `which-document-date` only. The
  anchor of `is-this-yours` points at where the identity block is printed, for her app's anchored view of her own copy of the document;
  a date points at where it is printed with its own `context.dates[].anchor` (4.47.0).
- **A date not copied from a text layer** (read by a model, on a picture) carries `anchor`, with its `bbox` and
  `eventId` = `about` (4.47.0): her app shows it with the crop of her own copy, so she checks the date against the page
  before she picks it. A date without one is not offered: the contact leaves it out of `context.dates`. A date copied
  from a text layer may carry one. An app that does not know `dates[].anchor` shows the date as before (R8).
- `which-date` is asked only when no sampling date is certain and at least one proposed value waits for a date.
- **`is-this-yours` is answered by her app on a match.** The contact holds no profile of hers, so it cannot tell a
  match: a contact that reads values typically asks `is-this-yours` for each document it reads; her app answers it without a tap when the printed identity matches her
  profile or one of her other names (§ R3, `basis: profile-match`), so she is asked only on doubt (no match, or no
  identity printed). On a picture, the contact reads no name (§ R7): the question carries the identity block's box in
  `context.anchor` and no `identity`, and she answers it by tap.
- A picked `day` from `context.dates` becomes `time` at 12:00 UTC with `timePrecision: day`
  ([PARTIAL-DATES.md](PARTIAL-DATES.md)).
- **An answer to a question writes no value.** The contact answers a `choose` on `which-specimen`, `which-unit` or
  `which-analyte` (and on `is-fasting` when fasting changes the item) with a new `proposed-value`, a new
  `candidateId` carrying `replaces` = the candidate the question was about, which she confirms like any other. Once a
  replacement exists, the replaced proposed value is shown as not confirmable. An answer to `which-date` or
  `is-this-yours` settles that question only. One to `which-row-date` writes nothing: the contact then proposes the row's values; one to `which-column-date`, the column's; one to `which-page-date`, that page's. An answer to `which-document-kind` or `which-document-date` writes
  nothing either: it supplies a field of its `proposed-document`, written when she confirms that one.

### Specimen codes

The options of `which-specimen`, registered here (4.26.0). Her app labels them; an unknown option is not selectable
(R8). They name the specimen of the item's stream (BLOOD-CHEMISTRY.md: specimen is part of the item key), never a
printed text.

| Code | en | fr | es |
|---|---|---|---|
| `serum-plasma` | Serum or plasma | Sérum ou plasma | Suero o plasma |
| `whole-blood` | Whole blood | Sang total | Sangre total |
| `citrated-plasma` | Citrated plasma (coagulation) | Plasma citraté (coagulation) | Plasma citratado (coagulación) |
| `rbc` | Red blood cells | Globules rouges | Glóbulos rojos |
| `urine` | Urine | Urine | Orina |
| `urine-24h` | 24-hour urine | Urines de 24 heures | Orina de 24 horas |
| `semen` | Semen | Sperme | Semen |
| `csf` | Cerebrospinal fluid | Liquide céphalorachidien | Líquido cefalorraquídeo |
| `stool` | Stool | Selles | Heces |
| `saliva` | Saliva | Salive | Saliva |

### Answers, by what they answer

| The answer is to | `action` | With |
|---|---|---|
| a proposed value | `confirm`, `correct`, `skip`, `request-item` (a kept-aside or unmapped one, never `not-read`), `duplicate` | `candidateIds`; `written` with `confirm` and `correct`; `basis: existing-value` only on an automatic `duplicate` (§ R3) |
| a `which-specimen`, `which-unit`, `which-analyte` or `is-fasting` question | `choose` | `option`, one of the question's `options`; `candidateIds` naming the question's `candidateId` |
| a `which-date` question | `confirm` | `timePrecision`, and `time` unless `timePrecision` is `unknown`; `candidateIds` naming the question's `candidateId` when it has one |
| an `is-this-yours` question | `confirm` or `not-mine` | `basis: profile-match` only on an automatic `confirm` (§ R3) |
| a `proposed-document` | `confirm`, `correct`, `skip` | `candidateIds` naming it; `applied` (the fields her app wrote, `time`, `kind`) with `confirm` and `correct`, never `written`; `basis: not-pending` only on an automatic `skip`, when none of its fields is still pending on the document (§ Writing a document's date and kind) |
| a `which-document-kind` question | `choose` | `option`, one of the question's kind keys; `candidateIds` naming its `proposed-document` |
| a `which-document-date` question | `confirm` | as for `which-date`; `candidateIds` naming its `proposed-document` |
| a `which-row-date` question | `confirm` | `time` (12:00 UTC of the day of the question's box) and `timePrecision: day` |
| a `which-column-date` question (4.39.0) | `confirm` | `time` (12:00 UTC of the day printed above the question's column) and `timePrecision: day` |
| a `which-page-date` question (4.49.0) | `confirm` | `time` (12:00 UTC of the day she gives for the question's page) and `timePrecision: day` |

Any question, proposed value or proposed document may be answered with `skip`, which settles nothing. `not-mine` is
always about the whole document and answers `is-this-yours` only. An answer whose `action` is not in this table for
what it answers is ignored: never a confirmation, never a `not-mine`.

### Her note (4.26.0)

She may comment on what she answers by typing: her app puts the text in the answer's `note`, on any action. A comment
alone is a `skip` with a `note`, `inReplyTo` the item she comments on, and has every effect of a `skip`: the item is
set aside, may leave nothing waiting, and is deleted at `done` (R10). Her app says so before sending it; a later
`confirm` still counts while the item exists.

- **Plain text, at most 1000 characters,** hers. It never changes the action's meaning: a `note` that says "yes" on a
  `skip` is still a `skip`, and no app or contact reads a decision from it.
- **On `sent` only.** It travels in no alert (R6), and the contact never echoes it, in an item, an alert or a chat
  message. A contact that does not read notes says so once per document, with the notice `note-not-read`.
- **Removed after `done`.** Her app removes `note` from an answer (an `events.update` of the answer, writing nothing
  else) once a `task-status` `done` of the contact for the document is later than the answer, whatever status follows that
  `done` (the document shared again, then read or on hold); when the contact's latest `task-status` is `done` and not later
  than the answer (a proposed document answered after the work), or on `not-mine` and on `document-unshared`, 24 h after
  the answer, so the contact may read it first (R10). An answer written while the work is in progress again waits for the
  next `done`. A `task-status` `error` still the contact's latest status 24 h after it was sent (the alert's `time`) ends
  the work for her notes, as a `done` does: each answer's own 24 h then applies, and a later status supersedes the error
  (R4). So a contact still retrying posts a status within 24 h of its error, or her notes are removed for good. Answers
  are ordered by `created`:
  an answer's `modified` never matters (R3, R4). The removal assumes the platform keeps no event history; where it
  does, the note stays in it.
- Her app shows that the contact reads it, as for the chat (§ Chat).

**Which answer settles a proposed value.** A `written` entry (from a `confirm` or `correct`) settles it for good.
Otherwise the latest answer that counts decides. A `duplicate`, automatic or tapped, may therefore be followed by a
`confirm` or `correct` that adds the value anyway; that is the only case of a second answer settling a candidate (R5:
an answer counts once per `candidateId` until a `written` entry ends it).

**`correct`.** Her app writes the value as she corrected it (on any type and item the pack allows, § R9) with
`hdsExtraction.corrected: true`. The answer carries exactly one `candidateIds` entry and its `written` entry: the
contact learns that its reading was changed, never to what. Corrections stay on her account.

### What a writer MUST include

The schema cannot express conditions between fields, so writers check them before writing:

| When | The event MUST |
|---|---|
| any `answer` to a proposed value or a proposed document, or to a question with a `candidateId` | carry `candidateIds`, naming the answered item or the question's candidate |
| `answer` with `action: choose` | carry `option`, one of the question's `options` |
| `answer` with `confirm` or `correct` on a proposed value | carry `written`, one entry per candidate whose value her app wrote; `correct` covers exactly one candidate |
| `answer` with `confirm` or `correct` on a proposed document | carry exactly one `candidateIds` entry and `applied`, the fields her app wrote; no `written` |
| `answer` with any other action, or to a question | carry no `written` and no `applied` |
| `answer` to a `which-date` or `which-document-date` question | carry `timePrecision`; `time` unless `timePrecision` is `unknown`, and then no `time` |
| `answer` with `basis: profile-match` | be a `confirm` on an `is-this-yours` question (§ R3) |
| `answer` with `basis: existing-value` | be a `duplicate` on proposed values, each one already in her record (§ R3, § A value she already has) |
| `answer` with `basis: not-pending` | be a `skip` on one proposed document none of whose proposed fields is pending on the document (4.26.0) |
| `question` | follow its row of § Question codes (`candidateId`, `options`, `context`) |
| `question` or `answer` with a `candidateId` | name a `proposed-value` (or, for the two document codes and an answer to a proposed document, a `proposed-document`) of the same document on the same relationship's `received` child |
| `question` with `context.identity` | be `is-this-yours`; with `context.anchor`, be `is-this-yours`, `which-row-date`, `which-column-date` or `which-page-date`; with `context.dates`, be `which-date` or `which-document-date` |
| `question` with `context.dates` (4.47.0) | list a date not copied from the document's text layer only with its `anchor`, and that anchor's `bbox`; leave a date with no box out; such a date carries no `label` (its `role` says what it is, the crop shows the printed label) and a `text` holding only the date as read |
| `question` `is-this-yours` (4.47.0) | carry `context.identity` only when copied verbatim from the document's text layer; otherwise none, and `context.anchor` with its `bbox` (the identity block) when the contact located it |
| `question` `which-row-date` (4.36.0) | carry `context.grid`, and `context.anchor` with its `bbox`; be the only one of its document for that attachment, page and `grid.row`; be on a document with no `which-date` question |
| `question` `which-column-date` (4.39.0) | carry `context.column`, and `context.anchor` with its `bbox`; be the only one of its document for that attachment, page and `column.index`; be on a document with no `which-date` question |
| `question` `which-page-date` (4.49.0) | carry `context.anchor` with `attachmentId` and `page`, and no other context; be the only one of its document for that attachment and page; be on a document with no `which-date`, `which-row-date` or `which-column-date` question |
| `proposed-value` on a document with a `which-page-date` question (4.49.0) | carry `anchor` (`attachmentId`, `page`), never `grid` or `column`; when it has a `proposal`, `proposal.time` at 12:00 UTC with `hdsTimePrecision: day`; on an asked page, be written only after her `confirm`, with her day |
| `proposed-value` on a document with a `which-row-date` question, `not-read` apart | carry `grid` and `proposal.time`, at 12:00 UTC with `hdsTimePrecision: day` |
| `proposed-value` on a document with a `which-column-date` question | carry `column`, never `grid`; when it has a `proposal`, `proposal.time` at 12:00 UTC with `hdsTimePrecision: day` |
| `answer` to a `which-row-date`, `which-column-date` or `which-page-date` question with `confirm` | carry `time` at 12:00 UTC and `timePrecision: day` |
| `proposed-value` with reason `not-read` (4.36.0) | have `status: unmapped`, carry `grid` and `anchor` with its `bbox`, and no `printed.value`, `proposal` or `requestKey` |
| `proposed-value` with any other reason, or none | carry `printed.value` |
| `proposed-value` or `proposed-document` with `replaces` | name an item of the same kind and the same document on the same child, not written (no `written` entry, no answer with `applied`); for a proposed value, one the person answered a question about |
| `proposed-value` or `proposed-document` with `anchor`, `question` with `context.anchor` (from 4.25.0) or a `context.dates[].anchor` (4.47.0) | carry `anchor.eventId` = `about` (PROVENANCE.md, a self-contained anchor) |
| `proposed-document` | carry a `proposal.documentKind` that is a `documentKinds` key of the pack, not deprecated; `proposal.time` at 12:00 UTC at the start of its period; be the only unanswered one of its contact for the document; be written only while the document's `hdsDocumentPending` holds at least one proposed field |
| `which-document-kind`, `which-document-date` question | be asked only while the document's `hdsDocumentPending` holds `kind`, `time` respectively |
| `answer` with `note` | carry nothing of the note anywhere else (an alert, another field) |
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
| `task-status` | contact → person | `about`, `status` (`received`, `reading`, `on-hold` (4.33.0), `awaiting-answers`, `done`, `error`), `attempt` (from 1, a label), `counts?` (`proposed`, `questions`, `keptAside`, `dropped`, `notRead` (4.36.0)), `errorCode?` (with `error`, MUST) |
| `notice` | contact → person | `code`, `about?` (a document event id) |
| `question` | contact → person | `eventId` (the question event), `about` |
| `proposed-values` | contact → person | `about`, `count` (from 1): a wake-up, her app lists the `received` child by `about` and never trusts `count`; also sent for a `proposed-document` (4.26.0), counted in `count` (the fixed words are not rendered, R12) |
| `answer` | person → contact | `eventId` (the answer event), `inReplyTo`, `about` |

### Notice and error codes

Codes, never text. As for question codes, bare codes are HDS's and a third party's own start with `x-<vendor>-`; an
unknown code is shown with a generic text.

| `notice.code` | `about` | Meaning |
|---|---|---|
| `no-result-found` | the document | The contact read the document and recognised no result line: nothing is proposed, no question is asked, the work ends `done` with zero counts. Not "not a lab report": a scan in which no line was recognised has none either. A read that failed is the error `reading-failed`, not this notice. |
| `several-sampling-dates` | the document | The document prints its results for several sampling days, one value column per day (a cumulative report), and the contact proposes no value from it: it does not tell which value was taken which day. Nothing is proposed, no question is asked, the work ends `done` with zero counts. Sent instead of `no-result-found`, never both for one read. A contact that reads each column under its own day sends neither. Not `which-date`, which asks for the one day all the waiting values share. The notice names no date (R6). Before 4.45.0 also sent for `several-result-columns`. |
| `several-result-columns` | the document | The document prints its results in several value columns, and the contact tells fewer than two sampling days apart (two samples of one day with no time or sample number that differs, or columns with no heading), so it proposes no value from them (4.45.0). Nothing is proposed, no question is asked, the work ends `done` with zero counts. Sent instead of `no-result-found` and `several-sampling-dates`: one of the three per read, `several-sampling-dates` when two days or more are told apart. On a document with a `which-column-date` question, or read per column, `columns-not-read` is sent instead, also when no column is proposed. The notice names no date and no time (R6). |
| `columns-not-read` | the document | A table read column by column on a picture (4.39.0): at least one result column is not proposed (she skipped its `which-column-date`, her day is not the day read, or the contact could not read that column on its own). The other columns' values stand. Once per document. The notice names no date and no column (R6). |
| `pages-not-read` | the document | A document read page by page (4.47.0): at least one page of the document was not read (the contact could not read it, or could not date it, or she skipped its `which-page-date`, 4.49.0), and its values are not proposed. The other pages' values stand. Also sent when no page's value is proposed; `no-result-found` is then not sent. Once per document. It does not end the work. The notice names no page and no date (R6). `columns-not-read` stays for the columns of a table read per column. |
| `lines-may-be-missing` | the document | Values read from a picture (4.45.0), a dated grid apart: the contact has evidence that the page prints more result lines than it read (proposed, kept aside and dropped lines alike), so a line may be missing from what is proposed. The proposed values stand, each with its own status; she compares them with her document. Sent once per document, with or after its first `proposed-values` alert; never on a read that writes no proposed value. A dated grid says this box by box with `not-read`, never with this notice. The notice names no line and no count (R6). |
| `grid-not-located` | the document | The document is, or may be, a dated grid (a paper cycle chart), and the contact cannot locate its grid with certainty (cut above its first row or beside a column, folded, partly hidden, or its kind in doubt), so it reads nothing of the document (4.45.0; `no-result-found` before). Nothing is proposed, no question is asked, the work ends `done` with zero counts. Sent instead of `no-result-found`. Her app's text never says the document is a chart; when it is one, a clearer picture of the whole grid, shared again, may be read. |
| `kind-not-read` | the document | The contact recognises the kind of the document and does not read that kind (4.45.0): nothing is proposed, no question is asked, the work ends `done` with zero counts. The kind is what the document is, not its file type (`no-attachment`). It may still propose the document's kind (§ A document's date and kind). It promises nothing about when or whether it will. Not `on-hold` (the contact reads that kind and cannot work now), not `no-result-found` (it read the document and found no result line). A contact that does not read dated grids sends this or `no-result-found`, never `grid-not-located`. The notice names no kind (R6). |
| `typed-text-not-read` | none | The contact does not read typed text (§ Chat). At most one per relationship per 24 h. |
| `note-not-read` | the document | The contact does not read her notes (§ Her note, 4.26.0). At most one per document. The notice names no text of the note (R6). |
| `ready` | none | The contact is ready to read the documents she shares in this conversation (4.27.0). Sent once per relationship, right after the contact receives her accept (a contact that starts sending it later sends it once to each relationship it already has). Optional: a contact that does not read documents does not send it. To know it sent one, the contact keeps a marker per relationship: the relationship id and the fact, nothing else, deleted when the relationship ends (R10). |

**A notice speaks of one read.** A notice about a document is about the read it was sent in: her app shows it only when
it is not earlier than the contact's latest `task-status` `received` about that document (4.45.0). A document shared again
and read again keeps none of the earlier read's notices.

**Rendering `ready`.** Her app shows it at its place in time (the first message of a new relationship), as a fixed
text with the contact's name ([APP-DESCRIPTION.md](APP-DESCRIPTION.md) § The rule), for example en "{name} can read
your documents: share one in this conversation", fr « {name} peut lire vos documents : partagez-en un dans cette
conversation ». When the app holding the relationship is `vouched`, it adds the app's `description` as that rule gives
it (the catalogue entry's, else the vouched manifest's), in her language, else `en`. An `unvouched` manifest's
description is never shown here. Like every notice, it carries no text of the contact's (R6, R12); her app shows only
the first `ready` of a relationship. An app that does not know the code shows the generic notice text (R8).

| `task-status.errorCode` | Meaning |
|---|---|
| `no-attachment` | The shared document has no attachment, or none of a type the contact reads. Not retried. |
| `write-failed` | The contact could not write its items on the person's account. |
| `reading-failed` | The document has an attachment of a type the contact reads, but fetching or reading it failed. The contact retries on its own: a later `task-status` (another `attempt`) supersedes the error (R4), and the person has nothing to do. The error stands once the contact stops retrying. A contact still retrying posts a status within 24 h of the error: past that, the error is final for her notes (§ Her note). |

## Rules

**R1. Everything points at its document.** Every `message/hds-conversation-v1` event carries `about` and
`clientData.related.<about>: true`; every event id in content (`inReplyTo`, `written[].eventId`) is mirrored in
`clientData.related` ([PROVENANCE.md](PROVENANCE.md#clientdatarelatedeventid--a-link-to-another-event)).

**R2. The child decides who wrote it.** A `question`, `proposed-value` or `proposed-document` counts only on the
relationship's `received` child; an `answer` counts only on its `sent` child. A reader ignores any other kind found on a child, and any item of
this type outside the relationship's two children.

**R3. Nothing is written before an answer, and an answer binds to what was shown.**
- Her app writes a value only for a proposed value she answered with `confirm` or `correct`, and only once every
  `is-this-yours` question of the document has a `confirm` answer (when one was asked) and the value has a date (its
  `proposal.time`, or her answer to `which-date`). `not-mine` writes nothing from the document.
- **A proposed document** changes nothing on the document before her `confirm` or `correct`, and only its fields still
  pending (§ Writing a document's date and kind). It needs no `is-this-yours` (it is about her document, not about
  her), and is refused once the document is `not-mine`.
- A proposed value, a proposed document or a question that has an answer is never updated (R5 says when a re-read
  writes a new one).
- An answer covers `inReplyTo`, each of its `candidateIds`, and the question's `candidateId`. It is void when any event
  it covers was modified after the answer was created (that event's `modified` is later than the answer's
  `created`). Just before writing, her app re-reads what an answer covers and does not write if one changed since it
  was shown.
- A batch answer's `inReplyTo` is the first proposed value of the batch; its `candidateIds` lists every one, that one
  included.
- **`basis: profile-match`** (an answer her app gave without a tap): only with `confirm` on `is-this-yours`, and only
  when all hold after normalisation (case, accents, hyphens, commas and spaces, order of given and family name): the
  full given name and the full family name both equal her profile's, or those of one of her other names (4.47.0, below)
  (an initial or a missing given name never matches), and `context.identity.birthDay` is present and equal to her
  profile's birth date. A profile without a birth date is never matched. At most one `profile-match` answer per
  document; the card says "matched to your profile" and offers `not-mine` until the work is `done`; the latest
  `is-this-yours` answer wins. A `not-mine` after values were written: her app deletes them, from the `written` entries
  of the document's answers. An unknown `basis` is never a confirmation.
  - **Her other names (4.47.0).** Each `other-name` event of hers (`contact/other-name-v1`, on the `other-names` root,
    [PROFILE.md](PROFILE.md#other-names-4460)) gives one more pair to compare, normalised the same way: its `given`, else
    her profile's given name, with its `family`, else her profile's family name. A part that is empty after
    normalisation never matches. An other name whose `use` is `nickname`, or a `use` her app does not know, never
    matches; one without `use` does. The birth date condition is unchanged. The contact never reads her other names
    (the match needs no grant on that root; once the production `*` accesses are masked for it, PROFILE.md § Other
    names, no grant on `profile` or `*` reaches it either) and never learns which name matched: the answer is the same
    `confirm` with `basis: profile-match`.
  - **"Remember this name".** After her own `confirm` (a tap, no `basis`) on an `is-this-yours` whose printed name
    matched none of her names, her app may offer to save that name as an other name, for her to accept or change.
    Never automatically, and nothing of it reaches the contact.
- **`basis: existing-value`** (also without a tap): only with `duplicate`, on proposed values her app would offer to
  confirm (an open candidate, a confirmable `status`, a proposal R9 accepts from a vouched engine), each already in
  her record (§ A value she already has), and only while no `is-this-yours` of the document is open or answered
  `not-mine`. Her app answers it for any contact's proposed values, never for one contact only. Each comparison run
  writes one answer: `inReplyTo` the first matched candidate, `candidateIds` every matched one (as a batch answer
  above). It writes nothing.
  - **What the contact learns.** That she already holds a value equal to each of those candidates, never which event
    or its value. This is a disclosure about her record to a contact she shares the document with, hence the
    restriction to confirmable proposals of a vouched engine. (From 4.26.0 her app links the matched event to the
    document with `hdsPrintedIn`, on that event, which the document's readers do not see: § Writing a value.)
  - **What she sees.** Her app shows these values as already in her record, from the answer's `candidateIds` (her
    answers stay on `sent`), and offers to add each one anyway while its proposed value exists, that is until the
    work is `done`: a later `confirm` or `correct` writes it (§ Answers, which answer settles a proposed value).
  - **The contact** treats it as any `duplicate`: the value is settled, and deleted at `done` (R10). With every value
    of a document matched, nothing waits and the work may end at once.
- **`basis: not-pending`** (4.26.0, also without a tap): only with `skip` on a proposed document none of whose
  proposed fields is still pending on the document (she set them, or confirmed another contact's). It writes nothing
  and tells the contact nothing it cannot read on the shared document; the contact deletes the proposal (R10).

**R4. The state of the work is the latest `task-status`** of the document by alert `time`; `attempt` labels it and
breaks a tie, never orders it (the contact deletes its alert copies, R10, so after a restart it may not know the last
attempt). Alerts are immutable; a contact that restarts re-derives its pending work from the person's account (its
items on `received`, her answers on `sent`).

**R5. Idempotency is per `candidateId`.** The contact derives `candidateId` deterministically from the document, the
record and the proposal: the same on every re-read while the proposal is the same, a new one only when it differs
(PROVENANCE.md, "same source record, same key"). It is opaque, never parsed. On a re-read, an unanswered candidate is
written again in place; a candidate found in an answer's `written` is never proposed again (this is why her answers
stay on `sent`). An answer counts once per `candidateId`, until a `written` entry settles it (§ Answers). The record
includes the column of a report printing one value column per day: two columns of one row are two candidates, even
with equal values on one day. In a dated grid it is the box and the item (4.36.0). The contact knows a candidate is written from
`answer.written`; her app knows it from the value's `sourceKey` (§ Writing a value). A `proposed-document`'s
`candidateId` derives from the document, its attachment and the proposal, the same way.

**R6. Never over CMC.** No alert, no chat message of the contact and no alert `title` or `body` carries a value, a
printed line, a name, a birth date, a date or a time of the document, an item key, a document kind, a stream id, free
text from a model or her `note`. They
carry kinds, event ids, codes and counts. What the document prints is only on the person's account: in
`proposed-value.printed`, `question.context`, and the values her app writes.

**R7. Some lines never become items.** Identity fields, a practitioner's name, administrative and other non-clinical
lines, a printed interpretation, a result in a special category (genetics) the person has not asked for, and lines
about another person are dropped before anything is written, and only counted in `task-status.counts.dropped`, never
split by reason (a count per category would say that a genetic result exists). The printed name and birth date appear
only in `context.identity` of an `is-this-yours` question, copied verbatim from the document's text layer, never
produced or completed by a model; no other identity field (address, insurance or patient number, sex, age,
practitioner) is carried anywhere. On a document read without a text layer (a picture), no model reads the name or the
birth date: the contact's `is-this-yours` carries no `identity`, only the identity block's box in `context.anchor`
(4.47.0), and her app shows her the crop. `context.dates` carries dates, their labels and, for a date not copied from
a text layer, its anchor (4.47.0), never the birth date or a person's name; a date not copied from a text layer carries
no `label`, and its `text` holds only the date as read. Apps render both as plain text.

**R8. Writers validate, readers dispatch.** A writer validates every event against this type, and every alert's `hds`
against `hds-conversation-alert.json`, before writing. A reader never validates on read: it dispatches on `kind`,
reads the fields it knows, ignores the rest, and skips a kind it does not know. New kinds, fields and enum values are
additive (a minor release); a breaking change is a `-v2` type. A value a reader does not know falls back:

| Field | Unknown value is read as |
|---|---|
| `task-status.status` | in progress: not settled, nothing is confirmable yet (`on-hold` before 4.33.0) |
| `proposed-value.status` | shown, not confirmable |
| `reason` | a generic "not saved" (`not-read` before 4.36.0) |
| `question.code` (bare or `x-`) | shown, not answerable |
| `answer.action` | ignored by the contact, never a confirmation |
| `answer.basis` | never a confirmation; the answer does not count. On a `duplicate` with `existing-value`, a contact that does not know it sees the value still open and never reaches `done`, and an older app shows it open: a contact reads `existing-value` before any app sends it. `not-pending` comes only from a 4.26.0 app, on a proposed document only a 4.26.0 contact writes, and `done` never waits for it |
| `context.dates[].role` | `other` |
| `context.dates[].anchor` (a field, 4.47.0) | ignored: an app before 4.47.0 shows the date as before, without its crop; her app shows the crop before any contact lists such a date (release order: forms and the webapp, then the engine) |
| `proposal.clientData.hdsComparator` | the proposal is not confirmable |
| `timePrecision`, `proposal.clientData.hdsTimePrecision` | absent |
| `proposal.clientData.hdsInterpretation` | absent |
| `notice.code`, `task-status.errorCode` | a generic text |
| an option code (`question.options`) | not selectable |
| `proposed-document.proposal.documentKind` | the proposal is not confirmable |
| `answer.note` | ignored by a contact that does not read notes (it may send `note-not-read`); never an action |
| `answer.applied` | a field name it does not know is ignored; the answer still settles its proposed document |
| a kind (`proposed-document` before 4.26.0) | skipped: an older app shows nothing, and the contact does not wait for it |

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
- **A proposed document** is checked too: `proposal.documentKind` is a `documentKinds` key of the pack, not deprecated;
  `about` is a `file/xds-v1` event shared in this relationship (R11), not trashed, and at least one of the proposed
  fields is still in its `hdsDocumentPending`. No engine binding applies (§ A document's date and kind). One that
  fails is shown as not confirmable.

**R10. Retention.** The items are the person's, on her account; the contact keeps nothing beyond the work on a
document. Deleted means deleted (twice), not only trashed.
- **On her account, the contact deletes** (it holds `contribute` on `received`), once the work on a document is `done`:
  the proposed values whose candidate is in an answer's `written`, those answered `skip`, `duplicate` or
  `request-item`, those replaced (`replaces`), and the questions answered (a `which-row-date`, `which-column-date` or `which-page-date` answered or skipped). An `is-this-yours` question carrying
  `identity` is deleted on `not-mine`, on `document-unshared` and when the work is `done`, whatever else stays. A
  kept-aside value stays until she dismisses it or its item ships; offering it again means reading the document again
  (it must still be shared). A `not-read` one stays until she answers it (4.36.0);
  the contact keeps reading her answers about it until it is gone. In a dated grid, the contact also deletes at once the
  candidates, not written, that it supersedes (§ A dated grid).
- **A `proposed-document`** is deleted by the contact once answered (an answer whose `inReplyTo` is it) with
  `confirm`, `correct`, or `skip` with `basis: not-pending`, or once replaced, whenever that happens, and the
  `which-document-kind` and `which-document-date` questions about it with it. An unanswered one, or one she skipped
  herself, stays after `done`: she may confirm it later. The contact keeps reading her answers about it until it is
  gone.
- **`not-mine`, `document-unshared` and a document gone win over everything above:** every item of that document is
  deleted, kept-aside values included.
- **Her answers** stay on `sent` until the relationship ends: they carry ids, codes and her date only, once her app
  has removed her `note` (after `done` or a final `error`, or 24 h after the answer, § Her note).
- **On the contact's account**, the delivered copies of the conversation alerts and of her chat messages, and its own
  copies of what it sent, are deleted once the work they are about is `done`, at the latest 24 h after they arrived.
  The `ready` marker of a relationship (its id and the fact, § Notice and error codes) is kept until the relationship
  ends.
- **After a revoke**, her app deletes both children (§ Where it lives); the contact deletes everything it still holds
  about the relationship.

**R11. Pointers resolve only inside the relationship.** A `question` alert's `eventId` is read only on the
relationship's `received` child, an `answer` alert's only on its `sent` child, and every `about` only among the
documents shared in that relationship (its `document-shares` `shared` child) or covered by its grant. A pointer that
resolves elsewhere is ignored: an alert never makes her app show any other event of her account. The same holds for
an item's anchor, and a date's: her app shows the anchored view from `about` only, and ignores an `anchor` whose `eventId` is not
`about` (it drops it, never rewrites it, when it writes the value).

**R12. The alert's words are fixed and not rendered.** Every conversation alert carries the fixed `title` and `body`
of its kind (the CMC plugin requires both), never anything about the document. Her app renders from `hds.kind`, never
from `title` or `body`; no app shows them in a notification list or a push notification.

## Writing a value

Her app writes each confirmed value as an ordinary event on its item, with her token:

- `streamIds`: the item's stream; `type` and `content`: the proposal's, or her correction; `time` and
  `clientData.hdsTimePrecision`: `proposal.time` and its `hdsTimePrecision`, or, when the proposal has no `time`, the
  `time` and `timePrecision` of her `which-date` answer about it or about the whole document (PARTIAL-DATES.md; with
  `unknown`, no `time`: the value is written at its recording moment). On a document with a `which-row-date` (4.36.0), `which-column-date`
  (4.39.0) or `which-page-date` (4.49.0) question, the day comes from `proposal.time` only: a proposed value without it is not confirmable, whatever
  `which-date` answer exists.
- `clientData.related.<document event id>: true`; `clientData.sourceKey` = `<engine>:document:<document event
  id>:<candidateId>` ([PROVENANCE.md](PROVENANCE.md#clientdatasourcekey--the-identity-of-an-imported-record)), so a
  retry finds it (`state: 'all'`; a trashed one is left trashed);
- the proposal's `clientData` keys (`hdsRefRange`, `hdsFlag`, `hdsInterpretation`, `hdsComparator`,
  `hdsTimePrecision`); `hdsSourceAnchor` = the proposed value's `anchor` when it has one, with `eventId` = `about`
  (set by her app when the contact left it out); `hdsSourceGrid` = the proposed value's `grid` when it has one and the
  anchor is written (4.51.0, [PROVENANCE.md](PROVENANCE.md#clientdatahdssourcegrid--the-box-of-a-dated-grid-4510)), also
  after her `correct`; only from `grid`: a value from a table read per column (`column`, an index from the left) or
  dated per page carries none, and `column` is never copied there;
  `hdsExtraction` = its `extraction` plus `confirmedBy: 'person'`, and
  `corrected: true` after a correction ([PROVENANCE.md](PROVENANCE.md#values-read-from-a-document-by-a-program)).

Order: re-read (R3), write the values (looking each `sourceKey` up first), write the `answer` with `written`, post the
`answer` alert. A retry after a failure finds the values by `sourceKey` and does not write them twice.

**The document lists them (4.26.0).** Then her app adds each value it wrote to the document event's
`clientData.hdsDocumentValues` with the role `source`
([PROVENANCE.md](PROVENANCE.md#clientdatahdsdocumentvalues--the-values-read-from-a-document)). It is an index,
written after the answer and best effort: a failure does not void the answer, and her app restores a missing entry on
its next write, from the `written` entries of the document's answers. When it deletes values (a `not-mine`), it
removes their entries.

**A value she already had (4.26.0).** For each event an automatic `duplicate` matched (§ A value she already has), her
app adds `clientData.hdsPrintedIn.<document event id>: true` to that event, after the answer and best effort
([PROVENANCE.md](PROVENANCE.md#clientdatahdsprintedineventid--a-document-that-prints-a-value-she-already-had)): the
document's view lists it as found in the document, not read from it. Nothing about it is written on the document,
which the contacts it is shared with read. On `not-mine`, her app removes the document from the `hdsPrintedIn` of her
events.

## Writing a document's date and kind (4.26.0)

When she confirms a `proposed-document`, her app updates the document event, with her token:

1. Re-read (R3): the `proposed-document` and the questions about it (their `modified` is the void test), and the
   document event for its pending fields and `content` (its own `modified` is not part of the void test: her index
   writes and share edits change it).
2. Take each field: from her `correct` when she changed it; else from the proposal; else from her answer to
   `which-document-kind` (`option`) or `which-document-date` (`time`, `timePrecision`) about it.
3. Keep only the fields still pending on the document (DOCUMENTS.md, a stale flag counts as not pending). With none
   left, write no update: answer `skip` with `basis: not-pending` instead (her app does this without a tap when it
   finds such a proposal).
4. One `events.update` of the document: the whole `content` with `class` and `type` replaced by the kind's Codings
   from the pack (`type` = `[kind.type]`, then `kind.detail` when it has one; the other fields of `content` as they are); `time` and
   `clientData.hdsTimePrecision` (with `unknown`, from her `which-document-date` answer: `time` stays the moment she
   added it, DOCUMENTS.md); `hdsDocumentPending` reduced by the fields written, `null` when empty. `streamIds`,
   `title`, `language`, `creation` and the attachments are not touched, and no `hdsExtraction` is written: the date and
   kind are her statement, and her answer on `sent` is the trace.
5. Write the `answer` (`confirm`, or `correct` when she changed a field) with `applied`, the fields written, and no
   `written` (a `written` entry is a value to delete on `not-mine`, never the document), then post the `answer`
   alert. The answer does not carry her correction; the document, which the contact reads, does.

**Filing is a second write (4.35.0).** When the screen she confirms on says where the document goes and who newly reads it,
her app also files it in the kind's `stream` ([DOCUMENTS.md § Filing](DOCUMENTS.md#filing-4350)), in a separate
`events.update` after step 4 that changes `streamIds` only: the two writes never race over a share id, and `applied` does
not list it. On any other screen, confirming a kind files nothing.

A retry finds the fields no longer pending and writes no second update. When the document already holds the values
this confirmation would write (the update went through, the answer did not), the retry writes the `confirm` (or
`correct`) with `applied`; `not-pending` is only for fields set by someone else. Her own edit of the document's date or kind
(her document viewer) removes that field from `hdsDocumentPending` the same way, so no contact's proposal overrides it.

## A value she already has

The comparison behind `basis: existing-value` (R3), the same for every contact. A proposed value is compared only
when its date is known at `day` precision: its `proposal.time` with `hdsTimePrecision: day`, or her `which-date` answer
at `day`. Day D is that UTC calendar day (the proposal's time is 12:00 UTC on it); a proposal at `month`, `year` or
`unknown` is never compared. It is already in her record when one of her events, not trashed, matches all three:

- **Same item:** on the stream of `proposal.itemKey`, of one of the item's types, and not written from this document
  by any engine (its `sourceKey` does not hold `:document:<about>:`), so a value she just added from the document never
  makes another of its values a duplicate.
- **Same day:**
  - her event at `day` precision: on UTC day D;
  - her event with an exact time (no `hdsTimePrecision`, or `minute`): in `[D 00:00 UTC − 14 h, D+1 00:00 UTC + 12 h)`,
    every instant at which day D is running in some time zone; with `clientData.hdsTimeZone`, on day D in that zone;
  - her event at `month`, `year`, `approx` or `unknown` precision never matches.
- **Equal value:**
  - **Same type:** equal content, numbers compared to 12 significant digits, and the same `hdsComparator` (absent
    equals absent). A content that is `null` equals one that is absent. A value of a convertible item (cervical fluid,
    mood) is equal by its method (`source.key`), reading (`source.sourceData`) and `source.annotations` (absent equals empty) and any other
    field, the `vectors`, `source.engineVersion` and `source.modelVersion` aside; with the method `_raw`, or without a method or a
    reading, the whole content is compared (4.36.0).
  - **Another type of the same item:** her value converted with the data model's conversions into the proposal's
    unit, then equal within a tolerance, with the same comparator. The tolerance is half a unit of the last digit
    printed in `printed.value`, taken in the printed unit and scaled into the proposal's by `proposal.content` divided
    by the printed number. `printed.value` is read as a plain number with one decimal separator, a comma or a point;
    anything else (text, a limit such as `< 5`, a thousands separator) never matches across types.
  - **`lab-result/coded-v1`:** an `analyte.codes` entry with the same `system` and `code`, and equal `content.value`,
    `content.unit` and `content.comparator` (absent equals absent), or an equal `content.valueText`. No conversion.

**One for one, per document.** Over one document, each of her events matches at most one candidate, so two equal
values of one day, two draws, stay two. Candidates already answered `existing-value` for the document keep the event
they matched (a later run, after a new batch (a row's values included), an `is-this-yours` confirmed or a late `which-date`, assigns only the events they leave). When an event
fits several candidates, it goes to the one on its own UTC day first, then the nearest in time, then the first in the
order of the candidates. Open candidates are never compared with each other. A contact may rely on this comparison: it need not hold back a value that the
person may already have.

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
3. Post `task-status` for every document it takes, `on-hold` when it cannot work on one now (§ The flow) (and,
   optionally, the notice `ready` once per relationship, keeping its marker, R10).
4. Write `proposed-value` and `question` events (and, optionally, one `proposed-document`) on the `received` child,
   validated against this type and following § What a writer MUST include (an anchor names its document:
   `anchor.eventId` = `about`), each followed by its alert, validated against `hds-conversation-alert.json`.
5. Read her answers on `sent`, and only there (R2); honour the binding and void rules (R3), and read an automatic
   `duplicate` (`basis: existing-value`) as settling its values. A contact that does not read her `note` says so once
   per document (`note-not-read`).
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
      "anchor": { "eventId": "ckq3w8n1x0001", "attachmentId": "ckq3w8n1x0001a", "page": 1, "bbox": [6, 8.2, 40, 4.5] }
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
    "anchor": { "eventId": "ckq3w8n1x0001", "attachmentId": "ckq3w8n1x0001a", "page": 1, "bbox": [8.5, 41.2, 83, 2.1] },
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

Her app's automatic answer, before she saw them, for two proposed values already in her record (§ A value she
already has); it writes nothing:

```json
{
  "streamIds": ["conv-p0w4e8r2t6y1"],
  "type": "message/hds-conversation-v1",
  "content": {
    "kind": "answer",
    "inReplyTo": "ckq3w8n1x0013",
    "about": "ckq3w8n1x0001",
    "action": "duplicate",
    "candidateIds": ["c-7a21d4c9", "c-90be3f12"],
    "basis": "existing-value"
  },
  "clientData": { "related": { "ckq3w8n1x0001": true, "ckq3w8n1x0013": true } }
}
```

A proposed date and kind for a document she added without them (4.26.0), on the `received` child:

```json
{
  "streamIds": ["conv-k3x9q2m7a1b0"],
  "type": "message/hds-conversation-v1",
  "content": {
    "kind": "proposed-document",
    "about": "ckq3w8n1x0001",
    "candidateId": "d-5c2e9a14",
    "proposal": { "documentKind": "laboratory-report", "time": 1773316800, "timePrecision": "day" },
    "anchor": { "eventId": "ckq3w8n1x0001", "attachmentId": "ckq3w8n1x0001a", "page": 1, "bbox": [62, 6.5, 30, 2.2] },
    "status": "clear",
    "extraction": { "engine": "hds-reader", "engineVersion": "0.4.0", "kbVersion": "0.4.0", "backend": "text-layer" }
  },
  "clientData": { "related": { "ckq3w8n1x0001": true } }
}
```

Her confirmation, after her app updated the document, with a comment:

```json
{
  "streamIds": ["conv-p0w4e8r2t6y1"],
  "type": "message/hds-conversation-v1",
  "content": {
    "kind": "answer",
    "inReplyTo": "ckq3w8n1x0014",
    "about": "ckq3w8n1x0001",
    "action": "confirm",
    "candidateIds": ["d-5c2e9a14"],
    "applied": ["time", "kind"],
    "note": "The follow-up blood test."
  },
  "clientData": { "related": { "ckq3w8n1x0001": true, "ckq3w8n1x0014": true } }
}
```

A dated grid (4.36.0): a row's question, a mark proposed once she answered, and a box not read:

```json
{
  "streamIds": ["conv-k3x9q2m7a1b0"],
  "type": "message/hds-conversation-v1",
  "content": {
    "kind": "question",
    "about": "ckq3w8n1x0002",
    "code": "which-row-date",
    "context": {
      "grid": { "row": 2, "column": 1 },
      "anchor": { "eventId": "ckq3w8n1x0002", "attachmentId": "ckq3w8n1x0002a", "page": 1, "bbox": [7.4, 22.4, 2.5, 12.9] }
    }
  },
  "clientData": { "related": { "ckq3w8n1x0002": true } }
}
```

```json
{
  "streamIds": ["conv-k3x9q2m7a1b0"],
  "type": "message/hds-conversation-v1",
  "content": {
    "kind": "proposed-value",
    "about": "ckq3w8n1x0002",
    "candidateId": "c-91be04d7",
    "printed": { "label": "14", "value": "P" },
    "anchor": { "eventId": "ckq3w8n1x0002", "attachmentId": "ckq3w8n1x0002a", "page": 1, "bbox": [40.6, 22.4, 2.5, 12.9] },
    "grid": { "row": 2, "column": 14 },
    "proposal": { "itemKey": "fertility-cycles-peak-day", "type": "activity/plain", "content": null, "time": 1773316800, "clientData": { "hdsTimePrecision": "day" } },
    "status": "check",
    "extraction": { "engine": "hds-reader", "engineVersion": "0.9.0", "kbVersion": "0.4.0", "backend": "bedrock:sonnet" }
  },
  "clientData": { "related": { "ckq3w8n1x0002": true } }
}
```

```json
{
  "streamIds": ["conv-k3x9q2m7a1b0"],
  "type": "message/hds-conversation-v1",
  "content": {
    "kind": "proposed-value",
    "about": "ckq3w8n1x0002",
    "candidateId": "c-0d55e1fa",
    "printed": { "label": "15" },
    "anchor": { "eventId": "ckq3w8n1x0002", "attachmentId": "ckq3w8n1x0002a", "page": 1, "bbox": [43.1, 22.4, 2.5, 12.9] },
    "grid": { "row": 2, "column": 15 },
    "status": "unmapped",
    "reason": "not-read",
    "extraction": { "engine": "hds-reader", "engineVersion": "0.9.0", "kbVersion": "0.4.0", "backend": "bedrock:sonnet" }
  },
  "clientData": { "related": { "ckq3w8n1x0002": true } }
}
```

The alerts of the flow, one per kind (written by the sender on its collectors stream; the words are the fixed ones
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

- Several pages or attachments bearing the same grid: a contact reads one.
- `text` and `optionLabels` on a question with an `x-` code (a third party's own question), reserved: plain text,
  `en` required, an option without a label not selectable.
- Corrected values to the contact (learning from corrections): a later opt-in.
- A contact answering typed text with a model.
- A per-relationship list of the items a contact may propose (R9 binds the engine only).

Tests: `tests/conversation.test.js` (`[CNV-*]`), under draft-04 (the cores) and draft-07.
