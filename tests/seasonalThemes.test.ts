import { describe, expect, it } from 'vitest';
import { DEFAULT_SITE_APPEARANCE } from '../src/types/siteContent';
import {
  formatMmDdSpanish,
  isMmDdInRange,
  resolveActiveSeasonalTheme,
} from '../src/utils/seasonalThemeResolver';

describe('Resolvedor de temas de temporada y festividades de Flandes', () => {
  it('activa San Juan y San Pedro automáticamente dentro del rango anual', () => {
    const resolved = resolveActiveSeasonalTheme(
      { ...DEFAULT_SITE_APPEARANCE, themeMode: 'auto' },
      new Date(2026, 5, 24), // 24 de junio
    );
    expect(resolved.source).toBe('calendar');
    expect(resolved.theme.id).toBe('san_juan_san_pedro');
  });

  it('soporta rangos que cruzan fin de año (Navidad 12-16 a 01-06)', () => {
    expect(isMmDdInRange('12-24', '12-16', '01-06')).toBe(true);
    expect(isMmDdInRange('01-03', '12-16', '01-06')).toBe(true);
    expect(isMmDdInRange('02-10', '12-16', '01-06')).toBe(false);

    const janResolved = resolveActiveSeasonalTheme(
      { ...DEFAULT_SITE_APPEARANCE, themeMode: 'auto' },
      new Date(2027, 0, 4), // 4 de enero
    );
    expect(janResolved.theme.id).toBe('navidad_ano_nuevo');
  });

  it('respeta selección manual y retorno al tema institucional', () => {
    const manual = resolveActiveSeasonalTheme(
      {
        ...DEFAULT_SITE_APPEARANCE,
        themeMode: 'manual',
        activeThemeId: 'puerta_oro_tolima',
      },
      new Date(2026, 5, 24),
    );
    expect(manual.source).toBe('manual');
    expect(manual.theme.id).toBe('puerta_oro_tolima');

    const reset = resolveActiveSeasonalTheme({
      ...DEFAULT_SITE_APPEARANCE,
      themeMode: 'manual',
      activeThemeId: 'institucional',
    });
    expect(reset.source).toBe('default');
    expect(reset.theme.id).toBe('institucional');
    expect(formatMmDdSpanish('06-24')).toBe('24 jun');
  });
});
