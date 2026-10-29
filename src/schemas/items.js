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
    entryType: { enum: ['number', 'text', 'select', 'checkbox', 'date', 'picture'] },
    // A single field inside a `composite` block. Recursive: a field of type
    // `composite` carries its own nested `composite` block, so the stored event
    // content can mirror a nested eventType (e.g. medication/basic's `intake`
    // sub-object). Leaf fields keep the flat shape (label/type/canBeNull/options).
    compositeField: {
      type: 'object',
      nullable: false,
      properties: {
        label: { $ref: 'defs.json#/definitions/localized' },
        type: {
          type: 'string',
          oneOf: [
            { $ref: 'defs.json#/definitions/entryType' },
            { enum: ['composite'] }
          ]
        },
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
        },
        composite: {
          type: 'object',
          nullable: false,
          patternProperties: {
            '^[a-z][a-zA-Z0-9]*$': { $ref: 'defs.json#/definitions/compositeField' }
          }
        }
      },
      additionalProperties: false
    },
    // ── FHIR mapping (plan 115) ─────────────────────────────────────────────────
    // The shapes of an item's `fhir` block. Semantic rules (the block agrees with its item, category per
    // resourceType from definitions/fhir/mapping.yaml, codings unique, the stream-scope invariant and the
    // lock) are checked in src/fhir.js; see documentation/FHIR-MAPPING.md.

    // A FHIR coding with a canonical system URI (http://loinc.org, http://snomed.info/sct, …). `display`
    // is required: it is the text a reader falls back on, and what a reviewer checks the code against.
    fhirCoding: {
      type: 'object',
      properties: {
        system: { type: 'string', pattern: '^(https?:|urn:)' },
        code: { type: 'string', minLength: 1 },
        display: { type: 'string', minLength: 1 }
      },
      required: ['system', 'code', 'display'],
      additionalProperties: false
    },
    // The resource's code: a static coding, or a source `{ from: datasource, field }` naming the dotted
    // path in the event content where a datasets-service selection stored its `codes[]`.
    fhirCode: {
      if: { type: 'object', required: ['from'] },
      then: {
        type: 'object',
        properties: {
          from: { enum: ['datasource'] },
          field: { type: 'string', pattern: '^[a-z][a-zA-Z0-9]*(\\.[a-z][a-zA-Z0-9]*)*$' }
        },
        required: ['from', 'field'],
        additionalProperties: false
      },
      else: { $ref: 'defs.json#/definitions/fhirCoding' }
    },
    // A UCUM unit code (`kg`, `mm[Hg]`, `/min`, `[lb_av]`).
    fhirUnit: { type: 'string', minLength: 1 },
    // Profile canonical per rendering flavour. An absent flavour renders the base resource with no
    // profile claim.
    fhirProfiles: {
      type: 'object',
      properties: {
        us: { type: 'string', minLength: 1 },
        ips: { type: 'string', minLength: 1 },
        ch: { type: 'string', minLength: 1 }
      },
      additionalProperties: false
    },
    // `value[x]`, discriminated by `kind`: each kind admits only its own fields.
    fhirValue: {
      type: 'object',
      properties: {
        kind: { enum: ['quantity', 'coded', 'components'] }
      },
      required: ['kind'],
      allOf: [
        { // quantity: eventType → UCUM unit; renders valueQuantity
          if: { properties: { kind: { const: 'quantity' } } },
          then: {
            properties: {
              kind: {},
              units: { type: 'object', minProperties: 1, additionalProperties: { $ref: 'defs.json#/definitions/fhirUnit' } }
            },
            required: ['units'],
            additionalProperties: false
          }
        },
        { // coded: option value → coding; renders valueCodeableConcept
          if: { properties: { kind: { const: 'coded' } } },
          then: {
            properties: {
              kind: {},
              options: { type: 'object', minProperties: 1, additionalProperties: { $ref: 'defs.json#/definitions/fhirCoding' } },
              // option value → extra codings accepted for that option on import only, never emitted
              alsoMatch: {
                type: 'object',
                minProperties: 1,
                additionalProperties: { type: 'array', minItems: 1, items: { $ref: 'defs.json#/definitions/fhirCoding' } }
              }
            },
            required: ['options'],
            additionalProperties: false
          }
        },
        { // components: composite field → component code and UCUM unit; renders component[]
          if: { properties: { kind: { const: 'components' } } },
          then: {
            properties: {
              kind: {},
              components: {
                type: 'object',
                minProperties: 1,
                additionalProperties: {
                  type: 'object',
                  properties: { code: { $ref: 'defs.json#/definitions/fhirCoding' }, unit: { $ref: 'defs.json#/definitions/fhirUnit' } },
                  required: ['code', 'unit'],
                  additionalProperties: false
                }
              }
            },
            required: ['components'],
            additionalProperties: false
          }
        }
      ]
    },
    // A mapping: how the item's events render as (and import from) one FHIR resource.
    fhirMapping: {
      type: 'object',
      properties: {
        resourceType: { enum: ['Observation', 'Condition'] },
        // Required or refused per resourceType, from the category table in definitions/fhir/mapping.yaml.
        category: { type: 'string', minLength: 1 },
        // Further categories of the same table a resource may carry and still import here (import only).
        alsoMatchCategories: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', minLength: 1 } },
        code: { $ref: 'defs.json#/definitions/fhirCode' },
        // Extra codes accepted on import only, never emitted (static code only).
        alsoMatch: { type: 'array', minItems: 1, items: { $ref: 'defs.json#/definitions/fhirCoding' } },
        value: { $ref: 'defs.json#/definitions/fhirValue' },
        // Extra resources, one per numeric composite field, inheriting the parent's resourceType and
        // category (e.g. the heart rate of a blood-pressure event).
        split: {
          type: 'object',
          minProperties: 1,
          additionalProperties: {
            type: 'object',
            properties: {
              code: { $ref: 'defs.json#/definitions/fhirCoding' },
              unit: { $ref: 'defs.json#/definitions/fhirUnit' },
              profiles: { $ref: 'defs.json#/definitions/fhirProfiles' }
            },
            required: ['code', 'unit', 'profiles'],
            additionalProperties: false
          }
        },
        // Composite fields deliberately left out of the FHIR rendering.
        ignore: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', minLength: 1 } },
        profiles: { $ref: 'defs.json#/definitions/fhirProfiles' }
      },
      required: ['resourceType', 'code', 'profiles'],
      additionalProperties: false
    },
    // A qualifier item that rides under its parent item's SMART scope and is never rendered on its own.
    fhirCompanion: {
      type: 'object',
      properties: {
        companionOf: { type: 'string', minLength: 1 }
      },
      required: ['companionOf'],
      additionalProperties: false
    },
    // One element of a resource that is assembled from several items rather than rendered per event: the
    // Patient, from the latest event of each profile item that contributes an element. Which elements exist and
    // which value each takes is checked in src/fhir.js (PATIENT_ELEMENTS).
    fhirElement: {
      type: 'object',
      properties: {
        resourceType: { enum: ['Patient'] },
        element: { enum: ['name.given', 'name.family', 'gender', 'birthDate', 'address.country'] },
        value: { $ref: 'defs.json#/definitions/fhirValue' }
      },
      required: ['resourceType', 'element'],
      additionalProperties: false
    },
    fhirBlock: {
      if: { type: 'object', required: ['companionOf'] },
      then: { $ref: 'defs.json#/definitions/fhirCompanion' },
      else: {
        if: { type: 'object', required: ['element'] },
        then: { $ref: 'defs.json#/definitions/fhirElement' },
        else: { $ref: 'defs.json#/definitions/fhirMapping' }
      }
    }
  }
};

