import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import {
  apiRequest,
  clearAuthTokenInMemory,
  setAuthTokenInMemory,
  subscribePortalRefresh,
  type SessionUser,
} from './lib/apiClient';
import { EMPTY_PORTAL_SETTINGS, STRUCTURAL_COMMISSIONS } from './lib/seedData';
import { ErrorBoundary } from './components/ErrorBoundary';
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
  GalleryItem,
  IdeaItem,
  LetterTemplate,
  NewsEvent,
  PortalDocument,
  PortalSettings,
  PublicCouncilor,
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
  documents: PortalDocument[];
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

  // Estado inicial limpio (solo estructura base, cero datos ficticios)
  const [settings, setSettings] = useState<PortalSettings>(EMPTY_PORTAL_SETTINGS);
  const [commissions, setCommissions] = useState<Commission[]>(STRUCTURAL_COMMISSIONS);
  const [commissionTasks, setCommissionTasks] = useState<CommissionTask[]>([]);
  const [publicCouncilors, setPublicCouncilors] = useState<PublicCouncilor[]>([]);
  const [privateCouncilors, setPrivateCouncilors] = useState<CouncilorPrivate[]>([]);
  const [newsEvents, setNewsEvents] = useState<NewsEvent[]>([]);
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [callsSurveys, setCallsSurveys] = useState<CallOrSurvey[]>([]);
  const [contactMessages, setContactMessages] = useState<ContactMessage[]>([]);
  const [sessions, setSessions] = useState<CouncilSession[]>([]);
  const [votes, setVotes] = useState<CouncilVote[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [ideas, setIdeas] = useState<IdeaItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [templates, setTemplates] = useState<LetterTemplate[]>([]);
  const [workPlans, setWorkPlans] = useState<WorkPlanItem[]>([]);

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
      setDocuments(data.documents || []);
      setCallsSurveys(data.callsSurveys || []);
    } catch {
      // Silencioso en carga inicial pública
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
      setDocuments(data.documents || []);
      setCallsSurveys(data.callsSurveys || []);
      setContactMessages(data.contactMessages || []);
      setSessions(data.sessions || []);
      setVotes(data.votes || []);
      setCommitments(data.commitments || []);
      setIdeas(data.ideas || []);
      setAuditLogs(data.auditLogs || []);
      setTemplates(data.templates || []);
      setWorkPlans(data.workPlans || []);
    } catch {
      // Si expira sesión en servidor, se maneja al siguiente check
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await apiRequest<{ user: SessionUser | null; token?: string }>(
          '/api/auth/me',
          { skipRefresh: true }
        );
        if (!active) return;
        if (res.user) {
          if (res.token) setAuthTokenInMemory(res.token);
          setAuthUser(res.user);
        }
      } catch {
        // Sin sesión activa
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
    if (!authReady) return;
    if (authUser) {
      loadPrivateState();
    }
    const unsub = subscribePortalRefresh(() => {
      if (authUser) {
        loadPrivateState();
      } else {
        loadPublicState();
      }
    });
    const timer = authUser
      ? window.setInterval(() => {
          loadPrivateState();
        }, 15000)
      : undefined;

    return () => {
      unsub();
      if (timer) window.clearInterval(timer);
    };
  }, [authReady, authUser, loadPrivateState, loadPublicState]);

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
          documents={documents}
          callsSurveys={callsSurveys}
          contactMessages={contactMessages}
          sessions={sessions}
          votes={votes}
          commitments={commitments}
          ideas={ideas}
          auditLogs={auditLogs}
          templates={templates}
          workPlans={workPlans}
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
          documents={documents}
          callsSurveys={callsSurveys}
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
        </ToastProvider>
      </ErrorBoundary>
    </MotionConfig>
  );
}
