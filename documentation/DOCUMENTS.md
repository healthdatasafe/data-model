# Medical documents

A lab report, a consultation or hospital letter, a prescription, an imaging or procedure report, an administrative
document: the person keeps the file, and HDS keeps enough validated metadata to publish it as a FHIR
`DocumentReference` (R5; CH:EPR through an R4 view) or an IHE XDS / CH:EPR `DocumentEntry` without reading
`clientData`. From [site-agents#23](https://github.com/healthdatasafe/site-agents/issues/23).

## Stream and item

| | |
|---|---|
| Stream | `documents` ("Medical documents"), a root with no children |
| Item | `document`, `type: attachments`, `repeatable: any`: **not published yet** (see below) |
| eventType | `file/xds-v1` |

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

## The `document` item: published later

The pack is loaded at runtime by every deployed app. Today hds-lib `itemsDefs.getAllActive()` skips only `system`
items, and hds-forms-js `schemaFor` throws on an item type it does not know, so a published `document` item would
show in the webapp Diary picker and break its form in every build already deployed. 3.25.0 therefore ships the root,
the eventType and the `attachments` rule, and **not the item**. It is published in a later minor once:

1. hds-lib skips `attachments` items where a person picks or enters data (`getAllActive`);
2. hds-forms-js `schemaFor` and `HDSFormField` handle `attachments` ("not editable here");
3. every consumer that lists items for a person to pick runs those versions: hds-webapp (web on demo **and prod**,
   and the iOS / Android builds actually in use, which bundle the libraries and load the pack at runtime),
   doctor-dashboard, and anything else calling `getAllActive` (hds-lib `cmc/formSpec.ts` in bridges).

`deploy.sh` cannot check consumer versions, so this list is an explicit checklist item of the release that adds the
item; adding it is a minor (AGENTS.md), but it changes what every deployed consumer shows.

Until then a writer that needs `forEvent` to resolve its documents declares the item in its own overload, with the
same definition as below (hds-lib ≥ 2.24.0 accepts a restatement whose immutable fields — `type`, `streamId`,
`eventType`, … — are identical, so the overload keeps working once the item is canonical). An event on `documents`
resolves to no item meanwhile.

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
  devNotes: >-
    One event per document: the file (or its pages) as Pryv attachments, the DocumentEntry metadata as content. The
    kind of document is its class and type codes, not a stream, and the `documents` root is a new root so no existing
    grant covers it. Not entered through a form: the person imports a file (forms show "not editable here"). A
    replacement is a new event listing the old one in `supersedes`. See documentation/DOCUMENTS.md.
```

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

**Ids in content.** `supersedes[]`, `authors[].eventId` and `encounterId` are event ids. Each one is mirrored in
`clientData.related.<eventId>: true` ([PROVENANCE.md](PROVENANCE.md)) so a cohort query finds the links; if the two
drift, the content is authoritative. `authors[]` without an `eventId` (a name as printed) is accepted until provider
items exist; an author entry needs at least one field.

**Visibility.** `title`, `authors[].name`, `organization` and `service` are free text and are shown to every reader of
the stream.

**Validation.** The cores do not validate HDS types (an HDS type is unknown to them, so content validation is
skipped), and no core code reads `attachmentRequired`. Like every HDS schema it is advisory there; a writer
validates against the pack.

## Open points

- `class` is one Coding and `type` a list: `DocumentEntry.classCode` and `typeCode` are 1..1 each in XDS; the list
  carries other codings of the same type, typeCode first.
- Writer-side enforcement of `attachmentRequired` in hds-lib is optional and not done.
- Per-kind child streams (to share only lab reports, for example) are not modelled. They can be added later as
  children of `documents` without breaking a grant on the root, but a grant on a child sees only the documents filed
  under it after the split: earlier ones would need re-filing, account by account.
- Not modelled yet, both minor to add: XDS `uniqueId` / FHIR `masterIdentifier` (to recognise a document already
  imported from the EPR) and `serviceStartTime` / `serviceStopTime` (`context.period`).
- `status` may gain `entered-in-error` (FHIR has it, XDS does not) if a need appears.
