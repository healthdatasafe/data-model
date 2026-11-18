# Terminology lookups: coding a person's record without sending it away

A LOINC, SNOMED CT or ATC code is often found by searching a name. When the name comes from a person's documents, the
search tells the service that answers it what was tested, diagnosed or prescribed, along with the requester's network
address and timing. This page says which lookups may leave the machine when a writer codes a person's record (an
importer, an AI agent, a bridge), and which must stay local. site-agents#36 A8.

This rule covers lookups only. An AI agent that reads the documents has already sent them to its model provider; a
local lookup does not change that.

## Two kinds of lookup

- **Curating the model** (`definitions/`, a converter, a datasets-service seed): a maintainer looks up generic
  concepts ("ferritin in serum") with no person's data. The procedures in [BLOOD-CHEMISTRY.md](BLOOD-CHEMISTRY.md#codes)
  § Codes and `AGENTS.md` (snomed-db, loinc-db, tx.fhir.org `$lookup` and `$expand` by name) are for this case only.
- **Coding a person's record**: the names come from that person's documents. The rule below applies.

## The rule: codes only, checked by code

A lookup made for a person's record that goes to a third party (anyone but the operator of the person's HDS platform)
carries **one bare code at most**:

- never a test, diagnosis, drug, procedure or finding name as the record writes it, and never a value, a date, a
  provider or any other part of the record;
- never to a web search;
- to a third-party terminology service (tx.fhir.org, loinc.org, a SNOMED CT browser, BioPortal, the WHO ATC index), only
  to check a code by the code itself (one the record prints, or one the writer's own table gives; a table is
  checked when it is built, not per record): `CodeSystem/$lookup?system=http://loinc.org&code=<code>`. A text search (`ValueSet/$expand` with a `filter`, a
  browser's search box) is not allowed.

A bare code still names its concept to the service that resolves it, and several codes looked up together describe the
record. So the local lookups below come first; a code goes out only when nothing local confirms it. Which codes a
writer may store at all is unchanged (BLOOD-CHEMISTRY.md: only curated codes, never one picked from unrecognised text).

## Local lookups, first

- **The published pack** (`https://model.datasafe.dev/pack.json`, fetched whole, the same file for everyone, so
  fetching it says nothing about the person). It holds every item's codes (`references.loinc`, `loincMethod`,
  `snomed`), the `fhir` blocks' `alsoMatch` import codes, item labels in English and French (a few in Spanish), and
  `documentKinds` (labels also in German and Italian). A printed LOINC code an item owns finds that item there; a
  printed test name matches an item label there, when the label is in a language the pack has.
  - The local HDS MCP (stdio) loads the pack on the person's computer: `search_items` matches a code or a label there,
    and the text stays on the machine. Through the remote connector the same search runs on the HDS MCP server, so
    the text goes to the operator of the person's HDS platform.
  - hds-lib `isValidLoincCode` checks a LOINC check digit locally; `checkLabResultCoded` also flags a code an item
    owns (`owned-by-item`).
- **A local terminology copy**, when the writer holds one: a LOINC release (free, under the LOINC terms of use) or a
  SNOMED CT release (licensed: a member country's national release centre, or an affiliate licence). HDS's own
  loinc-db and snomed-db are internal tools and are not distributed.

## HDS datasets-service

The coded datasets (`condition`, `finding`, `medication`, `procedure`, `treatment`, listed in the pack's
`datasources`) are searched by text on the datasets-service of the person's HDS platform. That service is run by
the operator of the person's HDS platform, not by a third party, and it receives the search text. A writer:

- sends only the name searched (a diagnosis, a drug or brand as printed), never values, dates or other parts of the
  record;
- tells the person, before searching, when the text names their condition or medication (the HDS MCP guidance does);
- copies the picked entry unchanged ([MEDICATION.md](MEDICATION.md#the-atc-hdsid), [CONDITION.md](CONDITION.md)).

## Nothing found locally

When the record prints no code and no local lookup gives one: store it without a terminology code where the model
allows (a `-basic` item with the name as printed, where one exists; for a lab result, `lab-result/coded-v1` under the
lab's or the writer's own code system,
[BLOOD-CHEMISTRY.md](BLOOD-CHEMISTRY.md#results-with-no-item-of-their-own-lab-resultcoded-v1)). Otherwise keep it
aside and tell the person. Never take a code from a remote text search, and never guess one.

## Not yet

A local import kit that carries terminology copies next to the person's files is proposed in site-agents#36 (A4 / A5);
it is not built. Until then, the local lookups are the pack and a terminology copy the writer already holds.
