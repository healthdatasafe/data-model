# Changelog

## [4.32.0] - 2026-11-24

Plan 141 (site-agents#67). Additive.

- **Item `fertility-cycles-chart-stamp`** on the new stream of that name under `fertility-cycles` and the new eventType
  `fertility/chart-stamp-v1` (`{ method, stamp }`): the stamp put on one day of a stamp-based chart (Creighton, Billings),
  as charted; `stamp` is one of `red`, `green`, `green-baby`, `white-baby`, `yellow`, `yellow-baby`. Chart notation, never a
  fertility verdict. `type: imported`, `repeatable: P1D`, no `fhir` block. **Consent:** stream permissions are recursive, so
  an app holding `fertility` or `fertility-cycles` also receives it. MENSTRUAL-CYCLE.md § Charted stamp; tests `[CYC-STAMP]`.
- **Document kind `menstrual-cycle-chart`**, the first of the new section `documentKinds.detailKinds`: the class and type of
  `other-patient-record` plus `detail`, a Coding of `https://hds.ngo/fhir/CodeSystem/document-kind`, the second entry of a
  document's `type`. `documentKinds.kinds` is unchanged (45). A reader of `kinds` alone (hds-lib before
  `documentKinds.codingsFor`) never offers it and reads a chart as `other-patient-record`. DOCUMENTS.md § Document kinds;
  tests `[DKND-8]`, `[DKND-9]`.
- `type: imported` also covers an object entered in a control made for that item alone.

Build check and documentation; the published pack is unchanged by these:

- **PARTIAL-DATES.md and FHIR-MAPPING.md § Time name the allergy exceptions** (B-2026-11-21-7): with `unknown`, an
  allergen item (`allergy-coded`, `allergy-basic`) renders no `onset[x]` (not a `data-absent-reason`), an import with no
  readable onset date writes `unknown` and is not refused for it, and the two items are in the list of items that may
  carry `unknown` (since 4.21.0); a "no known allergy" never does. As ALLERGY.md and hds-fhir-js already had it.
- **FHIR-MAPPING.md § Time, a laboratory result or US Core screening answer known only to the month or the year**
  (B-2026-11-23-15): exported with that date and without its US Core profile claim (us-core-1), not refused.
- **PARTIAL-DATES.md, `approx` in FHIR**: the year and a note, as FHIR-MAPPING.md and hds-fhir-js have it; the row said
  `onsetString` / `performedString`.
- **Two eventTypes of one FHIR block never share a unit written with other powers of ten** (B-2026-11-23-14): the
  `distinctUnits` build check reads `ug/L` and `ng/mL`, or `10*9/L` and `10*6/mL`, as one unit (`ucumUnitKey`), as
  hds-fhir-js `sameUcum` does on import. No block of the pack is affected. FHIR-MAPPING.md § Import states the rule.

Plan 138: a place for more languages. No text is added: the pack is unchanged.

- `definitions/l10n/{locale}.json`: reviewed translations (`es`, `it`, `pt`, `pt-BR`) added by the build, checked against the
  English they translate (`documentation/L10N.md`). Converter packs stay frozen: their texts go to
  `converters/{key}/l10n-{locale}.json`.
- `json-schemas/vocabulary.json` and `documentKinds.json`: labels accept `pt` and `pt-BR` (vocabularies also `de`, `it`).

## [4.31.0] - 2026-11-23

Plan 133 (FHIR after plan 115, Part A): the FHIR mapping of the lab results with no item of their own. Additive in
the pack; the SMART grant table widens (below).

### Added: FHIR blocks on `body-blood-coded`, `body-urine-coded` and `body-csf-coded`

- **Code source `{ from: concept, field }`** (Observation only): the content's labelled concept `{ label, codes }`,
  its codings as stored, `label.en` as text. **Value kind `lab-result`** (no fields): the value read from a
  `lab-result/coded-v1` content. The two go together (build check), on `lab-result/coded-v1` and its `analyte` only;
  the eventType's properties must be the ones the kind reads, so a property added later fails the build.
- The three items render as `Observation|laboratory` (US Core and IPS lab profiles when the analyte has a LOINC
  coding), as BLOOD-CHEMISTRY.md § The three items, Cross-system, now states it in full: the printed result of a
  semi-quantitative result in the `printed-result` extension, the UCUM code itself as `unit` when there is no
  `unitText`, the item key as `meta.tag`.
- **No import key:** a concept-coded item is never matched by code or category; the importer names the item (the
  specimen) or reads it from the `meta.tag` of an HDS export (FHIR-MAPPING.md § Import). `checkFhirImportKeys` skips
  the source.
- Tests `[FHIR-LABC-1]` to `[FHIR-LABC-5]`; `[FHIR-SCOPE-11]` counts 140 lab blocks on 130 streams.

### Changed: SMART grant table and consent text

- `pack.fhirScopes['Observation|laboratory']` gains the three streams (lock updated with `npm run fhir:lock`), so a
  laboratory grant covers infectious serology, viral loads and drug levels. Their stream `label` and `description`
  (en, fr) say so on the consent screen (perki, 2026-11-23).
- **Release order:** hds-fhir-js that renders the source and the kind, then this pack, then the facade re-pin, then
  each core's extension re-pin, where the scope widens; never the pack ahead of the renderer (FHIR-MAPPING.md §
  Forward compatibility). A concept block admits no `alsoMatch` or `alsoMatchCategories`, its item no LOINC
  ownership; the build pins every key of `lab-result/coded-v1`, at every level, and the comparator enum (`[FHIR-LABC-4]`,
  `[FHIR-LABC-6]`).

## [4.30.0] - 2026-11-23

