import type { ElectiveRoleLabel } from '../types/cmj';

export const BOGOTA_TZ = 'America/Bogota';
export const HANDOVER_DEADLINE_DAYS = 30;
export const BLANK_VOTE_OPTION = 'Voto en blanco';

export interface RoleTermConfigEntry {
  roleLabel: ElectiveRoleLabel;
  shortLabel: string;
  unique: boolean;
  perCommission: boolean;
  maxHolders: number | null;
  defaultTermMonths: number;
  handoverDeadlineDays: number;
  canElectViaVote: boolean;
  priority: number;
  description: string;
}

export const ROLE_TERM_CONFIG: Record<ElectiveRoleLabel, RoleTermConfigEntry> = {
  Presidente: {
    roleLabel: 'Presidente',
    shortLabel: 'Presidencia',
    unique: true,
    perCommission: false,
    maxHolders: 1,
    defaultTermMonths: 12,
    handoverDeadlineDays: HANDOVER_DEADLINE_DAYS,
    canElectViaVote: true,
    priority: 1,
    description: 'Representante legal institucional y coordinador de la Mesa Directiva del CMJ.',
  },
  Vicepresidente: {
    roleLabel: 'Vicepresidente',
    shortLabel: 'Vicepresidencia',
    unique: true,
    perCommission: false,
    maxHolders: 1,
    defaultTermMonths: 12,
    handoverDeadlineDays: HANDOVER_DEADLINE_DAYS,
    canElectViaVote: true,
    priority: 2,
    description: 'Suplente institucional de Presidencia y apoyo directo en plenarias y comisiones.',
  },
  Secretario: {
    roleLabel: 'Secretario',
    shortLabel: 'Secretaría',
    unique: true,
    perCommission: false,
    maxHolders: 1,
    defaultTermMonths: 12,
    handoverDeadlineDays: HANDOVER_DEADLINE_DAYS,
    canElectViaVote: true,
    priority: 3,
    description: 'Custodio de actas, convocatorias, votaciones, asistencia y archivo oficial.',
  },
  'Consejero Departamental': {
    roleLabel: 'Consejero Departamental',
    shortLabel: 'Delegado Dept.',
    unique: true,
    perCommission: false,
    maxHolders: 1,
    defaultTermMonths: 12,
    handoverDeadlineDays: HANDOVER_DEADLINE_DAYS,
    canElectViaVote: true,
    priority: 4,
    description: 'Delegado del CMJ Flandes ante el Consejo Departamental de Juventud del Tolima.',
  },
  'Coordinador de Comisión': {
    roleLabel: 'Coordinador de Comisión',
    shortLabel: 'Coord. Comisión',
    unique: true,
    perCommission: true,
    maxHolders: 1,
    defaultTermMonths: 12,
    handoverDeadlineDays: HANDOVER_DEADLINE_DAYS,
    canElectViaVote: true,
    priority: 5,
    description: 'Líder operativo de una de las 5 comisiones temáticas permanentes del CMJ.',
  },
  Consejero: {
    roleLabel: 'Consejero',
    shortLabel: 'Consejero(a)',
    unique: false,
    perCommission: false,
    maxHolders: null,
    defaultTermMonths: 48,
    handoverDeadlineDays: HANDOVER_DEADLINE_DAYS,
    canElectViaVote: false,
    priority: 6,
    description: 'Miembro plenario electo del Consejo Municipal de Juventudes de Flandes.',
  },
};

export const ELECTIVE_ROLE_OPTIONS: RoleTermConfigEntry[] = Object.values(ROLE_TERM_CONFIG)
  .filter((entry) => entry.canElectViaVote)
  .sort((a, b) => a.priority - b.priority);

export function isElectiveRole(value: unknown): value is ElectiveRoleLabel {
  return typeof value === 'string' && value in ROLE_TERM_CONFIG;
}

export function getRoleTermConfig(roleLabel: string): RoleTermConfigEntry {
  if (isElectiveRole(roleLabel)) {
    return ROLE_TERM_CONFIG[roleLabel];
  }
  return ROLE_TERM_CONFIG.Consejero;
}

export function isUniqueRole(roleLabel: string): boolean {
  return getRoleTermConfig(roleLabel).unique;
}

export function requiresCommissionForRole(roleLabel: string): boolean {
  return getRoleTermConfig(roleLabel).perCommission;
}

/**
 * Devuelve la fecha YYYY-MM-DD actual en la zona horaria de Colombia (America/Bogota, UTC-5).
 */
export function getBogotaDateString(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOGOTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value || '2026';
  const m = parts.find((p) => p.type === 'month')?.value || '01';
  const d = parts.find((p) => p.type === 'day')?.value || '01';
  return `${y}-${m}-${d}`;
}

/**
 * Inicio del día actual en Colombia (00:00:00-05:00) expresado como timestamp UTC ISO.
 */
export function getStartOfTodayBogotaIso(): string {
  const todayBogota = getBogotaDateString(new Date());
  return new Date(`${todayBogota}T00:00:00-05:00`).toISOString();
}

/**
 * Convierte un valor de <input type="datetime-local"> interpretado en America/Bogota (-05:00)
 * a ISO UTC estándar para almacenar y comparar en servidor.
 */
export function bogotaLocalInputToUtcIso(rawInput: string): string {
  const trimmed = String(rawInput || '').trim();
  if (!trimmed) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T00:00:00-05:00`);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}:00-05:00`);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}-05:00`);
    return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

/**
 * Convierte un ISO UTC a valor compatible con <input type="datetime-local"> en hora Colombia.
 */
export function utcIsoToBogotaInput(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BOGOTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  const rawHour = parts.find((p) => p.type === 'hour')?.value || '00';
  const hour = rawHour === '24' ? '00' : rawHour;
  const minute = parts.find((p) => p.type === 'minute')?.value || '00';
  if (!y || !m || !day) return '';
  return `${y}-${m}-${day}T${hour}:${minute}`;
}

export function formatBogotaDateTime(iso?: string): string {
  if (!iso) return 'Por definir';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

export function formatBogotaDate(iso?: string): string {
  if (!iso) return 'Por definir';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: BOGOTA_TZ,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

export function formatTermYearsLabel(startDate?: string, endDate?: string, status?: string): string {
  const startYear = startDate && !Number.isNaN(Date.parse(startDate))
    ? new Date(startDate).toLocaleDateString('en-CA', { timeZone: BOGOTA_TZ, year: 'numeric' })
    : '';
  const endYear = endDate && !Number.isNaN(Date.parse(endDate))
    ? new Date(endDate).toLocaleDateString('en-CA', { timeZone: BOGOTA_TZ, year: 'numeric' })
    : '';
  if (startYear && endYear) {
    return startYear === endYear ? startYear : `${startYear}–${endYear}`;
  }
  if (startYear) {
    return status === 'vigente' ? `${startYear}–Actual` : startYear;
  }
  return 'Periodo programado';
}
