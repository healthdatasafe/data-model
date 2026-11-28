# Questionnaire — data-model side

This document describes what `data-model` ships for the **questionnaire request/answer event pair** introduced by Plan 71. It is the **data-model perspective** — what eventTypes exist, what storage shape they declare, what the cross-reference convention looks like.

The runtime mechanics — questionnaire renderer, scope-aware prefill via Pryv content queries, batched submit, appTemplates `Questionnaire` declaration — live in **`hds-lib`** and **`hds-forms-js`** (Plan 71 Phases C–E).

---

## Why this exists

HDS forms commonly mix three answer shapes:

- **Value-collection** ("body weight in the past week") — captured into existing typed events (`body-weight`, on `mass/kg` or `mass/lb`).
- **Observation-recall** ("your last cycle, ≤60 days") — surfaces existing typed events (`fertility-cycles-start`) for confirmation.
- **Assertion / exposure** ("did you take Progesterone in your life?") — yes / no / I-don't-know / I-don't-want-to-answer, optionally with a sub-qualifier (trimester, severity, etc.).

A clinical questionnaire is the natural container for all three. The data-model side has to express:

1. **What the doctor asked** — a stable, time-stamped record of the questions, their scopes, and the items they're about.
2. **What the patient answered** — per-question status, references to whichever existing typed events satisfy "yes" answers, and an explicit slot for "no" / "unknown" / "declined" (FHIR `data-absent-reason` analogue) that today's typed records don't carry.

The questionnaire layer is a **storage shape for the asking/answering act**. The canonical clinical records remain in their typed items (`medication-intake-coded` on `medication/coded-v1`, `body-weight` on `mass/kg` or `mass/lb`, `fertility-cycles-start`, …) — the answer event just references them. This preserves the HDS promise *"you'll never fill twice the same question"* because the underlying clinical events are shared across questionnaires.

---

## What this repo ships for Plan 71

### Two new eventTypes — `definitions/eventTypes/eventTypes-hds.json`

#### `questionnaire/request-v1` *(what was asked)*

One event per questionnaire instance, in the patient's account: the question template a doctor (or a generator) asked, instantiated for this patient at this moment. **No event travels between two accounts.** Today the one writer is the patient's own app: a questionnaire bundled in a collector request is written when the patient accepts it (§ Who asked). A requester writing a request itself through its grant is allowed by the model and done by no app.

```yaml
content:
  title?: { en: "Pregnancy intake — visit 1" }
  description?: { en: "..." }
  templateRef?: "stormm-pregnancy-history"   # link to a saved hds-lib appTemplates Questionnaire
  questions:
    progesterone-life:
      label: { en: "Did you take Progesterone in your life?" }
      itemRef: medication-intake-coded         # existing HDS item
      params: { drug: { codes: [{ system: ATC, code: G03DA04 }] } }
      scope: { type: ever }
      subField:
        type: select-segmented
        label: { en: "Trimester" }
        options:
          - { value: T1, label: { en: "T1" } }
          - { value: T2, label: { en: "T2" } }
          - { value: T3, label: { en: "T3" } }
          - { value: TX, label: { en: "Unknown" } }
    weight-week:
      label: { en: "Body weight in the past week" }
      itemRef: body-weight
      scope: { type: latest, withinDays: 7 }
    cycle-recent:
      label: { en: "Your last cycle (≤60 days)" }
      itemRef: fertility-cycles-start
      scope: { type: latest, withinDays: 60 }
```

**Question keys** must match the Pryv content-query path grammar `[a-zA-Z0-9_-]+` — no colons, dots, brackets, or wildcards. This is enforced by the eventType schema (`propertyNames.pattern`) so that `content.answers.<key>.status` queries work against the matching answer event. Keys are **scoped per request**; nothing enforces cross-questionnaire uniqueness in v1.

**The template reference (`templateRef`).** An optional string that says which saved template the request was written from. It is **chosen by the requester's app** and is **unique only within that requester's templates**: nothing registers it with HDS, and two requesters may use the same reference (`intake`) for different templates. It is not an HDS registry entry. Requests written with the same reference by the same requester come from the same template; across requesters the reference says nothing. A requester that uses a published form may set its canonical URL as the reference. The eventType sets no pattern and no maximum length on it. Its FHIR rendering is in FHIR-MAPPING.md § Questionnaire ("The template reference").

**Scope variants:**

