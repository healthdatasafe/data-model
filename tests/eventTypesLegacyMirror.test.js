const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const AjvDraft04 = require('ajv-draft-04');
const addFormats = require('ajv-formats');

const LEGACY_PATH = path.join(__dirname, '../definitions/eventTypes/eventTypes-legacy.json');
const HDS_PATH = path.join(__dirname, '../definitions/eventTypes/eventTypes-hds.json');

// The ten CMC event types are owned by pryv/data-types and hardcoded as ET_* constants in
// @pryv/cmc. HDS code writes them today (hds-lib-js, doctor-dashboard, hds-webapp, bridge-mira,
// bridge-redcap), so the mirror must keep carrying them. They must never be copied into
// eventTypes-hds.json: src/eventTypes.js throws on a duplicate key across the two files.
const CMC_TYPES = [
  'consent/request-cmc',
  'consent/accept-cmc',
  'consent/refuse-cmc',
  'consent/revoke-cmc',
  'consent/back-channel-cmc',
  'consent/scope-request-cmc',
  'consent/scope-update-cmc',
  'consent/invalidate-link-cmc',
  'message/chat-cmc',
  'notification/alert-cmc'
];

describe('[ETLM] eventTypes-legacy.json upstream mirror', () => {
  let legacy;
  let hds;

  before(() => {
    legacy = JSON.parse(fs.readFileSync(LEGACY_PATH, 'utf-8'));
    hds = JSON.parse(fs.readFileSync(HDS_PATH, 'utf-8'));
  });

  describe('[ETLM-AJV] every schema compiles, under both validator flavours', () => {
    // A schema that does not compile makes its event type unwritable wherever it IS compiled,
    // because the compile throws and the caller reports a content-format error. Dictionary 1.1.0
    // shipped four such schemas (numset/*, audiogram/data, clinical/fhir, contact/facebook) for
    // months without anything failing; upstream repaired them in 1.1.2.
    //
    // Both flavours are checked on purpose, because they disagree:
    //   - plain ajv 8 (draft-07) is what a modern JS consumer of the pack will use;
    //   - `ajv-draft-04` plus `ajv-formats` is what open-pryv.io uses
    //     (components/utils/src/jsonValidator.ts).
    // Writing only for draft-07 is how questionnaire/request-v1 came to use a numeric
    // `exclusiveMinimum`, which draft-04 spells incompatibly, so it compiled everywhere we looked
    // and nowhere the platform would have looked. Keep schemas in the portable subset.
    //
    // This matters even though nothing enforces these schemas today: the cores only compile types
    // from pryv's own dictionary, none of the HDS custom types appear there, so a core treats every
    // one of them as unknown and skips content validation entirely ("Unknown types can just be
    // created as normal events", methods/events.ts). These assertions guard latent defects, and the
    // next consumer to compile a schema is the one they protect.
    // Mirrors the core's own options (jsonValidator.ts createValidator): a fresh instance per
    // schema, strict off, formats registered.
    function compileFailures (types, makeAjv) {
      const failures = [];
      for (const [key, schema] of Object.entries(types)) {
        try {
          makeAjv().compile(schema);
        } catch (err) {
          failures.push(key + ': ' + err.message);
        }
      }
      return failures;
    }

    const draft07 = () => new Ajv({ strict: false, allErrors: true, logger: false });
    const draft04 = () => {
      const ajv = new AjvDraft04({ strict: false, allErrors: true, coerceTypes: false, validateFormats: true, logger: false });
      addFormats(ajv);
      return ajv;
    };

    it('[ETLM-AJV-1] all legacy event type schemas compile (ajv 8, draft-07)', () => {
      const failures = compileFailures(legacy.types, draft07);
      assert.deepStrictEqual(failures, [], 'uncompilable legacy schemas:\n' + failures.join('\n'));
    });

    it('[ETLM-AJV-2] all HDS custom event type schemas compile (ajv 8, draft-07)', () => {
      const failures = compileFailures(hds.types, draft07);
      assert.deepStrictEqual(failures, [], 'uncompilable HDS schemas:\n' + failures.join('\n'));
    });

    it('[ETLM-AJV-3] all legacy event type schemas compile (ajv-draft-04, as the cores do)', () => {
      const failures = compileFailures(legacy.types, draft04);
      assert.deepStrictEqual(failures, [], 'legacy schemas the cores could not compile:\n' + failures.join('\n'));
    });

    it('[ETLM-AJV-4] all HDS custom event type schemas compile (ajv-draft-04, as the cores do)', () => {
      const failures = compileFailures(hds.types, draft04);
      assert.deepStrictEqual(failures, [], 'HDS schemas the cores could not compile:\n' + failures.join('\n'));
    });
  });

  describe('[ETLM-CMC] CMC consent types stay present and open', () => {
    it('[ETLM-CMC-1] all ten CMC event types are carried by the mirror', () => {
      const missing = CMC_TYPES.filter((t) => !legacy.types[t]);
      assert.deepStrictEqual(missing, [], 'CMC types missing from the mirror: ' + missing.join(', '));
    });

    it('[ETLM-CMC-2] no CMC type is duplicated into eventTypes-hds.json', () => {
      // src/eventTypes.js throws on any duplicate key, so a copy here breaks the whole build.
      const duplicated = CMC_TYPES.filter((t) => hds.types[t]);
      assert.deepStrictEqual(duplicated, [], 'CMC types must stay upstream-owned: ' + duplicated.join(', '));
    });

    it('[ETLM-CMC-3] notification/alert-cmc still accepts the plan 90 data-export envelope', () => {
      // buildDataExportRequestContent (hds-lib-js ts/cmc/dataExport.ts) rides an `hds` key that
      // this upstream schema does not declare. Asserting `additionalProperties !== false` was too
      // narrow: a tightening could also arrive as an additionalProperties SCHEMA, as
      // patternProperties, or as an `hds` property declared with a conflicting type. Compiling the
      // real schema and validating a representative envelope catches all of those.
      const schema = legacy.types['notification/alert-cmc'];
      assert.ok(schema, 'notification/alert-cmc should exist');
      const ajv = new Ajv({ strict: false, allErrors: true, logger: false });
      const validate = ajv.compile(schema);
      const envelope = {
        level: 'info',
        title: { en: 'Data export request' },
        body: { en: 'A data export has been requested.' },
        ackRequired: true,
        ackId: '11111111-2222-3333-4444-555555555555',
        hds: { kind: 'data-export-request', requestedAt: '2026-09-17T00:00:00.000Z' }
      };
      assert.ok(
        validate(envelope),
        'the plan 90 data-export envelope no longer validates against notification/alert-cmc: ' +
          JSON.stringify(validate.errors) +
          '\nRe-check hds-lib-js ts/cmc/dataExport.ts before taking this mirror.'
      );
    });
  });

  describe('[ETLM-INLINE] inlined shapes stay in step with the type they copy', () => {
    it('[ETLM-INLINE-1] medication/prescription-v1 posology.frequency matches frequency/times-period', () => {
      // The $ref was inlined because schemas compile standalone ([ETLM-REF]). Inlining duplicates
      // the shape, so the two copies can now drift silently. They are one concept and must agree
      // on everything except the description, which is deliberately more specific at the use site.
      const inlined = { ...hds.types['medication/prescription-v1'].properties.posology.properties.frequency };
      const standalone = { ...hds.types['frequency/times-period'] };
      delete inlined.description;
      delete standalone.description;
      assert.deepStrictEqual(
        inlined,
        standalone,
        'the inlined frequency shape has drifted from the standalone frequency/times-period type'
      );
    });
  });

  describe('[ETLM-REF] no schema relies on cross-type $ref', () => {
    // Event type schemas are compiled one at a time, with no dictionary root to resolve against
    // (jsonValidator.ts createValidator builds a fresh ajv per schema), so a "#/types/..." pointer
    // cannot resolve and the compile throws. medication/prescription-v1 shipped that way in
    // be77036; it went unnoticed because nothing compiles the HDS schemas yet (see [ETLM-AJV-2]).
    // Upstream's 354 types contain no $ref at all. Inline the shape instead.
    it('[ETLM-REF-1] no legacy schema contains a $ref', () => {
      const offenders = Object.keys(legacy.types).filter((k) => JSON.stringify(legacy.types[k]).includes('"$ref"'));
      assert.deepStrictEqual(offenders, [], 'legacy schemas using $ref: ' + offenders.join(', '));
    });

    it('[ETLM-REF-2] no HDS schema contains a $ref', () => {
      const offenders = Object.keys(hds.types).filter((k) => JSON.stringify(hds.types[k]).includes('"$ref"'));
      assert.deepStrictEqual(offenders, [], 'HDS schemas using $ref (inline them instead): ' + offenders.join(', '));
    });
  });

  describe('[ETLM-APPS] appStreams eventTypes resolve', () => {
    // src/appStreams.js does not check that the eventType it names exists. appStreams.yaml
    // referenced message/hds-chat-v1 and settings/hds-react-timeline while neither was declared
    // in either dictionary, so the model published app streams keyed on types it never defined:
    // a consumer resolving the stream found no schema, no label and no unit behind its eventType.
    it('[ETLM-APPS-1] every eventType named in appStreams.yaml is declared', () => {
      const yaml = require('yaml');
      const source = fs.readFileSync(path.join(__dirname, '../definitions/appStreams.yaml'), 'utf-8');
      const appStreams = yaml.parse(source);
      const missing = [];
      for (const [key, def] of Object.entries(appStreams)) {
        const eventType = def && def.eventType;
        if (eventType == null) continue;
        if (!legacy.types[eventType] && !hds.types[eventType]) missing.push(key + ' -> ' + eventType);
      }
      assert.deepStrictEqual(missing, [], 'appStreams eventTypes not declared: ' + missing.join(', '));
    });
  });

  describe('[ETLM-KEYS] the two dictionaries stay disjoint', () => {
    it('[ETLM-KEYS-1] no key collides between legacy and HDS types', () => {
      const collisions = Object.keys(hds.types).filter((k) => legacy.types[k]);
      assert.deepStrictEqual(collisions, [], 'colliding type keys: ' + collisions.join(', '));
    });

    it('[ETLM-KEYS-2] no key collides between legacy and HDS extras', () => {
      const legacyExtras = legacy.extras || {};
      const hdsExtras = hds.extras || {};
      const collisions = Object.keys(hdsExtras).filter((k) => legacyExtras[k]);
      assert.deepStrictEqual(collisions, [], 'colliding extra keys: ' + collisions.join(', '));
    });
  });
});
