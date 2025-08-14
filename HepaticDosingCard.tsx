// src/components/HepaticDosingCard.tsx
import React, { useMemo, useState } from "react";
import dataset from "@/data/drugDosing.json"; // put drugDosing.json at src/data/
import { calculateHepaticDose, findDrug } from "@/utils/dosing";
import type { ChildPughClass, DrugRecord } from "@/types/dosing";

type Props = {
  /** From your Child-Pugh calculator */
  childPughClass?: ChildPughClass; // 'A' | 'B' | 'C'
  bilirubinMgDl?: number;          // normalized mg/dL (for bilirubin-based drugs)
};

export default function HepaticDosingCard({ childPughClass, bilirubinMgDl }: Props) {
  const [query, setQuery] = useState("");
  const [selectedDrug, setSelectedDrug] = useState<DrugRecord | null>(null);
  const [route, setRoute] = useState<string>("");

  // Basic client-side search in local JSON (upgrade to RxNorm/DailyMed later)
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as DrugRecord[];
    return (dataset as unknown as DrugRecord[]).filter(d =>
      d.generic.toLowerCase().includes(q) ||
      (d.brands ?? []).some(b => b.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [query]);

  const onSelect = (drug: DrugRecord) => {
    setSelectedDrug(drug);
    setRoute(drug.routes[0]); // default to first route
  };

  const doseResult = useMemo(() => {
    if (!selectedDrug || !route) return null;
    return calculateHepaticDose({
      drug: selectedDrug,
      route,
      childPughClass,
      bilirubinMgDl,
    });
  }, [selectedDrug, route, childPughClass, bilirubinMgDl]);

  const cardBorder =
    doseResult?.ok && doseResult?.multiplier === 0
      ? "border-red-500"
      : "border-zinc-300 dark:border-zinc-700";

  return (
    <div className={`rounded-2xl border ${cardBorder} p-4 md:p-6 shadow-sm bg-white dark:bg-zinc-900`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-lg md:text-xl font-semibold">Drug Dosing (Hepatic)</h2>
        <ContextBadge childPughClass={childPughClass} bilirubinMgDl={bilirubinMgDl} />
      </div>

      {/* Search + Results */}
      <div className="mb-3">
        <label className="block text-sm font-medium mb-1">Search drug</label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g., apixaban, warfarin, doxorubicin"
          className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {query && matches.length > 0 && (
          <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
            {matches.map((d) => (
              <button
                key={d.generic}
                onClick={() => { onSelect(d); setQuery(d.generic); }}
                className="w-full text-left px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <div className="font-medium">{d.generic}</div>
                {!!d.brands?.length && (
                  <div className="text-xs text-zinc-500">Brands: {d.brands.join(", ")}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Drug + Route */}
      {selectedDrug && (
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <div className="text-sm text-zinc-500">Selected</div>
              <div className="font-medium">{selectedDrug.generic}</div>
            </div>
            <div className="grow" />
            <div className="min-w-[180px]">
              <label className="block text-sm text-zinc-500 mb-1">Route</label>
              <select
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2"
              >
                {selectedDrug.routes.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {selectedDrug && doseResult && (
        <ResultCard
          childPughClass={childPughClass}
          bilirubinMgDl={bilirubinMgDl}
          result={doseResult}
        />
      )}

      {/* Helper footer */}
      {!selectedDrug && (
        <p className="text-sm text-zinc-500">
          Start by searching a drug. Dose is computed from the drug’s label rules and
          your patient’s Child-Pugh class or bilirubin, when applicable.
        </p>
      )}
    </div>
  );
}

function ContextBadge({
  childPughClass,
  bilirubinMgDl,
}: {
  childPughClass?: ChildPughClass;
  bilirubinMgDl?: number;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-1">
        Child-Pugh: <b>{childPughClass ?? "—"}</b>
      </span>
      <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-1">
        Bilirubin: <b>{bilirubinMgDl != null ? `${bilirubinMgDl} mg/dL` : "—"}</b>
      </span>
    </div>
  );
}

function ResultCard({
  childPughClass,
  bilirubinMgDl,
  result,
}: {
  childPughClass?: ChildPughClass;
  bilirubinMgDl?: number;
  result: ReturnType<typeof calculateHepaticDose>;
}) {
  const danger = result.ok && result.multiplier === 0;
  return (
    <div
      className={`rounded-xl p-4 border ${
        danger ? "border-red-500 bg-red-50 dark:bg-red-950/20" : "border-zinc-200 dark:border-zinc-700"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold">Calculated Dose</h3>
        {result.method && (
          <span className="text-xs rounded-full px-2 py-1 bg-zinc-100 dark:bg-zinc-800">
            Method: {result.method}
          </span>
        )}
      </div>

      {/* Dose / advisory */}
      {result.ok && result.adjusted_dose != null ? (
        <div className="text-2xl font-semibold mb-1">
          {result.adjusted_dose} <span className="text-base font-normal">{result.units}</span>
        </div>
      ) : (
        <div className="text-base">
          {result.rationale || "No computable dose — see advisory."}
        </div>
      )}

      {/* Math + rationale */}
      {result.math && <div className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{result.math}</div>}
      {result.rationale && (
        <div className="text-sm mt-2">
          <span className="font-medium">Note: </span>{result.rationale}
        </div>
      )}

      {/* Warnings */}
      {!!result.warnings?.length && (
        <ul className="mt-3 text-sm text-amber-700 dark:text-amber-300 list-disc pl-5">
          {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
        </ul>
      )}

      {/* Citation */}
      {result.citation && (
        <div className="text-xs text-zinc-500 mt-3">
          Source: {result.citation}. Always verify against full prescribing information.
        </div>
      )}

      {/* Context echo */}
      <div className="text-xs text-zinc-500 mt-2">
        Context — Child-Pugh: <b>{childPughClass ?? "—"}</b>; Bilirubin:{" "}
        <b>{bilirubinMgDl != null ? `${bilirubinMgDl} mg/dL` : "—"}</b>
      </div>
    </div>
  );
}
