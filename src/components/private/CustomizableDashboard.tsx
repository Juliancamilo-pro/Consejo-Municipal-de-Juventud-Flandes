import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDown,
  ArrowUp,
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  EyeOff,
  FileCheck2,
  FileSpreadsheet,
  FolderKanban,
  Lightbulb,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Users,
  Vote,
  X,
} from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import { AnimatedCounter } from '../ui/AnimatedPrimitives';
import { useToast } from '../ToastProvider';
import { isLeadershipTier } from '../../lib/security';
import type {
  AccessTier,
  AffiliationType,
  Commission,
  CommissionTask,
  Commitment,
  ContactMessage,
  CouncilSession,
  CouncilVote,
  DashboardPreferences,
  DashboardWidgetId,
  GalleryItem,
  NewsEvent,
  PortalDocument,
  PrivateModule,
  RoleLabel,
  WorkPlanItem,
} from '../../types/cmj';

const DEFAULT_PREFS: DashboardPreferences = {
  order: ['role_panel', 'commitments', 'sessions', 'notifications', 'commissions_activity'],
  hidden: [],
  density: 'comodo',
};

const WIDGET_META: Record<
  DashboardWidgetId,
  { title: string; subtitle: string; icon: React.ReactNode }
> = {
  role_panel: {
    title: 'Panel de Gestión según tu Cargo',
    subtitle: 'Acciones rápidas y atribuciones de tu rol en el CMJ Flandes',
    icon: <Sparkles className="h-4 w-4 text-blue-600 dark:text-cyan-400" />,
  },
  commitments: {
    title: 'Mis Compromisos',
    subtitle: 'Seguimiento de tareas asignadas y cumplimiento',
    icon: <ClipboardCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />,
  },
  sessions: {
    title: 'Próximas Sesiones',
    subtitle: 'Plenarias, comisiones y mesa directiva programadas',
    icon: <CalendarClock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />,
  },
  notifications: {
    title: 'Notificaciones Relevantes',
    subtitle: 'Votaciones abiertas, aprobaciones y alertas de tu cuenta',
    icon: <Bell className="h-4 w-4 text-amber-600 dark:text-amber-400" />,
  },
  commissions_activity: {
    title: 'Actividad en Comisiones',
    subtitle: 'Avance real de tareas, plan de trabajo y evidencias',
    icon: <FolderKanban className="h-4 w-4 text-pink-600 dark:text-pink-400" />,
  },
};

