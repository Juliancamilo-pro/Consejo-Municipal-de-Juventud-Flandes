import {
  AttendanceRecord,
  CommitmentItem,
  InstitutionalDocument,
  PlenarySession,
  ProjectItem,
  UserProfile,
} from '../types/models';

export interface ManagementReportData {
  users: UserProfile[];
  projects: ProjectItem[];
  sessions: PlenarySession[];
  attendance: AttendanceRecord[];
  commitments: CommitmentItem[];
  documents: InstitutionalDocument[];
}

export async function exportFullManagementPdf(data: ManagementReportData): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF();
  doc.setFillColor(123, 24, 50);
  doc.rect(0, 0, 210, 8, 'F');

  doc.setFontSize(14);
  doc.text('INFORME INTEGRAL DE GESTIÓN · CMJ FLANDES, TOLIMA', 14, 20);
  doc.setFontSize(9.5);
  doc.text(`Periodo 2026–2029 · Generado: ${new Date().toLocaleString('es-CO')}`, 14, 27);

  const fulfilled = data.commitments.filter((c) => c.status === 'cumplido').length;
  const avgProj =
    data.projects.length > 0
      ? Math.round(
          data.projects.reduce((acc, p) => acc + p.progressPercent, 0) / data.projects.length,
        )
      : 0;

  autoTable(doc, {
    startY: 34,
    head: [['Indicador institucional', 'Valor real']],
    body: [
      ['Consejeros activos', String(data.users.filter((u) => u.status === 'activo').length)],
      ['Proyectos registrados / avance promedio', `${data.projects.length} (${avgProj}%)`],
      ['Sesiones registradas', String(data.sessions.length)],
      ['Registros de asistencia', String(data.attendance.length)],
      ['Compromisos cumplidos / totales', `${fulfilled} / ${data.commitments.length}`],
      ['Documentos y actas en archivo', String(data.documents.length)],
    ],
  });

  if (data.projects.length > 0) {
    const finalY =
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 100;
    autoTable(doc, {
      startY: finalY + 10,
      head: [['Proyecto', 'Estado', 'Avance']],
      body: data.projects.map((p) => [p.title, p.status, `${p.progressPercent}%`]),
    });
  }

  doc.save('cmj-flandes-informe-gestion.pdf');
}

export async function exportFullManagementExcel(data: ManagementReportData): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();

  const summary = wb.addWorksheet('Resumen Ejecutivo');
  summary.addRow(['Indicador', 'Cantidad / Valor']);
  summary.getRow(1).font = { bold: true };
  summary.addRows([
    ['Consejeros totales', data.users.length],
    ['Proyectos', data.projects.length],
    ['Sesiones', data.sessions.length],
    ['Registros asistencia', data.attendance.length],
    ['Compromisos', data.commitments.length],
    ['Documentos', data.documents.length],
  ]);

  const projSheet = wb.addWorksheet('Proyectos');
  projSheet.addRow(['Título', 'Estado', 'Avance (%)', 'Resumen']);
  projSheet.getRow(1).font = { bold: true };
  data.projects.forEach((p) => projSheet.addRow([p.title, p.status, p.progressPercent, p.summary]));

  const compSheet = wb.addWorksheet('Compromisos');
  compSheet.addRow(['Compromiso', 'Responsable', 'Fecha límite', 'Estado', 'Avance (%)']);
  compSheet.getRow(1).font = { bold: true };
  data.commitments.forEach((c) =>
    compSheet.addRow([c.title, c.assigneeName, c.dueDate, c.status, c.progressPercent]),
  );

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cmj-flandes-informe-gestion.xlsx';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
