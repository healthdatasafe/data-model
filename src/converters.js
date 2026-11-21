const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const YAML = require('yaml');

const defsDir = path.resolve(__dirname, '../definitions/converters');

/** The `temperatureRule` value of a method that draws no coverline. */
const NO_TEMPERATURE_RULE = 'none';

/**
 * Last change of a definition file, as an ISO string.
 *
 * These timestamps used to be `new Date()` taken at build time, which meant every single build
 * rewrote dist/pack.json even when no definition had changed — real changes were then hard to see
 * in a diff, and no two builds of the same source agreed. Deriving them from the source files
 * makes a rebuild of unchanged definitions byte-identical.
 *
 * The date is the commit date of the last commit touching the file, so two checkouts of the same
 * commit build the same pack (B-2026-10-28-43; the file mtime used before is checkout time on a
 * fresh clone). A file with uncommitted changes, or no git at all, falls back to its mtime: the
 * build of a working tree still shows what is being edited.
 */
function fileUpdatedAt (filePath) {
  return new Date(fileTime(filePath)).toISOString();
}

/** Last change of a file in milliseconds: its last commit if it is committed and clean, else its mtime. */
function fileTime (filePath) {
  try {
    const opts = { cwd: path.dirname(filePath), encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] };
    const dirty = execFileSync('git', ['status', '--porcelain', '--', filePath], opts).trim();
    if (dirty === '') {
      const committed = execFileSync('git', ['log', '-1', '--format=%cI', '--', filePath], opts).trim();
      if (committed !== '') return new Date(committed).getTime();
    }
  } catch {
    // no git, or not a repository: fall back to the mtime
  }
  return fs.statSync(filePath).mtime.getTime();
}

/**
 * Newest change across several files, as an ISO string.
 *
 * Falls back to `fallbackPath` when the list is empty: `Math.max()` of nothing is -Infinity, and
 * `new Date(-Infinity).toISOString()` throws RangeError. An item directory carrying neither a
 * converter yaml nor a model json is degenerate, but it used to produce a record rather than
 * crash the build, and a definition mistake should not look like a broken build script.
 */
function newestUpdatedAt (filePaths, fallbackPath) {
  if (filePaths.length === 0) return fileUpdatedAt(fallbackPath);
  const times = filePaths.map(fileTime);
  return new Date(Math.max(...times)).toISOString();
}

/**
 * `pack-latest.json` keeps the pack of this converter version for good, without `modelVersion`: as
 * published before the versioned packs. hds-lib before 2.60.0 fetches only that URL and ignores
 * `produce: false`; newer hds-lib fetches `pack-{v}.json`, v the highest of the index's `versions` it
 * supports. The published packs are pinned by tests/fixtures/converter-packs.sha256.json and checked
 * again by scripts/deploy.sh against the deployed files.
 */
const LEGACY_PACK_VERSION = 'v0';

/** A converter or model version name: `v<number>`. */
const VERSION_NAME = /^v\d+$/;

/**
 * Loads all converter definitions from definitions/converters/{itemKey}/
 * Each item-key directory contains:
 *   converter/{version}.yaml — dimensions, weights, helpers
 *   models/{sourceKey}/{version}.json — observations + vectors per method
 *
 * Publishes:
 *   dist/converters/pack.json — index of all converters (`latestVersion`, `versions` per item key)
 *   dist/converters/{itemKey}/index.json — versions with status
 *   dist/converters/{itemKey}/pack-{version}.json — bundled converter config + models, per converter version
 *   dist/converters/{itemKey}/pack-latest.json — the v0 pack, frozen (legacy URL, see LEGACY_PACK_VERSION)
 */

const converterIndex = {};

// Discover item-key directories
const itemKeys = fs.readdirSync(defsDir)
  .filter(f => fs.statSync(path.join(defsDir, f)).isDirectory());

