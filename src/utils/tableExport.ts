export interface ExportColumnDef<T> {
  header: string;
  getValue: (row: T) => string | number;
}

export function exportRowsToCsv<T>(
  fileName: string,
  columns: ExportColumnDef<T>[],
  rows: T[],
) {
  const headers = columns.map((c) => `"${c.header.replace(/"/g, '""')}"`).join(',');
  const lines = rows.map((row) =>
    columns
      .map((c) => `"${String(c.getValue(row)).replace(/"/g, '""')}"`)
      .join(','),
  );
  const blob = new Blob([`\uFEFF${[headers, ...lines].join('\n')}`], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportRowsToXlsx<T>(
  fileName: string,
  columns: ExportColumnDef<T>[],
  rows: T[],
  sheetTitle = 'Datos CMJ Flandes',
) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetTitle.slice(0, 31));
  sheet.addRow(columns.map((c) => c.header));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) {
    sheet.addRow(columns.map((c) => c.getValue(row)));
  }
  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportRowsToPdf<T>(
  fileName: string,
  columns: ExportColumnDef<T>[],
  rows: T[],
  title = 'Reporte Institucional — CMJ Flandes, Tolima',
) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ orientation: columns.length > 5 ? 'landscape' : 'portrait' });
  doc.setFontSize(13);
  doc.setTextColor(123, 24, 50);
  doc.text(title, 14, 16);

  doc.setFontSize(9);
  doc.setTextColor(87, 83, 78);
  const generated = new Date().toLocaleString('es-CO');
  doc.text(`Generado el ${generated} · ${rows.length} registros`, 14, 22);

  autoTable(doc, {
    startY: 27,
    head: [columns.map((c) => c.header)],
    body: rows.map((row) => columns.map((c) => String(c.getValue(row)))),
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      textColor: [28, 25, 23],
    },
    headStyles: {
      fillColor: [123, 24, 50],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [250, 250, 248],
    },
  });

  doc.save(`${fileName}.pdf`);
}
