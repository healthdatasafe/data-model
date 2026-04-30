# Treatment & Procedure subdomains (Plan 46)

How HDS captures clinical **treatment regimens** and **clinical procedures**, and how the **context-via-substream** resolution mechanic (D3) lets a single itemDef registered at a parent stream serve events placed in any descendant stream.

## Overview

Two parallel item / stream subdomains alongside the existing `medication-*` family:

- **`treatment-*`** — a clinical regimen / programme (multi-step, often multi-cycle, has a name): IVF, chemotherapy, CBT, dialysis, …
- **`procedure-*`** — a single dated clinical event: laparoscopy, polypectomy, pelvic ultrasound, vasectomy reversal, …
- Both distinct from `medication-*` (a substance taken).

Both subdomains follow the **basic / coded** item pair, mirroring `medication-intake-basic` + `medication-intake-coded`. Coded variants delegate vocabulary lookup to `datasets-service`.

## Stream tree

```
treatment/                          ← itemDefs registered here
  itemDefs: treatment-basic, treatment-coded
  treatment-fertility/              ← context (no itemDefs)
  …                                 ← future: treatment-oncology,
                                       treatment-mental-health, …

procedure/                          ← itemDefs registered here
  itemDefs: procedure-basic, procedure-coded
  procedure-fertility/              ← context (no itemDefs)
  …                                 ← future: procedure-cardiology, …
```

v1 ships only `*-fertility` context streams (STORMM unblock). Other context placeholders land when their forms drive the demand.

## Item shape

```yaml
treatment-basic:
  streamId: treatment
  eventType: treatment/basic
  payload:
    name:    text                    # "IVF", "Chemotherapy regimen", "CBT"
    count:   number (optional)       # Flavour A: lifetime aggregate count
    period:  { start, end } (opt.)   # Flavour B: treatment span
    notes:   text (optional)

treatment-coded:
  streamId: treatment
  eventType: treatment/coded-v1
  payload:
    regimen: { label, codes: [...] } # codes from datasets-service
    count, period, notes             # same as basic

procedure-basic:
  streamId: procedure
  eventType: procedure/basic
  payload:
    name:      text                   # "Laparoscopy", "HSG", "Polypectomy"
    performed: { date }               # Flavour B: per-event date
    count:     number (optional)      # Flavour A: lifetime occurrences
    findings:  array (optional)       # see below
    notes:     text (optional)

procedure-coded:
  streamId: procedure
  eventType: procedure/coded-v1
  payload:
    procedure: { label, codes: [...] }
    performed, count, findings, notes
```

### Flavours via eventType variation, same item key

- **Flavour A — aggregate intake** (intake forms; "have you ever had X?"): `count: N`, `count > 0` means yes. One event captures lifetime history.
- **Flavour B — per-event / per-cycle** (longitudinal capture): `performed.date` (or per-cycle date), no `count`. Each occurrence is a distinct event.

The shape distinction is in the payload (`count` vs `performed`), not in distinct itemDefs. Forms decide which fields to surface.

### Procedure findings

`procedure-basic.findings[]` is an open-vocabulary array describing procedure-bound observations (what was seen during this specific procedure event):

```yaml
findings:
  - type:  text          # "endometriosis-localisation", "adhesions",
                         # "fibroid", "modality", …
    value: text | bool | composite
    notes: text (optional)
```

The form preset declares which finding `type`s to surface per procedure label. **Cross-procedure persistent diagnoses** (e.g. "patient has been told they have endometriosis, regardless of which procedure detected it") are out of scope for Plan 46 — a future `diagnosis-*` plan handles them.

### No named-leaf items

There is no `treatment-fertility-iui`, no `procedure-fertility-laparoscopy`. The `name` / `regimen.label` / `procedure.label` carries clinical identity; the streamId (via D3) carries clinical-domain context. Open vocabulary by default; STORMM presets, FEMM forms, oncology PROs surface their own candidate-label lists.

## Context-via-substream resolution (D3)

This plan introduces a generic resolution mechanic — same closest-ancestor walk-up used by Plan 45's clientData lookup (`hds-lib-js/ts/appTemplates/resolveStream.ts`) and by `HDSModelAuthorizations` parent-covers-child de-dup — applied at the data-model itemDef layer.

**The rule.** An itemDef registers at a single canonical `streamId`. Events of that itemDef's `eventType` may be placed at the canonical `streamId` **or any descendant**. Resolution:

1. Try direct match `(itemDef.eventType === event.type && itemDef.streamId === event.streamIds[0])`.
2. If no match, **walk up the stream tree** from `event.streamIds[0]`. At each ancestor, retry the direct match. Closest ancestor wins.

**Event creation.** `eventTemplate(itemDef, opts?: { context?: string })`:

- No `context`: `streamIds: [itemDef.streamId]`.
- With `context`: `streamIds: [context]`. The `context` MUST be `itemDef.streamId` or a descendant; the validator rejects otherwise.
- The streamIds array is **always length-1** under D3. Multi-streamId tagging is reserved for the future `tags/` root (see [`TAGS.md`](./TAGS.md)).

