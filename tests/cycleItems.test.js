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
    'fertility-cycles-chart-stamp': ['fertility-cycles-chart-stamp', 'fertility/chart-stamp-v1'],
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

  it('[CYC-2] Cycle Intelligence\'s overlay item stays out of the model: its key and its stream are not canonical', () => {
    // hds-lib validateOverload refuses an overload restating an existing item's type, streamId, eventType or
    // options unless identical (2.24.0), and CI's overlay differs (B-2026-10-28-5). The canonical reading is
    // another key on another stream (fertility-monitor-reading), so CI's model still loads. An overlay may
    // restate the parent stream `fertility-monitor` (same parent: only parentId, role, clientData are checked).
    assert.strictEqual(itemsById['fertility-monitor-lh-marquette'], undefined);
    assert.strictEqual(streams.streamsById['fertility-monitor-lh-marquette'], undefined);
    assert.strictEqual(streams.streamsById['fertility-monitor'].parentId, 'fertility');
    assert.strictEqual(streams.streamsById['fertility-monitor'].role, undefined);
    assert.strictEqual(streams.streamsById['fertility-monitor'].clientData, undefined);
  });

  describe('[CYC-MON] fertility-monitor-reading: a monitor\'s daily Low / High / Peak', () => {
    const item = () => itemsById['fertility-monitor-reading'];

    it('[CYC-MON-1] a select of three string values on its own eventType, one per day', () => {
      assert.strictEqual(item().type, 'select');
      assert.strictEqual(item().eventType, 'fertility/monitor-reading-v1');
      assert.strictEqual(item().repeatable, 'P1D');
      assert.deepStrictEqual(item().options.map(o => o.value), ['low', 'high', 'peak']);
      assert.deepStrictEqual(eventTypesById('fertility/monitor-reading-v1').enum, ['low', 'high', 'peak']);
      for (const o of item().options) assert.ok(o.label.en && o.label.fr, o.value);
      assert.ok(item().label.fr && item().description.fr);
      assert.strictEqual(findItemForEvent('fertility/monitor-reading-v1', 'fertility-monitor-reading'), item());
    });

    it('[CYC-MON-2] its stream sits under fertility-monitor, apart from the tests and the peak days', () => {
      assert.deepStrictEqual(streams.getAncestorsById('fertility-monitor-reading'),
        ['fertility-monitor-reading', 'fertility-monitor', 'fertility']);
      for (const other of ['fertility-test-opk', 'fertility-cycles-lh-peak-day', 'fertility-cycles-peak-day']) {
        assert.ok(!streams.isDescendantOf('fertility-monitor-reading', other), other);
        assert.ok(!streams.isDescendantOf(other, 'fertility-monitor'), other);
      }
    });

    it('[CYC-MON-3] no source or device in the key or the values, no code asserted, no fhir block', () => {
      assert.doesNotMatch(JSON.stringify([item().streamId, item().options.map(o => o.value)]), /clearblue|marquette|mira|inito/i);
      assert.strictEqual(item().references, undefined);
      assert.strictEqual(item().fhir, undefined);
    });

    it('[CYC-MON-4] the reading rules are on the item: not the LH peak day, a missed test is no reading, the device', () => {
      const notes = item().devNotes;
      assert.match(notes, /fertility-cycles-lh-peak-day/);
      assert.match(notes, /never writes that mark by itself/);
      assert.match(notes, /"missed"\) is not a reading: no event is\s+written/);
      assert.match(notes, /clientData\.hdsInstrument/);
      assert.match(notes, /estrogenSurge/);
      assert.match(itemsById['fertility-cycles-lh-peak-day'].devNotes, /fertility-monitor-reading/);
    });
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

  describe('[CYC-STAMP] fertility-cycles-chart-stamp (4.32.0, site-agents#67)', () => {
    it('[CYC-STAMP-1] one per day, under fertility-cycles, out of generic pickers, with no FHIR block', () => {
      const item = itemsById['fertility-cycles-chart-stamp'];
      assert.strictEqual(item.type, 'imported');
      assert.strictEqual(item.repeatable, 'P1D');
      assert.strictEqual(item.fhir, undefined);
      assert.strictEqual(streams.streamsById['fertility-cycles-chart-stamp'].parentId, 'fertility-cycles');
    });

    it('[CYC-STAMP-2] the method and one of six whole stamps', () => {
      const type = eventTypesById('fertility/chart-stamp-v1');
      assert.deepStrictEqual(type.required, ['method', 'stamp']);
      assert.deepStrictEqual(type.properties.stamp.enum, ['red', 'green', 'green-baby', 'white-baby', 'yellow', 'yellow-baby']);
    });

    it('[CYC-STAMP-3] no text names a fertile or infertile day, and the reading rules are on the item', () => {
      const item = itemsById['fertility-cycles-chart-stamp'];
      for (const text of [...Object.values(item.label), ...Object.values(item.description)]) {
        assert.doesNotMatch(text, /fertil/i);
      }
      assert.match(item.devNotes, /never a fertility verdict/);
      assert.match(item.devNotes, /never stores a stamp it drew itself/);
      assert.match(item.devNotes, /on the instructor's\s+instruction only/);
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
      'fertility-cycles-chart-stamp': {
        valid: [{ method: 'creighton', stamp: 'yellow' }, { method: 'billings', stamp: 'white-baby' }],
        invalid: ['yellow', null, { stamp: 'yellow' }, { method: 'creighton' }, { method: '', stamp: 'red' }, { method: 'creighton', stamp: 'red-baby' }]
      },
      'fertility-cycles-lh-peak-day': { valid: [null], invalid: [true, 1] },
      'fertility-monitor-reading': { valid: ['low', 'high', 'peak'], invalid: ['missed', 'Low', 'L', 0, 2, null, { value: 2, relativeTo: 2 }] },
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

  it('[CYC-AVG-PEAK] the average Peak Day is the mucus Peak Day, never a fertility statement (4.11.0, B-2026-10-28-7)', () => {
    const item = itemsById['fertility-cycles-average-peak-day'];
    assert.strictEqual(item.version, 'v2', 'the meaning was fixed in 4.11.0');
    assert.match(item.devNotes, /never an LH peak/);
    assert.match(item.devNotes, /before 4\.11\.0/);
    assert.match(item.description.en, /mucus Peak Day/);
    assert.match(item.description.fr, /jour sommet de la glaire/);
    for (const lang of ['en', 'fr']) assert.doesNotMatch(item.description[lang], /fertility|fertilité/i, lang);
  });
});
