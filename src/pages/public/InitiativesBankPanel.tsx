import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Lightbulb, Search, Send, ThumbsUp } from 'lucide-react';
import {
  fetchYouthInitiatives,
  submitYouthInitiative,
  supportYouthInitiative,
} from '../../services/initiativesService';
import { YouthInitiative } from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { SkeletonCardGrid } from '../../components/ui/Skeleton';
import { StatusText } from '../../components/ui/StatusText';
import { useToast } from '../../components/ui/Toast';
import { WhatsAppShareButton } from '../../components/ui/WhatsAppShareButton';

const THEMATIC_OPTIONS = [
  'Educación y Cultura',
  'Deporte y Bienestar',
  'Ambiente y Ruralidad',
  'Emprendimiento y Empleo',
  'Salud Mental y Convivencia',
];

export function InitiativesBankPanel() {
  const { showToast } = useToast();
  const [initiatives, setInitiatives] = useState<YouthInitiative[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [sortBy, setSortBy] = useState<'apoyos' | 'titulo'>('apoyos');
  const [title, setTitle] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [thematicArea, setThematicArea] = useState(THEMATIC_OPTIONS[0]);
  const [proposerAlias, setProposerAlias] = useState('');
  const [summary, setSummary] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setInitiatives(await fetchYouthInitiatives());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = initiatives.filter((i) => {
      if (areaFilter && i.thematicArea !== areaFilter) return false;
      if (!q) return true;
      return (
        i.title.toLowerCase().includes(q) ||
        i.neighborhood.toLowerCase().includes(q) ||
        i.summary.toLowerCase().includes(q)
      );
    });
    return [...list].sort((a, b) =>
      sortBy === 'apoyos'
        ? b.supportCount - a.supportCount
        : a.title.localeCompare(b.title, 'es-CO'),
    );
  }, [initiatives, search, areaFilter, sortBy]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (honeypot.trim()) return;
    setSubmitting(true);
    try {
      await submitYouthInitiative({ title, summary, neighborhood, thematicArea, proposerAlias });
      setTitle('');
      setNeighborhood('');
      setProposerAlias('');
      setSummary('');
      showToast('Iniciativa publicada en el Banco Juvenil de Flandes.', 'success');
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSupport = async (id: string) => {
    try {
      const res = await supportYouthInitiative(id);
      if (res === 'already') {
        showToast('Ya respaldaste esta iniciativa desde este dispositivo.', 'info');
      } else {
        showToast('Respaldo ciudadano registrado.', 'success');
        await load();
      }
    } catch {
      showToast('No fue posible registrar el apoyo en este momento.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
          Proponer una iniciativa para los jóvenes de Flandes
        </h2>
        <p className="mt-1 text-xs text-stone-500 dark:text-slate-400">
          Comparte ideas comunitarias para tu barrio o vereda (no ingreses datos personales sensibles).
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="hidden" aria-hidden="true">
            <input tabIndex={-1} value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Título de la iniciativa" required minLength={5} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Cine foro juvenil al aire libre en Las Quintas" />
            <Input label="Barrio o vereda" required minLength={2} maxLength={120} value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Ej. Centro, Topacio, Colegio..." />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Área temática" value={thematicArea} onChange={(e) => setThematicArea(e.target.value)}>
              {THEMATIC_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </Select>
            <Input label="Colectivo o alias proponente (opcional)" maxLength={80} value={proposerAlias} onChange={(e) => setProposerAlias(e.target.value)} placeholder="Ej. Colectivo Río Magdalena" />
          </div>

          <Textarea label="Descripción de la propuesta" required minLength={15} maxLength={1500} rows={3} value={summary} onChange={(e) => setSummary(e.target.value)} />

          <Button type="submit" loading={submitting}>
            <Send className="h-4 w-4" aria-hidden="true" />
            <span>Publicar iniciativa</span>
          </Button>
        </form>
      </Card>

      {initiatives.length > 0 && (
        <Card padding="sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-9 left-3 h-4 w-4 text-stone-400" aria-hidden="true" />
              <Input label="Buscar iniciativa" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Barrio, título..." className="pl-9" />
            </div>
            <Select label="Área temática" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)}>
              <option value="">Todas las áreas</option>
              {THEMATIC_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </Select>
            <Select label="Ordenar por" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'apoyos' | 'titulo')}>
              <option value="apoyos">Más respaldadas</option>
              <option value="titulo">Título (A–Z)</option>
            </Select>
          </div>
        </Card>
      )}

      {loading ? (
        <SkeletonCardGrid count={2} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Lightbulb}
          title="Sé el primero en proponer una iniciativa"
          description="Las propuestas ciudadanas pueden recibir apoyos de otros jóvenes y ser priorizadas por el Consejo."
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => (
            <Card key={item.id} variant="interactive">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                    <span>{item.thematicArea}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.neighborhood}</span>
                    <StatusText label={item.status.replace('_', ' ')} tone={item.status === 'aprobada' ? 'success' : 'info'} />
                  </div>
                  <h3 className="mt-1.5 font-display text-lg font-semibold text-stone-950 dark:text-white">{item.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-stone-600 dark:text-slate-300">{item.summary}</p>
                  <p className="mt-2 text-xs text-stone-500 dark:text-slate-400">Propuesto por: {item.proposerAlias}</p>
                  {item.boardResponse && (
                    <p className="mt-2 rounded-lg border border-stone-200 bg-[#FAF8F4] p-2.5 text-xs text-stone-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
                      Respuesta CMJ: {item.boardResponse}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <WhatsAppShareButton text={`Apoya esta iniciativa juvenil en Flandes: ${item.title}`} />
                  <Button size="sm" variant="outline" onClick={() => void handleSupport(item.id)}>
                    <ThumbsUp className="h-3.5 w-3.5 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
                    <span className="font-mono-tabular">Apoyar ({item.supportCount})</span>
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
