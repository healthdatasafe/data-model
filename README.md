# HDS Data Model

Defines the stream structures, item definitions, event types, and converter configurations for the HDS health data model.

Published at [model.datasafe.dev](https://model.datasafe.dev)

## Contents

| Category | Count | Description |
|----------|-------|-------------|
| Items | 92 | Health data point definitions (body, fertility, treatment, procedure, …) |
| Streams | 12 | Hierarchical data categories |
| Event types (HDS) | 39 | Custom Pryv event type schemas |
| Event types (legacy) | ~340 | Standard Pryv measurement types |
| Converters | 2 | Cross-method conversion engines (cervical-fluid, mood) |

## Structure

```
definitions/
  items/           YAML item definitions by category
    activity.yaml     9 physical activity items
    body.yaml         body-weight, body-height
    body-skin.yaml    4 skin condition items
    body-vulva.yaml   bleeding, mucus, cervix, wetness items
    family.yaml       children count
    fertility.yaml    cycles, hormones, tests, sexual activity
    function.yaml     mobility, self-care, usual activities (ICF/EQ-5D)
    medication.yaml   basic, coded, prescription
    nutrition.yaml    appetite
    procedure.yaml    basic (free-text), coded (SNOMED-CT search)
    profile.yaml      display name, DOB, sex, address
    symptom.yaml      17 symptom items across 7 categories
    treatment.yaml    basic (free-text), coded (SNOMED-CT search) — duration-bearing
    wellbeing.yaml    mood (5D vectors), sex drive, mental distress, self-rated health
  streams/         YAML stream hierarchy definitions
  eventTypes/      JSON event type schemas (HDS + legacy Pryv types)
  converters/      Cross-method converter configurations
    cervical-fluid/  9D vector model for mucus observation methods
    mood/            5D vector model for mood states
  datasources/     External data source definitions
```

## Subdomain documentation

In-depth notes on specific subdomains live in `documentation/`:

- `MENSTRUAL-CYCLE.md`, `CERVICAL-POSITION.md`, `MOOD.md`, `SKIN.md`, `SYMPTOMS.md`, `PHYSICAL-ACTIVITY.md`, `FUNCTION.md`
- `TREATMENT-PROCEDURE.md` — D3 mechanic: parent items (`treatment`, `procedure`) reused under descendant streams (e.g. `treatment-fertility`, `procedure-fertility`) via the `forEvent` walk-up. Treatment items carry `event.duration` (Pryv-native); procedures are point-in-time.
- `CUSTOM-FIELDS-AND-SYSTEM.md`, `DESIGN-NOTES.md`, `TAGS.md`

## Item Definition Format

Each item defines a health data point with enough information for storage, display, and interoperability:

```yaml
body-weight:
  label:
    en: Body Weight
    fr: Poids corporel
  description:
    en: Measured body weight
  streamId: body-weight
  eventType: mass/kg
  type: number
  repeatable: unlimited
  variations:
    eventType:
      options:
        - value: mass/kg
          label: { en: Kg }
        - value: mass/lb
          label: { en: Lbs }
```

## Build

```bash
npm run setup    # Install dependencies
npm run build    # Generate dist/pack.json (served at model.datasafe.dev)
```

## Deploy

Published via GitHub Pages — `npm run deploy` builds and pushes to the `gh-pages` branch.

## Prerequisites

- Node.js >= 24
- npm
