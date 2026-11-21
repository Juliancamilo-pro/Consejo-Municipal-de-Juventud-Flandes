import { PointerEvent, useRef, useState } from 'react';
import { Grid3x3, RotateCcw } from 'lucide-react';
import {
  AspectRatioPreset,
  DEFAULT_PHOTO_EDITS,
  getAspectRatioClass,
  PhotoEditState,
} from '../../utils/mediaCanvas';
import { PhotoStudioControls, StudioTab } from './PhotoStudioControls';

interface PhotoStudioEditorProps {
  src: string;
  edits: PhotoEditState;
  onChange: (next: PhotoEditState) => void;
  lockedAspect?: AspectRatioPreset;
}

export function PhotoStudioEditor({
  src,
  edits,
  onChange,
  lockedAspect,
}: PhotoStudioEditorProps) {
  const [tab, setTab] = useState<StudioTab>('encuadre');
  const [showGrid, setShowGrid] = useState(true);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null,
  );

  const activeAspect = lockedAspect || edits.aspect;
  const ratioClass = getAspectRatioClass(activeAspect) || 'aspect-[16/10]';

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: edits.offsetX,
      origY: edits.offsetY,
    };
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = ((e.clientX - dragRef.current.startX) / 160) * 100;
    const dy = ((e.clientY - dragRef.current.startY) / 160) * 100;
    onChange({
      ...edits,
      offsetX: Math.max(-100, Math.min(100, Math.round(dragRef.current.origX + dx))),
      offsetY: Math.max(-100, Math.min(100, Math.round(dragRef.current.origY + dy))),
    });
  };

  const handlePointerUp = () => {
    dragRef.current = null;
  };

  const totalAngle = edits.baseRotate + edits.angle;
  const transformCss = [
    `translate(${edits.offsetX * 0.45}%, ${edits.offsetY * 0.45}%)`,
    `rotate(${totalAngle}deg)`,
    `scale(${(edits.flipH ? -1 : 1) * edits.zoom}, ${(edits.flipV ? -1 : 1) * edits.zoom})`,
  ].join(' ');

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="space-y-3 lg:col-span-7">
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`relative mx-auto flex max-h-[420px] w-full cursor-grab touch-none items-center justify-center overflow-hidden rounded-xl border border-stone-200 bg-slate-950 active:cursor-grabbing dark:border-slate-700 ${ratioClass}`}
        >
          <img
            src={src}
            alt="Vista previa editable"
            draggable={false}
            style={{
              transform: transformCss,
              filter: `brightness(${edits.brightness}%) contrast(${edits.contrast}%) saturate(${edits.saturate}%)`,
            }}
            className="h-full w-full select-none object-cover transition-[filter] duration-150"
          />

          {showGrid && (
            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
              {Array.from({ length: 9 }).map((_, idx) => (
                <div key={idx} className="border border-white/20" />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500 dark:text-slate-400">
          <span>Arrastra sobre la foto para mover el encuadre</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowGrid((v) => !v)}
              className="inline-flex items-center gap-1 font-medium text-stone-700 hover:text-[#7B1832] dark:text-slate-200 dark:hover:text-[#D9B245]"
            >
              <Grid3x3 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{showGrid ? 'Ocultar guía' : 'Ver guía 3×3'}</span>
            </button>
            <button
              type="button"
              onClick={() => onChange({ ...DEFAULT_PHOTO_EDITS, aspect: activeAspect })}
              className="inline-flex items-center gap-1 font-medium text-[#7B1832] hover:underline dark:text-[#D9B245]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Restablecer</span>
            </button>
          </div>
        </div>
      </div>

      <PhotoStudioControls
        tab={tab}
        onTabChange={setTab}
        edits={edits}
        onChange={onChange}
        lockedAspect={lockedAspect}
      />
    </div>
  );
}
