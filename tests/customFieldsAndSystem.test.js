const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('[CFSX] Custom fields & system stream (Plan 45)', () => {
  describe('[CFS-EVT] eventTypes registry', () => {
    let types;

    before(() => {
      const hdsTypes = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../definitions/eventTypes/eventTypes-hds.json'), 'utf-8')
      );
      types = hdsTypes.types;
    });

    it('[CFS-EVT-1] message/system-alert is registered', () => {
      assert.ok(types['message/system-alert'], 'message/system-alert should exist');
      assert.strictEqual(types['message/system-alert'].type, 'object');
      assert.deepStrictEqual(types['message/system-alert'].required.sort(), ['body', 'level', 'title']);
    });

    it('[CFS-EVT-2] message/system-alert has level enum info/warning/critical', () => {
      const enums = types['message/system-alert'].properties.level.enum;
      assert.deepStrictEqual(enums, ['info', 'warning', 'critical']);
    });

    it('[CFS-EVT-3] message/system-alert has optional ackRequired + ackId', () => {
      const props = types['message/system-alert'].properties;
      assert.strictEqual(props.ackRequired.type, 'boolean');
      assert.strictEqual(props.ackId.format, 'uuid');
    });

    it('[CFS-EVT-4] message/system-ack is registered', () => {
      assert.ok(types['message/system-ack'], 'message/system-ack should exist');
      assert.deepStrictEqual(types['message/system-ack'].required.sort(), ['ackId', 'ackedAt']);
    });

    it('[CFS-EVT-5] message/system-ack ackId has uuid format', () => {
      assert.strictEqual(types['message/system-ack'].properties.ackId.format, 'uuid');
    });

    it('[CFS-EVT-6] message/system-ack ackedAt has date-time format', () => {
      assert.strictEqual(types['message/system-ack'].properties.ackedAt.format, 'date-time');
    });
  });

  describe('[CFS-AS] appStreams declarations', () => {
    let appStreams;

    before(() => {
      const yaml = require('js-yaml');
      appStreams = yaml.load(
        fs.readFileSync(path.join(__dirname, '../definitions/appStreams.yaml'), 'utf-8')
      );
    });

    it('[CFS-AS-1] notes / chat / system-out / system-in all declared', () => {
      assert.ok(appStreams.notes);
      assert.ok(appStreams.chat);
      assert.ok(appStreams['system-out']);
      assert.ok(appStreams['system-in']);
    });

    it('[CFS-AS-2] system-out points at message/system-alert', () => {
      assert.strictEqual(appStreams['system-out'].suffix, 'system-out');
      assert.strictEqual(appStreams['system-out'].eventType, 'message/system-alert');
    });

    it('[CFS-AS-3] system-in points at message/system-ack', () => {
      assert.strictEqual(appStreams['system-in'].suffix, 'system-in');
      assert.strictEqual(appStreams['system-in'].eventType, 'message/system-ack');
    });
  });

  describe('[CFS-PACK] built pack.json', () => {
    let pack;

    before(() => {
      const packPath = path.join(__dirname, '../dist/pack.json');
      if (!fs.existsSync(packPath)) {
        // Build hasn't run yet — skip this block (npm run build is required).
        return;
      }
      pack = JSON.parse(fs.readFileSync(packPath, 'utf-8'));
    });

    it('[CFS-PACK-1] pack.eventTypes.types includes both new message/* impls', () => {
      if (!pack) return; // Skip if pack hasn't been built
      assert.ok(pack.eventTypes.types['message/system-alert']);
      assert.ok(pack.eventTypes.types['message/system-ack']);
    });

    it('[CFS-PACK-2] pack.appStreams includes system-out + system-in', () => {
      if (!pack) return;
      assert.ok(pack.appStreams['system-out']);
      assert.ok(pack.appStreams['system-in']);
    });
  });
});
