import { DocumentCategory, DocumentStatus, InstitutionalDocument } from '../types/models';

export const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'acta',
  'informe',
  'resolucion',
  'oficio',
  'circular',
  'convocatoria',
  'proposicion',
  'plan_accion',
  'reglamento',
  'presupuesto',
  'otro',
];

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  acta: 'Acta de sesión',
  informe: 'Informe de gestión',
  resolucion: 'Resolución',
  oficio: 'Oficio institucional',
  circular: 'Circular',
  convocatoria: 'Convocatoria',
  proposicion: 'Proposición',
  plan_accion: 'Plan de acción',
  reglamento: 'Reglamento interno',
  presupuesto: 'Presupuesto y gestión',
  otro: 'Otro / Anexo multimedia',
};

export const DOCUMENT_NUMBER_PREFIX: Record<DocumentCategory, string> = {
  acta: 'Acta',
  informe: 'Informe',
  resolucion: 'Resolución',
  oficio: 'Oficio',
  circular: 'Circular',
  convocatoria: 'Convocatoria',
  proposicion: 'Proposición',
  plan_accion: 'Plan',
  reglamento: 'Acuerdo',
  presupuesto: 'Certificado',
  otro: 'Documento',
};

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  borrador: 'Borrador',
  revision: 'En revisión',
  aprobada: 'Aprobada',
  publicada: 'Publicada',
  archivada: 'Archivada',
};

export function extractDocumentYear(docItem: Partial<InstitutionalDocument>): number {
  if (typeof docItem.year === 'number' && docItem.year >= 2020 && docItem.year <= 2040) {
    return docItem.year;
  }
  const raw = docItem.createdAt;
  if (
    raw &&
    typeof raw === 'object' &&
    'toDate' in raw &&
    typeof (raw as { toDate: () => Date }).toDate === 'function'
  ) {
    return (raw as { toDate: () => Date }).toDate().getFullYear();
  }
  const match = `${docItem.title || ''} ${docItem.fileName || ''}`.match(/20\d{2}/);
  return match ? Number(match[0]) : new Date().getFullYear();
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function formatConsecutiveNumber(
  category: DocumentCategory,
  seq: number,
  year: number,
): string {
  const prefix = DOCUMENT_NUMBER_PREFIX[category] || 'Documento';
  return `${prefix} No. ${String(seq).padStart(3, '0')} de ${year}`;
}

export function findPotentialDuplicateDocuments(
  existing: InstitutionalDocument[],
  title: string,
  fileName: string,
  fileSize: number,
  sha256?: string,
): InstitutionalDocument[] {
  const normTitle = title.trim().toLowerCase();
  const normFile = fileName.trim().toLowerCase();
  return existing.filter((docItem) => {
    const sameHash = Boolean(sha256 && docItem.contentSha256 && docItem.contentSha256 === sha256);
    const sameTitle = normTitle.length >= 4 && docItem.title.trim().toLowerCase() === normTitle;
    const sameFile =
      docItem.fileName.trim().toLowerCase() === normFile && docItem.fileSize === fileSize;
    return sameHash || sameTitle || sameFile;
  });
}

export function parseTagsInput(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length >= 2)
        .map((t) => t.slice(0, 32)),
    ),
  ).slice(0, 10);
}
