import { AttendanceRecord, PlenarySession } from '../types/models';

async function buildSessionMinutesPdfDoc(input: {
  session: PlenarySession;
  attendance: AttendanceRecord[];
  activeCounselorsCount: number;
  decisionsSummary?: string;
}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const { session, attendance, activeCounselorsCount, decisionsSummary } = input;
  const sessionAtt = attendance.filter((a) => a.sessionId === session.id);
  const presentCount = sessionAtt.filter((a) => a.status === 'presente').length;
  const totalBase = Math.max(activeCounselorsCount, sessionAtt.length, 1);
  const quorumPct = Math.round((presentCount / totalBase) * 100);
  const quorumAchieved = presentCount >= Math.ceil(totalBase / 2);

  const doc = new jsPDF();
  doc.setFillColor(123, 24, 50);
  doc.rect(0, 0, 210, 8, 'F');

  doc.setFontSize(14);
  doc.text('CONSEJO MUNICIPAL DE JUVENTUD DE FLANDES, TOLIMA', 14, 20);
  doc.setFontSize(11);
  doc.text(`ACTA DE SESIÓN ${session.sessionType.toUpperCase()} · PERIODO 2026–2029`, 14, 27);

  doc.setFontSize(9.5);
  doc.text(`Título: ${session.title}`, 14, 36);
  doc.text(`Fecha y hora: ${session.dateIso} · Lugar: ${session.location}`, 14, 42);
  doc.text(
    `Quórum calculado: ${presentCount} de ${totalBase} consejeros presentes (${quorumPct}%) · ${
      quorumAchieved ? 'QUÓRUM DELIBERATORIO Y DECISORIO VÁLIDO' : 'SIN QUÓRUM PLENO'
    }`,
    14,
    48,
  );

  doc.setFontSize(10.5);
  doc.text('1. Orden del día', 14, 58);
  doc.setFontSize(9);
  const agendaLines = doc.splitTextToSize(session.agenda || 'Sin orden del día.', 182);
  doc.text(agendaLines, 14, 64);

  const afterAgendaY = 66 + agendaLines.length * 4.8;
  doc.setFontSize(10.5);
  doc.text('2. Decisiones y proposiciones registradas', 14, afterAgendaY);
  doc.setFontSize(9);
  const decLines = doc.splitTextToSize(
    decisionsSummary?.trim() || 'Sin observaciones adicionales registradas al cierre del borrador.',
    182,
  );
  doc.text(decLines, 14, afterAgendaY + 6);

  autoTable(doc, {
    startY: afterAgendaY + 10 + decLines.length * 4.8,
    head: [['Consejero', 'Estado', 'Observaciones']],
    body:
      sessionAtt.length > 0
        ? sessionAtt.map((a) => [a.userName, a.status.toUpperCase(), a.notes || '—'])
        : [['Sin registros individuales de asistencia en esta sesión', '—', '—']],
  });

  const safeDate = session.dateIso.replace(/[^0-9A-Za-z_-]/g, '').slice(0, 12) || 'sesion';
  return { doc, fileName: `acta-cmj-flandes-${safeDate}.pdf` };
}

export async function exportSessionMinutesPdf(input: {
  session: PlenarySession;
  attendance: AttendanceRecord[];
  activeCounselorsCount: number;
  decisionsSummary?: string;
}): Promise<void> {
  const { doc, fileName } = await buildSessionMinutesPdfDoc(input);
  doc.save(fileName);
}

export async function generateSessionMinutesBlob(input: {
  session: PlenarySession;
  attendance: AttendanceRecord[];
  activeCounselorsCount: number;
  decisionsSummary?: string;
}): Promise<{ blob: Blob; fileName: string }> {
  const { doc, fileName } = await buildSessionMinutesPdfDoc(input);
  return { blob: doc.output('blob'), fileName };
}
