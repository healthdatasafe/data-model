# Data Model Design Notes & References

## Coding Standards References

### Medical Coding Systems
- **SNOMED CT**: [https://bioportal.bioontology.org/ontologies/SNOMEDCT](https://bioportal.bioontology.org/ontologies/SNOMEDCT)
- **LOINC** (e.g. Body Weight): [https://loinc.org/LG34372-9](https://loinc.org/LG34372-9)

### Medication Code Lists
- **ATC** (WHO): [https://atcddd.fhi.no/atc_ddd_index/](https://atcddd.fhi.no/atc_ddd_index/)
- **HCPCS**: [https://www.aapc.com/codes/hcpcs-codes-range/](https://www.aapc.com/codes/hcpcs-codes-range/)
- **SNOMED CT Browser**: [https://browser.ihtsdotools.org/?perspective=full&conceptId1=404684003](https://browser.ihtsdotools.org/?perspective=full&conceptId1=404684003)
- **UNII** (FDA): [https://precision.fda.gov/uniisearch](https://precision.fda.gov/uniisearch)
- **FHIR Medication Frequency**: [https://build.fhir.org/ig/HL7/CDA-Examples/medicationfrequency.html](https://build.fhir.org/ig/HL7/CDA-Examples/medicationfrequency.html)

### HL7 FHIR
- **HL7 US**: [https://hl7.org/fhir/us/](https://hl7.org/fhir/us/)
- **HL7 CH** (Switzerland): [https://www.fhir.ch](https://www.fhir.ch)
- **JSON Forms** (form rendering): [https://jsonforms.io/](https://jsonforms.io/)

## Item Design Principles

Each item definition should provide enough information to:

### Basics
- Identify an observation or information (e.g. Body Weight)
- Has a translatable label and description
- Has a unique identifier
- Has at least one eventType and streamId

### Constraints & Validation
The eventType provides base constraints (number, object structure via JSON Schema). Additional per-item constraints can specify min/max values, allowed options, etc.

### Scale hook placement (`ratio/*` items)

When an item uses `ratio/proportion` (or any `ratio/*` eventType) and defines discrete response options (`type: select` with numeric `value`s), the numeric hook values **must be chosen to align with the semantic anchors of established competing scales in the same domain**, not by evenly distributing N points across [0, 1].

**Why.** The `ratio/*` space is a shared interoperability surface used by items across many domains and by bridges from external systems (Apple HealthKit, Mira, Flo, Ovia, FHIR-sourced PROs, …). Every scale that lands in this space should sit at the position its semantics imply, so that N-level scales become clean subsets of finer scales. This removes the need for bespoke per-scale converters for the common case of ordinal severity / intensity measurement.

**Rule.** Pick hook values so that:

1. **"None" / absence / baseline lands at `0.0`** (when the construct admits an absence — severity, intensity, problem level).
2. **"Ceiling" / maximum lands at `1.0`** (what the scale calls its worst / strongest / most-severe value — even if finer scales have levels above it).
3. **"Middle" lands at `0.5`** (the semantic midpoint — "Moderate", "Neutral", etc. — even if it means the remaining hooks are not evenly spaced).
4. **Intermediate hooks** are placed to align with the hooks of other scales in the same family, not by dividing the remaining space evenly.

**Exceptions / special cases.**

- Scales whose values represent *deviation from baseline* rather than *absolute severity* (e.g. `wellbeing-sex-drive` — low/normal/high) use the middle region (e.g. `0.25 / 0.5 / 0.75`) and legitimately skip `0` and `1`.
- Scales with domain-specific non-linear anchors (e.g. `body-vulva-bleeding` with hooks approximating physiological volume at `0.0 / 0.08 / 0.20 / 0.35 / 0.55 / 0.75 / 0.95`) override even spacing for a reason — that reason must be documented in the item or a companion doc.

**Canonical severity-family placements** (reference for any severity / intensity item across symptoms, function, distress, etc.):

| Levels | Hooks | Labels (typical) | Covers |
|--------|-------|------------------|--------|
| 5-level | `0.0 / 0.25 / 0.5 / 0.75 / 1.0` | None / Slight (or Mild) / Moderate / Severe / Very severe (or Extreme) | EQ-5D-5L, PROMIS 5-level, VRS-5, ICF qualifier, WHODAS |
| 4-level | `0.0 / 0.25 / 0.5 / 1.0` | NotPresent / Mild / Moderate / Severe | Apple HealthKit `HKCategoryValueSeverity` — **subset of 5-level, skipping the `0.75` hook** |
| 3-level | `0.25 / 0.5 / 1.0` *(absolute)* or `0.25 / 0.5 / 0.75` *(relative-to-baseline)* | Mild / Moderate / Severe *or* Low / Normal / High | Intake screeners; `wellbeing-sex-drive`-style items use the relative form |
| 11-level | `0.0 / 0.1 / 0.2 / … / 1.0` | NRS 0–10 | Pain NRS, PROMIS 11-level. Every other hook aligns with the 5-level hooks |

**Anti-pattern (do not do this).** Placing N levels at `(k−1) / (N−1)` for `k = 1..N` — i.e. dividing [0, 1] into `N−1` equal gaps. This puts "Moderate" at `0.66` on a 4-level scale, above the semantic middle, and breaks closest-value interop with 5-level (Moderate at `0.66` is numerically closer to the 5-level `Severe` hook at `0.75` than to the 5-level `Moderate` hook at `0.5`). Round-tripping a 5-level Moderate through such a 4-level store would escalate it to Severe.

**Bridges and converters.** Bridges that import from external systems with their own scale labels should map by **label lookup** to the correct HDS hook, not by numeric proximity alone. The bridge owns the per-source label→hook table; the data-model owns the canonical hooks.

**When adding a new `ratio/*` item:** survey the scales in the same domain (consult SYMPTOMS.md / MOOD.md / FUNCTION.md / etc. for prior art, then check PROMIS, ICF, SNOMED, LOINC, Apple HealthKit, FHIR questionnaires). Place your item's hooks at positions that align with those scales' anchors. Document the reasoning briefly in the item YAML or in the domain companion doc.

### Encoding & Interoperability
- Items may have multiple variations (e.g. kg vs lbs for weight)
- SNOMED CT and LOINC codes for standard interoperability
- HL7 FHIR transformation support (resourceType, meta, valueQuantity mappings)

### Data Source
- Origin tracked via `createdBy` and `modifiedBy`
- Additional provenance via bridge metadata

### Display
- **Forms**: number input, text (short/long), date (day/year/full), select with IDs and labels
- **Graphs & Aggregation**: line charts, aggregation rules (sum for steps, average for temperature)
- **Tables**: rounding rules

### Versioning
- Items have versions
- Provide transformation information for data migration between versions

## Example: Body Weight with FHIR Mapping

```yaml
body-weight:
  label:
    en: Body Weight
  streamId: body-weight
  variations:
    eventType:
      label: Unit
      options:
        - value: mass/kg
          label: Kg
          hl7fhir:
            unit: kg
            code: kg
        - value: mass/lb
          label: Lbs
          hl7fhir:
            unit: lb
            code: "[lb_av]"
    measure-detail:
      default:
        label: { en: Default }
        description: { en: Measured with an instrument }
        encoding:
          loinc: 29463-7
          snomed: 27113001
      self-reported:
        label: { en: Self reported }
        encoding:
          loinc: 79348-9
          snomed: 784399000
      with-clothes:
        label: { en: Measured with clothes }
        encoding:
          loinc: 8350-1
  constraints:
    number:
      min: 0
  display:
    input: { type: number }
    table: { round: -2 }
    graph: { type: lines, aggregation: none }
  repeatable: any
  hl7fhir:
    resourceType: Observation
    meta:
      profile:
        - http://hl7.org/fhir/us/vitals/StructureDefinition/body-weight
      category-default: vital-sign
    valueQuantity:
      value: "{event.content}"
      system: http://unitsofmeasure.org
```

## Roadmap (Future)

- [ ] JSON Schema validation with [ajv](https://github.com/ajv-validator/ajv)
- [ ] FHIR transformation engine (toFhir / fromFhir)
- [ ] Model versioning with migration support
- [ ] Access ClientData properties for contact info and supported interactions
