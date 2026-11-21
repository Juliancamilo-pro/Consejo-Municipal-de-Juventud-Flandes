import { useMemo, useState } from 'react';
import { Image as ImageIcon, Megaphone, Newspaper } from 'lucide-react';
import { PublicPortalState } from '../../hooks/usePublicPortalData';
import { NewsItem } from '../../types/models';
import { AppRoute } from '../../types/navigation';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { FilterChip, FilterToolbar } from '../../components/ui/FilterToolbar';
import { Select } from '../../components/ui/Input';
import { MediaDisplay } from '../../components/ui/MediaDisplay';
import { FadeInSection } from '../../components/ui/MotionPrimitives';
import { PageHeader } from '../../components/ui/PageHeader';
import { SkeletonCardGrid } from '../../components/ui/Skeleton';
import { Tabs } from '../../components/ui/Tabs';
import { WhatsAppShareButton } from '../../components/ui/WhatsAppShareButton';
import { NewsDetailModal } from './NewsDetailModal';
import { NewsOpenDataTab } from './NewsOpenDataTab';

interface NewsPageProps {
  portal: PublicPortalState;
  onNavigate?: (path: AppRoute) => void;
}

type ActualidadTab = 'noticias' | 'comunicados' | 'galeria' | 'datos';
const PAGE_STEP = 6;

