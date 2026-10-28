# FHIR mapping (`fhir:` block on items)

**Status: draft (plan 115, SMART on FHIR), on a feature branch, not published.** The shape is subject to the
data-model review before the first release that carries it.

An item's `fhir:` block says how one of its events renders as a FHIR R4 resource. The renderer is
[`hds-fhir-js`](https://github.com/healthdatasafe/hds-fhir-js) (`toFhir`), which also derives SMART scope grants from
these blocks. One block serves every rendering flavour (US Core, IPS, CH); only the profile differs per flavour.

```yaml
body-weight:
  # …
  fhir:
    resourceType: Observation            # Observation | Condition
    category: vital-signs                # vital-signs, laboratory, social-history, survey, exam, activity,
                                         # problem-list-item, health-concern
    code: { system: http://loinc.org, code: 29463-7, display: Body weight }
    value:
      kind: quantity                     # quantity | coded | scaled | components | datasource-codes
      units: { mass/kg: kg, mass/lb: "[lb_av]" }   # eventType → UCUM
    profiles:
      us: http://hl7.org/fhir/us/core/StructureDefinition/us-core-body-weight
      ips: http://hl7.org/fhir/StructureDefinition/bodyweight
```

Value kinds:

| kind | Item | Block fields | Renders |
|---|---|---|---|
| `quantity` | `number` (with or without unit variants) | `units`: every eventType of the item → UCUM | `valueQuantity` |
| `coded` | `select` | `options`: every option value → coding | `valueCodeableConcept` |
| `scaled` | `ratio/proportion` slider or number | `multiplier` | `valueInteger` (value × multiplier, rounded) |
| `components` | `composite` | `components`: composite field → `{ code, unit }` | `component[]` |
| `datasource-codes` | `datasource-search` | `field`: content field with `{ label, codes[] }` | `Condition.code` (all codings) |

`split` (optional) derives extra resources from single composite fields, e.g. the pulse of a blood-pressure event
becomes its own heart-rate Observation, as US Core expects.

Rules, enforced at build time (`src/items.js`):
- Systems are canonical URIs (`http://loinc.org`, `http://snomed.info/sct`), never labels.
- `units` covers exactly the item's eventTypes; `options` covers exactly the item's options; `components` and `split`
  keys are composite fields. The renderer never meets content it cannot place.
- **Stream-subtree invariant:** SMART scopes are granted as Pryv stream permissions, which inherit down the stream
  tree. A stream that carries a mapped item may therefore only have mapped items of the same (resourceType,
  category) in its subtree. A mixed subtree fails the build.
- Additive only: a block can be added to an existing item without changing its key, stream or eventType.

Codes must be checked for meaning before shipping (SNOMED through `reference/snomed-db`, LOINC by lookup); the
`hds-fhir-js` CI validates rendered resources against US Core 6.1.0 and IPS 2.0.1 with the HL7 validator.
