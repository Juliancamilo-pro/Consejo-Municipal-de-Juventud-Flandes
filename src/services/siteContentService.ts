import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  DEFAULT_SITE_APPEARANCE,
  SiteAppearanceConfig,
  SiteAppearanceVersion,
} from '../types/siteContent';
import { db } from './firebase';

function upgradeLegacyDefaultImage(url: string | undefined, fallback: string): string {
  if (!url) return fallback;
  if (url.includes('flandes_hero_plaza_1795008982200.jpg')) {
    return '/src/assets/images/flandes_hero_plaza.webp';
  }
  if (url.includes('flandes_magdalena_river_1795008981920.jpg')) {
    return '/src/assets/images/flandes_magdalena_river.webp';
  }
  if (url.includes('flandes_council_hall_1795008981580.jpg')) {
    return '/src/assets/images/flandes_council_hall.webp';
  }
  return url;
}

function mergeSiteConfig(data?: Partial<SiteAppearanceConfig>): SiteAppearanceConfig {
  const merged = { ...DEFAULT_SITE_APPEARANCE, ...(data || {}) };
  return {
    ...merged,
    heroImageUrl: upgradeLegacyDefaultImage(merged.heroImageUrl, DEFAULT_SITE_APPEARANCE.heroImageUrl),
    territorialImageUrl: upgradeLegacyDefaultImage(
      merged.territorialImageUrl,
      DEFAULT_SITE_APPEARANCE.territorialImageUrl,
    ),
    councilImageUrl: upgradeLegacyDefaultImage(merged.councilImageUrl, DEFAULT_SITE_APPEARANCE.councilImageUrl),
    authImageUrl: upgradeLegacyDefaultImage(merged.authImageUrl, DEFAULT_SITE_APPEARANCE.authImageUrl),
  };
}

export async function fetchPublicSiteAppearance(): Promise<SiteAppearanceConfig> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'site_appearance'));
    if (snap.exists()) {
      return mergeSiteConfig(snap.data() as Partial<SiteAppearanceConfig>);
    }
    const res = await fetch('/api/public/site-content', { credentials: 'include' });
    if (res.ok) {
      const json = (await res.json()) as { content?: Partial<SiteAppearanceConfig> };
      if (json.content) return mergeSiteConfig(json.content);
    }
    return DEFAULT_SITE_APPEARANCE;
  } catch {
    return DEFAULT_SITE_APPEARANCE;
  }
}

export async function saveSiteAppearanceOnServer(
  payload: SiteAppearanceConfig,
  actor?: { uid: string; displayName: string },
  versionLabel?: string,
): Promise<SiteAppearanceConfig> {
  const cleanPayload: SiteAppearanceConfig = {
    ...DEFAULT_SITE_APPEARANCE,
    ...payload,
    ...(actor?.displayName ? { updatedByName: actor.displayName } : {}),
  };

  await setDoc(doc(db, 'settings', 'site_appearance'), {
    kind: 'site_appearance',
    ...cleanPayload,
    ...(actor?.uid ? { updatedByUid: actor.uid } : {}),
    updatedAt: serverTimestamp(),
  });

  if (actor?.uid) {
    await addDoc(collection(db, 'site_content_versions'), {
      label: (versionLabel || (cleanPayload.publishStatus === 'borrador' ? 'Borrador guardado' : 'Publicación oficial')).slice(0, 140),
      snapshot: cleanPayload,
      savedByUid: actor.uid,
      savedByName: actor.displayName || 'Mesa Directiva',
      createdAtIso: new Date().toISOString(),
    }).catch(() => undefined);
  }

  return cleanPayload;
}

export async function fetchSiteAppearanceVersions(): Promise<SiteAppearanceVersion[]> {
  try {
    const q = query(
      collection(db, 'site_content_versions'),
      orderBy('createdAtIso', 'desc'),
      limit(15),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<SiteAppearanceVersion, 'id'>),
    }));
  } catch {
    return [];
  }
}
