import { useState } from 'react';
import { CommitmentItem, ElectionItem, UserProfile } from '../../types/models';
import { Tabs } from '../../components/ui/Tabs';
import { CommitmentsPanel } from './CommitmentsPanel';
import { ElectionsPanel } from './ElectionsPanel';

interface ElectionsAndCommitmentsModuleProps {
  actor: UserProfile;
  users: UserProfile[];
  elections: ElectionItem[];
  commitments: CommitmentItem[];
  onReload: () => Promise<void>;
}

export function ElectionsAndCommitmentsModule({
  actor,
  users,
  elections,
  commitments,
  onReload,
}: ElectionsAndCommitmentsModuleProps) {
  const isBoard = ['secretario_admin', 'presidente', 'vicepresidente'].includes(actor.role);
  const isLeaderOrBoard = isBoard || actor.role === 'lider_comision';

  const [tab, setTab] = useState<'votaciones' | 'compromisos'>('votaciones');
  const activeUsers = users.filter((u) => u.status === 'activo');

  return (
    <div className="space-y-6">
      <Tabs
        ariaLabel="Submódulos de votaciones y compromisos"
        activeId={tab}
        onChange={setTab}
        options={[
          { id: 'votaciones', label: 'Votaciones secretas' },
          { id: 'compromisos', label: 'Compromisos y Exportación' },
        ]}
      />

      {tab === 'votaciones' && (
        <ElectionsPanel
          actor={actor}
          isBoard={isBoard}
          elections={elections}
          onReload={onReload}
        />
      )}

      {tab === 'compromisos' && (
        <CommitmentsPanel
          actor={actor}
          isLeaderOrBoard={isLeaderOrBoard}
          activeUsers={activeUsers}
          commitments={commitments}
          onReload={onReload}
        />
      )}
    </div>
  );
}
