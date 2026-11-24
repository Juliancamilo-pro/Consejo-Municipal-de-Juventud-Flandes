import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Award,
  Bell,
  BookOpen,
  Calendar,
  CalendarClock,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FolderArchive,
  FolderKanban,
  Globe,
  History,
  KeyRound,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Palette,
  Search,
  Sun,
  Trash2,
  UserCheck,
  Users,
  Vote,
  X,
} from 'lucide-react';
import { ApiRequestError, apiRequest } from '../../lib/apiClient';
import { isLeadershipTier } from '../../lib/security';
import { deleteStorageFile } from '../../lib/storageUtils';
import type {
  AffiliationType,
  AuditLog,
  CallOrSurvey,
  Commission,
  CommissionTask,
  Commitment,
  ContactMessage,
  CouncilSession,
  CouncilVote,
  CouncilorPrivate,
  GalleryAlbum,
  GalleryItem,
  IdeaItem,
  LetterTemplate,
  NewsEvent,
  PortalActa,
  PortalDocument,
  PortalSettings,
  PrivateModule,
  PublicCouncilor,
  WorkPlanItem,
} from '../../types/cmj';
import { BrandLogo } from '../BrandLogo';
import { ModuleErrorBoundary } from '../ErrorBoundary';
import { MediaUploader, type UploadedFileInfo } from '../MediaUploader';
import { OfflineIndicator, PWAInstallButton } from '../PWAInstallButton';
import { AvatarBadge } from '../public/AvatarBadge';
import { useToast } from '../ToastProvider';
import { SkeletonBlock } from '../ui/AnimatedPrimitives';
import { CustomizableDashboard } from './CustomizableDashboard';

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

interface SearchHit {
  id: string;
  title: string;
  subtitle: string;
  module: PrivateModule;
  badge: string;
}

