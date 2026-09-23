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
