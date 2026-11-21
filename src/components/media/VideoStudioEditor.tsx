import { useRef } from 'react';
import { FlipHorizontal, Play, RotateCw } from 'lucide-react';
import {
  ASPECT_OPTIONS,
  getAspectRatioClass,
  VideoEditState,
} from '../../utils/mediaCanvas';

interface VideoStudioEditorProps {
  src: string;
  edits: VideoEditState;
  onChange: (next: VideoEditState) => void;
}

function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

export function VideoStudioEditor({ src, edits, onChange }: VideoStudioEditorProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ratioClass = getAspectRatioClass(edits.aspect) || 'aspect-video';

  const handleLoadedMetadata = () => {
    const vid = videoRef.current;
    if (!vid || !Number.isFinite(vid.duration)) return;
    const duration = Math.max(1, Math.round(vid.duration * 10) / 10);
    onChange({
      ...edits,
      duration,
      trimStart: 0,
      trimEnd: duration,
    });
  };

  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (edits.trimEnd > edits.trimStart && vid.currentTime >= edits.trimEnd) {
      vid.currentTime = edits.trimStart;
      vid.pause();
    }
  };

  const previewRange = () => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = edits.trimStart;
    void vid.play();
  };

  const rotate90 = () => {
    const next = ((edits.rotate + 90) % 360) as 0 | 90 | 180 | 270;
    onChange({ ...edits, rotate: next });
  };

  const transformParts: string[] = [];
  if (edits.rotate !== 0) transformParts.push(`rotate(${edits.rotate}deg)`);
  if (edits.flipH) transformParts.push('scaleX(-1)');

  const activeDuration = Math.max(0.5, edits.trimEnd - edits.trimStart);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="space-y-3 lg:col-span-7">
        <div
          className={`relative mx-auto flex max-h-[420px] w-full items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-slate-950 dark:border-slate-700 ${ratioClass}`}
        >
          <video
            ref={videoRef}
            src={src}
            controls
            playsInline
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            style={
              transformParts.length > 0 ? { transform: transformParts.join(' ') } : undefined
            }
            className="h-full w-full object-contain"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500 dark:text-slate-400">
          <span className="font-mono-tabular">
            Rango activo: {formatSeconds(edits.trimStart)} – {formatSeconds(edits.trimEnd)} (
            {activeDuration.toFixed(1)}s)
          </span>
          <button
            type="button"
            onClick={previewRange}
            className="inline-flex items-center gap-1.5 font-medium text-[#7B1832] hover:underline dark:text-[#D9B245]"
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Reproducir rango</span>
          </button>
        </div>
      </div>

      <div className="space-y-5 lg:col-span-5">
        <div>
          <p className="text-xs font-semibold text-stone-700 dark:text-slate-200">
            Espacio / Relación de aspecto (TikTok, Reels, X, Facebook)
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ASPECT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChange({ ...edits, aspect: opt.id })}
                className={`rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
                  edits.aspect === opt.id
                    ? 'border-[#7B1832] bg-[#7B1832]/10 font-semibold text-[#7B1832] dark:border-[#C59B27] dark:bg-[#C59B27]/15 dark:text-[#D9B245]'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                }`}
              >
                <span className="block font-semibold">{opt.label}</span>
                <span className="block truncate text-[10px] opacity-75">{opt.platformHint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-stone-200 bg-[#FAF8F4] p-4 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-xs font-semibold text-stone-800 dark:text-slate-100">
            Rango de reproducción (Inicio → Fin)
          </p>
          <label className="block">
            <div className="flex justify-between text-xs">
              <span className="text-stone-600 dark:text-slate-300">Inicio</span>
              <span className="font-mono-tabular text-stone-500 dark:text-slate-400">
                {edits.trimStart.toFixed(1)} s
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(0.5, edits.trimEnd - 0.5)}
              step={0.5}
              value={edits.trimStart}
              onChange={(e) => {
                const start = Number(e.target.value);
                onChange({ ...edits, trimStart: start });
                if (videoRef.current) videoRef.current.currentTime = start;
              }}
              className="mt-1 h-2 w-full cursor-pointer accent-[#7B1832] dark:accent-[#C59B27]"
            />
          </label>

          <label className="block">
            <div className="flex justify-between text-xs">
              <span className="text-stone-600 dark:text-slate-300">Fin</span>
              <span className="font-mono-tabular text-stone-500 dark:text-slate-400">
                {edits.trimEnd.toFixed(1)} s
              </span>
            </div>
            <input
              type="range"
              min={Math.min(edits.duration, edits.trimStart + 0.5)}
              max={Math.max(1, edits.duration)}
              step={0.5}
              value={edits.trimEnd}
              onChange={(e) => onChange({ ...edits, trimEnd: Number(e.target.value) })}
              className="mt-1 h-2 w-full cursor-pointer accent-[#7B1832] dark:accent-[#C59B27]"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={rotate90}
            className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-800 hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Ángulo: {edits.rotate}°</span>
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...edits, flipH: !edits.flipH })}
            className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium ${
              edits.flipH
                ? 'border-[#7B1832] bg-[#7B1832]/10 text-[#7B1832] dark:border-[#C59B27] dark:text-[#D9B245]'
                : 'border-stone-200 bg-white text-stone-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
            }`}
          >
            <FlipHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Espejo horizontal</span>
          </button>
        </div>
      </div>
    </div>
  );
}
