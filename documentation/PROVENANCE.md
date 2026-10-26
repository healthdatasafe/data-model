# Provenance — where a value came from, and what it was measured with

An event's platform fields already say **who wrote it**: `createdBy` / `modifiedBy` name the access (the
app, the connector, the person's own token), and consumers turn that into a source name. Everything finer
than the writing access is carried in **`clientData`**, under keys this repo defines. This page is the
index of those keys and defines the two that are not owned by a domain document.

None of this changes an item, a stream or an eventType. `clientData` is free-form for the platform; the
conventions below are contracts between HDS apps, documented here so every writer and reader agrees.

## Index of HDS `clientData` keys

| Key | Meaning | Defined in |
|---|---|---|
| `clientData.hdsInstrument` | The instrument a measure was taken with | this page |
| `clientData.related.<eventId>` | A link to another event this one derives from or answers | this page; first used by [QUESTIONNAIRE.md](QUESTIONNAIRE.md) |
| `clientData.hdsBasis` | Whether a cycle boundary was predicted or confirmed by its source | [MENSTRUAL-CYCLE.md](MENSTRUAL-CYCLE.md) |
| `clientData.hdsCustomField`, `clientData.hdsSystemFeature` | Custom-field and system-stream declarations | [CUSTOM-FIELDS-AND-SYSTEM.md](CUSTOM-FIELDS-AND-SYSTEM.md) |

A reader ignores any `clientData` key it does not know. A new `hds*` key is documented here (or in its
domain document, and indexed here) before an app ships it.

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
| `id` | string | yes | Identifies this instrument within the person's account. Minted by the app the first time the instrument is named; every measure taken with it carries the same `id`. |
| `name` | string | yes | The name the person gave it, as shown in the app. |
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
- **`id` is the identity, `name` is a label.** Readers group and compare by `id`. When the person renames
  an instrument, events already written keep the old `name`; a reader that shows the current name takes
  it from the most recent event with that `id`.
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

Here `ckq3w8n1x0001` is the `file/attached` event of the lab report the value was read from.

**Rules.**

- **The derived event points at its source**, never the other way: a lab report does not list the values
  read from it. To find them, query events with `clientData.related.<reportId>` set.
- **`true` is the only value.** The kind of link follows from the two events' types (a value and a
  document: read from it; an answer and a request: answers it). A link that needs more than that gets its
  own documented key.
- **Write the whole `related` object** when changing the set of links.
- **A referenced event may be unreadable** by whoever reads the link: deleted, or on a stream the reader
  has no permission for. A reader shows the value without its source rather than failing.
- Event ids match the `clientData` query path grammar (`^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)*$`), so the
  link is queryable; see [QUESTIONNAIRE.md](QUESTIONNAIRE.md#cross-reference-convention--clientdatarelatedeventid-true).

**Cross-system.** FHIR `Observation.derivedFrom` (a reference to the `DocumentReference`, `Observation` or
`QuestionnaireResponse` it was derived from); for a questionnaire answer, the reference to the request.
