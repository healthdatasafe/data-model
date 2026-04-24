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
| moodChanges | Presence |
| sleepChanges | Presence |

**Notes:**
- All symptom types are `HKCategorySample` (categorical over a time interval, not numeric measurements).
- Introduced in iOS 13.6 (26 symptoms) and expanded in iOS 14 (13 more, total 39).

---

### SNOMED CT / HL7 FHIR

**SNOMED CT** organizes symptoms under **404684003 |Clinical finding|**, grouped by body system via the `Finding site` attribute.

| Body System | SNOMED Concept ID | Example symptoms |
|-------------|-------------------|------------------|
| Digestive system | 53619000 | nausea (73879007), bloating (236653009) |
| Nervous system | 118940003 | headache (25064002), dizziness (404640003) |
| Respiratory system | 50043002 | cough, dyspnea, wheezing |
| Musculoskeletal system | 928000 | joint pain, back pain |
| General/constitutional | 162408000 | fatigue (84229001), malaise, fever |

**FHIR modeling:**
- **Observation** (category: `survey` or `symptom`) — for point-in-time patient-reported symptoms
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
| Nausea | `nausea` (Severity) | 73879007 |
| Cramps | `abdominalCramps` (Severity) | 21522001 |
| Gas | — | 271835004 |
| Cravings | — | — |
| Sore breasts | `breastPain` (Severity) | 290077003 |
| Bloating | `bloating` (Severity) | 248490000 |
| Backache | `lowerBackPain` (Severity) | 161891005 |
| Dizziness | `dizziness` (Severity) | 404640003 |
| Acne | `acne` (Severity) | 11381005 |
| Diarrhea | `diarrhea` (Severity) | 62315008 |
| Constipation | `constipation` (Severity) | 14760008 |
| Water retention | — | 43498006 |
| Body/Facial hair growth | — | 66520009 (hirsutism) |
| Hair loss | `hairLoss` (Severity) | 278040002 |
| Insomnia | `sleepChanges` (Presence) | 193462001 |
| Low energy | `fatigue` (Severity) | 84229001 |
| Anxiety | `moodChanges` (Presence) | 48694002 |
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
| Constitutional | 4 symptoms (Severity) | General symptom (162408000) | Low energy | Fatigue |
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
| Anxiety | **finding** (48694002) | symptom (`moodChanges`) | Transient = symptom; persistent = condition (anxiety disorder 197480006) |
| Weight fluctuations | — (derived measurement) | quantity (`bodyMass`) | Not a symptom — computed from weight tracking |

**HDS approach:** Model these as self-reported symptom observations (FHIR `Observation` category `symptom`), not conditions. The same concept can exist as both a symptom item (self-reported presence) and a condition in a clinical context — the FHIR resource type determines the interpretation.

---

## Design Considerations

### Event type options for symptoms

| Approach | Pros | Cons |
|----------|------|------|
| `activity/plain` (presence + duration) | Simple, matches Ovia/most apps. Duration captures "how long". | No severity. |
| `ratio/proportion` (0-1 scale) | Captures severity. Maps to Apple HealthKit Mild/Moderate/Severe. | More complex. Not all sources provide severity. |
| Both: `activity/plain` as base, extend to `ratio/proportion` later | Start simple, add severity when needed per symptom. | Item version management. |

### Severity mapping (if ratio/proportion is used)

HDS uses a canonical **5-level** severity scale on `ratio/proportion`. See `DESIGN-NOTES.md` → "Scale hook placement" for the governing rule — hooks are placed at semantic anchors, not by even distribution.

| HDS label | HDS ratio value | Apple HealthKit (4-level) |
|---|---|---|
| None | 0.0 | NotPresent |
| Slight (or Mild) | 0.25 | Mild |
| Moderate | 0.5 | Moderate |
| Severe | 0.75 | *(no Apple equivalent)* |
| Very severe (or Extreme) | 1.0 | Severe (Apple ceiling) |

Apple HealthKit's 4-level `HKCategoryValueSeverity` is a **subset** of the HDS 5-level scale — sharing hooks at 0.0, 0.25, 0.5, and 1.0, with no Apple equivalent at the 0.75 position.

