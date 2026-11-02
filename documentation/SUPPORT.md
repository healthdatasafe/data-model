# Support: messages with the HDS team

What the HDS support channel stores, where, and for how long (plan 117). A person joins the support group's open-link
invite from an HDS app, and from then on exchanges messages with the HDS team over an ordinary CMC chat. The team
answers from a console, through a support service. **The channel carries messages only: no health data enters any
stream below, and the team gets no access to the person's data.**

The model defines two things: a stream on the person's account, `hds-support`, and an eventType on the group's
account, `support/conversation-v1`. Everything else is CMC (`@pryv/cmc`) and is named here only so the picture is
complete.

## What lives where

| Data | Account | Stream | Type | Written by | Read by |
|---|---|---|---|---|---|
| Consent anchor | person | `hds-support` (root, this model) | none, ever | nobody (created empty by the person's app) | nobody (the group's grant points at it) |
| Chat, the person's copy | person | `:_cmc:apps:hds-support:team:chats:hds-support--<host-slug>` | `message/chat-cmc` | the person's app; the platform mirrors the team's lines | the person's app |
| Chat, the group's copy | group | `:_cmc:apps:hds-support:team:chats:<userSlug>` | `message/chat-cmc` | the platform (the person's lines), the support service (the team's lines) | the support service, the team's members |
| Conversation state | group | `:_cmc:apps:hds-support:team:state` | `support/conversation-v1` (this model) | the team's members, the support service | the team's members, the support service |
| Notification address | support service | its SQLite outbox, keyed by `userSlug` | (not Pryv) | the support service (`POST /notify`) | the support service |

`<userSlug>` is the person's counterparty slug, `<username>--<host-slug>` (`cmc.counterpartySlug`). The group is one
`hds-support` account per platform, owned by HDS; members are HDS team accounts holding a CMC membership on
`:_cmc:apps:hds-support:team`.

## Stream `hds-support` (person's account)

```
hds-support     Health Data Safe support (holds no data)
```

A root with no child, no item and no event, ever. It exists because a CMC invite must request at least one
permission, and the support relationship needs none: the invite requests `read` on `hds-support`, which reaches
nothing. The person's app creates it (with its model `name`) before accepting, as for any offered stream.

**Why a root.** Under any other root it would inherit that root's grants and be named as part of it, and a grant on a
`:_cmc:` stream would reach the person's other chats (`:_cmc:apps:hds-patient` holds every doctor conversation).
An app stream (`appStreams.yaml`) is a suffix under each app's own `{appStreamId}`, so its id differs per app, while
the anchor's id must be the same everywhere: the support service checks a proof token against it (`POST /notify`).
A root is covered by no existing grant except `*`, and its own grant covers nothing else.

**Why the anchor is named `hds-support` while the type is generic.** The stream is what the person sees in their own
tree and on the consent screen: it names the one relationship it anchors, the HDS team, so the person can tell what
it is for and who holds the grant on it. Another support group would get its own anchor, never share this one. The
eventType describes a shape (the state of a support conversation on a group's account), which any support group can
reuse, so it names no one (AGENTS.md §3).

**Never write to it.** The group reads whatever is put there, so an app that wrote an event, or created a child, in
`hds-support` would hand it to the HDS team. Readers and writers treat it as empty by contract.

**Localised names.** It is the first stream to carry `label` and `description`, for consent screens: the permission
must read as "holds no data" in the person's language. The stream schema (`src/streams.js`, `checkLocalisedNames`):
both are optional; when present, each is an object with non-empty `en` and `fr` strings, and `label.en` equals
`name`, the English name the stream is created with. Today hds-lib's `permissionView` shows `name` (a stream with no
item); reading `label` there is a consumer change.

## EventType `support/conversation-v1` (group's account)

One event per conversation on `:_cmc:apps:hds-support:team:state`, updated in place. Closed object
(`additionalProperties: false`); times are Unix seconds. **It holds no personal data beyond account identifiers: no
health data, no message text, no email address.**

| field | required | meaning |
|---|---|---|
| `userSlug` | yes | The conversation: the last segment of its thread stream on the group account. Pattern `^[a-z0-9]+(-[a-z0-9]+)*--[a-z0-9]+(-[a-z0-9]+)*$`, at most 320 characters. |
| `status` | yes | `new` (the person wrote and no one on the team has it), `open` (the team is handling it), `closed` (closed by the team). |
| `claimedBy` | | The member who took it: `{ membershipAccessId, username, host, displayName?, at }`. Advisory, not an access control: every member still reads the thread and can answer. Absent when no one has it (never `null`). |
| `notify` | | The person asked for one email when the team answers: `{ consentAt, sentAt? }`, waiting while `sentAt` is absent. Written by the support service only. The address is never here. |

`claimedBy.membershipAccessId` is the id of the member's membership access on the group account, the same id the core
stamps as the event's `modifiedBy` when that member writes it, so a console can check the claim against the event.
`username` and `host` are the member's own account. `displayName` is the name the console shows (falling back to
`username`); it is at most 40 characters with no colon and no newline, because it feeds the widget's byline parse
`^([^:\n]{1,40}): `.

