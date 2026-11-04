# Genetic test results

The result of a genetic test for one variant of one gene, as a laboratory reported it: MTHFR C677T and A1298C,
thrombophilia variants (F5 Leiden, F2 G20210A), single pharmacogenetic variants, carrier screening. From
[site-agents#37](https://github.com/healthdatasafe/site-agents/issues/37); design reviewed and approved on 2026-11-03.
LOINC codes below were verified against LOINC 2.83 (tx.fhir.org) on 2026-11-03.

**Scope.** One event per tested variant. Not modelled yet, each an additive sibling of `genetics-variant` when needed:
pharmacogenomic diplotypes and phenotypes (`genetics-pgx`), karyotypes (`genetics-karyotype`), whole-genome or exome
files (a document, `documents`). **Compound heterozygosity** (two variants of one gene on different alleles, their
phase) is a relation between two results and is out of scope for a per-variant event: each variant is recorded with
its own zygosity, and a printed phase statement goes to `notes`. Carrier screening needs nothing more: it is one event
per variant tested.

## Why a root of its own

Genetic data is a special category (GDPR art. 9, HIPAA, US state genetic privacy laws), consented on its own. Under
`body`, `condition` or `finding`, every existing grant on those roots would silently cover it. On its own root, no
grant on another root reaches it. An access already minted with `streamId: '*'` does (a `*` permission covers streams
created later); the marker below, once consumers enforce it, keeps new broad grants out, and the existing ones are
swept before the first write.

| Stream | Name | Item | eventType |
|---|---|---|---|
| `genetics` (root) | Genetic test results | none | |
| `genetics-variant` | Tested gene variants | `genetics-variant` (`type: imported`) | `genetic-variant/coded-v1` |

The root carries consent-screen names (`label` / `description`, en and fr, 3.38.0).

## `explicitGrantOnly`

`explicitGrantOnly: true` on a root (root only, a boolean; `src/streams.js` refuses anything else) means: **an access
covers this root only when it names it, or one of its children, explicitly.** A `*` grant, or a grant on another root,
never reaches it. The pack publishes the streams tree as written, so the marker is in `pack.streams`.

What a consumer must do, by how the access is made:

- **A consent request (CMC) with `streamId: '*'`** is expanded by the requesting app into the model's roots **minus the
  marked roots**, one permission per root. A mask cannot be used here: Pryv refuses `level: 'none'` in a consent offer,
  because dropping a mask from an offer would widen it (open-pryv.io
  `components/business/src/accesses/permissionSet.ts:162-172`).
- **A directly minted access** (an app or shared access created with the person's token) with `streamId: '*'` adds
  `{ streamId: 'genetics', level: 'none' }` for each marked root.
- **A grant that names `genetics`** (or `genetics-variant`) is the only way in. Consent screens show the root's
  `label` and `description`.
- **Readers** that list what an access shares must not show a `level: 'none'` entry as shared.

### Before the first write

The marker does nothing on its own: data-model only declares it. **No importer writes a `genetic-variant/coded-v1`
event until the consumers honour the marker.** That enforcement is tracked separately (hds-lib, hds-mcp-js, the
webapp, the SMART translation); until it ships, the stream exists but stays empty.

Enforcement also covers **accesses that already exist with `streamId: '*'`** (an MCP connection, an app access minted
before 3.43.0): they reach `genetics` the moment the stream is created, and expanding new requests does nothing for
them. They are re-minted, or given the `level: 'none'` mask, before the first write.

## `genetic-variant/coded-v1`

Closed, portable subset (no `const`, `if`, `not` or `$ref`). Item `genetics-variant`, `type: imported`: written by
importers from a report, never entered in a form. Event `time` is the sample collection date, no duration.

| Field | Required | Content | Genomics Reporting IG (LOINC) |
|---|---|---|---|
| `gene` | yes | `{ label, codes[] }`: the symbol as printed, and at least one Coding (HGNC) | gene-studied, 48018-6 |
| `variant` | yes | `{ label, codes[]? }`: the lab's label as printed ("C677T"), and HGVS / dbSNP / ClinVar Codings when known | variation-code 81252-9; DNA change 48004-6 |
| `result` | yes | `present`, `absent`, `indeterminate`, `no-call` | 69548-6, answer list LL1971-2 |
| `zygosity` | no | `homozygous`, `heterozygous`, `hemizygous`, `homoplasmic`, `heteroplasmic` | 53034-5, answer list LL381-5 |
| `resultText` | no | the result exactly as printed | |
| `method` | no | the method or panel as printed | |
| `laboratory` | no | `{ eventId?, name? }`, at least one: the lab's `provider/organization-v1` event and/or its name as printed | |
| `notes` | no | the comment printed with the result | |

A Coding is `{ system, version?, code, display? }`, closed, `system` a URI: the shape of `lab-result/coded-v1`
`valueCodes` (test `[GEN-ET-3]`).

**`result`** (LOINC 69548-6 "Genetic variant assessment", answer list LL1971-2):

| Value | LOINC answer |
|---|---|
| `present` | LA9633-4 Present |
| `absent` | LA9634-2 Absent |
| `indeterminate` | LA11884-6 Indeterminate |
| `no-call` | LA18198-4 No call |

A report that says a variant was detected without printing a zygosity is `present` alone. "Not detected", "normal",
"wild type" are `absent`.

**`zygosity`** (LOINC 53034-5 "Allelic state", answer list LL381-5):

| Value | LOINC answer |
|---|---|
| `homozygous` | LA6705-3 Homozygous |
| `heterozygous` | LA6706-1 Heterozygous |
| `hemizygous` | LA6707-9 Hemizygous |
| `homoplasmic` | LA6704-6 Homoplasmic |
| `heteroplasmic` | LA6703-8 Heteroplasmic |

A zygosity is meaningful with `present` only. The schema does not enforce it (advisory): a reader ignores a zygosity on
any other result.

**LOINC 81252-9** ("Discrete genetic variant") has status TRIAL in LOINC 2.83; the others above are ACTIVE.

### Code systems

| What | System | Code example |
|---|---|---|
| Gene | `http://www.genenames.org/geneId` (HGNC) | `HGNC:7436`, display `MTHFR` |
| Variant, HGVS | `http://varnomen.hgvs.org` | `NM_005957.5:c.665C>T` (the `c.` string carries its transcript) |
| Variant, dbSNP | `http://www.ncbi.nlm.nih.gov/projects/SNP` | `rs1801133` |
| Variant, ClinVar | `http://www.ncbi.nlm.nih.gov/clinvar` | the ClinVar variation id |

A lab's legacy label ("C677T", "Factor V Leiden") goes in `variant.label` as printed; it is not an HGVS string. Add
an HGVS Coding only when the report prints one or the mapping is certain.

### Example

```json
{
  "gene": { "label": "MTHFR", "codes": [{ "system": "http://www.genenames.org/geneId", "code": "HGNC:7436", "display": "MTHFR" }] },
  "variant": {
    "label": "C677T",
    "codes": [
      { "system": "http://varnomen.hgvs.org", "code": "NM_005957.5:c.665C>T" },
      { "system": "http://www.ncbi.nlm.nih.gov/projects/SNP", "code": "rs1801133" }
    ]
  },
  "result": "present",
  "zygosity": "heterozygous",
  "resultText": "C677T hétérozygote",
  "method": "Real-time PCR",
  "laboratory": { "name": "Laboratoire Exemple SA" }
}
```

A `laboratory.eventId` is mirrored in `clientData.related.<eventId>` in the same write (PROVENANCE.md).

## FHIR

No `fhir` block yet, so `pack.fhirScopes` and `scopes.lock.json` are unchanged and no SMART scope reaches the root
(test `[GEN-FHIR-1]`). A later block maps to the Genomics Reporting IG variant Observation with the table above.
**It must never put a marked root under a broad grant:** an Observation `laboratory` category would place
`genetics-variant` in the `Observation|laboratory` pair, and `?category=laboratory` would then reach genetic results.
The mapping therefore needs its own pair, and `computeFhirScopes` (`src/fhir.js`) must keep marked roots out of any
grant that does not name them, with a test, in the same change.
