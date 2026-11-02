# Custom fields & system stream — data-model side

This document describes what `data-model` ships for **template-scoped custom fields** and the **account-level system stream** introduced by Plan 45. It is the **data-model perspective** — what types exist, what `appStreams` declarations exist, how the storage shapes are constrained.

The runtime mechanics — `clientData`-driven validator with parent-chain inheritance, helper APIs, stream provisioning — live in **`hds-lib-js`** (see `hds-lib-js/ts/appTemplates/CUSTOM-FIELDS-AND-SYSTEM.md`, Plan 45 Phase 3.5).

---

## Why this exists

HDS's canonical data-model is intentionally narrow: every item has a clinical-domain identity (no questionnaire / app / vendor branding — see `AGENTS.md` §1). But forms and templates routinely need to capture data points that are **inherently non-interoperable**:

- Free-text comments specific to one study's data-collection contract.
- Operator-issued reminders / alerts attached to an active CollectorRequest.
- Per-form custom fields that don't deserve canonical modelling (because their semantics are study-private).

Plan 45 introduces two **template-scoped extensions** alongside the canonical model:

1. **Custom fields** — declared per-template via `customFields[]` on the `CollectorRequest`, captured as events on streams under `{templateId}-custom-*`. Storage shape is one of the existing `<class>/<implementation>` eventTypes (no new types added to `data-model` for custom fields).
2. **System stream** — account-level streams `app-system-out` (operator → user) and `app-system-in` (user → operator), provisioned once by the user's HDS-aware client app at account setup. Two new `message/*` eventTypes ship in this repo.

Both extensions sit **outside the canonical-item registry** (`pack.json.items`); their per-stream typing is carried inline on the stream's `clientData.hdsCustomField[<eventType>]` / `clientData.hdsSystemFeature[<messageType>]`. See Plan 45 §2.4 for the validator parent-chain walk.

---

## What this repo ships for Plan 45

### 1. Two new eventTypes — `definitions/eventTypes/eventTypes-hds.json`

#### `message/system-alert` *(operator → user)*

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["level", "title", "body"],
  "properties": {
    "level":       { "type": "string", "enum": ["info", "warning", "critical"] },
    "title":       { "type": "string", "maxLength": 200 },
    "body":        { "type": "string", "maxLength": 4000 },
    "ackRequired": { "type": "boolean" },
    "ackId":       { "type": "string", "format": "uuid" }
  }
}
```

Used on `app-system-out`. The operator generates a UUID `ackId` when an explicit user acknowledgement is required (`ackRequired: true`).

#### `message/system-ack` *(user → operator)*

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["ackId", "ackedAt"],
  "properties": {
    "ackId":    { "type": "string", "format": "uuid" },
    "ackedAt":  { "type": "string", "format": "date-time" },
    "userNote": { "type": "string", "maxLength": 1000 }
  }
}
```

Used on `app-system-in`. The user's app posts this when the user clicks Acknowledge on an alert with `ackRequired: true`. The `ackId` matches the originating alert's `ackId` (one-to-one linkage; latest ack supersedes for the same id).

### 2. Two new appStream entries — `definitions/appStreams.yaml`

```yaml
system-out:
  suffix: system-out
  eventType: message/system-alert
  display: system

system-in:
  suffix: system-in
  eventType: message/system-ack
  display: system
```

These declare the account-level `app-system-out` / `app-system-in` streams' default eventTypes for the `appStreams` directory consumed by `hds-lib-js`'s `HDSModelAppStreams` helper. **Provisioning** (the actual `streams.create` call with the correct `clientData.hdsSystemFeature`) happens in `hds-webapp` at account setup, with a defensive fallback in `hds-lib-js`'s `CollectorClient` for users who reach HDS via an invite without ever opening the webapp.

### 3. No new eventTypes for custom fields

Custom fields reuse the existing eventType taxonomy:

