import React, { Suspense, lazy, useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db, testFirestoreConnection } from './firebase';
import { EMPTY_PORTAL_SETTINGS, STRUCTURAL_COMMISSIONS } from './lib/seedData';
import { hashEmail, isLeadershipTier, SECRETARY_BOOTSTRAP_EMAIL } from './lib/security';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider, useToast } from './components/ToastProvider';
import { SkeletonBlock } from './components/ui/AnimatedPrimitives';
import type {
  AccessTier,
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
  RoleLabel,
  WorkPlanItem,
} from './types/cmj';

const PublicPortal = lazy(() => import('./components/public/PublicPortal'));
const PrivatePortal = lazy(() => import('./components/private/PrivatePortal'));
const AuthModal = lazy(() =>
  import('./components/AuthModal').then((m) => ({ default: m.AuthModal }))
);

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

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userRole, setUserRole] = useState<{
    accessTier: AccessTier;
    roleLabel: RoleLabel;
  } | null>(null);
  const [sessionInitialSecret, setSessionInitialSecret] = useState('');

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

  useEffect(() => {
    testFirestoreConnection();
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthReady(true);
      if (!user) {
        setUserRole(null);
        setViewMode('public');
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !authUser) return;
    let repaired = false;
    const unsub = onSnapshot(
      doc(db, 'roles', authUser.uid),
      async (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setUserRole({
            accessTier: d.accessTier as AccessTier,
            roleLabel: d.roleLabel as RoleLabel,
          });
        } else if (
          !repaired &&
          authUser.email?.toLowerCase() === SECRETARY_BOOTSTRAP_EMAIL
        ) {
          repaired = true;
          try {
            const emailHash = await hashEmail(authUser.email);
            await setDoc(doc(db, 'roles', authUser.uid), {
              uid: authUser.uid,
              accessTier: 'tier_3_sec' as AccessTier,
              roleLabel: 'Secretario' as RoleLabel,
              emailHash,
              active: true,
              updatedAt: serverTimestamp(),
            });
          } catch {
            // Se completará desde AuthModal al iniciar sesión
          }
        }
      },
      () => {}
    );
    return () => unsub();
  }, [authReady, authUser]);

  // Suscripciones públicas acotadas
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(
      onSnapshot(
        doc(db, 'portal_settings', 'site_content'),
        (snap) => {
          if (snap.exists()) {
            setSettings({ id: snap.id, ...(snap.data() as Omit<PortalSettings, 'id'>) });
          } else {
            setSettings(EMPTY_PORTAL_SETTINGS);
          }
        },
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        collection(db, 'commissions'),
        (snap) => {
          if (!snap.empty) {
            setCommissions(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Commission, 'id'>) }))
            );
          } else {
            setCommissions(STRUCTURAL_COMMISSIONS);
          }
        },
        () => {}
      )
    );

    const councilorsQuery = userRole
      ? query(collection(db, 'public_councilors'), limit(100))
      : query(collection(db, 'public_councilors'), where('active', '==', true), limit(60));
    unsubs.push(
      onSnapshot(
        councilorsQuery,
        (snap) => {
          setPublicCouncilors(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PublicCouncilor, 'id'>) }))
          );
        },
        () => {}
      )
    );

    const newsQuery = userRole
      ? query(collection(db, 'news_events'), limit(50))
      : query(collection(db, 'news_events'), where('status', '==', 'publicado'), limit(30));
    unsubs.push(
      onSnapshot(
        newsQuery,
        (snap) => {
          setNewsEvents(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NewsEvent, 'id'>) }))
          );
        },
        () => {}
      )
    );

    const galleryQuery = userRole
      ? query(collection(db, 'gallery_items'), limit(60))
      : query(collection(db, 'gallery_items'), where('status', '==', 'publicado'), limit(40));
    unsubs.push(
      onSnapshot(
        galleryQuery,
        (snap) => {
          setGalleryItems(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<GalleryItem, 'id'>) }))
          );
        },
        () => {}
      )
    );

    const docsQuery = userRole
      ? query(collection(db, 'documents'), limit(80))
      : query(collection(db, 'documents'), where('visibility', '==', 'publico'), limit(40));
    unsubs.push(
      onSnapshot(
        docsQuery,
        (snap) => {
          setDocuments(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<PortalDocument, 'id'>) }))
          );
        },
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'calls_surveys'), limit(30)),
        (snap) => {
          setCallsSurveys(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CallOrSurvey, 'id'>) }))
          );
        },
        () => {}
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [userRole]);

  // Suscripciones privadas acotadas detrás de rol activo
  useEffect(() => {
    if (!authReady || !authUser || !userRole) return;
    const unsubs: (() => void)[] = [];
    const isLeader = isLeadershipTier(userRole.accessTier);

    unsubs.push(
      onSnapshot(
        query(collection(db, 'commission_tasks'), limit(120)),
        (snap) => {
          setCommissionTasks(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CommissionTask, 'id'>) }))
          );
        },
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'sessions'), limit(50)),
        (snap) => {
          setSessions(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CouncilSession, 'id'>) }))
          );
        },
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'votes'), limit(50)),
        (snap) => {
          setVotes(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CouncilVote, 'id'>) }))
          );
        },
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'commitments'), limit(80)),
        (snap) => {
          setCommitments(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Commitment, 'id'>) }))
          );
        },
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'ideas_inbox'), limit(50)),
        (snap) => {
          setIdeas(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<IdeaItem, 'id'>) }))
          );
        },
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'letter_templates'), limit(30)),
        (snap) => {
          setTemplates(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LetterTemplate, 'id'>) }))
          );
        },
        () => {}
      )
    );

    unsubs.push(
      onSnapshot(
        query(collection(db, 'work_plans'), limit(60)),
        (snap) => {
          setWorkPlans(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WorkPlanItem, 'id'>) }))
          );
        },
        () => {}
      )
    );

    if (isLeader) {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'councilor_private'), limit(100)),
          (snap) => {
            setPrivateCouncilors(
              snap.docs.map((d) => ({ ...(d.data() as CouncilorPrivate), uid: d.id }))
            );
          },
          () => {}
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'contact_messages'), orderBy('createdAt', 'desc'), limit(50)),
          (snap) => {
            setContactMessages(
              snap.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Omit<ContactMessage, 'id'>),
              }))
            );
          },
          () => {}
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, 'audit_logs'), orderBy('createdAt', 'desc'), limit(80)),
          (snap) => {
            setAuditLogs(
              snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AuditLog, 'id'>) }))
            );
          },
          () => {}
        )
      );

      unsubs.push(
        onSnapshot(
          doc(db, 'portal_security', 'leader_config'),
          (snap) => {
            if (snap.exists()) {
              const pwd = snap.data().initialPassword;
              if (typeof pwd === 'string' && pwd) setSessionInitialSecret(pwd);
            }
          },
          () => {}
        )
      );
    } else {
      unsubs.push(
        onSnapshot(
          doc(db, 'councilor_private', authUser.uid),
          (snap) => {
            if (snap.exists()) {
              setPrivateCouncilors([{ ...(snap.data() as CouncilorPrivate), uid: snap.id }]);
            }
          },
          () => {}
        )
      );
    }

    return () => unsubs.forEach((u) => u());
  }, [authReady, authUser, userRole]);

  const currentProfile = publicCouncilors.find((c) => c.uid === authUser?.uid) || null;
  const currentPrivate =
    privateCouncilors.find((c) => c.uid === authUser?.uid) ||
    (userRole && authUser
      ? {
          uid: authUser.uid,
          email: authUser.email || '',
          accessTier: userRole.accessTier,
          roleLabel: userRole.roleLabel,
          commissionId: currentProfile?.commissionId || 'comision-1',
          mustChangePassword: false,
        }
      : null);

  const handleSignOut = async () => {
    await signOut(auth);
    setViewMode('public');
    showToast('Sesión cerrada', 'info');
  };

  return (
    <Suspense fallback={<FullScreenSkeleton />}>
      {viewMode === 'private' && authUser ? (
        <PrivatePortal
          uid={authUser.uid}
          email={authUser.email || ''}
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
          sessionInitialSecret={sessionInitialSecret}
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
            onClose={() => setAuthModalOpen(false)}
            onSuccess={() => setViewMode('private')}
            onSessionInitialSecret={(s) => setSessionInitialSecret(s)}
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
