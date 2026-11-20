# HDS Reader: the dialogue, and the values it writes

> **Superseded (4.22.0).** The Reader is now a standard conversation counterparty: questions, proposed values and
> answers are `message/hds-conversation-v1` events in the relationship's children of `conversation-items`, pointed at
> by value-free alerts, and the person's app writes the values she confirms. The contract is
> [CONVERSATION.md](CONVERSATION.md). `message/hds-reader-v1` and the app tree below stay documented because demo
> accounts hold events of that type; no new writer uses them, and no migration is planned. The provenance keys
> (`hdsSourceAnchor`, `hdsExtraction`) are unchanged and used by both.

The HDS Reader is a service that reads values from a document the person sent it (a lab report photographed,
scanned or downloaded), asks her to confirm them, and writes the confirmed ones to her items. The model defines
three things for it:

| What | Where |
|---|---|
| The dialogue between the Reader and the person: one eventType, `message/hds-reader-v1` | this page |
| `clientData.hdsSourceAnchor` on each value written: where it is printed in the document | [PROVENANCE.md](PROVENANCE.md#clientdatahdssourceanchor--where-a-value-is-printed-in-its-document) |
| `clientData.hdsExtraction` on each value written: which program read it, and the role of who confirmed it | [PROVENANCE.md](PROVENANCE.md#clientdatahdsextraction--which-program-read-a-value-and-who-confirmed-it) |

The values themselves are ordinary events on their items, with the keys every importer writes: `related` to the
document, `sourceKey` with the `<tool>` `hds-reader` (PROVENANCE.md § sourceKey), and the lab keys of
[BLOOD-CHEMISTRY.md](BLOOD-CHEMISTRY.md) and [PARTIAL-DATES.md](PARTIAL-DATES.md). A result with no item of its own
is a `lab-result/coded-v1` event, as for any importer.

## Where it lives

All of it is on the **person's** account. In this version the Reader's streams form its own app tree, created by the
person's app when she connects the Reader, outside the clinical tree (AGENTS.md § 5, apps and health data live in
different dimensions):

```
hds-reader/                 the Reader's app base
├── hds-reader-inbox        documents sent to the Reader
├── hds-reader-dialogue     message/hds-reader-v1, this page
└── hds-reader-app/         the Reader's app streams (appStreams.yaml)
```

- **These are not model streams.** Like `bridge-mira` for the Mira bridge, the tree is the app's, so it is not in
  `definitions/streams`, and `appStreams.yaml` does not describe it: an app-stream suffix goes under the app's
  `{appId}-app` stream, while `hds-reader-inbox` and `hds-reader-dialogue` sit beside it. The ids are fixed: the
  Reader's grant and its webhooks name them.
- **A document is one event in two streams:** its `file/xds-v1` event in `documents` and in `hds-reader-inbox`
  ([DOCUMENTS.md](DOCUMENTS.md)). Removing it from `hds-reader-inbox` withdraws it from the Reader.
- **The Reader's grant:** `read` on `hds-reader-inbox`, `contribute` on `hds-reader-dialogue` and `hds-reader-app`,
  and nothing on the clinical tree until the person accepts a request to write a kind of data, then `create-only` on
  it. It never reads her clinical streams.
- **A grant on `hds-reader-dialogue` reads every value the Reader read**, kept-aside ones included. A CMC consent
  request with `streamId: '*'` and the FHIR facade expand `*` into the model's roots ([GENETICS.md](GENETICS.md#explicitgrantonly)),
  so they do not reach the app tree; only a directly minted access with a literal `streamId: '*'` does.

### Before the first production write

The dialogue's placement is a decision to take before the Reader writes on a production account: a top-level root
`hds-reader-dialogue` (same id) marked `explicitGrantOnly`, so that no `*` access of any kind reaches it, or the app
tree above. This version keeps the app tree. A child stream for the person's answers, on which the Reader holds only
`read` (so it cannot write or change an answer, rule 2), is evaluated at the same time.

The `explicitGrantOnly` root is **required** before production, not only preferred: rule 2's check is negative (an
answer counts when the Reader did not write it), so any other access holding a literal `*` with write rights (an
assistant connected through MCP, for example) could write an answer that counts as the person's.

## `message/hds-reader-v1`