const itemSchema = {
  $id: 'https://model.datasafe.dev/json-schemas/item.json',
  type: 'object',
  nullable: false,
  properties: {
    version: { type: 'string' },
    deprecated: { type: 'boolean' },
    // The denominator of a `ratio/generic` item: DERIVED by the loader on a select
    // (max(option values)), AUTHORED on a `type: number` item (a fixed denominator,
    // INR 1; data-model 3.33.0). Declared here because this schema is itself published
    // and describes the items in pack.json; `addItem` throws if any other item supplies
    // it. (Plan 100, finding F1; plan 114 Q8.)
    ratioRelativeTo: { type: 'number', exclusiveMinimum: 0 },
    label: { $ref: 'defs.json#/definitions/localized' },
    description: { $ref: 'defs.json#/definitions/localized' },
    streamId: { type: 'string' },
    eventType: { type: 'string' },
    // `once` (latest entry wins — profile data), `any`/`unlimited` (no interval
    // constraint), or an ISO-8601 duration (`P1D`, `P1W`, `P1M`) giving the minimum
    // interval between two entries. Was an unvalidated free string, so a typo or an
    // invented value passed silently and then failed to match any consumer branch.
    repeatable: {
      type: 'string',
      anyOf: [
        { enum: ['once', 'any', 'unlimited'] },
        { pattern: '^P(\\d+[YMWD])+(T(\\d+[HMS])+)?$' },
        { pattern: '^PT(\\d+[HMS])+$' }
      ]
    },
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
    // Codes for the item's concept, per code system (snomed, loinc, icf, icd10, …): always a list,
    // even of one code, so a reader never has to handle two shapes (until 3.29 a single code could be a
    // bare string, and some items used each form). `loincMethod` lists LOINC codes that decide ownership and are
    // never exported: method-specific codes ("… by Automated count") of the same observation, and codes labs send
    // for the analyte whose LOINC definition does not match the stored scale (Quick % as 5894-1).
    references: {
      type: 'object',
      nullable: false,
      additionalProperties: {
        type: 'array',
        minItems: 1,
        items: { type: 'string', minLength: 1 }
      }
    },
    // Population reference interval for a measured value (e.g. WHO-2021 semen
    // analysis lower limits). `null` states that no reference range applies.
    referenceRange: {
      type: 'object',
      nullable: true,
      properties: {
        source: { type: 'string' },
        lowerLimit: { type: 'number', nullable: true },
        upperLimit: { type: 'number', nullable: true },
        units: { type: 'string' },
        population: { type: 'string' }
      },
      additionalProperties: false
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
    // `multi-select` is `select`'s multi-valued twin: same `options` list, but the
    // event content is an ARRAY of the chosen values rather than one of them. Use it
    // when several options are simultaneously true (site-agents#9/#10). Orthogonal to
    // `repeatable`, which governs how often the item is recorded over time.
    //
    // `system` is not an input type: the item is written by a machine (a connector) and
    // read by apps, and consumers must skip it in pickers, forms and diaries (hds-lib
    // exposes `isSystem`). Its eventType must be an object (checked in src/items.js).
    // Deliberately listed here and NOT in `entryType`, which composite fields share: a
    // composite field can never be `system`.
    //
    // `attachments` is a document: files carried as Pryv attachments, with metadata as
    // content. Not entered field by field (forms show it as not editable); its eventType
    // must declare `attachmentRequired` (checked in src/items.js). Item-only, like `system`.
    //
    // `imported` is an object written by an importer from a coded source (`lab-result/coded-v1`),
    // never entered in a form: read, shown and requested like any item (unlike `system`), left out
    // of pickers and form sections. Its eventType must be an object (checked in src/items.js).
    // Item-only, like `system`.
    type: {
      type: 'string',
      oneOf: [
        { $ref: 'defs.json#/definitions/entryType' },
        { enum: ['composite', 'datasource-search', 'convertible', 'slider', 'multi-select', 'system', 'attachments', 'imported'] }
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
                  label: { $ref: 'defs.json#/definitions/localized' },
                  // The LOINC code of what this option stores (mass and moles of one analyte are two codes):
                  // one of the item's `references.loinc`, or null for a unit LOINC has no code for. Stated on every
                  // option of an item that asserts LOINC, never inherited. Rules in src/items.js (checkLoincRefs).
                  loinc: { type: 'string', minLength: 1, nullable: true }
                },
                required: ['value', 'label'],
                additionalProperties: false
              }
            }
          }
        }
      },
      additionalProperties: false
    },
    // Read-side comparison between the units an item offers as `variations.eventType`
    // (site-agents#21). Values are stored as printed, in the unit of the event's own type;
    // these factors are only for comparing, charting and checking against a reference
    // interval in another unit. Each pair (by eventType, in either order) appears at most
    // once, in `factors` or in `notConvertible`; a pair in neither has no published factor
    // yet. Rules checked in src/items.js; see documentation/BLOOD-CHEMISTRY.md § Unit conversions.
    // Kept in the portable subset (no numeric exclusiveMinimum, no const): `factor > 0`
    // is enforced by the loader.
    unitConversions: {
      type: 'object',
      properties: {
        factors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
              // value in `to` = value in `from` × factor
              factor: { type: 'number', minimum: 0 },
              // g/mol, when the factor derives from it
              molarMass: { type: 'number', minimum: 0 },
              source: { type: 'string', minLength: 1 }
            },
            required: ['from', 'to', 'factor', 'source'],
            additionalProperties: false
          }
        },
        // A pair whose values must never be converted or compared (assay- or
        // calibrator-dependent, or not a multiplicative relation).
        notConvertible: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
              reason: { type: 'string', minLength: 1 }
            },
            required: ['from', 'to', 'reason'],
            additionalProperties: false
          }
        }
      },
      additionalProperties: false
    },
    // How the item's events render as FHIR R4 and import back (plan 115; consumed by hds-fhir-js): a mapping,
    // `{ companionOf: <item key> }` for a qualifier that rides under its parent's SMART scope, or
    // `{ resourceType: Patient, element }` for one element of the assembled Patient resource.
    // Shapes in defs.json (`fhirBlock`); semantic rules, the stream-scope invariant and the scope lock are
    // checked in src/fhir.js. See documentation/FHIR-MAPPING.md.
    fhir: { $ref: 'defs.json#/definitions/fhirBlock' }
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
              // any key starting with a lowerCase letter; each field follows the
              // recursive `compositeField` definition (supports nested composites)
              '^[a-z][a-zA-Z0-9]*$': { $ref: 'defs.json#/definitions/compositeField' }
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
    { // type is number — plain numeric input. Storage is always the raw value in the
      // item's eventType; the optional `number.display` block controls how that raw
      // value is presented (multiplier/precision/suffix), mirroring `slider.display`.
      //
      // The driving case is lab percentages (Plan 83 / D2): HbA1c, hematocrit, RDW,
      // transferrin saturation and the WBC differential are genuine fractions, so they
      // store 0..1 on `ratio/proportion` and render as `42%` via multiplier: 100.
      // Without this, a clinician-facing value would sit at rest in an alien scale.
      // Precedent: `wellbeing-self-rated-health` does the same for a slider (EQ VAS).
      if: {
        properties: {
          type: { const: 'number' }
        }
      },
      then: {
        properties: {
          min: { type: 'number', nullable: true },
          max: { type: 'number', nullable: true },
          step: { type: 'number', nullable: true },
          number: {
            type: 'object',
            nullable: true,
            properties: {
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
        }
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
  // No `additionalProperties: false` here: the type-specific properties are declared
  // in the `allOf` branches, which draft-07 does not see from the top level. Unknown
  // keys are refused by `checkItem` instead, against `knownItemProperties`.
};

// Every top-level property an item may carry: the common ones plus those of each
// type-specific branch.
const knownItemProperties = new Set([
  ...Object.keys(itemSchema.properties),
  ...itemSchema.allOf.flatMap((branch) => Object.keys(branch.then.properties || {}))
]);

const ajv = new Ajv({
  schemas: [itemSchema, defsSchema],
  allowUnionTypes: true // to allow oneOf
});
const validateItem = ajv.getSchema('https://model.datasafe.dev/json-schemas/item.json');

function checkItem (item, key = 'item') {
  const unknown = Object.keys(item).filter((p) => !knownItemProperties.has(p));
  if (unknown.length > 0) {
    throw new Error(`Item "${key}" has unknown properties: ${unknown.join(', ')}`);
  }
  if (!validateItem(item)) {
    throw new Error(`Item "${key}" is invalid: ${ajv.errorsText(validateItem.errors, { dataVar: key })}`);
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
