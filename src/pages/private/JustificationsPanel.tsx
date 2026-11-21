import { FormEvent, useMemo, useState } from 'react';
import { FileWarning, LayoutGrid, List } from 'lucide-react';
import {
  reviewJustification,
  submitJustification,
} from '../../services/sessionsAttendanceService';
import { uploadFileToFirebaseStorage } from '../../services/storageService';
import { JustificationRecord, PlenarySession, UserProfile } from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { StatusText } from '../../components/ui/StatusText';
import { StorageDownloadButton } from '../../components/ui/StorageFileActions';
import { DataTable, TableColumn } from '../../components/ui/Table';
import { useToast } from '../../components/ui/Toast';

interface JustificationsPanelProps {
  actor: UserProfile;
  isBoard: boolean;
  sessions: PlenarySession[];
  justifications: JustificationRecord[];
  onReload: () => Promise<void>;
}

export function JustificationsPanel({
  actor,
  isBoard,
  sessions,
  justifications,
  onReload,
}: JustificationsPanelProps) {
  const { showToast } = useToast();
  const [justSessionId, setJustSessionId] = useState('');
  const [justReason, setJustReason] = useState('');
  const [justFile, setJustFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [confirmDecision, setConfirmDecision] = useState<{
    item: JustificationRecord;
    decision: 'aprobada' | 'rechazada';
  } | null>(null);
  const [deciding, setDeciding] = useState(false);

  const sessionMap = useMemo(() => new Map(sessions.map((s) => [s.id, s.title])), [sessions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return justifications.filter((j) => {
      if (statusFilter && j.reviewStatus !== statusFilter) return false;
      if (sessionFilter && j.sessionId !== sessionFilter) return false;
      if (!q) return true;
      return (
        j.userName.toLowerCase().includes(q) ||
        j.reason.toLowerCase().includes(q) ||
        (sessionMap.get(j.sessionId) || '').toLowerCase().includes(q)
      );
    });
  }, [justifications, statusFilter, sessionFilter, search, sessionMap]);

  const handleJustification = async (e: FormEvent) => {
    e.preventDefault();
    if (!justSessionId) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      let attachmentId: string | undefined;
      let attachmentName: string | undefined;
      let attachmentPath: string | undefined;
      if (justFile) {
        const up = await uploadFileToFirebaseStorage(justFile, 'interno', 'justifications');
        attachmentId = up.fileId;
        attachmentName = up.fileName;
        attachmentPath = up.storagePath;
      }
      await submitJustification(actor, {
        sessionId: justSessionId,
        reason: justReason,
        attachmentId,
        attachmentName,
        attachmentPath,
      });
      setJustReason('');
      setJustFile(null);
      showToast('Justificación radicada correctamente.', 'success');
      await onReload();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo enviar la justificación.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDecision = async () => {
    if (!confirmDecision) return;
    setDeciding(true);
    try {
      await reviewJustification(actor, confirmDecision.item.id, confirmDecision.decision);
      showToast(`Justificación ${confirmDecision.decision}.`, 'success');
      setConfirmDecision(null);
      await onReload();
    } finally {
      setDeciding(false);
    }
  };

  const columns: TableColumn<JustificationRecord>[] = [
    { key: 'userName', header: 'Consejero', sortValue: (j) => j.userName, render: (j) => <span className="font-semibold">{j.userName}</span> },
    { key: 'session', header: 'Sesión', sortValue: (j) => sessionMap.get(j.sessionId) || j.sessionId, render: (j) => <span>{sessionMap.get(j.sessionId) || j.sessionId}</span> },
    { key: 'reason', header: 'Motivo', exportValue: (j) => j.reason, render: (j) => <span className="line-clamp-2 max-w-xs">{j.reason}</span> },
    {
      key: 'reviewStatus',
      header: 'Estado',
      sortValue: (j) => j.reviewStatus,
      render: (j) => (
        <StatusText
          label={j.reviewStatus}
          tone={j.reviewStatus === 'aprobada' ? 'success' : j.reviewStatus === 'rechazada' ? 'danger' : 'warning'}
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
          Enviar justificación de inasistencia
        </h2>
        <form onSubmit={handleJustification} className="mt-4 space-y-4">
          <Select label="Sesión" required value={justSessionId} onChange={(e) => setJustSessionId(e.target.value)}>
            <option value="">Selecciona una sesión</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </Select>
          <Textarea label="Motivo de la inasistencia" required minLength={5} maxLength={2000} rows={3} value={justReason} onChange={(e) => setJustReason(e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-stone-800 dark:text-slate-200">
              Soporte protegido (PDF o imagen, opcional)
            </label>
            <input
              type="file"
              accept=".pdf,image/png,image/jpeg,image/webp"
              onChange={(e) => setJustFile(e.target.files?.[0] || null)}
              className="mt-1.5 block text-xs text-stone-600 dark:text-slate-300"
            />
          </div>
          {errorMsg && (
            <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-400">{errorMsg}</p>
          )}
          <Button type="submit" loading={saving} disabled={!justSessionId}>Radicar justificación</Button>
        </form>
      </Card>

      <Card padding="sm" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-stone-950 dark:text-white">
            Justificaciones ({filtered.length})
          </h3>
          <div className="flex gap-2">
            <Button size="sm" variant={viewMode === 'cards' ? 'primary' : 'outline'} onClick={() => setViewMode('cards')}>
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" /><span>Tarjetas</span>
            </Button>
            <Button size="sm" variant={viewMode === 'table' ? 'primary' : 'outline'} onClick={() => setViewMode('table')}>
              <List className="h-3.5 w-3.5" aria-hidden="true" /><span>Tabla y Exportar</span>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Buscar" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Consejero o motivo..." />
          <Select label="Estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="aprobada">Aprobadas</option>
            <option value="rechazada">Rechazadas</option>
          </Select>
          <Select label="Sesión" value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value)}>
            <option value="">Todas</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState icon={FileWarning} title="Sin justificaciones registradas" description="Las excusas presentadas por los consejeros aparecerán aquí para revisión." />
      ) : viewMode === 'table' ? (
        <Card>
          <DataTable rows={filtered} columns={columns} rowKey={(j) => j.id} exportFileName="cmj-flandes-justificaciones" exportTitle="Justificaciones de Inasistencia — CMJ Flandes" />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((j) => (
            <Card key={j.id} padding="sm">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-stone-900 dark:text-white">{j.userName}</span>
                    <span className="text-stone-400">·</span>
                    <span className="text-stone-500">{sessionMap.get(j.sessionId) || j.sessionId}</span>
                    <StatusText
                      label={j.reviewStatus}
                      tone={j.reviewStatus === 'aprobada' ? 'success' : j.reviewStatus === 'rechazada' ? 'danger' : 'warning'}
                    />
                  </div>
                  <p className="mt-1 text-sm text-stone-600 dark:text-slate-300">{j.reason}</p>
                  {(j.attachmentPath || j.attachmentId) && (
                    <div className="mt-2">
                      <StorageDownloadButton
                        compact
                        item={{ fileId: j.attachmentId, storagePath: j.attachmentPath, visibility: 'interno', fileName: j.attachmentName }}
                        label={`Anexo protegido (${j.attachmentName || 'soporte'})`}
                      />
                    </div>
                  )}
                </div>

                {isBoard && j.reviewStatus === 'pendiente' && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setConfirmDecision({ item: j, decision: 'aprobada' })}>Aprobar</Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmDecision({ item: j, decision: 'rechazada' })}>Rechazar</Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(confirmDecision)}
        destructive={confirmDecision?.decision === 'rechazada'}
        loading={deciding}
        title={confirmDecision?.decision === 'aprobada' ? '¿Aprobar justificación?' : '¿Rechazar justificación?'}
        description={`Se marcará como "${confirmDecision?.decision || ''}" la excusa presentada por ${confirmDecision?.item.userName || ''}.`}
        onConfirm={handleConfirmDecision}
        onCancel={() => setConfirmDecision(null)}
      />
    </div>
  );
}
