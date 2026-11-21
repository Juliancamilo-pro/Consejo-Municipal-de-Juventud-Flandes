import { Calendar, Download, FileText, FolderKanban, History } from 'lucide-react';
import { resolveDocumentAccessUrl } from '../../services/storageService';
import {
  AuditLogEntry,
  CalendarEventItem,
  Commission,
  CommitmentItem,
  InstitutionalDocument,
  PlenarySession,
  ProjectItem,
  UserProfile,
} from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { CommitmentsKanban } from './CommitmentsKanban';

interface CommissionSecondaryTabsProps {
  tab: 'compromisos' | 'documentos' | 'sesiones' | 'proyectos' | 'actividad';
  actor: UserProfile;
  commission: Commission;
  canManage: boolean;
  documents: InstitutionalDocument[];
  sessions: PlenarySession[];
  commitments: CommitmentItem[];
  projects: ProjectItem[];
  events: CalendarEventItem[];
  auditLogs: AuditLogEntry[];
  onReload: () => Promise<void>;
}

export function CommissionSecondaryTabs({
  tab,
  actor,
  commission,
  canManage,
  documents,
  sessions,
  commitments,
  projects,
  events,
  auditLogs,
  onReload,
}: CommissionSecondaryTabsProps) {
  const { showToast } = useToast();

  const handleDownloadDoc = async (docItem: InstitutionalDocument) => {
    try {
      const url = await resolveDocumentAccessUrl(docItem, false);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo abrir el documento.', 'error');
    }
  };

  if (tab === 'compromisos') {
    return commitments.length === 0 ? (
      <EmptyState
        icon={FolderKanban}
        title="Sin compromisos vinculados"
        description="Los compromisos asignados a esta comisión aparecerán en este tablero."
      />
    ) : (
      <CommitmentsKanban
        actor={actor}
        isLeaderOrBoard={canManage}
        commitments={commitments}
        onReload={onReload}
      />
    );
  }

  if (tab === 'documentos') {
    return documents.length === 0 ? (
      <EmptyState
        icon={FileText}
        title="Sin documentos vinculados"
        description="Los documentos asignados a esta comisión en el repositorio aparecerán aquí."
      />
    ) : (
      <div className="space-y-2.5">
        {documents.map((d) => (
          <Card key={d.id} padding="sm" className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-stone-950 dark:text-white">{d.title}</p>
              <p className="text-xs text-stone-500 dark:text-slate-400">
                {d.category} · {d.status} · v{d.currentVersion}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => void handleDownloadDoc(d)}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Abrir</span>
            </Button>
          </Card>
        ))}
      </div>
    );
  }

  if (tab === 'sesiones') {
    return sessions.length === 0 && events.length === 0 ? (
      <EmptyState
        icon={Calendar}
        title="Sin sesiones o reuniones vinculadas"
        description="Las sesiones de comisión y eventos agendados con este nombre aparecerán aquí."
      />
    ) : (
      <div className="space-y-3">
        {sessions.map((s) => (
          <Card key={s.id} padding="sm">
            <p className="font-semibold text-stone-950 dark:text-white">{s.title}</p>
            <p className="text-xs text-stone-500 dark:text-slate-400">
              {s.dateIso} · {s.location} · {s.status}
            </p>
          </Card>
        ))}
        {events.map((ev) => (
          <Card key={ev.id} padding="sm">
            <p className="font-semibold text-stone-950 dark:text-white">{ev.title}</p>
            <p className="text-xs text-stone-500 dark:text-slate-400">
              {ev.startIso} · {ev.location}
            </p>
          </Card>
        ))}
      </div>
    );
  }

  if (tab === 'proyectos') {
    return projects.length === 0 ? (
      <EmptyState
        icon={FolderKanban}
        title="Sin proyectos asociados"
        description="Los proyectos juveniles vinculados a esta comisión se listarán aquí."
      />
    ) : (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {projects.map((p) => (
          <Card key={p.id}>
            <h4 className="font-display text-base font-semibold text-stone-950 dark:text-white">
              {p.title}
            </h4>
            <p className="mt-1 text-sm text-stone-600 dark:text-slate-300">{p.summary}</p>
            <p className="mt-2 font-mono-tabular text-xs font-semibold text-[#7B1832] dark:text-[#D9B245]">
              Avance: {p.progressPercent}% · {p.status}
            </p>
          </Card>
        ))}
      </div>
    );
  }

  return auditLogs.length === 0 ? (
    <EmptyState
      icon={History}
      title="Sin actividad reciente registrada"
      description={`Las acciones de auditoría sobre "${commission.name}" aparecerán aquí.`}
    />
  ) : (
    <div className="space-y-2">
      {auditLogs.slice(0, 20).map((log) => (
        <Card key={log.id} padding="sm">
          <p className="text-sm text-stone-900 dark:text-white">{log.summary}</p>
          <p className="text-xs text-stone-500 dark:text-slate-400">
            {log.actorEmail} · {log.action}
          </p>
        </Card>
      ))}
    </div>
  );
}
