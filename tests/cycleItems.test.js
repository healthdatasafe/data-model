const assert = require('assert');
const Ajv = require('ajv');
const AjvDraft04 = require('ajv-draft-04');
const addFormats = require('ajv-formats');

// Cycle items of 3.24.0: the per-cycle coverline, the LH peak day beside the mucus Peak Day
// (B-2026-10-26-19), and the Billings label (B-2026-10-28-2). See documentation/MENSTRUAL-CYCLE.md.

describe('[CYC] Cycle items (3.24.0)', () => {
  const { itemsById, findItemForEvent } = require('../src/items');
  const streams = require('../src/streams');
  const { eventTypesById } = require('../src/eventTypes');

  const PAIRS = {
    'fertility-cycles-coverline': ['fertility-cycles-coverline', 'temperature/c'],
    'fertility-cycles-lh-peak-day': ['fertility-cycles-lh-peak-day', 'activity/plain'],
    'fertility-cycles-peak-day': ['fertility-cycles-peak-day', 'activity/plain']
  };

  it('[CYC-1] each item owns its streamId:eventType pair', () => {
    for (const [key, [streamId, eventType]] of Object.entries(PAIRS)) {
      const item = itemsById[key];
      assert.ok(item, `${key} must exist`);
      assert.strictEqual(item.streamId, streamId);
      assert.strictEqual(item.eventType, eventType);
      assert.strictEqual(findItemForEvent(eventType, streamId), item, key);
      assert.ok(item.label.fr && item.description.fr, `${key} is localised`);
      assert.ok(!item.deprecated, `${key} is active`);
    }
  });

  it('[CYC-2] the fertility monitor item is deferred while Cycle Intelligence carries it in its overlay', () => {
    // Before hds-lib 2.24.0, validateOverload refuses an overload restating an existing item's type,
    // streamId, eventType or options, so making it canonical would break Cycle Intelligence's model
    // load. It ships once CI runs hds-lib >= 2.24.0 with an overlay matching the canonical item exactly
    // (its option labels differ today, B-2026-10-28-5) or lists the key in UPSTREAM_ITEM_KEYS. Kept on
    // branch feature/marquette-monitor-item; see CHANGELOG 3.24.0.
    assert.strictEqual(itemsById['fertility-monitor-lh-marquette'], undefined);
    assert.strictEqual(streams.streamsById['fertility-monitor'], undefined);
  });

  describe('[CYC-COV] fertility-cycles-coverline', () => {
    it('[CYC-COV-1] one number in °C per cycle, under fertility-cycles', () => {
      const item = itemsById['fertility-cycles-coverline'];
      assert.strictEqual(item.type, 'number');
      assert.strictEqual(item.repeatable, 'P1D');
      assert.strictEqual(eventTypesById(item.eventType).description, 'Celsius');
      assert.strictEqual(streams.streamsById['fertility-cycles-coverline'].parentId, 'fertility-cycles');
    });

    it('[CYC-COV-2] the basal temperature and the coverline resolve to different items', () => {
      assert.strictEqual(findItemForEvent('temperature/c', 'body-temperature-basal'), itemsById['body-temperature-basal']);
      assert.strictEqual(findItemForEvent('temperature/c', 'fertility-cycles-coverline'), itemsById['fertility-cycles-coverline']);
    });

    it('[CYC-COV-3] the hdsBasis values are documented on the item', () => {
      const notes = itemsById['fertility-cycles-coverline'].devNotes;
      assert.match(notes, /clientData\.hdsBasis/);
      assert.match(notes, /'manual'/);
      assert.match(notes, /'auto'/);
      assert.match(notes, /never a stored 'auto'/, 'one precedence rule for readers');
      assert.match(notes, /apps that compute never store 'auto'/);
      assert.match(notes, /clientData\.related\.<cycleStartEventId>/);
    });
  });

  describe('[CYC-PEAK] two peaks, two items (B-2026-10-26-19)', () => {
    it('[CYC-PEAK-1] the mucus Peak Day and the LH peak day are sibling streams', () => {
      for (const id of ['fertility-cycles-peak-day', 'fertility-cycles-lh-peak-day']) {
        assert.strictEqual(streams.streamsById[id].parentId, 'fertility-cycles', id);
      }
      assert.ok(!streams.isDescendantOf('fertility-cycles-lh-peak-day', 'fertility-cycles-peak-day'),
        'a permission on the mucus Peak Day must not grant the LH peak');
      assert.ok(!streams.isDescendantOf('fertility-cycles-peak-day', 'fertility-cycles-lh-peak-day'));
    });

    it('[CYC-PEAK-2] the Peak Day says it is the mucus peak, not the LH peak', () => {
      const item = itemsById['fertility-cycles-peak-day'];
      assert.match(item.description.en, /mucus/);
      assert.match(item.devNotes, /never the LH peak/);
      assert.strictEqual(item.version, 'v2', 'the meaning changed in 3.24.0');
      assert.match(item.devNotes, /before 3\.24\.0 by Cycle\s+Intelligence/);
      assert.doesNotMatch(item.description.en, /fertility/i, 'chart notation, not a fertility statement');
      assert.match(itemsById['fertility-cycles-lh-peak-day'].description.en, /LH/);
    });
  });

  describe('[CYC-AJV] contents validate under both validators', () => {
    // Plain ajv 8 (draft-07) is what a JS consumer of the pack uses; ajv-draft-04 + ajv-formats is
    // what open-pryv.io would enforce if the HDS types were ever in its dictionary.
    const validators = {
      'draft-07': new Ajv({ strict: false, allErrors: true, logger: false }),
      'draft-04': (() => {
        const ajv = new AjvDraft04({ strict: false, allErrors: true, coerceTypes: false, validateFormats: true, logger: false });
        addFormats(ajv);
        return ajv;
      })()
    };
    const CASES = {
      'fertility-cycles-coverline': { valid: [36.5, 36.45], invalid: ['36.5', null, { value: 36.5 }] },
      'fertility-cycles-lh-peak-day': { valid: [null], invalid: [true, 1] },
      'fertility-cycles-peak-day': { valid: [null], invalid: [true, 1] }
    };

    for (const [flavour, ajv] of Object.entries(validators)) {
      it(`[CYC-AJV-${flavour}] valid contents pass, invalid ones fail`, () => {
        for (const [key, { valid, invalid }] of Object.entries(CASES)) {
          const validate = ajv.compile(eventTypesById(itemsById[key].eventType));
          for (const content of valid) assert.ok(validate(content), `${key} ${JSON.stringify(content)}: ${JSON.stringify(validate.errors)}`);
          for (const content of invalid) assert.ok(!validate(content), `${key} accepted ${JSON.stringify(content)}`);
        }
      });
    }
  });

  describe('[CYC-BIL] fertility-tracking-method Billings label (B-2026-10-28-2)', () => {
    it('[CYC-BIL-1] the option is labelled "Billings", value kept', () => {
      const option = itemsById['fertility-tracking-method'].options.find(o => o.value === 'billings');
      assert.ok(option, 'the billings value is kept');
      assert.deepStrictEqual(option.label, { en: 'Billings', fr: 'Billings' });
    });

    it('[CYC-BIL-2] no option label carries a full method denomination', () => {
      for (const option of itemsById['fertility-tracking-method'].options) {
        for (const text of Object.values(option.label)) {
          assert.doesNotMatch(text, /Ovulation Method|Méthode (de l'ovulation )?Billings|\bBOM\b|\bMOB\b/i, `${option.value}: ${text}`);
        }
      }
    });

    it('[CYC-BIL-3] sensiplan is in the converter pack only, not a tracking-method option', () => {
      assert.ok(!itemsById['fertility-tracking-method'].options.some(o => o.value === 'sensiplan'));
    });
  });
});
