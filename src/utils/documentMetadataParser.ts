import { Commission, DocumentCategory, PlenarySession } from '../types/models';

export interface SuggestedDocumentMetadata {
  title: string;
  category: DocumentCategory;
  year: number;
  commissionId?: string;
  sessionId?: string;
  tags: string[];
}

const KEYWORD_TO_CATEGORY: [RegExp, DocumentCategory][] = [
  [/\bacta\b/i, 'acta'],
  [/\bresoluci[oó]n\b|\bacuerdo\b/i, 'resolucion'],
  [/\boficio\b|\bsolicitud\b/i, 'oficio'],
  [/\bcircular\b/i, 'circular'],
  [/\binforme\b|\bbalance\b|\breporte\b/i, 'informe'],
  [/\bconvocatoria\b|\bcitaci[oó]n\b/i, 'convocatoria'],
  [/\bproposici[oó]n\b/i, 'proposicion'],
  [/\bplan\b/i, 'plan_accion'],
  [/\breglamento\b|\bestatuto\b/i, 'reglamento'],
  [/\bpresupuesto\b|\bfinanc/i, 'presupuesto'],
];

const stripAccents = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export function suggestMetadataFromFilename(
  fileName: string,
  commissions: Commission[] = [],
  sessions: PlenarySession[] = [],
): SuggestedDocumentMetadata {
  const withoutExt = fileName.replace(/\.[^.]+$/, '');
  const cleanTitle = withoutExt
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);

  const normalized = stripAccents(cleanTitle);
  let category: DocumentCategory = 'otro';
  for (const [pattern, cat] of KEYWORD_TO_CATEGORY) {
    if (pattern.test(cleanTitle)) {
      category = cat;
      break;
    }
  }

  const yearMatch = cleanTitle.match(/\b(202[0-9]|203[0-5])\b/);
  const year = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();

  const matchedCommission = commissions.find((c) => {
    const tokens = stripAccents(c.name)
      .split(/\s+/)
      .filter((t) => t.length >= 5);
    return tokens.some((tok) => normalized.includes(tok));
  });

  const matchedSession = sessions.find((s) => {
    if (s.dateIso && normalized.includes(s.dateIso.slice(0, 10))) return true;
    const tokens = stripAccents(s.title)
      .split(/\s+/)
      .filter((t) => t.length >= 5);
    return tokens.some((tok) => normalized.includes(tok));
  });

  const tags: string[] = [];
  if (category !== 'otro') tags.push(category);
  tags.push(String(year));
  if (matchedCommission) tags.push(matchedCommission.name.slice(0, 30));

  return {
    title: cleanTitle || 'Documento institucional CMJ Flandes',
    category,
    year,
    ...(matchedCommission ? { commissionId: matchedCommission.id } : {}),
    ...(matchedSession ? { sessionId: matchedSession.id } : {}),
    tags: Array.from(new Set(tags)).slice(0, 6),
  };
}
