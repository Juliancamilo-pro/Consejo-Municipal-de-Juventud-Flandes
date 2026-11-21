import { FormEvent, useEffect, useState } from 'react';
import { saveCouncilInfo } from '../../services/privateUsersService';
import { fetchCouncilInfo } from '../../services/publicService';
import { UserProfile } from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input, Textarea } from '../../components/ui/Input';

interface DashboardCouncilInfoCardProps {
  profile: UserProfile;
}

export function DashboardCouncilInfoCard({ profile }: DashboardCouncilInfoCardProps) {
  const [mission, setMission] = useState('');
  const [vision, setVision] = useState('');
  const [address, setAddress] = useState('');
  const [emailPublic, setEmailPublic] = useState('');
  const [schedule, setSchedule] = useState('');
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoNotice, setInfoNotice] = useState<string | null>(null);

  useEffect(() => {
    void fetchCouncilInfo().then((info) => {
      if (info) {
        setMission(info.mission || '');
        setVision(info.vision || '');
        setAddress(info.address || '');
        setEmailPublic(info.emailPublic || '');
        setSchedule(info.schedule || '');
      }
    });
  }, []);

  const handleSaveCouncilInfo = async (e: FormEvent) => {
    e.preventDefault();
    setSavingInfo(true);
    setInfoNotice(null);
    try {
      await saveCouncilInfo(profile, {
        mission,
        vision,
        address,
        emailPublic,
        schedule,
      });
      setInfoNotice('Información institucional pública guardada.');
    } catch (err) {
      setInfoNotice(err instanceof Error ? err.message : 'Error al guardar.');
    } finally {
      setSavingInfo(false);
    }
  };

  return (
    <Card className="relative overflow-hidden xl:col-span-5">
      <div className="absolute inset-x-0 top-0 h-0.5 bg-[#1E3A8A]" />
      <p className="text-xs font-semibold tracking-wider text-[#1E3A8A] uppercase dark:text-[#60A5FA]">
        Configuración Pública · Mesa Directiva
      </p>
      <h2 className="mt-1 font-display text-xl font-semibold text-stone-950 dark:text-white">
        Misión, visión y contacto oficial
      </h2>
      <p className="mt-1 text-xs text-stone-500 dark:text-slate-400">
        Información visible para toda la ciudadanía de Flandes en el portal público.
      </p>
      <form onSubmit={handleSaveCouncilInfo} className="mt-5 space-y-4">
        <Textarea
          label="Misión institucional"
          required
          minLength={10}
          maxLength={2500}
          rows={3}
          value={mission}
          onChange={(e) => setMission(e.target.value)}
        />
        <Textarea
          label="Visión institucional (2026–2029)"
          required
          minLength={10}
          maxLength={2500}
          rows={3}
          value={vision}
          onChange={(e) => setVision(e.target.value)}
        />
        <Input
          label="Dirección física oficial"
          maxLength={240}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Correo público"
            type="email"
            maxLength={160}
            value={emailPublic}
            onChange={(e) => setEmailPublic(e.target.value)}
          />
          <Input
            label="Horario de atención"
            maxLength={240}
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
          />
        </div>
        {infoNotice && (
          <p className="text-xs font-medium text-[#1E3A8A] dark:text-[#93C5FD]">{infoNotice}</p>
        )}
        <Button type="submit" variant="secondary" loading={savingInfo}>
          Publicar información del Consejo
        </Button>
      </form>
    </Card>
  );
}
