# Finding — coded clinical and imaging findings

> **⚠ The scope of this root is UNDECIDED.** This document records what `finding` is today and the
> question that is open, so a reader is not left inferring it from a one-line `description`. It does not
> settle the question. The decision is tracked in `_plans/XX-finding-root-scope-later/` in the workspace,
> and this file should be rewritten when it is made. Recorded as finding F9, plan 100.

## What exists today

One item, on the root stream itself:

| item | eventType | type | repeatable | stream |
|---|---|---|---|---|
| `finding-coded` | `finding/coded-v1` | datasource-search | unlimited | `finding` |

`finding` is one of two top-level streams with **no children**; the item sits directly on the root. The
coded identity is populated from datasets-service, the same pattern `condition-coded`, `procedure-coded`
and `treatment-coded` use.

## The distinction the model draws

`finding/coded-v1`'s own description is the authority, and it is narrow:

> Records what was FOUND at surgery or on imaging (e.g. hydrosalpinx, ovarian endometrioma) — neither a
> procedure, a symptom, nor quite a diagnosis.

So the four coded siblings are meant to partition cleanly:

| | records | example |
|---|---|---|
| `condition-coded` | what the patient **has** — an established diagnosis | endometriosis |
| `finding-coded` | what was **found** at surgery or on imaging | ovarian endometrioma |
| `procedure-coded` | what was **done**, point-in-time | laparoscopy |
| `treatment-coded` | what is being **done over time**, duration-bearing | IVF cycle |

`symptom-*` items are separate again: what the patient **reports**.

## The open question

"Found at surgery or on imaging" is narrower than how "finding" is used in SNOMED CT, where the
*finding* hierarchy is very broad and covers a great deal that HDS models as `symptom-*`, `condition-*`
or `body-*`. Several concepts sit uncomfortably:

- **A genetic test result.** Not a diagnosis, not seen at surgery or on imaging. It was peeled out of
  `_plans/TODO-ASAP.md` on the reasoning that `finding-coded` plus `procedure-coded` already carry it —
  but only once this root's scope admits a lab result.
- **A lab abnormality.** `body-blood-*` items carry the measured values; whether an abnormal one is also
  a `finding` is undecided.
- **A physical-examination finding.** Not surgery, not imaging.

Widening the scope is cheap in code and expensive in meaning: the `finding` root is published, so
anything written under it is permanent, and a root that means "any clinical observation" stops
partitioning against `condition`, `symptom` and `body` at all.

## Until it is settled

**Do not write new items into `finding` on the strength of the word alone.** Check the four-way table
above first, and if the concept does not clearly belong to exactly one row, take it to the plan rather
than picking. That is the failure mode this document exists to prevent.
