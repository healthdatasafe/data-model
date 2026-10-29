# Blood chemistry — design decisions

How HDS models blood analytes, and why. Driven by a reported gap: the model had **no blood-chemistry
domain at all** — the only `body-blood*` node was `body-blood-pressure` (a vital sign), and the sole
body-fluid items were 5 urine hormones and 8 semen indices.

Scope is the serum/plasma chemistry, CBC and hormone panels a fertility or reproductive-health
application meets in ordinary lab reports.

## Stream tree

```
body/
  body-blood-pressure          ← VITAL SIGN. A sibling, not a child (see the wart below)
  body-blood/
    body-blood-serum/          ← serum / plasma analytes (most of the domain)
    body-blood-cbc/            ← whole blood — complete blood count
    body-blood-rbc/            ← erythrocyte specimen (RBC magnesium)
    body-blood-hba1c           ← whole blood, not serum — hence the direct placement
    body-blood-coded           ← results with no item of their own (lab-result/coded-v1)
  body-urine/
    body-urine-hormones/       ← urine hormone assays
    body-urine-coded           ← results with no item of their own
  body-csf/
    body-csf-coded             ← cerebrospinal fluid results (lab-result/coded-v1)
```

Three blood specimens, not one. `body-blood-rbc-magnesium` and `body-blood-serum-magnesium` are the
same analyte in **different specimens** — different observations with different reference ranges, which
is precisely why specimen is in the key (below).

`body-blood` follows the existing specimen-rooted pattern (`body-urine`, `body-semen`).

### ⚠️ `body-blood-pressure` is not part of this domain

It is a **vital sign**, a direct child of `body`, and it holds the `body-blood-*` prefix — so it *looks*
like a child of `body-blood` but is a sibling.

- **Safe:** nothing resolves by string prefix. D3 context resolution walks the real stream tree
  (`getAncestorsById`), and authorizations use parent-covers-child on the same tree.
- **The trap:** "grant access to all `body-blood` data" reads as covering blood pressure. It does not.
- **Not fixable:** the stream is published and holds data; renaming it would break existing events.

## Specimen is explicit in the item key

**Serum and urine assays of the same hormone are different observations** with different reference
ranges. They cannot share an item, and a neutral key that silently means one of them is a trap.

SNOMED agrees — it codes the specimen as part of the procedure:

| Analyte | Urine | Serum |
|---|---|---|
| LH | `167381004` Urine luteinizing hormone measurement | `273969007` Serum luteinizing hormone measurement |
| FSH | `167382006` Urine follicle stimulating hormone measurement | `273971007` Serum follicle stimulating hormone measurement |

So the keys say so too: `body-urine-hormones-fsh` vs `body-blood-serum-fsh`. Every key equals its
`streamId`, the dominant convention in this repo.

**History.** These were `fertility-hormone-*` — a key prefix that matched neither the stream
(`body-urine-*`) nor the specimen. They were **renamed** in place. Deprecate-and-twin was *not*
available: the loader (`src/items.js`) rejects two items sharing a `streamId:eventType` pair, and a
renamed twin keeps both. The exception was LH, whose eventType changed (below).

**Renaming an item key does not touch stored data** — events carry `streamId` + `type`, and `forEvent`
resolves on that pair. It breaks *consumer code* that references the key, which is why it is a
coordinated release (see `AGENTS.md` → cross-repo relationships).

## Units

Reported units, not SI-normalised ones: a clinician-facing value stored in an alien scale is worse than
no value. Every analyte stores the number as the lab prints it.

