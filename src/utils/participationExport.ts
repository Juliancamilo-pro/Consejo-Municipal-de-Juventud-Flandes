import { CallRegistration, PollQuestion, PublicPoll } from '../types/participation';

export function getEffectivePollQuestions(poll: PublicPoll): PollQuestion[] {
  if (Array.isArray(poll.questions) && poll.questions.length > 0) {
    return poll.questions;
  }
  return [
    {
      id: 'q_main',
      prompt: poll.title,
      type: 'single_choice',
      required: true,
      options: poll.options || [],
    },
  ];
}

export function getPollTotalResponses(poll: PublicPoll): number {
  if (typeof poll.responseCount === 'number' && poll.responseCount > 0) {
    return poll.responseCount;
  }
  const questions = getEffectivePollQuestions(poll);
  const first = questions[0];
  if (!first) return 0;
  return first.options.reduce((sum, o) => sum + (o.votes || 0), 0);
}

export function buildPollShareUrl(pollId: string): string {
  if (typeof window === 'undefined') return `/participacion?encuesta=${pollId}`;
  return `${window.location.origin}/participacion?encuesta=${encodeURIComponent(pollId)}`;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportPollResultsCsv(poll: PublicPoll): void {
  const questions = getEffectivePollQuestions(poll);
  const rows: string[] = ['Pregunta,Tipo,Opción o Respuesta,Votos,Porcentaje'];
  for (const q of questions) {
    const total = q.options.reduce((s, o) => s + (o.votes || 0), 0);
    for (const opt of q.options) {
      const pct = total > 0 ? Math.round(((opt.votes || 0) / total) * 100) : 0;
      rows.push(
        [q.prompt, q.type, opt.label, String(opt.votes || 0), `${pct}%`]
          .map((c) => `"${c.replace(/"/g, '""')}"`)
          .join(','),
      );
    }
    for (const txt of q.textResponses || []) {
      rows.push(
        [q.prompt, 'texto_abierto', txt, '1', '—']
          .map((c) => `"${c.replace(/"/g, '""')}"`)
          .join(','),
      );
    }
  }
  downloadBlob(
    new Blob([`\uFEFF${rows.join('\n')}`], { type: 'text/csv;charset=utf-8;' }),
    `encuesta-${poll.id.slice(0, 12)}.csv`,
  );
}

export async function exportPollResultsExcel(poll: PublicPoll): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Resultados');
  ws.addRow(['Encuesta CMJ Flandes', poll.title]);
  ws.addRow(['Estado', poll.status, 'Participaciones', getPollTotalResponses(poll)]);
  ws.addRow([]);
  ws.addRow(['Pregunta', 'Tipo', 'Opción / Respuesta', 'Votos', 'Porcentaje']);

  for (const q of getEffectivePollQuestions(poll)) {
    const total = q.options.reduce((s, o) => s + (o.votes || 0), 0);
    for (const opt of q.options) {
      const pct = total > 0 ? Math.round(((opt.votes || 0) / total) * 100) : 0;
      ws.addRow([q.prompt, q.type, opt.label, opt.votes || 0, `${pct}%`]);
    }
    for (const txt of q.textResponses || []) {
      ws.addRow([q.prompt, 'texto_abierto', txt, 1, '—']);
    }
  }
  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `encuesta-${poll.id.slice(0, 12)}.xlsx`,
  );
}

export async function exportPollResultsPdf(poll: PublicPoll): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF();
  doc.setFillColor(123, 24, 50);
  doc.rect(0, 0, 210, 8, 'F');
  doc.setFontSize(13);
  doc.text('CMJ FLANDES, TOLIMA · REPORTE DE CONSULTA JUVENIL', 14, 18);
  doc.setFontSize(10);
  doc.text(poll.title, 14, 26);
  doc.setFontSize(8.5);
  doc.text(`Estado: ${poll.status.toUpperCase()} · Total participaciones: ${getPollTotalResponses(poll)}`, 14, 32);

  const body: string[][] = [];
  for (const q of getEffectivePollQuestions(poll)) {
    const total = q.options.reduce((s, o) => s + (o.votes || 0), 0);
    for (const opt of q.options) {
      const pct = total > 0 ? Math.round(((opt.votes || 0) / total) * 100) : 0;
      body.push([q.prompt, opt.label, String(opt.votes || 0), `${pct}%`]);
    }
    for (const txt of q.textResponses || []) {
      body.push([q.prompt, `Respuesta abierta: ${txt}`, '1', '—']);
    }
  }

  autoTable(doc, {
    startY: 38,
    head: [['Pregunta', 'Opción / Respuesta', 'Votos', '%']],
    body,
  });
  doc.save(`encuesta-${poll.id.slice(0, 12)}.pdf`);
}

export async function exportRegistrationsPdf(registrations: CallRegistration[]): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF();
  doc.setFillColor(30, 58, 138);
  doc.rect(0, 0, 210, 8, 'F');
  doc.setFontSize(13);
  doc.text('CMJ FLANDES · INSCRIPCIONES A CONVOCATORIAS', 14, 18);
  autoTable(doc, {
    startY: 26,
    head: [['Nombre', 'Convocatoria', 'Edad', 'Barrio / Vereda', 'Correo', 'Teléfono']],
    body: registrations.map((r) => [
      r.fullName,
      r.callTitle,
      String(r.age),
      r.neighborhood,
      r.email,
      r.phone || '—',
    ]),
  });
  doc.save('cmj-flandes-inscritos-convocatorias.pdf');
}