| Custom-field primitive | eventType | Source file |
|---|---|---|
| Free text | `note/txt` | `eventTypes-legacy.json` |
| Rich text | `note/html` | `eventTypes-legacy.json` |
| Boolean | `activity/plain` | `eventTypes-legacy.json` |
| Date | `date/iso-8601` | `eventTypes-legacy.json` |
| Number | `count/generic` | `eventTypes-legacy.json` |
| Single-select enum | `note/txt` (string; template-side `options[]` enforces the enum) | `eventTypes-legacy.json` |

Templates declare per-field constraints (`maxLength`, `options[]`, `min`, `max`, `step`, `required`, …) inline on each stream's `clientData.hdsCustomField[<eventType>]`. The data-model validator only enforces the eventType's storage shape — the form-engine enforces the template's constraints at submit time.

### 4. No `data-model` validator changes

`data-model/src/items.js` is the **build-time loader** for canonical item definitions. Runtime event validation against `clientData.hdsCustomField` / `hdsSystemFeature` lives in `hds-lib-js` (parent-chain walk). This repo's contribution is solely the new eventTypes + appStream declarations above.

---

## How a custom-field event looks at runtime

A patient writing a comment via a STORMM template's `daily-notes` custom field produces an event like:

```jsonc
{
  "streamIds": ["stormm-woman-custom-daily-notes"],
  "type": "note/txt",
  "content": "Took 81mg aspirin today. Spotting earlier this morning.",
  "time": 1730000000
}
```

The stream `stormm-woman-custom-daily-notes` was provisioned at CollectorRequest acceptance with:

```jsonc
{
  "id": "stormm-woman-custom-daily-notes",
  "parentId": "stormm-woman-custom",
  "clientData": {
    "hdsCustomField": {
      "note/txt": {
        "version": "v1",
        "templateId": "stormm-woman",
        "key": "daily-notes",
        "label": { "en": "Daily comments", "fr": "Commentaires quotidiens" },
        "section": "daily",
        "maxLength": 2000
      }
    }
  }
}
```

The `clientData.hdsCustomField[note/txt]` block declares the field-def. Runtime validators (in `hds-lib-js`) walk the parent chain looking for this declaration; finding it, they validate the event's `content` against the `note/txt` eventType's storage shape (here: any string up to 4MB). The `maxLength: 2000` constraint is enforced earlier by the form engine, not by the validator.

---

## How a system-message event looks at runtime

An operator posting an alert via `app-system-out`:

```jsonc
{
  "streamIds": ["app-system-out"],
  "type": "message/system-alert",
  "content": {
    "level": "warning",
    "title": "Lab results uploaded",
    "body": "Please review your latest hCG reading and contact us if questions.",
    "ackRequired": true,
    "ackId": "8f3a-...-uuid"
  },
  "time": 1730001000
}
```

The stream `app-system-out` was provisioned at account setup with:

```jsonc
{
  "id": "app-system-out",
  "parentId": "app-system",
  "clientData": {
    "hdsSystemFeature": {
      "message/system-alert": {
        "version": "v1",
        "levels": ["info", "warning", "critical"]
      }
    }
  }
}
```

The user clicks Acknowledge on the alert; their app posts:

```jsonc
{
  "streamIds": ["app-system-in"],
  "type": "message/system-ack",
  "content": {
    "ackId": "8f3a-...-uuid",
    "ackedAt": "2026-04-27T12:34:56Z",
    "userNote": "Got it, will check tomorrow."
  },
  "time": 1730001050
}
```

The operator's dashboard reads `app-system-in`, joins the ack to the alert by `ackId`, renders the alert as ✓ Acknowledged.

---

## CMC system messages carrying an HDS payload: data-export requests, documents, reminders, scope updates

