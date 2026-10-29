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

## `repeatable: unlimited`, and the absence of a status field

The item is `unlimited`, so a person can carry many conditions and record each as its own event.

There is **no status field** on `condition/coded-v1` today — no active / resolved / in-remission, and no
equivalent of FHIR `Condition.clinicalStatus`. Be careful about how much intent to read into that: it
does not appear to have been decided either way. The nearest precedent is plan 71, which rejected
per-domain *assertion* eventTypes, putting explicit-no / unknown / declined semantics on
`questionnaire/answer-v1` instead. That is a related but different question: resolution status is a
positive clinical attribute, not a negative or qualified assertion.

So if a deployment needs standalone resolution status, treat it as an open design question and take it to
a plan, per `AGENTS.md` §4 — do not add a status property to the published type on the assumption that
its absence was an oversight, nor on the assumption that it was settled.

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
