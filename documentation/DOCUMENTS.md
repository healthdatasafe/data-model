# Medical documents

A lab report, a consultation or hospital letter, a prescription, an imaging or procedure report, an administrative
document: the person keeps the file, and HDS keeps enough validated metadata to publish it as a FHIR
`DocumentReference` (R5; CH:EPR through an R4 view) or an IHE XDS / CH:EPR `DocumentEntry` without reading
`clientData`. From [site-agents#23](https://github.com/healthdatasafe/site-agents/issues/23).

## Stream and item

| | |
|---|---|
| Stream | `documents` ("Medical documents"), a root: not filed yet; below it `documents-clinical`, `documents-admin` and `documents-admin-insurance` ([Filing](#filing-4350)) |
| Item | `document`, `type: attachments`, `repeatable: any` (since 3.29.0); on the root only, a filed document resolves to it by walk-up |
| eventType | `file/xds-v1` |
| FHIR | `DocumentReference` + `Binary`, SMART scope key `DocumentReference\|clinical-note` on the root (since 4.2.0, [below](#fhir-documentreference-and-binary-420)); one scope class per filing stream, `filed-clinical`, `filed-administrative`, `filed-insurance` (plan 133) |

**One root; its children carry access, never a kind or a theme.** A document's kind (lab report, letter, …) and its
clinical theme are carried by its `class` and `type` codes, which become FHIR `DocumentReference.category` and `.type`.
The stream says who may read it. A document has never its own child under a clinical root: a new child under an existing root (`condition`, `treatment`, …) would be covered by every grant on that
root, so a doctor holding `condition` today would silently gain consultation letters; and a letter that spans
several themes would show all of them to whoever reads the stream it was filed under. A new root is covered by no
existing grant: an app asks for `documents` explicitly, and the person sees that request. A grant on `documents`
covers every document, filed or not, the sensitive ones included: say so where the person accepts it.

**Create the root before the first write.** As for `consents`: a writer creates `documents` (with its model name) on
the person's own connection before writing the first document. A filing stream is created, parents first and with its
model name, before the first document is filed in it: no item sits on it, so stream auto-creation does not know it.

**`type: attachments`.** An item type for documents: the files are Pryv attachments, the content is metadata. The
eventType must declare `attachmentRequired: true` (`src/items.js`). It is an item type only, like `system`, so no
composite field can be one. Forms do not enter it field by field: a document comes from an import, and forms show it
as not editable.

## The `document` item: held back in 3.25.0, published in 3.29.0

The pack is loaded at runtime by every deployed app. In 3.25.0 hds-lib `itemsDefs.getAllActive()` skipped only
`system` items, and hds-forms-js `schemaFor` threw on an item type it did not know, so a published `document` item
would have shown in the webapp Diary picker and broken its form in every build then deployed. 3.25.0 therefore shipped the root,
the eventType and the `attachments` rule, and **not the item**. The gate below was met on 2026-10-28 (hds-lib 2.28.0
and hds-forms-js 0.24.0 in hds-webapp, doctor-dashboard and the account app on demo and prod; no real users on any
build, mobile included, per the product owner), and 3.29.0 publishes the item. The gate, for the record:

1. hds-lib skips `attachments` items where a person picks or enters data (`getAllActive`);
2. hds-forms-js `schemaFor` and `HDSFormField` handle `attachments` ("not editable here");
3. every consumer that lists items for a person to pick runs those versions: hds-webapp (web on demo **and prod**,
   and the iOS / Android builds actually in use, which bundle the libraries and load the pack at runtime),
   doctor-dashboard, and anything else calling `getAllActive` (hds-lib `cmc/formSpec.ts` in bridges).

`deploy.sh` cannot check consumer versions, so this list is an explicit checklist item of the release that adds the
item; adding it is a minor (AGENTS.md), but it changes what every deployed consumer shows.

Until 3.29.0 a writer that needed `forEvent` to resolve its documents declared the item in its own overload, with the
same definition as below (hds-lib ≥ 2.24.0 accepts a restatement whose immutable fields — `type`, `streamId`,
`eventType`, … — are identical, so the overload keeps working once the item is canonical). An event on `documents`
resolved to no item until then.

```yaml
document:
  version: v1
  type: attachments
  label:
    en: Medical document
    fr: Document médical
    es: Documento médico
  description:
    en: A medical document you keep, such as a lab report, a letter, a prescription or an imaging report.
    fr: Un document médical que vous conservez, comme un résultat de laboratoire, une lettre, une ordonnance ou un compte rendu d'imagerie.
    es: Un documento médico que conserva, como un informe de laboratorio, una carta, una receta o un informe de imagen.
  streamId: documents
  eventType: file/xds-v1
  repeatable: any
  fhir:
    resourceType: DocumentReference
    category: clinical-note
    code:
      from: content
      field: type
      translate:
        "http://snomed.info/sct|4241000179101": { system: http://loinc.org, code: 11502-2, display: Laboratory report }
        "http://snomed.info/sct|371530004": { system: http://loinc.org, code: 11488-4, display: Consult Note }
        "http://snomed.info/sct|761938008": { system: http://loinc.org, code: 57833-6, display: Prescription for Medication }
        "http://snomed.info/sct|4201000179104": { system: http://loinc.org, code: 18748-4, display: Diagnostic imaging study }
      unknown: { system: http://terminology.hl7.org/CodeSystem/v3-NullFlavor, code: UNK, display: unknown }
    profiles:
      us: http://hl7.org/fhir/us/core/StructureDefinition/us-core-documentreference
  devNotes: >-
    One event per document: the file (or its pages) as Pryv attachments, the DocumentEntry metadata as content. The
    kind of document is its class and type codes, not a stream, and the `documents` root is a new root so no existing
    grant covers it. Not entered through a form: the person imports a file (forms show "not editable here"). A
    replacement is a new event listing the old one in `supersedes`. FHIR: a DocumentReference whose files are
    Binary resources (the `fhir` block, 4.2.0; IPS has no DocumentReference profile). See documentation/DOCUMENTS.md.
```

## FHIR: DocumentReference and Binary (4.2.0)

The `fhir` block above (plan 115 GAP H-8, [FHIR-MAPPING.md § DocumentReference](FHIR-MAPPING.md#documentreference-documents))
makes a document readable by a SMART on FHIR app as one `DocumentReference` whose files are `Binary` resources:

- **Scope key `DocumentReference|clinical-note`**, granted on `documents`: `patient/DocumentReference.rs` (with or
  without `?category=clinical-note`) reaches every document, filed or not, the sensitive ones included, as a grant on the
  root does. That holds for good, and also for a stock US Core app: the standard `clinical-note` scope reads every class
  (perki, 2026-11-27). The consent screen says so. **Every document carries `clinical-note`, administrative ones
  included** (an insurance letter, a kind "other"): it is the one code of US Core's DocumentReference category value set,
  the class name US Core gives everything a DocumentReference carries, not a claim about the document's content. The
  document's own `class` rides as another `category` coding, so what it is stays stated.
- **Scope classes, one per filing stream (plan 133).** An app that wants one class asks for it by an HDS category code
  (system `https://hds.ngo/fhir/CodeSystem/document-filing`, published as `pack.fhirScopeClasses`):

  | Scope | Reads | Does not read |
  |---|---|---|
  | `patient/DocumentReference.rs?category=filed-clinical` | `documents-clinical` | every other document, documents not filed included |
  | `patient/DocumentReference.rs?category=filed-administrative` | `documents-admin`, insurance papers included | clinical documents, documents not filed |
  | `patient/DocumentReference.rs?category=filed-insurance` | `documents-admin-insurance` | every other document, documents not filed included |

  **A class scope reads filed documents only:** a document on the root (not filed yet, nearly all of them before she
  files) is read by `clinical-note` and the type scope, never by a class. An app asking for `filed-clinical` sees only
  what she filed there; its consent text says so. A class is not a key of `pack.fhirScopes`: that table keeps one key
  for the whole tree, and the classes are published beside it ([FHIR-MAPPING.md § Scope classes](FHIR-MAPPING.md#scope-classes-packfhirscopeclasses)).
  A filed document carries the coding of its filing stream beside `clinical-note`, an insurance paper
  `filed-administrative` as well, so a category search agrees with the streams a grant reads. The native stream scope
  reads one class too (`hds/stream/documents-clinical.read`), for an app that knows the HDS streams.
- **`date`** is the event time (the document's date on the person's timeline), as an instant: it is what a `date`
  search filters, so a client that re-searches with a returned date finds the document again. The document's own
  authoring date and its precision are `content[].attachment.creation`; when the event was written is
  `Provenance.recorded`.
- **`type`:** the content's codings as written, led by the LOINC document type that US Core's required binding wants
  (`translate`: Laboratory report 11502-2, Consult Note 11488-4, Prescription for Medication 57833-6, Diagnostic imaging
  study 18748-4, each verified ACTIVE and `SCALE_TYP` Doc in the local LOINC release; the four CH:EPR typeCodes are the
  ones HDS's own writers use, hds-webapp and doctor-dashboard). Any other type, "Record artifact" (other documents)
  included, leads with v3 NullFlavor `UNK`, which the binding admits for exactly that case. The table is additive: a
  CH:EPR type gets its LOINC row when a writer uses it and an equivalent exists.
- **Files:** the facade serves `Binary/<eventId>.<fileId>` by streaming the Pryv attachment with its own exchanged
  token, under the same grant as the DocumentReference. The Pryv `readToken` (a credential, on the account's host)
  never reaches an app. In an export file the `url` is relative (`Binary/…`) and the file is not embedded.
- **Not rendered:** `encounterId` (no Encounter resource), `pages`, and whether another document supersedes this one
  (a reader would need a second query; the stored `status` is rendered as it is). `uniqueId` is not rendered yet; it
  maps to `masterIdentifier` as it is, once the renderer has a release that reads it (plan 115).
- **Import** (D12) is not implemented: `fromFhir` refuses the block. A DocumentReference import needs a writer that
  stores the file, so it comes with the first FHIR ingestion of documents.

## `file/xds-v1`

Class `file`, so a generic Pryv app still shows the attachment; version suffix as every HDS object type. Content is
closed (`additionalProperties: false`).

FHIR column: R4, as IHE MHD maps a DocumentEntry (CH:EPR is R4-based). R5 moves `practiceSetting` and `facilityType`
to the top level and `encounter` to `context`.

| Field | Req. | XDS DocumentEntry | FHIR DocumentReference (R4, MHD) |
|---|---|---|---|
| `class` (one Coding) | ✔ | `classCode` | `category` |
| `type` (Codings, typeCode first) | ✔ | `typeCode` | `type` |
| `title` | ✔ | `title` | `content.attachment.title` |
| `language` (BCP-47; `und` when unknown) | ✔ | `languageCode` | `content.attachment.language` |
| `creation` (FHIR dateTime: partial, or with its offset) | | `creationTime` | `content.attachment.creation` |
| `status` (`current`, `superseded`) | | `availabilityStatus` | `status` |
| `supersedes` (event ids) | | association `RPLC` | `relatesTo` (`replaces`) |
| `authors[]` (`eventId`, `name`, `organization`, `service`, `role`) | | `author` | `author` |
| `encounterId` | | `referenceIdList` | `context.encounter` |
| `practiceSetting` | | `practiceSettingCode` | `context.practiceSetting` |
| `facilityType` | | `healthcareFacilityTypeCode` | `context.facilityType` |
| `format` | | `formatCode` | `content.format` |
| `event[]` | | `eventCodeList` | `context.event` |
| `pages` | | | |
| `uniqueId` (Identifier `{ system, value }`, set by the issuing system) | | `uniqueId` | `masterIdentifier` |

**At publication.** XDS / CH:EPR require `creationTime`, `formatCode`, `healthcareFacilityTypeCode` and
`practiceSettingCode`, which the model keeps optional (an imported document may not say). The publisher derives what
is missing: `creationTime` from the event time, `formatCode` from the file type (e.g.
`urn:ihe:iti:xds:2017:mimeTypeSufficient`), facility type and practice setting from a default it states, or it refuses
to publish that document.

A Coding is `{ system, version?, code, display? }` with `system` a URI (`http://snomed.info/sct`, `http://loinc.org`,
`urn:oid:…`; checked as `scheme:`) and `version` the code system version when it matters (a SNOMED CT edition, such as
the Swiss extension). It is closed: FHIR Coding's `userSelected` is rejected, so an importer strips it. Opening it later
is a minor change.

**Codes.** `class` and `type` take their codes from the CH:EPR value sets
`http://fhir.ch/ig/ch-term/ValueSet/DocumentEntry.classCode` and `.typeCode`. A type belongs to one class: the pairs
are the CH Term ConceptMap's, published as [document kinds](#document-kinds-documentkinds-4170) since 4.17.0.

**Not stored, on purpose.** The confidentiality code (a choice made at publication) and the XDS SHA-1 hash (computed at
publication; the attachment's own integrity is its sha256).

**Time.** The event time is when the document belongs on the person's timeline. `creation` is when it was written,
when that differs. Which printed date is which: [below](#which-date-is-a-documents-date).

**Replacing a document.** A corrected or newer version is a new event that lists the old one in `supersedes`. The old
event stays, as Pryv keeps it. A reader treats a document as superseded when another document supersedes it,
whatever the old event's own `status` says, so a writer need not rewrite the old event (it may set its `status` to
`superseded`).

**A document already held: `uniqueId` and `clientData.hdsDocumentUniqueId`.** The same document can reach the account
from two sources that both carry its identifier: two importers, or an EPR import and a FHIR import. `sourceKey` cannot
tell, because it is per tool ([PROVENANCE.md](PROVENANCE.md)). The document's own identifier can. A scan, a photo or a
PDF loaded by hand carries none, so it is recognised by its importer's `sourceKey` only.

- **`uniqueId`** is the identifier the issuing system gave the document (XDS `uniqueId`, FHIR `masterIdentifier`), as
  a FHIR Identifier `{ system, value }`. A writer never makes one up. The XDS `entryUUID` / MHD `identifier` names a
  registry entry, not the document: it is not the `uniqueId`.
- **One spelling.** An OID or a UUID is stored as system `urn:ietf:rfc:3986` and value `urn:oid:<oid>` or
  `urn:uuid:<uuid in lower case>`, prefix in lower case (IHE ITI TF-2 Appendix Z.9.1, which MHD applies). That covers
  an XDS `uniqueId` (a string, bare or `urn:oid:` / `urn:uuid:` prefixed, in any case) and a FHIR `masterIdentifier`
  whose `system` is `urn:ietf:rfc:3986` (in any case), its `value` spelled either way. The schema refuses any other
  value under `urn:ietf:rfc:3986`. Not stored until that mapping is settled (Open points): an XDS
  `<root>^<extension>` identifier, and a `masterIdentifier` whose `system` is `urn:oid:<root>`, the same
  root-plus-extension form. Also not stored: a `masterIdentifier` without a `system`, whatever its `value`. Any other
  `masterIdentifier` is copied with `system` and `value` trimmed; `use`, `type` and `assigner` are stripped (the
  renderer restates MHD's fixed `type`). hds-lib `normalizeDocumentUniqueId` (2.55.0) applies these rules and returns
  `null` for what is not stored.
- **One per version.** A corrected document has its own `uniqueId` and lists the old event in `supersedes`. Two
  versions are two events; one version is one event.
- **`clientData.hdsDocumentUniqueId`** = `<system>|<value>` (the FHIR token form, e.g.
  `urn:ietf:rfc:3986|urn:oid:2.999.1.2.3`; `system` cannot hold `|`), set in the same create or update as `uniqueId`
  and removed with it (set to `null`: `events.update` merges `clientData`). It is the cross-writer lookup key: content
  is not searchable, `clientData` is, by exact match. If the two disagree, the content is authoritative and the key is
  a writer bug.
- **Before creating a document, a writer holding a `uniqueId` looks it up**: its own `sourceKey` first, then
  `events.get` with `types: ['file/xds-v1']`, `clientData: [{ "path": "hdsDocumentUniqueId", "eq": "<system>|<value>" }]`,
  `state: 'all'`. On a found event it only fills fields that are absent: it never replaces a value, never changes
  `sourceKey`, `status` or `supersedes`, and adds its file only when the event has no attachment. Several matches: the
  oldest `created`, never merged. An event found by `sourceKey` without a `uniqueId` gets it added. A trashed event is
  left trashed: a re-run never restores what the person removed ([PROVENANCE.md](PROVENANCE.md)). Only when nothing is
  found does it create the event. The lookup sees only what the writer's access reads; a `create-only` writer cannot
  look up.
- **Visible.** The identifier is shown to every reader of the stream and to each contact the document is shared with,
  in content and in `clientData`. An OID root can name the issuing institution even when `authors` is empty, and the
  id lets a reader with access to the source system match the document there. A writer does not store an identifier
  built from a patient or case number.

**No attachment.** Pryv lets an event exist before its attachment is uploaded. A reader shows a `file/xds-v1` event
without an attachment as a failed import, never drops it silently.

**Ids in content.** `supersedes[]`, `authors[].eventId` and `encounterId` are event ids. `supersedes[]` points at
other `file/xds-v1` events, `authors[].eventId` at a provider (`provider/practitioner-v1` or
`provider/organization-v1`), `encounterId` at a visit (`encounter/visit-v1`): see [ENCOUNTER.md](ENCOUNTER.md). Each one
MUST be mirrored in `clientData.related.<eventId>: true` ([PROVENANCE.md](PROVENANCE.md)) so a cohort query finds the
links; if the two drift, the content is authoritative. An author's `name` is the name as printed, kept beside
`eventId` so a reader who cannot read the provider still sees who wrote the document; an author entry needs at least
one field.

**Visibility.** `title`, `authors[].name`, `organization` and `service` are free text and are shown to every reader of
the stream, and to the contact a document is shared with. So is `uniqueId` (above).

**Validation.** The cores do not validate HDS types (an HDS type is unknown to them, so content validation is
skipped), and no core code reads `attachmentRequired`. Like every HDS schema it is advisory there; a writer
validates against the pack.

## Document kinds: `documentKinds` (4.17.0)

An importer that knows what a document is (a lab report, a discharge summary, a referral letter) writes the class and
first type of its kind, from the pack's `documentKinds` (`definitions/documentKinds.yaml`, `documentKinds.json`,
schema `json-schemas/documentKinds.json`). From [site-agents#36](https://github.com/healthdatasafe/site-agents/issues/36)
A9: until then every importer drafted its own table, and a first one drafted from the two value sets put types under
the wrong classes.

```json
"laboratory-report": {
  "label": { "en": "Laboratory report", "fr": "Rapport de laboratoire", "de": "Laborbericht", "it": "Referto di laboratorio" },
  "description": { "en": "The results of laboratory tests (blood, urine and other samples).", "fr": "…" },
  "class": { "system": "http://snomed.info/sct", "code": "371525003", "display": "Clinical procedure report" },
  "type": { "system": "http://snomed.info/sct", "code": "4241000179101", "display": "Laboratory report" },
  "timeBasis": "service",
  "stream": "documents-clinical"
}
```

- **Source.** One kind per row of the CH Term ConceptMap `DocumentEntryClassCodeToDocumentEntryTypeCode`, version
  3.4.0 (`source` in the table): 45 kinds, 17 classes, 29 types. Each type is in exactly one class, except Record
  artifact (`419891008`), which the ConceptMap pairs with every class: a class with more specific types has an
  "Other …" kind for it (`other-encounter-report`, `other-order`, `other-summary`, `other-procedure-report`,
  `other-care-plan`, `other-prescription`, `other-patient-record`, `other-health-event-record`, and
  `administrative-document`), a fallback when none of the class's specific kinds fits, never a default, and seven classes have
  Record artifact as their only type (referral letter, consent, advance directive, access log, emergency card, organ
  donor card, pregnancy or birth report). `other` is Record artifact for both.
- **Pick a kind by its `description`,** which says when it applies and how it differs from its neighbours (a
  medication list, a medication plan and a medication treatment decision; a referral letter and a transfer summary).
  When even the class is unclear, use `other`.
- **A detail kind (`documentKinds.detailKinds`, 4.32.0)** is for a document no CH Term row names, and no SNOMED CT or LOINC
  concept: it has the `class` and `type` of one of `kinds`, plus `detail`, a Coding of
  `https://hds.ngo/fhir/CodeSystem/document-kind` whose code is the kind's key. One today: `menstrual-cycle-chart`, beside
  `other-patient-record` (site-agents#67). A new one needs a use that routes on the kind; none is added to name a document
  more finely. It is a section of its own so that a reader of `kinds` alone never offers it: it would store the other
  kind. An app offers a detail kind only once it writes `detail` (hds-lib `documentKinds.codingsFor`).
- **Copy the Codings as they are** into `class` and `type[0]`, and `detail`, when the kind has one, into `type[1]`. `display` is the International Edition preferred term.
- **Swiss extension.** Three concepts are in the SNOMED CT Swiss extension, not the International Edition: class
  `2171000195109` Obstetrical record, types `2161000195103` Imaging order and `82291000195104` Medication dispense
  document. Their Coding carries `version: http://snomed.info/sct/2011000195101`, as the value sets list them; a
  terminology lookup against the International Edition does not find them. The other 42 codes are active in the
  International Edition (2026-02-01 release).
- **Reading a kind back.** Take the first `http://snomed.info/sct` coding in `type` (another writer may lead with a
  LOINC one) and `class`: the type identifies the kind, except Record artifact, where the class does. Among the kinds these codes fit, one whose
  `detail` (system and code) is also in `type` wins; without it, the one that has no `detail`. A reader that does not know
  `detail` reads the kind it shares its codes with. A document whose
  codes are in no kind keeps its codes; a reader shows it by its class `display` (its type would only say "Record
  artifact"), or as `other`.
- **Labels** are based on the CH Term designations (en-US, fr-CH, de-CH, it-CH), edited: typos fixed, a few
  renamed so that no two kinds share a label in one language (the build refuses that), and the "Other …" labels
  added. de and it are there because Swiss documents are written in them, and an agent classifying a document matches
  their words. hds-lib's `localizeText` reads en, fr and es only, so an app gets the de and it labels from the pack
  directly; the rest of the pack has no German or Italian yet.
- **Order.** The kinds are grouped by class in the file; JSON key order is no contract, so a picker groups by
  `class.code` itself.
- **Not in the table:** practice setting, facility type and format codes (chosen at publication, above), and the LOINC
  document type, which the `document` item's `fhir` block translates from the type.
- **A new CH Term release** may move a type or add a code: the table is checked against its ConceptMap by
  `tests/documentKinds.test.js`, whose copy of the pairs is updated with the table. A kind key is never renamed or
  removed: a pair a release drops stays, marked `deprecated: true`, so stored documents still read back, and pickers
  leave it out. A release that puts one type under two classes is refused by the build, and the reading rule above
  would need a revision first.

### Filing (4.35.0)

```
documents                        not filed yet
├── documents-clinical           everything about care
└── documents-admin              papers around care
    └── documents-admin-insurance    papers from and for insurers
document-shares                  one document shared with one contact (below)
```

| Stream | A grant on it reads | It does not read |
|---|---|---|
| `documents` | every document, filed or not | – |
| `documents-clinical` | the documents filed as clinical | invoices, insurance papers, documents not filed |
| `documents-admin` | the documents filed as administrative, insurance included | clinical documents, documents not filed |
| `documents-admin-insurance` | the insurance documents | other administrative papers, clinical documents, documents not filed |

A SMART app reads the same subtrees through the scope classes (`filed-clinical`, `filed-administrative`,
`filed-insurance`, [§ FHIR](#fhir-documentreference-and-binary-420)). So filing a document is also a disclosure to the
SMART apps granted a class, and her app counts their grants among who newly reads it.

- **Words.** A document is **received** when it is on a documents stream, the root included; **filed** when that stream is
  below the root.
- **One documents stream per document, first in `streamIds`,** then its share ids (below). Two would be read by the
  readers of either.
- **A kind's `stream`** is the default, chosen by what the document says about the person, not by its class: a medical
  certificate is "Administrative documentation" by its codes and is filed as clinical. A kind with no `stream` stays on the
  root: `other`, and `access-log`, which names everyone who opened the record. So does a document whose kind is pending. A
  `stream` the reader's model does not know is as none, and an older pack has none: nothing is filed.
- **No kind has `documents-admin-insurance` as its default:** one kind (`administrative-document`) covers invoices,
  policies and appointment letters. The person picks it. No program files there without her.
- **Filing is hers.** Her app files a document, with her token, when she says so: on its own, or as she confirms its kind
  when the same screen says where it goes ([CONVERSATION.md](CONVERSATION.md#writing-a-documents-date-and-kind-4260)). She
  may move it at any time.
- **Every other writer writes on the root only**: a contact through its receive child, a bridge, an assistant, an importer.
  The platform does not enforce it: an access with `contribute` on `documents` covers the streams below it. A document
  written on a filing stream by another writer is read by that stream's readers without her having said so.
- **Moving a document into a granted stream is a disclosure, and out of one takes it away** from its readers. Before a
  write that changes who reads it, her app says who newly reads it and who no longer does. Adding a stream below a granted
  one is the same decision, for the model.
- **Without a tap** only when all hold: she allowed it for that contact, the document is on the root and its kind pending,
  the proposal states that its kind was classified, and nobody reads the target who does not read the document now. No
  field of a proposal states it yet (`status` covers the date and the kind together and does not say it), so in this
  version her app always asks.
- **A write changes one thing.** `events.update` replaces the whole list: re-read `streamIds`, replace the documents
  stream only, keep every `share-…` id, write, re-read and check. A dropped id takes the document away from a contact,
  which then treats it as gone.
- **Before any writer files:** the readers on the account take this pack. A facade pinned to an older pack by its hash keeps
  it, and does not serve a document on a stream it does not know: raise its pin first.
- **Before a filing stream is granted or requested:** every app that accepts requests or shows who reads a document runs
  hds-lib 2.68.0, the mobile builds in use included. An older one answers "shared" by the root and the share ids only, so
  it can say a document is no longer shared while a filing stream still lets the contact read it.
- **The administrative streams are not "not sensitive".** An invoice names the provider, the speciality, the dates and
  the acts. Their consent text says so, and a narrower request says what it leaves out.
- **No migration.** A document stored before 4.35.0 is on the root: it is not filed, so a narrower grant does not read it
  until she files it, and nothing is shown to anyone new.
- **Readers** list `documents` (every filed document comes with it) and never take the stream for the kind.

Not modelled, each additive: a stream for advance directives, consents and emergency cards, when an emergency access needs
one (below `documents-clinical`: beside it, the move would take them from its readers); health insurance apart from other insurers (one insurer gets its own documents through its share child, since a
grant on the stream would read the other insurers' too); a restricted root, which cannot be a child (`explicitGrantOnly`
is for roots). Never a stream per kind, per sender or per contact.

### Which date is a document's date

The event `time` places the document on the person's timeline; `creation` is the date the document was written or
signed, when it differs. A kind's `timeBasis` is the writer's default for which date printed on the document is the
event time:

| `timeBasis` | Event time | Kinds |
|---|---|---|
| `service` | the date of the care the document reports: the sample taken (lab, pathology), the examination (imaging, history and physical), the operation, the consultation, the emergency visit, the dispense | reports, discharge and transfer summaries, emergency and allied-health reports, images, pregnancy or birth report |
| `creation` | the date the document was written or signed, the date `creation` holds | prescriptions, orders, letters, plans, certificates, consents, cards, lists, other summaries, administrative documents, `other` |

- **Care over a period takes its end; separate acts take the first.** A hospital stay, a transfer, a course of
  follow-up or therapy (progress and allied-health reports), a pregnancy: the day it ended (the discharge date for a
  discharge summary). A document reporting separate acts on several days (a lab report with samples on two days):
  the first day, and its own results carry their own times.
- **A record kept up to date** (a vaccination booklet, an allergy pass, an emergency card, a medication list or plan)
  often prints no issue date: take the date of its last entry or update.
- **Only a date from the document's body counts.** Never the fax header, the scan or print date, the upload date, the
  e-mail it came with or the date of a later copy: these say when a copy moved, not when the care happened. The one
  exception is the placeholder below, which says it is one (`hdsDocumentPending`).
- **When the kind's date is not printed,** use the other one (a lab report without a sampling date takes its report
  date). When no date can be read at all, ask the person; never fill one in. When the person does not know it either,
  the document is written with `hdsTimePrecision: unknown` (PARTIAL-DATES.md § A date nobody knows, 4.19.0): its
  `time` is then only the moment it was recorded, never a claim about the care. This is the one case where `time` is
  the recording moment, and the precision says it is not the document's date; its FHIR rendering has no `date`
  (FHIR-MAPPING.md § DocumentReference). An importer that cannot ask (a
  bridge, a batch run) holds the document for review, or writes the year or an `approx` date with `hdsTimeText`
  saying what is known, and never the upload date; it never writes `unknown` on its own.
- **Day, month, year.** A printed date has no hour: `time` is 12:00 UTC on that day with
  `clientData.hdsTimePrecision: day`, never local midnight. Partial dates ("03.1999", "spring 1998") follow
  [PARTIAL-DATES.md](PARTIAL-DATES.md) the same way, with `hdsTimeText` as printed. `creation` takes the date as a
  FHIR date (`1999-03-14`) or a partial one (`1999-03`).
- **A printed date can be wrong** (a template's date never updated, a typo, a year that contradicts the content). Check
  it against the content and the other documents of the same care; when in doubt, ask the person.
- **A default for writers, not a claim readers can use.** A reader cannot infer from the kind which date an existing
  event carries: the fallbacks above leave no trace, and older documents predate the table. The date of the care as
  a field of its own (XDS `serviceStartTime` / `serviceStopTime`) is an open point below.

### A document waiting for its date and kind (4.26.0)

She may add a document without saying when it is from or what it is, and let a contact propose both in the
conversation ([CONVERSATION.md](CONVERSATION.md#a-documents-date-and-kind-proposed-document-4260)). Her app then
writes it as a placeholder, stored as one: the "held for review" state above, on her own account.

```json
{
  "streamIds": ["documents"],
  "type": "file/xds-v1",
  "time": 1773842400,
  "content": {
    "class": { "system": "http://snomed.info/sct", "code": "419891008", "display": "Record artifact" },
    "type": [{ "system": "http://snomed.info/sct", "code": "419891008", "display": "Record artifact" }],
    "title": "IMG_2041.jpg",
    "language": "und"
  },
  "clientData": { "hdsDocumentPending": ["time", "kind"] }
}
```

- **`clientData.hdsDocumentPending`**: the fields she has not confirmed, `time`, `kind` or both, in any order, no
  repeat (schema `json-schemas/hds-document-pending.json`). `time`: the event time is the moment she added the
  document, not its date, and no `hdsTimePrecision` is written. `kind`: `class` and `type[0]` are the kind `other`'s.
- **Readers show it as waiting:** "date not confirmed" for a pending `time` (never the upload moment as the date of the
  care), "Other document" for a pending `kind`. The FHIR rendering omits `date` while `time` is pending, as for
  `hdsTimePrecision: unknown` (FHIR-MAPPING.md).
- **Any write that sets a field removes its entry:** her own edit of the date or the kind, or her confirmation of a
  contact's proposal (CONVERSATION.md § Writing a document's date and kind). The last entry removed, the key is
  written `null` (`events.update` merges `clientData`). A contact never writes it.
- **A stale flag.** An app older than 4.26.0 may set the date or the kind and leave the flag. So `time` counts as
  pending only while the event carries no `hdsTimePrecision`, and `kind` only while `class` and `type[0]` are still the
  kind `other`'s. An entry that fails this is stale: ignored by readers and by the conversation (no contact's proposal
  applies to it), and removed on the next write.
- **Older readers** show a pending document as it is stored: the moment she added it as its date, and "Other
  document". The flag is what tells a 4.26.0 reader otherwise.
- **Not retroactive.** A document added before 4.26.0 carries no flag: its date and kind are hers, and nothing is ever
  proposed onto it.

## Sharing one document: the `document-shares` root (3.37.0)

A person shares one document with one contact, and lets a contact send documents, through a child of a separate root.
The document stays one event on its documents stream, never copied.

| | |
|---|---|
| Stream | `document-shares` ("Shared documents"), a root; its children are created by the person's app |
| Item | none, anywhere in the subtree: `itemsDefs.forEvent` resolves a document through its documents stream, the first in `streamIds` |
| Stream key | `clientData.hdsDocumentShare` on each child ([PROVENANCE.md](PROVENANCE.md)) |
| Alerts | `document-shared`, `document-unshared`, `document-sent` ([CUSTOM-FIELDS-AND-SYSTEM.md](CUSTOM-FIELDS-AND-SYSTEM.md#documents-in-a-conversation-notificationalert-cmc-kinds-3370)) |

**Why a separate root.** Children of `documents` would show every vault reader whom the person shares with (every
reader of a stream sees its children's names and `clientData`), and would inherit every grant on `documents`.
`:_cmc:` subtrees are forbidden for reading.

**One child per relationship and direction, created by the person's app.**

- `id` = `share-` + 12 lowercase base36 characters (the platform takes `^[a-z0-9-]{1,100}$` at creation): random,
  never derived from a name, never reused across relationships, even with the same contact.
- `name` = the id itself. Pryv refuses two siblings with the same name, and the name must carry nothing.
- `clientData.hdsDocumentShare = { relationship: <CMC relationship id>, direction: 'shared' | 'received' }`. Only the
  contact granted that child reads it, and the relationship is its own.
- The person's app creates the root (with its model name) before the first grant, as for `documents` and `consents`.
- **A group asks for its own two ids (4.35.0).** Its members are minted accesses bounded by its offer, by exact stream id,
  so an offer made for a group names one new id at `read` and one at `contribute`, in that order, on a single-use invite
  (an open link would give every person the same ids). Her app creates and marks them after the accept.
- **An id asked for is checked before the accept, and again on the grant.** Every reader of a document sees the share ids
  it carries, so an offer or a scope request could name another contact's. Her app refuses an id that is another
  relationship's (marked, or named by another access), `document-shares` itself, a level a share child is never granted at,
  a level that does not fit the child's direction (its own `shared` child at `contribute` would let the contact change what
  she shared), and a second id for a direction (hds-lib `cmcDocuments.checkOfferedShares`, `ensureOfferedShareStreams`).

**Never granted as a whole.** A child is granted to one contact, by `consent/scope-update-cmc`:

- `direction: 'shared'`, level `read`: the documents the person shares with that contact.
- `direction: 'received'`, level `create-only`: the documents that contact may send (Route B), blind: it reads none back.
  Or level `contribute` (4.35.0), for an **uploader**: it lists, corrects and removes what it sent, while the document is open.

**An uploader's grant always holds a `shared` child, its `read` listed before the `contribute`,** for a single contact as
for a group. An app before hds-lib 2.65.0 takes the first share id it can read as the `shared` child: with the order kept it
shares on the right one, without it would put her own documents where the contact can change them. The order does not
cover its revoke, which sets `streamIds = ['documents']` on everything the received child holds: filed documents go back to
the root and lose the other contacts' share ids. So no HDS app grants `contribute` until the builds in use run 2.65.0.

**A shared document** has `streamIds = [<its documents stream>, <one or more share-… ids>]`. Sharing adds a share id,
taking it back removes it (`events.update` replaces the whole list: write, re-read, check); each touches the ids of its
own relationship only. Taking back tells the contact nothing, and says so to her, when the contact still reads the document
through a documents stream. Readers of the document see those
ids; they are opaque, so they learn how many shares exist, not with whom.

**A received document at `create-only`: replace, don't add.** The platform refuses an event to a reader when any of its
streams is `create-only` for that reader, so a document left in the receive child could never be shared back to its
sender. On receipt the person's app sets `streamIds = ['documents']`, or the stream it is filed in, in one `events.update`
(after checking it is a `file/xds-v1` event with its attachment). The receive child holds nothing processed.

**A received document at `contribute`: add, then freeze (4.35.0).** The received id stays on the document beside its
documents stream, so the sender goes on correcting it: **open**. Her app **freezes** it by replacing the received id by
the relationship's `shared` one (`read`): the sender still reads it and can no longer change or remove it, and a correction
is then a new document listing it in `supersedes`.

- Her app MUST freeze it before it shares it with someone else, and offers to at any time.
- A single contact's document SHOULD be frozen when it is filed (below the root). A group load may stay open, when she was
  told so at consent.
- **Open means it can change after she read it.** The platform keeps no history unless configured to, and the sender may
  rewrite `clientData`: "changed by the sender since" (`modified`, `modifiedBy`) is a signal, not proof. What was checked
  on receipt (type, size) held then.
- Going from `contribute` to `create-only` is refused while the child holds documents: freeze them first.
- A document waiting on the received child is in no `documents` query: her app lists it as waiting (sent, not received yet).

**Labels.** Readers never show a share child's name. They label it from `direction`, from the viewer's side:

| `direction` | Viewer | en | fr | es |
|---|---|---|---|---|
| `shared` | the person | Shared documents | Documents partagés | Documentos compartidos |
| `shared` | the contact | Documents shared with you | Documents partagés avec vous | Documentos compartidos con usted |
| `received` | the person | Received documents | Documents reçus | Documentos recibidos |
| `received` | the contact | Documents you send | Documents que vous envoyez | Documentos que usted envía |

**When a relationship ends.** On a full revoke the person's app first processes the receive child (every event on it
that is not filed gets `streamIds = ['documents']`, and the relationship's ids come off the filed ones), then deletes both
children with `mergeEventsWithParent: false`; documents keep their documents stream and the other contacts' ids. A restore recreates streams with their ids and `clientData` and keeps `streamIds`, but not accesses:
the person's app deletes a share child whose relationship no longer exists.

**Already sharing everything.** A contact that reads `documents`, a parent or `*` already reads every document: the
app sends only the alert, and offers no take-back. A contact granted a filing stream reads the documents filed there;
sharing one of them still adds its share id, so filing it elsewhere later does not take it away (hds-lib
`cmcDocuments.readsDocument` says whether a grant reads one document).

## Open points

- `class` is one Coding and `type` a list: `DocumentEntry.classCode` and `typeCode` are 1..1 each in XDS; the list
  carries other codings of the same type, typeCode first.
- Writer-side enforcement of `attachmentRequired` in hds-lib is optional and not done.
- What an administrative document is (invoice, policy, cost approval, reimbursement statement) has no code of its own: a
  table of sub-kinds, each a second `type` coding with its own default stream, is needed before a program may propose
  insurance.
- **No app freezes yet** (hds-lib `freezeDocument` exists, nothing calls it), and hds-lib does not refuse to share an open
  document. No app may grant `contribute` before both are done.
- Who sent a filed document is not kept: the received id goes at the freeze. A `clientData` key for it is to be defined.
- At `create-only` the contact cannot correct or retract a document sent to the wrong person, and at either level the
  platform bounds neither its type nor its size. Delivery by the platform, attachment included, is asked of Pryv; its
  event type will be the platform's.
- A superseded document: a share does not follow the new version. Whether marking the old one `superseded` should
  tell the contact that a newer one exists is open.
- Not modelled yet, minor to add: `serviceStartTime` / `serviceStopTime` (`context.period`).
- An XDS `uniqueId` in the `<root>^<extension>` form has no IHE rule for `masterIdentifier`, so it is not stored
  until settled (two importers guessing differently would split one document for good). Appendix Z.9.1.1's
  root-plus-extension rule (system `urn:oid:<root>`, value `<extension>`) is the likely one; settle it with the first
  source that sends one. A `masterIdentifier` already in that form (`system` `urn:oid:<root>`) is held back with it,
  and the schema refuses a `urn:oid:` system in any case (4.16.0), so settling it later is an addition, not a
  migration. It also refuses `urn:ietf:rfc:3986` in any spelling but lower case.
- The scheme case of other systems (`HTTPS://…` vs `https://…`) is stored as given, by the schema and by hds-lib
  alike: two writers spelling one system differently would not find each other's document. Not normalised yet.
- hds-lib (2.55.0) mirrors `hdsDocumentUniqueId` in `withRelatedMirror` (`null` on an update that drops the
  `uniqueId`) and reports `missing-document-key` / `stale-document-key` in `checkRelatedMirror`. It has no lookup
  helper: the writer runs the `events.get` above itself.
- `status` may gain `entered-in-error` (FHIR has it, XDS does not) if a need appears.
- Document kinds `image-reference` and `media-recording` (CH:EPR "Image" and "Picture/Video/Audio"), settled in
  4.17.1, by an **HDS convention**. What the Swiss sources say:
  - EPDV-EDI Annex 3, edition 7 (in force 2025-06-01), lists both as legal typeCodes under Clinical procedure report,
    with no definition or example. Edition 3 (2021) had only `900000000000471006`; `787148009` is there since edition
    6 (2024) at the latest.
  - eHealth Suisse's non-binding 2022 implementation aid ("Vereinfachte Anzeige und Handhabung der Metadaten im EPD",
    annex B.2) offers practitioners "Bild" with `900000000000471006`.
  - In SNOMED CT, `787148009` is a record type for a specimen. CH Term designates it "Bild/Video/Audio" with no
    specimen restriction.

  **The convention.** An HDS writer files every picture as `image-reference`. It files a video, a sound recording or a
  picture of a specimen as `media-recording`. A reader accepts either code for a picture, since another source may
  type a photo `787148009`. Revisit if a later edition of the annex drops one of them: the CH-EPR ART-DECOR changelog
  (2019-2020) once recorded `900000000000471006` as replaced by `787148009`, though neither the annex nor CH Term
  carried that through.