The CMC plugin (open-pryv.io `components/cmc`) forwards only its own event types between a
patient and a doctor; a type HDS would define here would never be delivered. HDS therefore rides
the plugin's **system channel** for structured exchanges and namespaces its payload under
`content.hds`. The plugin validates the envelope (`level`, localizable `title` and `body`,
`ackRequired`, `ackId`) and delivers every other content key verbatim, stamping `content.from` on
the receiving side.

### `notification/alert-cmc` with `hds.kind = data-export-request` *(patient → doctor)*

GDPR / HIPAA portability: the patient asks the doctor for an export of the data the doctor holds
about them. Written by the patient on its own `<scope>:collectors:<doctorSlug>` stream; the plugin
delivers it to the doctor's `<scope>:collectors:<patientSlug>` stream.

```json
{
  "level": "info",
  "title": { "en": "Data export request" },
  "body": { "en": "Please provide an export of the data you hold about me.\nRequested by: 2026-10-01" },
  "ackRequired": true,
  "ackId": "hds-data-export:<uuid>",
  "hds": { "kind": "data-export-request", "requestedAt": 1789000000, "dueAt": 1791000000, "note": "PDF please" }
}
```

| `hds` field | Type | Meaning |
|---|---|---|
| `kind` | `"data-export-request"` | Discriminator; the `ackId` prefix `hds-data-export:` is a secondary marker |
| `requestedAt` | unix seconds | When the patient asked |
| `dueAt` | unix seconds, optional | Deadline the patient proposes |
| `note` | string, optional | Free text for the doctor |

### `notification/ack-cmc` *(doctor → patient)*: fulfilment

