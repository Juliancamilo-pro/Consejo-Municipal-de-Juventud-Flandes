import { ChangeEvent } from 'react';
import { ImagePlus, RotateCcw, Sliders } from 'lucide-react';
import { DEFAULT_SITE_APPEARANCE, SiteAppearanceConfig } from '../../types/siteContent';
import { Input, Textarea } from '../../components/ui/Input';

export type AppearanceImageField =
  | 'heroImageUrl'
  | 'territorialImageUrl'
  | 'councilImageUrl'
  | 'authImageUrl';

type AppearanceAltField = 'heroAlt' | 'territorialAlt' | 'councilAlt' | 'authAlt';

const PRESET_GALLERY: { label: string; url: string }[] = [
  { label: 'Plaza de Flandes', url: '/src/assets/images/flandes_hero_plaza.webp' },
  { label: 'Río Magdalena', url: '/src/assets/images/flandes_magdalena_river.webp' },
  { label: 'Recinto CMJ', url: '/src/assets/images/flandes_council_hall.webp' },
];

interface SiteAppearancePhotosTabProps {
  form: SiteAppearanceConfig;
  onChange: React.Dispatch<React.SetStateAction<SiteAppearanceConfig>>;
  onFileChosen: (field: AppearanceImageField, e: ChangeEvent<HTMLInputElement>) => void;
  onOpenStudio: (field: AppearanceImageField, existingUrl: string) => void;
}

export function SiteAppearancePhotosTab({
  form,
  onChange,
  onFileChosen,
  onOpenStudio,
}: SiteAppearancePhotosTabProps) {
  const renderPhotoEditor = (
    label: string,
    field: AppearanceImageField,
    altField: AppearanceAltField,
  ) => (
    <div className="space-y-3 rounded-xl border border-stone-200 bg-[#FAF8F4]/60 p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-stone-800 dark:text-slate-100">{label}</span>
        <button
          type="button"
          onClick={() =>
            onChange((prev) => ({
              ...prev,
              [field]: DEFAULT_SITE_APPEARANCE[field],
              [altField]: DEFAULT_SITE_APPEARANCE[altField],
            }))
          }
          className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900 dark:text-slate-400 dark:hover:text-white"
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          <span>Restaurar original</span>
        </button>
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <img
          src={form[field]}
          alt={form[altField] || label}
          width={144}
          height={96}
          className="h-24 w-36 shrink-0 rounded-lg border border-stone-200 object-cover dark:border-slate-700"
        />
        <div className="flex-1 space-y-2.5">
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-800 hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
              <ImagePlus className="h-3.5 w-3.5 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
              <span>Subir foto</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => onFileChosen(field, e)}
              />
            </label>
            <button
              type="button"
              onClick={() => onOpenStudio(field, form[field])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-800 hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Sliders className="h-3.5 w-3.5 text-[#1E3A8A] dark:text-[#60A5FA]" aria-hidden="true" />
              <span>Encuadre / ángulo</span>
            </button>
            {PRESET_GALLERY.map((preset) => (
              <button
                key={preset.url}
                type="button"
                onClick={() => onChange((prev) => ({ ...prev, [field]: preset.url }))}
                className="rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-stone-600 hover:border-[#7B1832] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              label="Ruta o URL de la imagen"
              value={form[field]}
              onChange={(e) => onChange((prev) => ({ ...prev, [field]: e.target.value }))}
            />
            <Input
              label="Texto alternativo accesible (obligatorio)"
              required
              minLength={5}
              maxLength={220}
              value={form[altField] || ''}
              onChange={(e) => onChange((prev) => ({ ...prev, [altField]: e.target.value }))}
              placeholder="Describe qué muestra esta fotografía..."
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="space-y-4 border-b border-stone-200 pb-6 dark:border-slate-800">
        <h3 className="font-display text-base font-semibold text-stone-900 dark:text-slate-100">
          1. Portada principal (Inicio)
        </h3>
        {renderPhotoEditor('Fotografía principal de Inicio', 'heroImageUrl', 'heroAlt')}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Etiqueta superior"
            value={form.heroEyebrow}
            onChange={(e) => onChange((p) => ({ ...p, heroEyebrow: e.target.value }))}
          />
          <Input
            label="Pie de foto principal"
            value={form.heroCaption}
            onChange={(e) => onChange((p) => ({ ...p, heroCaption: e.target.value }))}
          />
        </div>
        <Input
          label="Título principal (Hero)"
          value={form.heroTitle}
          onChange={(e) => onChange((p) => ({ ...p, heroTitle: e.target.value }))}
        />
        <Textarea
          label="Descripción de portada"
          rows={2}
          value={form.heroSubtitle}
          onChange={(e) => onChange((p) => ({ ...p, heroSubtitle: e.target.value }))}
        />
      </div>

      <div className="space-y-4 border-b border-stone-200 pb-6 dark:border-slate-800">
        <h3 className="font-display text-base font-semibold text-stone-900 dark:text-slate-100">
          2. Sección territorial (Inicio)
        </h3>
        {renderPhotoEditor('Fotografía territorial de Flandes', 'territorialImageUrl', 'territorialAlt')}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Etiqueta territorial"
            value={form.territorialEyebrow}
            onChange={(e) => onChange((p) => ({ ...p, territorialEyebrow: e.target.value }))}
          />
          <Input
            label="Pie de foto territorial"
            value={form.territorialCaption}
            onChange={(e) => onChange((p) => ({ ...p, territorialCaption: e.target.value }))}
          />
        </div>
        <Input
          label="Titular territorial"
          value={form.territorialTitle}
          onChange={(e) => onChange((p) => ({ ...p, territorialTitle: e.target.value }))}
        />
        <Textarea
          label="Texto territorial"
          rows={2}
          value={form.territorialDescription}
          onChange={(e) => onChange((p) => ({ ...p, territorialDescription: e.target.value }))}
        />
      </div>

      <div className="space-y-4">
        <h3 className="font-display text-base font-semibold text-stone-900 dark:text-slate-100">
          3. Conoce nuestro Consejo, Ingreso y Contacto
        </h3>
        {renderPhotoEditor('Fotografía de Conoce nuestro Consejo', 'councilImageUrl', 'councilAlt')}
        {renderPhotoEditor('Fotografía del portal de ingreso (Login)', 'authImageUrl', 'authAlt')}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Título Conoce nuestro Consejo"
            value={form.councilTitle}
            onChange={(e) => onChange((p) => ({ ...p, councilTitle: e.target.value }))}
          />
          <Input
            label="Pie de foto del recinto"
            value={form.councilCaption}
            onChange={(e) => onChange((p) => ({ ...p, councilCaption: e.target.value }))}
          />
        </div>
        <Textarea
          label="Subtítulo Conoce nuestro Consejo"
          rows={2}
          value={form.councilSubtitle}
          onChange={(e) => onChange((p) => ({ ...p, councilSubtitle: e.target.value }))}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Título pantalla de ingreso"
            value={form.authTitle}
            onChange={(e) => onChange((p) => ({ ...p, authTitle: e.target.value }))}
          />
          <Input
            label="Introducción página de Contacto"
            value={form.contactIntro}
            onChange={(e) => onChange((p) => ({ ...p, contactIntro: e.target.value }))}
          />
        </div>
        <Textarea
          label="Subtítulo pantalla de ingreso"
          rows={2}
          value={form.authSubtitle}
          onChange={(e) => onChange((p) => ({ ...p, authSubtitle: e.target.value }))}
        />
      </div>
    </div>
  );
}
