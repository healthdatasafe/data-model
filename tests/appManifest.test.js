const assert = require('assert');

// The app manifest an implementer serves (`hdsApp.manifest`). See documentation/APP-DESCRIPTION.md.

describe('[APPM] App manifest — hds-app-manifest', () => {
  const { checkAppManifest, toBePublished } = require('../src/schemas/appManifest');
  const base = () => ({ format: 'hds-app-manifest', formatVersion: 1, appCode: 'dysnet-registry', name: { en: 'DysNet' } });

  it('[APPM-1] the minimal manifest and the full example are valid; unknown fields are allowed', () => {
    checkAppManifest(base());
    checkAppManifest({
      ...base(),
      name: { en: 'DysNet', fr: 'DysNet' },
      description: { en: 'The online dysmelia community', fr: 'La communauté en ligne de la dysmélie' },
      icon: 'https://dysnet.org/hds/icon-256.png',
      provider: { name: { en: 'DysNet (dysnet.org)' }, url: 'https://dysnet.org/' },
      open: { web: 'https://dev.dysnet.org/', ios: 'https://apps.apple.com/app/id0000000000', android: 'https://play.google.com/store/apps/details?id=org.dysnet' },
      privacy: { en: 'https://dysnet.org/privacy', fr: 'https://dysnet.org/fr/confidentialite' },
      support: 'https://dysnet.org/contact',
      later: { anything: true }
    });
  });

  it('[APPM-2] format, formatVersion 1, appCode and an English name are required', () => {
    for (const key of ['format', 'formatVersion', 'appCode', 'name']) {
      const m = base();
      delete m[key];
      assert.throws(() => checkAppManifest(m), new RegExp(key));
    }
    assert.throws(() => checkAppManifest({ ...base(), format: 'hds-legal-manifest' }));
    assert.throws(() => checkAppManifest({ ...base(), formatVersion: 2 }));
    assert.throws(() => checkAppManifest({ ...base(), name: { fr: 'DysNet' } }));
  });

  it('[APPM-3] every link is https', () => {
    assert.throws(() => checkAppManifest({ ...base(), icon: 'http://dysnet.org/icon.png' }));
    assert.throws(() => checkAppManifest({ ...base(), open: { web: 'javascript:alert(1)' } }));
    assert.throws(() => checkAppManifest({ ...base(), privacy: { en: 'https://dysnet.org/p', fr: 'ftp://dysnet.org/p' } }));
    assert.throws(() => checkAppManifest({ ...base(), privacy: { fr: 'https://dysnet.org/p' } }));
    assert.throws(() => checkAppManifest({ ...base(), support: 'mailto:help@dysnet.org' }));
    assert.throws(() => checkAppManifest({ ...base(), icon: 'https://u:p@dysnet.org/icon.png' }));
    assert.throws(() => checkAppManifest({ ...base(), support: 'https://' }));
  });

  it('[APPM-5] the published schema compiles under Ajv strict mode, with defs.json', () => {
    const Ajv = require('ajv');
    const { defsSchema } = require('../src/schemas/items');
    const [file] = toBePublished();
    const ajv = new Ajv({ strict: true, schemas: [file.content, defsSchema] });
    assert.ok(ajv.getSchema(file.content.$id));
  });

  it('[APPM-4] published with the pack as json-schemas/hds-app-manifest.json', () => {
    const [file] = toBePublished();
    assert.strictEqual(file.path + file.filename, './json-schemas/hds-app-manifest.json');
    assert.strictEqual(file.content.$id, 'https://model.datasafe.dev/json-schemas/hds-app-manifest.json');
  });
});