| Concern | Decision |
|---|---|
| **Cell counts** | `concentration/megacount-ml` (10⁶/mL) carries WBC and platelets — × 10⁹/L is × 10⁶/mL, so 3.4–10.8 and 150–400 store as printed. RBC is × 10¹²/L ≡ × 10⁹/mL, which would be 4300–4800 on that unit, so **`concentration/gigacount-ml`** exists for it: 4.3–4.8. The mixed-unit panel *mirrors the report*, which genuinely prints RBC in × 10¹²/L and WBC in × 10⁹/L. The display symbols follow the report too: `megacount-ml` shows `G/L`, `gigacount-ml` shows `T/L`. |
| **Percentages** | Lab percentages are genuine fractions (HbA1c is the glycated fraction of total hemoglobin; hematocrit the packed-cell fraction), so they store `0..1` on `ratio/proportion` and render via `number.display.multiplier: 100`. The `0..1` bound is enforced, and fractions match Apple HealthKit's `HKUnit.percent()`. FHIR/LOINC export applies the × 100 in the mapper. |
| **ng/mL** | Not a unit here: **1 ng/mL = 1 μg/L**, so ferritin, folate, 25-OH-D, C-peptide, AMH, thyroglobulin, progesterone, prolactin and total testosterone (its third option) use the legacy `concentration/ug-l` with the identical stored number. Adding `ng-ml` would have split one measurement across two type names. See the no-equivalent-types rule in `AGENTS.md`. Likewise **1 ng/L = 1 pg/mL**: a PTH printed in ng/L stores its number unchanged on `concentration/pg-ml`. |
| **SI units as variations** | An analyte that labs print in two units offers both as `variations.eventType` options, conventional unit first (the unit the item had), SI unit second: `body-blood-serum-glucose-fasting` from the start; since the lab-units release (3.21.0) the lipids, calcium, creatinine, the reproductive, adrenal and thyroid hormones, vitamin D (both forms), B12 and folate (site-agents#20); since 3.30.0 magnesium, total bilirubin, iron, TIBC, zinc, copper, vitamin A, C-peptide, PTH (pmol/L), hemoglobin, albumin, total protein and globulin (g/L), hs-CRP (mg/dL), ceruloplasmin (mg/L) and urea on `body-blood-serum-bun` (below). The writer picks the option matching the **printed** unit; nothing is converted at write time. One type was added for it, `concentration/pmol-l` (no pryv type exists; it is a decade apart from `nmol-l`, so not an equivalent twin). On a `ug-l` item the option label reads **ng/mL**, how those analytes are printed; such items no longer carry an item-level `number.display.suffix`, which renderers apply whatever the unit and would put "ng/mL" on a pmol/L value (`[UCNV-VAR-3]`). A third unit is appended after the two, never inserted before them: total testosterone offers ng/dL, nmol/L, then ng/mL; C-peptide ng/mL, nmol/L, then pmol/L; ceruloplasmin mg/dL, mg/L, then g/L. |
| **Urea and urea nitrogen** | `body-blood-serum-bun` stores **urea nitrogen** in mg/dL (BUN, LOINC `3094-0`) and **urea** in mmol/L (option "Urea mmol/L", LOINC `22664-7`): labs that report in SI print urea, not its nitrogen, and one mole of urea carries two nitrogen atoms, so mg/dL → mmol/L is 10 / 28.014 = 0.3570. **Urea printed in mg/dL** (the mass of urea, LOINC `3091-6`, as some European labs print it) is not this item's mg/dL, which would read it 2.14 times too high, and it has no option of its own: the two would share `concentration/mg-dl`. Store it as printed in `lab-result/coded-v1` under `3091-6` with UCUM `mg/dL`; it is never converted into the item. |
| **Endocrine reporting units (2.1.0)** | The reproductive/adrenal & thyroid extension added `concentration/ng-dl` (T3/T4, testosterone, androstenedione, 17-OHP, aldosterone), `concentration/nmol-l` (SHBG), `concentration/iu-ml` (TPO & thyroglobulin antibodies), `concentration/u-ml` (CA-125) and `rate/mm-h` (ESR). Each is a genuine scale difference from its nearest existing type (`ng-dl` ≠ `mcg-dl`/`pg-ml`/`ug-l`; `iu-ml` = 1000× `iu-l`; `u-ml` = 1000× `catalytic-activity/u-l`; `nmol-l` ≠ `umol-l`), not an equivalent twin. CA-125 is `concentration/u-ml`, **not** `catalytic-activity/u-ml`: the "U" is an arbitrary immunoassay unit, and `catalytic-activity/*` is reserved for the liver enzymes. |

## Unit conversions

Once an item offers two units, a reader that compares, charts or trends its values, or checks one
against a reference interval printed in the other unit, needs a factor. The factor is **per
analyte** (it comes from the analyte's molar mass), so there is no generic mg/dL ↔ mmol/L, and two
readers with two tables would give two verdicts for one stored value. The model therefore publishes
the factor on the item (site-agents#21). **It is for reading only:** stored values stay as printed,
and a reader that converts for display or comparison never writes the converted number back.

### Where it lives

On the itemDef, next to `variations`, as `unitConversions`. It is a plain JSON field of the item, so a
reader that does not use hds-lib finds it in the published `pack.json` (`pack.items[<itemKey>]`) and in
`items.json` (`items[<itemKey>]`), at `https://model.datasafe.dev/`. Its shape is in the published
item schema (`json-schemas/item.json`, `properties.unitConversions`).

```json
"body-blood-serum-cholesterol-total": {
  "variations": { "eventType": { "options": [
    { "value": "concentration/mg-dl", "label": { "en": "mg/dL" } },
    { "value": "concentration/mmol-l", "label": { "en": "mmol/L" } } ] } },
  "unitConversions": {
    "factors": [
      { "from": "concentration/mg-dl", "to": "concentration/mmol-l", "factor": 0.02586,
        "molarMass": 386.66,
        "source": "Molar mass of cholesterol, C27H46O, 386.66 g/mol (PubChem CID 5997; IUPAC standard atomic weights)" } ]
  }
}
```

### Fields

| Field | Meaning |
|---|---|
| `factors[]` | The pairs a reader may convert between. |
| `factors[].from`, `.to` | **Full eventType ids** of the item (`concentration/mg-dl`), never a unit token or a printed symbol. Both are among the item's `variations.eventType` options. |
| `factors[].factor` | `value in to = value in from × factor`. A finite number above 0, published to 4 significant figures. Multiplicative only. |
| `factors[].molarMass` | Optional. The molar mass (g/mol) the factor derives from, so it can be checked (`[UCNV-FAC-4]`). Absent between two units of one kind (g/dL ↔ g/L), where the factor is the exact ratio of the units (`[UCNV-FAC-8]`). For urea nitrogen it is the nitrogen in one mole of urea, 28.014 g/mol. |
| `factors[].source` | Required. Where the factor comes from, citable. |
| `notConvertible[]` | Pairs whose values must **never** be converted or compared: the two units do not measure on one scale for every assay. |
| `notConvertible[].from`, `.to` | Full eventType ids, as above. Order carries no meaning. |
| `notConvertible[].reason` | Required. Why the pair is not convertible. |

### How a reader finds a factor

Given an event of type `A` on an item and a target type `B` (both eventType ids):

1. `A === B`: no conversion.
2. An entry of `unitConversions.factors` with `from = A, to = B`: multiply by `factor`.
3. An entry with `from = B, to = A`: **divide** by its `factor`. Each pair is published once, in one
   direction; the reverse is never a second entry (the loader refuses one, so the two cannot disagree).
4. An entry of `unitConversions.notConvertible` with the pair in either order: the values are **not
   comparable**. Show each in its own unit; do not trend them on one axis or compare one against an
   interval printed in the other unit.
5. None of the above (or no `unitConversions` at all): **no factor is published yet**. Treat the pair as
   not convertible until the model publishes one; do not substitute your own factor silently.

A pair appears at most once across `factors` and `notConvertible`, so "not comparable" (step 4) and
"not yet published" (step 5) are always distinguishable.

### What stays out, by rule

- **Assay- or calibrator-dependent pairs**: insulin µIU/mL ↔ pmol/L (6.0 and 6.945 are both in use),
  prolactin ng/mL ↔ mIU/L (depends on the international standard), IU-based antibodies. These items
  offer both units, store as printed, and carry the pair in `notConvertible`. No factor ever crosses
  between an IU-based unit and a mass or molar one (`[UCNV-FAC-2]`).
- **Affine relations**: HbA1c % (NGSP) ↔ mmol/mol (IFCC) is `10.929 × (NGSP − 2.152)`, not a factor.
  `body-blood-hba1c` does not offer the IFCC unit.

### Sources

Mass ↔ molar factors derive from the analyte's molar mass, computed from its molecular formula with
IUPAC standard atomic weights and identified by its PubChem CID. Where clinical practice expresses an
analyte as a reference substance, the convention is used and the source says so: triglycerides as
triolein, total 25-OH vitamin D as 25-hydroxyvitamin D3, vitamin B12 as cyanocobalamin, folate as folic
acid, vitamin A as retinol, TIBC as the iron bound. These agree with the usual SI conversion tables to the published
precision. A peptide's molar mass (intact PTH 1-84, C-peptide) is computed from its UniProt sequence with the same atomic
weights, and the source names the accession and chain. A factor between two units of one kind (g/dL ↔ g/L, mg/L ↔
mg/dL, ng/dL ↔ µg/L) is exact by the definition of the units. An item with three units publishes every pair, and the
pairs agree (`[UCNV-VAR-4]`, `[UCNV-FAC-9]`).

AMH offers pmol/L but has **no factor yet**: the usual 7.14 pmol/L per ng/mL is a manufacturers'
convention (from a 140 kDa molar mass), and a citable primary source is still to be recorded.

## The printed reference range, flag and interpretation of one result

The model holds no reference range per analyte (see "Deliberately absent"), but a lab report prints one next
to each value, often with a flag (`H`, `L`, `*`). That printed range belongs to **the result**, not to the
analyte: it is the lab's, for its assay and for this patient. A reader needs it to display the result as the
report did, and FHIR export needs it for `Observation.referenceRange` and `Observation.interpretation`
(site-agents#29). It is carried per event, in `clientData`:

```json
{
  "streamIds": ["body-blood-serum-ferritin"],
  "type": "concentration/ug-l",
  "content": 412,
  "clientData": {
    "hdsRefRange": { "lowerLimit": 30, "upperLimit": 400, "text": "30 - 400 ng/mL" },
    "hdsFlag": "H",
    "hdsInterpretation": "H"
  }
}
```

| Key | Type | Meaning |
|---|---|---|
| `hdsRefRange.lowerLimit` | number, optional | Lower limit as printed, **on the stored scale of the value** (see the rules). |
| `hdsRefRange.upperLimit` | number, optional | Upper limit as printed, on the stored scale of the value. |
| `hdsRefRange.text` | string, optional | The range exactly as printed (`"30 - 400 ng/mL"`, `"< 5.0"`, `"36 - 46 %"`, `"negative"`). |
| `hdsFlag` | string, optional | The flag exactly as printed (`H`, `L`, `*`, `+`, `↑`). |
| `hdsInterpretation` | `H`, `L`, `N`, `A`, `HH`, `LL`, optional | The printed flag, normalised to HL7 v3 ObservationInterpretation: high, low, normal, abnormal, critically high, critically low. |

`hdsRefRange` carries at least one of its three fields. The limit names are the item-level
`referenceRange`'s (`lowerLimit`, `upperLimit`); `source` and `population` stay item-level only, since a
printed range is the lab's by definition.

**Rules.**

- **Limits are on the stored scale of the value.** The event's eventType is its unit, and the limits share it,
  so there is no `units` key that could contradict it. On a `ratio/proportion` item the value is stored as a
  fraction (Units, above), and so are the limits: a printed `36 - 46 %` is `lowerLimit: 0.36`,
  `upperLimit: 0.46`, exactly as the value 41 % is stored as `0.41`; `text` keeps the printed form. A range
  printed in another unit than the value (rare) is kept as `text` only, without limits: nothing is converted
  between units at write time.
- **A one-sided range** has one limit (`"< 5.0"` is `upperLimit: 5`). A qualitative range (`"negative"`)
  is `text` only.
- **`hdsInterpretation` is the lab's verdict, never the importer's.** Write it only by normalising a flag
  the lab printed (or an explicit "normal" the lab printed). Do not compute it from the value and the
  range: the lab may judge against limits it did not print (age, sex, cycle phase), a censored value
  (site-agents#22) does not compare simply, and a stored code looks like the lab's own statement. **No flag
  printed means no `hdsInterpretation`, not `N`.** A reader that wants a verdict where the lab gave none
  compares the value with `hdsRefRange` at read time and labels the result as its own.
- **Mapping a printed flag:** `H`, `↑` → `H`; `L`, `↓` → `L`; `HH`, `!!` (or "critical" high) → `HH`; `LL` (or
  "critical" low) → `LL`; `*`, `!` (abnormal, no direction) → `A`; a printed "normal" → `N`, which may then come
  without `hdsFlag`. A flag that maps to no code, or whose meaning is ambiguous (`+` means "high" on some reports and
  "positive" on others), is kept in `hdsFlag` alone.
- **An unknown `hdsInterpretation` value is read as absent**, so the list can grow by addition (qualitative codes
  such as `POS` / `NEG` when qualitative results are modelled).
- **Readers prefer the printed range** to the item-level `referenceRange` when an event carries one: the
  item-level range is a population reference (WHO 2021 for semen analysis), the printed one is the lab's for
  this result.
- These keys apply to any lab result, whichever the domain (`body-blood-*`, `body-urine-*`,
  `body-semen-*`).

**Cross-system.**

| HDS | HL7 FHIR R4 / R5 |
|---|---|
| `hdsRefRange.lowerLimit`, `.upperLimit` | `Observation.referenceRange.low`, `.high` (a `Quantity` in the value's unit) |
| `hdsRefRange.text` | `Observation.referenceRange.text` |
| `hdsInterpretation` | `Observation.interpretation`, system `http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation` |
| `hdsFlag` | `Observation.interpretation.text` |

### Not keys: the printed value, the printed unit and a conversion

site-agents#29 also asked for `printedValue`, `printedUnit` and `conversion`, for when the importer had to
convert a value to fit the item. These are **not defined**, because a stored value is never converted
(Units, above): the event's content is the printed figure and its eventType is the printed unit, so each of
the three would duplicate the event or record a conversion that must not happen.

What covers the need, when the lab printed a unit the item does not offer:

1. **Ask for the unit as a variation of the item** (an issue on site-agents). Adding a unit is additive and
   is released quickly (#20 and #27 are the precedent); the value is then stored as printed on the item.
2. **Meanwhile, store it as printed in `lab-result/coded-v1`** (site-agents#28), with its UCUM unit, and move it
   to the item once the variation ships (§ Moving a result to its item). Nothing on the report is lost and nothing
   is converted.

## A censored value: `hdsComparator`

A lab prints some results as a limit rather than a figure: `< 1.5` (below what the assay measures), `> 2000` (above
its range). The marker was tested and the result is real, but the figure is a bound (site-agents#22). The event
stores the limit as `content`, in the eventType of the printed unit as always, and says that it is a limit in
`clientData.hdsComparator`:

```json
{
  "streamIds": ["body-blood-serum-ferritin"],
  "type": "concentration/ug-l",
  "content": 1.5,
  "description": "< 1.5 ng/mL",
  "clientData": { "hdsComparator": "<" }
}
```

| Key | Values | Meaning |
|---|---|---|
| `hdsComparator` | `<`, `<=`, `>`, `>=` | `content` is a limit: the true value is below / at most / above / at least it. Absent: the value is exact. |

**Every reader of a numeric lab event must check it before using the value as exact.** A reader that ignores it
reads `< 1.5` as an exact 1.5, in a chart, a trend, an average or a FHIR export: the value is silently wrong.

- **Display:** the comparator before the value (`< 1.5 ng/mL`); hds-lib `eventToShortText` does it (2.28.0).
- **Charts and statistics:** a censored value is never plotted or averaged as exact. Mark it (an open marker at the
  limit) or leave it out, and say which (hds-lib `isExactLabValue`).
- **An unknown value** of `hdsComparator` means the value is not exact either.
- **Unit conversion** (§ Unit conversions) applies to the limit with the same factor; the comparator is kept.
- **Writers** also put the printed result in the event `description` (`< 1.5 ng/mL`), so a reader that knows no HDS
  key still shows that the figure is not exact.
- **A limit with no figure** (`< LOQ`, "below detection limit") is not a numeric event: it is a `valueText` in
  `lab-result/coded-v1`.
- **`hdsInterpretation` is unaffected:** it stays the lab's printed flag; a censored value is never compared with the
  range by the importer.
- On `lab-result/coded-v1` the comparator is content (`comparator`, validated); `clientData.hdsComparator` is not
  written there and is ignored if present.
- FHIR: `Observation.valueQuantity.comparator`, same four codes (hds-lib `labValueToFhir`).

## Results with no item of their own: `lab-result/coded-v1`

After the common analytes, records carry a long tail: drug levels, viral loads, blood gases, serologies,
electrophoresis fractions, cerebrospinal-fluid chemistry. One item per analyte would explode the stream tree and the
consent screen, so these results are coded **in content**, like `condition/coded-v1` (site-agents#28), in one stream
per specimen: `body-blood-coded`, `body-urine-coded`, `body-csf-coded`.

```json
{
  "streamIds": ["body-blood-coded"],
  "type": "lab-result/coded-v1",
  "content": {
    "analyte": {
      "label": { "en": "HIV-1 RNA (viral load)" },
      "codes": [{ "system": "http://loinc.org", "code": "20447-9",
                  "display": "HIV 1 RNA [#/volume] (viral load) in Serum or Plasma by NAA with probe detection" }]
    },
    "value": 20, "comparator": "<", "unit": "{copies}/mL", "unitText": "copies/mL"
  },
  "clientData": { "hdsRefRange": { "text": "< 20 copies/mL" } }
}
```

| Field | Meaning |
|---|---|
| `analyte.label` | The test name, by language (`en` required, `fr`, `es`). |
| `analyte.codes[]` | FHIR Codings `{ system, code, display?, version?, hdsId? }`; `system` is a canonical URI. A LOINC code (`http://loinc.org`) whenever one fits, verified as in § Codes; otherwise the lab's or the writer's own code system: a URL it controls, else a fixed `urn:uuid:` (or the lab's `urn:oid:…`), the same value on every event. `hdsId` only when a datasource provides the test (none does yet; a datasource that does emits URI systems). |
| `value` | The figure as printed. Requires `unit`. |
| `unit` | The **UCUM code** of the printed unit: case-sensitive, printable ASCII (`umol/L`, not `µmol/L`; `10*9/L`; `{copies}/mL`; `1` when unitless). |
| `unitText` | Optional: the unit exactly as printed (`µmol/l`, `mUI/mL`), for display. Readers show it when present, else a readable form of `unit` (hds-lib `labUnitText`). |
| `comparator` | `<`, `<=`, `>`, `>=`: `value` is a limit (§ A censored value). |
| `valueText` | The result exactly as printed when it is not only a number (`negative`, `détecté`, `1:160`, `< LOQ`). |
| `valueCodes[]` | Optional, with `valueText`: the qualitative result as FHIR Codings, a SNOMED CT qualifier value (positive, negative, detected, not detected, …) and the lab's own result code when it printed one. |
| `notes` | The comment printed with the result (`haemolysed sample`). |

At least one of `value` and `valueText`. Both together are a semi-quantitative result (an index `3.2` read as
`positive`), or a figure whose printed form a number loses (`0.10`: a JSON number drops the trailing zero, so a
writer that needs the printed digits keeps them in `valueText`). Every object is closed (`additionalProperties:
false`): a misspelt `comparitor` fails validation instead of silently dropping its meaning.

**Rules.**

- **Never an analyte an item owns.** A result whose analyte and specimen have an item goes to the item, in its printed
  unit's variation. An item owns the LOINC codes in its `references.loinc`, one owner per code (`[LABC-LOINC-1]`). The
  one exception is the interim of § Not keys: the item lacks the printed unit; the result moves to the item once the
  variation ships. A whole-blood sodium (`2947-0`, a blood-gas analyser) is not the serum sodium item's analyte: the
  specimen is part of the analyte (§ Specimen is explicit in the item key).
- **LOINC is per property.** Mass and substance concentrations of one analyte have different codes (bilirubin
  `1975-2` mass, `14631-6` substance). An item lists in `references.loinc` the code of every property its variations
  store; until codes are per variation, a FHIR export puts no `code.coding` on an item event whose item asserts more
  than one code.
- **Stored as printed, never converted.** No variations, no factors. A reader never converts a coded value, and draws
  a series only from events with the same code and the same `unit` (hds-lib `labSeriesKey`).
- **Reference range, flag, interpretation:** the `clientData` keys of § The printed reference range, unchanged; the
  limits are in `unit`.
- **No specimen field:** the stream gives the specimen family and the LOINC code the precise specimen. A `specimen`
  property would be additive later.
- **Only curated codes.** A writer codes the analyte from a table it maintains, never from unrecognised text (an
  unrecognised result stays in the source document).
- **Derived indices** printed by the lab (anion gap, corrected calcium, calculated osmolality) are stored here under
  their own LOINC, as printed: no item owns them (plan 114 Q5). They are never computed into this stream.
- hds-lib `checkLabResultCoded` warns about `owned-by-item`, `no-loinc` and `invalid-loinc` (check digit).

**Consent.** The coded streams sit under their specimen, so a grant on `body-blood` (or `body-urine`, or `body`)
covers every result of that specimen, including infectious serology, viral loads and drug levels. Consent screens name
such a grant "Blood and everything under it" (hds-lib `permissionLabels`); an app that needs fewer results requests
the item streams it needs, never the specimen.

### Moving a result to its item

When the item gains the printed unit, a result stored meanwhile in `lab-result/coded-v1` moves with **`events.update`
in place**, never trash and re-create: the event id stays (so `clientData.related` links from documents stay valid),
`clientData.sourceKey` stays (so a re-run still recognises it), and the history records the old type.

| `lab-result/coded-v1` | the item's event |
|---|---|
| `type` | the variation's eventType |
| `streamIds` | the item's stream |
| `content.value` | `content` |
| `content.comparator` | `clientData.hdsComparator` |
| `clientData.hdsRefRange`, `hdsFlag`, `hdsInterpretation` | kept (same unit) |
| `content.notes` | appended to `description`, after the printed result (`< 1.5 ng/mL; haemolysed sample`) |
| `content.analyte`, `unit`, `unitText` | dropped (the item and its variation say it) |

Only results with a `value` and no `valueText` move: an item event has no place for the printed text, so a
qualitative or semi-quantitative result stays coded. The move is a separate step of the importer, run after a
data-model release, with contribute access on both streams.

### The three items

`body-blood-coded`, `body-urine-coded` and `body-csf-coded` (`type: imported`, `lab-result/coded-v1`,
`repeatable: unlimited`, no references: the code is per event) are in `definitions/items/body.yaml` since 3.28.0;
3.27.0 shipped the eventType and the streams first. Readers need hds-lib ≥ 2.28.0 and hds-forms-js ≥ 0.24.0: an
older build lists an `imported` item in its pickers, breaks its form, and shows a coded result or a censored value as
a bare number. A writer that restated the items in its overload under 3.27.0 can drop the restatement; until it does,
the overload keeps loading (its immutable fields are identical).

**Cross-system.** FHIR `Observation`: `code.coding` ← `analyte.codes`, `code.text` ← `analyte.label`;
`valueQuantity` ← `value`, `comparator`, `unit` as `code` with system `http://unitsofmeasure.org`, `unitText` (or the
readable code) as `unit`; else `valueCodeableConcept` ← `valueCodes` with `valueText` as its `text`, else
`valueString` ← `valueText`. A semi-quantitative result exports its `valueQuantity`, and its `valueText` as a `note`;
`note` ← `notes`; `category` `laboratory`; `referenceRange` / `interpretation` from `clientData` as above.
`Observation.specimen` is a Reference, not exported: the LOINC System axis carries the specimen.

## Sample context

The context a sample needs is **not** one mechanism — it decomposes, and the model already answers most
of it:

| Context | Where it lives |
|---|---|
| **Cycle day** (Day 2–5, mid-luteal, Day 21) | **Derived** from `event.time` + `fertility-cycles-start`. Storing it would duplicate state the model already holds, and duplicated state goes stale. Same argument as spotting in [`MENSTRUAL-CYCLE.md`](./MENSTRUAL-CYCLE.md). |
| **Fasting** | Its **own item** (`body-blood-serum-glucose-fasting`). SNOMED codes fasting (`167087006`) and random (`167086002`) serum glucose as different procedures, and LOINC likewise — they are different observations, not one observation with a flag. Precedent: `body-temperature-basal` vs `body-temperature`. |
| **Time of day** (cortisol 6–9am vs 12–3pm) | `event.time` already carries it. |
| **HRT** | `medication-intake-coded`. |
| **Menopausal status** | **Not modelled, and not sample context** — it is durable patient state that outlives any draw. Belongs to its own plan. |

Note the schema's `variations` block supports **`eventType` only**. The `measure-detail` variation in
[`DESIGN-NOTES.md`](./DESIGN-NOTES.md)'s body-weight example is aspirational — it is not implemented.

## Deliberately absent

- **Reference / "optimal" ranges.** They vary by lab, assay and population, and functional-medicine
  "optimal" bands are a practice's *interpretation*, not a fact about the analyte. **The model carries
  the measured value; interpretation stays with the interpreter.** The range a lab printed for one result
  is a different thing and is kept with that result (see "The printed reference range, flag and
  interpretation of one result").
- **Derived indices** — HOMA-IR, LH:FSH, AST:ALT, BUN/creatinine, A/G, corrected calcium. Computable
  from the analytes; recompute rather than store. (Transferrin saturation is the grey zone — labs
  universally print it.) When the lab printed one, it is kept in `lab-result/coded-v1` (§ Results with no item of
  their own).
- **Non-blood markers** — stool (elastase, calprotectin), saliva (diurnal cortisol), 24-hr urine iodine.
  Demand exists; out of scope here.

## Known deprecation — `fertility-hormone-lh`

`fertility-hormone-lh` was typed `concentration/mg-l`. LH is reported in **IU/L**, and it was the only
item in the model using `mg-l` — its siblings all used `iu-l`.

**The stored numbers are already correct.** `bridge-mira` writes Mira's value verbatim with no unit
conversion, and Mira reports LH in mIU/mL — numerically identical to IU/L. Only the type label was
wrong.

It could not be retyped in place: stored events carry `type: concentration/mg-l`, and the data lives in
users' own accounts, so there is nothing for HDS to migrate. Instead the item is **`deprecated: true`**
and kept, so existing events still resolve and render; new data uses `body-urine-hormones-lh`
(`concentration/iu-l`). This is why LH is the one urine hormone that was deprecated rather than renamed
— its eventType changed, so the `streamId:eventType` pair differs and both items can coexist.

## Codes

- **SNOMED** references are verified against the local `snomed-db` (International Edition RF2
  20260201) — **never** hand-written, and **never taken from search order**. Verification is not a
  formality here: several concepts a plain search returns *first* are **inactive** — `35170002`
  (Hemoglobin determination), `142831004` (RBC count), `165701004` / `143103004` (RDW), `143134000`
  (transferrin saturation), `26966005` (total bilirubin), `103205003` (MCH). Shipping any of them would
  have repeated the stale-reference bug fixed in 1.12.1.
- Watch for **near-miss names**: `104134009` is *Hemoglobin* distribution width (HDW), not RDW —
  a different analyte with a very similar label.
- Where no concept exists, the item carries **no** `snomed` ref and says why:
  `body-urine-hormones-e3g` (estrone-3-glucuronide has no concept), `body-urine-hormones-pdg`
  (`89113004` is *Pregnanediol measurement* — a different substance) and `body-blood-rbc-magnesium`
  (no erythrocyte-magnesium concept).
- Three references are deliberate compromises, noted on the items: `body-blood-serum-folate` uses
  `250212002` *Plasma folate* (SNOMED has no serum folate **procedure**, only findings; the two are
  reported interchangeably), `body-blood-serum-egfr` uses `80274001`, an **observable entity**
  rather than a procedure — SNOMED has no estimated-GFR measurement procedure — and
  `body-blood-serum-tpo-antibodies` uses `27115008` *Microsomal thyroid antibody measurement*, the
  historical name for the TPO-antibody assay (thyroid peroxidase **is** the microsomal antigen); the
  dedicated TPO-Ab measurement concepts are all inactive.
- The 2.1.0 batch again earned its verification: five obvious top-of-search hits were **inactive**
  (`270996006` serum cholesterol, `28437009` DHEA-S measurement, `408253004` + `144297009` CA-125,
  and the TPO-Ab concepts above) and were rejected for their active equivalents.
- **LOINC** codes are **asserted** in `references.loinc` once verified (since 3.23.0, decision of
  plan 114; until then they were not asserted). Verification source: the official LOINC release
  served by the HL7 terminology server, `https://tx.fhir.org/r4/CodeSystem/$lookup?system=http://loinc.org&code=<code>`
  (LOINC 2.83 at 3.23.0; loinc.org itself refuses automated requests). A code ships only when it is
  `ACTIVE` and its Long Common Name matches the item's concept, including the time aspect (a
  per-session code does not fit a daily total). Where no code fits, the item asserts none and its
  `devNotes` say why. Candidates noted in comments before 3.23.0 (`body-semen-morphology-normal`)
  stay pending until someone verifies them this way. This applies to every domain, not only blood
  chemistry. The codes an item asserts also decide that it owns an analyte (§ Results with no item of their own):
  a code is asserted by one active item at most, with a valid check digit (`[LABC-LOINC-1]`, `[LABC-LOINC-2]`).
