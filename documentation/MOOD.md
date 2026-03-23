# Mood — Cross-system Compatibility

How HDS mood items can map to external systems, clinical standards, and mood-focused apps.

## Key Models

### Russell's Circumplex Model of Affect

The dominant dimensional model in affective science. Two independent continuous axes:

- **Valence** (horizontal): unpleasant (-1) to pleasant (+1)
- **Arousal** (vertical): low energy/calm (-1) to high energy/activated (+1)

```
                    High Arousal
                        |
           Tense     Angry   |  Excited    Elated
           Anxious   Stressed |  Thrilled   Joyful
                             |
  Unpleasant ────────────────┼──────────────── Pleasant
                             |
           Sad       Bored   |  Content    Serene
           Depressed Fatigued |  Relaxed    Calm
                        |
                    Low Arousal
```

This model underpins Apple's State of Mind API and the How We Feel app (Yale).

### PAD Model (Mehrabian & Russell, 1974)

Extension of the circumplex adding a third axis:

- **Pleasure** (= valence): unpleasant → pleasant
- **Arousal**: calm → excited
- **Dominance**: submissive/powerless → dominant/in-control

Dominance helps distinguish emotions close in circumplex space (e.g. "fear" vs "anger" — both high arousal, unpleasant, but anger is high-dominance while fear is low-dominance).

---

## External Systems

### Apple HealthKit — State of Mind (iOS 17+)

Apple's most sophisticated mood model. Dedicated type `HKStateOfMind` (not a category type).

**Structure:**
| Field | Type | Description |
|---|---|---|
| `kind` | enum | `momentaryEmotion` (right now) or `dailyMood` (overall today) |
| `valence` | Double [-1, +1] | Continuous pleasant-unpleasant scale |
| `valenceClassification` | enum (7) | Discrete bucket from valence |
| `labels` | [Label] | Zero or more emotion labels (multi-select) |
| `associations` | [Association] | Zero or more context/cause tags |

**Valence classification (7 levels):**
| Value | Classification |
|---|---|
| -1.0 to ~-0.71 | Very unpleasant |
| ~-0.71 to ~-0.43 | Unpleasant |
| ~-0.43 to ~-0.14 | Slightly unpleasant |
| ~-0.14 to ~+0.14 | Neutral |
| ~+0.14 to ~+0.43 | Slightly pleasant |
| ~+0.43 to ~+0.71 | Pleasant |
| ~+0.71 to +1.0 | Very pleasant |

**38 emotion labels:**
- Positive (16): amazed, amused, brave, calm, content, excited, grateful, happy, joyful, passionate, peaceful, proud, relieved, confident, hopeful, satisfied
- Negative (19): angry, anxious, ashamed, disappointed, discouraged, disgusted, embarrassed, frustrated, guilty, hopeless, irritated, jealous, lonely, sad, scared, stressed, worried, annoyed, drained, overwhelmed
- Neutral (3): surprised, indifferent

**18 association tags:** community, currentEvents, dating, education, family, fitness, friends, health, hobbies, identity, money, partner, selfCare, spirituality, tasks, travel, work, weather

**Note:** Apple also has the older `HKCategoryTypeIdentifier.moodChanges` which is a simple Present/NotPresent symptom — unrelated to State of Mind.

### SNOMED CT / HL7 FHIR

**SNOMED CT** organizes mood under `106131003 | Mood finding`:
- `366979004` Depressed mood
- `48694002` Anxiety (finding)
- Elevated mood, Irritable mood, Euthymic mood

**FHIR:** No dedicated mood observation profile. Uses:
- `Observation` (category: `survey` or `symptom`) for discrete mood ratings
- `QuestionnaireResponse` for validated instruments (PHQ-9, GAD-7)

**Validated clinical scales:**
| Scale | Items | Range | Purpose |
|---|---|---|---|
| PHQ-2 | 2 | 0-6 | Ultra-brief depression screening |
| PHQ-9 | 9 | 0-27 | Depression severity |
| GAD-7 | 7 | 0-21 | Anxiety severity |
| WHO-5 | 5 | 0-25 | Positive wellbeing |
| PANAS | 20 (10+10) | 10-50 per subscale | Positive/Negative Affect |
| VAMS | 8 VAS | 0-100 each | 8 specific moods |

