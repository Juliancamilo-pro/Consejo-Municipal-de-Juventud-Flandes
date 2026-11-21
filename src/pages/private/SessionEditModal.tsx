import { FormEvent, useEffect, useState } from 'react';
import { updatePlenarySession } from '../../services/sessionsAttendanceService';
import { PlenarySession, UserProfile } from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';

interface SessionEditModalProps {
  session: PlenarySession | null;
  actor: UserProfile;
  onClose: () => void;
  onReload: () => Promise<void>;
}

export function SessionEditModal({ session, actor, onClose, onReload }: SessionEditModalProps) {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [sessionType, setSessionType] = useState<PlenarySession['sessionType']>('ordinaria');
  const [dateIso, setDateIso] = useState('');
  const [location, setLocation] = useState('');
  const [agenda, setAgenda] = useState('');
  const [visibility, setVisibility] = useState<PlenarySession['visibility']>('publico');
  const [status, setStatus] = useState<PlenarySession['status']>('programada');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!session) return;
    setTitle(session.title);
    setSessionType(session.sessionType);
    setDateIso(session.dateIso);
    setLocation(session.location);
    setAgenda(session.agenda);
    setVisibility(session.visibility);
    setStatus(session.status);
  }, [session]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!session) return;
    setSaving(true);
    try {
      await updatePlenarySession(actor, session.id, {
        title: title.trim(),
        sessionType,
        dateIso,
        location: location.trim(),
        agenda: agenda.trim(),
        visibility,
        status,
      });
      showToast('Sesión actualizada y reprogramada.', 'success');
      onClose();
      await onReload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo actualizar la sesión.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={Boolean(session)} onClose={onClose} title="Editar o reprogramar sesión">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Título de la sesión"
          required
          minLength={3}
          maxLength={180}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select
            label="Tipo"
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value as PlenarySession['sessionType'])}
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
            label="Estado"
            value={status}
            onChange={(e) => setStatus(e.target.value as PlenarySession['status'])}
          >
            <option value="programada">Programada</option>
            <option value="realizada">Realizada</option>
            <option value="borrador">Borrador</option>
            <option value="cancelada">Cancelada</option>
          </Select>
          <Select
            label="Visibilidad"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as PlenarySession['visibility'])}
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
          rows={4}
          value={agenda}
          onChange={(e) => setAgenda(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            Guardar cambios
          </Button>
        </div>
      </form>
    </Modal>
  );
}
