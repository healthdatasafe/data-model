const fs = require('fs');
const path = require('path');

// Translations added to the published files at build time (documentation/L10N.md). The definitions keep `en` and `fr`
// (and the few `es`, `de`, `it` written there); every other text of a locale is in `definitions/l10n/{locale}.json`.
//
//   { "<published file>": { "<path>": { "en": "the English it translates", "text": "...", "reviewedBy": "...", "reviewedOn": "YYYY-MM-DD" } } }
//
// Only reviewed texts are kept there: drafts live outside this repository. A build fails on a text whose English changed,
// on a path that matches nothing and on an empty text, so a shipped translation never falls back to English unnoticed.
// Path: object keys joined with `/` (JSON Pointer escapes: `~0` for `~`, `~1` for `/`); an array entry is `[value=<JSON>]`
// or `[id=<JSON>]` when it has one, else `[index]`: an option moved in its list keeps its translation.

const l10nDir = path.join(__dirname, '../definitions/l10n');
/** The locales hds-lib supports beside the source ones (`localizeText.ts` `supportedLocales`). */
const LOCALES = ['es', 'it', 'pt', 'pt-BR'];
/** Published converter packs are frozen (tests/fixtures/converter-packs.sha256.json): their texts go to a sidecar. */
const CONVERTER_PACK = /^converters\/([^/]+)\/pack-(latest|v\d+)\.json$/;

module.exports = { LOCALES, CONVERTER_PACK, checkLocales, forEachText, loadLocales, localise, converterSidecars, checkPublished, checkConsentLabels };

function loadLocales (dir = l10nDir) {
  const locales = {};
  let doNotTranslate = [];
  if (!fs.existsSync(dir)) return { locales, doNotTranslate };
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.json')) continue;
    const content = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
    if (file === 'do-not-translate.json') doNotTranslate = content;
    else locales[file.replace(/\.json$/, '')] = content;
  }
  checkLocales(locales, doNotTranslate);
  return { locales, doNotTranslate };
}

/** `doNotTranslate`: `{ file, path, reason }`, texts of licensed or validated instruments; an entry there needs `official`. */
function checkLocales (locales, doNotTranslate) {
  const held = new Map(doNotTranslate.map(({ file, path: at, reason }) => [`${file} ${at}`, reason]));
  for (const [locale, files] of Object.entries(locales)) {
    if (!LOCALES.includes(locale)) throw new Error(`l10n: ${locale} is not one of ${LOCALES.join(', ')}`);
    for (const [file, texts] of Object.entries(files)) {
      for (const [at, entry] of Object.entries(texts)) {
        const where = `l10n: ${locale} ${file} ${at}`;
        for (const key of ['en', 'text', 'reviewedBy', 'reviewedOn']) {
          if (typeof entry[key] !== 'string' || entry[key].trim() === '') throw new Error(`${where}: ${key} is missing`);
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.reviewedOn)) throw new Error(`${where}: reviewedOn must be YYYY-MM-DD`);
        if (held.has(`${file} ${at}`) && !entry.official) throw new Error(`${where}: ${held.get(`${file} ${at}`)} (give the source in "official")`);
      }
    }
  }
}

