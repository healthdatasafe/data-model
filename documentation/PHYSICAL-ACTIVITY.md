# Physical Activity — Cross-system Compatibility

How HDS activity items map to external systems and clinical terminologies.

## External Systems

### Apple HealthKit (HKWorkoutActivityType)

HealthKit models exercise as `HKWorkout` objects with an `HKWorkoutActivityType` (80+ types). Optional fields: duration, totalEnergyBurned, totalDistance, heart rate samples.

| HDS Item | HKWorkoutActivityType | Notes |
|---|---|---|
| `activity-yoga` | `.yoga` | Direct match |
| `activity-stretching` | `.flexibility` | No literal `.stretching`; `.preparationAndRecovery` is alternative |
| `activity-pilates` | `.pilates` | Direct match |
| `activity-hiit` | `.highIntensityIntervalTraining` | Direct match |
| `activity-weights` | `.traditionalStrengthTraining` | Also `.functionalStrengthTraining` |
| `activity-swimming` | `.swimming` | Direct match |
| `activity-cycling` | `.cycling` | Direct match |
| `activity-jogging` | `.running` | HealthKit uses "running" (no separate jogging) |
| `activity-hiking` | `.hiking` | Direct match |

### SNOMED CT

Parent concept: **61686008** — "Physical exercise" (Observable entity / Activity).

| HDS Item | SNOMED CT Code | Preferred Term |
|---|---|---|
| `activity-yoga` | 229033006 | Yoga exercises |
| `activity-stretching` | 229070002 | Stretching exercises |
| `activity-pilates` | 710951000000107 | Pilates (UK extension) |
| `activity-hiit` | — | No specific code |
| `activity-weights` | 713015008 | Strength training |
| `activity-swimming` | 20461001 | Swimming |
| `activity-cycling` | 56493006 | Cycling |
| `activity-jogging` | 55881007 | Jogging |
| `activity-hiking` | 451261000124100 | Hiking |

### HL7 FHIR Physical Activity IG

FHIR PA IG (STU1) uses `Observation` with:
- LOINC **73985-4** ("Exercise activity") with answer list **LL734-5**: Bicycling, Jogging, Running, Swimming, Walking, Weights, Mixed
- LOINC **55411-3** ("Exercise duration"), **55424-6** ("Calories burned")
- "Exercise Vital Sign": LOINC 89555-7 (days/week), 68516-4 (minutes/day)

The LOINC answer list is limited (7 values) — missing yoga, pilates, stretching, hiking, HIIT. Implementers extend with SNOMED CT codes.

## Mira

**Field:** `physical_activity` — single string value per day.

**Confirmed values (from real Mira prod API, 2026-03-17):** Weights

**App UI options (from screenshots):** None, Yoga, Stretching, Pilates, HIIT, Weights, Swimming, Cycling, Jogging, Hiking

"None" = no event (skip silently).

## Fertility Apps

**Clue:** ~12+ exercise categories (Walking, Pilates, Rest day, etc.). Presence flags only, no duration/intensity.

**Flo:** Basic exercise tracking as lifestyle factor. Type only, no duration.

Both treat exercise as simple presence-based categorical data.

## Daily totals (3.23.0, site-agents#25)

Phones and watches export daily totals, not sessions. Three items carry them, one event per day:

| HDS item | eventType | HealthKit | Google Fit | LOINC |
|---|---|---|---|---|
| `activity-steps` | `count/steps` | `stepCount` | `step_count.delta` | 41950-7 Number of steps in 24 hour |
| `activity-distance-walking-running` | `length/m` | `distanceWalkingRunning` | `distance.delta` | 41953-1 Walking distance 24 hour |
| `activity-duration-active` | `time/s` | `appleExerciseTime` | `active_minutes` | none (55411-3 is per session) |

- **A day is a period:** `time` = local midnight, `duration` = 86400 (mandatory), `repeatable: P1D`.
  86400 is a convention: a DST day is 23 or 25 h, and the item's `maxSeconds` (90000) allows it.
  This differs on purpose from a partial date (site-agents#26), which is a *point* at 12:00 UTC of an
  uncertain day: a total covers the whole day, a partial date only says which day.
- **Walking and running together**, because that is the quantity devices export; a source that counts
  walking only writes it here too.
- **Active time is the source's own definition** (each vendor counts "active" or "exercise" minutes
  differently): compare a person with themself, not across devices.
- **Not sessions:** a yoga class stays `activity-yoga-intensity`; a session's duration is the event's
  own `duration`. One length unit (`length/m`), per the equivalent-twin rule.
- No SNOMED reference: SNOMED has no observable for these daily counts.

## Design Decisions

- **Presence flags** (`activity/plain`): Matches Mira, Clue, Flo. No duration or intensity.
- **Flat stream**: All activities directly under `activity/` — no sub-categories needed (unlike symptoms).
- **Extensible**: New activity types can be added as new items when HealthKit or other sources provide them.
- **Future**: When richer sources provide calories per session, the event type can evolve (e.g. to a composite type or link to duration observations).
