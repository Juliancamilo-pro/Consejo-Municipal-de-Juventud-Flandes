import { FormEvent, useState } from 'react';
import { CheckCircle2, Lock, Vote } from 'lucide-react';
import { submitCitizenPollResponse } from '../../services/participationPublicService';
import { PollQuestion, PublicPoll } from '../../types/participation';
import {
  getEffectivePollQuestions,
  getPollTotalResponses,
} from '../../utils/participationExport';
import { toFriendlySpanishError } from '../../utils/friendlyErrors';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';

interface CitizenPollCardProps {
  poll: PublicPoll;
  alreadyVoted: boolean;
  highlighted?: boolean;
  onVoted: (pollId: string) => Promise<void>;
}

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CitizenPollCard({
  poll,
  alreadyVoted,
  highlighted = false,
  onVoted,
}: CitizenPollCardProps) {
  const { showToast } = useToast();
  const questions = getEffectivePollQuestions(poll);
  const totalResponses = getPollTotalResponses(poll);
  const today = getTodayIso();

  const notOpenedYet = Boolean(poll.opensAt && poll.opensAt > today);
  const expiredByDate = Boolean(poll.closesAt && poll.closesAt < today);
  const isClosed = poll.status !== 'abierta' || expiredByDate;
  const showResults = alreadyVoted || isClosed;

  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const toggleMulti = (qId: string, optId: string) => {
    setAnswers((prev) => {
      const current = Array.isArray(prev[qId]) ? prev[qId] : [];
      const next = current.includes(optId)
        ? current.filter((x) => x !== optId)
        : [...current, optId];
      return { ...prev, [qId]: next };
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    for (const q of questions) {
      if (!q.required) continue;
      const val = answers[q.id];
      const missing =
        q.type === 'multiple_choice'
          ? !Array.isArray(val) || val.length === 0
          : typeof val !== 'string' || val.trim().length === 0;
      if (missing) {
        showToast(`Responde la pregunta obligatoria: "${q.prompt}"`, 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      await submitCitizenPollResponse(poll.id, answers, honeypot);
      localStorage.setItem(`cmj_poll_${poll.id}`, '1');
      showToast(
        poll.thankYouMessage || 'Tu participación ha sido registrada. ¡Gracias por opinar!',
        'success',
      );
      await onVoted(poll.id);
    } catch (err) {
      showToast(toFriendlySpanishError(err, 'No fue posible registrar tu participación.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const statusText = notOpenedYet
    ? `Abre el ${poll.opensAt}`
    : isClosed
      ? 'Consulta cerrada'
      : 'Consulta abierta';

  return (
    <div id={`encuesta-${poll.id}`}>
      <Card
        className={highlighted ? 'ring-2 ring-[#7B1832] dark:ring-[#D9B245]' : undefined}
      >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-2 font-medium">
          <span
            className={
              poll.status === 'abierta' && !isClosed && !notOpenedYet
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-stone-600 dark:text-slate-400'
            }
          >
            {statusText}
          </span>
          <span aria-hidden="true">·</span>
          <span>{poll.audience === 'consejeros' ? 'Solo consejeros' : 'Juventud de Flandes'}</span>
          <span aria-hidden="true">·</span>
          <span>{poll.anonymity === 'identificada' ? 'Identificada' : 'Anónima'}</span>
        </div>
        <span className="font-mono-tabular">{totalResponses} participaciones</span>
      </div>

      <h2 className="mt-2 font-display text-xl font-semibold text-stone-950 dark:text-white">
        {poll.title}
      </h2>
      <p className="mt-1 text-sm text-stone-600 dark:text-slate-300">{poll.description}</p>

      {alreadyVoted && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{poll.thankYouMessage || 'Tu participación quedó registrada. Aquí ves el resultado consolidado.'}</span>
        </div>
      )}

      {notOpenedYet ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-stone-200 p-3 text-xs text-stone-600 dark:border-slate-800 dark:text-slate-300">
          <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Esta consulta estará habilitada a partir del {poll.opensAt}.</span>
        </div>
      ) : showResults ? (
        <PollResultsView questions={questions} />
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-5">
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            className="sr-only"
          />
          {questions.map((q, idx) => (
            <fieldset
              key={q.id}
              className="space-y-2.5 border-t border-stone-200/80 pt-3.5 first:border-t-0 first:pt-0 dark:border-slate-800"
            >
              <legend className="text-sm font-semibold text-stone-900 dark:text-slate-100">
                {questions.length > 1 ? `${idx + 1}. ` : ''}
                {q.prompt}
                {q.required && <span className="ml-1 text-[#7B1832] dark:text-[#D9B245]">*</span>}
              </legend>

              {q.type === 'short_text' ? (
                <Input
                  label="Tu respuesta"
                  maxLength={280}
                  value={typeof answers[q.id] === 'string' ? (answers[q.id] as string) : ''}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Escribe brevemente tu opinión o propuesta…"
                />
              ) : q.type === 'scale_1_5' ? (
                <div className="grid grid-cols-5 gap-2">
                  {q.options.map((opt) => {
                    const selected = answers[q.id] === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                        className={`min-h-[42px] rounded-xl border text-xs font-semibold transition-colors ${
                          selected
                            ? 'border-[#7B1832] bg-[#7B1832] text-white dark:border-[#D9B245] dark:bg-[#D9B245] dark:text-slate-950'
                            : 'border-stone-300 bg-white text-stone-800 hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {q.options.map((opt) => {
                    const isMulti = q.type === 'multiple_choice';
                    const selected = isMulti
                      ? Array.isArray(answers[q.id]) && answers[q.id].includes(opt.id)
                      : answers[q.id] === opt.id;
                    return (
                      <label
                        key={opt.id}
                        className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2 text-sm transition-colors ${
                          selected
                            ? 'border-[#7B1832] bg-[#FAF3F5] text-stone-950 dark:border-[#D9B245] dark:bg-[#7B1832]/20 dark:text-white'
                            : 'border-stone-200 bg-white text-stone-800 hover:bg-stone-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200'
                        }`}
                      >
                        <input
                          type={isMulti ? 'checkbox' : 'radio'}
                          name={`poll_${poll.id}_${q.id}`}
                          checked={selected}
                          onChange={() =>
                            isMulti
                              ? toggleMulti(q.id, opt.id)
                              : setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))
                          }
                          className="h-4 w-4 accent-[#7B1832]"
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </fieldset>
          ))}

          <Button type="submit" loading={submitting}>
            <Vote className="h-4 w-4" aria-hidden="true" />
            <span>Enviar participación</span>
          </Button>
        </form>
      )}
      </Card>
    </div>
  );
}

function PollResultsView({ questions }: { questions: PollQuestion[] }) {
  return (
    <div className="mt-4 space-y-4">
      {questions.map((q, idx) => {
        const total = q.options.reduce((acc, o) => acc + (o.votes || 0), 0);
        return (
          <div key={q.id} className="space-y-2">
            {questions.length > 1 && (
              <p className="text-sm font-semibold text-stone-900 dark:text-slate-100">
                {idx + 1}. {q.prompt}
              </p>
            )}
            {q.type === 'short_text' ? (
              <p className="text-xs text-stone-500 dark:text-slate-400">
                {(q.textResponses || []).length} respuesta(s) abiertas registradas para análisis de la Mesa Directiva.
              </p>
            ) : (
              <div className="space-y-2">
                {q.options.map((opt) => {
                  const pct = total > 0 ? Math.round(((opt.votes || 0) / total) * 100) : 0;
                  return (
                    <div
                      key={opt.id}
                      className="rounded-xl border border-stone-200 p-3 dark:border-slate-800"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-stone-900 dark:text-slate-100">
                          {opt.label}
                        </span>
                        <span className="font-mono-tabular text-xs font-semibold text-[#7B1832] dark:text-[#D9B245]">
                          {pct}% ({opt.votes || 0})
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-slate-800">
                        <div
                          className="h-full bg-[#7B1832] dark:bg-[#D9B245]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
