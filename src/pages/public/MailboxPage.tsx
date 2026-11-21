import { useEffect, useMemo, useState } from 'react';
import { Commission, PublicDirectoryMember } from '../../types/models';
import { AppRoute } from '../../types/navigation';
import { getCommissionSlug } from '../../utils/commissionUtils';
import { slugifyCouncilorName } from '../../utils/avatarCrop';
import { FadeInSection } from '../../components/ui/MotionPrimitives';
import { PageHeader } from '../../components/ui/PageHeader';
import { Tabs } from '../../components/ui/Tabs';
import { InitiativesBankPanel } from './InitiativesBankPanel';
import { MailboxLookupPanel } from './MailboxLookupPanel';
import { MailboxSidebar, MailboxSuccessCard } from './MailboxSidebarAndSuccess';
import { MailboxSubmitForm } from './MailboxSubmitForm';
import { CitizenCallsPanel, CitizenPollsPanel } from './ParticipationHubPanels';

type MailboxTab = 'radicar' | 'consultar' | 'iniciativas' | 'encuestas' | 'convocatorias';

const ALLOWED_TABS: MailboxTab[] = [
  'radicar',
  'consultar',
  'iniciativas',
  'encuestas',
  'convocatorias',
];

interface MailboxPageProps {
  recipientSlug?: string | null;
  initialTab?: string | null;
  commissionSlug?: string | null;
  commissions?: Commission[];
  directory?: PublicDirectoryMember[];
  onNavigate?: (path: AppRoute) => void;
}

export function MailboxPage({
  recipientSlug,
  initialTab,
  commissionSlug,
  commissions = [],
  directory = [],
  onNavigate,
}: MailboxPageProps) {
  const validTab = ALLOWED_TABS.includes(initialTab as MailboxTab)
    ? (initialTab as MailboxTab)
    : 'radicar';
  const [tab, setTab] = useState<MailboxTab>(validTab);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [prefillLookup, setPrefillLookup] = useState('');

  useEffect(() => {
    if (initialTab && ALLOWED_TABS.includes(initialTab as MailboxTab)) {
      setTab(initialTab as MailboxTab);
    }
  }, [initialTab]);

  const targetCouncilor = useMemo(() => {
    if (!recipientSlug) return null;
    return (
      directory.find(
        (m) => (m.slug || slugifyCouncilorName(m.displayName, m.uid)) === recipientSlug,
      ) || null
    );
  }, [recipientSlug, directory]);

  const targetCommission = useMemo(() => {
    if (!commissionSlug) return null;
    return commissions.find((c) => getCommissionSlug(c) === commissionSlug) || null;
  }, [commissionSlug, commissions]);

  return (
    <div>
      <PageHeader
        eyebrow="Participación Ciudadana · Flandes, Tolima"
        title="Buzón e iniciativas juveniles"
        description="Presenta propuestas, inquietudes o PQRSD, apoya iniciativas ciudadanas en el Banco Juvenil o participa en encuestas y convocatorias."
        breadcrumbs={[
          { label: 'Inicio', onClick: () => onNavigate?.('/') },
          { label: 'Participación' },
        ]}
      />

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <FadeInSection>
          <Tabs
            ariaLabel="Opciones de participación juvenil"
            activeId={tab}
            onChange={setTab}
            options={[
              { id: 'radicar', label: 'Radicar solicitud' },
              { id: 'consultar', label: 'Consultar seguimiento' },
              { id: 'iniciativas', label: 'Banco de iniciativas' },
              { id: 'encuestas', label: 'Encuestas ciudadanas' },
              { id: 'convocatorias', label: 'Convocatorias e inscripciones' },
            ]}
          />

          <div className="mt-8 grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            <div className="lg:col-span-8">
              {tab === 'iniciativas' ? (
                <InitiativesBankPanel />
              ) : tab === 'encuestas' ? (
                <CitizenPollsPanel />
              ) : tab === 'convocatorias' ? (
                <CitizenCallsPanel />
              ) : tab === 'radicar' ? (
                issuedCode ? (
                  <MailboxSuccessCard
                    issuedCode={issuedCode}
                    onLookupCode={(code) => {
                      setPrefillLookup(code);
                      setIssuedCode(null);
                      setTab('consultar');
                    }}
                    onReset={() => setIssuedCode(null)}
                  />
                ) : (
                  <MailboxSubmitForm
                    targetCouncilor={targetCouncilor}
                    targetCommission={targetCommission}
                    onIssuedCode={setIssuedCode}
                  />
                )
              ) : (
                <MailboxLookupPanel initialCode={prefillLookup} />
              )}
            </div>

            <MailboxSidebar />
          </div>
        </FadeInSection>
      </section>
    </div>
  );
}