| `scope.type` | Required extra fields | Meaning |
|---|---|---|
| `ever` | — | Any time, lifetime. |
| `window` | `withinDays: N` | Within the past N days (rolling). |
| `latest` | `withinDays: N` | Most recent matching event, but only if it's within the past N days. |

A `{ type: "range", from, to }` variant is reserved for a future additive extension — not in v1.

**`subField`** is optional and exists for the qualifier-capture case (trimester, severity bucket, etc.). When present, the patient's answer entry stores the chosen value under `qualifier`. Sub-field types: `select-segmented` (with `options`), `text`, or `number`.

**One JSON type per sub-field (rule for new requests, 4.12.0, plan 115).** The option values of one `select-segmented` sub-field are **all strings or all numbers, never a mix**. The qualifier renders in FHIR as the answer of one nested item (`<key>.qualifier`), and a `Questionnaire` item has one type: `string` for a `text` sub-field and for a select whose options are strings, `decimal` for a `number` sub-field and for a select whose options are numbers (FHIR-MAPPING.md § QuestionnaireResponse, "The qualifier's type"). A select mixing `T1` and `9` cannot be described by any item type. **No code enforces the rule yet:** the eventType schema does not (a published schema is not tightened), and hds-lib's `Questionnaire` validation, where it will be checked, does not either. Until it does, the rule is the author's to follow. A request written before the rule with mixed options keeps rendering, and its numeric option fails validation against its `Questionnaire`: one known, documented error.

##### Who asked — `requester` *(3.49.0)*

```yaml
content:
  requester:
    relationship: "cmh3x1k2a0001ab12cd34ef56"   # base id of the access the person granted the requester
  questions: { ... }
```

A questionnaire bundled in a collector request is written into the person's account **by the person's own app**, right after she accepts (`Questionnaire.writeBundled`), so the event's `createdBy` is her own access and says nothing about who asked. That app therefore records the requester:

