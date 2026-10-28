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
distinguishes it: `clientData.hdsBasis` is `'predicted'` or `'confirmed'` on any of the four boundary items
(`-start`, `-period-end`, `-fertile-window`, `-ovulation`), it qualifies the event's day, and absent means "not stated",
never "confirmed". A bridge moving a prediction to confirmed writes `'confirmed'` explicitly (Pryv merges `clientData`
one level deep). The boundary items are `v1` since 3.18.1.

hds-lib `cyclePhaseAt(time, events, timeZone)` implements the derivation, by calendar day in the patient's zone:
- a cycle runs from a `-start` day to the day before the next `-start` (its `duration` never bounds a phase; an open
  cycle stops at the item's 90-day limit); a boundary belongs to the cycle containing its own day, the earliest one
  when there are several;
- `menstrual`: the start day, and through the `-period-end` day when there is one;
- `fertile`: the fertile-window days (first and last inclusive) and the ovulation day;
- `follicular`: after the period end, before the first fertile day (window start, else ovulation day);
- `luteal`: after the ovulation day (and after the window), to the end of the cycle;
- every other day (no period end recorded, no ovulation recorded, between a window and a later ovulation or an
  ovulation and a later window) has no phase: the helper returns `null`, it never guesses; a period end on or after
  the first fertile day is ignored;
- basis: `predicted` when any boundary used is predicted, `confirmed` when all are confirmed, else `unknown`.
A source's own phase label (Mira's `current_phase`) stays in that source's raw events.
Interoperability does not need a stored item either: a FHIR export can compute the phase observation at export time.
Not foreclosed: a **clinician-asserted** phase (e.g. "mid-luteal" for a day-21 progesterone) would be a different
observation, a distinct item if ever needed.

**Why separate browndark and clots as checkboxes?**
They are qualifiers, not intensity levels. A user can have Heavy flow with or without clots, Light flow that is brown-tinged, etc. Separate items allow any combination. Both always co-occur with a `body-vulva-bleeding` event.

## Peak days (3.24.0, B-2026-10-26-19)

Two different peaks, two items. Both are `activity/plain` checkboxes, one event per cycle, `time` anywhere on the
calendar day, no duration, on **sibling** streams under `fertility-cycles` (so a permission on one never grants the
other).

| Item | What it is | Typical source |
|---|---|---|
| `fertility-cycles-peak-day` | The **mucus Peak Day**: the last day of peak-type cervical fluid, in the charting method's own terms, known in retrospect once the fluid changes | the person, a charting app (Cyclefeminin, Read Your Body), a method's own chart |
| `fertility-cycles-lh-peak-day` | The **LH peak**: the day the LH surge peaked, as marked from urine LH tests or a fertility monitor | the person, an LH or monitor app (Cycle Intelligence) |

Neither is ovulation (`fertility-cycles-ovulation`), and neither is a fertility monitor's daily Low / High / Peak
reading (no item yet: see the 3.24.0 CHANGELOG). The two peaks usually fall a day or two apart and either can be
recorded without the other.

HealthKit has no peak-day sample: `HKCategoryValueOvulationTestResult.luteinizingHormoneSurge` is a per-test result
and maps to `fertility-test-opk`. A FHIR export carries either peak as a locally coded Observation, or leaves it out.

**Why the existing item is the mucus peak.** Until 3.24.0 the item said only "peak day of fertility", and two writers
read it differently: the Cyclefeminin import (`bridge-cycles-files`, and the earlier `bridge-cyclefeminin-net`) writes
Cyclefeminin's `isPeak` day, the mucus peak; Cycle Intelligence writes the day the person marks the LH peak (from its
hormone or monitor card). The stored data that reaches real accounts is the import's (Cycle Intelligence runs on demo
only), "Peak Day" is the mucus methods' own term (Billings, Creighton, FEMM, Sensiplan, STM, and the `peak-day` option
of `fertility-tracking-method`), and hds-feminine-cycle-ui and the method specification read the item as the mucus
peak. Keeping that meaning moves no real data; the LH peak gets the new item. The item is `v2` since 3.24.0: events
written before 3.24.0 by Cycle Intelligence (demo accounts only) may be LH peaks.

**Not a fertility statement.** Both are chart notation the person or her method records. HDS apps show them as
recorded; they do not derive fertile or infertile days from them.

## Coverline (3.24.0)

`fertility-cycles-coverline` is the basal-temperature coverline of one cycle, `temperature/c` (°C), one event per
cycle, `time` on the calendar day of that cycle's `fertility-cycles-start` (the patient's time zone), no duration.

`clientData.hdsBasis` says where the value comes from:

| `hdsBasis` | Meaning |
|---|---|
| `'manual'` | The person drew the line or moved it (the methods that publish no calculation, such as Justisse, are always drawn) |
| `'auto'` | Computed by the method's coverline rule (below) and stored as computed, by the writer that owns the cycle's data (an import) |
| absent | Not stated |

**Precedence, one rule:**
- a reader that computes the line (hds-lib, from the rule) shows the `'manual'` event if there is one, otherwise its
  own computation, and never a stored `'auto'`;
- a reader that cannot compute shows whichever event exists;
- an `'auto'` event is written only by the writer that owns the cycle's data (an import), and replaced by that writer;
- apps that compute never store `'auto'`.

Going back to the method's rule deletes the event. Writers are recommended to link the line to its cycle with
`clientData.related.<cycleStartEventId>: true` ([PROVENANCE.md](PROVENANCE.md)), so a moved start does not orphan it;
if the cycle's start is moved, the writer moves the coverline with it. Like the peaks, the coverline and its counted
high temperatures are chart notation; HDS does not derive "infertile from day N" from them.

No LOINC or SNOMED CT concept exists for a coverline (searched 2026-10-28); a FHIR export would carry it as an
Observation with a local code, or leave it out.

### Which rule a method charts the temperature by: `temperatureRule`

The cervical-fluid converter declares, for each method, the coverline rule its charts use. It is data only: the rule
parameters and their sources are in model-cervical-fluid (`references/rules/coverline-rules.json`, the method
specification), and the computation is hds-lib's. Each method of `converters/cervical-fluid/pack-latest.json` carries
`temperatureRule`, a key of the pack's `temperatureRules` or `none`:

| `temperatureRule` | Methods |
|---|---|
| `sympto-thermal` (STM / TCOYF: 6 lows, line 0.05 °C above the highest, 3 highs, the 3rd ≥ 0.15 °C above the line) | `sympto-thermal` |
| `sensiplan` ("3 over 6": line on the highest of 6 lows, 3 highs, the 3rd ≥ 0.2 °C above, two exceptions) | `sensiplan`, `chartneo` (Chart Neo charts by Sensiplan's rule) |
| `manual` (no calculation published: the person draws the line) | `justisse` |
| `none` (the method draws no coverline) | `billings`, `creighton`, `marquette` (rule not published), `femm`, `appleHealth`, `mira`, `bigelow`, `descriptive` |

The declaration lives in `converter/v0.yaml` (`temperatureRules`, `methodTemperatureRule`) because the method files
are copies of model-cervical-fluid's; the build adds it to each method and fails if a method has no entry or names an
unknown rule. When the experts settle an open rule (Chart Neo's double check, Marquette's temperature rule), the
value changes here.