One event per message on `hds-reader-dialogue`. `content.kind` discriminates; each kind is a closed object
(`additionalProperties: false`). Times are Unix seconds.

| `kind` | Written by | Content |
|---|---|---|
| `job` | Reader | `status` (`received`, `reading`, `awaiting-answers`, `awaiting-access`, `writing`, `done`, `error`), `attempt` (from 1), `engine`, `engineVersion`, `kbVersion`, `backend?` (the shapes of `hdsExtraction`), `counts?` (`readings`, `questions`, `written`, `keptAside`, `dropped`: integers), `errorCode?` (a code) |
| `notice` | Reader | `code`, `about?`: a message the app renders from its code |
| `reading` | Reader | `candidateId`, `printed` (`label`, `value`, `unit?`, `refRange?`, `flag?`, `section?`: the line as printed), `anchor?` (the shape of `hdsSourceAnchor`), `confidence?` (0..1), `proposal?` (`itemKey`, `type`, `content`, `time?`, `clientData?`: the event it proposes), `status` (`clear`, `check`, `unmapped`, `unit-missing`, `kept-aside`), `reason?`, `requestKey?`, `kbEntries?`, `askOneByOne?`, `specimenImplied?` |
| `question` | Reader | `code` (`which-specimen`, `which-unit`, `which-analyte`, `which-date`, `is-fasting`, `is-this-yours`), `about` (a `candidateId`, or `document`), `options?` (codes: a specimen, a UCUM code, an item key, `yes`, `no`; none for `which-date` and `is-this-yours`) |
| `answer` | the person's app | `inReplyTo` (the reading or question event), `action` (`confirm`, `correct`, `not-mine`, `skip`, `choose`, `request-item`, `duplicate`), `candidateIds?` (a batch), `option?` (with `choose`), `value?`, `eventType?`, `itemKey?` (with `correct`), `time?`, `timePrecision?` (`day`, `month`, `year`, `unknown`; with an answer to `which-date`) |
| `access-request` | Reader | `streamIds`, `level` (`create-only`) |
| `access-result` | the person's app | `inReplyTo` (the access-request event), `granted` |
| `written` | Reader | `candidateId`, `eventId` (the value event written) |
| `summary` | Reader | `written` (a count), `keptAside?` (`candidateId`, `reason`) |

`reason` is one of `no-item`, `unit-not-offered`, `no-coded-stream`, `timed-draw`, `implausible-value`,
`ambiguous-label`, `qualitative-result`, `derived-index`. `requestKey` is the key of the item request for a metric no
item holds yet (specimen and LOINC code, else specimen, language and normalised label tokens), so a kept-aside reading
can be offered again once its item ships. `proposal.clientData` and `timePrecision` take no `minute` (no time zone in
this version) and no `approx` (no `hdsTimeText`).

**`unmapped` and `kept-aside`** are both set by the Reader when it reads the line, never after an answer. `unmapped`:
the line was read but the Reader cannot say which metric it is, or why it does not fit (see `reason`). `kept-aside`:
the Reader names the metric (a `requestKey`), but no item can hold it yet, so the reading is kept for a later offer.
The person's `confirm` or `request-item` on a kept-aside reading is an answer like any other; the reading itself is not
changed.

### Answers, by what they answer

One encoding per case:

| The answer is to | `action` | With |
|---|---|---|
| a reading | `confirm`, `correct`, `skip`, `request-item` (a kept-aside or unmapped reading), `duplicate` | `candidateIds`; `value` (and `eventType?`, `itemKey?`) with `correct` |
| a `which-specimen`, `which-unit` or `which-analyte` question | `choose` | `option`, one of the question's `options`; `candidateIds` naming the candidate the question is `about` |
| an `is-fasting` question | `choose` | `option`: `yes` or `no` (the question's `options` are `yes`, `no`); `candidateIds` naming the candidate the question is `about` |
| a `which-date` question (no `options`) | `confirm` | `timePrecision`, and `time` unless `timePrecision` is `unknown`; `candidateIds` naming the candidate when the question is `about` one |
| an `is-this-yours` question (`about: document`, no `options`) | `confirm` or `not-mine` | nothing |

`not-mine` is always about the whole document: it answers `is-this-yours` and nothing else. Any question may also be
answered with `skip`. `skip` settles nothing: what the question is about stays unwritten. An answer whose `action` is
not in this table for what it answers is ignored: it is never a confirmation, and never a `not-mine`.

### What a writer MUST include

The schema cannot express conditions between fields, so writers check them before writing:

| When | The message MUST carry |
|---|---|
| any `answer` to a reading, or to a question about a candidate | `candidateIds`, naming the answered reading or the candidate the question is `about` (so `written` events join their answers once readings are deleted) |
| `answer` with `action: choose` | `option`, one of the question's `options` |
| `answer` with `action: correct` | `value` |
| `answer` to a `which-date` question | `timePrecision`; `time` unless `timePrecision` is `unknown`, and then no `time` (the Reader writes the value at its recording moment, PARTIAL-DATES.md § A date nobody knows) |
| `question` with `code: which-date` or `is-this-yours` | no `options` |
| `question` with `code: is-fasting` | `options` `yes`, `no` |
| `reading` with `status: kept-aside` or `unmapped` | `reason` |
| `proposal` with `time` | `clientData.hdsTimePrecision`; `unknown` only after the person answered `which-date` with `unknown` |
| `job` with `status: error` | `errorCode` |

**`correct`.** `value` is the number the person gives, on the scale of `eventType` (the proposal's when absent); for an
object content (`ratio/generic`, `lab-result/coded-v1`) it replaces `content.value`. The Reader validates the corrected
value, `eventType` and `itemKey` against the pack before writing (rule 10). `correct` carries a number only: a
corrected comparator (`<`, `>`) or a corrected coded unit has no field yet; a later field is additive.

### Rules

1. **Every message of a document points at it:** `clientData.related.<document event id>: true`. The ids in content
   (`inReplyTo`, `eventId`) are mirrored there too ([PROVENANCE.md](PROVENANCE.md#clientdatarelatedeventid--a-link-to-another-event)).
2. **An answer counts only when the person's app wrote it.** The Reader's `contribute` grant lets it write, change and
   trash any event of the stream, so a reader of the dialogue takes an `answer` or `access-result` only from an event
   whose `createdBy` and `modifiedBy` are not the Reader's access. The Reader never writes those two kinds. The
   person's app finds the Reader's access id in her list of accesses, which needs her personal token; the Reader
   finds its own through `access-info`.
3. **Nothing is written before an answer, and an answer binds to what was shown.**
   - A value event is written only for a reading the person confirmed, corrected, or chose an option for; it then
     carries `hdsExtraction.confirmedBy` (and `corrected: true` after a change of value, item or unit). `not-mine` on
     `is-this-yours` writes no value from the document.
   - Only an answer to the reading itself, or a `choose` on a `which-specimen`, `which-unit` or `which-analyte`
     question, confirms a value. An answer to `which-date`, `is-fasting` or `is-this-yours` settles that question only.
   - While a document's `is-this-yours` question has no `confirm` answer, no value from that document is written.
   - A reading that has an answer is never updated, and an answer never changes a reading: a re-read writes a new
     reading with a new `candidateId`.
   - An answer covers the readings named by its `inReplyTo`, by each of its `candidateIds`, and, for an answer to a
     question, the reading named by the question's `about`. It is void when any reading it covers was modified after
     the answer was created (that reading's `modified` is later than the answer's `created`).
   - Against a race, the person's app re-reads the readings an answer covers just before writing it, and does not
     write it if one's `modified` changed since it was shown.
   - A batch answer's `inReplyTo` is the first reading of the batch, and its `candidateIds` lists every reading it
     covers, that one included.
   - `document` is reserved for `about`; it is never a `candidateId`.
4. **The job state is the latest `job` event** of the document (append-only): a Reader that restarts re-derives its
   pending work from the account.
5. **Idempotency is per `candidateId`.** `candidateId` is derived by the Reader from the document and the record; it
   is opaque, never parsed. An answer counts once per `candidateId`; writes are idempotent through the Reader's own
   `written` events (under `create-only` it cannot read back what it wrote).
6. **`reading` carries what the document prints; `answer` may carry the corrected number; everything else is codes,
   ids and counts.** The person confirms what was read, so a reading holds the printed line. `summary` names kept-aside
   readings by `candidateId` only. No kind carries free text from a model: a `notice` is a code the app renders.
7. **Some lines never become readings.** Identity fields, a practitioner's name, administrative and other non-clinical
   lines, a printed interpretation, a result in a special category (genetics) the person has not asked for, and lines
   about another person are dropped before any message is written, and only counted in `job.counts.dropped`. That
   count is never split by reason: a count per category would say that a genetic result exists.
8. **No free text from the person in this version.** There is no `text` kind: a remark that is not one of the actions
   is not stored. A later kind is additive.
9. **Writers validate, readers dispatch.** A writer validates every message against this schema before writing it. A
   reader never validates on read: it dispatches on `kind`, reads the fields it knows, ignores the rest, and skips a
   `kind` it does not know. New kinds, fields and enum values are additive (a minor release of the model); a breaking
   change is a `-v2` type, both read during a transition. A value a reader does not know falls back:

   | Field | Unknown value is read as |
   |---|---|
   | `job.status` | in progress |
   | `reading.status` | shown, not confirmable |
   | `reason` | a generic "not saved" |
   | `question.code` | shown, not answerable |
   | `answer.action` | ignored by the Reader, never a confirmation |
   | `access-request.level` | not grantable; never treated as `create-only` |
   | `proposal.clientData.hdsComparator` | the proposal is not confirmable |
   | `timePrecision`, `proposal.clientData.hdsTimePrecision` | absent |
   | `proposal.clientData.hdsInterpretation` | absent |
   | `notice.code`, `job.errorCode` | a generic text |
   | an option code (`question.options`) | not selectable |

10. **The proposal is checked before it is shown, and before it is written.** The person's app validates
    `proposal.content` against `proposal.type` from the pack before showing or accepting it, and checks that
    `proposal.itemKey` is an item of the pack on that type. A proposal that fails is shown as not confirmable. The
    Reader checks the same, with any correction applied, before writing.
11. **Retention.** The dialogue is the person's, on her account; the Reader keeps nothing beyond a job. The Reader
    deletes while it holds its grant; after a revoke or a disconnect, the person's app deletes. Deleted means deleted,
    not only trashed.
    - Once a job is `done`, the readings whose candidate has a `written` event, and the skipped ones, are deleted. The
      `written` events carry no value and, joined to the answers by `candidateIds`, are enough for idempotency.
    - On `not-mine`, and when the document is trashed or leaves `hds-reader-inbox`, all the readings of that document
      are deleted.
    - A reading goes with the `correct` answers to it and the questions about it.
    - A deletion under these rules does not void an answer (rule 3 voids an answer on a *modified* reading only).
    - A kept-aside reading stays until the person dismisses it, or its item ships. Offering it again means reading the
      document again, which must still be in `hds-reader-inbox`, and writes a new reading; the document remains the
      source of truth.

### Example

```json
{
  "streamIds": ["hds-reader-dialogue"],
  "type": "message/hds-reader-v1",
  "content": {
    "kind": "reading",
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
    "kbEntries": ["alias.fr.ferritine"]
  },
  "clientData": { "related": { "ckq3w8n1x0001": true } }
}
```

A document-level question, with no `options`, and the person's answer:

```json
{
  "streamIds": ["hds-reader-dialogue"],
  "type": "message/hds-reader-v1",
  "content": { "kind": "question", "code": "is-this-yours", "about": "document" },
  "clientData": { "related": { "ckq3w8n1x0001": true } }
}
```

```json
{
  "streamIds": ["hds-reader-dialogue"],
  "type": "message/hds-reader-v1",
  "content": { "kind": "answer", "inReplyTo": "ckq3w8n1x0011", "action": "not-mine" },
  "clientData": { "related": { "ckq3w8n1x0001": true, "ckq3w8n1x0011": true } }
}
```

### Why one typed eventType

The dialogue is a contract between the Reader and every app that shows it, so its shape is the model's, versioned by
its suffix, rather than text in a chat message with structure on the side. It is not a CMC type: the CMC plugin
ignores it, so it never leaves the person's account (a CMC chat would store the Reader's messages, and the values in
them, on the Reader's account). CMC carries only value-free notifications to the person's inbox.

Tests: `tests/hdsReader.test.js` (`[RDR-*]`), under draft-04 (the cores) and draft-07.