- **Bridge conversion** (Apple → HDS): map by label, not by numeric proximity — `NotPresent → None (0.0)`, `Mild → Slight (0.25)`, `Moderate → Moderate (0.5)`, `Severe → Very severe (1.0)` (Apple's ceiling maps to the HDS ceiling).
- **Bridge conversion** (HDS → Apple): `None → NotPresent`, `Slight → Mild`, `Moderate → Moderate`, `Severe → ` tie-break to Apple `Severe` (upward, conservative), `Very severe → Severe`.
- **Closest-value** matching works correctly for all 4 Apple values and 4 of 5 HDS values under this placement; only the HDS `0.75` hook has no Apple equivalent and must tie-break by label rather than by distance.

Sources that use a 3-level or 4-level subset (Mira's `level` field, etc.) land on the same hooks as Apple's equivalent labels above — by label lookup, not by numeric distribution.

> **Revision note (Plan 44, 2026-04-24).** An earlier draft of this table placed Apple's 4 levels at `0.0 / 0.33 / 0.66 / 1.0` (even-distribution). That placement put "Moderate" above the semantic middle of the scale (0.66 vs 0.5) and broke round-trip interop with the HDS 5-level scale: a 5-level `Moderate (0.5)` would have escalated to `Severe (0.75)` after passing through a 4-level store, because 0.66 is numerically closer to 0.75 than to 0.5. The current placement (subset of 5-level) is semantic-anchor-aligned and round-trip-stable. Not a breaking change — the severity extension was never implemented.

### Naming conventions

Symptoms use long descriptive IDs for clarity:
- `symptom-gastrointestinal-nausea` (verbose, self-documenting)
- `sym-gi-nausea` (compact, needs legend)
- Decision: TBD based on existing HDS naming conventions

### Cross-boundary items

Some Mira concepts appear in multiple fields:
- **Acne**: appears in both `skin` field (as "Breaking out") and `symptoms` field (as "Acne"). In HDS, `body-skin-acne` exists under body/skin stream. When acne comes from the symptom field, should it map to the same item or a separate symptom item? See open questions below.
- **Anxiety/Stress**: appear in `symptoms` field AND overlap with `mood` field (5D mood vectors capture anxiety/stress as emotional states). These are complementary: symptom = "I have anxiety today", mood = "I feel anxious right now (valence=0.15, arousal=0.80)".

### Design decisions (settled 2026-03-17)

1. **Acne dual-source**: Mira's `symptoms.Acne` maps to existing `body-skin-acne` (reuse). Single item regardless of source — matches Apple HealthKit's single `acne` identifier.
2. **Anxiety / Stress / Depression** *(revised 2026-04-24, Plan 44)*: two distinct clinical constructs, mapped to different HDS items depending on what the source captures.
   - **Transient mood tags** — e.g. an entry in a symptoms-array or a free-form mood label flagging "anxious", "stressed", or "depressed" for the moment, with no validated severity scale. Captured through `wellbeing-mood` 5D vectors (via the `mood` converter). No symptom item. Unchanged rule.
   - **Validated distress-severity ratings** — e.g. EQ-5D-5L D5, Kessler K6/K10, HADS-A/-D, PHQ-2/PHQ-9, GAD-2/GAD-7, PROMIS Emotional Distress, DASS-21. Captured through the dedicated `wellbeing-mental-distress` (combined), `wellbeing-mental-distress-anxiety` (anxiety subscale), or `wellbeing-mental-distress-depression` (depression subscale) items on the 5-level `ratio/proportion` scale defined above.
   - **Hybrid sources** that expose a symptom-array entry with an *optional `level`* field (e.g. Mira's `symptoms.Anxiety` with `level: "Mild"`) sit between the two: the presence of a validated level makes this a severity rating, not a transient tag. Map it to `wellbeing-mental-distress-anxiety` / `…-depression` with the hook corresponding to the level — see `_plans/XXX-Backlog/MIRA-FINALIZE.md` for the Mira conversion specifics.
3. **Increased appetite**: Modeled as `nutrition-appetite` under new top-level `nutrition/` stream with `ratio/proportion` (0.25=decreased, 0.50=normal, 0.75=increased). Matches Apple HealthKit's 3-value `appetiteChanges` enum.
4. **Weight fluctuations**: Skipped — derived from body-weight measurements, not a symptom.
5. **Stream hierarchy**: Full clinical sub-categories under `symptom/` (gastrointestinal, pain, neurological, dermatological, sleep, metabolic, general) — ready for future items from HealthKit and other integrations.
