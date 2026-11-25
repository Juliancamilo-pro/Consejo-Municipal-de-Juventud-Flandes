import React from 'react';
import { Printer, X } from 'lucide-react';
import type { CouncilVote, PublicCouncilor } from '../../../types/cmj';
import { BrandLogo } from '../../BrandLogo';
import { MAJORITY_LABELS, MODE_LABELS } from './voteShared';

export function PrintableVoteModal({
  vote,
  publicCouncilors,
  onClose,
}: {
  vote: CouncilVote | null;
  publicCouncilors: PublicCouncilor[];
  onClose: () => void;
}) {
  if (!vote) return null;

  return (
    <div className="fixed inset-0 z-[85] bg-slate-950/80 p-4 overflow-y-auto flex justify-center print:static print:bg-white print:p-0 print:block">
      <div className="w-full max-w-2xl bg-white text-slate-900 rounded-2xl p-6 sm:p-8 space-y-5 shadow-2xl my-auto print:shadow-none print:max-w-none print:p-2">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-300 pb-4">
          <div className="flex items-center gap-3">
            <BrandLogo size="md" />
            <div>
              <p className="text-xs font-bold uppercase text-emerald-700">
                Acta de Escrutinio Oficial · CMJ Flandes, Tolima
              </p>
              <h2 className="mt-1 text-xl font-extrabold">{vote.title}</h2>
              <p className="text-xs text-slate-600">
                Modalidad: {MODE_LABELS[vote.voteMode || 'nominal']} · Regla:{' '}
                {MAJORITY_LABELS[vote.majorityType || 'simple']} · Participantes:{' '}
                {vote.voterUids.length}
              </p>
            </div>
          </div>
          <div className="flex gap-2 no-print">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white cursor-pointer whitespace-nowrap"
            >
              <Printer className="h-4 w-4" /> Imprimir PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar acta de escrutinio"
              className="rounded-xl bg-slate-200 p-2 text-slate-700 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {vote.resultSummary && (
          <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-xs font-bold">
            Dictamen: {vote.resultSummary}
          </div>
        )}

        <table className="w-full text-xs border border-slate-300">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 p-2 text-left">Opción</th>
              <th className="border border-slate-300 p-2 text-right">Votos</th>
              <th className="border border-slate-300 p-2 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {vote.options.map((opt) => {
              const cnt = vote.tallies?.[opt] || 0;
              const pct = vote.voterUids.length
                ? Math.round((cnt / vote.voterUids.length) * 100)
                : 0;
              return (
                <tr key={opt}>
                  <td className="border border-slate-300 p-2 font-semibold">{opt}</td>
                  <td className="border border-slate-300 p-2 text-right font-mono-num">{cnt}</td>
                  <td className="border border-slate-300 p-2 text-right font-mono-num">{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {vote.voteMode !== 'secreto' &&
          vote.nominalBallots &&
          Object.keys(vote.nominalBallots).length > 0 && (
            <div>
              <h3 className="text-xs font-bold uppercase mb-1.5">Voto Nominal Individual</h3>
              <table className="w-full text-xs border border-slate-300">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 p-2 text-left">Consejero(a)</th>
                    <th className="border border-slate-300 p-2 text-left">Cargo</th>
                    <th className="border border-slate-300 p-2 text-left">Decisión</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(vote.nominalBallots).map(([vUid, choice]) => {
                    const c = publicCouncilors.find((u) => u.uid === vUid);
                    return (
                      <tr key={vUid}>
                        <td className="border border-slate-300 p-2">
                          {c?.fullName || 'Consejero'}
                        </td>
                        <td className="border border-slate-300 p-2">
                          {c?.roleLabel || 'Consejero'}
                        </td>
                        <td className="border border-slate-300 p-2 font-semibold">{choice}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}
