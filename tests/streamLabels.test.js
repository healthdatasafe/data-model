const assert = require('assert');

// Localised stream names for consent screens (4.4.0): a consent row names a stream through the item on it; a stream no
// active item speaks for (every root but a few, the intermediate streams) shows its `label` instead, so each one has
// a `label` { en, fr }. See AGENTS.md § Stream schema.

describe('[STRL] Localised stream labels', () => {
  const { itemsById } = require('../src/items');
  const streams = require('../src/streams');

  // A consent row borrows an item's label only when exactly one active item is filed on the stream; with none, or
  // with several (no single one speaks for it), the row needs the stream's own label.
  const activeCount = {};
  for (const i of Object.values(itemsById)) {
    if (!i.deprecated) activeCount[i.streamId] = (activeCount[i.streamId] ?? 0) + 1;
  }

  it('[STRL-1] every stream no single active item speaks for carries a label { en, fr }', () => {
    const missing = Object.values(streams.streamsById)
      .filter((s) => activeCount[s.id] !== 1 && s.label == null)
      .map((s) => s.id);
    assert.deepStrictEqual(missing, [], 'add a label { en: <name>, fr } to these streams');
  });

  it('[STRL-2] the encounter root carries the consent wording of ENCOUNTER.md, en and fr', () => {
    const root = streams.streamsById.encounter;
    assert.strictEqual(root.label.fr, 'Soins et prestataires');
    assert.match(root.description.en, /including sensitive visits/);
    assert.match(root.description.fr, /y compris les visites sensibles/);
  });
});
