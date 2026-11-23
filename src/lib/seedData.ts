import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
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
    name: 'Comisión 1',
    iconName: 'GraduationCap',
    accentColor: '#2563EB',
    coverUrl: '',
    description: 'Temática y plan de trabajo por definir por sus integrantes.',
    coordinatorName: 'Por asignar',
    workPlanSummary: '',
  },
  {
    id: 'comision-2',
    number: 2,
    name: 'Comisión 2',
    iconName: 'Leaf',
    accentColor: '#10B981',
    coverUrl: '',
    description: 'Temática y plan de trabajo por definir por sus integrantes.',
    coordinatorName: 'Por asignar',
    workPlanSummary: '',
  },
  {
    id: 'comision-3',
    number: 3,
    name: 'Comisión 3',
    iconName: 'Music',
    accentColor: '#EC4899',
    coverUrl: '',
    description: 'Temática y plan de trabajo por definir por sus integrantes.',
    coordinatorName: 'Por asignar',
    workPlanSummary: '',
  },
  {
    id: 'comision-4',
    number: 4,
    name: 'Comisión 4',
    iconName: 'Briefcase',
    accentColor: '#F59E0B',
    coverUrl: '',
    description: 'Temática y plan de trabajo por definir por sus integrantes.',
    coordinatorName: 'Por asignar',
    workPlanSummary: '',
  },
  {
    id: 'comision-5',
    number: 5,
    name: 'Comisión 5',
    iconName: 'Scale',
    accentColor: '#06B6D4',
    coverUrl: '',
    description: 'Temática y plan de trabajo por definir por sus integrantes.',
    coordinatorName: 'Por asignar',
    workPlanSummary: '',
  },
];

let structurePromise: Promise<void> | null = null;

/**
 * Crea únicamente la estructura base vacía del portal (configuración mínima y las 5 comisiones sin datos ficticios).
 */
export async function ensureMinimalStructure(): Promise<void> {
  if (structurePromise) return structurePromise;
  structurePromise = (async () => {
    try {
      const settingsRef = doc(db, 'portal_settings', 'site_content');
      const settingsSnap = await getDoc(settingsRef);
      if (!settingsSnap.exists()) {
        await setDoc(settingsRef, {
          heroTitle: EMPTY_PORTAL_SETTINGS.heroTitle,
          heroSubtitle: EMPTY_PORTAL_SETTINGS.heroSubtitle,
          heroImageUrl: '',
          aboutText: EMPTY_PORTAL_SETTINGS.aboutText || '',
          missionText: EMPTY_PORTAL_SETTINGS.missionText || '',
          visionText: EMPTY_PORTAL_SETTINGS.visionText || '',
          contactEmail: EMPTY_PORTAL_SETTINGS.contactEmail || '',
          contactAddress: EMPTY_PORTAL_SETTINGS.contactAddress || '',
          activeTheme: EMPTY_PORTAL_SETTINGS.activeTheme,
          updatedAt: serverTimestamp(),
        });
      }

      for (const comm of STRUCTURAL_COMMISSIONS) {
        const cRef = doc(db, 'commissions', comm.id);
        const cSnap = await getDoc(cRef);
        if (!cSnap.exists()) {
          await setDoc(cRef, {
            id: comm.id,
            number: comm.number,
            name: comm.name,
            iconName: comm.iconName || 'Layers',
            accentColor: comm.accentColor || '#2563EB',
            coverUrl: '',
            description: comm.description,
            coordinatorName: comm.coordinatorName,
            workPlanSummary: '',
            updatedAt: serverTimestamp(),
          });
        }
      }
    } catch (err) {
      console.warn('No se pudo verificar la estructura mínima:', err);
    } finally {
      structurePromise = null;
    }
  })();
  return structurePromise;
}

const LEGACY_SAMPLE_DOCS: { col: string; ids: string[] }[] = [
  { col: 'news_events', ids: ['news-1', 'news-2', 'news-3'] },
  { col: 'gallery_items', ids: ['gal-1', 'gal-2', 'gal-3', 'gal-4'] },
  { col: 'documents', ids: ['doc-1', 'doc-2', 'doc-3'] },
  { col: 'calls_surveys', ids: ['call-1', 'call-2'] },
  { col: 'sessions', ids: ['ses-1', 'ses-2'] },
  { col: 'votes', ids: ['vote-1'] },
  { col: 'commitments', ids: ['comp-1', 'comp-2', 'comp-3'] },
  { col: 'ideas_inbox', ids: ['idea-1', 'idea-2'] },
  { col: 'letter_templates', ids: ['tpl-1', 'tpl-2'] },
  { col: 'work_plans', ids: ['wp-1', 'wp-2', 'wp-3', 'wp-4', 'wp-5'] },
  { col: 'public_councilors', ids: ['sample-pres', 'sample-vp', 'sample-sec', 'sample-c2', 'sample-c4'] },
];

/**
 * Elimina de Firestore cualquier documento ficticio sembrado anteriormente (solo Presidente/Secretario).
 */
export async function purgeLegacySampleData(): Promise<number> {
  let deletedCount = 0;

  for (const group of LEGACY_SAMPLE_DOCS) {
    for (const id of group.ids) {
      try {
        const snap = await getDoc(doc(db, group.col, id));
        if (snap.exists()) {
          await deleteDoc(doc(db, group.col, id));
          deletedCount++;
        }
      } catch {
        // Ignorar si no existe o ya fue eliminado
      }
    }
  }

  // Limpiar rutas rotas a /src/assets/images en portal_settings o commissions si quedaron guardadas
  try {
    const sSnap = await getDoc(doc(db, 'portal_settings', 'site_content'));
    if (sSnap.exists()) {
      const data = sSnap.data();
      if (typeof data.heroImageUrl === 'string' && data.heroImageUrl.includes('/src/assets/images/')) {
        await setDoc(doc(db, 'portal_settings', 'site_content'), {
          ...EMPTY_PORTAL_SETTINGS,
          updatedAt: serverTimestamp(),
        });
        deletedCount++;
      }
    }
  } catch {
    // non-blocking
  }

  try {
    const commsSnap = await getDocs(collection(db, 'commissions'));
    for (const cDoc of commsSnap.docs) {
      const data = cDoc.data();
      if (typeof data.coverUrl === 'string' && data.coverUrl.includes('/src/assets/images/')) {
        const base = STRUCTURAL_COMMISSIONS.find((c) => c.id === cDoc.id);
        await setDoc(doc(db, 'commissions', cDoc.id), {
          id: cDoc.id,
          number: Number(data.number || base?.number || 1),
          name: base?.name || String(data.name || cDoc.id),
          iconName: base?.iconName || 'Layers',
          accentColor: base?.accentColor || '#2563EB',
          coverUrl: '',
          description: 'Temática y plan de trabajo por definir por sus integrantes.',
          coordinatorName: 'Por asignar',
          workPlanSummary: '',
          updatedAt: serverTimestamp(),
        });
        deletedCount++;
      }
    }
  } catch {
    // non-blocking
  }

  return deletedCount;
}
