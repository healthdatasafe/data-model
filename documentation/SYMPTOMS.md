# Symptoms — Cross-system Compatibility

How HDS symptom items map to external systems and clinical terminologies.

## External Systems Overview

### Apple HealthKit (39 symptom types)

Apple uses a **flat list** of symptom identifiers under `HKCategoryTypeIdentifier`. No sub-categories in the API, but logically groupable by body system.

**Value types:**
- **HKCategoryValueSeverity** (used by 36/39 symptoms): Unspecified (0), NotPresent (1), Mild (2), Moderate (3), Severe (4)
- **HKCategoryValuePresence** (2 symptoms): Present (0), NotPresent (1) — used by `moodChanges`, `sleepChanges`
- **HKCategoryValueAppetiteChanges** (1 symptom): Unspecified (0), NoChange (1), Decreased (2), Increased (3)

**Complete list by body system:**

#### Gastrointestinal (7)
| HealthKit Identifier | Value Type |
|---|---|
| abdominalCramps | Severity |
| bloating | Severity |
| constipation | Severity |
| diarrhea | Severity |
| heartburn | Severity |
| nausea | Severity |
| vomiting | Severity |

#### Respiratory (6)
| HealthKit Identifier | Value Type |
|---|---|
| coughing | Severity |
| runnyNose | Severity |
| shortnessOfBreath | Severity |
| sinusCongestion | Severity |
| soreThroat | Severity |
| wheezing | Severity |

#### Pain (4)
| HealthKit Identifier | Value Type |
|---|---|
| breastPain | Severity |
| chestTightnessOrPain | Severity |
| lowerBackPain | Severity |
| pelvicPain | Severity |

#### Cardiovascular (2)
| HealthKit Identifier | Value Type |
|---|---|
| rapidPoundingOrFlutteringHeartbeat | Severity |
| skippedHeartbeat | Severity |

#### Neurological (4)
| HealthKit Identifier | Value Type |
|---|---|
| dizziness | Severity |
| fainting | Severity |
| headache | Severity |
| memoryLapse | Severity |

#### Constitutional / Whole Body (4)
| HealthKit Identifier | Value Type |
|---|---|
| chills | Severity |
| fatigue | Severity |
| fever | Severity |
| generalizedBodyAche | Severity |

#### Skin & Hair (3)
| HealthKit Identifier | Value Type |
|---|---|
| acne | Severity |
| drySkin | Severity |
| hairLoss | Severity |

#### Sensory (2)
| HealthKit Identifier | Value Type |
|---|---|
| lossOfSmell | Severity |
| lossOfTaste | Severity |

#### Hormonal / Menopause (3)
| HealthKit Identifier | Value Type |
|---|---|
| hotFlashes | Severity |
| nightSweats | Severity |
| vaginalDryness | Severity |

#### Urological (1)
| HealthKit Identifier | Value Type |
|---|---|
| bladderIncontinence | Severity |

#### Behavioral / Mood / Sleep (3)
| HealthKit Identifier | Value Type |
|---|---|
| appetiteChanges | AppetiteChanges (special) |
| moodChanges | Presence (→ `wellbeing-mood-swings`, decision 6) |
| sleepChanges | Presence |

**Notes:**
- All symptom types are `HKCategorySample` (categorical over a time interval, not numeric measurements).
- Introduced in iOS 13.6 (26 symptoms) and expanded in iOS 14 (13 more, total 39).

---

### SNOMED CT / HL7 FHIR

**SNOMED CT** organizes symptoms under **404684003 |Clinical finding|**, grouped by body system via the `Finding site` attribute.

| Body System | SNOMED Concept ID | Example symptoms |
|-------------|-------------------|------------------|
| Digestive system | 53619000 | nausea (422587007), bloating (116289008) |
| Nervous system | 118940003 | headache (25064002), dizziness (404640003) |
| Respiratory system | 50043002 | cough, dyspnea, wheezing |
| Musculoskeletal system | 928000 | joint pain, back pain |
| General/constitutional | 162408000 | fatigue (84229001), malaise (367391008), fever |

