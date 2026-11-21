import { useMemo, useState } from 'react';
import { LayoutGrid, List, Users } from 'lucide-react';
import { PublicPortalState } from '../../hooks/usePublicPortalData';
import { PublicDirectoryMember, ROLE_LABELS, UserRole } from '../../types/models';
import { AppRoute } from '../../types/navigation';
import { slugifyCouncilorName } from '../../utils/avatarCrop';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { FilterChip, FilterToolbar } from '../../components/ui/FilterToolbar';
import { Select } from '../../components/ui/Input';
import { FadeInSection } from '../../components/ui/MotionPrimitives';
import { PageHeader } from '../../components/ui/PageHeader';
import { SkeletonCardGrid } from '../../components/ui/Skeleton';
import { Tabs } from '../../components/ui/Tabs';
import { BoardHighlightSection } from './BoardHighlightSection';
import { CouncilorDirectoryCard } from './CouncilorDirectoryCard';
import { TerritorialDirectoryPanel } from './TerritorialDirectoryPanel';

interface CounselorsPageProps {
  portal: PublicPortalState;
  onNavigate: (path: AppRoute) => void;
}

const BOARD_ROLES: UserRole[] = ['presidente', 'vicepresidente', 'secretario_admin'];
const PAGE_STEP = 9;

