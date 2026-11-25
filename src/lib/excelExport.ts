import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import type { AffiliationType, Commission, RoleLabel } from '../types/cmj';

export type ExcelColumnType = 'text' | 'number' | 'integer' | 'percent' | 'currency' | 'date';

export interface ExcelColumnDef {
  key: string;
  header: string;
  type?: ExcelColumnType;
  minWidth?: number;
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
  wrap?: boolean;
}

export interface ExcelSheetSpec {
  name: string;
  title?: string;
  subtitle?: string;
  columns: ExcelColumnDef[];
  rows: Record<string, unknown>[];
  kpis?: { label: string; value: string | number }[];
}

export interface ExportWorkbookOptions {
  fileName: string;
  reportTitle: string;
  moduleName: string;
  generatedBy?: string;
  includeSummarySheet?: boolean;
  sheets: ExcelSheetSpec[];
}

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF047857' }, // Esmeralda institucional CMJ
};

const BANNER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF065F46' },
};

const SUBBANNER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFECFDF5' },
};

const ZEBRA_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF8FAFC' },
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
};

const HEADER_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF065F46' } },
  left: { style: 'thin', color: { argb: 'FF065F46' } },
  bottom: { style: 'medium', color: { argb: 'FF064E3B' } },
  right: { style: 'thin', color: { argb: 'FF065F46' } },
};

function sanitizeSheetName(raw: string, usedNames: Set<string>): string {
  const cleaned = raw
    .replace(/[\\/?*[\]:]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const base = (cleaned || 'Hoja').slice(0, 31);
  if (!usedNames.has(base)) {
    usedNames.add(base);
    return base;
  }
  let idx = 2;
  while (idx < 99) {
    const suffix = ` ${idx}`;
    const candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
    idx += 1;
  }
  return base;
}

function parseExcelDate(raw: unknown): Date | string {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
  const text = String(raw ?? '').trim();
  if (!text) return '—';
  // Match YYYY-MM-DD or YYYY-MM-DDTHH:mm...
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (isoMatch) {
    const d = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
    if (!Number.isNaN(d.getTime())) return d;
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime()) && text.length >= 8) return parsed;
  return text;
}

function toNumericValue(raw: unknown): number | string {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const str = String(raw ?? '').trim();
  if (!str) return 0;
  const cleaned = str.replace(/[$,\s%]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) && cleaned !== '' ? n : str;
}

function formatCellDisplayLength(val: unknown, type: ExcelColumnType): number {
  if (val instanceof Date) return 12;
  if (typeof val === 'number') {
    if (type === 'percent') return 8;
    if (type === 'currency') return 14;
    return String(val).length + 2;
  }
  const s = String(val ?? '');
  const longestLine = s.split('\n').reduce((max, line) => Math.max(max, line.length), 0);
  return longestLine;
}

function buildWorksheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  spec: ExcelSheetSpec,
  reportTitle: string,
  moduleName: string,
  generatedBy?: string
) {
  const ws = wb.addWorksheet(sheetName, {
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.4,
        right: 0.4,
        top: 0.5,
        bottom: 0.5,
        header: 0.25,
        footer: 0.25,
      },
    },
  });

  const colCount = Math.max(1, spec.columns.length);
  const nowLabel = new Date().toLocaleString('es-CO', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // Fila 1: Banner Institucional CMJ
  const row1 = ws.addRow(['CONSEJO MUNICIPAL DE JUVENTUDES DE FLANDES · TOLIMA']);
  ws.mergeCells(1, 1, 1, colCount);
  row1.height = 28;
  const c1 = row1.getCell(1);
  c1.fill = BANNER_FILL;
  c1.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  c1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  // Fila 2: Título del reporte y metadatos
  const subtitle =
    spec.subtitle ||
    `${spec.title || reportTitle} · Módulo: ${moduleName} · Generado: ${nowLabel}${
      generatedBy ? ` · Por: ${generatedBy}` : ''
    }`;
  const row2 = ws.addRow([subtitle]);
  ws.mergeCells(2, 1, 2, colCount);
  row2.height = 22;
  const c2 = row2.getCell(1);
  c2.fill = SUBBANNER_FILL;
  c2.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF065F46' } };
  c2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

  let currentRow = 3;

  // Bloque opcional de KPIs ejecutivos
  if (spec.kpis && spec.kpis.length > 0) {
    const kpiRow = ws.addRow(
      spec.kpis.flatMap((k) => [k.label, k.value]).slice(0, Math.max(colCount, spec.kpis.length * 2))
    );
    kpiRow.height = 20;
    kpiRow.eachCell((cell, idx) => {
      const isLabel = idx % 2 === 1;
      cell.font = {
        name: 'Calibri',
        size: 9.5,
        bold: true,
        color: { argb: isLabel ? 'FF475569' : 'FF047857' },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isLabel ? 'FFF1F5F9' : 'FFECFDF5' },
      };
      cell.border = THIN_BORDER;
      cell.alignment = { vertical: 'middle', horizontal: isLabel ? 'left' : 'center' };
    });
    currentRow += 1;
  }

  // Fila en blanco separadora
  ws.addRow([]);
  ws.getRow(currentRow).height = 8;
  currentRow += 1;

  // Fila de Encabezados
  const headerRowNumber = currentRow;
  const headerRow = ws.addRow(spec.columns.map((col) => col.header));
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = HEADER_BORDER;
  });

  // Track max widths per column
  const maxWidths = spec.columns.map((col) => Math.max(col.header.length + 3, col.minWidth ?? 11));

  // Filas de datos
  spec.rows.forEach((rawRow, rowIndex) => {
    const values = spec.columns.map((col) => {
      const raw = rawRow[col.key];
      const type = col.type || 'text';
      if (type === 'date') return parseExcelDate(raw);
      if (type === 'integer' || type === 'number' || type === 'currency') {
        return toNumericValue(raw);
      }
      if (type === 'percent') {
        const n = toNumericValue(raw);
        if (typeof n === 'number') {
          return n > 1.0001 ? n / 100 : n;
        }
        return n;
      }
      return raw === undefined || raw === null || raw === '' ? '—' : String(raw);
    });

    const excelRow = ws.addRow(values);
    let maxLines = 1;

    spec.columns.forEach((col, colIdx) => {
      const cell = excelRow.getCell(colIdx + 1);
      const type = col.type || 'text';
      const val = values[colIdx];
      const isZebra = rowIndex % 2 === 1;

      if (isZebra) cell.fill = ZEBRA_FILL;
      cell.border = THIN_BORDER;
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF0F172A' } };

      if (type === 'date' && val instanceof Date) {
        cell.numFmt = 'dd/mm/yyyy';
      } else if (type === 'integer' && typeof val === 'number') {
        cell.numFmt = '#,##0';
      } else if (type === 'number' && typeof val === 'number') {
        cell.numFmt = '#,##0.##';
      } else if (type === 'percent' && typeof val === 'number') {
        cell.numFmt = '0.0%';
      } else if (type === 'currency' && typeof val === 'number') {
        cell.numFmt = '$#,##0';
      }

      const defaultAlign: 'left' | 'center' | 'right' =
        col.align ||
        (type === 'integer' || type === 'number' || type === 'currency'
          ? 'right'
          : type === 'percent' || type === 'date'
          ? 'center'
          : 'left');

      const strVal = String(val ?? '');
      const shouldWrap = Boolean(col.wrap) || (type === 'text' && (strVal.length > 34 || strVal.includes('\n')));

      cell.alignment = {
        vertical: 'middle',
        horizontal: defaultAlign,
        wrapText: shouldWrap,
      };

      const displayLen = formatCellDisplayLength(val, type);
      const colMax = col.maxWidth ?? 46;
      maxWidths[colIdx] = Math.min(colMax, Math.max(maxWidths[colIdx], displayLen + 3));

      if (shouldWrap) {
        const effectiveWidth = Math.max(18, maxWidths[colIdx]);
        const estimatedLines = Math.max(
          strVal.split('\n').length,
          Math.ceil(strVal.length / Math.max(14, effectiveWidth - 3))
        );
        maxLines = Math.max(maxLines, Math.min(6, estimatedLines));
      }
    });

    excelRow.height = Math.max(21, maxLines * 15 + 6);
  });

  // Aplicar anchos automáticos
  ws.columns.forEach((column, idx) => {
    const colDef = spec.columns[idx];
    const minW = colDef?.minWidth ?? 11;
    const maxW = colDef?.maxWidth ?? 46;
    column.width = Math.max(minW, Math.min(maxW, maxWidths[idx] + 2));
  });

  // Congelar encabezados + Autofiltro + Título de impresión repetido
  ws.views = [{ state: 'frozen', ySplit: headerRowNumber }];
  if (spec.rows.length > 0) {
    ws.autoFilter = {
      from: { row: headerRowNumber, column: 1 },
      to: { row: headerRowNumber + spec.rows.length, column: colCount },
    };
  }
  ws.pageSetup.printTitlesRow = `${headerRowNumber}:${headerRowNumber}`;
}

