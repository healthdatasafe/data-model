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

International Edition 20260201, every code verified active in the local snomed-db (plan 133, 2026-11-27).

| HDS item | SNOMED CT | FSN | As a value |
|---|---|---|---|
| parent | 390736008 | Physical activity (qualifier value) | parent of the qualifier values below |
| parent (kept) | 61686008 | Physical exercise (observable entity) | a question, not a value |
| `activity-yoga` | 229224000 | Participation in yoga (regime/therapy) | acceptable; no qualifier value exists (1259940003 is "Yoga medicine (qualifier value)", not the activity) |
| `activity-stretching` | 53061000087100 | Stretching exercises (qualifier value) | preferred; 229070002 Stretching exercises (regime/therapy) import only |
| `activity-pilates` | 404928000 | Pilates exercise (regime/therapy) | acceptable, the only one |
| `activity-hiit` | none | searched "high intensity", "interval", "interval training" | |
| `activity-weights` | 6397004 | Muscular strength development exercise (regime/therapy) | closest ("Strengthening exercises"); 1386230000 Weightlifting (qualifier value) is the sport, import only |
| `activity-swimming` | 20461001 | Swimming (qualifier value) | yes |
| `activity-cycling` | 54391000087108 | Cycling (qualifier value) | yes |
| `activity-jogging` | 1968006 | Jogging (qualifier value) | yes; 229166008 Jogging training is a therapy |
| `activity-hiking` | none | searched "hiking", "hike", "hill walking", "trekking"; 257737006 Mountaineering is not hiking | |

Removed from the earlier table, wrong or not in the International Edition: `229033006` is "Radioisotope scan of total
body (procedure)"; `710951000000107`, `713015008`, `56493006`, `55881007` and `451261000124100` are not in it.

### HL7 FHIR Physical Activity IG

FHIR PA IG 1.0.0 (STU1), read on hl7.org 2026-11-27. The activity type is an Observation of its own, code LOINC
**73985-4** "Exercise activity", its value an answer of **LL734-5** (an EXAMPLE list: Bicycling `LA11837-4`, Jogging
`LA11835-8`, Running `LA11836-6`, Swimming `LA11838-2`, Walking `LA11834-1`, Weights `LA11839-0`, Mixed `LA11840-8`);
the IG's example is Running. A duration is another Observation (**55411-3** "Exercise duration"), and a group
Observation (code `PAPanel`, an IG temporary code, no value) links them by `hasMember`. Every PA profile requires two
categories, `activity` and the temporary `PhysicalActivity`, and allows `effectiveDateTime` or an `effectivePeriod`
with both start and end. Its activity-measure codes are 73985-4, 55411-3, 77592-4, 77593-2, 55426-1, 55425-3, 55424-6
(no **74008-4** "Exercise intensity": the IG states intensity as moderate and vigorous minutes); its time-measure codes
are 41950-7, 8873-2, 40443-4, 41979-6. The daily steps example is `7267 /d`, dated to the day. "Exercise Vital Sign":
89574-8, with the questions 89555-7 (days per week) and 68516-4 (minutes per day).

LL734-5 has no yoga, pilates, stretching, HIIT or hiking: SNOMED CT stands beside the LA code where a concept fits.

### HDS rendering (FHIR, plan 133)

Every activity item maps to `Observation|activity` (FHIR-MAPPING.md, "Physical activity"). A session, presence or
intensity, is one Observation coded 73985-4 whose `valueCodeableConcept` is the sport (`fixed-coded`): the LA code
first where LL734-5 has one, then SNOMED CT, and for HIIT and hiking, which no terminology has, the HDS code system
`https://hds.ngo/fhir/CodeSystem/activity` (`hiit`, `hiking`). The intensity item adds one component, 74008-4 with
its LL2553-7 answer (Light `LA20164-2`, Moderate `LA20165-9`, Vigorous `LA20166-7`), HDS's choice, so no PA profile is
claimed. A session with a duration states it as `effectivePeriod`. Import only: Running into `activity-jogging`,
Weightlifting `1386230000` into `activity-weights`, `229070002` into `activity-stretching`; Walking and Mixed are
refused (no item). The IG's split shape (a separate 55411-3, `PAPanel`) is not matched: a bridge assembles it.

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
| `activity-distance-walking-running` | `length/m` | `distanceWalkingRunning` | `distance.delta` | 41953-1 Walking distance 24 hour (93849-8 Exercise distance in 24 hour, import only) |
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
- **LOINC for walking and running:** 41953-1 is walking only. LOINC 2.83 has `112427-0` "Distance walking or
  running", but it is a point in time (Pt), not a day; `93849-8` "Exercise distance in 24 hour" is a day, and is
  accepted on import only. 41953-1 stays the exported code (it is in the PA IG's time-measure family).
- **FHIR:** each total renders as an `effectivePeriod` of the stored day (`effective: { from: span, day: true }`):
  start at `time`, end at `time + duration`, in the event's zone. A total that is not one day (a span outside 23 to
  25 h, a date-only period, a point) is refused on render and on import, so a 7 day mean under a "24 hour" code never
  lands as one day. Units: `/d` for steps, `m`, `s`; `km`, `min`, `{steps}` and `{#}/(24.h)` are refused (no declared
  conversion).

## Design Decisions

- **Presence flags** (`activity/plain`): Matches Mira, Clue, Flo. The presence items are deprecated (hidden from
  pickers, still written by presence-only sources); since plan 77 each sport also has an `-intensity` item (Light,
  Moderate, Vigorous: 0.25, 0.5, 1.0), the one to write when an intensity is known. A session's duration is the event's
  own `duration`, on either item.
- **Flat stream**: All activities directly under `activity/` — no sub-categories needed (unlike symptoms).
- **Extensible**: New activity types can be added as new items when HealthKit or other sources provide them.
- **Future**: When richer sources provide calories per session, the event type can evolve (e.g. to a composite type or link to duration observations).
