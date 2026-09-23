# HDS Data Model

Defines the stream structures, item definitions, event types, and converter configurations for the HDS health data model.

Published at [model.datasafe.dev](https://model.datasafe.dev)

## How this repo is consumed

**This repo publishes a pack, it is not an importable library.** Consumers read the built pack over
HTTP from `https://model.datasafe.dev/pack.json` (`version.json` alongside it carries the commit the
live pack was built from). The modules under `src/` are the build's own loaders and are not a public
API, so `package.json` deliberately declares no `main` entry point and `require()`-ing this package
is not expected to resolve, under either its package name or the dependency key a git install gives
it.

## Contents

| Category | Count | Description |
|----------|-------|-------------|
| Items | **296** (231 active, 65 deprecated) | Health data point definitions (body, fertility, lifestyle, treatment, procedure, …) |
| Streams | **15** top-level, **276** at all levels | Hierarchical data categories |
| Event types (HDS) | **70** | Custom Pryv event type schemas |
| Event types (legacy) | **354** | Standard Pryv measurement types |
| Converters | 2 | Cross-method conversion engines (cervical-fluid, mood) |

> Counts are as of `3.11.0` (2026-09-23). A **deprecated** item stays in the pack as a resolvable alias
> so consumers pinned to the old key keep working — see `AGENTS.md` on item-key renames — so "active" is
> the number that matters when reading the vocabulary, and the total is what a consumer can still
> resolve.

## Structure

```
definitions/
  items/           YAML item definitions by category (active / total)
    activity.yaml          9 / 18   physical activity items
    body.yaml             99 / 99   weight, height, vitals, blood chemistry, semen
    body-skin.yaml         4 / 4    skin condition items
    body-vulva.yaml        9 / 12   bleeding, mucus, cervix, wetness items
    condition.yaml         1 / 1    coded diagnosis
    family.yaml            1 / 1    children count
    fertility.yaml        22 / 25   cycles, hormones, tests, sexual activity
    finding.yaml           1 / 1    coded clinical finding
    function.yaml          3 / 3    mobility, self-care, usual activities (ICF/EQ-5D)
    lifestyle.yaml         8 / 8    tobacco, alcohol, diet
    medication.yaml        3 / 3    basic, coded, prescription
    nutrition.yaml         1 / 1    appetite
    procedure.yaml         2 / 2    basic (free-text), coded (SNOMED-CT search)
    profile.yaml          10 / 10   display name, DOB, sex, address, reproductive stage
    symptom.yaml          21 / 41   symptom items
    symptom-domains.yaml  28 / 56   symptom items by body-system domain
    treatment.yaml         2 / 2    basic (free-text), coded (SNOMED-CT search) — duration-bearing
    wellbeing.yaml         7 / 9    mood (5D vectors), sex drive, mental distress, self-rated health
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
- `LIFESTYLE.md` — tobacco, alcohol and diet: why `lifestyle` is a top-level domain, the AUDIT-C mapping, why alcohol quantity is stored in grams of ethanol, and the per-option SNOMED tables.
- `TREATMENT-PROCEDURE.md` — D3 mechanic: parent items (`treatment`, `procedure`) reused under descendant streams (e.g. `treatment-fertility`, `procedure-fertility`) via the `forEvent` walk-up. Treatment items carry `event.duration` (Pryv-native); procedures are point-in-time.
- `BLOOD-CHEMISTRY.md` — blood analytes: the `body-blood` tree, why specimen is explicit in item keys, reported-unit choices (gigacount vs megacount, percentages as fractions), and what is deliberately absent (reference ranges, derived indices).
- `PROFILE.md`, `CONDITION.md`, `FINDING.md`, `NUTRITION.md`, `FAMILY.md` — the five smaller domains. `FINDING.md` records an **open question**: the `finding` root's scope is undecided, and the doc says so rather than inventing one.
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

`deploy.sh` fails closed before it publishes anything: it requires `main`, a clean working tree, a
`node_modules` matching `package-lock.json`, **a green `npm test`**, a non-empty build, and a pack
that loads through real `hds-lib`. CI runs the suite on the push rather than as a gate on the
deploy, so the deploy runs it itself.

## Prerequisites

- Node.js >= 24
- npm