---

## Mood-focused Apps

### How We Feel (Yale Center for Emotional Intelligence)

Gold standard for emotion tracking. Based on the circumplex model (RULER framework).

- **2D grid**: Pleasantness (valence) x Energy (arousal)
- **4 quadrants**: Red (high energy, unpleasant), Yellow (high energy, pleasant), Green (low energy, pleasant), Blue (low energy, unpleasant)
- **144+ emotion words** distributed across quadrants
- Users locate themselves on the grid, then select a specific word

### Daylio

- **5-point ordinal scale**: Rad, Good, Meh, Bad, Awful
- Pure valence, no arousal axis
- Custom labels mapped to the 5 parent categories
- Activities tracked separately

### Bearable

- **1-10 numeric mood scale** + **separate 1-10 energy scale**
- Discrete emotion tags as secondary layer
- Effectively a valence + arousal model
- Auto-correlates mood with symptoms, sleep, weather, etc.

### MindDoc (formerly Moodpath)

- **5-point scale**: Very Bad, Bad, Moderate, Good, Very Good
- Emotion tags classified as Positive/Negative/Neutral
- Clinically grounded (CBT, validated against PHQ-9)
- Multiple check-ins per day

### Pixels (Year in Pixels)

- **5-level color scale** (one mood per day)
- Pure valence, no emotions
- Visual heatmap of the year

### Finch

- **5-point emoji scale**, asked multiple times per day
- Motivation prompt adds a loosely arousal-like dimension
- Reflection tags for contributing factors

---

## Menstrual Cycle Apps

### Clue

- **13 discrete feelings**: Happy, Sensitive, Sad, Mood Swings, PMS, Anxious, Confident, Insecure, Angry, Grateful, Indifferent, Excited, etc.
- Binary (present/absent), no intensity
- Correlated with cycle phase

### Flo

- **~8-12 mood labels**: Calm, Happy, Sad, Anxious, Mood Swings, Irritable, etc.
- Binary (present/absent)
- Part of 70+ trackable symptoms

### Ovia

- **~4-6+ mood labels**: Happy, Tired, Anxious, Cranky, etc.
- Binary one-tap selection
- Correlated with cycle/pregnancy

---

## Mira

**Field structure:** comma-separated string (not array)
```
"mood": "Excited,Exhausted,Anxiety or panic attacks"
```

**All 15 confirmed values (from real Mira prod API, 2026-03-17):**
Excited, Happy, Tired, Sad, Irritable, Angry, Exhausted, Hopeless, Poor sleep, Trouble focusing, Anxiety or panic attacks, Loss of motivation, Unhappy or depressed, Tense or nervous, Emotional

Values are human-readable labels with spaces (not coded enums). No severity/intensity. Single string when one value, comma-separated when multiple (e.g. `"Excited,Happy,Tired"`).

---

## Cross-system Comparison

| System | Model | Dimensions | Granularity |
|---|---|---|---|
| **Apple State of Mind** | Valence [-1,+1] + discrete labels | Valence (no explicit arousal) | 7 valence levels, 38 labels |
| **How We Feel** | Circumplex (2D) + vocabulary | Valence + Arousal | 144+ words in 4 quadrants |
| **Daylio** | Ordinal valence | Valence only | 5 levels |
| **Bearable** | Numeric valence + energy | Valence + Arousal (separate) | 10+10 levels + tags |
| **Clue/Flo/Ovia** | Discrete binary tags | Implicit valence | 4-13 emotions |
| **Mira** | Discrete comma-separated | None | 15 labels confirmed |
| **PHQ-9/GAD-7** | Clinical screening score | Depression/Anxiety severity | Validated cutoffs |

---

## Analysis: Can a single model convert between all systems?

### The problem with flat labels + valence

Options A-C (from earlier analysis) treat mood as HDS data-model items — a valence number and/or presence-flag labels. This approach:

