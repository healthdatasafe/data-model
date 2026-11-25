# FHIR mapping (`fhir:` block on items)

**Status: published since 3.31.0 (plan 115, SMART on FHIR).** Everything below marked *permanent* is.

**Lab items (3.39.0; 3.44.0 adds untimed insulin; 3.48.0 adds six percentages; 4.0.0 adds urine LH, E3G and PdG;
4.5.0, plan 115 labs slice: 31 more, below):** 133 numeric lab items carry an `Observation|laboratory` block,
plus the two legacy
urine-hormone items (`fertility-hormone-lh`, `fertility-hormone-pdg`) that keep their replacement's block for their
past events. Where mass and moles of one
analyte are two LOINC codes (`BLOOD-CHEMISTRY.md` § Codes), the code comes from the eventType
(`code: { from: eventType, codings }`, below); otherwise it is static. **Urine E3G and PdG have no LOINC and no SNOMED
code** (the glucuronides; 2259-0 and 2833-2 are the aglycones, other substances), so their static code is the HDS item
coding, `https://hds.ngo/fhir/CodeSystem/item` with the item key, the same coding the generic rendering uses; US Core
binds a lab `code` to LOINC extensibly, so a local code is permitted where LOINC has none. If LOINC codes them one day,
the LOINC code becomes the block's `code` and the item coding its `alsoMatch`. The build holds each block to the item's
`references.loinc` and `variations.eventType.options[].loinc`, and no import key may be a code another item owns
(`[LABC-LOINC-1]`), so ownership and the import match keys cannot disagree. The method-specific codes
(`references.loincMethod`) are the block's `alsoMatch`. **Reach of the grant (decided 2026-11-02):** FHIR has no
category finer than `laboratory`, so `patient/Observation.rs?category=laboratory` reaches every mapped lab item, the
lipid panel as much as urine hCG (a pregnancy test), the semen analysis and the reproductive hormones; the patient
narrows it per stream on the consent screen, as for vital signs. Since the plan 133 slice (4.31.0) it also
reaches the three `*-coded` streams, the results with no item of their own, which hold infectious serology, viral
loads and drug levels; their stream descriptions say so on the consent screen. A lab event's printed range, flag and comparator
(`hdsRefRange`, `hdsInterpretation`, `hdsFlag`, `hdsComparator`) render as `referenceRange`, `interpretation` and the
Quantity `comparator` (BLOOD-CHEMISTRY.md § Cross-system). The `ratio/proportion` percentages render in `%` through
the `scaled-quantity` kind (factor 100): HbA1c, transferrin saturation, hematocrit, RDW, myelocytes and metamyelocytes,
and the percentages of the labs slice.
**The `lab-result/coded-v1` items** (`body-blood-coded`, `body-urine-coded`, `body-csf-coded`; plan 133, since
4.31.0) carry the result's own code and unit, so their block reads both from the content: `code: { from: concept }`
and `value: { kind: lab-result }` (§ code, § Value kinds). They claim no import key (§ Import), and their release
order is renderer first (§ Forward compatibility). Urine LH was unmapped until 4.0.0 because its stream holds the
legacy urine LH typed mg/L: that item now carries the same block, rendering its IU/L numbers in `[IU]/L`.

**The labs slice (4.5.0, plan 115):** every numeric lab item now carries a block. **Release order: data-model
first, then hds-fhir-js, then the facade pin and the extension options.** The pack is safe with hds-fhir-js 0.6.0: it
skips the INR block (unknown value kind), renders every other block, and on import refuses a resource coded with a
shared code, never misplacing one. The other order would leave the library's `check:pack` failing until the pack
publishes (31 mappings without a block). The hds-fhir-js release that follows knows `ratio-quantity` and a code
shared by two eventTypes (below); production sees neither until the facade is re-pinned.

