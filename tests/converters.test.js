const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Run the build to generate dist/converters/
require('../src/build');

const distConverters = path.resolve(__dirname, '../dist/converters');

describe('[CNVX] Converters build output', () => {
  describe('[CNVI] Converters index', () => {
    it('[CNVI1] dist/converters/pack.json exists and lists cervical-fluid and mood', () => {
      const pack = JSON.parse(fs.readFileSync(path.join(distConverters, 'pack.json'), 'utf-8'));
      assert.ok(pack['cervical-fluid'], 'cervical-fluid should be in pack');
      assert.ok(pack.mood, 'mood should be in pack');
      assert.strictEqual(pack['cervical-fluid'].latestVersion, 'v1');
      assert.strictEqual(pack.mood.latestVersion, 'v0');
      assert.deepStrictEqual(pack['cervical-fluid'].versions, ['v0', 'v1']);
      assert.deepStrictEqual(pack.mood.versions, ['v0']);
    });
  });

  describe('[CNVV] One pack per converter version (plan 131)', () => {
    const read = (file) => JSON.parse(fs.readFileSync(path.join(distConverters, file), 'utf-8'));
    const { buildPack, byVersion } = require('../src/converters');

    it('[CNVV1] pack-latest.json is the v0 pack without modelVersion, for every item key', () => {
      for (const itemKey of ['cervical-fluid', 'mood']) {
        const v0 = read(`${itemKey}/pack-v0.json`);
        const latest = read(`${itemKey}/pack-latest.json`);
        assert.ok(v0.methods.every(m => m.modelVersion === 'v0'), itemKey);
        assert.ok(latest.methods.every(m => !('modelVersion' in m)), `${itemKey}: pack-latest as published before`);
        assert.deepStrictEqual(latest, { ...v0, methods: v0.methods.map(({ modelVersion, ...m }) => m) }, itemKey);
      }
    });

    it('[CNVV0] every published pack is pinned: a change needs a new converter version', () => {
      const crypto = require('crypto');
      const pinned = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/converter-packs.sha256.json'), 'utf-8'));
      const built = {};
      for (const itemKey of fs.readdirSync(distConverters).filter(f => fs.statSync(path.join(distConverters, f)).isDirectory())) {
        for (const file of fs.readdirSync(path.join(distConverters, itemKey)).filter(f => /^pack-(latest|v\d+)\.json$/.test(f))) {
          built[`${itemKey}/${file}`] = crypto.createHash('sha256').update(JSON.stringify(read(`${itemKey}/${file}`))).digest('hex');
        }
      }
      assert.deepStrictEqual(built, pinned.packs,
        'A published pack is frozen (store builds read it live). Change a method in a new model version and converter ' +
        'version; pin a new pack here only when it is added. Hash: sha256 of JSON.stringify(parsed pack).');
    });

    it('[CNVV6] the loader refuses badly named versions, a yaml version that is not its file name, an orphan model version', () => {
      const { checkVersions } = require('../src/converters');
      const ok = { v0: { version: 'v0' }, v1: { version: 'v1' } };
      assert.doesNotThrow(() => checkVersions('x', ok, { a: { v0: {}, v1: {} } }));
      assert.throws(() => checkVersions('x', { ...ok, 'v1-draft': { version: 'v1-draft' } }, {}), /v<number>/);
      assert.throws(() => checkVersions('x', { v0: { version: 'v1' } }, {}), /declares version "v1"/);
      assert.throws(() => checkVersions('x', ok, { a: { v2: {} } }), /has no converter\/v2\.yaml/);
      assert.throws(() => checkVersions('x', ok, { a: { V1: {} } }), /v<number>/);
    });

    it('[CNVV2] every converter version listed in index.json has its pack', () => {
      for (const itemKey of ['cervical-fluid', 'mood']) {
        const versions = Object.keys(read(`${itemKey}/index.json`).versions);
        for (const v of versions) assert.strictEqual(read(`${itemKey}/pack-${v}.json`).converterVersion, v);
      }
      assert.deepStrictEqual(Object.keys(read('cervical-fluid/index.json').versions).sort(), ['v0', 'v1']);
    });

    it('[CNVV3] cervical-fluid v1 differs from v0 only by its version and Creighton', () => {
      const v0 = read('cervical-fluid/pack-v0.json');
      const v1 = read('cervical-fluid/pack-v1.json');
      assert.deepStrictEqual({ ...v1, converterVersion: 'v0', methods: [] }, { ...v0, methods: [] });
      assert.deepStrictEqual(v1.methods.map(m => m.methodId), v0.methods.map(m => m.methodId));
      for (const m of v1.methods) {
        const old = v0.methods.find(o => o.methodId === m.methodId);
        if (m.methodId === 'creighton') continue;
        assert.deepStrictEqual(m, old, m.methodId);
        assert.strictEqual(m.modelVersion, 'v0');
      }
    });

    it('[CNVV4] Creighton: v0 frozen at the 36 codes before plan 131, v1 the generated list', () => {
      const optionsOf = (pack) => pack.methods.find(m => m.methodId === 'creighton').components[0].options;
      const v0 = read('cervical-fluid/pack-v0.json').methods.find(m => m.methodId === 'creighton');
      const v1 = read('cervical-fluid/pack-v1.json').methods.find(m => m.methodId === 'creighton');
      assert.strictEqual(v0.modelVersion, 'v0');
      assert.strictEqual(v1.modelVersion, 'v1');
      assert.strictEqual(optionsOf(read('cervical-fluid/pack-v0.json')).length, 36);
      assert.strictEqual(v0.notation, undefined);
      assert.ok(optionsOf(read('cervical-fluid/pack-v0.json')).every(o => o.produce === undefined && o.offer === undefined),
        'v0 has no option flags: hds-lib before 2.60.0 does not read them');
      assert.strictEqual(optionsOf(read('cervical-fluid/pack-v1.json')).length, 106);
      assert.ok(v1.notation?.rows?.length > 0);
      // Every v0 code is in v1 with the same vector.
      const v1ByValue = new Map(optionsOf(read('cervical-fluid/pack-v1.json')).map(o => [o.value, o]));
      for (const o of optionsOf(read('cervical-fluid/pack-v0.json'))) {
        assert.deepStrictEqual(v1ByValue.get(o.value)?.vector, o.vector, `${o.value} keeps its vector`);
      }
    });

    it('[CNVV5] a pack takes each method at its newest model version not above the converter version', () => {
      const config = { engine: 'euclidian-distance', eventType: 't/v', dimensionNames: [], dimensions: {} };
      const models = {
        a: { v0: { methodId: 'a', n: 0 }, v2: { methodId: 'a', n: 2 }, v10: { methodId: 'a', n: 10 } },
        b: { v0: { methodId: 'b', n: 0 } },
        c: { v3: { methodId: 'c', n: 3 } }
      };
      const pick = (v) => buildPack('x', v, config, models).methods.map(m => `${m.methodId}${m.n}@${m.modelVersion}`);
      assert.deepStrictEqual(pick('v0'), ['a0@v0', 'b0@v0']);
      assert.deepStrictEqual(pick('v2'), ['a2@v2', 'b0@v0']);
      assert.deepStrictEqual(pick('v9'), ['a2@v2', 'b0@v0', 'c3@v3']);
      assert.deepStrictEqual(pick('v10'), ['a10@v10', 'b0@v0', 'c3@v3']);
      assert.deepStrictEqual(['v10', 'v2', 'v1', 'v0'].sort(byVersion), ['v0', 'v1', 'v2', 'v10']);
    });
  });

  describe('[CNVC] Cervical-fluid converter', () => {
    let index, pack;

    before(() => {
      index = JSON.parse(fs.readFileSync(path.join(distConverters, 'cervical-fluid/index.json'), 'utf-8'));
      pack = JSON.parse(fs.readFileSync(path.join(distConverters, 'cervical-fluid/pack-latest.json'), 'utf-8'));
    });

    it('[CNVC1] index.json has v0 with active status', () => {
      assert.ok(index.versions.v0, 'v0 should exist');
      assert.strictEqual(index.versions.v0.status, 'active');
    });

    it('[CNVC2] pack-latest has correct metadata', () => {
      assert.strictEqual(pack.itemKey, 'cervical-fluid');
      assert.strictEqual(pack.engine, 'euclidian-distance');
      assert.strictEqual(pack.converterVersion, 'v0');
      assert.strictEqual(pack.eventType, 'vulva-mucus-inspect/9d-vector');
    });

    it('[CNVC3] pack-latest has 9 dimensions', () => {
      assert.strictEqual(pack.dimensionNames.length, 9);
      assert.ok(pack.dimensionNames.includes('threadiness'));
      assert.ok(pack.dimensionNames.includes('stretchability'));
      assert.ok(pack.dimensionNames.includes('color'));
    });

    it('[CNVC4] dimension weights sum to 1.0', () => {
      let sum = 0;
      for (const dim of pack.dimensionNames) {
        assert.ok(pack.dimensions[dim], `dimension ${dim} should have a definition`);
        sum += pack.dimensions[dim].weight;
      }
      assert.ok(Math.abs(sum - 1.0) < 0.01, `weights should sum to 1.0, got ${sum}`);
    });

    it('[CNVC5] pack-latest has 12 methods', () => {
      assert.strictEqual(pack.methods.length, 12);
    });

    it('[CNVC6] methods have correct IDs (no removed or old IDs)', () => {
      const ids = pack.methods.map(m => m.methodId).sort();
      const expected = [
        'appleHealth', 'bigelow', 'billings', 'chartneo', 'creighton',
        'descriptive', 'femm', 'justisse', 'marquette', 'mira', 'sensiplan', 'sympto-thermal'
      ].sort();
      assert.deepStrictEqual(ids, expected);
    });

    it('[CNVC9] sensiplan is published as model-cervical-fluid defines it (B-2026-10-26-18)', () => {
      const sensiplan = pack.methods.find(m => m.methodId === 'sensiplan');
      assert.ok(sensiplan, 'sensiplan method should exist');
      assert.strictEqual(sensiplan.order, 30);
      assert.deepStrictEqual(sensiplan.components.map(c => c.field), ['observation']);
      assert.deepStrictEqual(sensiplan.components[0].options.map(o => o.value), ['t', 'ø', 'f', 'S', 'S+']);
      const orders = pack.methods.map(m => m.order);
      assert.strictEqual(new Set(orders).size, orders.length, 'method orders are distinct');
    });

    it('[CNVC12] pickers list Creighton, Sensiplan, then Billings (3.49.2)', () => {
      const sorted = pack.methods.slice().sort((a, b) => (a.order ?? 999) - (b.order ?? 999)).map(m => m.methodId);
      assert.deepStrictEqual(sorted.slice(0, 4), ['creighton', 'sensiplan', 'billings', 'marquette']);
    });

    // The coverline rule each method charts the basal temperature by (3.24.0). Rule ids are those of
    // model-cervical-fluid references/rules/coverline-rules.json; `none` = the method draws no coverline.
    const RULE_IDS = ['sympto-thermal', 'sensiplan', 'manual'];
    const EXPECTED_RULES = {
      'sympto-thermal': 'sympto-thermal',
      sensiplan: 'sensiplan',
      chartneo: 'sensiplan',
      justisse: 'manual',
      billings: 'none',
      creighton: 'none',
      marquette: 'none',
      femm: 'none',
      appleHealth: 'none',
      mira: 'none',
      bigelow: 'none',
      descriptive: 'none'
    };

    it('[CNVC10] the rule catalogue holds the known coverline rule ids, each labelled and sourced', () => {
      assert.deepStrictEqual(Object.keys(pack.temperatureRules).sort(), [...RULE_IDS].sort());
      for (const [id, rule] of Object.entries(pack.temperatureRules)) {
        assert.ok(rule.label.en && rule.label.fr, `${id} label is localised`);
        assert.match(rule.source, /coverline-rules\.json \(version 2026-10-28\)/, `${id} points at a version of the method specification`);
      }
    });

    it('[CNVC11] every method declares a temperatureRule among the known ids or none', () => {
      for (const method of pack.methods) {
        assert.ok([...RULE_IDS, 'none'].includes(method.temperatureRule),
          `${method.methodId} has temperatureRule ${method.temperatureRule}`);
      }
      const actual = Object.fromEntries(pack.methods.map(m => [m.methodId, m.temperatureRule]));
      assert.deepStrictEqual(actual, EXPECTED_RULES);
    });

    describe('[CNVT] temperature rule declaration is checked by the loader', () => {
      const { checkTemperatureRules } = require('../src/converters');
      const rules = { sensiplan: { label: { en: 'Sensiplan' }, source: 'coverline-rules.json' } };
      const methods = [{ methodId: 'a' }, { methodId: 'b' }];

      it('[CNVT-1] a complete declaration is added to each method', () => {
        const out = checkTemperatureRules('x', { temperatureRules: rules, methodTemperatureRule: { a: 'sensiplan', b: 'none' } }, methods);
        assert.deepStrictEqual(out.map(m => m.temperatureRule), ['sensiplan', 'none']);
        assert.strictEqual(methods[0].temperatureRule, undefined, 'the source objects are not mutated');
      });

      it('[CNVT-2] a converter with no declaration is unchanged', () => {
        assert.strictEqual(checkTemperatureRules('mood', {}, methods), methods);
      });

      it('[CNVT-3] a method without an entry is rejected', () => {
        assert.throws(() => checkTemperatureRules('x', { temperatureRules: rules, methodTemperatureRule: { a: 'none' } }, methods),
          /method "b" has no methodTemperatureRule entry/);
      });

      it('[CNVT-4] an unknown rule id is rejected', () => {
        assert.throws(() => checkTemperatureRules('x', { temperatureRules: rules, methodTemperatureRule: { a: 'tcoyf', b: 'none' } }, methods),
          /method "a" has unknown temperatureRule "tcoyf"/);
        assert.throws(() => checkTemperatureRules('x', { temperatureRules: rules, methodTemperatureRule: { a: 'constructor', b: 'none' } }, methods),
          /unknown temperatureRule "constructor"/);
      });

      it('[CNVT-5] an entry for a method not in the pack is rejected', () => {
        assert.throws(() => checkTemperatureRules('x', { temperatureRules: rules, methodTemperatureRule: { a: 'none', b: 'none', c: 'none' } }, methods),
          /unknown method "c"/);
      });

      it('[CNVT-6] "none" cannot be declared as a rule', () => {
        const withNone = { ...rules, none: { label: { en: 'None' }, source: 's' } };
        assert.throws(() => checkTemperatureRules('x', { temperatureRules: withNone, methodTemperatureRule: { a: 'none', b: 'none' } }, methods),
          /"none" is reserved/);
      });
    });

    it('[CNVC7] each method has components with options and vectors', () => {
      for (const method of pack.methods) {
        assert.ok(method.methodId, 'method should have methodId');
        assert.ok(method.name?.en, `method ${method.methodId} should have name.en`);
        assert.ok(Array.isArray(method.components), `method ${method.methodId} should have components array`);
        assert.ok(method.components.length > 0, `method ${method.methodId} should have at least 1 component`);
        for (const comp of method.components) {
          assert.ok(comp.field, 'component should have field');
          assert.ok(Array.isArray(comp.options), 'component should have options');
          assert.ok(comp.options.length > 0, 'component should have at least 1 option');
        }
      }
    });

    it('[CNVC8] mira method has 8 observations', () => {
      const mira = pack.methods.find(m => m.methodId === 'mira');
      assert.ok(mira, 'mira method should exist');
      assert.strictEqual(mira.components[0].options.length, 8);
    });
  });

  describe('[CNVM] Mood converter', () => {
    let index, pack;

    before(() => {
      index = JSON.parse(fs.readFileSync(path.join(distConverters, 'mood/index.json'), 'utf-8'));
      pack = JSON.parse(fs.readFileSync(path.join(distConverters, 'mood/pack-latest.json'), 'utf-8'));
    });

    it('[CNVM1] index.json has v0 with active status', () => {
      assert.ok(index.versions.v0, 'v0 should exist');
      assert.strictEqual(index.versions.v0.status, 'active');
    });

    it('[CNVM2] pack-latest has correct metadata', () => {
      assert.strictEqual(pack.itemKey, 'mood');
      assert.strictEqual(pack.engine, 'euclidian-distance');
      assert.strictEqual(pack.eventType, 'mood/5d-vectors');
    });

    it('[CNVM3] pack-latest has 5 dimensions', () => {
      assert.strictEqual(pack.dimensionNames.length, 5);
      assert.ok(pack.dimensionNames.includes('valence'));
      assert.ok(pack.dimensionNames.includes('arousal'));
      assert.ok(pack.dimensionNames.includes('dominance'));
    });

    it('[CNVM4] dimension weights sum to 1.0', () => {
      let sum = 0;
      for (const dim of pack.dimensionNames) {
        sum += pack.dimensions[dim].weight;
      }
      assert.ok(Math.abs(sum - 1.0) < 0.01, `weights should sum to 1.0, got ${sum}`);
    });

    it('[CNVM5] pack-latest has 4 methods (no hds — replaced by _raw)', () => {
      assert.strictEqual(pack.methods.length, 4);
      const ids = pack.methods.map(m => m.methodId).sort();
      assert.deepStrictEqual(ids, ['appleHealth', 'daylio', 'howWeFeel', 'mira']);
    });

    it('[CNVM6] mira mood method has 16 observations', () => {
      const mira = pack.methods.find(m => m.methodId === 'mira');
      assert.ok(mira, 'mira method should exist');
      assert.strictEqual(mira.components[0].options.length, 16);
    });

    it('[CNVM13] mood declares no temperature rule', () => {
      assert.strictEqual(pack.temperatureRules, undefined);
      for (const method of pack.methods) assert.strictEqual(method.temperatureRule, undefined, method.methodId);
    });

    it('[CNVM7] _raw virtual method replaces hds (auto-generated by engine)', () => {
      // hds method removed — _raw is auto-generated from dimension stops at engine load time
      const hds = pack.methods.find(m => m.methodId === 'hds');
      assert.ok(!hds, 'hds method should not exist in pack (replaced by _raw)');
    });

    it('[CNVM8] appleHealth method has 38 observations', () => {
      const apple = pack.methods.find(m => m.methodId === 'appleHealth');
      assert.ok(apple, 'appleHealth method should exist');
      assert.strictEqual(apple.components.length, 1, 'single component');
      assert.strictEqual(apple.components[0].options.length, 38);
    });

    it('[CNVM10] daylio method has 5 ordinal levels', () => {
      const daylio = pack.methods.find(m => m.methodId === 'daylio');
      assert.ok(daylio, 'daylio method should exist');
      assert.strictEqual(daylio.components[0].options.length, 5);
      const values = daylio.components[0].options.map(o => o.value);
      assert.deepStrictEqual(values, ['rad', 'good', 'meh', 'bad', 'awful']);
    });

    it('[CNVM11] howWeFeel method has 4 quadrants of emotions', () => {
      const hwf = pack.methods.find(m => m.methodId === 'howWeFeel');
      assert.ok(hwf, 'howWeFeel method should exist');
      const options = hwf.components[0].options;
      assert.ok(options.length >= 40, `expected 40+ words, got ${options.length}`);
      // Check all 4 quadrant groups exist
      const groups = new Set(options.map(o => o.group?.en));
      assert.ok(groups.has('High Energy, Pleasant'), 'should have Yellow quadrant');
      assert.ok(groups.has('Low Energy, Pleasant'), 'should have Green quadrant');
      assert.ok(groups.has('High Energy, Unpleasant'), 'should have Red quadrant');
      assert.ok(groups.has('Low Energy, Unpleasant'), 'should have Blue quadrant');
    });

    it('[CNVM9] appleHealth observations have unique vectors', () => {
      const apple = pack.methods.find(m => m.methodId === 'appleHealth');
      const vectors = apple.components[0].options.map(o => JSON.stringify(o.vector));
      const unique = new Set(vectors);
      assert.strictEqual(unique.size, vectors.length, 'all vectors should be unique');
    });

    it('[CNVM12] each valence stop has an accessible display colour', () => {
      // Additive, display only (documentation/MOOD.md). Each colour must keep the WCAG non-text
      // contrast minimum (3:1) against a light and a dark background, so one value serves both themes.
      const luminance = (hex) => {
        const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
          .map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const contrast = (a, b) => {
        const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
        return (hi + 0.05) / (lo + 0.05);
      };
      const stops = pack.dimensions.valence.stops;
      assert.deepStrictEqual(stops.map(s => s.value), [0, 0.25, 0.5, 0.75, 1]);
      for (const stop of stops) {
        assert.match(stop.color ?? '', /^#[0-9a-f]{6}$/, `valence stop ${stop.value} needs a #rrggbb color`);
        for (const background of ['#ffffff', '#121212']) {
          const ratio = contrast(stop.color, background);
          assert.ok(ratio >= 3, `valence stop ${stop.value} ${stop.color} has ${ratio.toFixed(2)}:1 against ${background}`);
        }
      }
      assert.strictEqual(new Set(stops.map(s => s.color)).size, stops.length, 'colours are distinct');
    });
  });

  describe('[CNVR] updatedAt is reproducible (B-2026-10-28-43)', () => {
    const { execFileSync } = require('child_process');
    const git = (args) => execFileSync('git', args, { cwd: path.resolve(__dirname, '..'), encoding: 'utf-8' }).trim();

    it('[CNVR1] a committed, unchanged converter version carries its last commit date, not its mtime', function () {
      const file = 'definitions/converters/cervical-fluid/converter/v0.yaml';
      let committed;
      try {
        if (git(['status', '--porcelain', '--', file]) !== '') this.skip();
        committed = git(['log', '-1', '--format=%cI', '--', file]);
      } catch (e) {
        if (e.code === 'ENOENT' || e.status != null) this.skip();
        throw e;
      }
      if (committed === '') this.skip();
      const index = JSON.parse(fs.readFileSync(path.join(distConverters, 'cervical-fluid/index.json'), 'utf-8'));
      assert.strictEqual(index.versions.v0.updatedAt, new Date(committed).toISOString());
    });
  });
});
