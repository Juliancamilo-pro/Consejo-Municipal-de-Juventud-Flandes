import { useMemo, useState } from 'react';
import {
  Ban, BellRing, CalendarCheck, Edit3, FileDown, FilePlus2, FileText, LayoutGrid, List, Maximize2, QrCode,
} from 'lucide-react';
import { createInternalNotification } from '../../services/notificationsService';
import { cancelPlenarySession } from '../../services/sessionsAttendanceService';
import { AttendanceRecord, ElectionItem, InstitutionalDocument, PlenarySession, UserProfile } from '../../types/models';
import { exportSessionMinutesPdf } from '../../utils/pdfMinutesGenerator';
import { createDraftMinutesDocumentFromSession } from '../../utils/sessionActaHelper';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select } from '../../components/ui/Input';
import { StatusText } from '../../components/ui/StatusText';
import { StorageDownloadButton } from '../../components/ui/StorageFileActions';
import { DataTable, TableColumn } from '../../components/ui/Table';
import { useToast } from '../../components/ui/Toast';
import { SessionCreateCard } from './SessionCreateCard';
import { SessionEditModal } from './SessionEditModal';
import { SessionPresentationModal } from './SessionPresentationModal';
import { SessionQrCheckinModal } from './SessionQrCheckinModal';

interface SessionsPanelProps {
  actor: UserProfile;
  isBoard: boolean;
  sessions: PlenarySession[];
  attendance: AttendanceRecord[];
  documents?: InstitutionalDocument[];
  elections?: ElectionItem[];
  activeCounselorsCount: number;
  initialCheckinSessionId?: string | null;
  initialCheckinCode?: string | null;
  onReload: () => Promise<void>;
}

