import { Calendar, MapPin } from 'lucide-react';
import { Commission } from '../../types/models';
import { Card } from '../../components/ui/Card';

interface CommissionSummaryTabProps {
  commission: Commission;
  avgGoals: number;
  avgCommitments: number;
}

export function CommissionSummaryTab({
  commission,
  avgGoals,
  avgCommitments,
}: CommissionSummaryTabProps) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <h3 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
            Descripción y misión
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-stone-700 dark:text-slate-300">
            {commission.description}
          </p>
          {commission.mission && (
            <p className="mt-3 border-t border-stone-200 pt-3 text-sm leading-relaxed text-stone-600 dark:border-slate-800 dark:text-slate-300">
              <strong className="text-stone-900 dark:text-white">Misión:</strong>{' '}
              {commission.mission}
            </p>
          )}
        </Card>

        {commission.objectives?.length || commission.workLines?.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <h4 className="font-display text-base font-semibold text-stone-950 dark:text-white">
                Objetivos
              </h4>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-stone-600 dark:text-slate-300">
                {(commission.objectives || []).map((obj, idx) => (
                  <li key={idx}>{obj}</li>
                ))}
                {!commission.objectives?.length && <li>Sin objetivos registrados aún.</li>}
              </ul>
            </Card>
            <Card>
              <h4 className="font-display text-base font-semibold text-stone-950 dark:text-white">
                Líneas de trabajo
              </h4>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm text-stone-600 dark:text-slate-300">
                {(commission.workLines || []).map((line, idx) => (
                  <li key={idx}>{line}</li>
                ))}
                {!commission.workLines?.length && <li>Sin líneas registradas aún.</li>}
              </ul>
            </Card>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <Card>
          <h3 className="font-display text-base font-semibold text-stone-950 dark:text-white">
            Coordinación y encuentros
          </h3>
          <dl className="mt-3 space-y-2.5 text-xs text-stone-600 dark:text-slate-300">
            <div>
              <dt className="text-stone-500 dark:text-slate-400">Líder</dt>
              <dd className="font-semibold text-stone-900 dark:text-white">
                {commission.leaderName || 'Por asignar'}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500 dark:text-slate-400">Secretario(a)</dt>
              <dd className="font-semibold text-stone-900 dark:text-white">
                {commission.secretaryName || 'Por asignar'}
              </dd>
            </div>
            {commission.meetingPlace && (
              <div className="flex items-start gap-2">
                <MapPin
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7B1832] dark:text-[#D9B245]"
                  aria-hidden="true"
                />
                <span>{commission.meetingPlace}</span>
              </div>
            )}
            {commission.meetingSchedule && (
              <div className="flex items-start gap-2">
                <Calendar
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7B1832] dark:text-[#D9B245]"
                  aria-hidden="true"
                />
                <span>{commission.meetingSchedule}</span>
              </div>
            )}
          </dl>
        </Card>

        <Card>
          <h3 className="font-display text-base font-semibold text-stone-950 dark:text-white">
            Indicadores reales
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-lg bg-[#FAF8F4] p-3 dark:bg-slate-800/60">
              <p className="font-mono-tabular text-xl font-bold text-[#7B1832] dark:text-[#D9B245]">
                {avgGoals}%
              </p>
              <p className="text-[11px] text-stone-500 dark:text-slate-400">Plan de trabajo</p>
            </div>
            <div className="rounded-lg bg-[#FAF8F4] p-3 dark:bg-slate-800/60">
              <p className="font-mono-tabular text-xl font-bold text-stone-950 dark:text-white">
                {avgCommitments}%
              </p>
              <p className="text-[11px] text-stone-500 dark:text-slate-400">Compromisos</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
