import { useMemo, useState } from 'react';
import { FolderKanban, QrCode, Search, Users } from 'lucide-react';
import { PublicPortalState } from '../../hooks/usePublicPortalData';
import { InstitutionalDocument } from '../../types/models';
import { AppRoute } from '../../types/navigation';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { FadeInSection } from '../../components/ui/MotionPrimitives';
import { PageHeader } from '../../components/ui/PageHeader';
import { SkeletonCardGrid } from '../../components/ui/Skeleton';
import { StatusText } from '../../components/ui/StatusText';
import { useResolvedStorageUrl } from '../../components/ui/StorageFileActions';
import { Tabs } from '../../components/ui/Tabs';
import { WhatsAppShareButton } from '../../components/ui/WhatsAppShareButton';
import { ActionPlanPublicPanel } from './ActionPlanPublicPanel';
import { GovernanceAccountabilityPanel } from './GovernanceAccountabilityPanel';
import { GovernanceCalendarPanel, GovernanceDocsPanel } from './GovernanceDocsAndEvents';
import { TimelinePublicPanel } from './TimelinePublicPanel';

interface GovernancePageProps {
  portal: PublicPortalState;
  onNavigate?: (path: AppRoute) => void;
}

type GovTab =
  | 'proyectos'
  | 'plan_anual'
  | 'rendicion'
  | 'linea_tiempo'
  | 'sesiones'
  | 'calendario'
  | 'documentos';

