import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  CalendarClock,
  CheckCircle2,
  Clock,
  History,
  RotateCcw,
  ShieldAlert,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { ApiRequestError, apiRequest, triggerPortalRefresh } from '../../lib/apiClient';
import {
  HANDOVER_DEADLINE_DAYS,
  ROLE_TERM_CONFIG,
  bogotaLocalInputToUtcIso,
  formatBogotaDate,
  formatBogotaDateTime,
  formatTermYearsLabel,
  getBogotaDateString,
  requiresCommissionForRole,
  utcIsoToBogotaInput,
} from '../../lib/roleTerms';
import type { Commission, PublicCouncilor, RoleTerm, RoleTermStatus } from '../../types/cmj';
import { AvatarBadge } from '../public/AvatarBadge';
import { useToast } from '../ToastProvider';
import { EmptyState } from '../ui/AnimatedPrimitives';
import { ResponsiveModal } from '../ui/DataTableUI';
import { usePermissions } from './PermissionGate';

type ModalActionState =
  | { mode: 'schedule'; term: RoleTerm; outgoing: RoleTerm | null }
  | { mode: 'reprogram'; term: RoleTerm; outgoing: RoleTerm | null }
  | { mode: 'cancel'; term: RoleTerm; outgoing: RoleTerm | null }
  | null;

const STATUS_BADGE: Record<
  RoleTermStatus,
  { label: string; className: string }
