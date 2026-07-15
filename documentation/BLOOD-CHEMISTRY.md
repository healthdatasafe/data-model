# Blood chemistry — design decisions

How HDS models blood analytes, and why. Driven by a reported gap: the model had **no blood-chemistry
domain at all** — the only `body-blood*` node was `body-blood-pressure` (a vital sign), and the sole
body-fluid items were 5 urine hormones and 8 semen indices.

Scope is the serum/plasma chemistry, CBC and hormone panels a fertility or reproductive-health
application meets in ordinary lab reports.

## Stream tree

```
body/
  body-blood-pressure          ← VITAL SIGN. A sibling, not a child (see the wart below)
  body-blood/
    body-blood-serum/          ← serum / plasma analytes (most of the domain)
    body-blood-cbc/            ← whole blood — complete blood count
    body-blood-rbc/            ← erythrocyte specimen (RBC magnesium)
    body-blood-hba1c           ← whole blood, not serum — hence the direct placement
  body-urine/
    body-urine-hormones/       ← urine hormone assays
```

Three blood specimens, not one. `body-blood-rbc-magnesium` and `body-blood-serum-magnesium` are the
same analyte in **different specimens** — different observations with different reference ranges, which
is precisely why specimen is in the key (below).

`body-blood` follows the existing specimen-rooted pattern (`body-urine`, `body-semen`).

### ⚠️ `body-blood-pressure` is not part of this domain

It is a **vital sign**, a direct child of `body`, and it holds the `body-blood-*` prefix — so it *looks*
like a child of `body-blood` but is a sibling.

- **Safe:** nothing resolves by string prefix. D3 context resolution walks the real stream tree
  (`getAncestorsById`), and authorizations use parent-covers-child on the same tree.
- **The trap:** "grant access to all `body-blood` data" reads as covering blood pressure. It does not.
- **Not fixable:** the stream is published and holds data; renaming it would break existing events.

## Specimen is explicit in the item key

**Serum and urine assays of the same hormone are different observations** with different reference
ranges. They cannot share an item, and a neutral key that silently means one of them is a trap.

SNOMED agrees — it codes the specimen as part of the procedure:

| Analyte | Urine | Serum |
|---|---|---|
| LH | `167381004` Urine luteinizing hormone measurement | `273969007` Serum luteinizing hormone measurement |
| FSH | `167382006` Urine follicle stimulating hormone measurement | `273971007` Serum follicle stimulating hormone measurement |

So the keys say so too: `body-urine-hormones-fsh` vs `body-blood-serum-fsh`. Every key equals its
`streamId`, the dominant convention in this repo.

**History.** These were `fertility-hormone-*` — a key prefix that matched neither the stream
(`body-urine-*`) nor the specimen. They were **renamed** in place. Deprecate-and-twin was *not*
available: the loader (`src/items.js`) rejects two items sharing a `streamId:eventType` pair, and a
renamed twin keeps both. The exception was LH, whose eventType changed (below).

**Renaming an item key does not touch stored data** — events carry `streamId` + `type`, and `forEvent`
resolves on that pair. It breaks *consumer code* that references the key, which is why it is a
coordinated release (see `AGENTS.md` → cross-repo relationships).

## Units

Reported units, not SI-normalised ones: a clinician-facing value stored in an alien scale is worse than
no value. Every analyte stores the number as the lab prints it.

| Concern | Decision |
|---|---|
| **Cell counts** | `concentration/megacount-ml` (10⁶/mL) carries WBC and platelets — × 10⁹/L is × 10⁶/mL, so 3.4–10.8 and 150–400 store as printed. RBC is × 10¹²/L ≡ × 10⁹/mL, which would be 4300–4800 on that unit, so **`concentration/gigacount-ml`** exists for it: 4.3–4.8. The mixed-unit panel *mirrors the report*, which genuinely prints RBC in × 10¹²/L and WBC in × 10⁹/L. |
| **Percentages** | Lab percentages are genuine fractions (HbA1c is the glycated fraction of total hemoglobin; hematocrit the packed-cell fraction), so they store `0..1` on `ratio/proportion` and render via `number.display.multiplier: 100`. The `0..1` bound is enforced, and fractions match Apple HealthKit's `HKUnit.percent()`. FHIR/LOINC export applies the × 100 in the mapper. |
| **ng/mL** | Not a unit here: **1 ng/mL = 1 μg/L**, so ferritin, folate, 25-OH-D, C-peptide and AMH use the legacy `concentration/ug-l` with the identical stored number. Adding `ng-ml` would have split one measurement across two type names. See the no-equivalent-types rule in `AGENTS.md`. |

