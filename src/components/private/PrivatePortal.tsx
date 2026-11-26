import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  ChevronDown,
  Globe,
  KeyRound,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  X,
} from 'lucide-react';
import { apiRequest, triggerPortalRefresh } from '../../lib/apiClient';
import { hasPermission, isGrantActive } from '../../lib/permissions';
import type {
  AuditLog,
  CallOrSurvey,
  Commission,
  CommissionTask,
  Commitment,
  ContactMessage,
  CouncilSession,
  CouncilVote,
  CouncilorPrivate,
  DeptInterlocutionReport,
  DeptOversightRecord,
  DeptProposal,
  GalleryAlbum,
  GalleryItem,
  GrantedPermission,
  IdeaItem,
  LetterTemplate,
  NewsEvent,
  PermissionApprovalStep,
  PermissionKey,
  PermissionRequest,
  PortalActa,
  PortalDocument,
  PortalNotification,
  PortalSettings,
  PrivateModule,
  PublicCouncilor,
  SessionAgendaProposal,
  WorkPlanItem,
} from '../../types/cmj';
import { BrandLogo } from '../BrandLogo';
import { VerifiedBadge } from '../VerifiedBadge';
import { ModuleErrorBoundary } from '../ErrorBoundary';
import { OfflineIndicator, PWAInstallButton } from '../PWAInstallButton';
import { AvatarBadge } from '../public/AvatarBadge';
import { SkeletonBlock } from '../ui/AnimatedPrimitives';
import { CustomizableDashboard } from './CustomizableDashboard';
import { GlobalSearchModal, type GlobalSearchHit } from './layout/GlobalSearchModal';
import { MyProfileModal } from './layout/MyProfileModal';
import { MOBILE_QUICK_MODULES, NAV_GROUPS } from './layout/PrivateNavConfig';
import { PermissionProvider, type PermissionRequestPrefill } from './PermissionGate';

const UsersAndBoardModule = lazy(() =>
  import('./UsersAndBoardModule').then((m) => ({ default: m.UsersAndBoardModule }))
);
const CommissionsModule = lazy(() =>
  import('./CommissionsModule').then((m) => ({ default: m.CommissionsModule }))
);
const SessionsModule = lazy(() =>
  import('./SessionsModule').then((m) => ({ default: m.SessionsModule }))
);
const ActasModule = lazy(() =>
  import('./ActasModule').then((m) => ({ default: m.ActasModule }))
);
const VotesAndCommitmentsModule = lazy(() =>
  import('./VotesAndCommitmentsModule').then((m) => ({ default: m.VotesAndCommitmentsModule }))
);
const DocumentsAndArchiveModule = lazy(() =>
  import('./DocumentsAndArchiveModule').then((m) => ({ default: m.DocumentsAndArchiveModule }))
);
const SpreadsheetsModule = lazy(() =>
  import('./SpreadsheetsModule').then((m) => ({ default: m.SpreadsheetsModule }))
);
const SurveysAndMessagesModule = lazy(() =>
  import('./SurveysAndMessagesModule').then((m) => ({ default: m.SurveysAndMessagesModule }))
);
const AgendaCalendarModule = lazy(() =>
  import('./AgendaCalendarModule').then((m) => ({ default: m.AgendaCalendarModule }))
);
const IdeasBankModule = lazy(() =>
  import('./IdeasBankModule').then((m) => ({ default: m.IdeasBankModule }))
);
const LetterTemplatesModule = lazy(() =>
  import('./LetterTemplatesModule').then((m) => ({ default: m.LetterTemplatesModule }))
);
const WorkPlanAndCertsModule = lazy(() =>
  import('./WorkPlanAndCertsModule').then((m) => ({ default: m.WorkPlanAndCertsModule }))
);
const AuditLogModule = lazy(() =>
  import('./AuditLogModule').then((m) => ({ default: m.AuditLogModule }))
);
const PortalEditorModule = lazy(() =>
  import('./PortalEditorModule').then((m) => ({ default: m.PortalEditorModule }))
);
const RoleGuideModule = lazy(() =>
  import('./RoleGuideModule').then((m) => ({ default: m.RoleGuideModule }))
);
const PermissionsModule = lazy(() =>
  import('./PermissionsModule').then((m) => ({ default: m.PermissionsModule }))
);
const DepartamentalModule = lazy(() =>
  import('./DepartamentalModule').then((m) => ({ default: m.DepartamentalModule }))
);