- **`requester.relationship`** is the CMC relationship: the base id (`pryv.utils.parseAccessRef(id).base`, without its serial) of the access she granted the requester at accept (the accept result's `dataGrantAccessId`), the same value document shares store (`hdsDocumentShare.relationship`, DOCUMENTS.md). It survives scope updates (a new serial, same base) and tells several data sets of one counterparty apart. It is an id in her own account, meaningful there only.
- **It is an instantiation fact, never a template fact.** It is set from the accept result and never copied from the offer: a requester could otherwise name another contact as the one asking. hds-lib drops it from any `Questionnaire` content and sets it only in `makeRequestEvent` / `writeBundled`.
- **Reading it:** when `parseAccessRef(createdBy).base` is one of her relationships' access base (a request a requester wrote itself through its grant), that relationship asked, and the content field is not needed. Otherwise, `requester.relationship`. Absent on requests written before 3.49.0: the app shows no requester for those.
- An object, so a later version can add, say, the requester's data set or counterparty without a breaking change.

#### `questionnaire/answer-v1` *(what was answered)*

Written by the patient's app into the patient's own account, one event per filling instance. **Nothing sends it to the requester.** A requester (or any app) reads answers only under a grant on the stream they are in (§ Where the events live); no app requests that grant today, so in practice the answers stay with the patient.

```yaml
content:
  requestEventId: "evt-q-abc"
  answers:
    progesterone-life:
      status: answered
      references: ["evt-prog-intake-xyz"]
      qualifier: T2
    weight-week:
      status: answered
      references: ["evt-bw-2026-06-14"]
    cycle-recent:
      status: no                          # explicit no
    sensitive-question:
      status: declined                    # patient chose not to share
      reason: "privacy"
    forgotten-medication:
      status: unknown                     # I don't remember
    # missing key = implicit "not-answered" (skipped / unreached)

clientData:
  related:                                # Pryv §7 keyed-object cross-reference convention
    "evt-q-abc":            true          # the request itself
    "evt-prog-intake-xyz":  true
    "evt-bw-2026-06-14":    true
```

**Status enum** — exactly one of:

| `status` | Required fields | Optional fields | Meaning | FHIR mirror |
|---|---|---|---|---|
| `answered` | `references` (≥1) | `qualifier` | Yes, with supporting data. | `valueBoolean: true`, the references and the qualifier nested under the answer |
| `no` | — | — | Explicit "no / did not / does not". | `valueBoolean: false` |
| `unknown` | — | — | Patient can't recall / doesn't have the information. | an answer whose boolean is absent, `data-absent-reason: asked-unknown` |
| `declined` | — | `reason` (free-text in v1) | Patient chose not to answer (privacy / consent). | an answer whose boolean is absent, `data-absent-reason: asked-declined`, the reason nested under the answer |
| *(key absent)* | — | — | Not reached — skipped by form logic or filling abandoned. | no item |

The qualifier and the decline reason are **content the person typed or chose**: a grant on the answers shows them (§ Where the events live).

`reason` on `declined` is a free-text string in v1. A future additive extension may accept a coded value (e.g. SNOMED `715169006` "Declined to disclose information") via a string-or-object union; that's out of v1 to keep schema unambiguous.

---

## Cross-reference convention — `clientData.related.<eventId>: true`

To make cohort queries direct ("find all answer events that reference event X"), the answer-event writer **must** duplicate every reference from `content.answers[*].references[*]` (and the `requestEventId`) into `clientData.related` as a keyed object: `clientData.related[<eventId>] = true`.

This follows Pryv's §7 cross-reference convention. Both the `content` and `clientData` query parameters share the same path grammar `^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*$` (no arrays, no wildcards). The event ids the cores generate (cuids: 25 letters and digits) match the grammar, so `clientData.related.<eventId>` is queryable.

**Event ids: 1 to 31 characters of `[A-Za-z0-9-]`.** That is what the FHIR renderer accepts for `requestEventId` and for each reference (hds-fhir-js `isEventId`); a cuid fits. An earlier version of this page said ids may be UUIDs: a 36-character UUID matches the query grammar and **does not render** (the whole response is refused, an OperationOutcome in a search). An importer that chooses its own event ids keeps them within the 31 characters.

**Why both content + clientData?** `content.answers[k].references` is the semantic record (which events this question's answer points at). `clientData.related` is the indexable mirror — Pryv supports query-by-path on both parameters, but `clientData` is the dedicated cross-reference channel and has the documented §7 convention used elsewhere in HDS (e.g. PDF source mapping). Carrying refs in both places costs ~50 bytes per reference and removes the indirection cost on every cohort query.

---

## Atomicity during form-filling

A single questionnaire filling typically writes:

1. Zero or more **new typed events** (e.g. a body-weight measurement the patient enters during the form), AND
2. **The answer event** referencing those new events plus any pre-existing events the patient confirmed.

These must land as one **Pryv `events.batch`** so a partial failure doesn't leave dangling references or orphan typed events. Pryv enforces no cascade across events, so the convention is:

- **Answer-event references are immutable snapshots.** Once an answer event is written, do not delete the typed events it references.
- If a referenced typed event must be deleted/changed, write a **successor answer event** with updated references (or a `status` change). The latest-by-`event.time` wins for prefill.
- A dangling reference (referenced event not found at read time) is a known degraded state; consumers should treat it as "data unavailable" without throwing.

---

## Update semantics

Patient edits to a previous answer **create a new `questionnaire/answer-v1` event**, never mutate the existing one. The renderer's prefill logic uses **latest-by-`event.time` per `requestEventId`** — older answer events for the same request are kept for audit trail but ignored by display. This mirrors how HDS treats most clinical record edits and aligns with FHIR's `QuestionnaireResponse.status: in-progress | completed | amended | entered-in-error` lifecycle (v1 doesn't yet expose those status codes — deferred).

**The content of a request event is never updated; a changed questionnaire is a new request event** (4.13.0). The answers name their request by its event id, and the FHIR canonical built from that id has no version (FHIR-MAPPING.md § QuestionnaireResponse), so a request whose questions were edited after an answer would make the stored responses disagree with the Questionnaire at their canonical, with nothing to tell the two apart. Adding the model stream to a request's `streamIds` (§ Where the events live) is not a content change.

---

## FHIR mirror

| HDS | FHIR |
|---|---|
| `questionnaire/request-v1` | `Questionnaire`, mapped (below, § FHIR: Questionnaire): a per-patient instantiation, `item.linkId` = the question key, each question a boolean |
| `requester.relationship` on a request | `Task.requester` (a `Task` with `focus` = the `Questionnaire`, `for` = the patient), resolved to a `Practitioner` / `Organization` through the contact. Not `QuestionnaireResponse.author` (the person, on the answer) nor `Questionnaire.publisher` |
| `questionnaire/answer-v1` | `QuestionnaireResponse`, mapped (below, § FHIR: QuestionnaireResponse): one answer per question, a boolean with the references nested, or an absent boolean with a data-absent-reason for `unknown` and `declined` |
| `references[]` on an `answered` entry | `valueReference` answers of the nested item `<key>.references` |
| `qualifier` on an `answered` entry | the answer of the nested item `<key>.qualifier` (`valueString`, `valueDecimal` or `valueBoolean`; one type per sub-field, above) |
| `status: no` | `valueBoolean: false`; a consumer may derive `MedicationStatement.status=not-taken` / `Condition.verificationStatus=refuted` / `Procedure.status=not-done` per domain |
| `status: unknown` | `_valueBoolean` with `data-absent-reason: asked-unknown` |
| `status: declined` | `_valueBoolean` with `data-absent-reason: asked-declined`; the `reason` as the nested item `<key>.reason` |
| Key absent | no item in the response (on import, `not-asked` or an item with no answer reads as an absent key) |

The negative statuses (`no`/`unknown`/`declined`) have no standalone typed clinical record in HDS — consumers exporting to FHIR derive `MedicationStatement.status=not-taken`, `Condition.verificationStatus=refuted`, etc. from the answer event content. This is a documented Plan 71 D8 trade-off.

---

## Where the events live (4.12.0, plan 115)

The data model now has a home for the pair: the root stream `questionnaire` with two children,
`questionnaire-request` (item `questionnaire-request`, `questionnaire/request-v1`) and `questionnaire-answer` (item
`questionnaire-answer`, `questionnaire/answer-v1`). Both items are `type: system`: an app writes them, no form field
does. Before this, `streamIds` was left to the caller, and the patient app wrote both events into its own scope
stream (`:_cmc:apps:hds-patient`), which is not a model stream: no consent names it and no SMART grant reaches it.

- **An answer is shared, and served as FHIR, only from `questionnaire-answer`** (or a stream below it). An app that
  writes answers elsewhere keeps them out of every grant.
- **The root is `explicitGrantOnly`** ([GENETICS.md](GENETICS.md#explicitgrantonly), the second root after
  `genetics`): an access covers `questionnaire` and its two streams only when it names one of them. A `*` grant, a
  grant on another root never reach them; a consent screen offers them unticked, under the SMART `patient/*.rs`
  as under a scope that names them. The
  answers are a cross-topic sink (a yes on a question about a genetic test says that such a result exists), so the
  default is "not shared unless ticked".
- The two streams are siblings so each is granted alone: answers under `patient/QuestionnaireResponse.rs`, requests
  under `patient/Questionnaire.rs` (4.13.0). An app that holds the answers alone reads them without their question
  texts.
- **What a grant on the answers shows:** the question keys; for each a yes, a no, "does not know" or "prefers not to
  say"; **the qualifier the person chose or typed** (a trimester, a number, free text) **and the reason typed when
  declining**; the id of the request and the ids of the referenced records, on any health topic. The stream
  descriptions say so on the consent screen. The referenced records themselves are read under their own grants only.
- **What a grant on the requests shows:** every requester's question texts, and `requester.relationship` (an id of
  another access of the account, meaningful there only). The FHIR rendering shows the questions and leaves
  `requester`, `params` and `scope` out (§ FHIR: Questionnaire).
- **During the transition the app scope stream is kept.** Events already written in an app's scope stream are not
  moved by the data model. The app that owns them **adds** the model stream to their `streamIds` (a Pryv event may
  sit in several streams), the model stream first, and keeps the scope stream, so that an older build of the app
  still reads them; new events are written in both. Removing the scope stream is a later, separate step. An event
  left in the scope stream alone stays unshared.
- **Per-context substreams are not implemented.** Plan 53 D3 (context via substream) would place the requests and
  answers of one pregnancy on descendant streams of `questionnaire-request` and `questionnaire-answer`. No app
  writes such a stream today: every event is in the two streams above (and the app scope stream). The model admits
  children later, and a read of the stream already covers them.

## FHIR: QuestionnaireResponse (4.12.0, plan 115)

The `questionnaire-answer` item carries a `fhir` block: one answer event is one `QuestionnaireResponse`, rendered
from the event alone. The mapping, its one-way doors, the grant's reach and the import rules are in
[FHIR-MAPPING.md § QuestionnaireResponse](FHIR-MAPPING.md#questionnaireresponse-questionnaire-answers). In short:
`questionnaire` is the canonical `https://hds.ngo/fhir/Questionnaire/<requestEventId>`, `authored` the event time,
`status` `completed`; each question key is an item with one answer: `true` (with the referenced events and the
qualifier nested), `false` (`no`), or a boolean that is absent with a data-absent-reason (`asked-unknown`,
`asked-declined`, a decline's reason nested under the answer). The latest response per questionnaire is the current
one. A response carries the question as asked (`item.text`) when its reader also holds the requests (4.13.0, below).
**No profile is claimed**: the base resource on every flavour (FHIR-MAPPING.md, "No profile is claimed").

## FHIR: Questionnaire (4.13.0, plan 115)

The `questionnaire-request` item carries a `fhir` block: one request event is one `Questionnaire`, rendered from
the event alone ([FHIR-MAPPING.md § Questionnaire](FHIR-MAPPING.md#questionnaire-questionnaire-requests)). In short:
`url` is `https://hds.ngo/fhir/Questionnaire/<request event id>`, the canonical its responses name; `status`
`active` (a constant of the renderer today); `title` and `description` with their translations; `derivedFrom` the
template reference (`templateRef`: unchanged when it is an absolute `http:`, `https:` or `urn:` URI, the scheme in any case and printable ASCII only, under
`https://hds.ngo/fhir/Questionnaire/template/` otherwise); each question a `boolean` item whose `linkId` is the
question key, `text` the label and `code` the HDS item (`itemRef`, when it is an item key of the model; a deprecated
alias as its current key), with the children a response nests under its answer: `<key>.references`,
`<key>.qualifier` (from the `subField`) and `<key>.reason`. `requester`, `params` and `scope` are not rendered. A
Questionnaire is not imported: `scope` and `params` are not in it.

**Names the renderer reads** (reserved on this eventType, their types pinned by the build, `[FHIR-MAP-27]`):
`questions` and, in each question, `label` and `itemRef` (required); `title`, `description`, `templateRef` and, in a
question, `subField` (read when present). The build also holds the question key grammar (`^[a-zA-Z0-9_-]+$`, no dot)
and the `subField.type` enum (`select-segmented`, `text`, `number`), with the `options` of a sub-field (an array,
each `value` a number or a string): **a new sub-field type is added to the
renderer, and to `QUESTIONNAIRE_SUB_FIELD_TYPES` in `src/fhir.js`, before the eventType**, since the renderer refuses
a request whose sub-field type it does not know. The same holds for a new JSON type of an option value
(`QUESTIONNAIRE_OPTION_VALUE_TYPES`).

---

## Related precedents in HDS

- **Plan 45** — `message/system-alert` ↔ `message/system-ack` is the request/response event-pair precedent (paired by `ackId`). Plan 71 follows the same shape with `requestEventId`.
- **Plan 53** — D3 context-via-substream is how per-pregnancy questionnaires could be isolated (request and answer events on per-pregnancy descendant substreams). **Not implemented:** no app writes such a substream (§ Where the events live).
- **Pryv §7 keyed-object cross-references** — same convention used by PDF-source mapping elsewhere in HDS.


---

## Coverage check when embedding a Questionnaire inside a CollectorRequest

When a doctor (or a generator) bundles a Questionnaire inside a CollectorRequest (Option B — `CollectorRequest.addQuestionnaire(q)`), the bundled questionnaire's questions reference HDS items that live on specific streams. For the answer event's `references[]` and `clientData.related.<eventId>: true` mirror to be resolvable on the doctor's side, the request's `permissions[]` must cover those streams.

`hds-lib` ships a small helper to validate this and propose the missing permissions:

```ts
import { appTemplates } from 'hds-lib';
const { checkQuestionnaireCoverage } = appTemplates;

// Standalone — works on Questionnaire instances OR raw content for both sides
const report = checkQuestionnaireCoverage(questionnaire, request);
// → { ok, perQuestion, unknownItems, proposedPermissions }

// Convenience on CollectorRequest:
const sameReport = request.checkQuestionnaireCoverage(questionnaire);  // read-only
const reportAfterFix = request.applyQuestionnaireCoverage(questionnaire);  // adds the missing permissions in place
```

The `proposedPermissions` set is computed via the same `authorizations.forItemKeys` path that `CollectorRequest.buildPermissions` uses, so the result merges cleanly with existing permissions (no parent/child duplication). Unknown itemRefs (items the loaded HDS model doesn't recognize) are surfaced in `unknownItems` — never thrown on — so the UI can decide whether to block submission or just warn.

Intended UX in a form-builder: when the doctor adds a Questionnaire whose items aren't already in the request's sections, show a banner with the missing-count and an "Add missing permissions" button that calls `applyQuestionnaireCoverage`. The bundled FormBuilder in `hds-forms-js` ships this banner by default.

**Scope is permissions only.** A question's item does NOT need a matching section entry; sections are doctor-curated UX, not correctness constraints.
