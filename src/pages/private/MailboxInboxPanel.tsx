import { useMemo, useState } from 'react';
import { Archive, Clock, LayoutGrid, List, Mail } from 'lucide-react';
import {
  assignMailboxEntry,
  respondMailboxEntry,
} from '../../services/electionsCommitmentsMailboxService';
import { sendEmailNotificationOnServer } from '../../services/sessionApi';
import { MailboxEntry, UserProfile } from '../../types/models';
import { formatFirestoreDate } from '../../utils/formatDate';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { StatusText } from '../../components/ui/StatusText';
import { DataTable, TableColumn } from '../../components/ui/Table';
import { useToast } from '../../components/ui/Toast';

interface MailboxInboxPanelProps {
  actor: UserProfile;
  isBoard: boolean;
  activeUsers?: UserProfile[];
  mailbox: MailboxEntry[];
  onReload: () => Promise<void>;
}

const RESPONSE_TEMPLATES: { label: string; text: string }[] = [
  {
    label: 'Acuse de recibo',
    text: 'Cordial saludo. El Consejo Municipal de Juventud de Flandes confirma el recibo de su solicitud y la ha remitido a la comisión competente para estudio en próxima sesión.',
  },
  {
    label: 'Remisión a Secretaría / Alcaldía',
    text: 'Cordial saludo. Tras revisión del CMJ Flandes, trasladamos formalmente su requerimiento a la dependencia municipal correspondiente para gestión conjunta y respuesta de fondo.',
  },
  {
    label: 'Respuesta favorable / cierre',
    text: 'Cordial saludo. Le informamos que su propuesta fue analizada favorablemente por el Pleno del CMJ Flandes e incorporada en nuestro seguimiento territorial 2026–2029.',
  },
];

function computeElapsedDays(createdAt: unknown): string {
  const iso = formatFirestoreDate(createdAt);
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return 'Reciente';
  const days = Math.max(0, Math.floor((Date.now() - ms) / 86_400_000));
  return days === 0 ? 'Hoy' : days === 1 ? 'Hace 1 día' : `Hace ${days} días`;
}

