import React, { useMemo, useState } from 'react';
import {
  Calendar,
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  Mail,
  MapPin,
  MessageSquare,
  Newspaper,
  Play,
  Search,
  Send,
  Vote,
  X,
} from 'lucide-react';
import { apiRequest } from '../../lib/apiClient';
import { formatBytes } from '../../lib/mediaProcessor';
import type {
  CallOrSurvey,
  Commission,
  GalleryItem,
  NewsEvent,
  PortalDocument,
  PortalSettings,
} from '../../types/cmj';
import { useToast } from '../ToastProvider';
import { EmptyState, SectionReveal } from '../ui/AnimatedPrimitives';
import { MediaPreviewModal, type PreviewMediaPayload } from '../MediaPreviewModal';

export function PublicMediaAndCivic({
  settings,
  commissions,
  newsEvents,
  galleryItems,
  documents,
  callsSurveys,
  isAuthenticated,
  onEnterPrivatePortal,
}: {
  settings: PortalSettings;
  commissions: Commission[];
  newsEvents: NewsEvent[];
  galleryItems: GalleryItem[];
  documents: PortalDocument[];
  callsSurveys: CallOrSurvey[];
  isAuthenticated: boolean;
  onEnterPrivatePortal: () => void;
}) {
  const { showToast } = useToast();
  const [previewMedia, setPreviewMedia] = useState<PreviewMediaPayload | null>(null);
  const [selectedNews, setSelectedNews] = useState<NewsEvent | null>(null);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'image' | 'video'>('all');
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

  const publicGallery = useMemo(
    () =>
      galleryItems
        .filter((g) => g.status === 'publicado')
        .filter((g) => mediaFilter === 'all' || g.mediaType === mediaFilter),
    [galleryItems, mediaFilter]
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

  const docCategories = useMemo(
    () => Array.from(new Set(documents.filter((d) => d.visibility === 'publico').map((d) => d.category))),
    [documents]
  );

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
      <SectionReveal id="noticias" className="py-14 border-t border-slate-200/70 dark:border-slate-800/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-cyan-400">
              Actualidad Juvenil
            </span>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
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
                    className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col hover:border-blue-400 dark:hover:border-cyan-600 transition-colors cursor-pointer"
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
                        <div className="h-full w-full bg-gradient-to-br from-blue-600/15 to-cyan-500/20 flex items-center justify-center text-blue-600 dark:text-cyan-400">
                          <Newspaper className="h-8 w-8 opacity-60" />
                        </div>
                      )}
                    </div>
                    <div className="p-5 flex-1 flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
                        <span className="uppercase tracking-wider text-blue-600 dark:text-cyan-400">
                          {item.type === 'evento' ? 'Evento' : 'Noticia'}
                        </span>
                        {item.eventDate && (
                          <span className="inline-flex items-center gap-1 text-slate-500 font-mono-num">
                            <Calendar className="h-3 w-3" /> {item.eventDate}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-3 flex-1">
                        {item.summary}
                      </p>
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
                        <span className="truncate">{commName}</span>
                        <span className="font-semibold text-blue-600 dark:text-cyan-400 shrink-0">
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

      {/* Galería Multimedia */}
      <SectionReveal id="galeria" className="py-14 border-t border-slate-200/70 dark:border-slate-800/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-cyan-400">
                Memoria Visual
              </span>
              <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                Galería de Fotos y Videos
              </h2>
            </div>

            <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
              {(['all', 'image', 'video'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMediaFilter(t)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                    mediaFilter === t
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {t === 'all' ? 'Todo' : t === 'image' ? 'Fotos' : 'Videos'}
                </button>
              ))}
            </div>
          </div>

          {publicGallery.length === 0 ? (
            <EmptyState
              title="Galería sin registros publicados"
              description="Sube fotografías optimizadas en WebP, videos MP4 o enlaces de YouTube y Vimeo desde el portal privado."
              actionLabel={isAuthenticated ? 'Subir multimedia' : undefined}
              onAction={isAuthenticated ? onEnterPrivatePortal : undefined}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {publicGallery.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() =>
                    setPreviewMedia({
                      title: g.title,
                      subtitle: g.description,
                      url: g.url,
                      thumbnailUrl: g.thumbnailUrl,
                      videoSource: g.videoSource,
                      mediaType: g.mediaType,
                    })
                  }
                  className="group relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 text-left cursor-pointer"
                >
                  {g.mediaType === 'image' ? (
                    <img
                      src={g.thumbnailUrl || g.url}
                      alt={g.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : g.thumbnailUrl ? (
                    <img
                      src={g.thumbnailUrl}
                      alt={g.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-slate-900 text-cyan-400">
                      <Film className="h-9 w-9" />
                    </div>
                  )}

                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent flex flex-col justify-between p-3.5">
                    <span className="self-end rounded-lg bg-slate-950/70 px-2 py-1 text-[10px] font-semibold text-white inline-flex items-center gap-1">
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
                    <p className="text-xs font-semibold text-white line-clamp-2">{g.title}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </SectionReveal>

      {/* Documentos y Transparencia */}
      <SectionReveal id="documentos" className="py-14 border-t border-slate-200/70 dark:border-slate-800/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-cyan-400">
                Archivo Público
              </span>
              <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                Documentos, Actas y Transparencia
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="relative">
                <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={docSearch}
                  onChange={(e) => setDocSearch(e.target.value)}
                  placeholder="Buscar acta o acuerdo..."
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-3 py-2 text-xs"
                />
              </div>
              <select
                value={docCategory}
                onChange={(e) => setDocCategory(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
              >
                <option value="todas">Todas las categorías</option>
                {docCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {publicDocuments.length === 0 ? (
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
                    <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[11px] font-semibold text-blue-600 dark:text-cyan-400">
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
                      onClick={() =>
                        setPreviewMedia({
                          title: d.title,
                          subtitle: `${d.category} · ${d.version}`,
                          url: d.fileUrl,
                          fileName: d.fileName,
                          mediaType: d.mimeType.includes('pdf') ? 'pdf' : 'document',
                        })
                      }
                      className="text-xs font-semibold text-blue-600 dark:text-cyan-400 hover:underline cursor-pointer"
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
      <SectionReveal id="convocatorias" className="py-14 border-t border-slate-200/70 dark:border-slate-800/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-cyan-400">
              Incidencia Directa
            </span>
            <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
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
                    <span className="font-bold uppercase tracking-wider text-blue-600 dark:text-cyan-400">
                      {cs.kind === 'encuesta' ? 'Encuesta' : 'Convocatoria'}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                        cs.status === 'abierta'
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                      }`}
                    >
                      {cs.status === 'abierta' ? 'Abierta' : 'Cerrada'} · Cierra {cs.deadline}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{cs.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 flex-1">{cs.description}</p>
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
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
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
      <SectionReveal id="contacto" className="py-14 border-t border-slate-200/70 dark:border-slate-800/70">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-5">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-cyan-400">
                Canal Ciudadano
              </span>
              <h2 className="mt-1.5 text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                Buzón de Propuestas y Contacto
              </h2>
              <p className="mt-2.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                ¿Tienes una iniciativa juvenil, solicitud de audiencia o inquietud en tu barrio o colegio? Envía un mensaje directo a la Mesa Directiva del CMJ Flandes.
              </p>
            </div>

            <div className="space-y-3 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              {settings.contactEmail && (
                <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
                  <Mail className="h-4 w-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                  <span>{settings.contactEmail}</span>
                </div>
              )}
              {settings.contactAddress && (
                <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
                  <MapPin className="h-4 w-4 text-blue-600 dark:text-cyan-400 shrink-0" />
                  <span>{settings.contactAddress}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-200">
                <MessageSquare className="h-4 w-4 text-blue-600 dark:text-cyan-400 shrink-0" />
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
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
              >
                <Send className="h-4 w-4" />
                {sendingMsg ? 'Enviando...' : 'Enviar al buzón del CMJ'}
              </button>
            </form>
          </div>
        </div>
      </SectionReveal>

      {/* Modal detalle de noticia */}
      {selectedNews && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4"
          onClick={() => setSelectedNews(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase text-blue-600 dark:text-cyan-400">
                  {selectedNews.type === 'evento' ? 'Evento' : 'Noticia'}
                </span>
                <h3 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
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
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4"
          onClick={() => setActiveSurvey(null)}
        >
          <form
            onSubmit={handleSubmitSurvey}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-xs font-bold uppercase text-blue-600 dark:text-cyan-400">
                  {activeSurvey.kind}
                </span>
                <h3 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                  {activeSurvey.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveSurvey(null)}
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
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
                        ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 font-semibold'
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
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 cursor-pointer"
            >
              {submittingSurvey ? 'Enviando...' : 'Enviar participación'}
            </button>
          </form>
        </div>
      )}

      <MediaPreviewModal item={previewMedia} onClose={() => setPreviewMedia(null)} />
    </>
  );
}
