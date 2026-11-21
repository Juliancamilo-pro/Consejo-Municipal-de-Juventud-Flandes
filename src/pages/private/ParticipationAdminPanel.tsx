import { useCallback, useEffect, useState } from 'react';
import { Archive, BarChart3, Copy, Vote } from 'lucide-react';
import {
  duplicatePublicPoll,
  fetchAllCalls,
  fetchAllPolls,
  fetchCallRegistrations,
  updatePollStatus,
} from '../../services/participationPublicService';
import { UserProfile } from '../../types/models';
import { CallRegistration, PublicCall, PublicPoll } from '../../types/participation';
import { getPollTotalResponses } from '../../utils/participationExport';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/Toast';
import { PollAnalyticsModal } from './PollAnalyticsModal';
import { PollBuilderForm } from './PollBuilderForm';
import {
  CallRegistrationsTable,
  ParticipationCallsAdminTab,
} from './ParticipationCallsAdminTab';

interface ParticipationAdminPanelProps {
  actor: UserProfile;
}

export function ParticipationAdminPanel({ actor }: ParticipationAdminPanelProps) {
  const { showToast } = useToast();
  const [subTab, setSubTab] = useState<'encuestas' | 'convocatorias' | 'inscritos'>('encuestas');
  const [polls, setPolls] = useState<PublicPoll[]>([]);
  const [calls, setCalls] = useState<PublicCall[]>([]);
  const [registrations, setRegistrations] = useState<CallRegistration[]>([]);
  const [selectedAnalyticsPoll, setSelectedAnalyticsPoll] = useState<PublicPoll | null>(null);

  const loadAll = useCallback(async () => {
    const [p, c, r] = await Promise.allSettled([
      fetchAllPolls(),
      fetchAllCalls(),
      fetchCallRegistrations(),
    ]);
    if (p.status === 'fulfilled') setPolls(p.value);
    if (c.status === 'fulfilled') setCalls(c.value);
    if (r.status === 'fulfilled') setRegistrations(r.value);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  return (
    <div className="space-y-6">
      <Tabs
        ariaLabel="Gestión de participación ciudadana"
        activeId={subTab}
        onChange={setSubTab}
        options={[
          { id: 'encuestas', label: `Encuestas (${polls.length})` },
          { id: 'convocatorias', label: `Convocatorias (${calls.length})` },
          { id: 'inscritos', label: `Jóvenes inscritos (${registrations.length})` },
        ]}
      />

      {subTab === 'encuestas' && (
        <div className="space-y-6">
          <PollBuilderForm actor={actor} onCreated={loadAll} />

          {polls.length === 0 ? (
            <EmptyState
              icon={Vote}
              title="Sin encuestas creadas"
              description="Las consultas ciudadanas publicadas aquí aparecen en el módulo público Participación."
            />
          ) : (
            <div className="space-y-3">
              {polls.map((poll) => {
                const total = getPollTotalResponses(poll);
                return (
                  <Card key={poll.id} padding="sm">
                    <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={poll.status === 'abierta' ? 'success' : poll.status === 'archivada' ? 'warning' : 'neutral'}>
                            {poll.status.toUpperCase()}
                          </Badge>
                          <span className="font-mono-tabular text-xs text-stone-500">
                            {total} participación(es) · {(poll.questions?.length || 1)} pregunta(s)
                          </span>
                        </div>
                        <h3 className="mt-1 font-display text-base font-semibold text-stone-950 dark:text-white">
                          {poll.title}
                        </h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedAnalyticsPoll(poll)}
                        >
                          <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Resultados y exportar</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            void duplicatePublicPoll(actor, poll).then(() => {
                              showToast('Encuesta duplicada en estado borrador.', 'success');
                              return loadAll();
                            })
                          }
                        >
                          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Duplicar</span>
                        </Button>
                        {poll.status !== 'archivada' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void updatePollStatus(
                                actor,
                                poll.id,
                                poll.status === 'abierta' ? 'cerrada' : 'abierta',
                              ).then(loadAll)
                            }
                          >
                            {poll.status === 'abierta' ? 'Cerrar' : 'Reabrir'}
                          </Button>
                        )}
                        {poll.status !== 'archivada' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              void updatePollStatus(actor, poll.id, 'archivada').then(loadAll)
                            }
                          >
                            <Archive className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Archivar</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {subTab === 'convocatorias' && (
        <ParticipationCallsAdminTab
          actor={actor}
          calls={calls}
          registrations={registrations}
          onReload={loadAll}
        />
      )}

      {subTab === 'inscritos' && <CallRegistrationsTable registrations={registrations} />}

      <PollAnalyticsModal
        poll={selectedAnalyticsPoll}
        onClose={() => setSelectedAnalyticsPoll(null)}
      />
    </div>
  );
}
