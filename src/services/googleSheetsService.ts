import { AnnualActionPlanItem, AttendanceRecord, CommitmentItem, UserProfile } from '../types/models';
import { workspaceFetch } from './workspaceApi';

export interface GoogleSheetSummary {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface GoogleSheetTabMeta {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
}

export interface GoogleSheetMetadata {
  spreadsheetId: string;
  title: string;
  url: string;
  sheets: GoogleSheetTabMeta[];
}

export function formatA1Range(sheetTitle: string, rangeA1 = 'A1:Z100'): string {
  const escaped = sheetTitle.replace(/'/g, "''");
  return `'${escaped}'!${rangeA1}`;
}

export async function listRecentGoogleSheets(accessToken: string): Promise<GoogleSheetSummary[]> {
  const q = encodeURIComponent(
    "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
  );
  const fields = encodeURIComponent('files(id,name,modifiedTime,webViewLink)');
  const data = await workspaceFetch<{ files?: GoogleSheetSummary[] }>(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=modifiedTime desc&pageSize=20`,
    accessToken,
  );
  return data.files || [];
}

export async function createGoogleSpreadsheet(
  accessToken: string,
  title: string,
  initialSheetTitle = 'Datos_CMJ',
): Promise<GoogleSheetMetadata> {
  const created = await workspaceFetch<{
    spreadsheetId: string;
    spreadsheetUrl?: string;
    properties?: { title?: string };
    sheets?: { properties?: { sheetId?: number; title?: string; gridProperties?: { rowCount?: number; columnCount?: number } } }[];
  }>('https://sheets.googleapis.com/v4/spreadsheets', accessToken, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title: title.trim() || 'Registro CMJ Flandes' },
      sheets: [{ properties: { title: initialSheetTitle.trim() || 'Datos_CMJ' } }],
    }),
  });

  const sheets = (created.sheets || []).map((s, idx) => ({
    sheetId: s.properties?.sheetId ?? idx,
    title: s.properties?.title || 'Datos_CMJ',
    rowCount: s.properties?.gridProperties?.rowCount ?? 1000,
    columnCount: s.properties?.gridProperties?.columnCount ?? 26,
  }));

  return {
    spreadsheetId: created.spreadsheetId,
    title: created.properties?.title || title.trim(),
    url:
      created.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`,
    sheets,
  };
}

export async function getSpreadsheetMetadata(
  accessToken: string,
  spreadsheetId: string,
): Promise<GoogleSheetMetadata> {
  const fields = encodeURIComponent(
    'spreadsheetId,spreadsheetUrl,properties.title,sheets.properties(sheetId,title,gridProperties)',
  );
  const data = await workspaceFetch<{
    spreadsheetId: string;
    spreadsheetUrl?: string;
    properties?: { title?: string };
    sheets?: { properties?: { sheetId?: number; title?: string; gridProperties?: { rowCount?: number; columnCount?: number } } }[];
  }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=${fields}`,
    accessToken,
  );

  return {
    spreadsheetId: data.spreadsheetId || spreadsheetId,
    title: data.properties?.title || 'Hoja de cálculo',
    url:
      data.spreadsheetUrl ||
      `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    sheets: (data.sheets || []).map((s, idx) => ({
      sheetId: s.properties?.sheetId ?? idx,
      title: s.properties?.title || `Hoja${idx + 1}`,
      rowCount: s.properties?.gridProperties?.rowCount ?? 1000,
      columnCount: s.properties?.gridProperties?.columnCount ?? 26,
    })),
  };
}

export async function readSheetRange(
  accessToken: string,
  spreadsheetId: string,
  range: string,
): Promise<string[][]> {
  const encodedRange = encodeURIComponent(range);
  const data = await workspaceFetch<{ values?: unknown[][] }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodedRange}`,
    accessToken,
  );
  return (data.values || []).map((row) => row.map((cell) => String(cell ?? '')));
}

export async function updateSheetRange(
  accessToken: string,
  spreadsheetId: string,
  range: string,
  values: (string | number)[][],
): Promise<{ updatedCells: number }> {
  const encodedRange = encodeURIComponent(range);
  const res = await workspaceFetch<{ updatedCells?: number }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodedRange}?valueInputOption=USER_ENTERED`,
    accessToken,
    {
      method: 'PUT',
      body: JSON.stringify({ range, values }),
    },
  );
  return { updatedCells: res.updatedCells ?? 0 };
}

export async function appendSheetRows(
  accessToken: string,
  spreadsheetId: string,
  sheetTitle: string,
  rows: (string | number)[][],
): Promise<{ updatedRows: number }> {
  const range = formatA1Range(sheetTitle, 'A1');
  const encodedRange = encodeURIComponent(range);
  const res = await workspaceFetch<{ updates?: { updatedRows?: number } }>(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodedRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ values: rows }),
    },
  );
  return { updatedRows: res.updates?.updatedRows ?? rows.length };
}

export type CmjSheetDatasetKind = 'directorio' | 'asistencia' | 'compromisos' | 'plan_accion';

export function buildCmjExportRows(
  dataset: CmjSheetDatasetKind,
  input: {
    users?: UserProfile[];
    attendance?: AttendanceRecord[];
    commitments?: CommitmentItem[];
    actionPlan?: AnnualActionPlanItem[];
  },
): (string | number)[][] {
  if (dataset === 'directorio') {
    const users = input.users || [];
    return [
      ['Nombre completo', 'Rol institucional', 'Estado', 'Sector o localidad', 'Cargo'],
      ...users.map((u) => [
        u.displayName,
        u.role,
        u.status,
        u.sector || 'Flandes, Tolima',
        u.positionTitle || 'Consejero(a)',
      ]),
    ];
  }

  if (dataset === 'asistencia') {
    const att = input.attendance || [];
    return [
      ['ID Sesión', 'Consejero', 'Estado asistencia', 'Observaciones'],
      ...att.map((a) => [a.sessionId, a.userName, a.status, a.notes || '—']),
    ];
  }

  if (dataset === 'compromisos') {
    const commits = input.commitments || [];
    return [
      ['Compromiso', 'Responsable', 'Fecha límite', 'Avance (%)', 'Estado'],
      ...commits.map((c) => [c.title, c.assigneeName, c.dueDate, c.progressPercent, c.status]),
    ];
  }

  const plan = input.actionPlan || [];
  return [
    ['Año', 'Eje estratégico', 'Meta', 'Indicador', 'Ejecutado', 'Meta numérica', 'Estado', 'Responsable'],
    ...plan.map((p) => [
      p.year,
      p.axis,
      p.title,
      p.indicator,
      p.executedValue,
      p.targetValue,
      p.status,
      p.responsibleName,
    ]),
  ];
}
