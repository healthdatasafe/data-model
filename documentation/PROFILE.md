# Profile — durable facts about the person

How the HDS `profile-*` items map to external systems, and what belongs in this domain.

`profile` holds **durable identity and demographic facts**: who the person is, rather than anything
observed or measured about their health. It is the one domain whose items are mostly `repeatable: once`,
because the latest entry wins rather than accumulating a history.

It is distinct from:

- **`body-*`** — physiological measurements. Weight is `body-*`, sex is `profile-*`.
- **`family-*`** — facts about the household rather than the person.
- **`lifestyle-*`** — health-related behaviours, which change and keep a history.

## Items

| item | eventType | type | repeatable |
|---|---|---|---|
| `profile-name` | `contact/name` | text | once |
| `profile-surname` | `contact/surname` | text | once |
| `profile-display-name` | `contact/display-name` | text | once |
| `profile-date-of-birth` | `date/iso-8601` | date | once |
| `profile-sex` | `attributes/biological-sex` | select | once |
| `profile-ethnicity` | `attributes/ethnicity` | multi-select | once |
| `profile-birthcountry` | `contact/country` | text | once |
| `profile-addresscountry` | `contact/country` | text | once |
| `profile-avatar` | *(varies, see below)* | picture | once |
| `profile-reproductive-stage` | `attributes/reproductive-stage` | select | **any** |
| `other-name` (root `other-names`, not under `profile`, 4.47.0) | `contact/other-name-v1` | composite | **unlimited** |

## Three things that surprise readers

**`profile-name` and `profile-surname` share one stream.** Both sit on `profile-name`. That is legal and
deliberate: the storage identity is the `streamId:eventType` **pair**, and the two carry different
eventTypes (`contact/name`, `contact/surname`), so `findItemForEvent` resolves each unambiguously. Two
*active* items may never share the full pair, and the loader throws if they do.

**`profile-avatar` has no item-level `eventType`.** It declares `variations.eventType` instead, the same
mechanism `body-weight` uses to offer kg or lb. The loader registers one index entry per variation, and
throws if an item declares both an `eventType` and a variation. An absent `eventType` on such an item is
therefore correct, not missing.

**`profile-reproductive-stage` is `repeatable: any`, not `once`.** It is the one item here that is a
durable-but-changing fact rather than a fixed one: a new dated entry is recorded whenever the stage
changes, and the history is the value. It selects the reference band for stage-dependent hormones
(estradiol, FSH, prolactin), which is why the date matters. Hormone therapy is recorded separately as a
medication and is not encoded here.

## Other names (4.47.0)

A usage name, a name at birth, a former name, her full official name or a nickname: the item `other-name` on
`contact/other-name-v1`, `type: composite`, `repeatable: unlimited` (several hold at once, unlike the `once` items
above). Closed object, FHIR HumanName: `given?`, `family?` (at least one), `use?` (`official`, `usual`, `maiden`,
`old`, `nickname`). A missing part is her profile's: an other name `{ family: 'MARTIN', use: 'maiden' }` reads as her
profile's given name with MARTIN. `time` is when she recorded it; no period. She changes one by update and removes it
by delete; a trashed one never matches.

| Stream | Name | Item | eventType |
|---|---|---|---|
| `other-names` (root, **`explicitGrantOnly`**) | Other names | `other-name` (`type: composite`) | `contact/other-name-v1` |

