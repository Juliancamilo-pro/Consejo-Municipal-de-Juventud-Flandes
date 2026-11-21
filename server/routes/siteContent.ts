import { Router } from 'express';
import { DEFAULT_SITE_APPEARANCE, SiteAppearanceConfig } from '../../src/types/siteContent.ts';
import { requireAuth, requireCsrf, requireRoles } from '../middleware/auth.ts';
import { getAdminFirestore, isAdminCredentialConfigured } from '../utils/authHelpers.ts';
import { fetchFirestoreDocViaRest } from '../utils/firestoreRest.ts';

const siteContentRouter = Router();

function cleanStr(val: unknown, fallback: string, maxLen: number): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLen);
}

function cleanImageUrl(val: unknown, fallback: string): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (!trimmed) return fallback;
  if (
    trimmed.startsWith('/src/assets/') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed.slice(0, 800);
  }
  return fallback;
}

siteContentRouter.get('/public/site-content', async (_req, res) => {
  try {
    let saved: Partial<SiteAppearanceConfig> | null = null;
    if (isAdminCredentialConfigured()) {
      const snap = await getAdminFirestore().doc('settings/site_appearance').get();
      if (snap.exists) {
        saved = snap.data() as Partial<SiteAppearanceConfig>;
      }
    } else {
      const restDoc = await fetchFirestoreDocViaRest('settings/site_appearance');
      if (restDoc) {
        saved = restDoc as Partial<SiteAppearanceConfig>;
      }
    }
    res.json({
      content: saved ? { ...DEFAULT_SITE_APPEARANCE, ...saved } : DEFAULT_SITE_APPEARANCE,
      customized: Boolean(saved),
    });
  } catch (err) {
    console.error('Error leyendo site-content:', err);
    res.json({
      content: DEFAULT_SITE_APPEARANCE,
      customized: false,
    });
  }
});

siteContentRouter.put(
  '/site-content',
  requireAuth,
  requireRoles(['secretario_admin', 'presidente', 'vicepresidente']),
  requireCsrf,
  async (req, res) => {
    try {
      const actor = req.sessionUser!;
      const body = (req.body || {}) as Partial<SiteAppearanceConfig>;
      const sanitized: SiteAppearanceConfig = {
        heroEyebrow: cleanStr(body.heroEyebrow, DEFAULT_SITE_APPEARANCE.heroEyebrow, 180),
        heroTitle: cleanStr(body.heroTitle, DEFAULT_SITE_APPEARANCE.heroTitle, 200),
        heroSubtitle: cleanStr(body.heroSubtitle, DEFAULT_SITE_APPEARANCE.heroSubtitle, 2000),
        heroImageUrl: cleanImageUrl(body.heroImageUrl, DEFAULT_SITE_APPEARANCE.heroImageUrl),
        heroAlt: cleanStr(body.heroAlt, DEFAULT_SITE_APPEARANCE.heroAlt || '', 240),
        heroCaption: cleanStr(body.heroCaption, DEFAULT_SITE_APPEARANCE.heroCaption, 240),
        territorialEyebrow: cleanStr(
          body.territorialEyebrow,
          DEFAULT_SITE_APPEARANCE.territorialEyebrow,
          180,
        ),
        territorialTitle: cleanStr(
          body.territorialTitle,
          DEFAULT_SITE_APPEARANCE.territorialTitle,
          200,
        ),
        territorialDescription: cleanStr(
          body.territorialDescription,
          DEFAULT_SITE_APPEARANCE.territorialDescription,
          2000,
        ),
        territorialImageUrl: cleanImageUrl(
          body.territorialImageUrl,
          DEFAULT_SITE_APPEARANCE.territorialImageUrl,
        ),
        territorialAlt: cleanStr(
          body.territorialAlt,
          DEFAULT_SITE_APPEARANCE.territorialAlt || '',
          240,
        ),
        territorialCaption: cleanStr(
          body.territorialCaption,
          DEFAULT_SITE_APPEARANCE.territorialCaption,
          240,
        ),
        councilTitle: cleanStr(body.councilTitle, DEFAULT_SITE_APPEARANCE.councilTitle, 200),
        councilSubtitle: cleanStr(
          body.councilSubtitle,
          DEFAULT_SITE_APPEARANCE.councilSubtitle,
          2000,
        ),
        councilImageUrl: cleanImageUrl(
          body.councilImageUrl,
          DEFAULT_SITE_APPEARANCE.councilImageUrl,
        ),
        councilAlt: cleanStr(body.councilAlt, DEFAULT_SITE_APPEARANCE.councilAlt || '', 240),
        councilCaption: cleanStr(body.councilCaption, DEFAULT_SITE_APPEARANCE.councilCaption, 240),
        authTitle: cleanStr(body.authTitle, DEFAULT_SITE_APPEARANCE.authTitle, 200),
        authSubtitle: cleanStr(body.authSubtitle, DEFAULT_SITE_APPEARANCE.authSubtitle, 2000),
        authImageUrl: cleanImageUrl(body.authImageUrl, DEFAULT_SITE_APPEARANCE.authImageUrl),
        authAlt: cleanStr(body.authAlt, DEFAULT_SITE_APPEARANCE.authAlt || '', 240),
        contactIntro: cleanStr(body.contactIntro, DEFAULT_SITE_APPEARANCE.contactIntro, 2000),
        publishStatus: body.publishStatus === 'borrador' ? 'borrador' : 'publicado',
        themeMode: body.themeMode === 'manual' ? 'manual' : 'auto',
        activeThemeId: cleanStr(body.activeThemeId, 'institucional', 64),
        ...(Array.isArray(body.themeCalendar)
          ? { themeCalendar: body.themeCalendar.slice(0, 20) }
          : {}),
        ...(Array.isArray(body.customThemes)
          ? { customThemes: body.customThemes.slice(0, 10) }
          : {}),
        updatedByName: actor.displayName || actor.email,
      };

      if (isAdminCredentialConfigured()) {
        await getAdminFirestore()
          .doc('settings/site_appearance')
          .set({
            kind: 'site_appearance',
            ...sanitized,
            updatedByUid: actor.uid,
            updatedAt: new Date(),
          });
      }
      res.json({ content: sanitized, ok: true });
    } catch (err) {
      console.error('Error guardando site-content:', err);
      res.status(500).json({
        error: 'No se pudo guardar la apariencia del portal en Firestore.',
      });
    }
  },
);

export default siteContentRouter;
