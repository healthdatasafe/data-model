# Skin — Cross-system Compatibility

How HDS skin items can map to external systems, clinical standards, and health tracking apps.

## Context

Skin quality tracking is common in menstrual/fertility apps because skin changes correlate with hormonal fluctuations across the cycle. This is a **self-reported wellness observation** domain, not clinical dermatology — it includes positive states ("Glowing") alongside symptoms ("Acne").

---

## External Systems

### Apple HealthKit — Skin & Hair Symptoms

3 skin/hair-related symptom identifiers (out of 39 total, iOS 13.6+):

| HKCategoryTypeIdentifier | SNOMED equivalent | Value Type |
|---|---|---|
| `acne` | 11381005 | HKCategoryValueSeverity |
| `drySkin` | 52475004 (Xeroderma) | HKCategoryValueSeverity |
| `hairLoss` | — | HKCategoryValueSeverity |

**HKCategoryValueSeverity** enum (same as all other HealthKit symptoms):

| Case | Raw | Meaning |
|---|---|---|
| Unspecified | 0 | No severity recorded |
| NotPresent | 1 | Not present |
| Mild | 2 | Mild |
| Moderate | 3 | Moderate |
| Severe | 4 | Severe |

**Notable gaps:** No "oily skin", "glowing", or other positive/descriptive states. Only pathological symptoms.

### SNOMED CT

| Concept | SNOMED CT ID | Semantic tag | Notes |
|---|---|---|---|
| Acne | 11381005 | disorder | Parent concept for all acne types |
| Greasy skin (Oily skin) | 42273000 | finding | "Oily skin" is a synonym |
| Xeroderma (Dry skin) | 52475004 | disorder | Replaced older 16386004 |
| Pruritus (Itching) | 418363000 | finding | Self-reportable |
| Rash | 271807003 | finding | General skin eruption |

**No SNOMED concept for "glowing skin"** or other positive observations — SNOMED is clinical, not wellness-focused.

---

## Menstrual/Fertility Apps

### Clue

**4 skin options (binary present/absent):**
- Good
- Oily
- Dry
- Acne

Separate **Hair** category: Good, Bad, Oily, Dry

Source: PMC7250828 — "Characterizing physiological and symptomatic variation in menstrual cycles"

### Natural Cycles

**3 skin options (binary present/absent):**
- Oily
- Dry
- Glowing

Optional add-on tracker enabled from settings.

### Flo

Acne confirmed as trackable symptom. Likely also oily/dry skin. Binary present/absent. Part of 70+ trackable symptoms.

### Ovia

Acne confirmed. Full skin vocabulary not publicly documented. Presence flags.

---

## Mira

**Field structure:** comma-separated string (not array)
```
"skin": "Dry,Glowing"
```

**All confirmed values (from real Mira prod API, 2026-03-17):** Dry, Oily, Breaking out, Glowing, Normal

- "Breaking out" = Acne (maps to `body-skin-acne`)
- "Normal" = no event needed (skip, like "No symptoms")
- No severity/intensity. Multiple values comma-separated.

---

## Cross-system Comparison

| System | Skin Values | Severity? | Multi-select? |
|---|---|---|---|
| **Apple HealthKit** | acne, drySkin (+ hairLoss) | 5-level severity | Each is independent sample |
| **SNOMED CT** | Acne, Oily skin, Dry skin, Pruritus, Rash | No intrinsic severity | N/A (codes) |
| **Clue** | Good, Oily, Dry, Acne | No (present/absent) | Yes |
| **Natural Cycles** | Oily, Dry, Glowing | No (present/absent) | Yes |
| **Mira** | Dry, Glowing (+ likely Oily, Acne) | No | Yes (comma-separated) |
| **Flo** | Acne (+ likely oily, dry) | No (present/absent) | Yes |

### Key observations

1. **Core vocabulary is small and convergent**: Acne, Dry, Oily appear across nearly every system. Beyond that, Glowing (Natural Cycles, Mira) and Good (Clue) represent positive states.

2. **Binary is dominant**: Only Apple HealthKit provides severity (and only for acne and dry skin). All cycle apps use presence/absent.

3. **Positive states exist**: Unlike clinical systems, cycle apps track positive observations ("Good", "Glowing") — no SNOMED equivalent.

4. **Hair is related but separate**: Apple groups hairLoss with skin. Clue has a separate Hair category. Should be separate HDS streams.

5. **Simpler than mood**: Unlike mood (which needs a dimensional vector model for cross-system conversion), skin values are a small finite vocabulary with near-1:1 mapping across systems. A simple set of `activity/plain` items is sufficient.

---

## Proposed HDS Mapping

### Approach: `activity/plain` items under `body-skin/`

Skin observations are simple presence flags (like symptoms). Use `activity/plain` event type — same pattern as the existing symptom items.

### Stream structure

```
body/
└── body-skin/
    ├── body-skin-acne          # Acne / breakouts
    ├── body-skin-dry           # Dry skin
    ├── body-skin-oily          # Oily / greasy skin
    └── body-skin-glowing       # Glowing / good skin quality
```

Placed under `body/` (not `symptom/`) because:
- Includes positive states (glowing, good) — not symptoms
- Describes body observations, like `body-vulva-bleeding`
- Matches the self-observation nature of the data

### Event type

`activity/plain` — presence flag with time range. Same as symptom items.

No severity for now: only Apple HealthKit provides it, and most sources are binary. Can be upgraded to `ratio/proportion` later if needed.

### Cross-system mapping

| HDS Item | Apple HealthKit | SNOMED | Clue | Natural Cycles | Mira |
|---|---|---|---|---|---|
| `body-skin-acne` | `acne` | 11381005 | Acne | — | Breaking out |
| `body-skin-dry` | `drySkin` | 52475004 | Dry | Dry | Dry |
| `body-skin-oily` | — | 42273000 | Oily | Oily | Oily |
| `body-skin-glowing` | — | — | Good | Glowing | Glowing |

All Mira values confirmed from real prod API (2026-03-17). "Normal" = no event.

### Mira conversion

```
"skin": "Dry,Glowing"
→ split by comma
→ for each value:
    "Dry"     → body-skin-dry      (activity/plain)
    "Glowing" → body-skin-glowing  (activity/plain)
    "Oily"    → body-skin-oily     (activity/plain)
    "Acne"    → body-skin-acne     (activity/plain)
    unknown   → log warning, skip
```

### Items not included (and why)

- **Hair** (hairLoss, hair quality): Separate domain, separate stream (`body-hair/` if needed later). Since then, hair symptoms are under `symptom-dermatological`: hair loss, hair growth, and oily hair or scalp (`symptom-dermatological-hair-oily`, SYMPTOMS.md decision 7), never `body-skin-oily`.
- **Itchy/Pruritus**: Could be added as `body-skin-itchy` if a source provides it
- **Rash**: Clinical finding, could be added later
- **Severity**: Not needed now — can upgrade event type later