function ModuleLoadingFallback() {
  return (
    <div className="space-y-4">
      <SkeletonBlock className="h-28 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonBlock className="h-48 w-full" />
        <SkeletonBlock className="h-48 w-full" />
      </div>
    </div>
  );
}

interface HeaderNotification {
  id: string;
  dbId?: string;
  read?: boolean;
  title: string;
  detail: string;
  module?: PrivateModule;
  action?: () => void;
}

export function PrivatePortal({
  uid,
  email,
  profile,
  privateRecord,
  commissions,
  commissionTasks,
  publicCouncilors,
  privateCouncilors,
  newsEvents,
  galleryItems,
  galleryAlbums = [],
  documents,
  actas = [],
  callsSurveys,
  contactMessages,
  sessions,
  votes,
  commitments,
  ideas,
  auditLogs,
  templates,
  workPlans,
  permissionRequests = [],
  permissionApprovalSteps = [],
  grantedPermissions = [],
  portalNotifications = [],
  deptProposals = [],
  deptOversight = [],
  deptReports = [],
  sessionAgendaProposals = [],
  coordinatorCommissionIds = [],
  effectivePermissions = [],
  settings,
  darkMode,
  onToggleDarkMode,
  onGoPublic,
  onOpenPasswordChange,
  onSignOut,
}: {
  uid: string;
  email: string;
  profile: PublicCouncilor | null;
  privateRecord: CouncilorPrivate | null;
  commissions: Commission[];
  commissionTasks: CommissionTask[];
  publicCouncilors: PublicCouncilor[];
  privateCouncilors: CouncilorPrivate[];
  newsEvents: NewsEvent[];
  galleryItems: GalleryItem[];
  galleryAlbums?: GalleryAlbum[];
  documents: PortalDocument[];
  actas?: PortalActa[];
  callsSurveys: CallOrSurvey[];
  contactMessages: ContactMessage[];
  sessions: CouncilSession[];
  votes: CouncilVote[];
  commitments: Commitment[];
  ideas: IdeaItem[];
  auditLogs: AuditLog[];
  templates: LetterTemplate[];
  workPlans: WorkPlanItem[];
  permissionRequests?: PermissionRequest[];
  permissionApprovalSteps?: PermissionApprovalStep[];
  grantedPermissions?: GrantedPermission[];
  portalNotifications?: PortalNotification[];
  deptProposals?: DeptProposal[];
  deptOversight?: DeptOversightRecord[];
  deptReports?: DeptInterlocutionReport[];
  sessionAgendaProposals?: SessionAgendaProposal[];
  coordinatorCommissionIds?: string[];
  effectivePermissions?: PermissionKey[];
  settings: PortalSettings;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onGoPublic: () => void;
  onOpenPasswordChange: () => void;
  onSignOut: () => void;
}) {
  const [activeModule, setActiveModule] = useState<PrivateModule>('resumen');
  const [preselectedSessionForActa, setPreselectedSessionForActa] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [permissionPrefill, setPermissionPrefill] = useState<PermissionRequestPrefill | null>(null);

  const roleLabel = privateRecord?.roleLabel || profile?.roleLabel || 'Consejero';
  const accessTier = privateRecord?.accessTier || 'tier_4_member';
  const commissionId = profile?.commissionId ?? privateRecord?.commissionId ?? '';
  const fullName = profile?.fullName || email.split('@')[0] || 'Consejero CMJ';
  const inSession = sessions.some((s) => s.status === 'en_curso');

  const computedCoordinatorIds = useMemo(() => {
    const fromComms = commissions
      .filter((c) => c.coordinatorUid === uid)
      .map((c) => c.id);
    return Array.from(new Set([...coordinatorCommissionIds, ...fromComms]));
  }, [commissions, coordinatorCommissionIds, uid]);

  const myActiveGrants = useMemo(
    () => grantedPermissions.filter((g) => g.userUid === uid && isGrantActive(g)),
    [grantedPermissions, uid]
  );

  const can = React.useCallback(
    (permission: PermissionKey, targetCommissionId?: string) =>
      hasPermission(
        {
          roleLabel,
          active: privateRecord?.active ?? true,
          coordinatorCommissionIds: computedCoordinatorIds,
          grantedPermissions: myActiveGrants,
          effectivePermissions,
        },
        permission,
        targetCommissionId
      ),
    [roleLabel, privateRecord?.active, computedCoordinatorIds, myActiveGrants, effectivePermissions]
  );

  const pendingApprovalsForMe = useMemo(() => {
    const canPres = can('permisos.aprobar_presidencia');
    const canVp = can('permisos.aprobar_vicepresidencia');
    const canSec = can('permisos.aprobar_secretaria');
    return permissionRequests.filter((r) => {
      if (r.requesterUid === uid) return false;
      if (r.status === 'pendiente_presidente' && canPres) return true;
      if (r.status === 'pendiente_vicepresidente' && canVp) return true;
      if (r.status === 'pendiente_secretario' && canSec) return true;
      return permissionApprovalSteps.some(
        (s) =>
          s.requestId === r.id &&
          s.status === 'pendiente' &&
          s.expectedApproverUid === uid
      );
    }).length;
  }, [can, permissionRequests, permissionApprovalSteps, uid]);

  const handleOpenRequestPermission = React.useCallback((prefill?: PermissionRequestPrefill) => {
    setPermissionPrefill(prefill || null);
    setActiveModule('permisos');
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setNotificationsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const visibleGroups = useMemo(
    () =>
      NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (item.id === 'usuarios') return can('usuarios.ver');
          if (item.id === 'auditoria') return can('auditoria.ver');
          if (item.id === 'departamental') {
            return can('departamental.ver') || can('departamental.publicacion_aprobar');
          }
          return true;
        }),
      })).filter((group) => group.items.length > 0),
    [can]
  );

  const visibleNav = useMemo(() => visibleGroups.flatMap((g) => g.items), [visibleGroups]);

  const mobileQuickItems = useMemo(
    () =>
      MOBILE_QUICK_MODULES.map((id) => visibleNav.find((item) => item.id === id)).filter(
        (item): item is NonNullable<typeof item> => Boolean(item)
      ),
    [visibleNav]
  );

  const notifications = useMemo<HeaderNotification[]>(() => {
    const list: HeaderNotification[] = [];
    const todayIso = new Date().toISOString().slice(0, 10);

    portalNotifications
      .filter((n) => !n.read)
      .slice(0, 12)
      .forEach((n) => {
        list.push({
          id: `db-${n.id}`,
          dbId: n.id,
          read: n.read,
          title: n.title,
          detail: n.message,
          module: (n.linkModule as PrivateModule) || 'permisos',
        });
      });

    if (pendingApprovalsForMe > 0) {
      list.push({
        id: 'perm-approvals-pending',
        title: `${pendingApprovalsForMe} solicitud(es) de permiso por decidir`,
        detail: 'Tienes revisiones pendientes en el flujo secuencial CMJ.',
        module: 'permisos',
      });
    }

    if (privateRecord?.mustChangePassword) {
      list.push({
        id: 'pwd',
        title: 'Actualiza tu contraseña inicial',
        detail: 'Se recomienda definir una contraseña personal de seguridad.',
        action: onOpenPasswordChange,
      });
    }

    sessions
      .filter((s) => s.status === 'en_curso')
      .forEach((s) =>
        list.push({
          id: `ses-${s.id}`,
          title: `Sesión en curso: ${s.title}`,
          detail: 'Ingresa para registrar asistencia o gestionar el quórum.',
          module: 'sesiones',
        })
      );

    votes
      .filter((v) => v.status === 'abierta' && !v.voterUids.includes(uid))
      .forEach((v) =>
        list.push({
          id: `vote-${v.id}`,
          title: `Votación pendiente: ${v.title}`,
          detail: 'Tu voto aún no ha sido registrado en esta consulta interna.',
          module: 'votaciones',
        })
      );

    commitments
      .filter(
        (c) =>
          c.responsibleUid === uid &&
          c.status !== 'cumplido' &&
          c.dueDate &&
          c.dueDate <= todayIso
      )
      .forEach((c) =>
        list.push({
          id: `comp-${c.id}`,
          title: `Compromiso vencido o por vencer: ${c.title}`,
          detail: `Fecha límite: ${c.dueDate}`,
          module: 'votaciones',
        })
      );

    if (can('noticias.publicar')) {
      const pendingNews = newsEvents.filter((n) => n.status === 'pendiente').length;
      if (pendingNews > 0) {
        list.push({
          id: 'pending-news',
          title: `${pendingNews} publicación(es) esperando aprobación`,
          detail: 'Revisa y aprueba las noticias enviadas por los consejeros.',
          module: 'portal_editor',
        });
      }
    }
    if (can('buzon.responder')) {
      const unreadMsgs = contactMessages.filter((m) => m.status === 'nuevo').length;
      if (unreadMsgs > 0) {
        list.push({
          id: 'unread-msgs',
          title: `${unreadMsgs} mensaje(s) ciudadanos sin responder`,
          detail: 'Atiende los mensajes recibidos en el buzón público.',
          module: 'encuestas',
        });
      }
    }

    if (can('departamental.publicacion_aprobar')) {
      const pendingDeptCount =
        deptProposals.filter((p) => p.publicationStatus === 'pendiente_presidencia').length +
        deptOversight.filter((o) => o.publicationStatus === 'pendiente_presidencia').length +
        deptReports.filter((r) => r.publicationStatus === 'pendiente_presidencia').length;
      if (pendingDeptCount > 0) {
        list.push({
          id: 'pending-dept-pub',
          title: `${pendingDeptCount} publicación(es) departamentales por aprobar`,
          detail:
            'Propuestas, veedurías o informes del Consejero Departamental esperan revisión de Presidencia.',
          module: 'departamental',
        });
      }
    }

    return list;
  }, [
    portalNotifications,
    pendingApprovalsForMe,
    privateRecord?.mustChangePassword,
    onOpenPasswordChange,
    sessions,
    votes,
    uid,
    commitments,
    can,
    newsEvents,
    contactMessages,
    deptProposals,
    deptOversight,
    deptReports,
  ]);

  const searchHits = useMemo<GlobalSearchHit[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    const hits: GlobalSearchHit[] = [];

    visibleNav.forEach((nav) => {
      if (q && nav.label.toLowerCase().includes(q)) {
        hits.push({
          id: `nav-${nav.id}`,
          title: nav.label,
          subtitle: 'Ir directamente al módulo',
          module: nav.id,
          badge: 'Módulo',
        });
      }
    });

    publicCouncilors.forEach((c) => {
      if (
        !q ||
        c.fullName.toLowerCase().includes(q) ||
        c.roleLabel.toLowerCase().includes(q) ||
        (c.commissionName || '').toLowerCase().includes(q)
      ) {
        hits.push({
          id: `c-${c.id}`,
          title: c.fullName,
          subtitle: `${c.roleLabel} · ${c.commissionName || 'Sin comisión'}`,
          module: can('usuarios.ver') ? 'usuarios' : 'comisiones',
          badge: 'Consejero',
        });
      }
    });

    sessions.forEach((s) => {
      if (!q || s.title.toLowerCase().includes(q) || s.dateIso.includes(q)) {
        hits.push({
          id: `s-${s.id}`,
          title: s.title,
          subtitle: `${s.dateIso} · ${s.location}`,
          module: 'sesiones',
          badge: 'Sesión',
        });
      }
    });

    actas.forEach((a) => {
      if (
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.consecutive.toLowerCase().includes(q) ||
        a.status.toLowerCase().includes(q)
      ) {
        hits.push({
          id: `a-${a.id}`,
          title: `${a.consecutive} — ${a.title}`,
          subtitle: `${a.meetingDate} · ${a.status}`,
          module: 'actas',
          badge: 'Acta',
        });
      }
    });

    votes.forEach((v) => {
      if (!q || v.title.toLowerCase().includes(q)) {
        hits.push({
          id: `v-${v.id}`,
          title: v.title,
          subtitle: `Estado: ${v.status}`,
          module: 'votaciones',
          badge: 'Votación',
        });
      }
    });

    documents.forEach((d) => {
      if (
        !q ||
        d.title.toLowerCase().includes(q) ||
        d.category.toLowerCase().includes(q) ||
        d.fileName.toLowerCase().includes(q)
      ) {
        hits.push({
          id: `d-${d.id}`,
          title: d.title,
          subtitle: `${d.category} · v${d.version}`,
          module: 'documentos',
          badge: 'Documento',
        });
      }
    });

    newsEvents.forEach((n) => {
      if (!q || n.title.toLowerCase().includes(q)) {
        hits.push({
          id: `n-${n.id}`,
          title: n.title,
          subtitle: `${n.type} · ${n.status}`,
          module: 'portal_editor',
          badge: 'Noticia',
        });
      }
    });

    if (can('departamental.ver') || can('departamental.publicacion_aprobar')) {
      deptProposals.forEach((p) => {
        if (!q || p.title.toLowerCase().includes(q) || p.targetEntity.toLowerCase().includes(q)) {
          hits.push({
            id: `dp-${p.id}`,
            title: p.title,
            subtitle: `Propuesta Dept. · ${p.targetEntity}`,
            module: 'departamental',
            badge: 'Departamental',
          });
        }
      });
      deptOversight.forEach((o) => {
        if (!q || o.title.toLowerCase().includes(q) || o.watchedEntity.toLowerCase().includes(q)) {
          hits.push({
            id: `do-${o.id}`,
            title: o.title,
            subtitle: `Veeduría · ${o.watchedEntity}`,
            module: 'departamental',
            badge: 'Departamental',
          });
        }
      });
      deptReports.forEach((r) => {
        if (!q || r.title.toLowerCase().includes(q) || r.reportPeriod.toLowerCase().includes(q)) {
          hits.push({
            id: `dr-${r.id}`,
            title: r.title,
            subtitle: `Informe · ${r.reportPeriod}`,
            module: 'departamental',
            badge: 'Departamental',
          });
        }
      });
    }

    return hits.slice(0, 16);
  }, [
    searchQuery,
    visibleNav,
    publicCouncilors,
    sessions,
    actas,
    votes,
    documents,
    newsEvents,
    deptProposals,
    deptOversight,
    deptReports,
    can,
  ]);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const renderGroupedNavigation = (onPick?: () => void) => (
    <div className="space-y-4">
      {visibleGroups.map((group) => {
        const isCollapsed = Boolean(collapsedGroups[group.id]);
        return (
          <div key={group.id} className="space-y-1">
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              className="w-full flex items-center justify-between px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
            >
              <span>{group.label}</span>
              <ChevronDown
                className={`h-3 w-3 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
              />
            </button>
            {!isCollapsed && (
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = activeModule === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveModule(item.id);
                        onPick?.();
                      }}
                      className={`relative w-full min-h-[38px] flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                        active
                          ? 'text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId={onPick ? 'mobile-nav-active' : 'private-nav-active'}
                          transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                          className="absolute inset-0 rounded-xl bg-emerald-700 shadow-sm"
                        />
                      )}
                      <span className="relative z-10 flex items-center justify-between gap-2 w-full min-w-0">
                        <span className="flex items-center gap-2.5 min-w-0">
                          {item.icon}
                          <span className="truncate">{item.label}</span>
                        </span>
                        {item.id === 'permisos' && pendingApprovalsForMe > 0 && (
                          <span
                            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold font-mono-num ${
                              active
                                ? 'bg-white text-emerald-800'
                                : 'bg-amber-500 text-white'
                            }`}
                          >
                            {pendingApprovalsForMe}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <PermissionProvider
      uid={uid}
      roleLabel={roleLabel}
      coordinatorCommissionIds={computedCoordinatorIds}
      grantedPermissions={myActiveGrants}
      effectivePermissions={effectivePermissions}
      onRequestPermission={handleOpenRequestPermission}
    >
      <div className="min-h-screen bg-slate-50 dark:bg-[#070B14] text-slate-900 dark:text-slate-100 flex">
        {/* Sidebar Desktop */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 no-print sticky top-0 h-screen">
          <div className="flex items-center gap-3 px-2 pb-4 border-b border-slate-100 dark:border-slate-800">
            <BrandLogo size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-extrabold truncate">CMJ Flandes</p>
              <p
                className={`text-[11px] font-semibold truncate ${
                  roleLabel === 'Consejero Departamental'
                    ? 'text-purple-700 dark:text-purple-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                {roleLabel}
              </p>
            </div>
          </div>

        <nav
          aria-label="Menú principal del portal privado"
          className="flex-1 overflow-y-auto py-3 pr-1"
        >
          {renderGroupedNavigation()}
        </nav>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1">
          <button
            type="button"
            onClick={onGoPublic}
            className="w-full min-h-[38px] flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Globe className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
            Ver portal público
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="w-full min-h-[38px] flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-3 no-print">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Abrir menú lateral"
              className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate text-slate-900 dark:text-white">
                {visibleNav.find((n) => n.id === activeModule)?.label || 'Mi Tablero'}
              </p>
              <p className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Consejo Municipal de Juventudes · Flandes, Tolima
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2 relative shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              title="Búsqueda global (Ctrl+K)"
              aria-label="Búsqueda global"
              className="min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-0 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-500 hover:border-emerald-600 cursor-pointer"
            >
              <Search className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              <span className="hidden md:inline">Buscar...</span>
              <kbd className="hidden lg:inline rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[10px] font-mono-num">
                Ctrl+K
              </kbd>
            </button>

            <PWAInstallButton compact />

            {/* Notificaciones */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificationsOpen((v) => !v)}
                aria-label="Abrir notificaciones"
                className="relative min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Bell className="h-4 w-4" />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 h-4 min-w-[16px] rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white flex items-center justify-center font-mono-num">
                    {notifications.length}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-3 space-y-2 z-50">
                  <div className="flex items-center justify-between gap-2 px-1 pb-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold">
                      Notificaciones ({notifications.length})
                    </span>
                    <div className="flex items-center gap-1.5">
                      {portalNotifications.some((n) => !n.read) && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await apiRequest('/api/notifications/read-all', { method: 'POST' });
                              triggerPortalRefresh();
                            } catch {
                              // ignore
                            }
                          }}
                          className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          Marcar todo leído
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setNotificationsOpen(false)}
                        aria-label="Cerrar notificaciones"
                        className="text-slate-400 hover:text-slate-700 cursor-pointer p-1"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4 text-center">
                      Todo al día. No tienes alertas pendientes.
                    </p>
                  ) : (
                    <div className="max-h-72 overflow-y-auto space-y-1.5">
                      {notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={async () => {
                            setNotificationsOpen(false);
                            if (n.dbId) {
                              apiRequest(`/api/notifications/${n.dbId}/read`, { method: 'PATCH' })
                                .then(() => triggerPortalRefresh())
                                .catch(() => undefined);
                            }
                            if (n.action) n.action();
                            else if (n.module) setActiveModule(n.module);
                          }}
                          className="w-full text-left rounded-xl border border-slate-100 dark:border-slate-800 p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/70 cursor-pointer space-y-0.5"
                        >
                          <p className="text-xs font-bold text-slate-900 dark:text-white">
                            {n.title}
                          </p>
                          <p className="text-[11px] text-slate-500">{n.detail}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onToggleDarkMode}
              aria-label="Cambiar modo visual"
              className="min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onOpenPasswordChange}
              title="Cambiar contraseña"
              aria-label="Cambiar contraseña"
              className="hidden sm:flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <KeyRound className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setProfileModalOpen(true)}
              aria-label="Abrir mi perfil"
              className="min-h-[44px] sm:min-h-[40px] flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-2 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <AvatarBadge
                name={fullName}
                photoUrl={profile?.photoUrl}
                thumbUrl={profile?.photoThumbUrl}
                mediumUrl={profile?.photoMediumUrl}
                accentColor={commissions.find((c) => c.id === commissionId)?.accentColor}
                statusIndicator={inSession ? 'in_session' : 'active'}
                size="sm"
              />
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold leading-none flex items-center gap-1">
                  <span className="truncate max-w-[130px]">{fullName}</span>
                  {profile?.verificado && <VerifiedBadge size="xs" />}
                </p>
                <p
                  className={`text-[10px] font-semibold mt-0.5 ${
                    roleLabel === 'Consejero Departamental'
                      ? 'text-purple-700 dark:text-purple-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {roleLabel}
                </p>
              </div>
            </button>
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm lg:hidden flex"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-72 max-w-[85vw] bg-white dark:bg-slate-950 h-[100dvh] p-4 pb-safe-bottom flex flex-col shadow-2xl"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <BrandLogo size="sm" />
                  <span className="font-extrabold text-sm">Portal Privado CMJ</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(false)}
                  aria-label="Cerrar menú"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-3">
                {renderGroupedNavigation(() => setMobileSidebarOpen(false))}
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
                <button
                  type="button"
                  onClick={onOpenPasswordChange}
                  className="w-full min-h-[40px] flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  <KeyRound className="h-4 w-4 text-slate-500" /> Cambiar contraseña
                </button>
                <button
                  type="button"
                  onClick={onGoPublic}
                  className="w-full min-h-[40px] flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                >
                  <Globe className="h-4 w-4" /> Portal público
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="w-full min-h-[40px] flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600"
                >
                  <LogOut className="h-4 w-4" /> Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 max-w-7xl w-full mx-auto">
          <ModuleErrorBoundary key={activeModule} moduleName={activeModule}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeModule}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
              >
                <Suspense fallback={<ModuleLoadingFallback />}>
                  {activeModule === 'resumen' && (
                    <CustomizableDashboard
                      uid={uid}
                      fullName={fullName}
                      roleLabel={roleLabel}
                      commissionId={commissionId}
                      affiliationType={profile?.affiliationType}
                      affiliationName={profile?.affiliationName}
                      mustChangePassword={Boolean(privateRecord?.mustChangePassword)}
                      commissions={commissions}
                      commissionTasks={commissionTasks}
                      commitments={commitments}
                      sessions={sessions}
                      votes={votes}
                      newsEvents={newsEvents}
                      documents={documents}
                      galleryItems={galleryItems}
                      workPlans={workPlans}
                      contactMessages={contactMessages}
                      onNavigate={setActiveModule}
                      onOpenPasswordChange={onOpenPasswordChange}
                    />
                  )}

                  {activeModule === 'usuarios' && can('usuarios.ver') && (
                    <UsersAndBoardModule
                      uid={uid}
                      actorName={fullName}
                      actorRoleLabel={roleLabel}
                      commissions={commissions}
                      publicCouncilors={publicCouncilors}
                      privateCouncilors={privateCouncilors}
                      grantedPermissions={grantedPermissions}
                    />
                  )}

                  {activeModule === 'comisiones' && (
                    <CommissionsModule
                      uid={uid}
                      actorName={fullName}
                      actorRoleLabel={roleLabel}
                      accessTier={accessTier}
                      myCommissionId={commissionId}
                      commissions={commissions}
                      commissionTasks={commissionTasks}
                      publicCouncilors={publicCouncilors}
                      documents={documents}
                      galleryItems={galleryItems}
                    />
                  )}

                  {activeModule === 'sesiones' && (
                    <SessionsModule
                      uid={uid}
                      actorName={fullName}
                      actorRoleLabel={roleLabel}
                      accessTier={accessTier}
                      sessions={sessions}
                      commissions={commissions}
                      publicCouncilors={publicCouncilors}
                      sessionAgendaProposals={sessionAgendaProposals}
                      onOpenActas={(sessionId) => {
                        setPreselectedSessionForActa(sessionId);
                        setActiveModule('actas');
                      }}
                    />
                  )}

                  {activeModule === 'actas' && (
                    <ActasModule
                      uid={uid}
                      actorName={fullName}
                      actorRoleLabel={roleLabel}
                      accessTier={accessTier}
                      actas={actas}
                      sessions={sessions}
                      votes={votes}
                      commissions={commissions}
                      publicCouncilors={publicCouncilors}
                      preselectedSessionId={preselectedSessionForActa}
                      onClearPreselectedSession={() => setPreselectedSessionForActa(null)}
                    />
                  )}

                  {activeModule === 'votaciones' && (
                    <VotesAndCommitmentsModule
                      uid={uid}
                      actorName={fullName}
                      actorRoleLabel={roleLabel}
                      accessTier={accessTier}
                      commissions={commissions}
                      sessions={sessions}
                      publicCouncilors={publicCouncilors}
                      votes={votes}
                      commitments={commitments}
                    />
                  )}

                  {activeModule === 'planillas' && (
                    <SpreadsheetsModule
                      uid={uid}
                      actorName={fullName}
                      actorRoleLabel={roleLabel}
                      commissions={commissions}
                      commissionTasks={commissionTasks}
                      publicCouncilors={publicCouncilors}
                      privateCouncilors={privateCouncilors}
                      sessions={sessions}
                      votes={votes}
                      commitments={commitments}
                    />
                  )}

                  {activeModule === 'documentos' && (
                    <DocumentsAndArchiveModule
                      uid={uid}
                      actorName={fullName}
                      actorRoleLabel={roleLabel}
                      accessTier={accessTier}
                      commissions={commissions}
                      documents={documents}
                    />
                  )}

                  {activeModule === 'encuestas' && (
                    <SurveysAndMessagesModule
                      uid={uid}
                      actorName={fullName}
                      actorRoleLabel={roleLabel}
                      accessTier={accessTier}
                      callsSurveys={callsSurveys}
                      contactMessages={contactMessages}
                    />
                  )}

                  {activeModule === 'agenda' && (
                    <AgendaCalendarModule
                      sessions={sessions}
                      newsEvents={newsEvents}
                      commitments={commitments}
                    />
                  )}

                  {activeModule === 'buzon' && (
                    <IdeasBankModule
                      uid={uid}
                      actorName={fullName}
                      actorRoleLabel={roleLabel}
                      accessTier={accessTier}
                      commissions={commissions}
                      ideas={ideas}
                      publicCouncilors={publicCouncilors}
                    />
                  )}

                  {activeModule === 'plantillas' && (
                    <LetterTemplatesModule
                      uid={uid}
                      actorName={fullName}
                      accessTier={accessTier}
                      templates={templates}
                    />
                  )}

                  {activeModule === 'plan_trabajo' && (
                    <WorkPlanAndCertsModule
                      actorName={fullName}
                      commissions={commissions}
                      workPlans={workPlans}
                    />
                  )}

                  {activeModule === 'auditoria' && can('auditoria.ver') && (
                    <AuditLogModule auditLogs={auditLogs} />
                  )}

                  {activeModule === 'permisos' && (
                    <PermissionsModule
                      uid={uid}
                      roleLabel={roleLabel}
                      commissions={commissions}
                      publicCouncilors={publicCouncilors}
                      privateCouncilors={privateCouncilors}
                      permissionRequests={permissionRequests}
                      permissionApprovalSteps={permissionApprovalSteps}
                      grantedPermissions={grantedPermissions}
                      prefill={permissionPrefill}
                      onClearPrefill={() => setPermissionPrefill(null)}
                    />
                  )}

                  {activeModule === 'portal_editor' && (
                    <PortalEditorModule
                      uid={uid}
                      actorName={fullName}
                      actorRoleLabel={roleLabel}
                      settings={settings}
                      commissions={commissions}
                      newsEvents={newsEvents}
                      galleryItems={galleryItems}
                      galleryAlbums={galleryAlbums}
                    />
                  )}

                  {activeModule === 'departamental' &&
                    (can('departamental.ver') || can('departamental.publicacion_aprobar')) && (
                      <DepartamentalModule
                        uid={uid}
                        actorName={fullName}
                        actorRoleLabel={roleLabel}
                        commissions={commissions}
                        deptProposals={deptProposals}
                        deptOversight={deptOversight}
                        deptReports={deptReports}
                      />
                    )}

                  {activeModule === 'guia' && <RoleGuideModule roleLabel={roleLabel} />}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </ModuleErrorBoundary>
        </main>
      </div>

      {/* Barra Inferior Móvil (<= 15% altura, botones >= 44x44px) */}
      <nav
        aria-label="Navegación rápida móvil"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 min-h-16 h-auto pt-1 pb-safe-bottom border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md px-2 grid grid-cols-5 items-center no-print"
      >
        {mobileQuickItems.map((item) => {
          const active = activeModule === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveModule(item.id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 transition-colors cursor-pointer ${
                active
                  ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400 font-medium'
              }`}
            >
              {item.icon}
              <span className="text-[10px] leading-tight truncate max-w-full">
                {item.shortLabel}
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-slate-600 dark:text-slate-300 font-medium cursor-pointer"
        >
          <Menu className="h-4 w-4" />
          <span className="text-[10px] leading-tight">Menú</span>
        </button>
      </nav>

      <OfflineIndicator />

      <GlobalSearchModal
        open={searchOpen}
        query={searchQuery}
        hits={searchHits}
        onQueryChange={setSearchQuery}
        onSelect={(mod) => setActiveModule(mod)}
        onClose={() => {
          setSearchOpen(false);
          setSearchQuery('');
        }}
      />

      <MyProfileModal
        open={profileModalOpen}
        uid={uid}
        email={email}
        fullName={fullName}
        canEditCommission={can('usuarios.editar')}
        inSession={inSession}
        profile={profile}
        privateRecord={privateRecord}
        commissions={commissions}
        commissionId={commissionId}
        onClose={() => setProfileModalOpen(false)}
      />
      </div>
    </PermissionProvider>
  );
}
export default PrivatePortal;
