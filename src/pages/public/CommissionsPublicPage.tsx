import { useMemo, useState } from 'react';
import { ArrowRight, Building2, Calendar, FileText, FolderKanban, LayoutGrid, List, Users } from 'lucide-react';
import { PublicPortalState } from '../../hooks/usePublicPortalData';
import { AppRoute } from '../../types/navigation';
import { slugifyCouncilorName } from '../../utils/avatarCrop';
import {
  computeCommissionGoalsProgress,
  getCommissionAccent,
  getCommissionIcon,
  getCommissionSlug,
} from '../../utils/commissionUtils';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { FilterChip, FilterToolbar } from '../../components/ui/FilterToolbar';
import { Select } from '../../components/ui/Input';
import { FadeInSection } from '../../components/ui/MotionPrimitives';
import { PageHeader } from '../../components/ui/PageHeader';
import { SkeletonCardGrid } from '../../components/ui/Skeleton';
import { WhatsAppShareButton } from '../../components/ui/WhatsAppShareButton';

interface CommissionsPublicPageProps {
  portal: PublicPortalState;
  onNavigate: (path: AppRoute) => void;
}

export function CommissionsPublicPage({ portal, onNavigate }: CommissionsPublicPageProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'nombre' | 'avance' | 'proyectos'>('nombre');
  const [viewMode, setViewMode] = useState<'tarjetas' | 'lista'>('tarjetas');

  const directoryByUid = useMemo(() => new Map(portal.directory.map((m) => [m.uid, m])), [portal.directory]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = !q
      ? portal.commissions
      : portal.commissions.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q) ||
            (c.mission || '').toLowerCase().includes(q),
        );
    return [...list].sort((a, b) => {
      if (sortBy === 'avance') return computeCommissionGoalsProgress(b) - computeCommissionGoalsProgress(a);
      if (sortBy === 'proyectos') {
        const pb = portal.projects.filter((p) => p.commissionId === b.id).length;
        const pa = portal.projects.filter((p) => p.commissionId === a.id).length;
        return pb - pa;
      }
      return a.name.localeCompare(b.name, 'es-CO');
    });
  }, [portal.commissions, portal.projects, search, sortBy]);

  const activeChips: FilterChip[] = search.trim()
    ? [{ id: 'q', label: `Búsqueda: ${search.trim()}`, onRemove: () => setSearch('') }]
    : [];

  return (
    <div>
      <PageHeader
        eyebrow="Estructura Temática · CMJ Flandes (2026–2029)"
        title="Comisiones de trabajo"
        description="Mesas permanentes del Consejo Municipal de Juventud donde los consejeros articulan proyectos, control social y agendas juveniles en Flandes, Tolima."
        breadcrumbs={[
          { label: 'Inicio', onClick: () => onNavigate('/') },
          { label: 'Comisiones' },
        ]}
        primaryAction={{
          label: 'Ver convocatorias abiertas',
          onClick: () => onNavigate('/participacion?tab=convocatorias'),
        }}
        aside={
          portal.commissions.length > 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white px-5 py-3.5 text-xs dark:border-slate-800 dark:bg-slate-900">
              <span className="text-stone-500 dark:text-slate-400">Comisiones activas</span>
              <p className="mt-0.5 font-display text-2xl font-semibold tabular-nums text-[#7B1832] dark:text-[#D9B245]">
                {portal.commissions.length}
              </p>
            </div>
          ) : undefined
        }
      />

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <FadeInSection>
          <FilterToolbar
            className="mb-8"
            searchLabel="Buscar comisión temática"
            searchPlaceholder="Educación, ambiente, cultura..."
            searchValue={search}
            onSearchChange={setSearch}
            activeChips={activeChips}
            onClearAll={() => {
              setSearch('');
              setSortBy('nombre');
            }}
            resultsCount={filtered.length}
            primaryFilters={
              <Select label="Ordenar por" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'nombre' | 'avance' | 'proyectos')}>
                <option value="nombre">Nombre (A–Z)</option>
                <option value="avance">Mayor avance en metas</option>
                <option value="proyectos">Más proyectos asociados</option>
              </Select>
            }
            viewToggle={
              <div className="flex h-[44px] items-center rounded-lg border border-stone-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setViewMode('tarjetas')}
                  aria-label="Vista en tarjetas"
                  className={`rounded-md p-2 ${viewMode === 'tarjetas' ? 'bg-[#7B1832] text-white' : 'text-stone-600 dark:text-slate-300'}`}
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('lista')}
                  aria-label="Vista en lista"
                  className={`rounded-md p-2 ${viewMode === 'lista' ? 'bg-[#7B1832] text-white' : 'text-stone-600 dark:text-slate-300'}`}
                >
                  <List className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            }
          />

          {portal.loading ? (
            <SkeletonCardGrid count={2} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No hay comisiones activas para mostrar"
              description="Cuando la Mesa Directiva active comisiones de trabajo aparecerán aquí. También puedes enviar una iniciativa para proponer agendas juveniles."
              actionLabel={search ? 'Limpiar búsqueda' : 'Proponer iniciativa juvenil'}
              onAction={search ? () => setSearch('') : () => onNavigate('/participacion')}
            />
          ) : (
            <div className={viewMode === 'tarjetas' ? 'grid grid-cols-1 gap-6 md:grid-cols-2' : 'space-y-4'}>
              {filtered.map((com) => {
                const slug = getCommissionSlug(com);
                const accent = getCommissionAccent(com.accentColor);
                const Icon = getCommissionIcon(com.iconName);
                const publishedMembers = portal.directory.filter(
                  (d) => d.commissionId === com.id || (com.memberUids || []).includes(d.uid),
                );
                const leaderMember = com.leaderUid ? directoryByUid.get(com.leaderUid) : undefined;
                const projectsCount = portal.projects.filter((p) => p.commissionId === com.id).length;
                const docsCount = portal.documents.filter((d) => d.commissionId === com.id).length;
                const goalsAvg = computeCommissionGoalsProgress(com);

                return (
                  <Card key={com.id} padding="none" variant="interactive" className="flex flex-col overflow-hidden">
                    {viewMode === 'tarjetas' && (
                      <div
                        className="relative aspect-[16/6] w-full shrink-0"
                        style={com.coverImageUrl ? undefined : { background: `linear-gradient(125deg, ${accent}, #0F172A)` }}
                      >
                        {com.coverImageUrl && (
                          <img src={com.coverImageUrl} alt={com.name} loading="lazy" className="h-full w-full object-cover" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/75 via-stone-950/20 to-transparent" />
                        <div className="absolute bottom-3 left-5 flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm" style={{ backgroundColor: accent }}>
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-1 flex-col p-6">
                      <h2 className="font-display text-xl font-semibold text-stone-950 dark:text-white">{com.name}</h2>
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-stone-600 dark:text-slate-300">
                        {com.mission || com.description}
                      </p>
                      {(projectsCount > 0 || docsCount > 0 || (com.goals?.length ?? 0) > 0) && (
                        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-stone-500 dark:text-slate-400">
                          {projectsCount > 0 && (
                            <span className="inline-flex items-center gap-1.5 font-mono-tabular">
                              <FolderKanban className="h-3.5 w-3.5" aria-hidden="true" />
                              {projectsCount} {projectsCount === 1 ? 'proyecto' : 'proyectos'}
                            </span>
                          )}
                          {docsCount > 0 && (
                            <span className="inline-flex items-center gap-1.5 font-mono-tabular">
                              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                              {docsCount} {docsCount === 1 ? 'documento' : 'documentos'}
                            </span>
                          )}
                          {(com.goals?.length ?? 0) > 0 && (
                            <span className="font-mono-tabular font-semibold text-[#7B1832] dark:text-[#D9B245]">
                              Plan {goalsAvg}%
                            </span>
                          )}
                        </div>
                      )}
                      {com.meetingSchedule && (
                        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-stone-500 dark:text-slate-400">
                          <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          <span>{com.meetingSchedule}</span>
                        </p>
                      )}
                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          {publishedMembers.slice(0, 4).map((m) => (
                            <button
                              key={m.uid}
                              type="button"
                              title={m.displayName}
                              onClick={() => onNavigate(`/consejeros/${m.slug || slugifyCouncilorName(m.displayName, m.uid)}`)}
                              className="rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7B1832]"
                            >
                              <Avatar name={m.displayName} src={m.photoUrl} size="sm" />
                            </button>
                          ))}
                          <span className="inline-flex items-center gap-1 text-xs text-stone-500 dark:text-slate-400">
                            <Users className="h-3.5 w-3.5" aria-hidden="true" />
                            {leaderMember
                              ? `Líder: ${leaderMember.displayName}`
                              : com.leaderName
                                ? `Líder: ${com.leaderName}`
                                : publishedMembers.length > 0
                                  ? `${publishedMembers.length} consejeros`
                                  : 'Mesa temática CMJ'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <WhatsAppShareButton
                            text={`Conoce la comisión ${com.name} del CMJ Flandes:`}
                            url={typeof window !== 'undefined' ? `${window.location.origin}/comisiones/${slug}` : undefined}
                          />
                          <Button size="sm" onClick={() => onNavigate(`/comisiones/${slug}`)}>
                            <span>Ver ficha</span>
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </FadeInSection>
      </section>
    </div>
  );
}
