import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Lock, Vote } from 'lucide-react';
import {
  castSecretBallot,
  checkHasVoted,
  closeElection,
  createElection,
  fetchElectionTally,
} from '../../services/electionsCommitmentsMailboxService';
import { ElectionItem, UserProfile } from '../../types/models';
import {
  exportRowsToCsv,
  exportRowsToPdf,
  exportRowsToXlsx,
} from '../../utils/tableExport';
import { DonutBreakdownChart } from '../../components/charts/SimpleSvgCharts';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Dialog } from '../../components/ui/Dialog';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { StatusText } from '../../components/ui/StatusText';
import { useToast } from '../../components/ui/Toast';

interface ElectionsPanelProps {
  actor: UserProfile;
  isBoard: boolean;
  elections: ElectionItem[];
  onReload: () => Promise<void>;
}

const SLICE_COLORS = ['#7B1832', '#1E3A8A', '#C59B27', '#059669', '#D97706', '#64748B'];

export function ElectionsPanel({ actor, isBoard, elections, onReload }: ElectionsPanelProps) {
  const { showToast } = useToast();
  const [elTitle, setElTitle] = useState('');
  const [elDesc, setElDesc] = useState('');
  const [elOptionsText, setElOptionsText] = useState('A favor\nEn contra\nAbstención');
  const [elClosesAt, setElClosesAt] = useState('');
  const [votedMap, setVotedMap] = useState<Record<string, boolean>>({});
  const [tallyMap, setTallyMap] = useState<Record<string, number[]>>({});
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [closeTarget, setCloseTarget] = useState<ElectionItem | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const loadElectionStates = async () => {
      const nextVoted: Record<string, boolean> = {};
      const nextTally: Record<string, number[]> = {};
      for (const el of elections) {
        nextVoted[el.id] = await checkHasVoted(el.id, actor.uid);
        if (el.status === 'cerrada') {
          nextTally[el.id] = await fetchElectionTally(el.id, el.options.length).catch(() => []);
        }
      }
      setVotedMap(nextVoted);
      setTallyMap(nextTally);
    };
    if (elections.length > 0) void loadElectionStates();
  }, [elections, actor.uid]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return elections.filter((el) => {
      if (statusFilter && el.status !== statusFilter) return false;
      if (!q) return true;
      return el.title.toLowerCase().includes(q) || el.description.toLowerCase().includes(q);
    });
  }, [elections, search, statusFilter]);

  const handleCreateElection = async (e: FormEvent) => {
    e.preventDefault();
    const opts = elOptionsText.split('\n').map((s) => s.trim()).filter(Boolean);
    if (opts.length < 2) {
      showToast('Agrega al menos 2 opciones de voto.', 'error');
      return;
    }
    setSaving(true);
    try {
      await createElection(actor, {
        title: elTitle,
        description: elDesc,
        options: opts,
        closesAt: elClosesAt || undefined,
      });
      setElTitle('');
      setElDesc('');
      setElClosesAt('');
      showToast('Votación interna abierta correctamente.', 'success');
      await onReload();
    } finally {
      setSaving(false);
    }
  };

  const handleVote = async (electionId: string, optionIndex: number) => {
    setSaving(true);
    try {
      await castSecretBallot(actor, electionId, optionIndex);
      setVotedMap((prev) => ({ ...prev, [electionId]: true }));
      showToast('Tu voto secreto ha sido registrado.', 'success');
      await onReload();
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmClose = async () => {
    if (!closeTarget) return;
    setClosing(true);
    try {
      await closeElection(actor, closeTarget.id);
      showToast('Votación cerrada y escrutinio publicado.', 'success');
      setCloseTarget(null);
      await onReload();
    } finally {
      setClosing(false);
    }
  };

  const buildScrutinyRows = (el: ElectionItem, tally: number[], total: number) =>
    el.options.map((opt, idx) => {
      const votes = tally[idx] || 0;
      const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
      return { option: opt, votes, pct: `${pct}%` };
    });

  return (
    <div className="space-y-6">
      {isBoard && (
        <Card>
          <h2 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
            Abrir votación interna (voto secreto)
          </h2>
          <form onSubmit={handleCreateElection} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Asunto o proposición a votar" required minLength={3} maxLength={200} value={elTitle} onChange={(e) => setElTitle(e.target.value)} />
              <Input label="Cierre programado (opcional)" type="datetime-local" value={elClosesAt} onChange={(e) => setElClosesAt(e.target.value)} />
            </div>
            <Textarea label="Descripción" required minLength={5} maxLength={2000} rows={2} value={elDesc} onChange={(e) => setElDesc(e.target.value)} />
            <Textarea label="Opciones de voto (una por línea, mínimo 2)" required rows={3} value={elOptionsText} onChange={(e) => setElOptionsText(e.target.value)} />
            <Button type="submit" loading={saving}>Convocar votación</Button>
          </form>
        </Card>
      )}

      <Card padding="sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Buscar votación" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Asunto o descripción..." />
          <Select label="Filtrar por estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todas</option>
            <option value="abierta">Abiertas</option>
            <option value="cerrada">Cerradas · Escrutinio</option>
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState icon={Vote} title="No hay votaciones registradas" description="Cuando la Mesa Directiva abra una votación interna podrás emitir tu voto secreto único." />
      ) : (
        <div className="space-y-4">
          {filtered.map((el) => {
            const alreadyVoted = Boolean(votedMap[el.id]);
            const tally = tallyMap[el.id] || [];
            const totalVotes = tally.reduce((acc, n) => acc + n, 0);
            const expired = Boolean(el.closesAt && new Date(el.closesAt).getTime() <= Date.now());
            const cols = [
              { header: 'Opción', getValue: (r: { option: string; votes: number; pct: string }) => r.option },
              { header: 'Votos', getValue: (r: { option: string; votes: number; pct: string }) => r.votes },
              { header: 'Porcentaje', getValue: (r: { option: string; votes: number; pct: string }) => r.pct },
            ];

            return (
              <Card key={el.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusText
                      label={el.status === 'abierta' ? (expired ? 'Plazo cumplido · Pendiente cierre' : 'Votación abierta') : 'Cerrada · Escrutinio'}
                      tone={el.status === 'abierta' && !expired ? 'success' : 'info'}
                    />
                    {el.closesAt && (
                      <span className="font-mono-tabular text-xs text-stone-500">
                        Cierre programado: {el.closesAt.replace('T', ' ')}
                      </span>
                    )}
                  </div>
                  {isBoard && el.status === 'abierta' && (
                    <Button size="sm" variant="outline" onClick={() => setCloseTarget(el)}>
                      Cerrar y publicar escrutinio
                    </Button>
                  )}
                </div>
                <h3 className="mt-2 font-display text-xl font-semibold text-stone-950 dark:text-white">{el.title}</h3>
                <p className="mt-1 text-sm text-stone-600 dark:text-slate-300">{el.description}</p>

                {el.status === 'abierta' ? (
                  alreadyVoted ? (
                    <p className="mt-4 flex items-center gap-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                      <Lock className="h-4 w-4" aria-hidden="true" />
                      <span>Tu voto secreto ya fue registrado. Los resultados se publicarán al cierre.</span>
                    </p>
                  ) : expired ? (
                    <p className="mt-4 text-xs font-medium text-amber-700 dark:text-amber-300">
                      El plazo programado de esta votación ha vencido. La Mesa Directiva puede cerrarla para publicar el escrutinio.
                    </p>
                  ) : (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {el.options.map((opt, idx) => (
                        <Button key={opt} size="sm" variant="outline" disabled={saving} onClick={() => void handleVote(el.id, idx)}>
                          Votar: {opt}
                        </Button>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="mt-5 grid grid-cols-1 gap-6 border-t border-stone-200 pt-5 lg:grid-cols-12 dark:border-slate-800">
                    <div className="lg:col-span-5">
                      <DonutBreakdownChart
                        centerLabel="Votos"
                        centerValue={totalVotes}
                        slices={el.options.map((opt, idx) => ({
                          label: opt,
                          value: tally[idx] || 0,
                          color: SLICE_COLORS[idx % SLICE_COLORS.length],
                        }))}
                      />
                    </div>
                    <div className="space-y-3 lg:col-span-7">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-stone-600 dark:text-slate-300">
                          Escrutinio oficial ({totalVotes} votos)
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => exportRowsToCsv(`escrutinio-${el.id}`, cols, buildScrutinyRows(el, tally, totalVotes))}>
                            <Download className="h-3.5 w-3.5" aria-hidden="true" /><span>CSV</span>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void exportRowsToXlsx(`escrutinio-${el.id}`, cols, buildScrutinyRows(el, tally, totalVotes), el.title)}>
                            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" /><span>Excel</span>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void exportRowsToPdf(`escrutinio-${el.id}`, cols, buildScrutinyRows(el, tally, totalVotes), el.title)}>
                            <FileText className="h-3.5 w-3.5 text-[#7B1832]" aria-hidden="true" /><span>PDF</span>
                          </Button>
                        </div>
                      </div>
                      {el.options.map((opt, idx) => {
                        const count = tally[idx] || 0;
                        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                        return (
                          <div key={opt} className="text-sm">
                            <div className="flex justify-between">
                              <span>{opt}</span>
                              <span className="font-mono-tabular">{count} ({pct}%)</span>
                            </div>
                            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-slate-800">
                              <div className="h-full" style={{ width: `${pct}%`, backgroundColor: SLICE_COLORS[idx % SLICE_COLORS.length] }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={Boolean(closeTarget)}
        loading={closing}
        title="¿Cerrar votación y publicar escrutinio?"
        description={`Una vez cerrada "${closeTarget?.title || ''}", no se recibirán más papeletas y el conteo será visible para los consejeros.`}
        confirmLabel="Cerrar votación"
        onConfirm={handleConfirmClose}
        onCancel={() => setCloseTarget(null)}
      />
    </div>
  );
}
