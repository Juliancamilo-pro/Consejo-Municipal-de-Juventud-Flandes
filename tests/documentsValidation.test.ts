import { describe, expect, it } from 'vitest';
import { InstitutionalDocument } from '../src/types/models';
import { suggestMetadataFromFilename } from '../src/utils/documentMetadataParser';
import { findPotentialDuplicateDocuments } from '../src/utils/documentUtils';
import { computeFileSha256, validateFileMagicBytes } from '../src/utils/fileValidation';

describe('Bloque D · Validación documental, SHA-256 y metadatos', () => {
  it('valida magic bytes reales de PDF y rechaza archivos adulterados', async () => {
    const validPdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])], 'acta.pdf', {
      type: 'application/pdf',
    });
    await expect(validateFileMagicBytes(validPdf)).resolves.toBeUndefined();

    const fakePdf = new File(['esto no es un pdf'], 'falso.pdf', {
      type: 'application/pdf',
    });
    await expect(validateFileMagicBytes(fakePdf)).rejects.toThrow(/encabezado real/i);
  });

  it('calcula SHA-256 estable y detecta duplicados exactos aunque cambie el nombre', async () => {
    const content = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
    const f1 = new File([content], 'acta_01.pdf', { type: 'application/pdf' });
    const f2 = new File([content], 'copia_renombrada.pdf', { type: 'application/pdf' });
    const hash1 = await computeFileSha256(f1);
    const hash2 = await computeFileSha256(f2);
    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);

    const existing: InstitutionalDocument[] = [
      {
        id: 'd1',
        title: 'Acta Sesión Plenaria',
        category: 'acta',
        status: 'publicada',
        visibility: 'publico',
        currentVersion: 1,
        fileId: 'f1',
        fileName: 'acta_01.pdf',
        fileMime: 'application/pdf',
        fileSize: 999,
        contentSha256: hash1,
        authorUid: 'u1',
        authorName: 'Secretario',
      },
    ];

    const dups = findPotentialDuplicateDocuments(existing, 'Otro título', 'copia_renombrada.pdf', 8, hash2);
    expect(dups).toHaveLength(1);
    expect(dups[0].id).toBe('d1');
  });

  it('sugiere categoría, año y comisión desde el nombre del archivo', () => {
    const suggested = suggestMetadataFromFilename(
      'Acta_Plenaria_Educacion_2026_Flandes.pdf',
      [
        {
          id: 'com-edu',
          name: 'Comisión de Educación y Cultura',
          description: 'Desc',
          memberUids: [],
          status: 'activa',
        },
      ],
      [],
    );

    expect(suggested.category).toBe('acta');
    expect(suggested.year).toBe(2026);
    expect(suggested.commissionId).toBe('com-edu');
    expect(suggested.title).toContain('Acta Plenaria Educacion');
  });
});