Data-model gaps reported through the HDS MCP (site-agents#54 to #63). Additive: one unit option on three items, a
verified-codes table, docs; no new item, stream or eventType; a minor release.

### Added: counts per mm³ on WBC, platelets and RBC (site-agents#60)

French reports print counts per mm³, which is per μL (1 mm³ = 1 μL).
- `body-blood-cbc-wbc`, `body-blood-cbc-platelets` and `body-blood-cbc-rbc` move from an item-level `eventType` to
  `variations.eventType`: their unit stays option 1 (10⁹/L, 10⁹/L, 10¹²/L), **`concentration/count-ul`** is option 2,
  same LOINC per option. Factors: × 1000 (WBC, platelets), × 10⁶ (RBC), exact. FHIR exports the count in UCUM `/uL`.
  Stored events keep resolving: the `streamId:eventType` pair of option 1 is the old one. **Consumers:** the three
  items no longer carry a top-level `eventType`, so a writer picks the option (hds-lib `eventTemplate()` needs an
  explicit choice). Only a full count per mm³ goes to option 2: a scaled count (6,5 10³/mm³) is option 1's number.
- Every `count-ul` option (the eight `-count` items too) is labelled "/μL (/mm³)".
- Tests `[LAB60-OPT-1]`, `[LAB60-CNV-1]`, `[LAB60-LBL-1]`, `[LAB60-FHIR-1]`.

### Added: verified codes for frequent coded results (site-agents#54 to #59)

BLOOD-CHEMISTRY.md § Verified codes for frequent coded results: 27 LOINC codes, checked in loinc-db (LOINC 2.83), for
results that importers kept aside for want of a code: indirect bilirubin, prealbumin, the serum protein electrophoresis
fractions (% and g/L), the albumin/globulin ratio, the CD3, CD4 and CD8 lymphocyte subsets (% and count) and the
CD4/CD8 ratio. They stay `lab-result/coded-v1` results, as the long-tail and derived-index rules already said; no item
is added. A coded percentage is stored as printed, never as a fraction; ratios are written `{ratio}`. Test
`[LAB54-TBL-1]` keeps the table's codes valid and owned by no item.

### Docs: emergency contacts, trusted person, advance directives (site-agents#61 to #63)

PROFILE.md § Not modelled: emergency contacts and the trusted person are a third person's contact details, kept out;
advance directives and organ donation are stored as documents (`advance-directive`, `organ-donor-card`).

## [4.29.0] - 2026-11-22

Plan 128 (HDS Reader reading coverage, package 7). Additive: two items, three streams; no new eventType.

### Added: total PSA and urine creatinine

Two analytes a hospital report prints often and the model had no item for (they went to `lab-result/coded-v1`):
- **`body-blood-serum-psa-total`** "Total PSA" (stream under `body-blood-serum`), `concentration/ug-l` (ng/mL is the
  same unit), LOINC `2857-1`, SNOMED CT `63476009` *Prostate specific antigen measurement*. Total PSA only: free PSA
  (`10886-0`) and the free/total ratio (`12841-3`) stay coded.
- **`body-urine-chemistry-creatinine`**, in a new group **`body-urine-chemistry`** ("Urine chemistry" / "Chimie
  urinaire") under `body-urine`, beside `body-urine-hormones`: a spot urine concentration, `concentration/mg-dl`
  (LOINC `2161-8`) first and `concentration/mmol-l` (`14683-7`) second, with the molar-mass factor mg/dL → mmol/L
  0.0884 (113.12 g/mol); SNOMED CT `271260009` *Urine creatinine measurement*. Any timed collection stays coded: the
  24-hour rate (`2162-6`, `14684-5`) and the 24-hour concentration (`20624-3`, `25886-3`).
- Codes checked in loinc-db (LOINC 2.83, ACTIVE, property and system) and snomed-db (20260201, active). Fable review:
  ship with edits, all applied (the group and key, the option order, the label, devNotes, the 24-hour codes).
- The FHIR scope lock gains the two leaf streams, each its own `Observation|laboratory` grant root, like every
  sibling. BLOOD-CHEMISTRY.md § Stream tree.
- **For consumers:** results already stored as `lab-result/coded-v1` under `2857-1`, `2161-8` or `14683-7` are now
  owned by an item and can move to it (BLOOD-CHEMISTRY.md § Moving a result to its item).
- Tests `[LAB429-1]` to `[LAB429-4]`.

## [4.28.0] - 2026-11-22

Plan 133. Additive: one item, one eventType, one code source; no new stream and no new scope key; a minor release.

### Added: "no known allergy" (ALLERGY.md § No known allergy, FHIR-MAPPING.md § No known allergy)

A blank allergy list is not the same as "none", and HDS had no way to say it (an import refused it).
- **Item `allergy-none-known`** (`definitions/items/allergy.yaml`), eventType **`allergy/none-known-v1`**, on the
  `allergy` stream, under the same bare scope key `AllergyIntolerance`: no new consent unit (the scope lock
  acknowledges the item under `allergy`). A composite, `repeatable: unlimited`, no duration. Content
  `{ scope, verificationStatus?, notes? }`: `scope` required, one of `all`, `medication`, `food`, `environment`
  (en and fr labels); `verificationStatus` and `notes` shared with the allergies. The eventType refuses `status`,
  `categories`, `type`, `criticality`, `lastOccurrence` and `reactions`. `event.time` is when the statement was made,
  never an onset.
- **Code source `{ from: enum, field, codings }`** (an `AllergyIntolerance` only): one coding per value of a
  required string enum of the content. The block gives each scope its SNOMED CT code: `716186003`, `409137002`,
  `429625007`, `428607008` (all active in the 20260201 International Edition). The build requires the `codings` keys
  to equal the enum and the `select` field's options, each a SNOMED CT coding, unique, each key `all` or an allergy
  category; it refuses the source on any other resourceType.
- **Checker:** an `AllergyIntolerance` with a code from an enum is a "no known allergy": exempt from the `status`
  rule, checked against its own field set (`ALLERGY_NONE_KNOWN_FIELDS`), and refused if its eventType or composite
  declares an allergen field. The allergen items keep every existing check. Tests `[ALG-NKA-1]` to `[ALG-NKA-7]`.
- **Rendering and import** are hds-fhir-js work, documented here: `code` from the scope, `clinicalStatus` active,
  `recordedDate` the event time, no onset; the "No known allergy first" import rule now places the four codes, the
  retired `160244002` and the IPS no-known codes on the item, and still refuses latex and the other narrower
  concepts, `no-allergy-info`, a contradicting allergen coding and an `inactive` or `resolved` clinical status.
- Docs: ALLERGY.md and FHIR-MAPPING.md no longer say "drug" for the medication scope or "static code" for its code.

## [4.27.0] - 2026-11-21

Plan 128. Additive: one notice code; no schema, item, stream or alert-kind change; a minor release.

### Added: the notice `ready` (CONVERSATION.md § Notice and error codes)

perki's live test: a new connection's chat was empty, so she did not know what to do with it. A contact that reads
documents now tells her once, right after it receives her accept, that it is ready to read the documents she shares
in the conversation (notice `ready`, no `about`).
- **Once per relationship.** A contact that starts sending it later sends it once to each relationship it already
  has. It deletes its alert copies within 24 h (R10), so it keeps a marker per relationship (the relationship id and
  the fact, nothing else) until the relationship ends.
- **Rendering.** Her app renders it at its place in time (first in a new relationship), as a fixed text with the
  contact's name. For a `vouched` app it adds the app's catalogue or manifest `description`; an unvouched description
  is never shown. en and fr examples are given. No text of the contact's travels (R6, R12).
- Optional; listed in § The flow (before the steps) and in § What a counterparty implements. Test `[CNV-DOC-9]` registers it.
  Reviewed by Fable: "ship with listed changes", all applied.

## [4.26.0] - 2026-11-21

Plan 128. Additive: one conversation kind, two question codes, one notice code, a basis value, two
answer fields, three `clientData` keys; no item, stream or alert-kind change; a minor release.

### Added: a document's date and kind, asked in the conversation (CONVERSATION.md, DOCUMENTS.md)

perki: the import form no longer asks Day and Kind. The document sits on her timeline at the moment she added it, as
"Other document", until she confirms the date and kind a contact proposes in the chat.

- **The placeholder** (DOCUMENTS.md § A document waiting for its date and kind): kind `other`, `time` the moment she
  added it with no precision, and `clientData.hdsDocumentPending: ['time', 'kind']`. Readers show "date not confirmed"
  and "Other document"; the FHIR rendering omits `date` while `time` is pending (FHIR-MAPPING.md). Any write that sets
  a field removes its entry. One sentence of exception to "never the upload date".
- **`proposed-document`**, a new kind on `received`: `proposal` with a `documentKind` (a `documentKinds` key) and/or a
  date (`time`, `timePrecision` day, month or year, never unknown), `status` clear or check, optional `anchor` and
  `extraction` (no vouching: only a key and a date reach the document, on her tap). At most one open per contact and
  document, and only onto a document whose `hdsDocumentPending` holds a proposed field, so an older app never gets one.
- **A stale flag** (an older app set the date or kind and left the flag) is recognised and ignored: `time` is pending
  only without `hdsTimePrecision`, `kind` only while the kind is still `other`.
- **Two question codes**, `which-document-kind` (2 to 8 kind keys) and `which-document-date` (`context.dates`), each
  naming its `proposed-document`; neither writes nor triggers a re-proposal.
- **§ Writing a document's date and kind**: one `events.update` of the document, only the fields still pending (the
  first confirmation wins, her own edit is never overwritten). Her answer lists the fields in the new
  `answer.applied` (`time`, `kind`), never in `written`, which stays the list of values to delete on `not-mine`. When
  nothing is pending any more, her app answers `skip` with the new `basis: not-pending`.
- R2, R3, R5, R8, R9 and R10 say how the new kind is counted, checked, kept and deleted. The `proposed-values` alert is
  reused as its wake-up. A contact does not wait for it, nor for the two document questions, to post `done`, and does
  not count them in `task-status.counts`.

### Added: her note on an answer (CONVERSATION.md § Her note)

perki's one-by-one conversation: she may comment on what she answers. `answer.note`, plain text, at most 1000
characters, on any action (a comment alone is a `skip` with a `note`, with every effect of a skip). It never changes
the action, travels in no alert (R6), is never echoed, and her app removes it after `done`, or 24 h after the answer
when the work was already done, on `not-mine` or on unshare (R10). New notice `note-not-read` (about the document,
once per document) for a contact that does not read notes.

### Added: a document's values, `hdsDocumentValues` and `hdsPrintedIn` (PROVENANCE.md)

perki: the document lists the values tied to it, those read from it and, apart, those she already had that it prints
("listed, but not as the original source"). Shape chosen on Fable's review, so that no contact the document is shared
with learns which older events of hers match (4.25.0's "never which event" holds):

- **`clientData.hdsDocumentValues`** on the document: `{ <value event id>: "source" }`, the values written from it.
  An index, not the link (`related` on the value stays authoritative), written by her app best effort after the
  answer. Its ids are already in her answers' `written`, so its readers learn nothing new.
- **`clientData.hdsPrintedIn.<document event id>: true`** on a value she already had, written by her app when an
  automatic `duplicate` matches it. Not its source; the document's view finds them with one `clientData` query.
- Dangling ids are skipped by readers and dropped on the next write; `not-mine` removes both. The `related` rule now
  names the index.

### Added: specimen codes (CONVERSATION.md § Specimen codes)

The options of `which-specimen` are registered with en, fr and es labels: `serum-plasma`, `whole-blood`,
`citrated-plasma`, `rbc`, `urine`, `urine-24h`, `semen`, `csf`, `stool`, `saliva`.

### Published

`json-schemas/hds-document-pending.json`, `hds-document-values.json` and `hds-printed-in.json` (source
`src/schemas/clientDataKeys.js`). Tests `[CNV-*]`: the new kind under draft-04 and draft-07, the MUST rows, the
examples, the specimen table and both keys.

## [4.25.0] - 2026-11-21

Additive (plan 128): the conversation's automatic `duplicate`, a printed sampling time, and a self-contained document
anchor. One enum value and two optional fields; no item, stream, alert or `fhir` change; a minor release.

### Added: `basis: existing-value`, a value she already has (CONVERSATION.md, plan 128)

perki, on a cumulative report read per column: "You should be able to process a multi day report (and skip duplicates)".
A cumulative report repeats days already read from earlier reports, and the contact cannot see her record (D17).

- **What her app does.** It answers `duplicate` itself, `basis: existing-value`, for proposed values already in her
  record. One answer per comparison run (`inReplyTo` the first matched, `candidateIds` all), no tap.
  - Any contact's proposals, never one contact's only.
  - Only proposals she could confirm (vouched engine, R9), and only while no `is-this-yours` is open or `not-mine`.
  - The disclosure to the contact is stated.
- **What counts as already there**, new § A value she already has:
  - **Same item,** and not written from this document (by `sourceKey`).
  - **Same day,** only at `day` precision. An exact-time event in `[D 00:00 UTC − 14 h, D+1 00:00 UTC + 12 h)`, or on
    day D in its `hdsTimeZone`.
  - **Equal value.** Same type to 12 significant digits, with the comparator. Another type converted into the
    proposal's unit, within half the last printed digit; an unreadable printed value never matches. Coded lab results
    by the same `system` and `code`.
  - **One for one, per document,** with a deterministic tie-break.
- **What she sees.** The value is shown as already in her record and can be added anyway while it exists (until
  `done`). § Answers now says a `written` entry settles for good, otherwise the latest answer that counts, so a later
  `confirm` wins.
- **Writer-MUST rows** split by basis. R3 gains the rule; the `profile-match` normalisation now also ignores commas
  ("DUPONT, MARIE").
- **R5:** a column is part of the record. **R6:** "a time" added. **R8:** an app or contact that does not know the
  basis does not count the answer, which is why contacts read it before any app sends it. **§ minimum:** a contact reads
  it.
- A documented example of the automatic answer.

### Added: `proposed-value.printed.samplingTime`

`HH:MM` (24 h, normalised), display only: the sampling time printed over the value's column on a report with one
column per sampling, so two same-day draws can be told apart. Never the value's time, never over CMC.

### Added: `hdsSourceAnchor.eventId`, a self-contained anchor (PROVENANCE.md)

perki: the anchor "should send the event.id + attachment id of the document, and the zone to highlight <= one module
that can be reused for other purposes".

- `hdsSourceAnchor` gains optional `eventId`, the `file/xds-v1` document; `related` keeps naming it for queries.
- Whoever may read the event and the document finds the zone from the anchor alone.
- One shape for any event pointing at a zone of a document: a value, a note, a conversation item (proposed value
  `anchor`, `is-this-yours` `context.anchor`, which carry the same field).
- Writers set it from 4.25.0. A reader takes the document from `eventId`, else from `related`, and ignores an anchor
  whose `eventId` disagrees.
- Her app sets it on every value it writes from a proposal.
- `message/hds-reader-v1` (superseded) keeps its earlier shape.

### Tests and review

- **Tests:** the automatic `duplicate` per basis; `samplingTime` (valid, and `25:00`, `8h30`, a number rejected; the
  pattern pinned); `eventId` in the anchor and its copies; the documented examples.
- **Fable review, two rounds:** "ship with edits" each time, all taken, except published test vectors for the
  comparison, which live in hds-lib's tests. The second round brought:
  - a MUST row: a conversation anchor carries `eventId` = `about`;
  - R11: an anchor whose `eventId` is not `about` is ignored, and dropped when the value is written;
  - PROVENANCE.md: `eventId` must be a key of `related`;
  - one for one across comparison runs;
  - the cross-type tolerance scaled from the printed unit;
  - the `sourceKey` exclusion for any engine.

## [4.24.0] - 2026-11-21

Additive: two registered conversation codes (plan 128) and two more documented `rememberNever` prompt ids. No item,
stream, eventType, option value, schema or `fhir` block change; a minor release.

### Documented: two more `rememberNever` prompt ids

`rememberNever` (4.23.0) gains two prompt ids (B-2026-11-20-17): `input-method:<item key>` (keep the method chosen in
the entry form of a convertible item other than cervical fluid, such as mood) and `unit:<item key>` (keep the unit
chosen in the entry form of an item with variations), each kept as the item's `preferred-input-` setting on Yes. The
item key is everything after the first `:` and only names the prompt's item; a reader ignores an id whose item key it
does not know. When the person asks for a prompt again, a writer removes only ids of the forms the description names
and keeps every other. `[DSET-SET-2]` validates both forms. Fable-reviewed (clean with edits, applied).

### Added: notice `several-sampling-dates` and error code `reading-failed` (CONVERSATION.md, plan 128)

Two bare HDS codes registered in § Notice and error codes, both met by the HDS Reader on real reports.
- **Notice `several-sampling-dates`** (`about` the document). A cumulative report prints one value column per sampling
  day, and the contact proposes no value from it: nothing proposed, no question, `done` with zero counts, and no date
  in the notice (R6). It is sent instead of `no-result-found`, never with it; it is not `which-date`, which asks for the
  one day all the waiting values share. Until now the Reader sent `no-result-found`, which reads as "no result printed".
- **`task-status.errorCode` `reading-failed`.** The attachment is of a type the contact reads, but fetching or reading
  it failed. The contact retries on its own, and a later `task-status` supersedes the error (R4).
- **Wording tightened on two 4.22.0 codes, meaning unchanged:**
  - `no-result-found`: the read completed and recognised no line; a failed read is `reading-failed`.
  - `no-attachment`: no attachment, or none of a type the contact reads; not retried.
- **Schema and tests.** The alert schema is unchanged: codes were already open patterns, so an app that does not know
  them still shows a generic text (R8). `[CNV-DOC-9]` pins the registered codes, checks that every table row is parsed,
  and validates each code in its alert.
- **Review.** Fable-reviewed ("ship with edits", all taken). The HDS Reader engine switches to the new notice once
  hds-webapp renders it.

## [4.23.0] - 2026-11-21

Additive: two documented `settings/hds-webapp-diary` keys (plan 134); one datasource and one vocabulary for allergy
reactions (plan 133); cervical-fluid converter v1, the Creighton notation as the book's grammar generates it, with one
converter pack per version (plan 131). No item, stream, option value or `fhir` block change; one eventType description
(`source.annotations`). `pack-latest.json` is unchanged (JSON-equal to the pack published before); the converter
index gains `versions`, and cervical-fluid's `latestVersion` becomes `v1`. A minor release.

### Added: `stars` and `rememberNever` documented on `settings/hds-webapp-diary`

hds-webapp's Add data offers ⭐ entries: several items entered together on one page, one event per item filled, all at
the same time (plan 134). `stars`, an array of `{ id, group?, name?, items }`, is now a documented key. `id` is `cycle`
(the app's cycle entry: mucus and vaginal bleeding) or `star-` and 8 base36 characters; `group` is the hds-webapp kind
whose list shows the row (optional; else the app's own for its id, or the kind of the first item); `items` are item
keys of this model, in order (a reader keeps the first 8), and an empty array hides the entry. An app-defined id absent
from the key reads as the app's default, so the key is written only once the person changes something. A ⭐ entry id is
not a card id. The event's description now counts ⭐ entry ids among its values and their names among the labels the
person gave. Documentation only: the shape stays owned by hds-webapp (no `required`, open). `[DSET-SET-2]` validates an
event with `stars` (draft-07 and draft-04). Fable-reviewed (clean with edits, applied).
`rememberNever`, an array of prompt ids, holds the "remember it?" prompts the person declined for good
(`charting-method`: the offer, in an entry form, to make the method of a cervical-fluid observation the person's
charting method). Later is not stored; an id names a prompt, never a value; a reader ignores an id it does not know.
`methodLater`'s description now says it is the set-up's deferral only. The event's description counts prompt ids among
its values.

### Added: allergy reactions, what an entry UI needs to enter them (plan 133)

- **Datasource `manifestation`** (`datasets://manifestation`, result key `manifestations`, value fields `label` and
  `codes`): the coded choices for an allergy reaction's `manifestations[]` (ALLERGY.md § Datasource), served by
  datasets-service 1.4.0. No item field names it.
- **Vocabulary `allergy-reaction-severity`** (`definitions/vocabularies/allergy.yaml`): en/fr labels of
  the binding path `reactions.severity` on `allergy/coded-v1` and `allergy/basic-v1`, FHIR code = the stored value.
- The vocabulary loader resolves a path through an array of objects (`reactions.severity`), not only an array at
  its end. Fable-reviewed (ship with fixes, applied).

### Added: one converter pack per converter version
- `dist/converters/{itemKey}/pack-{version}.json` for every converter version. The pack of converter vN holds each
  method at its newest model version not above vN, and every method carries that `modelVersion`.
- The converter index (`converters` in `pack.json`) lists `versions` per item key. hds-lib 2.60.0 fetches the highest
  one it supports; `latestVersion` is informational.
- `pack-latest.json` is the v0 pack without `modelVersion`, as published before, and stays so: hds-lib before 2.60.0
  fetches only that URL.
- A published pack is frozen: `tests/fixtures/converter-packs.sha256.json` pins each one, and `scripts/deploy.sh`
  refuses a build that changes or drops a deployed `pack-latest.json` / `pack-vN.json`. The build refuses a version not
  named `v<number>`, a converter yaml whose `version` is not its file name, and a model version with no converter
  version of the same name (AGENTS.md §6).
- Cervical-fluid converter **v1** (`converter/v1.yaml`): same dimensions, weights, colours and temperature rules as v0.
  Its pack differs from v0 only by Creighton.

### Added: Creighton model v1
- `models/creighton/v1.json`, a byte copy of model-cervical-fluid `src/definitions/v0/creighton.json`: 106 codes
  from the book's grammar and the practitioner's answers. The 36 codes of v0 keep their vectors. The 70 new codes
  are `produce: false` (offered for entry, never produced by a conversion); 11 of the 36 are `offer: false` (not
  offered for entry, still read and produced). Every option has
  `parts` (its parsed code), and the method has a `notation` block (the rows a picker shows, and the frequency
  annotation X1, X2, X3, AD, required with a code).
- `models/creighton/v0.json` is unchanged (the 36 codes, model-cervical-fluid `tools/creighton-original-v0.json`).

### Changed: `vulva-mucus-inspect/9d-vector` documents `source.annotations`
- `content.source.annotations`, an object of strings: qualifiers of the record in the source method that the vector
  does not carry (Creighton `frequency`). Scoped to `source.key`; written at entry only; a reader that does not
  know it keeps it as is.

## [4.22.0] - 2026-11-21

A conversation between a person and any contact (plan 128): the HDS Reader becomes a standard counterparty, and
the contract is public so a third party can plug in its own. Additive: one root stream, one eventType, five alert
kinds and one published schema; `message/hds-reader-v1` is unchanged and marked superseded.

### Added
- **Stream `conversation-items`** (root, `explicitGrantOnly`, no children in the model, label "Conversation items" /
  "Éléments de conversation"; CONVERSATION.md): two children per relationship created by the person's app, `conv-` +
  12 lowercase base36, name = id, `clientData.hdsConversationItems = { relationship, direction }`: `received` (the
  contact's questions and proposed values, granted `contribute`) and `sent` (her answers, granted `read`). No item in
  the subtree. The third marked root, after `genetics` and `questionnaire`.
- **eventType `message/hds-conversation-v1`**: three closed kinds discriminated by `content.kind`. `question`
  (`about`, `code` as an open code with the six HDS codes registered and `x-<vendor>-` reserved for third parties,
  `candidateId?`, `options?` (codes up to 128 characters, so any item key), `context?` with `identity` and `dates`
  from H2 rev. 2 and `anchor`); `proposed-value` (the reader-v1 `reading` fields without `confidence` and
  `kbEntries`, plus `about`, `replaces?` and a required `extraction`); `answer` (`inReplyTo`, `about`, `action`,
  `candidateIds?`, `option?`, `time?`, `timePrecision?`, `basis?` (`profile-match`), `written?` as
  `[{ candidateId, eventId }]`; no value travels). Only `confirm` / `correct` on a proposed value write a value; an
  answer to a question writes nothing and the contact re-proposes with `replaces`. Every id has the `related` path
  pattern and at most 64 characters.
- **`notification/alert-cmc` kinds `task-status`, `notice`, `question`, `proposed-values`, `answer`**
  (CUSTOM-FIELDS-AND-SYSTEM.md): value-free pointers with fixed localised titles and bodies; their `hds` block is
  published as **`json-schemas/hds-conversation-alert.json`** (source `src/schemas/conversationAlert.js`, draft-04 and
  draft-07).
- **CONVERSATION.md**, normative: the by-reference principle, the children and their grants, the flow, the question
  codes and allowed answers, the writer MUSTs, rules R1 to R12 (child decides the writer, binding and void, the
  automatic `profile-match` answer, never over CMC, dropped lines and identity, fallbacks, proposal and engine checks,
  retention, pointer containment, fixed alert words), how the person's app writes a value (`sourceKey`
  `<engine>:document:<document event id>:<candidateId>`), chat, and the minimum a counterparty implements.

### Changed
- **`message/hds-reader-v1`**: description and HDS-READER.md marked superseded; schema unchanged. GENETICS.md,
  PROVENANCE.md (index row `hdsConversationItems`, the `related` mirror list, the conversation `sourceKey`), README and
  AGENTS updated.

## [4.21.0] - 2026-11-20

Allergies and intolerances (plan 133). Additive: one root stream, two items, two eventTypes, one datasource, an
`AllergyIntolerance` block under a new bare scope key, and two composite field types; no existing key, stream, option
value or `fhir` block changes.

### Added
- **Stream `allergy`** (root, no children; label "Allergies and intolerances" / "Allergies et intolérances") and
  **items `allergy-coded` and `allergy-basic`** (ALLERGY.md): composites, `repeatable: unlimited`, no `duration`
  (time + duration is reserved for an abatement, refused in v1). The coded twin selects its `allergen` through a
  `datasource-search` field (datasource `allergen`), the basic twin takes a `name` as written. Both share one field
  set through YAML anchors: `status` (required select), `verificationStatus`, `categories` (multi-select), `type`,
  `criticality` (selects), `lastOccurrence` (date), `notes`. `reactions` is not a form field (an array of objects, as
  procedure `findings`). event.time is the onset; `status` is stated by every writer, never defaulted;
  `verificationStatus` is never defaulted to `confirmed`.
- **eventTypes `allergy/coded-v1` and `allergy/basic-v1`**, identical but for `allergen` (a datasets-service
  selection with at least one code and a non-empty `label.en`, no `drug.product`) and `name` (non-empty): `status` required (`active`, `inactive`,
  `resolved`), `verificationStatus` (`unconfirmed`, `confirmed`), `categories` (unique, at least one, `food`,
  `medication`, `environment`, `biologic`), `type`, `criticality`, `reactions` (at least one, each with at least one
  manifestation holding a text or a label, `codes` only with a label, `severity` `mild` / `moderate` / `severe`,
  `notes`), `lastOccurrence` (`YYYY`, `YYYY-MM` or `YYYY-MM-DD`, month and day in range), `notes`. Both flavours (draft-04, draft-07).
- **Datasource `allergen`** (`datasets://allergen`, result key `allergens`): substances only in v1. The datasets-service
  kind ships separately; until then the coded item's search returns nothing.
- **`fhir` blocks: `AllergyIntolerance`** (US Core `us-core-allergyintolerance` on `us`, IPS `AllergyIntolerance-uv-ips`
  on `ips`, no `ch`), a **bare scope key** granted on `allergy` (`fhirScopes.AllergyIntolerance: ["allergy"]`, locked).
  No category table: the content `categories` is never a scope category, for good. The coded twin's code comes from
  the datasource, the basic twin's as text: the `{ from: text, field }` code source now applies to an
  AllergyIntolerance too. FHIR-MAPPING.md § AllergyIntolerance has the render and import rules (onset, statuses and
  their systems, refused verification values, reactions, `lastOccurrence` truncation, what is not carried), with the
  import decisions of 2026-11-20: no `clinicalStatus` refused; an out-of-set category, type, criticality or severity
  dropped and reported; an `onsetPeriod` start as the onset, the period in `notes`; the no-known-allergy codes refused
  before placement.
- **Build (`src/fhir.js`, `checkAllergyIntolerance`):** an AllergyIntolerance takes a datasource or text code, no
  category, value, split or dosage, and its item no `duration`; its eventType declares and requires `status` (never a
  nullable form field), and the content the
  renderer reads by name keeps its JSON types and exactly its enums (`ALLERGY_FIELDS`, `ALLERGY_REACTION_SEVERITIES`,
  exported); on a composite each is a field of its type and counts as mapped, and a `reactions` field is refused.
- **Composite field types `datasource-search` (with `datasource`) and `multi-select`** (`src/schemas/items.js`,
  `src/items.js`): a `datasource-search` field names a known datasource, takes no `options` and matches an object
  property; a `multi-select` field has string option values and matches an array property whose `items.enum` holds
  them; `datasource` on any other field type is refused.
- Tests `[ALG-*]` (`tests/allergy.test.js`).

### Consumers
- hds-fhir-js renders and imports the block in its next release (plan 133 phase 3); until then a renderer from 0.8.0
  serves an allergy event as the generic Observation of its item. Release order: data-model, hds-fhir-js, the facade
  pin and the extension options, then the apps.
- hds-forms-js and hds-lib meet a `datasource-search` and a `multi-select` field inside a composite for the first time;
  the entry UI (plan 133 phase 5) checks both before the items are offered in a form. It must also write no empty
  `categories` and a `lastOccurrence` at its precision (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`), never a full datetime.
- hds-lib `eventToShortText` skips object and array content fields, so an allergy displays as its first string field
  until plan 133 phase 5 teaches it the allergen: display work for the entry-UI phase.

### Fixed
- **eGFR: one result per time on import** (B-2026-11-19-34): FHIR-MAPPING.md § Import now also covers a report that
  states two different eGFR equations for one subject and time: after the population-pair rule, the result first in
  a fixed equation order (`69405-9`, CKD-EPI 2021, CKD-EPI 2009, MDRD, Schwartz) is kept and the others are left
  out. None is imported for a tie at the best rank with different values, for Schwartz beside an adult equation
  without `69405-9`, or for a per-population result beside a dropped pair. hds-fhir-js 0.10.6 `egfrSetAside`
  implements it.
- **A medication or procedure period within one period, on import** (B-2026-11-16-19): FHIR-MAPPING.md now says what
  PARTIAL-DATES.md § Spans already implied. A `stopped` or `completed` MedicationStatement period within one period
  imports as one intake (its regimen kept, a `statusReason` refused), listed as the second lossy medication mapping.
  A Procedure start within its end's period is a point event, like an end within the start's. hds-fhir-js 0.10.7
  implements both.

## [4.20.0] - 2026-11-19

The HDS Reader: provenance of a value read from a document, and the dialogue that confirms it. Additive: one
eventType, two `clientData` keys; no item, stream, option value or `fhir` block change.

### Added
- **`clientData.hdsSourceAnchor`** (PROVENANCE.md § Values read from a document by a program): where a value read from
  a document is printed in it, `{ attachmentId, page, bbox? }`. `attachmentId` the document event's Pryv attachment
  id; `page` the page within it, from 1 (an image is 1); `bbox` `[x, y, width, height]` in percent of the page as
  displayed (a PDF's CropBox after `/Rotate`), origin top left, absent when the reader has no box it trusts. Closed: no
  text, no value, no OCR output. A reader ignores an anchor whose attachment it cannot find.
- **`clientData.hdsExtraction`** (same section): `{ engine, engineVersion, kbVersion, backend, confirmedBy,
  corrected? }`, the first five required. Program id (lowercase, the `<tool>` of its `sourceKey`), semver versions,
  an opaque id of the backend configuration (no spaces, never parsed), the **role** that confirmed the value
  (`person` only in this version), never a name or account id, and `corrected: true` when the person changed the
  value, the item or the unit. Written only on a confirmed value, under `create-only`, so it
  describes the event as created ("originally read by" once another access modified it).
- Both keys are closed objects, published as `json-schemas/hds-source-anchor.json` and
  `json-schemas/hds-extraction.json` (source `src/schemas/clientDataKeys.js`, draft-04 and draft-07); PROVENANCE.md
  indexes them. A printed value and unit of a rescaled value, if ever written, get their own key, never
  `hdsExtraction`.
- **eventType `message/hds-reader-v1`** (HDS-READER.md): the dialogue between the Reader and the person, on
  `hds-reader-dialogue` in the Reader's own app tree (not a model stream; the placement is decided again before the
  first production write). `content.kind` discriminates nine closed kinds: `job`, `notice`, `reading`, `question`,
  `answer`, `access-request`, `access-result`, `written`, `summary`. `reading` carries what the document prints;
  `answer` may carry the corrected number (and the date given in answer to `which-date`); everything else is codes, ids
  and counts. No free-text kind. Event ids in content (`inReplyTo`, `eventId`) are mirrored in `clientData.related`
  (PROVENANCE.md list extended). One encoding per answer (`choose` + `option` for the which-* and is-fasting
  questions, `confirm` + `time` / `timePrecision` for which-date, `confirm` or `not-mine` for is-this-yours, and
  `candidateIds` on every answer to a reading); `kept-aside` is set by the Reader at reading time, never after an
  answer. Writers validate, readers dispatch on `kind` and fall back on unknown values; an answer counts only when
  written by the person's app and is void if a reading it covers changed after it; retention rules delete readings
  once written, skipped, or disowned. Printed flags and `hdsFlag` up to 16 characters.
- Tests `[RDR-*]` (`tests/hdsReader.test.js`): both flavours, every kind valid, closed objects, free text rejected in
  codes, ids, options and dates, exact enums and field lists, the inlined copies pinned to the key schemas, the
  published files, the model's ids fitting the patterns, the documentation examples valid.

### Consumers
- Nothing reads these yet. The Reader engine writes them; hds-webapp shows the dialogue and the anchor crop. A reader
  that does not know the keys ignores them, as any `clientData` key.

## [4.19.2] - 2026-11-19

Documentation only. No key, stream, eventType, option value, schema or `fhir` block change.

### Fixed
- **eGFR population pairs on import** (B-2026-11-16-17): FHIR-MAPPING.md § Import now states the rule for a report
  that sends both codes of a population pair (MDRD female / male, MDRD and CKD-EPI black / non black) for one subject
  and time: both are left out, the report's population-neutral eGFR result at that time standing for them, or none
  imported when it has none. hds-fhir-js 0.10.5 `pairedEgfr` implements it for the importing bridge.

## [4.19.1] - 2026-11-19

Documentation only. No key, stream, eventType, option value, schema or `fhir` block change.

### Fixed
- **The FHIR import of a qualified Condition** (B-2026-11-19-15): FHIR-MAPPING.md § Import and CONDITION.md § The
  second status now state that a Condition whose `verificationStatus` is `provisional`, `differential` or
  `unconfirmed`, or any stated value other than `confirmed`, is refused, as hds-fhir-js 0.10.3 does. CONDITION.md no
  longer records the importer as a known gap to its rule that a qualified diagnosis is never written as
  `condition-coded`.

## [4.19.0] - 2026-11-19

A value for a date nobody knows. Documentation only: no key, stream, item, eventType, option value, schema or `fhir`
block change; `hdsTimePrecision` is a documented `clientData` convention, not a schema.

### Added
- **`clientData.hdsTimePrecision: unknown`** (PARTIAL-DATES.md § A date nobody knows): the person was asked for the
  date and does not know it at all. `time` is then only the moment the event was recorded and makes no claim about
  the event. Written only from the person's answer, never by an importer on its own. Allowed on a closed list of
  history items (`condition-coded`, `finding-coded`, `procedure-*`, `treatment-*`, `encounter-visit`,
  `medication-intake-*`, `document`), never on a measured value or a prescription. The end may be known, the length
  never is: `duration: null` for a running span, a finite `duration` only as an end after the recording moment,
  with `hdsEndPrecision` required (stopping a medication period, a condition's abatement); no `unknown` for
  `hdsEndPrecision`; no `hdsTimeText` / `hdsTimeZone`. Readers show "date unknown", keep the event off any time axis
  (charts, timeline positions, latest value, "since", age at onset), and keep an ongoing period current. An edit
  that withdraws a date sets `unknown`.
- **FHIR rendering of `unknown`:** the date element carries only the `data-absent-reason` extension, code
  `asked-unknown` (`_onsetDateTime`, `_performedDateTime`, `_effectiveDateTime`, `effectivePeriod._start` with a
  known end as `end`); a DocumentReference has no `date` and takes `attachment.creation` only from `creation`; a
  vital-sign, laboratory or screening event with `unknown` is refused, and so is a procedure with `unknown` and a
  `duration`. The recording moment is an exact instant in the period tests: only an end after it is written. A date
  learned later keeps the end (duration recomputed); withdrawing a date drops a finite duration, and is refused on
  an ended medication period.
  FHIR import still refuses a resource with no date (open point), and a Condition onset stated absent no longer
  falls through to `recordedDate`. CONDITION.md, DOCUMENTS.md, MEDICATION.md and FHIR-MAPPING.md link to it.

### Changed
- PARTIAL-DATES.md § Spans: `hdsEndPrecision` takes the same values except `unknown`, and an `unknown` start never
  lends its precision to an end.

### Consumers
- A reader written before 4.19.0 reads the new value as absent and shows the recording moment as the event's date.
  hds-lib's `formatEventDate` and the timeline / chart readers need to learn it before a writer uses it.
- hds-fhir-js renders and refuses as above only once it implements this release (`toFhir` data-absent-reason,
  DocumentReference `date`, the Condition `recordedDate` fall-through in `fromFhir`).

## [4.18.1] - 2026-11-19

Text fixes from a review of the model against printed lab reports and documents. No key, stream, eventType, option
value, schema or `fhir` block change.

### Fixed
- **Two wrong SNOMED CT references:** `function-usual-activities` carried 413156007 (Left ankle circumference), now
  284545001 Ability to perform activities of everyday life; `symptom-pain-sore-breasts-severity` carried 290077003
  (Edema of breast), now 53430007 Pain of breast and 55222007 Tenderness of breast. FUNCTION.md and SYMPTOMS.md
  aligned; FUNCTION.md no longer lists the invalid 284774004 and the unused 228127002.
- **Labels that read as another measurement:** BUN option "BUN mg/dL" / "Azote uréique mg/dL" (urea nitrogen, not
  urea mass); `profile-name` en "First name" (fr was already "Prénom"); "Mucus peak day" / "Jour sommet de la glaire"
  and "Average mucus peak day" / "Jour sommet moyen de la glaire"; `fertility-pregnancy` option `abortion` en
  "Induced abortion (termination)"; vulva items "Vaginal bleeding intensity", "Brown/dark vaginal bleeding",
  "Blood clots in vaginal bleeding", en "Cervix position". Stream names are deliberately unchanged (already written
  into accounts), so these items' label and stream name now differ. Labels reach FHIR output as the HDS item
  coding's `display`.

### Added
- **devNotes on items a printed label can be mistaken for:** urea mass vs BUN (×2.14 in the same unit); mEq/L
  (also "mval/L") = mmol/L for sodium, potassium, chloride, bicarbonate, but 2 × mmol/L for calcium and magnesium;
  ESR first hour only; "not this item" notes on calcium (ionised, corrected), vitamin B12 (holoTC), 25-OH vitamin D
  (D3 / D2 fractions, a lone "25-OH D3" line), PTH (PTHrP, third-generation, fragments; "1-84" alone does not
  exclude), progesterone (17-OH), DHEA-S (DHEA), globulin (electrophoresis fractions, immunoglobulins, SHBG, TBG,
  thyroglobulin).
- **Documentation rules:** a product's strength stays in `name`, never in `doseValue` (MEDICATION.md); French
  "déjeuner" / "dîner" by country (MEDICATION.md); a qualified or negated diagnosis is never `condition-coded`, the
  FHIR import's `provisional` / `differential` / `unconfirmed` noted as a known gap (CONDITION.md); one rule for time
  and duration: absent duration = point event, `null` = ongoing, an unknown date is asked and never taken from the
  document (PARTIAL-DATES.md, linked from CONDITION.md, TREATMENT-PROCEDURE.md and FHIR-MAPPING.md); wild type and a
  bare genotype are never `present`, `zygosity` only with `present` (GENETICS.md).

### Removed
- FINDING.md no longer lists "a genetic test result" as a finding (GENETICS.md).

## [4.18.0] - 2026-11-18

Licence change, and a terminology-lookup page. No stream, item, eventType or `fhir` block changes.

### Changed
- **The model content is licensed under CC BY 4.0** from this release: `definitions/`, `documentation/` and the
  published pack. The code (`src/`, `scripts/`, `tests/`) stays BSD-3-Clause; `package.json` declares
  `BSD-3-Clause AND CC-BY-4.0`. Releases up to 4.17.1 remain available under BSD-3-Clause in their entirety, content
  included; that grant is not withdrawn. CC BY 4.0 applies to the content as published from this release. The JSON
  Schemas may be used under either licence.
- LICENSE carves out third-party material (LOINC, SNOMED CT with the CH Term value sets and Swiss extension, other
  code systems, third-party product names), and adds a notice on the model's name
  and on conformance: a modified version is not the HDS Data Model, and "compatible with the HDS Data Model
  `<version>`" stays allowed.
- The SNOMED CT notice uses SNOMED International's standard attribution ("used by permission", College of American
  Pathologists origin). It states that Health Data Safe holds a SNOMED CT Affiliate Licence obtained through eHealth
  Suisse and grants no licence or sublicence in SNOMED CT: users need their own.

### Added
- `TERMS.md`: terms of use of the hosted service at model.datasafe.dev (open to all, attribution, fair use, no
  warranty, Swiss law). The build publishes `LICENSE.txt` and `TERMS.txt` next to the pack, links them from the landing
  page, and adds `license` and `attribution` to `version.json`.
- `CONTRIBUTING.md`: contributions are signed off under the Developer Certificate of Origin (DCO).

### Docs
- **`documentation/TERMINOLOGY.md`** (site-agents#36 A8): terminology lookups when a writer codes a person's record.
  A lookup sent to a third party carries one bare code at most, never a name from the record. A third-party
  terminology service only checks a code the record prints (`$lookup` by code); a text search there or on the web is
  not allowed. Local lookups come first: the pack, the local MCP's `search_items`, a terminology copy the writer
  holds. HDS datasets-service searches send the name only, with the person told. With no code found: no code, never a
  guess. BLOOD-CHEMISTRY.md § Codes and AGENTS.md now say their tx.fhir.org procedures are for curating definitions.
  No pack change.

## [4.17.1] - 2026-11-18

### Changed
- `documentKinds` descriptions of `image-reference` and `media-recording` now decide between the two (the open point
  of 4.17.0), by an HDS convention.
  - **`image-reference`** is every picture an HDS writer files: an X-ray, ultrasound or MRI image (DICOM included),
    or a photo of a wound or of the skin.
  - **`media-recording`** is a video, a sound recording, or a picture of a specimen.
  - **Readers** accept either code for a picture.
  - **Sources** (DOCUMENTS.md Open points): EPDV-EDI Annex 3 edition 7 lists both codes as legal and does not define
    them. eHealth Suisse's non-binding 2022 implementation aid offers `900000000000471006` as "Bild".
  - Descriptions only: no code, key or schema change.

## [4.17.0] - 2026-11-18

Additive, site-agents#36 A9: a published document-kind table. No stream, item, eventType or `fhir` block changes.

### Added
- **`documentKinds`** (pack section, `documentKinds.json`, schema `json-schemas/documentKinds.json`): 45 kinds of
  medical document, one per row of the CH Term 3.4.0 ConceptMap `DocumentEntryClassCodeToDocumentEntryTypeCode`, each
  with the SNOMED CT Codings a `file/xds-v1` document writes as `class` and first `type`, a label (en / fr / de / it,
  based on the CH Term designations, edited), a `description` saying when to pick it (en / fr), and `timeBasis`
  (`service` or `creation`: the writer's default for which printed date is the event time). The three
  Swiss-extension concepts (Obstetrical record, Imaging order, Medication dispense document) carry
  `version: http://snomed.info/sct/2011000195101`; the other 42 codes are active in the International Edition. The
  build refuses two kinds that their codes or labels cannot tell apart, and a code with two Codings. A kind a later
  CH Term release drops is kept with `deprecated: true`.

### Documentation
- DOCUMENTS.md: "Document kinds" (the table, the Swiss extension, picking and reading a kind back, new CH Term
  releases) and "Which date is a document's date" (care over a period takes its end; records kept up to date take
  their last entry; only a date from the body, never the fax, scan, print or upload date; day precision at 12:00 UTC;
  importers that cannot ask; a printed date can be wrong; a writer default, not a reader claim). The "Codes" paragraph
  no longer says the model publishes no table.

## [4.16.0] - 2026-11-17

### Changed
- **`file/xds-v1` `uniqueId.system` refuses `urn:oid:<root>`** (in any case): the root-plus-extension form, which has
  no settled mapping (DOCUMENTS.md Open points). 4.14.0 left it to writers (hds-lib `normalizeDocumentUniqueId`
  already returns `null` for it). Refusing it in the schema while no writer stores a `uniqueId` means that settling
  the mapping later adds a form instead of migrating stored events. Also refuses `urn:ietf:rfc:3986` in any spelling
  but lower case (hds-lib already canonicalises it), so the one-spelling rule cannot be bypassed by case. No other
  change; a pack before 4.16.0 accepts what this one refuses, never the reverse (a tightening, kept minor: the field
  is from 4.14.0 and nothing stores it yet).

## [4.15.0] - 2026-11-17

Additive: one stream and two items on existing eventTypes. No eventType, fhir block or scope changes.

### Added
- **`symptom-general-malaise` / `symptom-general-malaise-severity`** ("Feeling unwell", SNOMED `367391008` Malaise),
  stream `symptom-general-malaise` under `symptom-general`. Additive: one stream, two items on existing eventTypes. The
  presence item is `deprecated` like every other symptom presence marker. No HealthKit category type exists. First
  source: Mira's daily-log symptom `Sickness` (B-2026-11-17-10), which bridge-mira dropped; Mira does not document the
  value and also sends `Nausea`, so it is read as feeling unwell. Malaise was already listed in SYMPTOMS.md's
  constitutional domain without an item.

### Documentation
- DOCUMENTS.md "One spelling": the list of spellings no longer says "an OID given as `system`", which contradicted the
  rule that a `urn:oid:<root>` system is the unsettled root-plus-extension form; that form is now named in the bullet.
  It points to hds-lib 2.55.0 `normalizeDocumentUniqueId`, and the open point on hds-lib is replaced by what 2.55.0
  ships.
- SYMPTOMS.md: nausea is SNOMED `422587007` (it listed the inactive `73879007` twice; the item was already right).

## [4.14.0] - 2026-11-17

Additive, site-agents#36 A11: a document's own identifier and the key that recognises a document already held. No
stream, item or `fhir` block changes. hds-fhir-js does not render the new property yet (it ignores unknown content), so
no renderer release is needed for this pack.

### Added
- **`file/xds-v1` `uniqueId`** (optional): the document's own identifier from its issuing system, XDS
  `DocumentEntry.uniqueId` / FHIR `DocumentReference.masterIdentifier`, as a closed Identifier `{ system, value }`. An
  OID or a UUID has one spelling, enforced: system `urn:ietf:rfc:3986`, value `urn:oid:<oid>` or lower-case
  `urn:uuid:<uuid>` (IHE ITI TF-2 Appendix Z.9.1). It is mirrored in the new `clientData.hdsDocumentUniqueId`
  (`<system>|<value>`), the cross-writer key a writer looks up before creating a document, so a document that reaches
  the account from two sources carrying its identifier (two importers, an EPR import and a FHIR import) is one event.
  DOCUMENTS.md § "A document already held". Additive for writers on this pack; content stays closed, so a validator on
  an older pack refuses a document carrying `uniqueId`. Follow-ups: hds-lib key mirror and normaliser before the first
  writer; hds-fhir-js `masterIdentifier` render (plan 115).

## [4.13.0] - 2026-11-17

Additive, plan 115 Questionnaire slice. One `fhir` block, one new resourceType and scope key. No stream, item or
eventType is added, and no eventType schema changes.

**Release order: this pack first, then hds-fhir-js (the same day), then the facade pin and the extension options
with the extension rebuilt from that hds-fhir-js, then the apps.** An hds-fhir-js release before the one of this
slice never misrenders this pack: it skips the block (unknown resourceType) and serves a request event as the
generic Observation of its item, as before (0.8.0 and later; earlier ones render nothing for it).

### Added
- **`fhir` block on `questionnaire-request`: `Questionnaire`, no profile claimed** (`profiles: {}`). One request
  event is one Questionnaire whose `url` is `https://hds.ngo/fhir/Questionnaire/<event id>`, the canonical the
  responses have carried since 4.12.0: it now names a resource. Each question is a boolean item (`linkId` the
  question key, `text` the label, `code` the HDS item when `itemRef` is an item key of the model) with the children
  a response nests under its answer. `requester`, `params` and `scope` are not rendered. FHIR-MAPPING.md
  § Questionnaire.
- **Scope key `Questionnaire`**, granted on `questionnaire-request` alone (`patient/Questionnaire.rs`). The stream
  is under the `explicitGrantOnly` root `questionnaire`: offered unticked, under `patient/*.rs` too (a second
  unticked row beside the answers), never reached by `*`.
- Schema: the `resourceType` enum gains `Questionnaire`; its block holds `resourceType` and `profiles` only.
  Build rule `[FHIR-MAP-27]`: beside the names the renderer reads, it holds the question key grammar
  (`^[a-zA-Z0-9_-]+$`, no dot) and the `subField.type` enum (`QUESTIONNAIRE_SUB_FIELD_TYPES` in `src/fhir.js`: a
  new type is added there and in the renderer before the eventType) and the option values of a sub-field (an array, `value` types exactly number and string:
  `QUESTIONNAIRE_OPTION_VALUE_TYPES`). Lock: one entry added
  (`questionnaire-request`, pair `Questionnaire`).

### Changed (what a reader sees once the facade and the extension are pinned to this pack)
- **A request event under a grant that names its stream (or the root) is a `Questionnaire`, no longer a generic
  Observation** without content: the question texts become readable in FHIR, as they are on the Pryv API under the
  same grant.
- **A `patient/*.rs` consent that was whole (the answers ticked) is no longer whole**: it is echoed as one scope
  per resource type, the answers included, at its next token exchange. Nothing an access reads changes.
- A response carries `item.text` and the questionnaire's title when its reader also holds the requests.

### Permanent
- The bare key `Questionnaire`; `questionnaire-request` under that pair; the reserved names `questions`, `label`,
  `itemRef`, `title`, `description`, `templateRef` and `subField` (its `options` and their `value` types with it), and
  the question key grammar; and, published by
  the renderer with the first Questionnaire rendered anywhere, the template canonical prefix
  `https://hds.ngo/fhir/Questionnaire/template/` (a `templateRef` that is itself an absolute `http:`, `https:` or
  `urn:` URI, the scheme in any case and printable ASCII only, is emitted unchanged), `item.code` in the HDS item system and the three children on every question.
  `status` is `active`, a constant of the renderer today, not a permanent value.

### Documentation
- `TREATMENT-PROCEDURE.md` states the care-programme history mapping decided 2026-10-13 (site-agents#4):
  `treatment-coded` at `treatment-fertility` with SNOMED `718701005` *Natural family planning method*, no new item.
  The "known ergonomic gap" paragraph is replaced: hds-forms-js 0.16.0 shipped `itemCustomizations[...].pin`, which
  shows the concept as static text and asks only for the companion fields.
- 4.12.0 announced the US Core QuestionnaireResponse claim with this mapping; it is not made (reasons in FHIR-MAPPING.md).
- FHIR-MAPPING.md § QuestionnaireResponse: the canonical paragraph and the qualifier table (a select of texts is a
  `string` item with `answerOption`) follow the mapping. The round-trip rule states its one exception (a
  `Questionnaire` is rendered and never imported), and the procedures paragraph no longer says "unreleased" (4.6.0).
- QUESTIONNAIRE.md defines `templateRef` (chosen by the requester's app, unique within that requester's templates
  only) and states that the content of a request event is never updated.

## [4.12.0] - 2026-11-16

Additive, plan 115 questionnaire answers slice. Three streams (the root `explicitGrantOnly`), two items, one `fhir`
block, one new resourceType and scope key; no existing key or stream changes, and no eventType schema changes (two
descriptions corrected).

**Release order: this pack first, then hds-fhir-js (the same day), then the facade pin and the extension options
with the extension rebuilt from that hds-fhir-js, then the apps.** An hds-fhir-js release before the one of this
slice never misrenders this pack: it skips the block (unknown resourceType, tested before the code it lacks) and
serves an answer event as the generic Observation of its item. No answer event sits in the new stream until an app
writes there, and production keeps the previous pack until the facade re-pin. **Before the first write** into the
new streams, the existing `*` accesses of each production core are masked for `questionnaire`, as they were for
`genetics` (GENETICS.md).

### Added
- **Streams `questionnaire` (root), `questionnaire-request` and `questionnaire-answer`**, with consent labels and
  descriptions { en, fr }, and the items `questionnaire-request` and `questionnaire-answer` (`type: system`) on the
  existing eventTypes `questionnaire/request-v1` and `questionnaire/answer-v1`. Until now the pair had eventTypes
  and no home in the model: the caller chose the stream, and the patient app wrote both into its own scope stream,
  which no consent names. QUESTIONNAIRE.md § Where the events live.
- **`explicitGrantOnly: true` on the `questionnaire` root**, the second root to carry the marker (perki,
  2026-11-16). The answer stream is a cross-topic sink: a yes on a question about a genetic test says that such a
  result exists. An access covers the root only when it names it or a child; a `*` grant and a grant on another
  root never reach it, and a consent screen offers it unticked (the SMART `patient/*.rs` included: offered, never
  ticked by default). The consumers already read
  the marker from the pack (hds-lib, hds-mcp-js, the account app's consent screen, and the hds-fhir-js extension,
  which has offered a marked stream unticked since 0.1.0); only the FHIR facade is new, from the release of this
  slice (`*` no longer reads a marked root). GENETICS.md § `explicitGrantOnly`.
- **A default SMART consent to `patient/*.rs` is echoed as one scope per resource type once the extension is pinned to this pack**, never
  as the literal `patient/*.rs`: the answers are offered unticked, so the wildcard is not whole. Nothing an access
  reads changes. FHIR-MAPPING.md § SMART scopes.
- **Consent descriptions that say everything a grant shows:** for each question a yes, a no, "did not know" or
  "preferred not to say", **with any detail the person added (the qualifier) and the reason given for not
  answering**, on any health topic, and that the streams are never part of "all your data". One French form for the
  answers, the plural (`Réponses aux questionnaires`), on the item and the stream.
- **`fhir` block on `questionnaire-answer`: `QuestionnaireResponse`, no profile claimed** (`profiles: {}`: the base
  resource on every flavour). One answer event is one response: `questionnaire` the canonical
  `https://hds.ngo/fhir/Questionnaire/<requestEventId>`, `authored` the event time, `status` `completed`, one item
  per question key with exactly one answer: `true` (the referenced events and the qualifier nested), `false`, or an
  absent boolean carrying a data-absent-reason (`asked-unknown`, `asked-declined`, a decline's reason nested under
  the answer). FHIR-MAPPING.md § QuestionnaireResponse.
- **Schema and build:** `resourceType` enum gains `QuestionnaireResponse`; `code` is required on every mapping
  except that one, whose block holds `resourceType` and `profiles` only. `[FHIR-MAP-26]`: a `system` item, one
  eventType with a string `requestEventId` and an object `answers`; import key the resourceType alone.
- **Scope:** `pack.fhirScopes.QuestionnaireResponse = ["questionnaire-answer"]`; lock entry `questionnaire-answer`
  (pair `QuestionnaireResponse`, parent `questionnaire`). Nothing rewritten. The root and the request stream are in
  no grant and not in the lock.

### Permanent
- The bare scope key `QuestionnaireResponse` (no category table can be added later), and the stream
  `questionnaire-answer` under that pair: nothing in it can be another resource type.
- `requestEventId` and `answers` as the names the renderer reads on any eventType mapped to
  `QuestionnaireResponse`.
- `explicitGrantOnly` on `questionnaire`: removing it later would widen every `*` grant given meanwhile.
- Published by the renderer with the first response rendered anywhere (the facade, demo included, or an app's export
  file), not by the pack: the canonical prefix `https://hds.ngo/fhir/Questionnaire/`, the identifier system
  `https://hds.ngo/fhir/sid/event`, the child linkIds `<key>.references`, `<key>.qualifier`, `<key>.reason`, one
  answer per question in every status, and the absence stated on `_valueBoolean`.

### Not in this release
- **No US Core profile claim.** The rendering is structurally valid against `us-core-questionnaireresponse`; the
  claim is added with the `Questionnaire` mapping (the question text is in the request), which is additive.
- The request has no mapping (no `Questionnaire` resource, so no question text in a response).
- No app writes into the new streams yet: hds-webapp still writes both events into its scope stream, so no
  response is served until it adds the model stream.

### Documentation (corrections: what the page said and no code does)
- QUESTIONNAIRE.md and the two eventType descriptions no longer say the pair travels "doctor → patient" and
  "patient → doctor": both events are written into the patient's account by the patient's own app, and nothing
  sends an answer to the requester.
- QUESTIONNAIRE.md no longer says per-pregnancy requests and answers live on per-pregnancy substreams (Plan 53 D3):
  not implemented, no app writes one.
- QUESTIONNAIRE.md: **one JSON type across a sub-field's options**, a rule for new requests (the qualifier renders
  as the answer of one FHIR item, which has one type); the example mixing `T1` and `9` is replaced.
- QUESTIONNAIRE.md no longer says event ids may be UUIDs: the renderer accepts 1 to 31 characters of
  `[A-Za-z0-9-]` (a cuid fits, a 36-character UUID is refused).
- QUESTIONNAIRE.md: § Where the events live (the app scope stream is kept during the transition, the model stream
  first), § FHIR; `status: unknown` mirrors `asked-unknown` (was `unknown`: the patient was asked); the FHIR mirror
  table follows the mapping.
- GENETICS.md: the second marked root, the SMART translation of `patient/*.rs`, the sweep before the first write.

## [4.11.2] - 2026-11-16

Text only: no key, stream, eventType or FHIR block change (the docs).

### Changed
- **The 14 h time-zone slack works both ways** (B-2026-11-16-18). CONDITION.md's ordered period test extended only a
  zoneless END past its end, against an exact onset. The mirror case was refused: onset `2016-04-06` (its UTC day) with
  abatement `2016-04-06T01:00+02:00` (23:00Z on the 5th, the same local day) had its end "wholly before" the onset.
  A truncated onset against an exact end now has its period extended by 14 h before its start, never past its end;
  both adjustments widen the periods of steps (1) and (2) only, never the anchors of step (3). CONDITION.md and
  FHIR-MAPPING.md § Abatement now also say that a period is half-open (its closing midnight belongs to the next
  period), and why both slacks are 14 h (a local day starts at most 14 h before its UTC day, ends at most 12 h after
  it). hds-fhir-js 0.8.4's Condition importer follows; its Procedure `performedPeriod.end` check takes the same
  onset-side slack. The Condition rule is Fable-reviewed.

## [4.11.1] - 2026-11-16

Text only: no key, stream, eventType or FHIR block change (`condition-coded` devNotes and the docs).

### Changed
- **A same-period condition abatement is not stored** (B-2026-11-13-12, perki's choice: status only). The core reads
  a duration of 0 back as absent, so the `duration: 0` that CONDITION.md, FHIR-MAPPING.md § Abatement,
  PARTIAL-DATES.md and the `condition-coded` devNotes promised since 4.1.0 could never be stored. Where one period
  contains the other (the ordered period test of CONDITION.md, before any anchor arithmetic; 14 h past a zoneless end
  against an exact onset), `condition-coded` keeps its abated status and carries no `duration` and no
  `hdsEndPrecision`; two different exact instants keep their positive duration. hds-fhir-js's importer follows the
  same text (plan 115). Fable-reviewed.

## [4.11.0] - 2026-11-16

Meaning made explicit, text only: no key, stream, eventType or FHIR change. An answer stored before 4.11.0 may be an
LH or monitor peak.

### Changed
- **`fertility-cycles-average-peak-day` (v2) is the average mucus Peak Day** (B-2026-10-28-7), the same Peak Day as
  `fertility-cycles-peak-day` since 3.24.0. The description said "Your typical cycle day of peak fertility" (fr
  « pic de fertilité »), which read as an LH peak or as a statement of fertility; it now reads "The cycle day on which
  your mucus Peak Day usually falls, as you recall it." devNotes added (legacy caveat, no LH twin). Fable-reviewed.
  Test `[CYC-AVG-PEAK]`.

### Documentation
- MENSTRUAL-CYCLE.md § Peak days: the recalled average follows the mucus peak.

## [4.10.0] - 2026-11-16

Additive, import only: no key, stream, eventType or exported code changes. hds-fhir-js regenerates its lab mappings
(`check:pack` compares the blocks), plan 115.

### Added
- **Lab LOINC codes no item owned now import** (B-2026-11-14-6, Fable F8 of the plan 115 labs review), each verified
  ACTIVE with no MapTo in the LOINC 2.83 release:
  - `body-blood-coagulation-inr` owns **38875-1** "INR in Platelet poor plasma or blood by Coagulation assay"
    (`references.loincMethod` + `alsoMatch`); `6301-6` stays the export. A whole-blood INR sent under 38875-1
    imports too (the code does not state the specimen); a result coded as capillary, `34714-6`, still goes to
    `lab-result/coded-v1`. AGENTS.md's `loincMethod` definition now names this case (a wider System).
  - `body-blood-serum-egfr` owns **50384-7** (Schwartz, pediatric), **50044-7** and **70969-1** (MDRD among female /
    male population), beside its seven per-equation codes; `69405-9` stays the export.
  - **107482-2** (all motile spermatozoa) stays unowned on purpose: `body-semen-tmc` is a progressive-motility derived
    count and the item's devNotes already record why neither 107482-2 nor 81319-6 is asserted.
  Tests `[FHIR-ITEM-12]` (eGFR, INR).

## [4.9.0] - 2026-11-16

Additive, text only: no key, stream id, eventType or FHIR change.

### Added
- **Consent `description` { en, fr } on the roots `wellbeing` and `profile`** (Fable's next candidates after 4.7.0):
  `wellbeing` names the sex drive and the mental distress (anxiety, depression, stress) its label hides; `profile`
  names the identifying facts and the Article 9 ones (ethnicity, reproductive stage: pregnancy, menopause) and the
  account preferences a root grant also reaches. Test `[STRL-3]` pins both roots' direct children. Fable-reviewed.

### Documentation
- BLOOD-CHEMISTRY.md § Known deprecation records the 4.0.0 PdG retype beside LH (the stale B-2026-10-29-2).
- PROFILE.md § Known gap: re-read the `profile` description if an item ever lands on `profile-location`.

## [4.8.0] - 2026-11-16

Additive, forms only: no key, stream, eventType or rendered FHIR change. Two Fable-review follow-ups of plan 115.

### Added
- **`procedure-basic` composite gains `robotAssisted`** (checkbox, optional; B-2026-11-16-1): the eventType
  `procedure/basic` already accepted it, but no form offered it. Listed in the `Procedure` block's `ignore`, so 4.6.0's
  "`robotAssisted` and `findings` are not rendered" still holds. `findings` stays out of the composite: it is an
  open-vocabulary array of objects, which no composite field type holds (devNotes, TREATMENT-PROCEDURE.md). The
  composite's other labels are now `{ en, fr }` (were English only). `procedure-coded` already offered both fields
  from its eventType. Item `version` v1 → v2. Test `[FHIR-ITEM-13]`.
- **The medication regimen's `route` select gains `parenteral`** (B-2026-11-13-16), « Parentéral (injection ou
  perfusion) »: the eventTypes accepted 14 routes, the form offered 13, and importers write `parenteral` from the WHO
  route `P`, so a form editing an imported event could neither show nor keep it. Shared by the two typed-name items
  (`medication-intake-basic` v4 → v5, `medication-prescription-basic` v1 → v2); the coded forms derive their route
  list from the eventType. Already rendered as text in the `MedicationStatement` block, so no FHIR change. Test
  `[MED-ROUTE-1]` keeps the form and the enums equal.

## [4.7.0] - 2026-11-16

Additive, text only: no key, stream id, eventType or FHIR change.

### Added
- **Consent `description` { en, fr } on the roots `fertility`, `body`, `lifestyle` and `family`** (Fable's follow-up
  on the 4.4.0 review, Fable-reviewed): one sentence saying what a grant on the root covers, as `encounter` and
  `genetics` already do. The texts name the sensitive parts a bare label hides: abortions and births under
  `fertility`, every laboratory result and the pregnancy hormones under `body`, a diet that reveals a belief under
  `lifestyle`. Test `[STRL-3]` also pins each root's direct children, so a new child fails until its description is
  re-read. Consumers that do not read stream descriptions are unchanged. Next candidates: `wellbeing` (anxiety,
  depression, sex drive) and `profile` (ethnicity, address, reproductive stage).

## [4.6.0] - 2026-11-16

Additive, plan 115 procedures slice. Two `fhir` blocks, one new resourceType and scope key; no key, stream or
eventType change.

**Release order: this pack first, then hds-fhir-js (the same day), then the facade pin and the extension options,
then hds-webapp and doctor-dashboard on the new library tag** (their export indexes the live pack). hds-fhir-js
0.7.0 never misrenders this pack: it skips both blocks (unknown resourceType). A skipped block renders nothing, so a
0.7.0 consumer that loads this pack shows no procedure event at all, where the previous pack gave a generic
Observation; the facade pins the pack hash, so production keeps the previous pack until the re-pin. The other order
would leave the library's `check:pack` red until the pack publishes
(two draft mappings without a block); `check:pack` is not relaxed. Production serves no `Procedure` until the
re-pin.

### Added
- **`Procedure` blocks on `procedure-coded` and `procedure-basic`** (FHIR-MAPPING.md § Procedures,
  TREATMENT-PROCEDURE.md § FHIR): US Core 6.1.0 `us-core-procedure` on `us`, IPS 2.0.1 `Procedure-uv-ips` on `ips`.
  The coded item takes its code from the datasource selection (`code: { from: datasource, field: procedure }`), the
  basic item the name as written (`code: { from: text, field: name }`, `ignore: [count]`). The event time is
  `performedDateTime` (a positive native duration: `performedPeriod`), `notes` the `note`, `status` always
  `completed` (the items store none and record a procedure that took place). `robotAssisted` and `findings` are not
  rendered.
- **A lifetime tally is never a Procedure:** an event carrying `count` (Flavour A, "had it N times", `0` never)
  states no date of any procedure, so the renderer serves it as the generic Observation of its item, as before.
  **Writer rule, now stated: a Flavour A event MUST carry `count`**; without it the event is one dated procedure.
- **Not a completed procedure, refused:** an open span, an event or a span end dated in the future, and content
  carrying the legacy `performed` key (before 1.8.1) are reported, never rendered as a Procedure.
- **`pack.fhirScopes` gains `Procedure: ["procedure"]`**, and the lock the `procedure` root with its context stream
  `procedure-fertility` under that pair (`npm run fhir:lock`: two entries added, nothing rewritten).
- **The text code source applies to a Procedure too** (it was a medication's only), and the schema's `resourceType`
  enum gains `Procedure`. Build rules `[FHIR-MAP-25]`: a Procedure takes a datasource or text code, no category,
  value, split or dosage; its `notes` is a string (counted as a mapped composite field), its `count` a number.

### Permanent
- **`Procedure` is a bare scope key, for good** (FHIR-MAPPING.md § Categories: a bare key is a one-way door). No
  category table can ever be added for the resourceType: `patient/Procedure.rs` is every procedure, and a stream
  mapped to `Procedure` later joins the key as another grant root.
- **Nothing under `procedure` can ever be a category-scoped Observation.** The lock holds `procedure` and
  `procedure-fertility` under the pair `Procedure`, and one subtree holds one pair: `findings` can never be mapped as
  Observations from these streams, and a tally can never be served under `Observation|survey` or any other category
  key (a faithful tally is a renderer-side, uncategorised Observation, never a pack category).
- **`count` and `notes` are reserved names on every eventType an item maps to `Procedure`.** The block does not name
  them; the renderer reads them by name and the build pins their types only. A non-null `count` means "a lifetime
  tally, not a Procedure", a string `notes` is the note, on these items and on any mapped later (treatments).
- **Both procedure items render as `Procedure`** (resourceType is permanent on a shipped block), and the `procedure`
  root and `procedure-fertility` are locked under that pair: an item or a stream added under them is read by every
  grant already issued and needs a `reviewed` entry.

### Not done
- The `treatment` items stay unmapped: in substance a `Procedure` over a period, which needs an import rule telling
  two datasource-coded Procedure items apart (FHIR-MAPPING.md § Procedures, last paragraph).

## [4.5.0] - 2026-11-14

Additive, plan 115 labs slice (the lab items 4.3.0 left unmapped). 31 `fhir` blocks, all `Observation|laboratory`; one
new value kind; two relaxations of the eventType code source and three new build rules; two LOINC codes newly
asserted (`59179-2`, a fix, and `69405-9`); no key, stream or eventType change.

**Release order: this pack first, then hds-fhir-js, then the facade pin and the extension options.** hds-fhir-js 0.6.0
is safe on this pack: it skips the INR block (unknown value kind), renders every other block, and on import only
refuses a resource coded `2986-8` or `14633-2` (it reads a code that names two eventTypes as a contradiction), never
misplacing one. The other order would leave the library's `check:pack` red until the pack publishes; `check:pack` is
not relaxed. The facade pins the library and the pack hash, so production sees neither until the re-pin.

### Fixed
- **Fasting insulin in pmol/L stores LOINC `59179-2`** "Insulin [Moles/volume] in Serum or Plasma --fasting" (ACTIVE,
  component `Insulin^post CFst`, the same as the item's `27873-9`). A defect published since 3.44.0:
  `body-blood-serum-insulin-fasting` carried `loinc: null` on its pmol/L option and `devNotes` saying LOINC had no
  such code, so a result coded `59179-2` matched no item. Now the option stores `59179-2`, `references.loinc` is
  `["27873-9", "59179-2"]`, the `devNotes` say so (`14796-7` stays the untimed twin's), and the item's new block codes
  pmol/L with it. A reader that took `null` to mean "no code" now reads a code; no stored event changes.
- **eGFR is not coded per equation only:** `body-blood-serum-egfr` `devNotes` and BLOOD-CHEMISTRY.md said so; LOINC
  has the equation-neutral `69405-9` (below).

### Added
- **The differential, percentage and absolute count together** (16 blocks): `body-blood-cbc-neutrophils`,
  `-neutrophils-segmented`, `-neutrophils-band`, `-lymphocytes`, `-monocytes`, `-eosinophils`, `-basophils`,
  `-reticulocytes` and their `-count` twins. **Why together:** the two items of a pair share one stream, and a grant
  is a stream subtree; a block on one alone would have left the other, unmapped, readable through
  `Observation|laboratory` without being rendered, which the build refuses (the one-pair invariant). With both mapped
  the stream holds one pair and a grant reaches exactly what it renders. The percentage is a `scaled-quantity` in `%`
  under the methodless LOINC code, the count a `quantity` in `10*6/mL`, `/uL` (and `10*9/mL` for reticulocytes) under
  its `[#/volume]` code; the method codes each item owns are `alsoMatch`.
- **Percentages on their own stream** (5): `body-blood-cbc-reticulocytes-immature-fraction` (`33516-6`),
  `body-semen-motility-progressive` (`14194-5`), `-motility-total` (`6800-7`), `-vitality` (`10613-8`),
  `-morphology-normal` (`10622-9`).
- **Two units of one property** (2): `body-blood-serum-testosterone-total` (ng/dL and ng/mL `2986-8`, nmol/L
  `14913-8`) and `body-blood-serum-c-peptide` (ng/mL `1986-9`, nmol/L and pmol/L `14633-2`). An eventType code source
  may now give two eventTypes the same coding (same display); at least two distinct codings remain required, and the
  units of a block stay distinct, so the unit picks the eventType on import; allowed only on an item that asserts
  `references.loinc`, whose unit options bind the repeat (`[FHIR-MAP-23]`).
- **Fasting insulin** (1): `body-blood-serum-insulin-fasting`, a code per unit, `27873-9` (μIU/mL) and `59179-2`
  (pmol/L, see Fixed).
- **The one unit LOINC has no code for** (1): `body-blood-serum-vitamin-d-125oh` renders its pmol/L under the HDS item
  coding (`https://hds.ngo/fhir/CodeSystem/item` with the item key; LOINC has moles for calcitriol alone, `14566-4`)
  and its pg/mL under `62290-2`. The build requires exactly that coding on an eventType whose option stores
  `loinc: null`, and refuses it on any other (`checkLoincAgreement`, `[FHIR-MAP-23]`).
- **eGFR** (1): `body-blood-serum-egfr` now asserts `references.loinc: ["69405-9"]` ("Glomerular filtration rate
  [Volume Rate/Area] in Serum, Plasma or Blood by based on 1.73 sq M": equation-neutral, no marker) and its block
  exports it in `mL/min/{1.73_m2}`; the seven per-equation creatinine-based codes it already owned are `alsoMatch`
  (the equation is not kept). The item now owns a result sent under `69405-9` whatever its marker. Import limit: a
  quantity in `mL/min` under `69405-9` (LOINC's example unit) is refused today, for the importing bridge to normalise.
- **Items with no exportable LOINC code** (4), the HDS item coding as static code and the owned codes
  (`references.loincMethod`) as `alsoMatch`: `body-blood-serum-ldh` (`14804-9`, `14805-6`, `2532-0`),
  `body-blood-coagulation-prothrombin-activity` (`5894-1` import only, and only in `%`: the unit refuses a PT ratio
  sent as a ratio), `body-semen-dna-fragmentation` (`104620-0`), `body-semen-tmc` (no import code, in `10*6`).
- **Build rules** (`src/fhir.js`, each holding on the model today, `[FHIR-MAP-23]`): an item that asserts
  `references.loinc` never carries a static code of another system (the HDS item coding included); an HDS item coding
  is the item's own key (a deprecated alias keeps its replacement's); two eventTypes share a coding only on an item
  that asserts `references.loinc`.
- **`body-blood-coagulation-inr`** (`6301-6`) through the **new value kind `ratio-quantity`**
  (`{ kind, units, relativeTo }`; schema `fhirValue`, `[FHIR-MAP-24]`): a `number` item on `ratio/generic` stores
  `{ value, relativeTo }`; the block renders `value` in UCUM `{INR}` and states the item's `ratioRelativeTo`.
- `pack.fhirScopes['Observation|laboratory']` gains 23 streams; the lock gains the same 23 roots (nothing rewritten).
  Every code verified ACTIVE with its Long Common Name in loinc-db (LOINC 2.83) on 2026-11-14, `2532-0` DISCOURAGED
  and import only. Tests `[FHIR-ITEM-12]`, `[FHIR-MAP-23]`, `[FHIR-MAP-24]`; `[FHIR-ITEM-7]`, `[FHIR-ITEM-8]`,
  `[FHIR-MAP-17]`, `[FHIR-SCOPE-11]`, `[FIN-INS-5]` updated.

### Changed
- `body-blood-serum-insulin` `devNotes`: the sentence saying the fasting twin has no code in pmol/L.
- FHIR-MAPPING.md: the medications paragraph says 4.3.0 (it read "unreleased").

### Permanent
- The 23 streams are `Observation|laboratory` for good (FHIR-MAPPING.md § Permanence). The codes a block emits can
  still move from the HDS item coding to a LOINC code if LOINC, or the model, gains one (the item coding then becomes
  an `alsoMatch`).

### Not done, on purpose
- The `lab-result/coded-v1` items (`body-blood-coded`, `body-urine-coded`, `body-csf-coded`) stay unmapped: the
  result carries its own code and unit, which no block shape renders yet.
- No other `references.loinc` change: LDH does not take the DISCOURAGED `2532-0`, the total motile count does not
  take `107482-2`. Each is an ownership decision of the lab model, not of the FHIR mapping.
- No unit alias on import (`mL/min` for eGFR, `10*3/uL` for the counts, `ng/mL`): one UCUM spelling per eventType, a
  refusal otherwise (FHIR-MAPPING.md § Import).

## [4.4.0] - 2026-11-14

Additive: localised names for consent screens. No key, id, parent, eventType or item change.

### Added
- **`label` { en, fr } on the 75 streams no single active item speaks for**: those with no item (most roots, the
  intermediate streams such as `body-blood` or `symptom-pain`, connector leaves) and those with several (`procedure`,
  `treatment`, `profile-name`, `medication-intake`, the blood-count cell streams…), with the 3.38.0 mechanism that only
  `genetics` and `hds-support` used so far. A consent row names a stream through its item's label when exactly one
  item is filed there; these streams had only their English `name`. `label.en` is the `name`; the French follows the
  items' wording (`glaire cervicale`, `humidité vulvaire`). Fable-reviewed.
- **`encounter` root: the consent `description`** of ENCOUNTER.md (en, fr): consultations, stays and care visits,
  with the doctors and places involved and the reason given, including sensitive visits. Closes the TODO "Consent
  screens for the `encounter` root" on the model side.
- Test `[STRL-1]`: a stream with no active item, or with several, must carry a `label`, so a new one cannot ship
  English-only.

## [4.3.0] - 2026-11-14

Additive, plan 115 medications slice (medications through SMART on FHIR). Four `fhir` blocks, two new scope keys, one
new code source, one new block field and one new pack table; no key, stream or eventType changes. Needs the hds-fhir-js
release that knows `MedicationStatement` and `MedicationRequest` (an older renderer skips the blocks: unknown
resourceType, code source and field, so a SMART app sees no medication until the facade is updated).

### Added
- **`fhir` blocks on the four medication items** (MEDICATION.md § FHIR, FHIR-MAPPING.md § Medications):
  `medication-intake-coded` and `medication-intake-basic` are a `MedicationStatement` (one intake or a period of use,
  R4's one resource for both; IPS `MedicationStatement-uv-ips` on `ips`, the base resource on `us`, which has no
  profile), `medication-prescription-coded` and `-basic` a `MedicationRequest` (US Core `us-core-medicationrequest`,
  IPS `MedicationRequest-uv-ips`). The coded twins take the medicine from the datasource selection (`drug`), the basic
  twins the name as written; all four share one `dosage`: the regimen path, the dose units as UCUM (`{tbl}`, `[drp]`,
  `{puff}`, `{application}`, `{suppository}`, `[IU]`, `mg`, `ug`, `g`, `mL`) and the routes as SNOMED CT route
  qualifiers verified active in snomed-db 20260201 (`parenteral` as text: no active concept).
- **Scope keys `MedicationStatement` → `medication-intake` and `MedicationRequest` → `medication-prescription`** in
  `pack.fhirScopes`: bare keys (no category table, one item set per type); the lock gains the two roots.
- **Code source `{ from: text, field }`** (schema `fhirCode`; `checkTextField`): no coding, the concept is the string
  at `field` (`medicationCodeableConcept.text`). A medication only. Import key `<ResourceType> from text`, one item
  per (resourceType, category); matched when no coding of the resource has a datasource label.
- **Block field `dosage: { field, doseUnits, routes }`** (schema `fhirDosage`; `checkDosage`): required on a
  medication, refused elsewhere; `doseUnits` keys are exactly the regimen's `doseUnit` enum with codes distinct as
  written (the annotation is the meaning of a count unit), `routes` keys exactly its `route` enum, a coding or
  `{ text }` each.
- **Pack table `fhirMapping.productSystems`**: `drug.product.system` → the URI the product code renders under as a
  second medication coding: `Swissmedic` → `https://hds.ngo/fhir/sid/swissmedic` (an HDS identifier namespace;
  Swissmedic publishes none for the number plus sequence), `CIS` → `https://smt.esante.gouv.fr/terminologie-bdpm` (the
  ANS SMT's BDPM CodeSystem, whose specialite concepts are the CIS codes: checked 2026-11-13 against its `$lookup`
  and the ANSM BDPM, evidence in `mapping.yaml`; it also holds presentations under CIP13, which hds-fhir-js refuses on
  import); one label per URI, distinct from `systems`; the build holds it to the `product.system` enum of the coded
  medication eventTypes. Tests `[FHIR-ITEM-11]`, `[FHIR-SCH-4]`, `[FHIR-MAP-22]`.

### Changed
- **Vocabulary `medication-intake-status`** binds to `MedicationStatement.status` and `skipped` carries `fhir:
  not-taken` (was `MedicationAdministration.status` / `not-done`, which the R4 rendering never emits);
  `medication-skip-reason` binds to `MedicationStatement.statusReason` likewise. A correction of what the `fhir` code
  documents, no key or value change; the `status`, `skipReason` and `medication/coded-v1` eventType descriptions and
  MEDICATION.md say the same.

### Permanent, both ways
- **No category table can ever be added for `MedicationStatement` or `MedicationRequest`** once these bare keys
  ship: the lock holds their streams under the bare pair, and a table would re-pair them (FHIR-MAPPING.md
  § Categories). A `category` coding, if a profile ever requires one, is a renderer constant, never the pack.
- **Both kinds of the intake stream render as `MedicationStatement` for good:** a MedicationAdministration for a dose
  (the R5 target) would need a stream of its own and a migration of the dose events (MEDICATION.md § FHIR).

### Not done, on purpose
- No MedicationAdministration: one intake renders as a MedicationStatement (`effectiveDateTime`, `completed` or
  `not-taken`), the R4 resource the stream's two kinds share one scope under.
- `bounds.duration` is not compared with the actual period to decide `stopped`; only a `stopReason` or `bounds.end` is.

## [4.2.0] - 2026-11-13

Additive, plan 115 GAP H-8 (documents through SMART on FHIR). One `fhir` block, one new scope key, one new category
table and one new code source; no key, stream or eventType changes. Needs hds-fhir-js 0.5.0 to render (an older
renderer skips the block: unknown resourceType, so a SMART app sees no document until the facade is updated).

### Added
- **`document` `fhir` block:** `DocumentReference`, category `clinical-note`, `code: { from: content, field: type,
  translate, unknown }`, profile US Core `us-core-documentreference` (IPS has no DocumentReference profile). `translate`
  leads `DocumentReference.type` with the LOINC document type US Core's required binding wants, for the four CH:EPR
  typeCodes HDS's writers use (Laboratory report 11502-2, Consult Note 11488-4, Prescription for Medication 57833-6,
  Diagnostic imaging study 18748-4; verified ACTIVE, `SCALE_TYP` Doc in the local LOINC release); any other type, the
  "other documents" Record artifact included, leads with v3 NullFlavor `UNK`. The content codings follow as written.
  DOCUMENTS.md § FHIR; FHIR-MAPPING.md § DocumentReference.
- **Scope key `DocumentReference|clinical-note`** → `documents` in `pack.fhirScopes`; the lock gains the root. A grant
  on it is a grant on every document, as a grant on the root is. The consent-screen label is hds-fhir-js's.
- **Category table `DocumentReference`:** `clinical-note` (`us-core-documentreference-category`), the one key of the
  US Core value set; the document's own XDS class renders as a second `category` coding.
- **Code source `{ from: content, field, translate, unknown }`** (schema `fhirCode`; `checkContentField`): the FHIR
  codings the content holds at `field`, led by the translation of the first the table knows, else `unknown`. A
  `DocumentReference` takes this source and nothing else, and the source applies to a `DocumentReference` only (so a
  renderer that predates it skips the block through its resourceType); one eventType; no `value`, `alsoMatch` or
  `alsoEmit`. Import key: `DocumentReference|clinical-note from content`, one item per category. Tests
  `[FHIR-SCH-4]`, `[FHIR-MAP-17]`.

### Not done, on purpose
- No import: `fromFhir` refuses the block until a writer that stores the file exists (D12 round trip pending).
- `encounterId`, `pages` and "superseded by another document" are not rendered.

## [4.1.0] - 2026-11-13

Additive, plan 115 GAP H-6: an imported FHIR Condition keeps its clinical status and its abatement. No key, stream,
eventType id or `fhir` block changes; the FHIR scope table and lock are unchanged. Needs hds-fhir-js 0.4.0 to render
and import the new fields (an older hds-fhir-js ignores them).

### Added
- **`condition/coded-v1` `status`** (optional): the FHIR `Condition.clinicalStatus` code, `active`, `recurrence`,
  `relapse`, `inactive`, `remission` or `resolved`; absent = not stated. Not required: every event written so far is
  still valid.
- **`condition-coded` `duration` block** (`mandatory: false`, `canBeNull: false`, 100 years as the UI hint):
  `time + duration` is the abatement. No duration = abatement unknown, never "ongoing" (the status says that), so
  `null` is not allowed, unlike the encounter and medication items, and `0` is a real value (abated within the onset's
  period), never "no duration". `content.verificationStatus` is reserved for the FHIR verification status (not stored
  yet; CONDITION.md). Rule (FHIR con-4): a duration requires status
  `inactive`, `remission` or `resolved`; hds-fhir-js refuses the event on export and the resource on import otherwise.
  A partial abatement date follows PARTIAL-DATES.md: anchored at 12:00 UTC on the last day of its period,
  `clientData.hdsEndPrecision` when its precision differs from the onset's.

### Documentation
- CONDITION.md § status and abatement replaces the "no status field, undecided" section; FHIR-MAPPING.md § Import
  (clinicalStatus, Abatement); PARTIAL-DATES.md cross-system table (the abated condition row, the end anchor on
  import).

## [4.0.2] - 2026-11-13

Display colours only; keys, stops and stored values unchanged.

### Changed: mood valence colours, a neutral sequential scale
The five `color` values on the valence stops of `converters/mood` (plan 124 4.1, hds-webapp review B4, Fable-reviewed)
change from red / blue / green (`#c62828`, `#ef4444`, `#3b82f6`, `#16a34a`, `#15803d`, 3.20.0) to a neutral scale
from violet to blue, lighter as the mood gets more pleasant: `#7551ab`, `#6f64b9`, `#6976c4`, `#6487cb`, `#6298cf`.
How pleasant a person felt is not good or bad, so no alarm or approval colours. Same key, same stops, same contrast
rule (3:1 against white and `#121212`, `[CNVM12]`); only the hex values change. Consumers read them from the pack;
the only copies of the old values in the workspace were hds-webapp test fixtures. MOOD.md § Valence stop colours
updated.

## [4.0.1] - 2026-11-13

Documentation; pack content unchanged.

### Documentation
- **PROVENANCE.md § An entry typed in answer to a connection's request** (plan 124 2.1, Fable-reviewed): an entry the
  person types for a connection points at the request with `clientData.related.<eventId>: true`: her
  `consent/accept-cmc` event of the data set for a one-off (`permanent`) section filled from that connection's tasks,
  the `notification/alert-cmc` reminder for a reminder's "Fill in". Written at create, or added by the update when she
  changes an existing entry from the task or the reminder; none when the accept event is not known; not retroactive;
  recurring logging, devices and imports carry none. Visible to every reader of the entry (an id, entries sharing it
  grouped, no name). Found per id with `clientData: [{ "path": "related.<eventId>", "eq": true }]`. The index row
  points at it.

## [4.0.0] - 2026-11-12

FHIR mapping, plan 115 phase 1 slice 2 (the fertility volume), and the PdG unit defect it uncovered. **Breaking:**
an existing item changes eventType (`body-urine-hormones-pdg`, below); its legacy item is re-added for the events
already stored. Five `fhir` blocks. Needs the deployed hds-fhir-js only for what it already renders (`quantity`,
static codes). Consumers: re-pin bridge-mira, hds-webapp and doctor-dashboard (an old bridge keeps writing PdG on
`concentration/iu-l`, which now resolves to the legacy item). No eventType added: μg/mL stores on the legacy
`concentration/mg-l` (1 μg/mL = 1 mg/L, AGENTS.md no-equivalent-types rule), shown with a display suffix.

### Changed (breaking)
- **`body-urine-hormones-pdg`** (v3) eventType `concentration/iu-l` → `concentration/mg-l`, shown μg/mL
  (`number.display.suffix`, as ferritin shows ng/mL on `concentration/ug-l`). PdG has no international unit; Mira,
  Inito and Proov report it in μg/mL, and every event written since the Plan 83 rename carried IU/L while the webapp
  showed "IU/L". New events store the same number on the right type; events already stored as `iu-l` resolve to the
  deprecated `fertility-hormone-pdg` (below). Consumers that pin the eventType or the item version re-pin.

### Added
- **`fertility-hormone-pdg`** (deprecated), stream `body-urine-hormones-pdg`, `concentration/iu-l`: the legacy home of
  the PdG events written before this release, the LH pattern of B-2026-07-15-1. PdG has no international unit; the
  stored numbers are Mira's μg/mL values (1 to 22) labelled IU/L, so only the type label was wrong, and an event
  cannot be retyped in place. The key is the Plan 83 rename alias removed in 2.3.0, back with the same
  streamId:eventType pair, so `findItemForEvent` resolves exactly the events that alias once did.
- **`fhir` blocks** (`Observation|laboratory`, US Core `us-core-observation-lab`, IPS
  `Observation-results-laboratory-pathology-uv-ips`), FHIR-MAPPING.md § Lab items:
  - `body-urine-hormones-lh`: LOINC 15079-7 "Lutropin [Units/volume] in Urine" (ACTIVE, LOINC 2.83), `[IU]/L`.
    `fertility-hormone-lh` (deprecated, `concentration/mg-l`, numbers in IU/L) carries the same block with
    `units: { concentration/mg-l: "[IU]/L" }`, so its 264 legacy events render in the true unit; without it the
    stream spanned `(unmapped)` and LH could not be granted.
  - `body-urine-hormones-e3g`: no LOINC or SNOMED code for estrone-3-glucuronide (2259-0 is estrone itself), so the
    static code is the **HDS item coding** `https://hds.ngo/fhir/CodeSystem/item` / `body-urine-hormones-e3g` /
    "E3G (urine)", the coding the generic rendering already used, now with `ng/mL` (stored `concentration/ug-l`,
    1 ng/mL = 1 μg/L), the category and the lab profiles. US Core binds a lab `code` to LOINC extensibly.
  - `body-urine-hormones-pdg`: same shape, `body-urine-hormones-pdg` / "PdG (urine)", `ug/mL` on
    `concentration/mg-l` (the same quantity); `fertility-hormone-pdg` carries the same block with
    `units: { concentration/iu-l: "ug/mL" }`.
- **Grant roots** `body-urine-hormones-e3g`, `body-urine-hormones-lh` (items `body-urine-hormones-lh`,
  `fertility-hormone-lh`), `body-urine-hormones-pdg` (items `body-urine-hormones-pdg`, `fertility-hormone-pdg`) under
  `Observation|laboratory` (102 roots), recorded in the lock. No `reviewed` entry: none of these streams was locked.
- FHIR-MAPPING.md: the HDS item coding as a static code (§ code), deprecated items are never import keys (§ Import).
- Tests `[ITMA-5]`, `[FHIR-ITEM-10]`; `[ITMA-1]`, `[ITMA-2]`, `[FHIR-ITEM-7]`, `[FHIR-SCOPE-11]` updated. Reviewed
  before publishing (Fable): no new eventType, major version.

## [3.50.0] - 2026-11-12

One stream added under `profile`; no item, eventType or existing stream changed.

### Added
- **Stream `profile-preferences`** ("Account preferences"), child of `profile` (PROFILE.md § Account preferences):
  where hds-lib `HDSProfile` already keeps the account's `settings/*` events. Declaring it lets consent
  provisioning (hds-lib `appTemplates.offerStreamsToCreate`, used by hds-webapp and the account app) create it
  under `profile` when a grant names it, instead of the core creating it at the account's root from the
  permission's `defaultName` (B-2026-11-12-3: every practitioner invite asks `read` on it since doctor-dashboard
  #43). No item: these are settings. Reviewed before publishing (Fable).

## [3.49.2] - 2026-11-12

Display order only; method ids, models, stored values, keys, streams and eventTypes unchanged.

### Changed
- `cervical-fluid` converter: Billings `order` 10 → 35, between Sensiplan 30 and Marquette 40. hds-lib sorts the
  methods by `order`, so method pickers read Creighton, Sensiplan, Billings, Marquette… (`pack.methods` itself stays
  in directory order). `billings/v0.json` stays a byte copy of model-cervical-fluid 1.2.2, which carries the same
  change. Test CNVC12 pins the first four. Reviewed before publishing (Fable).

## [3.49.1] - 2026-11-12

Display text only; stored values, key, stream and eventType unchanged.

### Fixed
- B-2026-10-28-42: `wellbeing-self-rated-health` no longer reproduces the EuroQol EQ VAS wording, which is
  licensed. Description "How you rate your health overall." (was "Your overall health today."), anchors
  "Very poor" / "Excellent" (were "The worst / best health you can imagine"); FR to match. A form that needs the
  EQ VAS text carries it in its `itemCustomizations` (the doctor-dashboard `eq5d5l` preset does). Reviewed before
  publishing (Fable).

## [3.49.0] - 2026-11-11

Who asked for a questionnaire (B-2026-10-27-35). Additive: one optional key on an existing eventType.

### Added
- **`questionnaire/request-v1` `requester: { relationship }`** (QUESTIONNAIRE.md § Who asked): the base id of the
  access the person granted the requester at accept, written by her app when it materializes a bundled questionnaire,
  from the accept result, never from the offer. An object (`additionalProperties: false`, `relationship` 1..128
  characters) so it can grow without a breaking change. Readers first use `createdBy` when it is a relationship's own
  access. FHIR: `Task.requester`. Reviewed before publishing (Fable): an object rather than a bare string, an
  instantiation fact that hds-lib never carries over from template content.

## [3.48.0] - 2026-11-11

FHIR mapping, plan 115 phase 1 slice 1: the US Core vital signs and the lab percentages. Additive: new blocks, a new
value kind and a new block field; no item, stream or eventType changes. Needs hds-fhir-js with `scaled-quantity` and
`alsoEmit` deployed first (FHIR-MAPPING.md § Forward compatibility): an older renderer skips these blocks.

### Added
- **Value kind `scaled-quantity`** (FHIR-MAPPING.md § Value kinds): each eventType renders in a UCUM `unit` at the
  stored number × `factor`, and imports back divided by it (reference range limits included). A proportion stored
  `0..1` renders in `%` with factor 100. Its own kind rather than a `quantity` field, so a renderer that does not know
  it skips the block instead of stating `0.07 %` for `7 %`. The build refuses a `ratio/proportion` eventType rendered
  in `%` with any other factor, a plain `quantity` included.
- **Block field `alsoEmit`**: codings emitted after a static code, never an import key, never another item's import
  key or owned LOINC code. The build refuses it on any value kind but `scaled-quantity` (a kind older renderers skip)
  until every deployed hds-fhir-js knows it.
- **Vital signs:** `body-height` (LOINC 8302-2, import also 3137-7; metres render in `cm`, feet in `[in_i]`, the only
  units the body height profiles take) and `body-oxygen-saturation` (59408-5, emitting 2708-6 as US Core pulse
  oximetry and the base oxygen saturation profile require; a resource coded 2708-6 alone, a blood-gas SaO2, still does
  not import here). `Observation|vital-signs` now grants `body-height` and `body-oxygen-saturation` too.
- **Lab percentages** (`Observation|laboratory`, `%`): `body-blood-hba1c` (4548-4), `body-blood-serum-transferrin-saturation`
  (2502-3), `body-blood-cbc-hematocrit` (4544-3, import also 20570-8), `body-blood-cbc-rdw` (30385-9, import also
  788-0), `body-blood-cbc-myelocytes` (26498-6, import also 749-2), `body-blood-cbc-metamyelocytes` (28541-1, import
  also 740-1). Each on its own stream, so the laboratory grant reaches nothing else. Every code verified ACTIVE in the
  LOINC 2.83 release.
- `definitions/fhir/scopes.lock.json`: the eight new grant roots.

### Not mapped, on purpose
- `body-temperature`: its stream holds the basal temperature and its disturbance flag, unmapped; mapping it is a
  decision on what a vital-signs reader may see (FHIR-MAPPING.md, top).
- The differential percentages that share their stream with the absolute count (neutrophils, lymphocytes, monocytes,
  eosinophils, basophils, segmented and band neutrophils, reticulocytes): mapped together with the count, later.

## [3.47.3] - 2026-11-10

Build script only; definitions unchanged.

### Fixed
- **Converter `updatedAt` is reproducible** (2026-11-10, B-2026-10-28-43): `dist/converters/pack.json` and each
  `dist/converters/<item>/index.json` took a converter's `updatedAt` from its source files' mtime, which is checkout
  time on a fresh clone, so two checkouts of the same commit published different timestamps. It is now the commit date
  of the last commit touching the file (the newest across an item's files, as before); a file with uncommitted changes,
  or a build with no git, still uses its mtime. This publish moves every converter's `updatedAt` once, to its commit
  date; no consumer reads it. Only `publicationDate` still changes from one build to the next.

## [3.47.2] - 2026-11-08

Documentation and the deploy script; pack content unchanged.

### Documentation
- **APP-DESCRIPTION.md § The requester behind a relationship** (2026-11-08, B-2026-11-02-15): when the naming rule
  gives `none` (a practitioner's or a bridge's invite), the relationship is named after the requester: before consent
  by the invite's `requesterMeta.displayName`, and afterwards by `content.requesterName`, which the person's app
  mirrors onto her `consent/accept-cmc` event at accept, only for an invite with no `hdsApp` at all (control and
  format characters replaced, at most 100 code points); with several relationships, the most recent accept carrying
  one wins; else the counterparty username. Self-given: it never vouches, a name from the rule or the operator wins
  over it, and a reader shows the username alongside it. § CMC app codes and § The pointer cross-reference it.

### Fixed

- **A deploy that never goes live now fails** (2026-11-08, B-2026-11-06-12): `scripts/deploy.sh` already polled the
  Pages build and the live `version.json`, but when model.datasafe.dev still did not serve the pushed commit after
  the wait it printed a WARNING and exited 0. It now prints an ERROR with the re-check command and exits 1.

## [3.47.1] - 2026-11-06

Documentation and dev dependencies; pack content unchanged.

### Documentation
- **APP-DESCRIPTION.md § CMC app codes** (2026-11-06): an implementer sends CMC requests under its own app code
  (`hds-collector` is Health Data Safe's); one app code carries any number of relationships (named by their
  per-request scope); a data set is a relationship whose invite carries a form spec, whatever its app code (older
  `hds-collector` accepts kept, bridges never); every person's app that accepts must mirror `hdsFormSpec` and
  `hdsApp` (the HDS account app's accept page complies in a later release); a reader never relies on the app code on
  her grant alone.
- **A catalogue entry without `counterparty` no longer vouches for a CMC relationship** (§ The catalogue vouches,
  § The rule): it vouched by app code alone, which any requester can claim. A practitioner app used by many accounts
  is `unvouched`, named from its manifest. hds-lib `vouchingEntry` follows.

Dev dependencies only, pack content unchanged: minimatch 11.0.4 and glob 14 via `overrides` (Dependabot #81,
GHSA-g3hv-75wg-m249, GHSA-3g3m-2fjr-6pw4); `npm audit`: 0. The deploy guard needs a version bump after this, which
the next release carries. minimatch 11 has no `makeRe`, so enabling `import-x/no-internal-modules` would break lint.

## [3.47.0] - 2026-11-04

National products: a medicine picked as a brand keeps the product (plan 120 P3). Additive. Needs 3.46.0 published
first (its hds-forms-js 0.29.0 condition applies).

### Added
- **`drug.product`** on `medication/coded-v1` and `medication/prescription-v1` (one schema, test `[MED-PRD-1]`), the
  shape reserved in 3.46.0 and returned by datasets-service for a brand hit: `name` (as on the box), `label` (keyed by
  its language, at least one of `de` / `fr` / `it` / `en`), `brand`, `strength` (string or null), `country` (ISO
  3166-1 alpha-2), `system` (`Swissmedic` | `CIS`, product level only: `GTIN` / `CIP13` are refused), `code`,
  `hdsId`. Required: `name`, `label`, `country`, `system`, `code`, `hdsId`. `drug.codes` keeps the coded medicine
  (`minItems: 1` unchanged).
- The medication datasource copies `product` from the search result (`valueFields`), so `DatasetSearch` stores it
  inside `drug` with no client change; pickers, short text and dashboards keep showing `drug.label`, which is the brand.
- **The `drug` fields the search stores are declared** (both coded types, test `[MED-DRUG-1]`): `ingredient`,
  `strength`, `doseForm`, `route`, `doseUnit` (string or null, informative copies from datasets-service, not
  normalised) and `hdsId` (string). Stored since the search began; consumers already read them (hds-webapp
  `drug.ingredient`, `drug.strength`). Every `drug` a search has stored still validates.
- MEDICATION.md § National products: `drug.label` keeps one meaning, the name the person knows (for a product pick, the
  brand display name under `en` and its language, as datasets-service returns it; the coded medicine's name in
  `drug.description`), so every reader is right with no change; `drug.product` is the only sign a product was picked.
  The code-system table, and the rule that a new product system ships in data-model before datasets-service returns it.

## [3.46.0] - 2026-11-04

Medication model pass DM-4 (B-2026-10-26-20). Additive, plus one contract tightening. Design and diff Fable-reviewed
2026-11-04.

**Consumers:** load this pack only with hds-forms-js 0.29.0 or later. Earlier hds-forms-js versions render every new
top-level property of a coded medication (`status`, `skipReason`, `stopReason`) as a raw companion select in
`DatasetSearch` forms. Re-pin doctor-dashboard, hds-mcp-js and the apps after hds-forms-js 0.29.0, and write
`status: skipped` only once every reader counts it (a reader that does not would count a skipped dose as taken).

### Added
- **Timing on the shared regimen** (`intake` on `medication/basic` and `medication/coded-v1`, `posology` on the two
  prescription types; one shape, test `[MED-TIM-1]`): `timeOfDay` (local clock times `HH:MM`, FHIR
  `Timing.repeat.timeOfDay`), `when` (19 values mapped 1:1 to FHIR EventTiming: `waking` … `after-dinner`) and
  `bounds` (the planned course: `duration` + `durationUnit`, or `start` / `end` dates; FHIR `repeat.bounds[x]`).
  `timeOfDay` and `when` are exclusive (FHIR tim-10); `duration` and `durationUnit` go together, never with `end`.
- **One intake: `status`** (`taken` | `skipped`; absent = taken) **and `skipReason`** (`forgot`, `side-effects`,
  `not-needed`, `unavailable`, `declined`, `advised`, `other`; only with `skipped`), top level on both intake types.
  Readers ship first: old readers count a skipped dose as taken.
- **`stopReason`** (`medical-advice`, `side-effects`, `ineffective`, `own-choice`, `other`) on an ended intake period
  and on a stopped prescription.
- **Prescription `status`** (`active`, `stopped`, `completed`; absent = not stated, not active), **`statusChanged`**
  (a date, needs `status`) and `stopReason` (only with `stopped`) on `medication/prescription-v1` and the new type.
- **Item `medication-prescription-basic`** on the new **eventType `medication/prescription-basic-v1`** (`name`, the
  same `posology` and status fields): a prescription entered by its name, no code found. Stream
  `medication-prescription`, beside the coded twin.
- **Pack section `vocabularies`** (`definitions/vocabularies/*.yaml`, `vocabularies.json`, schema
  `json-schemas/vocabulary.json`; `src/vocabularies.js`, `src/schemas/vocabularies.js`): EN/FR labels and FHIR /
  SNOMED CT codes of enum values. Five medication vocabularies: `medication-when`, `medication-intake-status`,
  `medication-skip-reason`, `medication-stop-reason`, `medication-prescription-status`. Each lists the fields it
  binds, and the loader refuses one whose values differ from a bound enum. SNOMED CT, verified active on the
  International release 20260201: 1269470004 (missed dose), 1303576005, 182897004, 242990004, 182895007 (skip),
  182840001, 395009001, 395007004 (stop).
- `medication-intake-basic` (v3 → v4): `doseUnit` option `mass/g`, which the eventType already allowed.
- Tests `[MED-TIM-*]`, `[MED-ST-*]`, `[MED-STOP-*]`, `[MED-RXB-*]`, `[MED-CODES-1]`, `[MED-VOC-*]`, `[MED-LBL-*]`,
  `[MED-COMPAT]`, each schema case under draft-04 and draft-07.

### Changed (contract)
- **`drug.codes` has `minItems: 1`** on `medication/coded-v1` and `medication/prescription-v1` (B-2026-10-26-20). A
  medication with no code is a `-basic` event, never `codes: []`. Only clients that validate are bound (hds-mcp-js);
  its `updateEvent` validates the whole content, so an agent editing any field of a stored `codes: []` event fails
  until that event is migrated to the `-basic` type. The only known writer was an unmerged sandbox branch.

### Changed
- `medication-intake-basic` composite labels (`name`, `intake`, `doseValue`, `doseUnit`, `route`) localized (en, fr).
- Descriptions of the three medication eventTypes and of `intake`: one intake vs a period of use, and on one intake
  only `doseValue`, `doseUnit`, `route` are meaningful.

### Docs
- MEDICATION.md: one intake or a period, the regimen and its timing, skipped, stopped (the period and the order),
  the typed prescription, `codes` minItems, vocabularies, FHIR and HealthKit mapping, and the names reserved for the
  product pass (`drug.product`; code systems `Swissmedic`, `CIS` product level, `GTIN`, `CIP13` pack level).
- FHIR-MAPPING.md § Medications: no block yet, `y` → UCUM `a`. AGENTS.md, README counts and layout.

## [3.45.0] - 2026-11-04

Fertility-intake asks, the last two (site-agents#38, #40 part 2). Additive. Diff Fable-reviewed before release.

### Added
- **Item `fertility-ttc-duration`** ("Time trying to conceive"), stream `fertility-ttc-duration` under `fertility`, a
  sibling of `fertility-ttc-tta` (a grant on one never covers the other): the recalled time trying, as a band
  (`less-than-6-months`, `6-12-months`, `1-2-years`, `more-than-2-years`) or `on-break` ("Currently taking a break"), one event per
  answer dated when reported. The intention stays on `fertility-ttc-tta` (a devNotes line now points to the new
  item). SNOMED `169449001`; no `fhir` block (a band would need a range value).
- **EventType `fertility/ttc-duration-v1`**, a string enum of those five values.
- Tests `[FIN-TTC-1..3]`; `[FIN-AJV]` covers the new eventType.

### Docs
- MENSTRUAL-CYCLE.md § Recalled summaries: the dating rule for every recalled summary (dated when reported, never
  back-dated, never `approx` for the answer's vagueness), regularity under it, and § Time trying to conceive (with
  the reader rule at the 12-month edge).
- BLOOD-CHEMISTRY.md § Sample context (site-agents#40 part 2): a cycle-day window reported without a date writes no
  cycle event, stays app-level, and a cycle day is derived only from a recorded `fertility-cycles-start`.
- AGENTS.md counts.

## [3.44.0] - 2026-11-04

Fertility-intake asks (site-agents#39, #40 part 1). Additive. Diff Fable-reviewed before release.

### Added
- **Item `fertility-cycles-regularity`** ("Cycle regularity"), stream `fertility-cycles-regularity` under
  `fertility-cycles`, beside the recalled averages: the person's own answer, `regular`, `irregular` or `no-periods`
  ("No current periods"), one event per answer at the date it is given. "Not sure" is not recorded; `no-periods` is
  reported, never a diagnosis or a reproductive stage. SNOMED `364307006`; option findings in MENSTRUAL-CYCLE.md.
- **EventType `fertility/cycle-regularity-v1`**, a string enum of those three values.
- **Item `body-blood-serum-insulin`** ("Insulin (untimed)"), stream `body-blood-serum-insulin` beside the fasting item:
  the untimed twin of `body-blood-serum-insulin-fasting`, for any result whose report does not state fasting. Same
  units (µIU/mL, pmol/L), not convertible between them. LOINC `20448-7` / `14796-7` (verified on tx.fhir.org, LOINC
  2.83, ACTIVE), SNOMED `16890009`. Mapped to FHIR (`Observation|laboratory`, `scopes.lock.json` grows by its
  stream); the fasting twin stays unmapped (its pmol/L has no LOINC code).
- Tests `[FIN-REG-1..3]`, `[FIN-INS-1..5]`, `[FIN-AJV]` (draft-04 and draft-07); `[UCNV]` excludes the new pair;
  `[FHIR-SCOPE-11]` counts 93 lab items. `fertility-cycles-regularity` has no `fhir` block: a coded block maps every
  option, and `no-periods` stays uncoded.

### Docs
- MENSTRUAL-CYCLE.md § Cycle regularity, as reported (and the dating rule for recalled summaries); BLOOD-CHEMISTRY.md:
  the insulin pair; FHIR-MAPPING.md lab count; AGENTS.md counts.

## [3.43.1] - 2026-11-04

### Changed
- **Root `genetics` `description`** (en, fr) carries the consent-screen promise dropped from 3.43.0: never part of a
  sharing of all the data, only of a sharing that names it. True now that the HDS consumers honour
  `explicitGrantOnly` (hds-lib 2.39.0, hds-mcp-js 0.8.0, the account app's consent screen) and the production `*`
  accesses are masked (site-agents#37). GENETICS.md records what shipped.

## [3.43.0] - 2026-11-04

Genetic test results on their own root (site-agents#37). Additive. Design Fable-reviewed and approved 2026-11-03;
diff Fable-reviewed before release.

### Added
- **Root `genetics`** ("Genetic test results"), with consent-screen `label` / `description` (en, fr). A special
  category of data (GDPR art. 9, HIPAA): no grant on another root reaches it (an access already minted with `*`
  does, and is swept before the first write). The root holds no item; its leaf
  `genetics-variant` ("Tested gene variants") does. Pharmacogenomic diplotypes and karyotypes are later, additive
  siblings.
- **Stream marker `explicitGrantOnly: true`**, on `genetics` (the first): an access covers the root only when it names
  it or a child, never through `*` or a grant on another root. Root only, boolean, checked in `src/streams.js`
  (`checkExplicitGrantOnly`); published as written in `pack.streams`. Consumers enforce it: a `*` consent request is
  expanded into the model roots minus the marked ones (Pryv refuses `level: 'none'` in a consent offer), a
  `level: 'none'` mask is added on directly minted accesses. **Data-model only declares it: no importer writes genetic
  data before the consumers honour it.**
- **EventType `genetic-variant/coded-v1`**, closed: `gene { label, codes[] }` (HGNC, required), `variant { label,
  codes[]? }` (HGVS, dbSNP, ClinVar), `result` (required: `present`, `absent`, `indeterminate`, `no-call`, LOINC
  69548-6 / LL1971-2), `zygosity` (`homozygous`, `heterozygous`, `hemizygous`, `homoplasmic`, `heteroplasmic`, LOINC
  53034-5 / LL381-5; advisory with `present` only), `resultText`, `method`, `laboratory { eventId?, name? }` (the
  `encounter/visit-v1` `serviceProvider` shape), `notes`. Codings are the `lab-result/coded-v1` `valueCodes` Coding.
  Every LOINC code verified against LOINC 2.83; 81252-9 is TRIAL.
- **Item `genetics-variant`**: `type: imported`, `repeatable: unlimited`, key = streamId, en/fr/es, no `fhir` block
  (`pack.fhirScopes` and `scopes.lock.json` unchanged), one event per tested variant at the collection date.
- Tests `[GEN-STR-1..3]`, `[GEN-ITM-1]`, `[GEN-ET-1..2]` (each under draft-04 and draft-07), `[GEN-ET-3..5]`,
  `[GEN-FHIR-1]`, `[GEN-PACK-1]`; `[LABC-ITM-1]` now counts `genetics-variant` among the imported items.

### Docs
- New `documentation/GENETICS.md`: why a root of its own, the marker and what each consumer must do, the field table
  with the Genomics Reporting IG LOINC codes, the answer tables, code systems, an example, compound heterozygosity out
  of scope, and the rule for a later `fhir` block (never under `Observation|laboratory`; `computeFhirScopes` keeps
  marked roots out of any grant that does not name them).
- PROVENANCE.md: `laboratory.eventId` joins the event ids mirrored in `clientData.related`.
- README index; AGENTS.md: the `genetics` root, and the item, stream and eventType counts brought up to date.

## [3.42.0] - 2026-11-03

### Added: app description, `hdsApp` and the `hds-app-manifest` (APP-DESCRIPTION.md)

- **`hdsApp = { manifest }`**: a pointer to the manifest of the app that holds an access, as `clientData.hdsApp` on a
  plain app access, or `requesterMeta.hdsApp` in a CMC invite, which the person's app mirrors as `content.hdsApp` on
  her `consent/accept-cmc` event (read through `clientData.cmc.acceptEventId`, as `hdsFormSpec`). Pointer only;
  fixed at consent. The first access-level key in PROVENANCE.md's index.
- **The manifest** (`format: "hds-app-manifest"`, `formatVersion: 1`), served by the app with CORS: `appCode`,
  localized `name` and `description`, `icon`, `provider`, `open` (web, ios, android), `privacy`, `support`; https
  only; an RFC 7591 mapping. JSON Schema published with the pack: `json-schemas/hds-app-manifest.json`
  (`$ref` to `defs.json#/definitions/localized`).
- **The rule every HDS app names an app by**, first match wins: `vouched` (a catalogue `partnerApps[]` entry by id /
  `appCode`, bound to its `counterparty` for CMC), `registered` (an OAuth client's registration), `unvouched` (a
  manifest only: the raw id first on the consent screen, "not listed by Health Data Safe · host"), `none`. The
  catalogue's new optional `manifest` and `counterparty` fields are defined there.
- Tests `[APPM-1..5]` (the published schema also compiles under Ajv strict mode).

No eventType, item, stream or settings key; no `fhir:lock` change.

## [3.41.1] - 2026-11-02

### Changed: when a data-set request is superseded (`consent/scope-request-cmc` `content.hds`)

- An unanswered request carrying `hds.formSpec` is superseded as soon as a later one carries `hds.formSpec`,
  whether that later request is answered, expired or still open. 3.41.0 said "the latest unanswered one is current",
  so once the latest was answered an older one became current again, and accepting it would have brought back an
  older data set and grant (found by a live run on demo). A request without `hds.formSpec` neither supersedes nor is
  superseded; a connection's own request whose delivery failed does not supersede.

Documentation only. Fable-reviewed (ship with edits, applied).

## [3.41.0] - 2026-11-02

### Added: `content.hds` on `consent/scope-request-cmc` (a connection's updated data set, confirmed by the person)

- **`hds.formSpec`** (a complete FormSpec, never `openLink`) and **`hds.formSpecHash`** (the writer's
  `formSpecFingerprint`) on pryv's scope request, in CUSTOM-FIELDS-AND-SYSTEM.md. The person's acceptance
  replaces the data-set copy on her `consent/accept-cmc` event; a change within the grant is sent too, with an
  unchanged permission set. Writer rules: `newPermissions` covers `deriveCmcPermissions(formSpec)`, requests go
  out one at a time per relationship and carry `expires`; the latest unanswered one is current, older ones are
  left unanswered. The connection derives each person's version from her latest accepted request.
- Test `[ETLM-CMC-5]`: pryv's mirrored schema still accepts the block.

No eventType, item, stream or settings key; no `fhir:lock` change. Fable-reviewed (ship with edits, applied).

## [3.40.0] - 2026-11-02

### Added: `notification/alert-cmc` kind `item-reminder` (a contact reminds the person of one item)

- **`hds.kind = 'item-reminder'`**, `hds.itemKey` (one item per alert), contact → person, written on the contact's
  collectors stream; fixed localised title and body, `code: 'hds-item-reminder'`, no `ackRequired`, in
  CUSTOM-FIELDS-AND-SYSTEM.md. The writer names only an enterable item of its own request. The reader keeps alerts
  carrying `from`, names the item from its model, and offers its form only while that relationship's grant covers the
  stream the entry would be written to (the section's `context` stream, else the item's). No reminder state; the
  item's `reminder` definition is unchanged.

No eventType, item, stream or settings key; no `fhir:lock` change. Fable-reviewed (ship with edits, applied).

## [3.39.0] - 2026-11-02

### Added: FHIR blocks on 92 lab items (`Observation|laboratory`)

- **Code source `{ from: eventType, codings }`**: one coding per eventType of the item, for an analyte whose mass and
  moles are two LOINC codes (35 items, fasting glucose 1558-6 / 14771-0 among them); the 57 others take a static code
  (one code for every unit). `alsoMatch` (import only) carries each item's `references.loincMethod`; with an
  eventType code it is keyed by the eventType each code names (`{ <eventType>: [codings] }`), so a mass code never
  imports a moles quantity (LDL: 13457-7, 18262-6 under mg/dL, 39469-2 under mmol/L). Every code checked ACTIVE in
  LOINC 2.83 (loinc-db), display = its long common name; units in UCUM (`[arb'U]/mL` for CA-125, an arbitrary-unit
  property).
- **Profiles** US Core `us-core-observation-lab` (6.1.0), IPS `Observation-results-laboratory-pathology-uv-ips` (2.0.1).
- **New SMART scope key `Observation|laboratory`**, 92 grant roots (each item's own stream), recorded in the lock.
  One grant reaches every mapped lab item, urine hCG and the semen analysis included (decided 2026-11-02; narrowed per
  stream on the consent screen).
- **LOINC notice** (licence §10) in README, on the landing page and as `LOINC_NOTICE.txt`.
- **Build checks `[LABC-LOINC-1]`**: on an item asserting `references.loinc`, an eventType coding is the code its unit
  option stores and a static LOINC code is stored by every unit option; a LOINC import key is never a code another
  active item owns.
- **Not mapped yet**, listed in FHIR-MAPPING.md: the `ratio/proportion` percentages, the absolute CBC counts and urine
  LH (their stream also holds an unmapped item), C-peptide and total testosterone, fasting insulin and
  1,25-dihydroxyvitamin D, INR, items without LOINC, the `lab-result/coded-v1` items.
- Tests `[FHIR-ITEM-7]`, `[FHIR-SCH-4]` (extended), `[FHIR-MAP-17]`, `[FHIR-MAP-18]`, `[FHIR-MAP-19]`,
  `[FHIR-SCOPE-19]`. Fable-reviewed (ship with edits; edits applied, including the keyed `alsoMatch`).

Needs hds-fhir-js with the eventType code source and the lab clientData keys (comparator, reference range,
interpretation) before a consumer serves these scopes.

## [3.38.0] - 2026-11-02

### Added: the HDS support channel (plan 117)

- **Root `hds-support`** ("Health Data Safe support (holds no data)") on the person's account: the consent anchor the
  HDS support invite requests `read` on, because a CMC invite needs one permission and the relationship is messages
  only. No item, no child, no event, ever (whatever were written there, the support group would read). A root, so it
  is covered by no existing grant and its own grant covers nothing else; never under `:_cmc:` (a grant there reaches
  the person's other chats). Brand-named because it names the one relationship the person sees in their tree; the
  type below is generic. First stream with localised `label` / `description` for consent screens; hds-lib's
  `permissionView` still shows `name` until it reads them.
- **Stream schema check** (`src/streams.js`, `checkLocalisedNames`): `label` and `description` are optional; when
  present, each is an object with non-empty `en` and `fr` strings, and `label.en` equals `name`. The build fails
  otherwise. Documented in AGENTS.md.
- **EventType `support/conversation-v1`**: the state of one support conversation, one event per conversation on the
  group's `:_cmc:apps:hds-support:team:state`, written by the team's members and the support service. Closed object;
  required `userSlug` (the person's `cmc.counterpartySlug`, `^[a-z0-9]+(-[a-z0-9]+)*--[a-z0-9]+(-[a-z0-9]+)*$`, at
  most 320 characters) and `status` (`new`, `open`, `closed`); optional
  `claimedBy { membershipAccessId, username, host, displayName?, at }` (advisory; `displayName` at most 40
  characters, no colon, no newline, as the widget's byline parse requires) and `notify { consentAt, sentAt? }`
  (written by the service only; waiting while `sentAt` is absent). **No email address and no `locale`:** the address
  lives only in the support service's outbox (30-day expiry), and nothing writes the person's language in v1 (the
  "joined" line is bilingual; the field can be added later as a minor). Not a CMC type, so never delivered off the
  group account. Named as a record (`<family>/<name>-v1`, like `sync-status/connector-v1`), not `settings/`, the
  plan's provisional name: it is per conversation and written by several parties.
- **`documentation/SUPPORT.md`**: what lives where (anchor, both copies of the chat, the state, the address in the
  service), why a brand-named root, the rules (the first message writes `status: 'new'`; a message after a close sets
  `new` and removes `claimedBy`; one event per `userSlug`; whole-content updates; only the service writes `notify`),
  retention (the address removed on send or after 30 days; the group's copy of the thread, its stream and the state
  removed when the relationship ends, on the person's `consent/revoke-cmc` or the team's "close + revoke"), and
  `clientData.hdsSupport` (which member wrote a line), indexed in PROVENANCE.md.
- AGENTS.md non-clinical roots five → six; README. Tests `[SUPP-STR-1..3]`, `[SUPP-ET-1..5]` (draft-04 and draft-07),
  `[SUPP-PACK-1]`.

No item or settings key; no `fhir:lock` change. Fable-reviewed (ship with changes, applied).

## [3.37.0] - 2026-11-01

### Added: sharing one document in a conversation (`document-shares`)

- **Root `document-shares`** ("Shared documents"), covered by no existing grant and never granted as a whole. Its
  children are created by the person's app, one per relationship and direction: id `share-` + 12 lowercase base36,
  name = the id, `clientData.hdsDocumentShare = { relationship, direction: 'shared' | 'received' }`. A child is granted
  to one contact, `read` (documents the person shares) or `create-only` (documents the contact may send). A shared
  document stays one event on `documents` with the share id added to its `streamIds`; a received one is moved to
  `['documents']` on receipt. No item anywhere in the subtree. Readers label a child from `direction` (labels EN / FR /
  ES in DOCUMENTS.md), never from its name. Revoke and restore cleanup documented.
- **`notification/alert-cmc` kinds** `document-shared`, `document-unshared`, `document-sent` (`hds.eventId`; fixed
  title and body, never the document's title; `code: 'hds-<kind>'`) in CUSTOM-FIELDS-AND-SYSTEM.md.
- **`clientData.hdsDocumentShare`** indexed in PROVENANCE.md; AGENTS.md non-clinical roots four → five.
- Tests `[DSHR-STR-1]`, `[DSHR-STR-2]`.

No eventType, item or settings key; no `fhir:lock` change. Fable-reviewed (blocking on the first draft, then clean
with edits, applied).

## [3.36.0] - 2026-10-29

### Added: `cards` documented on `settings/hds-webapp-diary` (v 2)

hds-webapp's Diary lets the person compose cards (hds-webapp#66): `cards`, an array of `{ id, name, items }`, is now a
documented key. `id` is `custom` (the card read from the v 1 custom chart) or `card-` and 8 base36 characters; `items`
are 1 to 6 data points, item keys of this model or `<item key>#<field>` for one field of a composite item
(`body-blood-pressure#rate`, the pulse); their order is meaningful. `cards` is the whole list. `v` notes that version 2
introduced it. `customSeries`, `customAdded` and `customName` are marked superseded (an event with `customAdded` true
and no `cards` key reads as the card `custom`; an empty `cards` array does not), left in place for older readers.
The description says the event holds no observation but is personal data (item keys and card names say what the person
tracks). Documentation only: the shape stays owned by hds-webapp (no `required`, open), no `minItems` / `maxItems`.
`[DSET-SET-2]` validates a v 2 event with `cards` (draft-07 and draft-04). Fable-reviewed (clean with edits, applied).

## [3.35.0] - 2026-10-29

### Changed: `eventTypes-legacy.json` mirror refreshed to pryv/data-types 1.3.3

Upstream commit `ace247c360` (2026-10-27, "consent/member-access-cmc and consent/member-revoke-cmc: failure.detail may
also carry retryAfterMs … version 1.3.3"), fetched 2026-10-29 and byte-verified against
`https://pryv.github.io/event-types/flat.json` and `api.pryv.com/event-types/flat.json` (after its redirect).
Byte-faithful copy. 358 → 358 types, nothing added or removed. **Changed**, one optional property and its description
only: `consent/member-access-cmc` and `consent/member-revoke-cmc` gain `failure.detail.retryAfterMs` (a number, the
peer's Retry-After in milliseconds on a 408, 429 or 503). No `required` changed; `extras` / `classes` / `sets`
unchanged. No `$ref`, no key shared with `eventTypes-hds.json`. Both types are platform-written; HDS writes neither.
The draft-07 caveat of 3.19.0 (`expireAfter` on `consent/member-access-cmc`) still holds; `[ETLM-AJV-1]` passes
unchanged. Fable-reviewed.

## [3.34.0] - 2026-10-29

Care encounters and providers (site-agents#24, plan 114 Q25-Q30, Q33, Q34), and the medication coding convention
(Q31, Q32).
Additive. Opus-drafted and Opus-reviewed design (proceed with changes, applied).

### Added
- **Root `encounter`** ("Care encounters and providers"): one new consent unit, covered by no existing grant. The root
  and its child `encounter-provider` ("Care providers") hold no item; the leaves are `encounter-visit` ("Visits and
  stays"), `encounter-provider-person` ("Doctors and therapists") and `encounter-provider-organization` ("Clinics,
  hospitals and practices"). One FHIR resourceType per leaf (Encounter, Practitioner, Organization), so each can get
  its own SMART scope once mapped.
- **EventType `encounter/visit-v1`**, closed: `kind` (required: `consultation`, `hospital-stay`, `emergency`,
  `day-case`, `teleconsultation`, `home-visit`, `other`), `specialty` (the `file/xds-v1` `practiceSetting` Coding),
  `reason`, `notes`, `participants[] { eventId?, name?, role? }` (role `attender`, `referrer`, `consultant`,
  `admitter`, `discharger` → FHIR participant type ATND, REF, CON, ADM, DIS), `serviceProvider { eventId?, name? }`.
  Period from the event time and duration; status derived, never stored (an unknown end is no duration, never
  `null`).
- **EventTypes `provider/practitioner-v1`** (`name` required; `given` (one string as printed, split on spaces by the
  FHIR export), `family`, `specialties[]` (at least one Coding: every specialist title as printed, in printed order;
  FHIR PractitionerRole.specialty 0..*), `identifiers[]`, `organizations[] { eventId?, name? }`) and **`provider/organization-v1`** (`name` required; `identifiers[]`; no
  specialty), closed. Identifiers are FHIR `{ system, value }`; the CH Core 6.0.0 systems are GLN
  `urn:oid:2.51.1.3`, ZSR `urn:oid:2.16.756.5.30.1.123.100.2.1.1`, UIDB `urn:oid:2.16.756.5.35` and BER
  `urn:oid:2.16.756.5.45`.
- New event id fields carry the pattern `^[a-zA-Z0-9_-]+$` (a valid `clientData.related` path).
- **Items** `encounter-visit` (composite `kind`, `reason`, `notes`; item-level `duration` `{ mandatory: false,
  canBeNull: true, maxSeconds: 31536000 }`, null being an ongoing stay), `encounter-provider-person` and
  `encounter-provider-organization` (composite `name`): `type: composite`, `repeatable: unlimited`, key = streamId.
  Importers write the other properties; a form edit keeps them. No `fhir` block (Encounter, Practitioner and
  Organization need a renderer first): `pack.fhirScopes` and `scopes.lock.json` are unchanged.
- **`clientData.hdsGln`, `clientData.hdsZsr`**: a provider's GLN and ZSR as bare values, mirroring content; writers
  look a provider up by GLN, then ZSR, then their `sourceKey` before creating one, on both provider types (a GLN can
  name a person or an organization); a found provider that is trashed is linked to, never untrashed or updated.
- Tests `[ENC-STR-1]`, `[ENC-ITM-1]`, `[ENC-ET-1..3]` (each under draft-04 and draft-07), `[ENC-ET-4..8]` (shared
  shapes and the portable subset, once), `[ENC-FHIR-1..3]` (the leaf layout
  maps without over-granting; an item on the root or a single provider item would not), `[ENC-PACK-1]`.

### Changed
- **PROVENANCE.md: an event id held in content MUST be mirrored** in `clientData.related.<eventId>`, in the same
  write, for every typed id field (`file/xds-v1` `supersedes[]`, `authors[].eventId`, `encounterId`;
  `encounter/visit-v1` `participants[].eventId`, `serviceProvider.eventId`; `provider/practitioner-v1`
  `organizations[].eventId`); a key is removed when its id leaves the content on update. Indexes `hdsGln` / `hdsZsr`.
- `file/xds-v1` descriptions of `authors[].eventId` and `encounterId` name their target types
  (`provider/practitioner-v1` or `provider/organization-v1`; `encounter/visit-v1`). Description text only, no schema
  change. DOCUMENTS.md likewise: an author's `name` is the name as printed, kept beside `eventId`.

### Docs
- New `documentation/ENCOUNTER.md`: layout and why, field tables with the FHIR column, `kind` → `Encounter.class`
  (`day-case` SS in the base flavour, AMB in `ch`; `other` NullFlavor OTH), period and derived status, participant
  roles, identifiers with their CH Core 6.0.0 sources (CDA root `1.3.88` written as `urn:oid:2.51.1.3`; an insurer's
  provider number is not an identifier), provider deduplication, specialty vocabularies per resource, links, write
  order and dangling ids, visibility, forms vs importers, open points.
- New `documentation/MEDICATION.md`: a Swiss brand `drug.label` as printed with the ATC substance code; the `hdsId`
  is always the one datasets-service returns (`S:<system>/k:<sourceKey>/C:<code>[/X<key>:<value>]*`, ATC rows from the
  WHO seed, the route-matching row else the first); an unmatched name stays `medication-intake-basic`.
- AGENTS.md and README index both; AGENTS.md: four non-clinical roots besides `profile`.

## [3.33.0] - 2026-10-29

The INR, site-agents#27 release 2 (plan 114 Q8), and a mg/L option on haptoglobin. Additive for readers; the meaning
of the published `ratioRelativeTo` widens (derived on a select, now also authored on a number item).

### Added
- **`body-blood-coagulation-inr`** (stream under `body-blood-coagulation`): a `type: number` item on `ratio/generic`
  with an authored `ratioRelativeTo: 1`. Content `{ value: 2.5, relativeTo: 1 }`, never a bare number; a censored
  INR keeps `clientData.hdsComparator`. LOINC `6301-6`, SNOMED `440685005`, both verified live. A home INR on
  capillary blood (`34714-6`) stays in `lab-result/coded-v1`. Readers need hds-lib 2.30.0 (`labNumberOf`, short text,
  FHIR `{INR}`); writers hds-forms-js 0.25.0. An older hds-forms-js writes a bare number, which the core refuses
  ("must be object"), so nothing wrong is stored.
- **`body-blood-serum-haptoglobin`** gains `concentration/mg-l` as option 3 (options 1 and 2 unchanged), LOINC
  `4542-7` like the others, factors to mg/dL (× 0.1) and g/L (× 0.001), exact. Importers print haptoglobin in mg/L.

### Changed
- **Loader:** `ratioRelativeTo` may be authored on a `type: number` item on `ratio/generic` only (finite, `> 0`,
  required there); refused on any other item, a select included (`checkRatioRelativeTo`). Such an item declares
  `eventType`, never `variations`. Tests `[RGEN-5]`, `[RGEN-REJ-6]` (now behavioural), `[RGEN-NUM-1..5]`; AGENTS.md
  § ratio/generic, BLOOD-CHEMISTRY.md (units, codes), published item schema comment.

## [3.32.0] - 2026-10-29

The missing lab analytes of site-agents#27, release 1 (everything but the INR, which follows in 3.33.0), the LOINC
pass over the existing lab items, and B-2026-10-28-41. Plan 114, decisions Q15-Q24. Additive for readers, except
for corrected references: five SNOMED codes move and some LOINC codes are removed (below), so `forLoinc` and SNOMED
lookups answer differently for those codes. Opus-reviewed before release (ship with changes, applied).

### Added: 32 lab items, 25 streams
- **Serum or plasma:** `body-blood-serum-glucose-random`, `-bilirubin-direct` ("Direct (conjugated) bilirubin"),
  `-lipase`, `-amylase` (new "Pancreas" group), `-phosphate`, `-haptoglobin`, `-igg`, `-iga`, `-igm`, `-crp` (the
  standard assay; `-crp-hs` stays the high-sensitivity one). Two-unit items, US conventional first, with their factors
  (phosphate expressed as phosphorus, 30.974 g/mol).
- **Complete blood count:** `body-blood-cbc-mchc`, `-mpv`, `-reticulocytes`, `-reticulocytes-immature-fraction`,
  `-reticulocytes-hemoglobin`, `-nucleated-rbc` (per 100 WBC), `-neutrophils-segmented`, `-neutrophils-band`,
  `-myelocytes`, `-metamyelocytes`.
- **Absolute counts** `body-blood-cbc-<cell>-count` for lymphocytes, neutrophils, segmented and band neutrophils,
  monocytes, eosinophils, basophils and reticulocytes, **on the cell's own stream** (key ≠ streamId): one grant
  covers the share and the count. Units 10⁹/L, then /μL (reticulocytes also 10¹²/L).
- **Coagulation**, a new branch `body-blood-coagulation`: `-prothrombin-time` (s), `-prothrombin-activity` (Quick %,
  `ratio/percent`, no exported LOINC), `-aptt` (s), `-fibrinogen` (mg/dL, g/L).
- **eventType `concentration/count-ul`** (counts per μL, symbol `/μL`): the US "cells/μL" figure, 1000 × the 10⁹/L
  number. No legacy equivalent (the legacy mirror has no count-per-volume type; `count-ml` is #/mL).
- `body-blood-serum` is labelled "Serum or plasma" (label only).

### Added: per-option LOINC and method codes
- `variations.eventType.options[].loinc`: the code an option stores, one of the item's `references.loinc`, or
  `null` for a unit LOINC has no code for. Stated on **every** option of an item that asserts LOINC, never inherited.
  Checked by the loader (`checkLoincRefs`): no missing option code, no option code outside the item's list, no listed
  code without an option, at most one code on a one-unit number item. `[LABC-LOINC-3e]`: options sharing a code have
  units of one kind.
- `references.loincMethod`: codes that make the item the owner of a result and are never exported: method-specific
  codes ("… by Automated count"), Quick % as labs send it (`5894-1`, a PT ratio that runs the other way), discouraged
  or superseded codes labs still send (LDH `2532-0`, race-adjusted eGFR). `[LABC-LOINC-1]` counts both lists.

### Added: LOINC on the existing lab items
- About 100 items gain verified codes (LOINC 2.83 on tx.fhir.org: status, property, system and long name checked, and
  each option's code against its unit): serum chemistry and hormones per property, the CBC (methodless code, method
  codes in `loincMethod`), urine FSH, hCG, LH and seven semen items. Where LOINC has no methodless code, the item
  exports the common method code when the method does not change the number (hematocrit `4544-3`, PT `5902-2`) and
  none when it does (eGFR per equation, LDH per reaction direction: owned only). Serum bicarbonate `1963-8` is owned
  by `-co2`. No code where none fits, each saying why (PdG, E3G, TMC; pmol/L of fasting insulin and 1,25-(OH)₂ D).
- AMH is `38476-8` / `48377-6`.
- The five differential percentages move to SNOMED "percent differential count" concepts; the plain "count" concepts
  go to the new count items.

### Fixed
- B-2026-10-28-41: the EQ-5D dimension codes `63800-5`, `63801-3`, `63802-1` on `function-mobility`,
  `function-self-care` and `function-usual-activities` do not exist in LOINC 2.83 and are removed (3.31.0 removed the
  others); `KNOWN_INVALID` is empty. Same origin (plan 44, unverified): `wellbeing-mental-distress-depression` cited
  `75275-8` ("Cognitive function [Interpretation]") and `wellbeing-mental-distress-anxiety` `69737-5` (the GAD-7
  panel); both items are five-level answers that no questionnaire total fits, and lose the code. AGENTS.md lists the
  PHQ-9 and GAD-7 total-score codes (44261-6, 70274-6).
- `body-oxygen-saturation` owns `59408-5` (pulse oximetry) only; a blood-gas SaO2 (`2708-6`) is a coded result.
- Stale LOINC comments on the semen items (`32623-1` is the platelet MPV).

### Docs
- BLOOD-CHEMISTRY.md: coagulation branch, serum or plasma vs whole blood, the count-on-the-cell's-stream exception,
  the percentage rule (part of a whole → `ratio/proportion`; ratio to a reference → `ratio/percent`, as printed),
  per-option and method codes, the verified codes of the derived indices, Quick % and CRP notes. AGENTS.md: LOINC in
  three places.

## [3.31.0] - 2026-10-29

The FHIR mapping block (plan 115, SMART on FHIR). Fable-reviewed twice before release: the branch at `c1520f4`
("ship after fixes": lock blind to item-less streams, `reviewed` not bound to a pair, unconstrained category keys),
then the fixes ("ship as is"). Additive for readers except `references` (always a list, below).

### Fixed
- A string `select` item whose eventType has no `enum` now fails the build with a clear message instead of crashing
  on `.find` (the check compared with `null` only and passed the JSON as a second `Error` argument).

### Added: `fhir:` mapping block on items (plan 115, SMART on FHIR)

- New optional item property `fhir` (schema in `src/schemas/items.js`, `defs.json` `fhirBlock`), bidirectional: it
  says how an item's events render as FHIR R4 and how a FHIR resource imports back. A mapping has `resourceType`
  (Observation, Condition), `category`, `code` (a static coding with a required `display`, or `{ from: datasource,
  field }` for codes a datasets-service selection stored in the content), optional `alsoMatch` (codes accepted on
  import only), optional `value` (`quantity`, `coded` or `components`, the schema discriminating by kind), optional
  `split` (extra resources from numeric composite fields, inheriting the parent's resourceType and category),
  optional `ignore` (composite fields not rendered) and `profiles` per flavour (us, ips, ch; an absent flavour renders
  the base resource). Or `{ companionOf: <item key> }` for a qualifier item that rides under its parent's SMART scope.
  Documented in `documentation/FHIR-MAPPING.md`, rewritten as an authoring guide (fields, kinds, split and nullable
  fields, profiles and IG versions, categories, companions, permanence, forward compatibility, import semantics and
  provenance keys, code verification).
- New `definitions/fhir/mapping.yaml`, published as **`pack.fhirMapping`**: `formatVersion` 1, `fhirVersion` 4.0.1,
  the IG of each flavour (US Core 6.1.0, IPS 2.0.1, CH Core 6.0.0), the category table per resourceType (the one place
  the build reads it) and the datasets-service system label → URI table.
- New **`pack.fhirScopes`**: the SMART scope grant table (`"ResourceType|category"` → minimal grant roots: the own
  stream of each mapped item, companions riding under their parent item's stream), computed by the build. Every item
  counts for the one-pair invariant: an unmapped active item as `(unmapped)`, a deprecated item with its mapping or as
  unmapped, a companion as its parent's pair. (Maximal homogeneous subtree roots until 2026-10-29, review F5: a
  stream added next to a mapped item later would have joined grants already issued.)
- New **`definitions/fhir/scopes.lock.json`** (format 2) and `npm run fhir:lock` (adds, never removes): every stream a
  published grant reaches, `{ pair, parent, items }`, append-only, plus a hand-written `reviewed` list. The build
  fails when a locked stream is removed, re-parented or holds another pair in its subtree, when an item on it is
  removed or moved (deprecate instead), and when a new item, companion or stream (added, or moved there, with or
  without items) appears on or under it without a `reviewed` entry under that locked stream (`reviewed: { items:
  { "<key>": { under, why } }, streams: { "<id>": { under, why } } }`, `why` = "YYYY-MM-DD <why>"; an
  acknowledgement holds under its own locked stream only). Tests fail when the lock is not up to date and when a
  published grant root is not in the lock under its pair (also checked on `dist/pack.json`). FHIR-MAPPING.md §
  Permanence describes how to rename a mapped item's key.
- Build checks (`src/fhir.js`): category per resourceType; the block agrees with its item (`quantity` on numeric
  `number` items with every eventType mapped, `coded` on `select` only and refused on `multi-select`, every composite
  field mapped or ignored, components and splits numeric and disjoint, a datasource source only on a datasource field
  holding `codes`, no `value` on a Condition); codings unique within an item; two eventTypes of one `quantity` block
  never share a UCUM unit, annotations such as `{beats}` aside; import match keys unique across active items; the
  one-pair invariant; companions valid; the lock; category keys lowercase letters, digits and dashes, and one coding
  per category within a resourceType.
- Blocks on `body-weight` (with `alsoMatch` LOINC 3141-9), `body-blood-pressure`, `lifestyle-tobacco-smoking`,
  `condition-coded` and the new `wellbeing-general-health`. Rendered output validates against US Core 6.1.0 and IPS
  2.0.1 and round-trips through import (hds-fhir-js).
- Fixed: AGENTS.md pointed authors at the never-implemented `hl7fhir:` block (B-2026-10-28-24); DESIGN-NOTES marks it
  superseded. Removed the unread `definitions/hl7-defaults/category.yaml`.
- Import-only additions from the plan 115 client import spike: a per-option `alsoMatch` on `coded` values (codings
  accepted for an option on import, never emitted; unique across the item's options and their `alsoMatch`, never on
  a Patient element) and `alsoMatchCategories` on a mapping (further categories of the same table a resource may
  carry and still import). Import matching is category-aware; a datasource source's import key is per category it
  accepts. `alsoMatch` LOINC 55284-4 on `body-blood-pressure`; a `body-heart-rate` block (LOINC 8867-4, `/min`, US
  Core heart rate and the FHIR heart-rate profile; new grant root, locked); on `lifestyle-tobacco-smoking`, the US
  Core answers 449868002, 428041000124106, 428071000124103 and 428061000124105 as `alsoMatch` of `current`, and
  `alsoMatchCategories: [survey]`; on `condition-coded`, `alsoMatchCategories: [encounter-diagnosis]`.
- FHIR-MAPPING.md § Import: withdrawn records refused, a panel without a required component refused, codings without
  a datasource label dropped while one remains, Observation and Condition time choices (a Condition's event time is
  its onset), units converted only through the item's declared `unitConversions`.
- **Patient from the profile items** (plan 115 D14): a third block form, `{ resourceType: Patient, element, value? }`
  (`defs.json` `fhirElement`), for one element of the Patient, which is assembled from the latest event of each
  contributing item. Elements: `name.given`, `name.family`, `gender` (`coded`, administrative-gender codes with their
  official displays), `birthDate`, `address.country`. Blocks on `profile-name`, `profile-surname`, `profile-sex`,
  `profile-date-of-birth` and `profile-addresscountry`; `profile-display-name`, `profile-birthcountry`,
  `profile-ethnicity`, `profile-avatar` and `profile-reproductive-stage` stay unmapped (reasons in FHIR-MAPPING.md).
  Build checks: the element's item type and string eventType, no `value` on a text or date element, gender codings
  exactly the item's options, one active item per element, no companion of an element.
- **Scope key format:** `ResourceType|category` for a resourceType with a category table, the bare resourceType
  otherwise. `pack.fhirScopes` gains `Patient` → `profile-address`, `profile-date-of-birth`, `profile-name`,
  `profile-sex` (locked), so `patient/Patient.rs` no longer maps to an empty grant.

### Changed: `references` codes are always a list (B2)
- `references.<system>` must be an array of non-empty strings, even for one code; the schema refuses a bare string.
  Every item was normalised (`snomed`, `loinc`, `icf`, `icd10`). A reader that compared `references.loinc` to a string
  must read a list.

### Fixed: `symptom-pain-severity` no longer cites LOINC 72514-3 (B1)
- 72514-3 is a 0 to 10 numeric pain score; the item stores five verbal levels as a ratio. Removed, with a YAML note on
  how the two relate.
- Also removed: LOINC 77564-4 (unknown to LOINC 2.83) and SNOMED 103325001 ("Patient need for", a qualifier value).
  `references` keeps SNOMED 22253000 (Pain) and 225908003 (Pain score) and LOINC 38208-5 (Pain severity - Reported).

### Added: `wellbeing-general-health`

- The 5-level self-rated health question, RAND-36 item 1 wording (public domain): "In general, would you say your
  health is:" Excellent / Very good / Good / Fair / Poor, on `ratio/proportion` at the canonical hooks, **higher is
  better** (excellent 1.0 … poor 0.0). New stream `wellbeing-general-health` under `wellbeing`. FHIR: LOINC 61577-3
  with the LL1012-5 answers; the SNOMED CT findings per answer (135816001, 135815002, 135817005, 135818000; none
  exists for "very good") as per-option `alsoMatch`, accepted on import.

### Changed: `wellbeing-self-rated-health` references

- The 0..100 slider stays HDS-only, with no FHIR mapping (B-2026-10-28-42). Its `references` are removed: 72006-0 is
  the VR-36 physical functioning T-score, 32622-6 does not exist in LOINC, 82589-3 is "Highest level of education";
  no standard code fits the scale. AGENTS.md no longer lists them.

## [3.30.0] - 2026-10-29

### Lab units, second slice: SI variations and factors (site-agents#20, #21)

The rest of what a second implementer asked for on #20 and #21, same rule as 3.21.0: the unit the item had stays
option 1 (minor), the writer stores the printed unit, factors are read-side only.

- **Two units, with a factor:** `body-blood-serum-magnesium` (mg/dL, mmol/L), `-bilirubin-total` (mg/dL, μmol/L),
  `-iron` and `-tibc` (μg/dL, μmol/L, as iron), `-zinc`, `-copper`, `-vitamin-a` (μg/dL, μmol/L, as retinol),
  `-c-peptide` (ng/mL, nmol/L), `-pth` (pg/mL, pmol/L), `body-blood-cbc-hemoglobin`, `-albumin`, `-protein-total`,
  `-globulin` (g/dL, g/L), `-crp-hs` (mg/L, mg/dL), `-ceruloplasmin` (mg/dL, mg/L).
- **Urea on `body-blood-serum-bun`** (plan 114 Q7): option "Urea mmol/L" (`concentration/mmol-l`), factor from the two
  nitrogen atoms of urea. Urea printed in mg/dL is not BUN and has no option (it would share `concentration/mg-dl`):
  `lab-result/coded-v1` under LOINC `3091-6` (BLOOD-CHEMISTRY.md § Units).
- **Third options**, appended after the two (all three pairs published, `[UCNV-FAC-9]`): total testosterone
  `concentration/ug-l` labelled ng/mL; C-peptide `concentration/pmol-l` (as UK labs print it); ceruloplasmin
  `concentration/g-l` (as European labs print it).
- `body-blood-serum-c-peptide` drops its item-level `number.display.suffix` (ng/mL is now its first option's label;
  hds-lib renders the same text).
- Sources: molar masses from PubChem formulas with IUPAC atomic weights; PTH 1-84 and C-peptide computed from their
  UniProt sequences (P01270, P01308); same-kind pairs (g/dL ↔ g/L) exact. All agree, to 0.2 %, with the factors the
  implementer used. Tests `[UCNV-VAR-4]`, `[UCNV-FAC-8..11]`.

### Documentation

- `BLOOD-CHEMISTRY.md`: `analyte.codes[]` outside LOINC uses the lab's or the writer's own code system (a URL it
  controls, else a fixed `urn:uuid:`); urea vs urea nitrogen; ng/L ≡ pg/mL.
- `CONDITION.md` § `codes[].hdsId`: how a writer that codes without datasets-service builds the code entry
  (`S:SNOMED-CT/k:<sourceKey>/C:<code>`, seed key or `IHTSDO`, never the writer's name).

## [3.29.0] - 2026-10-28

### Added: the `document` item

- **`document`** (`type: attachments`, stream `documents`, eventType `file/xds-v1`, `repeatable: any`): held back in
  3.25.0 until deployed consumers handled the `attachments` type; the definition is the one DOCUMENTS.md carried (a
  writer's overload of it keeps working). hds-lib ≥ 2.26.0 keeps it out of pickers, hds-forms-js ≥ 0.23.0 shows it as
  not editable; hds-webapp, doctor-dashboard and the account app run hds-lib 2.28.0 / hds-forms-js 0.24.0 on demo and
  prod.

### Changed: `settings/hds-webapp-diary` documentation

- `hiddenLines` holds line ids, a device's key and never the line's label (`instrument:<id>`, `healthkit:<sourceName>`,
  `connector:<id>`, `document` or `default`, followed by `#systolic` / `#diastolic` for a blood-pressure part); new documented key `pastCyclesAsRecorded` (boolean). The object
  stays open; no stored value changes.

## [3.28.0] - 2026-10-28

### The three coded lab-result items (site-agents#28)

- **Items `body-blood-coded`, `body-urine-coded` and `body-csf-coded`.** Each is `type: imported` on
  `lab-result/coded-v1`, with `repeatable: unlimited` and no references (the analyte is coded per event). They are
  published as 3.27.0 documented them, unchanged. No deployed build has real users (plan 114 Q14), so no consumer
  rollout gates them. Readers need hds-lib ≥ 2.28.0 / hds-forms-js ≥ 0.24.0. A writer's overload that restated them
  keeps loading (identical immutable fields) and can drop the restatement.
- `BLOOD-CHEMISTRY.md` § "The three items" replaces "published later". Tests `[LABC-ITM-1..3]` and `[LABC-PACK-1]`
  now check the published items.

## [3.27.0] - 2026-10-28

### Lab results: a printed limit (`hdsComparator`), coded results with no item (`lab-result/coded-v1`), item type `imported`

Plan 114 WP-D (site-agents#22, #28). The design was reviewed by Opus before release.

- **`clientData.hdsComparator`** (site-agents#22). It takes `<`, `<=`, `>`, `>=` and says that a numeric lab value
  is a printed limit (`< 1.5`), not an exact figure. Every reader must check it. It is documented in
  `BLOOD-CHEMISTRY.md` § "A censored value" (display, charts, unknown values, FHIR `valueQuantity.comparator`) and
  indexed in `PROVENANCE.md`. A limit with no figure (`< LOQ`) is a coded `valueText`.
- **EventType `lab-result/coded-v1`** (site-agents#28; id with the version suffix, plan 114 Q12): a result for an
  analyte with no item of its own, stored as printed. The object is closed:
  - `analyte` `{ label {en required}, codes[] }`. Each code is a closed FHIR Coding aligned with `file/xds-v1`, with
    an optional `hdsId`.
  - `value` + `unit` (the UCUM code, printable ASCII) + `unitText` (the unit as printed).
  - `comparator`.
  - `valueText`.
  - `valueCodes[]` (FHIR Codings of a qualitative result: SNOMED CT qualifier value, the lab's own code; with
    `valueText`).
  - `notes`.
  At least one of `value` / `valueText` is required; both together are allowed (semi-quantitative results).
  `specimen` is not a field: the stream and the LOINC System axis carry it.
- **Streams** `body-blood-coded`, `body-urine-coded`, and the new branch `body-csf` > `body-csf-coded`.
- **Item type `imported`**: an object written by an importer, never entered in a form. It is shown everywhere data is
  read and left out of pickers. Its eventType must be an object (`src/items.js`).
- **The three items `body-blood-coded`, `body-urine-coded` and `body-csf-coded` are not published yet.** Deployed
  builds before hds-lib 2.28.0 / hds-forms-js 0.24.0 would offer them in pickers and break their forms. Their
  definitions are in `BLOOD-CHEMISTRY.md` § "The three items: published later", for writers' overloads. They ship
  in a later minor, once consumers run those versions. This follows the `document` item precedent.
- `BLOOD-CHEMISTRY.md` also covers:
  - the writer rules: never an analyte an item owns, LOINC per property, stored as printed, curated codes;
  - the consent note;
  - moving a result to its item once the variation ships (`events.update` in place, with the field mapping; only
    results with no `valueText` move);
  - the writer gate: `hdsComparator` and coded results go to accounts read by deployed apps once those run
    hds-lib ≥ 2.28.0;
  - the FHIR mapping.
- Tests `[LABC-ET-1..3]` (draft-04 and draft-07), `[LABC-STR-1]`, `[LABC-ITM-1..3]`, `[LABC-PACK-1]`, and `[LABC-LOINC-1]` (no LOINC
  code asserted by two active items). `[LABC-LOINC-2]` checks the LOINC check digit. It found five codes asserted by
  plan 44 that LOINC 2.83 does not know (`32622-6`, `63800-5`, `63801-3`, `63802-1`, `77564-4`). They are frozen as
  known exceptions, pending correction.

## [3.26.0] - 2026-10-28

### Documentation: partial dates, the printed range and flag of a lab result, the import identity `sourceKey`

Conventions only: no item, stream or eventType changes. They are contracts between writers and readers, reviewed
before publishing (plan 114 WP-C).

- **New `documentation/PARTIAL-DATES.md`** (site-agents#26): a date known only to the month or the year, or
  approximately ("March 1999", "1997", "about spring 1998"). `time` = start of the period at 12:00 UTC, `duration`
  unchanged (a partial date never becomes a duration), `clientData.hdsTimePrecision` (`minute | day | month | year
  | approx`), `hdsTimeText` (the expression as written, required with `approx`), `hdsTimeZone` (IANA, with
  `minute`), `hdsEndPrecision` for a span whose end is known to another precision (the end is 12:00 UTC on the last
  day of its end period). Readers take the calendar fields in UTC. FHIR partial `dateTime` mapping. hds-lib 2.27.0
  `formatEventDate(event)` displays it.
- **`documentation/BLOOD-CHEMISTRY.md` § "The printed reference range, flag and interpretation of one result"**
  (site-agents#29): `clientData.hdsRefRange` (`lowerLimit`, `upperLimit` on the stored scale of the value, `text` as
  printed), `hdsFlag` (as printed), `hdsInterpretation` (`H | L | N | A | HH | LL`, the lab's printed flag
  normalised, never computed; unknown values read as absent), with the flag mapping and the FHIR mapping.
  `printedValue` / `printedUnit` / `conversion` are not defined (values are never converted); the alternative is a
  unit variation on the item, or `lab-result/coded` meanwhile.
- **`documentation/PROVENANCE.md`**: `clientData.sourceKey` (`<tool>:<kind>:<id>`, the identity of an imported
  record: one event per key, re-runs update in place and never restore a trashed event; find a whole import with
  the `prefix` condition of `events.get`), site-agents#33; the index lists the new keys; new keys are `hds`-prefixed.
  The bulk-import contract itself is on the agents site (`llms-full.txt` § 5f).

## [3.25.0] - 2026-10-28

### Added: medical documents, read markers for conversations

- **`documents` root ("Medical documents") and eventType `file/xds-v1`** (site-agents#23): a medical document as Pryv
  attachments, with the IHE XDS / CH:EPR DocumentEntry metadata as closed, validated content: `class`, `type`, `title`
  and `language` required (`creation` as FHIR dateTime; Codings `{ system (URI), version?, code, display? }`); `creation`, `status`, `supersedes`, `authors`, `encounterId`, `practiceSetting`,
  `facilityType`, `format`, `event`, `pages` optional. Codings are FHIR Codings; `class` and `type` take their codes
  from the CH:EPR DocumentEntry value sets. A replacement is a new event listing the old one in `supersedes`. The
  document's kind is its codes, not a stream; `documents` is a new root, so no existing grant covers it. See
  `documentation/DOCUMENTS.md`.
- **The `document` item is not published yet**: deployed apps would offer it in their pickers and fail on its item
  type. It ships once hds-lib skips `attachments` items in `getAllActive`, hds-forms-js renders them as not editable,
  and hds-webapp and doctor-dashboard run those versions on demo and prod. Its definition is in DOCUMENTS.md for a
  writer's overload meanwhile.
- **Item type `attachments`**: an item whose files are Pryv attachments; its eventType must declare
  `attachmentRequired: true`. An item type only, like `system`. Forms show it as not editable.
- **`settings/hds-webapp-read`**: where the person stopped reading each hds-webapp conversation,
  `lastRead: { <username@host lowercased, or access id>: <message time> }`, one recurring event on the
  `webapp-settings` app stream. Writers re-read and keep the later time per contact (a lost concurrent update only
  shows read messages as unread); a contact with no entry has no marker (unread unknown, not zero).
- PROVENANCE.md: event ids held in content are mirrored in `clientData.related` (content authoritative); the link
  kind is told by the two event types.
- Reviewed by a general-purpose reviewer in place of the usual Fable review (unavailable).

## [3.24.0] - 2026-10-28

### Added: cycle charting items, the coverline rule of each method, Sensiplan in the converter pack

- **`fertility-cycles-coverline`**: the basal-temperature coverline of one cycle, `temperature/c`, one event per cycle
  dated on the cycle's `fertility-cycles-start` day; `clientData.hdsBasis` `'manual'` (drawn or moved by the person)
  or `'auto'` (computed by the method's rule, written only by the writer that owns the cycle's data, such as an
  import). A reader that computes shows a `'manual'` event, else its own computation, never a stored `'auto'`; apps
  that compute never store `'auto'`. Writers are recommended to set `clientData.related.<cycleStartEventId>: true`.
  New stream under `fertility-cycles`.
- **`fertility-cycles-lh-peak-day`**: the LH peak day, beside the mucus Peak Day (below). New sibling stream under
  `fertility-cycles`.
- **`temperatureRule` on every cervical-fluid converter method** (`converters/cervical-fluid/pack-latest.json`), and
  the rule catalogue `temperatureRules` on the pack: `sympto-thermal` (STM / TCOYF), `sensiplan` (Sensiplan, and Chart
  Neo, which charts by Sensiplan's rule), `manual` (Justisse: the person draws the line), `none` for the eight methods
  with no coverline. Data only, ids from model-cervical-fluid `references/rules/coverline-rules.json`; declared in
  `converter/v0.yaml` because the method files are copies, checked complete by the build (`[CNVT-*]`).
- **Sensiplan in the cervical-fluid converter pack** (B-2026-10-26-18): `models/sensiplan/v0.json`, a byte copy of
  model-cervical-fluid `src/definitions/v0/sensiplan.json` (1.2.0), order 30, codes `t ø f S S+`. 12 methods. It was
  left out on 2026-03-19 with four other methods judged niche, for no recorded reason. Not added to the
  `fertility-tracking-method` options.

### Changed: the meaning of `fertility-cycles-peak-day`, and two labels

- **`fertility-cycles-peak-day` is the mucus Peak Day** (B-2026-10-26-19): the last day of peak-type cervical fluid in
  the method's terms. It had two meanings across writers: the Cyclefeminin import writes the mucus peak, Cycle
  Intelligence the LH peak. The data in real accounts is the import's (Cycle Intelligence runs on demo only), and "Peak
  Day" is the mucus methods' term, so the item keeps that meaning and the LH peak moves to the new
  `fertility-cycles-lh-peak-day`. Label "Peak day of fertility" → **"Peak Day"** (fr "Jour sommet"), description now
  "The last day of peak-type mucus in your cycle." (no fertility statement). Same key, stream and eventType; item
  version `v1` → `v2` (precedent: `body-vulva-cervix-position`). Events written before 3.24.0 by Cycle Intelligence
  (demo accounts only) may be LH peaks.
- **`fertility-tracking-method`**: the `billings` option is labelled **"Billings"** (en, fr), was "Billings Ovulation
  Method" (B-2026-10-28-2: no full method denomination as a label, as committed to WOOMB in July 2026). Value unchanged.

B-2026-10-28-3 (the "descriptive" cervical-fluid model differing between model-cervical-fluid and the pack) needed no
change here: model-cervical-fluid 1.2.0 was aligned on the published pack, and all 11 previously published method
files are byte-identical to it.

### Deferred: the fertility monitor reading (`fertility-monitor-lh-marquette`)

The Low / High / Peak monitor item, as Cycle Intelligence's overlay defines it, is **not** in this release. Cycle
Intelligence (and the `loic` webapp prototype's `dysnetOverload.ts`) carry the full item in an hds-lib overload, and
hds-lib's `validateOverload` refuses an overload that restates an existing item's `type`, `streamId`, `eventType` or
`options`, which makes their model load throw once the item is canonical. hds-lib 2.24.0 accepts an identical
restatement, so the item ships once Cycle Intelligence either runs hds-lib ≥ 2.24.0 with an overlay that matches the
canonical item exactly, or adds the key to its `UPSTREAM_ITEM_KEYS`. Today the overlay does not match: its option
labels are en/fr/es/it where the canonical item has en/fr (B-2026-10-28-5). The definition, its streams, tests and
documentation are kept on branch `feature/marquette-monitor-item`. `[CYC-2]` pins its absence until then.

**For consumers.**
- **Cycle Intelligence**: write the LH peak to `fertility-cycles-lh-peak-day` instead of `fertility-cycles-peak-day`, move the overlay's
  peak-day description to the new item, and relabel its existing demo events (stream change) or leave them, knowing
  they now read as mucus peaks.
- **bridge-cycles-files (Cyclefeminin) and bridge-cyclefeminin-net**: nothing to change; they already write the mucus
  Peak Day.
- **Readers** (hds-react-timeline and hds-webapp `FertilityCycleGraph`, doctor-dashboard `cycleModel`,
  hds-feminine-cycle-ui): label `fertility-cycles-peak-day` as the (mucus) Peak Day; show `fertility-cycles-lh-peak-day`
  separately if at all. doctor-dashboard's own LH-surge detection is unaffected.
- **hds-lib**: `MethodDef` gains an optional `temperatureRule` and the converter pack an optional `temperatureRules`;
  the coverline computation (`temperatureShift`) reads the rule from there, never from a method-name table, shows a
  `'manual'` coverline event over its own, and ignores a stored `'auto'`.
- **Apps showing the method list** (Settings, method choosers): Sensiplan now appears among the converter methods.
- **hds-forms-js / pickers**: two new active items appear (`fertility-cycles-coverline`,
  `fertility-cycles-lh-peak-day`). Apps with fixed stream permissions that want them must request the new streams; a
  permission on `fertility-cycles` already covers both.

Minor release: additions only, plus label and description changes on existing items (semver rule in `AGENTS.md`).

Tests `[CYC-*]` (items, streams, contents under draft-07 and draft-04, the Billings label, the deferred monitor item), `[CNVC5]`, `[CNVC6]`,
`[CNVC9]` to `[CNVC11]`, `[CNVT-*]`, `[CNVM13]`.

## [3.23.0] - 2026-10-28

### Added: vital signs, daily activity totals, medication regimen frequency (site-agents#25, #30, #31, #32)

- **Vital signs (#30):** `body-heart-rate` (`frequency/bpm`), `body-oxygen-saturation` (`ratio/proportion`, shown
  as %) on two new streams under `body`, and `body-temperature` (`temperature/c`) on the existing
  `body-temperature` stream, which had no item (the basal fertility reading stays `body-temperature-basal`; the
  pairs differ, so both resolve). SNOMED 364075005, 431314004, 386725007; LOINC 8867-4, 2708-6 + 59408-5,
  8310-5. **Consent:** stream permissions are recursive, so an app requesting `body-temperature` also receives
  the basal fertility readings (`body-temperature-basal`, `-disturbance`); consent screens that name the item
  should say so. The reverse is unaffected.
- **Daily activity totals (#25):** `activity-steps` (`count/steps`), `activity-distance-walking-running`
  (`length/m`), `activity-duration-active` (`time/s`), on three new streams under `activity`: one event per day,
  a period from local midnight, `duration` mandatory, `repeatable: P1D`. Named walking-*running* because that is
  what devices export (HealthKit `distanceWalkingRunning`). LOINC 41950-7, 41953-1; none for active time.
  `documentation/PHYSICAL-ACTIVITY.md` § Daily totals.
- **Medication regimen (#31):** `intake` in `medication/basic` and `medication/coded-v1` gains `frequency`
  (`{times, period, periodUnit}`), `asNeeded` and `note`, copied from `medication/prescription-v1` `posology` so an
  intake and a prescription carry a regimen the same way (FHIR `Dosage.timing.repeat`, `asNeeded`, `text`). The
  `medication-intake-basic` form gains the three fields. The issue's own spelling (`frequency.frequency`, a
  nested `asNeeded`, `text`) is not used: the published `posology` spelling covers the same need.
- **Regimen duration (#32):** `duration.maxSeconds` 10 → 50 years on `treatment-basic`, `treatment-coded`,
  `medication-intake-basic`, `medication-intake-coded`. It was always a UI hint (hds-forms-js), never validated by
  the cores, so API writers were not capped; ongoing use is still `duration: null`. Fertility caps unchanged.

### Changed: LOINC codes are asserted once verified

`BLOOD-CHEMISTRY.md` § Codes: LOINC codes now ship in `references.loinc` when verified as `ACTIVE` with a matching
Long Common Name against the official release on tx.fhir.org (`$lookup`, LOINC 2.83); previously they were not
asserted. Applies to every domain.

Tests `[ITMC1b]`, `[ITMV-1]` to `[ITMV-4]`; `[ITMC1]` lists the new intake fields.

## [3.22.0] - 2026-10-27

### Added: a conversion factor for fasting glucose (site-agents#21)

`body-blood-serum-glucose-fasting`, which already offered mg/dL and mmol/L, now publishes the factor between them:
`concentration/mg-dl` → `concentration/mmol-l` × **0.05551** (molar mass of glucose, C6H12O6, 180.16 g/mol, PubChem
CID 5793). Same derivation and direction as the 3.21.0 factors (conventional → SI, 4 significant figures); the
reverse is `1 / 0.05551` ≈ 18.01 (textbook 18.016, from 180.156). It is the one item where a value printed in mmol/L met a reference range written
in mg/dL with no published factor, so readers had to treat the pair as not convertible (requested by PRH).

## [3.21.0] - 2026-10-27

### Added: lab units, first slice — SI units as variations, and conversion factors (site-agents#20, #21)

Lab values stay stored as the lab prints them (`documentation/BLOOD-CHEMISTRY.md` § Units). An analyte that labs
print in two units now offers both as `variations.eventType` options, as `body-blood-serum-glucose-fasting` already
did; the factors between them are published on the item for read-side comparison only.

- **New eventType `concentration/pmol-l`** (pmol/L), HDS-owned: pryv's dictionary has no picomolar type, and it is a
  decade apart from `nmol-l`, so it is not an equivalent twin (`[UCNV-ET-*]`).
- **25 items gain a second unit**, the unit they had staying first, with the eventType tokens of site-agents#20:
  - `concentration/mmol-l`: calcium, cholesterol total, HDL, LDL, triglycerides;
  - `concentration/umol-l`: creatinine, DHEA-S;
  - `concentration/nmol-l`: cortisol, testosterone total, androstenedione, 17-OH progesterone, total T3, reverse T3,
    progesterone, vitamin D 25-OH, folate;
  - `concentration/pmol-l`: estradiol, free testosterone, free T3, free T4, vitamin D 1,25-(OH)2, vitamin B12, AMH,
    fasting insulin;
  - `concentration/uiu-ml` (printed mIU/L): prolactin.
- **New item field `unitConversions`** (`factors[]` with `from`, `to`, `factor`, optional `molarMass`, `source`;
  `notConvertible[]` with `from`, `to`, `reason`). Keyed by eventType id; one entry per pair, the reverse is
  `1 / factor`. 22 items carry a factor derived from the analyte's molar mass (PubChem CID, IUPAC atomic weights).
  Insulin µIU/mL ↔ pmol/L and prolactin ng/mL ↔ mIU/L are marked `notConvertible` (assay- or calibrator-dependent).
  AMH has no factor yet (no citable primary source recorded for the 7.14 convention). The loader checks both ends
  are eventTypes of the item, the factor is above 0 and a pair is declared once (`[UCNV-REJ-*]`). The field is in
  `pack.json` and `items.json` as published, for readers that do not use hds-lib; how to read it is in
  `BLOOD-CHEMISTRY.md` § Unit conversions.
- AMH, progesterone, prolactin, vitamin D 25-OH and folate drop their item-level `number.display.suffix` ("ng/mL"):
  renderers apply it whatever the unit, so it would label a pmol/L or nmol/L value "ng/mL". The `ug-l` option label
  now reads **ng/mL**, so hds-forms-js shows the same text as before (`[UCNV-VAR-3]`).

**For consumers.** These 25 items no longer carry a top-level `eventType`; read `variations.eventType.options` (or
hds-lib's `eventTypes`). hds-lib's `eventTemplate()` now requires an explicit `eventType` for them, as it already
did for glucose. Existing events keep resolving: the unit they were written in is still the item's first option.
The first-option default keeps every reader that picks a unit for the person on the conventional unit. This is a
minor release: the unit each item had stays option 1 (rule in `AGENTS.md`, semver).

**Display consequence.** hds-lib 2.20 `eventToShortText` prints `number.display.suffix` when an item has one, else
the eventType symbol. With the "ng/mL" suffix moved to the option label:

- AMH, progesterone, prolactin, vitamin D 25-OH and folate events on `concentration/ug-l` now render **"µg/L"**
  there (numerically identical to ng/mL, so the value is right, only the notation changes);
- prolactin events on `concentration/uiu-ml` render **"μIU/mL"**, not "mIU/L" (also numerically identical);
- hds-forms-js `NumberInput` keeps showing **"ng/mL"**, which it takes from the option label.

Follow-up in hds-lib: `eventToShortText` prefers the label of the variation option matching the event's type, and
`unitConversions` joins `ITEM_IMMUTABLE_FIELDS` in `HDSModel-Overload.ts`, so an app overload cannot rewrite a
factor.

**Next** (rest of site-agents#20/#21, not in this release): magnesium (mmol/L), bilirubin (µmol/L), iron, TIBC,
vitamin A, zinc, copper (µmol/L), C-peptide (nmol/L), hemoglobin, albumin, total protein, globulin (g/L), hs-CRP
(mg/dL), ceruloplasmin (mg/L), with their factors; a factor for fasting glucose (already two units); AMH's factor
once sourced. Censored values ("<1.5", site-agents#22) are a separate change.

## [3.20.0] - 2026-10-27

All additive: no item key, stream, option or `eventType` is removed or renamed. Consumers that ignore the new
keys are unaffected; the only visible change for an existing reader is the unit text of cell counts and of
the kilogram option label.

### Added: `settings/hds-webapp-diary` eventType

The hds-webapp Diary's layout and display state (card order, visibility, collapsed cards, custom chart, cycle
card tiles and chart rows, tips and lessons seen, set-up answers, daily logging kinds) as one recurring event
on the existing `webapp-settings` app stream, next to `settings/hds-react-timeline`, so it follows the person
across devices instead of living in `localStorage`. Same contract as the timeline type: the shape is owned by
hds-webapp, the 20 known keys are documented (including an optional `v`, the version of the shape), nothing
is `required` and other keys are allowed. It holds no health data: `goals` and `dailyKinds` hold Diary feature
or card ids and item keys only, the fertility intention stays on `fertility-ttc-tta`, and `methodLater` is a UI
deferral, not the charting method. `appStreams.yaml`'s `webapp-settings` description names both settings types (its single
`eventType` field is unchanged). Tests `[DSET-SET-1]`, `[DSET-SET-2]`.

### Changed: unit text — cell counts as lab reports print them, `kg` (B-2026-10-26-15)

- `extras.symbol` of `concentration/megacount-ml` is now **`G/L`** (was `M#/mL`) and of
  `concentration/gigacount-ml` **`T/L`** (was `G#/mL`): the same stored number (10⁶/mL = 10⁹/L,
  10⁹/mL = 10¹²/L), in the notation blood counts are printed in. Readers that print the eventType symbol
  (hds-lib `eventToShortText`, hds-forms-js) now show "5.2 G/L" for white cells and "4.5 T/L" for red cells.
- `body-semen-concentration` (also on `megacount-ml`) gains `number.display.suffix` **`10⁶/mL`**, the
  notation of semen analysis, so it does not read as a blood count where the item's display block is honoured.
  hds-forms-js `NumberInput` honours it. **hds-lib `eventToShortText` does not yet:** its `formatNumber` ignores
  `number.display` for `type: number` items and prints the eventType symbol, so until hds-lib changes, semen
  concentration reads "15 G/L" there (today "15 M#/mL"). Follow-up in hds-lib: `formatNumber` honours
  `number.display.suffix` (and `multiplier`), which also fixes the items stored on `concentration/ug-l` that
  display ng/mL.
- `body-weight`'s `mass/kg` unit option label is **`kg`** (was `Kg`), in both languages. The legacy mirror's
  `mass/kg` symbol is still `Kg`: it is pryv's (`pryv/data-types`) and can only be fixed upstream.
- Tests `[DSET-SYM-1]` to `[DSET-SYM-3]`. `AGENTS.md` states that a display symbol follows the reporting
  notation. README and `AGENTS.md` counts refreshed (298 items, 233 active; 17 roots, 284 streams; 73 HDS and
  358 legacy eventTypes).

### Added: a display `color` per valence stop of the mood converter

The five valence stops of `converters/mood` (0 / 0.25 / 0.5 / 0.75 / 1) carry an optional `color`: `#c62828`,
`#ef4444`, `#3b82f6`, `#16a34a`, `#15803d` (red for unpleasant, blue for neutral, green for pleasant). Each has
at least 3:1 contrast against white and against `#121212`, so one value serves both themes (`[CNVM12]`).
Display only: never the only carrier of meaning, and not a clinical rating. Rules in `documentation/MOOD.md`.
hds-lib's `_raw` method copies only `value` and `label` from a stop, so it is unaffected.

### Documentation: provenance on events, and the scope-change note on `consent/scope-update-cmc`

- New `documentation/PROVENANCE.md`: the index of HDS `clientData` keys, and the definition of two of them.
  **`clientData.hdsInstrument { id, name, brand?, model? }`**, the instrument a measure was taken with
  (mapped to FHIR `Observation.device` / `Device.manufacturer`, `modelNumber`, `deviceName`, and to HealthKit
  `HKDevice`). **`clientData.related.<eventId>: true`**, a link from a derived event to its source (a value
  read from a document, an answer to its request), generalised from `QUESTIONNAIRE.md` (FHIR
  `Observation.derivedFrom`). `hdsInstrument.id` is opaque, `[a-zA-Z0-9_-]`, at most 64 characters. Linked
  from `AGENTS.md`, `DESIGN-NOTES.md` and the README.
- `documentation/CUSTOM-FIELDS-AND-SYSTEM.md`: the `content.hds` block on `consent/scope-update-cmc`
  (`removed`, `added`, `asked`, `message`), which says what a person stopped or shared again, or what a declined
  request asked for, and carries the notice to the connection. A convention only: the mirrored schema is not
  changed; the permissions stay authoritative. `@pryv/cmc` `acceptScopeUpdate` / `refuseScopeUpdate` write a
  fixed content, so the block needs a helper (hds-lib) that writes the event itself; on a refusal the person's
  words stay in pryv's `reason`, not repeated in `hds.message`. A prototype's top-level keys (demo events
  before 2026-10-26) may be read as a fallback until the next minor release. `[ETLM-CMC-4]` checks that pryv's schema still accepts it under
  both validator flavours.

## [3.19.0] - 2026-10-26

### Changed: `eventTypes-legacy.json` mirror refreshed to pryv/data-types 1.3.2

Upstream commit `3190851ea5` (2026-10-20, "consent/revoke-cmc description … version 1.3.2"), fetched 2026-10-26 and
byte-verified against `https://pryv.github.io/event-types/flat.json`, `api.pryv.com/event-types/flat.json` (after its
redirect) and the commit itself. Byte-faithful copy. 356 → 358 types: **added** `consent/member-access-cmc` and
`consent/member-revoke-cmc` (group membership, platform-written; HDS writes neither). **Changed**, optional
properties and descriptions only: `consent/accept-cmc` (`acceptEventId`), `consent/request-cmc` (`membership` on a
permission entry), `consent/revoke-cmc` (server-written `acceptEventId`, `revokedAt`, `superseded`),
`consent/invalidate-link-cmc` (description: single-use invites can be withdrawn, server 2.0.0-rc.56). Nothing removed,
no `required` changed, no CMC type declares `additionalProperties`; `extras` / `classes` / `sets` unchanged. No
`$ref`, no key shared with `eventTypes-hds.json`. The cores already validate against this dictionary.

**Draft-07 caveat:** `consent/member-access-cmc` spells `expireAfter > 0` the draft-04 way (`"minimum": 0,
"exclusiveMinimum": true`), the dictionary's only such construct. The cores (ajv-draft-04) compile it; plain ajv 8
refuses the schema, so a consumer compiling every type under draft-07 throws on this one. The mirror cannot be
edited, so `[ETLM-AJV-1]` now pins it by its exact ajv message and `[ETLM-AJV-1b]` fails once upstream changes it.
`[ETLM-CMC-2]` now refuses any `*-cmc` key in `eventTypes-hds.json`, not only the ten HDS writes. Fable-reviewed.

## [3.18.1] - 2026-10-15

### Changed: cycle boundary items are `v1`; `clientData.hdsBasis` convention

`fertility-cycles-ovulation`, `fertility-cycles-period-end` and `fertility-cycles-fertile-window` move from
`version: temporary` to `v1` (no key, stream or eventType change: all three are written by bridge-mira and read by the
doctor-dashboard). Their devNotes, and `fertility-cycles-start`'s, now say how to write and read them: the period runs
from the start day through the period-end day inclusive, the fertile window from `time` to `time + duration`
inclusive by calendar day (Mira's 7-day window is the 6-day maximum duration), one ovulation event per cycle, and a
source that distinguishes predictions records `clientData.hdsBasis: 'predicted' | 'confirmed'` (absent = not
stated). `documentation/MENSTRUAL-CYCLE.md` states the convention and the phase derivation rules implemented by
hds-lib `cyclePhaseAt`. Fable-reviewed.

### Documentation: cycle day and cycle phase stay derived (B-2026-10-14-6)

`documentation/MENSTRUAL-CYCLE.md` records why there is no cycle-day or cycle-phase item: both derive from the
`fertility-cycles-*` items (cycle day in the patient's calendar days, phase from the boundary items with an explicit
confirmed / predicted / unknown basis), and a source's phase label, such as Mira's `current_phase`, stays in its raw
events. No definition change, nothing to publish.

## [3.18.0] - 2026-10-12

### Added: `version` on the published pack (B-2026-10-05-12 item 2)

`pack.json` and `version.json` now carry `version`, `package.json`'s semver, next to `publicationDate`. Consumers can
pin or compare the model they read (until now only a publication timestamp and, in `version.json`, a commit).
`scripts/deploy.sh` now refuses to publish when the build inputs (`definitions/`, `src/`, `package.json`,
`package-lock.json`) changed after the commit that last changed `package.json`'s version, and, after the build, when
the new version is lower than the live pack's or equal to it with different content. Versions before 3.18.0 are not
reliable pins: `852a5d0` changed the definitions after 3.16.0 without a bump and was deployed (gh-pages `2e0f69b`), so
3.16.0 was published with two contents; it would now be refused. Semver policy stated in README and `AGENTS.md`.
Additive: consumers read named keys only. Tests `[PVER-1]`, `[PVER-2]`. Fable-reviewed.

## [3.17.0] - 2026-10-09

### Changed: `eventTypes-legacy.json` mirror refreshed to pryv/data-types 1.2.1

Upstream commit `40a61450` (2026-10-08, "verification/email and email/string descriptions … version 1.2.1"), fetched
2026-10-09 from `https://pryv.github.io/event-types/flat.json` (`api.pryv.com/event-types/flat.json` now 301-redirects
there, so the two published URLs serve one file). Byte-faithful copy. 354 → 356 types: **added** `email/string` (the
account email address) and `verification/email` (read-only, server-derived proof state of the account email:
`verified`, `method`, `verifiedAt`; open-pryv.io rc.44 returns it with `:system:email`); nothing removed or changed;
`extras` / `sets` unchanged; `classes` gains `email` and `verification` (66 → 68; classes are not part of the published
pack). No `$ref`, no key shared with `eventTypes-hds.json`. 171 tests pass. Fable-reviewed (approved).

## [3.16.0] - 2026-10-08

### Added: `consents` root, `consent-record` item, `consent/record-v1` eventType (plan 91)

The account-level consent record lives in the user's own account: one append-only event per act
(`given`, `acknowledged`, `lapsed`; `withdrawn` is in the enum but reserved: withdrawing the health-data
consent is account deletion and writes nothing) on one version of one legal document (`terms`,
`privacy`, `health-processing`, `us-chd-privacy`, `us-chd-consent`). `consent-record` is a `system`
item on a new `consents` root that no app requests; the account app writes it with the personal
token. Closed eventType in the draft-04 subset, no free text; like every HDS type the schema is
advisory (the cores accept any content for it). See `documentation/CONSENTS.md`.

### Fixed

- `SYNC-STATUS.md` said the cores validate the `sync-status/connector-v1` enum; they validate no HDS
  type. Reworded.

## [3.15.0] - 2026-10-07

### Changed: `item.json` declares `references` and `referenceRange`

166 items carry `references` and 8 carry `referenceRange`, but the published item schema never
declared either. Both are now declared with the shape the items use: `references` maps a code system
(`snomed`, `loinc`, `icf`, `icd10`, …) to one code or a list of codes; `referenceRange` is `null` or
`{ source, lowerLimit, upperLimit, units, population }`. Every item in the pack already matches; the
only `pack.json` change in this release is the `fertility-cycles-period-end` label below.

### Fixed

- The loader refuses an item with an unknown top-level property (a misspelt key used to pass
  silently), and a schema error names the item and reads as text instead of `[object Object]`.
- `fertility-cycles-period-end` label: "End of period." → "End of period".
- README item example: it mixed `eventType` with `variations` and had no `version`, so the loader
  rejected it. A test now runs it through the schema. `AGENTS.md`: `inputs.yaml` is a draft, not
  loaded by the build.
- Dev dependencies: mocha 10 → 12 (drops chokidar 3 and its vulnerable `braces`), `brace-expansion`
  patched in range (Dependabot). `npm audit`: 0.

## [3.14.0] - 2026-10-07

### Changed: `eventTypes-legacy.json` mirrors Pryv's dictionary 1.1.3

Source: `pryv/data-types` `dist/flat.json` at commit **`5ecdc6c`** (merge of `a8167e8`), fetched
**2026-10-07**, byte-verified against both `https://pryv.github.io/event-types/flat.json` and
`https://api.pryv.com/event-types/flat.json`. **Additive, no migration:** 0 types added, 0 removed,
`extras` unchanged; four CMC types gain optional properties.

- `consent/request-cmc`, `consent/scope-request-cmc`, `consent/scope-update-cmc`: permission entries
  accept an optional boolean `optIn` (the consent UI opens the entry unselected; display-only, not to
  be combined with `mandatory`).
- `consent/accept-cmc`: new optional `features` (`chat`, `systemMessaging`: boolean or null), the
  relationship's channels as the platform reads them; `extra` is now described as deprecated and
  ignored by the platform (still accepted, so stored events stay valid).

The cores load their dictionary from the same URL (`service.eventTypes`); this brings the mirror
back in step with it.

### Documentation

- `SYNC-STATUS.md` rule 1: `contribute` on its leaf is the level a connector needs (events only, no
  stream management); `manage` also works. Plain-access connectors (bridge-tempdrop) request
  `contribute` in their catalogue `permissions`; CMC connectors keep `manage` for now.

## [3.13.0] - 2026-10-02

### Added: a connector's status, readable from the user's own account (site-agents#19)

An app the user authorised (first: Cycle Intelligence) needs to show whether a connected service
such as Mira is working — connected, needs reconnecting, last synced when — and it must read that
from the user's account with an ordinary permission, not by calling the bridge. Until now the only
status a bridge wrote was its resume watermark, on the bridge's **own** account, where no app can see
it.

- **New root stream `sync-status`** ("Connected services"), with one `role: context` leaf per
  catalogue connector: `sync-status-mira`, `-tempdrop`, `-femm`, `-ryb`, `-cyclefeminin`,
  `-healthkit`. Leaf names stand alone ("Mira connection status") because a consent screen shows the
  leaf without its parent.
- **New item `sync-status`** on that root, eventType `sync-status/connector-v1`, `repeatable: once`.
  A connector places its single event on its own leaf (D3 context, as `treatment-fertility` does)
  and updates it in place.
- **New eventType `sync-status/connector-v1`**: a closed object with `status`
  (`active` / `needs-reauth` / `error` / `disconnected`), `connectedAt`, `lastRunAt`, `lastSuccessAt`,
  `syncedUntil` and `lastError { class, code?, at }`, times in Unix seconds. `lastError.code` is
  constrained to a short operator code, so a writer cannot pass a partner's error message through. No
  `if`/`then`: the cores compile with `ajv-draft-04`.

**Privacy rule: apps request read on the leaf, never on the item or the root.** Read on
`sync-status` is inherited by every leaf and would tell an app every service the user has connected.
Requesting the one leaf it supports shows it that connector and nothing else.

`documentation/SYNC-STATUS.md` documents the tree, the status semantics, the rules (unknown status
renders as unknown; one event per leaf, latest wins) and how this differs from the two writer-private
watermarks. The `sync` app-stream comment and the `sync-status/bridge` description now say so too: a
bridge's resume watermark stays on the bridge account, and only its user-visible status goes to
`sync-status`.

### ⚠ Consumer-facing: a new item `type` value, `system`

`sync-status` is the first item that is **not user input**. It carries `type: system`, a new value in
the item `type` enum, and the loader requires a `system` item's eventType to be an object. `system` is
an item type only, never a composite field type.

**Every consumer that lists, picks, renders or maps items must skip `type: system`.** A consumer that
switches on `type` and throws on an unknown value will break on this pack; one that renders it would
show raw status JSON in a form or diary. The item stays fully resolvable (`forKey`, `forEvent`) and
requestable. hds-lib exposes `HDSItemDef.isSystem` and drops system items from `getAllActive()`, which
hides it from most pickers at once. **Deploy these before the pack is deployed** (consumers load the pack at runtime, so deploying it
flips every live app at once): **hds-lib** (then its consumers rebuilt on it), **hds-webapp** (diary),
**hds-forms-js** (form spec and field renderer), **doctor-dashboard**, **bridge-redcap** (field mapping)
and **app-web-user-account** (consent row label).

Counts: 297 items (232 active), 16 roots and 283 streams, 71 HDS eventTypes.

## [3.12.0] - 2026-09-23

### Added: `select` works over any numeric eventType, not just the `ratio/*` pair

The loader had branches for a `select` on a **string** eventType, on `ratio/generic` and on
`ratio/proportion` — and nothing else. Any other numeric eventType fell through to the catch-all
throw, so the only way to offer named numeric answers was a bare `type: number` box.

`checkItemVsEvenType` now carries a generic branch: option values must be numbers, and each is checked
against the eventType's own `minimum` / `maximum`. The two `ratio/*` branches are unchanged and still
take precedence — they carry rules this one does not (the derived denominator, the non-negative
numerator). `[NSEL-9]` and the existing `[RGEN-REJ]` tests guard against them being shadowed:
`[NSEL-9]` covers `ratio/proportion`, while `ratio/generic` is covered by `[RGEN-REJ]`, since the
generic branch would reject its object-typed eventType outright.

### Fixed: the two home-test items are no longer bare number boxes

`fertility-test-opk` and `fertility-test-pregnancy` are `test-result/scale` items on a -1 / 0 / 1
scale. That eventType publishes **no labels**, and 3.11.0 correctly moved the scale description out of
the item `description` under §6b — which left nothing user-facing saying what to type. Both are now
`type: select` with Negative / Indeterminate / Positive. `BUGS.md` `B-2026-09-23-3`.

**This is not a storage-identity change.** Both keep the same `streamId:eventType` pair, so every
stored event still resolves to the same item and nothing needs migrating.

**One thing to know before rendering:** `test-result/scale` admits the whole -1..1 continuum, and the
three options are the *human-entry* surface. A device bridge does write intermediate values — the
hds-webapp HealthKit bridge maps an "estrogen surge" to `0.5` on `fertility-test-opk` — and such a
value matches no option.

A controlled `<select>` whose value matches nothing renders **blank**, and under native form validation
a `required` field then forces the user to overwrite the reading to submit. **`hds-forms-js` 0.19.0
handles this**, showing an unmatched stored value as an extra read-back option; it ships alongside this
release and consumers should take both together. A renderer that does not do this will lose those
readings on the next edit.

## [3.11.0] - 2026-09-23

### Coherence pass — descriptions, localisation, domain docs and stale counts

No stream, item key or eventType changed. This release is entirely about the **published text** of the
model and the documentation around it, closing six findings from the plan 100 coherence review (F2, F5,
F6, F7, F8, F9).

**F5 — `description` is one short user-facing sentence again (22 items).** `AGENTS.md` §6b has always
said so, and 22 active descriptions broke it, the worst at 75 words and six sentences. Every one is
rewritten, and the maintainer knowledge that was living in them moved to `devNotes`, the field that
exists for it — **`devNotes` goes from 13 items to 39**. Several descriptions leaked storage detail
outright, including `body-semen-morphology-normal`, whose old text is the verbatim ❌ example
`AGENTS.md` uses to teach the rule and which had shipped live regardless.

Where a detail is something the **user must act on**, it stayed in the description rather than moving:
`fertility-cycles-start` still says "full bleeding (not just spotting)", because that is the judgement
the person makes on day one.

**F6 — localisation is complete.** French descriptions were missing on 39 active items, four option sets
were plain English scalar labels rather than `{ en, fr }` objects, and the `variations.eventType` unit
pickers on `body-weight`, `body-height` and `profile-avatar` were English-only. Active-item coverage is
now **100% on labels, descriptions, options and unit variations**. Several English strings were fragments
or ungrammatical ("Number of children at this date", "When a women is considered a fertile", two
malformed `fertility-ttc-tta` options) and were repaired while being localised.

**F9 — every active domain now has a `documentation/<DOMAIN>.md`.** Five were missing:

- `PROFILE.md` — durable identity facts; why `profile-name` and `profile-surname` legitimately share a
  stream, and why `profile-avatar` has no item-level `eventType`.
- `CONDITION.md` — the four-way split between `condition` / `finding` / `procedure` / `treatment`, and
  the open question of a status field.
- `FINDING.md` — records that **the `finding` root's scope is undecided** rather than inventing one, with
  the concepts that sit uncomfortably and a rule not to add items on the strength of the word alone.
- `NUTRITION.md` — the `nutrition` (state) vs `lifestyle-diet` (choice) boundary, and why
  `nutrition-appetite`'s 0.25 / 0.50 / 0.75 placement does not transfer to quantity or frequency scales.
- `FAMILY.md` — why a children count is not derivable from `fertility-delivery` in either direction.

**F8 — the documentation counts were wrong by ~3x and are now measured.** `README.md` claimed 92 items
and 12 streams against 296 and 276; `AGENTS.md` claimed ~73 items, ~36 streams and ~66 HDS eventTypes.
Both now carry the real numbers, split active / total, with the per-file item table rebuilt — it was
missing four files entirely (`condition`, `finding`, `lifestyle`, `symptom-domains`).

**F7 — encoding-reference coverage 66% → 70%**, adding SNOMED CT to 11 items where an active,
semantically correct concept exists. Not further: the obvious concepts for sperm vitality, progressive
motility and most exercise types are either **inactive** in the current International release or have no
concept at all. Notable trap found and avoided: both `16386004` "Dry skin" and `416247002` "C/O: dry
skin" are inactive, so `body-skin-dry` references `52475004` Xeroderma.

**F2 — `relativeTo` is documented as overloaded.** It is a *number* (the ratio denominator) in
`ratio/generic` content and a *string* (an anchor item key) in `reminder.relativeTo`. Renaming either is
breaking, so `AGENTS.md` now carries the disambiguation table and tells you to grep for
`ratioRelativeTo` instead.

### Corrections caught in review, worth knowing

- `fertility-cycles-fertile-window` carries a **mandatory duration** capped at six days: the event *is*
  the window, not a day within it. Its description said the latter and now says the former.
- `fertility-sexual-activity`'s `fertile` option contrasts with `condom` / `withdrawal` / `protected`, so
  it means *complete unprotected intercourse*, not *intercourse during the fertile window*. Both labels
  now say so, and the item description no longer implies that protected intercourse should not be
  recorded.

## [3.10.0] - 2026-09-23

### Added: the `lifestyle` domain — tobacco, alcohol and diet

The model had no coverage of tobacco, alcohol or diet; the only lifestyle-adjacent item was
`nutrition-appetite`. (Other health-related behaviours were already covered — `activity-*` for physical
activity, `fertility-sexual-activity` — this fills the three that were missing.) This adds a top-level `lifestyle` stream with 8 items across three subdomains,
documented in [`documentation/LIFESTYLE.md`](documentation/LIFESTYLE.md).

**Streams** — `lifestyle` → `lifestyle-tobacco` (Tobacco and nicotine) / `lifestyle-alcohol` /
`lifestyle-diet`, each with one leaf stream per item. Leaf streams are what D3 walk-up and
authorizations grant on, so a study can request drinking frequency without heavy-episode frequency.

**Items**

| item | eventType |
|---|---|
| `lifestyle-tobacco-smoking` | `lifestyle/use-status-v1` |
| `lifestyle-tobacco-ecigarette` | `lifestyle/use-status-v1` |
| `lifestyle-tobacco-smokeless` | `lifestyle/use-status-v1` |
| `lifestyle-alcohol-frequency` | `lifestyle/frequency-band-v1` |
| `lifestyle-alcohol-typical-quantity` | `mass/g` (legacy) |
| `lifestyle-alcohol-binge-frequency` | `lifestyle/frequency-band-v1` |
| `lifestyle-diet-pattern` | `lifestyle/diet-pattern-v1` |
| `lifestyle-diet-restriction` | `lifestyle/diet-restriction-v1` |

**Four new eventTypes**, not one per item:

- `lifestyle/use-status-v1` — `never` / `former` / `current`, shared by all three tobacco items. A coded
  status, which is the shape SNOMED and FHIR use for smoking status, not a severity ratio.
- `lifestyle/frequency-band-v1` — the union of nine coded frequency bands. AUDIT-C Q1 and Q3 each select
  their own five; the loader validates that item options are *in* the enum without requiring them to
  cover it, so the subset is an item-level constraint rather than a second type. Future habitual-frequency
  items land here too.
- `lifestyle/diet-pattern-v1`, `lifestyle/diet-restriction-v1` — the latter an array, a complete dated
  snapshot per event, same convention as `fertility/tracking-method-v1`.

**Alcohol quantity is stored in grams of ethanol on the legacy `mass/g`.** A standard drink is 8 g in the
UK, 10 g in Australia and France, 14 g in the US, so a stored drink count is not comparable across
cohorts. A new lifestyle-scoped grams type would be numerically identical to `mass/g`, which is the
equivalent-twin hazard `AGENTS.md` forbids. `mass/g` declares no minimum of its own, so the item declares
`min: 0`; note that `hds-forms-js` does not yet enforce a published `min`.

**Not in v1, deliberately:** tobacco quantity (does not generalise across the three tobacco items;
pack-years is derived), dietary intake frequency (that is a food-frequency questionnaire, which belongs in
a form template), and unknown / declined answers (those live on `questionnaire/answer-v1`).

All SNOMED codes were verified active against a SNOMED CT International release via `reference/snomed-db`;
several obvious candidates turned out inactive and are listed in the domain doc so they are not retried.

## [3.9.0] - 2026-09-22

### Added: the model now owns the `ratio/generic` denominator

`ratio/generic` is a legacy Pryv type whose schema is an object with two required properties,
`{ value, relativeTo }`. An item that declares it with `type: select` lists scalar `options[].value`
entries, so those are **numerators**: what a consumer stores is
`{ value: <chosen option>, relativeTo: <denominator> }`.

The denominator is `max(option values)`. Until now that rule lived **only in `hds-forms-js`**
(`src/schema/eventData.ts`), which derives it generically. data-model owns the option list the rule is
derived from, but neither stated nor validated it, so every other consumer either re-derived it or
hardcoded a constant.

**Items now publish `ratioRelativeTo`.** Read it; do not re-derive it and do not hardcode it.

```js
const itemDef = model.itemsDefs.forKey('fertility-ttc-tta');
content = { value: chosen, relativeTo: itemDef.data.ratioRelativeTo };   // 10
```

**Why it needed fixing even though nothing was broken.** Every hardcoded constant in the wild matched
the derived value (`2` for the three deprecated `body-vulva-*` items, `10` for `fertility-ttc-tta`), so
the convention was being followed. The hazard is divergence on the next edit: add one option and a
consumer that derives starts writing the new maximum while one that hardcodes keeps writing the old, so
**the same item carries two different denominators** and `value / relativeTo` stops being comparable
across writers, with nothing erroring. Plan 100, finding F1.

**Derived, never authored.** `addItem` throws if an item declares `ratioRelativeTo`, so the option list
stays the single source of truth and the two cannot disagree. The field is computed after the item has
been validated against its eventType, so it only ever exists on a scale already known to be non-empty,
numeric, non-negative and topped by a positive value. It is declared in the published
`json-schemas/item.json`, which describes the items in `pack.json`.

### Changed: stricter validation for `ratio/generic` select items

A `ratio/generic` select must now declare at least one option, and no option value may be negative, and
the largest must be finite and `> 0`. A zero or absent maximum would make every stored ratio undefined.
The existing corpus passes unchanged.

### Documentation

`AGENTS.md` gains a section on the object contract, the denominator rule, and the one limit the rule
implies: the scale's top anchor must itself be a selectable option, so a 0..10 scale offering only
`0, 2, 4, 6, 8` is not expressible as a `ratio/generic` select. It also states the default: prefer
`ratio/proportion` for anything new, since it stores a plain number and carries the hook-placement rule.

Reviewed by a Fable subagent per the data-model directive: approved, with its two required changes
applied before commit (refuse an authored `ratioRelativeTo` rather than silently overwriting it, and
declare the field in the published item schema), plus its optional tidiness (derive after validation
rather than before, and guard against a non-finite maximum).

## [3.8.0] - 2026-09-18

### Deprecated: `body-vulva-wetness-wiping`

Superseded by `body-vulva-mucus-inspect`. Existing events stay readable and keep validating; the item
is simply no longer offered for creating new ones.

**Why.** Plan 48 deprecated the two items that duplicate a dimension of the 9D cervical-fluid
converter, `body-vulva-mucus-stretch` (`stretchability`) and `body-vulva-wetness-feeling`
(`sensation`), and removed `bridge-chartneo`'s standalone `TestID` write at the same time. It left
`body-vulva-wetness-wiping` active with no recorded reason, and left the bridge writing both wetness
items. Plan 16 had deliberately kept those per-field converters, so plan 48 half-unwound an earlier
decision rather than simply overlooking this one. Found by the plan 100 coherence review, finding F10,
after a question about whether the wetness items should defer to the mucus item.

**Nothing is lost, and the mechanism matters.** In the chartneo converter method both `walking` and
`wiping` write the same three dimensions (`sensation`, `wetness`, `lubricative`) with
`vectorMerge: max`, so the vector holds `max(walking, wiping)` rather than isolating wiping. What
makes the deprecation lossless is that the raw per-field observation is preserved separately on the
event's `content.source.sourceData`.

**Writers at deprecation time.** `bridge-chartneo` stopped on 2026-09-18 (it was already folding
`WipingID` into the vector, so it had been storing the observation twice per day).
`reference/sample-datasets` `src/datasets/full-model.ts` still writes it, alongside other
already-deprecated items; that generator is unaffected, since writing to a deprecated item remains
permitted.

**No schema, eventType or stream change.** The item keeps its `streamId` and `ratio/generic`
eventType, so no `streamId:eventType` pair moves and `findItemForEvent` is unaffected.

Reviewed by a Fable subagent per the data-model directive: approved, with three corrections applied
before commit (the rationale moved into a consumer-visible `description` per `AGENTS.md:382`; a false
claim that chartneo was the only writer; and an oversimplified account of how the dimensions merge).

## [3.7.2] - 2026-09-18

Packaging and deploy-gate housekeeping. **No definition, schema or pack content change.** Nothing
published at `model.datasafe.dev` differs, and `version.json` carries the git commit rather than this
version, so no consumer observes the bump.

### Fixed: `package.json` declared a `main` that does not exist

`"main": "src/index.js"` was declared and there is no `src/index.js`. Nothing broke, because
consumers read the built pack over HTTP rather than importing the package, but the declaration
advertised an import path that could only ever fail. `reference/sample-datasets` does carry
`data-model` as a git dependency in its `package.json` (unused by its source today), so the first
`require()` was a plausible next step rather than a hypothetical one.

The field is removed rather than backfilled with a re-export barrel: the modules under `src/` are the
build's own loaders, not a public API, and the repo publishes a pack. README now says so explicitly
under "How this repo is consumed".

### Fixed: `scripts/deploy.sh` now fails closed on a red test suite

`deploy.sh` built, ran the consumer contract check and pushed `dist/` to `gh-pages` without ever
running `npm test`. CI runs the suite on the push, not as a gate on the deploy, so a deploy that
raced CI published whatever built regardless of what the tests said. The tripwire tests added in
3.7.0 (`tests/eventTypesLegacyMirror.test.js`) exist precisely to catch definition defects nothing
validates server-side, and the deploy did not consult them.

`npm test` now runs before the build and aborts the deploy on failure. It is safe there because the
suite builds `dist/` itself (`tests/converters.test.js` requires `src/build` at load time), so the
pack assertions read output built from source rather than the previously-published pack restored by
the `dist/` reset.

`npm run lint` is gated alongside it, for the same reason: CI was the only thing running it, so a
deploy racing CI could publish lint-red code.

### Changed: dead `--test-reporter=spec` flag dropped from the test script

`"test": "mocha tests --test-reporter=spec"` passed Node's test-runner flag to mocha, which ignores
it and uses its own default reporter (also `spec`). Inert, but it read as configuration. Now plain
`mocha tests`, with identical output.

The other half of the original report, refusing to deploy from a dirty working tree, was already
implemented and needed no change: `deploy.sh` has required `main` and a clean tree since before this
entry was filed.

## [3.7.1] - 2026-09-17

Housekeeping. One YAML parser instead of two. **No definition, schema or pack content change:**
the rebuilt `dist/pack.json` is byte-identical to 3.7.0's apart from `publicationDate`.

### Changed: `js-yaml` removed, everything now parses through `yaml`

The repo depended on two YAML parsers and used each in different files: `js-yaml` in
`src/conversions.js`, `src/appStreams.js`, `src/converters.js` and `src/settings.js`, and the
declared `yaml` in `src/streams.js`, `src/items.js` and `src/datasources.js`. The four `js-yaml`
call sites (plus one in `tests/customFieldsAndSystem.test.js`) now use `yaml`, and `js-yaml` is gone
from `dependencies`.

**Why it mattered.** Two parsers means two sets of parsing semantics over the same `definitions/`
tree, in a repo whose entire purpose is to be one source of truth. Two of those differences change
what a definition file *means*, rather than merely how an error reads:

- **Unquoted ISO dates.** `js-yaml` coerces `d: 2026-09-17` to a `Date` (which serialises into the
  pack as `2026-09-17T00:00:00.000Z`); `yaml` keeps the string `2026-09-17`. The `yaml` behaviour is
  the one a JSON pack wants.
- **Merge keys.** `js-yaml` expands `<<: *base` into the parent mapping; `yaml` follows YAML 1.2 and
  keeps a literal `"<<"` key. **So merge keys must not be used in definition files.** Plain anchors
  and aliases behave identically in both and remain fine.

Duplicate keys and multi-document files throw under *both* parsers, so neither was ever at risk, and
`on` / `off` / `yes` / `no` are plain strings in both (that coercion was `js-yaml` 3 behaviour, not 4).

### Fixed: an empty `appStreams.yaml` would have published `null` silently

Not a pre-existing bug; a regression this migration would have introduced, caught in review and
closed in the same change. `src/appStreams.js` passes its parsed content straight to the pack writer
rather than indexing into it, so it is the one loader that does not fail on its own. For a zero-byte
file `js-yaml` returned `undefined`, which `JSON.stringify` refused and the build died loudly, while
`yaml` returns `null`, which would have been written out as `"appStreams": null`. That matters
because `scripts/deploy.sh` runs the build and the consumer check but **not** the test suite, so the
`[CFS-AS]` assertion that would have caught it is not in the deploy path. The loader now throws
unless the parsed content is a mapping.

**How it was verified.** Reasoning about the two schemas is not proof, so before changing anything
every definition file the build reads (43 of the 45 on disk; `inputs.yaml` and
`hl7-defaults/category.yaml` are read by nothing in `src/`) was parsed with **both** parsers and the
results deep-compared: 0 differences. The divergences listed above are real but appear in none of
today's files, which is exactly why they are written down here rather than left to be rediscovered. After the migration, the built pack was byte-compared against the pre-change build, and
`npm ci --omit=dev` plus a build was run in a clean checkout to confirm the production dependency set
is now sufficient. That last check is the one that would have failed before 3.7.0, when `js-yaml` was
undeclared and arrived only through `eslint` / `mocha`.

## [3.7.0] - 2026-09-17

Mirrors Pryv's published event-type dictionary (1.1.0 → 1.1.2) and repairs three HDS-side
definition defects the new tests surfaced. **Additive, no migration.** No key, `streamId` or
`eventType` is removed or renamed, and no stored event becomes invalid.

### Changed: `eventTypes-legacy.json` is now a faithful 1.1.2 mirror

Source: `pryv/data-types` `dist/flat.json` at commit **`02a0873`**, fetched **2026-09-17**,
byte-verified against both `https://pryv.github.io/event-types/flat.json` and
`https://api.pryv.com/event-types/flat.json`.

**Pin the SHA, not the version string.** 1.1.2 is *untagged* upstream (tags stop at 1.1.1) and
`dist/flat.json` moved four times on 2026-09-17, with two different byte-contents both carrying the
label "1.1.2". The version field alone does not identify what was mirrored.

**15 types added**, 0 removed, `extras` byte-identical (260 keys):

- CMC consent lineage: `consent/request-cmc`, `consent/accept-cmc`, `consent/refuse-cmc`,
  `consent/revoke-cmc`, `consent/back-channel-cmc`, `consent/scope-request-cmc`,
  `consent/scope-update-cmc`, `consent/invalidate-link-cmc`
- CMC messaging: `message/chat-cmc`, `notification/alert-cmc`, `notification/ack-cmc`
- Crypto: `encrypted/aes-256-gcm`, `encrypted/ecies-aes-256-gcm`, `shared-secret/item`
- Calendar: `calendar/ical-event`

Four of these (`consent/request-cmc`, `consent/accept-cmc`, `message/chat-cmc`,
`notification/alert-cmc`) were **already written by HDS code** (hds-lib-js, doctor-dashboard,
hds-webapp, bridge-mira, bridge-redcap) while the pack did not declare them. This closes that gap.

**5 types changed, all upstream repairs, none used anywhere in HDS:**

| Type | What changed |
|------|--------------|
| `audiogram/data` | `start`, `end`, `metadata` and `required` were misnested inside `properties.sensitivityPoints.items`; moved to the type's top level |
| `clinical/fhir` | `required` was misnested inside a sub-property; moved to the top level |
| `numset/*` | `additionalProperties` was the **string** `"false"` (truthy, so it enforced nothing); restructured so the pattern matches `{ key: { "type/unit": number } }` |
| `contact/facebook` | `additionalProperties` was the **string** `"true"`; now boolean `true` |
| `encrypted/aes-text-base64` | Description only: marked deprecated in favour of `encrypted/aes-256-gcm`. Schema unchanged |

The first four did not compile under ajv at all, so any consumer compiling them threw. They are now
valid. `numset/*` remains inert on the cores regardless: `isKnown()` is a plain lookup with no
wildcard resolution, so no real event ever matches the literal key `numset/*`.

### Ownership boundary: `*-cmc` types are upstream's

`@pryv/cmc` hardcodes all ten `ET_*` constants and pryv's dictionary owns every `*-cmc` key.
**Never copy one into `eventTypes-hds.json`**: `src/eventTypes.js` throws on a duplicate key across
the two files, so a copy breaks the whole build. HDS owns only the `content.hds` sub-envelope
convention. Test [ETLM-CMC-2] enforces this.

### Fixed: `medication/prescription-v1` used a `$ref` that cannot resolve

`posology.frequency` was `{"$ref": "#/types/frequency~1times-period"}`, the only `$ref` in either
dictionary. Event-type schemas are compiled one at a time with no dictionary root to resolve
against, so `#` is the type schema itself and the pointer is unresolvable: the compile throws.
Upstream's 354 types contain no `$ref` at all. The referenced schema is now inlined, structurally
identical to the standalone `frequency/times-period` type, and [ETLM-INLINE-1] keeps the two copies
from drifting.

**No stored data is affected and nothing was rejected in production.** HDS custom types are absent
from pryv's dictionary, so cores treat them as unknown and skip content validation entirely; nothing
on the HDS side compiled these schemas either. This was a latent defect, caught by the new tests.

### Fixed: two `appStreams.yaml` eventTypes were declared nowhere

`appStreams.yaml` named `message/hds-chat-v1` (the `chat` stream) and `settings/hds-react-timeline`
(the `webapp-settings` stream), neither of which existed in either dictionary, and
`src/appStreams.js` never checked. Both are now declared:

- **`message/hds-chat-v1`** is typed as a plain `string`, matching how hds-webapp reads it
  (`DiaryItem.ts`). It is marked **deprecated, read path only**: nothing writes it any more, it is
  superseded by upstream's `message/chat-cmc` (whose content is an object), and it stays declared so
  existing conversations remain resolvable.
- **`settings/hds-react-timeline`** documents the known keys of the component's `TimelineSettings`
  interface (`items`, `groupings`, `rowOrder`, `mergedRows`, `rowHeights`, `scale`,
  `scaleMultiplier`) but deliberately sets **no `required`** and permits additional properties. The
  shape is owned by `hds-react-timeline`, not by this model; enforcing it here would make every new
  setting the component adds unwritable until the model was republished.

### Fixed: `questionnaire/request-v1` was not compilable by the platform's own validator

`scope.withinDays` used `"exclusiveMinimum": 0`, the draft-06+ numeric spelling. open-pryv.io
validates with **`ajv-draft-04`**, where `exclusiveMinimum` is a boolean modifier on `minimum`, so
the whole schema failed to compile there while compiling cleanly under every draft-07 validator we
had been checking with. It is now `"minimum": 1`, which is spelled identically in both drafts.

**Not a narrowing in practice.** The only producer, hds-forms-js's `QuestionnaireBuilder`, already
clamps the field with `min={1}` and `Math.max(1, …)`, and the documented semantics are "within the
past N days". The new bound excludes only the open interval (0, 1), which nothing can emit.
Fractional day counts above 1 stay valid, so `type` remains `number` rather than `integer`.

Tests [ETLM-AJV-3] and [ETLM-AJV-4] now compile **every** schema under `ajv-draft-04` as well as
draft-07, so the portable subset is enforced rather than assumed.

### Fixed: `js-yaml` was an undeclared dependency

`src/conversions.js`, `src/appStreams.js`, `src/converters.js` and `src/settings.js` all
`require('js-yaml')`, but it was never declared: it arrived transitively through `eslint` and
`mocha`, so `npm ci --omit=dev` produced an install where the build throws. Now declared in
`dependencies`.

The repo still uses two YAML parsers (`js-yaml` in those four files, the declared `yaml` in
`src/streams.js`, `src/items.js` and `src/datasources.js`). Consolidating onto one is left as a
separate change, since the two have different APIs and this release is not the place to retest that.

### Fixed: public repo no longer points into private workspace paths

This repository is public. `AGENTS.md`, `CHANGELOG.md` and three files under `documentation/`
carried `_plans/…` and `_macro` workspace paths, which leak internal structure and resolve to
nothing for an outside reader. The references are reworded; no content was lost.

### Fixed: builds are now reproducible

`converters[].updatedAt` and each converter version's `updatedAt` were `new Date()` taken at build
time, so **every** `npm run build` rewrote `dist/pack.json` even with no definition changed, burying
real changes in timestamp noise. They now derive from the source files' modification times. Two
consecutive builds of unchanged definitions are byte-identical apart from the top-level
`publicationDate`, which is genuinely a publication timestamp and stays as it is.

Caveat: mtime is checkout time on a fresh clone, so this is stable *within* a working tree rather
than globally reproducible.

### Added: mirror and definition tripwires (`tests/eventTypesLegacyMirror.test.js`)

Ten tests, so the next dictionary refresh fails loudly instead of silently:

- **[ETLM-AJV]** every legacy and HDS schema compiles under ajv. This is what would have caught
  1.1.0's four broken schemas.
- **[ETLM-REF]** no schema in either file uses `$ref`.
- **[ETLM-CMC]** all ten CMC types are present, none is duplicated into the HDS file, and
  `notification/alert-cmc` does **not** set `additionalProperties: false` (plan 90's data-export
  envelope rides extra fields on it; if upstream ever tightens this, the CMC plugin would reject
  every HDS data-export request and nothing would notice until runtime).
- **[ETLM-APPS]** every eventType named in `appStreams.yaml` is declared.
- **[ETLM-KEYS]** the legacy and HDS `types` and `extras` key sets stay disjoint.

## [3.6.0] - 2026-09-17

One schema addition and two documentation corrections. **Additive, no migration.** No key,
`streamId` or `eventType` is altered; the new block is optional, and every existing event stays
valid without it.

### Added — `duration` on both `medication-intake-*` items

`medication-intake-basic` and `medication-intake-coded` gain an optional `duration` block
(`mandatory: false`, `canBeNull: true`, `maxSeconds: 315360000`), matching the block
`treatment-basic` / `treatment-coded` have carried since 1.8.1.

**Why:** `medication/coded-v1` describes itself as mapping to FHIR `MedicationStatement`, a
span-bearing resource, yet no span was expressible through the item. "On drug X from 2010 to 2016"
had nowhere to go.

**Both items, deliberately.** They sit on the same `medication-intake` stream and `medication/basic`
is documented as following the same `intake` structure as `medication/coded-v1`, so they are one
concept at two fidelities. Giving a span to one and not its twin would show a duration picker for
one item only, with no clinical reason. It also matters practically: every bridge that writes
medication events today (mira, femm, cycles-files) writes the *basic* item, so a coded-only change
would have given the span to the item nobody writes.

**Two things a consumer should know:**
- **`duration: null` is the encoding for ongoing use**, not a very long span. A current, indefinite
  course (thyroid replacement, a statin) is `null`, which `canBeNull: true` permits.
- **`maxSeconds` is a UI hint, not a validated constraint.** Nothing in hds-lib, the pack schema, or
  the server rejects a stored event whose duration exceeds it; only a form component uses it to show
  an inline error. The 10-year figure is carried over from `treatment-*` for consistency. It only
  bites on a *closed* historical span longer than 10 years, and raising it later touches no key, no
  eventType and no stored event.

**`medication-prescription-coded` is deliberately excluded.** Not an oversight. `duration` on a
prescription is ambiguous between three different facts: validity period
(`MedicationRequest.dispenseRequest.validityPeriod`), expected supply duration, and course length
(`dosageInstruction.timing.repeat.boundsDuration`). `medication/prescription-v1.posology` carries
`frequency` / `asNeeded` / `note` and no span field, so nothing there is currently contradicted.
Picking one meaning silently is a modelling decision, not a bug fix; it is left to a dedicated
design pass. Adding the block later will be exactly as additive as this change, so deferring costs
nothing.

### Fixed — `TREATMENT-PROCEDURE.md` drew a context shape the model cannot resolve

The cross-tree context naming section drew `medication/medication-fertility/` as the medication-side
shape "when medication subtree adopts the pattern". **No such context can work.** D3 resolves an
event by walking up its streamId's ancestors to the first registered itemDef, and nothing registers
at the bare `medication` root: the two intake items register at `medication-intake` and the
prescription item at `medication-prescription`. A context hung under `medication` has no itemDef in
its ancestor chain, so `findItemForEvent` returns `null` and `eventTemplate({ context })` throws.

The section now prescribes `medication-intake/medication-intake-fertility/`, marks it (and the
`note/note-fertility/` line) as not currently defined, notes the `tags/hds/fertility` alternative
from `TAGS.md`, and warns against "fixing" it by registering a coded item at bare `medication`,
which would make the same intake writable two incompatible ways.

### Fixed — stale path in `AGENTS.md`

The file-orientation header read `data-model/data-model/`, the double-nesting layout retired
2026-07-11.

## [3.5.0] - 2026-09-15

One schema addition and a documentation correction, both from site-agents#4. Nothing existing
changes: no key, `streamId` or `eventType` is altered, the new property is optional, and nothing
needs migrating.

### Added — `robotAssisted` on both procedure eventTypes (site-agents#4 item 16)

`procedure/basic` and `procedure/coded-v1` gain an optional `robotAssisted` boolean, alongside the
`count` / `findings` / `notes` trio they already share. **Absent means not recorded, not `false`.**

**Deliberately a boolean, not a surgical-approach enum.** A six-value `approach`
(open / laparoscopic / robotic / hysteroscopic / vaginal / percutaneous) was drafted and rejected in
review: `robotic` is a *narrowing* of `laparoscopic`, not a sibling, so a single-select would make
`approach === 'laparoscopic'` silently drop every robot-assisted case, and a robot-assisted
hysteroscopic or transvaginal procedure could not be expressed at all. Every standard keeps the two
axes apart — ICD-10-PCS has an Approach character and codes robotic assistance as a separate
qualifier, SNOMED pre-coordinates it into the procedure concept (no standalone qualifier value
exists), and FHIR `Procedure` would carry it under `usedCode`. Splitting a shipped enum later would
mean rewriting stored `content`, which the deprecated-alias mechanism cannot do.

**Residual a consumer should know about:** SNOMED pre-coordination means a user can select
`708877008` ("laparoscopic total hysterectomy using robotic assistance") *and* leave `robotAssisted`
unset, or set it to `false`. The schema cannot catch the disagreement; read the code's FSN when the
distinction matters.

### Changed — documentation only

- `TREATMENT-PROCEDURE.md` now states that **ART cycle counts have no items of their own**: "how many
  IVF cycles" is `treatment-coded` at context `treatment-fertility` with `count: N`, the shape the
  STORMM Q16 worked example already describes. Two `fertility-art-*` count items were drafted for
  site-agents#4 item 12 and **rejected in review** — they would have forked a concept that is already
  published, seeded and consumed, leaving IVF history writable two incompatible ways. Records why,
  and why the regimen code rather than a retrieval rule decides the bucket (a retrieval boundary
  strands cancelled and natural-cycle IVF).
- `TREATMENT-PROCEDURE.md` payload tables corrected: they still listed `period: { start, end }` and
  `performed: { date }`, both removed from the schemas in 1.8.1 in favour of the Pryv-native
  `event.time` + `event.duration`. The Flavour B description is corrected to match.
- The worked example cited SCTID `63487001` for In vitro fertilization. That concept is *Assisted
  fertilization*; IVF is `52637005`, which is what the datasets-service seed itself uses. Corrected
  here and in the seed's README.

## [3.4.0] - 2026-09-15

Three additions, batched into one publish because all three were blocked on it. Nothing existing
changes: no key, `streamId`, `eventType` or behaviour is altered, and nothing needs migrating.

### Added — presence twins for anxiety and stress, so an ungraded report stops being given a grade (B-2026-09-15-7)

`wellbeing-mental-distress-anxiety` and `-stress` were `ratio/proportion` **only**. A source that
reports "anxious" with no grade therefore had nowhere correct to write: `0` contradicts the report,
any positive value invents a grade, and skipping loses it. `bridge-mira` wrote **0.25** — which on
the graded item is literally the option **"Slightly anxious"** — so an ungraded report was stored
indistinguishably from a real answer by the subject.

Adds `wellbeing-mental-distress-anxiety-presence` and `-stress-presence` (`activity/plain`,
`deprecated: true`, same `streamId`, the standard presence caveat in the description), completing
the 3.2.0 presence-twin contract for this pair.

**Keyed `<streamId>-presence`, deliberately unlike the other 57 twin pairs**, where the presence
item holds the base key and the graded twin carries `-severity`/`-intensity`. That pattern is an
artefact of order: in 3.2.0 the presence items already existed and the graded twins were added with
a suffix. Here the graded item came first and keeps its key, so the same underlying rule — the
pre-existing item keeps its key, the new twin takes the suffix — produces the mirror-image naming.
Renaming the graded item instead would have silently changed the `eventType` behind a published
key, which the deprecated-alias mechanism explicitly cannot cover (an alias must keep the same
`streamId` **and** `eventType`).

**Note on already-stored data:** events carrying the fabricated `0.25` are indistinguishable from a
genuine "Slightly anxious" — nothing marks them — so they are not migratable after the fact.

### Added — a standard `sync` app-stream suffix and the `sync-status/bridge` eventType (site-agents#17)

An app syncing into a user's **own** account needs somewhere to record how far it has synced and
read it back next run. Bridges never hit this — a bridge owns one HDS account with a stream per
partner user, so `streamUserId` is a natural home, and `lib-bridge-js` has written
`sync-status/bridge` there all along. An app talking to the user's account directly had no
equivalent, so every integration invented a private convention (the Cycle Féminin PHP integration
chose `app-cyclefeminin-sync`). Standardising later would have forced all of them to migrate.

`appStreams` gains a `sync` entry alongside `notes` / `chat` / `system-out` / `system-in` /
`webapp-settings`, and `sync-status/bridge` becomes a **published** eventType — the string `sync`
did not previously occur in `pack.json` at all, so neither the suffix nor the type was discoverable.

The content schema is deliberately permissive: existing writers already carry different payloads
(`syncedUntil`, `action`, `changeLogs`, a plugin/bridge version), and tightening it would break
them. `syncedUntil` is documented as the one agreed field, so a viewer can generically show "last
synced from &lt;app&gt;" — which is what `clientData.appStreamId` exists to enable.

### Added — a basal-temperature disturbance flag ("parasitic temperature") (site-agents#14)

Sympto-thermal rules **exclude** a disturbed reading from the coverline and temperature-shift
computation, so a consumer charting BBT cannot read the curve correctly without the flag. Cycle
Féminin exports it (`codifiedEvents: ["Parasitic temperature"]` plus a reason in
`codifiedTemperatureParasitic`); both the HDS importer and the PHP samples dropped it and wrote the
temperature to `body-temperature-basal` as if reliable — silently wrong for anyone computing a
shift.

Adds `body-temperature-basal-disturbance` (new stream nested under `body-temperature-basal`,
eventType `temperature/disturbance-v1`, a 7-value select: rough-night, illness-fever, alcohol,
late-or-short-sleep, different-time, travel-timezone, other).

Modelled as a **companion item on its own stream** — the same shape as
`body-vulva-bleeding-browndark` / `-clots`, described in-model as *"Qualifier for a co-occurring …
event"* — rather than as an event-level qualifier on the temperature itself. Plan 85 (D4,
2026-07-16) decided HDS does not encode observation qualifiers in the root model, and no such
mechanism exists.

Generic on purpose: FEMM, Billings, Creighton and Mira all have a comparable disturbance notion, so
one item serves several bridges instead of each inventing its own. **Absence of the event means the
reading was not flagged, not that it was confirmed reliable** — stated in the description so no
consumer infers reliability from silence.

## [3.3.0] - 2026-09-15

### Added — French labels for the last 33 active items, so a French consent screen reads in French (site-agents#16)

The consent screen in `app-web-user-account` mixed languages: the verbs were localised (`gérer`,
`contribuer à`) while the thing being granted stayed English (`Basal Body Temperature`) even at
`lang=fr`. Half of that was ours — **33 of 223 active items carried no `fr` label**, so
`localizeText` fell through to English. All 33 now have one, and every active item in the published
pack carries both `en` and `fr`.

The 33 are concentrated exactly where a fertility bridge asks for permission, which is why the gap
was so visible on that screen: the seven `body-vulva-*` bleeding and mucus items, eleven
`fertility-*` cycle / test / intention items, the coded clinical entries (`condition-coded`,
`finding-coded`, `medication-*`, `procedure-*`, `treatment-*`), and the `profile-*` identity fields.

Each was stored as a bare string (`label: Ovulation Day`) rather than the `{en, fr}` map every
localised item uses; they are now maps, with the English text unchanged. No key, `streamId`,
`eventType`, `description` or behaviour is touched — this is additive localisation only, so no
consumer needs to change and nothing needs migrating.

**What this does NOT fix, and cannot.** Stream *names* stay English. `stream.name` is a plain
`string` across all 263 streams — the schema has no localisation slot for it at all — so a consumer
rendering stream names still shows English. That is why the consent screen was changed to resolve a
`streamId` to its active item and render the *item's* label instead. Making `stream.name`
localisable was considered and rejected: it is a breaking change rippling through every consumer
that reads a stream name, and it would still leave the requester-supplied `defaultName`
single-language.

**Note for consumers resolving a stream to an item:** streams and items are not 1:1. Deprecated and
active twins share a `streamId`, and five streams carry more than one *active* item
(`body-vulva-mucus-inspect`, `medication-intake`, `procedure`, `profile-name`, `treatment`), so no
single item speaks for those. 213 of the 222 item-bearing streams resolve unambiguously.

## [3.2.0] - 2026-09-15

### Changed — the `deprecated` flag on presence twins now says what it actually means (site-agents#13)

Plan 77 decided, on 2026-07-06, to keep each `activity/plain` occurrence item alongside its new
graded twin and mark it `deprecated: true`, so pickers hide it while **presence-only sources keep
writing it**: *"Graded events are written only when intensity is known."* That second half lived
only in a YAML comment. The published `description` said `"Deprecated — use <key>-severity"` and
nothing else, so every consumer reading `pack.json` — including an agent surveying a bridge's
mappings — concluded that correct, sanctioned writes were defects. That is exactly what happened in
`healthdatasafe/site-agents#13`.

Nothing about the model's behaviour changes here. What changes is that the contract is now
published rather than implied.

- **All 56 presence items** (19 symptom + 9 activity from §1, 28 symptom-domains) now carry a
  description of the form *"Presence marker for sources that record occurrence only (no grade); use
  `<key>-severity` when a severity is known."* The pointer to the graded twin is preserved.
- **The 28 symptom-domains presence twins are now `deprecated: true` as well.** They shipped
  un-deprecated in 1.12.0 ("greenfield concepts keep presence-only logging valid") while §1's
  structurally identical twins were deprecated, so the model asserted two different things about one
  pattern, and a consumer could not tell which rule applied. They now carry the same flag and the
  same caveat. **Nothing referenced these 28 keys** — no writer, no reader, no form-spec preset, no
  timeline colour key — so the flag costs no consumer anything today; it only hides them from
  pickers, alongside the severity twin that was always the one to offer.
- Deprecated items: 33 → 62. Presence twins sharing a `streamId` with a `ratio/proportion` item:
  **0 active / 57 deprecated**, where it was 28 / 28.
- File headers in `symptom.yaml`, `activity.yaml` and `symptom-domains.yaml` now state plainly that
  `deprecated: true` on these items means *hidden from pickers*, not *do not write*, and warn that
  the published description must keep saying so because consumers cannot see the comment.

### Added — `symptom-pain-pelvic`, the missing presence twin (site-agents#13)

`symptom-pain-pelvic-severity` shipped without an `activity/plain` twin, so a source recording
pelvic pain as an ungraded flag had nowhere correct to write. Cycle Féminin is exactly that source,
and `bridge-cycles-files` was therefore mapping its `Pelvic pain` onto
`symptom-gastrointestinal-cramps` — a different clinical concept, as that severity item's own
description points out ("symptom-gastrointestinal-cramps is GI, not pelvic"). The presence twin now
exists on the existing `symptom-pain-pelvic` stream, carrying the same SNOMED reference
(`274671002`) and the same presence caveat as its 56 siblings. 284 → 285 items.

`bridge-cycles-files` remaps to it in the same change. Note that this moves which stream that
adapter writes to and requests permission on, so events imported before the remap remain on
`symptom-gastrointestinal-cramps`; both items resolve, so nothing is orphaned.

**No migration.** Identity is `streamId:eventType`, so stored `activity/plain` events keep resolving
through the presence items exactly as before, and no event data, eventType or permission changes.
Writers relaying an ungraded flag (`bridge-mira` without `symptoms[].level`, `bridge-cycles-files`
femm/cyclefem, and any direct integration) require no change and were never wrong.

**Deliberately not done:** no sentinel severity for "reported, ungraded". There is no honest value
on the 5-level scale — `0` means *None*, and `0.25` is the documented Slight/Mild anchor that
interop-maps to HealthKit `Mild` — and Plan 85 §4 bars carrying the caveat in `clientData`, which is
for non-authoritative data. Note the 3-level intensity scale has no `0` at all.

### Documentation

- `documentation/CUSTOM-FIELDS-AND-SYSTEM.md`: CMC system messages carrying an HDS payload — the
  data-export request convention (`notification/alert-cmc` with `content.hds`, ack as fulfilment).
  No definition or pack change.

## [3.1.0] - 2026-08-07

**Additive — `not-hispanic-latino`.** Resolves the real gap behind
[site-agents#11](https://github.com/healthdatasafe/site-agents/issues/11) **without** splitting race
from ethnicity.

### Added
- `attributes/ethnicity` / `profile-ethnicity` gain **`not-hispanic-latino`** (en "Not Hispanic or
  Latino", fr "Ni hispanique ni latino"). Previously the *absence* of `hispanic-latino` was ambiguous
  between "not Hispanic" and "didn't answer" — a data-quality problem, and the only concrete defect #11
  identified. Purely additive: existing content stays valid.

### Decided — we are NOT splitting into `profile-race` + `profile-ethnicity`
#11 proposed mirroring FHIR US Core (`us-core-race` 0..5, `us-core-ethnicity` 0..1). We declined, for
reasons recorded here so this is not silently revisited:

- **It is a US administrative construct** (OMB SPD-15), not a clinical one. Race is not a biological
  variable, and clinical medicine has been *removing* it from algorithms (eGFR race coefficient, 2021;
  spirometry correction). A European health model should not adopt it as a first-class concept.
- **GDPR.** "Racial / ethnic origin" is Article 9 special-category data. Splitting adds a second
  special-category field to the core profile of every deployment by default.
- **The terminologies do not back the split.** Verified against snomed-db (International Edition
  2026-02-01): the hierarchy roots `372148003` *Ethnic group* and `415229000` *Racial group* are active,
  but the *ethnic group* value concepts sampled are **inactive** (`185984009` White, `315240009` Black,
  `315280000` Asian) while the *racial group* values are active. Decisively, SNOMED codes
  **`414408004` Hispanic as a *racial group*** — the opposite of OMB/US Core, which makes Hispanic the
  *ethnicity* axis. The two standards disagree on the very boundary the split is drawn along.
  Base HL7 FHIR has neither concept on `Patient`; they exist only as US-realm US Core extensions whose
  values come from the CDC/OMB code set — not LOINC, not SNOMED.
- **The split is not needed for interop.** The combined value set **partitions cleanly**, so a boundary
  mapper produces US Core losslessly: `hispanic-latino` / `not-hispanic-latino` →
  `us-core-ethnicity.ombCategory`, everything else → `us-core-race.ombCategory`. US conformance is a
  US-profile mapping concern, not a core-model one. Test `[ITMM-8]` pins that partition.

**Known cost of not splitting:** `hispanic-latino` and `not-hispanic-latino` answer one question and are
mutually exclusive, which the array shape cannot enforce. Writers must not emit both. Documented on the
eventType.

## [3.0.0] - 2026-08-07

**BREAKING — multi-value item cardinality (`multi-select`).** Rules
[site-agents#9](https://github.com/healthdatasafe/site-agents/issues/9) and
[#10](https://github.com/healthdatasafe/site-agents/issues/10): two items held one value where several
are simultaneously true, so every selection past the first degraded to app-level free text.

### Added
- **Item type `multi-select`** — `select`'s multi-valued twin: same `options` list, but the event content
  is an **array** of chosen values. `checkItemVsEvenType` enforces that the matching eventType is an
  `array` whose `items.enum` covers every option.

### Changed — BREAKING
- **`attributes/ethnicity`** — `string` + `enum` → `array` of the same values, `uniqueItems: true`.
  **The `multiple` sentinel is removed**: it recorded *that* several applied while losing *which*.
  `profile-ethnicity` becomes `multi-select` and keeps `repeatable: once` (ethnicity is not time-varying,
  so latest event wins).
- **`fertility/tracking-method-v1`** — `string` + `enum` → `array`, `uniqueItems: true`.
  `fertility-tracking-method` becomes `multi-select` **and `repeatable: once` → `any`**. Cardinality and
  recurrence are orthogonal, and this item exercises both: methods run concurrently *and* change over
  time. Because the eventType is the interpretive key for cycle observations ("Determines how their cycle
  observations should be interpreted"), keeping only the current set would silently re-read a chart
  recorded under one method as though it used today's method. Same reasoning as
  `profile-reproductive-stage`. Each event is now a complete **dated snapshot** of the active set — a
  method that stops simply does not appear in the next snapshot.

### Migration
Both items had **no runtime consumers** in the workspace (swept 2026-08-07), so the change is in place —
no v2 eventType, no deprecation alias. **Pre-existing events written with scalar content do not match the
new shape** and need a backfill: write one array-valued event per known set, and for
`fertility-tracking-method` write **one dated event per historical set** rather than a single current-set
event, so existing history survives instead of collapsing to today's answer.

**Fix — `repeatable` is now validated.** The item schema typed `repeatable` as a mandatory but
otherwise free string, so a typo or an invented value passed validation and then silently matched no
consumer branch (consumers key on the exact strings — e.g. the timeline routes `once` to the Profile
panel, and hds-forms-js classifies builder sections on `!== 'once'`). It now accepts `once`, `any`,
`unlimited`, or an ISO-8601 duration (`P1D`, `P1W`, `P1M`, `PT12H`). All 284 existing definitions
already conform, so nothing in the model changes — but pre-ISO spellings (`daily`, `once-per-day`) and
invented values (`many`, `none`) are rejected from here on.

## [2.5.1] - 2026-07-22

**Fix — invalid SNOMED references.** A full audit of all SNOMED codes across the itemDefs (via
snomed-db `verifyConcept`) found 4 SCTIDs absent from the current edition. Corrected:
- `wellbeing-mental-distress-anxiety`: dropped invalid `444849004`; kept valid `48694002` (Anxiety).
- `function-self-care`: `284774004` → `228151002` (Personal care disability, finding — verified active).
- `wellbeing-self-rated-health`: removed invalid `425058002` + `104346004` (no clean SNOMED exists for the
  self-rated-health / EQ-VAS *scale*; the item keeps its 3 LOINC codes, the correct terminology for a PRO).
- All remaining **149** referenced codes verified active. Metadata-only; no item behaviour/values changed.

## [2.5.0] - 2026-07-22

**Additive — `wellbeing-mental-distress-stress`.** Completes the mental-distress domain: the third
dimension of the validated **DASS-21 (Depression / Anxiety / Stress)** triad, alongside the existing
`-anxiety` and `-depression` severity items (and distinct from the `-combined` item, which is
anxiety + low mood). No renames or removals.

### Added — `wellbeing-mental-distress-stress`
- `ratio/proportion`, 5-level `select` on the canonical severity hooks `0.0 / 0.25 / 0.5 / 0.75 / 1.0`
  (Not / Slightly / Moderately / Severely / Extremely stressed), en+fr, mirroring the sibling
  `-anxiety` / `-depression` items. New stream `wellbeing-mental-distress-stress` ("Stress severity").
- SNOMED refs verified active via snomed-db: `73595000` (Stress, finding) + `224974006`
  (Feeling stressed, finding). No LOINC (none verified in-workspace; the `-combined` item likewise omits it).
- Driver: gives the Mira bridge's `symptoms.Stress` a correct home (was `SYMPTOM_SKIP`) instead of the
  semantically-wrong `-combined` aggregate.

## [2.4.0] - 2026-07-16

**Additive — reproductive-stage / menopausal status** from
[healthdatasafe/site-agents#7](https://github.com/healthdatasafe/site-agents/issues/7). No renames or
removals. Loaded through hds-lib 1.3.3 via the consumer-check (283 items, no collision).

### Added — `profile-reproductive-stage`

- A durable-but-time-varying patient attribute for reproductive-aging / menopausal stage, aligned to the
  **STRAW+10** staging system. It is the standing fact that **selects the reference band** for
  stage-dependent hormones (estradiol, FSH, prolactin) shipped in
  [site-agents#5](https://github.com/healthdatasafe/site-agents/issues/5) — a value without the stage
  can't be interpreted.
- Follows the model's durable-attribute convention (`profile-sex`/`attributes/biological-sex`,
  `profile-ethnicity`/`attributes/ethnicity`): a `select` item `profile-reproductive-stage` on stream
  `profile-reproductive-stage`, new eventType **`attributes/reproductive-stage`** (string enum).
- **`repeatable: any`** (not `once`) — stage is time-varying (premenopausal → perimenopausal →
  postmenopausal), so it is a dated observation with `event.time` = when the stage applied, not a
  set-once profile field.
- Enum (STRAW+10): `premenopausal · perimenopausal · postmenopausal · surgical-menopause ·
  primary-ovarian-insufficiency · pregnant · postpartum · lactating`.
- **Stage only.** Hormone therapy stays a separate `medication-intake-coded` record (per the
  [site-agents#4](https://github.com/healthdatasafe/site-agents/issues/4) Q4 ruling); "on-HRT vs
  no-HRT" is derived by joining the two, keeping the vocabulary clean.

## [2.3.0] - 2026-07-16

**Removed the FSH/hCG/PdG/E3G urine-hormone rename aliases** (`fertility-hormone-{fsh,hcg,pdg,e3g}`),
the deprecated keys kept through the Plan 83 migration window. Their consumers (`bridge-mira`,
`doctor-dashboard`) now write and read the `body-urine-hormones-*` keys, so the aliases are unused. The
rename never changed `streamId`+`eventType`, so no stored event referenced the item key — removing them
orphans nothing, and it removes the colliding `streamId:eventType` pairs entirely (a pack even a pre-1.3.1
`hds-lib` loads cleanly). **`fertility-hormone-lh` is kept** — not an alias: its rename also changed the
unit (`mg-l` → `iu-l`), so historical `mg-l` LH events still resolve to it.

## [2.2.0] - 2026-07-16

**Additive — the trying-to-conceive intake-questionnaire concepts** from
[healthdatasafe/site-agents#4](https://github.com/healthdatasafe/site-agents/issues/4). No renames or
removals. Loaded through hds-lib 1.3.1 via the consumer-check (286 items, no collision).

### Added — coded diagnosis & findings concepts (the #4 blocker)

- **`condition-coded`** — the diagnosis concept the model was missing. `datasource-search` against a new
  `condition` datasource (`datasets://condition`), eventType `condition/coded-v1`, stream `condition`.
  Records what a patient **has** (an established diagnosis), distinct from symptoms/procedures/treatments.
- **`finding-coded`** — coded clinical / imaging finding (`finding` datasource, `finding/coded-v1`, stream
  `finding`). What was **found** at surgery or on imaging — neither a procedure nor a diagnosis.
- Both are backed by **datasets-service 1.2.0** (`/condition` = 27 diagnoses, `/finding` = 11 findings,
  curated SNOMED-CT). The items ship here; the searchable corpus lives in datasets-service.

### Added — questionnaire items (all reuse existing event types)

- **Recalled averages** (§Q4): `fertility-cycles-average-peak-day`, `fertility-cycles-average-luteal-phase`
  — twins of the existing `-average-length` / `-average-period` (`time/d`, recalled summaries).
- **`symptom-pain-pelvic-severity`** — the severity-twin the form needs; `symptom-gastrointestinal-cramps`
  is GI, not pelvic. SNOMED `274671002` (Pelvic and perineal pain).
- **`profile-birthcountry`** — country of birth (`contact/country`), distinct from the address country.
- **`profile-ethnicity`** — self-identified ethnicity as a clinical/epidemiological variable
  (new `attributes/ethnicity` enum, OMB-aligned categories).
- **`fertility-tracking-method`** — the charting method/device in use (new `fertility/tracking-method-v1`
  enum: Billings, Creighton, Sympto-Thermal, Marquette, FEMM, Justisse, Peak-Day, Clearblue, Mira, Inito,
  Oura, Kegg). Determines how the person's cycle observations should be read.

## [2.1.0] - 2026-07-16

**Additive — 28 analytes + 5 reporting units.** No renames, no removals; every existing key and event
type is untouched, so nothing breaks on upgrade.

Delivers the analytes enumerated in
[healthdatasafe/site-agents#5](https://github.com/healthdatasafe/site-agents/issues/5) (follow-up to the
#2 domain): the fertility/reproductive-endocrine workup the first delivery had deferred.

### Added — 28 serum/blood analytes

- **Lipids (4):** total cholesterol, HDL, LDL, triglycerides (`concentration/mg-dl`).
- **Inflammation (2):** hs-CRP (`concentration/mg-l`); ESR (`rate/mm-h`, whole blood — placed under
  `body-blood` beside HbA1c, not in the serum subtree).
- **Thyroid (9):** free T4, total T3, reverse T3 (`concentration/ng-dl`); free T3 (`concentration/pg-ml`);
  TPO antibodies, thyroglobulin antibodies (`concentration/iu-ml`); thyroglobulin (`concentration/ug-l`,
  displayed ng/mL); TSI, TRAb (`concentration/iu-l`).
- **Reproductive & adrenal (13):** progesterone, prolactin (`concentration/ug-l`, displayed ng/mL);
  total testosterone, androstenedione, 17-OH progesterone, aldosterone (`concentration/ng-dl`); free
  testosterone (`concentration/pg-ml`); SHBG (`concentration/nmol-l`); DHEA-S, cortisol
  (`concentration/mcg-dl`); CA-125 (`concentration/u-ml`); PTH, ACTH (`concentration/pg-ml`).

All 28 SNOMED references are measurement-procedure concepts, verified ACTIVE against the local
`snomed-db` — the batch rejected 5 inactive top-of-search hits (total cholesterol, DHEA-S, CA-125 ×2,
TPO). TPO uses `27115008` *Microsomal thyroid antibody measurement* (the historical name for the same
assay; the dedicated TPO-Ab concepts are all inactive) — noted on the item.

### Added — 5 reporting-unit event types

`concentration/ng-dl`, `concentration/nmol-l`, `concentration/iu-ml`, `concentration/u-ml`, `rate/mm-h`.
Each proven non-equivalent to every existing same-dimension type per the `AGENTS.md` no-equivalent-twins
rule (all are genuine decade/scale differences, not silent duplicates of `iu-l` / `u-l` / `umol-l`).

### Added — `molar` pregnancy outcome

`pregnancy/detailed` (and the `fertility-pregnancy` item) gain a `molar` (hydatidiform mole) enum value,
inserted after `ectopic` — a distinct entity with its own hCG-surveillance follow-up. Requested in
[healthdatasafe/site-agents#4 §3.5](https://github.com/healthdatasafe/site-agents/issues/4). Purely
additive; existing pregnancy events are unaffected.

### Judgment calls (open to correction by the reporter)

- **CA-125 → `concentration/u-ml`**, not `catalytic-activity/u-ml`: the existing `catalytic-activity/u-l`
  is reserved for the liver *enzymes* (ALT/AST/GGT/ALP/LDH); CA-125's "U" is an arbitrary immunoassay
  unit, not catalytic activity.
- **TSI → `concentration/iu-l`** (assumed): the request left the unit blank. Modern immunoassays report
  IU/L; older bioassays report a % stimulation index — if needed, add it as a `variations.eventType`
  rather than retyping.

## [2.0.0] - 2026-07-15

**Major bump because item keys were renamed.** Stored data is unaffected, and **the old keys keep
working** — each is retained as a deprecated alias (below), so no consumer breaks on upgrade. The major
is for the eventual removal of those aliases and the `concentration/mg-ml` / `mcg-ml` removals.

Delivers the serum blood-chemistry domain reported in
[healthdatasafe/site-agents#2](https://github.com/healthdatasafe/site-agents/issues/2): **all 58
analytes the report enumerated**, across metabolic, minerals, vitamins, iron studies, CBC, renal &
electrolytes, protein, liver, methylation, thyroid and reproductive hormones. Design rationale:
[`documentation/BLOOD-CHEMISTRY.md`](documentation/BLOOD-CHEMISTRY.md).

### Changed — urine hormone item keys renamed (`fertility-hormone-*` → `body-urine-hormones-*`), old keys kept as aliases

**Nothing breaks on upgrade.** Stored data is unaffected (events carry `streamId` + `type`), and each
old key is retained as a **deprecated alias** with the same `streamId` and `eventType` — so it emits
identical events, `forKey` still resolves it, and consumers migrate on their own schedule. Aliases are
hidden from pickers (`getAllActive`).

| Old key | New key |
|---|---|
| `fertility-hormone-fsh` | `body-urine-hormones-fsh` |
| `fertility-hormone-hcg` | `body-urine-hormones-hcg` |
| `fertility-hormone-pdg` | `body-urine-hormones-pdg` |
| `fertility-hormone-e3g` | `body-urine-hormones-e3g` |
| `fertility-hormone-lh` | `body-urine-hormones-lh` *(old key kept, deprecated — see below)* |

**Why:** the old prefix matched neither the stream (`body-urine-*`) nor the specimen. Serum and urine
assays of the same hormone are different observations with different reference ranges — SNOMED codes
them as distinct procedures — so a neutral key that silently meant "urine" was a trap, and serum twins
had nowhere symmetric to live. Keys now equal their `streamId`, and the specimen is explicit on both
sides.

**Loader change enabling the aliases** (`src/items.js`): a deprecated item may now share a
`streamId:eventType` pair with an active one, and the **active** item owns the resolution index
regardless of load order — so `findItemForEvent` stays unambiguous. Two *active* items on one pair
still throw (the storage-identity invariant), as do two *deprecated* with no active (ambiguous).
Covered by tests `[ITMA-1..5]`; the rename-alias procedure is documented in `AGENTS.md`.

**Consumers should migrate at leisure** (`hds-react-timeline` already done):
- `doctor-dashboard` — `app/data/presets.ts`
- `bridge-mira` — `src/methods/hds4miraMethods.ts`, `_hds/manifest.json`, and
  `src/dataSync/converters/hormone.ts`, which builds the key by concatenation
  (`'fertility-hormone-' + hormone`). Without the aliases this would have thrown at **runtime** on the
  write path, with no typecheck to catch it.

**Aliases are removed once the consumers are updated.**

### Deprecated — `fertility-hormone-lh` (was typed `concentration/mg-l`)

LH is reported in **IU/L**; this item was the only one in the model using `mg-l`, while its siblings all
used `iu-l`. **Stored numbers are already correct** — `bridge-mira` writes Mira's value verbatim and
Mira reports LH in mIU/mL, which is numerically identical to IU/L. Only the type label was wrong.

It cannot be retyped in place: existing events carry `type: concentration/mg-l`, and the data lives in
users' own accounts, so there is nothing for HDS to migrate. The item is kept with `deprecated: true` so
those events still resolve and render; new data uses `body-urine-hormones-lh` (`concentration/iu-l`).

### Added — blood chemistry: `body-blood` tree + 58 analytes

New stream tree `body-blood`, following the existing specimen-rooted pattern (`body-urine`,
`body-semen`), with three specimen subtrees:

- **`body-blood-serum/`** — serum/plasma analytes (most of the domain)
- **`body-blood-cbc/`** — whole-blood counts
- **`body-blood-rbc/`** — erythrocyte specimen (`body-blood-rbc-magnesium`, distinct from
  `body-blood-serum-magnesium` — a different observation, not a different unit)
- **`body-blood-hba1c`** — whole blood, hence the direct placement

| Panel | Items |
|---|---|
| Metabolic | fasting glucose (mg/dL + mmol/L), fasting insulin, HbA1c, C-peptide |
| Iron studies | ferritin, iron, TIBC, transferrin saturation |
| CBC | hemoglobin, hematocrit, RBC, WBC, platelets, MCV, MCH, RDW, and the 5-part differential |
| Liver | ALT, AST, GGT, ALP, LDH, total bilirubin, bile acids |
| Renal & electrolytes | BUN, creatinine, eGFR, sodium, potassium, chloride, CO2, calcium |
| Protein | total protein, albumin, globulin |
| Minerals | zinc, copper, ceruloplasmin, magnesium (serum + RBC), selenium |
| Vitamins | A, D (25-OH), D (active), B12, folate, B6, C |
| Methylation | homocysteine |
| Thyroid | TSH |
| Reproductive | FSH, LH, estradiol, **AMH** |

Fasting glucose is its own item rather than a variation — SNOMED codes fasting (`167087006`) and random
(`167086002`) serum glucose as different procedures, and `variations` supports `eventType` only.
Precedent: `body-temperature-basal`.

**Codes.** All SNOMED references verified active against `snomed-db` (International RF2 20260201) —
this caught several inactive concepts that a plain search returns first (`35170002` Hemoglobin
determination, `142831004` RBC count, `165701004` RDW, `143134000` transferrin saturation). Three items
carry **no** SNOMED ref because no concept exists: `body-urine-hormones-e3g`, `body-urine-hormones-pdg`
and `body-blood-rbc-magnesium`. LOINC is **not asserted** — there is no local source to verify against,
so candidates stay in comments (precedent: `body-semen-morphology-normal`).

**Reference ranges are deliberately absent** — they vary by lab, assay and population, and "optimal"
bands are a practice's interpretation. The model carries the measured value; interpretation stays with
the interpreter.

**⚠️ `body-blood-pressure` is a vital sign and a sibling of `body-blood`, not a child** — despite the
shared prefix. Nothing resolves by prefix, so it is safe, but "all `body-blood` data" does not cover it.

### Added — units for the serum blood-chemistry domain

Foundation for the serum blood-chemistry domain (~68 analytes). Units land first: an
analyte can't be modelled honestly without one, and several conventional reporting units
had no home.

- **`concentration/gigacount-ml`** (10⁹ counts/mL) — RBC stores 4.3–4.8, as printed.
  Sibling of `concentration/megacount-ml`, which keeps WBC and platelets (× 10⁹/L ≡
  × 10⁶/mL); the split mirrors how lab reports print the two.
- **`concentration/mcg-dl`** (μg/dL) — serum zinc, copper, retinol, iron, TIBC.
- **`concentration/pg-ml`** (pg/mL) — B12, active vitamin D, estradiol.
- **`concentration/uiu-ml`** (μIU/mL) — fasting insulin, TSH.
- **`concentration/umol-l`** (μmol/L) — homocysteine, bile acids.
- **`catalytic-activity/u-l`** (U/L) — ALT, AST, GGT, ALP, LDH.
- **`volume/fl`** (fL) — MCV. **`mass/pg`** (pg) — MCH.
- **`rate/ml-min-173m2`** (mL/min/1.73m²) — eGFR.

Reused rather than added: `concentration/mg-dl`, `g-dl`, `ug-l`, `mmol-l` (legacy) and
`concentration/megacount-ml`.

### Changed — `ratio/proportion` also covers objective measured fractions

Its description previously scoped it to *subjective* scales with option-defined hooks.
Lab percentages (HbA1c, hematocrit, RDW, transferrin saturation, the WBC differential)
are genuine fractions, so they store here as `0..1` — never as `42` — and render via
`display.multiplier`. The `0..1` bound is enforced, and fractions match Apple HealthKit's
`HKUnit.percent()`; FHIR/LOINC export applies the × 100 in the mapper.

### Added — `number.display` on number items

`type: number` items accept an optional `number.display` block (`multiplier` /
`precision` / `suffix`), mirroring `slider.display`. Storage stays raw; the user sees the
conventional scale (`0.42` → `42%`). Requires hds-forms-js ≥ the matching release.

### Removed — two eventTypes equivalent to legacy Pryv types

`concentration/mg-ml` (≡ legacy `concentration/g-l`) and `concentration/mcg-ml` (≡ legacy
`concentration/mg-l`) were HDS-added alongside twins that already existed. Equivalent
types split the same measurement across two names, invisibly to any validator. Both were
referenced by zero itemDefs and zero consumers, so removal is clean.

**New rule in `AGENTS.md`:** a new eventType must never be numerically equivalent to an
existing one — do the arithmetic, don't compare the names. Where the twin is a legacy
type, the legacy type wins.

### Changed — `AGENTS.md`: `description` is short, end-user text

Item `description` is rendered under the field label to patients and clinicians. One
short sentence; no storage detail (`Stored as a 0..1 ratio`), assay minutiae, or
rationale — those belong in `devNotes` or `documentation/`.

## [1.12.1] - 2026-07-06

### Fixed — SNOMED code corrections + newly-coded concepts (verified via snomed-db)

Audited every symptom/BP SNOMED reference against **SNOMED International RF2 20260201** using the
`snomed-db` tool. Corrected codes that shipped in 1.11.0/1.12.0 as **inactive or nonexistent** (they
came from a stale reference table):

- `symptom-gastrointestinal-nausea`: `73879007` (inactive) → **`422587007`** (Nausea).
- `symptom-gastrointestinal-bloating`: `248490000` (inactive) → **`116289008`** (Abdominal bloating).
- `symptom-cognitive-focus-difficulty`: `76039006` (nonexistent) → **`26329005`** (Poor concentration).
- `symptom-bleeding-nosebleed`: `12441001` (inactive disorder) → **`249366005`** (Bleeding from nose).
- `symptom-thermoregulation-hot-flashes`: `70882005` (nonexistent) → **uncoded** (no active finding-level concept; the "Hot flush/flashes" findings are all inactive).

Added SNOMED references to the 7 §2 concepts that shipped uncoded (all verified active findings):
`skipped-beat` `248629002`, `excessive-sweating` `52613005`, `cold-extremities` `[271584002, 271585001]`
(Cold hands + Cold feet — no active single "cold extremities" concept), `hearing-difficulty` `162340000`,
`bleeding-gums` `86276007`, `easy-bruising` `424131007`, `twitching` `82470000`.

## [1.12.0] - 2026-07-06

### Added — new symptom domains (Plan 77 / #19 §2)

28 new symptom concepts across 8 domains, each as a **live** occurrence (`activity/plain`) + severity (`ratio/proportion`, 5-level) twin on one `streamId`, en+fr. Unlike §1's existing items, the occurrence twin is **not** deprecated — greenfield concepts keep presence-only logging valid.

- **New categories:** respiratory (cough, shortness of breath, wheezing, nasal congestion, sore throat, runny nose), cardiac (palpitations, skipped heartbeat), thermoregulation (chills, hot flashes, night sweats, excessive sweating, cold extremities), vision & sensory (blurred vision, visual disturbance, hearing difficulty), hydration & urinary (excessive thirst, frequent urination), bleeding (nosebleed, bleeding gums, easy bruising).
- **Extended:** neurological (+ tingling/numbness, tremor, restless legs, muscle twitching), dermatological (+ rash, hives, itching).
- 56 items + 28 streams in `definitions/items/symptom-domains.yaml`. No new eventType.
- SNOMED references on 21/28 concepts; **7 pending code verification** (`skipped-beat`, `excessive-sweating`, `cold-extremities`, `hearing-difficulty`, `bleeding-gums`, `easy-bruising`, `twitching`).

## [1.11.0] - 2026-07-06

### Added — intensity/severity items + blood pressure (Plan 77 / #19)

Addresses [data-model#19](https://github.com/healthdatasafe/data-model/issues/19) (MSQ symptom-screening integration), §1 + §4.

- **Activity intensity** (§1): each of the 9 `activity-*` occurrence items is marked `deprecated: true` and paired with a new `activity-*-intensity` item on the same `streamId` — `ratio/proportion`, WHO/ACSM 3-level (`0.25` Light / `0.5` Moderate / `1.0` Vigorous), en+fr.
- **Symptom severity** (§1): each of the 19 presence `symptom-*` items is marked `deprecated: true` and paired with a new `symptom-*-severity` item on the same `streamId` — `ratio/proportion`, 5-level (`0 / 0.25 / 0.5 / 0.75 / 1.0` = None/Slight/Moderate/Severe/Extreme), en+fr, SNOMED references carried from `documentation/SYMPTOMS.md`. 4-level sources (Apple `HKCategoryValueSeverity`, Mira `level`, MSQ 0–3) map as a subset by label.
- **Blood pressure** (§4): new `body-blood-pressure` stream (under `body`) + composite item on the existing `blood-pressure/mmhg-bpm` eventType — `systolic` + `diastolic` (mmHg) + optional `rate` (pulse, bpm). SNOMED/LOINC references.
- **No new eventType** introduced (reuses `ratio/proportion`, `activity/plain`, `blood-pressure/mmhg-bpm`). Existing occurrence events keep resolving via the deprecated twins — item identity is `streamId:eventType`, so two itemDefs coexist on one stream (same pattern as `body-vulva-mucus-inspect`).
- #19 §3 (generic instrument-item) and §5 (affect converters) are consumer-side — no model change. §2 (8 new symptom domains) planned as a follow-up.

## [1.10.3] - 2026-06-29

### Changed — shorten Billings/Creighton method display labels to bare family names

- `definitions/converters/cervical-fluid/models/billings/v0.json`: display name `Billings Observation` / `Observation Billings` → `Billings` (en+fr).
- `definitions/converters/cervical-fluid/models/creighton/v0.json`: display name `Creighton Model` / `Modèle Creighton` → `Creighton` (en+fr).
- Method ids `billings` / `creighton` unchanged. Mirrors the `model: trademark naming alignment` rename in `model-cervical-fluid` (b401488), keeping the published model labels consistent with the standalone model package.

## [1.10.2] - 2026-06-23

### Changed — Billings method display label (avoid protected trademark)

- `definitions/converters/cervical-fluid/models/billings/v0.json`: renamed the display name from `Billings (BOM)` / `Billings (MOB)` to `Billings Observation` (en) / `Observation Billings` (fr), dropping the registered marks "Billings Ovulation Method" / BOM / MOB. Method id `billings` unchanged. Mirrors the same rename in `model-cervical-fluid`.

## [1.10.1] - 2026-06-22

### Fixed — composite↔eventType nesting + validation (B-2026-06-12-1)

- `medication-intake-basic` composite now nests `doseValue` / `doseUnit` / `route` under an `intake` sub-object, matching the `medication/basic` eventType (and aligning with `medication/coded-v1` + FHIR `dosage`). Previously the composite renderer emitted these flat, producing stored event content that violated its own declared eventType.
- `src/schemas/items.js`: item schema extended with a recursive `compositeField` definition so a composite field can itself be `type: composite` (nested groups).
- `src/items.js`: implemented the previously-stubbed composite↔eventType validation in `checkItemVsEvenType` — recursively checks that every composite field maps to a compatible eventType property (type + enum), catching shape/enum drift at build time. Replaces the `XX Composite type TODO` no-op.
- Tests: `tests/items.test.js` ITMC1-4 (nested shape present, valid composite passes, flat-shape rejected, out-of-enum select rejected).
- Backward compatibility: existing flat events are not migrated; consumers read both shapes (see hds-lib `eventToShortText`).

## [1.10.0] - 2026-06-16

### Added (plan 71 Phase B — questionnaire request/answer event pair)
- New eventType `questionnaire/request-v1` in `eventTypes-hds.json`. Doctor → patient: a questionnaire instantiated for this patient with a `questions` map keyed by stable question keys. Each question carries `label`, `itemRef` (existing HDS item key), optional `params` (entity filter — e.g. drug codes), required temporal `scope` (`ever` / `window` with `withinDays` / `latest` with `withinDays`), and optional `subField` (`select-segmented` / `text` / `number`) for qualifier capture. Question keys constrained to Pryv content-query path grammar `[a-zA-Z0-9_-]+` (no colons, dots, brackets) so `content.answers.<key>.status` queries work against the matching answer event.
- New eventType `questionnaire/answer-v1` in `eventTypes-hds.json`. Patient → doctor: response to a `questionnaire/request-v1`, linked via `requestEventId`. `answers` map keyed by the same question keys; each entry carries a `status` enum (`answered` / `no` / `unknown` / `declined`) with conditional fields per status: `answered` requires non-empty `references[]` (eventIds of typed events that satisfy the question) and allows optional `qualifier` (any shape per the request's subField); `declined` allows optional `reason` (free-text string, coded values deferred to additive extension). Key absence = implicit "not-answered". JSON Schema uses `oneOf` discriminator on `status` with `additionalProperties: false` per branch — invalid status enum values, references on `no`/`unknown`/`declined`, and missing references on `answered` all reject.
- New documentation file `documentation/QUESTIONNAIRE.md` capturing the two-layer model (template/asking + storage in typed events), the `clientData.related.<eventId>: true` keyed-object cross-reference convention (Pryv §7) that writers MUST mirror into for cohort queryability via the indexed `clientData` parameter, atomicity convention (`events.batch` for answer + new typed events; references immutable post-write), update semantics (new event per edit, latest-by-`event.time` wins for prefill), FHIR mirror table (`Questionnaire` / `QuestionnaireResponse` with `answer.reference` and `data-absent-reason` for the negative statuses), and HDS precedents (Plan 45 `message/system-alert`↔`message/system-ack` request/response pair; Plan 53 D3 context-via-substream for per-context isolation).
- Tests in `tests/questionnaire.test.js` (32 new cases) covering eventType registration, Pryv key-grammar enforcement on both maps, request schema (scope variants, subField shapes, additionalProperties rejection), and answer schema (per-status discriminator, references presence/absence rules, qualifier shape, reason on declined).

### Notes
- No new item type added in this release. The questionnaire is a top-level form artifact rendered by hds-forms-js (Plan 71 Phase C), not a field-on-an-item. `src/schemas/items.js` and `src/items.js` are untouched.
- No new per-domain assertion eventTypes — explicit-no/unknown/declined semantics live entirely on `questionnaire/answer-v1`. Cost: "no" answers have no standalone typed clinical record; FHIR `MedicationStatement.status=not-taken` exports are derived at the consumer from the answer event. Plan 71 Decision D8 (2026-06-15).
- The composite item↔eventType validation TODO in `src/items.js` is still deferred to a dedicated data-model session — unrelated to this plan and untouched.

## [1.9.1] - 2026-06-04

### Added (plan 53 phase A — `role: context` flag on context streams)
- New optional `role` field on stream definitions. v1 value: `context`. A `role: context` stream exists purely as a descendant-streamId marker for the D3 context-via-substream mechanic (see `documentation/TREATMENT-PROCEDURE.md`); no itemDef is registered there and consumers should treat it as metadata, not as a data-bearing bucket.
- `treatment-fertility` and `procedure-fertility` tagged `role: context`. Implicit default for all other streams is "data" (no declaration required).
- Field flows through `dist/streamsTree.json` and `pack.json` unchanged — `src/streams.js` parses YAML and re-emits the stream node verbatim; no schema/validation update needed.
- Non-breaking: existing consumers that don't know about `role` ignore unknown fields. Runtime helpers (`hds-lib-js#isContext()`), forms-engine rendering, and webapp/dashboard visual treatment are tracked separately under Plan 53 Phase B.

### Added (STORMM coherence — new `count/mega` eventType)
- `count/mega` eventType registered in `eventTypes-hds.json` — "Millions of units count." Symbol `M#`, label "Megacounts" / "Mégacomptes". Companion to the existing `concentration/megacount-ml`; the stream context defines what is being counted.
- `body-semen-tmc.eventType` retagged from `count/generic` to `count/mega`. The item description already documented megacount storage convention (10⁶ sperm); the new eventType makes the magnitude explicit at the schema layer so external consumers (HL7/FHIR export, third-party converters) interpret values correctly.

### Changed (STORMM coherence — `version: temporary` → `v1` promotions)
- `body-weight`, `body-height`, `fertility-cycles-start`, `fertility-cycles-peak-day` promoted to `version: v1`. All four are de-facto stable (used by every HDS app + multiple bridges); the `temporary` flag had not been updated since their introduction. No schema change.

## [1.9.0] - 2026-06-03

### Added (plan 70 phase E — `tilt` dimension on cervix-position)
- `body-vulva-cervix-position` item bumped `version: v1` → `v2`. Adds an optional fourth composite dimension `tilt` (Straight / Medium / Tilted → 0.0 / 0.5 / 1.0). Position-only (not a fertility signal); RYB-originated — no clinical-coding convention. Old events read identically (eventType name unchanged); new events may carry the optional field.
- `cervix-position/3d-vectors` eventType schema extended with optional `tilt` property (range 0–1). Existing height/firmness/openness unchanged. Description updated to flag tilt as position-only.
- `documentation/CERVICAL-POSITION.md` — Read Your Body added to the value-vocabulary table as the only system surveyed that tracks tilt; new section on the v1→v2 additive extension; tilt row added to the HDS model summary.

## [1.8.1] - 2026-04-30

### Changed (plan 46 — use Pryv-native event.time + event.duration for treatment span)
- `treatment/basic` and `treatment/coded-v1` eventType payload schemas no longer carry `period: { start, end }`. The treatment span is now expressed via Pryv's native event fields: `event.time` = treatment start, `event.duration` = span in seconds (omitted for ongoing / unbounded). Descriptions updated.
- `procedure/basic` and `procedure/coded-v1` eventType payload schemas no longer carry `performed: { date }`. Procedure timestamp uses `event.time` natively; procedures are point-in-time (no `event.duration`).
- `treatment-basic` and `treatment-coded` items declare `duration: { mandatory: false, canBeNull: true, maxSeconds: 315360000 }` (10-year cap) — matching the convention used by `fertility-cycles-start`, `fertility-cycles-fertile-window`, `fertility-pregnancy`. Procedure items intentionally omit the `duration` block since they're point-in-time.

### Notes
- Non-breaking change: `period` and `performed` were both optional and never required by clients; existing events that contain them still validate (JSON-schema defaults to `additionalProperties: true`). New writers should target the Pryv-native fields instead.
- Trigger: the `datasource-search` companion-fields renderer in hds-forms-js auto-generated plain-text Start / End inputs from the previous `period.{start,end}` payload schema. User vetoed shipping those text-only inputs; canonical Pryv mapping (`event.time` + `event.duration`) is the right place. Form-engine duration UI is a separate future plan; Plan 46 forms today omit `event.duration` (= point-in-time / Flavour A).

### Added (plan 46 — documentation)
- `documentation/TREATMENT-PROCEDURE.md` — canonical reference for the new subdomains, the basic+coded item pair, the procedure findings array, and the **context-via-substream resolution mechanic (D3)** with a worked STORMM IVF intake example, the cross-tree context naming convention, and FHIR / SNOMED / LOINC cross-walk.
- `documentation/TAGS.md` — deferred-design reference for the future `tags/` root: `tags/hds/*` controlled vocabulary + `tags/user/*` custom namespace, never `streamIds[0]`. Captures rationale, use cases, and integration points so a follow-up plan can pick it up without revisiting the design.

## [1.8.0] - 2026-04-30

### Added (plan 46 — treatment & procedure subdomains + context-via-substream)
- Two new top-level streams in `definitions/streams/`: `treatment.yaml` (`treatment` parent + `treatment-fertility` context child) and `procedure.yaml` (`procedure` parent + `procedure-fertility` context child).
- Four new itemDefs in `definitions/items/`: `treatment-basic`, `treatment-coded` (both registered at `treatment`); `procedure-basic`, `procedure-coded` (both registered at `procedure`). Mirrors the existing `medication-intake-basic` / `medication-intake-coded` pair pattern; the basic+coded duo is the v1 surface for both subdomains, with no per-domain named-leaf items.
- Four new eventTypes in `definitions/eventTypes/eventTypes-hds.json`: `treatment/basic`, `treatment/coded-v1`, `procedure/basic`, `procedure/coded-v1`. Treatment payloads carry `name` / `regimen.{label,codes}`, optional `count` (Flavour A), optional `period.{start,end}` (Flavour B). Procedure payloads carry `name` / `procedure.{label,codes}`, optional `performed.date`, optional `count`, an open-vocabulary `findings[]` array, and `notes`.
- Two new datasource declarations in `definitions/datasources/`: `treatments.yaml` and `procedures.yaml` exposing `datasets://treatment` and `datasets://procedure` for the coded variants. Datasets-service implementations land in Slice 2.
- Helpers in `src/streams.js`: `getAncestorsById(id)` returns the chain `[id, parent, …, root]`; `isDescendantOf(candidate, ancestor)` validates context membership.
- `findItemForEvent(eventType, streamId)` in `src/items.js` — implements the **context-via-substream resolution rule (D3)**: direct `(streamId, eventType)` match first; on miss, walk parents until the closest ancestor with a registered itemDef matches.

### Notes
- Same closest-ancestor walk-up algorithm as `hds-lib-js` Plan 45 (`resolveStream.ts` clientData lookup) and `HDSModelAuthorizations` (parent-covers-child de-dup) — D3 is the third application of the same principle, applied at the data-model itemDef layer.
- `streamId` schema stays singular. Multi-streamId tagging is reserved for the future `tags/` root (deferred per Plan 46 §2.9, documentation only).

## [1.7.0] - 2026-04-28

### Added (plan 52 — hds-react-timeline integration in hds-webapp)
- New app-stream declaration `webapp-settings` in `definitions/appStreams.yaml` (`suffix: webapp-settings`, `eventType: settings/hds-react-timeline`). Resolves under any client app's `appStreamId` (e.g. for hds-webapp: `app-client-dr-form-webapp-settings`). Holds one event per feature, distinguished by `eventType` (e.g. `settings/hds-react-timeline`); single recurring event per type, updated in place. Display category `system`.

## [1.6.0] - 2026-04-28

### Added (plan 45 — custom fields & system stream in appTemplates)
- Two new event types in `definitions/eventTypes/eventTypes-hds.json` for the system-stream feature:
  - **`message/system-alert`** — operator → user notification carrying `{ level: 'info'|'warning'|'critical', title, body, ackRequired?, ackId? }`. Used on the account-level `app-system-out` stream.
  - **`message/system-ack`** — user → operator acknowledgement carrying `{ ackId, ackedAt, userNote? }`, paired with its originating alert by `ackId`. Used on `app-system-in`.
- Two new app-stream declarations in `definitions/appStreams.yaml`: `system-out` (eventType `message/system-alert`) and `system-in` (eventType `message/system-ack`). These describe the account-level system-stream pair provisioned once by the user's HDS-aware client app.
- New `documentation/CUSTOM-FIELDS-AND-SYSTEM.md` covering the data-model perspective: which eventTypes are reused for custom fields (none new — `note/txt`, `note/html`, `activity/plain`, `date/iso-8601`, `count/generic`), the two new `message/*` impls for system streams, and pointers to the runtime mechanics in `hds-lib-js`.
- Tests in `tests/customFieldsAndSystem.test.js` covering the new eventTypes, appStream declarations, and pack.json registration.

### Notes
- **No new eventTypes for custom fields.** Templates' `customFields[]` declarations carry their typing inline on each stream's `clientData.hdsCustomField[<eventType>]`, reusing the existing storage-shape eventTypes. The runtime parent-chain validator walk lives in `hds-lib-js` (Plan 45 Phase 3).
- **No `data-model/src/items.js` changes.** That file is a build-time loader for canonical item definitions; runtime validation against `clientData.hds*` declarations is a `hds-lib-js` concern.

## [1.5.0] - 2026-04-28

### Added (plan 50 — deprecated itemdef policy)
- `deprecated: { type: 'boolean' }` (optional) recognised in `src/schemas/items.js`. Round-trips through `pack.json`.
- Contract documented in `AGENTS.md` § "`deprecated: true` on items": flag means item is kept (existing events keep validating + rendering) but not used for new data points. Consumer apps MUST filter deprecated items out of discovery / picker UIs (form builders, item picker sheets, data-model browser); the resolution layer (`itemsDefs.forKey` / `forEvent`) MUST still return deprecated items so readers can render existing events.

## [1.4.0] - 2026-04-28

### Added (plan 48 — cyclefeminin import)
- `body-vulva-mucus-inspect-count` (`count/generic`, `repeatable: once`) — companion item in the `body-vulva-mucus-inspect` stream that captures the daily count of cervical-fluid self-observations. Creighton FertilityCare protocol mandates this count alongside the most-fertile observation of the day; reusable across any future Creighton/FertilityCare/Billings importer or app.
- `deprecated: true` flag added to three items (`body-vulva-mucus-stretch`, `body-vulva-wetness-feeling`, `fertility-cycles-charted-count`) — flag-only at this stage; formal contract (schema validation, `pack.json` surfacing, consumer-app handling) tracked under plan 48 phase 6.

## [1.3.2] - 2026-04-27

### Changed
- `wellbeing-self-rated-health` slider gains `display.suffix: { en: "/100", fr: "/100" }` so the EQ VAS readout, ARIA `aria-valuetext`, and the diary list (via `eventToShortText`) all show `"73 /100"` instead of just `"73"` or the raw `"0.73"`. Storage unchanged (raw 0..1 ratio/proportion).

## [1.3.1] - 2026-04-27

### Changed
- Item descriptions trimmed to short, patient-facing text (no spec/scale/instrument leakage). Affects `wellbeing-self-rated-health`, `wellbeing-mental-distress*`, `function-mobility`, `function-self-care`, `function-usual-activities`, `symptom-pain-severity`, `body-vulva-cervix-position`, `body-vulva-menstrual-cup`, `fertility-cycles-average-length`, `fertility-cycles-average-period`, `profile-avatar`. Full clinical/spec context retained in `documentation/` and per-item `references:` blocks.

## [1.3.0] - 2026-04-24

### Added (plan 44 — EQ-5D-5L PRO integration)
- New `function/` top-level stream with children `function-mobility`, `function-self-care`, `function-usual-activities` (ICF Activities & Participation — `d450`, `d510`/`d540`, `d630`/`d845`/`d920`).
- New items on the canonical 5-level severity scale (`ratio/proportion` with hooks `0.0 / 0.25 / 0.5 / 0.75 / 1.0`):
  - `function-mobility`, `function-self-care`, `function-usual-activities` — EQ-5D-5L D1–D3, WHODAS, SF-36 PF, PROMIS Physical Function, Barthel, Katz.
  - `symptom-pain-severity` (new child under existing `symptom-pain`) — overall pain intensity (VRS-5 / NRS / PROMIS Pain Intensity / SF-36 BP compatible).
  - `wellbeing-mental-distress` (combined), `wellbeing-mental-distress-anxiety`, `wellbeing-mental-distress-depression` — covers EQ-5D-5L D5 (combined), K6/K10, WHO-5 inverse, plus splitting PROs GAD/PHQ/HADS/DASS-21/PROMIS.
- `wellbeing-self-rated-health` — EQ VAS / SF-36 GH / PROMIS Global01 / SF-1 / NHIS-MEPS SRH. Uses new `type: slider` with `display.multiplier: 100` (raw 0..1 storage, 0..100 shown).
- **New `type: slider` field type** on the item schema — numeric input with `min`, `max`, `step`, optional `slider.{orientation, labels, display{multiplier, precision, suffix}}`. Enables VAS-style inputs and any bounded-range slider UI, separating storage (raw value) from display (multiplier/precision/suffix). Validator accepts slider for any numeric eventType.
- `documentation/DESIGN-NOTES.md` — new "Scale hook placement" subsection: `ratio/*` hooks must match semantic anchors of competing scales (ICF, EQ-5D, PROMIS, HealthKit), not even distribution. Canonical placements for 5-level, 4-level (subset), 3-level, 11-level severity families.
- `documentation/FUNCTION.md` — companion doc for the new `function-*` domain covering ICF alignment, WHODAS/EQ-5D/PROMIS/SF-36/Katz/Barthel mappings, and design decisions.
- `AGENTS.md` (repo root) — primer for future agents covering architectural principles, the scale-hook rule, reuse-first examples, anti-patterns, file orientation, and cross-system reference library.

### Changed (plan 44)
- `documentation/SYMPTOMS.md` severity-mapping table: Apple HealthKit 4-level placement updated from `0.0 / 0.33 / 0.66 / 1.0` (even distribution) to `0.0 / 0.25 / 0.5 / 1.0` (subset of the 5-level canonical scale). Not a breaking change — the severity extension was never implemented. Round-trip analysis in plan 44 research notes.
- `documentation/SYMPTOMS.md` decision #2 split into "transient mood tags" (→ `wellbeing-mood`, unchanged) vs "validated distress-severity ratings" (→ the new `wellbeing-mental-distress*` items). Hybrid sources (Mira's `symptoms.Anxiety` with optional `level`) map to the severity items.

### Added (earlier, prior to plan 44)
- Body temperature stream (`body-temperature`) and `body-temperature-basal` item (`temperature/c`) — basal body temperature for fertility charting.
- `body-vulva-menstrual-cup` item under `body-vulva` stream (`ratio/proportion`, light/moderate/heavy fill levels).
- Cognitive symptom stream (`symptom-cognitive`) and `symptom-cognitive-focus-difficulty` item — difficulty concentrating (SNOMED CT 76039006).
- `symptom-pain-muscle` item under existing `symptom-pain` stream — muscle / joint pain.
- `fertility-cycles-average-length` and `fertility-cycles-average-period` items (`time/d`, `repeatable: once`) — profile-level cycle/period length metrics.

All new items added in support of the FEMM bridge (plan 33).

## [1.2.0] - 2026-03-23

### Changed
- Convertible eventType schemas (`mood/5d-vectors`, `vulva-mucus-inspect/9d-vector`): content now uses `{ vectors, source? }` wrapper with documented source provenance block
- `medication-intake-basic` v3: `doseUnit` changed to select (9 options: tablet, drop, puff, mg, μg, ml, etc.), `route` changed to select (13 options: oral, sublingual, topical, IV, IM, SC, etc.). All labels localized (en + fr).

## [1.1.0] - 2026-03-19

### Added
- Converter engine definitions for cervical-fluid (11 methods, 9 dimensions) and mood (2 methods, 5 dimensions)
- Build pipeline for `dist/converters/` output (pack.json, per-item index.json and pack-latest.json)
- New eventType `vulva-mucus-inspect/9d-vector` for 9D vector observations
- `convertible` item type support in schema validation

### Changed
- `body-vulva-mucus-inspect` itemDef: type `convertible` with converter-engine block
- `wellbeing-mood` itemDef: type `convertible` with converter-engine block
- Deprecated `vulva-mucus-inspect/v0` eventType

## [0.5.0] - 2026-03-17

### Added
- Physical activity stream, items, and cross-system documentation
- Postpartum and miscarriage bleeding items under body-vulva-bleeding
- Expanded symptom model with clinical categories
- Nutrition stream
- Cervical position cross-system research documentation
- Cervical position and mood composite items with `canBeNull` support
- Wellbeing stream with sex-drive item
- Profile-avatar and profile-display-name definitions
- Skin items (body-skin-*) and mood/skin research docs
- Symptom stream hierarchy and items for Mira daily log symptoms
- `ratio/proportion` event type
- `test-result/scale` event type, fertility test items (OPK, pregnancy)
- `protected` option for fertility-sexual-activity (Mira bridge)
- Settings definitions to data model
- Unit conversion compilation to build pipeline
- Reminder configs to item definitions
- `medication/prescription-v1` event type with frequency/times-period

### Changed
- Redesigned `medication/basic` event type
- Updated bleeding model
- Renamed setting event types to kebab-case for Pryv API compatibility
- Migrated repeatable values to ISO 8601 format
- Bumped Node engine to `>=24`

### Fixed
- Fixed profile-avatar: use variations instead of `picture/*` wildcard
- Fixed `localizeFields` recursing into displayFields
- Removed note field from `medication/coded-v1` intake

## [0.4.0] - 2026-02-27

### Added
- Data source medication intake definitions
- Better medication model

## [0.3.0] - 2026-02-12

### Changed
- Migrated linting to ESLint 9 + neostandard
- Adopted HDS style system: palette class, Google Fonts

### Added
- Event type definitions packaged for consumption

## [0.2.0] - 2026-01-23

### Added
- Urine hormones to index
- Fertility items (hormones, cycles)

### Changed
- Updated variations schema

## [0.1.0] - 2025-09-24

### Added
- Medication model (step 1)
- Item references from streams
- Stream listing HTML page
- Select possible values display
- Live birth to pregnancy model
- Bleeding and wetness/wiping items
- Form schema task

## [0.0.1] - 2025-05-26

### Added
- Initial release
- YAML-based health data model definitions
- Stream hierarchy with items
- JSON schema generation
- Test suite for model validation
- Documentation site with CNAME
- Body weight translations