interface HeaderNotification {
  id: string;
  title: string;
  detail: string;
  module?: PrivateModule;
  action?: () => void;
  tone: 'amber' | 'blue' | 'emerald' | 'rose';
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
  settings: PortalSettings;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onGoPublic: () => void;
  onOpenPasswordChange: () => void;
  onSignOut: () => void;
}) {
  const { showToast } = useToast();
  const [activeModule, setActiveModule] = useState<PrivateModule>('resumen');
  const [preselectedSessionForActa, setPreselectedSessionForActa] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const roleLabel = privateRecord?.roleLabel || profile?.roleLabel || 'Consejero';
  const accessTier = privateRecord?.accessTier || 'tier_4_member';
  const isLeader = isLeadershipTier(accessTier);
  const commissionId = profile?.commissionId ?? privateRecord?.commissionId ?? '';
  const fullName = profile?.fullName || email.split('@')[0] || 'Consejero CMJ';

  const [editBio, setEditBio] = useState(profile?.bio || '');
  const [editIg, setEditIg] = useState(profile?.instagram || '');
  const [editFb, setEditFb] = useState(profile?.facebook || '');
  const [editEmail, setEditEmail] = useState(profile?.email || privateRecord?.email || email);
  const [editPhone, setEditPhone] = useState(privateRecord?.phone || profile?.phone || '');
  const [editName, setEditName] = useState(fullName);
  const [editCommissionId, setEditCommissionId] = useState(commissionId);
  const [editAffiliationType, setEditAffiliationType] = useState<AffiliationType>(
    profile?.affiliationType || ''
  );
  const [editAffiliationName, setEditAffiliationName] = useState(profile?.affiliationName || '');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (profileModalOpen) {
      setEditName(fullName);
      setEditBio(profile?.bio || '');
      setEditIg(profile?.instagram || '');
      setEditFb(profile?.facebook || '');
      setEditEmail(profile?.email || privateRecord?.email || email);
      setEditPhone(privateRecord?.phone || profile?.phone || '');
      setEditCommissionId(commissionId);
      setEditAffiliationType(profile?.affiliationType || '');
      setEditAffiliationName(profile?.affiliationName || '');
    }
  }, [profileModalOpen, fullName, profile, privateRecord, email, commissionId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotificationsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const navItems: {
    id: PrivateModule;
    label: string;
    icon: React.ReactNode;
    leaderOnly?: boolean;
  }[] = [
    { id: 'resumen', label: 'Mi Tablero', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'comisiones', label: 'Comisiones (1–5)', icon: <FolderKanban className="h-4 w-4" /> },
    { id: 'sesiones', label: 'Sesiones y Asistencia', icon: <CalendarClock className="h-4 w-4" /> },
    { id: 'actas', label: 'Actas Oficiales', icon: <FileCheck2 className="h-4 w-4" /> },
    { id: 'votaciones', label: 'Votos y Compromisos', icon: <Vote className="h-4 w-4" /> },
    { id: 'planillas', label: 'Planillas y Excel', icon: <FileSpreadsheet className="h-4 w-4" /> },
    { id: 'documentos', label: 'Documentos', icon: <FolderArchive className="h-4 w-4" /> },
    { id: 'agenda', label: 'Agenda', icon: <Calendar className="h-4 w-4" /> },
    { id: 'buzon', label: 'Buzón de Ideas', icon: <Lightbulb className="h-4 w-4" /> },
    { id: 'plan_trabajo', label: 'Plan de Trabajo', icon: <Award className="h-4 w-4" /> },
    { id: 'plantillas', label: 'Plantillas de Oficios', icon: <FileText className="h-4 w-4" /> },
    { id: 'encuestas', label: 'Encuestas y Mensajes', icon: <MessageSquare className="h-4 w-4" /> },
    { id: 'portal_editor', label: 'Editor Portal y Galería', icon: <Palette className="h-4 w-4" /> },
    {
      id: 'usuarios',
      label: 'Usuarios y Mesa',
      icon: <Users className="h-4 w-4" />,
      leaderOnly: true,
    },
    {
      id: 'auditoria',
      label: 'Auditoría',
      icon: <History className="h-4 w-4" />,
      leaderOnly: true,
    },
    { id: 'guia', label: 'Guía CMJ', icon: <BookOpen className="h-4 w-4" /> },
  ];

  const visibleNav = navItems.filter((n) => !n.leaderOnly || isLeader);

  const notifications = useMemo<HeaderNotification[]>(() => {
    const list: HeaderNotification[] = [];
    const todayIso = new Date().toISOString().slice(0, 10);

    if (privateRecord?.mustChangePassword) {
      list.push({
        id: 'pwd',
        title: 'Actualiza tu contraseña inicial',
        detail: 'Se recomienda definir una contraseña personal de seguridad.',
        action: onOpenPasswordChange,
        tone: 'rose',
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
          tone: 'emerald',
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
          tone: 'blue',
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
          tone: 'amber',
        })
      );

    if (isLeader) {
      const pendingNews = newsEvents.filter((n) => n.status === 'pendiente').length;
      if (pendingNews > 0) {
        list.push({
          id: 'pending-news',
          title: `${pendingNews} publicación(es) esperando aprobación`,
          detail: 'Revisa y aprueba las noticias enviadas por los consejeros.',
          module: 'portal_editor',
          tone: 'amber',
        });
      }
      const unreadMsgs = contactMessages.filter((m) => m.status === 'nuevo').length;
      if (unreadMsgs > 0) {
        list.push({
          id: 'unread-msgs',
          title: `${unreadMsgs} mensaje(s) ciudadanos sin responder`,
          detail: 'Atiende los mensajes recibidos en el buzón público.',
          module: 'encuestas',
          tone: 'blue',
        });
      }
    }

    return list;
  }, [
    privateRecord?.mustChangePassword,
    onOpenPasswordChange,
    sessions,
    votes,
    uid,
    commitments,
    isLeader,
    newsEvents,
    contactMessages,
  ]);

  const searchHits = useMemo<SearchHit[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    const hits: SearchHit[] = [];

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
          module: isLeader ? 'usuarios' : 'comisiones',
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

    return hits.slice(0, 14);
  }, [searchQuery, publicCouncilors, sessions, actas, votes, documents, newsEvents, isLeader]);

  const handleAvatarUpload = async (files: UploadedFileInfo[]) => {
    const first = files[0];
    if (!first) return;
    try {
      if (profile?.storagePath) {
        await deleteStorageFile(profile.storagePath, profile.photoUrl);
      }
      await apiRequest(`/api/councilors/${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        body: {
          photoUrl: first.url,
          photoThumbUrl: first.thumbUrl || first.thumbnailUrl || first.url,
          photoMediumUrl: first.mediumUrl || first.url,
          storagePath: first.storagePath || '',
        },
      });
      showToast('Foto de perfil actualizada', 'success');
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : 'No se pudo actualizar la foto de perfil';
      showToast(msg, 'error');
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      if (profile?.storagePath) {
        await deleteStorageFile(profile.storagePath, profile.photoUrl);
      }
      await apiRequest(`/api/councilors/${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        body: {
          photoUrl: '',
          photoThumbUrl: '',
          photoMediumUrl: '',
          storagePath: '',
        },
      });
      showToast('Foto de perfil eliminada', 'info');
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.message : 'No se pudo quitar la foto de perfil';
      showToast(msg, 'error');
    }
  };

  const handleSaveMyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const payload: Record<string, unknown> = {
        fullName: editName.trim() || fullName,
        bio: editBio.trim(),
        instagram: editIg.trim(),
        facebook: editFb.trim(),
        email: editEmail.trim().toLowerCase(),
        phone: editPhone.trim(),
        affiliationType: editAffiliationType,
        affiliationName: editAffiliationName.trim(),
      };
      if (isLeader) {
        payload.commissionId = editCommissionId;
      }
      await apiRequest(`/api/councilors/${encodeURIComponent(uid)}`, {
        method: 'PATCH',
        body: payload,
      });
      setProfileModalOpen(false);
      showToast('Perfil actualizado correctamente', 'success');
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.message : 'Error al actualizar perfil';
      showToast(msg, 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100 flex">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 no-print">
        <div className="flex items-center gap-3 px-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <BrandLogo size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-extrabold truncate">CMJ Flandes</p>
            <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 truncate">
              {roleLabel}
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 space-y-1">
          {visibleNav.map((item) => {
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveModule(item.id)}
                className={`relative w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                  active
                    ? 'text-white'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="private-nav-active"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-blue-600 shadow-sm"
                  />
                )}
                <span className="relative z-10 flex items-center gap-2.5 min-w-0">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
          <button
            type="button"
            onClick={onGoPublic}
            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Globe className="h-4 w-4 text-blue-600" />
            Ver portal público
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Abrir menú lateral"
              className="lg:hidden rounded-xl p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="text-sm font-bold truncate">
              {visibleNav.find((n) => n.id === activeModule)?.label || 'Mi Tablero'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 relative">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              title="Búsqueda global (Ctrl+K)"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-500 hover:border-blue-500 cursor-pointer"
            >
              <Search className="h-3.5 w-3.5" />
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
                className="relative rounded-xl p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Bell className="h-4 w-4" />
                {notifications.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white flex items-center justify-center font-mono-num">
                    {notifications.length}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-3 space-y-2 z-50">
                  <div className="flex items-center justify-between px-1 pb-1 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-xs font-bold">Notificaciones ({notifications.length})</span>
                    <button
                      type="button"
                      onClick={() => setNotificationsOpen(false)}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
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
                          onClick={() => {
                            setNotificationsOpen(false);
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
              className="rounded-xl p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={onOpenPasswordChange}
              title="Cambiar contraseña"
              className="rounded-xl p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <KeyRound className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setEditName(fullName);
                setEditBio(profile?.bio || '');
                setEditIg(profile?.instagram || '');
                setEditFb(profile?.facebook || '');
                setEditPhone(privateRecord?.phone || '');
                setEditCommissionId(commissionId);
                setEditAffiliationType(profile?.affiliationType || '');
                setEditAffiliationName(profile?.affiliationName || '');
                setProfileModalOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <AvatarBadge
                name={fullName}
                photoUrl={profile?.photoUrl}
                thumbUrl={profile?.photoThumbUrl}
                mediumUrl={profile?.photoMediumUrl}
                accentColor={commissions.find((c) => c.id === commissionId)?.accentColor}
                statusIndicator={
                  sessions.some((s) => s.status === 'en_curso') ? 'in_session' : 'active'
                }
                size="sm"
              />
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold leading-none truncate max-w-[140px]">{fullName}</p>
                <p className="text-[10px] font-semibold text-blue-600 dark:text-cyan-400 mt-0.5">
                  {roleLabel}
                </p>
              </div>
            </button>
          </div>
        </header>

        {/* Mobile Drawer */}
        {mobileSidebarOpen && (
          <div
            className="fixed inset-0 z-50 bg-slate-950/70 lg:hidden flex"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-72 bg-white dark:bg-slate-950 h-full p-4 flex flex-col"
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
                  className="p-1.5 rounded-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-3 space-y-1">
                {visibleNav.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveModule(item.id);
                      setMobileSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold ${
                      activeModule === item.id
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-1">
                <button
                  type="button"
                  onClick={onGoPublic}
                  className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-blue-600"
                >
                  <Globe className="h-4 w-4" /> Portal público
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600"
                >
                  <LogOut className="h-4 w-4" /> Cerrar sesión
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          <ModuleErrorBoundary key={activeModule} moduleName={activeModule}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeModule}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                <Suspense fallback={<ModuleLoadingFallback />}>
                  {activeModule === 'resumen' && (
                    <CustomizableDashboard
                      uid={uid}
                      fullName={fullName}
                      roleLabel={roleLabel}
                      accessTier={accessTier}
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

                  {activeModule === 'usuarios' && isLeader && (
                    <UsersAndBoardModule
                      uid={uid}
                      actorName={fullName}
                      actorRoleLabel={roleLabel}
                      commissions={commissions}
                      publicCouncilors={publicCouncilors}
                      privateCouncilors={privateCouncilors}
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
                      accessTier={accessTier}
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
                      uid={uid}
                      actorName={fullName}
                      accessTier={accessTier}
                      commissions={commissions}
                      workPlans={workPlans}
                    />
                  )}

                  {activeModule === 'auditoria' && isLeader && (
                    <AuditLogModule auditLogs={auditLogs} />
                  )}

                  {activeModule === 'portal_editor' && (
                    <PortalEditorModule
                      uid={uid}
                      actorName={fullName}
                      actorRoleLabel={roleLabel}
                      accessTier={accessTier}
                      settings={settings}
                      commissions={commissions}
                      newsEvents={newsEvents}
                      galleryItems={galleryItems}
                      galleryAlbums={galleryAlbums}
                    />
                  )}

                  {activeModule === 'guia' && <RoleGuideModule roleLabel={roleLabel} />}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </ModuleErrorBoundary>
        </main>
      </div>

      <OfflineIndicator />

      {/* Búsqueda Global Ctrl+K */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-950/75 backdrop-blur-sm p-4"
          onClick={() => setSearchOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                autoFocus
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar consejeros, actas, sesiones, documentos o votaciones..."
                className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                Esc
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {searchHits.length === 0 ? (
                <p className="p-6 text-center text-xs text-slate-500">
                  No se encontraron resultados para "{searchQuery}".
                </p>
              ) : (
                searchHits.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    onClick={() => {
                      setActiveModule(hit.module);
                      setSearchOpen(false);
                      setSearchQuery('');
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {hit.title}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate">{hit.subtitle}</p>
                    </div>
                    <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                      {hit.badge}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Mi Perfil */}
      {profileModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
          onClick={() => setProfileModalOpen(false)}
        >
          <form
            onSubmit={handleSaveMyProfile}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AvatarBadge
                  name={editName || fullName}
                  photoUrl={profile?.photoUrl}
                  thumbUrl={profile?.photoThumbUrl}
                  mediumUrl={profile?.photoMediumUrl}
                  accentColor={commissions.find((c) => c.id === commissionId)?.accentColor}
                  statusIndicator={
                    sessions.some((s) => s.status === 'en_curso') ? 'in_session' : 'active'
                  }
                  size="md"
                />
                <div>
                  <h3 className="text-lg font-bold flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                    Mi Perfil de Consejero
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Visible en el directorio público del CMJ Flandes
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                aria-label="Cerrar perfil"
                className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <MediaUploader
                storageFolder={`profiles/${uid}`}
                imagePreset="profile"
                label="Actualizar foto de perfil (recorte 1:1 WebP)"
                onUploaded={handleAvatarUpload}
              />
              {profile?.photoUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                >
                  <Trash2 className="h-3 w-3" /> Quitar foto actual
                </button>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Nombre completo
              </label>
              <input
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nombre completo"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Correo público de contacto
              </label>
              <input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
              />
              <p className="mt-1 text-[10px] text-slate-400">
                {isLeader
                  ? 'Al guardar como Mesa Directiva, se sincroniza también con tu correo de acceso.'
                  : 'Se muestra en tu ficha pública para contacto ciudadano.'}
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Reseña o perfil juvenil
              </label>
              <textarea
                rows={3}
                value={editBio}
                onChange={(e) => setEditBio(e.target.value)}
                placeholder="Cuéntale a la juventud de Flandes sobre tu labor y causas..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Filiación
                </label>
                <select
                  value={editAffiliationType}
                  onChange={(e) => setEditAffiliationType(e.target.value as AffiliationType)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                >
                  <option value="">Filiación (opcional)</option>
                  <option value="partido">Partido político</option>
                  <option value="fundacion">Fundación / Organización</option>
                  <option value="independiente">Independiente</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Nombre de organización o partido
                </label>
                <input
                  type="text"
                  value={editAffiliationName}
                  onChange={(e) => setEditAffiliationName(e.target.value)}
                  placeholder={
                    editAffiliationType === 'partido'
                      ? 'Nombre del partido político'
                      : editAffiliationType === 'fundacion'
                      ? 'Nombre de la fundación u org.'
                      : 'Nombre de lista o colectivo'
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                />
              </div>
            </div>

            {isLeader && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Comisión asignada
                </label>
                <select
                  value={editCommissionId}
                  onChange={(e) => setEditCommissionId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                >
                  <option value="">Sin comisión asignada</option>
                  {commissions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Teléfono / WhatsApp
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Ej: 3101234567"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Instagram
                </label>
                <input
                  type="text"
                  value={editIg}
                  onChange={(e) => setEditIg(e.target.value)}
                  placeholder="@usuario o enlace"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                Facebook (opcional)
              </label>
              <input
                type="text"
                value={editFb}
                onChange={(e) => setEditFb(e.target.value)}
                placeholder="Usuario o enlace de Facebook"
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
              />
            </div>

            <button
              type="submit"
              disabled={savingProfile}
              className="w-full rounded-xl bg-emerald-700 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 cursor-pointer"
            >
              {savingProfile ? 'Guardando perfil...' : 'Guardar perfil'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
export default PrivatePortal;
