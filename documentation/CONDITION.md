# Condition — coded diagnoses

What the `condition` domain covers, and how it partitions against its three coded siblings.

## What exists

One item, on the root stream itself:

| item | eventType | type | repeatable | stream |
|---|---|---|---|---|
| `condition-coded` | `condition/coded-v1` | datasource-search | unlimited | `condition` |

`condition` is one of two top-level streams with **no children** (`finding` is the other); the item sits
directly on the root. This is deliberate: a diagnosis is identified by its **code**, not by its position
in the stream tree, so there is no clinical sub-tree to build. A study granted the `condition` stream
gets the person's diagnoses; a code filter, not a stream filter, narrows it further.

## The construct

`condition-coded` records **what the patient has** — an established diagnosis. Its coded identity comes
from datasets-service and carries `label`, `description` and a `codes` array spanning SNOMED CT, ICD-10
and others, plus an optional free-text `notes`.

It partitions against its siblings this way:

| | records | example |
|---|---|---|
| **`condition-coded`** | what the patient **has** | endometriosis |
| `finding-coded` | what was **found** at surgery or on imaging | ovarian endometrioma |
| `procedure-coded` | what was **done**, point-in-time | laparoscopy |
| `treatment-coded` | what is being **done over time**, duration-bearing | IVF cycle |

And against `symptom-*`, which records what the patient **reports** rather than what a clinician has
established. Pelvic pain is a symptom; endometriosis is a condition. Both can be recorded, and for the
same person they usually both are.

## `repeatable: unlimited`, status and abatement

The item is `unlimited`, so a person can carry many conditions and record each as its own event.

Since 4.1.0 (plan 115 GAP H-6) a condition can say whether it is still there, and when it stopped:

| What | Where | Values |
|---|---|---|
| Clinical status | `content.status` (optional) | `active`, `recurrence`, `relapse`, `inactive`, `remission`, `resolved`: the FHIR `Condition.clinicalStatus` codes (`condition-clinical`). Absent: not stated. |
| Abatement | `event.duration` (optional, never `null`) | `time + duration` is when the condition abated. Absent: the abatement is not known, or falls within the onset's own period (below), or is not later than the recording of an unknown onset (PARTIAL-DATES.md § A date nobody knows). |

The two go together under FHIR's con-4 rule: **a condition with a duration has status `inactive`, `remission` or
`resolved`.** A duration with no status, or with `active`, `recurrence` or `relapse`, is a contradiction: the FHIR
rendering refuses the event rather than emit it, and the importer refuses the resource.

`event.time` stays the onset (or the diagnosis date when that is all the source knows, FHIR-MAPPING.md § Time). **An
undated diagnosis is asked, never filled in:** the document's date is never used as `event.time`, where it would read
as the onset; ask the person (PARTIAL-DATES.md § Rules). When the person does not know it at all, the onset is
written with `hdsTimePrecision: unknown` (PARTIAL-DATES.md § A date nobody knows, 4.19.0): `time` is then when the
condition was recorded. An abatement learned later (after the recording) is written as for any condition, with
`hdsEndPrecision`; an abatement before the recording cannot follow an unknown onset (ask for a rough onset, or write
the status without a duration). An absent duration never means "ongoing": whether the
condition is still there is said by `status`, and a writer that does not know the abatement writes no duration at
all. This is the opposite of the encounter and medication items, where `duration: null` is an ongoing period: a
condition is an assertion about the patient, not a period of care, and the status carries that meaning on its own.
Partial dates follow [PARTIAL-DATES.md](PARTIAL-DATES.md): the onset's precision is `clientData.hdsTimePrecision`;
the abatement's, when different, `clientData.hdsEndPrecision`, with the end anchored at 12:00 UTC on the last day of
its period ("resolved in March 2001" is `time + duration` = 2001-03-31T12:00:00Z, `hdsEndPrecision: month`).

