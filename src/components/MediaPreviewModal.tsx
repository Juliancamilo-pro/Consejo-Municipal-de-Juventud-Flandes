import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import * as XLSX from 'xlsx';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Maximize2,
  Music,
  Pause,
  PictureInPicture2,
  Play,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

export interface PreviewMediaPayload {
  title: string;
  subtitle?: string;
  url: string;
  thumbnailUrl?: string;
  videoSource?: 'upload' | 'youtube' | 'vimeo';
  mimeType?: string;
  mediaType: 'image' | 'video' | 'audio' | 'pdf' | 'document';
  fileName?: string;
}

export function MediaPreviewModal({
  item,
  items,
  onSelectIndex,
  onClose,
}: {
  item: PreviewMediaPayload | null;
  items?: PreviewMediaPayload[];
  onSelectIndex?: (index: number) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [imageZoom, setImageZoom] = useState(1);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [sheetRows, setSheetRows] = useState<string[][] | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);

  const touchStartX = useRef<number | null>(null);

  const currentIndex = useMemoIndex(item, items);
  const canPrev = Boolean(items && onSelectIndex && currentIndex > 0);
  const canNext = Boolean(items && onSelectIndex && currentIndex >= 0 && currentIndex < items.length - 1);

  useEffect(() => {
    setImageZoom(1);
    setPlaying(false);
    setProgress(0);
    setPlaybackRate(1);
    setTextContent(null);
    setSheetRows(null);

    if (!item || item.mediaType !== 'document') return;

    const lowerName = (item.fileName || item.url || '').toLowerCase();
    const lowerMime = (item.mimeType || '').toLowerCase();
    const isText =
      lowerMime.startsWith('text/') ||
      lowerName.endsWith('.txt') ||
      lowerName.endsWith('.md') ||
      lowerName.endsWith('.json') ||
      lowerName.endsWith('.csv');
    const isSheet =
      lowerName.endsWith('.xlsx') ||
      lowerName.endsWith('.xls') ||
      lowerName.endsWith('.csv') ||
      lowerMime.includes('spreadsheet') ||
      lowerMime.includes('excel');

    if (!isText && !isSheet) return;

    let cancelled = false;
    setLoadingDoc(true);
    fetch(item.url)
      .then(async (res) => {
        if (!res.ok) return;
        if (isSheet) {
          const buf = await res.arrayBuffer();
          const wb = XLSX.read(buf, { type: 'array' });
          const firstSheet = wb.SheetNames[0];
          if (firstSheet && !cancelled) {
            const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[firstSheet], {
              header: 1,
              defval: '',
            });
            setSheetRows(rows.slice(0, 60).map((r) => r.slice(0, 14).map(String)));
          }
        } else if (isText) {
          const txt = await res.text();
          if (!cancelled) setTextContent(txt.slice(0, 25000));
        }
      })
      .catch(() => {
        // Fallback to download card
      })
      .finally(() => {
        if (!cancelled) setLoadingDoc(false);
      });

    return () => {
      cancelled = true;
    };
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && canPrev && onSelectIndex) onSelectIndex(currentIndex - 1);
      else if (e.key === 'ArrowRight' && canNext && onSelectIndex) onSelectIndex(currentIndex + 1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [item, canPrev, canNext, currentIndex, onSelectIndex, onClose]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const changeRate = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) videoRef.current.playbackRate = rate;
  };

  const isEmbedVideo =
    item?.mediaType === 'video' &&
    (item.videoSource === 'youtube' ||
      item.videoSource === 'vimeo' ||
      item.url.includes('youtube.com/embed/') ||
      item.url.includes('player.vimeo.com/video/'));

  const isAudio =
    item?.mediaType === 'audio' ||
    Boolean(item?.mimeType?.startsWith('audio/')) ||
    /\.(mp3|wav|ogg|m4a|flac)$/i.test(item?.fileName || '');

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4"
          onClick={onClose}
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current === null) return;
            const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
            const delta = endX - touchStartX.current;
            touchStartX.current = null;
            if (Math.abs(delta) > 55) {
              if (delta > 0 && canPrev && onSelectIndex) onSelectIndex(currentIndex - 1);
              if (delta < 0 && canNext && onSelectIndex) onSelectIndex(currentIndex + 1);
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                  {item.title}
                </h3>
                {item.subtitle && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                    {item.subtitle}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {item.mediaType === 'image' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setImageZoom((z) => Math.max(1, Number((z - 0.5).toFixed(1))))}
                      aria-label="Alejar imagen"
                      className="rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <ZoomOut className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageZoom((z) => Math.min(3, Number((z + 0.5).toFixed(1))))}
                      aria-label="Acercar imagen"
                      className="rounded-xl border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
                {!isEmbedVideo && (
                  <a
                    href={item.url}
                    download={item.fileName || true}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Descargar
                  </a>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar vista previa"
                  className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="relative p-4 sm:p-6 bg-slate-100 dark:bg-slate-950/70">
              {canPrev && onSelectIndex && (
                <button
                  type="button"
                  onClick={() => onSelectIndex(currentIndex - 1)}
                  aria-label="Elemento anterior"
                  className="absolute left-3 top-1/2 -translate-y-1/2 z-20 rounded-full bg-slate-900/75 text-white p-2.5 hover:bg-slate-900 shadow-lg cursor-pointer"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              {canNext && onSelectIndex && (
                <button
                  type="button"
                  onClick={() => onSelectIndex(currentIndex + 1)}
                  aria-label="Siguiente elemento"
                  className="absolute right-3 top-1/2 -translate-y-1/2 z-20 rounded-full bg-slate-900/75 text-white p-2.5 hover:bg-slate-900 shadow-lg cursor-pointer"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}

              {item.mediaType === 'image' && (
                <div className="flex items-center justify-center max-h-[70vh] overflow-auto rounded-2xl bg-slate-900/5 dark:bg-slate-900">
                  <img
                    src={item.url}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    style={{ transform: `scale(${imageZoom})` }}
                    className="max-h-[68vh] w-auto object-contain rounded-xl transition-transform duration-200"
                  />
                </div>
              )}

              {isAudio && (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 flex flex-col items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                    <Music className="h-7 w-7" />
                  </div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    {item.fileName || item.title}
                  </p>
                  <audio controls src={item.url} className="w-full max-w-md" />
                </div>
              )}

              {item.mediaType === 'video' && !isAudio && isEmbedVideo && (
                <div className="relative aspect-video rounded-2xl overflow-hidden bg-black">
                  <iframe
                    src={item.url}
                    title={item.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full border-0"
                  />
                </div>
              )}

              {item.mediaType === 'video' && !isAudio && !isEmbedVideo && (
                <div className="relative rounded-2xl overflow-hidden bg-black">
                  <video
                    ref={videoRef}
                    src={item.url}
                    poster={item.thumbnailUrl}
                    playsInline
                    onTimeUpdate={() => {
                      const v = videoRef.current;
                      if (v && v.duration) setProgress((v.currentTime / v.duration) * 100);
                    }}
                    onEnded={() => setPlaying(false)}
                    onClick={togglePlay}
                    className="w-full max-h-[65vh] object-contain cursor-pointer"
                  />
                  <div className="flex flex-wrap items-center gap-2.5 px-4 py-3 bg-slate-950/90 text-white">
                    <button
                      type="button"
                      onClick={togglePlay}
                      aria-label={playing ? 'Pausar video' : 'Reproducir video'}
                      className="rounded-lg bg-white/10 p-2 hover:bg-white/20 transition-colors cursor-pointer"
                    >
                      {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={progress}
                      aria-label="Progreso del video"
                      onChange={(e) => {
                        const v = videoRef.current;
                        if (!v || !v.duration) return;
                        const pct = Number(e.target.value);
                        v.currentTime = (pct / 100) * v.duration;
                        setProgress(pct);
                      }}
                      className="flex-1 accent-cyan-400 cursor-pointer"
                    />
                    <div className="flex items-center gap-1">
                      {[0.5, 1, 1.5, 2].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => changeRate(r)}
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-mono-num font-bold cursor-pointer ${
                            playbackRate === r ? 'bg-cyan-500 text-slate-950' : 'bg-white/10 text-white'
                          }`}
                        >
                          {r}x
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={toggleMute}
                      aria-label={muted ? 'Activar sonido' : 'Silenciar'}
                      className="rounded-lg bg-white/10 p-2 hover:bg-white/20 transition-colors cursor-pointer"
                    >
                      {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const v = videoRef.current as (HTMLVideoElement & {
                          requestPictureInPicture?: () => Promise<void>;
                        }) | null;
                        v?.requestPictureInPicture?.().catch(() => {});
                      }}
                      aria-label="Imagen en imagen"
                      className="rounded-lg bg-white/10 p-2 hover:bg-white/20 transition-colors cursor-pointer"
                    >
                      <PictureInPicture2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => videoRef.current?.requestFullscreen?.()}
                      aria-label="Pantalla completa"
                      className="rounded-lg bg-white/10 p-2 hover:bg-white/20 transition-colors cursor-pointer"
                    >
                      <Maximize2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {item.mediaType === 'pdf' && (
                <div className="space-y-3">
                  <iframe
                    src={item.url}
                    title={item.title}
                    className="w-full h-[65vh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white"
                  />
                  <div className="flex justify-end">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-cyan-400 hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir PDF en una pestaña nueva
                    </a>
                  </div>
                </div>
              )}

              {item.mediaType === 'document' && !isAudio && (
                <>
                  {loadingDoc ? (
                    <div className="py-12 text-center text-xs text-slate-500">
                      Cargando vista previa del documento...
                    </div>
                  ) : sheetRows && sheetRows.length > 0 ? (
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-auto max-h-[60vh]">
                      <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        <FileSpreadsheet className="h-4 w-4" /> Vista previa de tabla ({sheetRows.length} filas)
                      </div>
                      <table className="w-full text-left text-xs border-collapse">
                        <tbody>
                          {sheetRows.map((row, ri) => (
                            <tr
                              key={ri}
                              className={
                                ri === 0
                                  ? 'bg-slate-100 dark:bg-slate-800 font-bold'
                                  : 'border-t border-slate-100 dark:border-slate-800'
                              }
                            >
                              {row.map((cell, ci) => (
                                <td key={ci} className="px-3 py-1.5 whitespace-nowrap">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : textContent !== null ? (
                    <pre className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 text-xs font-mono whitespace-pre-wrap max-h-[60vh] overflow-auto text-slate-800 dark:text-slate-200">
                      {textContent}
                    </pre>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-cyan-300">
                        <FileText className="h-7 w-7" />
                      </div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">
                        {item.fileName || item.title}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        Este archivo está listo para descarga directa.
                      </p>
                      <a
                        href={item.url}
                        download={item.fileName || true}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        Descargar documento
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function useMemoIndex(item: PreviewMediaPayload | null, items?: PreviewMediaPayload[]): number {
  if (!item || !items || items.length === 0) return -1;
  return items.findIndex((x) => x.url === item.url && x.title === item.title);
}
