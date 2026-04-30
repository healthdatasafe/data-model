# Tags root (deferred design — Plan 46 §2.9)

> **Status:** Architectural reference for a future plan. **Not implemented in v1.** No data-model entries, no lib code, no UI. This document captures the design so a follow-up implementation can pick it up without re-litigating it.

## Concept

A separate root stream `tags/`, structurally orthogonal to the canonical item-bearing roots (`treatment/`, `procedure/`, `medication/`, `note/`, …). Tags live **only in `event.streamIds[1..]`** — never as `streamIds[0]`, so they don't interact with the [context-via-substream resolution rule (D3)](./TREATMENT-PROCEDURE.md#context-via-substream-resolution-d3).

```
tags/
  hds/                              ← controlled vocabulary, defined by data-model
    hds-fertility
    hds-oncology
    hds-mental-health
    …                               ← extended via data-model releases
  user/                             ← per-account custom, free-form
    user-housekeeping
    user-private
    …                               ← user-defined per HDS account
```

Two namespaces inside `tags/`:

- **`tags/hds/*`** — controlled vocabulary published in `data-model`. Stable across accounts; consumable by tools that need to filter by canonical clinical-domain or operational concept.
- **`tags/user/*`** — per-account, user-defined. Free-form. Persists in the user's stream tree.

## Constraints

- An event's `streamIds[0]` is the D3 context home (or canonical itemDef streamId). Tags never appear there. Resolution and timeline grouping ignore the tag entries.
- Tags are additive; there is no upper limit. Per-event arrays remain small in practice (handful of tags).
- `tags/hds/*` namespace mirrors the cross-tree clinical-domain suffix convention (`*-fertility`, `*-oncology`, …) where helpful, so a query "all events tagged hds-fertility" lines up with the existing context-streamId vocabulary used by D3.

## Use cases

- **Cross-cutting filtering.** "Show me all events tagged `tags/hds/fertility`" finds treatments + procedures + medications + notes in one query, regardless of which canonical root each lives under.
- **Contextualisation.** Annotate a `medication-intake-coded` event with `tags/hds/fertility` to mark "this medication was for fertility purposes" without inventing a `medication-fertility-*` itemDef.
- **Granular permission scopes.** "Share this account with Dr. X but exclude `tags/user/private` events" — a permission rule keyed off tag membership.
- **Workflow signalling.** `tags/user/triage`, `tags/user/follow-up` for personal organisation.

## Why deferred

Plan 46 v1 ships:
- Data-model `treatment-*` / `procedure-*` itemDefs + streams.
- D3 resolution mechanic (forEvent walk-up + eventTemplate context).
- STORMM SNOMED-CT seed in datasets-service.
- hds-forms-js context threading.

The `tags/` design is ready in spec but the build-out is non-trivial and orthogonal to the Plan 46 critical path:

- **`hds-lib-js`** — read/write helpers (`event.getTags()`, `eventTemplate({ tags })`), tag-stream registration in `HDSModel`, optional `streamIds[1..]` semantics in resolution.
- **`hds-forms-js`** — form-section tag input field type, prefill against tag membership, submit logic to merge tags into `streamIds`.
- **`hds-webapp`** — settings UI for managing `tags/user/*`, filter UX, visual distinction in the stream tree.
- **Permission system** — scope rules that consume tag membership (tied to Pryv access permissions, not strictly within data-model).
- **Vocabulary curation** — what canonical `tags/hds/*` ships? At minimum `hds-fertility` to mirror the v1 context streamIds.

Folding all of that into Plan 46 would have doubled its scope. A dedicated future plan implements `tags/`.

## Cross-event annotation (related, also out of scope)

Attaching a note to a *specific* `treatment-coded` event (vs. tagging the broad fertility context) is a different mechanism — Pryv's event `references` field — and is also deferred. See Plan 46 §2.10.

## When to revive this design

- A consumer (form, bridge, webapp filter, permission policy) explicitly needs a cross-cutting axis that `streamIds[0]`-as-context can't express.
- Multiple contexts apply to a single event (e.g. a chemotherapy treatment that's both `tags/hds/oncology` and `tags/hds/fertility-impact`). D3's length-1 streamIds rule rejects this; tags would express it.
- Granular permission scopes become a concrete demand (sharing accounts with selective opt-outs).

Until then, single-context-via-substream (D3) is sufficient and keeps the model surface small.