export function SessionsPanel({
  actor,
  isBoard,
  sessions,
  attendance,
  documents = [],
  elections = [],
  activeCounselorsCount,
  initialCheckinSessionId,
  initialCheckinCode,
  onReload,
}: SessionsPanelProps) {
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortBy, setSortBy] = useState<'date_desc' | 'date_asc' | 'title'>('date_desc');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const [presentationSession, setPresentationSession] = useState<PlenarySession | null>(null);
  const [editingSession, setEditingSession] = useState<PlenarySession | null>(null);
  const [cancelTarget, setCancelTarget] = useState<PlenarySession | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [qrSession, setQrSession] = useState<PlenarySession | null>(() =>
    initialCheckinSessionId
      ? sessions.find((s) => s.id === initialCheckinSessionId) || null
      : null,
  );

  const majorityRequired = Math.max(1, Math.floor(Math.max(1, activeCounselorsCount) / 2) + 1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessions
      .filter((s) => {
        if (statusFilter && s.status !== statusFilter) return false;
        if (fromDate && s.dateIso.slice(0, 10) < fromDate) return false;
        if (toDate && s.dateIso.slice(0, 10) > toDate) return false;
        if (!q) return true;
        return (
          s.title.toLowerCase().includes(q) ||
          s.location.toLowerCase().includes(q) ||
          s.agenda.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'title') return a.title.localeCompare(b.title, 'es-CO');
        if (sortBy === 'date_asc') return a.dateIso.localeCompare(b.dateIso);
        return b.dateIso.localeCompare(a.dateIso);
      });
  }, [sessions, search, statusFilter, fromDate, toDate, sortBy]);

  const getPresentCount = (sessionId: string) =>
    attendance.filter((a) => a.sessionId === sessionId && a.status === 'presente').length;

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await cancelPlenarySession(actor, cancelTarget.id, cancelTarget.title);
      showToast('Sesión cancelada correctamente.', 'info');
      setCancelTarget(null);
      await onReload();
    } finally {
      setCancelling(false);
    }
  };

  const [filingSessionId, setFilingSessionId] = useState<string | null>(null);

  const handleFileDraftMinutes = async (s: PlenarySession) => {
    setFilingSessionId(s.id);
    try {
      const consecutive = await createDraftMinutesDocumentFromSession({
        actor,
        session: s,
        attendance,
        activeCounselorsCount,
      });
      showToast(`Borrador de Acta ${consecutive} radicado en Documentos.`, 'success');
      await onReload();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo radicar el acta.', 'error');
    } finally {
      setFilingSessionId(null);
    }
  };

  const handleSendReminder = async (s: PlenarySession) => {
    try {
      await createInternalNotification(actor, {
        title: `Recordatorio de sesión: ${s.title}`,
        body: `Fecha: ${s.dateIso} · Lugar: ${s.location}. Revisa el orden del día en Sesiones y Asistencia.`,
        category: 'convocatoria_sesion',
        sessionId: s.id,
      });
      showToast('Recordatorio enviado al centro de avisos internos.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'No se pudo enviar el recordatorio.', 'error');
    }
  };

  const tableColumns: TableColumn<PlenarySession>[] = [
    { key: 'title', header: 'Sesión', sortValue: (s) => s.title, render: (s) => <span className="font-semibold">{s.title}</span> },
    { key: 'dateIso', header: 'Fecha', sortValue: (s) => s.dateIso, render: (s) => <span className="font-mono-tabular">{s.dateIso}</span> },
    { key: 'location', header: 'Lugar', sortValue: (s) => s.location, render: (s) => <span>{s.location}</span> },
    { key: 'status', header: 'Estado', sortValue: (s) => s.status, render: (s) => <StatusText label={s.status} tone={s.status === 'cancelada' ? 'danger' : 'info'} /> },
    {
      key: 'quorum',
      header: 'Quórum',
      sortValue: (s) => getPresentCount(s.id),
      render: (s) => <span className="font-mono-tabular">{getPresentCount(s.id)} / {activeCounselorsCount}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {isBoard && <SessionCreateCard actor={actor} onReload={onReload} />}

      <Card padding="sm" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-stone-950 dark:text-white">
            Sesiones registradas ({filtered.length})
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input label="Buscar" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Título, lugar u orden..." />
          <Select label="Estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="programada">Programada</option>
            <option value="realizada">Realizada</option>
            <option value="borrador">Borrador</option>
            <option value="cancelada">Cancelada</option>
          </Select>
          <Input label="Desde" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <Input label="Hasta" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          <Select label="Ordenar" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'date_desc' | 'date_asc' | 'title')}>
            <option value="date_desc">Más recientes</option>
            <option value="date_asc">Más antiguas</option>
            <option value="title">Por título</option>
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="Sin sesiones que coincidan" description="Ajusta los filtros o programa una nueva sesión." />
      ) : viewMode === 'table' ? (
        <Card>
          <DataTable rows={filtered} columns={tableColumns} rowKey={(s) => s.id} exportFileName="cmj-flandes-sesiones" exportTitle="Sesiones del Pleno — CMJ Flandes" />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const linkedDocs = documents.filter((d) => d.sessionId === s.id);
            const presentCount = getPresentCount(s.id);
            const quorumOk = presentCount >= majorityRequired;
            return (
              <Card key={s.id} padding="sm">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-slate-400">
                      <span className="font-mono-tabular">{s.dateIso}</span>
                      <span aria-hidden="true">·</span>
                      <span>{s.location}</span>
                      <StatusText label={s.status} tone={s.status === 'cancelada' ? 'danger' : 'info'} />
                      <span aria-hidden="true">·</span>
                      <StatusText
                        label={`Quórum ${presentCount}/${activeCounselorsCount} (${quorumOk ? 'alcanzado' : `mín. ${majorityRequired}`})`}
                        tone={quorumOk ? 'success' : 'neutral'}
                      />
                    </div>
                    <h3 className="mt-1 font-display text-base font-semibold text-stone-950 dark:text-white">{s.title}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => setPresentationSession(s)}>
                      <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" /><span>Presentación</span>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setQrSession(s)}>
                      <QrCode className="h-3.5 w-3.5" aria-hidden="true" /><span>QR</span>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => exportSessionMinutesPdf({ session: s, attendance, activeCounselorsCount })}>
                      <FileDown className="h-3.5 w-3.5" aria-hidden="true" /><span>Acta PDF</span>
                    </Button>
                    {isBoard && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          loading={filingSessionId === s.id}
                          onClick={() => void handleFileDraftMinutes(s)}
                        >
                          <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" /><span>Radicar Acta</span>
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void handleSendReminder(s)}>
                          <BellRing className="h-3.5 w-3.5" aria-hidden="true" /><span>Recordatorio</span>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingSession(s)}>
                          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" /><span>Editar</span>
                        </Button>
                        {s.status !== 'cancelada' && (
                          <Button size="sm" variant="danger" onClick={() => setCancelTarget(s)}>
                            <Ban className="h-3.5 w-3.5" aria-hidden="true" /><span>Cancelar</span>
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {linkedDocs.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-2.5 text-xs dark:border-slate-800">
                    <span className="inline-flex items-center gap-1 font-medium text-stone-600 dark:text-slate-300">
                      <FileText className="h-3.5 w-3.5 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
                      Documentos vinculados ({linkedDocs.length}):
                    </span>
                    {linkedDocs.map((docItem) => (
                      <span key={docItem.id} className="inline-flex items-center gap-1.5">
                        <span className="text-stone-700 dark:text-slate-200">
                          {docItem.consecutiveNumber ? `${docItem.consecutiveNumber} · ` : ''}{docItem.title}
                        </span>
                        <StorageDownloadButton compact item={docItem} />
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <SessionQrCheckinModal session={qrSession} actor={actor} isBoard={isBoard} attendance={attendance} initialCode={initialCheckinCode || ''} onClose={() => setQrSession(null)} onReload={onReload} />
      <SessionPresentationModal session={presentationSession} attendance={attendance} activeCounselorsCount={activeCounselorsCount} elections={elections} onClose={() => setPresentationSession(null)} />
      <SessionEditModal session={editingSession} actor={actor} onClose={() => setEditingSession(null)} onReload={onReload} />
      <Dialog
        open={Boolean(cancelTarget)}
        destructive
        loading={cancelling}
        title="¿Cancelar sesión convocada?"
        description={`La sesión "${cancelTarget?.title || ''}" cambiará a estado "cancelada" y se registrará en la bitácora de auditoría.`}
        confirmLabel="Sí, cancelar sesión"
        onConfirm={handleConfirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
