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

## `profile-addresscountry` vs `profile-birthcountry`

Both use `contact/country`, and they are different facts: where the person lives now, and where they were
born. Birth country is fixed; address country is `once` only because the model keeps the current value
rather than a relocation history. A study needing residency history should not read this item.

## Known gap

The stream `profile-location` is declared in `definitions/streams/profile.yaml` but carries **no item**
and is referenced nowhere else in the repo. It is either a placeholder for work never done or a leftover.
Removing a published stream is a published-surface change, so it is recorded here rather than dropped.

## Sensitivity

Most items here are **directly identifying** (`profile-name`, `profile-surname`, `profile-date-of-birth`,
`profile-avatar`) or **GDPR Article 9 special-category** (`profile-ethnicity`, collected for
health-equity monitoring; `profile-reproductive-stage`, which is health data). The country items and
`profile-display-name` are neither on their own, though they are identifying in combination.

Leaf streams exist per fact precisely so an authorization can grant a display name without granting
ethnicity or date of birth. Do not widen a request to the `profile` root when a leaf will do.
