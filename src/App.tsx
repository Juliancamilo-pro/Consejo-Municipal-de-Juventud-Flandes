import { lazy, Suspense, useMemo } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { SkeletonBlock } from './components/ui/MotionPrimitives';
import { ToastProvider } from './components/ui/Toast';
import { useAccessibility } from './hooks/useAccessibility';
import { usePublicPortalData } from './hooks/usePublicPortalData';
import { useRouter } from './hooks/useRouter';
import { useSeo } from './hooks/useSeo';
import { useSiteAppearance } from './hooks/useSiteContent';
import { slugifyCouncilorName } from './utils/avatarCrop';

import { getCommissionSlug } from './utils/commissionUtils';

const HomePage = lazy(() =>
  import('./pages/public/HomePage').then((m) => ({ default: m.HomePage })),
);
const CouncilPage = lazy(() =>
  import('./pages/public/CouncilPage').then((m) => ({ default: m.CouncilPage })),
);
const CommissionsPublicPage = lazy(() =>
  import('./pages/public/CommissionsPublicPage').then((m) => ({
    default: m.CommissionsPublicPage,
  })),
);
const CommissionDetailPublicPage = lazy(() =>
  import('./pages/public/CommissionDetailPublicPage').then((m) => ({
    default: m.CommissionDetailPublicPage,
  })),
);
const CounselorsPage = lazy(() =>
  import('./pages/public/CounselorsPage').then((m) => ({ default: m.CounselorsPage })),
);
const CouncilorDetailPage = lazy(() =>
  import('./pages/public/CouncilorDetailPage').then((m) => ({ default: m.CouncilorDetailPage })),
);
const GovernancePage = lazy(() =>
  import('./pages/public/GovernancePage').then((m) => ({ default: m.GovernancePage })),
);
const NewsPage = lazy(() =>
  import('./pages/public/NewsPage').then((m) => ({ default: m.NewsPage })),
);
const MailboxPage = lazy(() =>
  import('./pages/public/MailboxPage').then((m) => ({ default: m.MailboxPage })),
);
const ContactPage = lazy(() =>
  import('./pages/public/ContactPage').then((m) => ({ default: m.ContactPage })),
);
const PortalAuthGate = lazy(() =>
  import('./pages/auth/PortalAuthGate').then((m) => ({ default: m.PortalAuthGate })),
);
const CertificateVerifyPage = lazy(() =>
  import('./pages/public/CertificateVerifyPage').then((m) => ({
    default: m.CertificateVerifyPage,
  })),
);

function RouteLoadingFallback() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 py-12 sm:px-6">
      <SkeletonBlock className="h-10 w-72 rounded-lg" />
      <SkeletonBlock className="h-48 w-full rounded-xl" />
    </div>
  );
}

export default function App() {
  const {
    currentRoute,
    currentPathname,
    councilorSlug,
    commissionSlug,
    verifyCode,
    searchParams,
    navigate,
  } = useRouter();
  const portal = usePublicPortalData();
  const { siteContent, reloadSiteContent } = useSiteAppearance();

  const activeCouncilor = useMemo(() => {
    if (!councilorSlug) return null;
    return (
      portal.directory.find(
        (m) => (m.slug || slugifyCouncilorName(m.displayName, m.uid)) === councilorSlug,
      ) || null
    );
  }, [councilorSlug, portal.directory]);

  const activeCommission = useMemo(() => {
    if (!commissionSlug) return null;
    return (
      portal.commissions.find((c) => getCommissionSlug(c) === commissionSlug) || null
    );
  }, [commissionSlug, portal.commissions]);

  useSeo(currentRoute, activeCouncilor, activeCommission);

  const {
    settings,
    toggleTheme,
    setFontScale,
    toggleHighContrast,
    toggleReduceMotion,
    toggleHideSeasonalOrnaments,
    resetAccessibility,
  } = useAccessibility();

  return (
    <ToastProvider>
      <ErrorBoundary>
        <MainLayout
          currentRoute={currentRoute}
          onNavigate={navigate}
          portal={portal}
          siteContent={siteContent}
          accessibility={{
            settings,
            toggleTheme,
            setFontScale,
            toggleHighContrast,
            toggleReduceMotion,
            toggleHideSeasonalOrnaments,
            resetAccessibility,
          }}
        >
        <Suspense fallback={<RouteLoadingFallback />}>
          {currentPathname === '/' && (
            <HomePage portal={portal} siteContent={siteContent} onNavigate={navigate} />
          )}
          {currentPathname === '/consejo' && (
            <CouncilPage portal={portal} siteContent={siteContent} onNavigate={navigate} />
          )}
          {currentPathname === '/comisiones' && (
            <CommissionsPublicPage portal={portal} onNavigate={navigate} />
          )}
          {commissionSlug && (
            <CommissionDetailPublicPage
              slug={commissionSlug}
              portal={portal}
              onNavigate={navigate}
            />
          )}
          {currentPathname === '/consejeros' && (
            <CounselorsPage portal={portal} onNavigate={navigate} />
          )}
          {councilorSlug && (
            <CouncilorDetailPage slug={councilorSlug} portal={portal} onNavigate={navigate} />
          )}
          {currentPathname === '/gestion' && (
            <GovernancePage portal={portal} onNavigate={navigate} />
          )}
          {currentPathname === '/actualidad' && <NewsPage portal={portal} onNavigate={navigate} />}
          {currentPathname === '/participacion' && (
            <MailboxPage
              recipientSlug={searchParams.get('para')}
              initialTab={searchParams.get('tab')}
              commissionSlug={searchParams.get('comision')}
              commissions={portal.commissions}
              directory={portal.directory}
              onNavigate={navigate}
            />
          )}
          {(currentPathname === '/verificar' || Boolean(verifyCode)) && (
            <CertificateVerifyPage initialCode={verifyCode} onNavigate={navigate} />
          )}
          {currentPathname === '/contacto' && (
            <ContactPage portal={portal} siteContent={siteContent} onNavigate={navigate} />
          )}
          {currentPathname === '/portal' && (
            <PortalAuthGate
              siteContent={siteContent}
              onSiteContentUpdated={reloadSiteContent}
            />
          )}
        </Suspense>
        </MainLayout>
      </ErrorBoundary>
    </ToastProvider>
  );
}