### Worked example — STORMM Q16 IVF intake

STORMM intake records "patient has had 2 IVF cycles." The form section declares:

```yaml
itemKeys: [treatment-coded]
itemCustomizations:
  treatment-coded:
    context: treatment-fertility    # per-item D3 context
```

User searches `/treatment?search=ivf` (datasets-service) and selects **In vitro fertilization** (SCTID `63487001`). Submits with `count: 2`.

The form engine:

1. Calls `treatment-coded.eventTemplate({ context: 'treatment-fertility' })` → `{ streamIds: ['treatment-fertility'], type: 'treatment/coded-v1' }`. (Validator confirms `treatment-fertility` is descendant of `treatment`.)
2. Merges payload → final event:
   ```json
   {
     "streamIds": ["treatment-fertility"],
     "type": "treatment/coded-v1",
     "content": {
       "regimen": { "label": { "en": "In vitro fertilization" }, "codes": [{ "code": "63487001", "system": "SNOMED-CT", … }] },
       "count": 2
     }
   }
   ```
3. POSTs to Pryv. The event lives under `treatment-fertility` — not at `treatment` itself.

When the form prefills next time, `forEvent({ type: 'treatment/coded-v1', streamIds: ['treatment-fertility'] })` walks `treatment-fertility → treatment`, finds `treatment-coded` registered at `treatment`, returns it. The same itemDef serves all `treatment-*` contexts (fertility today, oncology / mental-health / cardiology when those streams land) without itemDef proliferation.

### Cross-tree context naming convention

When multiple roots accept the same clinical-domain context, mirror the suffix:

```
treatment/treatment-fertility/
procedure/procedure-fertility/
medication/medication-fertility/   ← when medication subtree adopts the pattern
note/note-fertility/               ← logic-check example: a note-txt itemDef
                                     at `note` resolves events placed at any
                                     `note-*` descendant context
```

Tools (and the future `tags/` root) can then ask "give me all fertility-context events" by querying `*-fertility` across roots. This is a documented convention, not a code-enforced invariant — keep new context streamIds aligned with existing clinical-domain suffixes.

## Boundary with `medication-*`

- `medication-*` records what was **taken** (with dose, route, schedule). One event per intake.
- A treatment may aggregate medications and procedures; a procedure may have associated peri-procedure medications. The subdomains compose; they do not subsume each other.

## Edge case — IVF egg retrieval

Both "part of an IVF treatment" and "a single procedure event." Resolution under D3:

- The retrieval is a **`procedure-basic`** event with `name: "IVF egg retrieval"`, `context: procedure-fertility`. SNOMED-CT concept: `84977000 |Oocyte retrieval|`.
- The treatment-level identity ("patient is doing IVF") is captured by a separate **`treatment-basic`** / **`treatment-coded`** event.
- Aggregation across the two layers is reconstructed at query time. No hierarchical link is modelled in v1.

## Coded vocabulary

Coded variants resolve via `datasets-service`:

- Datasource declarations: `definitions/datasources/treatments.yaml` (`datasets://treatment`), `definitions/datasources/procedures.yaml` (`datasets://procedure`).
- v1 seed: `datasets-service/datasets/SNOMED-CT-STORMM/{treatments,procedures}.json` — ~25 hand-curated SNOMED-CT entries covering Plan 47 STORMM fertility intake. Complementary with any future full SNOMED-CT procedures fetcher.
- Future expansions: ICD-10-PCS (US public domain), CPT (license-restricted), full SNOMED-CT.

## External systems & cross-walk

| System | Coded analog |
|---|---|
| **HL7 FHIR** | `Procedure` resource (single-event); `CarePlan` / `MedicationStatement` for regimens. `Procedure.category` is a small cross-cutting tag (Surgical / Diagnostic / Counseling / …) — clinical domain lives in `code` + `bodySite`, not in category. D3's domain-context streamId is the data-model analog. |
| **SNOMED CT** | Procedures form a deep poly-hierarchy under `71388002 \|Procedure\|`, organised by `Procedure by site` and `Procedure by method`. Concepts have multiple parents; D3's walk-up captures one organisational axis (clinical domain) — the rest stays in datasets-service codes. |
| **LOINC** | Not applicable. LOINC is observation/measurement, not procedure coding. |

## Files

- Streams: `definitions/streams/treatment.yaml`, `definitions/streams/procedure.yaml`
- Items: `definitions/items/treatment.yaml`, `definitions/items/procedure.yaml`
- EventTypes: `definitions/eventTypes/eventTypes-hds.json` (`treatment/basic`, `treatment/coded-v1`, `procedure/basic`, `procedure/coded-v1`)
- Datasources: `definitions/datasources/treatments.yaml`, `definitions/datasources/procedures.yaml`
- Lib resolution: `data-model/src/items.js#findItemForEvent`, `data-model/src/streams.js#getAncestorsById/isDescendantOf`; `hds-lib-js/ts/HDSModel/HDSModel-ItemsDefs.ts#forEvent` (walk-up); `hds-lib-js/ts/HDSModel/HDSItemDef.ts#eventTemplate` (context).
