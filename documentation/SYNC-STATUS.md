# Sync status — whether a connected service is working

How a connector (a bridge importing a partner's data into the user's account) publishes its status
**in the user's own account**, so that another app the user authorised can show "Mira: connected, last
synced this morning" without ever calling the bridge (site-agents#19).

The connector writes the status; apps only read it.

This is not clinical data. `sync-status` is a non-clinical root, like `profile`, and the one item on it
is of `type: system`: written by a machine, never entered by a person.

## Stream tree

```
sync-status                     Connected services          ← item `sync-status` registered here
  sync-status-mira              Mira connection status            role: context
  sync-status-tempdrop          Tempdrop connection status        role: context
  sync-status-femm              FEMM connection status            role: context
  sync-status-ryb               Read Your Body connection status  role: context
  sync-status-cyclefeminin      cyclefeminin connection status    role: context
  sync-status-healthkit         Apple Health connection status    role: context
```

One leaf per connector in the app catalogue. The leaves are **D3 context streams**
(see [`TREATMENT-PROCEDURE.md`](TREATMENT-PROCEDURE.md)): no item is registered on them, and an event
placed on a leaf resolves to the `sync-status` item through the `forEvent` walk-up. A writer places its
event with `eventTemplate({ context: 'sync-status-<connector>' })`.

**Why partner-named streams are acceptable here when partner-named item keys are not** (`AGENTS.md` §1):
the connector *is* the subject of the status, and the leaves are non-data-bearing context markers, not
vocabulary. The item key stays generic, so there is one key forever. The leaves must still be declared in
the model, because hds-lib refuses a context stream it does not know.

**Leaf names stand alone.** When an app requests a single leaf, the consent screen shows that leaf's
`name` with no parent around it, so it reads "Mira connection status", never just "Mira".

**A new connector adds a leaf** in `definitions/streams/sync-status.yaml` — a model release, no new item.
Its catalogue entry publishes the leaf as `statusStreamId`; apps read it from there and never infer it.

## Item

| item | streamId | eventType | type | repeatable |
|---|---|---|---|---|
| `sync-status` | `sync-status` | `sync-status/connector-v1` | **system** | once |

`type: system` is the hide marker: consumers **skip the item** in pickers, form builders, forms and
diaries. It stays fully resolvable (`forKey`, `forEvent`) and requestable like any other item. hds-lib
derives `HDSItemDef.isSystem` from it, and `getAllActive()` (the picker contract) excludes it. The loader
requires a `system` item's eventType to be an object; `system` is never a valid composite field type.

## EventType `sync-status/connector-v1`

Closed object (`additionalProperties: false`), all times **Unix seconds**.

