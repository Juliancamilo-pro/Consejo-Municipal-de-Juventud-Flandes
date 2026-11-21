import { describe, expect, it } from 'vitest';
import { buildCmjExportRows, formatA1Range } from '../src/services/googleSheetsService';
import { buildCalendarIcsContent } from '../src/utils/calendarIcsExport';
import { UserProfile } from '../src/types/models';

describe('Bloque E · Google Sheets y exportación iCalendar (.ics)', () => {
  it('escapa correctamente nombres reales de pestañas en rangos A1 de Google Sheets', () => {
    expect(formatA1Range('Datos CMJ 2026', 'A1:E50')).toBe("'Datos CMJ 2026'!A1:E50");
    expect(formatA1Range("Acta'26", 'A1')).toBe("'Acta''26'!A1");
  });

  it('construye matriz tabular de Directorio y Compromisos lista para Google Sheets', () => {
    const mockUsers: UserProfile[] = [
      {
        uid: 'u1',
        email: 'consejero@flandes.gov.co',
        displayName: 'Camila Rojas',
        role: 'consejero',
        status: 'activo',
        sector: 'Centro Flandes',
        positionTitle: 'Delegada Cultural',
      },
    ];
    const rows = buildCmjExportRows('directorio', { users: mockUsers });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(['Nombre completo', 'Rol institucional', 'Estado', 'Sector o localidad', 'Cargo']);
    expect(rows[1]).toEqual(['Camila Rojas', 'consejero', 'activo', 'Centro Flandes', 'Delegada Cultural']);
  });

  it('genera contenido VCALENDAR válido para eventos institucionales', () => {
    const ics = buildCalendarIcsContent([
      {
        id: 'ev1',
        title: 'Sesión Ordinaria CMJ',
        eventType: 'sesion',
        startIso: '2026-08-15T14:00:00Z',
        endIso: '2026-08-15T16:00:00Z',
        location: 'Alcaldía de Flandes',
        visibility: 'publico',
        createdByUid: 'u1',
      },
    ]);
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('SUMMARY:Sesión Ordinaria CMJ');
    expect(ics).toContain('LOCATION:Alcaldía de Flandes');
    expect(ics).toContain('END:VCALENDAR');
  });
});
