const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const AjvDraft04 = require('ajv-draft-04');
const addFormats = require('ajv-formats');

const HDS_PATH = path.join(__dirname, '../definitions/eventTypes/eventTypes-hds.json');

describe('[DSET] Display symbols and app settings types', () => {
  let hds;
  const { itemsById } = require('../src/items');

  before(() => {
    hds = JSON.parse(fs.readFileSync(HDS_PATH, 'utf-8'));
  });

  describe('[DSET-SET] settings types on the webapp-settings app stream stay open', () => {
    // Their shape is owned by the app or component that writes them. A `required` or a closed
    // object here would make every new setting unwritable until the model is republished.
    const SETTINGS_TYPES = ['settings/hds-react-timeline', 'settings/hds-webapp-diary'];
    const validatorsFor = (schema) => {
      const draft04 = new AjvDraft04({ strict: false, allErrors: true, logger: false });
      addFormats(draft04);
      return [new Ajv({ strict: false, allErrors: true, logger: false }).compile(schema), draft04.compile(schema)];
    };

    it('[DSET-SET-1] each is an object with no required key and no closed additionalProperties', () => {
      for (const key of SETTINGS_TYPES) {
        const schema = hds.types[key];
        assert.ok(schema, key + ' must be declared');
        assert.strictEqual(schema.type, 'object', key);
        assert.strictEqual(schema.required, undefined, key + ' must not require keys');
        assert.ok(schema.additionalProperties === undefined || schema.additionalProperties === true, key + ' must stay open');
      }
    });

    it('[DSET-SET-2] settings/hds-webapp-diary accepts the Diary layout, nulls and unknown keys', () => {
      const layout = {
        v: 1,
        order: ['mood', 'body-weight'],
        visible: null,
        collapsed: ['custom'],
        customSeries: ['body-weight', 'body-temperature-basal'],
        customAdded: true,
        customName: '',
        cycleHidden: false,
        medsHidden: true,
        signCards: { 'body-temperature-basal': true },
        cycleTiles: { order: null, on: {} },
        chartRows: { order: ['temp'], on: { temp: true } },
        chartView: null,
        hiddenLines: { 'body-temperature-basal': ['instrument:i-mvs6jbps-jq8r'] },
        pastCyclesAsRecorded: false,
        setupDone: true,
        methodLater: false,
        learnt: ['diary-cards'],
        tipsSeen: ['diary'],
        dailyKinds: ['mood'],
        goals: null,
        aSettingAddedLater: { anything: 1 }
      };
      for (const validate of validatorsFor(hds.types['settings/hds-webapp-diary'])) {
        assert.ok(validate(layout), JSON.stringify(validate.errors));
        assert.ok(validate({}), 'an empty settings event is valid');
        assert.ok(validate({ ...layout, visible: ['mood'], chartView: 'all', goals: ['cycle'] }), JSON.stringify(validate.errors));
        // v 2: the person's own cards (a composite's field as '<item key>#<field>')
        assert.ok(validate({ ...layout, v: 2, cards: [{ id: 'custom', name: '', items: ['body-weight', 'body-blood-pressure#rate'] }] }), JSON.stringify(validate.errors));
        // ⭐ entries: the app's cycle entry replaced, and one of the person's own
        assert.ok(validate({ ...layout, stars: [{ id: 'cycle', group: 'cycle', items: ['body-vulva-bleeding', 'body-vulva-mucus-inspect'] }, { id: 'star-a1b2c3d4', group: 'sym', name: 'Evening', items: ['symptom-pain-severity', 'wellbeing-mood'] }] }), JSON.stringify(validate.errors));
        // ⭐ entries: the app's cycle entry taken off (no group needed)
        assert.ok(validate({ ...layout, stars: [{ id: 'cycle', items: [] }] }), JSON.stringify(validate.errors));
        // "remember it?" prompts declined for good (an id this reader does not know is kept)
        assert.ok(validate({ ...layout, rememberNever: ['charting-method', 'some-later-prompt'] }), JSON.stringify(validate.errors));
        // the per-item prompts: an input method, a unit, and one for an item key this model does not have (kept)
        assert.ok(validate({ ...layout, rememberNever: ['input-method:wellbeing-mood', 'unit:body-weight', 'unit:some-later-item'] }), JSON.stringify(validate.errors));
      }
    });
  });

  describe('[DSET-DYN] hds-lib dynamic settings types (B-2026-11-25-17)', () => {
    // hds-lib HDSSettings.setDynamic writes `{ itemKey, value }` (ts/settings/HDSSettings.ts, DYNAMIC_PREFIXES): itemKey is
    // the key after the prefix, value whatever the app sets. A null value deletes the event, so none is stored.
    const DYNAMIC = { 'settings/preferred-display': 'preferred-display-', 'settings/preferred-input': 'preferred-input-' };
    const validatorsFor = (schema) => {
      const draft04 = new AjvDraft04({ strict: false, allErrors: true, logger: false });
      addFormats(draft04);
      return [new Ajv({ strict: false, allErrors: true, logger: false }).compile(schema), draft04.compile(schema)];
    };
    // What hds-lib writes for a key and a value, as setDynamic builds it
    const contentOf = (prefix, key, value) => ({ itemKey: key.slice(prefix.length), value });

    it('[DSET-DYN-1] both are declared', () => {
      for (const type of Object.keys(DYNAMIC)) assert.ok(hds.types[type], type + ' must be declared');
    });

    it('[DSET-DYN-2] they accept the content hds-lib writes, for the values the apps set', () => {
      const writes = {
        'settings/preferred-display': [
          ['preferred-display-body-vulva-mucus-inspect', 'billings'],
          ['preferred-display-cervical-cycle', 'creighton'],
          ['preferred-display-cervical-cycle-force-convert', false],
          ['preferred-display-timeline', { scale: 'month', items: {} }],
          ['preferred-display-cycles-view', { mode: 'grid' }]
        ],
        'settings/preferred-input': [
          ['preferred-input-wellbeing-mood', 'daylio'],
          ['preferred-input-body-weight', 'mass/lb'],
          ['preferred-input-mood', 'apple-healthkit'],
          ['preferred-input-fertility-cycles-chart-stamp', { peak: true }],
          ['preferred-input-some-item', 3],
          ['preferred-input-some-item', ['a', 'b']]
        ]
      };
      for (const [type, cases] of Object.entries(writes)) {
        for (const validate of validatorsFor(hds.types[type])) {
          for (const [key, value] of cases) {
            const content = contentOf(DYNAMIC[type], key, value);
            assert.ok(validate(content), type + ' ' + JSON.stringify(content) + ': ' + JSON.stringify(validate.errors));
          }
        }
      }
    });

    it('[DSET-DYN-3] they refuse a content hds-lib never writes', () => {
      for (const type of Object.keys(DYNAMIC)) {
        for (const validate of validatorsFor(hds.types[type])) {
          for (const content of [{}, { itemKey: 'x' }, { value: 'x' }, { itemKey: '', value: 'x' }, { itemKey: 'x', value: null }, { itemKey: 1, value: 'x' }, { itemKey: 'x', value: 'y', extra: 1 }, 'x']) {
            assert.ok(!validate(content), type + ' must refuse ' + JSON.stringify(content));
          }
        }
      }
    });
  });

  describe('[DSET-SYM] unit symbols', () => {
    it('[DSET-SYM-1] cell counts show the notation lab reports print', () => {
      // 10⁶/mL = 10⁹/L (G/L, WBC and platelets); 10⁹/mL = 10¹²/L (T/L, RBC). Same stored number.
      assert.strictEqual(hds.extras['concentration/megacount-ml'].symbol, 'G/L');
      assert.strictEqual(hds.extras['concentration/gigacount-ml'].symbol, 'T/L');
    });

    it('[DSET-SYM-2] sperm concentration keeps its own 10⁶/mL notation', () => {
      const item = itemsById['body-semen-concentration'];
      assert.strictEqual(item.eventType, 'concentration/megacount-ml');
      assert.deepStrictEqual(item.number.display.suffix, { en: '10⁶/mL', fr: '10⁶/mL' });
    });

    it('[DSET-SYM-3] no HDS-owned symbol or unit label spells kilograms "Kg"', () => {
      // B-2026-10-26-15. The legacy mirror's mass/kg symbol is pryv's and can only change upstream.
      const offenders = [];
      for (const [key, extra] of Object.entries(hds.extras)) {
        if (/\bKg\b/.test(extra.symbol ?? '')) offenders.push('extras ' + key);
      }
      for (const [key, item] of Object.entries(itemsById)) {
        for (const option of item.variations?.eventType?.options ?? []) {
          for (const text of Object.values(option.label ?? {})) {
            if (/\bKg\b/.test(text)) offenders.push(key + ' ' + option.value);
          }
        }
      }
      assert.deepStrictEqual(offenders, []);
      assert.strictEqual(itemsById['body-weight'].variations.eventType.options[0].label.en, 'kg');
    });
  });
});
