import { CounselorSocialLinks } from '../types/models';

export type SocialPlatform = keyof CounselorSocialLinks;

export interface SocialPlatformMeta {
  key: SocialPlatform;
  label: string;
  placeholder: string;
  handlePrefixUrl: string;
  allowedHosts: string[];
  exampleHint: string;
}

export const SOCIAL_PLATFORMS: SocialPlatformMeta[] = [
  {
    key: 'instagram',
    label: 'Instagram',
    placeholder: '@tuusuario o https://instagram.com/tuusuario',
    handlePrefixUrl: 'https://instagram.com/',
    allowedHosts: ['instagram.com', 'instagr.am'],
    exampleHint: 'Acepta @usuario o enlace instagram.com',
  },
  {
    key: 'facebook',
    label: 'Facebook',
    placeholder: 'nombre.pagina o https://facebook.com/nombre.pagina',
    handlePrefixUrl: 'https://facebook.com/',
    allowedHosts: ['facebook.com', 'fb.com', 'fb.me'],
    exampleHint: 'Acepta usuario o enlace facebook.com',
  },
  {
    key: 'x',
    label: 'X (Twitter)',
    placeholder: '@tuusuario o https://x.com/tuusuario',
    handlePrefixUrl: 'https://x.com/',
    allowedHosts: ['x.com', 'twitter.com'],
    exampleHint: 'Acepta @usuario o enlace x.com / twitter.com',
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    placeholder: '@tuusuario o https://tiktok.com/@tuusuario',
    handlePrefixUrl: 'https://tiktok.com/@',
    allowedHosts: ['tiktok.com', 'vm.tiktok.com'],
    exampleHint: 'Acepta @usuario o enlace tiktok.com',
  },
  {
    key: 'youtube',
    label: 'YouTube',
    placeholder: '@tucanal o https://youtube.com/@tucanal',
    handlePrefixUrl: 'https://youtube.com/@',
    allowedHosts: ['youtube.com', 'youtu.be'],
    exampleHint: 'Acepta @canal o enlace youtube.com / youtu.be',
  },
  {
    key: 'linkedin',
    label: 'LinkedIn',
    placeholder: 'tu-perfil o https://linkedin.com/in/tu-perfil',
    handlePrefixUrl: 'https://linkedin.com/in/',
    allowedHosts: ['linkedin.com'],
    exampleHint: 'Acepta usuario o enlace linkedin.com/in/...',
  },
  {
    key: 'website',
    label: 'Sitio web o portafolio',
    placeholder: 'https://tusitio.org',
    handlePrefixUrl: 'https://',
    allowedHosts: [],
    exampleHint: 'Enlace web público (https://...)',
  },
];

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
];

function matchesHost(hostname: string, allowedHosts: string[]): boolean {
  const clean = hostname.toLowerCase().replace(/^www\./, '');
  if (allowedHosts.length === 0) {
    return clean.includes('.') && !PRIVATE_HOST_PATTERNS.some((rx) => rx.test(clean));
  }
  return allowedHosts.some((allowed) => clean === allowed || clean.endsWith(`.${allowed}`));
}

export function normalizeAndValidateSocialUrl(
  platform: SocialPlatform,
  rawInput: string,
): { valid: boolean; normalizedUrl: string; error?: string } {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { valid: true, normalizedUrl: '' };
  }

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('file:')
  ) {
    return { valid: false, normalizedUrl: '', error: 'Esquema de enlace no permitido.' };
  }

  const meta = SOCIAL_PLATFORMS.find((p) => p.key === platform);
  if (!meta) {
    return { valid: false, normalizedUrl: '', error: 'Plataforma no soportada.' };
  }

  let candidate = trimmed;
  if (platform !== 'website' && (candidate.startsWith('@') || (!candidate.includes('.') && !candidate.includes('://')))) {
    const cleanHandle = candidate.replace(/^@+/, '').replace(/^\/+/, '');
    if (!cleanHandle || /\s/.test(cleanHandle)) {
      return {
        valid: false,
        normalizedUrl: '',
        error: `Ingresa un usuario válido para ${meta.label} (sin espacios).`,
      };
    }
    candidate = `${meta.handlePrefixUrl}${encodeURIComponent(cleanHandle)}`;
  } else if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { valid: false, normalizedUrl: '', error: 'Solo se permiten enlaces http o https.' };
    }
    if (!matchesHost(parsed.hostname, meta.allowedHosts)) {
      return {
        valid: false,
        normalizedUrl: '',
        error:
          meta.allowedHosts.length > 0
            ? `El dominio debe corresponder a ${meta.label} (${meta.allowedHosts.join(' o ')}).`
            : 'Ingresa un dominio web público válido.',
      };
    }
    return {
      valid: true,
      normalizedUrl: parsed.toString().slice(0, 240),
    };
  } catch {
    return {
      valid: false,
      normalizedUrl: '',
      error: `Formato de enlace inválido para ${meta.label}.`,
    };
  }
}
