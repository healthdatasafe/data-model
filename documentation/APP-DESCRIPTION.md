# App description: how an HDS app names the apps that hold an access

An implementer (a registry, a cycle-charting app, a clinic's tool) holds an access to a person's account. Every HDS
app that lists or asks about that access (the person's app, the account app's consent screen and connected apps)
names it by **one rule**, from three sources: the platform operator's **catalogue**, an OAuth client's
**registration**, and the app's own **manifest**, pointed to from its access. This page defines the pointer, the
manifest and the rule.

None of this changes an item, a stream or an eventType. The manifest's JSON Schema is published with the pack:
[`json-schemas/hds-app-manifest.json`](https://model.datasafe.dev/json-schemas/hds-app-manifest.json); it `$ref`s
`defs.json` in the same folder, which a validator loads with it.

## The pointer: `hdsApp = { manifest }`

```json
{ "hdsApp": { "manifest": "https://dysnet.org/hds/app-manifest.json" } }
```

- **A pointer only.** Nothing displayable is stored next to it, so the app can change its words, logo or links
  without new accesses, and no self-asserted name is kept on the access. (A requester with no pointer keeps its own
  name on the person's accept event instead, § The requester behind a relationship.)
- `manifest` is an absolute `https:` URL with no credentials and no fragment, compared after `new URL(x).href`.
  Anything else, the pointer is ignored. The path is the app's choice.
- **No version or hash.** The pointer is fixed when the person consents; a new manifest URL needs a new consent.
  The manifest versions its own content (`formatVersion`).

Where it rides:

| Access | Carrier | Written by |
|---|---|---|
| Plain app access (`/auth`, `requestingAppId`) | `clientData.hdsApp` on the access | the app, in its access request (`clientData`) |
| CMC relationship | `requesterMeta.hdsApp` in the invite; mirrored as `content.hdsApp` on the person's `consent/accept-cmc` event | the implementer, in its invite; the person's app, at accept |

For a CMC relationship the person's app does not write the access: the platform mints it from the offer when she
accepts, with `clientData.cmc` (and `cmc.acceptEventId`, her accept event). The offer itself sits on the
implementer's account, behind a single-use capability consumed by the accept, so it cannot be read afterwards. As
for a data set (`hdsFormSpec`, [CUSTOM-FIELDS-AND-SYSTEM.md](CUSTOM-FIELDS-AND-SYSTEM.md)):

- **before consent**, the person's app reads `requesterMeta.hdsApp` from the offer (through the capability);
- **at accept**, it mirrors it as `content.hdsApp = { manifest }` on her `consent/accept-cmc` event;
- **afterwards**, a reader finds it through `clientData.cmc.acceptEventId` → that event's `content.hdsApp`.

Nothing is written to the access after the fact (an `accesses.update` on a counterparty access sends the peer a
scope update).

## CMC app codes

- **An implementer uses its own app code**, the `appCode` of its manifest, as its CMC `appCode`
  (`requesterMeta.appId`, scope `:_cmc:apps:<appCode>`). `hds-collector` is Health Data Safe's own (the practitioner
  dashboard); an implementer never sends under it, since a catalogue entry cannot vouch for an app code several
  requesters share.
- **One app code carries any number of relationships.** The platform names a relationship by its per-request scope
  (`:_cmc:apps:<appCode>:<sub>`, e.g. one `<sub>` per data set or study), never by its app code. An account may hold
  several app codes (`manage` on each `:_cmc:apps:<appCode>` in its access).
- **A data set is a relationship whose invite carries a form spec** (`hdsFormSpec`,
  [CUSTOM-FIELDS-AND-SYSTEM.md](CUSTOM-FIELDS-AND-SYSTEM.md)), whatever its app code. Two exceptions: an older
  `hds-collector` accept without a mirrored spec is read as a data set; an HDS bridge's grant (`hds-bridge-*`) never
  is.
- **Every person's app that accepts an invite must mirror** `hdsFormSpec` and `hdsApp` onto her `consent/accept-cmc`
  event (`hdsApp` as above, `hdsFormSpec` as in CUSTOM-FIELDS-AND-SYSTEM.md), an account app's accept page included:
  the platform copies neither, and an accept without the spec is not read as a data set. An invite with no `hdsApp`
  also gets `requesterName` (§ The requester behind a relationship).
- **A reader never relies on `clientData.cmc.appCode` alone**: the platform copies `requesterMeta.appId` to it
  unchecked. Only the counterparty, which the requester's core stamps, binds a CMC relationship to an app (§ The
  catalogue vouches).

## The manifest (`format: "hds-app-manifest"`)

Served by the app, publicly, as JSON, **with `Access-Control-Allow-Origin: *`** (HDS apps read it from the
browser; without the header every read fails and the app is shown by its id).

```json
{
  "format": "hds-app-manifest",
  "formatVersion": 1,
  "appCode": "dysnet-registry",
  "name": { "en": "DysNet", "fr": "DysNet" },
  "description": { "en": "The online dysmelia community", "fr": "La communauté en ligne de la dysmélie" },
  "icon": "https://dysnet.org/hds/icon-256.png",
  "provider": { "name": { "en": "DysNet (dysnet.org)" }, "url": "https://dysnet.org/" },
  "open": { "web": "https://dev.dysnet.org/", "ios": "https://apps.apple.com/app/id0000000000", "android": "https://play.google.com/store/apps/details?id=org.dysnet" },
  "privacy": { "en": "https://dysnet.org/privacy", "fr": "https://dysnet.org/fr/confidentialite" },
  "support": "https://dysnet.org/contact"
}
```

| Field | Required | Meaning |
|---|---|---|
| `format`, `formatVersion` | yes | `"hds-app-manifest"`, `1`. A reader reads version 1 only; any other is treated as no manifest |
| `appCode` | yes | The app's id, at most 100 characters: its `requestingAppId` (plain access) or its CMC `appCode` (`requesterMeta.appId`). A manifest whose `appCode` is not the access's is ignored |
| `name` | yes | Localized (`en` required and non-empty, as the pack's `localized`); an empty name makes the manifest unreadable |
| `description` | no | Localized. The app's standing description; the consent message of one request stays `clientData["app-web-auth:description"]` |
| `icon` | no | https, a raster image (PNG, JPEG, WebP; no SVG), at most 2048 characters |
| `provider` | no | `name` (localized), `url` (https) |
| `open` | no | `web`, `ios`, `android`: https links to open the app. No origin rule: a reader shows each link's host |
| `privacy` | no | Localized https links to the app's privacy notice |
| `support` | no | https link to contact the app |

Every link is a lowercase `https://` URL with a host and no credentials; a reader drops any other. Unknown fields are
ignored. A reader never fails on a manifest: anything it cannot read, it treats as none.

Field names map to an OAuth 2.0 client's metadata (RFC 7591), so a registration can point at the same manifest
later (`appCode` = `client_id`): `name` → `client_name`, `open.web` → `client_uri`, `icon` → `logo_uri`, `privacy` →
`policy_uri`, `support` → `contacts`. The manifest keeps HDS's `{ en, fr }` maps, not `client_name#fr` tags.

## The catalogue vouches

The operator's catalogue (`apps/list.json`, `partnerApps[]`) vouches for an app. An entry may carry:

- `manifest`: the exact manifest URL it vouches for;
- `counterparty` (`grant: "cmc"`): the implementer's account, `{ "host": "…" }` or `{ "username": "…", "host": "…" }`.
  The platform binds a CMC relationship to its counterparty (the requester's core stamps it, and the accept is
  delivered there), so a vouched CMC display also requires `clientData.cmc.counterparty` to match. **An entry
  without `counterparty` never vouches for a CMC relationship** (its app code is a claim, § CMC app codes): an
  implementer used by many accounts (a practitioner app) has no one counterparty, so its relationships are
  `unvouched`, named from its manifest;
- the fields to show (`name`, `description`, `icon`, `urls`, `provider`), which override the manifest's.

**When vouching, the operator copies name, description and icon into the entry.** A vouched app is then never
fetched; its manifest is its proposal to the operator. A field the entry leaves out is taken from the manifest only
when the access's pointer equals the entry's `manifest`.

## The rule: how an app is named

First match wins.

| Trust | When | Shown |
|---|---|---|
| `vouched` | A catalogue entry matches by `id` / `appCode`, and for CMC the entry has a `counterparty` that matches, whatever the pointer | The entry's fields, gaps from the manifest as above; icon; Open links |
| `registered` | An OAuth client's operator-curated registration | Its `client_name`, `logo_uri`, `client_uri` |
| `unvouched` | A readable manifest, no entry, no registration | **Before consent** (the consent screen): the raw id as the heading, then "calls itself “name” · not listed by Health Data Safe · `host`". **After consent** (lists of connections and apps): the manifest's name, with "not listed by Health Data Safe · `host`". Never its icon (initials); never framed; each Open link with its host |
| `none` | Nothing readable | The raw id, access name or counterparty username |

`host` is the manifest URL's full host, never shortened to its registrable domain (a shared host such as
`*.github.io` is not an identity). Nothing in the rule blocks an app; it only says where the words come from.

**Residual risk.** `requestingAppId` is self-asserted: an app can copy a vouched app's id and pointer and get its
display. It cannot change the words or the Open links, which lead to the real app. CMC relationships are bound by
`counterparty`, and only an entry that names one vouches for them; for plain accesses the bound path is an OAuth
registration.

## The requester behind a relationship

The rule names apps. When it gives `none` (no catalogue entry, no registration, no manifest: a practitioner's
invite, sent with Health Data Safe's own `hds-collector`, typically, or a bridge's), the relationship is named after
the requester who sent it:

- **before consent**, by the invite's `requesterMeta.displayName` (read through the capability), else the
  counterparty username;
- **at accept**, the person's app mirrors that name as `content.requesterName` on her `consent/accept-cmc` event, only
  when the invite carries no `hdsApp` at all, valid or not (an invite that points at a manifest is an app, named by
  the rule, and no self-asserted app name is kept). Control and format characters (bidi overrides, zero-width
  characters) become spaces, runs of whitespace one space, and the result is trimmed; an empty name or one over 100
  code points is not written;
- **afterwards**, a reader names the relationship by `content.requesterName` on its accept event (through
  `clientData.cmc.acceptEventId`), cleaned the same way, else by the counterparty username. When one counterparty
  holds several relationships, the name on the most recent accept carrying one (`acceptedAt`) names them all.

The name is self-given, exactly as trustworthy as the invite screen that showed it before consent: it never vouches
for anything, a name the rule or the operator gives (a vouched app, Health Data Safe's support account) wins over it,
and a reader never shows it as the only identity: where the requester is described (a contact's details), the
counterparty username is shown alongside. Relationships accepted before an app mirrored it keep the username.

## Reading a manifest

- Fetch once per session, with `credentials: 'omit'`, `mode: 'cors'`, `referrerPolicy: 'no-referrer'`,
  `redirect: 'error'`, a 5 s timeout and a 64 KB cap; a JSON content type.
- Fetch only when no catalogue entry supplies the fields. An unvouched app's manifest is read from the person's
  device (her IP and the time she opens her app reach the implementer she connected to); a vouched one never.
