/**
 * Types for hepatic dosing engine (Child-Pugh / bilirubin rules).
 * Drop this into: src/types/dosing.ts
 */

export type ChildPughClass = 'A' | 'B' | 'C';

export type DosingMethod = 'child_pugh' | 'bilirubin' | 'advisory';

/** Rule applied when algorithm is Child-Pugh–based */
export interface ChildPughRule {
  multiplier: number;          // 1.0 = full dose; 0.5 = 50% dose; 0.0 = avoid
  note: string;                // human-readable guidance from label/monograph
}

/** Rule applied when algorithm is bilirubin–based */
export interface BilirubinCutoff {
  min?: number;                // inclusive lower bound (mg/dL); if omitted, -Infinity
  max?: number;                // exclusive upper bound (mg/dL); if omitted, +Infinity
  multiplier: number;          // 1.0 = full dose; 0.5 = half dose; 0.0 = avoid
  note: string;                // human-readable guidance tied to the cutoff
}

export interface ChildPughAlgorithm {
  method: 'child_pugh';
  base_dose: number;           // base dose value
  units: string;               // e.g., "mg/day", "mg BID", "mg/m²"
  rules: Record<ChildPughClass, ChildPughRule>;
}

export interface BilirubinAlgorithm {
  method: 'bilirubin';
  base_dose: number;
  units: string;
  cutoffs: BilirubinCutoff[];
}

/** Used when a label advises caution/avoidance but lacks a computable % change */
export interface AdvisoryAlgorithm {
  method: 'advisory';
  base_dose: number;           // may be 0 if not applicable
  units: string;               // e.g., "n/a" if not applicable
  advisory: string;            // explanatory text to display
  /** Optional: empty rules object for schema compatibility */
  rules?: Record<string, never>;
  /** Optional: empty cutoffs for schema compatibility */
  cutoffs?: never;
}

export type DosingAlgorithm = ChildPughAlgorithm | BilirubinAlgorithm | AdvisoryAlgorithm;

export interface DrugRecord {
  generic: string;
  brands?: string[];
  routes: string[];            // e.g., ['oral', 'IV']
  dosing_algorithm: DosingAlgorithm;
  citation?: string;           // short label/monograph text to display as source
  accessed?: string;           // ISO date string for audit trail
}

export interface DoseRequest {
  drug: DrugRecord;
  route: string;
  childPughClass?: ChildPughClass;
  bilirubinMgDl?: number;
}

export interface DoseResult {
  ok: boolean;
  adjusted_dose?: number | null;
  units?: string;
  rationale?: string;          // the rule note or advisory text
  method?: DosingMethod;
  base_dose?: number;
  multiplier?: number | null;  // multiplier used (if computable)
  math?: string;               // human-readable: "100 × 0.5 = 50 mg/day"
  warnings?: string[];
  citation?: string;
}