## Sample context

The context a sample needs is **not** one mechanism — it decomposes, and the model already answers most
of it:

| Context | Where it lives |
|---|---|
| **Cycle day** (Day 2–5, mid-luteal, Day 21) | **Derived** from `event.time` + `fertility-cycles-start`. Storing it would duplicate state the model already holds, and duplicated state goes stale. Same argument as spotting in [`MENSTRUAL-CYCLE.md`](./MENSTRUAL-CYCLE.md). |
| **Fasting** | Its **own item** (`body-blood-serum-glucose-fasting`). SNOMED codes fasting (`167087006`) and random (`167086002`) serum glucose as different procedures, and LOINC likewise — they are different observations, not one observation with a flag. Precedent: `body-temperature-basal` vs `body-temperature`. |
| **Time of day** (cortisol 6–9am vs 12–3pm) | `event.time` already carries it. |
| **HRT** | `medication-intake-coded`. |
| **Menopausal status** | **Not modelled, and not sample context** — it is durable patient state that outlives any draw. Belongs to its own plan. |

Note the schema's `variations` block supports **`eventType` only**. The `measure-detail` variation in
[`DESIGN-NOTES.md`](./DESIGN-NOTES.md)'s body-weight example is aspirational — it is not implemented.

## Deliberately absent

- **Reference / "optimal" ranges.** They vary by lab, assay and population, and functional-medicine
  "optimal" bands are a practice's *interpretation*, not a fact about the analyte. **The model carries
  the measured value; interpretation stays with the interpreter.**
- **Derived indices** — HOMA-IR, LH:FSH, AST:ALT, BUN/creatinine, A/G, corrected calcium. Computable
  from the analytes; recompute rather than store. (Transferrin saturation is the grey zone — labs
  universally print it.)
- **Non-blood markers** — stool (elastase, calprotectin), saliva (diurnal cortisol), 24-hr urine iodine.
  Demand exists; out of scope here.

## Known deprecation — `fertility-hormone-lh`

`fertility-hormone-lh` was typed `concentration/mg-l`. LH is reported in **IU/L**, and it was the only
item in the model using `mg-l` — its siblings all used `iu-l`.

**The stored numbers are already correct.** `bridge-mira` writes Mira's value verbatim with no unit
conversion, and Mira reports LH in mIU/mL — numerically identical to IU/L. Only the type label was
wrong.

It could not be retyped in place: stored events carry `type: concentration/mg-l`, and the data lives in
users' own accounts, so there is nothing for HDS to migrate. Instead the item is **`deprecated: true`**
and kept, so existing events still resolve and render; new data uses `body-urine-hormones-lh`
(`concentration/iu-l`). This is why LH is the one urine hormone that was deprecated rather than renamed
— its eventType changed, so the `streamId:eventType` pair differs and both items can coexist.

## Codes

- **SNOMED** references are verified against the local `snomed-db` (International Edition RF2
  20260201) — **never** hand-written, and **never taken from search order**. Verification is not a
  formality here: several concepts a plain search returns *first* are **inactive** — `35170002`
  (Hemoglobin determination), `142831004` (RBC count), `165701004` / `143103004` (RDW), `143134000`
  (transferrin saturation), `26966005` (total bilirubin), `103205003` (MCH). Shipping any of them would
  have repeated the stale-reference bug fixed in 1.12.1.
- Watch for **near-miss names**: `104134009` is *Hemoglobin* distribution width (HDW), not RDW —
  a different analyte with a very similar label.
- Where no concept exists, the item carries **no** `snomed` ref and says why:
  `body-urine-hormones-e3g` (estrone-3-glucuronide has no concept), `body-urine-hormones-pdg`
  (`89113004` is *Pregnanediol measurement* — a different substance) and `body-blood-rbc-magnesium`
  (no erythrocyte-magnesium concept).
- Two references are deliberate compromises, noted on the items: `body-blood-serum-folate` uses
  `250212002` *Plasma folate* (SNOMED has no serum folate **procedure**, only findings; the two are
  reported interchangeably), and `body-blood-serum-egfr` uses `80274001`, an **observable entity**
  rather than a procedure — SNOMED has no estimated-GFR measurement procedure.
- **LOINC** has no local source to verify against, so codes are **not** asserted. Follows the existing
  precedent (`body-semen-morphology-normal`): note the candidate in a comment marked pending
  verification rather than ship a guess.
