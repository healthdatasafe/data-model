# Research: invitations, eligibility tests and topics

What the HDS research relationship stores, where, and what HDS can read. A person who says yes to the research opt-in
(an optional choice, [`CONSENTS.md`](CONSENTS.md) § Optional choices, document `research`) accepts the `hds-research`
CMC invite. From then on HDS can send them research invitations and eligibility tests
([`ELIGIBILITY.md`](ELIGIBILITY.md)), at most 2 a month. **HDS reads none of the person's health records through this
relationship:** only what the person chose to send (a score range per test) and the topics they chose. Both can say
something about health by inference (a topic such as `cancer`, a top band on a named study), which is why the tree is
consented to on its own and never reached by a `*` grant.

The model defines a stream tree on the person's account, `hds-research`, one eventType, `research/topics-v1`, its
vocabulary, and two `notification/alert-cmc` kinds with a published schema. The band event,
`research/eligibility-band-v1`, is defined with the eligibility test. Everything else is CMC (`@pryv/cmc`).

## What lives where

| Data | Account | Stream | Type | Written by | Read by |
|---|---|---|---|---|---|
| Consent anchor | person | `hds-research` (root) | none, ever | nobody | HDS, through the grant (nothing to read) |
| Score ranges sent | person | `hds-research-eligibility` | `research/eligibility-band-v1` | the person's app, only when they send | the person's app; HDS through the grant |
| Topics chosen | person | `hds-research-topics` | `research/topics-v1` | the person's app | the person's app; HDS through the grant |
| Invitations, eligibility tests | person | the relationship's collectors stream (CMC) | `notification/alert-cmc` | HDS (`hds-research`), delivered by the platform | the person's app |

The counterparty is one `hds-research` account per platform, owned by HDS, as for support ([`SUPPORT.md`](SUPPORT.md)).

## Streams `hds-research` (person's account)

```
hds-research                   Health Data Safe research
├── hds-research-eligibility   Eligibility test results sent
└── hds-research-topics        Research topics
```

**The grant.** The research invite requests one permission, `read` on `hds-research`, which reaches its two children
and nothing else. No chat (`features.chat: false`); the invite enables system messaging, so HDS can deliver its two
alert kinds.

**Exactly two children, for good.** A grant on the root covers any child added later, under consents already given. So
no child is ever added to `hds-research`: another kind of research data is a new root or a scope request.

**`explicitGrantOnly`.** As for `genetics` ([`GENETICS.md`](GENETICS.md)): a consent request with `streamId: '*'` is
expanded into the model roots minus this one, a minted `*` access gets `{ streamId: 'hds-research', level: 'none' }`,
and a grant that names `hds-research` is the only way in. The root `description` carries the consent-screen promise
("never included when you share all your data").

**Why a root.** Under any other root the tree would inherit that root's grants. The ids are the same on every account,
so the research service reads them without a per-person mapping.

**Write only what the person chose.** Whatever is in the tree, HDS reads. The person's app writes a band only when the
person presses "send", and topics only as the person chose them. Never an answer, a value, an exact score or a
document. The root holds no event.

**No item.** Both types are written by the person's HDS apps from their own screens, never entered in a form or shown in
a diary, as for `conversation-items`.

**Who creates and writes.** The account app, with the personal token, creates the three streams (with their model
`name`) before accepting the invite. hds-webapp, which writes bands and topics, names `hds-research` in its own access
(an app access with `*` does not reach it).

## EventType `research/topics-v1`

One event on `hds-research-topics`, updated in place. Closed object.

| field | required | meaning |
|---|---|---|
| `topics` | yes | Keys of the `research-topic` vocabulary, each once, at most 32. |

**No event, an empty list: none chosen, and every study may be offered,** still within the cap. Topics narrow, they never
gate a yes. Choosing every key is not "all": a study in a topic added later is offered only to those with no topic or
that topic. The vocabulary (`definitions/vocabularies/research.yaml`) labels each key; topics are broad areas a study
recruits in, not clinical concepts, so they carry no code. **Keys are append-only:** a new topic is a minor release, a
key is never renamed or removed (a person's event holds it).

## Alert kinds

Written by `hds-research` on its own `<scope>:collectors:<personSlug>` stream; the plugin delivers them to the person's
collectors stream of the relationship, stamping `content.from`. As for the other HDS kinds
([`CUSTOM-FIELDS-AND-SYSTEM.md`](CUSTOM-FIELDS-AND-SYSTEM.md)): `level: 'info'`, a **fixed** localised `title` and
`body` per kind, `code: 'hds-<kind>'`, `hds.kind` the discriminator, no `ackRequired`. Schema of the `hds` block:
`json-schemas/hds-research-alert.json` (`src/schemas/researchAlert.js`).

```json
{
  "level": "info",
  "title": { "en": "Eligibility test" },
  "body": { "en": "A study asks whether you may be eligible. Open to read the conditions." },
  "code": "hds-research-eligibility-request",
  "hds": { "kind": "research-eligibility-request", "requestId": "req-2026-001" }
}
```

| `hds.kind` | Direction | `hds` fields | Meaning |
|---|---|---|---|
| `research-invitation` | HDS → person | `studyId` | HDS invites the person to a study. |
| `research-eligibility-request` | HDS → person | `requestId` | HDS sends the person a study's eligibility test. |

- **Ids only, per study or per request, never per person.** The alert carries no name, criterion, date or text. The
  person's app fetches the published study or request by its id from the research service, **unauthenticated and with
  no account identifier**, and shows it from what it fetched, in the person's language. It fetches on receipt, never on
  opening, so the service cannot learn who looked.
- **A duplicate** (two devices, a re-delivery) is keyed by `(kind, id)` and shows once.
- **Never written by the person's app.** The reply to an eligibility request is a band event on
  `hds-research-eligibility`; the reply to an invitation is the study's own consent request, a separate relationship.
- **An id the app cannot fetch** (withdrawn, expired, the service down) shows the bubble as "no longer available".

## Rules

1. **Only a latest `given` makes the relationship.** The account app accepts the invite when it records `given` on
   `research`, and revokes the acceptance when it records `withdrawn` or `declined`. A relationship whose document's
   latest act is not `given` (a `declined`, a `withdrawn`, an unknown action, or no act because the person deleted it)
   is ended at the next sign-in.
2. **At most 2 messages a month,** calendar month in UTC, both kinds together. The research service enforces it from
   its own send log; this model does not count.
3. **One band event per request.** Sending again updates it (ELIGIBILITY.md).
4. **One topics event.** A reader takes the most recently `modified` one; a writer updates it rather than adding.
5. **Never for a managed or delegated account.** The tree is not created and the invite not accepted for an account
   acting for someone else (a child, an account created for another person), and a delegate never answers.
6. **The schema is advisory; readers tolerate the unknown.** The cores accept any content for these types. A reader
   that meets an unknown topic ignores that topic; an unknown `hds.kind` shows as a message it cannot open.

## Retention

- **Bands expire on the device.** The person's app deletes a band at its request's `expiresAt`, so HDS cannot re-read
  bands of expired requests while the grant stands. The research service deletes its copy at the same time, or at the
  end of a period set with the DPO.
- **Opting out** (`withdrawn`): the account app revokes the acceptance, which removes HDS's access, and deletes every
  band. Topics stay, as the person's own choice, and are shown again for confirmation before a later yes is accepted.
- **Ending from HDS's side** removes the access the same way; the person's app deletes the bands at its next sign-in.
- **Nothing reaches a researcher individually**: aggregate counts only, with a small-cell threshold.
- The person can delete any band or topics event at any time, like any of their data.
