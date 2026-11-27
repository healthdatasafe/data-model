const assert = require('assert');

// Premenstrual-checklist gaps of an intake form: mood swings (site-agents#68) and oily hair or scalp (site-agents#69).
// Each is a symptom twin pair on one stream: a presence marker at the base key and a graded `-severity` item on the
// 5-level symptom scale, the shape of symptom-dermatological-hair-loss and its severity variant.

describe('[MSOH] Mood swings and oily hair (site-agents#68, #69)', () => {
  const { itemsById, findItemForEvent } = require('../src/items');
  const streams = require('../src/streams');

  const PAIRS = [
    { key: 'wellbeing-mood-swings', parent: 'wellbeing', snomed: '18963009' },
    { key: 'symptom-dermatological-hair-oily', parent: 'symptom-dermatological', snomed: '67295004' }
  ];
  const sibling = itemsById['symptom-dermatological-hair-loss-severity'];

  for (const { key, parent, snomed } of PAIRS) {
    const presence = itemsById[key];
    const severity = itemsById[`${key}-severity`];

    it(`[MSOH-1] ${key}: a presence marker, hidden from pickers, on its own stream under ${parent}`, () => {
      assert.strictEqual(presence.eventType, 'activity/plain');
      assert.strictEqual(presence.type, 'checkbox');
      assert.strictEqual(presence.deprecated, true);
      assert.strictEqual(presence.streamId, key);
      assert.strictEqual(streams.streamsById[key].parentId, parent);
      assert.match(presence.description.en, new RegExp(`use ${key}-severity when a severity is known`));
      assert.ok(presence.label.fr && presence.description.fr);
    });

    it(`[MSOH-2] ${key}-severity: the active graded twin on the same stream, the 5-level symptom scale`, () => {
      assert.strictEqual(severity.eventType, 'ratio/proportion');
      assert.strictEqual(severity.type, 'select');
      assert.strictEqual(severity.deprecated, undefined);
      assert.strictEqual(severity.streamId, key);
      assert.deepStrictEqual(severity.options, sibling.options);
      assert.strictEqual(severity.label.en, presence.label.en);
      assert.ok(severity.label.fr && severity.description.fr);
    });

    // Oily hair is a symptom stream, so it maps with the symptom family (plan 133): its one SNOMED finding is the value.
    const mapped = parent.startsWith('symptom');
    it(`[MSOH-3] ${key}: each twin resolves from its event, one SNOMED finding on both, ${mapped ? 'the symptom fhir block' : 'no fhir block'}`, () => {
      assert.strictEqual(findItemForEvent('activity/plain', key), presence);
      assert.strictEqual(findItemForEvent('ratio/proportion', key), severity);
      for (const i of [presence, severity]) {
        assert.deepStrictEqual(i.references.snomed, [snomed]);
        assert.strictEqual(i.repeatable, 'unlimited');
        if (!mapped) assert.strictEqual(i.fhir, undefined);
        else assert.deepStrictEqual(i.fhir.value.codings, [{ system: 'http://snomed.info/sct', code: snomed, display: 'Greasy hair' }]);
      }
    });
  }
});