**No abatement is no `duration` key: never `0`, never `null`.** A writer that uses `0` or `null` for "no duration"
elsewhere (a form's duration input, a diary that reads `0` as ongoing) leaves the key out on this item.

**A same-period abatement is not stored (4.11.1, B-2026-11-13-12).** The core cannot keep `duration: 0`: it stores
`endTime = time + duration`, an absent duration as `endTime = time` too, and reads a duration of 0 back as absent (a
point event, by design). The test is on periods and comes before any anchor arithmetic. The period of an exact
dateTime is that instant; of `YYYY-MM-DD`, that UTC day; of `YYYY-MM`, that UTC month; of `YYYY`, that UTC year. A
period is half-open: it holds its opening midnight, and its closing midnight belongs to the next period (onset
`2016-04-06` with abatement `2016-04-07T00:00Z` is a span of 12 h). Two adjustments, because a zoneless date's local
day can start up to 14 h before its UTC day (UTC+14) and end up to 12 h after it (UTC−12); both apply only to a
truncated date against an exact dateTime, and both are 14 h: a truncated end against an exact onset has its period
extended by 14 h past its end, never before its start; a truncated onset against an exact end has its period extended
by 14 h before its start, never past its end (4.11.2, B-2026-11-16-18). They widen the periods of steps (1) and (2)
only, never the anchors of step (3). In order: (1) the end's period lies wholly before the onset's: refused; (2) one
period contains the other, equal periods and equal instants included: the event keeps its abated status
(`inactive`, `remission` or `resolved`) and carries **no `duration` and no `hdsEndPrecision`**; (3) otherwise
`duration` = end anchor − `time`, which is then always positive. So onset `2016-03` with abatement `2016-03-20`, onset
`2016-04-06T21:45Z` (or `T08:00Z`) with abatement `2016-04-06`, onset `2016-04-06` with abatement
`2016-04-06T18:00Z`, and onset `2016-04-06` with abatement `2016-04-06T01:00+02:00` (23:00Z on the 5th, the same
local day) all carry no duration. "Diagnosed and resolved on 6 April 2016" is therefore `status: resolved` with no
duration: the abatement date is lost, and the status alone says the condition ended. An exact onset and a later
exact abatement, even on the same day, are two instants and keep theirs. (4.1.0 to 4.11.0 said `duration: 0` was a real value here; no stored
event could carry it, so nothing moves.)

### The second status: `verificationStatus`

FHIR's `Condition.verificationStatus` (`condition-ver-status`: `unconfirmed`, `provisional`, `differential`,
`confirmed`, `refuted`, `entered-in-error`) is **not stored yet**. The key is reserved: when it is added it will be
`content.verificationStatus`, with those codes, next to `status`, so nothing else should be written there in the
meantime. Current import behaviour (FHIR-MAPPING.md § Import): `refuted` and `entered-in-error` are refused (the
source withdrew the diagnosis); `confirmed`, `provisional`, `differential` and `unconfirmed` import, and the qualifier
is lost, so an imported event states the diagnosis without saying how sure the source was.

**A qualified or negated diagnosis is never written as `condition-coded`.** Since `verificationStatus` is not stored,
an event of this item can only state an established diagnosis. A diagnosis a document or the person qualifies or
negates ("suspicion de", "DD" or "differential", "à exclure", "rule out", a "?") is not written as one, nor moved to
another coded item: it stays in the source document. The FHIR import above does not follow this rule yet: it imports
`provisional`, `differential` and `unconfirmed` and loses the qualifier. That is a known gap until the key ships, not a
pattern for other writers.

The 4.1.0 addition is additive: events written before it carry neither key and read as "status not stated, abatement
unknown", which is what they were. Until 4.1.0 this page said the absence of a status was an open question (the plan
71 precedent, rejecting per-domain assertion types, is a different one: a status is a positive clinical attribute,
not a negative or qualified assertion). It is settled now, by mapping the FHIR element as it is rather than inventing
an HDS vocabulary.

## Encoding

No item-level `references` block, and correctly so: the codes travel **in the event content**, per
selection from datasets-service, rather than being fixed on the item. This is the distinguishing feature
of the four `*-coded` items and is why they are `type: datasource-search` rather than `select`.

Verify any SNOMED CT concept seeded into datasets-service against `reference/snomed-db` before it ships —
several plausible-looking concepts in adjacent domains have turned out inactive.

### `codes[].hdsId` when a writer codes without datasets-service

An importer that codes a diagnosis itself (a curated table, not a datasets-service search) still writes the `hdsId`
datasets-service returns, so its events group with entered ones. Build it as datasets-service's `buildHDSId` does:
`S:<system>/k:<sourceKey>/C:<code>`, with `system` `SNOMED-CT` and the code the SNOMED CT concept id. The `sourceKey`
is the seed that holds the concept: `SNOMED-CT-HDS` for the condition and finding seeds, `SNOMED-CT-STORMM` for the
treatment and procedure seeds. Never the writer's own name: `sourceKey` names the dataset, not who wrote the event.
The whole code entry is the one datasets-service returns:

```json
{ "code": "129103003", "system": "SNOMED-CT", "source": { "key": "SNOMED-CT-HDS" },
  "hdsId": "S:SNOMED-CT/k:SNOMED-CT-HDS/C:129103003" }
```

(endometriosis, in the condition seed). `system` is the short name, as datasets-service writes it in `condition/`,
`finding/`, `treatment/`, `procedure/` and `medication/coded-v1`, not the FHIR URI (`lab-result/coded-v1` is
different: URI systems, BLOOD-CHEMISTRY.md). The same rule applies to `treatment/coded-v1` and `procedure/coded-v1`
(`TREATMENT-PROCEDURE.md`).

**A concept in no seed.** datasets-service returns conditions, findings, treatments and procedures from the seeds only,
so no `hdsId` exists for such a concept. Prefer adding it to the seed first (verified in `reference/snomed-db`). Where a
writer cannot wait, the fallback is `k:IHTSDO` with `source.key` `IHTSDO`, the International Edition key datasets-service
uses for drugs. It is a known split: once the concept joins a seed, newly entered events carry the seed's key and the
earlier ones keep `IHTSDO`, so a reader that groups by `hdsId` sees two entries. Group SNOMED CT codes by `system` +
`code` when that matters.