No `locale` in v1: nothing writes the person's language, so the service's "joined" line is bilingual. Adding the
field later is a minor release.

**Why not `settings/`.** Settings types are one recurring event per type, holding an app's preferences, with keys
owned by the app; hds-webapp files `settings/*` as settings and leaves them out of the diary and the trash. This is
one event per conversation, written by several parties: a record, like `sync-status/connector-v1` (one event per
connector) and `consent/record-v1`, so it follows their `<family>/<name>-v1` naming. `support/` is generic on purpose:
another support group could keep the same state on its own account.

**Never delivered.** The type is not a CMC type, so the CMC plugin ignores it (`not-cmc-event`) wherever it is
written: it never leaves the group account.

## Rules

1. **The first message makes it new.** On a thread's first message from the person, the support service writes the
   state event with `status: 'new'`. A thread with no state event yet reads the same way. The console's New column
   is `status: 'new'`.
2. **A message after a close reopens it.** When the person writes on a `closed` conversation, the service (from its
   chat Monitor) sets `status: 'new'` and removes `claimedBy`.
3. **One event per `userSlug`.** The core has no unique key, so two writers racing can create two. A reader takes the
   most recently `modified` one; the support service deletes the others when it sees them.
4. **An update replaces the whole content.** A writer re-reads the event immediately before writing, and writes back
   every field it does not change. Releasing a claim is writing the content without `claimedBy`.
5. **Only the support service writes `notify`.** A member's write carries `notify` over unchanged. The field holds
   times only, so a member writing from a stale read can at worst bring back a stale `sentAt` or `consentAt`, never
   an address: the address lives only in the service's outbox.
6. **The schema is advisory.** The cores accept any content for this type (AGENTS.md, "What the cores actually
   enforce"); the console and the service compile it. A reader that meets an unknown `status` shows the conversation
   as `new`.

## Retention

- **The notification address** is held only by the support service, in its SQLite outbox keyed by `userSlug`, never
  on a Pryv account. The service removes it when the one email is sent (saying only that the team answered; no
  content, no names), and after 30 days if nothing was sent. The state event records only `notify.consentAt` and,
  once sent, `notify.sentAt`.
- **The chat** stays on the group account as long as the relationship exists, and **the group's copy is removed when
  the relationship ends, whichever side ends it.** When the person un-joins, the service sees the delivered
  `consent/revoke-cmc` and deletes the group-side thread's events and the state event (the person's
  `revokeAcceptance` alone leaves them in place, plan 117 WP-A). When the team ends it, the console's "close + revoke"
  has the service revoke the relationship and delete the same. The **thread stream itself stays, empty**: the core
  refuses to delete a CMC chat leaf (`cmc-reserved-stream-undeletable`, open-pryv.io rc.68), so a leaf's existence
  does not mean the person can still be answered. Plain "close" only sets `status: 'closed'`. The person's own copy
  is theirs, on their account.
- **No history.** The HDS cores keep no event history (`versioning.forceKeepHistory` off, see
  [`CONSENTS.md`](CONSENTS.md) rule 2), so a deleted event or a replaced content is gone.
- **The anchor** `hds-support` holds nothing, so it has nothing to retain; it may stay after an un-join.

## Which member wrote a line (`clientData.hdsSupport`)

Members cannot write chat (CMC refuses `message/chat-cmc` from a `member` access), so the support service writes the
team's lines with the group's token and stamps the group-side event:

```
clientData.hdsSupport = { agent: { membershipAccessId, username, host }, kind: 'message' | 'joined' }
```

The platform does not forward `clientData` to the person's copy, and a chat body is a string, so the person sees the
member only as the text prefix `"<display name>: "`. The console attributes a line by `hdsSupport.agent`, and the
person's lines by `content.from`.

## Not here

Message text (in `message/chat-cmc`, on the threads), presence (in the support service's memory), the notification
address (in the service's outbox), and the invite and its consent text (the group's CMC invite).
