const fs = require('fs');
const path = require('path');
const { loadLocales, checkInlineLocales, localise, localeStatus, converterSidecars, checkPublished, checkConsentLabels, checkConsentLabelLocales } = require('./l10n');
const { checkDocumentKindsTable } = require('./documentKinds');
const { checkItem } = require('./schemas/items');
const { checkVocabulary } = require('./schemas/vocabularies');
const { checkConsentOptInDescriptions } = require('./fhir');

const basePath = path.resolve(__dirname, '../dist');

// Browser app that replaced the static index.html / streams.html.
const BROWSER_URL = 'https://model-browser.datasafe.dev/';

const sources = [
  require('./schemas/items').toBePublished,
  require('./schemas/appManifest').toBePublished,
  require('./schemas/vocabularies').toBePublished,
  require('./schemas/documentKinds').toBePublished,
  require('./schemas/clientDataKeys').toBePublished,
  require('./schemas/conversationAlert').toBePublished,
  require('./schemas/eligibilityRequest').toBePublished,
  require('./schemas/researchAlert').toBePublished,
  require('./streams').toBePublished,
  require('./items').toBePublished,
  require('./eventTypes').toBePublished,
  require('./vocabularies').toBePublished,
  require('./documentKinds').toBePublished,
  require('./datasources').toBePublished,
  require('./conversions').toBePublished,
  require('./converters').toBePublished,
  require('./settings').toBePublished,
  require('./appStreams').toBePublished
];

// `version` is package.json's: consumers pin or compare the model by it.
// scripts/deploy.sh refuses a pack whose definitions changed after the last bump.
const pack = {
  version: require('../package.json').version,
  publicationDate: (new Date()).toISOString()
};

const htmlTableSrc = [{
  title: 'Pack items & streams',
  link: './pack.json',
  linkTxt: 'pack.json'
}];

const { locales, doNotTranslate } = loadLocales();
const publishedFiles = [];