const escape = (key) => key.replace(/~/g, '~0').replace(/\//g, '~1');

function segmentOf (entry, index) {
  if (entry !== null && typeof entry === 'object' && !Array.isArray(entry)) {
    for (const key of ['value', 'id']) {
      if (key in entry && (entry[key] === null || typeof entry[key] !== 'object')) return `[${key}=${JSON.stringify(entry[key])}]`;
    }
  }
  return `[${index}]`;
}

/** Calls `fn(node, path)` for every text map (an object with a string `en`) of `content`. */
function forEachText (content, fn, at = '') {
  if (content === null || typeof content !== 'object') return;
  if (Array.isArray(content)) {
    const segments = content.map(segmentOf);
    content.forEach((entry, i) => {
      // two entries with one value or id: neither can be named by it
      const shared = segments.indexOf(segments[i]) !== segments.lastIndexOf(segments[i]);
      let hasText = false;
      forEachText(entry, () => { hasText = true; });
      if (shared && hasText) throw new Error(`l10n: ${at} has two entries ${segments[i]}`);
      forEachText(entry, fn, at + segments[i]);
    });
    return;
  }
  if (typeof content.en === 'string') fn(content, at);
  for (const [key, value] of Object.entries(content)) forEachText(value, fn, at === '' ? escape(key) : `${at}/${escape(key)}`);
}

/** Runs `apply(node, locale, entry)` for each translated text of `content`; throws on a stale or unused entry. */
function walk (fileName, content, locales, apply) {
  for (const [locale, files] of Object.entries(locales)) {
    const texts = files[fileName];
    if (texts === undefined) continue;
    const left = new Set(Object.keys(texts));
    forEachText(content, (node, at) => {
      const entry = texts[at];
      if (entry === undefined) return;
      left.delete(at);
      if (entry.en !== node.en) throw new Error(`l10n: ${locale} ${fileName} ${at}: the English changed ("${entry.en}" is now "${node.en}")`);
      apply(node, locale, entry, at);
    });
    if (left.size > 0) throw new Error(`l10n: ${locale} ${fileName}: no such text: ${[...left].join(', ')}`);
  }
}

/** A copy of a published file's content with its translations. A frozen converter pack is returned as it is. */
function localise (fileName, content, locales) {
  if (CONVERTER_PACK.test(fileName)) return content;
  const copy = structuredClone(content);
  walk(fileName, copy, locales, (node, locale, entry, at) => {
    if (node[locale] !== undefined) throw new Error(`l10n: ${locale} ${fileName} ${at} is already in the definitions`);
    node[locale] = entry.text;
  });
  return copy;
}

/**
 * The texts of a frozen converter pack, one published file per item key and locale: `converters/{key}/l10n-{locale}.json`,
 * `{ locale, packs: { "pack-v1.json": { "<path>": "text" } } }`. A reader that knows it merges it after the pack.
 */
function converterSidecars (published, locales) {
  const files = {};
  for (const { fileName, content } of published) {
    const m = fileName.match(CONVERTER_PACK);
    if (!m) continue;
    walk(fileName, content, locales, (node, locale, entry, at) => {
      const name = `converters/${m[1]}/l10n-${locale}.json`;
      files[name] ??= { locale, packs: {} };
      (files[name].packs[`pack-${m[2]}.json`] ??= {})[at] = entry.text;
    });
  }
  return files;
}

/** A locale file or the do-not-translate list names a published file or a text that does not exist. `published`: `[{ fileName, content }]`. */
function checkPublished (published, locales, doNotTranslate) {
  const contents = new Map(published.map(({ fileName, content }) => [fileName, content]));
  for (const [locale, files] of Object.entries(locales)) {
    for (const file of Object.keys(files)) if (!contents.has(file)) throw new Error(`l10n: ${locale}: no published file ${file}`);
  }
  for (const { file, path: at } of doNotTranslate) {
    if (!contents.has(file)) throw new Error(`l10n: do-not-translate: no published file ${file}`);
    let found = false;
    forEachText(contents.get(file), (node, here) => { if (here === at) found = true; });
    if (!found) throw new Error(`l10n: do-not-translate: ${file} has no text ${at}`);
  }
}

/**
 * Two streams a person could not tell apart on a consent screen, in a locale added here: the label shown is the one of
 * the stream's only active item, else the stream's own, prefixed with its parent's in that language, else in English
 * (hds-fhir-js `consentLabels` and `duplicateStreamLabels`, whose `check:pack` refuses a pack with duplicates). A stream
 * whose label has no text in the locale is read in English as a whole.
 */
function checkConsentLabels (streams, items, locales) {
  const itemOf = new Map();
  for (const item of Object.values(items)) {
    if (item.deprecated) continue;
    itemOf.set(item.streamId, itemOf.has(item.streamId) ? null : item);
  }
  for (const locale of Object.keys(locales)) {
    const seen = new Map();
    const bare = (stream) => itemOf.get(stream.id)?.label ?? stream.label ?? { en: stream.name };
    (function visit (list, parent) {
      for (const stream of list) {
        const texts = bare(stream);
        const lang = texts[locale] === undefined ? 'en' : locale;
        const own = itemOf.get(stream.id) == null && stream.label != null && parent != null;
        const up = own ? bare(parent)[lang] ?? bare(parent).en : undefined;
        const label = up === undefined ? texts[lang] : `${up} › ${texts[lang]}`;
        const key = label.trim().toLowerCase();
        if (seen.has(key)) throw new Error(`l10n: ${locale}: streams ${seen.get(key)} and ${stream.id} are both "${label}" on a consent screen`);
        seen.set(key, stream.id);
        visit(stream.children ?? [], stream);
      }
    })(streams, undefined);
  }
}
