# Changelog

## [Unreleased]

### Added (plan 46 — documentation)
- `documentation/TREATMENT-PROCEDURE.md` — canonical reference for the new subdomains, the basic+coded item pair, the procedure findings array, and the **context-via-substream resolution mechanic (D3)** with a worked STORMM IVF intake example, the cross-tree context naming convention, and FHIR / SNOMED / LOINC cross-walk.
- `documentation/TAGS.md` — deferred-design reference for the future `tags/` root: `tags/hds/*` controlled vocabulary + `tags/user/*` custom namespace, never `streamIds[0]`. Captures rationale, use cases, and integration points so a follow-up plan can pick it up without revisiting the design.

## [1.8.0] - 2026-04-30

### Added (plan 46 — treatment & procedure subdomains + context-via-substream)
- Two new top-level streams in `definitions/streams/`: `treatment.yaml` (`treatment` parent + `treatment-fertility` context child) and `procedure.yaml` (`procedure` parent + `procedure-fertility` context child).
- Four new itemDefs in `definitions/items/`: `treatment-basic`, `treatment-coded` (both registered at `treatment`); `procedure-basic`, `procedure-coded` (both registered at `procedure`). Mirrors the existing `medication-intake-basic` / `medication-intake-coded` pair pattern; the basic+coded duo is the v1 surface for both subdomains, with no per-domain named-leaf items.
- Four new eventTypes in `definitions/eventTypes/eventTypes-hds.json`: `treatment/basic`, `treatment/coded-v1`, `procedure/basic`, `procedure/coded-v1`. Treatment payloads carry `name` / `regimen.{label,codes}`, optional `count` (Flavour A), optional `period.{start,end}` (Flavour B). Procedure payloads carry `name` / `procedure.{label,codes}`, optional `performed.date`, optional `count`, an open-vocabulary `findings[]` array, and `notes`.
- Two new datasource declarations in `definitions/datasources/`: `treatments.yaml` and `procedures.yaml` exposing `datasets://treatment` and `datasets://procedure` for the coded variants. Datasets-service implementations land in Slice 2.
- Helpers in `src/streams.js`: `getAncestorsById(id)` returns the chain `[id, parent, …, root]`; `isDescendantOf(candidate, ancestor)` validates context membership.
- `findItemForEvent(eventType, streamId)` in `src/items.js` — implements the **context-via-substream resolution rule (D3)**: direct `(streamId, eventType)` match first; on miss, walk parents until the closest ancestor with a registered itemDef matches.

### Notes
- Same closest-ancestor walk-up algorithm as `hds-lib-js` Plan 45 (`resolveStream.ts` clientData lookup) and `HDSModelAuthorizations` (parent-covers-child de-dup) — D3 is the third application of the same principle, applied at the data-model itemDef layer.
- `streamId` schema stays singular. Multi-streamId tagging is reserved for the future `tags/` root (deferred per Plan 46 §2.9, documentation only).

## [1.7.0] - 2026-04-28

### Added (plan 52 — hds-react-timeline integration in hds-webapp)
- New app-stream declaration `webapp-settings` in `definitions/appStreams.yaml` (`suffix: webapp-settings`, `eventType: settings/hds-react-timeline`). Resolves under any client app's `appStreamId` (e.g. for hds-webapp: `app-client-dr-form-webapp-settings`). Holds one event per feature, distinguished by `eventType` (e.g. `settings/hds-react-timeline`); single recurring event per type, updated in place. Display category `system`.

## [1.6.0] - 2026-04-28

### Added (plan 45 — custom fields & system stream in appTemplates)
- Two new event types in `definitions/eventTypes/eventTypes-hds.json` for the system-stream feature:
  - **`message/system-alert`** — operator → user notification carrying `{ level: 'info'|'warning'|'critical', title, body, ackRequired?, ackId? }`. Used on the account-level `app-system-out` stream.
  - **`message/system-ack`** — user → operator acknowledgement carrying `{ ackId, ackedAt, userNote? }`, paired with its originating alert by `ackId`. Used on `app-system-in`.
- Two new app-stream declarations in `definitions/appStreams.yaml`: `system-out` (eventType `message/system-alert`) and `system-in` (eventType `message/system-ack`). These describe the account-level system-stream pair provisioned once by the user's HDS-aware client app.
- New `documentation/CUSTOM-FIELDS-AND-SYSTEM.md` covering the data-model perspective: which eventTypes are reused for custom fields (none new — `note/txt`, `note/html`, `activity/plain`, `date/iso-8601`, `count/generic`), the two new `message/*` impls for system streams, and pointers to the runtime mechanics in `hds-lib-js`.
- Tests in `tests/customFieldsAndSystem.test.js` covering the new eventTypes, appStream declarations, and pack.json registration.

