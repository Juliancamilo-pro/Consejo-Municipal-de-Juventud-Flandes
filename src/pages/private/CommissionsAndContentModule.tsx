import { useState } from 'react';
import {
  AuditLogEntry,
  CalendarEventItem,
  Commission,
  CommitmentItem,
  InstitutionalDocument,
  NewsItem,
  PlenarySession,
  ProjectItem,
  UserProfile,
} from '../../types/models';
import { Tabs } from '../../components/ui/Tabs';
import { CommissionsPanel } from './CommissionsPanel';
import { NewsContentPanel } from './NewsContentPanel';
import { ProjectsPanel } from './ProjectsPanel';

interface CommissionsAndContentModuleProps {
  actor: UserProfile;
  users: UserProfile[];
  commissions: Commission[];
  news: NewsItem[];
  projects: ProjectItem[];
  documents: InstitutionalDocument[];
  sessions: PlenarySession[];
  commitments: CommitmentItem[];
  events: CalendarEventItem[];
  auditLogs: AuditLogEntry[];
  onReload: () => Promise<void>;
}

type SubTab = 'comisiones' | 'contenidos' | 'proyectos';

export function CommissionsAndContentModule({
  actor,
  users,
  commissions,
  news,
  projects,
  documents,
  sessions,
  commitments,
  events,
  auditLogs,
  onReload,
}: CommissionsAndContentModuleProps) {
  const isBoard = ['secretario_admin', 'presidente', 'vicepresidente'].includes(actor.role);
  const isLeaderOrBoard = isBoard || actor.role === 'lider_comision';

  const [tab, setTab] = useState<SubTab>('comisiones');

  return (
    <div className="space-y-6">
      <Tabs
        ariaLabel="Submódulos de comisiones y contenidos"
        activeId={tab}
        onChange={setTab}
        options={[
          { id: 'comisiones', label: 'Comisiones' },
          { id: 'contenidos', label: 'Noticias y Galería' },
          { id: 'proyectos', label: 'Proyectos' },
        ]}
      />

      {tab === 'comisiones' && (
        <CommissionsPanel
          actor={actor}
          isBoard={isBoard}
          users={users}
          commissions={commissions}
          documents={documents}
          sessions={sessions}
          commitments={commitments}
          projects={projects}
          events={events}
          auditLogs={auditLogs}
          onReload={onReload}
        />
      )}

      {tab === 'contenidos' && (
        <NewsContentPanel
          actor={actor}
          isBoard={isBoard}
          news={news}
          onReload={onReload}
        />
      )}

      {tab === 'proyectos' && (
        <ProjectsPanel
          actor={actor}
          isLeaderOrBoard={isLeaderOrBoard}
          projects={projects}
          commissions={commissions}
          documents={documents}
          onReload={onReload}
        />
      )}
    </div>
  );
}
