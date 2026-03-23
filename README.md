# HDS Data Model

Defines the stream structures, item definitions, event types, and converter configurations for the HDS health data model.

Published at [model.datasafe.dev](https://model.datasafe.dev)

## Contents

| Category | Count | Description |
|----------|-------|-------------|
| Items | 73 | Health data point definitions (body, fertility, medication, etc.) |
| Streams | 36 | Hierarchical data categories |
| Event types (HDS) | 33 | Custom Pryv event type schemas |
| Event types (legacy) | ~200 | Standard Pryv measurement types |
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
    medication.yaml   basic, coded, prescription
    nutrition.yaml    appetite
    profile.yaml      display name, DOB, sex, address
    symptom.yaml      17 symptom items across 7 categories
    wellbeing.yaml    mood (5D vectors), sex drive
  streams/         YAML stream hierarchy definitions
  eventTypes/      JSON event type schemas (HDS + legacy Pryv types)
  converters/      Cross-method converter configurations
    cervical-fluid/  9D vector model for mucus observation methods
    mood/            5D vector model for mood states
  datasources/     External data source definitions
```

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
