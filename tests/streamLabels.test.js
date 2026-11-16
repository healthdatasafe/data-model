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

  // A consent description must not understate the grant. The texts name each root's content exactly, so a root that
  // gains or loses a direct child fails here until its description is re-read (grandchildren are not caught).
  const DESCRIBED_CHILDREN = {
    fertility: ['fertility-cycles', 'fertility-trainings', 'fertility-ttc-tta', 'fertility-ttc-duration', 'fertility-sexual-activity', 'fertility-genital-contact', 'fertility-tracking-method', 'fertility-test-opk', 'fertility-test-pregnancy', 'fertility-pregnancies'],
    body: ['body-height', 'body-weight', 'body-blood-pressure', 'body-blood', 'body-vulva', 'body-skin', 'body-heart-rate', 'body-oxygen-saturation', 'body-temperature', 'body-urine', 'body-csf', 'body-semen'],
    lifestyle: ['lifestyle-tobacco', 'lifestyle-alcohol', 'lifestyle-diet'],
    family: ['family-children'],
    // 4.9.0
    wellbeing: ['wellbeing-mood', 'wellbeing-sex-drive', 'wellbeing-mental-distress', 'wellbeing-mental-distress-anxiety', 'wellbeing-mental-distress-depression', 'wellbeing-mental-distress-stress', 'wellbeing-self-rated-health', 'wellbeing-general-health'],
    profile: ['profile-address', 'profile-birthcountry', 'profile-ethnicity', 'profile-date-of-birth', 'profile-avatar', 'profile-display-name', 'profile-location', 'profile-name', 'profile-sex', 'profile-reproductive-stage', 'profile-preferences']
  };

  it('[STRL-3] the broad sensitive roots say what a grant on them covers, en and fr, and are re-read when they change (4.7.0)', () => {
    for (const [id, children] of Object.entries(DESCRIBED_CHILDREN)) {
      const root = streams.streamsById[id];
      assert.ok(root.description?.en && root.description?.fr, `${id} carries a description { en, fr }`);
      assert.deepStrictEqual((root.children ?? []).map((c) => c.id), children,
        `${id} gained or lost a child: re-read its consent description, then update this list`);
    }
    const d = (id) => streams.streamsById[id].description;
    assert.match(d('fertility').en, /sexual activity/);
    assert.match(d('fertility').en, /abortions/);
    assert.match(d('fertility').fr, /activité sexuelle/);
    assert.match(d('fertility').fr, /interruptions de grossesse/);
    assert.match(d('body').en, /all your laboratory results/);
    assert.match(d('body').en, /intimate/);
    assert.match(d('body').fr, /intimes/);
    assert.match(d('lifestyle').en, /belief/);
    assert.match(d('lifestyle').fr, /conviction/);
    assert.match(d('wellbeing').en, /depression/);
    assert.match(d('wellbeing').fr, /désir sexuel/);
    assert.match(d('profile').en, /ethnicity/);
    assert.match(d('profile').fr, /origine ethnique/);
    assert.match(d('wellbeing').en, /sex drive/);
    assert.match(d('wellbeing').fr, /dépression/);
    assert.match(d('profile').en, /pregnancy/);
    assert.match(d('profile').fr, /grossesse/);
  });
});
