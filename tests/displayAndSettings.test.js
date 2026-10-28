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
