# Medical documents

A lab report, a consultation or hospital letter, a prescription, an imaging or procedure report, an administrative
document: the person keeps the file, and HDS keeps enough validated metadata to publish it as a FHIR
`DocumentReference` (R5; CH:EPR through an R4 view) or an IHE XDS / CH:EPR `DocumentEntry` without reading
`clientData`. From [site-agents#23](https://github.com/healthdatasafe/site-agents/issues/23).

## Stream and item

| | |
|---|---|
| Stream | `documents` ("Medical documents"), a root with no children |
| Item | `document`, `type: attachments`, `repeatable: any` (since 3.29.0) |
| eventType | `file/xds-v1` |
| FHIR | `DocumentReference` + `Binary`, SMART scope key `DocumentReference\|clinical-note` (since 4.2.0, [below](#fhir-documentreference-and-binary-420)) |

**One root, no per-theme children.** A document's kind (lab report, letter, …) and its clinical theme are carried by
its `class` and `type` codes, which become FHIR `DocumentReference.category` and `.type`, never by the stream it is
filed under. A new child under an existing root (`condition`, `treatment`, …) would be covered by every grant on that
root, so a doctor holding `condition` today would silently gain consultation letters; and a letter that spans
several themes would show all of them to whoever reads the stream it was filed under. A new root is covered by no
existing grant: an app asks for `documents` explicitly, and the person sees that request. A grant on `documents`
covers every document, the sensitive ones included: say so where the person accepts it.

**Create the root before the first write.** As for `consents`: a writer creates `documents` (with its model name) on
the person's own connection before writing the first document. Until the item ships, hds-lib's stream auto-creation
does not know the root, as it works from items.

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
  without `?category=clinical-note`) reaches every document, the sensitive ones included, as a grant on the root does.
  The consent screen says so. **Every document carries `clinical-note`, administrative ones included** (an insurance
  letter, a kind "other"): it is the one code of US Core's DocumentReference category value set, the class name US
  Core gives everything a DocumentReference carries, not a claim about the document's content. The document's own
  `class` rides as a second `category` coding, so what it is stays stated.
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
  (a reader would need a second query; the stored `status` is rendered as it is).
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
`http://fhir.ch/ig/ch-term/ValueSet/DocumentEntry.classCode` and `.typeCode`. The model publishes no kind-to-code table:
the importer that classifies a document owns it. Several CH:EPR class, type and practice-setting concepts are Swiss
extension SNOMED codes, which the International Edition (and the workspace's snomed-db) does not hold. Check them on
fhir.ch, and say which are CH-extension, before shipping a table.

**Not stored, on purpose.** The confidentiality code (a choice made at publication) and the XDS SHA-1 hash (computed at
publication; the attachment's own integrity is its sha256).

**Time.** The event time is when the document belongs on the person's timeline. `creation` is when it was written,
when that differs.

**Replacing a document.** A corrected or newer version is a new event that lists the old one in `supersedes`. The old
event stays, as Pryv keeps it. A reader treats a document as superseded when another document supersedes it,
whatever the old event's own `status` says, so a writer need not rewrite the old event (it may set its `status` to
`superseded`).

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
the stream, and to the contact a document is shared with.

**Validation.** The cores do not validate HDS types (an HDS type is unknown to them, so content validation is
skipped), and no core code reads `attachmentRequired`. Like every HDS schema it is advisory there; a writer
validates against the pack.

## Sharing one document: the `document-shares` root (3.37.0)

A person shares one document with one contact, and lets a contact send documents, through a child of a separate root.
The document stays one event in `documents`, never copied.

| | |
|---|---|
| Stream | `document-shares` ("Shared documents"), a root; its children are created by the person's app |
| Item | none, anywhere in the subtree: `itemsDefs.forEvent` resolves a document through its `documents` stream id |
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

**Never granted as a whole.** A child is granted to one contact, by `consent/scope-update-cmc`:

- `direction: 'shared'`, level `read`: the documents the person shares with that contact.
- `direction: 'received'`, level `create-only`: the documents that contact may send (Route B).

**A shared document** has `streamIds = ['documents', <one or more share-… ids>]`. Sharing adds a share id, taking it
back removes it (`events.update` replaces the whole list: write, re-read, check). Readers of `documents` see those
ids; they are opaque, so they learn how many shares exist, not with whom.

**A received document: replace, don't add.** The platform refuses an event to a reader when any of its streams is
`create-only` for that reader, so a document left in the receive child could never be shared back to its sender. On
receipt the person's app sets `streamIds = ['documents']` in one `events.update` (after checking it is a `file/xds-v1`
event with its attachment). The receive child holds nothing processed.

**Labels.** Readers never show a share child's name. They label it from `direction`, from the viewer's side:

| `direction` | Viewer | en | fr | es |
|---|---|---|---|---|
| `shared` | the person | Shared documents | Documents partagés | Documentos compartidos |
| `shared` | the contact | Documents shared with you | Documents partagés avec vous | Documentos compartidos con usted |
| `received` | the person | Received documents | Documents reçus | Documentos recibidos |
| `received` | the contact | Documents you send | Documents que vous envoyez | Documentos que usted envía |

**When a relationship ends.** On a full revoke the person's app first processes the receive child (every event on it
gets `streamIds = ['documents']`), then deletes both children with `mergeEventsWithParent: false`; shared documents
keep `documents`. A restore recreates streams with their ids and `clientData` and keeps `streamIds`, but not accesses:
the person's app deletes a share child whose relationship no longer exists.

**Already sharing everything.** A contact that reads `documents`, a parent or `*` already reads every document: the
app sends only the alert, and offers no take-back.

## Open points

- `class` is one Coding and `type` a list: `DocumentEntry.classCode` and `typeCode` are 1..1 each in XDS; the list
  carries other codings of the same type, typeCode first.
- Writer-side enforcement of `attachmentRequired` in hds-lib is optional and not done.
- Per-kind child streams (to share only lab reports, for example) are not modelled. They can be added later as
  children of `documents` without breaking a grant on the root, but a grant on a child sees only the documents filed
  under it after the split: earlier ones would need re-filing, account by account. One document is shared through
  `document-shares` (above), not through a child of `documents`.
- A document a contact sends is written by the contact (Route B): the contact cannot correct or retract one sent to the
  wrong person, and the platform bounds neither its type nor its size. Delivery by the platform, attachment included,
  is asked of Pryv; its event type will be the platform's.
- A superseded document: a share does not follow the new version. Whether marking the old one `superseded` should
  tell the contact that a newer one exists is open.
- Not modelled yet, both minor to add: XDS `uniqueId` / FHIR `masterIdentifier` (to recognise a document already
  imported from the EPR) and `serviceStartTime` / `serviceStopTime` (`context.period`).
- `status` may gain `entered-in-error` (FHIR has it, XDS does not) if a need appears.
