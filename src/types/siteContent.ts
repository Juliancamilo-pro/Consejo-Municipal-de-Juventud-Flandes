export type SeasonalOrnamentKind =
  | 'institucional'
  | 'tambora'
  | 'folclor'
  | 'independencia'
  | 'juventud'
  | 'velitas'
  | 'navidad'
  | 'puente_flandes';

export interface SeasonalThemeDefinition {
  id: string;
  name: string;
  subtitle: string;
  ornamentKind: SeasonalOrnamentKind;
  accentHex: string;
  secondaryHex: string;
  darkAccentHex: string;
  bannerBgHex: string;
  bannerText: string;
  heroGradientCss: string;
  defaultStartMmDd: string;
  defaultEndMmDd: string;
  isCustom?: boolean;
}

export interface SeasonalScheduleEntry {
  themeId: string;
  enabled: boolean;
  startMmDd: string;
  endMmDd: string;
}

export interface SiteAppearanceVersion {
  id: string;
  label: string;
  snapshot: SiteAppearanceConfig;
  savedByUid: string;
  savedByName: string;
  createdAtIso: string;
}

export interface SiteAppearanceConfig {
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl: string;
  heroAlt?: string;
  heroCaption: string;
  territorialEyebrow: string;
  territorialTitle: string;
  territorialDescription: string;
  territorialImageUrl: string;
  territorialAlt?: string;
  territorialCaption: string;
  councilTitle: string;
  councilSubtitle: string;
  councilImageUrl: string;
  councilAlt?: string;
  councilCaption: string;
  authTitle: string;
  authSubtitle: string;
  authImageUrl: string;
  authAlt?: string;
  contactIntro: string;
  publishStatus?: 'borrador' | 'publicado';
  themeMode?: 'auto' | 'manual';
  activeThemeId?: string;
  themeCalendar?: SeasonalScheduleEntry[];
  customThemes?: SeasonalThemeDefinition[];
  updatedByName?: string;
  updatedAt?: string;
}

export const DEFAULT_SITE_APPEARANCE: SiteAppearanceConfig = {
  heroEyebrow: 'Flandes, Tolima · Periodo 2026–2029 · Ley 1622 de 2013',
  heroTitle: 'Consejo Municipal de Juventud de Flandes',
  heroSubtitle:
    'Plataforma institucional de representación, concertación y control social para las juventudes flamencas. Consulta la gestión pública, radica propuestas y sigue de cerca las decisiones del territorio.',
  heroImageUrl: '/src/assets/images/flandes_hero_plaza.webp',
  heroAlt: 'Jóvenes y plaza principal de Flandes, Tolima durante encuentro ciudadano del CMJ',
  heroCaption: 'Flandes, Tolima · Cuenca del Alto Magdalena — Participación juvenil 2026–2029',
  territorialEyebrow: 'Identidad Territorial · Tolima',
  territorialTitle: 'Juventud con voz en las decisiones del municipio',
  territorialDescription:
    'Cada acta publicada, proyecto formulado y radicado ciudadano queda trazado con transparencia. El CMJ articula las iniciativas urbanas y rurales de Flandes ante el Concejo Municipal, la Alcaldía y las entidades territoriales.',
  territorialImageUrl: '/src/assets/images/flandes_magdalena_river.webp',
  territorialAlt: 'Vista panorámica del río Magdalena a su paso por el municipio de Flandes, Tolima',
  territorialCaption: 'Fig. 01 — Territorio juvenil de Flandes, puerta fluvial del Tolima',
  councilTitle: 'Conoce nuestro Consejo',
  councilSubtitle:
    'Identidad territorial, marco normativo estatutario, Mesa Directiva, directorio oficial de consejeros y comisiones de trabajo para el periodo 2026–2029 en Flandes, Tolima.',
  councilImageUrl: '/src/assets/images/flandes_council_hall.webp',
  councilAlt: 'Recinto institucional de sesiones y concertación del CMJ de Flandes, Tolima',
  councilCaption: 'Recinto de sesiones y concertación juvenil · Flandes, Tolima',
  authTitle: 'Portal privado de consejeros',
  authSubtitle:
    'Espacio de trabajo interno para la Mesa Directiva, líderes de comisión y consejeros municipales electos.',
  authImageUrl: '/src/assets/images/flandes_council_hall.webp',
  authAlt: 'Sala institucional del Consejo Municipal de Juventud de Flandes',
  contactIntro:
    'Canales oficiales del Consejo Municipal de Juventud de Flandes, Tolima para peticiones, quejas, reclamos, sugerencias y denuncias.',
  publishStatus: 'publicado',
  themeMode: 'auto',
  activeThemeId: 'institucional',
};
