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
      assert.strictEqual(pack['cervical-fluid'].latestVersion, 'v0');
      assert.strictEqual(pack.mood.latestVersion, 'v0');
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

    it('[CNVC5] pack-latest has 11 methods', () => {
      assert.strictEqual(pack.methods.length, 11);
    });

    it('[CNVC6] methods have correct IDs (no removed or old IDs)', () => {
      const ids = pack.methods.map(m => m.methodId).sort();
      const expected = [
        'appleHealth', 'bigelow', 'billings', 'chartneo', 'creighton',
        'descriptive', 'femm', 'justisse', 'marquette', 'mira', 'sympto-thermal'
      ].sort();
      assert.deepStrictEqual(ids, expected);
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

    it('[CNVM5] pack-latest has 3 methods (appleHealth + hds + mira)', () => {
      assert.strictEqual(pack.methods.length, 3);
      const ids = pack.methods.map(m => m.methodId).sort();
      assert.deepStrictEqual(ids, ['appleHealth', 'hds', 'mira']);
    });

    it('[CNVM6] mira mood method has 16 observations', () => {
      const mira = pack.methods.find(m => m.methodId === 'mira');
      assert.ok(mira, 'mira method should exist');
      assert.strictEqual(mira.components[0].options.length, 16);
    });

    it('[CNVM7] hds method has 5 components (one per dimension)', () => {
      const hds = pack.methods.find(m => m.methodId === 'hds');
      assert.ok(hds, 'hds method should exist');
      assert.strictEqual(hds.components.length, 5);
    });

    it('[CNVM8] appleHealth method has 38 observations', () => {
      const apple = pack.methods.find(m => m.methodId === 'appleHealth');
      assert.ok(apple, 'appleHealth method should exist');
      assert.strictEqual(apple.components.length, 1, 'single component');
      assert.strictEqual(apple.components[0].options.length, 38);
    });

    it('[CNVM9] appleHealth observations have unique vectors', () => {
      const apple = pack.methods.find(m => m.methodId === 'appleHealth');
      const vectors = apple.components[0].options.map(o => JSON.stringify(o.vector));
      const unique = new Set(vectors);
      assert.strictEqual(unique.size, vectors.length, 'all vectors should be unique');
    });
  });
});
