import { FormEvent, useState } from 'react';
import { createPlenarySession } from '../../services/sessionsAttendanceService';
import { UserProfile } from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';

export function SessionCreateCard({
  actor,
  onReload,
}: {
  actor: UserProfile;
  onReload: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [sessionType, setSessionType] = useState<'ordinaria' | 'extraordinaria' | 'comision'>('ordinaria');
  const [dateIso, setDateIso] = useState('');
  const [location, setLocation] = useState('');
  const [agenda, setAgenda] = useState('');
  const [visibility, setVisibility] = useState<'publico' | 'interno'>('publico');
  const [saving, setSaving] = useState(false);

  const handleCreateSession = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createPlenarySession(actor, {
        title,
        sessionType,
        dateIso,
        location,
        agenda,
        status: 'programada',
        visibility,
      });
      setTitle('');
      setDateIso('');
      setLocation('');
      setAgenda('');
      showToast('Sesión programada correctamente.', 'success');
      await onReload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <h2 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
        Convocar nueva sesión
      </h2>
      <form onSubmit={handleCreateSession} className="mt-4 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Título de la sesión"
            required
            minLength={3}
            maxLength={180}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Select
            label="Tipo"
            value={sessionType}
            onChange={(e) =>
              setSessionType(e.target.value as 'ordinaria' | 'extraordinaria' | 'comision')
            }
          >
            <option value="ordinaria">Ordinaria</option>
            <option value="extraordinaria">Extraordinaria</option>
            <option value="comision">De comisión</option>
          </Select>
          <Input
            label="Fecha y hora"
            type="datetime-local"
            required
            value={dateIso}
            onChange={(e) => setDateIso(e.target.value)}
          />
          <Select
            label="Visibilidad"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as 'publico' | 'interno')}
          >
            <option value="publico">Pública</option>
            <option value="interno">Interna</option>
          </Select>
        </div>
        <Input
          label="Lugar o enlace de reunión"
          required
          minLength={2}
          maxLength={180}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <Textarea
          label="Orden del día"
          required
          minLength={3}
          maxLength={5000}
          rows={3}
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
        />
        <Button type="submit" loading={saving}>
          Programar sesión
        </Button>
      </form>
    </Card>
  );
}
