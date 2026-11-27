import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { MotionConfig } from 'motion/react';
import {
  ApiRequestError,
  apiRequest,
  clearAuthTokenInMemory,
  notifyAuthSync,
  setAuthTokenInMemory,
  subscribeAuthSync,
  subscribePortalRefresh,
  type SessionUser,
} from './lib/apiClient';
import { EMPTY_PORTAL_SETTINGS, STRUCTURAL_COMMISSIONS } from './lib/seedData';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PWAUpdatePrompt } from './components/PWAUpdatePrompt';
import { ToastProvider, useToast } from './components/ToastProvider';
import { SkeletonBlock } from './components/ui/AnimatedPrimitives';
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
  HeartToggleResponse,
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
  PublicCouncilor,
  PublicDepartamentalBundle,
  RoleTerm,
  SessionAgendaProposal,
  WorkPlanItem,
} from './types/cmj';

const PublicPortal = lazy(() => import('./components/public/PublicPortal'));
const PrivatePortal = lazy(() => import('./components/private/PrivatePortal'));
const AuthModal = lazy(() =>
  import('./components/AuthModal').then((m) => ({ default: m.AuthModal }))
);

interface PublicStateResponse {
  settings: PortalSettings | null;
  commissions: Commission[];
  publicCouncilors: PublicCouncilor[];
  newsEvents: NewsEvent[];
  galleryItems: GalleryItem[];
  galleryAlbums?: GalleryAlbum[];
  documents: PortalDocument[];
  actas?: PortalActa[];
  heartCounts?: Record<string, number>;
  myHeartedUids?: string[];
  publicDepartamental?: PublicDepartamentalBundle;
  callsSurveys: CallOrSurvey[];
}

interface PrivateStateResponse extends PublicStateResponse {
  commissionTasks: CommissionTask[];
  privateCouncilors: CouncilorPrivate[];
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
  roleTerms?: RoleTerm[];
  sessionAgendaProposals?: SessionAgendaProposal[];
  effectivePermissions?: PermissionKey[];
  coordinatorCommissionIds?: string[];
}

function FullScreenSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090D16] p-6 sm:p-10 max-w-6xl mx-auto space-y-6">
      <SkeletonBlock className="h-14 w-full" />
      <SkeletonBlock className="h-64 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SkeletonBlock className="h-36 w-full" />
        <SkeletonBlock className="h-36 w-full" />
        <SkeletonBlock className="h-36 w-full" />
      </div>
    </div>
  );
}