for (const itemKey of itemKeys) {
  const itemDir = path.join(defsDir, itemKey);

  // Load converter configs (versioned)
  const converterDir = path.join(itemDir, 'converter');
  const converterVersions = {};
  const converterVersionPaths = {};
  const sourcePaths = [];
  if (fs.existsSync(converterDir)) {
    for (const file of fs.readdirSync(converterDir).filter(f => f.endsWith('.yaml'))) {
      const version = path.basename(file, '.yaml');
      const fullPath = path.join(converterDir, file);
      converterVersions[version] = YAML.parse(fs.readFileSync(fullPath, 'utf-8'));
      converterVersionPaths[version] = fullPath;
      sourcePaths.push(fullPath);
    }
  }

  // Load models (grouped by sourceKey, each with versions)
  const modelsDir = path.join(itemDir, 'models');
  const models = {};
  if (fs.existsSync(modelsDir)) {
    for (const sourceKey of fs.readdirSync(modelsDir).filter(f => fs.statSync(path.join(modelsDir, f)).isDirectory())) {
      models[sourceKey] = {};
      const sourceDir = path.join(modelsDir, sourceKey);
      for (const file of fs.readdirSync(sourceDir).filter(f => f.endsWith('.json'))) {
        const version = path.basename(file, '.json');
        const fullPath = path.join(sourceDir, file);
        models[sourceKey][version] = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        sourcePaths.push(fullPath);
      }
    }
  }

  checkVersions(itemKey, converterVersions, models);

  // Build version index
  const versions = {};
  for (const version of Object.keys(converterVersions)) {
    versions[version] = {
      status: 'active',
      updatedAt: fileUpdatedAt(converterVersionPaths[version])
    };
  }

  // One pack per converter version: pack-{version}.json
  const packs = {};
  for (const version of Object.keys(converterVersions)) {
    packs[version] = buildPack(itemKey, version, converterVersions[version], models);
  }
  const sortedVersions = Object.keys(converterVersions).sort(byVersion);

  converterIndex[itemKey] = {
    latestVersion: sortedVersions[sortedVersions.length - 1],
    versions: sortedVersions,
    updatedAt: newestUpdatedAt(sourcePaths, itemDir)
  };

  // Store for publishing
  converterIndex[itemKey]._versions = versions;
  converterIndex[itemKey]._packs = packs;
}

module.exports = {
  toBePublished,
  checkTemperatureRules,
  checkVersions,
  buildPack,
  legacyPackOf,
  byVersion
};

/** Orders version names "v0", "v1", …, "v10" by their number. */
function byVersion (a, b) {
  return Number(a.slice(1)) - Number(b.slice(1));
}

/**
 * Version names are `v<number>`; a converter yaml's `version:` is its file name; a model version has a converter
 * version of the same name (else it would be in no pack, silently).
 */
function checkVersions (itemKey, converterVersions, models) {
  const fail = (msg) => { throw new Error(`converter "${itemKey}": ${msg}`); };
  for (const [version, config] of Object.entries(converterVersions)) {
    if (!VERSION_NAME.test(version)) fail(`converter/${version}.yaml: a version is named v<number>`);
    if (config.version !== version) fail(`converter/${version}.yaml declares version "${config.version}"`);
  }
  for (const [sourceKey, versions] of Object.entries(models)) {
    for (const version of Object.keys(versions)) {
      if (!VERSION_NAME.test(version)) fail(`models/${sourceKey}/${version}.json: a version is named v<number>`);
      if (!converterVersions[version]) fail(`models/${sourceKey}/${version}.json has no converter/${version}.yaml: a new model version comes with the converter version of the same name`);
    }
  }
}

/** The legacy `pack-latest.json`: the v0 pack as published before the versioned packs, without `modelVersion`. */
function legacyPackOf (pack) {
  return { ...pack, methods: pack.methods.map(({ modelVersion, ...m }) => m) };
}

/**
 * The pack of one converter version: its config, and each method at its newest model version not
 * above the converter version. Each method carries that `modelVersion`.
 *
 * A model version is therefore published only from the converter version of the same name on: a
 * method changed in a way older readers cannot take (Creighton v1: codes with `produce: false`,
 * which hds-lib before 2.60.0 ignores) gets a new model version and a new converter version, and the
 * packs of older converter versions keep the method as it was.
 */
