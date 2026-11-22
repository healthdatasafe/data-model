# Allergy: allergies and intolerances

What the `allergy` domain covers (4.21.0, plan 133), and how it sits beside its neighbours.

## What exists

Three items, on the root stream itself:

| item | eventType | type | repeatable | stream |
|---|---|---|---|---|
| `allergy-coded` | `allergy/coded-v1` | composite, `allergen` a `datasource-search` field (datasource `allergen`) | unlimited | `allergy` |
| `allergy-basic` | `allergy/basic-v1` | composite, `name` a `text` field | unlimited | `allergy` |
| `allergy-none-known` | `allergy/none-known-v1` | composite, `scope` a `select` field | unlimited | `allergy` |

The first two are an allergen; the third is the statement "no known allergy" ([No known allergy](#no-known-allergy)).

As for `condition`, the root has **no children**: an allergy is identified by its allergen's code, not by a place in
the stream tree. A grant on `allergy` reads every allergy and intolerance of the person; a code filter narrows it.
The basic twin is a name no code was found for, never a coded event with `codes: []`: the coded selection holds at
least one code. Same stream, so one consent unit covers both, as for the medication and procedure twins.

## The construct

An event records **a propensity to react to a substance**: an allergy (immune) or an intolerance (non-immune), with
what is known of it. It is not one reaction: the reactions are part of the record (`reactions`), and the last one is
dated (`lastOccurrence`).

| | records | example |
|---|---|---|
| **`allergy-*`** | what the person **reacts to** | peanut, penicillin |
| `condition-coded` | what the person **has** | asthma |
| `symptom-*` | what the person **reports** at a time | hives today |
| `medication-*` | what the person **takes** | amoxicillin |

An allergy pass kept as a document is the `allergy-record` document kind (`documentKinds.yaml`), on `documents`; the
values read from it land here.

## Content

The two eventTypes are identical but for the allergen (`allergen`, a datasets-service selection `{ label,
description, hdsId, codes[] }`, never a `drug.product`; or `name`, a string). The tests hold them equal.

| Field | Values | FHIR |
|---|---|---|
| `status` (required) | `active`, `inactive`, `resolved` | `clinicalStatus` |
| `verificationStatus` | `unconfirmed`, `confirmed`; absent = not stated | `verificationStatus` |
| `categories` | at least one, unique: `food`, `medication`, `environment`, `biologic` | `category` |
| `type` | `allergy`, `intolerance` | `type` |
| `criticality` | `low`, `high`, `unable-to-assess` | `criticality` |
| `reactions` | at least one `{ manifestations, severity?, notes? }`; `manifestations` at least one `{ text?, label?, codes? }`, each with a text or a label, and `codes` only with a label; `severity` `mild`, `moderate`, `severe` | `reaction[]` |
| `lastOccurrence` | `YYYY`, `YYYY-MM` or `YYYY-MM-DD` | `lastOccurrence` |
| `notes` | string | `note` |

**`status` is required.** The form presets it to `active` (the item format has no default value, so the entry UI
does it); every other writer (a bridge, the MCP import) states it and never defaults it.

**`verificationStatus` is never defaulted to `confirmed`.** Absent means the source did not say. A refuted or
erroneous record has no place: it is not written at all.

**Time.** `event.time` is the onset, at its precision ([PARTIAL-DATES.md](PARTIAL-DATES.md));
`hdsTimePrecision: unknown` when the person does not know when it began, the usual case for a childhood allergy. An
import whose source states no readable onset date writes `unknown` too, with `time` the recording moment: the
source's `recordedDate` when readable and not ahead, else the import moment ([FHIR-MAPPING.md §
AllergyIntolerance](FHIR-MAPPING.md#allergyintolerance-allergies), Import).
**No duration in v1:** `time + duration` is reserved for an abatement, as on `condition-coded`, and the FHIR
rendering refuses an event that carries one. Whether the allergy is still there is said by `status`.

## The form

Both items are composites, so every field above but `reactions` is a form field, defined once and shared by the two
twins (YAML anchors in `definitions/items/allergy.yaml`). Two composite field types arrive with them (4.21.0):
`datasource-search` (with its `datasource`), for `allergen`, and `multi-select`, for `categories`. The build checks
each against the eventType (`src/items.js`).

Two things the entry UI must hold, since the schema refuses the alternative: an empty `categories` selection writes
no `categories` key, never `categories: []` (at least one when present); and `lastOccurrence` is written as `YYYY`,
`YYYY-MM` or `YYYY-MM-DD`, never a full ISO datetime, with a way to enter a year or a month alone.

`reactions` is not a form field: no composite field type holds an array of objects, as for procedure `findings`. A
writer that has reactions writes them itself; the entry UI adds a repeating group later, the stored shape being fixed
now.

## Datasource

`allergen` (`definitions/datasources/allergens.yaml`, endpoint `datasets://allergen`): substances only in v1 (SNOMED
CT substance concepts, drug ingredients and classes included, with RxNorm ingredient codes as extra `codes[]` where
known). It is not federated with the `medication` datasource, which returns products, while an allergy is to an
ingredient or a class; the `{ label, codes[] }` shape takes ATC and RxNorm too, so a merged search later needs no
migration. The datasets-service side is its own task.

`manifestation` (`definitions/datasources/manifestations.yaml`, endpoint `datasets://manifestation`, result key
`manifestations`): what a reaction was (hives, anaphylaxis, wheezing), SNOMED CT clinical findings. An entry UI
writes the selection's `label` and `codes` as one `manifestations[]` entry; a reaction the list does not have is a
`text`. No item field names it (`reactions` is not a form field): it is there for the entry UI's reaction group and
for an importer completing a coded manifestation.

## Reactions

The labels of a reaction's `severity` are the vocabulary `allergy-reaction-severity`
(`definitions/vocabularies/allergy.yaml`): Mild / Légère, Moderate / Modérée, Severe / Sévère. Their FHIR code is
the stored value (`AllergyIntolerance.reaction.severity`, a required binding). The binding path is
`reactions.severity`, with no bracket: a path segment that is an array of objects steps into its items.

What an entry UI must hold, since the schema refuses the alternative:

- no reaction entered writes no `reactions` key, never `reactions: []` (at least one when present);
- a reaction has at least one manifestation: a severity or notes alone is not a reaction;
- a manifestation picked from the list is `{ label, codes }`; one typed is `{ text }` only (`codes` needs a `label`);
- the list's labels are in English only, so a search in French finds little: offer the typed text too;
- the search needs 3 characters (datasets-service answers 400 below that).

## No known allergy

"No known allergy" is a statement clinicians rely on: a blank allergy list is not the same as "none". It is the item
**`allergy-none-known`** (eventType `allergy/none-known-v1`, plan 133), on the same stream, so one consent unit
covers it with the allergies. It is not an allergen: a negation has no onset, carries no criticality or reactions, and
never appears in an allergen search.

| Field | Values | FHIR |
|---|---|---|
| `scope` (required) | `all`, `medication`, `food`, `environment` | `code`: SNOMED CT `716186003` No known allergy, `409137002` No known drug allergy, `429625007` No known food allergy, `428607008` No known environmental allergy |
| `verificationStatus` | `unconfirmed`, `confirmed`; absent = not stated | `verificationStatus` |
| `notes` | string | `note` |

- **`scope`** says what the statement covers: anything (`all`), or one kind of allergen, with the same words as the
  allergy `categories`. `biologic` is left out: SNOMED CT has no concept for it. A narrower scope (latex, insect,
  animal) can be added later as an additive enum value. The form asks for it, with no default.
- **`verificationStatus`** is the allergies' field, with the same rule: absent means not stated, never defaulted to
  `confirmed`; an import keeps the source's value.
- **No `status`, `categories`, `type`, `criticality`, `lastOccurrence` or `reactions`, and no `allergen` or `name`**:
  the eventType refuses them, and the build refuses them on the item. A statement that there is no allergy names none.
- **Time.** `event.time` is when the statement was made (its assertion), never an onset. Its precision is normal,
  never `unknown`. No duration.
- **Is it current?** There is no status: "an inactive no known allergy" would be a double negative. A reader judges
  it on what exists: it is current only if it is the latest one for its scope **and** no active allergy within its
  scope exists (for `all`, any active allergy; for another scope, an active allergy whose `categories` include it, or
  that has no `categories`). One function in hds-fhir-js holds the rule, shared by every reader.

The code of each scope sits in the mapping block, as a code from an enum
([FHIR-MAPPING.md § No known allergy](FHIR-MAPPING.md#no-known-allergy-allergy-none-known)), which also gives the
rendering and the import rules: which "no known allergy" codes and names place here, and which stay refused.

## FHIR

An `AllergyIntolerance` under the bare scope key `AllergyIntolerance`, granted on `allergy`. Rendering and import
rules: [FHIR-MAPPING.md § AllergyIntolerance](FHIR-MAPPING.md#allergyintolerance-allergies).

## Later

- `presumed` (R5) as an additive `verificationStatus` value.
- Other "no known allergy" scopes: `biologic`, latex, insect, animal.
- An abatement as `time + duration`.