export function CounselorsPage({ portal, onNavigate }: CounselorsPageProps) {
  const [viewMode, setViewMode] = useState<'lista' | 'territorial'>('lista');
  const [layoutMode, setLayoutMode] = useState<'tarjetas' | 'compacto'>('tarjetas');
  const [search, setSearch] = useState('');
  const [commissionFilter, setCommissionFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [axisFilter, setAxisFilter] = useState('');
  const [sortBy, setSortBy] = useState<'az' | 'za' | 'cargo'>('az');
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP);

  const getSlug = (m: PublicDirectoryMember) =>
    m.slug || slugifyCouncilorName(m.displayName, m.uid);

  const boardMembers = useMemo(
    () => portal.directory.filter((m) => BOARD_ROLES.includes(m.role)),
    [portal.directory],
  );

  const sectors = useMemo(() => {
    const set = new Set<string>();
    portal.directory.forEach((m) => {
      if (m.sector) set.add(m.sector);
    });
    return Array.from(set).sort();
  }, [portal.directory]);

  const workAxesList = useMemo(() => {
    const set = new Set<string>();
    portal.directory.forEach((m) => {
      (m.workAxes || []).forEach((ax) => set.add(ax));
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es-CO'));
  }, [portal.directory]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = portal.directory.filter((m) => {
      if (commissionFilter && m.commissionId !== commissionFilter) return false;
      if (roleFilter && m.role !== roleFilter) return false;
      if (sectorFilter && m.sector !== sectorFilter) return false;
      if (axisFilter && !(m.workAxes || []).includes(axisFilter)) return false;
      if (!q) return true;
      const haystack = [
        m.displayName,
        m.positionTitle,
        m.sector,
        m.shortBio,
        m.bio,
        m.featuredQuote,
        m.commissionName,
        ...(m.workAxes || []),
        ...(m.skills || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
    return [...list].sort((a, b) => {
      if (sortBy === 'za') return b.displayName.localeCompare(a.displayName, 'es-CO');
      if (sortBy === 'cargo') return ROLE_LABELS[a.role].localeCompare(ROLE_LABELS[b.role], 'es-CO');
      return a.displayName.localeCompare(b.displayName, 'es-CO');
    });
  }, [portal.directory, search, commissionFilter, roleFilter, sectorFilter, axisFilter, sortBy]);

  const visibleMembers = filtered.slice(0, visibleCount);
  const clearFilters = () => {
    setSearch('');
    setCommissionFilter('');
    setRoleFilter('');
    setSectorFilter('');
    setAxisFilter('');
    setSortBy('az');
    setVisibleCount(PAGE_STEP);
  };

  const activeChips: FilterChip[] = [];
  if (search.trim()) {
    activeChips.push({ id: 'q', label: `Búsqueda: ${search.trim()}`, onRemove: () => setSearch('') });
  }
  if (commissionFilter) {
    const com = portal.commissions.find((c) => c.id === commissionFilter);
    activeChips.push({
      id: 'com',
      label: `Comisión: ${com?.name || commissionFilter}`,
      onRemove: () => setCommissionFilter(''),
    });
  }
  if (roleFilter) {
    activeChips.push({
      id: 'role',
      label: `Cargo: ${ROLE_LABELS[roleFilter as UserRole] || roleFilter}`,
      onRemove: () => setRoleFilter(''),
    });
  }
  if (axisFilter) {
    activeChips.push({ id: 'axis', label: `Eje: ${axisFilter}`, onRemove: () => setAxisFilter('') });
  }
  if (sectorFilter) {
    activeChips.push({ id: 'sec', label: `Sector: ${sectorFilter}`, onRemove: () => setSectorFilter('') });
  }

  const activeSecondaryCount = [axisFilter, sectorFilter, sortBy !== 'az' ? sortBy : ''].filter(Boolean).length;

  return (
    <div>
      <PageHeader
        eyebrow="Representación Juvenil · Flandes, Tolima (2026–2029)"
        title="Consejeros Municipales de Juventud"
        description="Conoce a los jóvenes electos que integran la Mesa Directiva y las comisiones temáticas del CMJ Flandes, sus hojas de vida públicas y cobertura territorial."
        breadcrumbs={[
          { label: 'Inicio', onClick: () => onNavigate('/') },
          { label: 'Consejeros' },
        ]}
        primaryAction={{ label: 'Escribir a un consejero', onClick: () => onNavigate('/participacion') }}
      />

      <section className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6 lg:px-8">
        <BoardHighlightSection
          loading={portal.loading}
          boardMembers={boardMembers}
          onNavigate={onNavigate}
        />

        <FadeInSection>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs
              ariaLabel="Vista del directorio de consejeros"
              activeId={viewMode}
              onChange={setViewMode}
              options={[
                { id: 'lista', label: 'Directorio completo' },
                { id: 'territorial', label: 'Mapa por barrio, vereda o sector' },
              ]}
            />
          </div>

          {viewMode === 'territorial' ? (
            <div className="mt-6">
              <TerritorialDirectoryPanel directory={portal.directory} onNavigate={onNavigate} />
            </div>
          ) : (
            <>
              <FilterToolbar
                className="mt-6"
                searchLabel="Buscar consejero o tema"
                searchPlaceholder="Nombre, comisión o palabra..."
                searchValue={search}
                onSearchChange={setSearch}
                activeSecondaryCount={activeSecondaryCount}
                activeChips={activeChips}
                onClearAll={clearFilters}
                resultsCount={filtered.length}
                primaryFilters={
                  <>
                    <Select label="Comisión" value={commissionFilter} onChange={(e) => setCommissionFilter(e.target.value)}>
                      <option value="">Todas las comisiones</option>
                      {portal.commissions.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </Select>
                    <Select label="Cargo o dignidad" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                      <option value="">Todos los cargos</option>
                      <option value="presidente">Presidente</option>
                      <option value="vicepresidente">Vicepresidente</option>
                      <option value="secretario_admin">Secretario Administrador</option>
                      <option value="lider_comision">Líder de Comisión</option>
                      <option value="consejero">Consejero</option>
                    </Select>
                  </>
                }
                secondaryFilters={
                  <>
                    <Select label="Eje de trabajo" value={axisFilter} onChange={(e) => setAxisFilter(e.target.value)}>
                      <option value="">Todos los ejes</option>
                      {workAxesList.map((ax) => (
                        <option key={ax} value={ax}>{ax}</option>
                      ))}
                    </Select>
                    <Select label="Sector o lista" value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)}>
                      <option value="">Todos los sectores</option>
                      {sectors.map((sec) => (
                        <option key={sec} value={sec}>{sec}</option>
                      ))}
                    </Select>
                    <Select label="Ordenar por" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'az' | 'za' | 'cargo')}>
                      <option value="az">Nombre (A–Z)</option>
                      <option value="za">Nombre (Z–A)</option>
                      <option value="cargo">Cargo institucional</option>
                    </Select>
                  </>
                }
                viewToggle={
                  <div className="flex h-[44px] items-center rounded-lg border border-stone-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-900">
                    <button
                      type="button"
                      onClick={() => setLayoutMode('tarjetas')}
                      aria-label="Vista en tarjetas"
                      className={`rounded-md p-2 ${layoutMode === 'tarjetas' ? 'bg-[#7B1832] text-white' : 'text-stone-600 dark:text-slate-300'}`}
                    >
                      <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setLayoutMode('compacto')}
                      aria-label="Vista en lista compacta"
                      className={`rounded-md p-2 ${layoutMode === 'compacto' ? 'bg-[#7B1832] text-white' : 'text-stone-600 dark:text-slate-300'}`}
                    >
                      <List className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                }
              />

              <div className="mt-6">
                {portal.loading ? (
                  <SkeletonCardGrid count={6} />
                ) : filtered.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title={
                      activeChips.length > 0
                        ? 'No se encontraron consejeros con esos filtros'
                        : 'Aún no hay consejeros publicados en el directorio'
                    }
                    description={
                      activeChips.length > 0
                        ? 'Prueba quitar alguno de los filtros activos o limpiar la búsqueda.'
                        : 'Cuando los consejeros publiquen su ficha institucional aparecerán aquí. Puedes radicar inquietudes en el buzón ciudadano.'
                    }
                    actionLabel={activeChips.length > 0 ? 'Limpiar filtros' : 'Ir al buzón de participación'}
                    onAction={activeChips.length > 0 ? clearFilters : () => onNavigate('/participacion')}
                  />
                ) : (
                  <>
                    <div className={layoutMode === 'tarjetas' ? 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3' : 'space-y-3'}>
                      {visibleMembers.map((member) => (
                        <CouncilorDirectoryCard
                          key={member.uid}
                          member={member}
                          slug={getSlug(member)}
                          commObj={portal.commissions.find((c) => c.id === member.commissionId)}
                          compact={layoutMode === 'compacto'}
                          onNavigate={onNavigate}
                        />
                      ))}
                    </div>

                    {visibleCount < filtered.length && (
                      <div className="mt-6 text-center">
                        <Button variant="outline" onClick={() => setVisibleCount((c) => c + PAGE_STEP)}>
                          Cargar más consejeros ({filtered.length - visibleCount} restantes)
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </FadeInSection>
      </section>
    </div>
  );
}
