import {
  Building2,
  Globe,
  GraduationCap,
  HeartHandshake,
  LucideIcon,
  Palette,
  Scale,
  Sprout,
  Users,
} from 'lucide-react';
import { Commission, CommissionIconName } from '../types/models';

export const COMMISSION_ICONS: Record<CommissionIconName, { label: string; icon: LucideIcon }> = {
  Building2: { label: 'Institucional', icon: Building2 },
  Users: { label: 'Juventud y Comunidad', icon: Users },
  Sprout: { label: 'Ambiente y Ruralidad', icon: Sprout },
  Palette: { label: 'Cultura y Deporte', icon: Palette },
  GraduationCap: { label: 'Educación y Ciencia', icon: GraduationCap },
  HeartHandshake: { label: 'Bienestar e Inclusión', icon: HeartHandshake },
  Scale: { label: 'Veeduría y Derechos', icon: Scale },
  Globe: { label: 'Emprendimiento y TIC', icon: Globe },
};

export const COMMISSION_ACCENT_PRESETS = [
  { label: 'Vinotinto CMJ', value: '#7B1832' },
  { label: 'Azul Tolima', value: '#1E3A8A' },
  { label: 'Oro Institucional', value: '#C59B27' },
  { label: 'Verde Magdalena', value: '#0F766E' },
  { label: 'Terracota Flandes', value: '#9A3412' },
  { label: 'Pizarra Sobria', value: '#334155' },
];

export function slugifyCommissionName(name: string, fallbackId?: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  if (base.length >= 2) return base;
  return `comision-${(fallbackId || 'cmj').slice(0, 12).toLowerCase()}`;
}

export function getCommissionSlug(c: Pick<Commission, 'id' | 'name' | 'slug'>): string {
  return c.slug?.trim() || slugifyCommissionName(c.name, c.id);
}

export function getCommissionIcon(iconName?: string): LucideIcon {
  if (iconName && iconName in COMMISSION_ICONS) {
    return COMMISSION_ICONS[iconName as CommissionIconName].icon;
  }
  return Building2;
}

export function getCommissionAccent(accentColor?: string): string {
  if (accentColor && /^#[0-9A-Fa-f]{6}$/.test(accentColor)) {
    return accentColor;
  }
  return '#7B1832';
}

export function computeCommissionGoalsProgress(c: Commission): number {
  const goals = c.goals || [];
  if (goals.length === 0) return 0;
  const total = goals.reduce((sum, g) => sum + Math.min(100, Math.max(0, g.progressPercent || 0)), 0);
  return Math.round(total / goals.length);
}
