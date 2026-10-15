# Menstrual Cycle — Cross-system Compatibility

How HDS bleeding/flow items map to external systems.

## HDS Items

### `body-vulva-bleeding` (ratio/proportion, 0-1)

| Value | Label (en) | Label (fr) | Description |
|-------|------------|------------|-------------|
| 0.0 | None | Aucun | No bleeding |
| 0.08 | Spotting | Spotting | Very light bleeding, may occur outside period |
| 0.20 | Very light | Très léger | Very light menstrual flow |
| 0.35 | Light | Léger | Light menstrual flow |
| 0.55 | Moderate | Modéré | Moderate menstrual flow |
| 0.75 | Heavy | Abondant | Heavy menstrual flow |
| 0.95 | Very heavy | Très abondant | Very heavy flow, may indicate menorrhagia |

### `body-vulva-bleeding-browndark` (activity/plain, checkbox)

Presence of brown or dark coloration in bleeding.

### `body-vulva-bleeding-clots` (activity/plain, checkbox)

Presence of blood clots during bleeding. Clinically significant when large (>2.5cm) or frequent.

## Mapping to External Systems

### Apple HealthKit

| HealthKit | HDS |
|-----------|-----|
| `HKCategoryValueMenstrualFlow.light` (2) | `body-vulva-bleeding` = 0.35 |
| `HKCategoryValueMenstrualFlow.medium` (3) | `body-vulva-bleeding` = 0.55 |
| `HKCategoryValueMenstrualFlow.heavy` (4) | `body-vulva-bleeding` = 0.75 |
| `HKCategoryValueMenstrualFlow.none` (5) | `body-vulva-bleeding` = 0.0 |
| `HKCategoryValueMenstrualFlow.unspecified` (1) | No direct mapping |
| `intermenstrualBleeding` (separate type) | `body-vulva-bleeding` = 0.08 (Spotting) |

Notes:
- HealthKit has no "Very Heavy" — export HDS 0.95 as `heavy` (4) with loss of granularity.
- HealthKit has no "Very light" — export HDS 0.20 as `light` (2).
- HealthKit has no color or clots tracking.
- HealthKit uses `HKMetadataKeyMenstrualCycleStart` (Bool) on flow samples to mark cycle start — in HDS this is the `fertility-cycles-start` item.
- Spotting is a separate data type in HealthKit (`intermenstrualBleeding`), not a flow level. When exporting HDS value 0.08, create an `intermenstrualBleeding` sample instead of a `menstrualFlow` sample.

### Clue

| Clue | HDS |
|------|-----|
| Spotting (separate category) | `body-vulva-bleeding` = 0.08 |
| Light | `body-vulva-bleeding` = 0.35 |
| Medium | `body-vulva-bleeding` = 0.55 |
| Heavy | `body-vulva-bleeding` = 0.75 |
| Super Heavy | `body-vulva-bleeding` = 0.95 |

Notes:
- Clue tracks spotting as a separate category from period flow. In HDS both are on the same scale.
- Clue does not track color or clots as structured data.

### Flo

| Flo | HDS |
|-----|-----|
| Light | `body-vulva-bleeding` = 0.35 |
| Medium | `body-vulva-bleeding` = 0.55 |
| Heavy | `body-vulva-bleeding` = 0.75 |
| Blood clots (separate option) | `body-vulva-bleeding-clots` = true |
| Spotting (separate concept) | `body-vulva-bleeding` = 0.08 |

Notes:
- Flo's "Blood clots" is a flow option alongside L/M/H, not a qualifier. In HDS, clots are a separate checkbox to allow co-occurrence with any intensity level.
- Flo provides educational content about period blood color (bright red, dark red, brown, pink, black) but does not track it as structured data.

### Natural Cycles

| Natural Cycles | HDS |
|----------------|-----|
| Light | `body-vulva-bleeding` = 0.35 |
| Medium | `body-vulva-bleeding` = 0.55 |
| Heavy | `body-vulva-bleeding` = 0.75 |
| Spotting (separate toggle) | `body-vulva-bleeding` = 0.08 |

Notes:
- Natural Cycles has no "Very Heavy" or "Very light" levels.
- No color or clots tracking.

### Mira

| Mira field | HDS |
|------------|-----|
| `flow_spotting` = "Spotting" | `body-vulva-bleeding` = 0.08 |
| `flow_spotting` = "Light" | `body-vulva-bleeding` = 0.35 |
| `flow_spotting` = "Medium" | `body-vulva-bleeding` = 0.55 |
| `flow_spotting` = "Heavy" | `body-vulva-bleeding` = 0.75 |
| `spotting` = "Brown" or "Dark" | `body-vulva-bleeding-browndark` = true |
| `spotting` = "Red" | No extra event (red is default) |

