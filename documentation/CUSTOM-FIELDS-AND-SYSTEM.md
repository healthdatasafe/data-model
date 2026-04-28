# Custom fields & system stream — data-model side

This document describes what `data-model` ships for **template-scoped custom fields** and the **account-level system stream** introduced by Plan 45 (`_plans/45-custom-fields-appTemplates-atwork/` in the `_macro` workspace). It is the **data-model perspective** — what types exist, what `appStreams` declarations exist, how the storage shapes are constrained.

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

## Cross-references

- **Plan 45** — design doc, open-question log, full rationale: `_plans/45-custom-fields-appTemplates-atwork/PLAN.md`.
- **Plan 45 spec** — locked TS types, JSON schemas, validator pseudocode, helper API: `_plans/45-custom-fields-appTemplates-atwork/spec.md`.
- **`hds-lib-js/ts/appTemplates/CUSTOM-FIELDS-AND-SYSTEM.md`** *(Plan 45 Phase 3.5)* — the runtime side: parent-chain walk, helper APIs (`resolveStreamCustomField`, `streamCustomFieldToVirtualItem`, …), `CollectorRequest`/`CollectorClient` extensions, sandbox-prefix enforcement.
- **Plan 25** *(closed)* — `{app-id}-app/` convention precedent: `_plans/25-generic-app-stream-done/Plan.md`.
- **`AGENTS.md`** §1 (this repo) — "Items are domain-named, source-agnostic" — the principle that custom fields preserve by living *outside* the canonical item registry.