- **Cannot fully capture Russell's Circumplex**: "Excited" and "Content" are both pleasant (same valence) but differ on arousal. A valence-only number loses this. Even with labels, there's no quantitative basis for conversion.
- **Cannot convert between systems**: Without a vector space, there's no way to compute "Mira 'Excited' is closest to Apple 'excited' + 'thrilled'" or "Daylio 'Rad' maps to How We Feel quadrant Yellow".
- **Loses information on import**: When importing from a 2D system (How We Feel, Bearable) into a 1D model, the arousal dimension is discarded permanently.

### The model-cervical-fluid approach

The `model-cervical-fluid` library solves the exact same class of problem for cervical fluid observations: 15 different charting methods with incompatible vocabularies, unified through an N-dimensional continuous vector space with weighted Euclidean distance for cross-system conversion.

**Architecture:**
1. **Dimensions**: N continuous axes (0-1), each with a weight
2. **Methods**: Each external system's vocabulary mapped to vectors
3. **Conversion**: observation -> vector -> closest match in target method
4. **Round-trip**: observation -> vector -> same observation (verified by tests)

This pattern applies directly to mood.

### Proposed: `model-mood` library

A standalone library (like `model-cervical-fluid`) that maps mood vocabularies across systems via a shared dimensional vector space.

#### Dimensions