**Confirmed spotting colors (from real Mira prod API, 2026-03-17):** Red, Pink, Brown

**Separate `bleeding` field (not in flow scale):**
| Mira `bleeding` value | Meaning |
|---|---|
| `"Postpartum bleeding"` | Post-delivery bleeding |
| `"Miscarriage bleeding"` | Bleeding from pregnancy loss |

These are categorical events, not intensity levels. Need separate HDS items (TBD — see Plan 13 Phase D).

**Mira app UI also shows:** Menstrual flow (Light, Medium, Heavy, Blood clots) as a separate section from Spotting.

Notes:
- Mira `spotting` is the color, `flow_spotting` is the intensity.
- If `spotting` exists without `flow_spotting`, implies spotting-level intensity (0.08).
- "Blood clots" appears as a single toggle in the Mira UI — may map to `flow_spotting` or a separate field. Not yet seen in real API data. HDS already has `body-vulva-bleeding-clots` item ready.
- Pink spotting triggers a bleeding event but NOT browndark.
- Mira's cycle summary (`cycle_length`, `period_end`, `ovulation`, `fertile_window_start` / `_end`) maps to
  `fertility-cycles-start` (with duration), `-period-end`, `-ovulation` and `-fertile-window`. Its current-cycle
  fields `current_phase`, `current_cycle_day` and `phase_start_date` are **not** mapped: they stay in the raw
  `fertility-cycle/mira-current-v1` event as provenance (see "Why no cycle-day or cycle-phase item?" below).

### FHIR / HL7

No standard FHIR observation profile exists for menstrual flow intensity as of 2026.

- **LOINC** codes cover cycle timing (last period date, duration, frequency) but not flow intensity.
- **SNOMED CT** has diagnostic concepts (menorrhagia, hypomenorrhea) but not a graduated observation scale.
- **PBAC** (Pictorial Blood Loss Assessment Chart) is a clinical research tool using continuous numeric scores based on pad saturation and clot counts. Not a patient self-tracking scale.

The HDS model fills a gap — it can serve as a bridge format until a FHIR IG emerges.

## Design Rationale

**Why ratio/proportion (0-1)?**
A continuous [0, 1] scale with defined reference points allows systems with different granularities to map cleanly. The gaps between reference values (e.g. 0.08, 0.20, 0.35) leave room for future systems with intermediate levels without breaking existing data. It also enables meaningful averaging and charting.

**Why include Spotting (0.08) in the flow scale?**
Spotting is bleeding. Apps that separate it do so because spotting can occur between periods (intermenstrual), but the observation itself is about intensity. The timing context (during vs. between periods) is already captured by cycle event data (`fertility-cycles-start`, `fertility-cycles-period-end`).

**Why no cycle-day or cycle-phase item?** (decided 2026-10-15, B-2026-10-14-6)
Both are derived from items the model already holds, and stored derived state goes stale (the same rule as cycle day
in [`BLOOD-CHEMISTRY.md`](./BLOOD-CHEMISTRY.md)). Cycle day counts calendar days in the patient's time zone from the
`fertility-cycles-start` event (day 1 = that day), not 86 400-second steps, which drift across DST. Phase follows from
the boundary items: menstrual from `fertility-cycles-start` to `fertility-cycles-period-end`, follicular from
`-period-end` until ovulation (or the fertile window, when ovulation is absent), the fertile window from its own item,
luteal after `fertility-cycles-ovulation` until the next start. A derivation must report its basis (confirmed /
predicted / unknown) and never guess: a cycle with no ovulation recorded has no derivable luteal phase. Note that
sources may write *predicted* boundaries into `-ovulation` and `-fertile-window` (Mira does); a phase derived from
them inherits that basis, so bridges should record predicted-vs-confirmed in `clientData` where the source
distinguishes it. The `-ovulation` item is `version: temporary`; stabilise it before any shared helper depends on it.
A source's own phase label (Mira's `current_phase`) stays in that source's raw events.
Interoperability does not need a stored item either: a FHIR export can compute the phase observation at export time.
Not foreclosed: a **clinician-asserted** phase (e.g. "mid-luteal" for a day-21 progesterone) would be a different
observation, a distinct item if ever needed.

**Why separate browndark and clots as checkboxes?**
They are qualifiers, not intensity levels. A user can have Heavy flow with or without clots, Light flow that is brown-tinged, etc. Separate items allow any combination. Both always co-occur with a `body-vulva-bleeding` event.
