const fs = require('fs');
const path = require('path');

const basePath = path.resolve(__dirname, '../dist');

const { itemsById } = require('./items');

const rootStreams = require('./streams').roots;

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

// -- html table files
const htmlTableFiles = htmlTableSrc.map(i => `<tr><td>${i.title}</td><td><a href="${i.link}">${i.linkTxt}</a></tr>`).join('\n');

const indexHtmlSrc = fs.readFileSync(path.resolve(__dirname, '../docs-src/index.html'), 'utf-8');
const indexHtmlDest1 = indexHtmlSrc.replace('{TABLE_FILES}', htmlTableFiles);

const itemsByStreamId = {};

// -- html table items
const rowsItems = [];
for (const key of Object.keys(itemsById).sort()) {
  const i = itemsById[key];

  // add to itemsByStreamId
  if (itemsByStreamId[i.streamId] == null) itemsByStreamId[i.streamId] = [];
  itemsByStreamId[i.streamId].push(key);

  // continue
  const variation = (i.variations?.eventType != null) ? `(${i.variations.eventType.label.en}): ` + i.variations.eventType.options.map(v => v.value).join(', ') : '';
  const type = (typeof i.eventType === 'string') ? i.eventType : variation;
  const select = (i.options == null) ? '' : '<BR><SELECT style="width: 20em">' + i.options.map((o) => (`<OPTION>${o.value}: ${o.label.en}</OPTION>`)).join('') + '</SELECT>';
  const infos = (i.devNotes == null) ? '' : `<BR><span style="font-style: italic; font-size: small">${i.devNotes.replaceAll('\n', '<br>')}</span>`;
  const line = `<tr><td><span style="font-weight: bold;" id="${key}">${key}</span><br><u>Type:</u> ${i.type}<br><u>When:</u> ${i.repeatable}</td><td>${i.label.en}<br>${i.description.en}${select}${infos}</td><td><u>streamId:</u> ${i.streamId}<br><u>eventType(s):</u> ${type}<br><u>version:</u> ${i.version}</td></tr>`;
  rowsItems.push(line);
}
const indexHtmlDest = indexHtmlDest1.replace('{TABLE_ITEMS}', rowsItems.join('\n'));

fs.writeFileSync(path.resolve(basePath, 'index.html'), indexHtmlDest, 'utf-8');

// -- streams page
const streamsHtmlSrc = fs.readFileSync(path.resolve(__dirname, '../docs-src/streams.html'), 'utf-8');

function addStreams (streams, depth) {
  if (streams == null) return '';
  const pad = '                   '.substring(0, depth).replaceAll(' ', '&nbsp&nbsp');
  let res = '';
  for (const stream of streams) {
    const items = [];
    if (itemsByStreamId[stream.id]) {
      for (const key of itemsByStreamId[stream.id]) {
        items.push(`<A HREF="index.html#${key}">${key}</A>`);
      }
    }
    res += `<TR><TD>${pad}-${stream.name}</TD><TD>${stream.id}</TD><TD>${items.join('<BR>')}</TD></TR>`;
    res += addStreams(stream.children, depth + 1);
  }
  return res;
}

const streamsContent = addStreams(rootStreams, 0);

const streamsHtmlDest = streamsHtmlSrc.replace('{STREAMS}', streamsContent);

fs.writeFileSync(path.resolve(basePath, 'streams.html'), streamsHtmlDest, 'utf-8');
