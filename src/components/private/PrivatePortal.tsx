import React, { Suspense, lazy, useState } from 'react';
import {
  Award,
  BookOpen,
  Calendar,
  CalendarClock,
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
  Sun,
  UserCheck,
  Users,
  Vote,
  X,
} from 'lucide-react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { isLeadershipTier } from '../../lib/security';
import { deleteStorageFile } from '../../lib/storageUtils';
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
  GalleryItem,
  IdeaItem,
  LetterTemplate,
  NewsEvent,
  PortalDocument,
  PortalSettings,
  PrivateModule,
  PublicCouncilor,
  WorkPlanItem,
} from '../../types/cmj';
import { ModuleErrorBoundary } from '../ErrorBoundary';
import { MediaUploader, type UploadedFileInfo } from '../MediaUploader';
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
  import('./SecondaryModules').then((m) => ({ default: m.SurveysAndMessagesModule }))
);
const AgendaCalendarModule = lazy(() =>
  import('./SecondaryModules').then((m) => ({ default: m.AgendaCalendarModule }))
);
const IdeasBankModule = lazy(() =>
  import('./SecondaryModules').then((m) => ({ default: m.IdeasBankModule }))
);
const LetterTemplatesModule = lazy(() =>
  import('./SecondaryModules').then((m) => ({ default: m.LetterTemplatesModule }))
);
const WorkPlanAndCertsModule = lazy(() =>
  import('./SecondaryModules').then((m) => ({ default: m.WorkPlanAndCertsModule }))
);
const AuditLogModule = lazy(() =>
  import('./SecondaryModules').then((m) => ({ default: m.AuditLogModule }))
);
const PortalEditorModule = lazy(() =>
  import('./SecondaryModules').then((m) => ({ default: m.PortalEditorModule }))
);
const RoleGuideModule = lazy(() =>
  import('./SecondaryModules').then((m) => ({ default: m.RoleGuideModule }))
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
  documents,
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
  sessionInitialSecret,
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
  documents: PortalDocument[];
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
  sessionInitialSecret: string;
  darkMode: boolean;
  onToggleDarkMode: () => void;
  onGoPublic: () => void;
  onOpenPasswordChange: () => void;
  onSignOut: () => void;
}) {
  const { showToast } = useToast();
  const [activeModule, setActiveModule] = useState<PrivateModule>('resumen');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  const roleLabel = privateRecord?.roleLabel || profile?.roleLabel || 'Consejero';
  const accessTier = privateRecord?.accessTier || 'tier_4_member';
  const isLeader = isLeadershipTier(accessTier);
  const commissionId = profile?.commissionId || privateRecord?.commissionId || 'comision-1';
  const fullName = profile?.fullName || email.split('@')[0] || 'Consejero CMJ';

  const [editBio, setEditBio] = useState(profile?.bio || '');
  const [editIg, setEditIg] = useState(profile?.instagram || '');
  const [editFb, setEditFb] = useState(profile?.facebook || '');
  const [editPhone, setEditPhone] = useState(privateRecord?.phone || '');
  const [editName, setEditName] = useState(fullName);

  const navItems: {
    id: PrivateModule;
    label: string;
    icon: React.ReactNode;
    leaderOnly?: boolean;
  }[] = [
    { id: 'resumen', label: 'Mi Tablero', icon: <LayoutDashboard className="h-4 w-4" /> },
    { id: 'comisiones', label: 'Comisiones (1–5)', icon: <FolderKanban className="h-4 w-4" /> },
    { id: 'sesiones', label: 'Sesiones y Actas', icon: <CalendarClock className="h-4 w-4" /> },
    { id: 'votaciones', label: 'Votos y Compromisos', icon: <Vote className="h-4 w-4" /> },
    { id: 'planillas', label: 'Planillas y Excel', icon: <FileSpreadsheet className="h-4 w-4" /> },
    { id: 'documentos', label: 'Documentos', icon: <FolderArchive className="h-4 w-4" /> },
    { id: 'agenda', label: 'Agenda', icon: <Calendar className="h-4 w-4" /> },
    { id: 'buzon', label: 'Buzón de Ideas', icon: <Lightbulb className="h-4 w-4" /> },
    { id: 'plan_trabajo', label: 'Plan de Trabajo', icon: <Award className="h-4 w-4" /> },
    { id: 'plantillas', label: 'Plantillas de Oficios', icon: <FileText className="h-4 w-4" /> },
    { id: 'encuestas', label: 'Encuestas y Mensajes', icon: <MessageSquare className="h-4 w-4" /> },
    { id: 'portal_editor', label: 'Editor Portal y Noticias', icon: <Palette className="h-4 w-4" /> },
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

  const handleAvatarUpload = async (files: UploadedFileInfo[]) => {
    const first = files[0];
    if (!first || !profile) return;
    try {
      if (profile.storagePath) {
        await deleteStorageFile(profile.storagePath, profile.photoUrl);
      }
      await updateDoc(doc(db, 'public_councilors', profile.id), {
        photoUrl: first.url,
        storagePath: first.storagePath || '',
        updatedAt: serverTimestamp(),
      });
      showToast('Foto de perfil actualizada', 'success');
    } catch {
      showToast('No se pudo actualizar la foto de perfil', 'error');
    }
  };

  const handleSaveMyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (profile) {
        await updateDoc(doc(db, 'public_councilors', profile.id), {
          fullName: editName.trim() || fullName,
          bio: editBio.trim(),
          instagram: editIg.trim(),
          facebook: editFb.trim(),
          updatedAt: serverTimestamp(),
        });
      }
      await updateDoc(doc(db, 'councilor_private', uid), {
        phone: editPhone.trim(),
        updatedAt: serverTimestamp(),
      }).catch(() => {});
      setProfileModalOpen(false);
      showToast('Perfil actualizado', 'success');
    } catch {
      showToast('Error al actualizar perfil', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090D16] text-slate-900 dark:text-slate-100 flex">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 no-print">
        <div className="flex items-center gap-3 px-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center text-white font-extrabold text-sm">
            CMJ
          </div>
          <div className="min-w-0">
            <p className="text-sm font-extrabold truncate">CMJ Flandes</p>
            <p className="text-[11px] font-semibold text-blue-600 dark:text-cyan-400 truncate">
              {roleLabel}
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 space-y-1">
          {visibleNav.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveModule(item.id)}
              className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                activeModule === item.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70'
              }`}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </button>
          ))}
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
        <header className="sticky top-0 z-30 h-16 border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden rounded-xl p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>
            <p className="text-sm font-bold truncate">
              {visibleNav.find((n) => n.id === activeModule)?.label || 'Mi Tablero'}
            </p>
          </div>

          <div className="flex items-center gap-2">
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
                setProfileModalOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <AvatarBadge name={fullName} photoUrl={profile?.photoUrl} size="sm" />
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
                <span className="font-extrabold text-sm">Portal Privado CMJ</span>
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen(false)}
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
            <Suspense fallback={<ModuleLoadingFallback />}>
              {activeModule === 'resumen' && (
                <CustomizableDashboard
                  uid={uid}
                  fullName={fullName}
                  roleLabel={roleLabel}
                  accessTier={accessTier}
                  commissionId={commissionId}
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
                  sessionInitialSecret={sessionInitialSecret}
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
                  publicCouncilors={publicCouncilors}
                />
              )}

              {activeModule === 'votaciones' && (
                <VotesAndCommitmentsModule
                  uid={uid}
                  actorName={fullName}
                  actorRoleLabel={roleLabel}
                  accessTier={accessTier}
                  commissions={commissions}
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
                <AgendaCalendarModule sessions={sessions} newsEvents={newsEvents} />
              )}

              {activeModule === 'buzon' && (
                <IdeasBankModule
                  uid={uid}
                  actorName={fullName}
                  actorRoleLabel={roleLabel}
                  accessTier={accessTier}
                  commissions={commissions}
                  ideas={ideas}
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
                />
              )}

              {activeModule === 'guia' && <RoleGuideModule roleLabel={roleLabel} />}
            </Suspense>
          </ModuleErrorBoundary>
        </main>
      </div>

      {/* Modal Mi Perfil */}
      {profileModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
          onClick={() => setProfileModalOpen(false)}
        >
          <form
            onSubmit={handleSaveMyProfile}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-blue-600" /> Mi Perfil de Consejero
              </h3>
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <MediaUploader
              storageFolder={`profiles/${uid}`}
              imagePreset="profile"
              label="Actualizar foto de perfil (recorte 1:1 WebP)"
              onUploaded={handleAvatarUpload}
            />

            <input
              type="text"
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Nombre completo"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
            />
            <textarea
              rows={2}
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              placeholder="Biografía breve"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="Teléfono / WhatsApp"
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={editIg}
                onChange={(e) => setEditIg(e.target.value)}
                placeholder="Instagram (@usuario)"
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
              />
            </div>
            <input
              type="text"
              value={editFb}
              onChange={(e) => setEditFb(e.target.value)}
              placeholder="Facebook (opcional)"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-xs"
            />

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 cursor-pointer"
            >
              Guardar perfil
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
export default PrivatePortal;