for (const source of sources) {
  for (const published of source()) {
    const fileName = published.path.replace(/^\.\//, '').replace(/([^/])$/, '$1/') + published.filename;
    // en and fr only in the definitions: every other locale's text carries its review mark in definitions/l10n
    checkInlineLocales(fileName, published.content);
    const file = { ...published, content: localise(fileName, published.content, locales) };
    // what the definitions were checked for must hold in every language of the pack
    if (file.includeInPack === 'documentKinds') checkDocumentKindsTable(file.content);
    if (file.includeInPack === 'items') for (const [key, item] of Object.entries(file.content)) checkItem(item, key);
    if (file.includeInPack === 'vocabularies') for (const [key, vocabulary] of Object.entries(file.content)) checkVocabulary(vocabulary, key);
    publishedFiles.push({ fileName, content: file.content });
    const dirPath = path.resolve(basePath, file.path);
    const filePath = path.resolve(dirPath, file.filename);
    if (file.type !== 'json') throw new Error('Can only publish json files');
    const content = JSON.stringify(file.content, null, 2);
    fs.mkdirSync(dirPath, { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    if (file.includeInPack) pack[file.includeInPack] = file.content;
    htmlTableSrc.push({
      title: file.title,
      link: file.path + file.filename,
      linkTxt: file.path + file.filename
    });
  }
}

checkPublished(publishedFiles, locales, doNotTranslate);
for (const [name, content] of Object.entries(converterSidecars(publishedFiles, locales))) {
  fs.writeFileSync(path.resolve(basePath, name), JSON.stringify(content, null, 2), 'utf-8');
  htmlTableSrc.push({ title: `Translations: ${name}`, link: `./${name}`, linkTxt: name });
}

checkConsentLabels(pack.streams, pack.items, locales);
checkConsentLabelLocales(pack.streams, pack.items, locales, doNotTranslate);
// an opt-in consent row that grants more than its label says it in every language of the pack (FHIR-MAPPING.md § SMART scopes)
checkConsentOptInDescriptions(pack.streams, pack.items, ['en', 'fr', ...Object.keys(locales)]);
// the locales added from definitions/l10n, and whether they hold drafts (documentation/L10N.md)
if (Object.keys(locales).length > 0) pack.l10n = localeStatus(locales);

const packFilePath = path.resolve(basePath, 'pack.json');
fs.writeFileSync(packFilePath, JSON.stringify(pack, null, 2), 'utf-8');

// -- version.json (with files index for the data-model browser app)
// scripts/deploy.sh merges commit/branch/buildDate into this file at deploy time.
const filesIndex = htmlTableSrc.map(i => ({
  title: i.title,
  // strip leading "./" so consumers can join cleanly with the model base URL
  file: i.link.replace(/^\.\//, '')
}));
const versionFilePath = path.resolve(basePath, 'version.json');
const existingVersion = fs.existsSync(versionFilePath)
  ? JSON.parse(fs.readFileSync(versionFilePath, 'utf-8'))
  : {};
const versionContent = {
  ...existingVersion,
  version: pack.version,
  publicationDate: pack.publicationDate,
  license: 'CC-BY-4.0',
  attribution: `HDS Data Model ${pack.version}, © Health Data Safe, https://model.datasafe.dev, CC BY 4.0. ` +
    'Third-party code systems excluded: see https://model.datasafe.dev/LICENSE.txt',
  files: filesIndex
};
fs.writeFileSync(versionFilePath, JSON.stringify(versionContent, null, 2), 'utf-8');

// -- LOINC notice: the pack carries LOINC codes and their long common names (references, fhir blocks), so the
// licence's §10 notice is published with it, verbatim, on the landing page and as a text file.
const LOINC_NOTICE = 'This material contains content from LOINC (http://loinc.org). LOINC is copyright © Regenstrief Institute, Inc. ' +
  'and the Logical Observation Identifiers Names and Codes (LOINC) Committee and is available at no cost under the license at ' +
  'http://loinc.org/license. LOINC® is a registered United States trademark of Regenstrief Institute, Inc.';
fs.writeFileSync(path.resolve(basePath, 'LOINC_NOTICE.txt'), LOINC_NOTICE + '\n', 'utf-8');

// -- Licence and terms of use of the hosted service, published next to the pack so a consumer of model.datasafe.dev
// sees them without the repository.
fs.copyFileSync(path.resolve(__dirname, '../LICENSE'), path.resolve(basePath, 'LICENSE.txt'));
fs.copyFileSync(path.resolve(__dirname, '../TERMS.md'), path.resolve(basePath, 'TERMS.txt'));

// -- index.html — small landing page that redirects to the React browser.
// The previous static items / streams tables have been replaced by
// `app-data-model-browser` (https://model-browser.datasafe.dev/), which loads
// pack.json + version.json directly from this same domain. Anything that
// linked to model.datasafe.dev/index.html now bounces over via meta-refresh.
const redirectHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>HDS Data Model</title>
    <meta http-equiv="refresh" content="0; url=${BROWSER_URL}" />
    <link rel="canonical" href="${BROWSER_URL}" />
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif; padding: 4rem 2rem; max-width: 40rem; margin: 0 auto; color: #111928; }
      a { color: #1C64F2; }
    </style>
  </head>
  <body>
    <h1>HDS Data Model</h1>
    <p>The data-model browser has moved to <a href="${BROWSER_URL}">${BROWSER_URL}</a>.</p>
    <p>If you are not redirected automatically, click the link above.</p>
    <p><small>HDS Data Model © Health Data Safe. Content under <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>,
      code under BSD-3-Clause: see <a href="LICENSE.txt">LICENSE.txt</a> and the <a href="TERMS.txt">terms of use</a>.</small></p>
    <p><small>${LOINC_NOTICE}</small></p>
  </body>
</html>
`;
fs.writeFileSync(path.resolve(basePath, 'index.html'), redirectHtml, 'utf-8');

// -- robots.txt — this host serves machine-readable artifacts (pack.json,
// version.json, JSON schemas), not pages meant for search results. Keep it out
// of the index so it doesn't compete with model-browser.datasafe.dev, which is
// the human-facing view of exactly this data.
const robotsTxt = `User-agent: *
Disallow: /
`;
fs.writeFileSync(path.resolve(basePath, 'robots.txt'), robotsTxt, 'utf-8');

// streams.html is no longer published — remove any leftover from a prior build.
const oldStreamsHtml = path.resolve(basePath, 'streams.html');
if (fs.existsSync(oldStreamsHtml)) fs.unlinkSync(oldStreamsHtml);
