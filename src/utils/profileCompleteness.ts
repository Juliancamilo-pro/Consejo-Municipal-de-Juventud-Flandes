import { CounselorSocialLinks } from '../types/models';
import { normalizeAndValidateSocialUrl, SocialPlatform } from './socialLinks';

export type ProfileEditorTabId = 'ficha' | 'redes' | 'privacidad' | 'seguridad' | 'actividad';

export interface CompletenessCheckItem {
  key: string;
  label: string;
  done: boolean;
  targetTab: ProfileEditorTabId;
  targetFieldId: string;
}

export interface ProfileCompletenessInput {
  photoUrl: string;
  positionTitle: string;
  shortBio: string;
  fullBio: string;
  motivation: string;
  proposals: string;
  socialLinks: CounselorSocialLinks;
  habeasDataAccepted: boolean;
}

export interface ProfileCompletenessResult {
  percent: number;
  completedCount: number;
  totalCount: number;
  items: CompletenessCheckItem[];
  firstMissing: CompletenessCheckItem | null;
}

function hasAnyValidSocialLink(links: CounselorSocialLinks): boolean {
  const keys = Object.keys(links) as SocialPlatform[];
  return keys.some((key) => {
    const raw = links[key]?.trim();
    if (!raw) return false;
    return normalizeAndValidateSocialUrl(key, raw).valid;
  });
}

export function evaluateProfileCompleteness(
  input: ProfileCompletenessInput,
): ProfileCompletenessResult {
  const items: CompletenessCheckItem[] = [
    {
      key: 'photo',
      label: 'Fotografía oficial',
      done: input.photoUrl.trim().length > 0,
      targetTab: 'ficha',
      targetFieldId: 'profile-avatar-section',
    },
    {
      key: 'cargo',
      label: 'Cargo o dignidad',
      done: input.positionTitle.trim().length >= 2,
      targetTab: 'ficha',
      targetFieldId: 'profile-position-title',
    },
    {
      key: 'shortBio',
      label: 'Reseña corta',
      done: input.shortBio.trim().length >= 15,
      targetTab: 'ficha',
      targetFieldId: 'profile-short-bio',
    },
    {
      key: 'fullBio',
      label: 'Biografía completa',
      done: input.fullBio.trim().length >= 30,
      targetTab: 'ficha',
      targetFieldId: 'profile-full-bio',
    },
    {
      key: 'motivation',
      label: 'Motivación en el CMJ',
      done: input.motivation.trim().length >= 20,
      targetTab: 'ficha',
      targetFieldId: 'profile-motivation',
    },
    {
      key: 'proposals',
      label: 'Propuestas de trabajo',
      done: input.proposals.trim().length >= 20,
      targetTab: 'ficha',
      targetFieldId: 'profile-proposals',
    },
    {
      key: 'socials',
      label: 'Al menos una red o sitio web',
      done: hasAnyValidSocialLink(input.socialLinks),
      targetTab: 'redes',
      targetFieldId: 'profile-social-instagram',
    },
    {
      key: 'consent',
      label: 'Consentimiento Habeas Data',
      done: Boolean(input.habeasDataAccepted),
      targetTab: 'privacidad',
      targetFieldId: 'profile-habeas-checkbox',
    },
  ];

  const completedCount = items.filter((i) => i.done).length;
  const totalCount = items.length;
  const percent = Math.round((completedCount / totalCount) * 100);
  const firstMissing = items.find((i) => !i.done) || null;

  return {
    percent,
    completedCount,
    totalCount,
    items,
    firstMissing,
  };
}
