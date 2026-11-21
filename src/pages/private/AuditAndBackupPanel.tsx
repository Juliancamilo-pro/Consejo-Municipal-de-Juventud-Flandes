import { useEffect, useMemo, useState } from 'react';
import { Download, Shield } from 'lucide-react';
import { fetchServerSecurityEvents, ServerSecurityEvent } from '../../services/sessionApi';
import {
  AttendanceRecord,
  AuditLogEntry,
  CalendarEventItem,
  Commission,
  CommitmentItem,
  ElectionItem,
  InstitutionalDocument,
  JustificationRecord,
  MailboxEntry,
  NewsItem,
  PlenarySession,
  ProjectItem,
  UserProfile,
} from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { DataTable, TableColumn } from '../../components/ui/Table';
import { useToast } from '../../components/ui/Toast';

export interface FullBackupPayload {
  users: UserProfile[];
  commissions: Commission[];
  news: NewsItem[];
  projects: ProjectItem[];
  documents: InstitutionalDocument[];
  sessions: PlenarySession[];
  attendance: AttendanceRecord[];
  justifications: JustificationRecord[];
  elections: ElectionItem[];
  commitments: CommitmentItem[];
  events: CalendarEventItem[];
  mailbox: MailboxEntry[];
  auditLogs: AuditLogEntry[];
}

interface AuditAndBackupPanelProps {
  actor: UserProfile;
  auditLogs: AuditLogEntry[];
  backupData: FullBackupPayload;
}

export function AuditAndBackupPanel({ actor, auditLogs, backupData }: AuditAndBackupPanelProps) {
  const { showToast } = useToast();
  const isSecretaryAdmin = actor.role === 'secretario_admin';
  const [serverEvents, setServerEvents] = useState<ServerSecurityEvent[]>([]);

  useEffect(() => {
    void fetchServerSecurityEvents().then(setServerEvents);
  }, [auditLogs.length]);

  const combinedLogs = useMemo<AuditLogEntry[]>(() => {
    const mappedServer: AuditLogEntry[] = serverEvents.map((ev) => ({
      id: ev.id,
      actorUid: ev.actorUid,
      actorEmail: ev.actorEmail,
      actorRole: ev.actorRole,
      action: ev.action,
      targetCollection: ev.targetCollection,
      targetId: ev.targetId,
      summary: ev.summary,
      createdAt: ev.createdAtIso,
    }));
    const seenIds = new Set(auditLogs.map((l) => `${l.action}:${l.summary}`));
    const uniqueServer = mappedServer.filter((s) => !seenIds.has(`${s.action}:${s.summary}`));
    return [...uniqueServer, ...auditLogs];
  }, [auditLogs, serverEvents]);

  const handleDownloadJsonBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      exportedBy: actor.email,
      council: 'CMJ Flandes, Tolima (2026-2029)',
      collections: { ...backupData, auditLogs: combinedLogs },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cmj-flandes-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Respaldo JSON institucional descargado.', 'success');
  };

  const columns: TableColumn<AuditLogEntry>[] = [
    {
      key: 'action',
      header: 'Acción',
      sortValue: (l) => l.action,
      render: (l) => (
        <span className="font-mono-tabular font-semibold text-[#7B1832] dark:text-[#D9B245]">
          {l.action}
        </span>
      ),
    },
    {
      key: 'summary',
      header: 'Descripción',
      sortValue: (l) => l.summary,
      render: (l) => <span>{l.summary}</span>,
    },
    {
      key: 'actorEmail',
      header: 'Responsable / Origen',
      sortValue: (l) => l.actorEmail,
      render: (l) => (
        <span className="text-stone-500 dark:text-slate-400">
          {l.actorEmail} ({l.actorRole})
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {isSecretaryAdmin && (
        <Card className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#7B1832] uppercase dark:text-[#D9B245]">
              Continuidad institucional · Secretaría Técnica
            </p>
            <h2 className="mt-1 font-display text-lg font-semibold text-stone-950 dark:text-white">
              Respaldo integral en JSON
            </h2>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-slate-400">
              Descarga una copia estructurada de usuarios, sesiones, actas, proyectos, compromisos y bitácora.
            </p>
          </div>
          <Button onClick={handleDownloadJsonBackup}>
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Descargar respaldo JSON</span>
          </Button>
        </Card>
      )}

      {combinedLogs.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="Sin eventos de auditoría"
          description="Los inicios de sesión, intentos fallidos, bloqueos temporales y cambios institucionales quedarán registrados aquí."
        />
      ) : (
        <Card>
          <DataTable
            rows={combinedLogs}
            columns={columns}
            rowKey={(l) => l.id}
            searchPlaceholder="Filtrar por acción, correo o detalle..."
            searchableText={(l) => `${l.action} ${l.summary} ${l.actorEmail} ${l.actorRole}`}
            exportFileName="cmj-flandes-bitacora-auditoria"
          />
        </Card>
      )}
    </div>
  );
}
