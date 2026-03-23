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