export function GovernancePage({ portal, onNavigate }: GovernancePageProps) {
  const [tab, setTab] = useState<GovTab>('proyectos');
  const [projectSearch, setProjectSearch] = useState('');
  const [projectSort, setProjectSort] = useState<'avance' | 'titulo'>('avance');
  const [sessionSearch, setSessionSearch] = useState('');
  const [previewDoc, setPreviewDoc] = useState<InstitutionalDocument | null>(null);
  const { url: previewUrl, loading: loadingPreview, errorMsg: previewError } =
    useResolvedStorageUrl(previewDoc, true);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    const list = !q
      ? portal.projects
      : portal.projects.filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            p.summary.toLowerCase().includes(q) ||
            p.objective.toLowerCase().includes(q),
        );
    return [...list].sort((a, b) =>
      projectSort === 'avance'
        ? b.progressPercent - a.progressPercent
        : a.title.localeCompare(b.title, 'es-CO'),
    );
  }, [portal.projects, projectSearch, projectSort]);

  const filteredSessions = useMemo(() => {
    const q = sessionSearch.trim().toLowerCase();
    if (!q) return portal.sessions;
    return portal.sessions.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.agenda.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q),
    );
  }, [portal.sessions, sessionSearch]);

  const hasAsideMetrics = portal.projects.length > 0 || portal.documents.length > 0;

  return (
    <div>
      <PageHeader
        eyebrow="Transparencia · Flandes, Tolima · Periodo 2026–2029"
        title="Gestión institucional y rendición de cuentas"
        description="Consulta el avance de los proyectos juveniles, Plan de Acción Anual, línea de tiempo 2026–2029, sesiones del pleno, agenda sincronizable y centro documental oficial."
        breadcrumbs={[
          { label: 'Inicio', onClick: () => onNavigate?.('/') },
          { label: 'Gestión y Actas' },
        ]}
        primaryAction={
          onNavigate
            ? { label: 'Verificar certificado', onClick: () => onNavigate('/verificar'), variant: 'outline' }
            : undefined
        }
        aside={
          hasAsideMetrics ? (
            <div className="flex items-center gap-5 rounded-xl border border-stone-200 bg-white px-5 py-3.5 text-xs dark:border-slate-800 dark:bg-slate-900">
              {portal.projects.length > 0 && (
                <div>
                  <span className="text-stone-500 dark:text-slate-400">Proyectos</span>
                  <p className="mt-0.5 font-display text-xl font-semibold tabular-nums text-[#7B1832] dark:text-[#D9B245]">
                    {portal.projects.length}
                  </p>
                </div>
              )}
              {portal.projects.length > 0 && portal.documents.length > 0 && (
                <div className="h-8 w-px bg-stone-200 dark:bg-slate-800" />
              )}
              {portal.documents.length > 0 && (
                <div>
                  <span className="text-stone-500 dark:text-slate-400">Documentos</span>
                  <p className="mt-0.5 font-display text-xl font-semibold tabular-nums text-[#1E3A8A] dark:text-[#60A5FA]">
                    {portal.documents.length}
                  </p>
                </div>
              )}
              <QrCode className="hidden h-5 w-5 text-stone-400 sm:block" aria-hidden="true" />
            </div>
          ) : undefined
        }
      />

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <FadeInSection>
          <Tabs
            ariaLabel="Secciones de gestión institucional"
            activeId={tab}
            onChange={setTab}
            options={[
              { id: 'proyectos', label: 'Proyectos' },
              { id: 'plan_anual', label: 'Plan de Acción Anual' },
              { id: 'rendicion', label: 'Rendición de cuentas' },
              { id: 'linea_tiempo', label: 'Línea de tiempo 2026–2029' },
              { id: 'sesiones', label: 'Sesiones' },
              { id: 'calendario', label: 'Agenda y Calendario' },
              { id: 'documentos', label: 'Centro documental' },
            ]}
          />

          <div className="mt-8">
            {portal.loading ? (
              <SkeletonCardGrid count={2} />
            ) : (
              <>
                {tab === 'proyectos' && (
                  <div className="space-y-6">
                    {portal.projects.length > 0 && (
                      <Card padding="sm">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="relative sm:col-span-2">
                            <Search className="pointer-events-none absolute top-[41px] left-3 h-4 w-4 text-stone-400" aria-hidden="true" />
                            <Input
                              label="Buscar proyecto juvenil"
                              value={projectSearch}
                              onChange={(e) => setProjectSearch(e.target.value)}
                              placeholder="Nombre, resumen u objetivo..."
                              className="pl-9"
                            />
                          </div>
                          <Select label="Ordenar por" value={projectSort} onChange={(e) => setProjectSort(e.target.value as 'avance' | 'titulo')}>
                            <option value="avance">Mayor porcentaje de avance</option>
                            <option value="titulo">Nombre (A–Z)</option>
                          </Select>
                        </div>
                      </Card>
                    )}

                    {filteredProjects.length === 0 ? (
                      <EmptyState
                        icon={FolderKanban}
                        title="Aún no se han publicado proyectos"
                        description="Las iniciativas juveniles aprobadas por el Consejo aparecerán aquí con su objetivo y porcentaje real de avance."
                        actionLabel={onNavigate ? 'Radicar propuesta juvenil' : undefined}
                        onAction={onNavigate ? () => onNavigate('/participacion') : undefined}
                      />
                    ) : (
                      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                        {filteredProjects.map((project) => (
                          <Card key={project.id} variant="interactive">
                            <div className="flex items-center justify-between gap-2">
                              <StatusText label="Publicado" tone="success" />
                              <span className="font-mono-tabular text-xs font-semibold text-stone-700 dark:text-slate-200">
                                {project.progressPercent}% avance
                              </span>
                            </div>
                            <h2 className="mt-2 font-display text-xl font-semibold text-stone-950 dark:text-white">
                              {project.title}
                            </h2>
                            <p className="cmj-prose mt-2 text-sm text-stone-600 dark:text-slate-300">{project.summary}</p>
                            <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-slate-800">
                              <div
                                className="h-full bg-[#7B1832] dark:bg-[#D9B245]"
                                style={{ width: `${Math.min(100, Math.max(0, project.progressPercent))}%` }}
                              />
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <p className="text-xs leading-relaxed text-stone-500 dark:text-slate-400">
                                {project.objective}
                              </p>
                              <WhatsAppShareButton text={`Proyecto CMJ Flandes (${project.progressPercent}%): ${project.title}`} />
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {tab === 'plan_anual' && <ActionPlanPublicPanel />}
                {tab === 'rendicion' && <GovernanceAccountabilityPanel portal={portal} />}
                {tab === 'linea_tiempo' && <TimelinePublicPanel portal={portal} />}

                {tab === 'sesiones' && (
                  <div className="space-y-5">
                    {portal.sessions.length > 0 && (
                      <Card padding="sm">
                        <Input
                          label="Buscar sesión o tema del orden del día"
                          value={sessionSearch}
                          onChange={(e) => setSessionSearch(e.target.value)}
                          placeholder="Lugar, agenda o título..."
                        />
                      </Card>
                    )}
                    {filteredSessions.length === 0 ? (
                      <EmptyState
                        icon={Users}
                        title="Aún no se han registrado sesiones públicas"
                        description="Las convocatorias a sesiones ordinarias y extraordinarias del pleno se mostrarán aquí."
                        actionLabel={onNavigate ? 'Proponer tema en el buzón' : undefined}
                        onAction={onNavigate ? () => onNavigate('/participacion') : undefined}
                      />
                    ) : (
                      <div className="space-y-4">
                        {filteredSessions.map((s) => (
                          <Card key={s.id}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-slate-400">
                                <span className="font-mono-tabular">{s.dateIso}</span>
                                <span aria-hidden="true">·</span>
                                <span className="capitalize">Sesión {s.sessionType}</span>
                                <span aria-hidden="true">·</span>
                                <span>{s.location}</span>
                                <StatusText label={s.status} tone="info" />
                              </div>
                              <WhatsAppShareButton text={`Sesión CMJ Flandes (${s.dateIso}): ${s.title}`} />
                            </div>
                            <h2 className="mt-2 font-display text-xl font-semibold text-stone-950 dark:text-white">
                              {s.title}
                            </h2>
                            <p className="cmj-prose mt-2 whitespace-pre-line text-sm text-stone-600 dark:text-slate-300">
                              {s.agenda}
                            </p>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {tab === 'calendario' && <GovernanceCalendarPanel events={portal.events} />}
                {tab === 'documentos' && (
                  <GovernanceDocsPanel
                    documents={portal.documents}
                    commissions={portal.commissions}
                    onPreview={setPreviewDoc}
                    onNavigate={onNavigate}
                  />
                )}
              </>
            )}
          </div>
        </FadeInSection>
      </section>

      <Modal open={Boolean(previewDoc)} onClose={() => setPreviewDoc(null)} title={previewDoc?.title || 'Visor público'} maxWidth="xl">
        {previewDoc && (
          <div className="space-y-3">
            <p className="text-xs text-stone-500 dark:text-slate-400">
              {previewDoc.fileName} · Versión {previewDoc.currentVersion}
            </p>
            {loadingPreview && <p className="text-xs text-stone-500 dark:text-slate-400">Cargando documento desde Firebase Storage…</p>}
            {previewError && <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-400">{previewError}</p>}
            {previewUrl &&
              (previewDoc.fileMime === 'application/pdf' ? (
                <iframe title={previewDoc.title} src={previewUrl} className="h-[65vh] w-full rounded-lg border border-stone-200 dark:border-slate-700" />
              ) : previewDoc.fileMime.startsWith('image/') ? (
                <img src={previewUrl} alt={previewDoc.title} className="max-h-[65vh] w-full rounded-lg border border-stone-200 object-contain dark:border-slate-700" />
              ) : (
                <video src={previewUrl} controls playsInline preload="metadata" className="max-h-[65vh] w-full rounded-lg border border-stone-200 bg-slate-950 dark:border-slate-700" />
              ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
