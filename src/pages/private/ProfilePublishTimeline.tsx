import { AlertCircle, CheckCircle2, ExternalLink, EyeOff, Save, Send } from 'lucide-react';
import { ProfileReviewStatus } from '../../types/models';
import { formatFirestoreDate } from '../../utils/formatDate';
import { Button } from '../../components/ui/Button';

interface ProfilePublishTimelineProps {
  reviewStatus: ProfileReviewStatus;
  slug?: string;
  updatedAt?: unknown;
  reviewComment?: string;
  reviewedByName?: string;
  saving: boolean;
  unpublishing: boolean;
  hasUnsavedChanges: boolean;
  onSaveDraft: () => void;
  onRequestPublish: () => void;
  onUnpublish: () => void;
}

const STEPS: { key: ProfileReviewStatus; label: string; desc: string }[] = [
  { key: 'borrador', label: 'Borrador', desc: 'Edición privada' },
  { key: 'revision', label: 'En revisión', desc: 'Mesa Directiva' },
  { key: 'publicada', label: 'Publicada', desc: 'Visible al público' },
];

export function ProfilePublishTimeline({
  reviewStatus,
  slug,
  updatedAt,
  reviewComment,
  reviewedByName,
  saving,
  unpublishing,
  hasUnsavedChanges,
  onSaveDraft,
  onRequestPublish,
  onUnpublish,
}: ProfilePublishTimelineProps) {
  const currentIdx = STEPS.findIndex((s) => s.key === reviewStatus);
  const updatedText = updatedAt ? formatFirestoreDate(updatedAt) : 'Sin registro previo';

  return (
    <div className="space-y-4 rounded-xl border border-stone-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold tracking-wider text-stone-500 uppercase dark:text-slate-400">
            Estado de publicación ciudadana
          </p>
          <p className="mt-0.5 text-xs text-stone-500 dark:text-slate-400">
            Última actualización guardada en servidor: <span className="font-medium text-stone-800 dark:text-slate-200">{updatedText}</span>
          </p>
        </div>

        {reviewStatus === 'publicada' && slug && (
          <a
            href={`/consejeros/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#7B1832]/30 bg-[#7B1832]/5 px-3 py-1.5 text-xs font-semibold text-[#7B1832] hover:bg-[#7B1832]/10 dark:border-[#D9B245]/40 dark:bg-[#C59B27]/10 dark:text-[#E5C158]"
          >
            <span>Ver mi ficha pública</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        )}
      </div>

      <ol className="grid grid-cols-3 gap-2" aria-label="Flujo de publicación de ficha">
        {STEPS.map((step, idx) => {
          const doneOrActive = idx <= currentIdx;
          const isCurrent = idx === currentIdx;
          return (
            <li
              key={step.key}
              className={`rounded-lg border p-2.5 text-xs transition-colors ${
                isCurrent
                  ? 'border-[#7B1832] bg-[#7B1832]/8 dark:border-[#C59B27] dark:bg-[#C59B27]/12'
                  : doneOrActive
                    ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/30'
                    : 'border-stone-200 bg-stone-50 dark:border-slate-800 dark:bg-slate-950/50'
              }`}
            >
              <div className="flex items-center gap-1.5 font-semibold text-stone-900 dark:text-white">
                <CheckCircle2
                  className={`h-3.5 w-3.5 shrink-0 ${
                    isCurrent
                      ? 'text-[#7B1832] dark:text-[#E5C158]'
                      : doneOrActive
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-stone-400 dark:text-slate-600'
                  }`}
                  aria-hidden="true"
                />
                <span>{step.label}</span>
              </div>
              <p className="mt-0.5 text-[11px] text-stone-500 dark:text-slate-400">{step.desc}</p>
            </li>
          );
        })}
      </ol>

      {reviewComment && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">
              Observación de Mesa Directiva{reviewedByName ? ` (${reviewedByName})` : ''}:
            </p>
            <p className="mt-0.5 leading-relaxed">{reviewComment}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-200 pt-3 dark:border-slate-800">
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" loading={saving} onClick={onSaveDraft}>
            <Save className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Guardar borrador</span>
          </Button>
          <Button type="button" size="sm" loading={saving} onClick={onRequestPublish}>
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{reviewStatus === 'publicada' ? 'Actualizar y reenviar a revisión' : 'Solicitar publicación'}</span>
          </Button>
          {reviewStatus === 'publicada' && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              loading={unpublishing}
              onClick={onUnpublish}
            >
              <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Despublicar</span>
            </Button>
          )}
        </div>

        {hasUnsavedChanges && (
          <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
            Tienes cambios sin guardar en servidor
          </span>
        )}
      </div>
    </div>
  );
}
