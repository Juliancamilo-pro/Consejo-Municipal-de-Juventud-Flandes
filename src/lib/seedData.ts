import type { Commission, FestiveThemeId, PortalSettings } from '../types/cmj';

export interface FestiveThemeConfig {
  id: FestiveThemeId;
  name: string;
  subtitle: string;
  ribbonText: string;
  accentGradient: string;
  bannerBg: string;
}

export const FESTIVE_THEMES: FestiveThemeConfig[] = [
  {
    id: 'default',
    name: 'Identidad Institucional CMJ',
    subtitle: 'Paleta oficial juvenil de Flandes, Tolima',
    ribbonText: '',
    accentGradient: 'from-blue-600 via-cyan-500 to-amber-400',
    bannerBg: 'bg-blue-600 text-white',
  },
  {
    id: 'san_pedro',
    name: 'Fiestas del San Pedro y San Juan',
    subtitle: 'Tradición folclórica del Tolima y Flandes',
    ribbonText: 'Celebramos el Festival del San Pedro y nuestras raíces tolimenses',
    accentGradient: 'from-red-600 via-amber-500 to-yellow-400',
    bannerBg: 'bg-gradient-to-r from-red-700 via-amber-600 to-yellow-600 text-white',
  },
  {
    id: 'independencia',
    name: 'Fiestas Patrias de Colombia',
    subtitle: '20 de Julio y 7 de Agosto — Orgullo nacional',
    ribbonText: 'Mes de la Independencia de Colombia · Participación y democracia juvenil',
    accentGradient: 'from-amber-400 via-blue-700 to-red-600',
    bannerBg: 'bg-gradient-to-r from-amber-500 via-blue-700 to-red-600 text-white',
  },
  {
    id: 'semana_juventud',
    name: 'Semana de la Juventud Flandes',
    subtitle: 'Encuentro cultural, deportivo y de innovación juvenil',
    ribbonText: 'Semana de la Juventud en Flandes · Liderazgo, arte y transformación social',
    accentGradient: 'from-cyan-500 via-indigo-600 to-pink-500',
    bannerBg: 'bg-gradient-to-r from-cyan-600 via-indigo-600 to-pink-600 text-white',
  },
  {
    id: 'amor_amistad',
    name: 'Amor y Amistad',
    subtitle: 'Convivencia, empatía y comunidad juvenil',
    ribbonText: 'Mes del Amor y la Amistad · Construyendo lazos de respeto entre jóvenes',
    accentGradient: 'from-rose-500 via-pink-500 to-amber-400',
    bannerBg: 'bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 text-white',
  },
  {
    id: 'navidad',
    name: 'Navidad y Fin de Año',
    subtitle: 'Solidaridad y luz junto al río Magdalena',
    ribbonText: 'Navidad Juvenil en Flandes · Solidaridad en nuestros barrios y veredas',
    accentGradient: 'from-emerald-600 via-teal-500 to-amber-400',
    bannerBg: 'bg-gradient-to-r from-emerald-700 via-teal-700 to-amber-600 text-white',
  },
];

export const EMPTY_PORTAL_SETTINGS: PortalSettings = {
  id: 'site_content',
  heroTitle: 'CMJ Flandes · Consejo Municipal de Juventudes',
  heroSubtitle:
    'Plataforma oficial de participación, concertación, vigilancia y agenda juvenil de Flandes, Tolima.',
  heroImageUrl: '',
  aboutText:
    'Espacio institucional del Consejo Municipal de Juventudes (CMJ) de Flandes, Tolima, en el marco de la Ley Estatutaria 1622 de 2013 y la Ley 1885 de 2018. Edita este contenido desde el Editor del Portal Público.',
  missionText: 'Por definir por la Mesa Directiva del CMJ Flandes.',
  visionText: 'Por definir por la Mesa Directiva del CMJ Flandes.',
  contactEmail: '',
  contactAddress: 'Flandes, Tolima, Colombia',
  activeTheme: 'default',
};

export const STRUCTURAL_COMMISSIONS: Commission[] = [
  {
    id: 'comision-1',
    number: 1,
    name: 'Comisión de Educación, Cultura y Deporte',
    iconName: 'BookOpen',
    accentColor: '#2563EB',
    coverUrl: '',
    description:
      'Espacio de trabajo del Consejo Municipal de Juventudes de Flandes para iniciativas educativas, culturales y deportivas.',
    coordinatorName: 'Por asignar',
    workPlanSummary: '',
  },
  {
    id: 'comision-2',
    number: 2,
    name: 'Comisión de Empleo, Emprendimiento e Innovación',
    iconName: 'Briefcase',
    accentColor: '#059669',
    coverUrl: '',
    description:
      'Espacio de trabajo juvenil enfocado en emprendimiento, formación laboral y desarrollo económico en Flandes.',
    coordinatorName: 'Por asignar',
    workPlanSummary: '',
  },
  {
    id: 'comision-3',
    number: 3,
    name: 'Comisión de Salud Mental, Bienestar y Recreación',
    iconName: 'HeartPulse',
    accentColor: '#E11D48',
    coverUrl: '',
    description:
      'Espacio de seguimiento a bienestar integral, salud mental y convivencia juvenil en el municipio.',
    coordinatorName: 'Por asignar',
    workPlanSummary: '',
  },
  {
    id: 'comision-4',
    number: 4,
    name: 'Comisión de Ambiente, Territorio y Sostenibilidad',
    iconName: 'Leaf',
    accentColor: '#0D9488',
    coverUrl: '',
    description:
      'Espacio de gestión ambiental, cuidado del entorno urbano y rural y participación territorial juvenil.',
    coordinatorName: 'Por asignar',
    workPlanSummary: '',
  },
  {
    id: 'comision-5',
    number: 5,
    name: 'Comisión de Derechos Humanos, Participación y Control Social',
    iconName: 'Scale',
    accentColor: '#4F46E5',
    coverUrl: '',
    description:
      'Espacio de control social, transparencia institucional, veeduría y derechos juveniles en Flandes.',
    coordinatorName: 'Por asignar',
    workPlanSummary: '',
  },
];
