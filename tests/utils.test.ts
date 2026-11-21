import { describe, expect, it } from 'vitest';
import { mapFirebaseAuthError } from '../src/services/authErrorMapper';
import { Commission, InstitutionalDocument } from '../src/types/models';
import { slugifyCouncilorName } from '../src/utils/avatarCrop';
import {
  computeCommissionGoalsProgress,
  getCommissionAccent,
  slugifyCommissionName,
} from '../src/utils/commissionUtils';
import {
  extractDocumentYear,
  findPotentialDuplicateDocuments,
  formatConsecutiveNumber,
  formatFileSize,
  parseTagsInput,
} from '../src/utils/documentUtils';

describe('commissionUtils', () => {
  it('genera slugs válidos en español colombiano sin tildes', () => {
    expect(slugifyCommissionName('Educación, Cultura y Participación Juvenil')).toBe(
      'educacion-cultura-y-participacion-juvenil',
    );
  });

  it('resuelve colores de acento institucionales válidos y fallback por defecto', () => {
    expect(getCommissionAccent('#1E3A8A')).toBe('#1E3A8A');
    expect(getCommissionAccent('javascript:alert(1)')).toBe('#7B1832');
  });

  it('calcula correctamente el avance global de metas de una comisión', () => {
    const commission = {
      id: 'c1',
      name: 'Cultura',
      description: 'Cultura juvenil',
      status: 'activa',
      goals: [
        {
          id: '1',
          title: 'Meta 1',
          indicator: 'Talleres',
          targetValue: '4',
          currentValue: '4',
          status: 'cumplida',
          progressPercent: 100,
        },
        {
          id: '2',
          title: 'Meta 2',
          indicator: 'Foros',
          targetValue: '2',
          currentValue: '1',
          status: 'en_progreso',
          progressPercent: 50,
        },
      ],
    } as Commission;

    expect(computeCommissionGoalsProgress(commission)).toBe(75);
    expect(computeCommissionGoalsProgress({ ...commission, goals: [] })).toBe(0);
  });
});

describe('documentUtils', () => {
  it('formatea numeración consecutiva oficial por categoría y año', () => {
    expect(formatConsecutiveNumber('acta', 7, 2026)).toBe('Acta No. 007 de 2026');
    expect(formatConsecutiveNumber('resolucion', 14, 2026)).toBe('Resolución No. 014 de 2026');
    expect(formatConsecutiveNumber('oficio', 2, 2027)).toBe('Oficio No. 002 de 2027');
  });

  it('normaliza etiquetas recortadas, únicas y con límite de 10', () => {
    expect(parseTagsInput('Juventud,  Juventud , Cultura , 2026')).toEqual([
      'Juventud',
      'Cultura',
      '2026',
    ]);
  });

  it('detecta posibles documentos duplicados por archivo o título', () => {
    const existing = [
      {
        id: 'd1',
        title: 'Acta Plenaria Marzo 2026',
        fileName: 'acta-marzo.pdf',
        fileSize: 204800,
      } as InstitutionalDocument,
    ];
    expect(
      findPotentialDuplicateDocuments(existing, 'Otro título', 'acta-marzo.pdf', 204800),
    ).toHaveLength(1);
    expect(
      findPotentialDuplicateDocuments(existing, 'Acta Plenaria Marzo 2026', 'x.pdf', 10),
    ).toHaveLength(1);
    expect(
      findPotentialDuplicateDocuments(existing, 'Informe Nuevo', 'nuevo.pdf', 1024),
    ).toHaveLength(0);
  });

  it('formatea tamaños de archivo y extrae año del documento', () => {
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(
      extractDocumentYear({ title: 'Informe 2027', fileName: 'inf.pdf' } as InstitutionalDocument),
    ).toBe(2027);
  });
});

describe('authErrorMapper y slugs de consejeros', () => {
  it('mapea códigos de error de Firebase Auth a mensajes en español de Colombia', () => {
    expect(mapFirebaseAuthError({ code: 'auth/invalid-credential' })).toMatch(
      /correo o contraseña/i,
    );
    const mfaMsg = mapFirebaseAuthError({ code: 'auth/multi-factor-auth-required' });
    expect(mfaMsg).toMatch(/Firebase Console/i);
    expect(mfaMsg).not.toMatch(/README/i);
  });

  it('genera slug estable de consejero', () => {
    expect(slugifyCouncilorName('María José Peña', 'uid12345')).toBe('maria-jose-pena-uid12');
  });
});
