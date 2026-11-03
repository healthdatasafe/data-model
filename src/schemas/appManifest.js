const Ajv = require('ajv');
const { defsSchema } = require('./items');

// The app manifest an implementer serves, pointed to by `hdsApp.manifest` (documentation/APP-DESCRIPTION.md).
// Readers ignore unknown fields, so the schema does not forbid them.

module.exports = {
  checkAppManifest,
  toBePublished
};

// lowercase https, a host, no credentials
const httpsUrl = { type: 'string', pattern: '^https://[^/?#@\\s]+([/?#]|$)', maxLength: 2048 };

const appManifestSchema = {
  $id: 'https://model.datasafe.dev/json-schemas/hds-app-manifest.json',
  title: 'HDS app manifest',
  type: 'object',
  required: ['format', 'formatVersion', 'appCode', 'name'],
  properties: {
    format: { const: 'hds-app-manifest' },
    formatVersion: { const: 1 },
    appCode: { type: 'string', minLength: 1, maxLength: 100 },
    name: { $ref: 'defs.json#/definitions/localized' },
    description: { $ref: 'defs.json#/definitions/localized' },
    icon: httpsUrl,
    provider: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { $ref: 'defs.json#/definitions/localized' },
        url: httpsUrl
      }
    },
    open: {
      type: 'object',
      properties: { web: httpsUrl, ios: httpsUrl, android: httpsUrl }
    },
    privacy: {
      type: 'object',
      required: ['en'],
      properties: { en: httpsUrl },
      additionalProperties: httpsUrl
    },
    support: httpsUrl
  }
};

const ajv = new Ajv({ schemas: [appManifestSchema, defsSchema] });
const validateAppManifest = ajv.getSchema(appManifestSchema.$id);

/** Throws when `manifest` is not a valid HDS app manifest */
function checkAppManifest (manifest) {
  if (!validateAppManifest(manifest)) {
    throw new Error(`App manifest is invalid: ${ajv.errorsText(validateAppManifest.errors, { dataVar: 'manifest' })}`);
  }
}

function toBePublished () {
  return [{
    title: 'Json Schema App manifest',
    path: './json-schemas/',
    filename: 'hds-app-manifest.json',
    type: 'json',
    content: appManifestSchema
  }];
}
