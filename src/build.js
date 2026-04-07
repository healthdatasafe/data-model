const fs = require('fs');
const path = require('path');

const basePath = path.resolve(__dirname, '../dist');

// Browser app that replaced the static index.html / streams.html.
const BROWSER_URL = 'https://model-browser.datasafe.dev/';

const sources = [
  require('./schemas/items').toBePublished,
  require('./streams').toBePublished,
  require('./items').toBePublished,
  require('./eventTypes').toBePublished,
  require('./datasources').toBePublished,
  require('./conversions').toBePublished,
  require('./converters').toBePublished,
  require('./settings').toBePublished,
  require('./appStreams').toBePublished
];

const pack = {
  publicationDate: (new Date()).toISOString()
};

const htmlTableSrc = [{
  title: 'Pack items & streams',
  link: './pack.json',
  linkTxt: 'pack.json'
}];

for (const source of sources) {
  for (const file of source()) {
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
  publicationDate: pack.publicationDate,
  files: filesIndex
};
fs.writeFileSync(versionFilePath, JSON.stringify(versionContent, null, 2), 'utf-8');

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
  </body>
</html>
`;
fs.writeFileSync(path.resolve(basePath, 'index.html'), redirectHtml, 'utf-8');

// streams.html is no longer published — remove any leftover from a prior build.
const oldStreamsHtml = path.resolve(basePath, 'streams.html');
if (fs.existsSync(oldStreamsHtml)) fs.unlinkSync(oldStreamsHtml);
