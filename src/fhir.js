const YAML = require('yaml');
const fs = require('fs');
const path = require('path');
const { isDeepStrictEqual } = require('util');

const streams = require('./streams');
const { eventTypesById } = require('./eventTypes');

/**
 * FHIR mapping (plan 115): the pack-level tables, the per-item `fhir` block checks, the SMART scope grant table
 * and its lock. See documentation/FHIR-MAPPING.md.
 */

const MAPPING_FILE_PATH = path.join(__dirname, '../definitions/fhir/mapping.yaml');
const LOCK_FILE_PATH = path.join(__dirname, '../definitions/fhir/scopes.lock.json');

/** Scope pair of an item that has no mapping: its events would be readable through a grant but never rendered. */
const UNMAPPED = '(unmapped)';

/** The resourceTypes whose block maps a medication item (MEDICATION.md): a regimen (`dosage`), a datasource or text code. */
const MEDICATION_TYPES = ['MedicationStatement', 'MedicationRequest'];

/**
 * The resourceType whose block maps a procedure item (TREATMENT-PROCEDURE.md § FHIR): a datasource or text code, no
 * value, the content's `notes` as `Procedure.note`; an event carrying `count` is a lifetime tally and never a Procedure.
 */
const PROCEDURE_TYPE = 'Procedure';
/**
 * A lab result with no item of its own (BLOOD-CHEMISTRY.md § Results with no item of their own) and the keys the
 * `lab-result` value kind reads, at every level of the content.
 */
const LAB_RESULT_CODED = 'lab-result/coded-v1';
const LAB_RESULT_FIELDS = ['analyte', 'value', 'comparator', 'unit', 'unitText', 'valueText', 'valueCodes', 'notes'];
const LAB_RESULT_ANALYTE_FIELDS = ['label', 'codes'];
const LAB_RESULT_LABEL_LANGS = ['en', 'fr', 'es'];
const LAB_RESULT_ANALYTE_CODING_FIELDS = ['system', 'version', 'code', 'display', 'hdsId'];
const LAB_RESULT_VALUE_CODING_FIELDS = ['system', 'version', 'code', 'display'];
// FHIR Quantity.comparator, which `comparator` renders as is.
const LAB_RESULT_COMPARATORS = ['<', '<=', '>', '>='];

/**
 * The resourceType whose block maps an allergy item (ALLERGY.md, FHIR-MAPPING.md § AllergyIntolerance): a datasource or
 * text code (an enum code for a "no known allergy", below), no category, no value, no split. The renderer reads these content properties by name: each has this JSON
 * type, and an enum held equal to this one (every value renders as its FHIR code, so a value is added here and in the
 * renderer first); on a composite, each is a field of this type, counted as mapped. `reactions` is never a form field.
 */
const ALLERGY_TYPE = 'AllergyIntolerance';
const ALLERGY_FIELDS = {
  status: { type: 'string', enum: ['active', 'inactive', 'resolved'], field: 'select' },
  verificationStatus: { type: 'string', enum: ['unconfirmed', 'confirmed'], field: 'select' },
  categories: { type: 'array', enum: ['food', 'medication', 'environment', 'biologic'], field: 'multi-select' },
  type: { type: 'string', enum: ['allergy', 'intolerance'], field: 'select' },
  criticality: { type: 'string', enum: ['low', 'high', 'unable-to-assess'], field: 'select' },
  lastOccurrence: { type: 'string', field: 'date' },
  notes: { type: 'string', field: 'text' },
  reactions: { type: 'array' }
};
/** The `reactions[].severity` enum of an AllergyIntolerance eventType (reaction.severity), held equal as above. */
const ALLERGY_REACTION_SEVERITIES = ['mild', 'moderate', 'severe'];
/**
 * A "no known allergy" (ALLERGY.md § No known allergy) is the AllergyIntolerance block whose code comes from an enum
 * (`code: { from: enum, field, codings }`): a statement, not an allergy. Of `ALLERGY_FIELDS` it carries these only;
 * the others describe an allergen and are refused on its eventType and its composite. Its scope values are `all` or
 * an allergy category, so a reader can tell which allergies a statement covers.
 */
const ALLERGY_NONE_KNOWN_FIELDS = ['verificationStatus', 'notes'];
const ALLERGY_NONE_KNOWN_ALL = 'all';
/** What names an allergen on the two allergy items: never on a "no known allergy" (its eventType refuses both). */
const ALLERGY_NONE_KNOWN_NO_ALLERGEN = ['allergen', 'name'];
const SNOMED_SYSTEM = 'http://snomed.info/sct';

/**
 * The resourceType whose block maps the questionnaire answer item (QUESTIONNAIRE.md § FHIR): no code, no category, no
 * value. The renderer reads the content by name (`requestEventId`, `answers`), so the block holds `resourceType` and
 * `profiles` only.
 */
const QUESTIONNAIRE_RESPONSE_TYPE = 'QuestionnaireResponse';

/**
 * The resourceType whose block maps the questionnaire request item (QUESTIONNAIRE.md § FHIR): no code, no category, no
 * value either. The renderer reads the content by name (`questions`, and in each question `label` and `itemRef`), so
 * the block holds `resourceType` and `profiles` only.
 */
const QUESTIONNAIRE_TYPE = 'Questionnaire';

/**
 * The grammar of a question key on an eventType an item maps to `Questionnaire`, as the eventType declares it
 * (`questions.propertyNames.pattern`): the Pryv content-query path grammar. No dot, so the child linkIds a
 * Questionnaire and its responses carry (`<key>.references`, `<key>.qualifier`, `<key>.reason`, published with
 * 4.12.0) are never a question's. Never widened.
 */
const QUESTION_KEY_PATTERN = '^[a-zA-Z0-9_-]+$';

/**
 * The sub-field types of a question (`subField.type`) the renderer knows: each has a rendering as the item
 * `<key>.qualifier`. The eventType's enum is held equal to this list, and hds-fhir-js `check:pack` compares its own
 * copy with the pack's enum, so a type is never published before a renderer that serves it.
 */
const QUESTIONNAIRE_SUB_FIELD_TYPES = ['select-segmented', 'text', 'number'];

/**
 * The JSON types of a sub-field option `value` the renderer knows (`subField.options[].value`): it refuses a request
 * holding an option of another type. Held equal to the eventType's, like the list above.
 */
const QUESTIONNAIRE_OPTION_VALUE_TYPES = ['number', 'string'];

/**
 * The Patient elements an item may contribute (`fhir: { resourceType: Patient, element }`): the item type each needs
 * and, for a coded element, the code system its option codings come from, code → official display. Text and date
 * elements take the content as written. Additive, like the `fhirElement` enum in src/schemas/items.js.
 */
const PATIENT_ELEMENTS = {
  'name.given': { itemType: 'text' },
  'name.family': { itemType: 'text' },
  gender: {
    itemType: 'select',
    codes: { system: 'http://hl7.org/fhir/administrative-gender', displays: { male: 'Male', female: 'Female', other: 'Other', unknown: 'Unknown' } }
  },
  birthDate: { itemType: 'date' },
  'address.country': { itemType: 'text' }
};

const fhirMapping = YAML.parse(fs.readFileSync(MAPPING_FILE_PATH, 'utf8'));
checkMappingTable(fhirMapping);

/** Format of definitions/fhir/scopes.lock.json this build reads and writes. */
const LOCK_FORMAT = 2;

module.exports = {
  fhirMapping,
  UNMAPPED,
  MEDICATION_TYPES,
  ALLERGY_FIELDS,
  ALLERGY_REACTION_SEVERITIES,
  ALLERGY_NONE_KNOWN_FIELDS,
  PATIENT_ELEMENTS,
  QUESTION_KEY_PATTERN,
  QUESTIONNAIRE_SUB_FIELD_TYPES,
  QUESTIONNAIRE_OPTION_VALUE_TYPES,
  LOCK_FILE_PATH,
  LOCK_FORMAT,
  checkMappingTable,
  checkFhirMapping,
  scopePairOf,
  ucumKey,
  ucumUnitKey,
  computeFhirScopes,
  checkFhirScopes,
  checkFhirImportKeys,
  readLock,
  emptyLock,
  lockEntries,
  mergeLock,
  toBePublished
};

/**
 * A UCUM unit as compared for equality: annotations (`{beats}`) carry no meaning in UCUM, so `{beats}/min` is `/min`
 * and an annotation alone is the unity `1`.
 */
function ucumKey (unit) {
  return unit.replace(/\{[^}]*\}/g, '') || '1';
}

const UCUM_PREFIX = { k: 3, '': 0, d: -1, c: -2, m: -3, u: -6, n: -9, p: -12, f: -15 };
const UCUM_TEN = /^10[*^]([+-]?\d{1,2})?$/;
const UCUM_UNIT = /^(k|d|c|m|u|n|p|f)?(g|L|l|mol|eq|U|\[IU\]|\[iU\])$/;

/**
 * The unit a UCUM code stands for, as the importer compares it (hds-fhir-js `sameUcum`, same rule): annotations
 * dropped, and one unit written with other powers of ten is one unit (`10*3/uL` is `10*6/mL`, `ug/L` is `ng/mL`). Only
 * products and quotients of a power of ten and of `g L mol eq U [IU]` with a prefix are read so; anything else is the
 * code as written. Units are never cancelled (`mg/g` is `ug/mg`, not `10*-3`) and nothing is converted.
 */
function ucumUnitKey (unit) {
  const bare = ucumKey(unit);
  let exponent = 0;
  const over = [];
  const under = [];
  for (const [, sign, term] of (bare.startsWith('/') ? bare : `.${bare}`).matchAll(/([/.])([^/.]*)/g)) {
    const s = sign === '/' ? -1 : 1;
    const ten = UCUM_TEN.exec(term);
    if (ten != null) { exponent += s * Number(ten[1] ?? 1); continue; }
    const m = UCUM_UNIT.exec(term);
    if (m == null) return `as written: ${bare}`;
    exponent += s * UCUM_PREFIX[m[1] ?? ''];
    (s === 1 ? over : under).push(m[2] === 'l' ? 'L' : m[2] === '[iU]' ? '[IU]' : m[2]);
  }
  return `10^${exponent} ${over.sort().join('.')}/${under.sort().join('.')}`;
}