The doctor marks the request fulfilled with the plugin's standard ack, `{ alertEventId, ackId }`,
written on its own collectors stream and delivered back. A request is **pending** until an ack
with the same `ackId` (or `alertEventId`) exists on the same stream, then **fulfilled** at the ack's
time. The export itself is delivered out of band (the doctor's app), exactly as before; what this
adds is a structured, timestamped record on both accounts.

Implementation: `hds-lib` `cmcDataExport` (`requestDataExport`, `fulfillDataExportRequest`,
`listDataExportRequests`); doctor-dashboard shows the queue per patient, hds-webapp lets the
patient send a request and see its status. The document kinds below follow the same pattern.

### Documents in a conversation: `notification/alert-cmc` kinds *(3.37.0)*

A person shares one document with a contact, takes it back, or a contact sends one (Route B). The
document itself is read through the data grant by its event id; the alert only tells the other side.
Streams and rules: [DOCUMENTS.md](DOCUMENTS.md#sharing-one-document-the-document-shares-root-3370).

Written by the sender on its own `<scope>:collectors:<peerSlug>` stream; the plugin delivers it.

```json
{
  "level": "info",
  "title": { "en": "Document shared" },
  "body": { "en": "A document was shared with you in this conversation." },
  "code": "hds-document-shared",
  "hds": { "kind": "document-shared", "eventId": "<the document's event id>" }
}
```

- `level: 'info'`, and a **fixed** localised `title` and `body` per kind (the plugin requires both),
  **never the document's title**: the alert stays in the receiver's account through any take-back.
- `code: 'hds-<kind>'` is a secondary marker; `hds.kind` is the discriminator. No `ackRequired`.

| `hds.kind` | Direction | `hds` fields | Meaning |
|---|---|---|---|
| `document-shared` | person → contact | `eventId` | One document is now readable by the contact (a share child was added to it). |
| `document-unshared` | person → contact | `eventId` | Taken back. |
| `document-sent` | contact → person | `eventId` | The id returned by the contact's create in the person's account (Route B). |

**Reading.** The receiver keys bubbles by `(kind, eventId)`, so a duplicate (two devices) shows once;
between `document-shared` and `document-unshared` of one `eventId` the later event `time` wins. On
`document-unshared`, a 403 or a missing event, the reader shows "no longer available" and drops any
cached file. On `document-sent` the person's app moves the event to `documents` (DOCUMENTS.md) and
refuses what is not a `file/xds-v1` document.

### Reminding a person about one item: `notification/alert-cmc` kind `item-reminder` *(3.40.0)*

A contact (a doctor) asks the person to fill in one item of the data set they share: an item of a
recurring section that is due or overdue, or of a permanent section still missing. That is all it
does: nothing stores a reminder state, the request's sections do not change, and the item's own
`reminder` definition is not touched.

Three things share the word: the item's `reminder` field (`definitions/items/*.yaml`) is the
person's schedule, hds-lib `computeReminders` derives a status from it, and this kind is one message
a contact sends about one item. None feeds another; the contact's app may *use* the status to decide
when to send.

Written by the contact on its own `<scope>:collectors:<personSlug>` stream; the plugin delivers it to
the person's `<scope>:collectors:<contactSlug>` stream.

```json
{
  "level": "info",
  "title": { "en": "Reminder" },
  "body": { "en": "Your contact asks you to fill in an entry." },
  "code": "hds-item-reminder",
  "hds": { "kind": "item-reminder", "itemKey": "body-weight" }
}
```

| `hds.kind` | Direction | `hds` fields | Meaning |
|---|---|---|---|
| `item-reminder` | contact → person | `itemKey` | The contact asks the person to fill in this item. |

- `itemKey` is the key of one item of the model (`items.json`). A reminder about several items is
  one alert per item.
- **Writer rule.** `itemKey` names an item of a section of the request the stream belongs to, and
  one a person can enter (`isEnterable`: not `system`, `imported` or `attachments`). A contact never
  reminds about an item outside its request: asking for more goes through
  `consent/scope-request-cmc`.
- `level: 'info'`, a **fixed** localised `title` and `body`, and `code: 'hds-item-reminder'`, as for
  the document kinds. The item is named by the reader from its model (the item's `label` for
  `itemKey`), never from text carried in the event. No `ackRequired`: the answer is the entry
  itself, which the contact sees through its grant.

**Reading.** The person's app shows each reminder as a bubble in the conversation, in time order,
naming the item. The bubble offers to open the item's form **only while** the grant of the
relationship whose collectors stream carries the alert (the one the reader also takes the item's
section from; another grant of the same contact that covers the stream may serve as a fallback)
covers the stream the entry would be written to: the section's `itemCustomizations[itemKey].context`
stream when the request sets one, else the item's `streamId` (on that stream, a parent of it, or
`*`). The grant is read at display time, never from the alert. An `itemKey` the reader's model does
not know (a newer model), or a known one that is not enterable, shows the bubble without the action.
A deprecated key still resolves (`forKey` returns it, same `streamId:eventType` as its replacement),
so the form opens; the contact writes the key as it stands in its request.

The person's app never writes this kind. A reader keeps only alerts carrying `content.from`
(stamped by the plugin on delivery); an alert without `from` on a stream is the writer's own copy,
which only the contact's app reads back (to show when it last reminded the person of an item).

### `consent/scope-update-cmc` with a `content.hds` block *(patient → connection)*: what changed, and why

When a person stops sharing one type of data with a connection, shares it again, or answers the
connection's `consent/scope-request-cmc`, the app writes a `consent/scope-update-cmc`. The platform
applies the permissions and delivers the event's whole content (plus `from`) to the connection
(open-pryv.io `components/cmc/src/handleSystem.ts`, `deliverSystemToPeer`). The permission set alone
does not say what the person decided, or in which words the connection was told, so the app adds an
`hds` block. This is a **convention only**: the mirrored schema is pryv's and is not changed; it
declares no `additionalProperties`, so the extra key validates, and `[ETLM-CMC-4]` keeps it that way.

Self-initiated (the person stops sharing `body-weight`):

```json
{
  "accessId": "<the connection's data-grant access id>",
  "newPermissions": [{ "streamId": "body-temperature", "level": "read" }],
  "hds": {
    "removed": ["body-weight"],
    "message": { "en": "Anna stopped sharing Body weight with you on 26 October 2026.", "fr": "…" }
  }
}
```

Answer to a request (the person declines; `asked` is what the request asked for that was not shared;
the words for the connection go in pryv's own `reason`, see the rules):

```json
{
  "scopeRequestEventId": "<the request event id>",
  "accept": false,
  "reason": { "en": "I prefer not to share my weight.", "fr": "…" },
  "hds": { "asked": ["body-weight"] }
}
```

**Who can write it.** `@pryv/cmc` (3.21.1) `acceptScopeUpdate` and `refuseScopeUpdate` write a fixed
content, `{ scopeRequestEventId, accept }` plus an optional `reason` on a refusal, and take no other field.
An `hds` block can therefore only come from a helper that writes the `consent/scope-update-cmc` event with
`events.create` itself (an hds-lib helper, so every HDS app writes the same content) and then waits for the
outcome as those functions do.

| `hds` field | Type | Meaning |
|---|---|---|
| `removed` | array of streamIds, optional | Self-initiated: the streams this update stops sharing |
| `added` | array of streamIds, optional | Self-initiated: the streams this update shares again |
| `asked` | array of streamIds, optional | On an answer: the streams the request asked for that were not shared when the person answered, so both sides can still say what was decided |
| `message` | object, language code → text, optional | Self-initiated (and an acceptance): the notice for the connection, in every language the writing app has; the same shape as `message` on `consent/scope-request-cmc` |

**Rules.**

- **The permissions are authoritative; `hds` is the explanation.** What is shared is what the platform
  recorded on the trigger (`applied: true`, `newPermissions`). A reader never derives the grant from
  `removed` / `added`; when they disagree with the permissions, the permissions win.
- Every field is optional, and a reader ignores keys it does not know. New keys are added here first.
- Streams are listed by `streamId`; a reader names them from the model (item label for the stream),
  never from a label carried in the event.
- The `hds` block is written by the person's app only. The platform's own keys (`status`, `applied`,
  `responseEventId`, `from`) stay at the top level, as pryv defines them.
- **One text, one place.** On a refusal the person's words go in pryv's `reason` (a language code → text
  object), never also in `hds.message`; `hds.message` carries the notice only where pryv has no field for
  it (a self-initiated update, an acceptance). `hds.asked` is not text: it lists streams, and a reader names
  them from the model, so it never repeats `reason`.
- No field is added for a conversation's documents. A `document-shares` child appears in
  `newPermissions` (and `removed` / `added`) like any stream; the model does not know it, so a reader
  labels it from its `clientData.hdsDocumentShare.direction` (DOCUMENTS.md), never from its name.

**Read-only fallback, time-boxed.** An early hds-webapp prototype wrote `removed`, `added`, `asked` and
`message` at the top level of the content, on events written before 2026-10-26 on the demo platform. No
writer may do so. A reader may accept those keys at the top level for such events, and drops the fallback
at the next minor release of this model: pryv may later define a top-level `message` with another shape.

## Cross-references

- **Plan 45** — design doc, open-question log, full rationale (internal planning docs).
- **Plan 45 spec** — locked TS types, JSON schemas, validator pseudocode, helper API (internal planning docs).
- **`hds-lib-js/ts/appTemplates/CUSTOM-FIELDS-AND-SYSTEM.md`** *(Plan 45 Phase 3.5)* — the runtime side: parent-chain walk, helper APIs (`resolveStreamCustomField`, `streamCustomFieldToVirtualItem`, …), `CollectorRequest`/`CollectorClient` extensions, sandbox-prefix enforcement.
- **Plan 25** *(closed)* — `{app-id}-app/` convention precedent (internal planning docs).
- **`AGENTS.md`** §1 (this repo) — "Items are domain-named, source-agnostic" — the principle that custom fields preserve by living *outside* the canonical item registry.