**Not under `profile`.** A birth name or a former name can say a marriage, a divorce or a change of gender. Under
`profile` every grant on the root, and every `*`, would read it; `explicitGrantOnly` is allowed on a root only
([GENETICS.md](GENETICS.md#explicitgrantonly)), so it has a root of its own, and, once the sweep below is done, an
access reads it only when it names `other-names`. The root is not named `profile-other-names`: in a list of grants, a
`profile-` id reads as a child of `profile`.

**What reads it.** Her own app, to recognise her documents: an `is-this-yours` question is answered without a tap when
the printed name is her profile's or one of her other names, `nickname` (or a `use` her app does not know) apart
([CONVERSATION.md § R3](CONVERSATION.md#rules)). The contact that asks never reads it and never learns which name matched.
After she confirms by hand a document whose name matched none, her app may offer to save that name here, never
automatically.

**No `fhir` block.** `Patient.name` is exported from `profile-name` and `profile-surname`; no SMART scope reaches the
root.

**Before the first write**, in this order (an access minted with `*` covers a stream created later,
[GENETICS.md § Before the first write](GENETICS.md#before-the-first-write)):

- **(a)** every minter of `*` accesses loads a pack of 4.47.0 or later, so it masks the new root: app-web-user-account
  (`maskExplicitGrantOnly`), hds-mcp-js and hds-lib's CMC `*` expansion;
- **(b)** then the `*` accesses of the production cores ch1 and us1 are swept with `mask-star-accesses`, each getting
  `{ streamId: 'other-names', level: 'none' }` (or re-minted); demo stays unswept, as for `genetics`. The sweep is
  recorded in GENETICS.md § Before the first write when it is done;
- **(c)** only then may hds-webapp ship the screen that writes other names, or "Remember this name".

Until (b) is done, an existing `*` access would read the root, so neither this page nor the root's description says
otherwise; the description gains its consent-screen promise after the sweep, as `genetics` did (3.43.1).

## `profile-addresscountry` vs `profile-birthcountry`

Both use `contact/country`, and they are different facts: where the person lives now, and where they were
born. Birth country is fixed; address country is `once` only because the model keeps the current value
rather than a relocation history. A study needing residency history should not read this item.

## Account preferences: `profile-preferences`

hds-lib `HDSProfile` keeps the account-level preferences (`settings/preferred-locales`, `settings/timezone`,
`settings/date-format`, `settings/unit-system`) on the stream `profile-preferences`, under `profile`. They are
settings, not items, so the stream carries **no item**. It is declared here (3.50.0, B-2026-11-12-3) so that a
grant on it places it under `profile`: consent provisioning creates only the streams the model knows, and
otherwise the core created it from the permission's `defaultName` at the root of the account (a practitioner's
invite asks `read` on it for the patient's time zone, doctor-dashboard `withPatientTimeZonePermission`).

## Not modelled: emergency contacts, trusted person, advance directives

A national record's profile summary (France's Mon espace santé, site-agents#61 to #63) also lists emergency contacts, a
trusted person for health decisions (*personne de confiance*), whether the person wrote advance directives, and an
organ donation statement. **None of them is a profile item** (decision 2026-11-23):

- **Emergency contacts and the trusted person** are another person's name, relationship, phone and address. The
  model keeps contact details out (site-agents#4: phone and email are account- or app-level, not clinical facts), and
  it holds no structured contact details of a private third person (care providers are on `encounter-provider-*`).
  An importer leaves them in the source document and tells the person; a document the person stores, such as an
  emergency card, may name them.
- **Advance directives and organ donation** are documents: store the document itself under the document kinds
  `advance-directive` and `organ-donor-card` (`definitions/documentKinds.yaml`, DOCUMENTS.md), and an emergency card
  under `emergency-card`. A summary line that only says "advance directives: yes" or "informed about organ donation",
  with no document, is not stored.

Reopen with a specific case (a reader that needs a status without the document), not by adding an item for a
summary line.

## Known gap

The stream `profile-location` is declared in `definitions/streams/profile.yaml` but carries **no item**
and is referenced nowhere else in the repo. It is either a placeholder for work never done or a leftover.
Removing a published stream is a published-surface change, so it is recorded here rather than dropped.

The `profile` root's consent `description` (4.9.0) deliberately does not mention it. If an item is ever filed on
`profile-location`, or a finer address item on `profile-address`, re-read that description: test `[STRL-3]` only
catches a change in the root's direct children.

## Sensitivity

Most items here are **directly identifying** (`profile-name`, `profile-surname`, `profile-date-of-birth`,
`profile-avatar`) or **GDPR Article 9 special-category** (`profile-ethnicity`, collected for
health-equity monitoring; `profile-reproductive-stage`, which is health data). The country items and
`profile-display-name` are neither on their own, though they are identifying in combination. The account
preferences on `profile-preferences` (language, time zone, formats) are neither identifying nor Article 9, but a
read grant on the `profile` root reaches them too.

Leaf streams exist per fact precisely so an authorization can grant a display name without granting
ethnicity or date of birth. Do not widen a request to the `profile` root when a leaf will do.
