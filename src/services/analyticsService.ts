import {
  collection,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { SiteAnalyticsRecord } from '../types/models';
import { db } from './firebase';

function sanitizeRouteKey(pathname: string): string {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const slug = clean === '/' ? 'inicio' : clean.replace(/^\/+/, '').replace(/[^a-zA-Z0-9_-]+/g, '_');
  return slug.slice(0, 48) || 'inicio';
}

export async function trackPrivacyFirstPageView(pathname: string): Promise<void> {
  if (typeof window === 'undefined' || pathname.startsWith('/portal')) return;
  try {
    const dateKey = new Date().toISOString().slice(0, 10);
    const routeKey = sanitizeRouteKey(pathname);
    const docId = `${dateKey}_${routeKey}`;
    const ref = doc(db, 'site_analytics', docId);
    await setDoc(
      ref,
      {
        route: pathname.slice(0, 100),
        dateKey,
        count: increment(1),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  } catch {
    // La analítica sin cookies nunca debe interrumpir la navegación
  }
}

export async function fetchSiteAnalyticsSummary(): Promise<SiteAnalyticsRecord[]> {
  try {
    const q = query(collection(db, 'site_analytics'), orderBy('updatedAt', 'desc'), limit(60));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      ...(d.data() as Omit<SiteAnalyticsRecord, 'id'>),
      id: d.id,
    }));
  } catch {
    return [];
  }
}
