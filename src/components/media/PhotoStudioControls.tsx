import {
  FlipHorizontal,
  FlipVertical,
  RotateCcw,
  RotateCw,
  Sliders,
  Sun,
} from 'lucide-react';
import {
  ASPECT_OPTIONS,
  AspectRatioPreset,
  FILTER_PRESETS,
  FilterPreset,
  PhotoEditState,
} from '../../utils/mediaCanvas';

export type StudioTab = 'encuadre' | 'angulo' | 'ajustes';

interface PhotoStudioControlsProps {
  tab: StudioTab;
  onTabChange: (tab: StudioTab) => void;
  edits: PhotoEditState;
  onChange: (next: PhotoEditState) => void;
  lockedAspect?: AspectRatioPreset;
}

export function PhotoStudioControls({
  tab,
  onTabChange,
  edits,
  onChange,
  lockedAspect,
}: PhotoStudioControlsProps) {
  const rotate90 = (delta: number) => {
    const next = (((edits.baseRotate + delta) % 360) + 360) % 360;
    onChange({ ...edits, baseRotate: next as 0 | 90 | 180 | 270 });
  };

  const applyPreset = (presetId: FilterPreset) => {
    const p = FILTER_PRESETS[presetId];
    onChange({
      ...edits,
      filterPreset: presetId,
      brightness: p.brightness,
      contrast: p.contrast,
      saturate: p.saturate,
    });
  };

  return (
    <div className="space-y-4 lg:col-span-5">
      <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-stone-200 bg-[#FAF8F4] p-1 dark:border-slate-800 dark:bg-slate-900">
        {[
          { id: 'encuadre' as StudioTab, label: 'Espacio', icon: Sliders },
          { id: 'angulo' as StudioTab, label: 'Ángulo', icon: RotateCw },
          { id: 'ajustes' as StudioTab, label: 'Filtros', icon: Sun },
        ].map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-colors ${
                active
                  ? 'bg-[#7B1832] text-white dark:bg-[#C59B27] dark:text-slate-950'
                  : 'text-stone-700 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {tab === 'encuadre' && (
        <div className="space-y-4">
          {!lockedAspect && (
            <div>
              <p className="text-xs font-semibold text-stone-700 dark:text-slate-200">
                Relación de aspecto / Espacio (estilo redes)
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
                    <span className="block truncate text-[10px] opacity-75">
                      {opt.platformHint}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <RangeSlider
            label="Zoom / Rango"
            valueDisplay={`${edits.zoom.toFixed(2)}×`}
            min={1}
            max={3}
            step={0.05}
            value={edits.zoom}
            onChange={(zoom) => onChange({ ...edits, zoom })}
          />
          <RangeSlider
            label="Espacio horizontal (X)"
            valueDisplay={`${edits.offsetX}%`}
            min={-100}
            max={100}
            step={1}
            value={edits.offsetX}
            onChange={(offsetX) => onChange({ ...edits, offsetX })}
          />
          <RangeSlider
            label="Espacio vertical (Y)"
            valueDisplay={`${edits.offsetY}%`}
            min={-100}
            max={100}
            step={1}
            value={edits.offsetY}
            onChange={(offsetY) => onChange({ ...edits, offsetY })}
          />
        </div>
      )}

      {tab === 'angulo' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => rotate90(-90)}
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-800 hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Girar -90°</span>
            </button>
            <button
              type="button"
              onClick={() => rotate90(90)}
              className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-800 hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <RotateCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Girar +90°</span>
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
            <button
              type="button"
              onClick={() => onChange({ ...edits, flipV: !edits.flipV })}
              className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-medium ${
                edits.flipV
                  ? 'border-[#7B1832] bg-[#7B1832]/10 text-[#7B1832] dark:border-[#C59B27] dark:text-[#D9B245]'
                  : 'border-stone-200 bg-white text-stone-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
              }`}
            >
              <FlipVertical className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Voltear vertical</span>
            </button>
          </div>

          <RangeSlider
            label="Enderezar ángulo fino"
            valueDisplay={`${edits.angle > 0 ? '+' : ''}${edits.angle}°`}
            min={-45}
            max={45}
            step={1}
            value={edits.angle}
            onChange={(angle) => onChange({ ...edits, angle })}
          />
        </div>
      )}

      {tab === 'ajustes' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(FILTER_PRESETS) as FilterPreset[]).map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => applyPreset(id)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                  edits.filterPreset === id
                    ? 'border-[#7B1832] bg-[#7B1832] text-white dark:border-[#C59B27] dark:bg-[#C59B27] dark:text-slate-950'
                    : 'border-stone-200 bg-white text-stone-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                }`}
              >
                {FILTER_PRESETS[id].label}
              </button>
            ))}
          </div>

          <RangeSlider
            label="Brillo"
            valueDisplay={`${edits.brightness}%`}
            min={60}
            max={140}
            step={1}
            value={edits.brightness}
            onChange={(brightness) =>
              onChange({ ...edits, brightness, filterPreset: 'original' })
            }
          />
          <RangeSlider
            label="Contraste"
            valueDisplay={`${edits.contrast}%`}
            min={60}
            max={140}
            step={1}
            value={edits.contrast}
            onChange={(contrast) => onChange({ ...edits, contrast, filterPreset: 'original' })}
          />
          <RangeSlider
            label="Saturación"
            valueDisplay={`${edits.saturate}%`}
            min={0}
            max={180}
            step={1}
            value={edits.saturate}
            onChange={(saturate) => onChange({ ...edits, saturate, filterPreset: 'original' })}
          />
        </div>
      )}
    </div>
  );
}

function RangeSlider({
  label,
  valueDisplay,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  valueDisplay: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (val: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-stone-700 dark:text-slate-200">{label}</span>
        <span className="font-mono-tabular text-stone-500 dark:text-slate-400">
          {valueDisplay}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1.5 h-2 w-full cursor-pointer accent-[#7B1832] dark:accent-[#C59B27]"
      />
    </label>
  );
}
