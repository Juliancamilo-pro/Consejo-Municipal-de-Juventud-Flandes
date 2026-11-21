import { useMemo, useState } from 'react';
import { Calendar, Check, Copy, Eye, RotateCcw, Sparkles } from 'lucide-react';
import {
  SeasonalScheduleEntry,
  SeasonalThemeDefinition,
  SiteAppearanceConfig,
} from '../../types/siteContent';
import {
  formatMmDdSpanish,
  getEffectiveCalendar,
  getEffectiveThemes,
  resolveActiveSeasonalTheme,
} from '../../utils/seasonalThemeResolver';
import { SeasonalOrnamentSvg } from '../../components/theme/SeasonalOrnamentSvg';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';

interface SeasonalThemeCustomizerProps {
  form: SiteAppearanceConfig;
  onChange: (updater: (prev: SiteAppearanceConfig) => SiteAppearanceConfig) => void;
}

export function SeasonalThemeCustomizer({ form, onChange }: SeasonalThemeCustomizerProps) {
  const themes = useMemo(() => getEffectiveThemes(form), [form]);
  const calendar = useMemo(() => getEffectiveCalendar(form), [form]);
  const resolved = useMemo(() => resolveActiveSeasonalTheme(form), [form]);
  const [previewId, setPreviewId] = useState<string>(resolved.theme.id);

  const previewTheme = themes.find((t) => t.id === previewId) || resolved.theme;

  const setManualTheme = (themeId: string) => {
    setPreviewId(themeId);
    onChange((prev) => ({ ...prev, themeMode: 'manual', activeThemeId: themeId }));
  };

  const resetToInstitutional = () => {
    setPreviewId('institucional');
    onChange((prev) => ({ ...prev, themeMode: 'manual', activeThemeId: 'institucional' }));
  };

  const updateCalendarEntry = (
    themeId: string,
    patch: Partial<SeasonalScheduleEntry>,
  ) => {
    onChange((prev) => {
      const current = getEffectiveCalendar(prev);
      const exists = current.some((c) => c.themeId === themeId);
      const next = exists
        ? current.map((c) => (c.themeId === themeId ? { ...c, ...patch } : c))
        : [...current, { themeId, enabled: true, startMmDd: '01-01', endMmDd: '01-07', ...patch }];
      return { ...prev, themeCalendar: next };
    });
  };

  const duplicateThemeAsCustom = (source: SeasonalThemeDefinition) => {
    const newId = `custom_${Date.now().toString(36)}`;
    const copy: SeasonalThemeDefinition = {
      ...source,
      id: newId,
      name: `${source.name} (Personalizado)`,
      isCustom: true,
    };
    onChange((prev) => ({
      ...prev,
      customThemes: [...(prev.customThemes || []), copy],
      themeMode: 'manual',
      activeThemeId: newId,
    }));
    setPreviewId(newId);
  };

  const updateCustomTheme = (id: string, patch: Partial<SeasonalThemeDefinition>) => {
    onChange((prev) => ({
      ...prev,
      customThemes: (prev.customThemes || []).map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-[#FAF8F4] p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <div>
          <p className="text-xs font-semibold text-[#7B1832] uppercase dark:text-[#D9B245]">
            Modo de activación de temporada
          </p>
          <p className="mt-0.5 text-sm font-medium text-stone-900 dark:text-white">
            Tema vigente hoy: <span className="font-semibold">{resolved.theme.name}</span>{' '}
            <span className="text-xs text-stone-500">
              ({resolved.source === 'calendar' ? 'automático por fecha' : resolved.source === 'manual' ? 'selección manual' : 'identidad base'})
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={form.themeMode !== 'manual' ? 'primary' : 'outline'}
            onClick={() => onChange((prev) => ({ ...prev, themeMode: 'auto' }))}
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Automático (Calendario)</span>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={resetToInstitutional}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Volver al institucional</span>
          </Button>
        </div>
      </div>

      {/* Mini vista previa en vivo */}
      <div className="overflow-hidden rounded-xl border border-stone-200 dark:border-slate-800">
        <div className="flex items-center justify-between border-b border-stone-200 bg-white px-4 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
          <span className="inline-flex items-center gap-1.5 font-semibold text-stone-700 dark:text-slate-200">
            <Eye className="h-3.5 w-3.5 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
            Vista previa en vivo: {previewTheme.name}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => duplicateThemeAsCustom(previewTheme)}
          >
            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Duplicar para crear propio</span>
          </Button>
        </div>
        {previewTheme.bannerText && (
          <div
            style={{ backgroundColor: previewTheme.bannerBgHex }}
            className="flex items-center justify-between px-4 py-1.5 text-[11px] font-medium text-white"
          >
            <span className="inline-flex items-center gap-1.5 truncate">
              <Sparkles className="h-3 w-3 shrink-0 text-[#FDE68A]" aria-hidden="true" />
              {previewTheme.bannerText}
            </span>
          </div>
        )}
        <div
          style={{ background: previewTheme.heroGradientCss }}
          className="flex items-center justify-between gap-4 px-5 py-5 text-white"
        >
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-wider uppercase" style={{ color: '#FDE68A' }}>
              CMJ Flandes · Flandes, Tolima
            </p>
            <p className="mt-1 font-display text-lg font-semibold">{form.heroTitle}</p>
            <p className="mt-1 line-clamp-1 text-xs text-stone-200">{previewTheme.subtitle}</p>
          </div>
          <SeasonalOrnamentSvg
            kind={previewTheme.ornamentKind}
            accentHex={previewTheme.accentHex}
            secondaryHex={previewTheme.secondaryHex}
            className="h-14 w-28 shrink-0"
          />
        </div>
      </div>

      {/* Editor rápido si el tema seleccionado es personalizado */}
      {previewTheme.isCustom && (
        <div className="space-y-3 rounded-xl border border-[#C59B27]/50 bg-[#FFFDF7] p-4 dark:bg-slate-900/70">
          <p className="text-xs font-semibold text-[#7B1832] dark:text-[#D9B245]">
            Personalizando tema propio
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              label="Nombre del tema"
              value={previewTheme.name}
              onChange={(e) => updateCustomTheme(previewTheme.id, { name: e.target.value })}
            />
            <Input
              label="Texto de franja superior"
              value={previewTheme.bannerText}
              onChange={(e) => updateCustomTheme(previewTheme.id, { bannerText: e.target.value })}
            />
            <Select
              label="Motivo SVG territorial"
              value={previewTheme.ornamentKind}
              onChange={(e) =>
                updateCustomTheme(previewTheme.id, {
                  ornamentKind: e.target.value as SeasonalThemeDefinition['ornamentKind'],
                })
              }
            >
              <option value="puente_flandes">Puente de Flandes y Río Magdalena</option>
              <option value="tambora">San Juan y San Pedro (Tambora)</option>
              <option value="folclor">Festival Folclórico</option>
              <option value="independencia">Independencia Nacional</option>
              <option value="juventud">Semana de la Juventud</option>
              <option value="velitas">Velitas y Faroles</option>
              <option value="navidad">Navidad y Año Nuevo</option>
              <option value="institucional">Geométrico Institucional</option>
            </Select>
          </div>
        </div>
      )}

      {/* Galería y calendario editable */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {themes.map((theme) => {
          const isSelected = resolved.theme.id === theme.id;
          const cal = calendar.find((c) => c.themeId === theme.id);
          return (
            <div
              key={theme.id}
              onClick={() => setPreviewId(theme.id)}
              className={`cursor-pointer rounded-xl border p-3.5 transition-colors ${
                previewId === theme.id
                  ? 'border-[#7B1832] bg-[#FBF6F7] dark:border-[#D9B245] dark:bg-slate-900'
                  : 'border-stone-200 bg-white dark:border-slate-800 dark:bg-slate-900/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-display text-sm font-semibold text-stone-950 dark:text-white">
                      {theme.name}
                    </span>
                    {isSelected && <Badge tone="brand">Activo</Badge>}
                    {theme.isCustom && <Badge tone="info">Propio</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-stone-600 dark:text-slate-400">
                    {theme.subtitle}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={form.themeMode === 'manual' && form.activeThemeId === theme.id ? 'primary' : 'outline'}
                  onClick={(e) => {
                    e.stopPropagation();
                    setManualTheme(theme.id);
                  }}
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Activar</span>
                </Button>
              </div>

              {theme.id !== 'institucional' && cal && (
                <div
                  className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-200 pt-2.5 text-xs dark:border-slate-800"
                  onClick={(e) => e.stopPropagation()}
                >
                  <label className="inline-flex items-center gap-1.5 font-medium text-stone-700 dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={cal.enabled}
                      onChange={(e) => updateCalendarEntry(theme.id, { enabled: e.target.checked })}
                      className="h-3.5 w-3.5 accent-[#7B1832]"
                    />
                    <span>Auto ({formatMmDdSpanish(cal.startMmDd)} – {formatMmDdSpanish(cal.endMmDd)})</span>
                  </label>
                  <div className="ml-auto flex items-center gap-1.5">
                    <input
                      type="text"
                      aria-label={`Inicio MM-DD para ${theme.name}`}
                      maxLength={5}
                      value={cal.startMmDd}
                      onChange={(e) => updateCalendarEntry(theme.id, { startMmDd: e.target.value })}
                      className="w-16 rounded border border-stone-300 bg-white px-2 py-1 font-mono-tabular text-[11px] dark:border-slate-700 dark:bg-slate-900"
                    />
                    <span className="text-stone-400">→</span>
                    <input
                      type="text"
                      aria-label={`Fin MM-DD para ${theme.name}`}
                      maxLength={5}
                      value={cal.endMmDd}
                      onChange={(e) => updateCalendarEntry(theme.id, { endMmDd: e.target.value })}
                      className="w-16 rounded border border-stone-300 bg-white px-2 py-1 font-mono-tabular text-[11px] dark:border-slate-700 dark:bg-slate-900"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
