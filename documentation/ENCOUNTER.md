# Care encounters and providers

A consultation, a hospital stay, an emergency, a day case, a teleconsultation or a home visit, and the doctors,
therapists and organizations involved. From [site-agents#24](https://github.com/healthdatasafe/site-agents/issues/24);
decisions in plan 114 (Q11, Q25-Q30, Q33, Q34), reviewed before release. Identifier systems and value sets below were read on
fhir.ch and hl7.org on 2026-10-29.

**Scope.** An encounter is the visit; a procedure (`procedure-*`) is what was done in it, a condition (`condition-*`)
what was diagnosed there, a document (`documents`) what was written about it. Those events point at the visit through
`clientData.related.<visitId>` (FHIR `Procedure.encounter`, `Condition.encounter`) or, for a document, `encounterId`;
the visit lists none of them. Appointments (future visits) are not modelled; the alternative that covers the need is a
reminder, or a note, until a booked visit happens and is recorded as one.

## Streams and consent

| Stream | Name | Item | eventType | FHIR resource |
|---|---|---|---|---|
| `encounter` (root) | Care encounters and providers | none | | |
| `encounter-visit` | Visits and stays | `encounter-visit` | `encounter/visit-v1` | Encounter |
| `encounter-provider` | Care providers | none | | |
| `encounter-provider-person` | Doctors and therapists | `encounter-provider-person` | `provider/practitioner-v1` | Practitioner (+ PractitionerRole) |
| `encounter-provider-organization` | Clinics, hospitals and practices | `encounter-provider-organization` | `provider/organization-v1` | Organization |

**Why this layout.** One consent unit: a grant on `encounter` covers visits and providers, and no existing grant
reaches the new root. Within it, each leaf carries **one FHIR resourceType**. A `fhir` block has exactly one
`resourceType`, so each item has one SMART scope pair, and a granted stream must hold one pair in its whole subtree
(FHIR-MAPPING.md, `computeFhirScopes`). An Encounter item on the root, or one provider item for people and
organizations, could therefore never be mapped without over-granting, and a published stream is never moved. The
roots that hold no item keep that door open; tests `[ENC-FHIR-2]` and `[ENC-FHIR-3]` prove both directions.

**Consent wording** (for the consent screens; stream `name` is a single English string): "Your consultations, hospital
stays and other care visits, with the doctors and places involved and the reason given, including sensitive visits." /
"Vos consultations, séjours hospitaliers et autres soins, avec les médecins et les lieux concernés et le motif indiqué,
y compris les visites sensibles." Stream names in French: "Soins et prestataires", "Consultations et séjours",
"Prestataires de soins", "Médecins et thérapeutes", "Cliniques, hôpitaux et cabinets".

## `encounter/visit-v1`

Closed, portable subset (no `const`, `if`, `not` or `$ref`). Item `encounter-visit`, `type: composite`.

| Field | Req. | Form | FHIR R4 Encounter |
|---|---|---|---|
| `kind` (enum, below) | ✔ | select | `class` |
| `specialty` (Coding, DocumentEntry.practiceSettingCode) | | | `serviceType` |
| `reason` (text as said or printed) | | text | `reasonCode.text` |
| `notes` | | text | not exported (R4 Encounter has no `note`) |
| `participants[]` `{ eventId?, name?, role? }` | | | `participant` |
| `serviceProvider` `{ eventId?, name? }` | | | `serviceProvider` |
| event `time` / `duration` | | | `period` |
| (derived) | | | `status` |

`specialty` is the same Coding as `file/xds-v1` `practiceSetting` (`{ system, version?, code, display? }`, `system` a
URI), pinned by `[ENC-ET-4]`.

### `kind` → `Encounter.class`

Class is 1..1, extensible to `http://terminology.hl7.org/ValueSet/v3-ActEncounterCode`, codes in
`http://terminology.hl7.org/CodeSystem/v3-ActCode` (https://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html).

| `kind` | base flavour (us, ips) | `ch` flavour |
|---|---|---|
| `consultation` | `AMB` ambulatory | `AMB` |
| `hospital-stay` | `IMP` inpatient encounter | `IMP` |
| `emergency` | `EMER` emergency | `EMER` |
| `day-case` | `SS` short stay | `AMB`: a Swiss day case is ambulant (BFS map, https://fhir.ch/ig/ch-term/ConceptMap-bfs-encounter-class-to-fhir.html: 1 ambulant → AMB, 3 stationär → IMP) |
| `teleconsultation` | `VR` virtual | `VR` |
| `home-visit` | `HH` home health | `HH` |
| `other` | `OTH` "other", system `http://terminology.hl7.org/CodeSystem/v3-NullFlavor` (no ActEncounterCode applies; the binding is extensible, so a validator warns and does not fail; `UNK` would be wrong) | same |

### Period and status

- `event.time` is when the visit began (`period.start`), `time + duration` when it ended (`period.end`).
- **No duration** (a point consultation, or a stay whose end the writer does not know): start only, status
  `finished`.
- **`duration: null`** (a running Pryv event): the stay is ongoing, status `in-progress`. Only for a stay still under
  way. **An unknown end is written as no duration, never `null`**, or the visit reads in-progress forever.
- The item declares `duration: { mandatory: false, canBeNull: true, maxSeconds: 31536000 }` (a year, a UI hint):
  `canBeNull` is what lets a form record an ongoing stay. Forms do not enter a duration today, so a stay entered by
  hand is a point event until a duration field exists; importers set it.
- **Status is derived, never stored.** A visit is recorded once it happened; appointments (future visits) are out of
  scope, and a writer does not record one as a visit.
- Partial dates apply as anywhere ("a hospital stay in March 1999"): `clientData.hdsTimePrecision`,
  [PARTIAL-DATES.md](PARTIAL-DATES.md).

### Participants and the service provider

| `participants[].role` | FHIR `Encounter.participant.type` (`http://terminology.hl7.org/CodeSystem/v3-ParticipationType`) |
|---|---|
| `attender` | `ATND` attender |
| `referrer` | `REF` referrer |
| `consultant` | `CON` consultant |
| `admitter` | `ADM` admitter |
| `discharger` | `DIS` discharger |

The participant type value set is extensible (https://hl7.org/fhir/R4/valueset-encounter-participant-type.html). No
`role`: a participant with no type. `participants[].eventId` points at a `provider/practitioner-v1` event
(`participant.individual`, a PractitionerRole when the practitioner has specialties or organizations), never at an
organization, which FHIR places in `serviceProvider`; `serviceProvider.eventId` points at a `provider/organization-v1`
event. Each entry needs an `eventId`, a `name`, or both: the name as printed is kept beside the id, so a reader who
cannot read the provider (below) still sees who it was.

**One entry per (eventId, role).** A practitioner who both admitted and discharged the person is listed twice, once per
role, so the same `eventId` can appear in two entries; that is why `participants` carries no `uniqueItems`.

## `provider/practitioner-v1` and `provider/organization-v1`

One event per provider, reused by every visit and document that names it. Both closed. Items
`encounter-provider-person` and `encounter-provider-organization`, `type: composite`; forms enter `name` only.

| Field | Practitioner | Organization | FHIR R4 |
|---|---|---|---|
| `name` (as printed) | ✔ | ✔ | `Practitioner.name.text` / `Organization.name` |
| `given` (one string, as printed), `family` | optional | | `HumanName.given` (split on spaces), `HumanName.family` |
| `specialties[]` (Coding, at least one) | optional | | `PractitionerRole.specialty` (0..*) |
| `identifiers[]` `{ system, value }` | optional | optional | `identifier` |
| `organizations[]` `{ eventId?, name? }` | optional | | `PractitionerRole.organization` |

A practitioner working at two places lists both in `organizations[]` (one PractitionerRole each); the visit's
`serviceProvider` says where a given visit happened. An organization has no specialty (FHIR Organization has none): a
department is its own organization ("HUG, Service de cardiologie").

**`specialties`** lists every specialist title as printed, in printed order ("Cardiology, General internal medicine"
is two Codings), as FHIR PractitionerRole.specialty is 0..* (Q33). A visit keeps one `specialty`
(`Encounter.serviceType`, 0..1): the department the visit was in, not the titles of the people in it.

**`given`** is one string as printed ("Anne Marie"), never split by the writer (Q34). The FHIR export splits it on
spaces into `HumanName.given` (`["Anne", "Marie"]`); `name` keeps the printed whole.

**A practitioner without `family`** exports as the base Practitioner with no CH Core claim: CH Core Practitioner
requires a family name (`ch-pract-1`, error level). The exporter never invents one.

### Identifiers

Values from **CH Core 6.0.0**, the IG pinned in `fhir/mapping.yaml` `flavours.ch`. CH Core publishes no
NamingSystem: each identifier is a data-type profile with a fixed `system`.

| Identifier | `system` | Value rule (CH Core, warning level) | On | Source |
|---|---|---|---|---|
| GLN | `urn:oid:2.51.1.3` | 13 digits, GS1 mod-10, starts `76` for a Swiss provider | practitioner (0..1), organization (0..1) | https://fhir.ch/ig/ch-core/6.0.0/StructureDefinition-ch-core-gln-identifier.html |
| ZSR / RCC | `urn:oid:2.16.756.5.30.1.123.100.2.1.1` | one letter and 6 digits, mod-26 | practitioner (0..*), organization (0..1) | https://fhir.ch/ig/ch-core/6.0.0/StructureDefinition-ch-core-zsr-identifier.html |
| UIDB / UID / IDE | `urn:oid:2.16.756.5.35` | `CHE` and 9 digits, mod-11 | organization (0..1) | https://fhir.ch/ig/ch-core/6.0.0/StructureDefinition-ch-core-uidb-identifier.html |
| BER / BUR | `urn:oid:2.16.756.5.45` | `A` or `B` and 8 digits, mod-11 | organization (0..1) | https://fhir.ch/ig/ch-core/6.0.0/StructureDefinition-ch-core-ber-identifier.html |

Slices per https://fhir.ch/ig/ch-core/6.0.0/StructureDefinition-ch-core-practitioner.html and
https://fhir.ch/ig/ch-core/6.0.0/StructureDefinition-ch-core-organization.html (open slicing; Organization `org-1`:
a name or an identifier, which `name` always satisfies).

- **Values are stored as printed and not pattern-checked** by the schema: CH Core's own rules are warnings, and a
  non-Swiss identifier follows other rules. An hds-lib GLN / ZSR check may come later.
- **A CDA document gives a GLN with root `1.3.88`** (GS1's OID). Importers write it as `urn:oid:2.51.1.3`, the CH
  Core system, so one provider never carries two spellings of one number.
- **An insurer's own provider number is not an identifier**: it has no citable system. The claims importer keeps it in
  its `clientData.sourceKey`.

### One provider, one event: `clientData.hdsGln`, `hdsZsr`

`sourceKey` is per tool ([PROVENANCE.md](PROVENANCE.md)), so two importers, or an importer and a hand entry, would each
create the same doctor. The GLN and the ZSR are the cross-writer keys:

- **`clientData.hdsGln`** and **`clientData.hdsZsr`**: the bare values (`"7601000000000"`, `"A123456"`, no system
  prefix) of the provider's GLN and ZSR identifiers in content, set in the same create or update as the content and
  removed when the identifier leaves it. UIDB and BER stay in content only.
- **Several ZSR numbers** (a practitioner billing from two practices): `hdsZsr` keeps its existing value while that
  number is still listed in content, else takes the first listed (what hds-lib `withRelatedMirror` does), so a re-run
  that reorders the list does not move the key. A lookup by another of the provider's ZSR numbers does not find it and
  falls through to the writer's `sourceKey`.
- **Before creating a provider, a writer looks it up** by `clientData.hdsGln`, then `clientData.hdsZsr`, then its own
  `sourceKey` (`events.get` with `types: ['provider/practitioner-v1', 'provider/organization-v1']`,
  `clientData: [{ "path": "hdsGln", "eq": "<value>" }]`, `state: 'all'`; both types, as a GLN can name a person or an
  organization), and reuses the event it finds, adding what it knows. Only then does it create one. An hds-lib helper
  fills the two keys from content.
- **A found provider that is trashed** is linked to (its `name` kept beside the id, as always) but never untrashed or
  updated: a re-run never restores what the person removed ([PROVENANCE.md](PROVENANCE.md)).
- Content is authoritative: if a key and the content disagree, the key is a writer bug (hds-lib `checkRelatedMirror`
  flags it as `stale-provider-key`: it would send another writer's lookup to the wrong provider).

### Specialty vocabularies (Q28)

The Coding shape is the same everywhere; the vocabulary depends on the resource it exports to.

| Field | Vocabulary | Source |
|---|---|---|
| visit `specialty` | DocumentEntry.practiceSettingCode, SNOMED CT incl. the Swiss Edition (OID 2.16.756.5.30.1.127.3.10.1.18; e.g. `394579002` Cardiology), as `file/xds-v1` `practiceSetting` | `http://fhir.ch/ig/ch-term/ValueSet/DocumentEntry.practiceSettingCode`, https://fhir.ch/ig/ch-term/ValueSet-DocumentEntry.practiceSettingCode.html |
| practitioner `specialties[]` | every specialist title as printed, in printed order; **preferred**: MedReg HCProfessional.hcSpecialisation, system `urn:oid:2.16.756.5.30.1.127.3.5` (e.g. `1025` Cardiology, `1040` General medical practitioner), the value set CH Core PractitionerRole.specialty binds (preferred); a practiceSetting SNOMED CT code is accepted | `http://fhir.ch/ig/ch-term/ValueSet/HCProfessional.hcSpecialisation`, https://fhir.ch/ig/ch-term/ValueSet-HCProfessional.hcSpecialisation.html, https://fhir.ch/ig/ch-core/6.0.0/StructureDefinition-ch-core-practitionerrole.html |
| organization | none | |

## Links

| Typed id in content | On | Points at |
|---|---|---|
| `participants[].eventId` | `encounter/visit-v1` | `provider/practitioner-v1` |
| `serviceProvider.eventId` | `encounter/visit-v1` | `provider/organization-v1` |
| `organizations[].eventId` | `provider/practitioner-v1` | `provider/organization-v1` |
| `authors[].eventId` | `file/xds-v1` | `provider/practitioner-v1` or `provider/organization-v1` |
| `encounterId` | `file/xds-v1` | `encounter/visit-v1` |
| `supersedes[]` | `file/xds-v1` | `file/xds-v1` |

- **Every id is mirrored** in `clientData.related.<eventId>: true` in the same write, and the key is removed when the
  id leaves the content on update (PROVENANCE.md, a MUST).
- **The new id fields carry the pattern `^[a-zA-Z0-9_-]+$`**, so each id is a valid `related` query path. The
  `file/xds-v1` fields predate the rule and keep `minLength: 1` only: tightening a published field would refuse
  content already written, while a new field can start strict.
- **Write order, sources first:** organization → practitioner → visit → document → the values read from the document
  (`related` only, FHIR `Observation.derivedFrom`). A writer never writes an id it has not created or found (by
  `hdsGln`, `hdsZsr` or `sourceKey`).
- **A dangling id** (deleted, trashed, not written yet, or on a stream the reader cannot read, such as a doctor holding
  `documents` but not `encounter`): the reader shows what the event itself says (the `name` kept beside the id) and
  never fails. An id whose target has the wrong type (a `serviceProvider` naming a practitioner) is ignored for display
  and flagged by the hds-lib check.

## Visibility

`reason`, `notes`, every `name`, `given` and `family` are free text and are shown to every reader of the stream. A
visit's reason can be sensitive; the consent wording says so.

## Forms and importers

The three items are `composite` (Q27): a person can log a visit (`kind`, `reason`, `notes`) or a provider (`name`), and
old builds render them (hds-lib lists `composite` items, hds-forms-js renders the fields it knows). Everything else is
importer-written: Codings, ids, identifiers, `given` / `family`, `organizations`. A form edit keeps those properties,
as it keeps the stored content it does not show. hds-forms-js, same release train: a cleared optional (`canBeNull`)
sub-field omits its key instead of writing `''`, which the closed schemas refuse (`minLength: 1`). Only `canBeNull`
sub-fields drop a cleared key: a cleared required `name` still writes `''`, and the form refuses to submit it
(`required`).

## FHIR mapping

No `fhir` block yet: the block's `resourceType` is Observation, Condition or Patient, and Encounter, Practitioner and
Organization need a renderer first (hds-fhir-js, then blocks; FHIR-MAPPING.md). `pack.fhirScopes` and the scope lock
are unchanged (`[ENC-FHIR-1]`). The future SMART keys are `Encounter` on `encounter-visit`, `Practitioner` (and
`PractitionerRole`, rendered from the same item) on `encounter-provider-person`, `Organization` on
`encounter-provider-organization`.

## Open points

- A practitioner's profession (doctor vs physiotherapist): CH Core PractitionerRole.code binds
  HCProfessional.hcProfession (preferred). An optional `profession` Coding is a minor addition.
- An organization's parent (a department within a hospital, FHIR `Organization.partOf`): a minor addition.
- A coded reason (`reasonCode` codings): free `reason` text today; diagnoses link to the visit through `related`.
- Appointments and a stored `status` (planned, cancelled): record the visit once it happened.
- Identifier `type`, `use`, `period`: closed `{ system, value }` today; opening is minor.
- GLN / ZSR / UIDB / BER value checks (hds-lib).
- Location as its own resource: the hosting organization (`serviceProvider`) carries it today.
- Whether the HL7 validator accepts NullFlavor `OTH` in `Encounter.class` under US Core: not verified.
