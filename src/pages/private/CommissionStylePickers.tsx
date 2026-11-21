import { ChangeEvent } from 'react';
import { ImagePlus, Trash2 } from 'lucide-react';
import { CommissionIconName } from '../../types/models';
import { COMMISSION_ACCENT_PRESETS, COMMISSION_ICONS } from '../../utils/commissionUtils';
import { Button } from '../../components/ui/Button';

interface CommissionStylePickersProps {
  accentColor: string;
  onChangeAccent: (color: string) => void;
  iconName: CommissionIconName;
  onChangeIcon: (icon: CommissionIconName) => void;
  coverImageUrl: string;
  uploadingCover: boolean;
  onUploadCover: (e: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onClearCover: () => void;
}

export function CommissionStylePickers({
  accentColor,
  onChangeAccent,
  iconName,
  onChangeIcon,
  coverImageUrl,
  uploadingCover,
  onUploadCover,
  onClearCover,
}: CommissionStylePickersProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-5 rounded-xl border border-stone-200 bg-[#FAF8F4] p-4 sm:grid-cols-2 dark:border-slate-700 dark:bg-slate-800/50">
        <div>
          <p className="text-xs font-semibold tracking-wider text-stone-600 uppercase dark:text-slate-300">
            Color institucional de acento
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {COMMISSION_ACCENT_PRESETS.map((preset) => {
              const selected = accentColor === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => onChangeAccent(preset.value)}
                  aria-label={preset.label}
                  aria-pressed={selected}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                    selected
                      ? 'border-stone-900 bg-white font-semibold text-stone-950 dark:border-[#D9B245] dark:bg-slate-900 dark:text-white'
                      : 'border-stone-200 bg-white/70 text-stone-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300'
                  }`}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-black/15"
                    style={{ backgroundColor: preset.value }}
                  />
                  <span>{preset.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-wider text-stone-600 uppercase dark:text-slate-300">
            Ícono representativo
          </p>
          <div className="mt-2.5 grid grid-cols-4 gap-2">
            {(Object.keys(COMMISSION_ICONS) as CommissionIconName[]).map((key) => {
              const Entry = COMMISSION_ICONS[key];
              const Icon = Entry.icon;
              const selected = iconName === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onChangeIcon(key)}
                  title={Entry.label}
                  aria-label={Entry.label}
                  aria-pressed={selected}
                  className={`flex flex-col items-center justify-center rounded-lg border p-2 text-[11px] transition-colors ${
                    selected
                      ? 'border-[#7B1832] bg-[#7B1832]/10 font-semibold text-[#7B1832] dark:border-[#D9B245] dark:bg-[#D9B245]/15 dark:text-[#D9B245]'
                      : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 p-4 dark:border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-stone-900 dark:text-white">
              Imagen de portada (opcional)
            </p>
            <p className="text-xs text-stone-500 dark:text-slate-400">
              PNG, JPG o WebP almacenado en Firebase Storage.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex min-h-[38px] cursor-pointer items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              <span>{uploadingCover ? 'Subiendo...' : 'Subir portada'}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={uploadingCover}
                onChange={(e) => void onUploadCover(e)}
              />
            </label>
            {coverImageUrl && (
              <Button type="button" size="sm" variant="outline" onClick={onClearCover}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Quitar</span>
              </Button>
            )}
          </div>
        </div>
        {coverImageUrl && (
          <img
            src={coverImageUrl}
            alt="Vista previa portada de comisión"
            className="mt-3 h-32 w-full rounded-lg object-cover"
          />
        )}
      </div>
    </div>
  );
}