Based on established affective science models (Russell's Circumplex + PAD):

| Dimension | Weight | Range | Low (0) | High (1) |
|---|---|---|---|---|
| **valence** | 0.35 | 0-1 | Very unpleasant | Very pleasant |
| **arousal** | 0.30 | 0-1 | Calm, low energy | Activated, high energy |
| **dominance** | 0.15 | 0-1 | Powerless, submissive | In control, dominant |
| **socialOrientation** | 0.10 | 0-1 | Self-focused | Other-focused |
| **temporalFocus** | 0.10 | 0-1 | Past-dwelling | Future-anticipating |

- **valence + arousal** = Russell's Circumplex (covers the core 2D model)
- **dominance** = PAD model's 3rd axis (disambiguates fear vs anger, guilt vs sadness)
- **socialOrientation** = disambiguates lonely vs sad, grateful vs content
- **temporalFocus** = disambiguates worried/hopeful (future) vs guilty/nostalgic (past)

These 5 dimensions can represent any emotion label from any surveyed system as a unique point in vector space.

#### Methods (external systems)

Each system becomes a "method" with its vocabulary mapped to 5D vectors:

| Method | Observations | Components | Notes |
|---|---|---|---|
| **apple** | 38 labels | Single (label) | Valence field maps directly to valence dimension |
| **howWeFeel** | 144+ words | Single (word) | 4 quadrants map to valence+arousal quadrants |
| **daylio** | 5 levels | Single (level) | Valence-only (arousal ~0.5 neutral) |
| **bearable** | 10x10 grid + tags | Composite (mood + energy + tags) | mood=valence, energy=arousal |
| **mira** | N labels | Single (label) | Comma-separated, presence only |
| **clue** | 13 feelings | Single (label) | Binary presence |
| **flo** | 8-12 labels | Single (label) | Binary presence |

#### Example vectors

| Emotion | valence | arousal | dominance | socialOrientation | temporalFocus |
|---|---|---|---|---|---|
| excited | 0.85 | 0.90 | 0.65 | 0.40 | 0.70 |
| calm | 0.70 | 0.15 | 0.55 | 0.35 | 0.45 |
| content | 0.75 | 0.25 | 0.60 | 0.40 | 0.45 |
| anxious | 0.15 | 0.80 | 0.20 | 0.35 | 0.80 |
| sad | 0.15 | 0.20 | 0.25 | 0.30 | 0.60 |
| angry | 0.10 | 0.85 | 0.75 | 0.55 | 0.40 |
| exhausted | 0.20 | 0.05 | 0.15 | 0.25 | 0.35 |
| grateful | 0.85 | 0.35 | 0.50 | 0.80 | 0.55 |
| lonely | 0.15 | 0.20 | 0.20 | 0.85 | 0.50 |
| guilty | 0.10 | 0.40 | 0.15 | 0.75 | 0.75 |
| hopeful | 0.75 | 0.50 | 0.45 | 0.40 | 0.85 |
| scared | 0.10 | 0.85 | 0.10 | 0.30 | 0.75 |

Note how the extra dimensions disambiguate pairs that are close in 2D circumplex space:
- **angry vs scared**: both unpleasant + high arousal, but anger is high-dominance, fear is low-dominance
- **sad vs lonely**: both unpleasant + low arousal, but lonely is high social-orientation
- **guilty vs sad**: both unpleasant + low-medium arousal, but guilty is high social-orientation + past-focused
- **excited vs angry**: both high arousal, but opposite valence and different dominance

#### Example conversion flow

```
// Mira "Excited" -> Apple State of Mind
model.convert("Excited", "mira", "apple")
// -> { label: "excited", valence: 0.85, distance: 0.02 }

// Daylio "Rad" -> How We Feel
model.convert("Rad", "daylio", "howWeFeel")
// -> { word: "elated", quadrant: "yellow", distance: 0.08 }

// Bearable {mood: 8, energy: 3} -> Clue
model.convert({mood: 8, energy: 3}, "bearable", "clue")
// -> "Calm" (pleasant + low energy)
```

#### Relationship to HDS data model

The `model-mood` library is a **conversion tool**, separate from HDS storage. For HDS storage (data-model), the model's vector itself could be stored as the event content, or individual dimensions could map to HDS items. This decision can be made after the model library exists.

### Coverage assessment: which systems can the 5D model fully capture?

| System | Full round-trip? | Notes |
|---|---|---|
| **Russell's Circumplex** | Yes | valence + arousal cover both axes completely |
| **PAD Model** | Yes | valence + arousal + dominance = all 3 PAD axes |
| **Apple State of Mind** | Yes | valence maps directly; 38 labels all representable as unique vectors; associations are metadata (not mood) |
| **How We Feel** | Yes | 2D grid = valence + arousal; 144 words distinguishable with 5D |
| **Daylio** | Yes | 5 ordinal levels = 5 valence points (arousal neutral) |
| **Bearable** | Yes | mood = valence, energy = arousal; emotion tags as labels |
| **Clue/Flo/Ovia** | Yes | discrete labels all mappable to unique vectors |
| **Mira** | Yes | discrete labels mappable; no info lost (Mira has no dimensions to lose) |
| **PHQ-9/GAD-7** | Partial | clinical scores map to a region (low valence, specific arousal range) but not individual items; these are screening instruments, not emotion vocabularies |
| **PANAS** | Yes | Positive Affect ~ high valence+arousal, Negative Affect ~ low valence+high arousal |

### Open questions

- **Dimension count**: Are 5 dimensions the right number, or would 3 (valence + arousal + dominance) suffice? More dimensions = better disambiguation but harder to validate vector assignments.
- **Weight tuning**: Weights are proposed based on importance in literature. Could be refined empirically (as done in model-cervical-fluid via analysis tools).
- **Scope**: Should `model-mood` also handle **mood associations/context** (Apple's 18 tags, Bearable's correlations)? Or keep those as separate HDS metadata?
- **Library vs inline**: Build as a standalone `model-mood` package (like model-cervical-fluid), or start simpler with conversion tables in bridge-mira?

---

## Status: IN PROGRESS (Plan 13, Phase B)

The `wellbeing-mood` item with `mood/5d-vectors` event type is defined in data-model. Bridge-mira converter implementation is next — mapping Mira's 15 labels to 5D vectors inline (no standalone model-mood library yet).

### Design decisions (settled 2026-03-17)
- **Library vs inline**: Start with inline `MOOD_VECTORS` map in bridge-mira converter. Extract to a shared library later when more methods (Apple, How We Feel) need conversion.
- **Anxiety/Stress from symptoms field**: Skipped — only captured through mood vectors. Avoids duplication between symptom presence flags and dimensional mood data.
- **Mira "Normal"**: Maps to neutral vector (0.50 on all axes) — represents absence of strong emotion, not absence of data.
