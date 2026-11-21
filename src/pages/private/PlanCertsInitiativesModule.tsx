import { useState } from 'react';
import { Commission, UserProfile } from '../../types/models';
import { Tabs } from '../../components/ui/Tabs';
import { ActionPlanPanel } from './ActionPlanPanel';
import { CertificatesPanel } from './CertificatesPanel';
import { InitiativesAdminPanel } from './InitiativesAdminPanel';

interface PlanCertsInitiativesModuleProps {
  actor: UserProfile;
  isBoard: boolean;
  users: UserProfile[];
  commissions: Commission[];
}

type SubTab = 'plan_anual' | 'certificados' | 'iniciativas';

export function PlanCertsInitiativesModule({
  actor,
  isBoard,
  users,
  commissions,
}: PlanCertsInitiativesModuleProps) {
  const [tab, setTab] = useState<SubTab>('plan_anual');

  const options: { id: SubTab; label: string }[] = isBoard
    ? [
        { id: 'plan_anual', label: 'Plan de Acción Anual' },
        { id: 'certificados', label: 'Certificados PDF + QR' },
        { id: 'iniciativas', label: 'Banco de iniciativas' },
      ]
    : [{ id: 'plan_anual', label: 'Plan de Acción Anual' }];

  return (
    <div className="space-y-6">
      <Tabs
        ariaLabel="Plan de acción, certificados e iniciativas"
        activeId={tab}
        onChange={setTab}
        options={options}
      />

      {tab === 'plan_anual' && (
        <ActionPlanPanel actor={actor} isBoard={isBoard} commissions={commissions} />
      )}

      {tab === 'certificados' && isBoard && (
        <CertificatesPanel actor={actor} users={users} />
      )}

      {tab === 'iniciativas' && isBoard && (
        <InitiativesAdminPanel actor={actor} commissions={commissions} />
      )}
    </div>
  );
}