- **The differential, percentage and absolute count together** (neutrophils, segmented and band neutrophils,
  lymphocytes, monocytes, eosinophils, basophils, reticulocytes): the two items of each pair sit on one stream, so they
  are mapped together, both `Observation|laboratory`, and the stream holds one pair; mapping one alone would have put
  the other, unmapped, under the same grant. The percentage is a `scaled-quantity` in `%` under the methodless
  "/Leukocytes" code (reticulocytes: "/Erythrocytes"), the count a `quantity` under the "[#/volume]" code, one code
  for its units (`10*6/mL` for 10⁹/L, `/uL`, and `10*9/mL` for the reticulocytes' 10¹²/L). The immature reticulocyte
  fraction (`33516-6`) and the four semen percentages (progressive `14194-5` and total `6800-7` motility, vitality
  `10613-8`, normal forms `10622-9`) are on streams of their own.
- **Two units of one property store one code** (total testosterone: ng/dL and ng/mL under `2986-8`, nmol/L under
  `14913-8`; C-peptide: nmol/L and pmol/L under `14633-2`): the eventType source gives both eventTypes that coding
  ([code from the eventType](#code-static-from-a-datasource-from-the-eventtype-or-from-the-content)), and on import
  the unit picks among the eventTypes the code names.
- **A unit LOINC has no code for** (`options[].loinc: null`): one is left, the pmol/L of 1,25-dihydroxyvitamin D
  (LOINC has moles for calcitriol alone, `14566-4`, and no D2 + D3 total in moles). It renders the **HDS item coding**
  on that eventType and the LOINC code on the other. **Fasting insulin in pmol/L is not one:** it stores `59179-2`
  "Insulin [Moles/volume] in Serum or Plasma --fasting", which the model overlooked from 3.44.0 until this slice.
- **eGFR** exports the equation-neutral `69405-9` ("Glomerular filtration rate [Volume Rate/Area] in Serum, Plasma or
  Blood by based on 1.73 sq M": no equation, no marker), which the item now asserts (`references.loinc`). The
  equation changes the number and is not stored, so the ten per-equation creatinine-based codes the item owns
  (`references.loincMethod`, the pediatric Schwartz and sex-specific MDRD codes since 4.10.0) are `alsoMatch`: a
  result coded with one imports, and the equation is not kept.
- **An item with no exportable LOINC code** renders the HDS item coding as its static code, as E3G and PdG do, with
  the codes it owns (`references.loincMethod`) as `alsoMatch`: LDH (the methodless `2532-0` is DISCOURAGED, the two
  ACTIVE codes each state a reaction direction the item does not store), Quick % (no LOINC code; `5894-1`, which
  European labs send it under, is import only: its LOINC definition, actual/normal time, runs the other way. **The
  unit is the guard:** the block's only unit is `%`, so a PT ratio sent as a ratio under `5894-1`, unit `1` or
  `{ratio}`, is refused, and only a figure in `%` imports; a true actual/normal ratio printed in `%` would import as
  a Quick %, the bet `references.loincMethod` already makes), sperm DNA fragmentation (one code, by flow cytometry)
  and the total motile count (none asserted; SNOMED CT `167806003` is the procedure, which no lab block codes an
  Observation with).
- **INR** (`6301-6`) is stored `{ value, relativeTo: 1 }` on `ratio/generic`: the new `ratio-quantity` kind renders
  `value` in UCUM `{INR}` ([value kinds](#value-kinds)). `38875-1` (PPP or blood, same method) is import only
  (`references.loincMethod`, 4.10.0); the specimen it leaves open is not kept, and the export says `6301-6`.

**Vital signs:** body weight, blood pressure (with its pulse as a split), heart rate, body height and oxygen saturation
(SpO2) carry an `Observation|vital-signs` block. **Body temperature is not mapped yet:** its stream holds the basal
body temperature (fertility charting) and that reading's disturbance flag, both unmapped, so a grant on it would
over-grant; mapping it means deciding whether a reader of vital signs may see the basal readings and their flags.

**Documents (4.2.0):** the `document` item carries a `DocumentReference|clinical-note` block, the first block on a
resourceType other than Observation and Condition, and the first whose code comes from the content
([DocumentReference: documents](#documentreference-documents)). Needs hds-fhir-js 0.5.0 to render; an older renderer
skips it (unknown resourceType), and a SMART app then sees no document.

**Medications (4.3.0, plan 115 medications slice):** the four medication items carry a block, the two intake
items a `MedicationStatement`, the two prescription items a `MedicationRequest`, both **bare scope keys** (no category
table: one item set per type, so a category would discriminate nothing). The coded twins take the medicine from the
datasource selection (`drug`, the national product as a second coding under `fhirMapping.productSystems`), the basic
twins the name as written through the `{ from: text, field }` code source, and all four carry the `dosage`
field, the regimen as a FHIR `Dosage` ([Medications](#medications-medicationstatement-and-medicationrequest)). Needs
hds-fhir-js 0.6.0 to render; an older renderer skips the blocks.

**Procedures (4.6.0, plan 115 procedures slice):** the two procedure items carry a `Procedure` block, a **bare
scope key** (no category table), the coded twin taking its code from the datasource selection (`procedure`), the
basic twin the name as written through the `{ from: text, field }` code source, which a Procedure now takes as a
medication does ([Procedures](#procedures-procedure)). An event that carries `count` is a lifetime tally, never a
Procedure. Needs the hds-fhir-js release that knows the resourceType; an older renderer skips the blocks, and a
SMART app then sees no procedure at all (not even the generic Observation an unmapped item renders as: a skipped
block renders nothing), which the pinned pack hash keeps from production until the facade is re-pinned. **Release
order: data-model first, then
hds-fhir-js, then the facade pin and the extension options, then hds-webapp and doctor-dashboard on the new library
tag** (their export indexes the live pack, [Forward compatibility](#forward-compatibility)). The `treatment`
items joined the key later ([Treatments](#treatments-procedure-over-a-period)).

**Treatments (4.34.0, plan 133):** the two treatment items carry a `Procedure` block too, with `status: { from: span }`, a new
block field: the status comes from the event's span, and the item has no import key
([Treatments](#treatments-procedure-over-a-period)). An older renderer does not know the field, skips the block and keeps
serving the events as generic Observations. Needs hds-fhir-js 0.14.0 to render.

**Questionnaire answers (4.12.0, plan 115):** the `questionnaire-answer` item carries a `QuestionnaireResponse`
block, a **bare scope key**, the first block with no `code` (the resource has none, and its content is read by
name) and with **no profile claimed** (`profiles: {}`)
([QuestionnaireResponse](#questionnaireresponse-questionnaire-answers)). The streams `questionnaire`,
`questionnaire-request` and `questionnaire-answer` and the two items are new with it, and the root is
**`explicitGrantOnly`**: a consent screen offers it unticked, under `patient/*.rs` too, and a `*` grant never
reaches it. Needs the hds-fhir-js release that knows the
resourceType; an older renderer serves an answer event as a generic Observation. **Release order: data-model first,
then hds-fhir-js, then the facade pin and the extension options (the extension rebuilt from that hds-fhir-js), then
the apps.**

**Questionnaire requests (4.13.0, plan 115):** the `questionnaire-request` item carries a `Questionnaire` block, a
**bare scope key** of its own, with no `code` and **no profile claimed** (`profiles: {}`), like its sibling
([Questionnaire](#questionnaire-questionnaire-requests)). A request event renders as the `Questionnaire` whose `url`
is the canonical the responses to it have carried since 4.12.0, so that canonical now names a resource a reader can
fetch. The stream is under the same `explicitGrantOnly` root: `patient/Questionnaire.rs` and `patient/*.rs` offer it
unticked. No stream, item or eventType is added. Needs the hds-fhir-js release that knows the resourceType; an older
renderer serves a request event as the generic Observation it was (0.8.0 and later; earlier ones render nothing for
it). **Release order: data-model first, then
hds-fhir-js, then the facade pin and the extension options, then the apps.**

**Allergies (4.21.0, plan 133):** the new `allergy` root and its two items, `allergy-coded` and `allergy-basic`, carry
an `AllergyIntolerance` block, a **bare scope key** (no category table), the coded twin taking its code from the
datasource selection (`allergen`), the basic twin the name as written through the `{ from: text, field }` code source,
which an AllergyIntolerance now takes as a medication and a Procedure do
([AllergyIntolerance](#allergyintolerance-allergies)). Both items are composites whose other fields the renderer reads
by name. Needs the hds-fhir-js release that knows the resourceType; an older renderer (0.8.0 and later) serves an
allergy event as the generic Observation of its item. **Release order: data-model first, then hds-fhir-js, then the
facade pin and the extension options, then the apps.**

An item's `fhir:` block says how its events **render as** a FHIR R4 resource and how a FHIR resource **imports
back** into an event of that item. HDS uses it in three ways:

1. **Export:** a SMART on FHIR app reads the patient's events as FHIR resources (`toFhir` in
   [`hds-fhir-js`](https://github.com/healthdatasafe/hds-fhir-js)).
2. **Import:** HDS reads resources from external SMART on FHIR servers (EHR patient-access APIs) into events
   (`fromFhir`). Every mapping round-trips, with one stated exception: a `Questionnaire` is rendered and never
   imported ([Questionnaire](#questionnaire-questionnaire-requests), Import).
3. **Authorization:** a SMART scope such as `patient/Observation.rs?category=vital-signs` is enforced by granting Pryv
   read access on streams. The build computes which streams, from the blocks, and publishes the table
   (`pack.fhirScopes`).

One block serves every rendering flavour (US Core, IPS, CH); only the profile differs per flavour. Most blocks map
one event to one resource; the Patient is the exception, assembled from several profile items
([Patient elements](#patient-elements)).

```yaml
body-weight:
  # …
  fhir:
    resourceType: Observation
    category: vital-signs
    code: { system: http://loinc.org, code: 29463-7, display: Body weight }
    alsoMatch:                                   # import only
      - { system: http://loinc.org, code: 3141-9, display: Body weight Measured }
    value:
      kind: quantity
      units: { mass/kg: kg, mass/lb: "[lb_av]" }  # every eventType of the item → UCUM
    profiles:
      us: http://hl7.org/fhir/us/core/StructureDefinition/us-core-body-weight
      ips: http://hl7.org/fhir/StructureDefinition/bodyweight
```

The shapes are in `src/schemas/items.js` (`defs.json`: `fhirBlock`, `fhirMapping`, `fhirCompanion`, `fhirElement`,
`fhirValue`, `fhirCode`, `fhirCoding`, `fhirProfiles`), the rules in `src/fhir.js`, the tests in `tests/fhirMapping.test.js`.

---

## Pack-level tables: `definitions/fhir/mapping.yaml` → `pack.fhirMapping`

One file holds the tables every block refers to. The build reads it to validate blocks and publishes it unchanged as
`pack.fhirMapping`, so a second implementer needs nothing but the pack.

| Key | Meaning |
|---|---|
| `formatVersion` | Version of the block format and of these tables: `1`. A consumer that does not know the version does not render the blocks. |
| `fhirVersion` | `4.0.1` (FHIR R4). |
| `flavours` | Flavour → the implementation guide its profiles come from, as `package#version`: `us` = `hl7.fhir.us.core#6.1.0`, `ips` = `hl7.fhir.uv.ips#2.0.1`, `ch` = `ch.fhir.ig.ch-core#6.0.0`. A profile URL in a block is a profile of that IG version. |
| `categories` | Per resourceType, category key → `{ system, code, display }`, the coding rendered in `category`. The key is also the SMART scope category. |
| `systems` | datasets-service code-system label → canonical URI (`SNOMED-CT` → `http://snomed.info/sct`, `ICD-10` → `http://hl7.org/fhir/sid/icd-10`, `LOINC`, `ATC`, `RxNorm`). One label per URI, so an imported coding maps back to one label. Used for codes taken from a datasource. |
| `productSystems` | national product code system (`drug.product.system`, MEDICATION.md § National products) → the URI its product code renders under, as the second coding of a medication concept: `Swissmedic` → `https://hds.ngo/fhir/sid/swissmedic` (an HDS identifier namespace: Swissmedic publishes none for the number plus sequence), `CIS` → `https://smt.esante.gouv.fr/terminologie-bdpm` (the ANS SMT's BDPM CodeSystem, whose specialite concepts are the CIS codes; the evidence is in the table's comment). One label per URI, distinct from `systems`, so an imported product coding never reads back as a `drug.codes[]` entry. The build holds the labels to the `product.system` enum of the coded medication eventTypes. |

Entries are additive: a published category key or system label is never renamed or removed.

### Categories per resourceType

| resourceType | Category keys | Required |
|---|---|---|
| Observation | `vital-signs`, `social-history`, `survey`, `laboratory`, `exam`, `imaging`, `procedure`, `therapy`, `activity` (system `http://terminology.hl7.org/CodeSystem/observation-category`) | yes |
| Condition | `problem-list-item`, `encounter-diagnosis` (system `http://terminology.hl7.org/CodeSystem/condition-category`), `health-concern` (system `http://hl7.org/fhir/us/core/CodeSystem/condition-category`) | yes |
| DocumentReference | `clinical-note` (system `http://hl7.org/fhir/us/core/CodeSystem/us-core-documentreference-category`), the one key of the US Core category value set: every HDS document, whatever its XDS class (4.2.0) | yes |

A resourceType that has a table must carry a `category` from it; a resourceType without a table takes none (Patient,
MedicationStatement, MedicationRequest, Procedure, QuestionnaireResponse, Questionnaire, AllergyIntolerance). The SMART scope key is `ResourceType|category` for a resourceType with a
table, and the bare resourceType otherwise (see [SMART scopes](#smart-scopes-packfhirscopes)). **A bare key is a
one-way door: once it is published, no category table can ever be added for that resourceType.** A block with a
category pairs its stream as `ResourceType|category`, and the lock holds the type's streams under the bare pair, so a
table added later would re-pair every one of them and the build refuses it ([Permanence](#permanence)). Nor can a
block emit a `category` coding without a table: if a profile ever requires one (US Core 6.1.0 marks
`MedicationRequest.category` Must Support), it is a renderer-side constant, never the pack. The medication types hold
one item set each, so `patient/MedicationRequest.rs` is the whole of it and a `?category=` on them grants nothing,
now and for good. So does `Procedure` ([Procedures](#procedures-procedure) gives the reasons): `patient/Procedure.rs`
is every procedure and every treatment (the `treatment` root is the key's second grant root, plan 133; any stream mapped
to `Procedure` later joins the same key the same way, never a category of it). `QuestionnaireResponse` is a bare key too
([QuestionnaireResponse](#questionnaireresponse-questionnaire-answers)), and so is `Questionnaire`
([Questionnaire](#questionnaire-questionnaire-requests)). So is `AllergyIntolerance` (4.21.0,
[AllergyIntolerance](#allergyintolerance-allergies)): `patient/AllergyIntolerance.rs` is every allergy, and the
content's `categories` (food, medication, environment, biologic) is never a scope category, now and for good.

---

## The block, field by field

A block is a **mapping** (below), a **companion**, `{ companionOf: <item key> }` (see
[Qualifiers](#qualifiers-companionof)), or a **Patient element**, `{ resourceType: Patient, element }` (see
[Patient elements](#patient-elements)).

| Field | Required | Meaning |
|---|---|---|
| `resourceType` | yes | `Observation`, `Condition`, `DocumentReference` ([documents](#documentreference-documents)), `MedicationStatement` or `MedicationRequest` ([medications](#medications-medicationstatement-and-medicationrequest)), `Procedure` ([procedures](#procedures-procedure)), `QuestionnaireResponse` ([questionnaire answers](#questionnaireresponse-questionnaire-answers)), `Questionnaire` ([questionnaire requests](#questionnaire-questionnaire-requests)), `AllergyIntolerance` ([allergies](#allergyintolerance-allergies); `Patient` is an [element block](#patient-elements)). *Permanent.* |
| `category` | per resourceType (table above) | Category key. *Permanent.* |
| `alsoMatchCategories` | no | Further category keys of the same table that a resource may carry and still import into this item, **on import only**, never emitted (smoking status filed under `survey` by older sources). Never the block's own category. |
| `code` | yes; none on a `QuestionnaireResponse` or a `Questionnaire` | The resource code: a **static coding** `{ system, code, display }`, or a **source**: `{ from: datasource, field: <dotted path> }`, `{ from: eventType, codings }`, `{ from: content, field, translate, unknown }`, `{ from: text, field }`, `{ from: enum, field, codings }` or `{ from: concept, field }` (below). |
| `alsoMatch` | no | Extra codings accepted **on import only**, never emitted. With a static code, a list; with an eventType code, keyed by the eventType each names (`{ concentration/mg-dl: [codings] }`). Never with a datasource code. |
| `alsoEmit` | no | Extra codings **emitted only**, after the static code in `code.coding`, never an import key: the second code a profile requires (US Core pulse oximetry wants 2708-6 beside 59408-5). A list, with a static code only. A resource that carries an `alsoEmit` coding without the code does not match the item. |
| `value` | no | FHIR `value[x]`, by `kind` (below). Absent on a Condition, a DocumentReference, a medication, a Procedure and an AllergyIntolerance, which have no `value[x]`. |
| `split` | no | Extra resources, one per numeric composite field (below). |
| `ignore` | no | Composite fields deliberately left out of the FHIR rendering. |
| `dosage` | on a medication | `{ field, doseUnits, routes }`: the regimen as a FHIR `Dosage` ([medications](#medications-medicationstatement-and-medicationrequest)). Required on a `MedicationStatement` or `MedicationRequest`, refused elsewhere. |
| `status` | on a treatment | `{ from: span }`: a Procedure's status from the event's span ([treatments](#treatments-procedure-over-a-period)). Required on a Procedure item whose `duration` may be null, refused elsewhere. |
| `profiles` | yes | Profile per flavour; `{}` claims none (below). |

**Codings** always have a canonical system URI (`http://loinc.org`, `http://snomed.info/sct`), never a label, a
non-empty `code` and a `display`. The display is the code system's official display, copied exactly: it is what a
reviewer checks the code against and what a reader falls back on.

### `code`: static, from a datasource, from the eventType or from the content

The code comes from one of seven sources: static, a datasource, the eventType, the content's own codings, a text field
(`from: text`), an enum of the content (`from: enum`, the "no known allergy" only), or a labelled concept of the
content (`from: concept`, a lab result with no item of its own).

- **Static:** `code: { system: http://loinc.org, code: 72166-2, display: Tobacco smoking status }`. Every event of the
  item has this code. When no LOINC or SNOMED CT code exists for the analyte, the static code is the **HDS item
  coding**: `{ system: https://hds.ngo/fhir/CodeSystem/item, code: <item key>, display: <English label> }`, the coding
  the generic rendering gives an unmapped item, here with a real UCUM unit, the category and the lab profiles (urine
  E3G and PdG, 4.0.0). It is a code like any other for the import keys and the lock. The same holds when codes exist
  but **none states what the item stores**: every one names a method or a reaction direction the item
  does not keep (LDH, sperm DNA fragmentation), or means something else (Quick %). The item then asserts no
  `references.loinc`, owns those codes in `references.loincMethod`, and its block lists them as `alsoMatch`: a result
  coded with one imports into the item, and the export never claims a method the event does not state. Look for a
  method-neutral code first: eGFR has one (`69405-9`), so it exports that and keeps its per-equation codes as
  `alsoMatch`. The item coding is always the item's own key, and **an item that asserts `references.loinc` never
  carries it as its static code** (nor any other non-LOINC code): the build refuses both.
- **From a datasource:** `code: { from: datasource, field: condition }`. The code is the selection a person made in a
  `datasource-search` field: the content at `field` (a dotted path) is a datasets-service selection
  `{ label, codes[] }`, and every entry of `codes[]` becomes a coding, its `system` label translated through
  `fhirMapping.systems`; `code.text` is `label.en`. The field must be a content property of the item's eventType that
  holds a `codes` array, and must be the item's datasource field (the item is `datasource-search`, or the field is a
  `datasource-search` field of its composite).
- **From the eventType:** the code depends on the unit, because a measure in mass and in moles is two LOINC codes:
  ```yaml
  code:
    from: eventType
    codings:
      concentration/mg-dl: { system: http://loinc.org, code: 1558-6, display: "Fasting glucose [Mass/volume] in Serum or Plasma" }
      concentration/mmol-l: { system: http://loinc.org, code: 14771-0, display: "Fasting glucose [Moles/volume] in Serum or Plasma" }
  ```
  Every eventType of the item, each with its coding (at least two distinct codings; one code for every unit is a
  static code). On an item that asserts LOINC, each coding is the code its unit option stores (`options[].loinc`).
  **Two units of one property store one code**, so two eventTypes may carry the same coding, with the same display
  (total testosterone: `concentration/ng-dl` and `concentration/ug-l` both `2986-8`), on an item that asserts
  `references.loinc` only: the unit options are what binds the repeat. **A unit whose option stores
  `null`** (LOINC has no code for it) carries the HDS item coding of the item, and nothing else: never a LOINC code of
  another property or of another analyte. On import, the
  matched coding names the eventTypes that carry it and only their units are accepted: a mass code with a moles unit is
  refused, never converted; a resource carrying the codes of two properties is refused; among the eventTypes one code
  names, the unit picks (the build keeps the units of a block distinct). `alsoMatch` is keyed by eventType here,
  so an import-only code names its eventType the same way (LDL: `13457-7` "by calculation" is a mass code and imports
  into `concentration/mg-dl` only):
  ```yaml
  alsoMatch:
    concentration/mg-dl:
      - { system: http://loinc.org, code: 13457-7, display: "Cholesterol in LDL [Mass/volume] in Serum or Plasma by calculation" }
  ```
- **From the content** (4.2.0, a `DocumentReference` only): `code: { from: content, field: type, translate, unknown }`.
  The content at `field` already holds FHIR Codings (a document's XDS `type`, CH:EPR SNOMED CT codes), and they are
  rendered as they are. The profile's binding may want another terminology (US Core binds `DocumentReference.type`,
  **required**, to the LOINC Document Ontology plus v3 NullFlavor `UNK`), so `translate` maps `"<system>|<code>"` to
  the coding that leads the concept: the first content coding the table knows gives it, else `unknown` does. The field
  must be a content property of the item's one eventType holding a Coding or a list of them; a key never translates to
  itself. No `alsoMatch`, no `alsoEmit`, no `value`. The item is matched on import by (resourceType, category) alone,
  one content-coded item per category, like a datasource code.
- **From the content as text** (medications, a `MedicationStatement` or `MedicationRequest` only): `code: { from: text,
  field: name }`. The resource carries no coding: the concept is `{ text: <the string at field> }`, the name of a
  medication as written (`medicationCodeableConcept.text`). The field is a `text` field of the item's composite, on
  an item with one eventType (a standalone `text` item cannot carry a `dosage`, so a medication block always sits on
  a composite). No `alsoMatch`, no `alsoEmit`. On import the item is
  matched by resourceType alone, one text-coded item per (resourceType, category), and only when no coding of the
  resource has a datasource label: a coded medicine goes to the datasource item, a name alone to this one
  (MEDICATION.md § A Swiss brand name: never a coded event with a guessed code). **A `Procedure` takes it too**
  (procedures slice): `code: { from: text, field: name }` on `procedure-basic` renders `Procedure.code` as
  `{ text: <name> }`, and the import rule is the same (a coding with a datasource label goes to `procedure-coded`, a
  name alone to `procedure-basic`). **So does an `AllergyIntolerance`** (4.21.0): `code: { from: text, field: name }`
  on `allergy-basic` renders `AllergyIntolerance.code` as `{ text: <name> }`, with the same import rule (a coding with
  a datasource label goes to `allergy-coded`, a name alone to `allergy-basic`). Any other resourceType refuses it.
- **From an enum of the content** (an `AllergyIntolerance` only, the "no known allergy" of plan 133): `code: { from:
  enum, field: scope, codings }`. The content at `field` is a required string enum, and each of its values renders as
  its own coding:
  ```yaml
  code:
    from: enum
    field: scope
    codings:
      all: { system: http://snomed.info/sct, code: "716186003", display: No known allergy }
      medication: { system: http://snomed.info/sct, code: "409137002", display: No known drug allergy }
      …
  ```
  Modelled on the code from the eventType, keyed by the enum value instead. The table sits in the block, not on the
  form options (no item option carries codes). The `codings` keys are exactly the eventType's enum at `field` (a
  `select` field of the composite whose options are that enum, never `canBeNull`), each a SNOMED CT coding, unique.
  No `alsoMatch`, no `alsoEmit`. On import each coding is a match key, like a code from the eventType, and names its
  value back; the import-only codes (a retired concept, the IPS `absent-unknown-uv-ips` codes) are hds-fhir-js rules,
  never block entries. Any other resourceType refuses it.
- **From a labelled concept of the content** (an `Observation` only, the `lab-result/coded-v1` items of plan 133):
  `code: { from: concept, field: analyte }`, always with `value: { kind: lab-result }`. The content at `field` is
  `{ label: { en, fr?, es? }, codes: [Coding] }`: every entry of `codes` is a coding as stored (the systems are
  already canonical URIs, no `fhirMapping.systems` translation), `version` and `display` kept, `hdsId` dropped, a
  LOINC coding first; `code.text` is `label.en`, with `fr` and `es` as the `translation` extension. Named by its
  shape, not by the domain: unlike a datasource selection, also `{ label, codes[] }`, its label is localised, its
  systems are canonical URIs as stored and no datasource stands behind it; `from: content` stays the
  DocumentReference source (a Coding list, not a labelled concept). The item's one eventType is `lab-result/coded-v1`
  and `field` is its `analyte`. No `alsoMatch`, no `alsoEmit`, no `alsoMatchCategories`, and the item owns no LOINC
  code. **A renderer supports the pair**, the `concept` code with the `lab-result` kind, never either alone: a later
  `lab-result/coded-v2`, or a `concept` code on another resourceType, takes a new kind. **It claims no import key** and is never matched by code or category: the three items share
  (Observation, laboratory), one per specimen, and nothing in a resource states the specimen for sure, so the
  importer is told the item (§ Import). Since 4.31.0.

### Value kinds

| `kind` | Item | Block fields | Renders |
|---|---|---|---|
| `quantity` | `number`, every eventType numeric | `units`: every eventType of the item (its unit variants) → UCUM code, none empty, no two the same (annotations such as `{beats}` aside: they carry no meaning in UCUM; one unit written with other powers of ten is the same one) | `valueQuantity` (`system` UCUM, `code` = `unit`); a lab event's `hdsComparator` as its `comparator`, `hdsRefRange` as `referenceRange` (limits in the same unit), `hdsInterpretation` and `hdsFlag` as `interpretation`, and back on import (BLOOD-CHEMISTRY.md § Cross-system) |
| `scaled-quantity` | `number`, every eventType numeric | `units`: every eventType of the item → `{ unit, factor }`: the UCUM code it renders in and the factor from the stored number to the rendered one (`factor > 0`); units distinct as for `quantity` | `valueQuantity` of the stored number × `factor` in `unit`; the lab extras as for `quantity`, the range limits × `factor` too. On import the value and the limits are divided by `factor` |
| `ratio-quantity` | `number`, every eventType an object `{ value, relativeTo }` (`ratio/generic`) | `units`: every eventType of the item → UCUM code, distinct as for `quantity`; `relativeTo`: the item's fixed denominator (`ratioRelativeTo`) | `valueQuantity` of `content.value` in the unit, with the lab extras as for `quantity`; an event whose `relativeTo` is not the block's is refused. On import the content is `{ value, relativeTo }` with the block's denominator |
| `coded` | `select` | `options`: every option value → coding, each coding once; optional `alsoMatch`: option value → extra codings accepted for that option on import only | `valueCodeableConcept` (the option coding, never an `alsoMatch` one) |
| `components` | `composite` | `components`: numeric composite field → `{ code, unit }` | `component[]`, one per field present |
| `lab-result` | `imported`, eventType `lab-result/coded-v1`, with a `concept` code | none | from the content (BLOOD-CHEMISTRY.md § The three items, Cross-system): `valueQuantity` (`value`, `comparator`, `unit` as the UCUM `code`, `unitText` else the code itself as `unit`), else `valueCodeableConcept` (`valueCodes`, `valueText` as text), else `valueString` (`valueText`); the printed text of a semi-quantitative result in the `https://hds.ngo/fhir/StructureDefinition/printed-result` extension, with a readable copy in `note`; `notes` as a `note`; the range and interpretation from `clientData` (the range text only when there is no `value`; `clientData.hdsComparator` is not read); the item's key as `meta.tag` in `https://hds.ngo/fhir/CodeSystem/item`; the lab profiles only when the analyte has a LOINC coding |

**`lab-result`** reads an object eventType, not a composite, so the composite accounting of the next section does not
see it: the build holds instead that the keys of `lab-result/coded-v1` are exactly the ones the kind reads, at every
level (the content: `analyte`, `value`, `comparator`, `unit`, `unitText`, `valueText`, `valueCodes`, `notes`;
`analyte`: `label`, `codes`; `label`: `en`, `fr`, `es`; a Coding: `system`, `version`, `code`, `display`, and `hdsId`
in `analyte.codes`), and that `comparator` allows `<`, `<=`, `>`, `>=` only (it renders as `Quantity.comparator`), so
a key or a value added to the eventType fails the build until the renderers place it.

Published with the first rendering, in hds-fhir-js and not in the pack, and permanent from then on: the extension
`https://hds.ngo/fhir/StructureDefinition/printed-result` (a `valueCodeableConcept`; no StructureDefinition is
served, the URL does not resolve), the `meta.tag` coding `https://hds.ngo/fhir/CodeSystem/item|<item key>` (a
forged or stripped tag only falls back to the caller-named import, with its guards), a LOINC coding first in
`code.coding`, and the lab profiles claimed only when there is one (the US Core one only with a date known to the day
too, § Time). It is a kind of its own, and the `concept` code a source
of its own, for [forward compatibility](#forward-compatibility): a renderer that knows neither, or only one of them,
skips the block and keeps the generic Observation.

The schema discriminates by kind: a kind's fields are refused on another kind. `coded` is refused on a
`multi-select`: one resource with several answer codings would state one answer with several codes, not several
answers. A multi-select mapping needs its own design.

**`scaled-quantity`** is for an item that stores a number in another unit than the one FHIR needs, by an exact factor:
a proportion stored `0..1` that FHIR states in `%` (factor 100), a height stored in metres or feet that the body height
profiles take in `cm` or `[in_i]` only (factors 100 and 12). The factor is a definition of the units, never a
measured conversion (that stays the item's `unitConversions`). Only a multiplicative factor belongs here: an offset
or any other conversion (a temperature in °F to `Cel`) is a new value kind, never a field of `scaled-quantity`, since
a renderer that does not know the field would emit the unconverted number.

```yaml
body-blood-hba1c:
  fhir:
    # …
    value:
      kind: scaled-quantity
      units:
        ratio/proportion: { unit: "%", factor: 100 }   # 0.057 renders as 5.7 %, 5.7 % imports as 0.057
```

The product and the quotient are rounded to 15 significant digits, so a binary rounding artefact never reaches
either side (`0.07 × 100` is `7`, not `7.000000000000001`). It is a kind of its own, not a field of `quantity`, for
[forward compatibility](#forward-compatibility): a renderer that does not know it skips the block, where a renderer
that ignored an unknown `quantity` field would state `0.057 %` for `5.7 %`. For the same reason the build refuses a
`ratio/proportion` eventType rendered in `%` with any factor other than 100, a plain `quantity` included.

**`ratio-quantity`** is for a `type: number` item on `ratio/generic`, whose content is never a bare number but
`{ value, relativeTo }` with a denominator the item fixes (`ratioRelativeTo`; BLOOD-CHEMISTRY.md § A ratio with a fixed
denominator). The one such item is the INR:

```yaml
body-blood-coagulation-inr:
  fhir:
    # …
    value:
      kind: ratio-quantity
      units:
        ratio/generic: "{INR}"     # { value: 2.5, relativeTo: 1 } renders as 2.5 {INR}
      relativeTo: 1                 # the item's ratioRelativeTo; an event carrying another one is refused
```

The Quantity is `content.value`, never divided by `relativeTo`: the denominator is part of the definition of the
figure, and the block states it so that a renderer holding the block alone can refuse an event that carries another
one rather than state a number on another scale. `clientData.hdsRefRange` limits are on the scale of `value`. It is a
kind of its own for the same [forward compatibility](#forward-compatibility) reason as `scaled-quantity`: a renderer
that read the object as a number would throw on every event, or worse. A `select` on `ratio/generic` (a score out of
its maximum) is not a `ratio-quantity`: it is `coded` or unmapped.

**Option keys** are the option value as a string, as JavaScript prints it: `never`, `0.75`, and `1` for `1.0`, `0` for
`0.0`. Quote them in YAML (`"1": …`).

**Per-option `alsoMatch`** lists answer codings a source may send for an option, finer or older than the option's
own, that **truly mean that option**: US Core's "Smokes tobacco daily" (449868002) is a current smoker, so it is
an `alsoMatch` of `current`. Keys are option keys; every coding, option codings and `alsoMatch` codings together,
appears once in the item, so an imported answer maps back to one option. What the finer coding adds (daily, heavy)
is not stored. Not on a Patient element.

```yaml
lifestyle-tobacco-smoking:
  fhir:
    # …
    value:
      kind: coded
      options:
        current: { system: http://snomed.info/sct, code: "77176002", display: Smoker }
        # …
      alsoMatch:
        current:
          - { system: http://snomed.info/sct, code: "449868002", display: Smokes tobacco daily }
```

### Composite items: `components`, `split`, `ignore`

Every top-level field of a composite item is accounted for, exactly once: as a component, as a split, as the
datasource or text field of the code, as the `dosage` field of a medication, as the `notes` of a Procedure (rendered
as `Procedure.note`, by name), as one of the fields of an AllergyIntolerance the renderer reads by name (`status`,
`verificationStatus`, `categories`, `type`, `criticality`, `lastOccurrence`, `notes`;
[AllergyIntolerance](#allergyintolerance-allergies)), or in `ignore`. A field that is none of these fails the build, so a field added to the
composite later cannot silently vanish from the FHIR rendering.

- **Components and split fields are numeric** (`number` or `slider`), and one field is never both.
- **`split`** derives an extra resource from one field: `split: { rate: { code, unit, profiles } }` renders the pulse of
  a blood-pressure event as its own heart-rate Observation, as US Core expects. A split resource **inherits the
  parent's resourceType and category** (so it falls under the same SMART scope); it has its own code, unit and
  profiles. Its id is `<event id>-<field>`. Split codes differ from the parent code and its component codes.
- **Nullable fields** (`canBeNull: true`): a component whose field is null or absent is left out of `component[]`; a
  split whose field is null or absent yields no extra resource. The blood-pressure pulse is both optional and split.
- **`ignore`** lists fields that are not rendered, on purpose. An ignored field is a composite field and is not also
  mapped.

### Profiles

`profiles: { us: <url>, ips: <url>, ch: <url> }`, each a profile of the IG version in `fhirMapping.flavours`. A
flavour that is **absent renders the base resource, with no profile claim** (`meta.profile` is omitted). There is no
`null`: absence is the statement. `{}` claims no profile in any flavour. A split entry has its own `profiles`.

### DocumentReference: documents

The `document` item (`documents` root, `file/xds-v1`, [DOCUMENTS.md](DOCUMENTS.md)) carries the one
`DocumentReference` block (4.2.0, plan 115 GAP H-8). One event renders as one `DocumentReference` whose files are
`Binary` resources the facade streams from the Pryv attachments; the block owns the metadata side only.

```yaml
document:
  fhir:
    resourceType: DocumentReference
    category: clinical-note
    code:
      from: content
      field: type
      translate:
        "http://snomed.info/sct|4241000179101": { system: http://loinc.org, code: 11502-2, display: Laboratory report }
        # … Consult Note, Prescription for Medication, Diagnostic imaging study
      unknown: { system: http://terminology.hl7.org/CodeSystem/v3-NullFlavor, code: UNK, display: unknown }
    profiles:
      us: http://hl7.org/fhir/us/core/StructureDefinition/us-core-documentreference
```

| Content, event | DocumentReference (hds-fhir-js `toFhir`) |
|---|---|
| `type[]` | `type.coding`: the translated LOINC document type (else `UNK`) first, then the content codings as written |
| `class` | `category[1]`; `category[0]` is the block's `clinical-note` |
| `status` | `status`: `superseded` as stored, else `current`. Whether another document supersedes this one is not looked up |
| `supersedes[]` | `relatesTo[]` `{ code: replaces, target: DocumentReference/<id> }` |
| `title` | `description`, and each attachment's `title` when the file has no name |
| `language` | `content[].attachment.language` (left out when `und`) |
| `creation`, else the event date | `content[].attachment.creation`; with `hdsTimePrecision: unknown` (4.19.0), or while `hdsDocumentPending` holds `time` (4.26.0), only from `creation`, never from the event time |
| `authors[]` | `author[]` as `display` only (name, organization, service joined): no Practitioner or Organization resource is served |
| `practiceSetting`, `facilityType`, `event[]` | `context.practiceSetting`, `.facilityType`, `.event[]` |
| `format` | `content[].format` |
| `encounterId`, `pages` | not rendered (no Encounter resource is served; a page count has no element) |
| `uniqueId` | not rendered yet: `masterIdentifier` with MHD's fixed `type`, in a later hds-fhir-js release (plan 115) |
| event `time` | `date`, as an instant: the document's date on the timeline, what a `date` search filters (`created` is `Provenance.recorded`); no `date` (0..1) when `hdsTimePrecision` is `unknown` (4.19.0, PARTIAL-DATES.md), nor while `clientData.hdsDocumentPending` holds `time` (4.26.0, DOCUMENTS.md § A document waiting for its date and kind) |
| `attachments[]` (Pryv) | one `content[]` per file: `attachment.contentType`, `size`, `title` (file name), `url` = `Binary/<eventId>.<fileId>` (absolute on the facade, relative in an export file); never the Pryv `readToken`; no `hash` (FHIR's is SHA-1, Pryv's integrity is sha256) |

The category key is `clinical-note` for every document: US Core's category value set has that one code, and a grant on
`DocumentReference|clinical-note` is a grant on `documents`, the whole of it, filing streams included, as DOCUMENTS.md says of the root. IPS has no
DocumentReference profile, so the `ips` and `ch` flavours render the base resource. **Import is not implemented:** a
DocumentReference matches the item by category (`matchResource`), and `fromFhir` refuses the block until a writer that
stores the file exists; the block is permanent either way.

### Qualifiers: `companionOf`

Some items only qualify another item's measurement: a flag that a basal temperature reading was disturbed, the body
position of a blood-pressure reading. They have no FHIR resource of their own, but their stream sits under the
measurement's stream, so they must not break its SMART scope. Such an item declares:

```yaml
body-temperature-basal-disturbance:
  # …
  fhir: { companionOf: body-temperature-basal }
```

- The parent item must carry a mapping (not be a companion itself), and the companion's stream must be the parent's
  stream or inside its subtree.
- For SMART scopes the companion counts as its parent's (resourceType, category) pair.
- It is **never rendered or imported on its own**: `toFhir` returns nothing for it, `fromFhir` refuses it.
- **Meaning:** a grant on the parent's scope also exposes the companion's raw events through Pryv, to the SMART app
  holding the token. That is acceptable for qualifiers of the same observation, and only for them: a companion must
  be something a reader of the parent's scope may see.
- A Patient element is not a mapping in this sense: a companion of it is refused.

### Patient elements

The Patient is not one event: it is assembled from the **latest event of each profile item that contributes an
element**. Each such item declares the one element it contributes:

```yaml
profile-sex:
  # …
  fhir:
    resourceType: Patient
    element: gender
    value:
      kind: coded
      options:
        male: { system: http://hl7.org/fhir/administrative-gender, code: male, display: Male }
        female: { system: http://hl7.org/fhir/administrative-gender, code: female, display: Female }
profile-date-of-birth:
  # …
  fhir: { resourceType: Patient, element: birthDate }
```

| `element` | Item | `value` | Renders |
|---|---|---|---|
| `name.given` | `text` | none: the content as written | `name[0].given[0]` |
| `name.family` | `text` | none | `name[0].family` |
| `gender` | `select` | `coded`: every option → an `http://hl7.org/fhir/administrative-gender` coding (`male`, `female`, `other`, `unknown`) with its official display, each coding once | `gender` (the code) |
| `birthDate` | `date` | none | `birthDate` |
| `address.country` | `text` | none | `address[0]` = `{ use: home, country }` |

The item's eventType is a string. A block has no `category` (Patient has none), no `code` and no `profiles`: the
Patient profile per flavour is the renderer's (US Core `us-core-patient`, IPS `Patient-uv-ips`). An element is
claimed by **one active item** only, so an imported Patient places each element in one item.

**Pseudonymity covers the id only** (plan 115 D14, D15). The Patient's `id` (and identifier) is the per-grant alias
when the app asked for a pseudonym, otherwise the stable HDS user id, whatever else is shared. Demographics reach an app only when it requests `patient/Patient.rs` (or
`patient/*.rs`) and the patient consents to the matching profile streams, like any other grant; each element is its
own leaf stream, so the patient can share the name without the date of birth. When a flavour requires an element the
patient did not share, the renderer states it as absent and never invents it (hds-fhir-js `patientResource`).

**What the profile items mean in FHIR.**
- `profile-name` (first name) and `profile-surname` are `name.given` and `name.family` of one name, with no `use`
  (HDS does not know whether it is the official one).
- `profile-sex` records biological sex; `Patient.gender` is administrative gender. It is the one core Patient
  element for sex (US Core requires it), and for the two options the item has, the codes coincide. The eventType also
  admits `notSet` and `other`, which are not options of the item: an event carrying them is refused by the renderer.
- `profile-date-of-birth` stores the date **in its content** (`"1990-04-12"`), not in `time` (which is when it was
  recorded), so `clientData.hdsTimePrecision` does not apply to it: the content carries its own precision, and a FHIR
  `date` takes `YYYY`, `YYYY-MM` or `YYYY-MM-DD` as written. A full dateTime in the content keeps its date as
  written, with no zone shift.
- `profile-addresscountry` is "the country you live in": a home address with a country only. The content is free
  text, which `Address.country` admits.

**Left unmapped,** each for a reason: `profile-display-name` (a UI preference, often a nickname, not a legal name);
`profile-birthcountry` (no core element, only the `patient-birthPlace` extension); `profile-ethnicity` (US Core race
and ethnicity extensions, a multi-select needing its own design); `profile-avatar` (`Patient.photo` is an attachment,
not supported yet); `profile-reproductive-stage` (health data, not demographics). They are leaf streams, so they are
never granted with the Patient.

---

## SMART scopes: `pack.fhirScopes`

Pryv permissions inherit down the stream tree, so a scope is granted as stream subtree roots whose whole subtree
holds one (resourceType, category) pair. The roots are **minimal**: the own stream of each mapped item. The build
computes the table and publishes it:

```json
"fhirScopes": {
  "AllergyIntolerance": ["allergy"],
  "Condition|problem-list-item": ["condition"],
  "DocumentReference|clinical-note": ["documents"],
  "MedicationRequest": ["medication-prescription"],
  "MedicationStatement": ["medication-intake"],
  "Observation|vital-signs": ["body-blood-pressure", "body-heart-rate", "body-height", "body-oxygen-saturation", "body-weight"],
  "Patient": ["profile-address", "profile-date-of-birth", "profile-name", "profile-sex"],
  "Procedure": ["procedure"],
  "Questionnaire": ["questionnaire-request"],
  "QuestionnaireResponse": ["questionnaire-answer"]
}
```

Keys are `ResourceType|category` for a resourceType with a category table, and the **bare resourceType** for one
without (`Patient`, `MedicationStatement`, `MedicationRequest`, `Procedure`, `QuestionnaireResponse`,
`Questionnaire`, `AllergyIntolerance`); values are sorted stream ids.
`patient/Patient.rs` and `patient/*.rs` reach the `Patient` key, `patient/MedicationStatement.rs` the
`MedicationStatement` key, `patient/Procedure.rs` the `Procedure` key (the `procedure` and `treatment` roots, their context streams
`procedure-fertility` and `treatment-fertility` with them); a scope with `?category=` never reaches a bare key. **A grant root under an `explicitGrantOnly` root is offered unticked**
([GENETICS.md](GENETICS.md#explicitgrantonly)): `questionnaire-answer` is in the offer of `patient/*.rs`, of
`patient/QuestionnaireResponse.rs` and of the native `hds/stream/questionnaire-answer.read` alike, and in each the
person has to tick it. The same holds for `questionnaire-request` (4.13.0): `patient/*.rs`, `patient/Questionnaire.rs`
and `hds/stream/questionnaire-request.read` offer it unticked, as a row of its own. The two rows are independent: the
answers without the requests are served without their question texts. Left unticked under `patient/*.rs`, the token response states the narrower scopes that were
granted, as after any untick. **So once the extension is pinned to 4.12.0, a default consent to `patient/*.rs` never echoes the literal again:**
it echoes one scope per resource type (`patient/Condition.rs`, `patient/Observation.rs`, ...), and so does a
`patient/*.rs` grant given before, at its next token exchange. Nothing an access reads changes. An app that tests
the granted scope for the string `patient/*.rs` must test for the type it needs. The table itself lists every key; the marker is in `pack.streams`, and hds-fhir-js
pins the marked streams in the extension options (`explicitGrantOnly`, part of the hash). It feeds the Pryv OAuth extension's `fhirScopes` option, pinned
by version and hash (`hds-fhir-js`: `node scripts/extension-options.ts <pack>`); a hand-written table is never used
in production.

**How it is computed.**
- Every item counts for the invariant, at its `streamId`: a mapped item as its pair, a companion as its parent's
  pair, an **active item without a block as its own `(unmapped)` pair**. A **deprecated item** counts with its
  mapping if it has one, otherwise as unmapped: its past events still sit in its stream.
- A pair is granted on the **own stream of each mapped item** of that pair (deprecated mapped items included, for
  their past events). A companion has no entry of its own: it sits inside its parent item's stream, which covers it.
  A listed stream inside another listed stream of the same pair is left out. An ancestor that merely holds mapped
  items (`body` above `body-weight`) is never granted, so a stream added next to a mapped item later never joins a
  grant already issued.

**Build failure 1, the invariant.** A stream that carries a mapped or companion item must have a subtree that holds
one pair, `(unmapped)` included. A mapped parent with an unmapped child, or with a child of another pair, fails: its
item could never be granted without over-granting. Fix it by mapping the child (or declaring it a companion), never
by moving streams.

**Build failure 2, the lock.** `definitions/fhir/scopes.lock.json` records, append-only, **every stream a published
grant reaches**: each grant root and every stream in its subtree, with its pair, its parent and the items on it.

```json
{
  "formatVersion": 2,
  "streams": {
    "profile-name": { "pair": "Patient", "parent": "profile", "items": ["profile-name", "profile-surname"] }
  },
  "reviewed": {
    "items": {
      "profile-middle-name": { "under": "profile-name", "why": "2026-11-02 part of the name; a reader of Patient may see it" }
    },
    "streams": {
      "profile-name-history": { "under": "profile-name", "why": "2026-11-02 earlier names; a reader of Patient may see them" }
    }
  }
}
```

The build fails when a locked stream
- is no longer a stream, or has another parent (a published stream is never re-parented);
- holds a pair other than its locked one in its subtree, `(unmapped)` included;
- loses an item: removed, or moved to another stream (deprecate it instead: its events stay);
- gains, on itself or anywhere under it, an item, a companion or a **stream** (added, or moved there from elsewhere,
  with or without items) that is not in the lock, unless **`reviewed`** names it under that locked stream. Such an
  item or stream is read by every grant already issued for that pair, so someone states, with the date, why a reader
  of that scope may see it. `under` is the nearest locked stream above (or, for an item, the locked stream it sits
  on): an acknowledgement given for one pair never covers a placement under another, and one whose `under` is not on
  or above where the item or stream sits now fails the build (it never pre-approves a later move). Acknowledging a
  stream does not acknowledge its children: each new stream and item needs its own entry.

Each would widen, or silently break, every grant already issued for that scope. New grant roots are allowed. The
test suite also fails when the lock is not up to date with the current table, and when a published grant root
(`fhirScopes`, and `dist/pack.json` when built) is not in the lock under its pair.

- `npm run fhir:lock` adds the current table and its items to the lock. It never removes or rewrites anything. Run it
  when you add or change a mapping, and commit the lock with the change. `streams` is never edited by hand;
  `reviewed` is, and only that.

### Permanence

A shipped block's **(resourceType, category) is permanent**, like an item key. Changing it moves the item's stream
from one grant table entry to another: apps already granted the old scope would lose data they were promised, and
the lock refuses it anyway (the stream is locked under the old pair). The same holds for a locked stream: whatever is
added on it or under it must belong to its pair, and is acknowledged in `reviewed`.

**Renaming a mapped item's key.** The usual pattern (the old key stays as a deprecated alias on the same `streamId`
and eventType) needs one more thing here: the alias must still count as the stream's pair, or the stream's subtree
gains `(unmapped)` and the invariant fails. So the deprecated alias keeps **the same `fhir` block** (import keys skip
deprecated items, so the two blocks never clash) or becomes `{ companionOf: <new key> }`, and the new key gets a
`reviewed.items` entry under the locked stream (it is an item the lock has not seen). The lock keeps the old key in
the stream's `items`, which the deprecated alias satisfies.

Additive changes are fine: a block can be added to an item without changing its key, stream or eventType; `alsoMatch`
entries (on the code or per option), `alsoMatchCategories`, profiles of new flavours and new options (with their
coding) can be added. Import-only entries change what HDS accepts, never what it emits or grants.

**A unit added to an item with a block** takes its unit in `value.units` and, on an item that asserts LOINC, a code
the build accepts, so plan for it before adding the variation:

- **Static code:** a new unit of the same property (`ng/mL` beside `ug/L`) stores the same code; nothing else changes.
  A new unit of **another property** (moles beside mass) stores another code, so the block switches to
  `code: { from: eventType, codings }`. The codes it emits for the existing units stay the same, and the import keys
  only grow, so the switch is additive.
- **eventType source:** the new unit gets its coding beside the others.
- **A unit LOINC has no code for** (`options[].loinc: null`, as 1,25-dihydroxyvitamin D in pmol/L; search loinc-db
  before concluding so: fasting insulin in pmol/L was thought to be one and has `59179-2`) takes the HDS item coding
  on its eventType (labs slice): the block is, or becomes, a code from eventType, and the build refuses any other
  coding there. If LOINC codes the unit one day, the option stores the code, the eventType's coding becomes that code,
  and the item coding moves to its keyed `alsoMatch`, so what was exported before still imports.
- **A unit of a property that already has a code** (ng/mL beside ng/dL) on a block whose code comes from the eventType
  carries the same coding as its sibling; it needs a UCUM unit of its own.

---

## Medications: MedicationStatement and MedicationRequest

The four medication items ([MEDICATION.md](MEDICATION.md)) carry a block each. The two items of the
`medication-intake` stream are a **`MedicationStatement`**: R4's one resource for both kinds of fact the stream holds,
one intake (no `duration`) and a period of use (a `duration`, `null` while ongoing); the two items of
`medication-prescription` are a **`MedicationRequest`**. Neither resourceType has a category table, so the scope keys
are bare (`MedicationStatement`, `MedicationRequest`) and each is granted on its one stream. The coded twin takes the
medicine from the datasource selection, the basic twin the name as written; all four share one `dosage`:

```yaml
medication-intake-coded:
  fhir:
    resourceType: MedicationStatement
    code: { from: datasource, field: drug }
    dosage:
      field: intake                                   # the regimen object: intake, or posology on a prescription
      doseUnits: { dose/tablet: "{tbl}", dose/drop: "[drp]", dose/puff: "{puff}", dose/application: "{application}",
                   dose/suppository: "{suppository}", dose/unit: "[IU]", mass/mg: mg, mass/mcg: ug, mass/g: g, volume/ml: mL }
      routes:
        oral: { system: http://snomed.info/sct, code: "26643006", display: Oral route }
        parenteral: { text: Parenteral }               # no active SNOMED CT route concept
        # … one entry per route enum value
    profiles:
      ips: http://hl7.org/fhir/uv/ips/StructureDefinition/MedicationStatement-uv-ips
medication-intake-basic:
  fhir: { resourceType: MedicationStatement, code: { from: text, field: name }, dosage: …, profiles: … }
medication-prescription-coded:
  fhir:
    resourceType: MedicationRequest
    code: { from: datasource, field: drug }
    dosage: { field: posology, doseUnits: …, routes: … }
    profiles:
      us: http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest
      ips: http://hl7.org/fhir/uv/ips/StructureDefinition/MedicationRequest-uv-ips
```

**`dosage`**: `field` names the regimen object in the content of the item's one eventType (a composite field of the
composite, on the basic items); `doseUnits` maps every value of its `doseUnit` enum to the UCUM code the dose renders in,
and `routes` every value of its `route` enum to the coding its route renders as, or `{ text }` when no active code
exists. The dose unit codes are compared **as written**, never through `ucumKey`: on a count unit the annotation is the
meaning (`{tbl}` is not `{puff}`, and a bare `1` imports as neither), so the build holds them distinct as strings. The
timing fields need no declaration (one shape on every medication eventType, `h d wk mo y` with **`y` exported as `a`**,
UCUM annum), and the enum vocabularies (`when`, the intake and prescription statuses, the skip and stop reasons) are the
pack's `vocabularies` (MEDICATION.md § Vocabularies), which the renderer carries a checked copy of.

**The medicine.** `drug.codes[]` render as codings through `fhirMapping.systems` (ATC, RxNorm, SNOMED CT), `drug.label.en`
as `text`; a `drug.product` adds a second coding under `fhirMapping.productSystems` with the box name (`product.name`)
as its display, so the national product stands beside the coded medicine, never instead of it. A basic item renders
`{ text: name }` and nothing else (US Core binds `medication[x]` extensibly, so a text-only medication is permitted).

| Event | Resource (hds-fhir-js `toFhir`) |
|---|---|
| one intake (no `duration`, or `0`) | `MedicationStatement.effectiveDateTime`; `status` `completed`, or `not-taken` with `skipReason` as `statusReason`; a Dosage of the dose and route only (MEDICATION.md: the rest is ignored on a dose). A `skipReason` on an intake that was taken is refused |
| a period still open (`duration` null) | `effectivePeriod.start`, no end; `status` `active`; the whole regimen as one Dosage |
| a start the person does not know (`hdsTimePrecision: unknown`, 4.19.0) | `effectivePeriod._start` (or `_effectiveDateTime` for one intake) carrying only the `data-absent-reason` `asked-unknown`; a known end as `effectivePeriod.end` at `hdsEndPrecision`; the recording moment is never rendered. A prescription never carries `unknown` (PARTIAL-DATES.md) and is refused if it does |
| an ended period | `effectivePeriod` start and end (the end at `hdsEndPrecision`, else the start's); `status` `stopped` when closed with a `stopReason` (rendered as `statusReason`) or before the planned `bounds.end`, else `completed`. `bounds.duration` is not compared (calendar arithmetic) |
| any intake | `informationSource` = the patient unless the event was imported; no category; IPS profile on `ips`, the base resource on `us` (US Core 6.1.0 has no MedicationStatement profile) |
| a prescription | `MedicationRequest`, `intent` `order`, `authoredOn` = the event time at its precision, `status` as stored (absent is `unknown`, never active), `stopReason` as `statusReason`, `statusChanged` as the R5 cross-version extension `http://hl7.org/fhir/5.0/StructureDefinition/extension-MedicationRequest.statusChanged` (`valueDateTime`), the posology as the one `dosageInstruction`. US Core on `us`, IPS on `ips` |
| US Core Must Support beyond the model | `requester`: who wrote the order is not stored, and US Core 6.1.0 requires one on an order (us-core-21), so on `us` it is stated as absent (a data-absent-reason `unknown`, as the IPS lab performer is) and left out on the other flavours; `reported[x]`: `reportedBoolean: true` on `us` for an order with no `clientData.sourceKey` (one the patient recorded: a patient-held copy is the secondary, reported record the element describes), stated only where the profile marks it Must Support, so omitted on the other flavours and for an imported order (hds-fhir-js 0.11.0). A writer that acts as the primary source of an order (a practitioner app, a bridge) must set a `sourceKey`; `encounter`, `dispenseRequest` (each 0..1): omitted, as the profile allows |

**Import** (`fromFhir`, § [Import](#import)): a resource is matched by its `medicationCodeableConcept`: a coding with a
datasource label places it on the coded item, a name alone (`text`, or a display of a coding HDS cannot place) on the
basic one; a `medicationReference` is not resolved and is refused. A national product coding comes back as a partial
`drug.product` (`system`, `code`, `name`), which the bridge completes from datasets-service or drops. The regimen comes
back from the one Dosage (several are refused); anything the regimen has no place for (a dose range or rate, a site, a
method, a maximum dose, `dayOfWeek`, `count`, `offset`, a time unit outside `h d wk mo a`, a `when` outside the
vocabulary, a dose unit or route outside the block) refuses the resource rather than drop it, and `patientInstruction`
is not kept (`text` is the wording the model keeps as `note`). `reported[x]` is not read and not carried: an order
that arrived as reported re-renders as an imported one, which states nothing (absence is not `false`). Statuses: a `MedicationRequest` must be an order
(`intent`), `cancelled`, `draft` and `entered-in-error` are withdrawn, `on-hold` and `unknown` import without a
`status`; a `MedicationStatement` with `effectiveDateTime` is one intake when `completed` or `not-taken` and an open
period when `active`, with `effectivePeriod` a period of use (`active` without an end, `stopped` or `completed` with
one), any other combination refused; a `stopped` or `completed` period within one period (an end within the start's
period, or a start within the end's: [PARTIAL-DATES.md](PARTIAL-DATES.md) § Spans) imports as one intake, with no
`duration`, its regimen kept as written (one intake reads only its dose and route), and a `statusReason` on it refused,
since one intake keeps no stop reason; a `statusReason` imports only where the model keeps a reason (a skipped intake,
a stopped period or order) and only when it is one of the vocabulary's (by SNOMED CT code or English label). A
national product coding without a substance code (a Swissmedic or CIS code and no ATC or RxNorm) is refused with a
reason rather than reduced to its name: HDS has a place for the code, the text item has none, so the bridge resolves
the product through datasets-service and passes its codes. **Two mappings are lossy.** A `stopped` period without a
`statusReason` imports as an ended period with no `stopReason` (the model has no "stopped, reason not stated") and
renders again as `completed`, unless it closed before its planned `bounds.end`. The status is lost rather than a
reason invented: no importer writes `stopReason: other` for it (hds-fhir-js `[IMPT-27]`). And a period within one
period imports as one intake: its end, and a `stopped` status, are lost, since a span within one period has no
`duration` to hold them (PARTIAL-DATES.md § Spans).

---

## Procedures: Procedure

The two items of the `procedure` stream ([TREATMENT-PROCEDURE.md](TREATMENT-PROCEDURE.md)) carry a `Procedure` block
each (procedures slice). One event that records one dated procedure renders as one `Procedure`.

```yaml
procedure-coded:
  fhir:
    resourceType: Procedure
    code: { from: datasource, field: procedure }    # procedure.codes through fhirMapping.systems, label.en as text
    profiles:
      us: http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure
      ips: http://hl7.org/fhir/uv/ips/StructureDefinition/Procedure-uv-ips
procedure-basic:
  fhir:
    resourceType: Procedure
    code: { from: text, field: name }               # the name as written: code.text, no coding
    ignore: [count]                                 # never rendered (a lifetime tally, below)
    profiles: { us: …, ips: … }
```

| Event | Procedure (hds-fhir-js `toFhir`) |
|---|---|
| `procedure` (coded) or `name` (basic) | `code`: the selection's codings with `label.en` as `text`, or `{ text: name }` |
| event `time` | `performedDateTime`, truncated to `hdsTimePrecision` ([PARTIAL-DATES.md](PARTIAL-DATES.md): a year, a month, a day or the moment; `approx` gives the year and a note; `unknown` gives `_performedDateTime` with only the `data-absent-reason` `asked-unknown`, 4.19.0; `unknown` with a `duration` is refused) |
| `time` and a positive `duration` | `performedPeriod` `{ start, end }`, the end at `hdsEndPrecision`, else at the start's. Absent or `0`: a point event. `null` (an open span, a procedure still under way) is refused, never stated as completed |
| a `time`, or an end, in the future; a legacy `performed` key | refused (below): not a completed procedure, or a date that is not known |
| (no status field) | `status: completed`, always (below) |
| `notes` | `note[0].text` |
| `count` | never rendered; **an event that carries one is not a Procedure at all** (below) |
| `robotAssisted`, `findings` | not rendered: no R4 element states "robot-assisted" without a device or a code HDS does not hold, and `findings` is an open vocabulary with no codes. Not squeezed into `note` either |
| who performed it, where, why, the outcome | not stored: `performer`, `location`, `reasonCode`, `bodySite`, `outcome`, `category` are omitted |

**Events in a context stream.** A procedure event may sit in `procedure-fertility`, a context stream with no item
of its own (TREATMENT-PROCEDURE.md § Context-via-substream resolution): it is an event of the item registered at
the closest ancestor, and renders through that item's block. The grant on `procedure` covers the context stream (the
lock holds it under the `Procedure` pair), and a patient may grant the context stream alone. A consumer that looked
an item up by the event's own stream only would miss these events: hds-fhir-js resolves the closest ancestor from
the release of this slice on (`packIndex`), where it rendered them generically before.

**Why a bare key, and why it stays one.** A category table exists to split a resourceType into SMART scopes
(`?category=`). (1) HDS holds one item set for procedures, on one stream, and stores nothing that would tell a
surgical procedure from a diagnostic one: a category could only be one constant on both items, which discriminates
nothing. (2) The clinical domain of a procedure is its stream context (`procedure-fertility`), a narrowing that
exists in the access (a grant may name the context stream alone) though not on the SMART consent screen, which lists
grant roots and so shows one entry for `procedure`; FHIR's `Procedure.category` value set (surgical, diagnostic,
counselling, …) is another axis altogether. (3) US Core 6.1.0 defines no `category` search parameter for Procedure
(its searches are `patient`, `date`, `code`, `status`, read from the IG's CapabilityStatement), so an app has no
category search to pair a `?category=` scope with. (4) The decision is a one-way door in both directions ([Categories](#categories-per-resourcetype)): a bare
key can never gain a table, and a category shipped today could never be dropped. The bare key costs nothing later: a
second stream that renders as `Procedure` joins the key as another grant root.

**Two more one-way doors this block closes** (permanent, like the key):

1. **Nothing under `procedure` can ever be a category-scoped Observation.** The lock holds `procedure` and
   `procedure-fertility` under the pair `Procedure`, and one subtree holds one pair. So `findings` can never be
   mapped as Observations from these streams, and a tally can never be served under `Observation|survey` or any
   other category key. A faithful rendering of a tally is therefore reachable only on the renderer's side, as an
   uncategorised Observation (which is what the generic rendering is), never through a pack category.
2. **`count` and `notes` are reserved names on every eventType an item maps to `Procedure`.** The block does not
   name them (unlike `dosage.field`): the renderer reads them by name and the build only pins their types. On any
   item ever mapped to `Procedure` (the treatment items included), a non-null `count` means "a lifetime tally, not a
   Procedure" and a string `notes` is the note. A future Procedure item that wants a `count` with another meaning
   (embryos transferred) cannot have it under that name.

**`status` is `completed`, a constant of the renderer.** The eventTypes have no status field, and the items are
defined as a procedure that took place ("a single dated clinical event", what was done and what was seen). US Core
and base R4 require a status, and `unknown` would say less than the event does. Nothing is invented beyond that: an
event with an open span (`duration: null`) is refused rather than rendered `in-progress`, and on import only a
`completed` Procedure has a place (below). A planned or cancelled procedure has no place in this model; if one is
ever needed, it is an additive `status` property on the eventTypes, rendered when present. **An event dated in the
future is refused, like the open span:** a patient who notes next month's operation writes exactly such an event,
and it is not a completed procedure. "In the future" is judged against the present (the clock on the facade, the
export's own timestamp in a file) on the period the date names: a date known to the month is ahead only when that
month has not begun. **The period is the UTC one**, as every partial date is read (PARTIAL-DATES.md; no zone is
stored with a partial date): a date known to the day is in the future until 00:00 UTC of that day, a month until
00:00 UTC on its first day, a year until 00:00 UTC on 1 January. So east of UTC a procedure dated today can be
refused for the first hours of the local day (one or two in Switzerland), and west of UTC tomorrow's date is
accepted a few hours early. An exact time is compared as an instant, whatever its zone. The same holds for a span
whose end is ahead, and on import for a `completed` Procedure dated
ahead. **Content carrying the legacy `performed` key is refused too** (before 1.8.1 the date of a procedure was
`content.performed.date` and the event time the day it was entered, so the event time is not known to be the
procedure's date). A refused event is reported (an outcome in the Procedure search, a line in the export file),
never served as a Procedure and never silently dropped.

**A lifetime tally is not a Procedure.** An event whose content carries `count` (TREATMENT-PROCEDURE.md, Flavour A:
"had it 2 times", `0` meaning never, recorded on an intake form) states no date of any procedure: its `time` is when
the question was answered. Rendering it as a Procedure would state a performed date that is not one, state several
procedures as one, and, for `0`, state a procedure that never happened. So `count != null` means **no Procedure**:
hds-fhir-js renders such an event as the generic Observation of its item (the HDS item coding, no value), exactly
what every procedure event rendered as before this block, so it stays visible to a reader of the grant and claims
nothing. It does not answer a Procedure search. Rendering a tally faithfully is its own design, decided in principle
(2026-11-15): an uncategorised Observation on the renderer's side, the count as its value and the procedure named
in its code beside the item coding; never a Procedure (us-core-7 wants a date for `completed`, and `not-done` for a
`0` would enter procedure lists as an event), never a pack category (above).

**The writer's side of that rule: a Flavour A event MUST carry `count`** (`0` included). The split is `count !=
null` and nothing else, so an intake answer written without it (`{ name: "HSG" }`, at the time of the form) is read
as one dated procedure performed at `event.time`, and is served as a completed Procedure. `count: null` states no
count (a Procedure); any other value, a string included, is a tally. The apps show `×N` only for a count above 1,
so a `count: 1` event looks like a single procedure there and is a tally here: a writer that knows the date writes
Flavour B, without `count`.

**What the profiles require, and where it comes from.**

| Element | US Core 6.1.0 `us-core-procedure` | IPS 2.0.1 `Procedure-uv-ips` | HDS |
|---|---|---|---|
| `status` | 1..1, Must Support | 1..1 (base) | `completed` (above) |
| `code` | 1..1, Must Support, extensible binding to US Core Procedure Codes | 1..1, preferred binding | the datasource selection (SNOMED CT today), or text only on the basic item: an extensible binding admits text when no code applies, and the validator notes it as a warning |
| `subject` | 1..1, Must Support | 1..1, `reference` 1..1 | the patient |
| `performed[x]` | Must Support (`dateTime`); required when `completed` (us-core-7) | 1..1 | always present: `performedDateTime`, or `performedPeriod`; with `hdsTimePrecision: unknown` (4.19.0), `_performedDateTime` carrying only the `data-absent-reason` `asked-unknown`, which satisfies us-core-7 and the IPS 1..1; `unknown` with a `duration` is refused (a completed procedure cannot end after it is recorded) |
| `basedOn`, `encounter`, `performer`, `bodySite` | not Must Support in 6.1.0 | optional | not stored, omitted |

**Import** (`fromFhir`, § [Import](#import)): a Procedure is matched on its `code`: a coding with a datasource label
places it on `procedure-coded`, a name alone (`text`, or the display of a coding HDS cannot place, such as a CPT or
ICD-10-PCS code, whose systems have no label in `fhirMapping.systems` yet) on `procedure-basic`. Only `status:
completed` imports: `entered-in-error` and `not-done` are withdrawn records, and `preparation`, `in-progress`,
`on-hold`, `stopped` and `unknown` are refused, since the model would store each as a procedure that took place.
The time is `performedDateTime`, else `performedPeriod.start`; a `performedPeriod.end` becomes `event.duration` as an
abatement does (the last day of a truncated end's period, `hdsEndPrecision` when it differs; an end before the start
is refused; an end within the start's own period, or a start within the end's, is a point event). `performedString`, `performedAge` and
`performedRange` are not dates: refused, like a text onset. `note[].text` are joined into `notes` (the note an
approximate date renders, "Date: about …", comes back there too). Everything else (`category`, `bodySite`, `outcome`,
`performer`, `reasonCode`, `complication`, `report`, `usedCode`) is not kept, and `count`, `robotAssisted` and
`findings` are never written.

**The duration on a procedure event.** The items declare no `duration` (a procedure is a point in time on the forms),
but `duration` is a native event field any writer can set, and an imported operation states a start and an end. The
block honours it both ways rather than drop an end the source stated; no form surfaces it today.

### Treatments: Procedure over a period

`treatment-basic` and `treatment-coded` hold a regimen or a course over time (IVF, chemotherapy, dialysis, CBT), with an
optional span ([TREATMENT-PROCEDURE.md](TREATMENT-PROCEDURE.md)). In FHIR R4 that is a `Procedure` too (the resource covers
long-running care), not a `CarePlan` (an intention; the event records what was undergone) and not a `MedicationStatement`
(no substance). Plan 133.

```yaml
treatment-coded:
  fhir:
    resourceType: Procedure
    code: { from: datasource, field: regimen }
    status: { from: span }
    profiles: { us: …, ips: … }          # as the procedure items
treatment-basic:
  fhir:
    resourceType: Procedure
    code: { from: text, field: name }
    status: { from: span }
    ignore: [count]
    profiles: { us: …, ips: … }
```

Everything is as on a procedure item (`code`, `notes`, dates and their precision, the profiles, a tally, the refusal of a
start in the future) except the status, the open span and the import.

| Event | `status` | `performed[x]` |
|---|---|---|
| `count != null` | no Procedure: a lifetime tally, the generic Observation | |
| `duration: null` (still running) | `in-progress` | `performedPeriod { start }` |
| a positive `duration`, its end not in the future | `completed` | `performedPeriod { start, end }` |
| a positive `duration`, its end in the future | `in-progress` | `performedPeriod { start, end }` (R4: a future end is a planned one) |
| no `duration`, `0`, or a span within one period: a point | `unknown` | `performedDateTime` |
| a start in the future; a legacy `period` key | refused | |

- **A point is `unknown`**, never `completed`: in the common case the event does not say whether the course is over. A few
  points are known to be over (a span within one period; a course of unknown start that ended before it was recorded,
  PARTIAL-DATES.md); they cannot be told apart, so that fact is not stated. `unknown` is a code of the required binding,
  and `performed[x]` is stated with it.
- **An ended span is `completed`** (R4: "the event has now concluded"). Whether it was stopped early is not stored.
- **"In the future"** is the UTC rule of a procedure: an end known as November 2026 has passed from 1 November. So a course
  whose end is known to the current month or year only reads `completed` before that period closes (recorded as ended "this
  month", or planned to end then: the event does not say which).
- **A date nobody knows** (`hdsTimePrecision: unknown`): `_performedDateTime` `asked-unknown` on a point,
  `performedPeriod._start` `asked-unknown` on a span, its end stated when known, as on a MedicationStatement.
- **`meta.tag`** names the item (`https://hds.ngo/fhir/CodeSystem/item`), always: it is what brings the export back.

**Import: by name, never by guess.** A Procedure goes to a treatment item when its `meta.tag` names it (an HDS export) or
when the caller names it. Any other Procedure is a procedure, as before.
It is not routed by its code: SNOMED CT calls a course and a single act alike `(procedure)`, and the datasets-service lists
do not draw the line the items draw (B-2026-11-24-13). Nor by the shape of its date: an operation with a start and an end
is a period and no treatment. A tag that names no active item a Procedure imports into (a renamed key included: an alias is resolved the day one
exists) is reported, never sent to a procedure item.
A tag stripped on the way costs the route: a `completed` treatment then lands on a procedure item, and any other status is
refused. Into a treatment item:

| Source | Event |
|---|---|
| `in-progress`, a start (or a date) and no end | `duration: null` |
| `in-progress` with an end, passed or not | that `duration` (a planned end read after it passed is the same event, and renders `completed` once the end's period has begun) |
| `in-progress` with an end within the start's period | a point: the model keeps no span within one period, so `in-progress` is kept as `unknown` |
| `completed` with a start and an end | that `duration`; an end in the future is refused |
| `completed` or `unknown`, a date or a start only, or a span within one period | a point (a `completed` point is kept as `unknown`: less, not false) |
| `unknown` with an end beyond the start's period | refused: the span would render as more than the source says |
| `preparation`, `on-hold`, `stopped` | refused: no status is stored |
| `entered-in-error`, `not-done`; a start in the future; an end before the start | refused |

Not read back, as elsewhere: a date stated as a `data-absent-reason` (refused), `approx` (comes back as a year, its text in
`notes`), `hdsTimeZone`, a tally, a coded treatment none of whose codes has a datasource label (refused).

**One-way doors.** The `treatment` root is in the `Procedure` grant for good, `treatment-fertility` and any later context
stream under it included (the lock asks for a `reviewed` entry), and so are its tallies, which a reader of the grant sees
as generic Observations. Nothing under it can be a category-scoped Observation. The item keys are in exported files. A
grant issued before does not follow. A faithful rendering of a tally is its own design (above), and matters more here:
most treatment intake data are tallies.

## AllergyIntolerance: allergies

The two allergen items of the `allergy` root ([ALLERGY.md](ALLERGY.md)) carry an `AllergyIntolerance` block each
(4.21.0, plan 133), and so does the "no known allergy" item `allergy-none-known` (below, [No known
allergy](#no-known-allergy-allergy-none-known)). One event renders as one `AllergyIntolerance`.

```yaml
allergy-coded:
  fhir:
    resourceType: AllergyIntolerance
    code: { from: datasource, field: allergen }    # allergen.codes through fhirMapping.systems, label.en as text
    profiles:
      us: http://hl7.org/fhir/us/core/StructureDefinition/us-core-allergyintolerance
      ips: http://hl7.org/fhir/uv/ips/StructureDefinition/AllergyIntolerance-uv-ips
allergy-basic:
  fhir:
    resourceType: AllergyIntolerance
    code: { from: text, field: name }               # the allergen as written: code.text, no coding
    profiles: { us: …, ips: … }
```

No `ch` profile: it comes with the CH flavour as a whole.

| Event | AllergyIntolerance (hds-fhir-js `toFhir`) |
|---|---|
| `allergen` (coded) or `name` (basic) | `code`: the selection's codings with `label.en` as `text`, or `{ text: name }`. A `drug.product` is never part of an allergen |
| `status` (required) | `clinicalStatus`, a coding of `http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical` (`active`, `inactive`, `resolved`): always present, as ait-1 requires |
| `verificationStatus` | `verificationStatus`, a coding of `http://terminology.hl7.org/CodeSystem/allergyintolerance-verification` (`unconfirmed`, `confirmed`); absent renders none, never `confirmed` |
| `categories[]` | `category[]`, the codes as stored (`food`, `medication`, `environment`, `biologic`) |
| `type`, `criticality` | `type` (`allergy`, `intolerance`), `criticality` (`low`, `high`, `unable-to-assess`), the codes as stored |
| event `time` | `onsetDateTime`, truncated to `hdsTimePrecision` ([PARTIAL-DATES.md](PARTIAL-DATES.md)); with `unknown`, no onset at all (`onset[x]` is 0..1 in both profiles), never the recording moment |
| a `duration` | refused: `time + duration` is reserved for an abatement (IPS has an abatement extension), not in v1 |
| `reactions[]` | `reaction[]`: each manifestation a `manifestation` concept (its `codes` through `fhirMapping.systems`, `label.en` or `text` as `text`), `severity` as stored, `notes` as `description` |
| `lastOccurrence` | `lastOccurrence`, as written (`YYYY`, `YYYY-MM` or `YYYY-MM-DD`) |
| `notes` | `note[0].text` |
| the writer | `recorder` and `asserter` are the patient, unless the event was imported (`clientData.sourceKey`) |

**Why a bare key, and why it stays one.** The reason: **US Core requires no granular `?category=` scope for
AllergyIntolerance** (its granular scopes are for Observation and Condition), so no app asks for one. Base R4 does
define a `category` search parameter, but a category scope would not fit the content anyway: `categories` is a list of
zero or more codes, one allergy (a drug that is also a food additive) can be in several and many are in none, so a
`?category=` grant could neither place every allergy nor place each once. The bare key is a one-way door ([Categories](#categories-per-resourcetype)): no category table is ever added
for the type, and the content `categories` is never a scope category.

**Reserved names.** `status`, `verificationStatus`, `categories`, `type`, `criticality`, `lastOccurrence`, `notes` and
`reactions` are read by name on every eventType an item maps to `AllergyIntolerance` (a "no known allergy" carries
`verificationStatus` and `notes` only, below); the build pins their types and
their enums (`ALLERGY_FIELDS`, `ALLERGY_REACTION_SEVERITIES` in `src/fhir.js`), so a new value (R5's `presumed`) is
added in the renderer first, then here. `reactions` is never a form field (no composite field holds an array of
objects): a writer that has reactions writes them itself, until the entry UI gains a repeating group.

**Import** (`fromFhir`, § [Import](#import)): an AllergyIntolerance is matched on its `code`: a coding with a datasource
label places it on `allergy-coded` (the selection completed from datasets-service's `allergen` kind), a name alone
(`text`, or the display of a coding HDS cannot place) on `allergy-basic`. **An allergen coded only in a system outside
`fhirMapping.systems` (UNII, NDF-RT) imports into `allergy-basic` and loses its code.** **An allergen coding
datasets-service cannot place** (a labelled system, but a code the `allergen` kind does not know, so `hdsId` cannot be
completed) **falls back to `allergy-basic` by its name** (`text`, else the first display), never a coded event with a
guessed code: the bridge imports the resource again with the `allergy-basic` block. A labelled allergen coding with no
`text` and no display keeps its code as `label.en`, which the bridge completes from datasets-service, as a
manifestation does.

Decided 2026-11-20 (perki): the status, out-of-set, `onsetPeriod` and no-known-allergy rules below, and Q1 to Q6 (the
text "no known allergy", the anchor of an unknown onset, no `patient` check, an unreadable onset date, the reaction
notes, the fallback above).

- **No known allergy first.** Before placement, a resource whose `code` carries a "no known allergy" concept never
  reaches the allergen items. A fixed list (hds-fhir-js `NO_KNOWN_ALLERGY`) names the concepts; since the
  `allergy-none-known` item (plan 133), some place there and the rest stay refused, each with its own reason
  ([No known allergy](#no-known-allergy-allergy-none-known), Import). The list: SNOMED CT `716186003` (No known
  allergy), `409137002` (No known drug allergy), `429625007` (No known food allergy), `428607008` (No known
  environmental allergy), the other active children of `716186003` (`716220001`, `428197003`, `1003774007`), all
  active in the 20260201 International Edition; two retired predecessors still found in older records, read on import
  only: `160244002` "No known allergies" and `716184000` "No known latex allergy", both inactive in 20260201; and five
  codes of `http://hl7.org/fhir/uv/ips/CodeSystem/absent-unknown-uv-ips` (`no-known-allergies`,
  `no-known-medication-allergies`, `no-known-environmental-allergies`, `no-known-food-allergies`, `no-allergy-info`).
  The IPS 2.0.1 value set `allergies-intolerances-uv-ips` takes absent allergies as `is-a 716186003`; the five
  `absent-unknown-uv-ips` codes are listed from IPS 1.1.0 and not verified against 2.0.1 (the 2.0.1 package has no
  such code system, so they are import-only). **The same as a name (Q1):** a `code.text`, or any display of the
  `code`, equal after trim, lowercase and the removal of trailing dots to one of a short list (`NO_KNOWN_ALLERGY_TEXTS`:
  `nka`, `nkda`, `no known allergy`, `no known allergies`, `no known drug allergy`, `no known drug allergies`, `none
  known`, `aucune allergie connue`, `pas d'allergie connue`, `keine bekannten allergien`, `keine allergien bekannt`),
  is treated as the code it names. An exact match, never a substring: "No known allergies except latex" is a name. The
  check runs before the item is chosen, so such a resource never lands in `allergy-basic` as a name.
- **Status.** `clinicalStatus` imports as `status` when it carries exactly one code of `allergyintolerance-clinical`
  and that code is one of the three. Every code of that system counts: `active` beside another code of it is two
  statuses and is refused; a coding in another system is ignored. A resource without one is refused and reported per
  resource: `status` is required, and an importer never defaults it.
- **Verification.** `unconfirmed` and `confirmed` import as `verificationStatus`; no `verificationStatus` imports with
  none. `refuted`, `entered-in-error` and any other value are refused, as a withdrawn Condition is: placing them would
  state as an allergy what the source retracted or never asserted. `presumed` (R5) is refused today, and becomes an
  additive enum value later.
- **Patient (Q3).** A resource without `patient` is not refused: the bridge reads one patient's record, and the
  element is not stored.
- **Onset.** `onsetDateTime` is the event time at its precision ([PARTIAL-DATES.md](PARTIAL-DATES.md)). An
  `onsetPeriod`'s start is the event time at its precision, never a `duration` (reserved for an abatement); a period
  with an end goes as a text into `notes` ("Onset: 2010-03 to 2012", or "Onset: before 2012" without a start), a start
  alone writes no text. `onsetAge`, `onsetRange` and `onsetString` import as unknown, the stated onset as a text in
  `notes` ("Onset: at age 4 years": the UCUM units `a`, `mo`, `wk`, `d` in words). **An unreadable `onsetDateTime` or
  `onsetPeriod.start` (Q4)** imports as unknown, its value as written in `notes` and reported as dropped. No text is
  written when nothing readable is stated. Never refused. **A future onset has no rule:** it imports and renders as
  stated (unlike a completed Procedure, an allergy states no event that must have taken place).
- **An unknown onset (Q2)** is `hdsTimePrecision: unknown`, with `time` the recording moment (PARTIAL-DATES.md): a
  readable `recordedDate` whose anchor is not after the import moment, else the import moment. **`recordedDate` is never
  read as the onset** (unlike a Condition's fallback): it is when someone wrote the allergy down, which is what
  `unknown` puts in `time`. A bridge passes one import moment per run and keeps the stored `time` when it updates an
  event, so a re-run does not move an allergy without a `recordedDate`.
- **Category, type, criticality** import as their codes. **A value outside the set** (of these three, or a reaction
  `severity`) drops that one optional element, reported, and the resource is kept: none of them is required, and
  losing one states less, never something false. A repeated category is kept once. The report (hds-fhir-js
  `ImportedEvent.dropped`) names each element, with its index when it repeats (`category[1]`,
  `reaction[0].severity`), and its value as the resource states it; it also lists an unreadable onset date or
  `lastOccurrence` and a manifestation or reaction left out (below). Elements the model never carries (the "Not
  carried" ones below) are not listed. The report's `value` carries raw health data: it is never logged or sent to
  telemetry.
- **Reactions.** Each `reaction` becomes one entry of `reactions`: each `manifestation` a selection (a coding with a
  datasource label, completed from datasets-service's manifestations; a coded manifestation keeps its label: its
  `text`, else a display, else the code itself, which the bridge completes) or a `text` (its `text`, else a display),
  `severity` as its code, `description` then `note[].text` (Q5) as `notes`, joined by a blank line. A manifestation that
  names nothing is dropped, and so is a reaction left with none. Not carried: `reaction.substance`, `reaction.onset`,
  `reaction.exposureRoute`.
- **`lastOccurrence`**: a dateTime is truncated to its date (`YYYY-MM-DD`); a `YYYY` or `YYYY-MM` is kept as written;
  an unreadable one is dropped and reported.
- `note[].text` are joined into `notes`, an onset text after them; `recorder`, `asserter`, `patient` and `encounter`
  are not kept.

### No known allergy: `allergy-none-known`

**No known allergies** is not an allergen and has no place in the two allergen items: it is a dedicated item,
`allergy-none-known` (eventType `allergy/none-known-v1`, plan 133), on the same stream and under the same bare scope
key, so no new consent unit. Its content is `{ scope, verificationStatus?, notes? }`, `scope` one of `all`,
`medication`, `food`, `environment` ([ALLERGY.md § No known allergy](ALLERGY.md#no-known-allergy)). The code comes
from the scope, a code from an enum ([`code`](#code-static-from-a-datasource-from-the-eventtype-or-from-the-content)):

```yaml
allergy-none-known:
  fhir:
    resourceType: AllergyIntolerance
    code:
      from: enum
      field: scope
      codings:
        all: { system: http://snomed.info/sct, code: "716186003", display: No known allergy }
        medication: { system: http://snomed.info/sct, code: "409137002", display: No known drug allergy }
        food: { system: http://snomed.info/sct, code: "429625007", display: No known food allergy }
        environment: { system: http://snomed.info/sct, code: "428607008", display: No known environmental allergy }
    profiles: { us: …, ips: … }    # the allergy profiles: US Core 6.1.0, IPS 2.0.1
```

The four are SNOMED CT alone on both flavours, all active in the 20260201 International Edition (the displays are
their preferred terms; "drug" is SNOMED's wording, the HDS scope is `medication`). IPS 2.0.1 binds `code`
(preferred) to a value set that includes `is-a 716186003`.

**Release order:** the pack may ship first (§ Forward compatibility, a new code source on a new item). Until the
hds-fhir-js release that renders `from: enum`, a "no known allergy" is served as a generic Observation and no
AllergyIntolerance search returns it; hds-fhir-js `check:pack` stays red until then.

| Event | AllergyIntolerance (hds-fhir-js `toFhir`) |
|---|---|
| `scope` (required) | `code`: the SNOMED CT coding of the scope, nothing else |
| (no `status`) | `clinicalStatus` `active` (ait-1): the statement is made; a "no longer current" one is a reader's judgement (below), never a stored status |
| `verificationStatus` | as on the allergies: rendered only when stated, never `confirmed` by default |
| event `time` | `recordedDate`: when the statement was made, at normal precision (never `unknown`); no `onset[x]` |
| `notes` | `note[0].text` |
| the writer | `recorder` and `asserter` as on the allergies |

The resource carries no `onset[x]`, `category`, `type`, `criticality`, `reaction` or `lastOccurrence`; the eventType
refuses the matching content (`status`, `categories`, `type`, `criticality`, `lastOccurrence`, `reactions`) and the
build refuses them on the eventType and the composite. The facade's `date` search applies to it on `recordedDate`
(it stays unsupported for the allergen items, which do not render one).

**Import** (`fromFhir`): the "No known allergy first" rule above now places the resource on `allergy-none-known`,
for these codes only:
- `716186003` → `all`; `409137002` → `medication`; `429625007` → `food`; `428607008` → `environment`;
- the retired `160244002` "No known allergies" → `all`;
- the IPS codes `no-known-allergies`, `no-known-medication-allergies`, `no-known-food-allergies` and
  `no-known-environmental-allergies` → their scope;
- a text match (`NO_KNOWN_ALLERGY_TEXTS`): `nkda`, `no known drug allergy` and `no known drug allergies` →
  `medication`, the rest → `all`.

Still refused, each with its own reason:
- animal `716220001`, insect `428197003`, latex `1003774007` and the retired latex `716184000`: stored as `all` they would state a wider
  negation than the source, and no scope is narrower than a category yet;
- `no-allergy-info`: it says there is no information, not that there is no allergy;
- a no-known code beside an allergen coding: the resource contradicts itself;
- a `verificationStatus` of `refuted` or `entered-in-error`, as for an allergy;
- a `clinicalStatus` of `inactive` or `resolved` (absent or `active` is accepted).

**Time:** a readable `recordedDate` that is not in the future, else the import moment; never `onset`. `verificationStatus`
keeps the source's value (`unconfirmed`, `confirmed`, or none).

**Is it current?** No status: "an inactive no known allergy" would be a double negative. A reader holds one rule, in
one function of hds-fhir-js: a no known allergy is current only if it is the latest one for its scope (by `created`)
**and** no `active` allergy within its scope exists (for `all`, any active allergy; for another scope, an active
allergy whose `categories` include it or that has none). It is judged on what exists, not on onset times: an
allergy's `time` is its onset, so a childhood allergy entered today would otherwise never end it. The facade filters
`clinical-status` on the rendered value (an NKA matches `active`), and a type search leaves out an NKA that is not
current (still readable by `_id`).

## QuestionnaireResponse: questionnaire answers

The `questionnaire-answer` item (stream `questionnaire-answer`, eventType `questionnaire/answer-v1`,
[QUESTIONNAIRE.md](QUESTIONNAIRE.md)) carries the one `QuestionnaireResponse` block (4.12.0, plan 115). One
answer event renders as one `QuestionnaireResponse`, from the event alone: no other event is read to build it.

```yaml
questionnaire-answer:
  fhir:
    resourceType: QuestionnaireResponse        # no code: the resource has none
    profiles: {}                               # no profile claimed (below, "No profile is claimed")
```

| Event | QuestionnaireResponse (hds-fhir-js `toFhir`) |
|---|---|
| event id | `id` |
| `requestEventId` | `questionnaire`: the canonical `https://hds.ngo/fhir/Questionnaire/<requestEventId>` (below) |
| (no status field) | `status: completed`, always (below) |
| event `time` | `authored`, at the event's precision ([PARTIAL-DATES.md](PARTIAL-DATES.md)); an `approx` date is refused (the resource has no note to say "about") |
| the writer | `subject` is the patient; `author` is the patient too, unless the event was imported (`clientData.sourceKey`), where who recorded the answers is not known and `author` is left out |
| `answers.<key>` | one `item`, `linkId` = the question key, with **exactly one `answer`** whatever the status; items come in the order the content is read (below) |
| `status: answered` | `answer: [{ valueBoolean: true, item: [...] }]`: a nested item `<key>.references` with one `valueReference` per referenced event, and, when the answer has one, a nested item `<key>.qualifier` with the qualifier as `valueString`, `valueDecimal` or `valueBoolean` (a string, a number, a boolean; anything else is refused; "The qualifier's type" below) |
| a referenced event id | `valueReference.identifier` = `{ system: https://hds.ngo/fhir/sid/event, value: <event id> }`, always; `valueReference.reference` = `<ResourceType>/<id>` as well when the caller resolved the event under the same grant (the facade reads it with the same token; the export looks it up in its own set). An event the grant cannot read keeps its identifier only |
| `status: no` | `answer: [{ valueBoolean: false }]` |
| `status: unknown` | `answer: [{ _valueBoolean: { extension: [data-absent-reason = asked-unknown] } }]`: the boolean is absent, and the extension `http://hl7.org/fhir/StructureDefinition/data-absent-reason` on it says why |
| `status: declined` | `answer: [{ _valueBoolean: { extension: [data-absent-reason = asked-declined] }, item: [...] }]`; a `reason` as the nested item `<key>.reason` with `valueString`, under the answer |
| key absent (not answered) | no item |
| `clientData.related` | not rendered: it mirrors `requestEventId` and the references, which are |

**Why a boolean with nested items.** The model's own semantics are yes with supporting records, no, does not know,
prefers not to say (QUESTIONNAIRE.md § Status enum). One `linkId` therefore always answers with one type (a
boolean), and the records, the qualifier and the decline reason are children of the answer, as R4 nests them
(`item.answer.item`). A flat rendering (`valueReference` for a yes, a boolean for a no) would answer one question
with two types, which no `Questionnaire` item can describe, and would leave the qualifier without a place when a yes
names several records. A dot never occurs in a question key (`[a-zA-Z0-9_-]+`), so `<key>.references`,
`<key>.qualifier` and `<key>.reason` can never collide with a question.

**Why the absence sits on the value, and never on the item** (review 2026-11-16, must-fix 1). R4 allows child items
under a question only inside an answer ("when dealing with questions, nesting must occur within each answer"). A
declined answer rendered as an item with no `answer`, the extension on the item and the reason as `item.item`
validates while no `Questionnaire` resolves, and fails the day one does: "Items not of type group should not have
items outside answers". So every status keeps one answer, the data-absent-reason sits on the missing boolean
(`_valueBoolean`, its usual place), and the reason nests under the answer like the references. The shape also holds
in R5 (`item.item` for groups only). hds-fhir-js validates its fixtures against a test `Questionnaire` at the same
canonical (boolean questions with `reference`, `string` or `decimal`, and `string` children), so the shape is
checked against the resource the next slice must serve: 0 errors, 0 warnings.

**The qualifier's type: one per sub-field** (review must-fix 2). The renderer does not read the request, so it
renders the qualifier by its JSON type: a string as `valueString`, a number as `valueDecimal`, a boolean as
`valueBoolean`. The `Questionnaire` (4.13.0) types the item `<key>.qualifier` from the request's `subField`:

| Request `subField` | `Questionnaire` item `<key>.qualifier` |
|---|---|
| `text` | `string` |
| `number` | `decimal` |
| `select-segmented`, every option value a string | `string`, with the option values as `answerOption` (`valueString`) |
| `select-segmented`, every option value a number | `decimal` (R4 `answerOption` has no decimal, so not a `choice`) |
| (none today: a qualifier that is a JSON boolean) | `boolean`; the renderer emits `valueBoolean` for it and import reads it back |
| `select-segmented`, strings and numbers mixed | **not describable**: forbidden for new requests (QUESTIONNAIRE.md, "One JSON type per sub-field"); an existing one renders as a `string` item without options, and keeps one known validation error on its numeric option |

A number is always `valueDecimal`, never `valueInteger`: an integer rendering would break a `number` sub-field,
whose item type is `decimal`. Import accepts `valueInteger` too.

**Item order.** Items follow the order in which the content's `answers` object is read. That is the order written
for ordinary keys; JavaScript reads integer-like keys (`1`, `10`, `2`) first and sorted, and the core does not
promise key order. Nothing depends on the order: an item is found by its `linkId`.

**Why a bare key, and why it stays one.** HDS holds one item for answers, on one stream, and nothing stored tells one
kind of questionnaire from another; `QuestionnaireResponse` has no `category` element in R4, and US Core 6.1.0
defines no category search for it (its searches are `_id`, `patient`, `status`, `authored`, `questionnaire`).
As for `Procedure`, the bare key is a one-way door ([Categories](#categories-per-resourcetype)); a second stream that
renders as `QuestionnaireResponse` later joins the key as another grant root.

**What this block closes for good** (permanent, like the key):

1. **Nothing in `questionnaire-answer` or under it can ever be another resource type or a category-scoped
   Observation.** The lock holds the stream under the pair `QuestionnaireResponse`. The request stream is a sibling,
   locked since 4.13.0 under a pair of its own, `Questionnaire` ([Questionnaire](#questionnaire-questionnaire-requests)).
2. **`requestEventId` and `answers` are reserved names** on every eventType an item maps to
   `QuestionnaireResponse`: the block does not name them, the renderer reads them by name, and the build pins their
   types (`[FHIR-MAP-26]`).
3. **Three URIs, three linkId forms and the answer shapes are published with the first rendering**, in hds-fhir-js
   and not in the pack, and are as permanent as a code: the canonical prefix `https://hds.ngo/fhir/Questionnaire/`,
   the identifier system `https://hds.ngo/fhir/sid/event`, the child linkIds `<key>.references`, `<key>.qualifier`,
   `<key>.reason`, one answer per question in every status, and the absence on `_valueBoolean`. An app that stores a
   rendered response keeps them. "First rendering" means anywhere: the facade, demo included, or an app's export
   file.

**The `questionnaire` canonical.** A request is a questionnaire instantiated for one patient, so the canonical names
that instance: `https://hds.ngo/fhir/Questionnaire/<requestEventId>`. It is an identifier, the same on every base an
account is read on (a regional base, a per-user base, an export file) and after a core move. It is not a web
address: nothing is hosted at it. Since 4.13.0 the request item is mapped, and the `Questionnaire` it renders
carries this value as its `url` ([Questionnaire](#questionnaire-questionnaire-requests)): a reader that holds a
grant on the requests resolves a canonical, one stored before 4.13.0 included, by `GET Questionnaire?url=`. `toFhir`
still renders a response from its event alone; a caller that read the request under the same grant adds the question
as asked (`item.text`) and the questionnaire's title (hds-fhir-js `withQuestionnaire`: the facade under the token,
the export within its own set). Without a grant on the requests a response has no `item.text`, and `linkId`, the
request's own question key, is all it says of the question. Two limits, stated: the canonical names **one patient's instance**, so
two patients answering the same template have different canonicals (a `Questionnaire` whose request holds a
`templateRef` carries it in `derivedFrom`, a value the requests written with the same reference share:
[Questionnaire](#questionnaire-questionnaire-requests), "The template reference"); and it is unversioned and not
hosted, where SDC's text asks for the version-specific URL of a form on a Form Manager (prose, not a validator rule).

**`status` is `completed`, a constant of the renderer.** An app writes the answer event when the person submits, and
the eventType has no status. An edit is a new answer event, never a change in place (QUESTIONNAIRE.md § Update
semantics), so every answer event is a response completed at its `authored` time, and **the current response to a
questionnaire is the one with the latest `authored` among those naming it**: an earlier one is not rendered
`amended` or `entered-in-error`, since no event says which one replaced it.

**A date ahead of the clock: tolerated up to 24 hours, refused beyond.** An answer is stamped by the device at
submit, not dated by hand, so a time ahead of the server is a clock fault, not a planned response: a phone 30
seconds fast must not hide the answer until the server catches up, and a time zone set wrong moves it by hours. The
renderer and the importer accept an answer whose date (the UTC period it names) starts up to 24 hours after
`ctx.now`, and render `authored` as written. Beyond 24 hours the event is refused ("dated more than a day in the
future"), an outcome in the search. A procedure keeps the strict rule: it is dated by hand, and a future one is a
planned one.

**The reach of the grant.** `patient/QuestionnaireResponse.rs` reads every answer event in `questionnaire-answer`:
which questions were asked (their keys); for each a yes, a no, "does not know" or "prefers not to say"; **the
qualifier the person chose or typed and the reason typed when declining**, both free content; on any health topic,
whatever other scope the app holds. A question about a medication, a pregnancy or a genetic test answered here is
read under this grant even when the app holds no grant on those records; the records themselves are read only under
their own grants (the reference is then an identifier the app cannot follow). **The ids are part of the reach:** the
canonical carries the id of a request the app cannot read, and each reference identifier the id of a record it may
not read either; an HDS event id (a cuid) encodes its creation instant, so an id says roughly when its event was
written. The same token reads those ids in `content` on the raw API, so the FHIR rendering shows nothing more. The
stream description says all of this in plain words on the consent screen. **A grant reaches an answer only when
the event is in this stream:** an answer event written anywhere else (an app's own scope stream) is in no FHIR grant
and is not served.

**Granted on purpose only.** The `questionnaire` root is `explicitGrantOnly`
([GENETICS.md](GENETICS.md#explicitgrantonly)): because of the paragraph above, the answers are not part of "all my
data". Every SMART request that reaches the stream, `patient/*.rs` included, offers it **unticked**, and the
person ticks it (the behaviour `genetics` has on a native token; perki, 2026-11-16); a `*` stream permission does
not read it at the facade, and the apps leave the root out of a `*` request (or mask it on a minted access), as for
`genetics`.

**No profile is claimed** (perki, 2026-11-16). The block ships `profiles: {}`: the base resource on `us`, `ips` and
`ch`, no `meta.profile`, no `supportedProfile` in the CapabilityStatement. The rendering is structurally valid
against US Core 6.1.0 `us-core-questionnaireresponse` (the validator, run with the profile, finds no error and no
warning, with and without the question texts), which is not conformance. `item.text` (Must Support through SDC) is
rendered since 4.13.0 when the reader also holds the requests. What remains is what the model does not hold: the
profile's Must Support set includes coded answers (`valueCoding`), groups (`item.item`), an `identifier` (HDS has
one on an imported response only) and the non-FHIR form extension on `questionnaire`; a question here is answered
by a yes or a no that points to records, never by a value, and US Core asks a responder to be "capable of
populating all data elements". **The profile is not claimed.** The responses validate against it; a claim would
need typed answers, which the model does not hold. It is reconsidered only if that changes. IPS 2.0.1 has no
QuestionnaireResponse profile. For reference, what US Core requires and HDS renders:

| Element | US Core 6.1.0 `us-core-questionnaireresponse` (on SDC 3.0.0) | HDS |
|---|---|---|
| `questionnaire` | 1..1 (SDC), Must Support | the canonical above |
| `status` | 1..1 (base), Must Support | `completed` |
| `subject` | 1..1, Must Support, a US Core Patient | the patient |
| `authored` | 1..1 (SDC), Must Support | the event time |
| `author` | Must Support | the patient, unless imported |
| `item.linkId` | 1..1, Must Support | the question key |
| `item.text`, `identifier` | Must Support (SDC) | `item.text` when the reader also holds the requests (4.13.0); `identifier` is the source record's on an imported event |
| `questionnaire` display extension | Must Support (SDC) | the questionnaire's title, when the reader also holds the requests (4.13.0) |
| `item.answer.value[x]` as decimal, string, Coding | Must Support | a boolean on the question; string and decimal on the nested qualifier and reason; never a Coding |
| `item.item`, `questionnaire` non-FHIR form extension | Must Support | never: no group, and the form is a FHIR Questionnaire |

**Import** (`fromFhir`): a `QuestionnaireResponse` matches the one item that maps the resourceType. Only a response
HDS rendered has a place: its `questionnaire` must be an HDS canonical (the request event id comes from it) and its
items must have the shapes above, since `questionnaire/answer-v1` stores references to records and not values. A
response to another questionnaire (a PHQ-9 from an EHR, with coded or typed answers) is refused: its answers are
values, which belong in the typed items of their domain, an import of its own design. `status` `completed` or
`amended` imports (HDS keeps no status, so `amended` renders back as `completed`); `in-progress`, `stopped` and
`entered-in-error` are refused, as is a response authored more than a day in the future. The data-absent-reason is
read on the answer's `_valueBoolean`, and on the item itself too (another writer's usual place for it; a reason
is then read from the item's child): `unknown` is read as `asked-unknown`. An item with no answer and no
data-absent-reason, or with `not-asked`, is an unanswered question: no key. Any question key the grammar allows
imports, `constructor` and `__proto__` included.
The importer also returns the `clientData.related` mirror. **The event ids are those of the account the response
was rendered from:** a bridge that imports into another account maps them to the events it wrote there (the
`related` mirror lists every one of them), or the references dangle (QUESTIONNAIRE.md: a dangling reference is a
known degraded state). `item.text`, `author`, `source` and `identifier` are not kept.

**Forward compatibility.** A new resourceType: hds-fhir-js releases before the one of this slice skip the block and
serve an answer event as the generic Observation of its item (the item coding, no value), which answers an
Observation search without a category and no `QuestionnaireResponse` search. The block has no `code`, which every
earlier mapping had; those releases test the resourceType before they read the code.

## Questionnaire: questionnaire requests

The `questionnaire-request` item (stream `questionnaire-request`, eventType `questionnaire/request-v1`,
[QUESTIONNAIRE.md](QUESTIONNAIRE.md)) carries the one `Questionnaire` block (4.13.0, plan 115). One request event
renders as one `Questionnaire`, from the event alone.

```yaml
questionnaire-request:
  fhir:
    resourceType: Questionnaire                # no code: the resource has none
    profiles: {}                               # no profile claimed
```

| Event | Questionnaire (hds-fhir-js `toFhir`) |
|---|---|
| event id | `id`, and `url`: `https://hds.ngo/fhir/Questionnaire/<event id>`, the canonical the responses to it name |
| (no status field) | `status: active`: a questionnaire that was asked. A constant of the renderer today, not a permanent value |
| (the account) | `subjectType: [Patient]` |
| event `time` | `date`, at the event's precision ([PARTIAL-DATES.md](PARTIAL-DATES.md)); left out for an `approx` date (the resource has no note to say "about") |
| `title`, `description` | `title`, `description`: the English text as the value, every other language as a `translation` extension on the element (`_title`, `_description`) |
| `templateRef` | `derivedFrom`, one value. A `templateRef` that is an absolute `http:`, `https:` or `urn:` URI (the scheme in any case, printable ASCII only: no white space, no control character) is emitted unchanged, as written; any other is emitted as `https://hds.ngo/fhir/Questionnaire/template/<templateRef, percent-encoded>`. Requests that carry the same `templateRef` share this value; it is not an HDS registry entry, and two requesters may use the same reference for different templates ("The template reference" below) |
| `clientData.sourceKey` | `identifier`, the source record of an imported request |
| `questions.<key>` | one `item`: `linkId` = the question key, `type: boolean`, in the order the content is read, which is the order written except for keys made of digits only; the eventType has no order field |
| `questions.<key>.label` | `item.text`, with its translations on `_text`; left out when the label holds no text |
| `questions.<key>.itemRef` | `item.code`: `{ system: https://hds.ngo/fhir/CodeSystem/item, code: <item key> }`, the HDS item the question is about (the coding a generic Observation of that item carries). **Emitted only when `itemRef` is an item key of the pack the renderer holds**: a deprecated key that is an alias of a current item (same stream and eventType) is emitted as the current item's key; an `itemRef` that is no item key (the eventType checks only that it is a string) gives an item without `code`. `toFhir` alone holds no pack and emits no `code`; `renderEvent` (the facade, the export) resolves the key in its pack index |
| (every question) | child `item` `<key>.references`, `type: reference`, `repeats: true`; child `item` `<key>.reason`, `type: string` |
| `questions.<key>.subField` | child `item` `<key>.qualifier`, between the two: its type by the table in [QuestionnaireResponse](#questionnaireresponse-questionnaire-answers) ("The qualifier's type"), `text` from its label, `answerOption` for a select of texts |
| `requester` | **not rendered**: an id of another access of the account |
| `questions.<key>.params`, `.scope` | **not rendered**: which records the app looks up to prefill the answer (a filter and a period), not part of the question as asked |
| a sub-field option's `label` | **not rendered**: the response stores the option value, and `answerOption` lists the values |

**A Questionnaire describes exactly what a response renders.** Each question is a boolean, and the three children are
declared under the question, where R4 has a response nest them: under its answer. hds-fhir-js renders its
Questionnaire fixtures, loads them into the HL7 validator and validates every response fixture against the
questionnaire at its canonical: 0 errors, 0 warnings. A response answers `<key>.qualifier` by the JSON type of the
stored qualifier and the Questionnaire types the item from the sub-field, so the two agree whenever the request
follows the one-type rule (QUESTIONNAIRE.md).

**Why a bare key of its own.** A mapped item's stream is a grant root under its pair (the invariant above), and the
request stream is a sibling of the answer stream, which the lock forbids to move: the requests can be neither a
companion of the answers nor part of their key. So the answers and the questions are two consents:
`patient/QuestionnaireResponse.rs` reads the answers with their question keys, `patient/Questionnaire.rs` reads the
questions as asked. An app that wants a response with its question texts asks for both.

**Not in the R4 Patient compartment.** R4 lists `Questionnaire` among the resources that are never in the Patient
compartment, and the type has no `patient` search parameter. HDS grants it at patient level all the same
(`patient/Questionnaire.rs`), because every Questionnaire it serves is one patient's instance, stored in that
patient's account. The `user/` and `system/` forms are not granted: an app that derives its scopes from the
compartment and asks `user/Questionnaire.rs` is offered nothing for it, and reads its responses without their
question texts. The CapabilityStatement lists no `patient` parameter for the type, since the token names the
patient; one that names the token's patient is accepted and ignored, any other is refused.

**The reach of the grant.** `patient/Questionnaire.rs` reads every request event in `questionnaire-request`: the
title, the description and the template of each questionnaire, every question as asked, on any health topic and from
every requester, the HDS item each is about, and the options of its sub-field. Not who asked, and not the lookup
filter: the same token reads those on the Pryv API, where the grant is the stream's. No answer is read under it. The
stream is under the `explicitGrantOnly` root: offered unticked, never reached by `*`.

**What this block closes for good** (permanent, like the key):

1. **Nothing in `questionnaire-request` or under it can ever be another resource type**: the lock holds the stream
   under the pair `Questionnaire`.
2. **Reserved names** on every eventType an item maps to `Questionnaire`, read by the renderer by name, their types
   pinned by the build (`[FHIR-MAP-27]`): `questions` (an object keyed by question key) and, in each question,
   `label` (an object) and `itemRef` (a string), all three required; and, where the eventType declares them, `title`
   and `description` (objects), `templateRef` (a string) and, in a question, `subField` (an object). The build also
   holds **the question key grammar** to exactly `^[a-zA-Z0-9_-]+$` (no dot, so the child linkIds
   `<key>.references`, `<key>.qualifier` and `<key>.reason` stay distinct from every question's, as R4 requires of
   the linkIds of one Questionnaire), and **the `subField.type` enum** to the list the renderer knows
   (`QUESTIONNAIRE_SUB_FIELD_TYPES` in `src/fhir.js`: `select-segmented`, `text`, `number`), and **the options of a
   sub-field** to an array whose `value` types are exactly number and string (`QUESTIONNAIRE_OPTION_VALUE_TYPES`).
   The renderer refuses a
   request whose sub-field has a type, or an option value of a JSON type, it does not know, so a new one is added to
   these lists and to the renderer first; hds-fhir-js `check:pack` compares its own copies with the pack's eventType.
3. **Published with the first rendering**, in hds-fhir-js and not in the pack: the template canonical prefix
   `https://hds.ngo/fhir/Questionnaire/template/` and the rule that an absolute `templateRef` is emitted unchanged;
   `item.code` in the HDS item system; the three children declared on every question. The instance canonical and the
   child linkIds were published with 4.12.0. `status` is not part of this list: it is `active`, a constant of the
   renderer today, and another value may be rendered later (a request that is withdrawn or expires).

**No profile is claimed.** The rendering is valid against SDC 3.0.0 `sdc-questionnaire` (the profile US Core's
server CapabilityStatement names for the type; validator: no error), and no claim is made; adding one later is
additive.

**The template reference.** `templateRef` is chosen by the requester's app and is unique only within that
requester's templates ([QUESTIONNAIRE.md](QUESTIONNAIRE.md), "The template reference"). Requests that carry the same
`templateRef` share the `derivedFrom` value; it is not an HDS registry entry, and two requesters may use the same
reference for different templates. An app that groups responses by `derivedFrom` therefore groups them within the
requests of one requester it knows, never across requesters. A `templateRef` that is already an absolute `http:`,
`https:` or `urn:` URI (the canonical of a published form; the scheme in any case, printable ASCII only) is emitted
unchanged, as written, so HDS never wraps another
party's canonical under its own domain; any other reference goes under the HDS prefix, percent-encoded. The
eventType sets no maximum length on `templateRef`, so the canonical has none either: the length is not bounded.

**`derivedFrom` does not resolve.** The template canonical is an identifier: no template is served. The validator
says so in one warning on a Questionnaire that has a `templateRef`.

**Import** (`fromFhir`): **a Questionnaire is not imported.** It matches the one item that maps the resourceType and
is refused with the reason. A request also holds `scope` (required by the eventType) and `params`, which the
Questionnaire does not carry, so even one HDS rendered cannot be rebuilt; and a questionnaire from another system
asks for values (choices, numbers, dates), which a request cannot ask for: its questions are yes or no about an HDS
item. A response still imports alone: it names its request by id.

**Forward compatibility.** A new resourceType: hds-fhir-js releases before the one of this slice skip the block and
serve a request event as the generic Observation of its item (the item coding, no content), as they did before the
block (0.8.0 and later; earlier ones render nothing for it).

---

## Forward compatibility

A consumer **skips a block whose resourceType, value kind or code source it does not know** (a newer pack than the
consumer), and a companion block: `toFhir` renders nothing for it rather than throwing. `fromFhir` refuses such a
block with an explicit error. hds-fhir-js also skips a block whose category it does not know, and a Patient element
block whose element (or value) it does not know: the Patient is assembled without it. **From the release of the
procedures slice on, a skipped block is not a vanished event:** `renderEvent` (the facade, the apps' export) serves
an event whose block the library does not support as the generic Observation of its item, as it does for an item
with no block, so a pack ahead of a renderer costs fidelity, never visibility. Releases before it (up to 0.7.0)
render nothing for such an event, which is why the apps are bumped with each slice (release order, step 4).

So a new value kind, a new code source, a new resourceType or a new Patient element **needs a renderer change
first**: implement and validate
it in hds-fhir-js, release that, then add the first block that uses it here. A block the deployed renderer skips is
data a SMART app does not see. **One case may ship pack first:** a new resourceType on an item whose events an
older renderer already serves generically (hds-fhir-js 0.8.0 and later, paragraph above), as `QuestionnaireResponse`
(4.12.0), `Questionnaire` (4.13.0) and `AllergyIntolerance` (4.21.0) did; and, the same way, **a new code source on a
new item**, as `from: enum` on `allergy-none-known`: a renderer that does not know the source skips the block and
serves the item's events as generic Observations, so until the hds-fhir-js release that renders it (release order) no
AllergyIntolerance search returns a "no known allergy". The older renderer keeps serving the generic Observation, the facade pins
the pack by hash, and the library's `check:pack` stays red until the pack is published. **Not so for the `concept`
code and the `lab-result` kind** on the three `*-coded` lab items (plan 133): their events are served generically
today, but the blocks add their streams to `Observation|laboratory`, and a facade `category=laboratory` search
reads that table's streams and keeps what renders in the category. With the new pack and an older library, those
events are scanned (they count toward the scan cap) and dropped, never shown. So, in order: (1) hds-fhir-js with
the renderer is released (its `check:pack` stays red until step 2, as for any library released first); (2) data-model
4.31.0 is published to model.datasafe.dev; (3) the facade is re-pinned to both; (4) each core's extension is
re-pinned, its `fhirScopes` option pinned by hash with the pack. The consent offer and the scope widen at step 4,
never before: the core extension's `fhirScopes` is what a grant expands to, and a token reads the streams raw at the
Pryv API as well. **A new value of a medication vocabulary needs the renderer first in the same way**
(`when`, the intake and prescription statuses, the skip and stop reasons; MEDICATION.md § Vocabularies): hds-fhir-js
renders them from a checked copy of `pack.vocabularies` (`check:pack`), so a deployed renderer refuses an event
carrying a value it does not know until it is released with it. A new dose unit or route, by contrast, rides in the
block's `dosage` and needs no renderer change.

**A new field is not skipped:** a consumer that does not know a field ignores it. That is harmless for an import-only
field (`alsoMatch`, `alsoMatchCategories`: an older importer accepts less), and it is why a change of what a block
emits is a new kind rather than a field (`scaled-quantity`). `alsoEmit` is the exception, and holds only as long as the
blocks that use it also use a kind an older renderer skips: today one block (`body-oxygen-saturation`, a
`scaled-quantity`). An older renderer that rendered a block with `alsoEmit` would leave the coding out and claim a
profile the resource does not meet, so **the build refuses `alsoEmit` on any other value kind**. The rule lifts once
every deployed hds-fhir-js knows `alsoEmit` (the release that adds `scaled-quantity`).

**A coding shared by two eventTypes** of an eventType source (labs slice) changes nothing an older renderer emits: it
renders each eventType's coding as before. Its importer, though, takes a code that names two eventTypes for a
contradiction and refuses the resource (never a wrong placement); the hds-fhir-js release of the labs slice lets the
unit pick. `ratio-quantity` is a new value kind: until the facade runs that release, the INR block is skipped and a
SMART app sees no INR. **This slice ships the pack first** (data-model, then hds-fhir-js, then the facade pin and the
extension options): a skipped block is safe, the facade pins both the library and the pack hash so production sees
neither until the re-pin, and the library's `check:pack` (run by its CI) compares its mappings with the published
pack, so a library released first would stay red until the pack follows. `check:pack` is never relaxed to get green.

From that release on, hds-fhir-js also skips a block carrying a top-level field it does not know, so a later field that
changes what a block emits is skipped by the renderers that predate it rather than half-rendered. The cost: an
import-only field added later also needs the renderer to ship first, which is the order above anyway.

---

## Import

`fromFhir(resource, mapping, { item })` places one FHIR resource as content of the item the mapping belongs to.
Anything it cannot place is **rejected, never guessed**.

**Which item.** A resource matches an item by **(resourceType, code)**, with a **compatible category**: any coding of
`resource.code` equal (system and code) to the block's static code, an eventType's code or one of its `alsoMatch` codings. A block whose
code comes from a datasource matches by resourceType and category (a Condition goes to the Condition item that takes
its code from a datasource). A static code match wins over a datasource match. A resource that matches only a `split`
code imports as a fragment of that item (below) and only when no item matches it directly: a standalone heart-rate
Observation goes to `body-heart-rate`, not to the blood-pressure pulse. The build guarantees that a static code or an
`alsoMatch` coding is claimed by one active item only, and a datasource source by one active item per category it
accepts (`hds-fhir-js`: `matchResource`, which also says why nothing matched). A medication is matched on its
`medicationCodeableConcept`: a coding with a datasource label goes to the datasource-coded item, a name alone to the
text-coded one ([medications](#medications-medicationstatement-and-medicationrequest)); a Procedure the same way on
its `code` ([procedures](#procedures-procedure)), never to a treatment item unless a tag names it (below). **Deprecated items are not import
keys:** the importer matches against active items only, so a legacy item that keeps its replacement's block for its
past events (`fertility-hormone-lh`, `fertility-hormone-pdg`) never makes a code match two items, and an imported
resource always lands on the active item, in its current eventType.

**Concept-coded lab items are never matched** (`body-blood-coded`, `body-urine-coded`, `body-csf-coded`; plan 133).
They claim no import key. A laboratory Observation whose codes match no item is reported with the three as
candidates and the specimen as what is missing, and nothing is imported; the caller names the item
(`fromFhir(resource, mapping, { item })`), from the LOINC System axis or the source report. An HDS export carries
the item key as `meta.tag` (`https://hds.ngo/fhir/CodeSystem/item`), which names the item back on its own re-import.
Into such an item the importer also requires an explicit `laboratory` category, and refuses an analyte an active item
owns (its static, eventType or `alsoMatch` code, `references.loincMethod` included) unless the owning item lacks the
printed unit in any spelling (an HDS export tagged with the coded item comes back when only another spelling is
the owner's; BLOOD-CHEMISTRY.md § Rules, the interim case) or the result is not a quantity (an item event has no
place for a printed text), and then only into the coded item of the owner's specimen.

**Treatment items are never matched either** (`treatment-basic`, `treatment-coded`; plan 133). They claim no import key: the
caller names the item, or the `meta.tag` of an HDS export does. Any other Procedure is a procedure
([treatments](#treatments-procedure-over-a-period)).

- **Category.** The resource's categories are its `category` codings in the systems of the resourceType's table
  (`fhirMapping.categories`); a coding in another system (a local category, another IG's) says nothing checkable and
  is ignored. A resource with none matches by code alone. Otherwise one of them must be the block's `category` or one
  of its `alsoMatchCategories`. So a Condition filed as a `health-concern` (US Core files social findings, housing or
  education, there) does not import as a diagnosis into `condition-coded`, while an `encounter-diagnosis` does. A
  resource that states no category cannot be told apart by it: when it fits several datasource-coded items, the
  importer reports it as ambiguous and imports nothing.
- **Withdrawn records** are refused: an Observation with `status` `entered-in-error` or `cancelled`, a Condition whose
  `verificationStatus` is `refuted` or `entered-in-error`, a MedicationStatement `entered-in-error`, a MedicationRequest
  `entered-in-error`, `cancelled` or `draft` (never an order), a Procedure `entered-in-error` or `not-done`, an
  AllergyIntolerance whose `verificationStatus` is `refuted` or `entered-in-error` ([allergies](#allergyintolerance-allergies)). Placing
  them would state as fact what the source retracted. Every other status imports as it is (`preliminary`, `amended`,
  …), except on a Procedure, where only `completed` has a place on a procedure item ([procedures](#procedures-procedure))
  and `in-progress` and `unknown` too on a treatment item ([treatments](#treatments-procedure-over-a-period)), and on a
  Condition (next point).
- **A qualified Condition is refused too** (hds-fhir-js 0.10.3), though nothing was withdrawn: a `verificationStatus`
  of `provisional`, `differential` or `unconfirmed`, and any other stated value but `confirmed` (another code, a coding
  outside `condition-ver-status` only, text only: R4 binds the element to that value set, so an unreadable one may be
  a qualifier). A `condition-coded` event states an established diagnosis and `verificationStatus` is not stored yet
  (CONDITION.md § The second status), so the import would drop the qualifier. Unlike an unreadable `clinicalStatus`
  (next point), which only leaves `status` out, an unreadable `verificationStatus` cannot be dropped: the event would
  then state the diagnosis as established. A Condition whose only `condition-ver-status` code is `confirmed`, or with
  no `verificationStatus`, imports.
- **A Condition's `clinicalStatus`** (4.1.0, CONDITION.md § status and abatement) imports as `content.status` when its
  coding in `http://terminology.hl7.org/CodeSystem/condition-clinical` is one of the six codes (`active`, `recurrence`,
  `relapse`, `inactive`, `remission`, `resolved`); another code or no coding leaves `status` out, the resource still
  imports. Its abatement imports as `event.duration` (below, Time). An abatement whose status is not `inactive`,
  `remission` or `resolved` (none, or an active-family code) contradicts FHIR's own rule (con-4) and is refused: the
  importer never guesses which of the two is wrong. Export is the reverse: `content.status` renders as
  `clinicalStatus`, no status renders none.

**Values.**
- `quantity`: the `valueQuantity` must have system `http://unitsofmeasure.org` and a `code` equal to one of the
  block's units, annotations aside (`{beats}/min` is `/min`), or the same unit written with other powers of ten
  (`10*3/uL` and `10*9/L` are `10*6/mL`, `m[IU]/L` is `u[IU]/mL`: the number is the same, nothing is converted; the
  block's own code first; hds-fhir-js `sameUcum` from the release after 0.13.1). Read so: products and quotients of
  powers of ten and of `g`, `L`, `mol`, `eq`, `U` and `[IU]`, with or without one of the prefixes `k d c m u n p f`; any
  other code is compared as written, and units are never cancelled. That unit picks the eventType (`[lb_av]` → `mass/lb`), and the value is
  stored as printed. Units are
  **converted only through the item's declared `unitConversions`**. Those relate the item's own eventTypes, and every
  one of them already has its UCUM unit in the block, so in practice a value in one of the block's units is taken as
  printed in that eventType, and a unit outside them (`g` for body weight, `[ft_i]` for body height) has no declared
  conversion and is rejected. Importing such a unit takes a new eventType variant on the item first.
- `scaled-quantity`: as `quantity`, against each eventType's `unit`, then the value is divided by that eventType's
  `factor` (`97 %` → `0.97` on `ratio/proportion`, `175 cm` → `1.75` on `length/m`); so are the reference range limits.
  The stored unit itself (`m` for body height) is not one of the block's units and is rejected, like any other.
- `ratio-quantity`: as `quantity` for the unit and the lab extras; the content is `{ value: <the number>, relativeTo:
  <the block's> }` (`2.5 {INR}` → `{ value: 2.5, relativeTo: 1 }`). `{INR}` is an annotation, so a source that sends
  the INR with the unity `1`, or `{ratio}`, imports too.
- **A code from the eventType** names the eventTypes that carry it (one, or the units of one property); the quantity's
  unit must be one of theirs, and picks among them.
- **Import limits known today** (each is a refusal, never a wrong value; for the
  importing bridge of phase 4 to normalise, no block change): **eGFR under `69405-9` in `mL/min`** (the example unit
  LOINC lists for that code) is refused, as are `mL/min/1.73m2` and `mL/min/1.73.m2`: only `mL/min/{1.73_m2}`
  imports (the annotation-stripping comparison leaves a trailing `/`, so `mL/min` differs, although under a code
  that says "based on 1.73 sq M" the unit adds nothing); an INR without a UCUM code; with hds-fhir-js up to 0.13.1, also
  any other spelling of a block's unit (`10*3/uL` or `10*9/L` for `10*6/mL`, `ng/mL` for `ug/L`).
- **eGFR: one result per time** (B-2026-11-16-17, B-2026-11-19-34): `body-blood-serum-egfr` imports every eGFR code
  it lists, per equation and per population, while keeping no equation and no population, so a report that states
  several eGFR results for one subject and time would give several eGFR events at that time with different values.
  Among the resources of one source (a lab report, a bundle), at most one eGFR is imported per subject and time. Only
  results the import can take count: a withdrawn one, one with no readable time, or one with no numeric quantity in
  the item's unit counts for nothing (the import refuses it).
  - **Population pairs.** LOINC gives some equations one code per population: MDRD among female `50044-7` / among
    male `70969-1`, MDRD among black `48643-1` / non black `48642-3`, CKD-EPI among black `88293-6` / non black
    `88294-4`. When both codes of a pair are stated for one time, both are left out: nothing says which population
    applies to the person, and HDS does not choose one. A per-population result of another equation at that time is
    left out too, since the report does not settle the population. A result coded with per-population codes only is
    a pair member; one that also carries the other code of its pair, or a code in no pair, is not.
  - **Age.** Schwartz `50384-7` is for children, the other equations for adults. When both are stated for one time
    (an adult pair left out above included) and `69405-9` is not, none is imported: HDS does not record the person's
    age.
  - **Equations.** Otherwise, of the results left, the first in this order is kept and the others are left out:
    `69405-9` (equation-neutral like the item, and the code it exports), CKD-EPI 2021 `98979-8`, CKD-EPI 2009
    `62238-1`, then its per-population codes, MDRD `77147-7`, then its per-population codes, Schwartz `50384-7`. A
    result carrying several codes ranks by its best one. When several results share the best rank with different
    values (value and comparator: one code twice, or two per-population codes of one equation), none is imported,
    the lower ranked ones included; when they agree, one is kept.

  This needs the whole report: hds-fhir-js `egfrSetAside(resources, mappings)` (0.10.6; `EGFR_PREFERENCE` holds the
  order) returns the resources to leave out, each with its reason, and the importing bridge calls it before
  `fromFhir`.
- `coded`: the `valueCodeableConcept` codings must match exactly one option, by its coding or one of its
  `alsoMatch` codings; the option value is returned with its type (`0.75`, not `"0.75"`). Option codings and
  `alsoMatch` codings are unique within an item (a build check), so a coding maps back to one option.
- `components`: each component's code must match a mapped component, in its unit; an unknown component (for
  example a mean arterial pressure in a blood-pressure panel) rejects the resource. A component stated absent
  (`dataAbsentReason`, no value) counts as missing. **Never partial content:** every mapped component whose composite
  field is not `canBeNull` must be there, so a blood-pressure panel without its systolic or its diastolic is
  rejected.
- A resource with a value when the block has none, or without one when the block has one, is rejected.

**Splits.** A resource matching a `split` code imports as `{ <field>: value }`, flagged with the split field: a
fragment to merge into the parent item's event at the same time (the blood-pressure reading the pulse belongs to).

**Datasource codes.** The codings become `{ label: { en: code.text or the first display }, codes: [{ system:
<label>, code }] }` at the block's `field`. A coding whose system has no label in `fhirMapping.systems` is dropped
(the ICD-10-CM coding US EHRs send next to SNOMED CT), and the resource is rejected only when no coding is left. The
eventType
also requires each code's `hdsId` (and may carry a `description`), which FHIR does not carry: the importer completes
the selection from datasets-service, and rejects the resource when datasets-service does not know a code.

**Patient.** A Patient imports into the profile items, one content per contributing item whose element it carries
(hds-fhir-js `patientFromFhir`). The name is the `official` one, else `usual`, else one without `use` (names with a
period end are past); given names are joined with a space, and a name with `text` only is not split. The country is
the `home` address's, else an address without `use`. `gender` `unknown` states nothing and is skipped. An element
that cannot be placed (a `gender` that is not an option of the item, an unreadable `birthDate`, two current official
names that disagree) is reported per element, never guessed, and the other elements still import. A Patient has no
clinical date: the importer records the facts at import time, as a profile entry is recorded.

**Time.** Observation: `effectiveDateTime`, else `effectivePeriod.start`, else `effectiveInstant`. Condition:
`onsetDateTime`, else `onsetPeriod.start`, else `recordedDate`. MedicationRequest: `authoredOn` (a point event).
MedicationStatement: `effectiveDateTime`, else `effectivePeriod.start`; an `effectivePeriod.end` becomes the event
`duration` as an abatement does (below). Procedure: `performedDateTime`, else `performedPeriod.start`, a
`performedPeriod.end` becoming the `duration` the same way. The event time of a `condition-coded` event is when
the patient has had the condition from (its onset, or the date of the diagnosis when that is all the source knows),
not when someone wrote it down, as for the "March 1999" diagnosis of [PARTIAL-DATES.md](PARTIAL-DATES.md); so the
rendering states it as `onsetDateTime`, and the import prefers the onset. An `onsetPeriod`'s end is not kept (the
onset is a moment). An Observation's `effectivePeriod.end` is not kept either: the mapped Observation items are point
events. A missing or unreadable date is rejected (a text onset such as `onsetString` included, and a date element
carrying only a `data-absent-reason`: reading it back as `unknown` is an open point of PARTIAL-DATES.md); an
AllergyIntolerance is never refused for its date (§ AllergyIntolerance, Onset). A Condition's onset
stated absent does not fall through to `recordedDate`: the resource is refused, since the recorded date would read
as the onset. Precision follows
[PARTIAL-DATES.md](PARTIAL-DATES.md): a full dateTime is the exact moment, `clientData.hdsTimePrecision: minute`; a
truncated one (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`) is the start of its period at 12:00 UTC with precision `year`, `month`
or `day`. Export is the reverse: the date is truncated to the event's precision (`approx` gives the year and a note
with `hdsTimeText`; `unknown`, 4.19.0, gives no date: the date element carries only the `data-absent-reason`
extension, code `asked-unknown` (none at all for an allergy's onset or a DocumentReference's `date`), and the recording
moment is never exported as the date; an event of a vital-sign,
laboratory or US Core screening item that carries `unknown` is refused, since PARTIAL-DATES.md
never allows `unknown` there; the generic Observation of an unmapped item, such as `finding-coded` or
`encounter-visit`, takes `_effectiveDateTime` the same way). A vital sign known only to the month or the year cannot be exported, since FHIR requires a
vital sign's date to the day (vs-1), and is refused rather than padded to a day. A
laboratory result or a US Core screening answer known only to the month or the year (`approx` included) is exported with
that date and without its US Core profile claim, since that profile requires the day (us-core-1; hds-fhir-js,
B-2026-11-23-15). The IPS laboratory profile has no such rule, so its claim stays.

**Abatement** (4.1.0, `condition-coded` only). `abatementDateTime`, else `abatementPeriod.end`, becomes
`event.duration` = abatement − `time`, in seconds; a truncated abatement is anchored at 12:00 UTC on the **last** day
of its period (PARTIAL-DATES.md § Spans), and `clientData.hdsEndPrecision` is written when that precision differs from
the onset's. An abatement whose period lies wholly before the onset's is refused (periods, not noon anchors, and
half-open: a date-only onset is its whole UTC day, its closing midnight the next day's; against a zoned instant a
zoneless date gets 14 h of slack, since a local day starts at most 14 h before its UTC day and ends at most 12 h
after it: a zoneless end's period runs 14 h past its end, a zoneless onset's starts 14 h before its start); one
period containing the other (an end within the onset's period, or an onset within the end's: "onset
2016-04-06T21:45, abated 2016-04-06"; equal instants too) is a span within one period: the status is kept and **no
duration** is written, nor `hdsEndPrecision`. The period test comes before the anchor arithmetic, and the 14 h widen
the periods only, never the anchors (CONDITION.md § status and abatement has the ordered test, 4.11.1, and the
onset-side slack, 4.11.2: the core reads a duration of 0 back as absent). Two different exact instants, even on one
day, keep their positive duration. `abatementAge`, `abatementString`, `abatementRange` and
`abatementBoolean` are not dates: the status is kept and the abatement dropped (no duration). Export: `time + duration`
as `abatementDateTime`, truncated to `hdsEndPrecision`, else to `hdsTimePrecision`; a duration on an event whose status
is not `inactive`, `remission` or `resolved` is refused (con-4), never rendered.

**Provenance and idempotency** belong to the importing bridge, with the `clientData` keys of
[PROVENANCE.md](PROVENANCE.md):

| Key | Value on an imported event |
|---|---|
| `clientData.sourceKey` | `<tool>:<ResourceType>:<source>/<resource id>`: `<tool>` the bridge's stable name, `<source>` a stable opaque id the bridge gives the source server (not its URL or name: the key is visible to every reader), `<resource id>` the resource's logical id on that server. A re-run looks the key up and updates the event; a fragment merged from a split resource does not get a key of its own (the event keeps its panel's). |
| `clientData.hdsTimePrecision` | From the date, as above. |

Cross-system: `sourceKey` corresponds to FHIR `Resource.identifier` (system naming the tool and source).

---

## Build checks (`src/fhir.js`)

- **Schema:** shapes per kind and per code source; canonical system URIs; `display` required; units non-empty;
  profiles are strings.
- **Category:** required and known for the resourceType, refused on a resourceType without a table.
- **Agreement with the item:** `quantity` and `scaled-quantity` only on `number` items, units exactly the item's
  eventTypes, each numeric; a `ratio/proportion` eventType rendered in `%` has factor 100 (so never a plain
  `quantity`); `ratio-quantity` only on a `number` item whose eventTypes store `{ value, relativeTo }`, units exactly
  the item's eventTypes, `relativeTo` the item's `ratioRelativeTo` (`[FHIR-MAP-24]`); `alsoEmit` only with a static code;
  `coded` only on `select` (never `multi-select`), options exactly the item's options; component, split and ignore
  keys are composite fields, components and splits numeric, no field in two roles, every composite field accounted
  for; a datasource source only on a datasource field, resolving to a `codes` array in the eventType; no `value` on a
  Condition, a DocumentReference, a medication or a Procedure; `alsoMatch` only with a static code (a list) or an eventType code (keyed by the item's eventTypes); an
  eventType source covers exactly the item's eventTypes; per-option `alsoMatch` only on `coded`, keyed by option keys; `alsoMatchCategories` known keys of the
  resourceType's table, never the block's own category.
- **Content code (`[FHIR-MAP-17]`):** a `DocumentReference` takes `{ from: content }` and nothing else, and the source
  applies to a `DocumentReference` only; one eventType; the field holds a Coding or a list of them; `translate` keys
  are `"<canonical system>|<code>"` and never translate to themselves; no `value`, no `alsoMatch`.
- **Medications (`[FHIR-MAP-22]`):** a `MedicationStatement` or `MedicationRequest` takes `{ from: datasource }` or
  `{ from: text }` and a `dosage`, no `value`; a text source names a `text` field of the composite, one eventType, no
  `alsoMatch`; `dosage.field` holds a regimen (`doseValue`, `doseUnit`, `route`, `frequency`, …; a
  composite field on a composite item), `doseUnits` keys are exactly its `doseUnit` enum with distinct non-empty codes
  as written, `routes` keys exactly its `route` enum, each coding once and each text once; a datasource-coded
  medication's `product.system` enum is covered by `fhirMapping.productSystems`; `text` and `dosage` on any other
  resourceType are refused. Import keys: one datasource-coded and one text-coded item per (resourceType, category).
- **Procedures (`[FHIR-MAP-25]`):** a `Procedure` takes `{ from: datasource }` or `{ from: text }` (the text source
  applies to a medication or a Procedure, nothing else), no `category`, no `value`, no `split`, no `dosage`; one
  eventType, whose `notes`, when declared, is a string (a `text` field on a composite, counted as mapped: it renders
  as `Procedure.note`) and whose `count`, when declared, is a number (on a composite it is listed in `ignore`). The
  two names are reserved on every Procedure-mapped eventType: the renderer reads them by name
  ([Procedures](#procedures-procedure), one-way doors). `status` is `{ from: span }` and nothing else, on a Procedure only
  (`[FHIR-MAP-28]`): required when the item's `duration.canBeNull` is true, refused otherwise. Such a block claims no
  import key.
- **Allergies (`[ALG-FHIR-*]`):** an `AllergyIntolerance` takes `{ from: datasource }` or `{ from: text }`, no
  `category`, no `value`, no `split`, no `dosage`, and its item declares no `duration`; one eventType, which declares
  and requires `status` (on a composite never `canBeNull`), and whose `status`, `verificationStatus`, `categories`, `type`, `criticality`, `lastOccurrence`, `notes`
  and `reactions`, when declared, have their JSON type and exactly their enum (`ALLERGY_FIELDS`, and the
  `reactions[].severity` enum, `ALLERGY_REACTION_SEVERITIES`); on a composite each but `reactions` is a field of its
  type (`select`, `multi-select` for `categories`, `date`, `text`), counted as mapped, and a `reactions` field is
  refused. Import keys: one datasource-coded and one text-coded item for the bare key.
- **No known allergy (`[ALG-NKA-*]`):** an `AllergyIntolerance` with `{ from: enum }` is a "no known allergy" and is
  exempt from the `status` rule: its one eventType declares none of `status`, `categories`, `type`, `criticality`,
  `lastOccurrence` and `reactions`, nor does its composite, and its `verificationStatus` and `notes`
  (`ALLERGY_NONE_KNOWN_FIELDS`) keep their type and enum. The `code.field` is a required string enum of the eventType,
  a `select` field of the composite (never `canBeNull`) whose options are that enum; the `codings` keys are exactly the
  enum, each a SNOMED CT coding, unique, each key `all` or an allergy category. `{ from: enum }` on any other
  resourceType is refused. Import keys: each coding, as for a code from eventType.
- **Questionnaire answers (`[FHIR-MAP-26]`):** a `QuestionnaireResponse` block holds `resourceType` and `profiles`
  only (`profiles` may be empty; no `code`, which every other mapping requires; no `category`, `value`, `split`, `ignore` or `dosage`), on a
  `system` item with one eventType whose content has a string `requestEventId` and an object `answers`, the two
  names the renderer reads. Import key: the resourceType alone, one active item.
- **Questionnaire requests (`[FHIR-MAP-27]`):** a `Questionnaire` block holds `resourceType` and `profiles` only
  (`profiles` may be empty), on a `system` item with one eventType whose content has an object `questions`, each
  entry an object with an object `label` and a string `itemRef`, the names the renderer reads. Also held: the keys
  of `questions` follow exactly `^[a-zA-Z0-9_-]+$`; a declared `subField` is an object whose `type` enum is exactly
  `QUESTIONNAIRE_SUB_FIELD_TYPES` and whose `options`, when declared, are an array with `value` types exactly number
  and string; `title` and `description`, when declared, are objects, and `templateRef` a string.
  Import key: the resourceType alone, one active item, kept so the import refusal names one item; it can be lifted
  when a second item maps the type.
- **eventType codings (`[FHIR-MAP-23]`):** at least two distinct codings; two eventTypes may share one, with one
  display, on an item that asserts `references.loinc` only; a shared coding is still never an `alsoMatch` of the
  block. **An HDS item coding** (static or per eventType) is the item's own key, a deprecated alias aside.
- **LOINC (`[LABC-LOINC-1]`):** on an item that asserts `references.loinc`, an eventType coding is the code its unit
  option stores, or the HDS item coding of the item itself when the option stores `null` (and only then), and a static
  code is a LOINC code, the one every unit option stores (never the item coding or another system); a LOINC import key (code, eventType
  coding, `alsoMatch`) is never a code another active item owns (`references.loinc` or `references.loincMethod`).
- **Patient elements:** the element from the allowed list (the schema's `fhirElement` enum, the checker's
  `PATIENT_ELEMENTS`); the item type the element takes, with one string eventType; no `value` on a text or date
  element; on `gender`, `coded` with exactly the item's options, each an administrative-gender code with its official
  display, each once.
- **Uniqueness:** codings unique within an item (code, `alsoMatch` and `alsoEmit`; options and their `alsoMatch`;
  code, `alsoMatch`, `alsoEmit`, components and splits); import keys unique across active items (a static code,
  eventType coding or `alsoMatch` coding; a datasource or content source per category it accepts; a Patient element). A split
  code is not an import key: it may be another item's code, which then wins (`body-heart-rate` and the blood-pressure
  pulse). An `alsoEmit` coding is not an import key either, and is never another active item's import key or a LOINC
  code another item owns: the rendered resource would import back into that item.
- **Units:** two eventTypes of one `quantity`, `scaled-quantity` or `ratio-quantity` block never share a UCUM unit,
  annotations aside (`{beats}/min` is `/min`) and powers of ten alike (`ug/L` is `ng/mL`): the unit picks the eventType
  on import.
- **Scopes:** companions valid (never of a Patient element); the one-pair invariant; the lock (no locked stream
  removed, re-parented or re-paired, no locked item removed or moved, no new item or stream under a locked stream
  without a `reviewed` entry naming that locked stream).
- **Category table:** category keys are lowercase letters, digits and dashes (a scope key is split on `|`); one
  `{system, code}` names one category per resourceType.

---

## Adding a mapping

1. **Check the renderer knows the resourceType, value kind and code source** (hds-fhir-js). If not, that comes first
   (see [Forward compatibility](#forward-compatibility)).
2. **Pick the codes and verify every one**, with its official display:
   - LOINC, against a local database built from the LOINC release (the HDS team keeps one with a `verify` CLI, as for
     SNOMED below: exists, `ACTIVE`, meaning, MapTo replacement). Without one, on the HL7 terminology server:
     ```sh
     curl -s -H 'Accept: application/fhir+json' \
       'https://tx.fhir.org/r4/CodeSystem/$lookup?system=http://loinc.org&code=61577-3'
     ```
     The result gives the display, the status (must be `ACTIVE`) and the code's answer lists (`AnswerList`). Expand
     an answer list to get its LA codes:
     ```sh
     curl -s -H 'Accept: application/fhir+json' \
       'https://tx.fhir.org/r4/ValueSet/$expand?url=http://loinc.org/vs/LL1012-5'
     ```
   - SNOMED CT, in the local snomed-db (`reference/snomed-db` in the HDS workspace):
     ```sh
     npx tsx src/cli.ts verify 135816001      # exists, active, and its FSN
     npx tsx src/cli.ts search "general health"
     ```
     A code must be active and mean what the item means; read the FSN, not only the preferred term.
   - Prefer a generic code over an instrument-specific one when it carries the same answers; when the answers need an
     answer list, take the code whose list matches the item's options exactly.
3. **Pick the category** from the table, then check the stream tree: the item's stream must not have unmapped or
   differently mapped items in its subtree (map them, or declare qualifiers `companionOf`).
4. **Write the block**, `profiles` from the IG versions in `fhirMapping.flavours`; leave a flavour out when its IG has
   no profile that fits.
5. `npm test` (the build checks run at load), then `npm run fhir:lock`, and commit the lock with the block.
6. **Validate the rendering** in hds-fhir-js: add the block to its mappings and a sample event per unit variant and
   option, run `npm test` (round trip) and `npm run validate:fhir` (HL7 validator against every flavour's IG), then
   `npm run check:pack -- <data-model>/dist/pack.json` (the pack and the library agree).