### Notes
- **No new eventTypes for custom fields.** Templates' `customFields[]` declarations carry their typing inline on each stream's `clientData.hdsCustomField[<eventType>]`, reusing the existing storage-shape eventTypes. The runtime parent-chain validator walk lives in `hds-lib-js` (Plan 45 Phase 3).
- **No `data-model/src/items.js` changes.** That file is a build-time loader for canonical item definitions; runtime validation against `clientData.hds*` declarations is a `hds-lib-js` concern.

## [1.5.0] - 2026-04-28

### Added (plan 50 — deprecated itemdef policy)
- `deprecated: { type: 'boolean' }` (optional) recognised in `src/schemas/items.js`. Round-trips through `pack.json`.
- Contract documented in `AGENTS.md` § "`deprecated: true` on items": flag means item is kept (existing events keep validating + rendering) but not used for new data points. Consumer apps MUST filter deprecated items out of discovery / picker UIs (form builders, item picker sheets, data-model browser); the resolution layer (`itemsDefs.forKey` / `forEvent`) MUST still return deprecated items so readers can render existing events.

## [1.4.0] - 2026-04-28

### Added (plan 48 — cyclefeminin import)
- `body-vulva-mucus-inspect-count` (`count/generic`, `repeatable: once`) — companion item in the `body-vulva-mucus-inspect` stream that captures the daily count of cervical-fluid self-observations. Creighton FertilityCare protocol mandates this count alongside the most-fertile observation of the day; reusable across any future Creighton/FertilityCare/Billings importer or app.
- `deprecated: true` flag added to three items (`body-vulva-mucus-stretch`, `body-vulva-wetness-feeling`, `fertility-cycles-charted-count`) — flag-only at this stage; formal contract (schema validation, `pack.json` surfacing, consumer-app handling) tracked under plan 48 phase 6.

## [1.3.2] - 2026-04-27

### Changed
- `wellbeing-self-rated-health` slider gains `display.suffix: { en: "/100", fr: "/100" }` so the EQ VAS readout, ARIA `aria-valuetext`, and the diary list (via `eventToShortText`) all show `"73 /100"` instead of just `"73"` or the raw `"0.73"`. Storage unchanged (raw 0..1 ratio/proportion).

## [1.3.1] - 2026-04-27

### Changed
- Item descriptions trimmed to short, patient-facing text (no spec/scale/instrument leakage). Affects `wellbeing-self-rated-health`, `wellbeing-mental-distress*`, `function-mobility`, `function-self-care`, `function-usual-activities`, `symptom-pain-severity`, `body-vulva-cervix-position`, `body-vulva-menstrual-cup`, `fertility-cycles-average-length`, `fertility-cycles-average-period`, `profile-avatar`. Full clinical/spec context retained in `documentation/` and per-item `references:` blocks.

## [1.3.0] - 2026-04-24

### Added (plan 44 — EQ-5D-5L PRO integration)
- New `function/` top-level stream with children `function-mobility`, `function-self-care`, `function-usual-activities` (ICF Activities & Participation — `d450`, `d510`/`d540`, `d630`/`d845`/`d920`).
- New items on the canonical 5-level severity scale (`ratio/proportion` with hooks `0.0 / 0.25 / 0.5 / 0.75 / 1.0`):
  - `function-mobility`, `function-self-care`, `function-usual-activities` — EQ-5D-5L D1–D3, WHODAS, SF-36 PF, PROMIS Physical Function, Barthel, Katz.
  - `symptom-pain-severity` (new child under existing `symptom-pain`) — overall pain intensity (VRS-5 / NRS / PROMIS Pain Intensity / SF-36 BP compatible).
  - `wellbeing-mental-distress` (combined), `wellbeing-mental-distress-anxiety`, `wellbeing-mental-distress-depression` — covers EQ-5D-5L D5 (combined), K6/K10, WHO-5 inverse, plus splitting PROs GAD/PHQ/HADS/DASS-21/PROMIS.
- `wellbeing-self-rated-health` — EQ VAS / SF-36 GH / PROMIS Global01 / SF-1 / NHIS-MEPS SRH. Uses new `type: slider` with `display.multiplier: 100` (raw 0..1 storage, 0..100 shown).
- **New `type: slider` field type** on the item schema — numeric input with `min`, `max`, `step`, optional `slider.{orientation, labels, display{multiplier, precision, suffix}}`. Enables VAS-style inputs and any bounded-range slider UI, separating storage (raw value) from display (multiplier/precision/suffix). Validator accepts slider for any numeric eventType.
- `documentation/DESIGN-NOTES.md` — new "Scale hook placement" subsection: `ratio/*` hooks must match semantic anchors of competing scales (ICF, EQ-5D, PROMIS, HealthKit), not even distribution. Canonical placements for 5-level, 4-level (subset), 3-level, 11-level severity families.
- `documentation/FUNCTION.md` — companion doc for the new `function-*` domain covering ICF alignment, WHODAS/EQ-5D/PROMIS/SF-36/Katz/Barthel mappings, and design decisions.
- `AGENTS.md` (repo root) — primer for future agents covering architectural principles, the scale-hook rule, reuse-first examples, anti-patterns, file orientation, and cross-system reference library.

