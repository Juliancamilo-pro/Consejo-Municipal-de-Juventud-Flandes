import { useState } from 'react';
import { useAuthSession } from '../../hooks/useAuthSession';
import { SiteAppearanceConfig } from '../../types/siteContent';
import { FadeInSection, SkeletonBlock } from '../../components/ui/MotionPrimitives';
import { Tabs } from '../../components/ui/Tabs';
import { PrivatePortalShell } from '../private/PrivatePortalShell';
import { AuthAccountStatusView } from './AuthAccountStatusView';
import { AuthCredentialsForm, AuthView } from './AuthCredentialsForm';
import { AuthInfoAside } from './AuthInfoAside';

interface PortalAuthGateProps {
  siteContent: SiteAppearanceConfig;
  onSiteContentUpdated: () => Promise<void>;
}

export function PortalAuthGate({ siteContent, onSiteContentUpdated }: PortalAuthGateProps) {
  const authSession = useAuthSession();
  const [view, setView] = useState<AuthView>('login');

  if (authSession.loading) {
    return (
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
        <SkeletonBlock className="h-10 w-64 rounded-lg" />
        <SkeletonBlock className="mt-4 h-72 w-full rounded-xl" />
      </section>
    );
  }

  if (authSession.firebaseUser && authSession.profile) {
    if (authSession.profile.status !== 'activo') {
      return (
        <AuthAccountStatusView
          profile={authSession.profile}
          onLogout={authSession.logout}
        />
      );
    }
    return (
      <PrivatePortalShell
        profile={authSession.profile}
        siteContent={siteContent}
        onSiteContentUpdated={onSiteContentUpdated}
        onLogout={authSession.logout}
        inactivityWarningSeconds={authSession.inactivityWarningSeconds}
        onExtendSession={authSession.extendSession}
        onRevokeAllDevices={authSession.revokeAllDevices}
      />
    );
  }

  return (
    <section className="cmj-territorial-weave border-b border-stone-200 bg-[#F7F4EE] py-12 dark:border-slate-800 dark:bg-slate-950/60 sm:py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <FadeInSection>
          <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12 lg:gap-10">
            <AuthInfoAside siteContent={siteContent} />

            <div className="lg:col-span-7">
              {authSession.sessionExpiredNotice && (
                <div
                  role="status"
                  className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                >
                  Tu sesión se cerró automáticamente por inactividad para proteger la información institucional.
                </div>
              )}

              {authSession.authError && (
                <div
                  role="alert"
                  className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs font-medium text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
                >
                  {authSession.authError}
                </div>
              )}

              <Tabs
                ariaLabel="Opciones de ingreso al portal"
                activeId={view === 'recover' ? 'login' : view}
                onChange={(id) => setView(id)}
                options={[
                  { id: 'login', label: 'Iniciar sesión' },
                  { id: 'register', label: 'Crear cuenta' },
                ]}
              />

              <AuthCredentialsForm
                view={view}
                onChangeView={setView}
                onLogin={authSession.login}
                onResolveLegacyFactor={authSession.resolveAndRemoveLegacyFactor}
                onRegister={authSession.registerCouncilor}
                onResetPassword={authSession.resetPassword}
              />
            </div>
          </div>
        </FadeInSection>
      </div>
    </section>
  );
}