function PortalOrchestrator() {
  const { showToast } = useToast();
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('cmj_theme_mode');
      if (saved) return saved === 'dark';
    } catch {
      // ignore
    }
    return false;
  });

  const [viewMode, setViewMode] = useState<'public' | 'private'>('public');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<'login' | 'change_password'>('login');

  const [authUser, setAuthUser] = useState<SessionUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const authUserRef = useRef<SessionUser | null>(null);
  authUserRef.current = authUser;

  // Estado inicial limpio (solo estructura base, cero datos ficticios)
  const [settings, setSettings] = useState<PortalSettings>(EMPTY_PORTAL_SETTINGS);
  const [commissions, setCommissions] = useState<Commission[]>(STRUCTURAL_COMMISSIONS);
  const [commissionTasks, setCommissionTasks] = useState<CommissionTask[]>([]);
  const [publicCouncilors, setPublicCouncilors] = useState<PublicCouncilor[]>([]);
  const [privateCouncilors, setPrivateCouncilors] = useState<CouncilorPrivate[]>([]);
  const [newsEvents, setNewsEvents] = useState<NewsEvent[]>([]);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [galleryAlbums, setGalleryAlbums] = useState<GalleryAlbum[]>([]);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [actas, setActas] = useState<PortalActa[]>([]);
  const [callsSurveys, setCallsSurveys] = useState<CallOrSurvey[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [sessions, setSessions] = useState<CouncilSession[]>([]);
  const [votes, setVotes] = useState<CouncilVote[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [ideas, setIdeas] = useState<IdeaItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [workPlans, setWorkPlans] = useState<WorkPlanItem[]>([]);
  const [permissionRequests, setPermissionRequests] = useState<PermissionRequest[]>([]);
  const [permissionApprovalSteps, setPermissionApprovalSteps] = useState<PermissionApprovalStep[]>([]);
  const [grantedPermissions, setGrantedPermissions] = useState<GrantedPermission[]>([]);
  const [portalNotifications, setPortalNotifications] = useState<PortalNotification[]>([]);
  const [publicDepartamental, setPublicDepartamental] = useState<PublicDepartamentalBundle>({
    proposals: [],
    oversight: [],
    reports: [],
  });
  const [deptProposals, setDeptProposals] = useState<DeptProposal[]>([]);
  const [deptOversight, setDeptOversight] = useState<DeptOversightRecord[]>([]);
  const [deptReports, setDeptReports] = useState<DeptInterlocutionReport[]>([]);
  const [roleTerms, setRoleTerms] = useState<RoleTerm[]>([]);
  const [sessionAgendaProposals, setSessionAgendaProposals] = useState<SessionAgendaProposal[]>([]);
  const [effectivePermissions, setEffectivePermissions] = useState<PermissionKey[]>([]);
  const [coordinatorCommissionIds, setCoordinatorCommissionIds] = useState<string[]>([]);
  const [heartCounts, setHeartCounts] = useState<Record<string, number>>({});
  const [myHeartedUids, setMyHeartedUids] = useState<string[]>([]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('cmj_theme_mode', darkMode ? 'dark' : 'light');
    } catch {
      // ignore
    }
  }, [darkMode]);

  const loadPublicState = useCallback(async () => {
    try {
      const data = await apiRequest<PublicStateResponse>('/api/public/state', {
        skipRefresh: true,
      });
      if (data.settings) setSettings(data.settings);
      if (Array.isArray(data.commissions) && data.commissions.length > 0) {
        setCommissions(data.commissions);
      } else {
        setCommissions(STRUCTURAL_COMMISSIONS);
      }
      setPublicCouncilors(data.publicCouncilors || []);
      setNewsEvents(data.newsEvents || []);
      setGalleryItems(data.galleryItems || []);
      setGalleryAlbums(data.galleryAlbums || []);
      setDocuments(data.documents || []);
      setActas(data.actas || []);
      setPublicDepartamental(
        data.publicDepartamental || { proposals: [], oversight: [], reports: [] }
      );
      setCallsSurveys(data.callsSurveys || []);
      if (data.heartCounts) setHeartCounts(data.heartCounts);
      if (Array.isArray(data.myHeartedUids)) setMyHeartedUids(data.myHeartedUids);
    } catch {
      // Silencioso en carga inicial pública
    }
  }, []);

  const handleHeartChange = useCallback((res: HeartToggleResponse) => {
    setHeartCounts((prev) => ({
      ...prev,
      [res.councilorUid]: res.count,
    }));
    setMyHeartedUids((prev) => {
      const has = prev.includes(res.councilorUid);
      if (res.hearted && !has) return [...prev, res.councilorUid];
      if (!res.hearted && has) return prev.filter((id) => id !== res.councilorUid);
      return prev;
    });
  }, []);

  const refreshAuthSession = useCallback(async (retryOnTransient = false): Promise<SessionUser | null> => {
    const attempt = async () =>
      apiRequest<{ user: SessionUser | null; token?: string }>('/api/auth/me', {
        skipRefresh: true,
      });

    const applyUser = (nextUser: SessionUser | null, token?: string) => {
      if (nextUser) {
        if (token) setAuthTokenInMemory(token);
        const prev = authUserRef.current;
        const prevPerms = (prev?.effectivePermissions || []).join(',');
        const nextPerms = (nextUser.effectivePermissions || []).join(',');
        const prevCoords = (prev?.coordinatorCommissionIds || []).join(',');
        const nextCoords = (nextUser.coordinatorCommissionIds || []).join(',');
        if (
          !prev ||
          prev.uid !== nextUser.uid ||
          prev.roleLabel !== nextUser.roleLabel ||
          prev.commissionId !== nextUser.commissionId ||
          prev.mustChangePassword !== nextUser.mustChangePassword ||
          prev.verificado !== nextUser.verificado ||
          prev.coordDeclaradaPendiente !== nextUser.coordDeclaradaPendiente ||
          prev.fullName !== nextUser.fullName ||
          prevPerms !== nextPerms ||
          prevCoords !== nextCoords
        ) {
          setAuthUser(nextUser);
        }
        return nextUser;
      }
      clearAuthTokenInMemory();
      if (authUserRef.current !== null) setAuthUser(null);
      return null;
    };

    try {
      const res = await attempt();
      return applyUser(res.user, res.token);
    } catch (err) {
      const transient =
        err instanceof ApiRequestError && (err.status === 0 || err.status >= 500);
      if (retryOnTransient && transient) {
        await new Promise((r) => window.setTimeout(r, 850));
        try {
          const retryRes = await attempt();
          return applyUser(retryRes.user, retryRes.token);
        } catch {
          return authUserRef.current;
        }
      }
      return authUserRef.current;
    }
  }, []);

  const loadPrivateState = useCallback(async () => {
    try {
      const data = await apiRequest<PrivateStateResponse>('/api/private/state', {
        skipRefresh: true,
      });
      if (data.settings) setSettings(data.settings);
      if (Array.isArray(data.commissions) && data.commissions.length > 0) {
        setCommissions(data.commissions);
      }
      setCommissionTasks(data.commissionTasks || []);
      setPublicCouncilors(data.publicCouncilors || []);
      setPrivateCouncilors(data.privateCouncilors || []);
      setNewsEvents(data.newsEvents || []);
      setGalleryItems(data.galleryItems || []);
      setGalleryAlbums(data.galleryAlbums || []);
      setDocuments(data.documents || []);
      setActas(data.actas || []);
      setCallsSurveys(data.callsSurveys || []);
      setContactMessages(data.contactMessages || []);
      setSessions(data.sessions || []);
      setVotes(data.votes || []);
      setCommitments(data.commitments || []);
      setIdeas(data.ideas || []);
      setAuditLogs(data.auditLogs || []);
      setTemplates(data.templates || []);
      setWorkPlans(data.workPlans || []);
      setPermissionRequests(data.permissionRequests || []);
      setPermissionApprovalSteps(data.permissionApprovalSteps || []);
      setGrantedPermissions(data.grantedPermissions || []);
      setPortalNotifications(data.portalNotifications || []);
      setDeptProposals(data.deptProposals || []);
      setDeptOversight(data.deptOversight || []);
      setDeptReports(data.deptReports || []);
      setRoleTerms(data.roleTerms || []);
      setSessionAgendaProposals(data.sessionAgendaProposals || []);
      if (data.publicDepartamental) setPublicDepartamental(data.publicDepartamental);
      if (Array.isArray(data.effectivePermissions)) {
        setEffectivePermissions(data.effectivePermissions);
      }
      if (Array.isArray(data.coordinatorCommissionIds)) {
        setCoordinatorCommissionIds(data.coordinatorCommissionIds);
      }

      const currentAuth = authUserRef.current;
      if (currentAuth) {
        const mePriv = (data.privateCouncilors || []).find((p) => p.uid === currentAuth.uid);
        const nextCoordStr = (data.coordinatorCommissionIds || []).join(',');
        const prevCoordStr = (currentAuth.coordinatorCommissionIds || []).join(',');
        const nextPermStr = (data.effectivePermissions || []).join(',');
        const prevPermStr = (currentAuth.effectivePermissions || []).join(',');
        if (
          (mePriv && mePriv.roleLabel !== currentAuth.roleLabel) ||
          nextCoordStr !== prevCoordStr ||
          nextPermStr !== prevPermStr
        ) {
          refreshAuthSession(false);
        }
      }
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 401) {
        try {
          const check = await apiRequest<{ user: SessionUser | null; token?: string }>(
            '/api/auth/me',
            { skipRefresh: true }
          );
          if (check.user) {
            if (check.token) setAuthTokenInMemory(check.token);
            setAuthUser(check.user);
            return;
          }
          clearAuthTokenInMemory();
          setAuthUser(null);
          setViewMode('public');
          showToast('Tu sesión expiró. Inicia sesión nuevamente.', 'info');
        } catch {
          // Error temporal de red/servidor: mantener sesión actual y reintentar luego
        }
      }
    }
  }, [refreshAuthSession, showToast]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        let res: { user: SessionUser | null; token?: string } | null = null;
        try {
          res = await apiRequest<{ user: SessionUser | null; token?: string }>('/api/auth/me', {
            skipRefresh: true,
          });
        } catch (err) {
          const transient =
            err instanceof ApiRequestError && (err.status === 0 || err.status >= 500);
          if (transient) {
            await new Promise((r) => window.setTimeout(r, 850));
            res = await apiRequest<{ user: SessionUser | null; token?: string }>('/api/auth/me', {
              skipRefresh: true,
            });
          } else {
            throw err;
          }
        }
        if (!active) return;
        if (res?.user) {
          if (res.token) setAuthTokenInMemory(res.token);
          setAuthUser(res.user);
        }
      } catch {
        // Sin sesión activa o servidor temporalmente no disponible
      } finally {
        if (active) setAuthReady(true);
      }
      await loadPublicState();
    })();
    return () => {
      active = false;
    };
  }, [loadPublicState]);

  useEffect(() => {
    const unsubSync = subscribeAuthSync((event) => {
      if (event === 'logout') {
        clearAuthTokenInMemory();
        setAuthUser(null);
        setViewMode('public');
        loadPublicState();
      } else if (event === 'login') {
        refreshAuthSession(true);
      }
    });
    return () => unsubSync();
  }, [loadPublicState, refreshAuthSession]);

  const authUserUid = authUser?.uid || null;

  useEffect(() => {
    if (!authReady) return;
    if (authUserUid) {
      loadPrivateState();
    }
    const unsub = subscribePortalRefresh(() => {
      if (authUserRef.current) {
        loadPrivateState();
      } else {
        loadPublicState();
      }
    });
    const timer = authUserUid
      ? window.setInterval(() => {
          loadPrivateState();
        }, 15000)
      : undefined;

    let lastSessionTouch = Date.now();
    const touchSession = () => {
      if (!authUserRef.current) return;
      const now = Date.now();
      if (now - lastSessionTouch < 30000) return;
      lastSessionTouch = now;
      refreshAuthSession(false);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        touchSession();
      }
    };

    const keepAliveTimer = authUserUid
      ? window.setInterval(() => {
          refreshAuthSession(false);
        }, 5 * 60 * 1000)
      : undefined;

    if (authUserUid) {
      document.addEventListener('visibilitychange', onVisibilityChange);
      window.addEventListener('focus', touchSession);
      window.addEventListener('online', touchSession);
    }

    return () => {
      unsub();
      if (timer) window.clearInterval(timer);
      if (keepAliveTimer) window.clearInterval(keepAliveTimer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', touchSession);
      window.removeEventListener('online', touchSession);
    };
  }, [authReady, authUserUid, loadPrivateState, loadPublicState, refreshAuthSession]);

  const currentProfile = publicCouncilors.find((c) => c.uid === authUser?.uid) || null;
  const currentPrivate =
    privateCouncilors.find((c) => c.uid === authUser?.uid) ||
    (authUser
      ? {
          uid: authUser.uid,
          email: authUser.email,
          phone: authUser.phone,
          accessTier: authUser.accessTier,
          roleLabel: authUser.roleLabel,
          commissionId: currentProfile?.commissionId ?? authUser.commissionId ?? '',
          active: authUser.active,
          mustChangePassword: authUser.mustChangePassword,
        }
      : null);

  const handleSignOut = async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', skipRefresh: true });
    } catch {
      // ignore
    }
    clearAuthTokenInMemory();
    notifyAuthSync('logout');
    setAuthUser(null);
    setPrivateCouncilors([]);
    setCommissionTasks([]);
    setContactMessages([]);
    setSessions([]);
    setVotes([]);
    setCommitments([]);
    setIdeas([]);
    setAuditLogs([]);
    setTemplates([]);
    setWorkPlans([]);
    setPermissionRequests([]);
    setPermissionApprovalSteps([]);
    setGrantedPermissions([]);
    setPortalNotifications([]);
    setDeptProposals([]);
    setDeptOversight([]);
    setDeptReports([]);
    setRoleTerms([]);
    setSessionAgendaProposals([]);
    setEffectivePermissions([]);
    setCoordinatorCommissionIds([]);
    setViewMode('public');
    await loadPublicState();
    showToast('Sesión cerrada', 'info');
  };

  return (
    <Suspense fallback={<FullScreenSkeleton />}>
      {viewMode === 'private' && authUser ? (
        <PrivatePortal
          uid={authUser.uid}
          email={authUser.email}
          profile={currentProfile}
          privateRecord={currentPrivate}
          commissions={commissions}
          commissionTasks={commissionTasks}
          publicCouncilors={publicCouncilors}
          privateCouncilors={privateCouncilors}
          newsEvents={newsEvents}
          galleryItems={galleryItems}
          galleryAlbums={galleryAlbums}
          documents={documents}
          actas={actas}
          callsSurveys={callsSurveys}
          contactMessages={contactMessages}
          sessions={sessions}
          votes={votes}
          commitments={commitments}
          ideas={ideas}
          auditLogs={auditLogs}
          templates={templates}
          workPlans={workPlans}
          permissionRequests={permissionRequests}
          permissionApprovalSteps={permissionApprovalSteps}
          grantedPermissions={grantedPermissions}
          portalNotifications={portalNotifications}
          deptProposals={deptProposals}
          deptOversight={deptOversight}
          deptReports={deptReports}
          roleTerms={roleTerms}
          sessionAgendaProposals={sessionAgendaProposals}
          coordinatorCommissionIds={
            coordinatorCommissionIds.length > 0
              ? coordinatorCommissionIds
              : authUser.coordinatorCommissionIds || []
          }
          effectivePermissions={
            effectivePermissions.length > 0
              ? effectivePermissions
              : authUser.effectivePermissions || []
          }
          settings={settings}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((d) => !d)}
          onGoPublic={() => setViewMode('public')}
          onOpenPasswordChange={() => {
            setAuthModalTab('change_password');
            setAuthModalOpen(true);
          }}
          onSignOut={handleSignOut}
        />
      ) : (
        <PublicPortal
          settings={settings}
          commissions={commissions}
          councilors={publicCouncilors.filter((c) => c.active)}
          newsEvents={newsEvents}
          galleryItems={galleryItems}
          galleryAlbums={galleryAlbums}
          documents={documents}
          actas={actas}
          publicDepartamental={publicDepartamental}
          callsSurveys={callsSurveys}
          heartCounts={heartCounts}
          myHeartedUids={myHeartedUids}
          viewerUid={authUser?.uid || null}
          onHeartChange={handleHeartChange}
          isAuthenticated={Boolean(authUser)}
          darkMode={darkMode}
          onToggleDarkMode={() => setDarkMode((d) => !d)}
          onOpenAuth={() => {
            setAuthModalTab('login');
            setAuthModalOpen(true);
          }}
          onEnterPrivatePortal={() => setViewMode('private')}
        />
      )}

      {authModalOpen && (
        <Suspense fallback={null}>
          <AuthModal
            open={authModalOpen}
            initialTab={authModalTab}
            currentUser={authUser}
            commissions={commissions}
            onClose={() => setAuthModalOpen(false)}
            onAuthenticated={(user) => {
              setAuthUser(user);
              setViewMode('private');
            }}
          />
        </Suspense>
      )}
    </Suspense>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
        <ToastProvider>
          <PortalOrchestrator />
          <PWAUpdatePrompt />
        </ToastProvider>
      </ErrorBoundary>
    </MotionConfig>
  );
}
