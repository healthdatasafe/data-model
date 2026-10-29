# FHIR mapping (`fhir:` block on items)

**Status: draft (plan 115, SMART on FHIR), on a feature branch, not published.** The shape is subject to the
data-model review before the first release that carries it. Once published, everything below marked *permanent* is.

An item's `fhir:` block says how its events **render as** a FHIR R4 resource and how a FHIR resource **imports
back** into an event of that item. HDS uses it in three ways:

1. **Export:** a SMART on FHIR app reads the patient's events as FHIR resources (`toFhir` in
   [`hds-fhir-js`](https://github.com/healthdatasafe/hds-fhir-js)).
2. **Import:** HDS reads resources from external SMART on FHIR servers (EHR patient-access APIs) into events
   (`fromFhir`). Every mapping must therefore round-trip.
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

Entries are additive: a published category key or system label is never renamed or removed.

### Categories per resourceType

| resourceType | Category keys | Required |
|---|---|---|
| Observation | `vital-signs`, `social-history`, `survey`, `laboratory`, `exam`, `imaging`, `procedure`, `therapy`, `activity` (system `http://terminology.hl7.org/CodeSystem/observation-category`) | yes |
| Condition | `problem-list-item`, `encounter-diagnosis` (system `http://terminology.hl7.org/CodeSystem/condition-category`), `health-concern` (system `http://hl7.org/fhir/us/core/CodeSystem/condition-category`) | yes |

A resourceType that has a table must carry a `category` from it; a resourceType without a table takes none (Patient).
The SMART scope key is `ResourceType|category` for a resourceType with a table, and the bare resourceType otherwise
(see [SMART scopes](#smart-scopes-packfhirscopes)).

---

## The block, field by field

A block is a **mapping** (below), a **companion**, `{ companionOf: <item key> }` (see
[Qualifiers](#qualifiers-companionof)), or a **Patient element**, `{ resourceType: Patient, element }` (see
[Patient elements](#patient-elements)).

| Field | Required | Meaning |
|---|---|---|
| `resourceType` | yes | `Observation` or `Condition` (`Patient` is an [element block](#patient-elements)). *Permanent.* |
| `category` | per resourceType (table above) | Category key. *Permanent.* |
| `alsoMatchCategories` | no | Further category keys of the same table that a resource may carry and still import into this item, **on import only**, never emitted (smoking status filed under `survey` by older sources). Never the block's own category. |
| `code` | yes | The resource code: a **static coding** `{ system, code, display }`, or a **source** `{ from: datasource, field: <dotted path> }` (below). |
| `alsoMatch` | no | Extra codings accepted **on import only**, never emitted. Static code only. |
| `value` | no | FHIR `value[x]`, by `kind` (below). Absent on a Condition, which has no `value[x]`. |
| `split` | no | Extra resources, one per numeric composite field (below). |
| `ignore` | no | Composite fields deliberately left out of the FHIR rendering. |
| `profiles` | yes | Profile per flavour; `{}` claims none (below). |

**Codings** always have a canonical system URI (`http://loinc.org`, `http://snomed.info/sct`), never a label, a
non-empty `code` and a `display`. The display is the code system's official display, copied exactly: it is what a
reviewer checks the code against and what a reader falls back on.

### `code`: static or from a datasource

- **Static:** `code: { system: http://loinc.org, code: 72166-2, display: Tobacco smoking status }`. Every event of the
  item has this code.
- **From a datasource:** `code: { from: datasource, field: condition }`. The code is the selection a person made in a
  `datasource-search` field: the content at `field` (a dotted path) is a datasets-service selection
  `{ label, codes[] }`, and every entry of `codes[]` becomes a coding, its `system` label translated through
  `fhirMapping.systems`; `code.text` is `label.en`. The field must be a content property of the item's eventType that
  holds a `codes` array, and must be the item's datasource field (the item is `datasource-search`, or the field is a
  `datasource-search` field of its composite).

### Value kinds

| `kind` | Item | Block fields | Renders |
|---|---|---|---|
| `quantity` | `number`, every eventType numeric | `units`: every eventType of the item (its unit variants) → UCUM code, none empty | `valueQuantity` (`system` UCUM, `code` = `unit`) |
| `coded` | `select` | `options`: every option value → coding, each coding once; optional `alsoMatch`: option value → extra codings accepted for that option on import only | `valueCodeableConcept` (the option coding, never an `alsoMatch` one) |
| `components` | `composite` | `components`: numeric composite field → `{ code, unit }` | `component[]`, one per field present |

The schema discriminates by kind: a kind's fields are refused on another kind. `coded` is refused on a
`multi-select`: one resource with several answer codings would state one answer with several codes, not several
answers. A multi-select mapping needs its own design.

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
datasource field of the code, or in `ignore`. A field that is none of these fails the build, so a field added to the
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

**Pseudonymity covers the id only** (plan 115 D14). The Patient's `id` (and identifier) is always the per-grant
alias, whatever else is shared. Demographics reach an app only when it requests `patient/Patient.rs` (or
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
holds one (resourceType, category) pair. The build computes the table and publishes it:

```json
"fhirScopes": {
  "Condition|problem-list-item": ["condition"],
  "Observation|vital-signs": ["body-blood-pressure", "body-heart-rate", "body-weight"],
  "Patient": ["profile-address", "profile-date-of-birth", "profile-name", "profile-sex"]
}
```

Keys are `ResourceType|category` for a resourceType with a category table, and the **bare resourceType** for one
without (`Patient`); values are sorted stream ids. `patient/Patient.rs` and `patient/*.rs` reach the `Patient` key;
a scope with `?category=` never reaches a bare key. It feeds the Pryv OAuth extension's `streamGrants`
(`hds-fhir-js`: `npm run check:pack -- --json`).

**How it is computed.**
- Every item counts, at its `streamId`: a mapped item as its pair, a companion as its parent's pair, an **active item
  without a block as its own `(unmapped)` pair**. A **deprecated item** counts with its mapping if it has one,
  otherwise as unmapped: its past events still sit in its stream.
- A stream is granted when its whole subtree holds exactly one pair and that pair is not `(unmapped)`; then none of
  its descendants is listed. Otherwise the walk descends into its children. Streams with no item in their subtree
  are never granted on their own (they are covered when an ancestor is granted).

**Build failure 1, the invariant.** A stream that carries a mapped or companion item must have a subtree that holds
one pair, `(unmapped)` included. A mapped parent with an unmapped child, or with a child of another pair, fails: its
item could never be granted without over-granting. Fix it by mapping the child (or declaring it a companion), never
by moving streams.

**Build failure 2, the lock.** `definitions/fhir/scopes.lock.json` records every (pair, root) ever published. The
build fails when a locked root's subtree now holds any pair other than its locked one, `(unmapped)` included, or when
a locked root is no longer a stream: either would widen or break every grant already issued for that scope. New roots
are allowed. The test suite also fails when a current grant root is missing from the lock, so every committed state
has its table locked.

- `npm run fhir:lock` adds the current table to the lock. It never removes an entry. Run it when you add or change a
  mapping, and commit the lock with the change. Never edit the lock by hand.

### Permanence

A shipped block's **(resourceType, category) is permanent**, like an item key. Changing it moves the item's stream
from one grant table entry to another: apps already granted the old scope would lose data they were promised, and
the lock refuses it anyway (the stream is a locked root of the old pair). The same holds for a stream that is a locked
grant root: whatever is added under it must belong to its pair.

Additive changes are fine: a block can be added to an item without changing its key, stream or eventType; `alsoMatch`
entries (on the code or per option), `alsoMatchCategories`, profiles of new flavours and new options (with their
coding) can be added. Import-only entries change what HDS accepts, never what it emits or grants.

---

## Forward compatibility

A consumer **skips a block whose resourceType, value kind or code source it does not know** (a newer pack than the
consumer), and a companion block: `toFhir` renders nothing for it rather than throwing. `fromFhir` refuses such a
block with an explicit error. hds-fhir-js also skips a block whose category it does not know, and a Patient element
block whose element (or value) it does not know: the Patient is assembled without it.

So a new value kind, a new code source, a new resourceType or a new Patient element **needs a renderer change
first**: implement and validate
it in hds-fhir-js, release that, then add the first block that uses it here. A block the deployed renderer skips is
data a SMART app does not see.

---

## Import

`fromFhir(resource, mapping, { item })` places one FHIR resource as content of the item the mapping belongs to.
Anything it cannot place is **rejected, never guessed**.

**Which item.** A resource matches an item by **(resourceType, code)**, with a **compatible category**: any coding of
`resource.code` equal (system and code) to the block's static code or one of its `alsoMatch` codings. A block whose
code comes from a datasource matches by resourceType and category (a Condition goes to the Condition item that takes
its code from a datasource). A static code match wins over a datasource match. A resource that matches only a `split`
code imports as a fragment of that item (below) and only when no item matches it directly: a standalone heart-rate
Observation goes to `body-heart-rate`, not to the blood-pressure pulse. The build guarantees that a static code or an
`alsoMatch` coding is claimed by one active item only, and a datasource source by one active item per category it
accepts (`hds-fhir-js`: `matchResource`, which also says why nothing matched).

- **Category.** The resource's categories are its `category` codings in the systems of the resourceType's table
  (`fhirMapping.categories`); a coding in another system (a local category, another IG's) says nothing checkable and
  is ignored. A resource with none matches by code alone. Otherwise one of them must be the block's `category` or one
  of its `alsoMatchCategories`. So a Condition filed as a `health-concern` (US Core files social findings, housing or
  education, there) does not import as a diagnosis into `condition-coded`, while an `encounter-diagnosis` does. A
  resource that states no category cannot be told apart by it: when it fits several datasource-coded items, the
  importer reports it as ambiguous and imports nothing.
- **Withdrawn records** are refused: an Observation with `status` `entered-in-error` or `cancelled`, a Condition whose
  `verificationStatus` is `refuted` or `entered-in-error`. Placing them would state as fact what the source
  retracted. Every other status imports as it is (`preliminary`, `amended`, `provisional`, `unconfirmed`, …); a
  Condition's `clinicalStatus` (resolved, in remission) is not carried yet.

**Values.**
- `quantity`: the `valueQuantity` must have system `http://unitsofmeasure.org` and a `code` equal to one of the
  block's units; that unit picks the eventType (`[lb_av]` → `mass/lb`), and the value is stored as printed. Units are
  **converted only through the item's declared `unitConversions`**. Those relate the item's own eventTypes, and every
  one of them already has its UCUM unit in the block, so in practice a value in one of the block's units is taken as
  printed in that eventType, and a unit outside them (`g` for body weight, `cm` for body height) has no declared
  conversion and is rejected. Importing such a unit takes a new eventType variant on the item first.
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
`onsetDateTime`, else `onsetPeriod.start`, else `recordedDate`. The event time of a `condition-coded` event is when
the patient has had the condition from (its onset, or the date of the diagnosis when that is all the source knows),
not when someone wrote it down, as for the "March 1999" diagnosis of [PARTIAL-DATES.md](PARTIAL-DATES.md); so the
rendering states it as `onsetDateTime`, and the import prefers the onset. A period's end is not kept: no `clientData`
key holds it, and the mapped items are point events. A missing or unreadable date is rejected (a text onset such as
`onsetString` included). Precision follows
[PARTIAL-DATES.md](PARTIAL-DATES.md): a full dateTime is the exact moment, `clientData.hdsTimePrecision: minute`; a
truncated one (`YYYY`, `YYYY-MM`, `YYYY-MM-DD`) is the start of its period at 12:00 UTC with precision `year`, `month`
or `day`. Export is the reverse: the date is truncated to the event's precision (`approx` gives the year and a note
with `hdsTimeText`). A vital sign known only to the month or the year cannot be exported, since FHIR requires a
vital sign's date to the day (vs-1), and is refused rather than padded to a day; so is a US Core screening answer
(us-core-1).

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
- **Agreement with the item:** `quantity` only on `number` items, units exactly the item's eventTypes, each numeric;
  `coded` only on `select` (never `multi-select`), options exactly the item's options; component, split and ignore
  keys are composite fields, components and splits numeric, no field in two roles, every composite field accounted
  for; a datasource source only on a datasource field, resolving to a `codes` array in the eventType; no `value` on a
  Condition; `alsoMatch` only with a static code; per-option `alsoMatch` only on `coded`, keyed by option keys;
  `alsoMatchCategories` known keys of the resourceType's table, never the block's own category.
- **Patient elements:** the element from the allowed list (the schema's `fhirElement` enum, the checker's
  `PATIENT_ELEMENTS`); the item type the element takes, with one string eventType; no `value` on a text or date
  element; on `gender`, `coded` with exactly the item's options, each an administrative-gender code with its official
  display, each once.
- **Uniqueness:** codings unique within an item (code and `alsoMatch`; options and their `alsoMatch`; code,
  `alsoMatch`, components and splits); import keys unique across active items (a static code or `alsoMatch` coding;
  a datasource source per category it accepts; a Patient element). A split code is not an import key: it may be
  another item's code, which then wins (`body-heart-rate` and the blood-pressure pulse).
- **Scopes:** companions valid (never of a Patient element); the one-pair invariant; the lock.

---

## Adding a mapping

1. **Check the renderer knows the resourceType, value kind and code source** (hds-fhir-js). If not, that comes first
   (see [Forward compatibility](#forward-compatibility)).
2. **Pick the codes and verify every one**, with its official display:
   - LOINC, on the HL7 terminology server:
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
