const Ajv = require('ajv');

module.exports = {
  checkItem,
  toBePublished
};

const defsSchema = {
  $id: 'https://model.datasafe.dev/json-schemas/defs.json',
  definitions: {
    localized: {
      type: 'object',
      nullable: false,
      properties: {
        en: { type: 'string' },
        fr: { type: 'string' },
        es: { type: 'string' }
      },
      required: ['en']
    },
    entryType: { enum: ['number', 'text', 'select', 'checkbox', 'date', 'picture'] }
  }
};

const itemSchema = {
  $id: 'https://model.datasafe.dev/json-schemas/item.json',
  type: 'object',
  nullable: false,
  properties: {
    version: { type: 'string' },
    deprecated: { type: 'boolean' },
    label: { $ref: 'defs.json#/definitions/localized' },
    description: { $ref: 'defs.json#/definitions/localized' },
    streamId: { type: 'string' },
    eventType: { type: 'string' },
    repeatable: { type: 'string' },
    duration: {
      type: 'object',
      nullable: true,
      properties: {
        mandatory: { type: 'boolean', nullable: false },
        canBeNull: { type: 'boolean', nullable: false },
        maxSeconds: { type: 'number', nullable: true }
      }
    },
    devNotes: {
      type: 'string',
      nullable: true
    },
    reminder: {
      type: 'object',
      nullable: true,
      properties: {
        cooldown: { type: 'string' },
        expectedInterval: {
          type: 'object',
          properties: {
            min: { type: 'string' },
            max: { type: 'string' }
          }
        },
        relativeTo: { type: 'string' },
        relativeDays: {
          type: 'array',
          items: { type: 'number' }
        },
        importance: { enum: ['may', 'should', 'must'] }
      }
    },
    type: {
      type: 'string',
      oneOf: [
        { $ref: 'defs.json#/definitions/entryType' },
        { enum: ['composite', 'datasource-search', 'convertible', 'slider'] }
      ]
    },
    variations: {
      type: 'object',
      nullable: false,
      properties: {
        eventType: {
          type: 'object',
          properties: {
            label: { $ref: 'defs.json#/definitions/localized' },
            options: {
              type: 'array',
              items: {
                type: 'object',
                nullable: false,
                properties: {
                  value: { type: 'string' },
                  label: { $ref: 'defs.json#/definitions/localized' }
                },
                required: ['value', 'label'],
                additionalProperties: false
              }
            }
          }
        }
      },
      additionalProperties: false
    }
  },
  allOf: [
    { // type is select
      if: {
        properties: {
          type: { const: 'select' }
        }
      },
      then: {
        properties: {
          options: {
            type: 'array',
            items: {
              type: 'object',
              nullable: false,
              properties: {
                value: { type: ['number', 'string'] },
                label: { $ref: 'defs.json#/definitions/localized' }
              },
              required: ['value', 'label'],
              additionalProperties: false
            }
          }
        }
      }
    },
    { // type is composite or not
      if: {
        properties: {
          type: { const: 'composite' }
        }
      },
      then: {
        properties: {
          composite: {
            type: 'object',
            nullable: false,
            patternProperties: {
              '^[a-z][a-zA-Z0-9]*$': { // any key starting with a lowerCase
                type: 'object',
                properties: {
                  label: { $ref: 'defs.json#/definitions/localized' },
                  type: { $ref: 'defs.json#/definitions/entryType' },
                  canBeNull: { type: 'boolean', nullable: true },
                  options: {
                    type: 'array',
                    items: {
                      type: 'object',
                      nullable: false,
                      properties: {
                        value: { type: ['number', 'string'] },
                        label: { $ref: 'defs.json#/definitions/localized' }
                      },
                      required: ['value', 'label'],
                      additionalProperties: false
                    }
                  }
                },
                additionalProperties: false
              }
            }
          }
        },
        required: ['composite']
      }
    },
    { // type is datasource-search
      if: {
        properties: {
          type: { const: 'datasource-search' }
        }
      },
      then: {
        properties: {
          datasource: { type: 'string' }
        },
        required: ['datasource']
      }
    },
    { // type is convertible
      if: {
        properties: {
          type: { const: 'convertible' }
        }
      },
      then: {
        properties: {
          'converter-engine': {
            type: 'object',
            nullable: false,
            properties: {
              key: { type: 'string' },
              version: { type: 'string' },
              models: { type: 'string' }
            },
            required: ['key', 'version', 'models']
          }
        },
        required: ['converter-engine']
      }
    },
    { // type is slider — numeric input with min/max/step. Storage is the raw value
      // in the item's eventType; the optional `slider.display` block controls how
      // the raw value is presented to the user (multiplier/precision/suffix).
      if: {
        properties: {
          type: { const: 'slider' }
        }
      },
      then: {
        properties: {
          min: { type: 'number' },
          max: { type: 'number' },
          step: { type: 'number', nullable: true },
          slider: {
            type: 'object',
            nullable: true,
            properties: {
              orientation: { enum: ['horizontal', 'vertical'] },
              labels: {
                // per-value tick labels, keyed by the raw numeric value (as a string)
                type: 'object',
                patternProperties: {
                  '^-?[0-9]+(\\.[0-9]+)?$': {
                    type: 'object',
                    properties: {
                      label: { $ref: 'defs.json#/definitions/localized' },
                      description: { $ref: 'defs.json#/definitions/localized' }
                    },
                    required: ['label'],
                    additionalProperties: false
                  }
                }
              },
              display: {
                type: 'object',
                properties: {
                  multiplier: { type: 'number' },
                  precision: { type: 'number' },
                  suffix: { $ref: 'defs.json#/definitions/localized' }
                },
                additionalProperties: false
              }
            },
            additionalProperties: false
          }
        },
        required: ['min', 'max']
      }
    }
  ],
  required: ['version', 'label', 'description', 'streamId', 'type', 'repeatable']
  // additionalProperties: false // find a way to check no additional properties have been induced
};

const ajv = new Ajv({
  schemas: [itemSchema, defsSchema],
  allowUnionTypes: true // to allow oneOf
});
const validateItem = ajv.getSchema('https://model.datasafe.dev/json-schemas/item.json');

function checkItem (item) {
  const valid = validateItem(item);
  if (!valid) {
    console.log(item);
    console.log(validateItem.errors);
    throw new Error(validateItem.errors);
  }
}

function toBePublished () {
  return [{
    title: 'Json Schema Item',
    path: './json-schemas/',
    filename: 'item.json',
    type: 'json',
    content: itemSchema
  },
  {
    title: 'Json Schema Defs',
    path: './json-schemas/',
    filename: 'defs.json',
    type: 'json',
    content: defsSchema
  }
  ];
}