function checkMappingTable (t) {
  const fail = (msg) => { throw new Error(`definitions/fhir/mapping.yaml: ${msg}`); };
  if (!Number.isInteger(t.formatVersion)) fail('formatVersion must be an integer');
  if (typeof t.fhirVersion !== 'string') fail('fhirVersion must be a string');
  for (const [flavour, ig] of Object.entries(t.flavours || {})) {
    if (!/^[a-z0-9.-]+#\d+\.\d+\.\d+$/.test(ig)) fail(`flavour "${flavour}": "${ig}" is not package#version`);
  }
  for (const [resourceType, table] of Object.entries(t.categories || {})) {
    if (!/^[A-Z][A-Za-z]*$/.test(resourceType)) fail(`categories: "${resourceType}" is not a FHIR resourceType name`);
    const codings = new Map();
    for (const [key, c] of Object.entries(table)) {
      // The key is the second half of a `ResourceType|category` scope key: no `|`, no space, no capital.
      if (!/^[a-z][a-z0-9-]*$/.test(key)) fail(`category ${resourceType}/${key}: a category key is lowercase letters, digits and dashes, starting with a letter`);
      if (!/^(https?:|urn:)/.test(c.system) || !c.code || !c.display) fail(`category ${resourceType}/${key} needs a canonical system, a code and a display`);
      const other = codings.get(c.system + '|' + c.code);
      if (other != null) fail(`categories ${resourceType}/${other} and ${resourceType}/${key} share the coding ${c.system}|${c.code}; an imported category would map back to two keys`);
      codings.set(c.system + '|' + c.code, key);
    }
  }
  const uris = Object.values(t.systems || {});
  for (const uri of uris) if (!/^(https?:|urn:)/.test(uri)) fail(`system "${uri}" is not a canonical URI`);
  if (new Set(uris).size !== uris.length) fail('systems: one label per URI, so an imported coding maps back to one label');
  // A product system renders a product code as a second medication coding: its own URI, never one of `systems`
  // (an imported product coding must not read back as a `drug.codes[]` entry).
  const productUris = Object.values(t.productSystems || {});
  for (const uri of productUris) if (!/^(https?:|urn:)/.test(uri)) fail(`productSystem "${uri}" is not a canonical URI`);
  if (new Set([...uris, ...productUris]).size !== uris.length + productUris.length) fail('productSystems: one label per URI, distinct from systems');
}

/**
 * What the schema cannot check about an item's `fhir` block: that it agrees with the item it maps. Every unit,
 * option, component, split and ignore key names something the item really has, every unit variant, option and
 * composite field is accounted for, and codings are unique within the item, so the renderer never meets content it
 * cannot place and an imported coding maps back to exactly one place. A companion block is checked later, with every
 * item loaded (checkFhirScopes).
 */
function checkFhirMapping (key, item, itemEventTypes) {
  const f = item.fhir;
  if (f.companionOf != null) return;
  const fail = (msg) => { throw new Error(`item "${key}" fhir: ${msg}`); };
  const sameSet = (what, mapped, expected) => {
    const missing = expected.filter((x) => !mapped.includes(x));
    const extra = mapped.filter((x) => !expected.includes(x));
    if (missing.length > 0 || extra.length > 0) fail(`${what} must match exactly; missing [${missing.join(', ')}], unknown [${extra.join(', ')}]`);
  };
  const unique = (what, codings) => {
    const seen = new Set();
    for (const c of codings) {
      const k = c.system + '|' + c.code;
      if (seen.has(k)) fail(`${what}: the coding ${k} appears more than once, so it would not map back to one place`);
      seen.add(k);
    }
  };

  if (f.element != null) {
    checkFhirElement(item, itemEventTypes, { fail, sameSet, unique });
    return;
  }

  // category, per resourceType, from the one table
  const table = fhirMapping.categories[f.resourceType];
  if (table != null) {
    if (f.category == null) fail(`a ${f.resourceType} mapping needs a "category" (one of ${Object.keys(table).join(', ')})`);
    if (table[f.category] == null) fail(`unknown ${f.resourceType} category "${f.category}" (known: ${Object.keys(table).join(', ')})`);
  } else if (f.category != null) {
    fail(`resourceType "${f.resourceType}" takes no category`);
  }
  for (const c of f.alsoMatchCategories || []) {
    if (table == null) fail(`resourceType "${f.resourceType}" takes no category, so no "alsoMatchCategories"`);
    if (table[c] == null) fail(`alsoMatchCategories: unknown ${f.resourceType} category "${c}" (known: ${Object.keys(table).join(', ')})`);
    if (c === f.category) fail(`alsoMatchCategories: "${c}" is the block's own category`);
  }

  // A QuestionnaireResponse has no code: nothing below applies to it.
  if (f.resourceType === QUESTIONNAIRE_RESPONSE_TYPE) {
    checkQuestionnaireResponse(item, f, itemEventTypes, fail);
    return;
  }
  // Nor has a Questionnaire.
  if (f.resourceType === QUESTIONNAIRE_TYPE) {
    checkQuestionnaire(item, f, itemEventTypes, fail);
    return;
  }

  const composite = item.composite;
  const mappedFields = new Set();
  const isDatasourceCode = f.code.from === 'datasource';
  const isContentCode = f.code.from === 'content';
  const isTextCode = f.code.from === 'text';
  const isEnumCode = f.code.from === 'enum';
  const isConceptCode = f.code.from === 'concept';
  const isMedication = MEDICATION_TYPES.includes(f.resourceType);
  const isProcedure = f.resourceType === PROCEDURE_TYPE;
  const isAllergy = f.resourceType === ALLERGY_TYPE;
  // An eventType source may give two eventTypes the same coding (two units of one property store one LOINC code): the
  // coding counts once here, with one display.
  const distinctCodings = (codings) => {
    const byKey = new Map();
    for (const c of codings) {
      const k = c.system + '|' + c.code;
      if (byKey.has(k) && byKey.get(k).display !== c.display) fail(`code.codings: the coding ${k} has two displays ("${byKey.get(k).display}", "${c.display}")`);
      byKey.set(k, c);
    }
    return [...byKey.values()];
  };
  const codeCodings = f.code.from === 'eventType'
    ? distinctCodings(Object.values(f.code.codings))
    : isEnumCode ? Object.values(f.code.codings) : isDatasourceCode || isContentCode || isTextCode || isConceptCode ? [] : [f.code];
  // The HDS item coding names the item that carries it, never another one (whose generic rendering has that coding).
  // A deprecated alias keeps its replacement's block, the replacement's key with it.
  if (!item.deprecated) {
    for (const c of codeCodings) {
      if (c.system === ITEM_SYSTEM && c.code !== key) fail(`the HDS item coding ${ITEM_SYSTEM}|${c.code} is not the item's own key`);
    }
  }
  const alsoMatchCodings = alsoMatchCodingsOf(f);
  const alsoEmitCodings = f.alsoEmit || [];
  if (f.alsoEmit != null && f.code.from != null) fail('"alsoEmit" applies to a static code only');
  // A DocumentReference's type is the document's own codings, translated for the profile's binding (DOCUMENTS.md).
  if (f.resourceType === 'DocumentReference' && !isContentCode) fail('a DocumentReference takes its type from the content: code: { from: content, field, translate, unknown }');
  if (isContentCode && f.resourceType !== 'DocumentReference') fail('a content code source applies to a DocumentReference only (the renderer places it as DocumentReference.type)');
  // A medication is the coded medicine datasets-service returned (`drug`), or a name as written (MEDICATION.md).
  if (isMedication && !isDatasourceCode && !isTextCode) fail(`a ${f.resourceType} takes its medication from the content: code: { from: datasource, field } (the coded medicine) or { from: text, field } (the name as written)`);
  // A procedure is the coded procedure datasets-service returned, or a name as written (TREATMENT-PROCEDURE.md).
  if (isProcedure && !isDatasourceCode && !isTextCode) fail('a Procedure takes its code from the content: code: { from: datasource, field } (the coded procedure) or { from: text, field } (the name as written)');
  // An allergen is the coded substance datasets-service returned, or a name as written; a "no known allergy" is the
  // SNOMED CT code of its scope (ALLERGY.md).
  if (isAllergy && !isDatasourceCode && !isTextCode && !isEnumCode) fail('an AllergyIntolerance takes its code from the content: code: { from: datasource, field } (the coded allergen), { from: text, field } (the name as written) or { from: enum, field, codings } (a "no known allergy", by scope)');
  if (isTextCode && !isMedication && !isProcedure && !isAllergy) fail('a text code source applies to a MedicationStatement, a MedicationRequest, a Procedure or an AllergyIntolerance only (the renderer places it as medication[x].text or code.text)');
  if (isEnumCode && !isAllergy) fail('an enum code source applies to an AllergyIntolerance only (a "no known allergy", one SNOMED CT code per scope)');
  // A lab result with no item of its own carries its analyte and its value in content (BLOOD-CHEMISTRY.md): the two
  // go together, so a renderer that knows neither, or one of them only, skips the block.
  if (isConceptCode && f.resourceType !== 'Observation') fail('a concept code source applies to an Observation only (a lab-result/coded-v1 analyte)');
  if (isConceptCode !== (f.value?.kind === 'lab-result')) fail('a concept code source and value.kind "lab-result" go together: the analyte and the result are both read from the content');
  if (isConceptCode) {
    checkLabResultContent(item, f, itemEventTypes, fail);
    if (f.alsoMatch != null) fail('"alsoMatch" applies to a static or eventType code only');
  }
  if (f.status != null && !isProcedure) fail('"status" applies to a Procedure only (the status of a course, from the event\'s span)');
  checkEffective(item, f, fail);
  if (isProcedure) {
    checkProcedure(item, f, itemEventTypes, fail);
    if (composite?.notes != null) mappedFields.add('notes');
  }
  if (isAllergy && isEnumCode) {
    checkNoKnownAllergy(item, f, itemEventTypes, fail);
    for (const k of ALLERGY_NONE_KNOWN_FIELDS) if (composite?.[k] != null) mappedFields.add(k);
  } else if (isAllergy) {
    checkAllergyIntolerance(item, itemEventTypes, fail);
    for (const [k, spec] of Object.entries(ALLERGY_FIELDS)) if (spec.field != null && composite?.[k] != null) mappedFields.add(k);
  }
  if (isMedication) {
    if (f.dosage == null) fail(`a ${f.resourceType} needs "dosage": { field, doseUnits, routes } (the regimen as a FHIR Dosage)`);
    checkDosage(item, f, itemEventTypes, fail, sameSet, unique);
    mappedFields.add(f.dosage.field.split('.')[0]);
  } else if (f.dosage != null) {
    fail('"dosage" applies to a MedicationStatement or MedicationRequest only');
  }
  if (isDatasourceCode) {
    checkDatasourceField(item, f.code.field, itemEventTypes, fail);
    if (f.alsoMatch != null) fail('"alsoMatch" applies to a static or eventType code only');
    mappedFields.add(f.code.field.split('.')[0]);
    if (isMedication) checkProductSystems(f.code.field, itemEventTypes, fail);
  } else if (isTextCode) {
    checkTextField(item, f.code.field, itemEventTypes, fail);
    if (f.alsoMatch != null) fail('"alsoMatch" applies to a static or eventType code only');
    mappedFields.add(f.code.field.split('.')[0]);
  } else if (isContentCode) {
    checkContentField(item, f.code, itemEventTypes, fail);
    if (f.alsoMatch != null) fail('"alsoMatch" applies to a static or eventType code only');
  } else if (isEnumCode) {
    checkEnumField(item, f.code, itemEventTypes, fail, sameSet);
    if (f.alsoMatch != null) fail('"alsoMatch" applies to a static or eventType code only');
    unique('code.codings', codeCodings);
    mappedFields.add(f.code.field);
  } else if (f.code.from === 'eventType') {
    // Each eventType renders its own code, and an imported code names its eventType back; so does an import-only
    // code, keyed by the eventType it names (a mass code never imports a moles quantity). Two units of one property
    // (ng/dL and ng/mL, both mass) store one code: that code names both eventTypes and the unit, distinct per
    // eventType (below), picks among them. One code for every eventType is a static code.
    sameSet('code.codings keys vs the item eventTypes', Object.keys(f.code.codings), itemEventTypes);
    if (codeCodings.length < 2) fail('code.codings give every eventType the same coding: that is a static code, not a code from eventType');
    // What keeps a shared coding honest is the unit options (`options[].loinc`, held by checkLoincAgreement and
    // `[LABC-LOINC-3e]`): without them nothing says the two units are one property.
    if (codeCodings.length < Object.keys(f.code.codings).length && (item.references?.loinc || []).length === 0) {
      fail('two eventTypes share a coding only on an item whose unit options store it (references.loinc)');
    }
    if (Array.isArray(f.alsoMatch)) fail('with an eventType code, "alsoMatch" is keyed by eventType: { <eventType>: [codings] }');
    for (const t of Object.keys(f.alsoMatch || {})) {
      if (!itemEventTypes.includes(t)) fail(`alsoMatch "${t}" is not one of the item eventTypes (${itemEventTypes.join(', ')})`);
    }
    unique('code.codings and alsoMatch', [...codeCodings, ...alsoMatchCodings]);
  } else {
    if (f.alsoMatch != null && !Array.isArray(f.alsoMatch)) fail('"alsoMatch" keyed by eventType applies to an eventType code only; a static code takes a list');
    unique('code, alsoMatch and alsoEmit', [f.code, ...alsoMatchCodings, ...alsoEmitCodings]);
  }
  checkLoincAgreement(key, item, f, itemEventTypes, fail);

  if ((f.resourceType === 'Condition' || f.resourceType === 'DocumentReference' || isMedication || isProcedure || isAllergy) && f.value != null) fail(`a ${f.resourceType} has no value[x]; remove "value"`);
  if ((isProcedure || isAllergy) && f.split != null) fail(`a ${f.resourceType} has no numeric field to split; remove "split"`);

  const numericField = (what, k) => {
    const field = composite?.[k];
    if (field == null) fail(`${what} "${k}" is not a composite field`);
    if (field.type !== 'number' && field.type !== 'slider') fail(`${what} "${k}" must be a numeric composite field, it is "${field.type}"`);
  };

  const v = f.value;
  const ownCodings = [...codeCodings, ...alsoMatchCodings, ...alsoEmitCodings];
  if (v?.alsoMatch != null && v.kind !== 'coded' && v.kind !== 'fixed-coded') fail('value.alsoMatch applies to value.kind "coded" or "fixed-coded" only');
  if (v != null) {
    switch (v.kind) {
      case 'quantity':
      case 'scaled-quantity': {
        if (item.type !== 'number') fail(`value.kind "${v.kind}" applies to "number" items only`);
        sameSet('value.units keys vs the item eventTypes', Object.keys(v.units), itemEventTypes);
        for (const t of itemEventTypes) {
          if (eventTypesById(t)?.type !== 'number') fail(`value.kind "${v.kind}": eventType "${t}" is not a number`);
        }
        // eventType → { unit, factor }; a plain quantity renders the stored number as it is.
        const scaled = Object.entries(v.units).map(([t, u]) => v.kind === 'quantity' ? [t, u, 1] : [t, u.unit, u.factor]);
        distinctUnits(scaled.map(([t, u]) => [t, u]), fail);
        for (const [t, u, factor] of scaled) {
          // A proportion stores 0..1: as a percentage it is 100 times the stored number, never the number itself.
          if (t === 'ratio/proportion' && ucumKey(u) === '%' && factor !== 100) {
            fail(`value.units "${t}": a proportion (0..1) renders in % with value.kind "scaled-quantity" and factor 100, not ${v.kind === 'quantity' ? 'as stored' : `factor ${factor}`}`);
          }
        }
        break;
      }
      case 'ratio-quantity': {
        // A number stored as `{ value, relativeTo }` with the item's fixed denominator (INR: relativeTo 1). The block
        // states that denominator, so a renderer that holds the block alone refuses an event carrying another one.
        if (item.type !== 'number') fail('value.kind "ratio-quantity" applies to "number" items only');
        sameSet('value.units keys vs the item eventTypes', Object.keys(v.units), itemEventTypes);
        for (const t of itemEventTypes) {
          const et = eventTypesById(t);
          if (et?.type !== 'object' || et.properties?.value?.type !== 'number' || et.properties?.relativeTo?.type !== 'number') {
            fail(`value.kind "ratio-quantity": eventType "${t}" does not store { value, relativeTo }`);
          }
        }
        if (v.relativeTo !== item.ratioRelativeTo) fail(`value.relativeTo ${v.relativeTo} is not the item's ratioRelativeTo (${item.ratioRelativeTo})`);
        distinctUnits(Object.entries(v.units), fail);
        break;
      }
      case 'coded':
        if (item.type === 'multi-select') fail('value.kind "coded" on a multi-select is not supported: one resource with several answer codings would misstate the answer');
        if (item.type !== 'select') fail('value.kind "coded" applies to "select" items only');
        sameSet('value.options keys vs the item options', Object.keys(v.options), item.options.map((o) => String(o.value)));
        for (const k of Object.keys(v.alsoMatch || {})) {
          if (v.options[k] == null) fail(`value.alsoMatch "${k}" is not an option of the block`);
        }
        // One coding, one option: an import-only coding never repeats an option coding or another alsoMatch.
        unique('value.options and value.alsoMatch', [...Object.values(v.options), ...Object.values(v.alsoMatch || {}).flat()]);
        break;
      case 'lab-result':
        // Held with the concept code above (checkLabResultContent): the content is the value.
        break;
      case 'fixed-coded':
        checkFixedCoded(item, f, itemEventTypes, fail, sameSet);
        // One coding, one place in the item: the code, the value codings, their alsoMatch and the component.
        ownCodings.push(...fixedCodedCodings(v));
        break;
      case 'components':
        if (composite == null) fail('value.kind "components" needs a composite item');
        for (const k of Object.keys(v.components)) {
          numericField('component', k);
          mappedFields.add(k);
        }
        ownCodings.push(...Object.values(v.components).map((c) => c.code));
        break;
    }
  }

  for (const k of Object.keys(f.split || {})) {
    numericField('split', k);
    if (mappedFields.has(k)) fail(`field "${k}" is both a component and a split`);
    mappedFields.add(k);
  }
  unique('code, components and split codes', [...ownCodings, ...Object.values(f.split || {}).map((s) => s.code)]);
  // A renderer that predates alsoEmit would leave it out and claim a profile the resource misses. alsoEmit came with
  // scaled-quantity in hds-fhir-js 0.1.0, and the three consumers (facade v0.15.0, hds-webapp and doctor-dashboard
  // v0.10.2, by their package.json pins, 2026-11-26) are past it, so `quantity` is allowed too (plan 133, the basal body
  // temperature); any other kind stays refused until a block needs it and its renderer is checked.
  if (f.alsoEmit != null && v?.kind !== 'scaled-quantity' && v?.kind !== 'quantity') fail('"alsoEmit" applies to value kind "quantity" or "scaled-quantity" only; see FHIR-MAPPING.md § Forward compatibility');

  for (const k of f.ignore || []) {
    if (composite?.[k] == null) fail(`ignore "${k}" is not a composite field`);
    if (mappedFields.has(k)) fail(`field "${k}" is both mapped and ignored`);
  }
  for (const k of Object.keys(composite || {})) {
    if (!mappedFields.has(k) && !(f.ignore || []).includes(k)) fail(`composite field "${k}" is neither mapped nor listed in "ignore"`);
  }
}

/**
 * The unit picks the eventType on import, so two eventTypes of one block never share a UCUM unit: annotations aside, and
 * one unit written with other powers of ten is one (`ucumUnitKey`).
 */
function distinctUnits (pairs, fail) {
  const byUnit = new Map();
  for (const [t, u] of pairs) {
    const other = byUnit.get(ucumUnitKey(u));
    if (other != null) fail(`value.units: eventTypes "${other.t}" and "${t}" share the UCUM unit "${ucumKey(u)}"${ucumKey(other.u) === ucumKey(u) ? '' : ` ("${ucumKey(other.u)}", powers of ten alike)`} (annotations aside); an imported quantity would map back to two eventTypes`);
    byUnit.set(ucumUnitKey(u), { t, u });
  }
}

/** The eventType of a presence event (no content): the one a `fixed-coded` presence twin sits on. */
const PRESENCE_EVENT_TYPE = 'activity/plain';

/** Every coding of a `fixed-coded` value: its codings, its alsoMatch, the component code and its option codings. */
function fixedCodedCodings (v) {
  return [...v.codings, ...(v.alsoMatch || []), ...(v.component != null ? [v.component.code, ...Object.values(v.component.options)] : [])];
}

/**
 * A `fixed-coded` value (FHIR-MAPPING.md § Value kinds, plan 133 activity): an Observation whose static code is the
 * question a family of items shares (73985-4 "Exercise activity") and whose value is fixed per item (the sport). Without
 * a component, the item's one eventType has no content (`activity/plain`, a presence); with one, the item is a `select`
 * whose options are exactly the component's. Its code is never an import key, so the block takes no code `alsoMatch`
 * (an import-only value coding goes in `value.alsoMatch`). No coding is the HDS item coding: the item system names the
 * item that carries a coding, and a value is an answer, not an item. The twin a component names, the family's one
 * category and the import keys by value are checked with every item loaded (checkFixedCodedFamilies,
 * checkFhirImportKeys).
 */
function checkFixedCoded (item, f, itemEventTypes, fail, sameSet) {
  const v = f.value;
  if (f.resourceType !== 'Observation') fail('value.kind "fixed-coded" applies to an Observation only');
  if (f.code.from != null) fail('value.kind "fixed-coded" needs a static code: the question its value answers');
  if (f.alsoMatch != null) fail('value.kind "fixed-coded": the code is no import key, so the block takes no "alsoMatch" (an import-only value coding goes in value.alsoMatch)');
  for (const c of fixedCodedCodings(v)) {
    if (c.system === ITEM_SYSTEM) fail(`value.kind "fixed-coded": ${c.system}|${c.code} is the HDS item coding, which names the item that carries it, never a value`);
  }
  if (itemEventTypes.length !== 1) fail('value.kind "fixed-coded" needs an item with exactly one eventType');
  if (v.component == null) {
    if (eventTypesById(itemEventTypes[0])?.type !== 'null') fail(`value.kind "fixed-coded" without a component needs an item whose eventType holds no content (${PRESENCE_EVENT_TYPE}); "${itemEventTypes[0]}" does`);
    return;
  }
  if (item.type !== 'select') fail('value.kind "fixed-coded" with a component applies to "select" items only (the component renders the option)');
  sameSet('value.component.options keys vs the item options', Object.keys(v.component.options), item.options.map((o) => String(o.value)));
}

/**
 * `effective: { from: span }` (plan 133 activity): an Observation's date from the event's span, `effectivePeriod` for a
 * positive duration. On an Observation only, never beside a `split` or a concept code (hds-fhir-js skips such a block).
 * `day: true` marks an event that is one local day (a daily total): it is required exactly on an Observation item
 * whose duration is one day (mandatory, never null, `maxSeconds` at most 90000), so a renderer never states a 1 h or a
 * 7 d event under a "24 hour" code; a mandatory duration of another kind (a fertile window of up to 6 days, a
 * pregnancy still running) is no day.
 */
function checkEffective (item, f, fail) {
  if (f.effective != null && f.resourceType !== 'Observation') fail('"effective" applies to an Observation only (effectiveDateTime or effectivePeriod)');
  if (f.resourceType !== 'Observation') return;
  // hds-fhir-js `isSupported` refuses `effective` beside these two, so a block carrying both would never render.
  if (f.effective != null && f.split != null) fail('"effective" and "split" do not go together (a renderer skips such a block)');
  if (f.effective != null && f.code.from === 'concept') fail('"effective" does not apply to a concept code (lab-result) block (a renderer skips such a block)');
  // A daily total: a mandatory, never-null duration of at most one day plus the DST hour.
  const d = item.duration;
  const isDay = d?.mandatory === true && d.canBeNull === false && typeof d.maxSeconds === 'number' && d.maxSeconds <= 90000;
  if (isDay && f.effective?.day !== true) fail('an item whose duration is one day (mandatory, never null, maxSeconds <= 90000) needs "effective: { from: span, day: true }"');
  if (!isDay && f.effective?.day === true) fail('"effective.day" applies to an item whose duration is one day only (mandatory, never null, maxSeconds <= 90000)');
}

/**
 * A Patient element block: the element takes an item of its type whose one eventType is a string, the content as
 * written for a text or date element, and for a coded element (gender) one coding per item option, each a code of
 * the element's code system with its official display.
 */
function checkFhirElement (item, itemEventTypes, { fail, sameSet, unique }) {
  const f = item.fhir;
  const spec = PATIENT_ELEMENTS[f.element];
  if (spec == null) fail(`unknown Patient element "${f.element}"`);
  if (item.type !== spec.itemType) fail(`element "${f.element}" takes a "${spec.itemType}" item; item type is "${item.type}"`);
  if (itemEventTypes.length !== 1) fail(`element "${f.element}" needs an item with exactly one eventType`);
  if (eventTypesById(itemEventTypes[0])?.type !== 'string') fail(`element "${f.element}": eventType "${itemEventTypes[0]}" is not a string`);
  if (spec.codes == null) {
    if (f.value != null) fail(`element "${f.element}" takes the content as written; remove "value"`);
    return;
  }
  if (f.value?.kind !== 'coded') fail(`element "${f.element}" needs value.kind "coded"`);
  if (f.value.alsoMatch != null) fail(`element "${f.element}" takes no value.alsoMatch: a Patient element imports from its own code`);
  sameSet('value.options keys vs the item options', Object.keys(f.value.options), item.options.map((o) => String(o.value)));
  unique('value.options', Object.values(f.value.options));
  for (const [option, c] of Object.entries(f.value.options)) {
    if (c.system !== spec.codes.system || spec.codes.displays[c.code] !== c.display) {
      fail(`option "${option}": ${c.system}|${c.code} "${c.display}" is not a code of ${spec.codes.system} with its display`);
    }
  }
}

const LOINC_SYSTEM = 'http://loinc.org';
/** The HDS item coding: the item key as a code, for what LOINC has no code for (FHIR-MAPPING.md § code). */
const ITEM_SYSTEM = 'https://hds.ngo/fhir/CodeSystem/item';

/** Every `alsoMatch` coding of a block: the list of a static code, or all lists of an eventType code. */
function alsoMatchCodingsOf (f) {
  if (f.alsoMatch == null) return [];
  return Array.isArray(f.alsoMatch) ? f.alsoMatch : Object.values(f.alsoMatch).flat();
}

/**
 * `[LABC-LOINC-1]`, the block side: on an item that asserts LOINC codes (`references.loinc`), the block's LOINC
 * codings agree with them, so ownership and the import match keys cannot disagree. Each eventType renders the code its
 * unit option stores (`variations.eventType.options[].loinc`; on an item without unit options, its one code), and a
 * static code is stored by every unit option, and is a LOINC code. A unit LOINC has no code for (`loinc: null`: the
 * pmol/L of 1,25-dihydroxyvitamin D) renders the HDS item coding, the item's own key, never a LOINC code. An `alsoMatch` code may be one no item
 * owns (a discouraged panel code); that no other item owns a block's LOINC import key is checked with every item
 * loaded (checkFhirImportKeys).
 */
function checkLoincAgreement (key, item, f, itemEventTypes, fail) {
  const loinc = item.references?.loinc || [];
  if (loinc.length === 0) return;
  const options = item.variations?.eventType?.options || [];
  const storedBy = (t) => options.length > 0 ? options.find((o) => o.value === t)?.loinc ?? null : loinc[0];
  const isLoinc = (c) => c.system === LOINC_SYSTEM;
  if (f.code.from === 'eventType') {
    for (const [t, c] of Object.entries(f.code.codings)) {
      const stored = storedBy(t);
      if (stored == null) {
        if (c.system !== ITEM_SYSTEM || c.code !== key) fail(`code.codings "${t}": its unit option stores no LOINC code, so its coding is the HDS item coding (${ITEM_SYSTEM}|${key}), not ${c.system}|${c.code}`);
      } else if (!isLoinc(c) || c.code !== stored) {
        fail(`code.codings "${t}": ${c.system}|${c.code} is not the LOINC code its unit option stores (${stored})`);
      }
    }
  } else if (f.code.from == null && isLoinc(f.code)) {
    const other = itemEventTypes.filter((t) => storedBy(t) !== f.code.code);
    if (other.length > 0) fail(`code ${f.code.code} is a static code, but eventType ${other.join(', ')} stores ${other.map(storedBy).join(', ')}: use a code from eventType`);
  } else if (f.code.from == null) {
    // An item that asserts a LOINC code exports it: never the HDS item coding or another system in its place.
    fail(`the item asserts LOINC (references.loinc): its static code is the LOINC code every unit option stores, not ${f.code.system}|${f.code.code}`);
  }
}

/** A `code: { from: datasource, field }` must name a datasets-service selection (`{ label, codes[] }`) in the content. */
function checkDatasourceField (item, field, itemEventTypes, fail) {
  if (itemEventTypes.length !== 1) fail('a datasource code source needs an item with exactly one eventType');
  const segments = field.split('.');
  let prop = eventTypesById(itemEventTypes[0]);
  for (const s of segments) {
    prop = prop?.type === 'object' ? prop.properties?.[s] : undefined;
    if (prop == null) fail(`code.field "${field}" is not a content property of eventType "${itemEventTypes[0]}"`);
  }
  if (prop.type !== 'object' || prop.properties?.codes?.type !== 'array') fail(`code.field "${field}" does not hold a datasets-service "codes" array`);
  if (item.composite != null) {
    let def = { composite: item.composite };
    for (const s of segments) def = def?.composite?.[s];
    if (def?.type !== 'datasource-search') fail(`code.field "${field}" is not a datasource-search field of the composite`);
  } else if (item.type !== 'datasource-search') {
    fail(`a datasource code source applies to a datasource field; item type is "${item.type}"`);
  }
}

/**
 * A `code: { from: content, field, translate, unknown }` names, in the content of the item's one eventType, a FHIR
 * Coding or a list of them (`{ system, code }` objects: a document's `type`). `translate` is keyed `"<system>|<code>"`
 * with a canonical system; its codings and `unknown` are what the renderer leads the concept with, so none of them
 * may be one of the keys' own (a translation to itself says nothing) and the keys name no system the field cannot
 * hold a coding of.
 */
function checkContentField (item, code, itemEventTypes, fail) {
  if (itemEventTypes.length !== 1) fail('a content code source needs an item with exactly one eventType');
  let prop = eventTypesById(itemEventTypes[0]);
  for (const s of code.field.split('.')) {
    prop = prop?.type === 'object' ? prop.properties?.[s] : undefined;
    if (prop == null) fail(`code.field "${code.field}" is not a content property of eventType "${itemEventTypes[0]}"`);
  }
  const coding = prop.type === 'array' ? prop.items : prop;
  if (coding?.type !== 'object' || coding.properties?.system?.type !== 'string' || coding.properties?.code?.type !== 'string') {
    fail(`code.field "${code.field}" does not hold a FHIR Coding or a list of them (objects with system and code)`);
  }
  for (const [k, c] of Object.entries(code.translate)) {
    const [system, value] = [k.slice(0, k.indexOf('|')), k.slice(k.indexOf('|') + 1)];
    if (!/^(https?:|urn:)/.test(system) || value === '') fail(`code.translate "${k}": a key is "<canonical system>|<code>"`);
    if (c.system === system && c.code === value) fail(`code.translate "${k}" translates to itself`);
  }
}

/**
 * A `code: { from: concept, field }` with `value: { kind: lab-result }` sits on an item whose one eventType is
 * `lab-result/coded-v1`: `field` holds the labelled concept `{ label: { en, … }, codes: [Coding] }`, and the renderer
 * reads every other property by name (LAB_RESULT_FIELDS). The eventType's properties are exactly those, so a property
 * added to it later fails the build until the renderers place it (the composite check does not see an eventType).
 */
function checkLabResultContent (item, f, itemEventTypes, fail) {
  if (item.type !== 'imported') fail(`a concept code source sits on an "imported" item (a result written by importers); item type is "${item.type}"`);
  if (itemEventTypes.length !== 1 || itemEventTypes[0] !== LAB_RESULT_CODED) fail(`a concept code source needs an item whose one eventType is "${LAB_RESULT_CODED}"`);
  if (f.code.field !== 'analyte') fail(`code.field "${f.code.field}" is not the analyte of "${LAB_RESULT_CODED}" ("analyte")`);
  // Never matched on import: nothing may make it an import key or an owner of a code (that would invert the
  // importer's owned-analyte guard).
  if (f.alsoMatchCategories != null) fail('a concept code source claims no import key: no "alsoMatchCategories"');
  if (item.references?.loinc != null || item.references?.loincMethod != null) fail('a concept-coded item owns no LOINC code (references.loinc, references.loincMethod): its analyte is per event');
  // Every key the renderer meets, at every level, is one it places.
  const et = eventTypesById(itemEventTypes[0]);
  const keysOf = (what, prop, expected) => {
    const props = Object.keys(prop?.properties || {});
    const missing = expected.filter((k) => !props.includes(k));
    const unplaced = props.filter((k) => !expected.includes(k));
    if (prop?.type !== 'object' || missing.length > 0 || unplaced.length > 0) {
      fail(`value.kind "lab-result" reads ${what} { ${expected.join(', ')} }; eventType "${itemEventTypes[0]}"${prop?.type !== 'object' ? ' has no such object' : ''}${unplaced.length > 0 ? ` adds ${unplaced.join(', ')}, which no renderer places` : ''}${missing.length > 0 ? ` lacks ${missing.join(', ')}` : ''}`);
    }
  };
  keysOf('the content', et, LAB_RESULT_FIELDS);
  const analyte = et.properties.analyte;
  keysOf('analyte', analyte, LAB_RESULT_ANALYTE_FIELDS);
  keysOf('analyte.label', analyte.properties.label, LAB_RESULT_LABEL_LANGS);
  keysOf('analyte.codes[]', analyte.properties.codes?.items, LAB_RESULT_ANALYTE_CODING_FIELDS);
  keysOf('valueCodes[]', et.properties.valueCodes?.items, LAB_RESULT_VALUE_CODING_FIELDS);
  const comparators = et.properties.comparator?.enum || [];
  if (comparators.length !== LAB_RESULT_COMPARATORS.length || comparators.some((c) => !LAB_RESULT_COMPARATORS.includes(c))) {
    fail(`value.kind "lab-result" renders comparator as Quantity.comparator (${LAB_RESULT_COMPARATORS.join(' ')}); eventType "${itemEventTypes[0]}" allows ${comparators.join(' ')}`);
  }
}

/** The content property at a dotted path of an item's one eventType, or undefined. */
function contentProperty (eventType, field) {
  let prop = eventTypesById(eventType);
  for (const s of field.split('.')) {
    prop = prop?.type === 'object' ? prop.properties?.[s] : undefined;
    if (prop == null) return undefined;
  }
  return prop;
}

/**
 * A `code: { from: text, field }` names a string in the content of the item's one eventType, the name of a
 * medication or of a procedure as written: a `text` field of the item's composite. (A standalone `text` item cannot carry one: its
 * eventType is a string, so no `field` is a content property of it, and `checkDosage` needs a regimen object in the
 * same eventType anyway.)
 */
function checkTextField (item, field, itemEventTypes, fail) {
  if (itemEventTypes.length !== 1) fail('a text code source needs an item with exactly one eventType');
  const prop = contentProperty(itemEventTypes[0], field);
  if (prop == null) fail(`code.field "${field}" is not a content property of eventType "${itemEventTypes[0]}"`);
  if (prop.type !== 'string') fail(`code.field "${field}" is not a string`);
  if (item.composite != null) {
    let def = { composite: item.composite };
    for (const s of field.split('.')) def = def?.composite?.[s];
    if (def?.type !== 'text') fail(`code.field "${field}" is not a text field of the composite`);
  }
}

/**
 * A Procedure block (TREATMENT-PROCEDURE.md § FHIR) sits on an item with one eventType whose content the renderer
 * reads by name: `notes`, a string, is `Procedure.note`; `count`, a number, marks a lifetime tally ("had it N times"),
 * which is not one dated procedure and never renders as a Procedure. Either may be absent from the eventType; one
 * that is there has that type, so a renderer holding the block alone never meets another shape under these names.
 *
 * `status: { from: span }` is on an item whose events may be a span still running (`duration.canBeNull`), and only
 * there: without it an open span has no rendering (a procedure that took place is `completed`), and without an open
 * span there is no status to take from it.
 */
function checkProcedure (item, f, itemEventTypes, fail) {
  if (itemEventTypes.length !== 1) fail('a Procedure block needs an item with exactly one eventType');
  const openSpan = item.duration?.canBeNull === true;
  if (openSpan && f.status == null) fail('an item whose duration may be null (a span still running) needs "status: { from: span }" on its Procedure block: without it the Procedure is completed, and an open span has no rendering');
  if (!openSpan && f.status != null) fail('"status: { from: span }" needs an item whose duration may be null (duration.canBeNull: a span still running)');
  const notes = contentProperty(itemEventTypes[0], 'notes');
  if (notes != null && notes.type !== 'string') fail(`content property "notes" of eventType "${itemEventTypes[0]}" is not a string (it renders as Procedure.note)`);
  const count = contentProperty(itemEventTypes[0], 'count');
  if (count != null && count.type !== 'number') fail(`content property "count" of eventType "${itemEventTypes[0]}" is not a number (it marks a lifetime tally)`);
  if (item.composite?.notes != null && item.composite.notes.type !== 'text') fail('composite field "notes" is not a text field (it renders as Procedure.note)');
}

/**
 * An AllergyIntolerance block (FHIR-MAPPING.md § AllergyIntolerance) sits on an item with one eventType that requires
 * `status` (clinicalStatus, ait-1) and whose other content the renderer reads by name (`ALLERGY_FIELDS`): each one
 * declared has its JSON type and exactly its enum, and is a field of its type on a composite; `reactions` is never a
 * form field, and its items hold a `manifestations` array and exactly the severity enum. The item declares no
 * `duration`: time + duration is reserved for an abatement, refused in v1.
 */
function checkAllergyIntolerance (item, itemEventTypes, fail) {
  if (itemEventTypes.length !== 1) fail('an AllergyIntolerance block needs an item with exactly one eventType');
  if (item.duration != null) fail('an AllergyIntolerance item declares no "duration": time + duration is reserved for an abatement, refused in v1');
  const et = itemEventTypes[0];
  const sameEnum = (values, expected) => Array.isArray(values) && values.length === expected.length && expected.every((v) => values.includes(v));
  if (contentProperty(et, 'status') == null) fail(`eventType "${et}" must declare the content property "status" (AllergyIntolerance.clinicalStatus, ait-1)`);
  if (!eventTypesById(et)?.required?.includes('status')) fail(`eventType "${et}" must require "status" (AllergyIntolerance.clinicalStatus, ait-1)`);
  if (item.composite?.status?.canBeNull === true) fail('composite field "status" cannot be null: every writer states it (AllergyIntolerance.clinicalStatus, ait-1)');
  for (const [name, spec] of Object.entries(ALLERGY_FIELDS)) {
    const prop = contentProperty(et, name);
    if (prop != null) {
      if (prop.type !== spec.type) fail(`content property "${name}" of eventType "${et}" is not of type ${spec.type} (the renderer reads it by name)`);
      if (spec.enum != null && !sameEnum(spec.type === 'array' ? prop.items?.enum : prop.enum, spec.enum)) {
        fail(`content property "${name}" of eventType "${et}": the enum must be exactly ${spec.enum.join(', ')} (each value renders as its FHIR code: add a value here and in the renderer first)`);
      }
    }
    const field = item.composite?.[name];
    if (field == null) continue;
    if (spec.field == null) fail(`composite field "${name}" is not a form field of an AllergyIntolerance item`);
    if (field.type !== spec.field) fail(`composite field "${name}" is not a ${spec.field} field (the renderer reads it by name)`);
  }
  const reaction = contentProperty(et, 'reactions')?.items;
  if (reaction != null) {
    if (reaction.properties?.manifestations?.type !== 'array') fail(`eventType "${et}": a reaction has no array "manifestations" (reaction.manifestation, 1..*)`);
    if (!sameEnum(reaction.properties?.severity?.enum, ALLERGY_REACTION_SEVERITIES)) fail(`eventType "${et}": the "reactions[].severity" enum must be exactly ${ALLERGY_REACTION_SEVERITIES.join(', ')}`);
  }
}

/**
 * A `code: { from: enum, field, codings }` names a required string enum in the content of the item's one eventType,
 * entered in a `select` field of the composite whose options are the enum: each value renders as its own coding, so
 * the `codings` keys are exactly the enum, and an imported coding maps back to one value.
 */
function checkEnumField (item, code, itemEventTypes, fail, sameSet) {
  if (itemEventTypes.length !== 1) fail('an enum code source needs an item with exactly one eventType');
  const et = itemEventTypes[0];
  const prop = contentProperty(et, code.field);
  if (prop == null) fail(`code.field "${code.field}" is not a content property of eventType "${et}"`);
  if (prop.type !== 'string' || !Array.isArray(prop.enum)) fail(`code.field "${code.field}" is not a string enum of eventType "${et}"`);
  if (!eventTypesById(et)?.required?.includes(code.field)) fail(`eventType "${et}" must require "${code.field}": it is the resource's code`);
  sameSet(`code.codings keys vs the "${code.field}" enum`, Object.keys(code.codings), prop.enum);
  const def = item.composite?.[code.field];
  if (def?.type !== 'select') fail(`code.field "${code.field}" is not a select field of the composite`);
  if (def.canBeNull === true) fail(`composite field "${code.field}" cannot be null: it is the resource's code`);
  sameSet(`the "${code.field}" options vs its enum`, (def.options || []).map((o) => String(o.value)), prop.enum);
}

/**
 * A "no known allergy" block (FHIR-MAPPING.md § AllergyIntolerance, "No known allergy"): the AllergyIntolerance whose
 * code comes from an enum. It sits on an item with one eventType and no `duration`; it has no `status` (it renders as
 * clinicalStatus active, ait-1), so its eventType declares none and none of the other allergen properties
 * (`categories`, `type`, `criticality`, `lastOccurrence`, `reactions`); the composite has none of them either. What it
 * does carry (`ALLERGY_NONE_KNOWN_FIELDS`) keeps the type and the enum the renderer reads by name. Every coding is a
 * SNOMED CT code, and every scope value is `all` or an allergy category.
 */
function checkNoKnownAllergy (item, f, itemEventTypes, fail) {
  if (itemEventTypes.length !== 1) fail('an AllergyIntolerance block needs an item with exactly one eventType');
  if (item.duration != null) fail('a "no known allergy" item declares no "duration": the event time is when the statement was made');
  const et = itemEventTypes[0];
  const sameEnum = (values, expected) => Array.isArray(values) && values.length === expected.length && expected.every((v) => values.includes(v));
  for (const [name, spec] of Object.entries(ALLERGY_FIELDS)) {
    const prop = contentProperty(et, name);
    const field = item.composite?.[name];
    if (!ALLERGY_NONE_KNOWN_FIELDS.includes(name)) {
      if (prop != null) fail(`eventType "${et}" of a "no known allergy" declares "${name}": a statement has no ${name} (it describes an allergen)`);
      if (field != null) fail(`composite field "${name}" has no place on a "no known allergy" item (it describes an allergen)`);
      continue;
    }
    if (prop != null) {
      if (prop.type !== spec.type) fail(`content property "${name}" of eventType "${et}" is not of type ${spec.type} (the renderer reads it by name)`);
      if (spec.enum != null && !sameEnum(prop.enum, spec.enum)) fail(`content property "${name}" of eventType "${et}": the enum must be exactly ${spec.enum.join(', ')}`);
    }
    if (field != null && field.type !== spec.field) fail(`composite field "${name}" is not a ${spec.field} field (the renderer reads it by name)`);
  }
  // Nor what names an allergen: a statement that there is none never carries one
  for (const name of ALLERGY_NONE_KNOWN_NO_ALLERGEN) {
    if (contentProperty(et, name) != null) fail(`eventType "${et}" of a "no known allergy" declares "${name}": a statement that there is no allergy names no allergen`);
    if (item.composite?.[name] != null) fail(`composite field "${name}" has no place on a "no known allergy" item (it names an allergen)`);
  }
  for (const [value, c] of Object.entries(f.code.codings)) {
    if (c.system !== SNOMED_SYSTEM) fail(`code.codings "${value}": ${c.system}|${c.code} is not a SNOMED CT code (a "no known allergy" is a SNOMED CT situation)`);
    if (value !== ALLERGY_NONE_KNOWN_ALL && !ALLERGY_FIELDS.categories.enum.includes(value)) fail(`code.codings "${value}": a scope is "${ALLERGY_NONE_KNOWN_ALL}" or an allergy category (${ALLERGY_FIELDS.categories.enum.join(', ')})`);
  }
}

/**
 * The `dosage` of a medication block names the regimen object (MEDICATION.md § The regimen) in the content of the
 * item's one eventType, and covers its two coded enums exactly: every `doseUnit` value renders in a UCUM code of its
 * own (compared as written: the annotation is the meaning of a count unit), every `route` value as one coding (or a
 * text when no active code exists), each once, so an imported dose unit or route maps back to one value.
 */
function checkDosage (item, f, itemEventTypes, fail, sameSet, unique) {
  const d = f.dosage;
  if (itemEventTypes.length !== 1) fail('"dosage" needs an item with exactly one eventType');
  const regimen = contentProperty(itemEventTypes[0], d.field);
  if (regimen == null) fail(`dosage.field "${d.field}" is not a content property of eventType "${itemEventTypes[0]}"`);
  const enumOf = (name) => {
    const p = regimen.type === 'object' ? regimen.properties?.[name] : undefined;
    if (p?.type !== 'string' || !Array.isArray(p.enum)) fail(`dosage.field "${d.field}" does not hold a regimen: no "${name}" enum (doseValue, doseUnit, route, frequency, …)`);
    return p.enum;
  };
  if (regimen.properties?.doseValue?.type !== 'number' || regimen.properties?.frequency?.type !== 'object') fail(`dosage.field "${d.field}" does not hold a regimen (doseValue, doseUnit, route, frequency, …)`);
  if (item.composite != null) {
    let def = { composite: item.composite };
    for (const s of d.field.split('.')) def = def?.composite?.[s];
    if (def?.type !== 'composite') fail(`dosage.field "${d.field}" is not a composite field of the composite`);
  }
  sameSet(`dosage.doseUnits keys vs the ${d.field}.doseUnit enum`, Object.keys(d.doseUnits), enumOf('doseUnit'));
  const codes = Object.values(d.doseUnits);
  if (new Set(codes).size !== codes.length) fail('dosage.doseUnits: two dose units share a UCUM code; an imported dose would map back to two units');
  sameSet(`dosage.routes keys vs the ${d.field}.route enum`, Object.keys(d.routes), enumOf('route'));
  const routeCodings = Object.values(d.routes).filter((r) => r.text == null);
  unique('dosage.routes', routeCodings);
  const texts = Object.values(d.routes).filter((r) => r.text != null).map((r) => r.text.toLowerCase());
  if (new Set(texts).size !== texts.length) fail('dosage.routes: two routes share a text; an imported route would map back to two values');
}

/**
 * A QuestionnaireResponse block (`[FHIR-MAP-26]`, QUESTIONNAIRE.md § FHIR) sits on a `system` item (no form field
 * writes an answer event) with one eventType whose content the renderer reads by name: `requestEventId`, a string,
 * names the questionnaire answered (`QuestionnaireResponse.questionnaire`), and `answers`, an object keyed by
 * question key, holds the answers (`item[]`). The block names neither, so it holds `resourceType` and `profiles`
 * only: no code (the resource has none), no value, nothing to split or ignore.
 */
function checkQuestionnaireResponse (item, f, itemEventTypes, fail) {
  const extra = Object.keys(f).filter((k) => k !== 'resourceType' && k !== 'profiles');
  if (extra.length > 0) fail(`a QuestionnaireResponse block holds "resourceType" and "profiles" only (the resource has no code and no value); remove ${extra.map((k) => `"${k}"`).join(', ')}`);
  if (item.type !== 'system') fail(`a QuestionnaireResponse block applies to a "system" item (an answer event is written by an app, not entered in a form field); item type is "${item.type}"`);
  if (itemEventTypes.length !== 1) fail('a QuestionnaireResponse block needs an item with exactly one eventType');
  const request = contentProperty(itemEventTypes[0], 'requestEventId');
  if (request?.type !== 'string') fail(`eventType "${itemEventTypes[0]}" has no string content property "requestEventId" (it renders as QuestionnaireResponse.questionnaire)`);
  const answers = contentProperty(itemEventTypes[0], 'answers');
  if (answers?.type !== 'object') fail(`eventType "${itemEventTypes[0]}" has no object content property "answers" (it renders as QuestionnaireResponse.item)`);
}

/**
 * A Questionnaire block (`[FHIR-MAP-27]`, QUESTIONNAIRE.md § FHIR) sits on a `system` item (no form field writes a
 * request event) with one eventType whose content the renderer reads by name: `questions`, an object keyed by
 * question key, each question an object with a `label` (an object of texts per language: `item.text`) and a string
 * `itemRef` (the HDS item coding of `item.code`). The block names none of them, so it holds `resourceType` and
 * `profiles` only: no code (the resource has none), no value, nothing to split or ignore.
 *
 * Also held, because a renderer that holds the block alone depends on them:
 * - the question keys follow `QUESTION_KEY_PATTERN` exactly: a key never holds a dot, so the child linkIds
 *   `<key>.references`, `<key>.qualifier` and `<key>.reason` never collide with a question's (R4 que-2);
 * - a declared `subField` is an object whose `type` enum is `QUESTIONNAIRE_SUB_FIELD_TYPES` exactly: the renderer
 *   refuses a request with a type it does not know, so a new type is added here and in the renderer first;
 * - its `options`, when declared, are an array whose `value` types are `QUESTIONNAIRE_OPTION_VALUE_TYPES` exactly: the
 *   renderer refuses a request holding an option value of another type;
 * - `title` and `description`, when declared, are objects (texts per language), and `templateRef` a string.
 */
function checkQuestionnaire (item, f, itemEventTypes, fail) {
  const extra = Object.keys(f).filter((k) => k !== 'resourceType' && k !== 'profiles');
  if (extra.length > 0) fail(`a Questionnaire block holds "resourceType" and "profiles" only (the resource has no code and no value); remove ${extra.map((k) => `"${k}"`).join(', ')}`);
  if (item.type !== 'system') fail(`a Questionnaire block applies to a "system" item (a request event is written by an app, not entered in a form field); item type is "${item.type}"`);
  if (itemEventTypes.length !== 1) fail('a Questionnaire block needs an item with exactly one eventType');
  const questions = contentProperty(itemEventTypes[0], 'questions');
  const question = questions?.type === 'object' ? questions.additionalProperties : undefined;
  if (question?.type !== 'object') fail(`eventType "${itemEventTypes[0]}" has no object content property "questions" whose entries are objects (they render as Questionnaire.item)`);
  if (question.properties?.label?.type !== 'object') fail(`eventType "${itemEventTypes[0]}": a question has no object "label" (it renders as Questionnaire.item.text)`);
  if (question.properties?.itemRef?.type !== 'string') fail(`eventType "${itemEventTypes[0]}": a question has no string "itemRef" (it renders as Questionnaire.item.code)`);
  if (questions.propertyNames?.pattern !== QUESTION_KEY_PATTERN) fail(`eventType "${itemEventTypes[0]}": the keys of "questions" must follow exactly ${QUESTION_KEY_PATTERN} (a key without a dot keeps the child linkIds <key>.references, <key>.qualifier and <key>.reason distinct)`);
  const subField = question.properties?.subField;
  if (subField != null) {
    if (subField.type !== 'object') fail(`eventType "${itemEventTypes[0]}": a question's "subField" is not an object (it renders as the item <key>.qualifier)`);
    const types = subField.properties?.type?.enum;
    const same = Array.isArray(types) && types.length === QUESTIONNAIRE_SUB_FIELD_TYPES.length && QUESTIONNAIRE_SUB_FIELD_TYPES.every((t) => types.includes(t));
    if (!same) fail(`eventType "${itemEventTypes[0]}": the "subField.type" enum must be exactly ${QUESTIONNAIRE_SUB_FIELD_TYPES.join(', ')} (the renderer refuses a request with a type it does not know: add the type to QUESTIONNAIRE_SUB_FIELD_TYPES and to the renderer first)`);
    const options = subField.properties?.options;
    if (options != null) {
      if (options.type !== 'array') fail(`eventType "${itemEventTypes[0]}": a question's "subField.options" is not an array (the renderer reads a list of options)`);
      const declared = options.items?.properties?.value?.type;
      const valueTypes = Array.isArray(declared) ? declared : [declared];
      const sameValues = valueTypes.length === QUESTIONNAIRE_OPTION_VALUE_TYPES.length && QUESTIONNAIRE_OPTION_VALUE_TYPES.every((t) => valueTypes.includes(t));
      if (!sameValues) fail(`eventType "${itemEventTypes[0]}": the option "value" types of "subField.options" must be exactly ${QUESTIONNAIRE_OPTION_VALUE_TYPES.join(', ')} (the renderer refuses a request holding an option value of another type: add the type to QUESTIONNAIRE_OPTION_VALUE_TYPES and to the renderer first)`);
    }
  }
  for (const name of ['title', 'description']) {
    const p = contentProperty(itemEventTypes[0], name);
    if (p != null && p.type !== 'object') fail(`content property "${name}" of eventType "${itemEventTypes[0]}" is not an object of texts per language (it renders as Questionnaire.${name})`);
  }
  const templateRef = contentProperty(itemEventTypes[0], 'templateRef');
  if (templateRef != null && templateRef.type !== 'string') fail(`content property "templateRef" of eventType "${itemEventTypes[0]}" is not a string (it renders as Questionnaire.derivedFrom)`);
}

/** The `product.system` enum of a coded medication (`drug.product`, MEDICATION.md § National products) is covered by `fhirMapping.productSystems`. */
function checkProductSystems (field, itemEventTypes, fail) {
  const system = contentProperty(itemEventTypes[0], `${field}.product.system`);
  if (system == null) return;
  const known = Object.keys(fhirMapping.productSystems || {});
  const missing = (system.enum || []).filter((s) => !known.includes(s));
  if (missing.length > 0) fail(`${field}.product.system admits ${missing.join(', ')}, which definitions/fhir/mapping.yaml productSystems gives no URI for`);
}

/**
 * The SMART scope key an item's events fall under, or `(unmapped)`: `ResourceType|category` for a resourceType with
 * a category table, the bare resourceType otherwise (`Patient`).
 */
function scopePairOf (key, items) {
  let f = items[key]?.fhir;
  if (f?.companionOf != null) f = items[f.companionOf]?.fhir;
  if (f == null || f.companionOf != null) return UNMAPPED;
  return f.category != null ? `${f.resourceType}|${f.category}` : f.resourceType;
}

/** Parent and descendants of every stream of a tree. */
function streamIndex (roots) {
  const parentOf = new Map();
  const childrenOf = new Map();
  const index = (node, parentId) => {
    parentOf.set(node.id, parentId);
    childrenOf.set(node.id, (node.children ?? []).map((c) => c.id));
    for (const c of node.children ?? []) index(c, node.id);
  };
  for (const r of roots) index(r, null);
  const ancestorsOf = (id) => {
    const out = [];
    for (let s = parentOf.get(id); s != null; s = parentOf.get(s)) out.push(s);
    return out;
  };
  const descendantsOf = (id) => [id, ...(childrenOf.get(id) ?? []).flatMap(descendantsOf)];
  return { parentOf, ancestorsOf, descendantsOf };
}

/**
 * The SMART scope grant table. Pryv permissions inherit down the stream tree, so granting a stream grants its whole
 * subtree. A scope is granted as **minimal roots**: the own stream of each mapped item of that pair (a companion
 * rides under its parent item's stream, which it sits inside), never an ancestor that merely holds them, so a stream
 * added next to a mapped item later never joins a grant already issued. A listed stream inside another listed stream
 * of the same pair is left out. A deprecated mapped item keeps its stream in the table: its past events are there.
 *
 * The invariant: every stream that carries a mapped or companion item has a subtree holding that one pair. Every item
 * counts: an active item without a block is its own `(unmapped)` pair, and a deprecated item counts with its mapping
 * or as unmapped.
 *
 * @param {object} items item key → item
 * @param {Array} roots the stream tree (defaults to the model's)
 * @returns {{ grants: object, subtree: Map<string, Set<string>>, violations: string[] }}
 */
function computeFhirScopes (items, roots = streams.roots) {
  const own = new Map();
  const carriesMapped = new Set();
  for (const [key, item] of Object.entries(items)) {
    const set = own.get(item.streamId) ?? new Set();
    set.add(scopePairOf(key, items));
    own.set(item.streamId, set);
    if (item.fhir != null) carriesMapped.add(item.streamId);
  }

  const subtree = new Map();
  const walk = (node) => {
    const acc = new Set(own.get(node.id) ?? []);
    for (const c of node.children ?? []) for (const p of walk(c)) acc.add(p);
    subtree.set(node.id, acc);
    return acc;
  };
  for (const r of roots) walk(r);

  const { ancestorsOf } = streamIndex(roots);
  const grants = {};
  for (const [key, item] of Object.entries(items)) {
    if (item.fhir == null || item.fhir.companionOf != null) continue;
    if (subtree.get(item.streamId)?.size !== 1) continue; // a violation, reported below
    (grants[scopePairOf(key, items)] ??= new Set()).add(item.streamId);
  }
  const sorted = {};
  for (const p of Object.keys(grants).sort()) {
    const listed = grants[p];
    sorted[p] = [...listed].filter((s) => !ancestorsOf(s).some((a) => listed.has(a))).sort();
  }

  const violations = [...carriesMapped].sort()
    .filter((s) => subtree.get(s)?.size > 1)
    .map((s) => `stream "${s}" carries a mapped or companion item but its subtree spans ${[...subtree.get(s)].sort().join(', ')}; granting it would over-grant`);
  return { grants: sorted, subtree, violations };
}

/**
 * Every check that needs all items loaded: companion blocks, the one-pair invariant, the scope lock (a published
 * stream is never removed, re-parented, given another pair or a new item unacknowledged) and the import match keys.
 * Returns the grant table.
 *
 * @param {object} items item key → item
 * @param {object} [opts] `{ roots, lock }` for tests; default the model's stream tree and the committed lock
 */
function checkFhirScopes (items, { roots = streams.roots, lock = readLock() } = {}) {
  const { parentOf } = streamIndex(roots);
  const inSubtree = (id, rootId) => {
    for (let s = id; s != null; s = parentOf.get(s)) if (s === rootId) return true;
    return false;
  };

  for (const [key, item] of Object.entries(items)) {
    const parentKey = item.fhir?.companionOf;
    if (parentKey == null) continue;
    const parent = items[parentKey];
    const fail = (msg) => { throw new Error(`item "${key}" fhir.companionOf "${parentKey}": ${msg}`); };
    if (parent == null) fail('no such item');
    if (parent.fhir == null || parent.fhir.companionOf != null) fail('the parent must carry a mapping');
    if (parent.fhir.element != null) fail('the parent is a Patient element; a companion qualifies a resource mapping');
    if (!inSubtree(item.streamId, parent.streamId)) fail(`stream "${item.streamId}" is not inside the parent's stream subtree "${parent.streamId}"`);
  }

  const { grants, subtree, violations } = computeFhirScopes(items, roots);
  if (violations.length > 0) throw new Error(`fhir scope invariant:\n  ${violations.join('\n  ')}`);
  checkConsentOptInPlacement(grants, roots);
  checkLock(items, checkedLock(lock), subtree, parentOf);
  checkFixedCodedFamilies(items);
  checkFhirImportKeys(items, roots);
  return grants;
}

/**
 * The `fixed-coded` blocks, with every item loaded (FHIR-MAPPING.md § Value kinds, § Import; plan 133 activity):
 * - every block sharing a code has one category: the code is the family's question, never an import key
 *   (checkFhirImportKeys), and the value names the item;
 * - per stream, at most one item carries a component;
 * - the component's `absent` names the presence twin: another item on the same stream, eventType `activity/plain`,
 *   whose block is `fixed-coded` without a component, with the same code, category, codings, alsoMatch and effective. A resource
 *   without the component imports into it, deprecated or not: the one deprecated import target.
 */
function checkFixedCodedFamilies (items) {
  const categoryOf = new Map();
  const withComponent = new Map();
  for (const [key, item] of Object.entries(items)) {
    const f = item.fhir;
    if (f?.value?.kind !== 'fixed-coded') continue;
    const fail = (msg) => { throw new Error(`item "${key}" fhir: ${msg}`); };
    const code = `${f.code.system}|${f.code.code}`;
    const other = categoryOf.get(code);
    if (other != null && other.category !== f.category) fail(`the fixed-coded code ${code} is "${other.key}"'s under category "${other.category}": every block sharing it has one category`);
    if (other == null) categoryOf.set(code, { category: f.category, key });
    const c = f.value.component;
    if (c == null) continue;
    const sibling = withComponent.get(item.streamId);
    if (sibling != null) fail(`stream "${item.streamId}" already holds "${sibling}", a fixed-coded block with a component: one per stream`);
    withComponent.set(item.streamId, key);
    const at = `value.component.absent "${c.absent}"`;
    const twin = items[c.absent];
    if (twin == null) fail(`${at}: no such item`);
    if (c.absent === key) fail(`${at} is the item itself`);
    if (twin.streamId !== item.streamId) fail(`${at} is on stream "${twin.streamId}", not on "${item.streamId}": the presence twin shares the stream`);
    if (twin.eventType !== PRESENCE_EVENT_TYPE || twin.variations?.eventType != null) fail(`${at} has eventType "${twin.eventType}": the presence twin is "${PRESENCE_EVENT_TYPE}" (no content)`);
    const t = twin.fhir;
    if (t?.value?.kind !== 'fixed-coded' || t.value.component != null) fail(`${at} must carry a fixed-coded block without a component`);
    if (!isDeepStrictEqual(t.code, f.code) || t.category !== f.category) fail(`${at} must carry the same code and category`);
    if (!isDeepStrictEqual(t.value.codings, f.value.codings) || !isDeepStrictEqual(t.value.alsoMatch ?? [], f.value.alsoMatch ?? [])) fail(`${at} must carry the same value.codings and value.alsoMatch`);
    if (!isDeepStrictEqual(t.effective, f.effective)) fail(`${at} must carry the same "effective"`);
  }
}

/**
 * A `consentOptIn` stream is offered unticked by a SMART consent, so it must be a row of one: a grant root of a scope
 * key. It is refused under an `explicitGrantOnly` root (already offered unticked, and also kept out of `*`) and under
 * another `consentOptIn` stream (the outer one already holds it). See FHIR-MAPPING.md § SMART scopes.
 */
function checkConsentOptInPlacement (grants, roots) {
  const granted = new Set(Object.values(grants).flat());
  const visit = (node, ancestors) => {
    if (node.consentOptIn === true) {
      const at = `stream "${node.id}" is consentOptIn`;
      const explicit = [node, ...ancestors].find((s) => s.explicitGrantOnly === true);
      if (explicit != null) throw new Error(`${at} but sits under the explicitGrantOnly root "${explicit.id}", which a consent already offers unticked`);
      const outer = ancestors.find((s) => s.consentOptIn === true);
      if (outer != null) throw new Error(`${at} but sits under the consentOptIn stream "${outer.id}", which already holds it`);
      if (!granted.has(node.id)) throw new Error(`${at} but is not a grant root of any fhirScopes key: no SMART consent offers it as a row`);
    }
    for (const c of node.children ?? []) visit(c, [node, ...ancestors]);
  };
  for (const r of roots) visit(r, []);
}

/**
 * The lock records every stream a published grant reaches (each grant root and its whole subtree) with its pair, its
 * parent and the items on it. A grant already issued must never reach more than it did, nor silently less. So the
 * build fails when a locked stream is removed, is re-parented, holds another pair in its subtree, or loses an item
 * (removed, or moved to another stream: deprecate instead), and when a stream or an item that is not in the lock
 * appears on a locked stream or under one, unless the lock's `reviewed` list acknowledges it under that locked stream.
 */
function checkLock (items, lock, subtree, parentOf) {
  for (const kind of ['items', 'streams']) {
    for (const [id, r] of Object.entries(lock.reviewed[kind])) {
      const at = `fhir scope lock: reviewed ${kind} "${id}"`;
      if (kind === 'items' ? items[id] == null : !subtree.has(id)) throw new Error(`${at} is not ${kind === 'items' ? 'an item' : 'a stream'}`);
      if (typeof r?.under !== 'string' || lock.streams[r.under] == null) throw new Error(`${at}: "under" must name a locked stream`);
      // On or above where it sits now: an entry written for another placement never pre-approves a later move.
      const above = kind === 'items' ? [items[id].streamId, ...ancestorsIn(parentOf, items[id].streamId)] : ancestorsIn(parentOf, id);
      if (!above.includes(r.under)) throw new Error(`${at}: "under" is "${r.under}", which is not ${kind === 'items' ? 'its stream nor ' : ''}above it`);
      if (typeof r.why !== 'string' || !/^\d{4}-\d{2}-\d{2} \S/.test(r.why)) throw new Error(`${at}: "why" must read "YYYY-MM-DD <why>"`);
    }
  }
  const reviewedUnder = (kind, id, locked) => lock.reviewed[kind][id]?.under === locked;
  for (const [id, e] of Object.entries(lock.streams)) {
    const at = `fhir scope lock: stream "${id}", published under ${e.pair},`;
    if (!subtree.has(id)) throw new Error(`${at} is no longer a stream`);
    const parent = parentOf.get(id) ?? null;
    if (parent !== e.parent) throw new Error(`${at} was a child of "${e.parent}" and is now a child of "${parent}": a published stream is never re-parented`);
    const other = [...subtree.get(id)].filter((p) => p !== e.pair);
    if (other.length > 0) throw new Error(`${at} now also holds ${other.sort().join(', ')} in its subtree, which would widen every grant already issued`);
    for (const key of e.items) {
      const item = items[key];
      if (item == null) throw new Error(`${at} held item "${key}", which is gone: an item on a published stream is deprecated, never removed`);
      if (item.streamId !== id) throw new Error(`${at} held item "${key}", which is now on stream "${item.streamId}": its past events stay where they are`);
    }
  }
  // A stream added or moved under a locked stream: every grant already issued reads its subtree.
  for (const id of parentOf.keys()) {
    if (lock.streams[id] != null) continue;
    const locked = ancestorsIn(parentOf, id).find((s) => lock.streams[s] != null);
    if (locked == null || reviewedUnder('streams', id, locked)) continue;
    const pair = lock.streams[locked].pair;
    throw new Error(`fhir scope lock: stream "${id}" is new under the published stream "${locked}": every grant already issued for ${pair} would read it. If a reader of ${pair} may see it, acknowledge it in definitions/fhir/scopes.lock.json, "reviewed": { "streams": { "${id}": { "under": "${locked}", "why": "YYYY-MM-DD <why>" } } }, then run npm run fhir:lock`);
  }
  for (const [key, item] of Object.entries(items)) {
    if (lock.streams[item.streamId]?.items.includes(key)) continue;
    const locked = [item.streamId, ...ancestorsIn(parentOf, item.streamId)].find((s) => lock.streams[s] != null);
    if (locked == null || reviewedUnder('items', key, locked)) continue;
    const pair = lock.streams[locked].pair;
    throw new Error(`fhir scope lock: item "${key}" is new under the published stream "${locked}": every grant already issued for ${pair} would read it. If a reader of ${pair} may see it, acknowledge it in definitions/fhir/scopes.lock.json, "reviewed": { "items": { "${key}": { "under": "${locked}", "why": "YYYY-MM-DD <why>" } } }, then run npm run fhir:lock`);
  }
}

function ancestorsIn (parentOf, id) {
  const out = [];
  for (let s = parentOf.get(id); s != null; s = parentOf.get(s)) out.push(s);
  return out;
}

/**
 * Import match keys are unique across active items: a resource matches an item by (resourceType, static code, an
 * eventType's or an enum value's code, or alsoMatch coding), or by (resourceType, category, datasource or content code source) for each
 * category the block accepts (its own and its `alsoMatchCategories`), and must match one item only. A LOINC import key is never a
 * code another active item owns (`references.loinc` or `references.loincMethod`, `[LABC-LOINC-1]`). A Patient element
 * is claimed by one active item only, so an imported Patient places each element in one item. A resource that states
 * no category can still fit two datasource-coded items of different categories; the importer reports that as
 * ambiguous rather than guess. A `fixed-coded` block is matched by (resourceType, code, value coding): its code is
 * reserved, never an import key of any item, and its value codings are the keys, claimed by the item with a component
 * for itself and the presence twin it names (the one deprecated import target, FHIR-MAPPING.md § Import).
 */
function checkFhirImportKeys (items, roots = streams.roots) {
  const seen = new Map();
  const claim = (k, key) => {
    const other = seen.get(k);
    if (other != null && other !== key) throw new Error(`fhir import key ${k} is claimed by both "${other}" and "${key}"; an imported resource would match two items`);
    seen.set(k, key);
  };
  const owner = new Map();
  for (const [key, item] of Object.entries(items)) {
    if (item.deprecated) continue;
    for (const c of [...(item.references?.loinc || []), ...(item.references?.loincMethod || [])]) {
      if (owner.has(c) && owner.get(c) !== key) throw new Error(`LOINC ${c} is owned by both "${owner.get(c)}" and "${key}" (references.loinc or loincMethod); one code has one owner`);
      owner.set(c, key);
    }
  }
  const claimCoding = (f, c, key) => {
    const o = c.system === LOINC_SYSTEM ? owner.get(c.code) : undefined;
    if (o != null && o !== key) throw new Error(`fhir import key ${f.resourceType} ${c.system}|${c.code} of "${key}" is a LOINC code item "${o}" owns`);
    claim(`${f.resourceType} ${c.system}|${c.code}`, key);
  };
  // A fixed-coded code is the question a family shares (plan 133 activity): never an import key of any item. The
  // presence twins a component names claim nothing: the item with the component claims the value keys for both.
  const reserved = new Map();
  const twinned = new Set();
  for (const [key, item] of Object.entries(items)) {
    const f = item.fhir;
    if (f?.value?.kind !== 'fixed-coded') continue;
    const k = `${f.resourceType} ${f.code.system}|${f.code.code}`;
    if (!reserved.has(k)) reserved.set(k, key);
    if (f.value.component != null) twinned.add(f.value.component.absent);
  }
  for (const [key, item] of Object.entries(items)) {
    const f = item.fhir;
    if (item.deprecated || f == null || f.companionOf != null) continue;
    if (f.value?.kind === 'fixed-coded') {
      // Matched by (resourceType, code, value coding): each value coding and value alsoMatch coding is a key.
      if (f.value.component == null && twinned.has(key)) continue;
      for (const c of [...f.value.codings, ...(f.value.alsoMatch || [])]) claim(`${f.resourceType} ${f.code.system}|${f.code.code} value ${c.system}|${c.code}`, key);
    } else if (f.element != null) {
      claim(`${f.resourceType}.${f.element}`, key);
    } else if (f.resourceType === QUESTIONNAIRE_RESPONSE_TYPE || f.resourceType === QUESTIONNAIRE_TYPE) {
      // No code to match on: a QuestionnaireResponse, or a Questionnaire, goes to the one item that maps the resourceType.
      // A Questionnaire is never imported: its claim is kept so the refusal names one item, and it can be lifted when
      // a second item maps the type.
      claim(f.resourceType, key);
    } else if (f.code.from === 'concept') {
      // The code is per event and nothing in a resource names the specimen for sure, so a concept-coded item (one per
      // specimen) claims no import key and is never matched by code or category: the importer is told the item
      // (FHIR-MAPPING.md § Import), or reads it back from the `meta.tag` of an HDS export.
      continue;
    } else if (f.status?.from === 'span') {
      // Nothing in a Procedure tells a course from one act (not its code, not the shape of its date), so a treatment
      // item claims no import key either: the importer is told the item, or reads it back from the `meta.tag` of an
      // HDS export. Any other Procedure is a procedure.
      continue;
    } else if (f.code.from === 'datasource' || f.code.from === 'content' || f.code.from === 'text') {
      // The resource's code is content, so the item is matched by (resourceType, category) alone: one per category
      // and per source (a coded medicine goes to the datasource item, a name alone to the text item).
      for (const c of [f.category, ...(f.alsoMatchCategories || [])]) {
        claim(`${f.resourceType}${c != null ? `|${c}` : ''} from ${f.code.from}`, key);
      }
    } else {
      const own = f.code.from === 'eventType' || f.code.from === 'enum' ? Object.values(f.code.codings) : [f.code];
      for (const c of [...own, ...alsoMatchCodingsOf(f)]) claimCoding(f, c, key);
    }
  }
  for (const [k, key] of reserved) {
    if (seen.has(k)) throw new Error(`fhir import key ${k} of "${seen.get(k)}" is the fixed-coded code of "${key}": that code is the question a family shares, never an import key`);
  }
  // An emitted-only coding (`alsoEmit`) is never an import key, and never a code that would make the rendered resource
  // match another item on its way back: no item's import key, no LOINC code another item owns. One exception (plan
  // 133): the code of a **more general item**, one whose stream is a strict ancestor of the emitter's, in the same scope
  // pair (the basal body temperature emits body-temperature's 8310-5). The rendered resource then matches both; of
  // several items a resource matches by code, the importer picks the one that also emits every code of the others that
  // the resource carries, the more specific one (FHIR-MAPPING.md § Import). Deprecated items are never in `seen` or
  // `owner`, so `other` is active.
  const { parentOf } = streamIndex(roots);
  const isMoreGeneral = (other, key) => {
    const o = items[other];
    const e = items[key];
    if (o?.streamId == null || e?.streamId == null) return false;
    if (!ancestorsIn(parentOf, e.streamId).includes(o.streamId)) return false;
    return scopePairOf(other, items) === scopePairOf(key, items);
  };
  const refuse = (k, key, other, what) => {
    const why = items[other]?.streamId != null && items[key]?.streamId != null && ancestorsIn(parentOf, items[key].streamId).includes(items[other].streamId)
      ? `"${other}" is another scope pair`
      : `it is allowed only from an item whose stream is under "${other}"'s stream, in the same scope pair`;
    throw new Error(`fhir alsoEmit ${k} of "${key}" is ${what}; ${why}`);
  };
  for (const [key, item] of Object.entries(items)) {
    const f = item.fhir;
    if (item.deprecated || f?.alsoEmit == null) continue;
    for (const c of f.alsoEmit) {
      const k = `${f.resourceType} ${c.system}|${c.code}`;
      const s = seen.get(k);
      if (s != null && !isMoreGeneral(s, key)) refuse(k, key, s, `an import key of "${s}" (the rendered resource would import back into it)`);
      const o = c.system === LOINC_SYSTEM ? owner.get(c.code) : undefined;
      if (o != null && o !== key && !isMoreGeneral(o, key)) refuse(k, key, o, `a LOINC code item "${o}" owns`);
    }
  }
}

function emptyLock () {
  return { formatVersion: LOCK_FORMAT, streams: {}, reviewed: { items: {}, streams: {} } };
}

/**
 * The committed lock, `{ formatVersion, streams: { <streamId>: { pair, parent, items } }, reviewed: { items:
 * { <item key>: { under, why } }, streams: { <streamId>: { under, why } } } }`: every stream a published grant
 * reaches, ever, and each acknowledgement of a new item or stream under the locked stream `under`, with
 * `why` = "YYYY-MM-DD <why>". An absent file is an empty lock.
 */
function readLock () {
  if (!fs.existsSync(LOCK_FILE_PATH)) return emptyLock();
  return checkedLock(JSON.parse(fs.readFileSync(LOCK_FILE_PATH, 'utf8')));
}

function checkedLock (lock) {
  if (lock.formatVersion !== LOCK_FORMAT) throw new Error(`definitions/fhir/scopes.lock.json: formatVersion ${lock.formatVersion}, this build reads ${LOCK_FORMAT}`);
  const reviewed = lock.reviewed ?? {};
  const unknown = Object.keys(reviewed).filter((k) => k !== 'items' && k !== 'streams');
  if (unknown.length > 0) throw new Error(`definitions/fhir/scopes.lock.json: "reviewed" holds "items" and "streams" only, not ${unknown.map((k) => `"${k}"`).join(', ')}`);
  return { ...emptyLock(), ...lock, reviewed: { items: reviewed.items ?? {}, streams: reviewed.streams ?? {} } };
}

/**
 * What the lock records for a grant table: each grant root and every stream in its subtree, with the root's pair,
 * the stream's parent and the items on it (sorted keys).
 *
 * @param {object} items item key → item
 * @param {object} grants the grant table (`computeFhirScopes(...).grants`)
 * @param {Array} roots the stream tree (defaults to the model's)
 */
function lockEntries (items, grants, roots = streams.roots) {
  const { parentOf, descendantsOf } = streamIndex(roots);
  const out = {};
  for (const [pair, grantRoots] of Object.entries(grants)) {
    for (const root of grantRoots) {
      for (const id of descendantsOf(root)) {
        const on = Object.entries(items).filter(([, i]) => i.streamId === id).map(([k]) => k).sort();
        out[id] = { pair, parent: parentOf.get(id) ?? null, items: on };
      }
    }
  }
  return out;
}

/**
 * Add lock entries to a lock. Never removes a stream or an item, never rewrites a pair or a parent (the build has
 * already refused a change), and keeps the hand-written `reviewed` list.
 */
function mergeLock (lock, entries) {
  const out = {};
  for (const id of [...new Set([...Object.keys(lock.streams), ...Object.keys(entries)])].sort()) {
    const was = lock.streams[id];
    const now = entries[id];
    out[id] = was == null ? now : { ...was, items: [...new Set([...was.items, ...(now?.items ?? [])])].sort() };
  }
  return { formatVersion: LOCK_FORMAT, streams: out, reviewed: lock.reviewed ?? emptyLock().reviewed };
}

function toBePublished (grants) {
  return [{
    title: 'FHIR SMART scope grants',
    path: './fhir/',
    filename: 'scopes.json',
    type: 'json',
    content: grants,
    includeInPack: 'fhirScopes'
  }, {
    title: 'FHIR mapping tables',
    path: './fhir/',
    filename: 'mapping.json',
    type: 'json',
    content: fhirMapping,
    includeInPack: 'fhirMapping'
  }];
}
