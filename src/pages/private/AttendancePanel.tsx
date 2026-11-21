import { FormEvent, useMemo, useState } from 'react';
import { ClipboardCheck, Download } from 'lucide-react';
import { recordAttendance } from '../../services/sessionsAttendanceService';
import { AttendanceRecord, PlenarySession, UserProfile } from '../../types/models';
import { exportAttendanceExcel, exportAttendancePdf } from '../../utils/reportExport';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select } from '../../components/ui/Input';
import { StatusText } from '../../components/ui/StatusText';
import { DataTable, TableColumn } from '../../components/ui/Table';
import { useToast } from '../../components/ui/Toast';

interface AttendancePanelProps {
  actor: UserProfile;
  isBoard: boolean;
  activeUsers: UserProfile[];
  sessions: PlenarySession[];
  attendance: AttendanceRecord[];
  onReload: () => Promise<void>;
}

export function AttendancePanel({
  actor,
  isBoard,
  activeUsers,
  sessions,
  attendance,
  onReload,
}: AttendancePanelProps) {
  const { showToast } = useToast();
  const [attSessionId, setAttSessionId] = useState('');
  const [attUserUid, setAttUserUid] = useState(actor.uid);
  const [attStatus, setAttStatus] = useState<'presente' | 'ausente' | 'justificada'>('presente');
  const [attNotes, setAttNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const [filterSessionId, setFilterSessionId] = useState('');
  const [filterUserUid, setFilterUserUid] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const sessionMap = useMemo(
    () => new Map(sessions.map((s) => [s.id, s])),
    [sessions],
  );

  const filtered = useMemo(
    () =>
      attendance.filter((a) => {
        if (filterSessionId && a.sessionId !== filterSessionId) return false;
        if (filterUserUid && a.userUid !== filterUserUid) return false;
        if (filterStatus && a.status !== filterStatus) return false;
        return true;
      }),
    [attendance, filterSessionId, filterUserUid, filterStatus],
  );

  const counselorStats = useMemo(() => {
    const map = new Map<string, { name: string; total: number; present: number }>();
    for (const a of attendance) {
      const prev = map.get(a.userUid) || { name: a.userName, total: 0, present: 0 };
      prev.total += 1;
      if (a.status === 'presente') prev.present += 1;
      map.set(a.userUid, prev);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'es-CO'));
  }, [attendance]);

  const handleRecordAttendance = async (e: FormEvent) => {
    e.preventDefault();
    if (!attSessionId) return;
    setSaving(true);
    try {
      const targetUser = isBoard ? activeUsers.find((u) => u.uid === attUserUid) || actor : actor;
      await recordAttendance(actor, {
        sessionId: attSessionId,
        userUid: targetUser.uid,
        userName: targetUser.displayName,
        status: attStatus,
        notes: attNotes,
      });
      setAttNotes('');
      showToast('Asistencia registrada correctamente.', 'success');
      await onReload();
    } finally {
      setSaving(false);
    }
  };

  const columns: TableColumn<AttendanceRecord>[] = [
    {
      key: 'userName',
      header: 'Consejero',
      sortValue: (a) => a.userName,
      render: (a) => <span className="font-semibold">{a.userName}</span>,
    },
    {
      key: 'session',
      header: 'Sesión',
      sortValue: (a) => sessionMap.get(a.sessionId)?.title || a.sessionId,
      render: (a) => {
        const s = sessionMap.get(a.sessionId);
        return <span>{s ? `${s.title} (${s.dateIso.slice(0, 10)})` : a.sessionId}</span>;
      },
    },
    {
      key: 'status',
      header: 'Estado',
      sortValue: (a) => a.status,
      render: (a) => (
        <StatusText
          label={a.status}
          tone={a.status === 'presente' ? 'success' : a.status === 'justificada' ? 'warning' : 'danger'}
        />
      ),
    },
    {
      key: 'notes',
      header: 'Observaciones',
      exportValue: (a) => a.notes || '',
      render: (a) => <span className="text-stone-500">{a.notes || '—'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <h2 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
            Registrar asistencia
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={filtered.length === 0} onClick={() => exportAttendancePdf(filtered)}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" /><span>PDF</span>
            </Button>
            <Button size="sm" variant="outline" disabled={filtered.length === 0} onClick={() => void exportAttendanceExcel(filtered)}>
              <Download className="h-3.5 w-3.5" aria-hidden="true" /><span>Excel</span>
            </Button>
          </div>
        </div>

        <form onSubmit={handleRecordAttendance} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Select label="Sesión" required value={attSessionId} onChange={(e) => setAttSessionId(e.target.value)}>
              <option value="">Selecciona una sesión</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.title} ({s.dateIso})</option>
              ))}
            </Select>
            {isBoard && (
              <Select label="Consejero" value={attUserUid} onChange={(e) => setAttUserUid(e.target.value)}>
                {activeUsers.map((u) => (
                  <option key={u.uid} value={u.uid}>{u.displayName}</option>
                ))}
              </Select>
            )}
            <Select label="Estado" value={attStatus} onChange={(e) => setAttStatus(e.target.value as 'presente' | 'ausente' | 'justificada')}>
              <option value="presente">Presente</option>
              {isBoard && <option value="ausente">Ausente</option>}
              {isBoard && <option value="justificada">Justificada</option>}
            </Select>
          </div>
          <Input label="Observaciones (opcional)" maxLength={500} value={attNotes} onChange={(e) => setAttNotes(e.target.value)} />
          <Button type="submit" loading={saving} disabled={!attSessionId}>Guardar asistencia</Button>
        </form>
      </Card>

      {counselorStats.length > 0 && (
        <Card padding="sm">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-slate-400">
            Resumen de presencialidad por consejero
          </h3>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {counselorStats.map((st) => {
              const pct = Math.round((st.present / Math.max(1, st.total)) * 100);
              return (
                <div key={st.name} className="rounded-lg border border-stone-200 bg-[#FAF8F4] px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900/60">
                  <p className="truncate font-semibold text-stone-900 dark:text-white">{st.name}</p>
                  <p className="mt-0.5 font-mono-tabular text-stone-600 dark:text-slate-300">
                    {st.present}/{st.total} sesiones · {pct}%
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {attendance.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Aún no hay registros de asistencia" description="Los registros de asistencia por sesión aparecerán aquí." />
      ) : (
        <Card>
          <DataTable
            rows={filtered}
            columns={columns}
            rowKey={(a) => a.id}
            searchPlaceholder="Buscar consejero o nota..."
            searchableText={(a) => `${a.userName} ${a.notes || ''} ${sessionMap.get(a.sessionId)?.title || ''}`}
            exportFileName="cmj-flandes-asistencia"
            exportTitle="Registro Oficial de Asistencia — CMJ Flandes"
            toolbarExtra={
              <div className="flex flex-wrap gap-2">
                <select aria-label="Filtrar por sesión" value={filterSessionId} onChange={(e) => setFilterSessionId(e.target.value)} className="min-h-[38px] rounded-lg border border-stone-300 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-900">
                  <option value="">Todas las sesiones</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
                <select aria-label="Filtrar por consejero" value={filterUserUid} onChange={(e) => setFilterUserUid(e.target.value)} className="min-h-[38px] rounded-lg border border-stone-300 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-900">
                  <option value="">Todos los consejeros</option>
                  {activeUsers.map((u) => (
                    <option key={u.uid} value={u.uid}>{u.displayName}</option>
                  ))}
                </select>
                <select aria-label="Filtrar por estado" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="min-h-[38px] rounded-lg border border-stone-300 bg-white px-2.5 text-xs dark:border-slate-700 dark:bg-slate-900">
                  <option value="">Todos los estados</option>
                  <option value="presente">Presente</option>
                  <option value="ausente">Ausente</option>
                  <option value="justificada">Justificada</option>
                </select>
              </div>
            }
          />
        </Card>
      )}
    </div>
  );
}
