import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  X,
  Download,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  FileText,
  ExternalLink,
} from 'lucide-react';

export interface PreviewMediaPayload {
  title: string;
  subtitle?: string;
  url: string;
  thumbnailUrl?: string;
  videoSource?: 'upload' | 'youtube' | 'vimeo';
  mimeType?: string;
  mediaType: 'image' | 'video' | 'pdf' | 'document';
  fileName?: string;
}

export function MediaPreviewModal({
  item,
  onClose,
}: {
  item: PreviewMediaPayload | null;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [progress, setProgress] = useState(0);

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

  const isEmbedVideo =
    item?.mediaType === 'video' &&
    (item.videoSource === 'youtube' ||
      item.videoSource === 'vimeo' ||
      item.url.includes('youtube.com/embed/') ||
      item.url.includes('player.vimeo.com/video/'));

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
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
              <div className="flex items-center gap-2 shrink-0">
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

            <div className="p-4 sm:p-6 bg-slate-100 dark:bg-slate-950/70">
              {item.mediaType === 'image' && (
                <div className="flex items-center justify-center max-h-[70vh] overflow-hidden rounded-2xl bg-slate-900/5 dark:bg-slate-900">
                  <img
                    src={item.url}
                    alt={item.title}
                    referrerPolicy="no-referrer"
                    className="max-h-[68vh] w-auto object-contain rounded-xl"
                  />
                </div>
              )}

              {item.mediaType === 'video' && isEmbedVideo && (
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

              {item.mediaType === 'video' && !isEmbedVideo && (
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
                  <div className="flex items-center gap-3 px-4 py-3 bg-slate-950/90 text-white">
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

              {item.mediaType === 'document' && (
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
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
