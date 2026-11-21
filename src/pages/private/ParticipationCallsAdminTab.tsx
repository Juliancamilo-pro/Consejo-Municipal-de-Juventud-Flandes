import { FormEvent, useState } from 'react';
import { Megaphone, Plus, Trash2 } from 'lucide-react';
import { createPublicCall, updateCallStatus } from '../../services/participationPublicService';
import { UserProfile } from '../../types/models';
import { CallExtraField, CallRegistration, PublicCall } from '../../types/participation';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';
export { CallRegistrationsTable } from './CallRegistrationsTable';

export function ParticipationCallsAdminTab({
  actor,
  calls,
  registrations = [],
  onReload,
}: {
  actor: UserProfile;
  calls: PublicCall[];
  registrations?: CallRegistration[];
  onReload: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [callTitle, setCallTitle] = useState('');
  const [callCategory, setCallCategory] = useState<PublicCall['category']>('convocatoria');
  const [callSummary, setCallSummary] = useState('');
  const [callDateIso, setCallDateIso] = useState('');
  const [callLocation, setCallLocation] = useState('');
  const [callCapacity, setCallCapacity] = useState('');
  const [extraFields, setExtraFields] = useState<CallExtraField[]>([]);
  const [busy, setBusy] = useState(false);

  const addExtraField = () => {
    setExtraFields((prev) => [
      ...prev,
      { id: `campo_${prev.length + 1}`, label: '', required: false },
    ]);
  };

  const handleCreateCall = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const cleanedFields = extraFields
        .map((f) => ({ ...f, label: f.label.trim() }))
        .filter((f) => f.label.length >= 2);

      await createPublicCall(actor, {
        title: callTitle,
        category: callCategory,
        summary: callSummary,
        eventDateIso: callDateIso,
        location: callLocation,
        ...(callCapacity ? { capacity: Number(callCapacity) } : {}),
        ...(cleanedFields.length ? { extraFields: cleanedFields } : {}),
      });
      setCallTitle('');
      setCallSummary('');
      setCallDateIso('');
      setCallLocation('');
      setCallCapacity('');
      setExtraFields([]);
      showToast('Convocatoria abierta para inscripción juvenil.', 'success');
      await onReload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo abrir la convocatoria.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
          Abrir convocatoria o inscripción a evento juvenil
        </h2>
        <form onSubmit={handleCreateCall} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Título de la convocatoria"
              required
              minLength={4}
              maxLength={180}
              value={callTitle}
              onChange={(e) => setCallTitle(e.target.value)}
            />
            <Select
              label="Categoría"
              value={callCategory}
              onChange={(e) => setCallCategory(e.target.value as PublicCall['category'])}
            >
              <option value="convocatoria">Convocatoria</option>
              <option value="cabildo">Cabildo / Asamblea</option>
              <option value="taller">Taller formativo</option>
              <option value="evento">Evento territorial</option>
            </Select>
            <Input
              label="Fecha y hora"
              required
              placeholder="Ej. 2026-06-15 · 3:00 p. m."
              value={callDateIso}
              onChange={(e) => setCallDateIso(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Lugar en Flandes"
              required
              value={callLocation}
              onChange={(e) => setCallLocation(e.target.value)}
            />
            <Input
              label="Cupo máximo (opcional)"
              type="number"
              min={1}
              max={5000}
              value={callCapacity}
              onChange={(e) => setCallCapacity(e.target.value)}
            />
          </div>
          <Textarea
            label="Descripción y requisitos"
            required
            rows={3}
            maxLength={1000}
            value={callSummary}
            onChange={(e) => setCallSummary(e.target.value)}
          />

          <div className="space-y-2 rounded-xl border border-stone-200 bg-[#FAF8F4] p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-stone-800 dark:text-slate-200">
                Campos adicionales del formulario de inscripción ({extraFields.length})
              </span>
              <Button type="button" size="sm" variant="outline" onClick={addExtraField}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Agregar pregunta</span>
              </Button>
            </div>
            {extraFields.map((field, idx) => (
              <div key={field.id} className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={field.label}
                  onChange={(e) =>
                    setExtraFields((prev) =>
                      prev.map((f, i) => (i === idx ? { ...f, label: e.target.value } : f)),
                    )
                  }
                  placeholder="Ej. Institución educativa u organización"
                  className="min-h-[38px] flex-1 rounded-lg border border-stone-300 bg-white px-3 text-xs dark:border-slate-700 dark:bg-slate-900"
                />
                <label className="inline-flex items-center gap-1.5 text-xs text-stone-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) =>
                      setExtraFields((prev) =>
                        prev.map((f, i) => (i === idx ? { ...f, required: e.target.checked } : f)),
                      )
                    }
                    className="h-4 w-4 accent-[#7B1832]"
                  />
                  <span>Obligatorio</span>
                </label>
                <button
                  type="button"
                  onClick={() => setExtraFields((prev) => prev.filter((_, i) => i !== idx))}
                  aria-label="Quitar campo adicional"
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-stone-200 text-red-700 dark:border-slate-700 dark:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>

          <Button type="submit" loading={busy}>
            Publicar convocatoria
          </Button>
        </form>
      </Card>

      {calls.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Sin convocatorias abiertas"
          description="Crea aquí cabildos, talleres o convocatorias para que jóvenes de 14 a 28 años se inscriban."
        />
      ) : (
        <div className="space-y-3">
          {calls.map((c) => {
            const count = registrations.filter((r) => r.callId === c.id).length;
            const isFull = typeof c.capacity === 'number' && count >= c.capacity;
            return (
              <Card key={c.id} padding="sm">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={c.status === 'abierta' && !isFull ? 'success' : isFull ? 'warning' : 'neutral'}>
                        {isFull ? 'CUPO LLENO' : c.status.toUpperCase()}
                      </Badge>
                      <span className="font-mono-tabular text-xs text-stone-500">
                        {count} inscrito(s){c.capacity ? ` / ${c.capacity} cupos` : ''}
                      </span>
                    </div>
                    <h3 className="mt-1 font-display text-base font-semibold text-stone-950 dark:text-white">
                      {c.title}
                    </h3>
                    <p className="text-xs text-stone-500">
                      {c.eventDateIso} · {c.location}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void updateCallStatus(
                          actor,
                          c.id,
                          c.status === 'abierta' ? 'cerrada' : 'abierta',
                        ).then(onReload)
                      }
                    >
                      {c.status === 'abierta' ? 'Cerrar inscripción' : 'Reabrir inscripción'}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
