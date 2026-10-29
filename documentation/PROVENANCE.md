# Provenance — where a value came from, and what it was measured with

An event's platform fields already say **who wrote it**: `createdBy` / `modifiedBy` name the access (the
app, the connector, the person's own token), and consumers turn that into a source name. Everything finer
than the writing access is carried in **`clientData`**, under keys this repo defines. This page is the
index of those keys and defines the ones that are not owned by a domain document.

None of this changes an item, a stream or an eventType. `clientData` is free-form for the platform; the
conventions below are contracts between HDS apps, documented here so every writer and reader agrees.

## Index of HDS `clientData` keys

| Key | Meaning | Defined in |
|---|---|---|
| `clientData.hdsInstrument` | The instrument a measure was taken with | this page |
| `clientData.related.<eventId>` | A link to another event this one derives from or answers | this page; first used by [QUESTIONNAIRE.md](QUESTIONNAIRE.md) |
| `clientData.hdsBasis` | Where a cycle value comes from: on the four cycle boundaries, `'predicted'` or `'confirmed'` by its source; on `fertility-cycles-coverline`, `'auto'` (computed by the method's rule) or `'manual'` (drawn or moved by the person) | [MENSTRUAL-CYCLE.md](MENSTRUAL-CYCLE.md) |
| `clientData.hdsCustomField`, `clientData.hdsSystemFeature` | Custom-field and system-stream declarations | [CUSTOM-FIELDS-AND-SYSTEM.md](CUSTOM-FIELDS-AND-SYSTEM.md) |
| `clientData.sourceKey` | The stable identity of an imported record in its source, for re-runs and removal | this page |
| `clientData.hdsTimePrecision`, `hdsTimeText`, `hdsTimeZone`, `hdsEndPrecision` | How much of `time` is known: partial and approximate dates ("March 1999", "about spring 1998") | [PARTIAL-DATES.md](PARTIAL-DATES.md) |
| `clientData.hdsRefRange`, `hdsFlag`, `hdsInterpretation` | The reference range and flag a lab printed for one result, and the flag normalised | [BLOOD-CHEMISTRY.md](BLOOD-CHEMISTRY.md#the-printed-reference-range-flag-and-interpretation-of-one-result) |
| `clientData.hdsComparator` | The value is a printed limit (`<`, `<=`, `>`, `>=`), not an exact figure | [BLOOD-CHEMISTRY.md](BLOOD-CHEMISTRY.md#a-censored-value-hdscomparator) |
| `clientData.hdsGln`, `hdsZsr` | A provider's GLN and ZSR, bare values mirroring its content `identifiers`: the cross-writer lookup keys (GLN, then ZSR, then `sourceKey`) | [ENCOUNTER.md](ENCOUNTER.md#one-provider-one-event-clientdatahdsgln-hdszsr) |

A reader ignores any `clientData` key it does not know. A new key is `hds`-prefixed and documented here (or in
its domain document, and indexed here) before an app ships it. `related` and `sourceKey` predate the prefix
and keep their bare names.

---

## `clientData.hdsInstrument` — the instrument a measure was taken with

For some measures the device matters clinically: two thermometers differ by a few tenths of a degree,
which is the size of the shift a basal-temperature chart looks for. The person names the instruments they
use, and the app tags each measure with the one it was taken with.

```json
{
  "streamIds": ["body-temperature-basal"],
  "type": "temperature/c",
  "content": 36.42,
  "clientData": {
    "hdsInstrument": { "id": "i-lz4k1q-8f3a", "name": "Bedside thermometer", "brand": "Braun", "model": "ThermoScan 7" }
  }
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | yes | Identifies this instrument within the person's account. Opaque, `[a-zA-Z0-9_-]`, at most 64 characters. Minted by the app the first time the instrument is named; every measure taken with it carries the same `id`. |
| `name` | string | yes | The name the person gave it. Readers display it exactly as written (no translation, no reformatting). |
| `brand` | string | no | The manufacturer. |
| `model` | string | no | The model name or number. |

**Rules.**

- **Written by the app that records the measure**, on create, and rewritten whole when the person
  changes the instrument of an existing measure. Setting `clientData.hdsInstrument` to `null` removes it.
- **It names a physical device, not the writer.** The app or connector that wrote the event is
  `createdBy`; an import from HealthKit or a connector does not set `hdsInstrument` unless it knows the
  device itself.
- **Measures only.** It is meaningful on events of a measured value (temperature, weight, blood pressure,
  …), not on answers, notes or self-reports.
- **`id` is the identity, `name` is a label.** Readers group and compare by `id`, and never parse or
  derive meaning from it. When the person renames an instrument, events already written keep the old
  `name`. **Interim, until the registry below exists:** a reader that shows the current name takes it from
  the most recent event with that `id`.
- **The `name` is visible to everyone who can read the measure.** It is free text from the person (it may
  say "Mum's thermometer"), so the app says so where the person names an instrument.
- Optional fields may be added later (for example the measurement site: oral, vaginal, wrist). A reader
  ignores fields it does not know.

**Not a registry.** The tag on each event is the source of truth today. An account-level list of the
person's instruments (one record per instrument, referenced by `id`) and a list of validated devices are a
planned follow-up; when they land, `id` is the key the events already carry, so nothing is migrated.

### Cross-system mapping

| HDS | HL7 FHIR (R4 / R5) | Apple HealthKit |
|---|---|---|
| `hdsInstrument` (the object) | `Observation.device` → a `Device` resource | `HKObject.device` (`HKDevice`) |
| `id` | `Device.identifier` (a system local to the person's account) | `HKDevice.localIdentifier` |
| `name` | R4 `Device.deviceName` / R5 `Device.name`, with `type` = `patient-reported-name` | `HKDevice.name` |
| `brand` | `Device.manufacturer` | `HKDevice.manufacturer` |
| `model` | `Device.modelNumber` | `HKDevice.model` |
| *(writer)* `createdBy` | `Observation.performer` / `Provenance.agent` | `HKSourceRevision` (the writing app) |

The `name` is mapped as **`patient-reported-name`** rather than `user-friendly-name` because the person
chose it; FHIR's `user-friendly-name` is a manufacturer-assigned lay name. HealthKit keeps the writing app
(`HKSource`) and the device (`HKDevice`) apart, as HDS keeps `createdBy` and `hdsInstrument` apart: an
import that knows both should carry both.

---

## `clientData.related.<eventId>` — a link to another event

An event points at the events it derives from or answers, as a keyed object (Pryv's cross-reference
convention): one key per referenced event id, value `true`.

```json
{
  "streamIds": ["body-blood-serum-ferritin"],
  "type": "concentration/ug-l",
  "content": 48,
  "clientData": { "related": { "ckq3w8n1x0001": true } }
}
```

Here `ckq3w8n1x0001` is the document event (`file/xds-v1`, [DOCUMENTS.md](DOCUMENTS.md)) of the lab report the value
was read from.

**Rules.**

- **The derived event points at its source**, never the other way: a lab report does not list the values
  read from it. To find them, query events with `clientData.related.<reportId>` set.
- **`true` is the only value.** The kind of link follows from the two events' types (a value and a
  document: read from it; an answer and a request: answers it; a procedure or a condition and the visit it
  happened during, `related` only: [ENCOUNTER.md](ENCOUNTER.md)). A link that needs more than that gets its
  own documented key.
- **Write the whole `related` object** when changing the set of links.
- **An event id held in content MUST be mirrored here.** When an eventType carries event ids in its content
  (`file/xds-v1` `supersedes[]`, `authors[].eventId`, `encounterId`; `encounter/visit-v1` `participants[].eventId`,
  `serviceProvider.eventId`; `provider/practitioner-v1` `organizations[].eventId`), the writer sets
  `clientData.related.<eventId>: true` for each one, in the same create or update, so a cohort query finds the link
  without reading content. On an update, the key of an id that left the content is removed in the same call (write
  the whole `related` object). The content is the typed link (which field, which role); `related` is its index. If
  the two drift, the content is authoritative and the missing or stale keys are a writer bug. A measure (a number)
  has no place for an id: it keeps `related` only. A new eventType that carries an event id lists the field here.
  The id fields added with the encounter types carry the pattern `^[a-zA-Z0-9_-]+$`, so each id is a valid `related`
  path ([ENCOUNTER.md](ENCOUNTER.md#links)).
- **The kind of link is told apart by the event types only.** That holds while each pair of types has one kind of
  link; a second kind between the same types (a document appending to, or transforming, another besides replacing
  it) needs its own documented key.
- **A referenced event may be unreadable** by whoever reads the link: deleted, or on a stream the reader
  has no permission for. A reader shows the value without its source rather than failing.
- Event ids match the `clientData` query path grammar (`^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*$`), so the
  link is queryable; see [QUESTIONNAIRE.md](QUESTIONNAIRE.md#cross-reference-convention--clientdatarelatedeventid-true).

**Cross-system.** FHIR `Observation.derivedFrom` (a reference to the `DocumentReference`, `Observation` or
`QuestionnaireResponse` it was derived from); for a questionnaire answer, the reference to the request.

---

## `clientData.sourceKey` — the identity of an imported record

An importer or a bridge tags each event it writes with the identity of the record it came from, so that
running it again updates that event instead of writing a duplicate, and so that its whole import can be
found and removed (site-agents#33).

```json
{
  "streamIds": ["body-blood-serum-ferritin"],
  "type": "concentration/ug-l",
  "content": 48,
  "clientData": { "sourceKey": "healthfiles:lab:2024-03-12-ferritin" }
}
```

**Format:** `<tool>:<kind>:<id>`.

| Part | Meaning |
|---|---|
| `<tool>` | The importer, a stable lowercase name without `:` (`healthfiles`, `cyclefem`, `femm`). Every key the tool writes starts with `<tool>:`. |
| `<kind>` | The kind of source record (`lab`, `letter`, `day`, `cycle`). |
| `<id>` | The record's own identity in the source, stable from one run to the next. It may contain `:` (the bridges append the field: `femm:day:2026-03-02:mucus`). |

**Rules.**

- **Same source record, same key, on every run.** Derive it from the source, never from the run (no
  timestamps of the import, no counters).
- **One event per key** within an account. A re-run looks the key up, trashed events included
  (`state: 'all'`), and updates that event.
- **A re-run never restores what the person removed.** A trashed event keeps its key and is left trashed; it
  is not updated back to life nor written again. An event deleted for good can no longer be found by its key,
  so a re-run writes it again: that is accepted, and an importer that must avoid it keeps its own list of the
  keys it wrote.
- **No identifying data in the key.** It is visible to everyone who can read the event: no names,
  insurance or national numbers.
- **Bare name.** `sourceKey` predates the `hds` prefix (the bridges have always written it) and keeps it.

**Finding events by key.** `events.get` filters on `clientData`:
`clientData: [{ "path": "sourceKey", "eq": "<key>" }]` finds one record, and
`clientData: [{ "path": "sourceKey", "prefix": "<tool>:" }]` finds a whole import. The full re-run and
removal contract for bulk importers (dedicated access, scoped permissions, write order) is on the agents
site: <https://agents.datasafe.dev/llms-full.txt>, § "5f".

**Cross-system.** FHIR `Resource.identifier` with a `system` naming the tool; HealthKit
`HKMetadataKeyExternalUUID`, or `HKMetadataKeySyncIdentifier` (which HealthKit requires together with
`HKMetadataKeySyncVersion`).