export function MailboxInboxPanel({
  actor,
  isBoard,
  activeUsers = [],
  mailbox,
  onReload,
}: MailboxInboxPanelProps) {
  const { showToast } = useToast();
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [archiveTarget, setArchiveTarget] = useState<MailboxEntry | null>(null);
  const [archiving, setArchiving] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mailbox.filter((entry) => {
      if (statusFilter && entry.status !== statusFilter) return false;
      if (categoryFilter && entry.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        entry.trackingCode.toLowerCase().includes(q) ||
        entry.subject.toLowerCase().includes(q) ||
        entry.message.toLowerCase().includes(q) ||
        (entry.senderName || '').toLowerCase().includes(q)
      );
    });
  }, [mailbox, search, statusFilter, categoryFilter]);

  const handleAssign = async (entry: MailboxEntry, uid: string) => {
    const targetUser = activeUsers.find((u) => u.uid === uid);
    await assignMailboxEntry(actor, entry, uid, targetUser?.displayName || '');
    showToast(uid ? `Radicado asignado a ${targetUser?.displayName || 'consejero'}.` : 'Asignación retirada.', 'success');
    await onReload();
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    setArchiving(true);
    try {
      await respondMailboxEntry(
        actor,
        archiveTarget,
        'archivado',
        responses[archiveTarget.id] ?? archiveTarget.officialResponse ?? 'Solicitud archivada tras cierre de gestión.',
      );
      showToast(`Radicado ${archiveTarget.trackingCode} archivado.`, 'info');
      setArchiveTarget(null);
      await onReload();
    } finally {
      setArchiving(false);
    }
  };

  const columns: TableColumn<MailboxEntry>[] = [
    { key: 'trackingCode', header: 'Radicado', sortValue: (m) => m.trackingCode, render: (m) => <span className="font-mono-tabular font-semibold">{m.trackingCode}</span> },
    { key: 'subject', header: 'Asunto', sortValue: (m) => m.subject, render: (m) => <span>{m.subject}</span> },
    { key: 'category', header: 'Tipo', sortValue: (m) => m.category, render: (m) => <span className="capitalize">{m.category}</span> },
    { key: 'assignedTo', header: 'Responsable', sortValue: (m) => m.assignedToName || '', render: (m) => <span>{m.assignedToName || 'Sin asignar'}</span> },
    { key: 'status', header: 'Estado', sortValue: (m) => m.status, render: (m) => <StatusText label={m.status} tone={m.status === 'respondido' ? 'success' : 'warning'} /> },
  ];

  return (
    <div className="space-y-4">
      <Card padding="sm" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-stone-950 dark:text-white">
            Bandeja de participación y PQRSD ({filtered.length})
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
          <Input label="Buscar radicado" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Código, asunto o remitente..." />
          <Select label="Estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos</option>
            <option value="radicado">Radicado</option>
            <option value="en_revision">En revisión</option>
            <option value="respondido">Respondido</option>
            <option value="archivado">Archivado</option>
          </Select>
          <Select label="Categoría" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Todas</option>
            <option value="propuesta">Propuesta</option>
            <option value="inquietud">Inquietud</option>
            <option value="denuncia">Denuncia</option>
            <option value="pqrsd">PQRSD</option>
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState icon={Mail} title="Bandeja sin resultados" description="Aún no hay radicados que coincidan con el filtro." />
      ) : viewMode === 'table' ? (
        <Card>
          <DataTable rows={filtered} columns={columns} rowKey={(m) => m.id} exportFileName="cmj-flandes-buzon" exportTitle="Radicados del Buzón Juvenil — CMJ Flandes" />
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((entry) => (
            <Card key={entry.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-mono-tabular font-semibold text-stone-900 dark:text-white">{entry.trackingCode}</span>
                  <span className="capitalize text-stone-500">{entry.category}</span>
                  <StatusText label={entry.status} tone={entry.status === 'respondido' ? 'success' : 'warning'} />
                  <span aria-hidden="true" className="text-stone-400 dark:text-slate-500">·</span>
                  <span className="font-mono-tabular inline-flex items-center gap-1 text-stone-500 dark:text-slate-400">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {computeElapsedDays(entry.createdAt)}
                  </span>
                </div>
                <span className="text-xs text-stone-500">
                  {entry.isAnonymous ? 'Radicado anónimo' : entry.senderName}
                </span>
              </div>
              <h3 className="mt-2 font-display text-lg font-semibold text-stone-950 dark:text-white">{entry.subject}</h3>
              <p className="mt-1 whitespace-pre-line text-sm text-stone-600 dark:text-slate-300">{entry.message}</p>

              {entry.history && entry.history.length > 0 && (
                <div className="mt-3 rounded-lg border border-stone-200 bg-[#FAF8F4] px-3 py-2 text-[11px] text-stone-600 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-300">
                  <span className="font-semibold">Trazabilidad:</span>{' '}
                  {entry.history.slice(-3).map((h) => `${h.action} (${h.actorName})`).join(' → ')}
                </div>
              )}

              {isBoard && (
                <div className="mt-4 space-y-3 border-t border-stone-200 pt-4 dark:border-slate-800">
                  {activeUsers.length > 0 && (
                    <div className="max-w-xs">
                      <Select
                        label="Responsable asignado"
                        value={entry.assignedToUid || ''}
                        onChange={(e) => void handleAssign(entry, e.target.value)}
                      >
                        <option value="">Sin asignar</option>
                        {activeUsers.map((u) => (
                          <option key={u.uid} value={u.uid}>{u.displayName}</option>
                        ))}
                      </Select>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-medium text-stone-500">Plantillas rápidas:</span>
                    {RESPONSE_TEMPLATES.map((tpl) => (
                      <button
                        key={tpl.label}
                        type="button"
                        onClick={() => setResponses((prev) => ({ ...prev, [entry.id]: tpl.text }))}
                        className="rounded-md border border-stone-300 bg-white px-2 py-1 text-[11px] font-medium text-stone-700 hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        {tpl.label}
                      </button>
                    ))}
                  </div>

                  <Textarea
                    label="Respuesta oficial"
                    rows={2}
                    value={responses[entry.id] ?? entry.officialResponse ?? ''}
                    onChange={(e) => setResponses((prev) => ({ ...prev, [entry.id]: e.target.value }))}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void respondMailboxEntry(
                          actor,
                          entry,
                          'en_revision',
                          responses[entry.id] ?? entry.officialResponse ?? 'En revisión por el Consejo.',
                        ).then(() => {
                          showToast('Radicado marcado en revisión.', 'info');
                          return onReload();
                        })
                      }
                    >
                      Marcar en revisión
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => {
                        const replyText = responses[entry.id] ?? entry.officialResponse ?? '';
                        void respondMailboxEntry(actor, entry, 'respondido', replyText).then(() => {
                          if (!entry.isAnonymous && entry.senderEmail) {
                            void sendEmailNotificationOnServer({
                              to: [entry.senderEmail],
                              subject: `Respuesta a tu radicado ${entry.trackingCode} · CMJ Flandes`,
                              text: `Tu solicitud "${entry.subject}" tiene una respuesta oficial del CMJ Flandes:\n\n${replyText}`,
                            });
                          }
                          showToast('Respuesta oficial enviada.', 'success');
                          return onReload();
                        });
                      }}
                    >
                      Enviar respuesta oficial
                    </Button>
                    {entry.status !== 'archivado' && (
                      <Button size="sm" variant="outline" onClick={() => setArchiveTarget(entry)}>
                        <Archive className="h-3.5 w-3.5" aria-hidden="true" /><span>Archivar</span>
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(archiveTarget)}
        destructive
        loading={archiving}
        title="¿Archivar radicado ciudadano?"
        description={`El radicado ${archiveTarget?.trackingCode || ''} pasará a estado archivado y no contará como pendiente en la bandeja activa.`}
        confirmLabel="Archivar radicado"
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchiveTarget(null)}
      />
    </div>
  );
}
