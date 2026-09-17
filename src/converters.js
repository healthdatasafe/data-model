const fs = require('fs');
const path = require('path');
const YAML = require('yaml');

const defsDir = path.resolve(__dirname, '../definitions/converters');

/**
 * Last modification time of a definition file, as an ISO string.
 *
 * These timestamps used to be `new Date()` taken at build time, which meant every single build
 * rewrote dist/pack.json even when no definition had changed — real changes were then hard to see
 * in a diff, and no two builds of the same source agreed. Deriving them from the source files
 * makes a rebuild of unchanged definitions byte-identical.
 *
 * Caveat: mtime is checkout time on a fresh clone, so it is stable *within* a working tree rather
 * than globally reproducible. That is enough for the purpose here (a quiet diff); making it
 * clone-independent would mean reading git commit dates during the build.
 */
function fileUpdatedAt (filePath) {
  return fs.statSync(filePath).mtime.toISOString();
}

/**
 * Newest mtime across several files, as an ISO string.
 *
 * Falls back to `fallbackPath` when the list is empty: `Math.max()` of nothing is -Infinity, and
 * `new Date(-Infinity).toISOString()` throws RangeError. An item directory carrying neither a
 * converter yaml nor a model json is degenerate, but it used to produce a record rather than
 * crash the build, and a definition mistake should not look like a broken build script.
 */
function newestUpdatedAt (filePaths, fallbackPath) {
  if (filePaths.length === 0) return fileUpdatedAt(fallbackPath);
  const times = filePaths.map(p => fs.statSync(p).mtime.getTime());
  return new Date(Math.max(...times)).toISOString();
}

/**
 * Loads all converter definitions from definitions/converters/{itemKey}/
 * Each item-key directory contains:
 *   converter/{version}.yaml — dimensions, weights, helpers
 *   models/{sourceKey}/{version}.json — observations + vectors per method
 *
 * Publishes:
 *   dist/converters/pack.json — index of all converters
 *   dist/converters/{itemKey}/index.json — versions with status
 *   dist/converters/{itemKey}/pack-latest.json — bundled converter config + all models
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

  // Build version index
  const versions = {};
  for (const version of Object.keys(converterVersions)) {
    versions[version] = {
      status: 'active',
      updatedAt: fileUpdatedAt(converterVersionPaths[version])
    };
  }

  // Build pack-latest: latest converter config + all models at latest version
  const latestVersion = Object.keys(converterVersions).sort().pop();
  let packLatest = null;
  if (latestVersion) {
    const latestConfig = converterVersions[latestVersion];
    const latestModels = [];
    for (const sourceKey of Object.keys(models)) {
      const sourceVersions = Object.keys(models[sourceKey]).sort();
      const latestModelVersion = sourceVersions[sourceVersions.length - 1];
      if (latestModelVersion) {
        latestModels.push(models[sourceKey][latestModelVersion]);
      }
    }
    packLatest = {
      itemKey,
      converterVersion: latestVersion,
      engine: latestConfig.engine,
      eventType: latestConfig.eventType,
      dimensionNames: latestConfig.dimensionNames,
      dimensions: latestConfig.dimensions,
      colorToRGB: latestConfig.colorToRGB || undefined,
      methods: latestModels
    };
  }

  converterIndex[itemKey] = {
    latestVersion,
    updatedAt: newestUpdatedAt(sourcePaths, itemDir)
  };

  // Store for publishing
  converterIndex[itemKey]._versions = versions;
  converterIndex[itemKey]._packLatest = packLatest;
}

module.exports = {
  toBePublished
};

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

    // pack-latest.json — bundled converter + models
    if (entry._packLatest) {
      files.push({
        title: `Converter: ${itemKey} — latest pack`,
        path: `converters/${itemKey}/`,
        filename: 'pack-latest.json',
        type: 'json',
        content: entry._packLatest
      });
    }
  }

  // Global converters pack.json
  const packContent = {};
  for (const itemKey of Object.keys(converterIndex)) {
    packContent[itemKey] = {
      latestVersion: converterIndex[itemKey].latestVersion,
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
