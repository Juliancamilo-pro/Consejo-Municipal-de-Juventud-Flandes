import { AttendanceRecord, CommitmentItem } from '../types/models';

export async function exportAttendancePdf(rows: AttendanceRecord[]): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text('CMJ Flandes, Tolima · Reporte de Asistencia (2026-2029)', 14, 18);
  doc.setFontSize(9);
  doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, 14, 25);

  autoTable(doc, {
    startY: 30,
    head: [['Consejero', 'Sesión ID', 'Estado', 'Observaciones']],
    body: rows.map((r) => [r.userName, r.sessionId, r.status, r.notes || '—']),
  });

  doc.save('cmj-flandes-asistencia.pdf');
}

export async function exportAttendanceExcel(rows: AttendanceRecord[]): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Asistencia CMJ');
  sheet.columns = [
    { header: 'Consejero', key: 'userName', width: 28 },
    { header: 'Sesión ID', key: 'sessionId', width: 24 },
    { header: 'Estado', key: 'status', width: 16 },
    { header: 'Observaciones', key: 'notes', width: 36 },
  ];
  rows.forEach((r) =>
    sheet.addRow({
      userName: r.userName,
      sessionId: r.sessionId,
      status: r.status,
      notes: r.notes || '',
    }),
  );

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cmj-flandes-asistencia.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportCommitmentsPdf(rows: CommitmentItem[]): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text('CMJ Flandes, Tolima · Reporte de Compromisos (2026-2029)', 14, 18);
  doc.setFontSize(9);
  doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, 14, 25);

  autoTable(doc, {
    startY: 30,
    head: [['Compromiso', 'Responsable', 'Fecha límite', 'Avance', 'Estado']],
    body: rows.map((c) => [
      c.title,
      c.assigneeName,
      c.dueDate,
      `${c.progressPercent}%`,
      c.status,
    ]),
  });

  doc.save('cmj-flandes-compromisos.pdf');
}

export async function exportCommitmentsExcel(rows: CommitmentItem[]): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Compromisos CMJ');
  sheet.columns = [
    { header: 'Compromiso', key: 'title', width: 32 },
    { header: 'Responsable', key: 'assigneeName', width: 24 },
    { header: 'Fecha límite', key: 'dueDate', width: 16 },
    { header: 'Avance (%)', key: 'progressPercent', width: 14 },
    { header: 'Estado', key: 'status', width: 16 },
  ];
  rows.forEach((c) =>
    sheet.addRow({
      title: c.title,
      assigneeName: c.assigneeName,
      dueDate: c.dueDate,
      progressPercent: c.progressPercent,
      status: c.status,
    }),
  );

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cmj-flandes-compromisos.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