export function NewsPage({ portal, onNavigate }: NewsPageProps) {
  const [tab, setTab] = useState<ActualidadTab>('noticias');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'recientes' | 'titulo'>('recientes');
  const [mediaOnly, setMediaOnly] = useState<'' | 'con_imagen'>('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP);
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);

  const authors = useMemo(() => {
    const set = new Set<string>();
    portal.news.forEach((n) => n.authorName && set.add(n.authorName));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es-CO'));
  }, [portal.news]);

  const filterAndSort = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items: NewsItem[]) => {
      const filtered = items.filter((n) => {
        if (mediaOnly === 'con_imagen' && !n.imageUrl) return false;
        if (authorFilter && n.authorName !== authorFilter) return false;
        if (!q) return true;
        return (
          n.title.toLowerCase().includes(q) ||
          n.summary.toLowerCase().includes(q) ||
          n.authorName.toLowerCase().includes(q) ||
          (n.tags || []).some((t) => t.toLowerCase().includes(q))
        );
      });
      return sortBy === 'titulo'
        ? [...filtered].sort((a, b) => a.title.localeCompare(b.title, 'es-CO'))
        : filtered;
    };
  }, [search, sortBy, mediaOnly, authorFilter]);

  const noticias = filterAndSort(portal.news.filter((n) => n.type === 'noticia'));
  const comunicados = filterAndSort(portal.news.filter((n) => n.type === 'comunicado'));
  const galeria = filterAndSort(portal.news.filter((n) => n.type === 'galeria'));
  const totalNoticias = portal.news.filter((n) => n.type === 'noticia').length;
  const totalComunicados = portal.news.filter((n) => n.type === 'comunicado').length;

  const activeChips: FilterChip[] = [];
  if (search.trim()) activeChips.push({ id: 'q', label: `Búsqueda: ${search.trim()}`, onRemove: () => setSearch('') });
  if (mediaOnly === 'con_imagen') activeChips.push({ id: 'media', label: 'Solo con fotografía', onRemove: () => setMediaOnly('') });
  if (authorFilter) activeChips.push({ id: 'author', label: `Autor: ${authorFilter}`, onRemove: () => setAuthorFilter('') });

  const clearFilters = () => {
    setSearch('');
    setMediaOnly('');
    setAuthorFilter('');
    setSortBy('recientes');
  };

  const activeTabCount =
    tab === 'noticias' ? noticias.length : tab === 'comunicados' ? comunicados.length : galeria.length;

  return (
    <div>
      <PageHeader
        eyebrow="Flandes, Tolima · Comunicación Pública y Datos Abiertos"
        title="Actualidad y transparencia"
        description="Boletines informativos, comunicados oficiales, galería institucional del CMJ Flandes y conjuntos de datos abiertos en formatos CSV y JSON."
        breadcrumbs={[{ label: 'Inicio', onClick: () => onNavigate?.('/') }, { label: 'Actualidad y Datos' }]}
        aside={
          totalNoticias > 0 || totalComunicados > 0 ? (
            <div className="flex items-center gap-6 rounded-xl border border-stone-200 bg-white px-5 py-3.5 text-xs dark:border-slate-800 dark:bg-slate-900">
              {totalNoticias > 0 && (
                <div>
                  <span className="text-stone-500 dark:text-slate-400">Noticias</span>
                  <p className="mt-0.5 font-display text-xl font-semibold tabular-nums text-[#7B1832] dark:text-[#D9B245]">{totalNoticias}</p>
                </div>
              )}
              {totalNoticias > 0 && totalComunicados > 0 && <div className="h-8 w-px bg-stone-200 dark:bg-slate-800" />}
              {totalComunicados > 0 && (
                <div>
                  <span className="text-stone-500 dark:text-slate-400">Comunicados</span>
                  <p className="mt-0.5 font-display text-xl font-semibold tabular-nums text-stone-950 dark:text-white">{totalComunicados}</p>
                </div>
              )}
            </div>
          ) : undefined
        }
      />

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <FadeInSection>
          <Tabs
            ariaLabel="Secciones de actualidad y transparencia"
            activeId={tab}
            onChange={(next) => {
              setTab(next);
              setVisibleCount(PAGE_STEP);
            }}
            options={[
              { id: 'noticias', label: 'Noticias' },
              { id: 'comunicados', label: 'Comunicados' },
              { id: 'galeria', label: 'Galería' },
              { id: 'datos', label: 'Datos abiertos' },
            ]}
          />

          {tab !== 'datos' && (
            <FilterToolbar
              className="mt-6"
              searchLabel="Buscar publicación"
              searchPlaceholder="Título, resumen o autor..."
              searchValue={search}
              onSearchChange={setSearch}
              activeSecondaryCount={authorFilter ? 1 : 0}
              activeChips={activeChips}
              onClearAll={clearFilters}
              resultsCount={activeTabCount}
              primaryFilters={
                <>
                  <Select label="Ordenar por" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'recientes' | 'titulo')}>
                    <option value="recientes">Más recientes</option>
                    <option value="titulo">Título (A–Z)</option>
                  </Select>
                  <Select label="Contenido visual" value={mediaOnly} onChange={(e) => setMediaOnly(e.target.value as '' | 'con_imagen')}>
                    <option value="">Todas las publicaciones</option>
                    <option value="con_imagen">Con fotografía</option>
                  </Select>
                </>
              }
              secondaryFilters={
                <Select label="Publicado por" value={authorFilter} onChange={(e) => setAuthorFilter(e.target.value)}>
                  <option value="">Cualquier autor</option>
                  {authors.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </Select>
              }
            />
          )}

          <div className="mt-8">
            {portal.loading ? (
              <SkeletonCardGrid count={3} />
            ) : (
              <>
                {tab === 'noticias' &&
                  (noticias.length === 0 ? (
                    <EmptyState
                      icon={Newspaper}
                      title={activeChips.length > 0 ? 'Sin noticias para esos filtros' : 'Aún no se han publicado noticias'}
                      description="Las crónicas y novedades oficiales del CMJ Flandes se mostrarán aquí una vez sean publicadas."
                      actionLabel={activeChips.length > 0 ? 'Limpiar filtros' : onNavigate ? 'Radicar propuesta juvenil' : undefined}
                      onAction={activeChips.length > 0 ? clearFilters : onNavigate ? () => onNavigate('/participacion') : undefined}
                    />
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        {noticias.slice(0, visibleCount).map((item, idx) => (
                          <Card key={item.id} variant="interactive" className={`overflow-hidden ${idx === 0 ? 'md:col-span-2' : ''}`} padding="none">
                            {item.imageUrl && (
                              <MediaDisplay
                                src={item.imageUrl}
                                alt={item.title}
                                className={`${idx === 0 ? 'max-h-80' : 'max-h-60'} w-full border-b border-stone-200 dark:border-slate-800`}
                              />
                            )}
                            <div className="p-6">
                              <p className="text-xs text-stone-500 dark:text-slate-400">
                                Noticia · {item.authorName}
                                {item.tags && item.tags.length > 0 ? ` · ${item.tags.slice(0, 3).join(' · ')}` : ''}
                              </p>
                              <h2 className="mt-2 font-display text-xl font-semibold text-stone-950 dark:text-white">{item.title}</h2>
                              <p className="cmj-prose mt-2 text-sm text-stone-600 dark:text-slate-300">{item.summary}</p>
                              <div className="mt-4 flex flex-wrap items-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => setSelectedItem(item)}>Leer completo</Button>
                                <WhatsAppShareButton text={`${item.title} · CMJ Flandes:`} />
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                      {visibleCount < noticias.length && (
                        <div className="text-center">
                          <Button variant="outline" onClick={() => setVisibleCount((c) => c + PAGE_STEP)}>
                            Cargar más noticias ({noticias.length - visibleCount} restantes)
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}

                {tab === 'comunicados' &&
                  (comunicados.length === 0 ? (
                    <EmptyState
                      icon={Megaphone}
                      title={activeChips.length > 0 ? 'Sin comunicados para esos filtros' : 'Aún no se han publicado comunicados'}
                      description="Los pronunciamientos oficiales de la Mesa Directiva y del pleno aparecerán aquí."
                      actionLabel={activeChips.length > 0 ? 'Limpiar filtros' : undefined}
                      onAction={activeChips.length > 0 ? clearFilters : undefined}
                    />
                  ) : (
                    <div className="space-y-4">
                      {comunicados.slice(0, visibleCount).map((item) => (
                        <Card key={item.id} variant="interactive">
                          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                            <div>
                              <p className="text-xs text-stone-500 dark:text-slate-400">Comunicado oficial · {item.authorName}</p>
                              <h2 className="mt-1 font-display text-xl font-semibold text-stone-950 dark:text-white">{item.title}</h2>
                              <p className="cmj-prose mt-1 text-sm text-stone-600 dark:text-slate-300">{item.summary}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button variant="outline" size="sm" onClick={() => setSelectedItem(item)}>Abrir comunicado</Button>
                              <WhatsAppShareButton text={`${item.title} · Comunicado CMJ Flandes:`} />
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ))}

                {tab === 'galeria' &&
                  (galeria.length === 0 ? (
                    <EmptyState
                      icon={ImageIcon}
                      title={activeChips.length > 0 ? 'Sin fotografías para esos filtros' : 'Aún no se han publicado registros en la galería'}
                      description="Las fotografías oficiales de sesiones, cabildos y encuentros juveniles aparecerán aquí."
                      actionLabel={activeChips.length > 0 ? 'Limpiar filtros' : undefined}
                      onAction={activeChips.length > 0 ? clearFilters : undefined}
                    />
                  ) : (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {galeria.slice(0, visibleCount).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSelectedItem(item)}
                          className="group overflow-hidden rounded-xl border border-stone-200 bg-white text-left transition-colors hover:border-[#7B1832]/50 dark:border-slate-800 dark:bg-slate-900/70"
                        >
                          {item.imageUrl ? (
                            <MediaDisplay src={item.imageUrl} alt={item.title} className="w-full" />
                          ) : (
                            <div className="flex aspect-[4/3] w-full items-center justify-center bg-stone-100 text-stone-400 dark:bg-slate-800">
                              <ImageIcon className="h-8 w-8" aria-hidden="true" />
                            </div>
                          )}
                          <div className="p-4">
                            <h3 className="font-display text-base font-semibold text-stone-950 dark:text-white">{item.title}</h3>
                            <p className="mt-1 text-xs text-stone-600 dark:text-slate-300">{item.summary}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ))}

                {tab === 'datos' && <NewsOpenDataTab portal={portal} />}
              </>
            )}
          </div>
        </FadeInSection>

        <NewsDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      </section>
    </div>
  );
}
