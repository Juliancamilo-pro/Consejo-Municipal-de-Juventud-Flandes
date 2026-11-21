import { BUILTIN_SEASONAL_THEMES, DEFAULT_THEME_CALENDAR } from '../data/seasonalThemes';
import {
  SeasonalScheduleEntry,
  SeasonalThemeDefinition,
  SiteAppearanceConfig,
} from '../types/siteContent';

export function getEffectiveThemes(config: SiteAppearanceConfig): SeasonalThemeDefinition[] {
  const custom = Array.isArray(config.customThemes) ? config.customThemes : [];
  return [...BUILTIN_SEASONAL_THEMES, ...custom];
}

export function getEffectiveCalendar(config: SiteAppearanceConfig): SeasonalScheduleEntry[] {
  const savedMap = new Map((config.themeCalendar || []).map((e) => [e.themeId, e]));
  const merged = DEFAULT_THEME_CALENDAR.map((def) => savedMap.get(def.themeId) || def);
  const customEntries = (config.themeCalendar || []).filter(
    (entry) => !DEFAULT_THEME_CALENDAR.some((d) => d.themeId === entry.themeId),
  );
  return [...merged, ...customEntries];
}

function toMmDd(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${m}-${d}`;
}

export function isMmDdInRange(currentMmDd: string, startMmDd: string, endMmDd: string): boolean {
  if (!/^\d{2}-\d{2}$/.test(startMmDd) || !/^\d{2}-\d{2}$/.test(endMmDd)) return false;
  if (startMmDd <= endMmDd) {
    return currentMmDd >= startMmDd && currentMmDd <= endMmDd;
  }
  // Rango que cruza fin de año (ej. 12-16 a 01-06)
  return currentMmDd >= startMmDd || currentMmDd <= endMmDd;
}

export function resolveActiveSeasonalTheme(
  config: SiteAppearanceConfig,
  now: Date = new Date(),
): {
  theme: SeasonalThemeDefinition;
  source: 'manual' | 'calendar' | 'default';
} {
  const themes = getEffectiveThemes(config);
  const institutional = themes[0];

  if (config.themeMode === 'manual') {
    const match = themes.find((t) => t.id === config.activeThemeId);
    return {
      theme: match || institutional,
      source: match && match.id !== 'institucional' ? 'manual' : 'default',
    };
  }

  const mmdd = toMmDd(now);
  const calendar = getEffectiveCalendar(config);
  for (const entry of calendar) {
    if (!entry.enabled) continue;
    if (isMmDdInRange(mmdd, entry.startMmDd, entry.endMmDd)) {
      const match = themes.find((t) => t.id === entry.themeId);
      if (match) {
        return { theme: match, source: 'calendar' };
      }
    }
  }

  return { theme: institutional, source: 'default' };
}

const MONTHS_ES = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

export function formatMmDdSpanish(mmdd: string): string {
  const [mStr, dStr] = mmdd.split('-');
  const m = Number(mStr);
  const d = Number(dStr);
  if (!Number.isFinite(m) || !Number.isFinite(d) || m < 1 || m > 12) return mmdd;
  return `${d} ${MONTHS_ES[m - 1]}`;
}