function buildPack (itemKey, version, config, models) {
  const packModels = [];
  for (const sourceKey of Object.keys(models)) {
    const modelVersion = Object.keys(models[sourceKey]).filter(v => byVersion(v, version) <= 0).sort(byVersion).pop();
    if (modelVersion) packModels.push({ ...models[sourceKey][modelVersion], modelVersion });
  }
  const methods = checkTemperatureRules(itemKey, config, packModels);
  return {
    itemKey,
    converterVersion: version,
    engine: config.engine,
    eventType: config.eventType,
    dimensionNames: config.dimensionNames,
    dimensions: config.dimensions,
    colorToRGB: config.colorToRGB || undefined,
    temperatureRules: config.temperatureRules || undefined,
    methods
  };
}

/**
 * Check a converter's per-method temperature rule declaration (3.24.0) and return the methods,
 * each with its `temperatureRule`. A converter that declares neither block is returned unchanged.
 *
 * The model JSON files are byte copies of model-cervical-fluid's definitions, so the declaration
 * lives in the converter config (owned here) and is added to each method at build time. It must
 * be complete: a method copied in later without a declaration fails the build rather than
 * publishing a method of unknown rule.
 */
function checkTemperatureRules (itemKey, config, methods) {
  const rules = config.temperatureRules;
  const perMethod = config.methodTemperatureRule;
  if (rules === undefined && perMethod === undefined) return methods;
  const fail = (msg) => { throw new Error(`converter "${itemKey}": ${msg}`); };
  if (!rules || typeof rules !== 'object' || Array.isArray(rules)) fail('temperatureRules must be a map of rule id to { label, source }');
  if (!perMethod || typeof perMethod !== 'object' || Array.isArray(perMethod)) fail('methodTemperatureRule must be a map of methodId to a rule id');
  if (rules[NO_TEMPERATURE_RULE]) fail(`"${NO_TEMPERATURE_RULE}" is reserved and cannot be a temperatureRules id`);
  for (const [id, rule] of Object.entries(rules)) {
    if (!rule?.label?.en || !rule.source) fail(`temperatureRules.${id} needs label.en and source`);
  }
  const methodIds = methods.map(m => m.methodId);
  for (const methodId of methodIds) {
    if (!Object.hasOwn(perMethod, methodId)) fail(`method "${methodId}" has no methodTemperatureRule entry`);
  }
  for (const [methodId, ruleId] of Object.entries(perMethod)) {
    if (!methodIds.includes(methodId)) fail(`methodTemperatureRule names unknown method "${methodId}"`);
    if (ruleId !== NO_TEMPERATURE_RULE && !Object.hasOwn(rules, ruleId)) fail(`method "${methodId}" has unknown temperatureRule "${ruleId}"`);
  }
  return methods.map(m => ({ ...m, temperatureRule: perMethod[m.methodId] }));
}

function toBePublished () {
  const files = [];

  // Per-item files
  for (const itemKey of Object.keys(converterIndex)) {
    const entry = converterIndex[itemKey];

    // index.json — version list with status
    files.push({
      title: `Converter: ${itemKey} — versions`,
      path: `converters/${itemKey}/`,
      filename: 'index.json',
      type: 'json',
      content: { itemKey, versions: entry._versions }
    });

    // pack-{version}.json — bundled converter + models, one per converter version
    for (const [version, pack] of Object.entries(entry._packs)) {
      files.push({
        title: `Converter: ${itemKey} — pack ${version}`,
        path: `converters/${itemKey}/`,
        filename: `pack-${version}.json`,
        type: 'json',
        content: pack
      });
    }

    // pack-latest.json — the v0 pack, frozen: hds-lib before 2.60.0 reads only this URL
    if (entry._packs[LEGACY_PACK_VERSION]) {
      files.push({
        title: `Converter: ${itemKey} — pack ${LEGACY_PACK_VERSION} (legacy URL)`,
        path: `converters/${itemKey}/`,
        filename: 'pack-latest.json',
        type: 'json',
        content: legacyPackOf(entry._packs[LEGACY_PACK_VERSION])
      });
    }
  }

  // Global converters pack.json
  const packContent = {};
  for (const itemKey of Object.keys(converterIndex)) {
    packContent[itemKey] = {
      latestVersion: converterIndex[itemKey].latestVersion,
      versions: converterIndex[itemKey].versions,
      updatedAt: converterIndex[itemKey].updatedAt
    };
  }
  files.push({
    title: 'Converters index',
    path: 'converters/',
    filename: 'pack.json',
    type: 'json',
    content: packContent,
    includeInPack: 'converters'
  });

  return files;
}
