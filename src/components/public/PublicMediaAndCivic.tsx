import React, { useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  Download,
  FileText,
  Film,
  FolderOpen,
  Image as ImageIcon,
  Mail,
  MapPin,
  MessageSquare,
  Newspaper,
  Play,
  Printer,
  Search,
  Send,
  ShieldCheck,
  Vote,
  X,
} from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import { formatBytes } from '../../lib/mediaProcessor';
import type {
  CallOrSurvey,
  Commission,
  GalleryAlbum,
  GalleryItem,
  NewsEvent,
  PortalActa,
  PortalDocument,
  PortalSettings,
  PublicDepartamentalBundle,
} from '../../types/cmj';
import { BrandLogo } from '../BrandLogo';
import { MediaPreviewModal, type PreviewMediaPayload } from '../MediaPreviewModal';
import { useToast } from '../ToastProvider';
import { EmptyState, SectionReveal } from '../ui/AnimatedPrimitives';

export function PublicMediaAndCivic({
  settings,
  commissions,
  newsEvents,
  galleryItems,
  galleryAlbums = [],
  documents,
  actas = [],
  publicDepartamental = { proposals: [], oversight: [], reports: [] },
  callsSurveys,
  isAuthenticated,
  onEnterPrivatePortal,
}: {
  settings: PortalSettings;
  commissions: Commission[];
  newsEvents: NewsEvent[];
  galleryItems: GalleryItem[];
  galleryAlbums?: GalleryAlbum[];
  documents: PortalDocument[];
  actas?: PortalActa[];
  publicDepartamental?: PublicDepartamentalBundle;
  callsSurveys: CallOrSurvey[];
  isAuthenticated: boolean;
  onEnterPrivatePortal: () => void;
}) {
  const { showToast } = useToast();
  const [previewMedia, setPreviewMedia] = useState<PreviewMediaPayload | null>(null);
  const [lightboxItems, setLightboxItems] = useState<PreviewMediaPayload[] | undefined>(undefined);
  const [selectedNews, setSelectedNews] = useState<NewsEvent | null>(null);
  const [selectedPublicActa, setSelectedPublicActa] = useState<PortalActa | null>(null);

  // Filtros de galería
  const [mediaFilter, setMediaFilter] = useState<'all' | 'image' | 'video'>('all');
  const [albumFilter, setAlbumFilter] = useState<string>('todos');
  const [galCommFilter, setGalCommFilter] = useState<string>('todas');

  // Filtros de documentos y actas
  const [transparencyTab, setTransparencyTab] = useState<'documentos' | 'actas' | 'departamental'>(
    'documentos'
  );
  const [docSearch, setDocSearch] = useState('');
  const [docCategory, setDocCategory] = useState('todas');

  // Respuesta a encuesta/convocatoria
  const [activeSurvey, setActiveSurvey] = useState<CallOrSurvey | null>(null);
  const [selectedOption, setSelectedOption] = useState('');
  const [respondentName, setRespondentName] = useState('');
  const [respondentEmail, setRespondentEmail] = useState('');
  const [surveyComment, setSurveyComment] = useState('');
  const [submittingSurvey, setSubmittingSurvey] = useState(false);

  // Buzón ciudadano
  const [senderName, setSenderName] = useState('');
  const [senderEmail, setSenderEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('Propuesta juvenil');
  const [messageText, setMessageText] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  const publishedNews = useMemo(
    () => newsEvents.filter((n) => n.status === 'publicado'),
    [newsEvents]
  );

  const publishedAlbums = useMemo(
    () => galleryAlbums.filter((a) => a.status === 'publicado'),
    [galleryAlbums]
  );

  const publicGallery = useMemo(
    () =>
      galleryItems
        .filter((g) => g.status === 'publicado')
        .filter((g) => mediaFilter === 'all' || g.mediaType === mediaFilter)
        .filter((g) => albumFilter === 'todos' || (g.albumId || '') === albumFilter)
        .filter((g) => galCommFilter === 'todas' || (g.commissionId || '') === galCommFilter),
    [galleryItems, mediaFilter, albumFilter, galCommFilter]
  );

  const galleryLightboxPayloads = useMemo<PreviewMediaPayload[]>(
    () =>
      publicGallery.map((g) => ({
        title: g.title,
        subtitle: g.description || g.eventDate || undefined,
        url: g.url,
        thumbnailUrl: g.thumbnailUrl,
        videoSource: g.videoSource,
        mimeType: g.mimeType,
        mediaType: g.mediaType,
      })),
    [publicGallery]
  );

  const publicDocuments = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    return documents
      .filter((d) => d.visibility === 'publico')
      .filter((d) => docCategory === 'todas' || d.category === docCategory)
      .filter(
        (d) =>
          !q ||
          d.title.toLowerCase().includes(q) ||
          d.category.toLowerCase().includes(q) ||
          d.fileName.toLowerCase().includes(q)
      );
  }, [documents, docSearch, docCategory]);

  const publicActas = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    return actas
      .filter((a) => ['aprobada', 'firmada', 'archivada'].includes(a.status))
      .filter(
        (a) =>
          !q ||
          a.consecutive.toLowerCase().includes(q) ||
          a.title.toLowerCase().includes(q) ||
          a.propositions.toLowerCase().includes(q)
      );
  }, [actas, docSearch]);

  const docCategories = useMemo(
    () =>
      Array.from(new Set(documents.filter((d) => d.visibility === 'publico').map((d) => d.category))),
    [documents]
  );

  const filteredDeptProposals = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    return (publicDepartamental.proposals || []).filter(
      (p) =>
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.targetEntity.toLowerCase().includes(q) ||
        p.thematicAxis.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q)
    );
  }, [publicDepartamental.proposals, docSearch]);

  const filteredDeptOversight = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    return (publicDepartamental.oversight || []).filter(
      (o) =>
        !q ||
        o.title.toLowerCase().includes(q) ||
        o.watchedEntity.toLowerCase().includes(q) ||
        o.policyOrPlan.toLowerCase().includes(q) ||
        o.findings.toLowerCase().includes(q)
    );
  }, [publicDepartamental.oversight, docSearch]);

  const filteredDeptReports = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    return (publicDepartamental.reports || []).filter(
      (r) =>
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.reportPeriod.toLowerCase().includes(q) ||
        r.departamentalSpace.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q)
    );
  }, [publicDepartamental.reports, docSearch]);

  const publicDeptTotal =
    filteredDeptProposals.length + filteredDeptOversight.length + filteredDeptReports.length;

  const handleSubmitSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSurvey) return;
    if (!respondentName.trim() || (!selectedOption && (activeSurvey.options?.length ?? 0) > 0)) {
      showToast('Completa tu nombre y selecciona una opción', 'error');
      return;
    }

    setSubmittingSurvey(true);
    try {
      await apiRequest('/api/public/survey-response', {
        method: 'POST',
        body: {
          surveyId: activeSurvey.id,
          selectedOption: selectedOption || 'Inscripción / Participación',
          respondentName: respondentName.trim(),
          respondentEmail: respondentEmail.trim(),
          comment: surveyComment.trim(),
        },
      });
      showToast('Participación registrada', 'success', 'Gracias por aportar al CMJ Flandes.');
      setActiveSurvey(null);
      setSelectedOption('');
      setRespondentName('');
      setRespondentEmail('');
      setSurveyComment('');
    } catch {
      showToast('No se pudo enviar tu participación', 'error');
    } finally {
      setSubmittingSurvey(false);
    }
  };

  const handleSendContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!senderName.trim() || !senderEmail.trim() || !subject.trim() || !messageText.trim()) {
      showToast('Completa todos los campos requeridos', 'error');
      return;
    }
    setSendingMsg(true);
    try {
      await apiRequest('/api/public/contact-message', {
        method: 'POST',
        body: {
          senderName: senderName.trim(),
          senderEmail: senderEmail.trim(),
          subject: subject.trim(),
          category,
          message: messageText.trim(),
        },
      });
      showToast('Mensaje enviado al CMJ Flandes', 'success', 'La Mesa Directiva lo revisará pronto.');
      setSenderName('');
      setSenderEmail('');
      setSubject('');
      setMessageText('');
    } catch {
      showToast('Error al enviar el mensaje', 'error');
    } finally {
      setSendingMsg(false);
    }
  };

  return (
    <>
      {/* Noticias y Eventos */}
      <SectionReveal
        id="noticias"
        className="py-16 border-t border-slate-200/80 dark:border-slate-800/80"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Actualidad Juvenil
            </span>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white text-balance">
              Noticias y Agenda de Eventos
            </h2>
          </div>

          {publishedNews.length === 0 ? (
            <EmptyState
              title="Aún no hay noticias ni eventos publicados"
              description="Las noticias, jornadas territoriales y convocatorias aprobadas por la Mesa Directiva aparecerán en este espacio."
              actionLabel={isAuthenticated ? 'Publicar noticia o evento' : undefined}
              onAction={isAuthenticated ? onEnterPrivatePortal : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {publishedNews.map((item) => {
                const commName =
                  commissions.find((c) => c.id === item.commissionId)?.name || 'CMJ Flandes';
                return (
                  <article
                    key={item.id}
                    onClick={() => setSelectedNews(item)}
                    className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col hover:border-emerald-400 dark:hover:border-emerald-700 transition-colors cursor-pointer"
                  >
                    <div className="aspect-video bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      {item.coverUrl ? (
                        <img
                          src={item.coverUrl}
                          alt={item.title}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-gradient-to-br from-emerald-600/15 to-blue-600/15 flex items-center justify-center text-emerald-700 dark:text-emerald-400">
                          <Newspaper className="h-8 w-8 opacity-60" />
                        </div>
                      )}
                    </div>
                    <div className="p-5 flex-1 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                        <span className="uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                          {item.type === 'evento' ? 'Evento' : 'Noticia'}
                        </span>
                        {item.eventDate && (
                          <span className="inline-flex items-center gap-1 text-slate-500 font-mono-num">
                            <Calendar className="h-3 w-3" /> {item.eventDate}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2 text-balance">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 flex-1">
                        {item.summary}
                      </p>
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="truncate">{commName}</span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                          Leer más →
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </SectionReveal>

      {/* Galería Multimedia Masonry + Álbumes */}
      <SectionReveal
        id="galeria"
        className="py-16 border-t border-slate-200/80 dark:border-slate-800/80"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Memoria Visual
              </span>
              <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white text-balance">
                Galería de Fotos y Videos
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {publishedAlbums.length > 0 && (
                <select
                  value={albumFilter}
                  onChange={(e) => setAlbumFilter(e.target.value)}
                  aria-label="Filtrar por álbum"
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                >
                  <option value="todos">Todos los álbumes</option>
                  {publishedAlbums.map((al) => (
                    <option key={al.id} value={al.id}>
                      Álbum: {al.title}
                    </option>
                  ))}
                </select>
              )}
              <select
                value={galCommFilter}
                onChange={(e) => setGalCommFilter(e.target.value)}
                aria-label="Filtrar por comisión"
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
              >
                <option value="todas">Todas las comisiones</option>
                {commissions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
                {(['all', 'image', 'video'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMediaFilter(t)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                      mediaFilter === t
                        ? 'bg-emerald-700 text-white'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {t === 'all' ? 'Todo' : t === 'image' ? 'Fotos' : 'Videos'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {publishedAlbums.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAlbumFilter('todos')}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold border cursor-pointer ${
                  albumFilter === 'todos'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                }`}
              >
                <FolderOpen className="h-3.5 w-3.5" /> Todo ({galleryItems.filter((g) => g.status === 'publicado').length})
              </button>
              {publishedAlbums.map((al) => {
                const count = galleryItems.filter(
                  (g) => g.status === 'publicado' && g.albumId === al.id
                ).length;
                return (
                  <button
                    key={al.id}
                    type="button"
                    onClick={() => setAlbumFilter(al.id)}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold border cursor-pointer ${
                      albumFilter === al.id
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <FolderOpen className="h-3.5 w-3.5" /> {al.title} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {publicGallery.length === 0 ? (
            <EmptyState
              title="Galería sin registros publicados"
              description="Sube fotografías optimizadas en WebP, videos MP4 o enlaces de YouTube y Vimeo desde el portal privado."
              actionLabel={isAuthenticated ? 'Subir multimedia' : undefined}
              onAction={isAuthenticated ? onEnterPrivatePortal : undefined}
            />
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">
              {publicGallery.map((g, idx) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setLightboxItems(galleryLightboxPayloads);
                    setPreviewMedia(galleryLightboxPayloads[idx]);
                  }}
                  className="group relative break-inside-avoid w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 text-left cursor-pointer block"
                >
                  {g.mediaType === 'image' ? (
                    <img
                      src={g.thumbnailUrl || g.url}
                      alt={g.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-auto object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  ) : g.thumbnailUrl ? (
                    <img
                      src={g.thumbnailUrl}
                      alt={g.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full aspect-video object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  ) : (
                    <div className="aspect-video w-full flex items-center justify-center bg-slate-900 text-emerald-400">
                      <Film className="h-9 w-9" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/15 to-transparent flex flex-col justify-between p-3.5">
                    <span className="self-end text-[10px] font-semibold text-white/95 inline-flex items-center gap-1 drop-shadow">
                      {g.mediaType === 'video' ? (
                        <>
                          <Play className="h-3 w-3" /> Video
                        </>
                      ) : (
                        <>
                          <ImageIcon className="h-3 w-3" /> Foto
                        </>
                      )}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-white line-clamp-2">{g.title}</p>
                      {g.eventDate && (
                        <p className="text-[10px] text-white/75 font-mono-num mt-0.5">{g.eventDate}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </SectionReveal>

      {/* Documentos, Actas y Transparencia */}
      <SectionReveal
        id="documentos"
        className="py-16 border-t border-slate-200/80 dark:border-slate-800/80"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Archivo Público
              </span>
              <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white text-balance">
                Documentos, Actas y Transparencia
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
                <button
                  type="button"
                  onClick={() => setTransparencyTab('documentos')}
                  className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                    transparencyTab === 'documentos'
                      ? 'bg-emerald-700 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Documentos ({publicDocuments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTransparencyTab('actas')}
                  className={`min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                    transparencyTab === 'actas'
                      ? 'bg-emerald-700 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  Actas Oficiales ({publicActas.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTransparencyTab('departamental')}
                  className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                    transparencyTab === 'departamental'
                      ? 'bg-purple-700 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Gestión Departamental ({publicDeptTotal})
                </button>
              </div>
              <div className="relative w-full sm:w-auto">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  placeholder="Buscar acta, informe o documento..."
                  className="w-full sm:w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-xs"
                />
              </div>
              {transparencyTab === 'documentos' && (
                <select
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value)}
                  aria-label="Categoría de documento"
                  className="w-full sm:w-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                >
                  <option value="todas">Todas las categorías</option>
                  {docCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {transparencyTab === 'departamental' ? (
            publicDeptTotal === 0 ? (
              <EmptyState
                title="No hay publicaciones departamentales visibles aún"
                description="Las propuestas ante autoridades, acciones de veeduría juvenil e informes de interlocución aprobados por la Presidencia del CMJ aparecerán aquí."
              />
            ) : (
              <div className="space-y-6">
                {filteredDeptProposals.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                      Propuestas de Planes y Programas Juveniles ({filteredDeptProposals.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredDeptProposals.map((p) => (
                        <div
                          key={p.id}
                          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col gap-2.5"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="font-bold uppercase text-purple-700 dark:text-purple-400 truncate">
                              {p.thematicAxis}
                            </span>
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                              Aprobado Presidencia
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                            {p.title}
                          </h4>
                          <p className="text-[11px] font-medium text-slate-500">
                            Entidad: {p.targetEntity} · Por {p.authorName}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-4 flex-1">
                            {p.summary}
                          </p>
                          {p.attachmentUrl && (
                            <a
                              href={p.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-400 hover:underline pt-2 border-t border-slate-100 dark:border-slate-800"
                            >
                              <Download className="h-3.5 w-3.5" />
                              {p.attachmentName || 'Descargar documento'}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {filteredDeptOversight.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                      Veeduría y Control Social ({filteredDeptOversight.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredDeptOversight.map((o) => (
                        <div
                          key={o.id}
                          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col gap-2.5"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="font-bold uppercase text-purple-700 dark:text-purple-400 truncate">
                              {o.watchedEntity}
                            </span>
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                              Aprobado Presidencia
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                            {o.title}
                          </h4>
                          <p className="text-[11px] font-medium text-slate-500">
                            Política / Plan: {o.policyOrPlan}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-4 flex-1">
                            {o.findings}
                          </p>
                          {o.evidenceUrl && (
                            <a
                              href={o.evidenceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-400 hover:underline pt-2 border-t border-slate-100 dark:border-slate-800"
                            >
                              <Download className="h-3.5 w-3.5" />
                              {o.evidenceName || 'Ver evidencia'}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {filteredDeptReports.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-400">
                      Informes de Interlocución Departamental ({filteredDeptReports.length})
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredDeptReports.map((r) => (
                        <div
                          key={r.id}
                          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col gap-2.5"
                        >
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <span className="font-mono-num font-bold text-purple-700 dark:text-purple-400">
                              {r.reportPeriod}
                            </span>
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                              {r.sessionDate}
                            </span>
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                            {r.title}
                          </h4>
                          <p className="text-[11px] font-medium text-slate-500 truncate">
                            {r.departamentalSpace} · {r.authorName}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-4 flex-1">
                            {r.summary}
                          </p>
                          {r.attachmentUrl && (
                            <a
                              href={r.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-auto inline-flex items-center gap-1.5 text-xs font-semibold text-purple-700 dark:text-purple-400 hover:underline pt-2 border-t border-slate-100 dark:border-slate-800"
                            >
                              <Download className="h-3.5 w-3.5" />
                              {r.attachmentName || 'Descargar informe'}
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          ) : transparencyTab === 'actas' ? (
            publicActas.length === 0 ? (
              <EmptyState
                title="No hay actas oficiales publicadas aún"
                description="Las actas aprobadas y firmadas por la Mesa Directiva del CMJ Flandes se publican aquí con su código de verificación."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {publicActas.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col gap-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-num text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                        {a.consecutive}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        <ShieldCheck className="h-3 w-3" /> {a.status}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                      {a.title}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {a.meetingDate} · {a.location} · {a.signatures.length} firma(s)
                    </p>
                    {a.verificationHash && (
                      <p className="font-mono-num text-[10px] text-slate-400 truncate">
                        Sello: {a.verificationHash}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedPublicActa(a)}
                      className="mt-auto rounded-xl bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-emerald-700 hover:text-white transition-colors cursor-pointer"
                    >
                      Consultar acta y firmas →
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : publicDocuments.length === 0 ? (
            <EmptyState
              title="Aún no hay documentos públicos disponibles"
              description="Actas, reglamentos, informes de gestión y oficios publicados por Presidencia y Secretaría aparecerán en este archivo."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {publicDocuments.map((d) => (
                <div
                  key={d.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        {d.category} · {d.version}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 mt-0.5">
                        {d.title}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-1 truncate">
                        {d.fileName} {d.fileSize ? `· ${formatBytes(d.fileSize)}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="mt-auto pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setLightboxItems(undefined);
                        setPreviewMedia({
                          title: d.title,
                          subtitle: `${d.category} · ${d.version}`,
                          url: d.fileUrl,
                          fileName: d.fileName,
                          mimeType: d.mimeType,
                          mediaType: d.mimeType.includes('pdf') ? 'pdf' : 'document',
                        });
                      }}
                      className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      Vista previa
                    </button>
                    <a
                      href={d.fileUrl}
                      download={d.fileName || true}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Descargar
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionReveal>

      {/* Convocatorias y Encuestas */}
      <SectionReveal
        id="convocatorias"
        className="py-16 border-t border-slate-200/80 dark:border-slate-800/80"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Incidencia Directa
            </span>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white text-balance">
              Convocatorias y Encuestas Juveniles
            </h2>
          </div>

          {callsSurveys.length === 0 ? (
            <EmptyState
              title="No hay convocatorias ni encuestas activas en este momento"
              description="Cuando el CMJ Flandes lance consultas ciudadanas o inscripciones de voluntariado juvenil, podrás participar directamente desde aquí."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {callsSurveys.map((cs) => (
                <div
                  key={cs.id}
                  className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      {cs.kind === 'encuesta' ? 'Encuesta' : 'Convocatoria'}
                    </span>
                    <span
                      className={`font-mono-num text-[11px] font-semibold ${
                        cs.status === 'abierta'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {cs.status === 'abierta' ? 'Abierta' : 'Cerrada'} · Cierra {cs.deadline}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white text-balance">
                    {cs.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 flex-1">
                    {cs.description}
                  </p>
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-mono-num">
                      {cs.responseCount} participaciones
                    </span>
                    {cs.status === 'abierta' && (
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSurvey(cs);
                          setSelectedOption(cs.options?.[0] || '');
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
                      >
                        <Vote className="h-3.5 w-3.5" />
                        Participar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionReveal>

      {/* Contacto y Buzón */}
      <SectionReveal
        id="contacto"
        className="py-16 border-t border-slate-200/80 dark:border-slate-800/80"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-5">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Canal Ciudadano
              </span>
              <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white text-balance">
                Buzón de Propuestas y Contacto
              </h2>
              <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                ¿Tienes una iniciativa juvenil, solicitud de audiencia o inquietud en tu barrio o colegio? Envía un mensaje directo a la Mesa Directiva del CMJ Flandes.
              </p>
            </div>

            <div className="space-y-3 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              {settings.contactEmail && (
                <a
                  href={`mailto:${settings.contactEmail}`}
                  className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-400"
                >
                  <Mail className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <span>{settings.contactEmail}</span>
                </a>
              )}
              {settings.contactAddress && (
                <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
                  <MapPin className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <span>{settings.contactAddress}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
                <MessageSquare className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <span>Respuesta institucional revisada en Mesa Directiva</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <form
              onSubmit={handleSendContact}
              className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    required
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    placeholder="Tu nombre"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    required
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Categoría
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                  >
                    <option>Propuesta juvenil</option>
                    <option>Solicitud de espacio o audiencia</option>
                    <option>Veeduría o denuncia</option>
                    <option>Consulta general</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Asunto
                  </label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Resumen breve del mensaje"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Mensaje
                </label>
                <textarea
                  rows={4}
                  required
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Cuéntanos tu idea, barrio o institución educativa..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={sendingMsg}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 cursor-pointer"
              >
                <Send className="h-4 w-4" />
                {sendingMsg ? 'Enviando...' : 'Enviar al buzón del CMJ'}
              </button>
            </form>
          </div>
        </div>
      </SectionReveal>

      {/* Modal Acta Pública */}
      {selectedPublicActa && (
        <div
          className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-slate-950/75 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setSelectedPublicActa(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-3xl h-[100dvh] sm:h-auto sm:max-h-[90dvh] overflow-y-auto rounded-none sm:rounded-3xl border-0 sm:border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8 pb-safe-bottom shadow-2xl space-y-5"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3 min-w-0">
                <BrandLogo size="sm" />
                <div className="min-w-0">
                  <span className="font-mono-num text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    {selectedPublicActa.consecutive} · {selectedPublicActa.status.toUpperCase()}
                  </span>
                  <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {selectedPublicActa.title}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedPublicActa.meetingDate} · {selectedPublicActa.location} · Quórum{' '}
                    {selectedPublicActa.quorumCount}/{selectedPublicActa.quorumRequired}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="no-print min-h-[40px] inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-semibold cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" /> Imprimir
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPublicActa(null)}
                  aria-label="Cerrar acta"
                  className="no-print min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs leading-relaxed">
              <div>
                <h4 className="font-bold uppercase text-emerald-700 dark:text-emerald-400 mb-1">
                  Orden del Día
                </h4>
                <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                  {selectedPublicActa.agenda || 'Sin registrar.'}
                </p>
              </div>
              <div>
                <h4 className="font-bold uppercase text-emerald-700 dark:text-emerald-400 mb-1">
                  Desarrollo
                </h4>
                <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                  {selectedPublicActa.development || 'Sin registrar.'}
                </p>
              </div>
              <div>
                <h4 className="font-bold uppercase text-emerald-700 dark:text-emerald-400 mb-1">
                  Proposiciones y Acuerdos
                </h4>
                <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                  {selectedPublicActa.propositions || 'Sin registrar.'}
                </p>
              </div>
              <div>
                <h4 className="font-bold uppercase text-emerald-700 dark:text-emerald-400 mb-1">
                  Compromisos
                </h4>
                <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-200">
                  {selectedPublicActa.commitmentsSummary || 'Sin registrar.'}
                </p>
              </div>
            </div>

            {selectedPublicActa.signatures.length > 0 && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <p className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4" /> Firmas y Verificación
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedPublicActa.signatures.map((sig) => (
                    <div
                      key={sig.uid}
                      className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 px-3 py-2 text-xs"
                    >
                      <p className="font-bold">{sig.name}</p>
                      <p className="text-emerald-700 dark:text-emerald-400">{sig.roleLabel}</p>
                      <p className="font-mono-num text-[10px] text-slate-500">Sello: {sig.hash}</p>
                    </div>
                  ))}
                </div>
                {selectedPublicActa.verificationHash && (
                  <p className="font-mono-num text-[10px] text-slate-500">
                    Código de integridad: {selectedPublicActa.verificationHash}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal detalle de noticia */}
      {selectedNews && (
        <div
          className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-slate-950/75 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setSelectedNews(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-2xl h-[100dvh] sm:h-auto sm:max-h-[90dvh] overflow-y-auto rounded-none sm:rounded-3xl border-0 sm:border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8 pb-safe-bottom shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">
                  {selectedNews.type === 'evento' ? 'Evento' : 'Noticia'}
                </span>
                <h3 className="mt-1 text-xl font-bold text-slate-900 dark:text-white text-balance">
                  {selectedNews.title}
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Por {selectedNews.authorName} {selectedNews.eventDate ? `· ${selectedNews.eventDate}` : ''}{' '}
                  {selectedNews.location ? `· ${selectedNews.location}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedNews(null)}
                aria-label="Cerrar noticia"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {selectedNews.coverUrl && (
              <img
                src={selectedNews.coverUrl}
                alt={selectedNews.title}
                referrerPolicy="no-referrer"
                className="w-full aspect-video object-cover rounded-2xl"
              />
            )}
            <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
              {selectedNews.content}
            </p>
          </div>
        </div>
      )}

      {/* Modal participar encuesta */}
      {activeSurvey && (
        <div
          className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-slate-950/75 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setActiveSurvey(null)}
        >
          <form
            onSubmit={handleSubmitSurvey}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md h-[100dvh] sm:h-auto sm:max-h-[90dvh] overflow-y-auto rounded-none sm:rounded-3xl border-0 sm:border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 pb-safe-bottom shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400">
                  {activeSurvey.kind}
                </span>
                <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                  {activeSurvey.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveSurvey(null)}
                aria-label="Cerrar encuesta"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {activeSurvey.options && activeSurvey.options.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Elige una opción:
                </p>
                {activeSurvey.options.map((opt) => (
                  <label
                    key={opt}
                    className={`flex items-center gap-2.5 rounded-xl border p-3 text-xs cursor-pointer ${
                      selectedOption === opt
                        ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40 font-semibold'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="surveyOpt"
                      checked={selectedOption === opt}
                      onChange={() => setSelectedOption(opt)}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            )}

            <input
              type="text"
              required
              value={respondentName}
              onChange={(e) => setRespondentName(e.target.value)}
              placeholder="Tu nombre completo"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
            />
            <input
              type="email"
              value={respondentEmail}
              onChange={(e) => setRespondentEmail(e.target.value)}
              placeholder="Correo electrónico (opcional)"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
            />
            <textarea
              rows={2}
              value={surveyComment}
              onChange={(e) => setSurveyComment(e.target.value)}
              placeholder="Comentario o barrio (opcional)"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-sm"
            />

            <button
              type="submit"
              disabled={submittingSurvey}
              className="w-full rounded-xl bg-emerald-700 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 cursor-pointer"
            >
              {submittingSurvey ? 'Enviando...' : 'Enviar participación'}
            </button>
          </form>
        </div>
      )}

      <MediaPreviewModal
        item={previewMedia}
        items={lightboxItems}
        onSelectIndex={(idx) => {
          if (lightboxItems?.[idx]) setPreviewMedia(lightboxItems[idx]);
        }}
        onClose={() => {
          setPreviewMedia(null);
          setLightboxItems(undefined);
        }}
      />
    </>
  );
}
