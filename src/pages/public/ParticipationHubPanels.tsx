import { FormEvent, useEffect, useState } from 'react';
import { BarChart3, CalendarCheck, CheckCircle2 } from 'lucide-react';
import {
  fetchPublishedCalls,
  fetchPublishedPolls,
  submitPublicCallRegistration,
} from '../../services/participationPublicService';
import { PublicCall, PublicPoll } from '../../types/participation';
import { toFriendlySpanishError } from '../../utils/friendlyErrors';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { CitizenPollCard } from './CitizenPollCard';

export function CitizenPollsPanel() {
  const [polls, setPolls] = useState<PublicPoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [votedIds, setVotedIds] = useState<Record<string, boolean>>({});
  const targetPollId =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('encuesta') || ''
      : '';

  const load = async () => {
    setLoading(true);
    try {
      const list = await fetchPublishedPolls();
      setPolls(list);
      const localMarks: Record<string, boolean> = {};
      list.forEach((p) => {
        if (localStorage.getItem(`cmj_poll_${p.id}`)) localMarks[p.id] = true;
      });
      setVotedIds(localMarks);
    } catch {
      setPolls([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return <p className="text-sm text-stone-500 dark:text-slate-400">Cargando encuestas ciudadanas…</p>;
  }

  if (polls.length === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No hay encuestas ciudadanas activas"
        description="Cuando la Mesa Directiva publique consultas abiertas para la juventud de Flandes aparecerán aquí con resultados en tiempo real."
      />
    );
  }

  return (
    <div className="space-y-5">
      {polls.map((poll) => (
        <CitizenPollCard
          key={poll.id}
          poll={poll}
          alreadyVoted={Boolean(votedIds[poll.id])}
          highlighted={Boolean(targetPollId && poll.id === targetPollId)}
          onVoted={async (id) => {
            setVotedIds((prev) => ({ ...prev, [id]: true }));
            await load();
          }}
        />
      ))}
    </div>
  );
}

export function CitizenCallsPanel() {
  const { showToast } = useToast();
  const [calls, setCalls] = useState<PublicCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<PublicCall | null>(null);
  const [fullName, setFullName] = useState('');
  const [age, setAge] = useState('18');
  const [neighborhood, setNeighborhood] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [extraAnswers, setExtraAnswers] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void fetchPublishedCalls()
      .then(setCalls)
      .catch(() => setCalls([]))
      .finally(() => setLoading(false));
  }, []);

  const openModalForCall = (call: PublicCall) => {
    setSelectedCall(call);
    setExtraAnswers({});
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCall) return;
    setSubmitting(true);
    try {
      const result = await submitPublicCallRegistration({
        callId: selectedCall.id,
        callTitle: selectedCall.title,
        fullName,
        age: Number(age),
        neighborhood,
        email,
        phone,
        notes,
        ...(Object.keys(extraAnswers).length > 0 ? { extraAnswers } : {}),
        honeypot,
      });
      showToast(
        result.emailDelivered
          ? 'Inscripción registrada. Te enviamos confirmación al correo.'
          : 'Inscripción registrada con éxito.',
        'success',
      );
      setSelectedCall(null);
      setFullName('');
      setNeighborhood('');
      setEmail('');
      setPhone('');
      setNotes('');
      setExtraAnswers({});
    } catch (err) {
      showToast(toFriendlySpanishError(err, 'No fue posible inscribirte.'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-stone-500 dark:text-slate-400">Cargando convocatorias…</p>;
  }

  if (calls.length === 0) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="Sin convocatorias abiertas actualmente"
        description="Los talleres, cabildos juveniles y convocatorias públicas con inscripción aparecerán aquí."
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {calls.map((c) => (
          <Card key={c.id} className="flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 text-xs text-stone-500 dark:text-slate-400">
                <span className="font-medium capitalize text-[#7B1832] dark:text-[#D9B245]">
                  {c.category}
                  {c.capacity ? ` · ${c.capacity} cupos` : ''}
                </span>
                <span className="font-mono-tabular">{c.eventDateIso}</span>
              </div>
              <h2 className="mt-2 font-display text-lg font-semibold text-stone-950 dark:text-white">
                {c.title}
              </h2>
              <p className="mt-1 text-xs font-medium text-[#1E3A8A] dark:text-[#60A5FA]">
                Lugar: {c.location}
              </p>
              <p className="mt-2 text-sm text-stone-600 dark:text-slate-300">{c.summary}</p>
            </div>
            <div className="mt-4 pt-2">
              {c.status === 'abierta' ? (
                <Button size="sm" onClick={() => openModalForCall(c)}>
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Inscribirme</span>
                </Button>
              ) : (
                <span className="text-xs text-stone-500">Inscripciones cerradas</span>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={Boolean(selectedCall)}
        onClose={() => setSelectedCall(null)}
        title={`Inscripción: ${selectedCall?.title || ''}`}
      >
        <form onSubmit={handleRegister} className="space-y-3.5">
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            className="sr-only"
          />
          <Input
            label="Nombre completo"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Edad"
              type="number"
              min={10}
              max={99}
              required
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
            <Input
              label="Barrio o vereda (Flandes)"
              required
              value={neighborhood}
              onChange={(e) => setNeighborhood(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Correo electrónico"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Celular / WhatsApp (opcional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          {selectedCall?.extraFields?.map((field) => (
            <Input
              key={field.id}
              label={field.label}
              required={field.required}
              maxLength={240}
              value={extraAnswers[field.label] || ''}
              onChange={(e) =>
                setExtraAnswers((prev) => ({ ...prev, [field.label]: e.target.value }))
              }
            />
          ))}
          <Textarea
            label="Expectativas o comentarios (opcional)"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <Button type="submit" loading={submitting} className="w-full">
            Confirmar inscripción
          </Button>
        </form>
      </Modal>
    </>
  );
}
