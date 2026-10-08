# Consents: the account-level consent record

Where HDS keeps the proof that a user consented to the processing of their health data, accepted the Terms,
acknowledged the Privacy Policy and, for US residents, gave the US consumer-health-data consent. The record lives
**in the user's own account** (plan 91, decision D-A option A, validated by the DPO 2026-10-08): no separate service
holds it.

These are the consents given **at account level**. Consents to *share* data with someone are not recorded here: the
access the user grants is itself the record of that consent.

`consents` is a non-clinical root, like `profile` and `sync-status`, and its one item is of `type: system`: written by
the account app, never entered in a form.

## Stream

```
consents          Privacy and consents     ← item `consent-record` registered here
```

One root, no children. **No app requests access to it.** The account app reads and writes it with the user's
personal token; any other app has no reason to know which legal documents a user accepted.

## Item

| item | streamId | eventType | type | repeatable |
|---|---|---|---|---|
| `consent-record` | `consents` | `consent/record-v1` | **system** | unlimited |

`type: system` hides it from pickers, form builders, forms and diaries (see [`SYNC-STATUS.md`](SYNC-STATUS.md) for
the marker).

## EventType `consent/record-v1`

Closed object (`additionalProperties: false`). One event per act.

| field | required | meaning |
|---|---|---|
| `documentId` | yes | Which document: `terms`, `privacy`, `health-processing`, `us-chd-privacy`, `us-chd-consent` today. Pattern `^[a-z0-9][a-z0-9-]{0,63}$`, so a new document needs no model release. |
| `version` | yes | The version of that document the act refers to, as published in the website's legal manifest (`1.0`, `1.2`, `2.0.1`; the manifest's versions must match the pattern `^[0-9]{1,4}(\.[0-9]{1,4}){0,2}$`). A `lapsed` (or `withdrawn`) act carries the version of the `given` it ends. |
| `action` | yes | `given`, `withdrawn`, `acknowledged`, `lapsed`: see below. |
| `locale` | | The language the text was shown in (`en`, `fr`, `es`, `en-US`). |
| `url` | | The URL the document was published at when the act happened. Informational: the website's URLs are not versioned, so what version N said is evidenced by the version and the published-documents register, not by this URL. |
| `residence` | | The residence the user declared at that moment: `{ country, state? }`. `country` is the closed set of jurisdictions the signup distinguishes, not an ISO list: today `US` or `other` ("none of those offered at the time"). The set grows by adding codes (`CH`, `EU`, ...), never by re-reading `other`. `state` is a two-letter US state code, given with `US` (a writer convention; the schema stays shape-only). Nothing more is collected than the US layer needs. |
| `surface` | | Where the act happened: `signup`, `sign-in` (the prompt shown at sign-in: a first consent for an older account, or a new version after a material change), `center` (the Privacy & Consents area of the account). |
| `method` | | `checkbox` (a box ticked) or `button` (an explicit button, as in the Privacy & Consents center). Omitted on `lapsed`, which the app derives from a residence change. |

### Actions

| action | used for | meaning |
|---|---|---|
| `given` | `terms`, `health-processing`, `us-chd-consent` | The user accepted or consented to this version. |
| `acknowledged` | `privacy`, `us-chd-privacy` | The user was shown this version of a notice and confirmed having read it. A notice is not consented to. |
| `withdrawn` | (reserved) | The user withdrew a consent and the account stays. Not written for `health-processing` or `us-chd-consent`: withdrawing those **is** deleting the account (below). |
| `lapsed` | `us-chd-consent` | The user declared a residence outside the United States; the US layer stops applying. Declaring US residence again requires a new `given`. |

**Withdrawing the health-data consent is deleting the account** (decision, plan 91, 2026-10-08): no one can withdraw
`health-processing` and keep their data, so there is no "withdrawn but still holding data" state to record. The
account app's withdraw action leads to export, then account deletion, and writes nothing; the deletion removes the
record with everything else. The same holds for `us-chd-consent` while the user declares US residence (a user who
moves away declares the new residence, which records `lapsed`). A refused material change likewise records nothing
and leads to export, then deletion. `withdrawn` stays in the enum for a future consent whose withdrawal leaves the
account in place. "Superseded" is a state derived from the manifest, not an act.

No free text anywhere: the record carries identifiers, versions and enumerations only.

## Evidence

What demonstrates an act (GDPR art. 7(1)) is the server's part of the event, not the client's: `created` (stamped by
the core) and `createdBy` (the personal access of the account app session). Writers set `time` to the moment of the
act, and it should match `created`; a record whose `modified` differs from `created` was edited after the act, and the
center may show it as such. What version N of a document said is evidenced by the published-documents register in
compliance, so no hash of the text is stored here.

A withdrawal of `health-processing` leaves no event: it is the deletion of the account. Evidence that the deletion was
requested and honoured has to live outside the user's account (a platform-side deletion log holding no health data),
never in this record, which disappears with the account. Before deleting, the user can export their data, consent
history included.

Residence is a snapshot taken on acts only: a change of residence with no consent effect (one US state to another,
`other` to `other`) leaves no record. If that is ever needed, a `documentId: residence` with an action `declared` is
cheap to add.

## Rules

1. **The stream exists before the first write.** `events.create` on a missing stream fails
   (`unknown-referenced-resource`). The account app creates the root with the personal token
   (`streams.create { id: 'consents', name }`, `item-already-exists` being the normal outcome after the first act)
   in the same batch as its first event.
2. **Append-only.** A writer never updates or deletes a consent event; a change is a new event. A user can still
   delete events in their own account, as with any of their data; the DPO accepted this (question 3 of the plan-91
   proposal). Pryv's `events.delete` trashes first (`trashed: true`) and a second call removes; `events.get` hides
   trashed events by default, so a trashed or deleted record is **absent**, and the next sign-in asks again. The HDS
   cores keep no event history, so a deletion is final.
3. **Latest wins, per document.** The current state of a document for a user is its most recent event by `time`.
   A document with no event has never been accepted: the account app treats it as "consent required".
4. **The version is the published one.** `version` is copied from the legal manifest the account app reads, never
   typed by hand; a re-consent compares it with the manifest.
5. **The schema is advisory; readers tolerate the unknown.** The cores accept any content for `consent/record-v1`
   (AGENTS.md, "What the cores actually enforce"); only this repo's tests and a client that compiles the schema
   enforce it. A reader that meets an unknown `documentId` ignores the event; a reader that meets an unknown `action`
   or `surface` treats the document as **consent required**, never as given and never as withdrawn. Adding a value
   is a model release.

The schema is shape only and uses no `if`/`then`, so it would validate unchanged if a core ever enforced it (the
cores compile with `ajv-draft-04`). Which actions go with which documents is a writer convention, not a schema rule.