export async function exportStyledWorkbook({
  fileName,
  reportTitle,
  moduleName,
  generatedBy,
  includeSummarySheet = false,
  sheets,
}: ExportWorkbookOptions): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = generatedBy || 'CMJ Flandes, Tolima';
  wb.created = new Date();
  wb.modified = new Date();

  const usedNames = new Set<string>();

  if (includeSummarySheet && sheets.length > 1) {
    const summaryName = sanitizeSheetName('Resumen', usedNames);
    const summarySpec: ExcelSheetSpec = {
      name: summaryName,
      title: `${reportTitle} — Resumen Ejecutivo`,
      columns: [
        { key: 'seccion', header: 'Sección / Hoja', type: 'text', minWidth: 22, maxWidth: 34 },
        { key: 'descripcion', header: 'Descripción del contenido', type: 'text', minWidth: 32, maxWidth: 52, wrap: true },
        { key: 'registros', header: 'Registros', type: 'integer', minWidth: 13 },
        { key: 'columnas', header: 'Columnas', type: 'integer', minWidth: 12 },
      ],
      rows: sheets.map((s) => ({
        seccion: s.name,
        descripcion: s.title || s.name,
        registros: s.rows.length,
        columnas: s.columns.length,
      })),
    };
    buildWorksheet(wb, summaryName, summarySpec, reportTitle, moduleName, generatedBy);
  }

  for (const spec of sheets) {
    const safeName = sanitizeSheetName(spec.name, usedNames);
    buildWorksheet(wb, safeName, spec, reportTitle, moduleName, generatedBy);
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerBlobDownload(blob, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}

function escapeCsvCell(value: unknown): string {
  const str = value === undefined || value === null ? '' : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportCsvWithBom({
  fileName,
  headers,
  rows,
}: {
  fileName: string;
  headers: { key: string; label: string }[];
  rows: Record<string, unknown>[];
}): void {
  const lines = [
    headers.map((h) => escapeCsvCell(h.label)).join(','),
    ...rows.map((r) => headers.map((h) => escapeCsvCell(r[h.key])).join(',')),
  ];
  const csvContent = `\uFEFF${lines.join('\r\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  triggerBlobDownload(blob, fileName.endsWith('.csv') ? fileName : `${fileName}.csv`);
}

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export interface ImportedCouncilorRow {
  rowNumber: number;
  fullName: string;
  email: string;
  roleLabel: RoleLabel;
  commissionId: string;
  affiliationType: AffiliationType;
  affiliationName: string;
  phone: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ImportCouncilorParseResult {
  rows: ImportedCouncilorRow[];
  headerErrors: string[];
  totalRows: number;
}

function pickField(row: Record<string, unknown>, aliases: string[]): string {
  const keys = Object.keys(row);
  for (const alias of aliases) {
    const matchedKey = keys.find(
      (k) =>
        k
          .trim()
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') === alias
    );
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
      return String(row[matchedKey]).trim();
    }
  }
  return '';
}

export async function parseCouncilorImportFile(
  file: File,
  commissions: Commission[],
  existingEmails: string[] = []
): Promise<ImportCouncilorParseResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) {
    return { rows: [], headerErrors: ['El archivo no contiene hojas válidas.'], totalRows: 0 };
  }
  const sheet = wb.Sheets[firstSheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  if (!rawRows.length) {
    return {
      rows: [],
      headerErrors: ['La hoja está vacía. Incluye al menos una fila con Nombre y Correo.'],
      totalRows: 0,
    };
  }

  const normalizedHeaders = new Set(
    Object.keys(rawRows[0]).map((k) =>
      k
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
    )
  );

  const headerErrors: string[] = [];
  const hasNameHeader = ['nombre', 'nombre completo', 'fullname', 'consejero'].some((h) =>
    normalizedHeaders.has(h)
  );
  const hasEmailHeader = ['correo', 'email', 'correo electronico'].some((h) =>
    normalizedHeaders.has(h)
  );
  if (!hasNameHeader) {
    headerErrors.push('Falta la columna obligatoria "Nombre".');
  }
  if (!hasEmailHeader) {
    headerErrors.push('Falta la columna obligatoria "Correo".');
  }

  const existingSet = new Set(existingEmails.map((e) => e.trim().toLowerCase()));
  const seenEmailsInFile = new Set<string>();

  const rows: ImportedCouncilorRow[] = rawRows.slice(0, 100).map((r, idx) => {
    const rowNumber = idx + 2;
    const errors: string[] = [];
    const warnings: string[] = [];

    const fullName = pickField(r, ['nombre', 'nombre completo', 'fullname', 'consejero']);
    const email = pickField(r, ['correo', 'email', 'correo electronico']).toLowerCase();
    const rawRole = pickField(r, ['cargo', 'rol', 'role']);
    const rawComm = pickField(r, ['comision', 'commission']).toLowerCase();
    const rawAff = pickField(r, ['filiacion', 'tipo', 'afiliacion']).toLowerCase();
    const affiliationName = pickField(r, ['organizacion', 'partido', 'fundacion', 'colectivo']);
    const phone = pickField(r, ['telefono', 'celular', 'whatsapp']);

    if (!fullName || fullName.length < 2) {
      errors.push('Falta el nombre completo (mín. 2 caracteres)');
    }

    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!email) {
      errors.push('Falta el correo electrónico');
    } else if (!validEmail) {
      errors.push('Formato de correo inválido');
    } else if (seenEmailsInFile.has(email)) {
      errors.push('Correo duplicado dentro del mismo archivo');
    } else {
      seenEmailsInFile.add(email);
      if (existingSet.has(email)) {
        warnings.push('Correo ya registrado (se actualizará)');
      }
    }

    const normalizedRole = rawRole
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    let roleLabel: RoleLabel = 'Consejero';
    if (normalizedRole === 'presidente') roleLabel = 'Presidente';
    else if (normalizedRole === 'vicepresidente') roleLabel = 'Vicepresidente';
    else if (normalizedRole === 'secretario') roleLabel = 'Secretario';
    else if (rawRole && normalizedRole !== 'consejero') {
      warnings.push(`Cargo "${rawRole}" ajustado a Consejero`);
    }

    let commissionId = '';
    if (rawComm && !rawComm.includes('sin comisi') && rawComm !== 'ninguna' && rawComm !== '—') {
      const matched = commissions.find(
        (c) =>
          c.id.toLowerCase() === rawComm ||
          c.name.toLowerCase().includes(rawComm) ||
          rawComm.includes(String(c.number))
      );
      if (matched) {
        commissionId = matched.id;
      } else {
        warnings.push(`Comisión "${rawComm}" no reconocida (quedará sin comisión)`);
      }
    }

    const affiliationType: AffiliationType = rawAff.includes('partido')
      ? 'partido'
      : rawAff.includes('fundac') || rawAff.includes('org')
      ? 'fundacion'
      : rawAff.includes('independ')
      ? 'independiente'
      : '';

    return {
      rowNumber,
      fullName: fullName || 'Sin nombre',
      email,
      roleLabel,
      commissionId,
      affiliationType,
      affiliationName,
      phone,
      valid: errors.length === 0 && headerErrors.length === 0,
      errors,
      warnings,
    };
  });

  return { rows, headerErrors, totalRows: rawRows.length };
}