| field | required | meaning |
|---|---|---|
| `status` | yes | `active` / `needs-reauth` / `error` / `disconnected` — see below |
| `connectedAt` | | When the current connection was made. A reconnect after `disconnected` sets it again, so it never points at an earlier, ended connection. |
| `lastRunAt` | | Last sync attempt, successful or not. |
| `lastSuccessAt` | | Last successful sync. |
| `syncedUntil` | | High-water mark of the partner data imported so far. |
| `lastError` | | The most recent failure: `{ class, code?, at }`. `status` says whether it is still current. A `lastError` on an `active` status is a failure the connector has recovered from (`lastSuccessAt` later than `lastError.at`). |
| `lastError.class` | yes (in `lastError`) | `auth` (the partner credential), `upstream` (the partner's service), `hds` (writing into HDS), `other` |
| `lastError.code` | | Short operator code, `^[a-z0-9][a-z0-9-]{0,63}$` |
| `lastError.at` | yes (in `lastError`) | When the failure happened. |

### Status values

| status | meaning | what an app shows |
|---|---|---|
| `active` | Connected and syncing. | Connected; last synced `lastSuccessAt`. |
| `needs-reauth` | The partner credential expired or was revoked; nothing syncs until the user reconnects. | Ask the user to reconnect. |
| `error` | Syncing fails for another reason; the connector keeps trying. | A problem, with `lastError.class` as the hint. |
| `disconnected` | The user disconnected the service. The connector writes it, and so may the connect flow (`/connect`). | Not connected. |

No event on the leaf means the connector has published no status: the service was never connected, or it
was connected before the connector published status (3.13.0) and has not been reconnected since. An app
shows this as "not connected" and offers to connect; the connect flow handles a service that is already
connected.

The schema is shape only and uses no `if`/`then`, because the cores compile with `ajv-draft-04`. Which
fields accompany which status is a writer convention, not a schema rule.

## Rules

1. **Apps request READ on the leaf only, never on the item or the root.** An app asks for the leaf of
   the connector it supports (an hds-lib `forItemKeys` preRequest). Read on `sync-status` would be
   inherited by every leaf and would reveal every service the user has connected, which is not the app's
   business. The connector's own grant likewise covers only its leaf, so connectors are isolated from
   each other. **`contribute` is the level a connector needs:** it reads, creates, updates and deletes
   events on the leaf and nothing more; it cannot create child streams or edit the leaf. Update rights
   do not depend on who created the event, so the connector updates in place a `disconnected` event
   that `/connect` wrote as the user. `manage` also works and is what a CMC grant carries today
   (bridge-mira); it only adds stream management the status writer does not use. A plain-access
   connector lists its permissions in its catalogue entry, and the account app's `/connect` (or the
   webapp) mints the access from them with the user's personal token, after placing the leaf under
   `sync-status` in the tree (a missing stream named in `accesses.create` would otherwise be created
   at the root from its `defaultName`); such a connector requests `contribute` on its leaf
   (bridge-tempdrop).
2. **An unknown `status` renders as unknown.** A reader that meets a value it does not know shows
   "unknown"; it never fails and never maps it onto a known value.
3. **One event per leaf, updated in place; latest wins.** The connector updates its single event rather
   than adding new ones (`repeatable: once`). Should a leaf ever carry several, the most recent is the
   status.
4. **`lastError.code` is an operator code, never partner text.** A partner's error message can carry
   personal data or arbitrary text, and this event is read by other apps. The pattern keeps the field to a
   short lowercase code an operator can look up (`mira-http-503`, `token-revoked`).
5. **The writer sends the whole content on every update.** `events.update` replaces `content`; the writer
   never carries forward a field it no longer asserts. A fresh connect starts a new content: new
   `connectedAt`, no `lastError` from the previous connection.

The `status` enum is closed in the schema, which is advisory: the cores accept any content for HDS types
(AGENTS.md, "What the cores actually enforce"), so a new value is a model release, and readers treat a value
they do not know as unknown (rule 2).

## Relation to the other sync streams

Three things are called "sync", and they serve different readers:

| what | where | eventType | read by |
|---|---|---|---|
| **Connector status** (this document) | user's account, `sync-status-<connector>` | `sync-status/connector-v1` (closed) | apps the user authorised |
| App watermark | user's account, app-stream `{appStreamId}-sync` (site-agents#17) | `sync-status/bridge` (open) | the writing app itself |
| Bridge watermark | the bridge's own account, per partner-user stream | `sync-status/bridge` (open) | the bridge itself |

The watermarks are **writer-private**: how far a source has synced, so its next run can resume. Their
schema is deliberately open because existing writers carry different payloads. A bridge's resume
watermark stays on the bridge account; only its **user-visible status** goes to `sync-status`. The two
are separate on purpose, so the status can be closed, small and safe to share, while the watermark stays
free-form.

## Consumers that must tolerate `type: system`

Introduced in 3.13.0. Release these with or before the pack:

- **hds-lib** — `HDSItemDef.isSystem`; `itemsDefs.getAllActive()` excludes system items.
- **hds-webapp** — the diary skips `isSystem` items (otherwise the status JSON would show in the diary).
- **hds-forms-js** — form specs report the item as unsupported (`reason: 'system'`) instead of throwing;
  the field renderer guards the same way.
- **doctor-dashboard**, **bridge-redcap** field mapping — filter `isSystem`.
- **app-web-user-account** — the consent row label must still resolve for a system item.
