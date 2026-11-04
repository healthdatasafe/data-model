# Medication — intakes, prescriptions, and coding a medication

The medication domain: what an intake event means (one dose, or a period of use), the shared regimen and its timing,
a skipped dose, a stopped medicine, the typed-name prescription, the vocabularies that label the enums, and how an
importer codes a medication read from a Swiss document. The coding rules were decided in plan 114 (Q31, Q32); the rest
in the DM-4 model pass (3.46.0).

| Item | eventType | Use |
|---|---|---|
| `medication-intake-coded` | `medication/coded-v1` | a medication matched to a code datasets-service returns |
| `medication-intake-basic` | `medication/basic` | a medication no code was found for: the name as printed, in `name` |
| `medication-prescription-coded` | `medication/prescription-v1` | what was prescribed, same `drug` rules |
| `medication-prescription-basic` | `medication/prescription-basic-v1` | a prescription no code was found for: the name as written, in `name` (3.46.0) |

Both intake items share the stream `medication-intake`, both prescription items `medication-prescription`, so one
consent unit covers the coded and the typed twin. Neither stream is `singleActivity`: several ongoing periods coexist.

## One intake or a period of use

The `medication-intake` stream holds two kinds of fact, and **the event's `duration` tells them apart**:

| Kind | Event | FHIR | HealthKit |
|---|---|---|---|
| **one intake** (a dose) | no `duration`, or `0` | MedicationAdministration | `HKMedicationDoseEvent` |
| **a period of use** (a regimen) | a `duration`; `null` while ongoing | MedicationStatement (`effectivePeriod`) | `HKUserAnnotatedMedication` |

`duration` is outside `content`, so no schema can check which fields go with which kind. The rule, which readers apply
through one helper (hds-lib `medicationIntakeKind(event)`):

- **on one intake:** `status` and `skipReason` apply; `stopReason` is ignored; of `intake`, **only `doseValue`,
  `doseUnit` and `route` are meaningful** (FHIR `MedicationAdministration.dosage` has `dose` and `route`, no timing),
  and `frequency`, `asNeeded`, `note`, `timeOfDay`, `when`, `bounds` are ignored;
- **on a period:** the whole regimen applies, and `stopReason` once it has ended; `status` and `skipReason` are ignored.

**Writer rule.** A dose written from a period or from the previous dose ("I took them all", the ✓) copies `drug` /
`name` and `doseValue`, `doseUnit`, `route` only, never `status`, `skipReason` or `stopReason`. Older doses that carry a
copied `frequency` stay valid.

A prescription is always a point event (FHIR `MedicationRequest.authoredOn`); its course is `posology.bounds`.

## The regimen: dose, frequency and timing