### Changed (plan 44)
- `documentation/SYMPTOMS.md` severity-mapping table: Apple HealthKit 4-level placement updated from `0.0 / 0.33 / 0.66 / 1.0` (even distribution) to `0.0 / 0.25 / 0.5 / 1.0` (subset of the 5-level canonical scale). Not a breaking change — the severity extension was never implemented. Round-trip analysis in plan 44 research notes.
- `documentation/SYMPTOMS.md` decision #2 split into "transient mood tags" (→ `wellbeing-mood`, unchanged) vs "validated distress-severity ratings" (→ the new `wellbeing-mental-distress*` items). Hybrid sources (Mira's `symptoms.Anxiety` with optional `level`) map to the severity items.

### Added (earlier, prior to plan 44)
- Body temperature stream (`body-temperature`) and `body-temperature-basal` item (`temperature/c`) — basal body temperature for fertility charting.
- `body-vulva-menstrual-cup` item under `body-vulva` stream (`ratio/proportion`, light/moderate/heavy fill levels).
- Cognitive symptom stream (`symptom-cognitive`) and `symptom-cognitive-focus-difficulty` item — difficulty concentrating (SNOMED CT 76039006).
- `symptom-pain-muscle` item under existing `symptom-pain` stream — muscle / joint pain.
- `fertility-cycles-average-length` and `fertility-cycles-average-period` items (`time/d`, `repeatable: once`) — profile-level cycle/period length metrics.

All new items added in support of the FEMM bridge (plan 33).

## [1.2.0] - 2026-03-23

### Changed
- Convertible eventType schemas (`mood/5d-vectors`, `vulva-mucus-inspect/9d-vector`): content now uses `{ vectors, source? }` wrapper with documented source provenance block
- `medication-intake-basic` v3: `doseUnit` changed to select (9 options: tablet, drop, puff, mg, μg, ml, etc.), `route` changed to select (13 options: oral, sublingual, topical, IV, IM, SC, etc.). All labels localized (en + fr).

## [1.1.0] - 2026-03-19

### Added
- Converter engine definitions for cervical-fluid (11 methods, 9 dimensions) and mood (2 methods, 5 dimensions)
- Build pipeline for `dist/converters/` output (pack.json, per-item index.json and pack-latest.json)
- New eventType `vulva-mucus-inspect/9d-vector` for 9D vector observations
- `convertible` item type support in schema validation

### Changed
- `body-vulva-mucus-inspect` itemDef: type `convertible` with converter-engine block
- `wellbeing-mood` itemDef: type `convertible` with converter-engine block
- Deprecated `vulva-mucus-inspect/v0` eventType

## [0.5.0] - 2026-03-17

### Added
- Physical activity stream, items, and cross-system documentation
- Postpartum and miscarriage bleeding items under body-vulva-bleeding
- Expanded symptom model with clinical categories
- Nutrition stream
- Cervical position cross-system research documentation
- Cervical position and mood composite items with `canBeNull` support
- Wellbeing stream with sex-drive item
- Profile-avatar and profile-display-name definitions
- Skin items (body-skin-*) and mood/skin research docs
- Symptom stream hierarchy and items for Mira daily log symptoms
- `ratio/proportion` event type
- `test-result/scale` event type, fertility test items (OPK, pregnancy)
- `protected` option for fertility-sexual-activity (Mira bridge)
- Settings definitions to data model
- Unit conversion compilation to build pipeline
- Reminder configs to item definitions
- `medication/prescription-v1` event type with frequency/times-period

### Changed
- Redesigned `medication/basic` event type
- Updated bleeding model
- Renamed setting event types to kebab-case for Pryv API compatibility
- Migrated repeatable values to ISO 8601 format
- Bumped Node engine to `>=24`

### Fixed
- Fixed profile-avatar: use variations instead of `picture/*` wildcard
- Fixed `localizeFields` recursing into displayFields
- Removed note field from `medication/coded-v1` intake

## [0.4.0] - 2026-02-27

### Added
- Data source medication intake definitions
- Better medication model

## [0.3.0] - 2026-02-12

### Changed
- Migrated linting to ESLint 9 + neostandard
- Adopted HDS style system: palette class, Google Fonts

### Added
- Event type definitions packaged for consumption

## [0.2.0] - 2026-01-23

### Added
- Urine hormones to index
- Fertility items (hormones, cycles)

### Changed
- Updated variations schema

## [0.1.0] - 2025-09-24

### Added
- Medication model (step 1)
- Item references from streams
- Stream listing HTML page
- Select possible values display
- Live birth to pregnancy model
- Bleeding and wetness/wiping items
- Form schema task

## [0.0.1] - 2025-05-26

### Added
- Initial release
- YAML-based health data model definitions
- Stream hierarchy with items
- JSON schema generation
- Test suite for model validation
- Documentation site with CNAME
- Body weight translations
