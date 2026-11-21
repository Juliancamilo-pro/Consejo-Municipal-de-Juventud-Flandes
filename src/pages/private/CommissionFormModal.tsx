import { FormEvent, useEffect, useState, ChangeEvent } from 'react';
import { saveCommission } from '../../services/commissionsService';
import { uploadFileToFirebaseStorage } from '../../services/storageService';
import { Commission, CommissionIconName, UserProfile } from '../../types/models';
import { slugifyCommissionName } from '../../utils/commissionUtils';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { CommissionStylePickers } from './CommissionStylePickers';

interface CommissionFormModalProps {
  open: boolean;
  actor: UserProfile;
  isBoard: boolean;
  users: UserProfile[];
  initial?: Commission | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

export function CommissionFormModal({
  open,
  actor,
  isBoard,
  users,
  initial,
  onClose,
  onSaved,
}: CommissionFormModalProps) {
  const activeUsers = users.filter((u) => u.status === 'activo');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mission, setMission] = useState('');
  const [objectivesText, setObjectivesText] = useState('');
  const [workLinesText, setWorkLinesText] = useState('');
  const [meetingPlace, setMeetingPlace] = useState('');
  const [meetingSchedule, setMeetingSchedule] = useState('');
  const [accentColor, setAccentColor] = useState('#7B1832');
  const [iconName, setIconName] = useState<CommissionIconName>('Building2');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [leaderUid, setLeaderUid] = useState('');
  const [secretaryUid, setSecretaryUid] = useState('');
  const [status, setStatus] = useState<'activa' | 'inactiva' | 'archivada'>('activa');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    setName(initial?.name || '');
    setDescription(initial?.description || '');
    setMission(initial?.mission || '');
    setObjectivesText((initial?.objectives || []).join('\n'));
    setWorkLinesText((initial?.workLines || []).join('\n'));
    setMeetingPlace(initial?.meetingPlace || '');
    setMeetingSchedule(initial?.meetingSchedule || '');
    setAccentColor(initial?.accentColor || '#7B1832');
    setIconName(initial?.iconName || 'Building2');
    setCoverImageUrl(initial?.coverImageUrl || '');
    setLeaderUid(initial?.leaderUid || '');
    setSecretaryUid(initial?.secretaryUid || '');
    setStatus(initial?.status || 'activa');
  }, [open, initial]);

  const handleUploadCover = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    setErrorMsg(null);
    try {
      const uploaded = await uploadFileToFirebaseStorage(file, 'publico', 'commissions');
      if (uploaded.downloadUrl) {
        setCoverImageUrl(uploaded.downloadUrl);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo subir la imagen de portada.');
    } finally {
      setUploadingCover(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      const leader = activeUsers.find((u) => u.uid === leaderUid);
      const secretary = activeUsers.find((u) => u.uid === secretaryUid);
      await saveCommission(actor, {
        id: initial?.id,
        name: isBoard || !initial ? name : initial.name,
        slug: initial?.slug || slugifyCommissionName(name, initial?.id),
        description,
        mission,
        objectives: objectivesText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        workLines: workLinesText
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        meetingPlace,
        meetingSchedule,
        accentColor,
        iconName,
        coverImageUrl,
        leaderUid: leader?.uid ?? initial?.leaderUid,
        leaderName: leader?.displayName ?? initial?.leaderName,
        secretaryUid: secretary?.uid,
        secretaryName: secretary?.displayName,
        members: initial?.members,
        memberUids: initial?.memberUids,
        goals: initial?.goals,
        status: isBoard ? status : initial?.status || 'activa',
      });
      await onSaved();
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo guardar la comisión.');
    } finally {
      setSaving(false);
    }
  };

  const slugPreview = slugifyCommissionName(name || 'comision', initial?.id);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? `Editar comisión: ${initial.name}` : 'Nueva comisión de trabajo'}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Nombre de la comisión"
            required
            disabled={Boolean(initial) && !isBoard}
            minLength={3}
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
            hint={`URL pública: /comisiones/${slugPreview}`}
          />
          {isBoard ? (
            <Select
              label="Estado de la comisión"
              value={status}
              onChange={(e) => setStatus(e.target.value as 'activa' | 'inactiva' | 'archivada')}
            >
              <option value="activa">Activa</option>
              <option value="inactiva">Inactiva</option>
              <option value="archivada">Archivada</option>
            </Select>
          ) : (
            <Input
              label="Estado"
              disabled
              value={status}
              hint="Solo Mesa Directiva cambia el estado."
            />
          )}
        </div>

        <Textarea
          label="Descripción corta y alcance"
          required
          minLength={5}
          maxLength={1000}
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <Textarea
          label="Misión de la comisión"
          maxLength={2000}
          rows={2}
          value={mission}
          onChange={(e) => setMission(e.target.value)}
          placeholder="Propósito principal de la comisión en el municipio de Flandes..."
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Textarea
            label="Objetivos estratégicos (uno por línea)"
            rows={4}
            value={objectivesText}
            onChange={(e) => setObjectivesText(e.target.value)}
            placeholder="Fortalecer redes juveniles rurales&#10;Gestionar espacios de formación"
          />
          <Textarea
            label="Líneas de trabajo (una por línea)"
            rows={4}
            value={workLinesText}
            onChange={(e) => setWorkLinesText(e.target.value)}
            placeholder="Cultura y deporte&#10;Participación estudiantil"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Lugar habitual de reunión"
            maxLength={200}
            value={meetingPlace}
            onChange={(e) => setMeetingPlace(e.target.value)}
            placeholder="Ej. Casa de la Cultura de Flandes"
          />
          <Input
            label="Horario habitual de reunión"
            maxLength={160}
            value={meetingSchedule}
            onChange={(e) => setMeetingSchedule(e.target.value)}
            placeholder="Ej. Miércoles cada 15 días, 4:00 p. m."
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Líder de comisión"
            disabled={Boolean(initial) && !isBoard}
            value={leaderUid}
            onChange={(e) => setLeaderUid(e.target.value)}
          >
            <option value="">Sin líder asignado</option>
            {activeUsers.map((u) => (
              <option key={u.uid} value={u.uid}>
                {u.displayName}
              </option>
            ))}
          </Select>

          <Select
            label="Secretario(a) de comisión"
            value={secretaryUid}
            onChange={(e) => setSecretaryUid(e.target.value)}
          >
            <option value="">Sin secretario(a) asignado</option>
            {activeUsers.map((u) => (
              <option key={u.uid} value={u.uid}>
                {u.displayName}
              </option>
            ))}
          </Select>
        </div>

        <CommissionStylePickers
          accentColor={accentColor}
          onChangeAccent={setAccentColor}
          iconName={iconName}
          onChangeIcon={setIconName}
          coverImageUrl={coverImageUrl}
          uploadingCover={uploadingCover}
          onUploadCover={handleUploadCover}
          onClearCover={() => setCoverImageUrl('')}
        />

        {errorMsg && (
          <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
            {errorMsg}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-stone-200 pt-4 dark:border-slate-800">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving || uploadingCover}>
            <span>{initial ? 'Guardar cambios' : 'Crear comisión'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
