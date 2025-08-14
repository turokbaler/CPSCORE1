/**
 * Utilities for hepatic dosing computation.
 * Drop this into: src/utils/dosing.ts
 */
import type {
  BilirubinAlgorithm,
  ChildPughAlgorithm,
  DoseRequest,
  DoseResult,
  DosingAlgorithm,
  DrugRecord,
} from '../types/dosing';

function isChildPugh(algo: DosingAlgorithm): algo is ChildPughAlgorithm {
  return algo.method === 'child_pugh';
}
function isBilirubin(algo: DosingAlgorithm): algo is BilirubinAlgorithm {
  return algo.method === 'bilirubin';
}

export function calculateHepaticDose(req: DoseRequest): DoseResult {
  const warnings: string[] = [];
  const algo = req.drug.dosing_algorithm;

  // Route-aware extensions could be added here later (e.g., per-route algorithms).
  // For now we just carry the selected route for display.
  const route = req.route?.toLowerCase();

  if (algo.method === 'advisory') {
    return {
      ok: true,
      adjusted_dose: null,
      units: algo.units,
      rationale: algo.advisory,
      method: 'advisory',
      base_dose: algo.base_dose,
      multiplier: null,
      math: 'Advisory only — no computable percentage provided in label.',
      warnings,
      citation: (req.drug.citation ?? undefined),
    };
  }

  if (isChildPugh(algo)) {
    if (!req.childPughClass) {
      warnings.push('Child-Pugh class is required for this drug.');
      return {
        ok: false,
        units: algo.units,
        rationale: 'Missing Child-Pugh class',
        method: 'child_pugh',
        base_dose: algo.base_dose,
        multiplier: null,
        math: '',
        warnings,
        citation: (req.drug.citation ?? undefined),
      };
    }
    const rule = algo.rules[req.childPughClass];
    if (!rule) {
      warnings.push(`No rule found for Child-Pugh ${req.childPughClass}.`);
      return {
        ok: false,
        units: algo.units,
        rationale: `No dosing rule for Child-Pugh ${req.childPughClass}`,
        method: 'child_pugh',
        base_dose: algo.base_dose,
        multiplier: null,
        math: '',
        warnings,
        citation: (req.drug.citation ?? undefined),
      };
    }
    const adjusted = Number((algo.base_dose * rule.multiplier).toFixed(4));
    const math = `${algo.base_dose} × ${rule.multiplier} = ${adjusted} ${algo.units}`;
    return {
      ok: true,
      adjusted_dose: adjusted,
      units: algo.units,
      rationale: rule.note,
      method: 'child_pugh',
      base_dose: algo.base_dose,
      multiplier: rule.multiplier,
      math,
      warnings,
      citation: (req.drug.citation ?? undefined),
    };
  }

  if (isBilirubin(algo)) {
    if (req.bilirubinMgDl == null || Number.isNaN(req.bilirubinMgDl)) {
      warnings.push('Bilirubin (mg/dL) is required for this drug.');
      return {
        ok: false,
        units: algo.units,
        rationale: 'Missing bilirubin value',
        method: 'bilirubin',
        base_dose: algo.base_dose,
        multiplier: null,
        math: '',
        warnings,
        citation: (req.drug.citation ?? undefined),
      };
    }
    const b = req.bilirubinMgDl;
    const cutoff = (algo.cutoffs ?? []).find(c => {
      const min = c.min ?? -Infinity;
      const max = c.max ?? Infinity;
      return b >= min && b < max;
    });
    if (!cutoff) {
      warnings.push(`No bilirubin cutoff rule covers value ${b} mg/dL.`);
      return {
        ok: false,
        units: algo.units,
        rationale: 'No bilirubin-based rule matched',
        method: 'bilirubin',
        base_dose: algo.base_dose,
        multiplier: null,
        math: '',
        warnings,
        citation: (req.drug.citation ?? undefined),
      };
    }
    const adjusted = Number((algo.base_dose * cutoff.multiplier).toFixed(4));
    const math = `${algo.base_dose} × ${cutoff.multiplier} = ${adjusted} ${algo.units} (bilirubin = ${b} mg/dL)`;
    return {
      ok: true,
      adjusted_dose: adjusted,
      units: algo.units,
      rationale: cutoff.note,
      method: 'bilirubin',
      base_dose: algo.base_dose,
      multiplier: cutoff.multiplier,
      math,
      warnings,
      citation: (req.drug.citation ?? undefined),
    };
  }

  // Should never get here, but just in case:
  return {
    ok: false,
    rationale: 'Unsupported dosing algorithm',
    warnings: ['Unsupported dosing algorithm'],
    method: undefined as any,
  };
}

/**
 * Utility to find a drug by generic or brand name (case-insensitive)
 * from a loaded dataset (array of DrugRecord).
 */
export function findDrug(
  dataset: DrugRecord[],
  query: string
): DrugRecord | undefined {
  const q = query.trim().toLowerCase();
  return dataset.find(d => {
    if (d.generic.toLowerCase() === q) return true;
    return (d.brands ?? []).some(b => b.toLowerCase() === q);
  });
}
