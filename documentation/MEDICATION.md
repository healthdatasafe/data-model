# Medication — coding a medication read from a document

How an importer codes a medication it read from a Swiss document (a prescription, a discharge letter, a medication
plan). Decided in plan 114 (Q31, Q32), from the HEALTH FILES importer's ask. A convention only: no item, stream or
eventType changes.

| Item | eventType | Use |
|---|---|---|
| `medication-intake-coded` | `medication/coded-v1` | a medication matched to a code datasets-service returns |
| `medication-intake-basic` | `medication/basic` | a medication no code was found for: the name as printed, in `name` |
| `medication-prescription-coded` | `medication/prescription-v1` | what was prescribed, same `drug` rules |

## A Swiss brand name

- **`drug.label` is the name as printed** ("Dafalgan 1 g"), the same text in every language the writer sets. A brand
  name is not translated, and the substance name is not substituted for it.
- **`drug.codes[]` carries the ATC code of the substance** (`N02BE01`, paracetamol, for "Dafalgan 1 g").
  datasets-service has no Swiss product source (no Swissmedic or compendium seed), so the product itself has no code;
  add the RxNorm code too when RxNorm has the product.
- **A name the importer cannot match stays `medication-intake-basic`**, with the name as printed. Never a coded event
  with a code that was guessed or built.

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

The printed regimen goes in `intake` on the intake items (`medication/coded-v1`, `medication/basic`) and in `posology`
on `medication-prescription-coded` (`medication/prescription-v1`), with the same fields spelled the same way:
`doseValue`, `doseUnit`, `route`, `frequency`, `asNeeded`, `note`.