function DashboardWidgetCard({
  widgetId,
  density,
  customizing,
  canMoveUp,
  canMoveDown,
  onMove,
  onHide,
  children,
  actionSlot,
}: {
  widgetId: DashboardWidgetId;
  density: 'comodo' | 'compacto';
  customizing: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (dir: -1 | 1) => void;
  onHide: () => void;
  children: React.ReactNode;
  actionSlot?: React.ReactNode;
}) {
  const meta = WIDGET_META[widgetId];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.22 }}
      className={`rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ${
        density === 'compacto' ? 'p-4' : 'p-6'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
            {meta.icon}
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">
              {meta.title}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {meta.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {actionSlot}
          {customizing && (
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1">
              <button
                type="button"
                disabled={!canMoveUp}
                onClick={() => onMove(-1)}
                title="Subir bloque"
                className="rounded-lg p-1 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
              >
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                disabled={!canMoveDown}
                onClick={() => onMove(1)}
                title="Bajar bloque"
                className="rounded-lg p-1 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onHide}
                title="Ocultar bloque"
                className="rounded-lg p-1 text-rose-500 hover:bg-white dark:hover:bg-slate-700 cursor-pointer"
              >
                <EyeOff className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {children}
    </motion.div>
  );
}

export function CustomizableDashboard({
  uid,
  fullName,
  roleLabel,
  accessTier,
  commissionId,
  affiliationType,
  affiliationName,
  mustChangePassword,
  commissions,
  commissionTasks,
  commitments,
  sessions,
  votes,
  newsEvents,
  documents,
  galleryItems,
  workPlans,
  contactMessages,
  onNavigate,
  onOpenPasswordChange,
}: {
  uid: string;
  fullName: string;
  roleLabel: RoleLabel;
  accessTier: AccessTier;
  commissionId: string;
  affiliationType?: AffiliationType;
  affiliationName?: string;
  mustChangePassword: boolean;
  commissions: Commission[];
  commissionTasks: CommissionTask[];
  commitments: Commitment[];
  sessions: CouncilSession[];
  votes: CouncilVote[];
  newsEvents: NewsEvent[];
  documents: PortalDocument[];
  galleryItems: GalleryItem[];
  workPlans: WorkPlanItem[];
  contactMessages: ContactMessage[];
  onNavigate: (mod: PrivateModule) => void;
  onOpenPasswordChange: () => void;
}) {
  const { showToast } = useToast();
  const storageKey = `cmj_dashboard_prefs_${uid}`;

  const [prefs, setPrefs] = useState<DashboardPreferences>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as DashboardPreferences;
        if (Array.isArray(parsed.order)) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_PREFS;
  });

  const [customizing, setCustomizing] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  }, [prefs, storageKey]);

  const isLeader = isLeadershipTier(accessTier);
  const myCommission = commissions.find((c) => c.id === commissionId);
  const visibleWidgets = prefs.order.filter((id) => !prefs.hidden.includes(id));

  const moveWidget = (id: DashboardWidgetId, dir: -1 | 1) => {
    setPrefs((prev) => {
      const idx = prev.order.indexOf(id);
      const targetIdx = idx + dir;
      if (idx < 0 || targetIdx < 0 || targetIdx >= prev.order.length) return prev;
      const next = [...prev.order];
      const [item] = next.splice(idx, 1);
      next.splice(targetIdx, 0, item);
      return { ...prev, order: next };
    });
  };

  const toggleVisibility = (id: DashboardWidgetId) => {
    setPrefs((prev) => {
      const isHidden = prev.hidden.includes(id);
      return {
        ...prev,
        hidden: isHidden ? prev.hidden.filter((x) => x !== id) : [...prev.hidden, id],
      };
    });
  };

  const myCommitments = useMemo(() => {
    const mine = commitments.filter((c) => c.responsibleUid === uid);
    if (mine.length > 0) return mine;
    if (isLeader) return commitments.slice(0, 5);
    if (!commissionId) return [];
    return commitments.filter((c) => c.commissionId === commissionId).slice(0, 5);
  }, [commitments, uid, isLeader, commissionId]);

  const upcomingSessions = useMemo(
    () => sessions.filter((s) => s.status !== 'finalizada').slice(0, 4),
    [sessions]
  );

  // Porcentaje real de asistencia del usuario en sesiones registradas
  const myAttendanceRate = useMemo(() => {
    const relevant = sessions.filter((s) => s.attendance && uid in s.attendance);
    if (relevant.length === 0) return 0;
    const attended = relevant.filter(
      (s) => s.attendance?.[uid] === 'presente' || s.attendance?.[uid] === 'tarde'
    ).length;
    return Math.round((attended / relevant.length) * 100);
  }, [sessions, uid]);

  const notifications = useMemo(() => {
    const list: {
      id: string;
      title: string;
      detail: string;
      actionLabel: string;
      onClick: () => void;
    }[] = [];

    if (mustChangePassword) {
      list.push({
        id: 'pwd',
        title: 'Actualiza tu contraseña inicial',
        detail: 'Por seguridad, cambia la contraseña inicial usando el código de invitación.',
        actionLabel: 'Cambiar ahora',
        onClick: onOpenPasswordChange,
      });
    }

    const pendingVotes = votes.filter(
      (v) => v.status === 'abierta' && !v.voterUids.includes(uid)
    );
    pendingVotes.forEach((v) => {
      list.push({
        id: `vote-${v.id}`,
        title: `Votación abierta: ${v.title}`,
        detail: `Fecha límite: ${v.deadline || v.closesAt || 'Por definir'}`,
        actionLabel: 'Votar',
        onClick: () => onNavigate('votaciones'),
      });
    });

    if (roleLabel === 'Presidente') {
      const pendingNews = newsEvents.filter((n) => n.status === 'pendiente');
      const unapprovedDocs = documents.filter((d) => !d.approvedByPresidente);
      if (pendingNews.length > 0) {
        list.push({
          id: 'pres-news',
          title: `${pendingNews.length} publicación(es) esperando aprobación`,
          detail: 'Revisa y aprueba las noticias propuestas por las comisiones.',
          actionLabel: 'Revisar',
          onClick: () => onNavigate('portal_editor'),
        });
      }
      if (unapprovedDocs.length > 0) {
        list.push({
          id: 'pres-docs',
          title: `${unapprovedDocs.length} documento(s) sin aprobación`,
          detail: 'Aprueba actas y oficios para su archivo o publicación.',
          actionLabel: 'Aprobar',
          onClick: () => onNavigate('documentos'),
        });
      }
    }

    if (isLeader) {
      const unreadMsgs = contactMessages.filter((m) => m.status === 'nuevo');
      if (unreadMsgs.length > 0) {
        list.push({
          id: 'msgs',
          title: `${unreadMsgs.length} mensaje(s) ciudadano(s) sin responder`,
          detail: 'Jóvenes y ciudadanos escribieron desde el buzón público.',
          actionLabel: 'Ver mensajes',
          onClick: () => onNavigate('encuestas'),
        });
      }
    }

    if (list.length === 0) {
      list.push({
        id: 'clear',
        title: 'Todo al día',
        detail: 'No tienes votaciones pendientes ni alertas urgentes en este momento.',
        actionLabel: 'Ver agenda',
        onClick: () => onNavigate('agenda'),
      });
    }

    return list;
  }, [
    mustChangePassword,
    votes,
    uid,
    roleLabel,
    newsEvents,
    documents,
    isLeader,
    contactMessages,
    onNavigate,
    onOpenPasswordChange,
  ]);

  const handleToggleCommitmentDone = async (c: Commitment) => {
    const nextStatus = c.status === 'cumplido' ? 'en_progreso' : 'cumplido';
    const nextProgress = nextStatus === 'cumplido' ? 100 : 50;
    try {
      await apiRequest(`/api/commitments/${encodeURIComponent(c.id)}`, {
        method: 'PATCH',
        body: {
          status: nextStatus,
          progress: nextProgress,
        },
      });
      showToast(
        nextStatus === 'cumplido' ? 'Compromiso marcado como cumplido' : 'Compromiso reabierto',
        'success'
      );
    } catch {
      showToast('No se pudo actualizar el compromiso', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div>
          <p className="text-xs font-semibold text-blue-600 dark:text-cyan-400">
            {roleLabel} · {myCommission ? myCommission.name : 'Sin comisión asignada'}
            {affiliationType && (
              <>
                {' · '}
                {affiliationType === 'partido'
                  ? 'Partido político'
                  : affiliationType === 'fundacion'
                  ? 'Fundación / Org.'
                  : 'Independiente'}
                {affiliationName ? ` (${affiliationName})` : ''}
              </>
            )}
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Hola, {fullName}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {roleLabel === 'Presidente'
              ? 'Convoca sesiones, aprueba actas, oficios y publicaciones, y supervisa indicadores globales.'
              : roleLabel === 'Vicepresidente'
              ? 'Supervisa el avance de las 5 comisiones, apoya la presidencia y verifica compromisos.'
              : roleLabel === 'Secretario'
              ? 'Gestiona consejeros, actas, asistencia, planillas, convocatorias y configuración del portal.'
              : 'Consulta tus compromisos, agenda, votaciones y gestiona evidencias de tu comisión.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setCustomizing((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              customizing
                ? 'bg-blue-600 text-white'
                : 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>{customizing ? 'Finalizar edición' : 'Personalizar tablero'}</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {customizing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-3xl border border-blue-200 dark:border-cyan-900/60 bg-blue-50/70 dark:bg-slate-900/90 p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    Configura tus módulos visibles y densidad
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Reordena los bloques con las flechas o elige cuáles deseas mostrar.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="inline-flex rounded-xl bg-white dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
                    {(['comodo', 'compacto'] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setPrefs((p) => ({ ...p, density: d }))}
                        className={`rounded-lg px-3 py-1 text-xs font-semibold capitalize cursor-pointer ${
                          prefs.density === d
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setPrefs(DEFAULT_PREFS)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Restablecer
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomizing(false)}
                    className="rounded-xl p-1.5 text-slate-500 hover:bg-white dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(Object.keys(WIDGET_META) as DashboardWidgetId[]).map((id) => {
                  const visible = !prefs.hidden.includes(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleVisibility(id)}
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                        visible
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      {WIDGET_META[id].title}
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KPIs reales 100% calculados de la base de datos */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Compromisos activos
          </p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
            <AnimatedCounter value={myCommitments.filter((c) => c.status !== 'cumplido').length} />
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Sesiones activas / próx.
          </p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
            <AnimatedCounter value={upcomingSessions.length} />
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Votaciones abiertas
          </p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
            <AnimatedCounter value={votes.filter((v) => v.status === 'abierta').length} />
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Mi asistencia registrada
          </p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
            <AnimatedCounter value={myAttendanceRate} suffix="%" />
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visibleWidgets.map((widgetId) => {
          if (widgetId === 'role_panel') {
            return (
              <div key={widgetId} className="lg:col-span-2">
                <DashboardWidgetCard
                  widgetId={widgetId}
                  density={prefs.density}
                  customizing={customizing}
                  canMoveUp={prefs.order.indexOf(widgetId) > 0}
                  canMoveDown={prefs.order.indexOf(widgetId) < prefs.order.length - 1}
                  onMove={(d) => moveWidget(widgetId, d)}
                  onHide={() => toggleVisibility(widgetId)}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {roleLabel === 'Presidente' && (
                      <>
                        <button
                          type="button"
                          onClick={() => onNavigate('sesiones')}
                          className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-blue-500 transition-colors cursor-pointer"
                        >
                          <CalendarClock className="h-5 w-5 text-blue-600 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              Convocar sesión
                            </p>
                            <p className="text-xs text-slate-500">Presidir y fijar agenda</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate('documentos')}
                          className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-blue-500 transition-colors cursor-pointer"
                        >
                          <FileCheck2 className="h-5 w-5 text-emerald-600 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              Aprobar oficios y actas
                            </p>
                            <p className="text-xs text-slate-500">
                              {documents.filter((d) => !d.approvedByPresidente).length} pendientes
                            </p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate('portal_editor')}
                          className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-blue-500 transition-colors cursor-pointer"
                        >
                          <Sparkles className="h-5 w-5 text-pink-600 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              Aprobar publicaciones
                            </p>
                            <p className="text-xs text-slate-500">Noticias y temas del portal</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate('planillas')}
                          className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-blue-500 transition-colors cursor-pointer"
                        >
                          <FileSpreadsheet className="h-5 w-5 text-amber-600 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              Planillas y Excel
                            </p>
                            <p className="text-xs text-slate-500">Asistencia, votos y matriz</p>
                          </div>
                        </button>
                      </>
                    )}

                    {roleLabel === 'Vicepresidente' && (
                      <>
                        <button
                          type="button"
                          onClick={() => onNavigate('comisiones')}
                          className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-blue-500 transition-colors cursor-pointer"
                        >
                          <FolderKanban className="h-5 w-5 text-blue-600 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              Supervisar comisiones
                            </p>
                            <p className="text-xs text-slate-500">Avance de Comisiones 1 a 5</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate('votaciones')}
                          className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-blue-500 transition-colors cursor-pointer"
                        >
                          <ClipboardCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              Control de compromisos
                            </p>
                            <p className="text-xs text-slate-500">Seguimiento por responsable</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate('planillas')}
                          className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-blue-500 transition-colors cursor-pointer"
                        >
                          <FileSpreadsheet className="h-5 w-5 text-indigo-600 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              Planillas consolidadas
                            </p>
                            <p className="text-xs text-slate-500">Exportar reportes XLSX/PDF</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate('sesiones')}
                          className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-blue-500 transition-colors cursor-pointer"
                        >
                          <CalendarClock className="h-5 w-5 text-pink-600 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              Apoyar sesiones
                            </p>
                            <p className="text-xs text-slate-500">Asistencia y reemplazo</p>
                          </div>
                        </button>
                      </>
                    )}

                    {roleLabel === 'Secretario' && (
                      <>
                        <button
                          type="button"
                          onClick={() => onNavigate('usuarios')}
                          className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-blue-500 transition-colors cursor-pointer"
                        >
                          <Users className="h-5 w-5 text-blue-600 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              Usuarios y Mesa
                            </p>
                            <p className="text-xs text-slate-500">Directorio y claves</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate('sesiones')}
                          className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-blue-500 transition-colors cursor-pointer"
                        >
                          <ClipboardCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              Actas y asistencia
                            </p>
                            <p className="text-xs text-slate-500">Quórum y código QR</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate('planillas')}
                          className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-blue-500 transition-colors cursor-pointer"
                        >
                          <FileSpreadsheet className="h-5 w-5 text-amber-600 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              Planillas e Importar
                            </p>
                            <p className="text-xs text-slate-500">Matrices Excel y CSV</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate('portal_editor')}
                          className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-blue-500 transition-colors cursor-pointer"
                        >
                          <Plus className="h-5 w-5 text-pink-600 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              Editor del Portal
                            </p>
                            <p className="text-xs text-slate-500">Noticias, galería y temas</p>
                          </div>
                        </button>
                      </>
                    )}

                    {roleLabel === 'Consejero' && (
                      <>
                        <button
                          type="button"
                          onClick={() => onNavigate('comisiones')}
                          className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-blue-500 transition-colors cursor-pointer"
                        >
                          <Upload className="h-5 w-5 text-blue-600 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              Mi comisión y tareas
                            </p>
                            <p className="text-xs text-slate-500">Evidencias y entregas</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate('votaciones')}
                          className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-blue-500 transition-colors cursor-pointer"
                        >
                          <Vote className="h-5 w-5 text-emerald-600 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              Votaciones
                            </p>
                            <p className="text-xs text-slate-500">Participa en decisiones</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate('buzon')}
                          className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-blue-500 transition-colors cursor-pointer"
                        >
                          <Lightbulb className="h-5 w-5 text-amber-600 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              Buzón de ideas
                            </p>
                            <p className="text-xs text-slate-500">Propón iniciativas nuevas</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate('sesiones')}
                          className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-blue-500 transition-colors cursor-pointer"
                        >
                          <CalendarClock className="h-5 w-5 text-pink-600 shrink-0" />
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              Sesiones y asistencia
                            </p>
                            <p className="text-xs text-slate-500">Registrar ingreso QR</p>
                          </div>
                        </button>
                      </>
                    )}
                  </div>
                </DashboardWidgetCard>
              </div>
            );
          }

          if (widgetId === 'commitments') {
            return (
              <DashboardWidgetCard
                key={widgetId}
                widgetId={widgetId}
                density={prefs.density}
                customizing={customizing}
                canMoveUp={prefs.order.indexOf(widgetId) > 0}
                canMoveDown={prefs.order.indexOf(widgetId) < prefs.order.length - 1}
                onMove={(d) => moveWidget(widgetId, d)}
                onHide={() => toggleVisibility(widgetId)}
                actionSlot={
                  <button
                    type="button"
                    onClick={() => onNavigate('votaciones')}
                    className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                  >
                    Ver todos
                  </button>
                }
              >
                {myCommitments.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">
                    No tienes compromisos asignados por ahora.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {myCommitments.map((c) => (
                      <div
                        key={c.id}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleCommitmentDone(c)}
                              title="Cambiar estado"
                              className={`shrink-0 rounded-full p-0.5 transition-colors cursor-pointer ${
                                c.status === 'cumplido'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-300 dark:text-slate-600 hover:text-blue-600'
                              }`}
                            >
                              <CheckCircle2 className="h-5 w-5" />
                            </button>
                            <p
                              className={`text-sm font-semibold truncate ${
                                c.status === 'cumplido'
                                  ? 'line-through text-slate-400'
                                  : 'text-slate-900 dark:text-white'
                              }`}
                            >
                              {c.title}
                            </p>
                          </div>
                          <div className="mt-1.5 pl-7 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span>{c.responsibleName}</span>
                            {c.dueDate && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono-num">Límite: {c.dueDate}</span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-num font-semibold text-blue-600 dark:text-cyan-400">
                              {c.progress}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </DashboardWidgetCard>
            );
          }

          if (widgetId === 'sessions') {
            return (
              <DashboardWidgetCard
                key={widgetId}
                widgetId={widgetId}
                density={prefs.density}
                customizing={customizing}
                canMoveUp={prefs.order.indexOf(widgetId) > 0}
                canMoveDown={prefs.order.indexOf(widgetId) < prefs.order.length - 1}
                onMove={(d) => moveWidget(widgetId, d)}
                onHide={() => toggleVisibility(widgetId)}
                actionSlot={
                  <button
                    type="button"
                    onClick={() => onNavigate('sesiones')}
                    className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                  >
                    Ir a sesiones
                  </button>
                }
              >
                {upcomingSessions.length === 0 ? (
                  <p className="text-sm text-slate-500 py-6 text-center">
                    No hay sesiones próximas programadas.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {upcomingSessions.map((ses) => (
                      <div
                        key={ses.id}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-indigo-600 dark:text-cyan-400">
                            {ses.sessionType} · <span className="font-mono-num">{ses.dateIso}</span>
                          </p>
                          <p className="mt-0.5 text-sm font-bold text-slate-900 dark:text-white truncate">
                            {ses.title}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">
                            {ses.timeRange ? `${ses.timeRange} · ` : ''}
                            {ses.location}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onNavigate('sesiones')}
                          className="shrink-0 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          Detalle
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </DashboardWidgetCard>
            );
          }

          if (widgetId === 'notifications') {
            return (
              <DashboardWidgetCard
                key={widgetId}
                widgetId={widgetId}
                density={prefs.density}
                customizing={customizing}
                canMoveUp={prefs.order.indexOf(widgetId) > 0}
                canMoveDown={prefs.order.indexOf(widgetId) < prefs.order.length - 1}
                onMove={(d) => moveWidget(widgetId, d)}
                onHide={() => toggleVisibility(widgetId)}
              >
                <div className="space-y-3">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className="rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {n.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {n.detail}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={n.onClick}
                        className="shrink-0 rounded-xl bg-slate-900 dark:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-white dark:text-slate-900 hover:opacity-90 cursor-pointer whitespace-nowrap"
                      >
                        {n.actionLabel}
                      </button>
                    </div>
                  ))}
                </div>
              </DashboardWidgetCard>
            );
          }

          // commissions_activity: cálculo real basado en tareas y metas registradas
          return (
            <DashboardWidgetCard
              key={widgetId}
              widgetId={widgetId}
              density={prefs.density}
              customizing={customizing}
              canMoveUp={prefs.order.indexOf(widgetId) > 0}
              canMoveDown={prefs.order.indexOf(widgetId) < prefs.order.length - 1}
              onMove={(d) => moveWidget(widgetId, d)}
              onHide={() => toggleVisibility(widgetId)}
              actionSlot={
                <button
                  type="button"
                  onClick={() => onNavigate('comisiones')}
                  className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
                >
                  Gestionar
                </button>
              }
            >
              <div className="space-y-3.5">
                {commissions
                  .slice()
                  .sort((a, b) => a.number - b.number)
                  .map((comm) => {
                    const commTasks = commissionTasks.filter((t) => t.commissionId === comm.id);
                    const commPlans = workPlans.filter((w) => w.commissionId === comm.id);
                    let avgProgress = 0;
                    if (commTasks.length > 0) {
                      const doneScore = commTasks.reduce(
                        (acc, t) => acc + (t.status === 'hecha' ? 100 : t.status === 'en_curso' ? 50 : 0),
                        0
                      );
                      avgProgress = Math.round(doneScore / commTasks.length);
                    } else if (commPlans.length > 0) {
                      avgProgress = Math.round(
                        commPlans.reduce((acc, w) => acc + (w.progress || 0), 0) / commPlans.length
                      );
                    }
                    const evidCount = galleryItems.filter((g) => g.commissionId === comm.id).length;
                    const isMine = comm.id === commissionId;

                    return (
                      <div key={comm.id} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {comm.name}
                            {isMine && (
                              <span className="ml-1.5 text-[10px] font-bold text-blue-600 dark:text-cyan-400">
                                (Tu comisión)
                              </span>
                            )}
                          </span>
                          <span className="font-mono-num text-slate-500 shrink-0">
                            {avgProgress}% · {commTasks.length} tareas · {evidCount} evid.
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${avgProgress}%`,
                              backgroundColor: comm.accentColor || '#2563EB',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </DashboardWidgetCard>
          );
        })}
      </div>
    </div>
  );
}
