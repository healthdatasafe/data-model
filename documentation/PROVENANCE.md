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
| `clientData.related.<eventId>` | A link to another event this one derives from or answers (an entry typed in answer to a connection's request: [below](#an-entry-typed-in-answer-to-a-connections-request)) | this page; first used by [QUESTIONNAIRE.md](QUESTIONNAIRE.md) |
| `clientData.hdsBasis` | Where a cycle value comes from: on the four cycle boundaries, `'predicted'` or `'confirmed'` by its source; on `fertility-cycles-coverline`, `'auto'` (computed by the method's rule) or `'manual'` (drawn or moved by the person) | [MENSTRUAL-CYCLE.md](MENSTRUAL-CYCLE.md) |
| `clientData.hdsCustomField`, `clientData.hdsSystemFeature` | Custom-field and system-stream declarations | [CUSTOM-FIELDS-AND-SYSTEM.md](CUSTOM-FIELDS-AND-SYSTEM.md) |
| `clientData.sourceKey` | The stable identity of an imported record in its source, for re-runs and removal | this page |
| `clientData.hdsTimePrecision`, `hdsTimeText`, `hdsTimeZone`, `hdsEndPrecision` | How much of `time` is known: partial and approximate dates ("March 1999", "about spring 1998") | [PARTIAL-DATES.md](PARTIAL-DATES.md) |
| `clientData.hdsRefRange`, `hdsFlag`, `hdsInterpretation` | The reference range and flag a lab printed for one result, and the flag normalised | [BLOOD-CHEMISTRY.md](BLOOD-CHEMISTRY.md#the-printed-reference-range-flag-and-interpretation-of-one-result) |
| `clientData.hdsComparator` | The value is a printed limit (`<`, `<=`, `>`, `>=`), not an exact figure | [BLOOD-CHEMISTRY.md](BLOOD-CHEMISTRY.md#a-censored-value-hdscomparator) |
| `clientData.hdsDocumentShare` | A share child's relationship and direction (stream clientData); visible to the contact granted the child | [DOCUMENTS.md](DOCUMENTS.md#sharing-one-document-the-document-shares-root-3370) |
| `clientData.hdsConversationItems` | A conversation child's relationship and direction (`received`, `sent`; stream clientData); visible to the contact granted the child | [CONVERSATION.md](CONVERSATION.md#where-it-lives-the-conversation-items-root) |
| `clientData.hdsSupport` | Which team member a support line comes from, on the group's copy of a support chat event; written by the support service, never forwarded to the person | [SUPPORT.md](SUPPORT.md#which-member-wrote-a-line-clientdatahdssupport) |
| `clientData.hdsApp` (on an **access**; for CMC, `requesterMeta.hdsApp` in the invite, mirrored as `content.hdsApp` on the accept event) | The app's manifest URL, from which HDS apps name the app that holds the access | [APP-DESCRIPTION.md](APP-DESCRIPTION.md) |
| `clientData.hdsGln`, `hdsZsr` | A provider's GLN and ZSR, bare values mirroring its content `identifiers`: the cross-writer lookup keys (GLN, then ZSR, then `sourceKey`) | [ENCOUNTER.md](ENCOUNTER.md#one-provider-one-event-clientdatahdsgln-hdszsr) |
| `clientData.hdsDocumentUniqueId` | A document's `uniqueId` as `<system>\|<value>`, mirroring its content: the cross-writer key that recognises a document already held | [DOCUMENTS.md](DOCUMENTS.md#filexds-v1) |
| `clientData.hdsSourceAnchor` | Where a value read from a document is printed in it: a page and a box, nothing of what is printed there | this page, [below](#clientdatahdssourceanchor--where-a-value-is-printed-in-its-document) |
| `clientData.hdsExtraction` | Which program read a value from a document, with which knowledge base and backend, and the role of who confirmed it | this page, [below](#clientdatahdsextraction--which-program-read-a-value-and-who-confirmed-it) |
| `clientData.hdsDocumentValues` (on a document event, 4.26.0) | Her value events read from the document, by id, with their role (`source`) | this page, [below](#clientdatahdsdocumentvalues--the-values-read-from-a-document) |
| `clientData.hdsPrintedIn.<eventId>` (on a value event, 4.26.0) | The documents that print a value she already had, not its source | this page, [below](#clientdatahdsprintedineventid--a-document-that-prints-a-value-she-already-had) |
| `clientData.hdsDocumentPending` (on a document event, 4.26.0) | The fields of a document she has not confirmed yet (`time`, `kind`): a placeholder waiting for its date and kind | [DOCUMENTS.md](DOCUMENTS.md#a-document-waiting-for-its-date-and-kind-4260) |

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

- **The derived event points at its source**, never the other way: `related` is never set on a lab report for the
  values read from it. To find them, query events with `clientData.related.<reportId>` set. The document may also
  carry an index of them, `hdsDocumentValues` (4.26.0, [below](#clientdatahdsdocumentvalues--the-values-read-from-a-document)),
  for a reader that holds the document and wants its values without a query; `related` on each value stays the link.
- **`true` is the only value.** The kind of link follows from the two events' types (a value and a
  document: read from it; an answer and a request: answers it; a procedure or a condition and the visit it
  happened during, `related` only: [ENCOUNTER.md](ENCOUNTER.md)). A link that needs more than that gets its
  own documented key.
- **Write the whole `related` object** when changing the set of links.
- **An event id held in content MUST be mirrored here.** When an eventType carries event ids in its content
  (`file/xds-v1` `supersedes[]`, `authors[].eventId`, `encounterId`; `encounter/visit-v1` `participants[].eventId`,
  `serviceProvider.eventId`; `provider/practitioner-v1` `organizations[].eventId`; `genetic-variant/coded-v1`
  `laboratory.eventId`; `message/hds-reader-v1` `inReplyTo` and `eventId`, [HDS-READER.md](HDS-READER.md);
  `message/hds-conversation-v1` `about`, `inReplyTo` and `written[].eventId`, [CONVERSATION.md](CONVERSATION.md)), the writer sets
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

### An entry typed in answer to a connection's request

When the person types an entry because a connection (a doctor, a carer, a study) asked for it, the app that saves it
points at the request, so the conversation with that connection can show what she filled in for it, and nothing of
her everyday logging.

| She filled in | `related.<eventId>` points at |
|---|---|
| an item of a data set's one-off section (a FormSpec `permanent` section), from that connection's tasks | her accept event of that data set (`consent/accept-cmc`, the relationship's accept event id) |
| the item a connection's reminder asks for, from the reminder ("Fill in") | the reminder (`notification/alert-cmc`) on her collectors stream of that relationship |

- **Written by the app the person types it in**, at create, with any other `related` keys of the entry; when she
  changes an existing entry from the task or the reminder instead, the same update adds the key to the entry's
  `related` object, written whole. When the relationship's accept event is not known, no key is written. An app
  that updates the entry later keeps the key. An entry recorded otherwise (her daily logging, a recurring section, a
  device, an import) carries no such key, even when the item is one the connection reads.
- **Not retroactive.** Entries saved before an app wrote the key are not marked, and no app adds one from a guess.
- **The kind of link follows from the types**, as above: an entry and a `consent/accept-cmc` or a
  `notification/alert-cmc` event: answers it.
- **Visible to everyone who can read the entry**, like every `clientData` key: another reader sees that it points at
  some event, by its id, usually cannot read that event (it sits on the person's own CMC streams), and can tell that
  entries carrying the same id belong together. It carries no name and says nothing about who asked.
- **A reader finds the answers to one connection** among the entries it reads, by the keys of that relationship's
  accept events and reminders (ids in the person's account, not the connection's own copies), or with `events.get`
  `clientData: [{ "path": "related.<eventId>", "eq": true }]`, one call per id. The accept event keeps its id when the
  person accepts an updated data set (its copy of the data set is updated in place), so the link holds.

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

---


## Values read from a document by a program

A program that reads values from a document (a lab report photographed, scanned or downloaded) writes each value
the person confirmed as an ordinary event on its item, linked to the document by `clientData.related.<document event
id>` and identified by `clientData.sourceKey` (its `<tool>` is the program's `engine` id; the HDS Reader's is
`hds-reader`; in a conversation the person's app writes the value and builds the key as
`<engine>:document:<document event id>:<candidateId>`, [CONVERSATION.md](CONVERSATION.md#writing-a-value)). Two keys say how it was read, so a reader can show the person where the value came from and an audit
can tell which program and knowledge base produced it. The HDS Reader is the first writer
([HDS-READER.md](HDS-READER.md)); the keys name no program and any reader of documents may write them.

```json
{
  "streamIds": ["body-blood-serum-ferritin"],
  "type": "concentration/ug-l",
  "content": 48,
  "time": 1773316800,
  "clientData": {
    "related": { "ckq3w8n1x0001": true },
    "hdsTimePrecision": "day",
    "hdsRefRange": { "lowerLimit": 30, "upperLimit": 400, "text": "30 - 400" },
    "hdsSourceAnchor": { "eventId": "ckq3w8n1x0001", "attachmentId": "ckq3w8n1x0001a", "page": 1, "bbox": [8.5, 41.2, 83, 2.1] },
    "hdsExtraction": { "engine": "hds-reader", "engineVersion": "0.2.0", "kbVersion": "0.4.0", "backend": "text-layer", "confirmedBy": "person" }
  }
}
```

Both are closed objects. Their JSON Schemas (draft-04 and draft-07) are published with the pack as
`json-schemas/hds-source-anchor.json` and `json-schemas/hds-extraction.json` (source `src/schemas/clientDataKeys.js`,
tests `[RDR-KEY-*]`); the dialogue type `message/hds-reader-v1` inlines the same shapes. Compile them as draft-07 (or
draft-04), not 2020-12: the box's tuple `items` array means something else there.

**Content-free, by shape, as far as writers conform.** Neither key may carry document text, a value, a date, a
person's or practitioner's name, or an identifier that leads to one: every field is a number, a code, an id or a
version. Nothing on the platform validates `clientData`, so the shape is enforced by conforming writers, which
validate against the published schemas before writing and carry conformance tests for it. What the document prints
stays in the document (and, while the reading is in progress, on the dialogue events, which are the person's).

**No printed value here.** Values are stored as printed (BLOOD-CHEMISTRY.md § Units). If a value rescaled by a power
of ten is ever written, its printed value and unit get their own key, defined with that change to the store-as-printed
rule; never `hdsExtraction`.

### `clientData.hdsSourceAnchor` — where a value is printed in its document

| Field | Type | Required | Meaning |
|---|---|---|---|
| `eventId` | string, `^[a-zA-Z0-9_-]+$`, ≤ 64 | no (4.25.0) | The id of the `file/xds-v1` document event: the one `clientData.related` names, which stays there for queries. Absent on anchors written before 4.25.0. |
| `attachmentId` | string, `^[a-zA-Z0-9_-]+$`, ≤ 64 | yes | The id of the document event's attachment (Pryv `attachments[].id`) the value was read from. |
| `page` | integer ≥ 1 | yes | The page **within that attachment**, from 1; an image is page 1. |
| `bbox` | 4 numbers, each 0..100 | no | `[x, y, width, height]` of the printed line the value was read from, in **percent of the page as displayed**: `x` and `width` of the page width, `y` and `height` of its height, origin at the **top left**. For a PDF, the page as displayed is its CropBox after its `/Rotate`; for an image, the image after its orientation (EXIF) is applied. |

The anchor names the attachment because a document event may hold its pages as several attachments.

**One module, self-contained.** `{ eventId, attachmentId, page, bbox? }` says, on its own, which zone of which
document a thing points at: whoever may read both the event that carries it and the document finds the zone from the
anchor alone. Any event that points at a zone of a document uses this one shape, under this key: a value read from
it, a note about it, a conversation item (CONVERSATION.md: a proposed value's `anchor`, an `is-this-yours` question's
`context.anchor`).

**Rules.**

- **It points into the one document the event is related to.** Written only on an event whose `clientData.related`
  names exactly one `file/xds-v1` event; the anchor is in that document's attachment `attachmentId`. Writers set
  `eventId` to that document (from 4.25.0), and `eventId` MUST be a key of `clientData.related`: a reader ignores an
  anchor whose `eventId` is not, without fetching anything. A reader takes the document from `eventId` when present,
  else from `related`. An event linked to no document, or to several, carries no anchor.
- **A box only when the reader trusts it.** Without one, the anchor is `{ attachmentId, page }`: no box rather than a
  doubtful one. Writers keep `x + width ≤ 100` and `y + height ≤ 100`, width and height above 0, and round to two
  decimals.
- **Nothing of the line.** No text, no value, no OCR output: the box says where to look, the document says what is
  there. A reader renders the crop from the document itself. When it cannot read the document (deleted, or on a
  stream it has no permission for), or the document has no attachment `attachmentId`, it ignores the anchor.
- **It does not follow a replacement.** A document that supersedes another is a new event; values read from the older
  one keep their anchor into it.
- **Written by the program that read the value**, at create. An app that moves the value to another document's
  reading writes the new anchor with the new `related` link, or removes it.

**Cross-system.** No FHIR or HealthKit element holds a position in a document. The link to the document could render
as `Observation.derivedFrom` (from `related`, which FHIR-MAPPING.md does not render today); the box could then be a
fragment on the file in the style of W3C Media Fragments, `Binary/<eventId>.<fileId>#page=<page>&xywh=percent:<x>,<y>,<width>,<height>`
(`<fileId>` is `attachmentId`, as FHIR-MAPPING.md names it; `page=` comes from the PDF fragment identifiers of
RFC 8118, and Media Fragments' `xywh` takes integers, so the percentages are rounded there).

### `clientData.hdsExtraction` — which program read a value, and who confirmed it

| Field | Type | Required | Meaning |
|---|---|---|---|
| `engine` | string, `^[a-z][a-z0-9]*(-[a-z0-9]+)*$`, ≤ 64 | yes | The stable id of the reading program (`hds-reader`): the `<tool>` of the `sourceKey` it writes. |
| `engineVersion` | semver, optional pre-release, ≤ 64 | yes | The program's version (`0.2.0`, `0.3.0-rc.1`). |
| `kbVersion` | semver `MAJOR.MINOR.PATCH`, ≤ 32 | yes | The version of the knowledge-base pack the program used to read and map the line. |
| `backend` | string, `^[A-Za-z0-9][A-Za-z0-9._:/+-]*$`, ≤ 128 | yes | An **opaque** id of the program's backend configuration record that read the printed line, never parsed: for example `<runtime>:<model>` (`ollama:qwen2.5vl:7b`), or `text-layer` when no backend ran (a born-digital PDF's text read deterministically). No spaces; never a URL, a host name, a device name or a user name. |
| `confirmedBy` | `person` | yes | The **role** of who confirmed the value before it was written: `person`, the account holder, from her own app. |
| `corrected` | `true` | no | The person changed the value, the item or the unit before it was written. Absent otherwise. |

**Rules.**

- **Written only after a confirmation.** The key is written on a value the person confirmed, so it always names a
  role. A value written with no confirmation carries no `hdsExtraction`.
- **A role, never an identity.** No name, no account id, no username. The writing access is already the event's
  `createdBy`; who answered is on the dialogue, on the person's own account. `confirmedBy` is the program's claim, and
  can be checked against the dialogue's answer events.
- **Ids and versions only.** No prompt, no model output, no confidence, no document text. A correction is the value
  itself (or its item, or its unit), with `corrected: true`.
- **`backend` names a configuration, not a place or a person.** It is never a URL, a host name, a device name or a user
  name, even where the pattern would let one through: `ollama:qwen2.5vl:7b` conforms; `https://gpu1.lab.example/v1`,
  `annas-macbook` or `ollama:anna` do not.
- **What the versions audit.** The mapping from a printed line to an item is decided by the knowledge base, never by
  the backend, so `kbVersion` is what audits it; `backend` audits the reading of the line. `kbVersion` does not cover
  the person's own private corrections that the program may also apply (its private overlay, on her account).
- **As created.** The program writes under `create-only` and cannot update the event. When the event's `modifiedBy`
  differs from its `createdBy`, the key describes the event as it was created: a reader presents it as "originally
  read by".
- **A role list that grows by addition.** A reader that meets a `confirmedBy` it does not know shows the value as
  confirmed, without naming the role.

**Cross-system.** A FHIR export may later render it as a `Provenance` (the program as an agent of type `assembler`, the
role as a `verifier`); not exported today.

### `clientData.hdsDocumentValues` — the values read from a document

On a document event (`file/xds-v1`), 4.26.0: an index of her value events read from it, keyed by event id, each with
its role. Her app writes it when a conversation settles values of the document
([CONVERSATION.md](CONVERSATION.md#writing-a-value)), so the document's view lists them without a query. A value she
already had that the document also prints is not listed here: it carries the link itself,
[`hdsPrintedIn`](#clientdatahdsprintedineventid--a-document-that-prints-a-value-she-already-had).

```json
{
  "streamIds": ["documents"],
  "type": "file/xds-v1",
  "clientData": {
    "hdsDocumentValues": { "ckq3w8n1x0020": "source", "ckq3w8n1x0021": "source" }
  }
}
```

| Role | The event | Its own link |
|---|---|---|
| `source` | was read from this document and written from it: confirmed or corrected from a proposed value | `clientData.related.<document event id>`, its `sourceKey` (`<engine>:document:<document event id>:<candidateId>`) and its `hdsSourceAnchor` |

Schema: `json-schemas/hds-document-values.json` (source `src/schemas/clientDataKeys.js`). Keys are event ids
(`^[a-zA-Z0-9_-]{1,64}$`, a `clientData` query path), at most 1000 entries.

**Rules.**

- **An index, not the link.** `related` on the value is authoritative: when the two disagree, the value's `related`
  wins and the entry is stale. A lost entry is rebuilt from the `written` entries of the document's answers, or by
  querying `related.<document event id>`.
- **Written by her app only**, with her token, never by a contact, and only for events of her account. It writes the
  whole object (`events.update` merges `clientData` keys, not their contents), re-reading the document just before.
- **Dangling ids are expected.** A value can be deleted, trashed or moved to another document after it was listed. A
  reader skips an id it cannot read, one that is deleted or trashed, an entry whose event's `related` does not name the
  document, and an entry whose role it does not know; none of these is an error. Her app drops the dangling entries it
  finds the next time it writes the object; it does not sweep for them.
- **Removed with what it lists.** When her app deletes values written from the document (a `not-mine`), it removes their
  entries. A document's own deletion takes the index with it.
- **Visible to every reader of the document**, including each contact it is shared with: ids of the values written
  from it, which that contact already holds in her answers' `written`, and a role. Nothing new about her record.
- **A role list that grows by addition.** A new role is a minor release; a reader skips one it does not know.

### `clientData.hdsPrintedIn.<eventId>` — a document that prints a value she already had

On a value event, 4.26.0: the documents that print this value, though it was not read from them. When her
conversation finds that a proposed value is already in her record (an automatic `duplicate`, CONVERSATION.md § A value
she already has), her app adds the document to the event it matched, so the document's view lists that value too:
found in this document, not sourced from it.

```json
{
  "streamIds": ["body-blood-serum-ferritin"],
  "type": "concentration/ug-l",
  "content": 48,
  "clientData": { "hdsPrintedIn": { "ckq3w8n1x0001": true } }
}
```

Schema: `json-schemas/hds-printed-in.json`. One key per document event id, value `true`, at most 100.

**Rules.**

- **Not its source.** The value keeps its own `related`, `sourceKey`, `hdsSourceAnchor` and `hdsExtraction`;
  `hdsPrintedIn` never names the document it was read from, and a reader never shows it as read from these documents.
- **Written by her app only**, with her token, on events of her own record; `events.update` merges `clientData`
  keys, not their contents, so it writes the whole `hdsPrintedIn` object, re-reading the event just before. The event's `modified`
  changes; nothing else of it does.
- **Finding them.** The document's view queries `events.get` with
  `clientData: [{ "path": "hdsPrintedIn.<document event id>", "eq": true }]`, the same `clientData` filter as for
  `related.<eventId>` and `sourceKey` above (one call; the ids are query paths).
- **Removed** from the event when the document is `not-mine` (her app queries the key, then removes the document's
  entry, `null` when none is left). A reader ignores an entry whose document it cannot read or that is gone.
- **Visible to every reader of the value**, like `related`: a document id, usually unreadable to them. It names no
  contact, and the document's own readers learn nothing of it: 4.25.0's "never which event" holds (CONVERSATION.md R3).

**Cross-system.** FHIR has no reverse link on `DocumentReference`; the values' `Observation.derivedFrom` (from
`related`) is the forward one. Neither `hdsDocumentValues` nor `hdsPrintedIn` is rendered today.