> = {
  vigente: {
    label: 'Vigente',
    className:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900',
  },
  programado: {
    label: 'Relevo programado',
    className:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900',
  },
  finalizado: {
    label: 'Finalizado',
    className:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
  cancelado: {
    label: 'Cancelado',
    className:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-900',
  },
};

function defaultTomorrowBogotaInput(): string {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const datePart = getBogotaDateString(tomorrow);
  return `${datePart}T08:00`;
}

export function RoleTermsPanel({
  uid,
  commissions,
  publicCouncilors,
  roleTerms,
}: {
  uid: string;
  commissions: Commission[];
  publicCouncilors: PublicCouncilor[];
  roleTerms: RoleTerm[];
}) {
  const { showToast } = useToast();
  const { can } = usePermissions();

  const canAssignPres = can('usuarios.asignar_presidencia');
  const canAssignCoord = can('comision.coordinador_asignar');
  const canEditUsers = can('usuarios.editar');

  const [statusFilter, setStatusFilter] = useState<'todos' | RoleTermStatus>('todos');
  const [roleFilter, setRoleFilter] = useState<string>('todos');

  const [modalState, setModalState] = useState<ModalActionState>(null);
  const [exitDateInput, setExitDateInput] = useState(defaultTomorrowBogotaInput);
  const [immediate, setImmediate] = useState(false);
  const [handoverNotes, setHandoverNotes] = useState('');
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const commMap = useMemo(
    () => new Map(commissions.map((c) => [c.id, c])),
    [commissions]
  );
  const councilorMap = useMemo(
    () => new Map(publicCouncilors.map((c) => [c.uid, c])),
    [publicCouncilors]
  );

  const findOutgoing = React.useCallback(
    (incoming: RoleTerm): RoleTerm | null => {
      if (incoming.previousTermId) {
        const match = roleTerms.find(
          (t) => t.id === incoming.previousTermId && t.status === 'vigente'
        );
        if (match) return match;
      }
      const targetComm = requiresCommissionForRole(incoming.roleLabel)
        ? incoming.commissionId || ''
        : '';
      return (
        roleTerms.find(
          (t) =>
            t.status === 'vigente' &&
            t.roleLabel === incoming.roleLabel &&
            (t.commissionId || '') === targetComm
        ) || null
      );
    },
    [roleTerms]
  );

  const canManageHandover = React.useCallback(
    (term: RoleTerm, outgoing: RoleTerm | null) => {
      const isOutgoingHolder = Boolean(outgoing && outgoing.councilorUid === uid);
      const isVacant = !outgoing;
      const hasOverride =
        canAssignPres ||
        (term.roleLabel === 'Coordinador de Comisión' && canAssignCoord);
      return {
        isOutgoingHolder,
        isVacant,
        hasOverride,
        canScheduleOrReprogram: isOutgoingHolder || hasOverride || (isVacant && canEditUsers),
        canCancel: hasOverride,
        requiresJustificationOnSchedule: !isOutgoingHolder && !isVacant,
      };
    },
    [canAssignCoord, canAssignPres, canEditUsers, uid]
  );

  const scheduledTerms = useMemo(
    () =>
      roleTerms
        .filter((t) => t.status === 'programado')
        .sort((a, b) => {
          if (!a.startDate && b.startDate) return -1;
          if (a.startDate && !b.startDate) return 1;
          return (a.startDate || '').localeCompare(b.startDate || '');
        }),
    [roleTerms]
  );

  const activeTerms = useMemo(
    () =>
      roleTerms
        .filter((t) => t.status === 'vigente')
        .sort((a, b) => {
          const pa = ROLE_TERM_CONFIG[a.roleLabel]?.priority ?? 99;
          const pb = ROLE_TERM_CONFIG[b.roleLabel]?.priority ?? 99;
          if (pa !== pb) return pa - pb;
          return (a.commissionId || '').localeCompare(b.commissionId || '');
        }),
    [roleTerms]
  );

  const filteredHistory = useMemo(() => {
    return roleTerms.filter((t) => {
      if (statusFilter !== 'todos' && t.status !== statusFilter) return false;
      if (roleFilter !== 'todos' && t.roleLabel !== roleFilter) return false;
      return true;
    });
  }, [roleFilter, roleTerms, statusFilter]);

  const openScheduleModal = (term: RoleTerm, mode: 'schedule' | 'reprogram') => {
    const outgoing = findOutgoing(term);
    setModalState({ mode, term, outgoing });
    setExitDateInput(
      term.startDate ? utcIsoToBogotaInput(term.startDate) : defaultTomorrowBogotaInput()
    );
    setImmediate(!outgoing);
    setHandoverNotes(term.handoverNotes || '');
    setJustification('');
  };

  const openCancelModal = (term: RoleTerm) => {
    const outgoing = findOutgoing(term);
    setModalState({ mode: 'cancel', term, outgoing });
    setJustification('');
  };

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalState) return;
    const { mode, term, outgoing } = modalState;
    const perms = canManageHandover(term, outgoing);

    if (mode === 'cancel') {
      if (justification.trim().length < 10) {
        showToast('Ingresa una justificación de al menos 10 caracteres', 'error');
        return;
      }
      setSubmitting(true);
      try {
        await apiRequest(`/api/role-terms/${encodeURIComponent(term.id)}/cancel`, {
          method: 'POST',
          body: { reason: justification.trim() },
        });
        triggerPortalRefresh();
        showToast('Relevo programado cancelado', 'info');
        setModalState(null);
      } catch (err) {
        showToast(
          err instanceof ApiRequestError ? err.message : 'No se pudo cancelar el relevo',
          'error'
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if ((mode === 'reprogram' || perms.requiresJustificationOnSchedule) && justification.trim().length < 10) {
      showToast('Debes ingresar una justificación de al menos 10 caracteres', 'error');
      return;
    }

    const exitDateIso = immediate ? '' : bogotaLocalInputToUtcIso(exitDateInput);
    if (!immediate && !exitDateIso) {
      showToast('Selecciona una fecha y hora válida en zona Colombia', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const endpoint =
        mode === 'reprogram'
          ? `/api/role-terms/${encodeURIComponent(term.id)}/reprogram`
          : `/api/role-terms/${encodeURIComponent(term.id)}/schedule-handover`;
      const body =
        mode === 'reprogram'
          ? {
              exitDate: exitDateIso,
              immediate,
              reason: justification.trim(),
            }
          : {
              exitDate: exitDateIso,
              immediate,
              handoverNotes: handoverNotes.trim(),
              justification: justification.trim(),
            };

      const res = await apiRequest<{ ok: boolean; activatedImmediately?: boolean }>(endpoint, {
        method: 'POST',
        body,
      });
      triggerPortalRefresh();
      showToast(
        res.activatedImmediately
          ? 'Relevo ejecutado inmediatamente y permisos actualizados'
          : mode === 'reprogram'
            ? 'Fecha de relevo reprogramada'
            : 'Fecha de entrega del cargo registrada',
        'success'
      );
      setModalState(null);
    } catch (err) {
      showToast(
        err instanceof ApiRequestError ? err.message : 'No se pudo guardar la programación del relevo',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const renderRoleWithCommission = (term: RoleTerm) => {
    if (requiresCommissionForRole(term.roleLabel) && term.commissionId) {
      const comm = commMap.get(term.commissionId);
      return `${term.roleLabel} · ${comm ? `Comisión ${comm.number} (${comm.name})` : term.commissionId}`;
    }
    return term.roleLabel;
  };

  return (
    <div className="space-y-6">
      {/* Relevos pendientes / programados */}
      {scheduledTerms.length > 0 && (
        <div className="rounded-3xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
                <ArrowRightLeft className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Relevos Electos y Transiciones Pendientes ({scheduledTerms.length})
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  El titular electo conserva sus permisos actuales hasta que llegue la fecha oficial de entrega registrada.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {scheduledTerms.map((term) => {
              const outgoing = findOutgoing(term);
              const perms = canManageHandover(term, outgoing);
              const incomingPub = councilorMap.get(term.councilorUid);
              const outgoingPub = outgoing ? councilorMap.get(outgoing.councilorUid) : undefined;
              const createdMs = term.createdAt ? new Date(String(term.createdAt)).getTime() : NaN;
              const daysElapsed = !Number.isNaN(createdMs)
                ? Math.floor((Date.now() - createdMs) / 86_400_000)
                : 0;
              const isOverdue = !term.startDate && daysElapsed >= HANDOVER_DEADLINE_DAYS;

              return (
                <div
                  key={term.id}
                  className="rounded-2xl border border-amber-200/80 dark:border-amber-900/50 bg-white dark:bg-slate-900 p-4 space-y-3 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <span className="inline-block rounded-lg bg-amber-100 dark:bg-amber-950/80 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-300">
                        {renderRoleWithCommission(term)}
                      </span>
                      {isOverdue && (
                        <span className="ml-2 inline-flex items-center gap-1 rounded-lg bg-rose-100 dark:bg-rose-950/70 px-2 py-0.5 text-[11px] font-bold text-rose-700 dark:text-rose-300">
                          <AlertTriangle className="h-3 w-3" /> +{daysElapsed}d sin fecha
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {term.startDate ? 'Fecha fijada' : 'Falta definir fecha'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                        Titular saliente
                      </p>
                      {outgoing ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <AvatarBadge
                            name={outgoingPub?.fullName || outgoing.councilorName}
                            photoUrl={outgoingPub?.photoUrl}
                            thumbUrl={outgoingPub?.photoThumbUrl}
                            size="xs"
                          />
                          <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {outgoingPub?.fullName || outgoing.councilorName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Cargo actualmente vacante</span>
                      )}
                    </div>

                    <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-1">
                        Electo(a) entrante
                      </p>
                      <div className="flex items-center gap-2 min-w-0">
                        <AvatarBadge
                          name={incomingPub?.fullName || term.councilorName}
                          photoUrl={incomingPub?.photoUrl}
                          thumbUrl={incomingPub?.photoThumbUrl}
                          size="xs"
                        />
                        <span className="font-bold text-emerald-900 dark:text-emerald-200 truncate">
                          {incomingPub?.fullName || term.councilorName}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 dark:bg-slate-950/70 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    {term.startDate ? (
                      <span>
                        Entrega oficial programada:{' '}
                        <strong className="font-mono-num">
                          {formatBogotaDateTime(term.startDate)}
                        </strong>
                      </span>
                    ) : (
                      <span>
                        Relevo pendiente: falta registrar la fecha y hora oficial de entrega del cargo.
                      </span>
                    )}
                  </div>

                  {term.handoverNotes && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Notas de entrega: {term.handoverNotes}
                    </p>
                  )}

                  {(perms.canScheduleOrReprogram || perms.canCancel) && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {!term.startDate && perms.canScheduleOrReprogram && (
                        <button
                          type="button"
                          onClick={() => openScheduleModal(term, 'schedule')}
                          className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
                        >
                          <CalendarClock className="h-3.5 w-3.5" />
                          Registrar fecha de entrega
                        </button>
                      )}
                      {term.startDate && perms.canScheduleOrReprogram && (
                        <button
                          type="button"
                          onClick={() => openScheduleModal(term, 'reprogram')}
                          className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Reprogramar
                        </button>
                      )}
                      {perms.canCancel && (
                        <button
                          type="button"
                          onClick={() => openCancelModal(term)}
                          className="min-h-[36px] inline-flex items-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 cursor-pointer"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Cancelar relevo
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mandatos vigentes */}
      <div className="cmj-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              Cargos y Mandatos Vigentes ({activeTerms.length})
            </h3>
            <p className="text-xs text-slate-500">
              Titulares actualmente en ejercicio de Mesa Directiva, Delegación Departamental y Coordinaciones.
            </p>
          </div>
        </div>

        {activeTerms.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            title="Sin mandatos activos registrados"
            description="Los periodos vigentes se crean automáticamente a partir de la Mesa Directiva actual o elecciones cerradas."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {activeTerms.map((term) => {
              const pub = councilorMap.get(term.councilorUid);
              return (
                <div
                  key={term.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 dark:border-emerald-900 px-2 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                      {renderRoleWithCommission(term)}
                    </span>
                    <span className="font-mono-num text-[11px] text-slate-500">
                      {formatTermYearsLabel(term.startDate, term.endDate, term.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <AvatarBadge
                      name={pub?.fullName || term.councilorName}
                      photoUrl={pub?.photoUrl}
                      thumbUrl={pub?.photoThumbUrl}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {pub?.fullName || term.councilorName}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Desde: {formatBogotaDate(term.startDate)}
                      </p>
                    </div>
                  </div>
                  {term.endDate && (
                    <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 inline-flex items-center gap-1">
                      <Clock className="h-3 w-3 shrink-0" />
                      Entrega programada: {formatBogotaDateTime(term.endDate)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Línea de tiempo / historial completo */}
      <div className="cmj-card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              Historial de Periodos y Relevos ({filteredHistory.length})
            </h3>
            <p className="text-xs text-slate-500">
              Trazabilidad institucional completa por cargo, incluyendo ex-presidentes, secretarios y coordinadores.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filtrar historial por estado"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'todos' | RoleTermStatus)}
              className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
            >
              <option value="todos">Todos los estados</option>
              <option value="vigente">Vigentes</option>
              <option value="programado">Programados</option>
              <option value="finalizado">Finalizados</option>
              <option value="cancelado">Cancelados</option>
            </select>
            <select
              aria-label="Filtrar historial por cargo"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
            >
              <option value="todos">Todos los cargos</option>
              <option value="Presidente">Presidente</option>
              <option value="Vicepresidente">Vicepresidente</option>
              <option value="Secretario">Secretario</option>
              <option value="Consejero Departamental">Consejero Departamental</option>
              <option value="Coordinador de Comisión">Coordinador de Comisión</option>
            </select>
          </div>
        </div>

        {filteredHistory.length === 0 ? (
          <EmptyState
            icon={History}
            title="Sin registros en este filtro"
            description="Ajusta el filtro de cargo o estado para consultar los periodos históricos."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-2">Cargo</th>
                  <th className="py-2.5 px-2">Titular</th>
                  <th className="py-2.5 px-2">Inicio</th>
                  <th className="py-2.5 px-2">Fin / Entrega</th>
                  <th className="py-2.5 px-2">Estado</th>
                  <th className="py-2.5 px-2">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredHistory.map((term) => {
                  const pub = councilorMap.get(term.councilorUid);
                  const badge = STATUS_BADGE[term.status] || STATUS_BADGE.finalizado;
                  const note =
                    term.cancelReason ||
                    term.reprogramReason ||
                    term.handoverNotes ||
                    (term.electedByVoteId ? 'Electo en votación oficial' : 'Designación institucional');

                  return (
                    <tr key={term.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                      <td className="py-3 px-2 font-semibold text-slate-800 dark:text-slate-100">
                        {renderRoleWithCommission(term)}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-2">
                          <AvatarBadge
                            name={pub?.fullName || term.councilorName}
                            photoUrl={pub?.photoUrl}
                            thumbUrl={pub?.photoThumbUrl}
                            size="xs"
                          />
                          <span className="font-medium text-slate-900 dark:text-white">
                            {pub?.fullName || term.councilorName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-2 font-mono-num text-slate-600 dark:text-slate-300">
                        {term.startDate ? formatBogotaDateTime(term.startDate) : 'Por definir'}
                      </td>
                      <td className="py-3 px-2 font-mono-num text-slate-600 dark:text-slate-300">
                        {term.endDate
                          ? formatBogotaDateTime(term.endDate)
                          : term.status === 'vigente'
                            ? 'En ejercicio'
                            : '—'}
                      </td>
                      <td className="py-3 px-2">
                        <span
                          className={`inline-block rounded-lg border px-2 py-0.5 text-[11px] font-bold whitespace-nowrap ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-slate-500 dark:text-slate-400 max-w-[260px] truncate" title={note}>
                        {note}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de programación / reprogramación / cancelación */}
      <ResponsiveModal
        open={Boolean(modalState)}
        title={
          modalState?.mode === 'cancel'
            ? `Cancelar relevo · ${modalState.term.roleLabel}`
            : modalState?.mode === 'reprogram'
              ? `Reprogramar entrega · ${modalState.term.roleLabel}`
              : `Registrar fecha de entrega · ${modalState?.term.roleLabel || ''}`
        }
        subtitle={
          modalState
            ? `Electo(a): ${modalState.term.councilorName}${
                modalState.outgoing
                  ? ` · Saliente: ${modalState.outgoing.councilorName}`
                  : ' · Cargo vacante'
              }`
            : undefined
        }
        maxWidthClass="sm:max-w-lg"
        onClose={() => !submitting && setModalState(null)}
      >
        {modalState && (
          <form onSubmit={handleSubmitModal} className="space-y-4">
            {modalState.mode === 'cancel' ? (
              <>
                <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 p-3 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Al cancelar este relevo, {modalState.term.councilorName} no asumirá el cargo y el titular saliente conservará sus funciones actuales. Esta acción quedará registrada en Auditoría.
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                    Justificación obligatoria (mínimo 10 caracteres) *
                  </label>
                  <textarea
                    required
                    minLength={10}
                    rows={3}
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Indica el motivo oficial (ej. renuncia al cargo electo, nulidad por quórum, acta plenaria...)"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                  />
                </div>
              </>
            ) : (
              <>
                <label className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={immediate}
                    onChange={(e) => setImmediate(e.target.checked)}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  <span>Ejecutar transición inmediatamente (efectivo ahora mismo)</span>
                </label>

                {!immediate && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                      Fecha y hora de entrega (hora Colombia · America/Bogota) *
                    </label>
                    <input
                      type="datetime-local"
                      required
                      min={`${getBogotaDateString()}T00:00`}
                      value={exitDateInput}
                      onChange={(e) => setExitDateInput(e.target.value)}
                      className="w-full min-h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono-num"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      El intercambio atómico de roles y permisos se activará exactamente al cumplirse esta fecha.
                    </p>
                  </div>
                )}

                {modalState.mode === 'schedule' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                      Notas de entrega y empalme (opcional)
                    </label>
                    <textarea
                      rows={2}
                      value={handoverNotes}
                      onChange={(e) => setHandoverNotes(e.target.value)}
                      placeholder="Acta de empalme, inventario de documentos o compromisos pendientes..."
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                  </div>
                )}

                {(modalState.mode === 'reprogram' ||
                  canManageHandover(modalState.term, modalState.outgoing)
                    .requiresJustificationOnSchedule) && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                      Justificación obligatoria (mínimo 10 caracteres) *
                    </label>
                    <textarea
                      required
                      minLength={10}
                      rows={2}
                      value={justification}
                      onChange={(e) => setJustification(e.target.value)}
                      placeholder={
                        modalState.mode === 'reprogram'
                          ? 'Motivo por el cual se reprograma la fecha de entrega...'
                          : 'Motivo por el cual Presidencia registra la fecha de salida del titular actual...'
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setModalState(null)}
                className="min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold text-white cursor-pointer disabled:opacity-60 ${
                  modalState.mode === 'cancel'
                    ? 'bg-rose-700 hover:bg-rose-800'
                    : 'bg-emerald-700 hover:bg-emerald-800'
                }`}
              >
                <CheckCircle2 className="h-4 w-4" />
                {submitting
                  ? 'Procesando...'
                  : modalState.mode === 'cancel'
                    ? 'Confirmar cancelación'
                    : modalState.mode === 'reprogram'
                      ? 'Guardar reprogramación'
                      : immediate
                        ? 'Ejecutar relevo ahora'
                        : 'Confirmar fecha de entrega'}
              </button>
            </div>
          </form>
        )}
      </ResponsiveModal>
    </div>
  );
}
