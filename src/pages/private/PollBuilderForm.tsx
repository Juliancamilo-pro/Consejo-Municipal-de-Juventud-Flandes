import { FormEvent, useState } from 'react';
import { Eye, Plus, Sparkles, Trash2 } from 'lucide-react';
import {
  buildDefaultOptionsForType,
  POLL_TEMPLATES,
} from '../../data/pollTemplates';
import { createPublicPoll } from '../../services/participationPublicService';
import { UserProfile } from '../../types/models';
import { PollQuestion, PollQuestionType } from '../../types/participation';
import { toFriendlySpanishError } from '../../utils/friendlyErrors';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';

interface PollBuilderFormProps {
  actor: UserProfile;
  onCreated: () => Promise<void>;
}

export function PollBuilderForm({ actor, onCreated }: PollBuilderFormProps) {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState<'publica' | 'consejeros'>('publica');
  const [anonymity, setAnonymity] = useState<'anonima' | 'identificada'>('anonima');
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');
  const [thankYouMessage, setThankYouMessage] = useState(
    '¡Gracias por participar! Tu aporte fortalece la voz juvenil de Flandes.',
  );
  const [questions, setQuestions] = useState<PollQuestion[]>([
    {
      id: 'q_1',
      prompt: '',
      type: 'single_choice',
      required: true,
      options: buildDefaultOptionsForType('single_choice'),
    },
  ]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const applyTemplate = (templateId: string) => {
    const tpl = POLL_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setTitle(tpl.title);
    setDescription(tpl.description);
    setQuestions(tpl.questions.map((q) => ({ ...q, options: q.options.map((o) => ({ ...o })) })));
  };

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: `q_${prev.length + 1}_${Date.now().toString(36).slice(-3)}`,
        prompt: '',
        type: 'single_choice',
        required: true,
        options: buildDefaultOptionsForType('single_choice'),
      },
    ]);
  };

  const updateQuestion = (idx: number, patch: Partial<PollQuestion>) => {
    setQuestions((prev) => prev.map((q, i) => (i === idx ? { ...q, ...patch } : q)));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const cleanedQuestions = questions.map((q, idx) => ({
      ...q,
      prompt: q.prompt.trim() || `${title.trim()} (${idx + 1})`,
      options: q.options.filter((o) => o.label.trim().length > 0),
    }));

    const hasValid = cleanedQuestions.every(
      (q) => q.type === 'short_text' || q.options.length >= 2,
    );
    if (!hasValid) {
      showToast('Cada pregunta de selección debe tener al menos 2 opciones.', 'error');
      return;
    }

    setBusy(true);
    try {
      await createPublicPoll(actor, {
        title,
        description,
        options: cleanedQuestions[0].options.map((o) => o.label),
        questions: cleanedQuestions,
        audience,
        anonymity,
        opensAt,
        closesAt,
        thankYouMessage,
        status: 'abierta',
      });
      setTitle('');
      setDescription('');
      setOpensAt('');
      setClosesAt('');
      setQuestions([
        {
          id: 'q_1',
          prompt: '',
          type: 'single_choice',
          required: true,
          options: buildDefaultOptionsForType('single_choice'),
        },
      ]);
      showToast('Encuesta publicada correctamente en Participación.', 'success');
      await onCreated();
    } catch (err) {
      showToast(toFriendlySpanishError(err, 'No se pudo crear la encuesta.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
            Constructor de encuestas y consultas ciudadanas
          </h2>
          <p className="text-xs text-stone-500 dark:text-slate-400">
            Múltiples preguntas, escalas 1–5, selección múltiple, respuestas cortas y control de voto único en servidor.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Cargar plantilla de encuesta"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) applyTemplate(e.target.value);
              e.target.value = '';
            }}
            className="min-h-[36px] rounded-lg border border-stone-300 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Usar plantilla…</option>
            {POLL_TEMPLATES.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>{tpl.label}</option>
            ))}
          </select>
          <Button type="button" size="sm" variant="outline" onClick={() => setPreviewOpen((v) => !v)}>
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{previewOpen ? 'Ocultar vista previa' : 'Vista previa'}</span>
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <Input label="Título de la encuesta" required minLength={4} maxLength={180} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <Select label="Audiencia" value={audience} onChange={(e) => setAudience(e.target.value as 'publica' | 'consejeros')}>
            <option value="publica">Pública (toda la juventud)</option>
            <option value="consejeros">Solo consejeros internos</option>
          </Select>
          <Select label="Participación" value={anonymity} onChange={(e) => setAnonymity(e.target.value as 'anonima' | 'identificada')}>
            <option value="anonima">Anónima (con huella única)</option>
            <option value="identificada">Identificada</option>
          </Select>
        </div>

        <Textarea label="Descripción y contexto ciudadano" required rows={2} maxLength={600} value={description} onChange={(e) => setDescription(e.target.value)} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Apertura programada (opcional)" type="date" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
          <Input label="Fecha de cierre (opcional)" type="date" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
          <Input label="Mensaje de agradecimiento" value={thankYouMessage} maxLength={240} onChange={(e) => setThankYouMessage(e.target.value)} />
        </div>

        <div className="space-y-3 border-t border-stone-200 pt-4 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold tracking-wider text-[#7B1832] uppercase dark:text-[#D9B245]">
              Preguntas ({questions.length})
            </h3>
            <Button type="button" size="sm" variant="outline" onClick={addQuestion}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Agregar pregunta</span>
            </Button>
          </div>

          {questions.map((q, idx) => (
            <div key={q.id} className="space-y-3 rounded-xl border border-stone-200 bg-[#FAF8F4] p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                <div className="sm:col-span-6">
                  <Input
                    label={`Pregunta ${idx + 1}`}
                    required
                    value={q.prompt}
                    onChange={(e) => updateQuestion(idx, { prompt: e.target.value })}
                    placeholder="Ej. ¿Qué proyecto cultural te gustaría priorizar?"
                  />
                </div>
                <div className="sm:col-span-4">
                  <Select
                    label="Tipo de respuesta"
                    value={q.type}
                    onChange={(e) => {
                      const nextType = e.target.value as PollQuestionType;
                      updateQuestion(idx, { type: nextType, options: buildDefaultOptionsForType(nextType) });
                    }}
                  >
                    <option value="single_choice">Opción única</option>
                    <option value="multiple_choice">Selección múltiple</option>
                    <option value="scale_1_5">Escala 1 a 5</option>
                    <option value="yes_no">Sí / No</option>
                    <option value="short_text">Texto corto</option>
                  </Select>
                </div>
                <div className="flex items-end justify-between gap-2 sm:col-span-2">
                  <label className="inline-flex items-center gap-1.5 text-xs text-stone-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={(e) => updateQuestion(idx, { required: e.target.checked })}
                      className="h-4 w-4 accent-[#7B1832]"
                    />
                    <span>Oblig.</span>
                  </label>
                  {questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label={`Eliminar pregunta ${idx + 1}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded border border-stone-200 text-red-700 hover:bg-red-50 dark:border-slate-700 dark:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
                <Textarea
                  label="Opciones (una por línea)"
                  rows={2}
                  value={q.options.map((o) => o.label).join('\n')}
                  onChange={(e) =>
                    updateQuestion(idx, {
                      options: e.target.value.split('\n').map((lbl, oIdx) => ({
                        id: `opt_${oIdx + 1}`,
                        label: lbl,
                        votes: 0,
                      })),
                    })
                  }
                />
              )}
            </div>
          ))}
        </div>

        {previewOpen && (
          <div className="rounded-xl border border-[#C59B27]/60 bg-[#FFFDF7] p-4 text-xs dark:bg-slate-900/70">
            <p className="inline-flex items-center gap-1 font-semibold text-[#7B1832] dark:text-[#D9B245]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Vista previa ciudadana: {title || 'Sin título'}
            </p>
            <p className="mt-1 text-stone-600 dark:text-slate-300">{description}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-4 text-stone-800 dark:text-slate-200">
              {questions.map((q) => (
                <li key={q.id}>
                  <span className="font-medium">{q.prompt || '(Pregunta sin texto)'}</span>{' '}
                  <span className="text-stone-500">({q.type})</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <Button type="submit" loading={busy}>
          Publicar encuesta ciudadana
        </Button>
      </form>
    </Card>
  );
}
