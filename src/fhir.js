const YAML = require('yaml');
const fs = require('fs');
const path = require('path');

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

module.exports = {
  fhirMapping,
  UNMAPPED,
  PATIENT_ELEMENTS,
  LOCK_FILE_PATH,
  checkFhirMapping,
  scopePairOf,
  computeFhirScopes,
  checkFhirScopes,
  checkFhirImportKeys,
  readLock,
  mergeLock,
  toBePublished
};

function checkMappingTable (t) {
  const fail = (msg) => { throw new Error(`definitions/fhir/mapping.yaml: ${msg}`); };
  if (!Number.isInteger(t.formatVersion)) fail('formatVersion must be an integer');
  if (typeof t.fhirVersion !== 'string') fail('fhirVersion must be a string');
  for (const [flavour, ig] of Object.entries(t.flavours || {})) {
    if (!/^[a-z0-9.-]+#\d+\.\d+\.\d+$/.test(ig)) fail(`flavour "${flavour}": "${ig}" is not package#version`);
  }
  for (const [resourceType, table] of Object.entries(t.categories || {})) {
    for (const [key, c] of Object.entries(table)) {
      if (!/^(https?:|urn:)/.test(c.system) || !c.code || !c.display) fail(`category ${resourceType}/${key} needs a canonical system, a code and a display`);
    }
  }
  const uris = Object.values(t.systems || {});
  for (const uri of uris) if (!/^(https?:|urn:)/.test(uri)) fail(`system "${uri}" is not a canonical URI`);
  if (new Set(uris).size !== uris.length) fail('systems: one label per URI, so an imported coding maps back to one label');
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

  const composite = item.composite;
  const mappedFields = new Set();
  const isDatasourceCode = f.code.from != null;
  if (isDatasourceCode) {
    checkDatasourceField(item, f.code.field, itemEventTypes, fail);
    if (f.alsoMatch != null) fail('"alsoMatch" applies to a static code only');
    mappedFields.add(f.code.field.split('.')[0]);
  } else {
    unique('code and alsoMatch', [f.code, ...(f.alsoMatch || [])]);
  }

  if (f.resourceType === 'Condition' && f.value != null) fail('a Condition has no value[x]; remove "value"');

  const numericField = (what, k) => {
    const field = composite?.[k];
    if (field == null) fail(`${what} "${k}" is not a composite field`);
    if (field.type !== 'number' && field.type !== 'slider') fail(`${what} "${k}" must be a numeric composite field, it is "${field.type}"`);
  };

  const v = f.value;
  const ownCodings = isDatasourceCode ? [] : [f.code];
  if (v != null) {
    switch (v.kind) {
      case 'quantity':
        if (item.type !== 'number') fail('value.kind "quantity" applies to "number" items only');
        sameSet('value.units keys vs the item eventTypes', Object.keys(v.units), itemEventTypes);
        for (const t of itemEventTypes) {
          if (eventTypesById(t)?.type !== 'number') fail(`value.kind "quantity": eventType "${t}" is not a number`);
        }
        break;
      case 'coded':
        if (item.type === 'multi-select') fail('value.kind "coded" on a multi-select is not supported: one resource with several answer codings would misstate the answer');
        if (item.type !== 'select') fail('value.kind "coded" applies to "select" items only');
        sameSet('value.options keys vs the item options', Object.keys(v.options), item.options.map((o) => String(o.value)));
        unique('value.options', Object.values(v.options));
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

  for (const k of f.ignore || []) {
    if (composite?.[k] == null) fail(`ignore "${k}" is not a composite field`);
    if (mappedFields.has(k)) fail(`field "${k}" is both mapped and ignored`);
  }
  for (const k of Object.keys(composite || {})) {
    if (!mappedFields.has(k) && !(f.ignore || []).includes(k)) fail(`composite field "${k}" is neither mapped nor listed in "ignore"`);
  }
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
  sameSet('value.options keys vs the item options', Object.keys(f.value.options), item.options.map((o) => String(o.value)));
  unique('value.options', Object.values(f.value.options));
  for (const [option, c] of Object.entries(f.value.options)) {
    if (c.system !== spec.codes.system || spec.codes.displays[c.code] !== c.display) {
      fail(`option "${option}": ${c.system}|${c.code} "${c.display}" is not a code of ${spec.codes.system} with its display`);
    }
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
 * The SMART scope key an item's events fall under, or `(unmapped)`: `ResourceType|category` for a resourceType with
 * a category table, the bare resourceType otherwise (`Patient`).
 */
function scopePairOf (key, items) {
  let f = items[key]?.fhir;
  if (f?.companionOf != null) f = items[f.companionOf]?.fhir;
  if (f == null || f.companionOf != null) return UNMAPPED;
  return f.category != null ? `${f.resourceType}|${f.category}` : f.resourceType;
}

/**
 * The SMART scope grant table. Pryv permissions inherit down the stream tree, so a scope is granted as the maximal
 * stream subtree roots whose whole subtree holds that one pair. Every item counts: an active item without a block is
 * its own `(unmapped)` pair, and a deprecated item counts with its mapping or as unmapped, because its past events
 * still sit in its stream. Streams with no item in their subtree are never granted on their own.
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

  const grants = {};
  const visit = (node) => {
    const pairs = subtree.get(node.id);
    if (pairs.size === 0) return;
    if (pairs.size === 1) {
      const [p] = pairs;
      if (p !== UNMAPPED) (grants[p] ??= []).push(node.id);
      return;
    }
    for (const c of node.children ?? []) visit(c);
  };
  for (const r of roots) visit(r);

  const sorted = {};
  for (const p of Object.keys(grants).sort()) sorted[p] = grants[p].sort();

  const violations = [...carriesMapped].sort()
    .filter((s) => subtree.get(s)?.size > 1)
    .map((s) => `stream "${s}" carries a mapped or companion item but its subtree spans ${[...subtree.get(s)].sort().join(', ')}; granting it would over-grant`);
  return { grants: sorted, subtree, violations };
}

/**
 * Every check that needs all items loaded: companion blocks, the one-pair-per-granted-subtree invariant, the scope
 * lock (a published grant root never widens) and the import match keys. Returns the grant table.
 *
 * @param {object} items item key → item
 * @param {object} [opts] `{ roots, lock }` for tests; default the model's stream tree and the committed lock
 */
function checkFhirScopes (items, { roots = streams.roots, lock = readLock() } = {}) {
  const parentOf = new Map();
  const index = (node, parentId) => {
    parentOf.set(node.id, parentId);
    for (const c of node.children ?? []) index(c, node.id);
  };
  for (const r of roots) index(r, null);
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

  for (const [pair, lockedRoots] of Object.entries(lock)) {
    for (const root of lockedRoots) {
      const pairs = subtree.get(root);
      if (pairs == null) throw new Error(`fhir scope lock: "${root}" was published as a grant root of ${pair} and is no longer a stream`);
      const other = [...pairs].filter((p) => p !== pair);
      if (other.length > 0) throw new Error(`fhir scope lock: "${root}" was published as a grant root of ${pair}; its subtree now also holds ${other.sort().join(', ')}, which would widen every grant already issued`);
    }
  }

  checkFhirImportKeys(items);
  return grants;
}

/**
 * Import match keys are unique across active items: a resource matches an item by (resourceType, static code or
 * alsoMatch coding), or by (resourceType, datasource code source), and must match one item only. A Patient element
 * is claimed by one active item only, so an imported Patient places each element in one item.
 */
function checkFhirImportKeys (items) {
  const seen = new Map();
  const claim = (k, key) => {
    const other = seen.get(k);
    if (other != null && other !== key) throw new Error(`fhir import key ${k} is claimed by both "${other}" and "${key}"; an imported resource would match two items`);
    seen.set(k, key);
  };
  for (const [key, item] of Object.entries(items)) {
    const f = item.fhir;
    if (item.deprecated || f == null || f.companionOf != null) continue;
    if (f.element != null) {
      claim(`${f.resourceType}.${f.element}`, key);
    } else if (f.code.from != null) {
      claim(`${f.resourceType} from ${f.code.from}`, key);
    } else {
      for (const c of [f.code, ...(f.alsoMatch || [])]) claim(`${f.resourceType} ${c.system}|${c.code}`, key);
    }
  }
}

/** The committed lock: every (pair, root) ever published. An absent file is an empty lock. */
function readLock () {
  if (!fs.existsSync(LOCK_FILE_PATH)) return {};
  return JSON.parse(fs.readFileSync(LOCK_FILE_PATH, 'utf8'));
}

/** Add a grant table to a lock. Never removes an entry. */
function mergeLock (lock, grants) {
  const out = {};
  for (const pair of [...new Set([...Object.keys(lock), ...Object.keys(grants)])].sort()) {
    out[pair] = [...new Set([...(lock[pair] || []), ...(grants[pair] || [])])].sort();
  }
  return out;
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
