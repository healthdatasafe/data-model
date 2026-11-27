# Corrections: a professional says an entry should have been different

A professional who holds a CMC relationship with the person (a fertility-awareness method instructor reviewing her
chart, a clinician) says that one of her entries should have been different, should exist, or should not exist, and
why. **The entry is never changed by the professional.** The correction is an event of its own, and HDS apps show
"corrected by <role>" next to the entry. She applies a correction herself, with her own app, if she agrees.

**Normative** (4.43.0). "MUST" and "never" bind writers; readers follow § Where a correction counts.

## Where it lives: the `entry-corrections` root

| | |
|---|---|
| Stream | `entry-corrections` ("Corrections from your contacts"), a root |
| Item | `entry-correction` on the root, `type: system` (no form, no reminder), eventType `correction/entry-v1` |
| Children | `corr-` + 12 lowercase base36 characters, one per relationship, holding that contact's corrections; not in the model |
| Stream key | `clientData.hdsEntryCorrections = { relationship: <CMC relationship id> }` on each child ([PROVENANCE.md](PROVENANCE.md)) |

**A grant on the item is a grant on the root:** it reads the corrections of every contact (a doctor who reads what her
instructor corrected). A contact writes on its own child only.

**Why one child per relationship.** Pryv has no level that lets an access change its own events only: on a stream
shared by several contacts, `contribute` would let one change or remove another's corrections. A per-app stream has
the same defect as soon as two relationships go through the same app. The corrected entry's own stream is excluded
too: the writer would need `contribute` on her clinical stream, which is what lets it change the entry.

**The child.**

- `id` = `corr-` + 12 lowercase base36 characters, random, never derived from a name, never reused across
  relationships, even with the same contact. `name` = the id itself (the name must carry nothing).
- Granted at `contribute`: the contact lists, supersedes and withdraws its corrections there. It holds at most `read` on
  the entries it corrects.
- Her app creates the root (with its model name) before the first child, and marks each child with
  `clientData.hdsEntryCorrections` once it is granted.

**Two ways to get one**, as for the other per-relationship children:

- **Minted by her app** (the conversation precedent, [CONVERSATION.md](CONVERSATION.md#where-it-lives-the-conversation-items-root)).
  The contact asks for corrections by requesting the item `entry-correction` at `contribute` (a permission on
  `entry-corrections` at `contribute`). Her app never grants the root above `read`: it accepts without that permission,
  then creates a child and grants it with `consent/scope-update-cmc` (hds-lib `asksForCorrections`). This is the way
  for a contact that invites with a reusable link or code.
- **Named by the contact in its offer, on a single-use invite only** (the uploader precedent,
  [DOCUMENTS.md](DOCUMENTS.md#sharing-one-document-the-document-shares-root-3370)): her app creates it under the root at
  the accept (hds-lib `offerStreamsToCreate`). An open link would give every person the same id, which would then
  identify the professional to any reader of the root. So a `corr-` id that does not exist yet is taken only from a
  contact whose invite was single-use, on a scope request as well; any other `corr-` id must already exist and be this
  relationship's.
- **An id asked for is checked before the accept, and again on a scope update.** Every reader of the root sees the
  children's ids, so an offer could name another contact's. Her app refuses an id that exists and is not this
  relationship's (marked for another, or named by another access), a new id from a contact whose invite was not
  single-use, a child at any level but `contribute`, a second `corr-` id for one relationship, and the root at
  `manage` or `create-only` (hds-lib `checkOfferedCorrectionStreams`). A child she created but did not mark yet (an
  interrupted accept) is this relationship's when its access names it.

**When a relationship ends**, the child and its corrections stay on her account: they are her record. The contact loses
its access. Her app may offer to delete them.

**Readers never show a child's name.** Her app labels a child "Corrections from <contact name>" from the relationship
it is marked with; a reader without that knowledge, "Corrections".

**A reader of the root sees more than corrections:** every child's id and marked relationship, so how many contacts
correct her record, and every `comment`, free text the professional wrote. Her consent screen says so when a contact
asks to read the item.

**Release order.** A reader on hds-lib before 2.76.0 cannot resolve a `corr-` child (`forEvent` throws unless told not
to). The person's apps move to hds-lib 2.76.0 before any contact writes corrections.

## `correction/entry-v1`

A closed object (`additionalProperties: false`). One event per entry.

| Field | Req. | Meaning |
|---|---|---|
| `kind` | ✔ | `change`: the entry should have been `corrected`. `add`: there is no entry, one should exist. `remove`: the entry should not exist |
| `authorRole` | ✔ | the author's role (§ The author's role) |
| `itemKey` | ✔ | the pack item the entry is, or should be, on |
| `entryId` | with `change`, `remove` | the corrected event's id |
| `entryModified` | with `change`, `remove` | the entry's `modified` (Unix seconds) as the writer saw it |
| `corrected` | with `change`, `add` | what the entry should have been: `{ type?, content?, time?, clientData? }`, the shape of a conversation proposal ([CONVERSATION.md](CONVERSATION.md)) |
| `comment` | | the author's explanation, 1 to 4000 characters; markdown when `clientData.hdsTextFormat` is `text/markdown` ([PROVENANCE.md](PROVENANCE.md#clientdatahdstextformat--markdown-text)) |
| `about` | | the `file/xds-v1` document the correction was read from (a photo of a paper chart) |
| `replaces` | | an earlier correction that this one replaces: on the same `corr-` child, with the same `entryId` (for `add`, the same `itemKey`) |

**`corrected`.** `type` and `content` go together: `type` is an eventType of `itemKey`, `content` is valid against it.
`time` (with `clientData.hdsTimePrecision` when it is a day: 12:00 UTC, [PARTIAL-DATES.md](PARTIAL-DATES.md)) says the
entry belongs on another moment, a day misplaced on a chart; it goes with `change` only. `clientData` holds only
`hdsTimePrecision`, `hdsBasis` ([MENSTRUAL-CYCLE.md](MENSTRUAL-CYCLE.md)) and `hdsComparator`
([BLOOD-CHEMISTRY.md](BLOOD-CHEMISTRY.md#a-censored-value-hdscomparator)). With `change`, at least one of `type` and
`content` or `time`; with `add`, `type` and `content`.

**Event `time`.** The corrected entry's `time`, copied, for `change` and `remove`; for `add`, the moment the missing
entry is about (a day: 12:00 UTC with `clientData.hdsTimePrecision: day`). Not the moment it was written (`created`
is). A timeline thus places a correction next to its entry. **Readers join a correction to its entry by `entryId`,
never by time.**

**Links.** `entryId`, `about` and `replaces` are mirrored in `clientData.related.<eventId>: true` in the same write
([PROVENANCE.md](PROVENANCE.md#clientdatarelatedeventid--a-link-to-another-event)). With `about`,
`clientData.hdsSourceAnchor` may point at the box the correction was read from; its `eventId` is `about`.

### What a writer MUST include

| When | The event MUST |
|---|---|
| always | be written on the writer's own `corr-` child, and nowhere else; carry an `itemKey` that is an item of the published pack (not an app's overload item: every reader must be able to check it), whose `type` is neither `system` nor `attachments`, and whose stream is not under an `explicitGrantOnly` root (genetics, questionnaires, ...); carry an `authorRole` of the writer's pack |
| `change`, `remove` | carry `entryId` and `entryModified`; the entry is on the item's stream, or a stream under it, with one of the item's types |
| `change` | carry `corrected` with `type` and `content`, or `time`, or both |
| `add` | carry `corrected` with `type` and `content`; no `entryId`, no `entryModified`, no `corrected.time` |
| `remove` | carry no `corrected` |
| `corrected.type` | be an eventType of `itemKey`, and `corrected.content` valid against it |
| any id in content | be mirrored in `clientData.related` |
| `replaces` | name a correction on the same `corr-` child, with the same `entryId` (for `add`, the same `itemKey`) |

**Visibility.** Every reader of the root or of the child reads `corrected` and `comment`, even one with no grant on
the item they concern. That is why items under an `explicitGrantOnly` root are excluded, and why her consent screen
says that a contact who reads corrections reads what they say. `comment` is free text from the professional.

**Out of scope of v1.** Several entries in one correction (write one per entry; `about` groups those read from one
document); a correction of another author's correction; her refusal (she may leave a correction open).

## The author's role

`authorRole` is a closed list, labelled by the vocabulary `professional-role` (`definitions/vocabularies/professional.yaml`,
`pack.vocabularies`), each with its SNOMED CT occupation:

| `authorRole` | en | fr | SNOMED CT |
|---|---|---|---|
| `physician` | Physician | Médecin | 309343006 Physician (occupation) |
| `midwife` | Midwife | Sage-femme | 309453006 Registered midwife (occupation) |
| `nurse` | Nurse | Infirmier ou infirmière | 106292003 Professional nurse (occupation) |
| `pharmacist` | Pharmacist | Pharmacien ou pharmacienne | 46255001 Pharmacist (occupation) |
| `psychologist` | Psychologist | Psychologue | 59944000 Psychologist (occupation) |
| `dietitian` | Dietitian | Diététicien ou diététicienne | 159033005 Dietitian (occupation) |
| `physiotherapist` | Physiotherapist | Physiothérapeute | 36682004 Physiotherapist (occupation) |
| `health-educator` | Health educator | Éducateur ou éducatrice en santé | 409974004 Health educator (occupation) |
| `other` | Other | Autre | none |

- **A role, never an identity,** declared by the writer (as `hdsExtraction.confirmedBy`, [PROVENANCE.md](PROVENANCE.md)).
  Her app adds the contact's name from the relationship; any other reader shows the role only.
- A fertility-awareness method instructor is a `health-educator`. A specialist physician (a gynaecologist) is a
  `physician`.
- A role a reader does not know (a newer pack) is read as `other`. The list grows by addition, in a minor release.

## Where a correction counts

- **Only on a `corr-` child of `entry-corrections`.** A `correction/entry-v1` event on any other stream is ignored.
- **Its author is `createdBy`.** Her app names the contact only when `createdBy` is an access of the relationship the
  child is marked with (a scope update may give the relationship a new access); otherwise she sees "an app", and the
  role is not shown.
- **It is checked before it is shown** against § What a writer MUST include and the pack (the item exists, `corrected`
  validates against its type). One that fails is shown as not applicable, and never offered to apply. An `authorRole`
  the reader does not know is not a failure: it reads as `other`.

## Lifecycle: supersede and withdraw

- **Immutable.** Nobody updates a correction: not the writer, not her app. A reader marks one whose `modified` is later
  than its `created` as "changed after it was written", and still shows it.
- **Supersede:** the writer writes a new correction with `replaces` = the old one's id, then trashes the old one.
- **Withdraw:** the writer trashes it (`events.delete`, once). A writer never deletes a correction for good; purging is
  hers.
- **Superseded** means named in `replaces` by any correction of the same child with the same `entryId` (for `add`, the
  same `itemKey`), trashed ones included (read with `state: 'all'`), so withdrawing a replacement never brings back what
  it replaced.
- **Current** means not trashed and not superseded. An entry may have several current corrections (several authors):
  all are shown, newest `created` first.

## A correction and the live entry

The state is computed by the reader, never stored:

| State | When |
|---|---|
| `applied` | `change`: the entry equals `corrected` on what `corrected` holds. With `type` and `content`: the same type and an equal content, as [CONVERSATION.md § A value she already has](CONVERSATION.md#a-value-she-already-has) compares them (the comparator too, absent equals absent; a convertible item by its method, reading and annotations); with `time`: the same `time` and the same `clientData.hdsTimePrecision`; with only `time`, type and content are not compared; `hdsBasis` when `corrected` holds it. `add`: an entry carries `clientData.related.<correction id>`. `remove`: the entry is gone or trashed |
| `outdated` | not `applied`, and the entry's `modified` is later than `entryModified`: a signal ("the entry changed since"), never a reason to refuse applying; her app's own index writes on the entry also change `modified` |
| `entry-gone` | `change` whose entry is gone or trashed |
| `open` | otherwise, and whenever the reader cannot read the entry (a contact that reads the root but not the item): it cannot tell |

**Applying is hers.** Her app may offer it: she edits her own entry with her token (or, for `add`, writes it, or for
`remove`, trashes it), and her app adds `clientData.related.<correction id>: true` to the entry it edits or writes, so
the trace survives a purge of the correction. Nothing is written on the correction.

## Cross-system

- **HL7 FHIR:** no resource says "a third party says this observation should have been X". The closest rendering is a
  `Task` (`focus` the Observation, `requester` a PractitionerRole with the role's SNOMED CT code, `input` the corrected
  value, `note` the comment); once she applies it, the entry is `Observation.status` `corrected` (or
  `entered-in-error` for `remove`) with a `Provenance`. Not `DetectedIssue`. Not exported today.
- **Apple HealthKit:** no equivalent; not exported.

## Open points

- A CMC alert pointing at a new correction (`hds.kind: 'entry-correction'`, `eventId` only), so her app need not poll:
  additive, with the first person-side app that shows corrections.
- A professional's review status on a document (a copy to take again, accepted, transcribed): CONVERSATION.md's
  `task-status` and notices carry the state of a contact's work on a shared document; distinct notice codes
  (`copy-unreadable`, `copy-incomplete`, `wrong-document`) are a later minor.
- A planned appointment a contact writes: out of scope ([ENCOUNTER.md](ENCOUNTER.md)); it can reuse `professional-role`.

## Example

A `change` read from a photo of her paper chart, on the instructor's child:

```json
{
  "streamIds": ["corr-4k2m9x0q7a1b"],
  "type": "correction/entry-v1",
  "time": 1773316800,
  "content": {
    "kind": "change",
    "authorRole": "health-educator",
    "itemKey": "body-vulva-bleeding",
    "entryId": "ckq3w8n1x0042",
    "entryModified": 1773320000.5,
    "corrected": { "type": "ratio/proportion", "content": 0 },
    "comment": "No bleeding on this day: the **stamp** on your photo is green.",
    "about": "ckq3w8n1x0001"
  },
  "clientData": {
    "related": { "ckq3w8n1x0042": true, "ckq3w8n1x0001": true },
    "hdsTimePrecision": "day",
    "hdsTextFormat": "text/markdown"
  }
}
```
