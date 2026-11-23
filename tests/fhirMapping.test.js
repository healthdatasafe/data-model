const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

describe('[FHIR] item fhir blocks (plan 115)', () => {
  const { itemsById, fhirScopes, toBePublished } = require('../src/items');
  const { checkItem, toBePublished: schemasToBePublished } = require('../src/schemas/items');
  const { checkMappingTable, checkFhirMapping, checkFhirScopes, computeFhirScopes, readLock, emptyLock, lockEntries, mergeLock, ucumKey, fhirMapping, UNMAPPED, PATIENT_ELEMENTS } = require('../src/fhir');

  const MAPPED = ['body-weight', 'body-blood-pressure', 'body-heart-rate', 'lifestyle-tobacco-smoking', 'condition-coded', 'wellbeing-general-health'];
  const item = (k) => structuredClone(itemsById[k]);
  const eventTypesOf = (it) => it.variations?.eventType ? it.variations.eventType.options.map((o) => o.value) : [it.eventType];
  const check = (it, key = 'x') => checkFhirMapping(key, it, eventTypesOf(it));
  const coding = (code, system = 'http://loinc.org') => ({ system, code, display: `display ${code}` });

  describe('[FHIR-ITEM] the shipped blocks', () => {
    it('[FHIR-ITEM-1] the mapped items load and keep their blocks; the VAS slider is unmapped', () => {
      for (const k of MAPPED) assert.ok(itemsById[k].fhir, `${k} has no fhir block`);
      assert.strictEqual(itemsById['wellbeing-self-rated-health'].fhir, undefined);
    });

    it('[FHIR-ITEM-7] lab: one LOINC code per unit when mass and moles differ, else a static code; lab profiles', () => {
      const g = itemsById['body-blood-serum-glucose-fasting'].fhir;
      assert.deepStrictEqual(g.code, {
        from: 'eventType',
        codings: {
          'concentration/mg-dl': { system: 'http://loinc.org', code: '1558-6', display: 'Fasting glucose [Mass/volume] in Serum or Plasma' },
          'concentration/mmol-l': { system: 'http://loinc.org', code: '14771-0', display: 'Fasting glucose [Moles/volume] in Serum or Plasma' }
        }
      });
      assert.deepStrictEqual(g.value.units, { 'concentration/mg-dl': 'mg/dL', 'concentration/mmol-l': 'mmol/L' });
      assert.deepStrictEqual(g.profiles, {
        us: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab',
        ips: 'http://hl7.org/fhir/uv/ips/StructureDefinition/Observation-results-laboratory-pathology-uv-ips'
      });
      assert.deepStrictEqual(itemsById['body-blood-serum-ferritin'].fhir.code, { system: 'http://loinc.org', code: '2276-4', display: 'Ferritin [Mass/volume] in Serum or Plasma' });
      // CA-125 is an arbitrary-unit property: UCUM U is the catalytic enzyme unit.
      assert.deepStrictEqual(itemsById['body-blood-serum-ca-125'].fhir.value.units, { 'concentration/u-ml': "[arb'U]/mL" });
    });

    it('[FHIR-ITEM-12] lab (plan 115 labs slice): a differential percentage and its count map together on their stream; two units of one property share their code; a unit or an item LOINC has no code for takes the HDS item coding, the owned method codes as import keys; eGFR exports the equation-neutral 69405-9; the INR is a ratio-quantity', () => {
      const lab = {
        us: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab',
        ips: 'http://hl7.org/fhir/uv/ips/StructureDefinition/Observation-results-laboratory-pathology-uv-ips'
      };
      const percent = { kind: 'scaled-quantity', units: { 'ratio/proportion': { unit: '%', factor: 100 } } };
      const loinc = (code, display) => ({ system: 'http://loinc.org', code, display });
      const hds = (key) => ({ system: 'https://hds.ngo/fhir/CodeSystem/item', code: key, display: itemsById[key].label.en });
      const codes = (list) => (list || []).map((c) => c.code);

      // The eight differential streams: both items mapped, the percentage in %, the count in its printed unit.
      const pairs = { neutrophils: ['26511-6', '26499-4'], 'neutrophils-segmented': ['26505-8', '30451-9'], 'neutrophils-band': ['26508-2', '26507-4'], lymphocytes: ['26478-8', '26474-7'], monocytes: ['26485-3', '26484-6'], eosinophils: ['26450-7', '26449-9'], basophils: ['30180-4', '26444-0'], reticulocytes: ['4679-7', '14196-0'] };
      for (const [name, [pct, count]] of Object.entries(pairs)) {
        const stream = `body-blood-cbc-${name}`;
        const p = itemsById[stream];
        const c = itemsById[`${stream}-count`];
        assert.deepStrictEqual([p.streamId, c.streamId], [stream, stream], name);
        assert.deepStrictEqual([p.fhir.category, p.fhir.code.code, p.fhir.value, p.fhir.profiles], ['laboratory', pct, percent, lab], name);
        assert.deepStrictEqual([c.fhir.category, c.fhir.code.code, c.fhir.value.kind, c.fhir.profiles], ['laboratory', count, 'quantity', lab], name);
        // Every method code an item owns is an import key of its block, and nothing else is.
        for (const i of [p, c]) assert.deepStrictEqual(codes(i.fhir.alsoMatch), i.references.loincMethod, name);
        assert.ok(fhirScopes['Observation|laboratory'].includes(stream), `${stream} is a laboratory grant root`);
        assert.deepStrictEqual([...computeFhirScopes(itemsById).subtree.get(stream)], ['Observation|laboratory'], `${stream} holds one pair`);
      }
      assert.deepStrictEqual(itemsById['body-blood-cbc-neutrophils-count'].fhir.value.units, { 'concentration/megacount-ml': '10*6/mL', 'concentration/count-ul': '/uL' });
      assert.deepStrictEqual(itemsById['body-blood-cbc-reticulocytes-count'].fhir.value.units, { 'concentration/megacount-ml': '10*6/mL', 'concentration/count-ul': '/uL', 'concentration/gigacount-ml': '10*9/mL' });

      // Percentages on a stream of their own.
      const alone = { 'body-blood-cbc-reticulocytes-immature-fraction': '33516-6', 'body-semen-motility-progressive': '14194-5', 'body-semen-motility-total': '6800-7', 'body-semen-vitality': '10613-8', 'body-semen-morphology-normal': '10622-9' };
      for (const [k, code] of Object.entries(alone)) {
        assert.deepStrictEqual([itemsById[k].fhir.code.code, itemsById[k].fhir.value, itemsById[k].references.loinc], [code, percent, [code]], k);
      }

      // Two units of one property store one code: the coding names both eventTypes, the units stay distinct.
      const testo = itemsById['body-blood-serum-testosterone-total'].fhir;
      assert.deepStrictEqual(Object.fromEntries(Object.entries(testo.code.codings).map(([t, c]) => [t, c.code])), { 'concentration/ng-dl': '2986-8', 'concentration/nmol-l': '14913-8', 'concentration/ug-l': '2986-8' });
      assert.deepStrictEqual(testo.value.units, { 'concentration/ng-dl': 'ng/dL', 'concentration/nmol-l': 'nmol/L', 'concentration/ug-l': 'ug/L' });
      const cpep = itemsById['body-blood-serum-c-peptide'].fhir;
      assert.deepStrictEqual(Object.fromEntries(Object.entries(cpep.code.codings).map(([t, c]) => [t, c.code])), { 'concentration/ug-l': '1986-9', 'concentration/nmol-l': '14633-2', 'concentration/pmol-l': '14633-2' });
      for (const k of ['body-blood-serum-testosterone-total', 'body-blood-serum-c-peptide']) {
        for (const o of itemsById[k].variations.eventType.options) assert.strictEqual(itemsById[k].fhir.code.codings[o.value].code, o.loinc, `${k} ${o.value}`);
      }

      // The one unit LOINC has no code for (1,25-dihydroxyvitamin D in pmol/L: 14566-4 is calcitriol alone): the HDS
      // item coding on that eventType, the LOINC code on the other. Every other `null` option is gone.
      const vitD = itemsById['body-blood-serum-vitamin-d-125oh'];
      assert.deepStrictEqual(vitD.fhir.code.codings['concentration/pmol-l'], hds('body-blood-serum-vitamin-d-125oh'));
      assert.strictEqual(vitD.fhir.code.codings['concentration/pg-ml'].code, '62290-2');
      assert.deepStrictEqual(vitD.references.loinc, ['62290-2'], 'the HDS coding is not a LOINC claim');
      const nullUnits = Object.entries(itemsById).filter(([, i]) => !i.deprecated && (i.variations?.eventType?.options || []).some((o) => o.loinc === null)).map(([k]) => k);
      assert.deepStrictEqual(nullUnits, ['body-blood-serum-vitamin-d-125oh']);
      // Fasting insulin in pmol/L has a LOINC code, 59179-2 (the model said it had none until this slice).
      assert.deepStrictEqual(itemsById['body-blood-serum-insulin-fasting'].fhir.code.codings['concentration/pmol-l'], loinc('59179-2', 'Insulin [Moles/volume] in Serum or Plasma --fasting'));

      // No exportable LOINC code (none, or only codes that state a method or a direction the item does not store, or
      // mean something else): the HDS item coding, and the codes the item owns as import keys.
      const owned = { 'body-blood-serum-ldh': 'U/L', 'body-blood-coagulation-prothrombin-activity': '%', 'body-semen-dna-fragmentation': null, 'body-semen-tmc': '10*6' };
      for (const [k, unit] of Object.entries(owned)) {
        const i = itemsById[k];
        assert.deepStrictEqual(i.fhir.code, hds(k), k);
        assert.strictEqual(i.references?.loinc, undefined, `${k} asserts no LOINC code`);
        assert.deepStrictEqual(codes(i.fhir.alsoMatch), i.references?.loincMethod || [], k);
        if (unit != null) assert.deepStrictEqual(Object.values(i.fhir.value.units), [unit], k);
      }
      // eGFR exports the equation-neutral 69405-9; the ten per-equation codes it owns import, the equation is not kept
      // (Schwartz and the sex-specific MDRD codes since 4.10.0, B-2026-11-14-6).
      const egfr = itemsById['body-blood-serum-egfr'];
      assert.deepStrictEqual(egfr.fhir.code, loinc('69405-9', 'Glomerular filtration rate [Volume Rate/Area] in Serum, Plasma or Blood by based on 1.73 sq M'));
      assert.deepStrictEqual(egfr.references.loinc, ['69405-9']);
      assert.deepStrictEqual(codes(egfr.fhir.alsoMatch), ['98979-8', '62238-1', '77147-7', '88293-6', '88294-4', '48643-1', '48642-3', '50384-7', '50044-7', '70969-1']);
      assert.deepStrictEqual(codes(egfr.fhir.alsoMatch), egfr.references.loincMethod);
      assert.deepStrictEqual(egfr.fhir.value, { kind: 'quantity', units: { 'rate/ml-min-173m2': 'mL/min/{1.73_m2}' } });
      assert.deepStrictEqual(itemsById['body-semen-dna-fragmentation'].fhir.value, percent);
      // Quick % is stored as printed on ratio/percent (it exceeds 100 %): a plain quantity, never a factor.
      assert.deepStrictEqual(itemsById['body-blood-coagulation-prothrombin-activity'].fhir.value, { kind: 'quantity', units: { 'ratio/percent': '%' } });

      // The INR: `{ value, relativeTo: 1 }`, the block states the denominator the item fixes.
      const inr = itemsById['body-blood-coagulation-inr'];
      assert.deepStrictEqual(inr.fhir, { resourceType: 'Observation', category: 'laboratory', code: loinc('6301-6', 'INR in Platelet poor plasma by Coagulation assay'), alsoMatch: [loinc('38875-1', 'INR in Platelet poor plasma or blood by Coagulation assay')], value: { kind: 'ratio-quantity', units: { 'ratio/generic': '{INR}' }, relativeTo: 1 }, profiles: lab });
      assert.deepStrictEqual(inr.references.loincMethod, ['38875-1'], 'the PPP-or-blood INR imports (4.10.0, B-2026-11-14-6)');
      assert.strictEqual(inr.fhir.value.relativeTo, inr.ratioRelativeTo);

      // Every HDS item coding in a block is the item's own key with its English label (a deprecated alias carries its replacement's).
      for (const [k, i] of Object.entries(itemsById)) {
        const f = i.fhir;
        if (f == null || f.code == null) continue;
        const own = f.code.from === 'eventType' ? Object.values(f.code.codings) : f.code.from == null ? [f.code] : [];
        for (const c of own.filter((x) => x.system === 'https://hds.ngo/fhir/CodeSystem/item')) {
          if (!i.deprecated) assert.strictEqual(c.code, k, k);
          assert.strictEqual(c.display, itemsById[c.code].label.en, k);
        }
      }
    });

    it('[FHIR-ITEM-10] urine hormones (4.0.0): LH on 15079-7 with its legacy item, E3G and PdG on the HDS item coding, each legacy item rendering in the true unit', () => {
      const lab = {
        us: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab',
        ips: 'http://hl7.org/fhir/uv/ips/StructureDefinition/Observation-results-laboratory-pathology-uv-ips'
      };
      const lhCode = { system: 'http://loinc.org', code: '15079-7', display: 'Lutropin [Units/volume] in Urine' };
      const lh = itemsById['body-urine-hormones-lh'].fhir;
      assert.deepStrictEqual(lh, { resourceType: 'Observation', category: 'laboratory', code: lhCode, value: { kind: 'quantity', units: { 'concentration/iu-l': '[IU]/L' } }, profiles: lab });
      // The legacy LH item (mg-l, B-2026-07-15-1) holds IU/L numbers: same block, its own eventType rendering in [IU]/L.
      const lhLegacy = itemsById['fertility-hormone-lh'];
      assert.strictEqual(lhLegacy.deprecated, true);
      assert.deepStrictEqual(lhLegacy.fhir, { ...lh, value: { kind: 'quantity', units: { 'concentration/mg-l': '[IU]/L' } } });
      // No LOINC or SNOMED for the glucuronides: the code is the item's own coding, the unit is UCUM.
      const hds = (key, display) => ({ system: 'https://hds.ngo/fhir/CodeSystem/item', code: key, display });
      const e3g = itemsById['body-urine-hormones-e3g'].fhir;
      assert.deepStrictEqual(e3g, { resourceType: 'Observation', category: 'laboratory', code: hds('body-urine-hormones-e3g', 'E3G (urine)'), value: { kind: 'quantity', units: { 'concentration/ug-l': 'ng/mL' } }, profiles: lab });
      const pdg = itemsById['body-urine-hormones-pdg'].fhir;
      // μg/mL stores on the legacy mg-l (the same quantity), so the block's UCUM unit is ug/mL on concentration/mg-l.
      assert.deepStrictEqual(pdg, { resourceType: 'Observation', category: 'laboratory', code: hds('body-urine-hormones-pdg', 'PdG (urine)'), value: { kind: 'quantity', units: { 'concentration/mg-l': 'ug/mL' } }, profiles: lab });
      // The legacy PdG item (iu-l) holds μg/mL numbers: same block, rendering in ug/mL.
      const pdgLegacy = itemsById['fertility-hormone-pdg'];
      assert.strictEqual(pdgLegacy.deprecated, true);
      assert.deepStrictEqual(pdgLegacy.fhir, { ...pdg, value: { kind: 'quantity', units: { 'concentration/iu-l': 'ug/mL' } } });
      for (const k of ['body-urine-hormones-lh', 'body-urine-hormones-e3g', 'body-urine-hormones-pdg']) {
        assert.ok(fhirScopes['Observation|laboratory'].includes(k), `${k} is a laboratory grant root`);
      }
      // E3G and PdG stay without LOINC: the HDS coding is not a LOINC claim.
      assert.strictEqual(itemsById['body-urine-hormones-e3g'].references?.loinc, undefined);
      assert.strictEqual(itemsById['body-urine-hormones-pdg'].references?.loinc, undefined);
    });

    it('[FHIR-ITEM-8] proportions render in % with factor 100: SpO2 emits 2708-6 beside 59408-5; the lab percentages on their own stream', () => {
      const percent = { kind: 'scaled-quantity', units: { 'ratio/proportion': { unit: '%', factor: 100 } } };
      const spo2 = itemsById['body-oxygen-saturation'].fhir;
      assert.deepStrictEqual(spo2.code, { system: 'http://loinc.org', code: '59408-5', display: 'Oxygen saturation in Arterial blood by Pulse oximetry' });
      assert.deepStrictEqual(spo2.alsoEmit, [{ system: 'http://loinc.org', code: '2708-6', display: 'Oxygen saturation in Arterial blood' }]);
      assert.strictEqual(spo2.alsoMatch, undefined, '2708-6 alone is a blood-gas SaO2, never imported here');
      assert.deepStrictEqual(spo2.value, percent);
      assert.strictEqual(spo2.profiles.us, 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-pulse-oximetry');
      const lab = { 'body-blood-hba1c': '4548-4', 'body-blood-serum-transferrin-saturation': '2502-3', 'body-blood-cbc-hematocrit': '4544-3', 'body-blood-cbc-rdw': '30385-9', 'body-blood-cbc-myelocytes': '26498-6', 'body-blood-cbc-metamyelocytes': '28541-1' };
      for (const [k, code] of Object.entries(lab)) {
        const f = itemsById[k].fhir;
        assert.deepStrictEqual([f.category, f.code.code, f.value], ['laboratory', code, percent], k);
      }
    });

    it('[FHIR-ITEM-9] body height: 8302-2, metres in cm and feet in inches (the profiles take cm or [in_i] only); body temperature stays unmapped', () => {
      const h = itemsById['body-height'].fhir;
      assert.deepStrictEqual(h.code, { system: 'http://loinc.org', code: '8302-2', display: 'Body height' });
      assert.deepStrictEqual(h.alsoMatch, [{ system: 'http://loinc.org', code: '3137-7', display: 'Body height Measured' }]);
      assert.deepStrictEqual(h.value, { kind: 'scaled-quantity', units: { 'length/m': { unit: 'cm', factor: 100 }, 'length/ft': { unit: '[in_i]', factor: 12 } } });
      assert.deepStrictEqual(h.profiles, { us: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-body-height', ips: 'http://hl7.org/fhir/StructureDefinition/bodyheight' });
      // Its stream holds the basal temperature (fertility charting) and its disturbance flag, both unmapped.
      assert.strictEqual(itemsById['body-temperature'].fhir, undefined);
    });

    it('[FHIR-ITEM-2] wellbeing-general-health: 5 levels, higher is better, LOINC answers on every option', () => {
      const gh = itemsById['wellbeing-general-health'];
      assert.strictEqual(gh.eventType, 'ratio/proportion');
      assert.deepStrictEqual(gh.options.map((o) => [o.value, o.label.en]), [[1, 'Excellent'], [0.75, 'Very good'], [0.5, 'Good'], [0.25, 'Fair'], [0, 'Poor']]);
      assert.deepStrictEqual(gh.fhir.code, { system: 'http://loinc.org', code: '61577-3', display: 'In general, would you say your health is [PROMIS]' });
      // keyed by String(option value): 1.0 is "1", 0.0 is "0"
      assert.deepStrictEqual(Object.fromEntries(Object.entries(gh.fhir.value.options).map(([k, c]) => [k, c.code])),
        { 1: 'LA9206-9', 0.75: 'LA13913-1', 0.5: 'LA8967-7', 0.25: 'LA8968-5', 0: 'LA8969-3' });
      assert.strictEqual(gh.fhir.profiles.ips, undefined, 'no IPS profile: base resource');
    });

    it('[FHIR-ITEM-3] condition-coded takes its code from the datasource selection and has no value', () => {
      const c = itemsById['condition-coded'].fhir;
      assert.deepStrictEqual(c.code, { from: 'datasource', field: 'condition' });
      assert.strictEqual(c.value, undefined);
    });

    it('[FHIR-ITEM-4] the Patient is assembled from profile items; the other profile items stay unmapped', () => {
      const elements = Object.fromEntries(Object.entries(itemsById).filter(([, it]) => it.fhir?.element != null).map(([k, it]) => [k, it.fhir.element]));
      assert.deepStrictEqual(elements, {
        'profile-addresscountry': 'address.country',
        'profile-date-of-birth': 'birthDate',
        'profile-name': 'name.given',
        'profile-surname': 'name.family',
        'profile-sex': 'gender'
      });
      for (const k of ['profile-birthcountry', 'profile-ethnicity', 'profile-avatar', 'profile-display-name', 'profile-reproductive-stage']) {
        assert.strictEqual(itemsById[k].fhir, undefined, `${k} is mapped`);
      }
      assert.deepStrictEqual(Object.fromEntries(Object.entries(itemsById['profile-sex'].fhir.value.options).map(([k, c]) => [k, c.code])), { male: 'male', female: 'female' });
    });

    it('[FHIR-ITEM-5] import-only codings: 55284-4 on blood pressure, the finer US Core smoking answers on `current`, survey and encounter-diagnosis categories', () => {
      const bp = itemsById['body-blood-pressure'].fhir;
      assert.deepStrictEqual(bp.alsoMatch, [{ system: 'http://loinc.org', code: '55284-4', display: 'Blood pressure systolic and diastolic' }]);
      const smoke = itemsById['lifestyle-tobacco-smoking'].fhir;
      assert.deepStrictEqual(Object.keys(smoke.value.alsoMatch), ['current']);
      assert.deepStrictEqual(smoke.value.alsoMatch.current.map((c) => [c.code, c.display]), [
        ['449868002', 'Smokes tobacco daily'],
        ['428041000124106', 'Occasional tobacco smoker'],
        ['428071000124103', 'Heavy tobacco smoker'],
        ['428061000124105', 'Light tobacco smoker']
      ]);
      assert.deepStrictEqual(smoke.alsoMatchCategories, ['survey']);
      assert.deepStrictEqual(itemsById['condition-coded'].fhir.alsoMatchCategories, ['encounter-diagnosis']);
    });

    it('[FHIR-ITEM-6] body-heart-rate: 8867-4 in /min, the same code the blood-pressure split renders the pulse with', () => {
      const hr = itemsById['body-heart-rate'].fhir;
      assert.deepStrictEqual(hr.code, { system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' });
      assert.deepStrictEqual(hr.value, { kind: 'quantity', units: { 'frequency/bpm': '/min' } });
      assert.deepStrictEqual(hr.code, itemsById['body-blood-pressure'].fhir.split.rate.code);
      assert.deepStrictEqual(hr.profiles, itemsById['body-blood-pressure'].fhir.split.rate.profiles);
    });

    it('[FHIR-ITEM-11] medications (plan 115): the intake items are a MedicationStatement, the prescriptions a MedicationRequest; coded items take the drug from the datasource, basic ones the name as text; one Dosage shape', () => {
      const sct = (code, display) => ({ system: 'http://snomed.info/sct', code, display });
      const intake = itemsById['medication-intake-coded'].fhir;
      assert.strictEqual(intake.resourceType, 'MedicationStatement');
      assert.strictEqual(intake.category, undefined, 'a bare scope key: no category table');
      assert.deepStrictEqual(intake.code, { from: 'datasource', field: 'drug' });
      assert.strictEqual(intake.dosage.field, 'intake');
      assert.deepStrictEqual(intake.dosage.doseUnits, { 'dose/tablet': '{tbl}', 'dose/drop': '[drp]', 'dose/puff': '{puff}', 'dose/application': '{application}', 'dose/suppository': '{suppository}', 'dose/unit': '[IU]', 'mass/mg': 'mg', 'mass/mcg': 'ug', 'mass/g': 'g', 'volume/ml': 'mL' });
      assert.deepStrictEqual(intake.dosage.routes.oral, sct('26643006', 'Oral route'));
      assert.deepStrictEqual(intake.dosage.routes.inhalation, sct('447694001', 'Respiratory tract route'));
      assert.deepStrictEqual(intake.dosage.routes.parenteral, { text: 'Parenteral' }, 'no active SNOMED CT route concept');
      assert.deepStrictEqual(Object.keys(intake.dosage.routes).sort(), ['inhalation', 'intramuscular', 'intravenous', 'nasal', 'ophthalmic', 'oral', 'otic', 'parenteral', 'rectal', 'subcutaneous', 'sublingual', 'topical', 'transdermal', 'vaginal']);
      assert.deepStrictEqual(intake.profiles, { ips: 'http://hl7.org/fhir/uv/ips/StructureDefinition/MedicationStatement-uv-ips' }, 'US Core has no MedicationStatement profile');
      const basic = itemsById['medication-intake-basic'].fhir;
      assert.deepStrictEqual(basic, { ...intake, code: { from: 'text', field: 'name' } });
      const rx = itemsById['medication-prescription-coded'].fhir;
      assert.strictEqual(rx.resourceType, 'MedicationRequest');
      assert.deepStrictEqual(rx.code, { from: 'datasource', field: 'drug' });
      assert.deepStrictEqual(rx.dosage, { ...intake.dosage, field: 'posology' });
      assert.deepStrictEqual(rx.profiles, {
        us: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-medicationrequest',
        ips: 'http://hl7.org/fhir/uv/ips/StructureDefinition/MedicationRequest-uv-ips'
      });
      assert.deepStrictEqual(itemsById['medication-prescription-basic'].fhir, { ...rx, code: { from: 'text', field: 'name' } });
      // CIS: the ANS SMT's BDPM CodeSystem (its specialite concepts are the CIS codes; evidence in mapping.yaml), not an HDS namespace
      assert.deepStrictEqual(fhirMapping.productSystems, { Swissmedic: 'https://hds.ngo/fhir/sid/swissmedic', CIS: 'https://smt.esante.gouv.fr/terminologie-bdpm' });
    });

    it('[FHIR-ITEM-13] procedures (plan 115): both procedure items are a Procedure under a bare scope key; the coded item takes its code from the datasource, the basic one the name as text; count is never rendered; the treatment items stay unmapped', () => {
      const profiles = {
        us: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-procedure',
        ips: 'http://hl7.org/fhir/uv/ips/StructureDefinition/Procedure-uv-ips'
      };
      assert.deepStrictEqual(itemsById['procedure-coded'].fhir, { resourceType: 'Procedure', code: { from: 'datasource', field: 'procedure' }, profiles });
      assert.deepStrictEqual(itemsById['procedure-basic'].fhir, { resourceType: 'Procedure', code: { from: 'text', field: 'name' }, ignore: ['count', 'robotAssisted'], profiles });
      // 4.8.0 (B-2026-11-16-1): robotAssisted is on the form, still not rendered; findings is not a form field (an array).
      assert.deepStrictEqual(Object.keys(itemsById['procedure-basic'].composite), ['name', 'count', 'robotAssisted', 'notes']);
      assert.strictEqual(itemsById['procedure-basic'].composite.robotAssisted.type, 'checkbox');
      assert.strictEqual(fhirMapping.categories.Procedure, undefined, 'no category table: a bare scope key, for good');
      for (const k of ['procedure-basic', 'procedure-coded']) {
        assert.strictEqual(itemsById[k].streamId, 'procedure');
        assert.strictEqual(itemsById[k].duration, undefined, `${k}: a point event, no duration declared`);
      }
      for (const k of ['treatment-basic', 'treatment-coded']) assert.strictEqual(itemsById[k].fhir, undefined, `${k} is mapped`);
    });

    it('[FHIR-ITEM-14] questionnaire answers (plan 115): the answer item is a QuestionnaireResponse under a bare scope key, with no code and no profile claimed; the request item is a Questionnaire under a bare scope key of its own, on a sibling stream; the root is explicitGrantOnly and the consent text names everything a grant shows', () => {
      const answer = itemsById['questionnaire-answer'];
      const request = itemsById['questionnaire-request'];
      // no profile on any flavour: the US Core profile is not claimed (FHIR-MAPPING.md § No profile is claimed)
      assert.deepStrictEqual(answer.fhir, { resourceType: 'QuestionnaireResponse', profiles: {} });
      assert.strictEqual(fhirMapping.categories.QuestionnaireResponse, undefined, 'no category table: a bare scope key, for good');
      assert.deepStrictEqual([answer.streamId, answer.eventType, answer.type], ['questionnaire-answer', 'questionnaire/answer-v1', 'system']);
      assert.deepStrictEqual([request.streamId, request.eventType, request.type], ['questionnaire-request', 'questionnaire/request-v1', 'system']);
      // the request (Questionnaire slice): the same shape of block, its own bare key, no profile either
      assert.deepStrictEqual(request.fhir, { resourceType: 'Questionnaire', profiles: {} });
      assert.strictEqual(fhirMapping.categories.Questionnaire, undefined, 'no category table: a bare scope key, for good');
      const { streamsById } = require('../src/streams');
      assert.deepStrictEqual(streamsById.questionnaire.children.map((c) => c.id), ['questionnaire-request', 'questionnaire-answer']);
      // the consent text says what a bare label hides: answers on any health topic, with the qualifier the person
      // added and the reason typed when declining (both free content the grant shows)
      for (const id of ['questionnaire', 'questionnaire-answer']) {
        assert.match(streamsById[id].description.en, /any health topic/);
        assert.match(streamsById[id].description.fr, /tout sujet de santé/);
        assert.match(streamsById[id].description.en, /any detail you added and the reason you gave for not answering/);
        assert.match(streamsById[id].description.fr, /les précisions que vous avez ajoutées et la raison que vous avez donnée pour ne pas répondre/);
      }
      // granted on purpose only: the marker is on the root (the whole subtree), and every description says so
      assert.strictEqual(streamsById.questionnaire.explicitGrantOnly, true);
      for (const id of ['questionnaire', 'questionnaire-request', 'questionnaire-answer']) {
        assert.match(streamsById[id].description.en, /Never included when you share all your data: shared only when you name them\.$/);
        assert.match(streamsById[id].description.fr, /Jamais inclus(es)? quand vous partagez toutes vos données : partagée?s seulement si vous les nommez\.$/);
      }
      // one French form for the consent row, the stream and the group: the plural
      assert.strictEqual(answer.label.fr, 'Réponses aux questionnaires');
      assert.strictEqual(streamsById['questionnaire-answer'].label.fr, answer.label.fr);
    });
  });

  describe('[FHIR-SCH] the schema', () => {
    it('[FHIR-SCH-1] refuses a label instead of a canonical system URI, a coding without display, and unknown keys', () => {
      const a = item('body-weight');
      a.fhir.code.system = 'loinc';
      assert.throws(() => checkItem(a, 'w'), /pattern/);
      const b = item('body-weight');
      delete b.fhir.code.display;
      assert.throws(() => checkItem(b, 'w'), /display/);
      const c = item('body-weight');
      c.fhir.extra = 1;
      assert.throws(() => checkItem(c, 'w'), /additional properties/);
    });

    it('[FHIR-SCH-2] discriminates by value kind: a field of another kind is refused', () => {
      const a = item('body-weight');
      a.fhir.value.options = { 1: coding('1') };
      assert.throws(() => checkItem(a, 'w'), /additional properties/);
      const b = item('lifestyle-tobacco-smoking');
      b.fhir.value.units = { x: 'kg' };
      assert.throws(() => checkItem(b, 's'), /additional properties/);
      const c = item('body-blood-pressure');
      c.fhir.value.units = { x: 'kg' };
      assert.throws(() => checkItem(c, 'bp'), /additional properties/);
      const d = item('body-weight');
      delete d.fhir.value.units;
      assert.throws(() => checkItem(d, 'w'), /units/);
    });

    it('[FHIR-SCH-3] removed shapes are refused: scaled, datasource-codes, split pair, null profile, empty unit', () => {
      const a = item('wellbeing-general-health');
      a.fhir.value = { kind: 'scaled', multiplier: 100 };
      assert.throws(() => checkItem(a, 'gh'), /allowed values/);
      const b = item('condition-coded');
      b.fhir.value = { kind: 'datasource-codes', field: 'condition' };
      assert.throws(() => checkItem(b, 'c'), /allowed values/);
      const c = item('body-blood-pressure');
      c.fhir.split.rate.category = 'vital-signs';
      assert.throws(() => checkItem(c, 'bp'), /additional properties/);
      const d = item('wellbeing-general-health');
      d.fhir.profiles.ips = null;
      assert.throws(() => checkItem(d, 'gh'), /must be string/);
      const e = item('body-weight');
      e.fhir.value.units['mass/kg'] = '';
      assert.throws(() => checkItem(e, 'w'), /fewer than 1 characters/);
    });

    it('[FHIR-SCH-8] scaled-quantity: each eventType takes a UCUM unit and a positive factor, nothing else; alsoEmit is a list of codings', () => {
      const s = () => item('body-blood-hba1c');
      checkItem(s(), 'a');
      const a = s();
      a.fhir.value.units['ratio/proportion'] = '%';
      assert.throws(() => checkItem(a, 'a'), /must be object/);
      const b = s();
      delete b.fhir.value.units['ratio/proportion'].factor;
      assert.throws(() => checkItem(b, 'a'), /must have required property 'factor'/);
      const c = s();
      c.fhir.value.units['ratio/proportion'].factor = 0;
      assert.throws(() => checkItem(c, 'a'), /must be > 0/);
      const d = s();
      d.fhir.value.units['ratio/proportion'].offset = 1;
      assert.throws(() => checkItem(d, 'a'), /additional properties/);
      const e = s();
      e.fhir.value.scale = 100;
      assert.throws(() => checkItem(e, 'a'), /additional properties/);
      const f = item('body-weight');
      f.fhir.value.units['mass/kg'] = { unit: 'kg', factor: 1 };
      assert.throws(() => checkItem(f, 'w'), /must be string/);
      const g = item('body-oxygen-saturation');
      g.fhir.alsoEmit = [];
      assert.throws(() => checkItem(g, 'o'), /fewer than 1 items/);
      g.fhir.alsoEmit = [{ system: 'http://loinc.org', code: '2708-6' }];
      assert.throws(() => checkItem(g, 'o'), /display/);
    });

    it('[FHIR-SCH-4] a code source is `{ from: datasource, field }`, `{ from: eventType, codings }`, `{ from: content, field, translate, unknown }` or `{ from: text, field }` and nothing else', () => {
      const a = item('condition-coded');
      a.fhir.code.from = 'stream';
      assert.throws(() => checkItem(a, 'c'), /allowed values/);
      const txt = item('medication-intake-basic');
      checkItem(txt, 'm');
      txt.fhir.code.translate = {};
      assert.throws(() => checkItem(txt, 'm'), /additional properties/);
      const txt2 = item('medication-intake-basic');
      delete txt2.fhir.code.field;
      assert.throws(() => checkItem(txt2, 'm'), /must have required property 'field'/);
      const proc = item('procedure-basic');
      checkItem(proc, 'p');
      proc.fhir.resourceType = 'ServiceRequest';
      assert.throws(() => checkItem(proc, 'p'), /allowed values/);
      // a QuestionnaireResponse block has no code and nothing else; every other resourceType needs its code
      const qr = item('questionnaire-answer');
      checkItem(qr, 'q');
      qr.fhir.code = coding('1');
      assert.throws(() => checkItem(qr, 'q'), /must NOT have more than 2 properties/);
      const qn = item('questionnaire-request');
      checkItem(qn, 'q');
      qn.fhir.code = coding('1');
      assert.throws(() => checkItem(qn, 'q'), /must NOT have more than 2 properties/);
      const noCode = item('procedure-basic');
      delete noCode.fhir.code;
      assert.throws(() => checkItem(noCode, 'p'), /must have required property 'code'/);
      const ct = item('condition-coded');
      ct.fhir.code.from = 'content';
      assert.throws(() => checkItem(ct, 'c'), /must have required property 'translate'/);
      const doc = item('document');
      checkItem(doc, 'document');
      const noUnknown = item('document');
      delete noUnknown.fhir.code.unknown;
      assert.throws(() => checkItem(noUnknown, 'document'), /must have required property 'unknown'/);
      const badKey = item('document');
      badKey.fhir.code.translate['SNOMED-CT|1'] = { system: 'http://loinc.org', code: '1', display: 'x' };
      assert.throws(() => checkItem(badKey, 'document'), /propertyNames|pattern/);
      const extra = item('document');
      extra.fhir.code.codings = {};
      assert.throws(() => checkItem(extra, 'document'), /additional properties/);
      const b = item('condition-coded');
      b.fhir.code.display = 'x';
      assert.throws(() => checkItem(b, 'c'), /additional properties/);
      const g = () => item('body-blood-serum-glucose-fasting');
      checkItem(g(), 'g');
      const c = g();
      c.fhir.code.field = 'x';
      assert.throws(() => checkItem(c, 'g'), /additional properties/);
      const d = g();
      delete d.fhir.code.codings;
      assert.throws(() => checkItem(d, 'g'), /must have required property 'codings'/);
      const e = g();
      delete e.fhir.code.codings['concentration/mmol-l'];
      assert.throws(() => checkItem(e, 'g'), /fewer than 2 properties/);
      const f = g();
      f.fhir.code.codings['concentration/mg-dl'] = { system: 'LOINC', code: '1558-6', display: 'x' };
      assert.throws(() => checkItem(f, 'g'), /must match pattern/);
      const h = item('condition-coded');
      h.fhir.code = { from: 'datasource', codings: {} };
      assert.throws(() => checkItem(h, 'c'), /must have required property 'field'/);
    });

    it('[FHIR-SCH-5] a companion block holds companionOf only', () => {
      const a = item('body-temperature-basal');
      a.fhir = { companionOf: 'body-weight' };
      checkItem(a, 't');
      a.fhir.category = 'vital-signs';
      assert.throws(() => checkItem(a, 't'), /additional properties/);
    });

    it('[FHIR-SCH-7] a Patient element block holds resourceType, element and value only; the element list is the checker\'s', () => {
      const a = item('profile-name');
      a.fhir.element = 'name.prefix';
      assert.throws(() => checkItem(a, 'n'), /allowed values/);
      const b = item('profile-name');
      b.fhir.category = 'demographics';
      assert.throws(() => checkItem(b, 'n'), /additional properties/);
      const c = item('profile-name');
      c.fhir.profiles = {};
      assert.throws(() => checkItem(c, 'n'), /additional properties/);
      const d = item('profile-name');
      d.fhir.resourceType = 'Practitioner';
      assert.throws(() => checkItem(d, 'n'), /allowed values/);
      const [, defsSchema] = schemasToBePublished().map((f) => f.content);
      assert.deepStrictEqual(defsSchema.definitions.fhirElement.properties.element.enum, Object.keys(PATIENT_ELEMENTS));
    });

    it('[FHIR-SCH-6] round trip: every published item validates against the published schema, compiled afresh', () => {
      const [itemSchema, defsSchema] = schemasToBePublished().map((f) => JSON.parse(JSON.stringify(f.content)));
      const ajv = new Ajv({ schemas: [itemSchema, defsSchema], allowUnionTypes: true });
      const validate = ajv.getSchema(itemSchema.$id);
      const published = JSON.parse(JSON.stringify(toBePublished()[0].content));
      for (const [key, it] of Object.entries(published)) {
        assert.ok(validate(it), `${key}: ${ajv.errorsText(validate.errors)}`);
      }
    });
  });

  describe('[FHIR-MAP] the block agrees with its item', () => {
    it('[FHIR-MAP-1] quantity units cover exactly the item eventTypes, on number items only', () => {
      const a = item('body-weight');
      delete a.fhir.value.units['mass/lb'];
      assert.throws(() => check(a), /missing \[mass\/lb\]/);
      const b = item('body-weight');
      b.fhir.value.units['mass/g'] = 'g';
      assert.throws(() => check(b), /unknown \[mass\/g\]/);
      const c = item('wellbeing-general-health');
      c.fhir.value = { kind: 'quantity', units: { 'ratio/proportion': '1' } };
      assert.throws(() => check(c), /applies to "number" items only/);
    });

    it('[FHIR-MAP-16] two eventTypes of one quantity block never share a UCUM unit, annotations aside', () => {
      assert.deepStrictEqual(['{beats}/min', '/min', '{score}', '1', 'kg'].map(ucumKey), ['/min', '/min', '1', '1', 'kg']);
      const a = item('body-weight');
      a.fhir.value.units['mass/lb'] = 'kg';
      assert.throws(() => check(a), /eventTypes "mass\/kg" and "mass\/lb" share the UCUM unit "kg"/);
      const b = item('body-weight');
      b.fhir.value.units['mass/kg'] = '{net}kg';
      b.fhir.value.units['mass/lb'] = 'kg{gross}';
      assert.throws(() => check(b), /share the UCUM unit "kg" \(annotations aside\)/);
    });

    it('[FHIR-MAP-2] coded options match the item options and codings are unique within the item', () => {
      const a = item('lifestyle-tobacco-smoking');
      delete a.fhir.value.options.current;
      assert.throws(() => check(a), /missing \[current\]/);
      const b = item('lifestyle-tobacco-smoking');
      b.fhir.value.options.current = b.fhir.value.options.former;
      assert.throws(() => check(b), /appears more than once/);
    });

    it('[FHIR-MAP-3] coded is refused on a multi-select', () => {
      const ms = Object.entries(itemsById).find(([, it]) => it.type === 'multi-select');
      assert.ok(ms, 'the model has a multi-select item');
      const it = structuredClone(ms[1]);
      it.fhir = { resourceType: 'Observation', category: 'survey', code: coding('1'), value: { kind: 'coded', options: {} }, profiles: {} };
      for (const o of it.options) it.fhir.value.options[String(o.value)] = coding(String(o.value));
      assert.throws(() => check(it), /multi-select is not supported/);
    });

    it('[FHIR-MAP-4] category is required for Observation and Condition, and checked against its resourceType table', () => {
      const a = item('body-weight');
      a.fhir.category = 'vital-sign';
      assert.throws(() => check(a), /unknown Observation category "vital-sign"/);
      const b = item('body-weight');
      delete b.fhir.category;
      assert.throws(() => check(b), /needs a "category"/);
      const c = item('body-weight');
      c.fhir.category = 'problem-list-item';
      assert.throws(() => check(c), /unknown Observation category/);
      const d = item('condition-coded');
      d.fhir.category = 'health-concern';
      check(d);
      d.fhir.category = 'vital-signs';
      assert.throws(() => check(d), /unknown Condition category/);
    });

    it('[FHIR-MAP-5] split and component fields are numeric composite fields, never both', () => {
      const a = item('body-blood-pressure');
      a.fhir.split.pulse = a.fhir.split.rate;
      assert.throws(() => check(a), /split "pulse" is not a composite field/);
      const b = item('body-blood-pressure');
      b.fhir.value.components.rate = { code: coding('8867-4'), unit: '/min' };
      assert.throws(() => check(b), /both a component and a split/);
      const c = item('body-blood-pressure');
      c.composite.rate.type = 'text';
      assert.throws(() => check(c), /must be a numeric composite field/);
    });

    it('[FHIR-MAP-6] every composite field is mapped or listed in ignore', () => {
      const a = item('body-blood-pressure');
      delete a.fhir.split;
      assert.throws(() => check(a), /composite field "rate" is neither mapped nor listed in "ignore"/);
      a.fhir.ignore = ['rate'];
      check(a);
      a.fhir.ignore = ['rate', 'systolic'];
      assert.throws(() => check(a), /both mapped and ignored/);
      a.fhir.ignore = ['rate', 'mean'];
      assert.throws(() => check(a), /ignore "mean" is not a composite field/);
    });

    it('[FHIR-MAP-7] a split code differs from the parent code and components', () => {
      const a = item('body-blood-pressure');
      a.fhir.split.rate.code = a.fhir.value.components.systolic.code;
      assert.throws(() => check(a), /appears more than once/);
    });

    it('[FHIR-MAP-8] Condition rules: no value, a datasource source must name a datasource field', () => {
      const a = item('condition-coded');
      a.fhir.value = { kind: 'coded', options: { x: coding('x') } };
      assert.throws(() => check(a), /a Condition has no value\[x\]/);
      const b = item('condition-coded');
      b.fhir.code.field = 'notes';
      assert.throws(() => check(b), /does not hold a datasets-service "codes" array|is not a content property/);
      const c = item('condition-coded');
      c.fhir.code.field = 'nothing';
      assert.throws(() => check(c), /is not a content property of eventType "condition\/coded-v1"/);
      const d = item('condition-coded');
      delete d.fhir.code;
      assert.throws(() => checkItem(d, 'c'), /required property 'code'/);
    });

    it('[FHIR-MAP-9] a datasource source on a non-datasource item is refused', () => {
      const a = item('body-weight');
      a.fhir = { resourceType: 'Observation', category: 'vital-signs', code: { from: 'datasource', field: 'x' }, profiles: {} };
      assert.throws(() => check(a), /datasource code source needs an item with exactly one eventType/);
      const b = item('wellbeing-general-health');
      b.fhir = { resourceType: 'Observation', category: 'survey', code: { from: 'datasource', field: 'x' }, profiles: {} };
      assert.throws(() => check(b), /is not a content property/);
    });

    it('[FHIR-MAP-10] alsoMatch: static or eventType code only, and not a repeat of the code', () => {
      const a = item('body-weight');
      a.fhir.alsoMatch.push(a.fhir.code);
      assert.throws(() => check(a), /appears more than once/);
      const b = item('condition-coded');
      b.fhir.alsoMatch = [coding('1')];
      assert.throws(() => check(b), /"alsoMatch" applies to a static or eventType code only/);
    });

    it('[FHIR-MAP-17] eventType code source: one coding per item eventType, each the LOINC code its unit option stores; one code for every eventType is a static code', () => {
      const g = () => item('body-blood-serum-glucose-fasting');
      check(g());
      const a = g();
      delete a.fhir.code.codings['concentration/mmol-l'];
      assert.throws(() => check(a), /code.codings keys vs the item eventTypes must match exactly; missing \[concentration\/mmol-l\]/);
      const b = g();
      b.fhir.code.codings['concentration/mmol-l'] = b.fhir.code.codings['concentration/mg-dl'];
      assert.throws(() => check(b), /code.codings give every eventType the same coding: that is a static code/);
      const c = g();
      c.fhir.code.codings['concentration/mmol-l'] = coding('2345-7');
      assert.throws(() => check(c), /code.codings "concentration\/mmol-l": http:\/\/loinc.org\|2345-7 is not the LOINC code its unit option stores \(14771-0\)/);
      const d = g();
      d.fhir.alsoMatch = { 'concentration/mg-dl': [d.fhir.code.codings['concentration/mmol-l']] };
      assert.throws(() => check(d), /appears more than once/);
    });

    it('[FHIR-MAP-23] eventType code source: two units of one property share their coding, with one display, never the code of another property, and only on an item whose options store it; a unit without a LOINC code takes the HDS item coding and nothing else; an item coding is the item\'s own key; an item that asserts LOINC never carries a static code of another system', () => {
      const t = () => item('body-blood-serum-testosterone-total');
      check(t(), 'body-blood-serum-testosterone-total');
      // The shared code is still never an alsoMatch of the block.
      const a = t();
      a.fhir.alsoMatch = { 'concentration/ug-l': [a.fhir.code.codings['concentration/ng-dl']] };
      assert.throws(() => check(a), /code.codings and alsoMatch: the coding http:\/\/loinc.org\|2986-8 appears more than once/);
      const b = t();
      b.fhir.code.codings['concentration/ug-l'] = { ...b.fhir.code.codings['concentration/ug-l'], display: 'Testosterone' };
      assert.throws(() => check(b), /the coding http:\/\/loinc.org\|2986-8 has two displays/);
      // The moles unit never takes the mass code: its option stores another one.
      const c = t();
      c.fhir.code.codings['concentration/nmol-l'] = c.fhir.code.codings['concentration/ng-dl'];
      assert.throws(() => check(c), /code.codings give every eventType the same coding/);
      const d = item('body-blood-serum-c-peptide');
      d.fhir.code.codings['concentration/pmol-l'] = d.fhir.code.codings['concentration/ug-l'];
      assert.throws(() => check(d), /code.codings "concentration\/pmol-l": http:\/\/loinc.org\|1986-9 is not the LOINC code its unit option stores \(14633-2\)/);
      // Two eventTypes that share a code still never share a unit: the unit is what tells them apart on import.
      const e = t();
      e.fhir.value.units['concentration/ug-l'] = 'ng/dL';
      assert.throws(() => check(e), /eventTypes "concentration\/ng-dl" and "concentration\/ug-l" share the UCUM unit "ng\/dL"/);

      // The one unit LOINC has no code for: the pmol/L of 1,25-dihydroxyvitamin D (14566-4 is calcitriol alone).
      const ITEM = 'https://hds.ngo/fhir/CodeSystem/item';
      const K = 'body-blood-serum-vitamin-d-125oh';
      const f = () => item(K);
      check(f(), K);
      const g = f();
      g.fhir.code.codings['concentration/pmol-l'] = coding('14566-4');
      assert.throws(() => check(g, K), /code.codings "concentration\/pmol-l": its unit option stores no LOINC code, so its coding is the HDS item coding \(https:\/\/hds.ngo\/fhir\/CodeSystem\/item\|body-blood-serum-vitamin-d-125oh\), not http:\/\/loinc.org\|14566-4/);
      // The unit that has a LOINC code never takes the item coding.
      const i = f();
      i.fhir.code.codings['concentration/pg-ml'] = i.fhir.code.codings['concentration/pmol-l'];
      assert.throws(() => check(i, K), /code.codings give every eventType the same coding/);
      // The HDS item coding is the item's own key, on a null unit and as a static code alike; a deprecated alias keeps its replacement's.
      const h = f();
      h.fhir.code.codings['concentration/pmol-l'] = coding('body-blood-serum-vitamin-d-25oh', ITEM);
      assert.throws(() => check(h, K), /the HDS item coding https:\/\/hds.ngo\/fhir\/CodeSystem\/item\|body-blood-serum-vitamin-d-25oh is not the item's own key/);
      const l = item('body-blood-serum-ldh');
      l.fhir.code = coding('body-semen-tmc', ITEM);
      assert.throws(() => check(l, 'body-blood-serum-ldh'), /the HDS item coding https:\/\/hds.ngo\/fhir\/CodeSystem\/item\|body-semen-tmc is not the item's own key/);
      check(item('fertility-hormone-pdg'), 'fertility-hormone-pdg');
      // An item that asserts LOINC exports it: a static code in another system is refused, its own item coding included.
      const k = item('body-blood-serum-egfr');
      k.fhir.code = coding('body-blood-serum-egfr', ITEM);
      assert.throws(() => check(k, 'body-blood-serum-egfr'), /the item asserts LOINC \(references.loinc\): its static code is the LOINC code every unit option stores, not https:\/\/hds.ngo\/fhir\/CodeSystem\/item\|body-blood-serum-egfr/);
      // Two eventTypes share a coding only where the unit options bind it.
      const m = t();
      delete m.references.loinc;
      assert.throws(() => check(m), /two eventTypes share a coding only on an item whose unit options store it \(references.loinc\)/);
    });

    it('[FHIR-MAP-24] ratio-quantity: a number item whose eventTypes store { value, relativeTo }, units covering them, the denominator the item fixes', () => {
      const K = 'body-blood-coagulation-inr';
      const r = () => item(K);
      check(r(), K);
      checkItem(r(), K);
      const a = r();
      a.fhir.value.relativeTo = 100;
      assert.throws(() => check(a), /value.relativeTo 100 is not the item's ratioRelativeTo \(1\)/);
      const b = r();
      b.fhir.value.units = { 'ratio/percent': '%' };
      assert.throws(() => check(b), /value.units keys vs the item eventTypes must match exactly; missing \[ratio\/generic\], unknown \[ratio\/percent\]/);
      // An eventType that stores a bare number is a quantity, and an object eventType is never one.
      const c = item('body-blood-serum-ferritin');
      c.fhir.value = { kind: 'ratio-quantity', units: { 'concentration/ug-l': 'ug/L' }, relativeTo: 1 };
      assert.throws(() => check(c), /value.kind "ratio-quantity": eventType "concentration\/ug-l" does not store \{ value, relativeTo \}/);
      const d = r();
      d.fhir.value = { kind: 'quantity', units: { 'ratio/generic': '{INR}' } };
      assert.throws(() => check(d), /value.kind "quantity": eventType "ratio\/generic" is not a number/);
      const e = item('wellbeing-general-health');
      e.fhir.value = { kind: 'ratio-quantity', units: { 'ratio/generic': '1' }, relativeTo: 1 };
      assert.throws(() => check(e), /value.kind "ratio-quantity" applies to "number" items only/);
      // The schema: units and a positive relativeTo, nothing else.
      const f = r();
      delete f.fhir.value.relativeTo;
      assert.throws(() => checkItem(f, K), /must have required property 'relativeTo'/);
      const g = r();
      g.fhir.value.relativeTo = 0;
      assert.throws(() => checkItem(g, K), /must be > 0/);
      const h = r();
      h.fhir.value.factor = 1;
      assert.throws(() => checkItem(h, K), /additional properties/);
    });

    it('[FHIR-MAP-19] alsoMatch is a list with a static code, keyed by the item eventType it names with an eventType code', () => {
      const ldl = item('body-blood-serum-cholesterol-ldl');
      assert.deepStrictEqual(Object.fromEntries(Object.entries(ldl.fhir.alsoMatch).map(([t, cs]) => [t, cs.map((c) => c.code)])),
        { 'concentration/mg-dl': ['13457-7', '18262-6'], 'concentration/mmol-l': ['39469-2'] });
      check(ldl);
      checkItem(ldl, 'ldl');
      const a = item('body-blood-serum-cholesterol-ldl');
      a.fhir.alsoMatch = Object.values(a.fhir.alsoMatch).flat();
      assert.throws(() => check(a), /with an eventType code, "alsoMatch" is keyed by eventType/);
      const b = item('body-blood-serum-cholesterol-ldl');
      b.fhir.alsoMatch['concentration/ug-l'] = [coding('1')];
      assert.throws(() => check(b), /alsoMatch "concentration\/ug-l" is not one of the item eventTypes/);
      const c = item('body-weight');
      c.fhir.alsoMatch = { 'mass/kg': c.fhir.alsoMatch };
      assert.throws(() => check(c), /"alsoMatch" keyed by eventType applies to an eventType code only/);
      const e = item('body-blood-serum-cholesterol-ldl');
      e.fhir.alsoMatch['concentration/mg-dl'] = [];
      assert.throws(() => checkItem(e, 'ldl'), /fewer than 1 items/);
    });

    it('[FHIR-MAP-20] scaled-quantity: units cover the item eventTypes, distinct; a proportion in % is factor 100 and never a plain quantity', () => {
      check(item('body-height'));
      const a = item('body-height');
      delete a.fhir.value.units['length/ft'];
      assert.throws(() => check(a), /missing \[length\/ft\]/);
      const b = item('body-height');
      b.fhir.value.units['length/ft'].unit = 'cm';
      assert.throws(() => check(b), /eventTypes "length\/m" and "length\/ft" share the UCUM unit "cm"/);
      const c = item('wellbeing-general-health');
      c.fhir.value = { kind: 'scaled-quantity', units: { 'ratio/proportion': { unit: '%', factor: 100 } } };
      assert.throws(() => check(c), /value.kind "scaled-quantity" applies to "number" items only/);
      const d = item('body-blood-hba1c');
      d.fhir.value = { kind: 'quantity', units: { 'ratio/proportion': '%' } };
      assert.throws(() => check(d), /a proportion \(0..1\) renders in % with value.kind "scaled-quantity" and factor 100, not as stored/);
      const e = item('body-blood-hba1c');
      e.fhir.value.units['ratio/proportion'].factor = 10;
      assert.throws(() => check(e), /factor 100, not factor 10/);
      // A proportion as the dimensionless 1, or a ratio/percent stored as printed, stays a plain quantity.
      const f = item('body-blood-hba1c');
      f.fhir.value = { kind: 'quantity', units: { 'ratio/proportion': '1' } };
      check(f);
      check(item('body-blood-cbc-nucleated-rbc'));
    });

    it('[FHIR-MAP-21] alsoEmit: with a static code only, never a repeat of the code, an alsoMatch, a component or a split code', () => {
      check(item('body-oxygen-saturation'));
      const a = item('body-oxygen-saturation');
      a.fhir.alsoEmit.push(a.fhir.code);
      assert.throws(() => check(a), /code, alsoMatch and alsoEmit: the coding http:\/\/loinc.org\|59408-5 appears more than once/);
      const b = item('body-height');
      b.fhir.alsoEmit = [b.fhir.alsoMatch[0]];
      assert.throws(() => check(b), /appears more than once/);
      const c = item('body-blood-serum-glucose-fasting');
      c.fhir.alsoEmit = [coding('9')];
      assert.throws(() => check(c), /"alsoEmit" applies to a static code only/);
      const d = item('body-blood-pressure');
      d.fhir.alsoEmit = [d.fhir.split.rate.code];
      assert.throws(() => check(d), /code, components and split codes: the coding http:\/\/loinc.org\|8867-4 appears more than once/);
      // A plain quantity block would be half-rendered by a renderer that predates alsoEmit.
      const e = item('body-heart-rate');
      e.fhir.alsoEmit = [coding('9')];
      assert.throws(() => check(e), /"alsoEmit" needs a value kind the deployed renderers skip \(scaled-quantity\)/);
    });

    it('[FHIR-MAP-18] a static LOINC code must be the code every unit option stores', () => {
      const a = item('body-blood-serum-glucose-fasting');
      a.fhir.code = a.fhir.code.codings['concentration/mg-dl'];
      assert.throws(() => check(a), /code 1558-6 is a static code, but eventType concentration\/mmol-l stores 14771-0: use a code from eventType/);
      const b = item('body-blood-serum-ferritin');
      b.fhir.code = coding('2345-7');
      assert.throws(() => check(b), /code 2345-7 is a static code, but eventType concentration\/ug-l stores 2276-4/);
      // An item that asserts no LOINC is not held to it: the vital signs carry their codes in the block only.
      check(item('body-heart-rate'));
    });

    it('[FHIR-MAP-11] a Patient element takes an item of its type, and the content as written unless coded', () => {
      const a = item('profile-name');
      a.fhir.element = 'birthDate';
      assert.throws(() => check(a), /element "birthDate" takes a "date" item; item type is "text"/);
      const b = item('profile-date-of-birth');
      b.fhir.value = { kind: 'coded', options: { x: coding('x') } };
      assert.throws(() => check(b), /takes the content as written; remove "value"/);
      const c = item('profile-sex');
      delete c.fhir.value;
      assert.throws(() => check(c), /needs value.kind "coded"/);
      const d = item('profile-ethnicity');
      d.fhir = { resourceType: 'Patient', element: 'gender' };
      assert.throws(() => check(d), /takes a "select" item; item type is "multi-select"/);
    });

    it('[FHIR-MAP-12] gender: one administrative-gender coding per option, with its official display', () => {
      const a = item('profile-sex');
      a.fhir.value.options.female = { system: 'http://hl7.org/fhir/administrative-gender', code: 'female', display: 'Woman' };
      assert.throws(() => check(a), /option "female": .* is not a code of http:\/\/hl7.org\/fhir\/administrative-gender with its display/);
      const b = item('profile-sex');
      b.fhir.value.options.female = { system: 'http://snomed.info/sct', code: '248152002', display: 'Female' };
      assert.throws(() => check(b), /is not a code of/);
      const c = item('profile-sex');
      c.fhir.value.options.female = c.fhir.value.options.male;
      assert.throws(() => check(c), /appears more than once/);
      const d = item('profile-sex');
      delete d.fhir.value.options.female;
      assert.throws(() => check(d), /missing \[female\]/);
      const e = item('profile-sex');
      e.options.push({ value: 'not-stated', label: { en: 'Not stated' } });
      e.fhir.value.options['not-stated'] = { system: 'http://hl7.org/fhir/administrative-gender', code: 'unknown', display: 'Unknown' };
      check(e);
      const f = item('profile-sex');
      f.fhir.value.alsoMatch = { female: [{ system: 'http://hl7.org/fhir/administrative-gender', code: 'other', display: 'Other' }] };
      checkItem(f, 'sex');
      assert.throws(() => check(f), /takes no value.alsoMatch/);
    });

    it('[FHIR-MAP-13] value.alsoMatch: per option, keys are options, codings unique across options and alsoMatch, coded only', () => {
      const ok = item('lifestyle-tobacco-smoking');
      check(ok);
      const a = item('lifestyle-tobacco-smoking');
      a.fhir.value.alsoMatch.sometimes = [coding('1', 'http://snomed.info/sct')];
      assert.throws(() => check(a), /value.alsoMatch "sometimes" is not an option of the block/);
      const b = item('lifestyle-tobacco-smoking');
      b.fhir.value.alsoMatch.former = [b.fhir.value.options.never];
      assert.throws(() => check(b), /value.options and value.alsoMatch: the coding http:\/\/snomed.info\/sct\|266919005 appears more than once/);
      const c = item('lifestyle-tobacco-smoking');
      c.fhir.value.alsoMatch.former = [c.fhir.value.alsoMatch.current[0]];
      assert.throws(() => check(c), /appears more than once/);
      const d = item('body-weight');
      d.fhir.value.alsoMatch = { 'mass/kg': [coding('1')] };
      assert.throws(() => checkItem(d, 'w'), /additional properties/);
      const e = item('lifestyle-tobacco-smoking');
      e.fhir.value.alsoMatch.current = [];
      assert.throws(() => checkItem(e, 's'), /fewer than 1 items/);
      const g = item('lifestyle-tobacco-smoking');
      delete g.fhir.value.alsoMatch.current[0].display;
      assert.throws(() => checkItem(g, 's'), /display/);
    });

    it('[FHIR-MAP-17] a DocumentReference takes its type from the content: one eventType, a field holding codings, translate keys "<system>|<code>" not to themselves, no value (plan 115 GAP H-8)', () => {
      const doc = () => item('document');
      check(doc(), 'document');
      const a = doc();
      a.fhir.code = coding('1');
      assert.throws(() => check(a, 'document'), /a DocumentReference takes its type from the content/);
      const b = item('condition-coded');
      b.fhir.code = doc().fhir.code;
      assert.throws(() => check(b, 'c'), /a content code source applies to a DocumentReference only/);
      const c = doc();
      c.fhir.code.field = 'title';
      assert.throws(() => check(c, 'document'), /code.field "title" does not hold a FHIR Coding or a list of them/);
      const c2 = doc();
      c2.fhir.code.field = 'class';
      check(c2, 'document'); // one Coding, not a list: also a coding field
      const d = doc();
      d.fhir.code.field = 'nope';
      assert.throws(() => check(d, 'document'), /code.field "nope" is not a content property/);
      const e = doc();
      e.fhir.code.translate = { 'SNOMED-CT|1': coding('1') };
      assert.throws(() => check(e, 'document'), /code.translate "SNOMED-CT\|1": a key is "<canonical system>\|<code>"/);
      const f = doc();
      f.fhir.code.translate = { 'http://loinc.org|1': coding('1') };
      assert.throws(() => check(f, 'document'), /translates to itself/);
      const g = doc();
      g.fhir.value = { kind: 'coded', options: {} };
      assert.throws(() => check(g, 'document'), /a DocumentReference has no value\[x\]/);
      const h = doc();
      h.fhir.alsoMatch = [coding('2')];
      assert.throws(() => check(h, 'document'), /"alsoMatch" applies to a static or eventType code only/);
      const two = doc();
      two.eventType = undefined;
      two.variations = { eventType: { options: [{ value: 'file/xds-v1' }, { value: 'file/attached' }] } };
      assert.throws(() => checkFhirMapping('document', two, ['file/xds-v1', 'file/attached']), /exactly one eventType/);
      // The import key: one content-coded item per (resourceType, category).
      const { checkFhirImportKeys } = require('../src/fhir');
      assert.throws(() => checkFhirImportKeys({ a: { fhir: doc().fhir }, b: { fhir: doc().fhir } }), /fhir import key DocumentReference\|clinical-note from content is claimed by both "a" and "b"/);
    });

    it('[FHIR-MAP-22] a medication block: a datasource or text code, a dosage naming the regimen and covering its doseUnit and route enums exactly (codes distinct as written), no value; text and dosage on a medication only (plan 115)', () => {
      const med = (k = 'medication-intake-basic') => item(k);
      for (const k of ['medication-intake-basic', 'medication-intake-coded', 'medication-prescription-coded', 'medication-prescription-basic']) check(med(k), k);
      const a = med();
      a.fhir.code = coding('1');
      assert.throws(() => check(a, 'm'), /takes its medication from the content: code: \{ from: datasource, field \} .* or \{ from: text, field \}/);
      const b = med();
      delete b.fhir.dosage;
      assert.throws(() => check(b, 'm'), /needs "dosage": \{ field, doseUnits, routes \}/);
      const c = med();
      c.fhir.value = { kind: 'coded', options: { x: coding('x') } };
      assert.throws(() => check(c, 'm'), /a MedicationStatement has no value\[x\]/);
      const d = med();
      d.fhir.dosage.field = 'name';
      assert.throws(() => check(d, 'm'), /dosage.field "name" does not hold a regimen/);
      const e = med();
      e.fhir.dosage.field = 'nope';
      assert.throws(() => check(e, 'm'), /dosage.field "nope" is not a content property/);
      const f = med();
      delete f.fhir.dosage.doseUnits['mass/mg'];
      assert.throws(() => check(f, 'm'), /dosage.doseUnits keys vs the intake.doseUnit enum must match exactly; missing \[mass\/mg\]/);
      const g = med();
      g.fhir.dosage.doseUnits['dose/puff'] = '{tbl}';
      assert.throws(() => check(g, 'm'), /two dose units share a UCUM code/);
      const h = med();
      h.fhir.dosage.routes.nasal = h.fhir.dosage.routes.oral;
      assert.throws(() => check(h, 'm'), /dosage.routes: the coding .* appears more than once/);
      const i = med();
      i.fhir.dosage.routes.extra = coding('9');
      assert.throws(() => check(i, 'm'), /dosage.routes keys vs the intake.route enum must match exactly; missing \[\], unknown \[extra\]/);
      const j = med();
      j.fhir.dosage.routes.nasal = { text: 'parenteral' };
      assert.throws(() => check(j, 'm'), /two routes share a text/);
      // the text code names a text field of the composite; the dosage field a composite field
      const k = med();
      k.fhir.code.field = 'intake';
      assert.throws(() => check(k, 'm'), /code.field "intake" is not a string/);
      const k2 = med();
      k2.composite.name.type = 'textarea';
      assert.throws(() => check(k2, 'm'), /code.field "name" is not a text field of the composite/);
      // the composite accounting: name is the code, intake the dosage; neither may be ignored twice
      const l = med();
      l.fhir.ignore = ['intake'];
      assert.throws(() => check(l, 'm'), /field "intake" is both mapped and ignored/);
      // text and dosage are a medication's
      const m = item('condition-coded');
      m.fhir.code = { from: 'text', field: 'notes' };
      assert.throws(() => check(m, 'c'), /a text code source applies to a MedicationStatement, a MedicationRequest, a Procedure or an AllergyIntolerance only/);
      const n = item('body-weight');
      n.fhir.dosage = med().fhir.dosage;
      assert.throws(() => check(n, 'w'), /"dosage" applies to a MedicationStatement or MedicationRequest only/);
      // a coded medication's product systems are all in the table
      const o = med('medication-intake-coded');
      const { fhirMapping: table } = require('../src/fhir');
      const saved = table.productSystems;
      table.productSystems = { Swissmedic: saved.Swissmedic };
      try {
        assert.throws(() => check(o, 'm'), /drug.product.system admits CIS, which definitions\/fhir\/mapping.yaml productSystems gives no URI for/);
      } finally {
        table.productSystems = saved;
      }
      // the import keys: one datasource-coded and one text-coded item per resourceType
      const { checkFhirImportKeys } = require('../src/fhir');
      checkFhirImportKeys({ a: { fhir: med('medication-intake-coded').fhir }, b: { fhir: med().fhir } });
      assert.throws(() => checkFhirImportKeys({ a: { fhir: med().fhir }, b: { fhir: med().fhir } }), /fhir import key MedicationStatement from text is claimed by both "a" and "b"/);
    });

    it('[FHIR-MAP-25] a Procedure block: a datasource or text code, no category, no value, no dosage, no split; notes is the note and count is ignored, each of its type; one datasource-coded and one text-coded item (plan 115)', () => {
      const proc = (k = 'procedure-basic') => item(k);
      for (const k of ['procedure-basic', 'procedure-coded']) {
        checkItem(proc(k), k);
        check(proc(k), k);
      }
      const a = proc();
      a.fhir.code = coding('80146002', 'http://snomed.info/sct');
      assert.throws(() => check(a, 'p'), /a Procedure takes its code from the content: code: \{ from: datasource, field \} .* or \{ from: text, field \}/);
      const b = proc();
      b.fhir.category = 'surgical';
      assert.throws(() => check(b, 'p'), /resourceType "Procedure" takes no category/);
      const c = proc();
      c.fhir.value = { kind: 'coded', options: { x: coding('x') } };
      assert.throws(() => check(c, 'p'), /a Procedure has no value\[x\]/);
      const d = proc();
      d.fhir.dosage = item('medication-intake-basic').fhir.dosage;
      assert.throws(() => check(d, 'p'), /"dosage" applies to a MedicationStatement or MedicationRequest only/);
      const e = proc();
      e.fhir.split = { count: { code: coding('1'), unit: '1', profiles: {} } };
      assert.throws(() => check(e, 'p'), /a Procedure has no numeric field to split/);
      // the composite accounting: name is the code, notes the note, count ignored
      const f = proc();
      delete f.fhir.ignore;
      assert.throws(() => check(f, 'p'), /composite field "count" is neither mapped nor listed in "ignore"/);
      const g = proc();
      g.fhir.ignore = ['count', 'notes'];
      assert.throws(() => check(g, 'p'), /field "notes" is both mapped and ignored/);
      const h = proc();
      h.composite.notes.type = 'number';
      assert.throws(() => check(h, 'p'), /composite field "notes" is not a text field/);
      const j = proc();
      j.fhir.code.field = 'count';
      assert.throws(() => check(j, 'p'), /code.field "count" is not a string/);
      // the coded twin names the datasource field
      const k = proc('procedure-coded');
      k.fhir.code.field = 'notes';
      assert.throws(() => check(k, 'p'), /code.field "notes" does not hold a datasets-service "codes" array/);
      const l = proc('procedure-coded');
      l.fhir.alsoMatch = [coding('1')];
      assert.throws(() => check(l, 'p'), /"alsoMatch" applies to a static or eventType code only/);
      // the import keys: one datasource-coded and one text-coded item for the bare key
      const { checkFhirImportKeys } = require('../src/fhir');
      checkFhirImportKeys({ a: { fhir: proc('procedure-coded').fhir }, b: { fhir: proc().fhir } });
      assert.throws(() => checkFhirImportKeys({ a: { fhir: proc('procedure-coded').fhir }, b: { fhir: proc('procedure-coded').fhir } }), /fhir import key Procedure from datasource is claimed by both "a" and "b"/);
    });

    it('[FHIR-MAP-26] a QuestionnaireResponse block: resourceType and profiles only (no code, no category, no value), on a system item whose one eventType holds requestEventId and answers; one item maps the resourceType (plan 115)', () => {
      const qr = () => item('questionnaire-answer');
      checkItem(qr(), 'questionnaire-answer');
      check(qr(), 'questionnaire-answer');
      const a = qr();
      a.fhir.category = 'survey';
      assert.throws(() => check(a, 'q'), /resourceType "QuestionnaireResponse" takes no category/);
      for (const [k, v] of [['code', coding('1')], ['value', { kind: 'coded', options: { x: coding('x') } }], ['ignore', ['answers']], ['alsoMatch', [coding('2')]]]) {
        const b = qr();
        b.fhir[k] = v;
        assert.throws(() => check(b, 'q'), new RegExp(`a QuestionnaireResponse block holds "resourceType" and "profiles" only .* remove "${k}"`));
      }
      const c = qr();
      c.type = 'text';
      assert.throws(() => check(c, 'q'), /a QuestionnaireResponse block applies to a "system" item/);
      // the renderer reads requestEventId and answers by name: an eventType without them cannot carry the block
      const d = qr();
      d.eventType = 'questionnaire/request-v1';
      assert.throws(() => check(d, 'q'), /eventType "questionnaire\/request-v1" has no string content property "requestEventId"/);
      assert.throws(() => checkFhirMapping('q', qr(), ['questionnaire/answer-v1', 'questionnaire/request-v1']), /needs an item with exactly one eventType/);
      // the import key: the resourceType alone, one item
      const { checkFhirImportKeys } = require('../src/fhir');
      checkFhirImportKeys({ a: { fhir: qr().fhir } });
      assert.throws(() => checkFhirImportKeys({ a: { fhir: qr().fhir }, b: { fhir: qr().fhir } }), /fhir import key QuestionnaireResponse is claimed by both "a" and "b"/);
    });

    it('[FHIR-MAP-27] a Questionnaire block: resourceType and profiles only (no code, no category, no value), on a system item whose one eventType holds questions, each with a label and an itemRef; the key grammar, the sub-field types and the types of title, description, templateRef and subField are held; one item maps the resourceType (plan 115)', () => {
      const qn = () => item('questionnaire-request');
      checkItem(qn(), 'questionnaire-request');
      check(qn(), 'questionnaire-request');
      const a = qn();
      a.fhir.category = 'survey';
      assert.throws(() => check(a, 'q'), /resourceType "Questionnaire" takes no category/);
      for (const [k, v] of [['code', coding('1')], ['value', { kind: 'coded', options: { x: coding('x') } }], ['ignore', ['questions']], ['alsoMatch', [coding('2')]]]) {
        const b = qn();
        b.fhir[k] = v;
        assert.throws(() => check(b, 'q'), new RegExp(`a Questionnaire block holds "resourceType" and "profiles" only .* remove "${k}"`));
      }
      const c = qn();
      c.type = 'text';
      assert.throws(() => check(c, 'q'), /a Questionnaire block applies to a "system" item/);
      // the renderer reads questions, and each question's label and itemRef, by name
      const d = qn();
      d.eventType = 'questionnaire/answer-v1';
      assert.throws(() => check(d, 'q'), /eventType "questionnaire\/answer-v1" has no object content property "questions"/);
      assert.throws(() => checkFhirMapping('q', qn(), ['questionnaire/answer-v1', 'questionnaire/request-v1']), /needs an item with exactly one eventType/);
      // what a renderer holding the block alone depends on in the eventType: the key grammar (no dot, so the child
      // linkIds stay distinct), the sub-field types it knows, and the type of each name it reads when declared
      const { eventTypesById } = require('../src/eventTypes');
      const { QUESTION_KEY_PATTERN, QUESTIONNAIRE_SUB_FIELD_TYPES, QUESTIONNAIRE_OPTION_VALUE_TYPES } = require('../src/fhir');
      const schema = eventTypesById('questionnaire/request-v1');
      const question = schema.properties.questions.additionalProperties;
      assert.strictEqual(schema.properties.questions.propertyNames.pattern, QUESTION_KEY_PATTERN);
      assert.deepStrictEqual(question.properties.subField.properties.type.enum, QUESTIONNAIRE_SUB_FIELD_TYPES);
      assert.deepStrictEqual(question.properties.subField.properties.options.items.properties.value.type, QUESTIONNAIRE_OPTION_VALUE_TYPES);
      const withSchema = (change, expected) => {
        const saved = structuredClone(schema.properties);
        try {
          change();
          assert.throws(() => check(qn(), 'q'), expected);
        } finally {
          schema.properties = saved;
        }
        check(qn(), 'q');
      };
      const questionOf = () => schema.properties.questions.additionalProperties;
      withSchema(() => { schema.properties.questions.propertyNames.pattern = '^[a-zA-Z0-9_.-]+$'; }, /the keys of "questions" must follow exactly \^\[a-zA-Z0-9_-\]\+\$/);
      withSchema(() => { delete schema.properties.questions.propertyNames; }, /the keys of "questions" must follow exactly/);
      withSchema(() => { questionOf().properties.subField.properties.type.enum.push('date'); }, /the "subField.type" enum must be exactly select-segmented, text, number/);
      withSchema(() => { questionOf().properties.subField.properties.type.enum.pop(); }, /the "subField.type" enum must be exactly/);
      withSchema(() => { questionOf().properties.subField = { type: 'string' }; }, /a question's "subField" is not an object/);
      withSchema(() => { questionOf().properties.subField.properties.options = { type: 'object' }; }, /a question's "subField.options" is not an array/);
      withSchema(() => { questionOf().properties.subField.properties.options.items.properties.value.type.push('boolean'); }, /the option "value" types of "subField.options" must be exactly number, string/);
      withSchema(() => { questionOf().properties.subField.properties.options.items.properties.value.type = 'string'; }, /the option "value" types of "subField.options" must be exactly number, string/);
      withSchema(() => { schema.properties.title = { type: 'string' }; }, /content property "title" of eventType "questionnaire\/request-v1" is not an object/);
      withSchema(() => { schema.properties.description = { type: 'string' }; }, /content property "description" of eventType "questionnaire\/request-v1" is not an object/);
      withSchema(() => { schema.properties.templateRef = { type: 'object' }; }, /content property "templateRef" of eventType "questionnaire\/request-v1" is not a string/);
      // each of the optional names may be absent from the eventType
      const saved = structuredClone(schema.properties);
      try {
        delete questionOf().properties.subField.properties.options;
        check(qn(), 'q');
        for (const k of ['title', 'description', 'templateRef']) delete schema.properties[k];
        delete questionOf().properties.subField;
        check(qn(), 'q');
      } finally {
        schema.properties = saved;
      }
      // the import key: the resourceType alone, one item; it never collides with the answers' key
      const { checkFhirImportKeys } = require('../src/fhir');
      checkFhirImportKeys({ a: { fhir: qn().fhir }, b: { fhir: item('questionnaire-answer').fhir } });
      assert.throws(() => checkFhirImportKeys({ a: { fhir: qn().fhir }, b: { fhir: qn().fhir } }), /fhir import key Questionnaire is claimed by both "a" and "b"/);
    });

    it('[FHIR-MAP-14] alsoMatchCategories: known keys of the resourceType table, never the block\'s own, refused without a table', () => {
      const a = item('lifestyle-tobacco-smoking');
      a.fhir.alsoMatchCategories = ['surveys'];
      assert.throws(() => check(a), /alsoMatchCategories: unknown Observation category "surveys"/);
      const b = item('lifestyle-tobacco-smoking');
      b.fhir.alsoMatchCategories = ['social-history'];
      assert.throws(() => check(b), /"social-history" is the block's own category/);
      const c = item('condition-coded');
      c.fhir.alsoMatchCategories = ['survey'];
      assert.throws(() => check(c), /unknown Condition category "survey"/);
      const d = item('lifestyle-tobacco-smoking');
      d.fhir.alsoMatchCategories = ['survey', 'survey'];
      assert.throws(() => checkItem(d, 's'), /duplicate items/);
      const e = item('profile-name');
      e.fhir.alsoMatchCategories = ['survey'];
      assert.throws(() => checkItem(e, 'n'), /additional properties/);
    });

    it('[FHIR-MAP-15] the resource code\'s alsoMatch never repeats a component or split code', () => {
      const a = item('body-blood-pressure');
      a.fhir.alsoMatch.push(a.fhir.split.rate.code);
      assert.throws(() => check(a), /code, components and split codes: the coding http:\/\/loinc.org\|8867-4 appears more than once/);
    });

    it('[FHIR-MAP-16] category keys fit a scope key, and one coding names one category per resourceType', () => {
      checkMappingTable(fhirMapping);
      const withCategory = (key, c) => {
        const t = structuredClone(fhirMapping);
        t.categories.Observation[key] = c;
        return t;
      };
      const fresh = { system: 'http://example.org/cat', code: 'x', display: 'X' };
      checkMappingTable(withCategory('new-cat', fresh));
      for (const bad of ['a|b', 'a b', 'Vital', '-a', '']) {
        assert.throws(() => checkMappingTable(withCategory(bad, fresh)), /a category key is lowercase letters, digits and dashes/, bad);
      }
      const badType = structuredClone(fhirMapping);
      badType.categories['observation|x'] = { a: fresh };
      assert.throws(() => checkMappingTable(badType), /"observation\|x" is not a FHIR resourceType name/);
      const dup = structuredClone(fhirMapping.categories.Observation['vital-signs']);
      assert.throws(() => checkMappingTable(withCategory('vitals', dup)), /categories Observation\/vital-signs and Observation\/vitals share the coding/);
    });
  });

  describe('[FHIR-LABC] lab results with no item of their own: a concept code and value kind lab-result (plan 133)', () => {
    const CODED = ['body-blood-coded', 'body-urine-coded', 'body-csf-coded'];
    const { eventTypesById } = require('../src/eventTypes');

    it('[FHIR-LABC-1] the three items carry the same block: the analyte as code, the content as value, lab profiles', () => {
      for (const k of CODED) {
        assert.deepStrictEqual(itemsById[k].fhir, {
          resourceType: 'Observation',
          category: 'laboratory',
          code: { from: 'concept', field: 'analyte' },
          value: { kind: 'lab-result' },
          profiles: {
            us: 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-observation-lab',
            ips: 'http://hl7.org/fhir/uv/ips/StructureDefinition/Observation-results-laboratory-pathology-uv-ips'
          }
        }, k);
        assert.ok(fhirScopes['Observation|laboratory'].includes(itemsById[k].streamId), k);
      }
    });

    it('[FHIR-LABC-2] the schema: a concept code takes a field only, value kind lab-result no field', () => {
      const a = item('body-blood-coded');
      a.fhir.code.translate = { 'http://loinc.org|1': coding('2') };
      assert.throws(() => checkItem(a, 'c'), /additional properties/);
      const b = item('body-blood-coded');
      delete b.fhir.code.field;
      assert.throws(() => checkItem(b, 'c'), /required property 'field'/);
      const c = item('body-blood-coded');
      c.fhir.value.units = { 'lab-result/coded-v1': 'mg/dL' };
      assert.throws(() => checkItem(c, 'c'), /additional properties/);
    });

    it('[FHIR-LABC-3] the two go together, on an Observation, on lab-result/coded-v1 and its analyte', () => {
      check(item('body-blood-coded'), 'body-blood-coded');
      const a = item('body-blood-coded');
      a.fhir.value = { kind: 'quantity', units: { 'lab-result/coded-v1': 'mg/dL' } };
      assert.throws(() => check(a), /a concept code source and value.kind "lab-result" go together/);
      const b = item('body-blood-serum-ferritin');
      b.fhir.value = { kind: 'lab-result' };
      assert.throws(() => check(b), /a concept code source and value.kind "lab-result" go together/);
      const c = item('body-blood-coded');
      c.fhir.resourceType = 'Condition';
      c.fhir.category = 'problem-list-item';
      delete c.fhir.value;
      assert.throws(() => check(c), /a concept code source applies to an Observation only/);
      const d = item('body-blood-coded');
      d.fhir.code.field = 'notes';
      assert.throws(() => check(d), /code.field "notes" is not the analyte of "lab-result\/coded-v1"/);
      const e = item('body-blood-coded');
      e.eventType = 'genetic-variant/coded-v1';
      assert.throws(() => check(e), /needs an item whose one eventType is "lab-result\/coded-v1"/);
      const g = item('body-blood-coded');
      g.type = 'number';
      assert.throws(() => check(g), /a concept code source sits on an "imported" item/);
    });

    it('[FHIR-LABC-4] a key added or removed at any level of lab-result/coded-v1 fails the build until the renderers place it', () => {
      const et = eventTypesById('lab-result/coded-v1');
      const tamper = (change, re) => {
        const saved = structuredClone(et);
        change(et);
        try {
          assert.throws(() => check(item('body-blood-coded')), re);
        } finally {
          for (const k of Object.keys(et)) delete et[k];
          Object.assign(et, saved);
        }
      };
      tamper((t) => { t.properties.specimen = { type: 'string' }; }, /reads the content \{ .* \}; eventType "lab-result\/coded-v1" adds specimen, which no renderer places/);
      tamper((t) => { delete t.properties.notes; }, /reads the content .* lacks notes/);
      tamper((t) => { t.properties.analyte.properties.method = { type: 'string' }; }, /reads analyte \{ label, codes \}; .* adds method/);
      tamper((t) => { t.properties.analyte.properties.label.properties.de = { type: 'string' }; }, /reads analyte.label \{ en, fr, es \}; .* adds de/);
      tamper((t) => { t.properties.analyte.properties.codes.items.properties.userSelected = { type: 'boolean' }; }, /reads analyte.codes\[\] .* adds userSelected/);
      tamper((t) => { t.properties.valueCodes.items.properties.hdsId = { type: 'string' }; }, /reads valueCodes\[\] .* adds hdsId/);
      tamper((t) => { t.properties.comparator.enum.push('~'); }, /renders comparator as Quantity.comparator \(< <= > >=\); .* allows < <= > >= ~/);
      check(item('body-blood-coded'));
    });

    it('[FHIR-LABC-6] nothing makes a concept-coded item an import key or a code owner', () => {
      const a = item('body-blood-coded');
      a.fhir.alsoMatch = [coding('20447-9')];
      assert.throws(() => check(a), /"alsoMatch" applies to a static or eventType code only/);
      const b = item('body-blood-coded');
      b.fhir.alsoMatchCategories = ['vital-signs'];
      assert.throws(() => check(b), /a concept code source claims no import key: no "alsoMatchCategories"/);
      const c = item('body-blood-coded');
      c.references = { loinc: ['20447-9'] };
      assert.throws(() => check(c), /a concept-coded item owns no LOINC code/);
    });

    it('[FHIR-LABC-5] the concept-coded items claim no import key: the importer is told the specimen', () => {
      const { checkFhirImportKeys } = require('../src/fhir');
      // Three items of one (resourceType, category) would otherwise clash on one key.
      const three = Object.fromEntries(CODED.map((k) => [k, item(k)]));
      checkFhirImportKeys(three);
      checkFhirImportKeys(itemsById);
    });
  });

  describe('[FHIR-SCOPE] the SMART scope grant table', () => {
    const obs = (category, code = '1') => ({ resourceType: 'Observation', category, code: coding(code), value: { kind: 'quantity', units: { 'mass/kg': 'kg' } }, profiles: {} });
    const it_ = (streamId, fhir, extra = {}) => ({ streamId, ...(fhir ? { fhir } : {}), ...extra });
    const tree = [
      { id: 'body', children: [{ id: 'body-a', children: [{ id: 'body-a-flag' }] }, { id: 'body-b' }] },
      { id: 'mood' }
    ];
    const run = (items, lock = emptyLock(), roots = tree) => checkFhirScopes(items, { roots, lock });
    /** The lock `npm run fhir:lock` would write for these items, from an empty one. */
    const lockOf = (items, roots = tree) => mergeLock(emptyLock(), lockEntries(items, computeFhirScopes(items, roots).grants, roots));

    it('[FHIR-SCOPE-1] grants minimal roots: each mapped item\'s own stream, never an ancestor that merely holds them', () => {
      const grants = run({ a: it_('body-a', obs('vital-signs', 'a')), f: it_('body-a-flag', obs('vital-signs', 'f')), b: it_('body-b', obs('vital-signs', 'b')) });
      assert.deepStrictEqual(grants, { 'Observation|vital-signs': ['body-a', 'body-b'] }, 'body-a-flag is inside body-a; "body" is not granted');
    });

    it('[FHIR-SCOPE-2] a root that carries no item descends into its children', () => {
      const grants = run({ a: it_('body-a', obs('vital-signs', 'a')), b: it_('body-b', obs('survey', 'b')), m: it_('mood') });
      assert.deepStrictEqual(grants, { 'Observation|survey': ['body-b'], 'Observation|vital-signs': ['body-a'] });
    });

    it('[FHIR-SCOPE-3] a mapped parent with an unmapped child fails, with another pair too', () => {
      assert.throws(() => run({ a: it_('body-a', obs('vital-signs')), f: it_('body-a-flag') }), /stream "body-a" carries a mapped or companion item but its subtree spans \(unmapped\), Observation\|vital-signs/);
      assert.throws(() => run({ a: it_('body-a', obs('vital-signs', 'a')), f: it_('body-a-flag', obs('survey', 'f')) }), /spans Observation\|survey, Observation\|vital-signs/);
    });

    it('[FHIR-SCOPE-4] unmapped streams are never granted and do not fail on their own', () => {
      const { grants, violations } = computeFhirScopes({ a: it_('body-a'), f: it_('body-a-flag', obs('vital-signs')) }, tree);
      assert.deepStrictEqual(grants, { 'Observation|vital-signs': ['body-a-flag'] });
      assert.deepStrictEqual(violations, []);
    });

    it('[FHIR-SCOPE-5] deprecated items count: with their mapping, or as unmapped', () => {
      assert.throws(() => run({ a: it_('body-a', obs('vital-signs')), old: it_('body-a', null, { deprecated: true }) }), /\(unmapped\)/);
      // a deprecated mapped item keeps its stream in the table: its past events are there
      const grants = run({ a: it_('body-a', obs('vital-signs', 'a')), old: it_('body-b', obs('vital-signs', 'o'), { deprecated: true }) });
      assert.deepStrictEqual(grants, { 'Observation|vital-signs': ['body-a', 'body-b'] });
    });

    it('[FHIR-SCOPE-6] a companion counts as its parent\'s pair', () => {
      const grants = run({ a: it_('body-a', obs('vital-signs')), f: it_('body-a-flag', { companionOf: 'a' }), b: it_('body-b') });
      assert.deepStrictEqual(grants, { 'Observation|vital-signs': ['body-a'] });
    });

    it('[FHIR-SCOPE-7] a companion needs a mapped parent and a stream inside the parent\'s subtree', () => {
      assert.throws(() => run({ a: it_('body-a'), f: it_('body-a-flag', { companionOf: 'a' }) }), /the parent must carry a mapping/);
      assert.throws(() => run({ f: it_('body-a-flag', { companionOf: 'nope' }) }), /no such item/);
      assert.throws(() => run({ a: it_('body-a-flag', obs('vital-signs')), f: it_('body-a', { companionOf: 'a' }) }), /is not inside the parent's stream subtree/);
      assert.throws(() => run({ a: it_('body-a', obs('vital-signs')), c: it_('body-a-flag', { companionOf: 'a' }), d: it_('body-a-flag', { companionOf: 'c' }) }), /the parent must carry a mapping/);
    });

    it('[FHIR-SCOPE-8] the lock records every stream a grant reaches: pair, parent, items', () => {
      const items = { a: it_('body-a', obs('vital-signs', 'a')), f: it_('body-a-flag', { companionOf: 'a' }), b: it_('body-b', obs('survey', 'b')) };
      assert.deepStrictEqual(lockOf(items), {
        formatVersion: 2,
        streams: {
          'body-a': { pair: 'Observation|vital-signs', parent: 'body', items: ['a'] },
          'body-a-flag': { pair: 'Observation|vital-signs', parent: 'body-a', items: ['f'] },
          'body-b': { pair: 'Observation|survey', parent: 'body', items: ['b'] }
        },
        reviewed: { items: {}, streams: {} }
      });
      run(items, lockOf(items));
      // a new grant root passes
      const more = { ...items, m: it_('mood', obs('survey', 'm')) };
      assert.deepStrictEqual(run(more, lockOf(items)), { 'Observation|survey': ['body-b', 'mood'], 'Observation|vital-signs': ['body-a'] });
    });

    it('[FHIR-SCOPE-14] the lock fails a removed, re-parented or re-paired stream', () => {
      const items = { a: it_('body-a', obs('vital-signs', 'a')), f: it_('body-a-flag', { companionOf: 'a' }) };
      const lock = lockOf(items);
      const moved = [{ id: 'body', children: [{ id: 'body-b', children: [{ id: 'body-a', children: [{ id: 'body-a-flag' }] }] }] }, { id: 'mood' }];
      assert.throws(() => run(items, lock, moved), /stream "body-a", published under Observation\|vital-signs, was a child of "body" and is now a child of "body-b"/);
      const gone = [{ id: 'body', children: [{ id: 'body-a' }] }, { id: 'mood' }];
      assert.throws(() => run({ a: items.a }, lock, gone), /stream "body-a-flag", published under Observation\|vital-signs, is no longer a stream/);
      assert.throws(() => run({ a: it_('body-a', obs('survey', 'a')), f: items.f }, lock), /stream "body-a", published under Observation\|vital-signs, now also holds Observation\|survey/);
    });

    it('[FHIR-SCOPE-15] the lock fails a removed or moved item; deprecating it passes', () => {
      const items = { a: it_('body-a', obs('vital-signs', 'a')), f: it_('body-a-flag', { companionOf: 'a' }) };
      const lock = lockOf(items);
      assert.throws(() => run({ a: items.a }, lock), /stream "body-a-flag", published under Observation\|vital-signs, held item "f", which is gone: an item on a published stream is deprecated, never removed/);
      assert.throws(() => run({ a: items.a, f: it_('body-a', { companionOf: 'a' }) }, lock), /held item "f", which is now on stream "body-a"/);
      run({ a: items.a, f: it_('body-a-flag', { companionOf: 'a' }, { deprecated: true }) }, lock);
    });

    it('[FHIR-SCOPE-16] a new item or companion under a locked stream needs an acknowledgement in "reviewed"', () => {
      const items = { a: it_('body-a', obs('vital-signs', 'a')) };
      const lock = lockOf(items);
      const flag = { ...items, f: it_('body-a-flag', { companionOf: 'a' }) };
      assert.throws(() => run(flag, lock), /item "f" is new under the published stream "body-a-flag": every grant already issued for Observation\|vital-signs would read it\. .*"reviewed": \{ "items": \{ "f": \{ "under": "body-a-flag", "why": "YYYY-MM-DD <why>" \} \} \}/);
      const same = { ...items, a2: it_('body-a', obs('vital-signs', 'a2')) };
      assert.throws(() => run(same, lock), /item "a2" is new under the published stream "body-a"/, 'a new item on the locked stream itself');
      const ack = (why = '2026-10-29 the disturbance flag qualifies the reading', under = 'body-a-flag') => ({ ...lock, reviewed: { items: { f: { under, why } }, streams: {} } });
      run(flag, ack());
      // fhir:lock then records it; the acknowledgement stays as the record of the review
      assert.deepStrictEqual(lockOf(flag).streams['body-a-flag'].items, ['f']);
      assert.throws(() => run(flag, ack('looks fine')), /reviewed items "f": "why" must read "YYYY-MM-DD <why>"/);
      assert.throws(() => run(items, { ...lock, reviewed: { items: { nope: { under: 'body-a', why: '2026-10-29 x' } } } }), /reviewed items "nope" is not an item/);
      assert.throws(() => run(flag, ack(undefined, 'body-b')), /reviewed items "f": "under" must name a locked stream/);
      // the old flat form is refused, not read as an acknowledgement
      assert.throws(() => run(flag, { ...lock, reviewed: { f: '2026-10-29 x' } }), /"reviewed" holds "items" and "streams" only, not "f"/);
      // outside every locked stream, nothing to acknowledge
      run({ ...items, b: it_('body-b', obs('survey', 'b')) }, lock);
    });

    it('[FHIR-SCOPE-19] an acknowledgement holds under its own locked stream only', () => {
      const items = { a: it_('body-a', obs('vital-signs', 'a')), b: it_('body-b', obs('survey', 'b')) };
      const lock = lockOf(items);
      const flag = { ...items, f: it_('body-a-flag', { companionOf: 'a' }) };
      // reviewed for a reader of Observation|survey (under body-b), then placed under the vital-signs stream
      const elsewhere = { ...lock, reviewed: { items: { f: { under: 'body-b', why: '2026-10-29 fine for survey readers' } }, streams: {} } };
      assert.throws(() => run(flag, elsewhere), /reviewed items "f": "under" is "body-b", which is not its stream nor above it/);
      // under an outer locked stream while a nearer one is found: not an acknowledgement for the nearer one
      const outer = { ...lock, reviewed: { items: { f: { under: 'body-a', why: '2026-10-29 fine for vital-signs readers' } }, streams: {} } };
      assert.throws(() => run(flag, outer), /item "f" is new under the published stream "body-a-flag"/);
    });

    it('[FHIR-SCOPE-20] a stream added or moved under a locked stream needs an acknowledgement, items or not', () => {
      const items = { a: it_('body-a', obs('vital-signs', 'a')) };
      const lockTree = [{ id: 'body', children: [{ id: 'body-a' }, { id: 'body-b' }] }, { id: 'mood' }];
      const lock = lockOf(items, lockTree);
      // a new item-less child, and a deeper one
      const added = [{ id: 'body', children: [{ id: 'body-a', children: [{ id: 'body-a-notes' }, { id: 'body-a-ctx', children: [{ id: 'body-a-ctx-deep' }] }] }, { id: 'body-b' }] }, { id: 'mood' }];
      assert.throws(() => run(items, lock, added), /stream "body-a-notes" is new under the published stream "body-a": every grant already issued for Observation\|vital-signs would read it\. .*"reviewed": \{ "streams": \{ "body-a-notes": \{ "under": "body-a"/);
      // an existing item-less stream re-parented into the locked one
      const moved = [{ id: 'body', children: [{ id: 'body-a', children: [{ id: 'body-b' }] }] }, { id: 'mood' }];
      assert.throws(() => run(items, lock, moved), /stream "body-b" is new under the published stream "body-a"/);
      // acknowledged under its locked stream: passes; fhir:lock then records it
      const ack = (under) => ({ ...lock, reviewed: { items: {}, streams: { 'body-b': { under, why: '2026-10-29 empty container' } } } });
      run(items, ack('body-a'), moved);
      assert.deepStrictEqual(lockOf(items, moved).streams['body-b'], { pair: 'Observation|vital-signs', parent: 'body-a', items: [] });
      assert.throws(() => run(items, { ...lock, reviewed: { items: {}, streams: { nope: { under: 'body-a', why: '2026-10-29 x' } } } }), /reviewed streams "nope" is not a stream/);
      // acknowledging a stream does not acknowledge its children: each needs its own entry
      const deep = [{ id: 'body', children: [{ id: 'body-a', children: [{ id: 'body-a-ctx', children: [{ id: 'body-a-ctx-deep' }] }] }, { id: 'body-b' }] }, { id: 'mood' }];
      const ctxOnly = { ...lock, reviewed: { items: {}, streams: { 'body-a-ctx': { under: 'body-a', why: '2026-10-29 context' } } } };
      assert.throws(() => run(items, ctxOnly, deep), /stream "body-a-ctx-deep" is new under the published stream "body-a"/);
    });

    it('[FHIR-SCOPE-22] an acknowledgement must sit on or above where its item or stream is now', () => {
      const items = { a: it_('body-a', obs('vital-signs', 'a')) };
      const lock = lockOf(items);
      // written for body-a while the item sits outside every locked subtree: refused, so it never pre-approves a move
      const stale = { ...lock, reviewed: { items: { m: { under: 'body-a', why: '2026-10-29 for later' } }, streams: {} } };
      assert.throws(() => run({ ...items, m: it_('mood', obs('survey', 'm')) }, stale), /reviewed items "m": "under" is "body-a", which is not its stream nor above it/);
      const streamStale = { ...lock, reviewed: { items: {}, streams: { mood: { under: 'body-a', why: '2026-10-29 for later' } } } };
      assert.throws(() => run(items, streamStale), /reviewed streams "mood": "under" is "body-a", which is not above it/);
    });

    it('[FHIR-SCOPE-21] renaming a mapped key: the deprecated alias keeps the block (or is a companion), the new key is reviewed', () => {
      const items = { a: it_('body-a', obs('vital-signs', 'a')) };
      const lock = lockOf(items);
      const ack = { ...lock, reviewed: { items: { a2: { under: 'body-a', why: '2026-10-29 rename of a' } }, streams: {} } };
      run({ a: it_('body-a', obs('vital-signs', 'a'), { deprecated: true }), a2: it_('body-a', obs('vital-signs', 'a')) }, ack);
      run({ a: it_('body-a', { companionOf: 'a2' }, { deprecated: true }), a2: it_('body-a', obs('vital-signs', 'a')) }, ack);
      assert.throws(() => run({ a: it_('body-a', null, { deprecated: true }), a2: it_('body-a', obs('vital-signs', 'a')) }, ack), /spans \(unmapped\), Observation\|vital-signs/);
      assert.throws(() => run({ a: it_('body-a', obs('vital-signs', 'a'), { deprecated: true }), a2: it_('body-a', obs('vital-signs', 'a')) }, lock), /item "a2" is new under the published stream "body-a"/);
    });

    it('[FHIR-SCOPE-17] an old-format lock is refused', () => {
      assert.throws(() => checkFhirScopes({}, { roots: tree, lock: { 'Observation|survey': ['x'] } }), /formatVersion undefined, this build reads 2/);
    });

    it('[FHIR-SCOPE-12] Patient elements: a bare scope key, one active item per element, never a companion parent', () => {
      const el = (element) => ({ resourceType: 'Patient', element });
      const grants = run({ a: it_('body-a', el('name.given')), f: it_('body-a-flag', el('name.family')), b: it_('body-b') });
      assert.deepStrictEqual(grants, { Patient: ['body-a'] });
      assert.throws(() => run({ a: it_('body-a', el('gender')), b: it_('body-b', el('gender')) }), /fhir import key Patient\.gender is claimed by both "a" and "b"/);
      run({ a: it_('body-a', el('gender')), b: it_('body-b', el('gender'), { deprecated: true }) });
      assert.throws(() => run({ a: it_('body-a', el('gender')), f: it_('body-a-flag', { companionOf: 'a' }) }), /the parent is a Patient element/);
      assert.throws(() => run({ a: it_('body-a', el('gender')), f: it_('body-a-flag') }), /spans \(unmapped\), Patient/);
    });

    it('[FHIR-SCOPE-9] mergeLock adds and never removes, never rewrites a pair or parent, keeps "reviewed"', () => {
      const reviewed = { items: { j: { under: 'x', why: '2026-10-29 ok' } }, streams: {} };
      const lock = { formatVersion: 2, streams: { x: { pair: 'Observation|survey', parent: null, items: ['i'] } }, reviewed };
      const merged = mergeLock(lock, {
        x: { pair: 'Observation|vital-signs', parent: 'p', items: ['j'] },
        c: { pair: 'Condition|problem-list-item', parent: null, items: ['c'] }
      });
      assert.deepStrictEqual(merged, {
        formatVersion: 2,
        streams: {
          c: { pair: 'Condition|problem-list-item', parent: null, items: ['c'] },
          x: { pair: 'Observation|survey', parent: null, items: ['i', 'j'] }
        },
        reviewed
      });
      assert.deepStrictEqual(mergeLock(merged, {}), merged);
    });

    it('[FHIR-SCOPE-10] import keys are unique across active items', () => {
      assert.throws(() => run({ a: it_('body-a', obs('vital-signs', 'same')), b: it_('body-b', obs('vital-signs', 'same')) }), /claimed by both "a" and "b"/);
      const withAlso = obs('vital-signs', 'b');
      withAlso.alsoMatch = [coding('a')];
      assert.throws(() => run({ a: it_('body-a', obs('vital-signs', 'a')), b: it_('body-b', withAlso) }), /claimed by both/);
      run({ a: it_('body-a', obs('vital-signs', 'same')), b: it_('body-b', obs('vital-signs', 'same'), { deprecated: true }) });
    });

    it('[FHIR-SCOPE-13] datasource import keys are per category the block accepts; a split code is no import key', () => {
      const { checkFhirImportKeys } = require('../src/fhir');
      const ds = (category, also) => ({ resourceType: 'Condition', category, ...(also ? { alsoMatchCategories: also } : {}), code: { from: 'datasource', field: 'x' }, profiles: {} });
      checkFhirImportKeys({ a: { fhir: ds('problem-list-item') }, b: { fhir: ds('health-concern') } });
      assert.throws(() => checkFhirImportKeys({ a: { fhir: ds('problem-list-item') }, b: { fhir: ds('problem-list-item') } }), /Condition\|problem-list-item from datasource is claimed by both "a" and "b"/);
      assert.throws(() => checkFhirImportKeys({ a: { fhir: ds('problem-list-item', ['encounter-diagnosis']) }, b: { fhir: ds('encounter-diagnosis') } }), /Condition\|encounter-diagnosis from datasource is claimed by both/);
      // the heart-rate item claims 8867-4; the blood-pressure split renders with it and still loads
      assert.strictEqual(itemsById['body-heart-rate'].fhir.code.code, itemsById['body-blood-pressure'].fhir.split.rate.code.code);
      checkFhirImportKeys(itemsById);
    });

    it('[FHIR-SCOPE-19] eventType codes are import keys; a LOINC import key is never a code another item owns ([LABC-LOINC-1])', () => {
      const { checkFhirImportKeys } = require('../src/fhir');
      const lab = (codes) => ({ resourceType: 'Observation', category: 'laboratory', code: { from: 'eventType', codings: Object.fromEntries(codes.map((c, i) => [`t${i}`, coding(c)])) }, profiles: {} });
      checkFhirImportKeys({ a: { fhir: lab(['1', '2']), references: { loinc: ['1', '2'] } }, b: { fhir: lab(['3', '4']) } });
      assert.throws(() => checkFhirImportKeys({ a: { fhir: lab(['1', '2']) }, b: { fhir: lab(['2', '3']) } }), /Observation http:\/\/loinc.org\|2 is claimed by both "a" and "b"/);
      assert.throws(() => checkFhirImportKeys({ a: { fhir: lab(['1', '2']) }, b: { references: { loincMethod: ['2'] } } }), /http:\/\/loinc.org\|2 of "a" is a LOINC code item "b" owns/);
      const also = { ...lab(['1', '2']), alsoMatch: [coding('9')] };
      assert.throws(() => checkFhirImportKeys({ a: { fhir: also }, b: { references: { loinc: ['9'] } } }), /http:\/\/loinc.org\|9 of "a" is a LOINC code item "b" owns/);
      checkFhirImportKeys({ a: { fhir: also }, b: { references: { loinc: ['9'] }, deprecated: true } });
    });

    it('[FHIR-SCOPE-23] an alsoEmit coding is no import key, and never one of another item nor a LOINC code another item owns', () => {
      const { checkFhirImportKeys } = require('../src/fhir');
      const emits = (code, also) => ({ ...obs('vital-signs', code), alsoEmit: [coding(also)] });
      // Not an import key: another item may not claim it either, but two items may emit the same one.
      checkFhirImportKeys({ a: { fhir: emits('1', '9') }, b: { fhir: emits('2', '9') } });
      assert.throws(() => checkFhirImportKeys({ a: { fhir: emits('1', '9') }, b: { fhir: obs('vital-signs', '9') } }), /alsoEmit Observation http:\/\/loinc.org\|9 of "a" is an import key of "b"/);
      const withAlso = { ...obs('vital-signs', '2'), alsoMatch: [coding('9')] };
      assert.throws(() => checkFhirImportKeys({ a: { fhir: emits('1', '9') }, b: { fhir: withAlso } }), /is an import key of "b"/);
      assert.throws(() => checkFhirImportKeys({ a: { fhir: emits('1', '9') }, b: { references: { loinc: ['9'] } } }), /alsoEmit Observation http:\/\/loinc.org\|9 of "a" is a LOINC code item "b" owns/);
      checkFhirImportKeys({ a: { fhir: emits('1', '9'), references: { loinc: ['9'] } } });
      checkFhirImportKeys({ a: { fhir: emits('1', '9') }, b: { fhir: obs('vital-signs', '9'), deprecated: true } });
      // The model: 2708-6 (a blood-gas SaO2) is emitted by SpO2 and claimed by no item.
      assert.ok(Object.values(itemsById).every((i) => !(i.references?.loinc || []).includes('2708-6')));
    });

    it('[FHIR-SCOPE-11] the model\'s table; the committed lock is up to date (run npm run fhir:lock)', () => {
      const labBlocks = Object.entries(itemsById).filter(([, i]) => i.fhir?.category === 'laboratory');
      // 135 active items, plus the two legacy urine-hormone items (LH, PdG) whose stream is their replacement's. The
      // eight differential streams hold two items each (the percentage and the absolute count). 4.29.0 adds PSA total
      // and urine creatinine. The three lab-result/coded-v1 items (blood, urine, cerebrospinal fluid), one stream each.
      assert.strictEqual(labBlocks.length, 140);
      const lab = [...new Set(labBlocks.map(([, i]) => i.streamId))].sort();
      assert.strictEqual(lab.length, 130);
      assert.deepStrictEqual(fhirScopes, {
        AllergyIntolerance: ['allergy'],
        'Condition|problem-list-item': ['condition'],
        'DocumentReference|clinical-note': ['documents'],
        MedicationRequest: ['medication-prescription'],
        MedicationStatement: ['medication-intake'],
        'Observation|laboratory': lab,
        'Observation|social-history': ['lifestyle-tobacco-smoking'],
        'Observation|survey': ['wellbeing-general-health'],
        'Observation|vital-signs': ['body-blood-pressure', 'body-heart-rate', 'body-height', 'body-oxygen-saturation', 'body-weight'],
        Patient: ['profile-address', 'profile-date-of-birth', 'profile-name', 'profile-sex'],
        Procedure: ['procedure'],
        Questionnaire: ['questionnaire-request'],
        QuestionnaireResponse: ['questionnaire-answer']
      });
      // each of the two streams is a grant of its own, under its own pair; the root above them is in no grant
      assert.deepStrictEqual(readLock().streams['questionnaire-answer'], { pair: 'QuestionnaireResponse', parent: 'questionnaire', items: ['questionnaire-answer'] });
      assert.deepStrictEqual(readLock().streams['questionnaire-request'], { pair: 'Questionnaire', parent: 'questionnaire', items: ['questionnaire-request'] });
      assert.strictEqual(readLock().streams.questionnaire, undefined);
      // the Procedure grant reaches the context stream under its root, which holds no item of its own
      assert.deepStrictEqual(readLock().streams['procedure-fertility'], { pair: 'Procedure', parent: 'procedure', items: [] });
      assert.deepStrictEqual(mergeLock(readLock(), lockEntries(itemsById, fhirScopes)), readLock(), 'definitions/fhir/scopes.lock.json is not up to date');
      assert.ok(!JSON.stringify(fhirScopes).includes(UNMAPPED));
    });

    it('[FHIR-SCOPE-18] CI: the published fhirScopes is contained in the lock, each root under its pair', () => {
      const lock = readLock();
      const contained = (table) => {
        for (const [pair, roots] of Object.entries(table)) {
          for (const root of roots) assert.strictEqual(lock.streams[root]?.pair, pair, `grant root "${root}" of ${pair} is not in the lock under that pair`);
        }
      };
      contained(fhirScopes);
      const p = path.join(__dirname, '../dist/pack.json');
      if (fs.existsSync(p)) contained(JSON.parse(fs.readFileSync(p, 'utf-8')).fhirScopes ?? {});
    });
  });

  describe('[FHIR-PACK] what readers download', () => {
    it('[FHIR-PACK-1] the pack carries fhirScopes and fhirMapping (in memory, as build.js assembles them)', () => {
      const byPack = Object.fromEntries(toBePublished().filter((f) => f.includeInPack).map((f) => [f.includeInPack, f.content]));
      assert.deepStrictEqual(byPack.fhirScopes, fhirScopes);
      const m = byPack.fhirMapping;
      assert.strictEqual(m.formatVersion, 1);
      assert.strictEqual(m.fhirVersion, '4.0.1');
      assert.deepStrictEqual(m.flavours, { us: 'hl7.fhir.us.core#6.1.0', ips: 'hl7.fhir.uv.ips#2.0.1', ch: 'ch.fhir.ig.ch-core#6.0.0' });
      assert.deepStrictEqual(Object.keys(m.categories.Observation), ['vital-signs', 'social-history', 'survey', 'laboratory', 'exam', 'imaging', 'procedure', 'therapy', 'activity']);
      assert.deepStrictEqual(Object.keys(m.categories.Condition), ['problem-list-item', 'encounter-diagnosis', 'health-concern']);
      assert.strictEqual(m.systems['SNOMED-CT'], 'http://snomed.info/sct');
      assert.strictEqual(m.systems['ICD-10'], 'http://hl7.org/fhir/sid/icd-10');
      assert.deepStrictEqual(Object.keys(m.productSystems), ['Swissmedic', 'CIS']);
      assert.strictEqual(fhirMapping, m);
    });

    it('[FHIR-PACK-2] the built dist/pack.json carries them', () => {
      const p = path.join(__dirname, '../dist/pack.json');
      if (!fs.existsSync(p)) return; // npm run build has not run yet
      const pack = JSON.parse(fs.readFileSync(p, 'utf-8'));
      assert.deepStrictEqual(pack.fhirScopes, fhirScopes);
      assert.strictEqual(pack.fhirMapping.formatVersion, 1);
    });
  });
});
