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

/** Format of definitions/fhir/scopes.lock.json this build reads and writes. */
const LOCK_FORMAT = 2;

module.exports = {
  fhirMapping,
  UNMAPPED,
  PATIENT_ELEMENTS,
  LOCK_FILE_PATH,
  LOCK_FORMAT,
  checkMappingTable,
  checkFhirMapping,
  scopePairOf,
  ucumKey,
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

  const composite = item.composite;
  const mappedFields = new Set();
  const isDatasourceCode = f.code.from === 'datasource';
  const codeCodings = f.code.from === 'eventType' ? Object.values(f.code.codings) : isDatasourceCode ? [] : [f.code];
  const alsoMatchCodings = alsoMatchCodingsOf(f);
  const alsoEmitCodings = f.alsoEmit || [];
  if (f.alsoEmit != null && f.code.from != null) fail('"alsoEmit" applies to a static code only');
  if (isDatasourceCode) {
    checkDatasourceField(item, f.code.field, itemEventTypes, fail);
    if (f.alsoMatch != null) fail('"alsoMatch" applies to a static or eventType code only');
    mappedFields.add(f.code.field.split('.')[0]);
  } else if (f.code.from === 'eventType') {
    // Each eventType renders its own code, and an imported code names one eventType back; so does an import-only
    // code, keyed by the eventType it names (a mass code never imports a moles quantity).
    sameSet('code.codings keys vs the item eventTypes', Object.keys(f.code.codings), itemEventTypes);
    if (Array.isArray(f.alsoMatch)) fail('with an eventType code, "alsoMatch" is keyed by eventType: { <eventType>: [codings] }');
    for (const t of Object.keys(f.alsoMatch || {})) {
      if (!itemEventTypes.includes(t)) fail(`alsoMatch "${t}" is not one of the item eventTypes (${itemEventTypes.join(', ')})`);
    }
    unique('code.codings and alsoMatch', [...codeCodings, ...alsoMatchCodings]);
  } else {
    if (f.alsoMatch != null && !Array.isArray(f.alsoMatch)) fail('"alsoMatch" keyed by eventType applies to an eventType code only; a static code takes a list');
    unique('code, alsoMatch and alsoEmit', [f.code, ...alsoMatchCodings, ...alsoEmitCodings]);
  }
  checkLoincAgreement(item, f, itemEventTypes, fail);

  if (f.resourceType === 'Condition' && f.value != null) fail('a Condition has no value[x]; remove "value"');

  const numericField = (what, k) => {
    const field = composite?.[k];
    if (field == null) fail(`${what} "${k}" is not a composite field`);
    if (field.type !== 'number' && field.type !== 'slider') fail(`${what} "${k}" must be a numeric composite field, it is "${field.type}"`);
  };

  const v = f.value;
  const ownCodings = [...codeCodings, ...alsoMatchCodings, ...alsoEmitCodings];
  if (v?.alsoMatch != null && v.kind !== 'coded') fail('value.alsoMatch applies to value.kind "coded" only');
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
        // The unit picks the eventType on import, so two eventTypes never share one (annotations aside).
        const byUnit = new Map();
        for (const [t, u, factor] of scaled) {
          const other = byUnit.get(ucumKey(u));
          if (other != null) fail(`value.units: eventTypes "${other}" and "${t}" share the UCUM unit "${ucumKey(u)}" (annotations aside); an imported quantity would map back to two eventTypes`);
          byUnit.set(ucumKey(u), t);
          // A proportion stores 0..1: as a percentage it is 100 times the stored number, never the number itself.
          if (t === 'ratio/proportion' && ucumKey(u) === '%' && factor !== 100) {
            fail(`value.units "${t}": a proportion (0..1) renders in % with value.kind "scaled-quantity" and factor 100, not ${v.kind === 'quantity' ? 'as stored' : `factor ${factor}`}`);
          }
        }
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

/** Every `alsoMatch` coding of a block: the list of a static code, or all lists of an eventType code. */
function alsoMatchCodingsOf (f) {
  if (f.alsoMatch == null) return [];
  return Array.isArray(f.alsoMatch) ? f.alsoMatch : Object.values(f.alsoMatch).flat();
}

/**
 * `[LABC-LOINC-1]`, the block side: on an item that asserts LOINC codes (`references.loinc`), the block's LOINC
 * codings agree with them, so ownership and the import match keys cannot disagree. Each eventType renders the code its
 * unit option stores (`variations.eventType.options[].loinc`; on an item without unit options, its one code), and a
 * static code is stored by every unit option. An `alsoMatch` code may be one no item owns (a discouraged panel code);
 * that no other item owns a block's LOINC import key is checked with every item loaded (checkFhirImportKeys).
 */
function checkLoincAgreement (item, f, itemEventTypes, fail) {
  const loinc = item.references?.loinc || [];
  if (loinc.length === 0) return;
  const options = item.variations?.eventType?.options || [];
  const storedBy = (t) => options.length > 0 ? options.find((o) => o.value === t)?.loinc ?? null : loinc[0];
  const isLoinc = (c) => c.system === LOINC_SYSTEM;
  if (f.code.from === 'eventType') {
    for (const [t, c] of Object.entries(f.code.codings)) {
      if (!isLoinc(c) || c.code !== storedBy(t)) fail(`code.codings "${t}": ${c.system}|${c.code} is not the LOINC code its unit option stores (${storedBy(t)})`);
    }
  } else if (f.code.from == null && isLoinc(f.code)) {
    const other = itemEventTypes.filter((t) => storedBy(t) !== f.code.code);
    if (other.length > 0) fail(`code ${f.code.code} is a static code, but eventType ${other.join(', ')} stores ${other.map(storedBy).join(', ')}: use a code from eventType`);
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
  checkLock(items, checkedLock(lock), subtree, parentOf);
  checkFhirImportKeys(items);
  return grants;
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
 * eventType's code or alsoMatch coding), or by (resourceType, category, datasource code source) for each category the
 * block accepts (its own and its `alsoMatchCategories`), and must match one item only. A LOINC import key is never a
 * code another active item owns (`references.loinc` or `references.loincMethod`, `[LABC-LOINC-1]`). A Patient element
 * is claimed by one active item only, so an imported Patient places each element in one item. A resource that states
 * no category can still fit two datasource-coded items of different categories; the importer reports that as
 * ambiguous rather than guess.
 */
function checkFhirImportKeys (items) {
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
  for (const [key, item] of Object.entries(items)) {
    const f = item.fhir;
    if (item.deprecated || f == null || f.companionOf != null) continue;
    if (f.element != null) {
      claim(`${f.resourceType}.${f.element}`, key);
    } else if (f.code.from === 'datasource') {
      for (const c of [f.category, ...(f.alsoMatchCategories || [])]) {
        claim(`${f.resourceType}${c != null ? `|${c}` : ''} from ${f.code.from}`, key);
      }
    } else {
      const own = f.code.from === 'eventType' ? Object.values(f.code.codings) : [f.code];
      for (const c of [...own, ...alsoMatchCodingsOf(f)]) claimCoding(f, c, key);
    }
  }
  // An emitted-only coding (`alsoEmit`) is never an import key, and never a code that would make the rendered resource
  // match another item on its way back: no item's import key, no LOINC code another item owns.
  for (const [key, item] of Object.entries(items)) {
    const f = item.fhir;
    if (item.deprecated || f?.alsoEmit == null) continue;
    for (const c of f.alsoEmit) {
      const k = `${f.resourceType} ${c.system}|${c.code}`;
      if (seen.has(k)) throw new Error(`fhir alsoEmit ${k} of "${key}" is an import key of "${seen.get(k)}"; the rendered resource would import back into it`);
      const o = c.system === LOINC_SYSTEM ? owner.get(c.code) : undefined;
      if (o != null && o !== key) throw new Error(`fhir alsoEmit ${k} of "${key}" is a LOINC code item "${o}" owns`);
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