**FHIR modeling:**
- **Observation**: for point-in-time patient-reported symptoms. HL7's observation-category system has no symptom code
  (its nine codes, and US Core 6.1.0's four, name none), so HDS renders its own category (§ HDS rendering in FHIR, below)
- **Condition** — for persistent/recurring symptoms on a problem list
- **Questionnaire / QuestionnaireResponse** (SDC profile) — for structured symptom diary entries
- Rule of thumb: episodic self-reports → Observation; persistent patterns → Condition

**Relevant code systems:**
- SNOMED CT `Clinical finding` hierarchy — primary coding backbone
- LOINC — for structured questionnaire items
- ICD-10 Chapter R — supplementary grouping (symptoms, signs, abnormal findings)

---

### Ovia Health

Ovia tracks **100+ symptoms** across these categories (no public API; reconstructed from research papers and app content):

- **Period-related**: spotting (with color), flow intensity, discharge
- **Physical**: headaches, migraines, cramps, backache, breast tenderness, nausea, bloating, constipation, diarrhea, dizziness, hot flashes, acne, fatigue, mittelschmerz
- **Behavioral**: mood (10+ options), sleep patterns, sex drive, cravings, appetite changes
- **Cervical**: fluid quality/amount, position (height/firmness/opening)
- **Menopause additions**: hot flashes, night sweats, vaginal dryness, mood swings
- **Postpartum additions**: birth recovery, postpartum mood states

Most symptoms recorded as **presence flags** (not severity-graded).

Source: PMC8631160 — "The real-world applications of the symptom tracking functionality available to menstrual health tracking apps" (2021)

---

### Mira

**API structure** (`symptoms` field in daily log):
```json
"symptoms": [
  { "value": "Headache", "level": "Mild" },
  { "value": "Nausea", "level": "Mild" },
  { "value": "Cravings" }
]
```

- `value` (string, required): symptom name
- `level` (string, optional): severity — only "Mild" documented, likely also "Moderate"/"Severe"
- Flat array, no categorization in the API
- API is read-only; no schema enumerating valid values

**All 22 confirmed symptom values (from real Mira prod API, 2026-03-17):**

| Mira value | Apple HealthKit match | SNOMED CT |
|---|---|---|
| Headache | `headache` (Severity) | 25064002 |
| Migraine | `headache` (Severity) | 37796009 |
| Nausea | `nausea` (Severity) | 422587007 |
| Cramps | `abdominalCramps` (Severity) | 55300003 (Cramp: the item is abdominal or pelvic cramps) |
| Gas | — | 308698004 |
| Cravings | — | 192019001 |
| Sore breasts | `breastPain` (Severity) | 53430007 (55222007 tenderness, import only) |
| Bloating | `bloating` (Severity) | 116289008 |
| Backache | `lowerBackPain` (Severity) | 161891005 |
| Dizziness | `dizziness` (Severity) | 404640003 |
| Acne | `acne` (Severity) | 11381005 |
| Diarrhea | `diarrhea` (Severity) | 62315008 |
| Constipation | `constipation` (Severity) | 14760008 |
| Water retention | — | 43498006 |
| Body/Facial hair growth | — | 271607001 (excessive hair growth; the hirsutism disorders import only) |
| Hair loss | `hairLoss` (Severity) | 278040002 |
| Insomnia | `sleepChanges` (Presence) | 301345002 (difficulty sleeping; 193462001 the disorder, import only) |
| Low energy | `fatigue` (Severity) | 84229001 |
| Sickness | — (no HealthKit type) | 367391008 (malaise: Mira does not document the value; it also sends Nausea, so read as feeling unwell) |
| Anxiety | — (`moodChanges` is mood swings, decision 6) | 48694002 |
| Stress | — | 73595000 |
| Increased appetite | `appetiteChanges` (AppetiteChanges) | 72405004 |
| Weight fluctuations | — (quantitative: `bodyMass`) | — (derived) |

**Separate Mira daily log fields** (not in `symptoms` array):
- `mood` — e.g. "Excited", "Exhausted" (see MOOD.md)
- `skin` — e.g. "Dry", "Glowing" (see SKIN.md)
- `sex_drive` — e.g. "High", "Neutral", "Low"
- `cervical_mucous` — object with `description` and `volume`
- `cervical_position` — object with `height`, `openness`, `texture`
- `physical_activity` — e.g. "Weights", "Yoga"
- `bleeding` — e.g. "Postpartum bleeding", "Miscarriage bleeding"

---

## Cross-system Category Alignment

| HDS Category | Apple HealthKit | SNOMED CT Parent | Mira | Ovia |
|---|---|---|---|---|
| Gastrointestinal | 7 symptoms (Severity) | Digestive system (53619000) | Nausea, Gas, Cramps, Cravings, Bloating, Diarrhea, Constipation, Increased appetite | Nausea, bloating, cramps, diarrhea, constipation |
| Pain / Musculoskeletal | 4 symptoms (Severity) | Finding site-based | Headache, Migraine, Sore breasts, Backache | Headaches, migraines, cramps, backache, breast tenderness |
| Neurological | 4 symptoms (Severity) | Nervous system (118940003) | Dizziness | Dizziness |
| Constitutional | 4 symptoms (Severity) | General symptom (162408000) | Low energy, Sickness | Fatigue |
| Dermatological | 3 symptoms (Severity) | Finding site-based | Acne, Hair loss, Body/Facial hair growth | Acne |
| Psychological | 3 symptoms (Presence/special) | Finding-based | Anxiety, Stress | Mood (10+ options) |
| Sleep | `sleepChanges` (Presence) | 193462001 | Insomnia | Sleep patterns |
| Metabolic | `appetiteChanges` (special) | Various | Water retention, Weight fluctuations | Appetite changes |
| Respiratory | 6 symptoms (Severity) | Respiratory system (50043002) | — | — |
| Cardiovascular | 2 symptoms (Severity) | — | — | — |
| Hormonal/Menopause | 3 symptoms (Severity) | — | — | Hot flashes, night sweats, vaginal dryness |
| Urological | 1 symptom (Severity) | — | — | — |
| Sensory | 2 symptoms (Severity) | — | — | — |

---

## Symptom vs Observation vs Condition

Some concepts tracked as "symptoms" in consumer apps are clinically classified differently:

| Concept | SNOMED semantic tag | Apple HealthKit | Clinical note |
|---|---|---|---|
| Acne | **disorder** (11381005) | symptom (`acne`) | Self-reported = symptom; diagnosed = condition |
| Hirsutism | **disorder** (66520009) | — | Endocrine disorder; self-reported = symptom |
| Insomnia | **disorder** (193462001) | symptom (`sleepChanges`) | Sleep disorder (ICD-10: G47.0); "difficulty sleeping" is a symptom |
| Anxiety | **finding** (48694002) | — (`moodChanges` is mood swings) | Transient = symptom; persistent = condition (anxiety disorder 197480006) |
| Weight fluctuations | — (derived measurement) | quantity (`bodyMass`) | Not a symptom — computed from weight tracking |

**HDS approach:** Model these as self-reported symptom observations (FHIR `Observation` in the HDS category `symptom`, § HDS rendering in FHIR), not conditions. The same concept can exist as both a symptom item (self-reported presence) and a condition in a clinical context: the FHIR resource type determines the interpretation.

---

## Design Considerations

### Event type options for symptoms

| Approach | Pros | Cons |
|----------|------|------|
| `activity/plain` (presence + duration) | Simple, matches Ovia/most apps. Duration captures "how long". | No severity. |
| `ratio/proportion` (0-1 scale) | Captures severity. Maps to Apple HealthKit Mild/Moderate/Severe. | More complex. Not all sources provide severity. |
| Both: `activity/plain` as base, extend to `ratio/proportion` later | Start simple, add severity when needed per symptom. | Item version management. |

**Decided (plan 77): both, on one stream.** Each symptom has a presence marker at the base key (`activity/plain`,
`deprecated: true`: hidden from pickers, still written by presence-only sources) and a `-severity` item
(`ratio/proportion`, the 5-level scale below). `symptom-pain-severity` alone has no presence marker.

### Severity mapping (if ratio/proportion is used)

HDS uses a canonical **5-level** severity scale on `ratio/proportion`. See `DESIGN-NOTES.md` → "Scale hook placement" for the governing rule — hooks are placed at semantic anchors, not by even distribution.

| HDS label | HDS ratio value | Apple HealthKit (4-level) |
|---|---|---|
| None | 0.0 | NotPresent |
| Slight (or Mild) | 0.25 | Mild |
| Moderate | 0.5 | Moderate |
| Severe | 0.75 | Severe |
| Extreme | 1.0 | *(no Apple equivalent)* |

Apple HealthKit's 4-level `HKCategoryValueSeverity` is a **subset** of the HDS 5-level scale, **mapped by label**: it shares the hooks 0.0, 0.25, 0.5 and 0.75, and has no equivalent at 1.0 (Extreme).

- **Bridge conversion** (Apple → HDS): map by label, not by numeric proximity or by ceiling: `NotPresent → None (0.0)`, `Mild → Slight (0.25)`, `Moderate → Moderate (0.5)`, `Severe → Severe (0.75)`.
- **Bridge conversion** (HDS → Apple): `None → NotPresent`, `Slight → Mild`, `Moderate → Moderate`, `Severe → Severe`, `Extreme → Severe` (Apple's ceiling).
- One rule for every source: Mira's `level` (Mild 0.25, Moderate 0.5, Severe 0.75), a FHIR answer (SNOMED CT or LOINC Severe is 0.75, § HDS rendering in FHIR) and Apple land on the hook their label names. A 3-level source's top label is "Severe", never stretched to the HDS ceiling.

> **Correction (plan 133, 2026-11-27, B-2026-11-27-47).** Until then this section mapped Apple's `Severe` to 1.0 ("Apple's ceiling maps to the HDS ceiling"), while Mira's bridge and every FHIR answer map "Severe" by label to 0.75. perki decided for the label rule: an incoming "Severe" is 0.75 whatever its source.

Sources that use a 3-level or 4-level subset (Mira's `level` field, etc.) land on the same hooks as Apple's equivalent labels above — by label lookup, not by numeric distribution.

> **Revision note (Plan 44, 2026-04-24).** An earlier draft of this table placed Apple's 4 levels at `0.0 / 0.33 / 0.66 / 1.0` (even-distribution). That placement put "Moderate" above the semantic middle of the scale (0.66 vs 0.5) and broke round-trip interop with the HDS 5-level scale: a 5-level `Moderate (0.5)` would have escalated to `Severe (0.75)` after passing through a 4-level store, because 0.66 is numerically closer to 0.75 than to 0.5. The current placement (subset of 5-level) is semantic-anchor-aligned and round-trip-stable. Not a breaking change — the severity extension was never implemented.

### Naming conventions

Symptoms use long descriptive IDs for clarity:
- `symptom-gastrointestinal-nausea` (verbose, self-documenting)
- `sym-gi-nausea` (compact, needs legend)
- Decision: the long form, `symptom-<group>-<concept>`, with `-severity` for the graded item
  (`symptom-gastrointestinal-nausea`, `symptom-gastrointestinal-nausea-severity`). No compact key exists.

### Cross-boundary items

Some Mira concepts appear in multiple fields:
- **Acne**: appears in both `skin` field (as "Breaking out") and `symptoms` field (as "Acne"). In HDS, `body-skin-acne` exists under body/skin stream. When acne comes from the symptom field, it maps to the same item (decision 1 below).
- **Anxiety/Stress**: appear in `symptoms` field AND overlap with `mood` field (5D mood vectors capture anxiety/stress as emotional states). These are complementary: symptom = "I have anxiety today", mood = "I feel anxious right now (valence=0.15, arousal=0.80)".

### Design decisions (settled 2026-03-17)

1. **Acne dual-source**: Mira's `symptoms.Acne` maps to existing `body-skin-acne` (reuse). Single item regardless of source — matches Apple HealthKit's single `acne` identifier.
2. **Anxiety / Stress / Depression** *(revised 2026-04-24, Plan 44)*: two distinct clinical constructs, mapped to different HDS items depending on what the source captures.
   - **Transient mood tags** — e.g. an entry in a symptoms-array or a free-form mood label flagging "anxious", "stressed", or "depressed" for the moment, with no validated severity scale. Captured through `wellbeing-mood` 5D vectors (via the `mood` converter). No symptom item. Unchanged rule.
   - **Validated distress-severity ratings** — e.g. EQ-5D-5L D5, Kessler K6/K10, HADS-A/-D, PHQ-2/PHQ-9, GAD-2/GAD-7, PROMIS Emotional Distress, DASS-21. Captured through the dedicated `wellbeing-mental-distress` (combined), `wellbeing-mental-distress-anxiety` (anxiety subscale), or `wellbeing-mental-distress-depression` (depression subscale) items on the 5-level `ratio/proportion` scale defined above.
   - **Hybrid sources** that expose a symptom-array entry with an *optional `level`* field (e.g. Mira's `symptoms.Anxiety` with `level: "Mild"`) sit between the two: the presence of a validated level makes this a severity rating, not a transient tag. Map it to `wellbeing-mental-distress-anxiety` / `…-depression` with the hook corresponding to the level; the Mira conversion specifics live with the bridge.
3. **Increased appetite**: Modeled as `nutrition-appetite` under new top-level `nutrition/` stream with `ratio/proportion` (0.25=decreased, 0.50=normal, 0.75=increased). Matches Apple HealthKit's 3-value `appetiteChanges` enum.
4. **Weight fluctuations**: Skipped — derived from body-weight measurements, not a symptom.
5. **Stream hierarchy**: Full clinical sub-categories under `symptom/`. The first seven (gastrointestinal, pain, neurological, dermatological, sleep, metabolic, general) have grown to fourteen: those, plus cognitive, respiratory, cardiac, thermoregulation, vision, hydration and bleeding (51 leaf streams in all).
6. **Mood swings** *(site-agents#68)*: a report that the mood changes a lot over a short time is a symptom, not a mood state. `wellbeing-mood` (5D vectors) holds a state at a point in time, and none of its dimensions says the mood varies, so a ticked "Mood swings" box written there would claim a state the person never reported. Recorded on `wellbeing-mood-swings` (stream beside the mental-distress items, not under them: it is not a validated distress rating): the presence marker at the base key (`activity/plain`, hidden from pickers, written by presence-only sources such as a checklist) and `wellbeing-mood-swings-severity` (`ratio/proportion`, the 5-level symptom scale). SNOMED `18963009` "Mood swings (finding)", synonyms "Labile mood", "Emotional lability". The item is not PMS-specific; no key carries the premenstrual context yet. A "Mood swings" tag from any source writes `wellbeing-mood-swings`, and no mood converter method carries that label. Apple HealthKit `moodChanges` (Presence) writes `wellbeing-mood-swings`, not anxiety. To be migrated: the femm adapter of bridge-cycles-files (`src/adapters/femm/mapping.ts:105`) still maps femm's `mood_swings` to a mood vector.
7. **Oily hair or scalp** *(site-agents#69)*: `body-skin-oily` is skin. Recorded on `symptom-dermatological-hair-oily`, beside hair loss and hair growth, with the same twin shape (presence `activity/plain`, `-severity` `ratio/proportion`). SNOMED `67295004` "Greasy hair (finding)", synonym "Oily hair"; no concept names the scalp, so the label says hair and the description says hair or scalp. Cross-system match: Clue's Hair category (Good, Bad, Oily, Dry; SKIN.md), its "Oily" value. The item is not PMS-specific; no key carries the premenstrual context yet.

**Hearing under a vision key.** `symptom-vision-hearing-difficulty` (and its `-severity`) records difficulty hearing,
on a stream of the `symptom-vision` group, whose label is "Vision & Sensory". The key and the stream id say vision
although the item is about hearing, and a grant on `symptom-vision` covers it. Keys and published streams are permanent,
so it stays as it is.

---

## HDS rendering in FHIR

Plan 133 (FHIR-MAPPING.md, "Symptoms"). Every item of the 51 `symptom-*` leaf streams carries a block; the
`wellbeing-mental-distress-*` and `wellbeing-mood-swings` items, `body-skin-acne` and `nutrition-appetite` are not
in this family, even when Mira sends them in its `symptoms` array.

- **Category:** `symptom` in the HDS system `https://hds.ngo/fhir/CodeSystem/observation-category` (HL7 has none, see
  "SNOMED CT / HL7 FHIR" above). Import also accepts `survey`, `exam` or no category. Scope
  `patient/Observation.rs?category=symptom`; the 51 leaf streams are its grant roots, never `symptom` or a body-system
  group. Offered ticked (not opt-in).
- **Shape (the C-CDA question):** `code` LOINC `75325-1` "Symptom", `valueCodeableConcept` the finding (the one SNOMED
  CT concept of the stream; hot flashes, with no active concept, `https://hds.ngo/fhir/CodeSystem/symptom|hot-flashes`),
  and for a `-severity` event a `64750-3` "Severity of symptoms" component. The presence twin renders the same resource
  without the component; on import a resource without the component goes back to it (P1). Other concepts a symptom
  covers are import only (cramps: 51197009 Stomach cramps, 431416001 Menstrual cramp; sore breasts: 55222007,
  302003005; gas: 249504006, 80301007; and so on, in the items' blocks).
- **The date** is the event's span: a point for a daily log, an `effectivePeriod` for an interval (HealthKit).
- **Severity:**

  | HDS value | HDS label | Rendered answer (LL4051-0) | Also imported (by label) |
  |---|---|---|---|
  | 0 | None | **code `111551-8` "Symptom absent"**, the finding as value, no component (LA137-2 None under `75325-1` also imports) | SNOMED 260413007 None |
  | 0.25 | Slight | LA6752-5 Mild | LA11910-9 Slight; SNOMED 255604002 Mild, 255510006 Slight, 162468002 Symptom mild |
  | 0.5 | Moderate | LA6751-7 Moderate | SNOMED 6736007 Moderate severity, 162469005 Symptom moderate |
  | 0.75 | Severe | LA6750-9 Severe | SNOMED 24484000 Severe, 162470006 Symptom severe |
  | 1 | Extreme | LA11912-5 Extreme | LA13958-6 Very severe; SNOMED 12565001 Extreme, 162471005 Symptom very severe |

  Refused on import: Trivial (162466003), "mild to moderate", "moderate to severe" (no HDS level means them). The zero
  shape (`111551-8` with the finding as value) passed the HL7 validator (hds-fhir-js `validate:fhir`, US Core and IPS,
  2026-11-27) and renders; the None component under `75325-1` still imports.
- **Pain severity** (`symptom-pain-severity`, no presence twin): `code` LOINC `38208-5` "Pain severity - Reported",
  the same five answers as its value; a 0 to 10 score is refused.
