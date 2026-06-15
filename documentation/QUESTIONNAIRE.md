# Questionnaire — data-model side

This document describes what `data-model` ships for the **questionnaire request/answer event pair** introduced by Plan 71 (`_plans/71-history-checklist-field-type-atwork/` in the `_macro2` workspace). It is the **data-model perspective** — what eventTypes exist, what storage shape they declare, what the cross-reference convention looks like.

The runtime mechanics — questionnaire renderer, scope-aware prefill via Pryv content queries, batched submit, appTemplates `Questionnaire` declaration — live in **`hds-lib`** and **`hds-forms-js`** (Plan 71 Phases C–E).

---

## Why this exists

HDS forms commonly mix three answer shapes:

- **Value-collection** ("body weight in the past week") — captured into existing typed events (`body-weight/kg`).
- **Observation-recall** ("your last cycle, ≤60 days") — surfaces existing typed events (`fertility-cycles-start`) for confirmation.
- **Assertion / exposure** ("did you take Progesterone in your life?") — yes / no / I-don't-know / I-don't-want-to-answer, optionally with a sub-qualifier (trimester, severity, etc.).

A clinical questionnaire is the natural container for all three. The data-model side has to express:

1. **What the doctor asked** — a stable, time-stamped record of the questions, their scopes, and the items they're about.
2. **What the patient answered** — per-question status, references to whichever existing typed events satisfy "yes" answers, and an explicit slot for "no" / "unknown" / "declined" (FHIR `data-absent-reason` analogue) that today's typed records don't carry.

The questionnaire layer is a **storage shape for the asking/answering act**. The canonical clinical records remain in the typed eventTypes (`medication/coded-v1`, `body-weight/kg`, `fertility-cycles-start`, …) — the answer event just references them. This preserves the HDS promise *"you'll never fill twice the same question"* because the underlying clinical events are shared across questionnaires.

---

## What this repo ships for Plan 71

### Two new eventTypes — `definitions/eventTypes/eventTypes-hds.json`

#### `questionnaire/request-v1` *(doctor → patient)*

The doctor (or generator) writes one of these per questionnaire instance. Carries the question template instantiated for this patient at this moment.

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
          - { value: 9,  label: { en: "Unknown" } }
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

**Scope variants:**

| `scope.type` | Required extra fields | Meaning |
|---|---|---|
| `ever` | — | Any time, lifetime. |
| `window` | `withinDays: N` | Within the past N days (rolling). |
| `latest` | `withinDays: N` | Most recent matching event, but only if it's within the past N days. |

A `{ type: "range", from, to }` variant is reserved for a future additive extension — not in v1.

**`subField`** is optional and exists for the qualifier-capture case (trimester, severity bucket, etc.). When present, the patient's answer entry stores the chosen value under `qualifier`. Sub-field types: `select-segmented` (with `options`), `text`, or `number`.

#### `questionnaire/answer-v1` *(patient → doctor)*

Written by the patient as one event per filling instance.

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
| `answered` | `references` (≥1) | `qualifier` | Yes, with supporting data. | Observation / MedicationStatement / Procedure |
| `no` | — | — | Explicit "no / did not / does not". | `status: not-taken`, `verificationStatus: refuted`, etc. |
| `unknown` | — | — | Patient can't recall / doesn't have the information. | `data-absent-reason: unknown` |
| `declined` | — | `reason` (free-text in v1) | Patient chose not to answer (privacy / consent). | `data-absent-reason: asked-declined` |
| *(key absent)* | — | — | Not reached — skipped by form logic or filling abandoned. | `data-absent-reason: not-asked` |

`reason` on `declined` is a free-text string in v1. A future additive extension may accept a coded value (e.g. SNOMED `715169006` "Declined to disclose information") via a string-or-object union; that's out of v1 to keep schema unambiguous.

---

## Cross-reference convention — `clientData.related.<eventId>: true`

To make cohort queries direct ("find all answer events that reference event X"), the answer-event writer **must** duplicate every reference from `content.answers[*].references[*]` (and the `requestEventId`) into `clientData.related` as a keyed object: `clientData.related[<eventId>] = true`.

This follows Pryv's §7 cross-reference convention documented in `_plans/71-history-checklist-field-type-atwork/archives/API-FACING-CHANGES.md`. Both the `content` and `clientData` query parameters share the same path grammar `^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*$` (no arrays, no wildcards) — eventIds (cuid/UUID) match the grammar, so `clientData.related.<eventId>` is queryable.

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

---

## FHIR mirror

| HDS | FHIR |
|---|---|
| `questionnaire/request-v1` | `Questionnaire` (per-patient instantiation; FHIR's `Questionnaire.item[].linkId` ≈ HDS's question key) |
| `questionnaire/answer-v1` | `QuestionnaireResponse` (with `answer.reference` to typed records and `answer.dataAbsentReason` for the negative statuses) |
| `references[]` on an `answered` entry | `QuestionnaireResponse.item.answer.valueReference` |
| `qualifier` on an `answered` entry | `QuestionnaireResponse.item.answer.value*` (qualifier-specific type) |
| `status: no` | derives `MedicationStatement.status=not-taken` / `Condition.verificationStatus=refuted` / `Procedure.status=not-done` per domain |
| `status: unknown` | `data-absent-reason: unknown` |
| `status: declined` | `data-absent-reason: asked-declined` |
| Key absent | `data-absent-reason: not-asked` |

The negative statuses (`no`/`unknown`/`declined`) have no standalone typed clinical record in HDS — consumers exporting to FHIR derive `MedicationStatement.status=not-taken`, `Condition.verificationStatus=refuted`, etc. from the answer event content. This is a documented Plan 71 D8 trade-off (`_plans/71-history-checklist-field-type-atwork/PLAN.md`).

---

## Related precedents in HDS

- **Plan 45** — `message/system-alert` ↔ `message/system-ack` is the request/response event-pair precedent (paired by `ackId`). Plan 71 follows the same shape with `requestEventId`.
- **Plan 53** — D3 context-via-substream is how per-pregnancy questionnaires stay isolated (request and answer events live on per-pregnancy descendant substreams).
- **Pryv §7 keyed-object cross-references** — same convention used by PDF-source mapping elsewhere in HDS.
