# Family — household and family-structure facts

What the `family` domain covers, and why it is one item.

## What exists

| item | eventType | type | repeatable | stream |
|---|---|---|---|---|
| `family-children-count` | `count/generic` (legacy) | number | `once` | `family-children` |

## The construct

`family-*` records facts about the person's **family or household**, as distinct from facts about the
person themselves (`profile-*`) or about their reproductive history (`fertility-*`).

That last boundary is the one that matters, and it is easy to get wrong:

| | records | example |
|---|---|---|
| **`family-children-count`** | how many children the person **has**, now | 2 |
| `fertility-pregnancy` | each pregnancy and **how it ended** | a miscarriage in 2019 |
| `fertility-delivery` | each **birth**, one event per baby, with per-baby attributes | a live birth, 3.2 kg |

They are not derivable from one another in either direction. A live-birth count from `fertility-delivery`
is not a children count — it misses adopted and step-children, and it counts a child who has since died.
And `family-children-count` carries no dates, modes or per-baby attributes, so it cannot stand in for the
delivery history. A study wanting obstetric history reads `fertility-*`; a study wanting household
composition reads here.

## `repeatable: once`

The latest entry wins. The item is a **current** count, not a history: it is re-recorded when it changes,
and the model keeps only the standing value.

This is why the description reads "Number of children at this date" — `event.time` says when the count
was true, which is what lets a consumer tell a stale entry from a current one.

## `count/generic`, not an HDS type

It uses the **legacy Pryv** `count/generic` rather than a `family/*` type. That is the equivalence rule in
`AGENTS.md` working correctly: a count of children stores the same number either way, so a new type would
be a numerically identical twin, which is forbidden. Reach for the legacy type whenever the quantity is a
plain count with no unit of its own.

## Why the domain is one item

Family structure is a large surface — partners, siblings, household size, caregiving relationships,
family medical history — and none of it has been needed yet. Each would be its own decision, and
**family medical history in particular is not a small addition**: it describes third parties who have not
consented, which is a governance question before it is a modelling one.

Add a child stream under `family` when a real requirement arrives, not in anticipation. `AGENTS.md`:
*"New streams are cheap; adding children under existing parents is cheaper still"* — but neither is free
once published.

## Encoding

No `references` block. A children count maps to SNOMED CT and to LOINC, so this is a gap rather than a
decision. Verify any code against `reference/snomed-db` before adding it.