`intake` (both intake types) and `posology` (both prescription types) are one shape, spelled the same way (plan 114,
site-agents#31; tests `[ITMC1b]`, `[MED-TIM-1]`): `doseValue`, `doseUnit`, `route`, `frequency { times, period,
periodUnit }`, `asNeeded`, `note`, and since 3.46.0:

- **`timeOfDay`**: clock times of the intakes, the person's local wall-clock time, `HH:MM` (`["08:00", "20:00"]`).
  FHIR `Timing.repeat.timeOfDay` (`"08:00"` → `"08:00:00"`).
- **`when`**: moments of the day or times relative to a meal, 19 values mapped 1:1 to FHIR EventTiming (vocabulary
  `medication-when`): `waking` WAKE, `morning` MORN, `noon` NOON, `afternoon` AFT, `evening` EVE, `night` NIGHT,
  `bedtime` HS, `meal` C, `before-meal` AC, `after-meal` PC, `breakfast` CM, `before-breakfast` ACM, `after-breakfast`
  PCM, `lunch` CD, `before-lunch` ACD, `after-lunch` PCD, `dinner` CV, `before-dinner` ACV, `after-dinner` PCV. Every
  EventTiming code except `MORN/AFT/EVE.early/.late`, `PHS`, `IMD`. Closed enum, additive.
- **`bounds`**: the planned course (FHIR `Timing.repeat.bounds[x]`): `duration` + `durationUnit` (boundsDuration,
  both or neither) or `start` / `end` dates (boundsPeriod), never `duration` with `end`. Start defaults to the event
  time; `end >= start` is not validated.

**`timeOfDay` or `when`, never both on one regimen** (FHIR invariant tim-10, enforced by the schema). `timeOfDay` is
what readers schedule from; `when` is the printed wording. Given only `when`, a reader may place reminders at its own
default hours, but never stores them. When a prescription says "before breakfast" and the person sets 07:30, **the
prescription keeps `when` and her intake period carries `timeOfDay`**. For a medicine with no prescription, the printed
wording goes to the period's `note` once she sets clock times. `frequency.times` should equal the number of `timeOfDay`
entries for a daily period: documented, not validated.

**`bounds` and the event's own time.** On an intake period, the event's `time` + `duration` is the *actual* period of
use, and `intake.bounds` is what was *planned*: together they give "until <date>" while the course runs, "ended" when
it is over, "stopped" when the period was closed early. On a dose, `bounds` is ignored. `bounds.duration` is the length
of the **course**, not FHIR's `repeat.duration` (the length of each occurrence: a patch worn 72 h, an infusion over
30 min). If that is ever added, it must not be named `intake.duration`, which would read like the Pryv event
`duration`.

Not modelled yet, additive later: `offset` (minutes before/after a `when`, which FHIR allows only with a non-meal code,
tim-9) and `dayOfWeek` (a weekly methotrexate). `note` carries them meanwhile.

## A skipped dose: `status` and `skipReason`

On one intake (both intake types, top level): **`status`** `taken` | `skipped` (absent = taken, every event before
3.46.0) and **`skipReason`**, only with `status: skipped`: `forgot`, `side-effects`, `not-needed`, `unavailable`,
`declined`, `advised`, `other`. Labels and SNOMED CT in vocabulary `medication-skip-reason`.

**Old readers count a skipped dose as taken.** No writer writes `skipped` before the readers are out: hds-lib with
`isSkipped` / `medicationIntakeKind`, then the webapp reader in one web deploy and one store release; the writer comes
in the next build only (plan 116 `model-pass`).

## A stopped medicine: the period, and the order

Two facts, kept apart as FHIR keeps them:

- **The person's use is the intake period, and it is the canonical answer to "is she taking it now".** Stopping gives
  the open period its `duration` (end = now); the closed period may carry **`stopReason`** (`medical-advice`,
  `side-effects`, `ineffective`, `own-choice`, `other`; absent = ended as planned, or not said). Taking it again is a
  new open period, never a reopened one. A period's start is a fact, or it is marked approximate
  (`clientData.hdsTimePrecision: 'approx'` + `hdsTimeText`, [PARTIAL-DATES.md](PARTIAL-DATES.md)): a period an app
  creates only to close it, starting at the first logged intake, is approximate.
- **The order is the prescription's `status`** (both prescription types, top level): `active`, `stopped`, `completed`
  (FHIR `MedicationRequest.status`, R4 and R5), with `statusChanged` (the day it took effect, needs `status`) and
  `stopReason` (only with `status: stopped`). Written by whoever wrote the prescription. **Absent means not stated**
  (FHIR `unknown`), never active: readers keep judging old prescriptions by their own recency rule.

The person's "I stopped" never edits a doctor-written prescription.

## A typed-name prescription

`medication-prescription-basic` (`medication/prescription-basic-v1`) is the uncoded twin of
`medication-prescription-coded`, as `medication-intake-basic` is of `-coded`: `name` (as written, non-empty), the same
`posology` (byte-identical, test `[MED-RXB-*]`) and the same `status` / `statusChanged` / `stopReason`. Coding it later
is an `events.update` of the same event (type → `medication/prescription-v1`, `name` → `drug.label`). FHIR:
MedicationRequest with `medicationCodeableConcept.text` (R5 `medication.concept.text`) only.

## `drug.codes`: at least one (3.46.0)

`drug.codes` has `minItems: 1` on `medication/coded-v1` and `medication/prescription-v1` (B-2026-10-26-20). **A
medication no code was found for is a `-basic` event, never a coded event with `codes: []`.** Events stored before
3.46.0 with `codes: []` stay readable (readers render the drug by its label); hds-mcp-js, which validates, refuses to
update one until it is migrated to the `-basic` type.

## The `drug` object as the search stores it (3.47.0)

The medication search copies these fields of the picked datasets-service result into `drug`
(`datasources/medications.yaml` `valueFields`); they were stored before 3.47.0 and are now declared, on both coded
types (test `[MED-DRUG-1]`): `label`, `description`, `ingredient`, `strength`, `doseForm`, `route`, `doseUnit`, `codes`,
`hdsId`, and `product` for a pick made as a product. `ingredient`, `strength`, `doseForm`, `route` and `doseUnit` are
**informative copies, string or null** as the service gives them: not normalised (`route` and `doseUnit` are free strings: the service's vocabulary, today within `intake.route` /
`intake.doseUnit`, which may grow past them with a data load and no pack release; an enum here would make such picks
invalid under every older pack), so a reader that needs the regimen reads `intake`, and one that needs the
medicine reads `codes`. `hdsId` is the result's own id (its primary code's). A writer without the search may omit them.

## Vocabularies

The labels and code mappings of the enum values are in the pack's **`vocabularies`** section
(`definitions/vocabularies/medication.yaml`, `vocabularies.json`, schema `json-schemas/vocabulary.json`). The eventType
enum is the contract: each vocabulary lists the fields it labels (`binds`: eventType + dotted path), and the loader
refuses a vocabulary whose values differ from any bound enum (same values, same order). Each value has `label { en, fr
}`, and `fhir` (the FHIR code of the bound element) and/or `snomed` (an SCTID verified active) when coded.

| Vocabulary | Binds | Codes |
|---|---|---|
| `medication-when` | `intake.when`, `posology.when` | FHIR EventTiming (above) |
| `medication-intake-status` | `status` on the intake types | MedicationAdministration.status `completed` / `not-done`; `skipped` SNOMED 1269470004 "Individual dose of drug or medicament not taken" (Missed dose) |
| `medication-skip-reason` | `skipReason` | SNOMED: `forgot` 1303576005 Forgets to take medication · `side-effects` 182897004 Drug declined by patient - side effects · `unavailable` 242990004 Drug not available for administration · `declined` 182895007 Drug declined by patient; `not-needed`, `advised`, `other` uncoded |
| `medication-stop-reason` | `stopReason` on all four types | SNOMED: `medical-advice` 182840001 Drug treatment stopped - medical advice · `side-effects` 395009001 Medication stopped - side effect · `ineffective` 395007004 Medication stopped - ineffective; `own-choice`, `other` uncoded (258147002 "Stopped by patient" is inactive) |
| `medication-prescription-status` | `status` on the prescription types | MedicationRequest.status `active` / `stopped` / `completed` |

The skip-reason codes are members of the value set R5 `MedicationAdministration.statusReason` binds to (example binding; is-a 242990004
∪ is-a 182895007), except `forgot`, a finding about the person. Every SCTID was checked active on the International
release 20260201.

## FHIR and HealthKit

**Regimen → `Dosage`.** `doseValue`/`doseUnit` → `doseAndRate.doseQuantity` · `route` → `route` · `frequency` →
`timing.repeat.frequency/period/periodUnit` · `timeOfDay` → `repeat.timeOfDay` · `when` → `repeat.when` ·
`bounds.duration`/`durationUnit` → `repeat.boundsDuration` · `bounds.start`/`end` → `repeat.boundsPeriod` · `asNeeded`
→ `asNeededBoolean` (R4) / `asNeeded` (R5) · `note` → `text`. **Units:** `h d wk mo` as they are, **`y` → UCUM `a`**.

- **One intake** → MedicationAdministration, `subject` = `performer` = Patient. Taken or absent → `status: completed`,
  `effectiveDateTime` (R5 `occurence[x]`); skipped → `status: not-done` + `statusReason` (the SNOMED coding where one
  exists, else `text`). An exporter preferring MedicationStatement (R4) may write `status: not-taken` instead.
- **A period** → MedicationStatement, `effectivePeriod` from the event's time and duration, `dosage` from `intake`.
  Ended: R4 `status` `stopped` (closed with a `stopReason`, or before the `bounds` end) or `completed`, `statusReason`
  from `stopReason`; R5 has no such status and uses `adherence.code` (`stopped`, `taking`, …) and `adherence.reason`.
- **A prescription** → MedicationRequest, `dosageInstruction` from `posology`, `status` as stored (absent →
  `unknown`), `statusReason` from `stopReason`, R5 `statusChanged`. R5's `ended` is the parent of `stopped`, `completed`
  and `cancelled`: an importer receiving it writes `stopped` when the reason says the order was stopped, else no
  `status`.

**HealthKit (iOS 26 Medications API, read-only for third-party apps in the public docs).**

- `HKUserAnnotatedMedication` → an intake period: `isArchived` → the period has ended; **`hasSchedule == false` →
  `asNeeded: true`**. HealthKit exposes no schedule times: `timeOfDay` is derived from recent dose events'
  `scheduledDate`. No `when`, no `bounds`, no prescription.
- `HKMedicationDoseEvent` → one intake: `doseQuantity` + `unit` → `doseValue`/`doseUnit`. **`scheduleType` is per
  dose** (`.asNeeded` = logged ad hoc, even for a scheduled medicine): never derive the regimen's `asNeeded` from it.
- `logStatus`: `taken` → `taken`; `skipped` → `skipped`, no reason; **`notLogged` (the person undid a logged status) →
  trash the HDS event written for that dose event**; `notInteracted`, `notificationNotSent`, `snoozed` are reminder
  states: write nothing.
- Coding: `HKMedicationConcept.relatedCodings` (RxNorm) **resolved through datasets-service**, so each code entry has
  the service's `hdsId`. No resolvable code → `medication/basic` with `displayText` as `name` and the `nickname`, if
  any, in `intake.note`.

## A Swiss brand name

- **`drug.label` is the name as printed** ("Dafalgan 1 g"), the same text in every language the writer sets. A brand
  name is not translated, and the substance name is not substituted for it.
- **`drug.codes[]` carries the ATC code of the substance** (`N02BE01`, paracetamol, for "Dafalgan 1 g"). Add the
  RxNorm code too when RxNorm has the product. A product picked through the search adds `drug.product` (below).
- **A name the importer cannot match stays `medication-intake-basic`** (or `medication-prescription-basic`), with the
  name as printed. Never a coded event with a code that was guessed or built.

## The ATC `hdsId`

datasets-service builds every id with `buildHDSId` (`services/datasets-service/src/lib/hdsId.ts`):

```
S:<system>/k:<sourceKey>/C:<code>[/X<key>:<value>]*
```

- **ATC** (`src/loaders/atc-who.ts`, the committed WHO seed `datasets/WHO-ATC/WHO ATC-DDD 2024-07-31.json`): system
  `ATC`, source key `WHO`, and the extras `admRoute` (the WHO route code: `O`, `P`, `R`, `SL`, `TD`, `V`, `N`,
  `Inhal`, `Instill`, `Implant`) and `dosageValue` (the DDD), in that order, each only when the seed row has one. So
  `S:ATC/k:WHO/C:N02BE01` is the form of a row with neither, and the oral row of a code with a DDD reads
  `S:ATC/k:WHO/C:N02BE01/XadmRoute:O/XdosageValue:<DDD>`.
- **RxNorm** (`src/loaders/rxnorm.ts`): `S:RxNorm/k:NLM/C:<rxcui>`, no extras.

**Always an id the service returns, never constructed.** The extras come from the seed row, so an id built by hand
from the code alone would not match the row and would not group with events entered through the search.

**Which row.** An ATC code has one row per route and DDD in the seed. Take the row whose `admRoute` matches the printed
route (the loader's route map: `O` oral, `P` parenteral, `R` rectal, `SL` sublingual, `TD` transdermal, `V` vaginal,
`N` nasal, `Inhal` inhalation, `Instill` ophthalmic, `Implant` subcutaneous); when no route is printed or none
matches, the service's first row for that code.

The code entry is the one datasets-service returns, with the short system name, not a URI (as
[CONDITION.md](CONDITION.md#codeshdsid-when-a-writer-codes-without-datasets-service) describes for SNOMED CT):

```json
{ "code": "N02BE01", "system": "ATC", "source": { "key": "WHO" }, "hdsId": "<as returned by the service>" }
```

## National products: `drug.product` (3.47.0)

Brand and product names (plan 120). datasets-service holds the national products of Switzerland (Swissmedic) and
France (BDPM): a search for a brand ("Dafalgan", "Doliprane") returns the product's **coded medicine** (ATC / RxNorm /
SNOMED CT codes, as for any pick) under the brand's name, plus the product it was found as. The medication search (`datasources/medications.yaml`)
copies that product into the event as **`drug.product`**, next to `drug.codes`, on `medication/coded-v1` and
`medication/prescription-v1` (the same schema on both, test `[MED-PRD-1]`). It is never a top-level property, which a
search form would show as a field. Absent when the medicine was not picked as a product.

```json
{
  "drug": {
    "label": { "en": "Metfin 500 mg, Filmtablette", "de": "Metfin 500 mg, Filmtablette" },
    "description": { "en": "metformin hydrochloride 500 MG Oral Tablet" },
    "codes": [
      { "code": "861007", "system": "RxNorm", "source": { "key": "NLM" }, "hdsId": "S:RxNorm/k:NLM/C:861007" },
      { "code": "A10BA02", "system": "ATC", "source": { "key": "WHO" }, "hdsId": "<as returned by the service>" }
    ],
    "product": {
      "name": "Metfin 500, Filmtabletten",
      "label": { "de": "Metfin 500 mg, Filmtablette" },
      "brand": "Metfin",
      "strength": "500 mg",
      "country": "CH",
      "system": "Swissmedic",
      "code": "5535101",
      "hdsId": "S:Swissmedic/k:Swissmedic/C:5535101"
    }
  }
}
```

| Field | Required | Content |
|---|---|---|
| `name` | yes | the name as on the box, in the source language |
| `label` | yes | the display name (brand + strength + dose form), keyed by the language it is in (`de`, `fr`, `it`, `en` today): `{ "fr": … }`. Not a localizable text: it may have no `en`, so it is read as it is, never through `localizeText` |
| `brand` | no | the brand alone ("Metfin") |
| `strength` | no | the label strength as displayed ("500 mg", "500/125 mg"), or null |
| `country` | yes | ISO 3166-1 alpha-2 |
| `system` | yes | a **product-level** system: `Swissmedic` or `CIS` (a schema enum: a pack-level system is refused) |
| `code` | yes | the product code in `system` |
| `hdsId` | yes | as returned by datasets-service, never constructed |

**`drug.label` keeps one meaning: the name the person knows the medicine by.** For a pick made as a product it is the
brand display name, the same text under `en` and the product's language ("Metfin 500 mg, Filmtablette"), and the coded
medicine's own name is in `drug.description`; for a pick made as a generic it is the generic's name; for an importer it
is the name as printed (§ A Swiss brand name). So every reader keeps showing `drug.label`. **`drug.product` is the only
sign that a national product was picked**: it adds the national code and the box name (`name`), and repeats the display
name in `label` with its language key, so the product object stands on its own. Analytics and FHIR use `drug.codes`,
which keeps `minItems: 1`: a product never replaces the coded medicine.

**A brand name written without the search** (an importer, a typed name) is unchanged: `drug.label` is the name as
printed and the codes are the substance's (§ A Swiss brand name). Such a writer sets `drug.product` only from a product
datasets-service returned.

**Code systems**, with their level. `codes[].system` stays a free string; `drug.product.system` takes the product
level only, as an enum. **A new product system (or country) ships in data-model first**; datasets-service returns it
only once consumers have the pack that lists it, because an event whose `product.system` is outside the enum is invalid
under every older pack (hds-mcp-js and any client validate against their pinned pack).

| `system` | Country | Level | Code | `hdsId` |
|---|---|---|---|---|
| `Swissmedic` | CH | product | authorisation number (5 digits) + sequence (2 digits), e.g. `5535101`; one authorisation covers several strengths, the sequence picks one | `S:Swissmedic/k:Swissmedic/C:<code>` |
| `CIS` | FR | product | CIS (BDPM) | `S:CIS/k:ANSM/C:<code>` |
| `GTIN` | CH | pack | GTIN-13 of one pack | (not returned by datasets-service yet) |
| `CIP13` | FR | pack | CIP13 of one pack | (not returned by datasets-service yet) |

Packs are not part of `drug.product`: a pack would be its own additive field when datasets-service returns packs.
FHIR: the product maps to a second `coding` of the medication concept and its name to `CodeableConcept.text`; the
national system URIs are left to the exporter work (FHIR-MAPPING.md § Medications: no block yet).
