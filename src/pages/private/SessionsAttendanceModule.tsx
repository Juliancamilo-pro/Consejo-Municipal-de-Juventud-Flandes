import { useState } from 'react';
import {
  AttendanceRecord,
  ElectionItem,
  InstitutionalDocument,
  JustificationRecord,
  PlenarySession,
  UserProfile,
} from '../../types/models';
import { Tabs } from '../../components/ui/Tabs';
import { AttendancePanel } from './AttendancePanel';
import { JustificationsPanel } from './JustificationsPanel';
import { SessionsPanel } from './SessionsPanel';

interface SessionsAttendanceModuleProps {
  actor: UserProfile;
  users: UserProfile[];
  sessions: PlenarySession[];
  attendance: AttendanceRecord[];
  justifications: JustificationRecord[];
  documents?: InstitutionalDocument[];
  elections?: ElectionItem[];
  initialCheckinSessionId?: string | null;
  initialCheckinCode?: string | null;
  onReload: () => Promise<void>;
}

type SubTab = 'sesiones' | 'asistencia' | 'justificaciones';

export function SessionsAttendanceModule({
  actor,
  users,
  sessions,
  attendance,
  justifications,
  documents = [],
  elections = [],
  initialCheckinSessionId,
  initialCheckinCode,
  onReload,
}: SessionsAttendanceModuleProps) {
  const isBoard = ['secretario_admin', 'presidente', 'vicepresidente'].includes(actor.role);
  const [tab, setTab] = useState<SubTab>('sesiones');
  const activeUsers = users.filter((u) => u.status === 'activo');

  return (
    <div className="space-y-6">
      <Tabs
        ariaLabel="Secciones de sesiones y asistencia"
        activeId={tab}
        onChange={setTab}
        options={[
          { id: 'sesiones', label: 'Sesiones del pleno' },
          { id: 'asistencia', label: 'Asistencia y Reportes' },
          { id: 'justificaciones', label: 'Justificaciones' },
        ]}
      />

      {tab === 'sesiones' && (
        <SessionsPanel
          actor={actor}
          isBoard={isBoard}
          sessions={sessions}
          attendance={attendance}
          documents={documents}
          elections={elections}
          activeCounselorsCount={activeUsers.length}
          initialCheckinSessionId={initialCheckinSessionId}
          initialCheckinCode={initialCheckinCode}
          onReload={onReload}
        />
      )}

      {tab === 'asistencia' && (
        <AttendancePanel
          actor={actor}
          isBoard={isBoard}
          activeUsers={activeUsers}
          sessions={sessions}
          attendance={attendance}
          onReload={onReload}
        />
      )}

      {tab === 'justificaciones' && (
        <JustificationsPanel
          actor={actor}
          isBoard={isBoard}
          sessions={sessions}
          justifications={justifications}
          onReload={onReload}
        />
      )}
    </div>
  );
}
