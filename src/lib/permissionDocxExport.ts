import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import { CMJ_LOGO_SRC } from '../components/BrandLogo';
import type { PermissionApprovalStep, PermissionRequest } from '../types/cmj';

export interface PermissionDocxInput {
  request: PermissionRequest;
  applicantPosition?: string;
  applicantCommission?: string;
  steps?: PermissionApprovalStep[];
  effectiveStatusLabel?: string;
}

function formatDocDate(value: unknown): string {
  if (!value) {
    return new Date().toLocaleString('es-CO', {
      dateStyle: 'long',
      timeStyle: 'short',
    });
  }
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('es-CO', {
    dateStyle: 'long',
    timeStyle: 'short',
  });
}

async function fetchLogoBytes(): Promise<{ bytes: Uint8Array; type: 'jpg' | 'png' } | null> {
  try {
    const res = await fetch(CMJ_LOGO_SRC);
    if (!res.ok) return null;
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const buf = await res.arrayBuffer();
    if (!buf.byteLength) return null;
    const type: 'jpg' | 'png' = contentType.includes('png') ? 'png' : 'jpg';
    return { bytes: new Uint8Array(buf), type };
  } catch {
    return null;
  }
}

function infoRow(label: string, value: string): TableRow {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: 32, type: WidthType.PERCENTAGE },
        shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
          left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
          right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: label,
                bold: true,
                size: 20,
                color: '0F172A',
                font: 'Calibri',
              }),
            ],
          }),
        ],
      }),
      new TableCell({
        width: { size: 68, type: WidthType.PERCENTAGE },
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
          left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
          right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: value || '—',
                size: 20,
                color: '1E293B',
                font: 'Calibri',
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

function sectionTitle(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 100 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '047857' },
    },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 22,
        color: '047857',
        font: 'Calibri',
      }),
    ],
  });
}

export async function downloadPermissionRequestDocx(input: PermissionDocxInput): Promise<void> {
  const { request, applicantPosition, applicantCommission, steps = [], effectiveStatusLabel } = input;
  const logo = await fetchLogoBytes();

  const durationText =
    request.durationType === 'permanente'
      ? 'Permanente (sujeto a revocación)'
      : `Temporal hasta ${formatDocDate(request.expiresAt)}`;

  const headerChildren: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        ...(logo
          ? [
              new ImageRun({
                type: logo.type,
                data: logo.bytes,
                transformation: { width: 46, height: 46 },
              }),
              new TextRun({ text: '   ' }),
            ]
          : []),
        new TextRun({
          text: 'CONSEJO MUNICIPAL DE JUVENTUDES DE FLANDES, TOLIMA',
          bold: true,
          size: 20,
          color: '047857',
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1' },
      },
      children: [
        new TextRun({
          text: 'Formato Institucional de Solicitud de Permiso Especial · Ley 1622 de 2013 / Ley 1885 de 2018',
          size: 16,
          color: '64748B',
          font: 'Calibri',
        }),
      ],
    }),
  ];

  const footerChildren: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: {
        top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
      },
      spacing: { before: 80 },
      children: [
        new TextRun({
          text: 'Consejo Municipal de Juventudes de Flandes, Tolima · Documento Oficial · Página ',
          size: 16,
          color: '64748B',
          font: 'Calibri',
        }),
        new TextRun({
          children: [PageNumber.CURRENT],
          size: 16,
          bold: true,
          color: '334155',
          font: 'Calibri',
        }),
        new TextRun({
          text: ' de ',
          size: 16,
          color: '64748B',
          font: 'Calibri',
        }),
        new TextRun({
          children: [PageNumber.TOTAL_PAGES],
          size: 16,
          bold: true,
          color: '334155',
          font: 'Calibri',
        }),
      ],
    }),
  ];

  const stepSummaryLines = steps
    .slice()
    .sort((a, b) => a.stepOrder - b.stepOrder)
    .map((s) => {
      const state =
        s.status === 'aprobado'
          ? 'Aprobado'
          : s.status === 'rechazado'
          ? 'Rechazado'
          : s.status === 'omitido'
          ? 'Omitido'
          : 'Pendiente';
      const actor = s.decidedByName || s.expectedApproverName || s.approverRole;
      return `${s.stepOrder}. ${s.approverRole} (${actor}): ${state}${s.comment ? ` — "${s.comment}"` : ''}`;
    });

  const bodyChildren: Array<Paragraph | Table> = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 60 },
      children: [
        new TextRun({
          text: 'SOLICITUD DE PERMISO ESPECIAL',
          bold: true,
          size: 30,
          color: '0F172A',
          font: 'Calibri',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 220 },
      children: [
        new TextRun({
          text: `Radicado N.° ${request.id}   |   Fecha y hora: ${formatDocDate(request.createdAt)}`,
          size: 19,
          color: '475569',
          font: 'Calibri',
        }),
      ],
    }),

    sectionTitle('1. Datos del solicitante'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        infoRow('Nombre completo', request.requesterName),
        infoRow('Cargo / Posición declarada', applicantPosition || request.requesterRoleLabel),
        infoRow('Rol actual en el portal', request.requesterRoleLabel),
        infoRow(
          'Comisión asignada',
          applicantCommission || request.targetCommissionName || 'Sin comisión asignada'
        ),
        infoRow('Correo electrónico', request.requesterEmail),
      ],
    }),

    sectionTitle('2. Detalle del permiso solicitado'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        infoRow('Permiso solicitado', `${request.permissionLabel} (${request.permissionKey})`),
        infoRow('Módulo del portal', request.targetModule),
        infoRow(
          'Alcance / Comisión específica',
          request.targetCommissionName || 'Alcance general del módulo'
        ),
        infoRow('Duración solicitada', durationText),
        infoRow('Estado actual del trámite', effectiveStatusLabel || request.status),
      ],
    }),

    sectionTitle('3. Finalidad concreta'),
    new Paragraph({
      spacing: { before: 60, after: 120 },
      children: [
        new TextRun({
          text: request.purpose || 'No especificada.',
          size: 21,
          color: '1E293B',
          font: 'Calibri',
        }),
      ],
    }),

    sectionTitle('4. Justificación detallada'),
    new Paragraph({
      spacing: { before: 60, after: 140 },
      alignment: AlignmentType.JUSTIFIED,
      children: [
        new TextRun({
          text: request.reason || 'Sin justificación registrada.',
          size: 21,
          color: '1E293B',
          font: 'Calibri',
        }),
      ],
    }),
  ];

  if (stepSummaryLines.length > 0) {
    bodyChildren.push(sectionTitle('5. Trazabilidad de aprobación en plataforma'));
    for (const line of stepSummaryLines) {
      bodyChildren.push(
        new Paragraph({
          spacing: { before: 40, after: 40 },
          children: [
            new TextRun({
              text: `• ${line}`,
              size: 19,
              color: '334155',
              font: 'Calibri',
            }),
          ],
        })
      );
    }
  }

  bodyChildren.push(
    sectionTitle(stepSummaryLines.length > 0 ? '6. Espacios para firmas y validación institucional' : '5. Espacios para firmas y validación institucional'),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: { top: 220, bottom: 140, left: 160, right: 160 },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
              },
              children: [
                new Paragraph({
                  spacing: { before: 280, after: 40 },
                  children: [
                    new TextRun({
                      text: '________________________________________',
                      size: 18,
                      color: '475569',
                      font: 'Calibri',
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Firma del/la Solicitante',
                      bold: true,
                      size: 19,
                      color: '0F172A',
                      font: 'Calibri',
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${request.requesterName} · ${request.requesterRoleLabel}`,
                      size: 17,
                      color: '64748B',
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              margins: { top: 220, bottom: 140, left: 160, right: 160 },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
              },
              children: [
                new Paragraph({
                  spacing: { before: 280, after: 40 },
                  children: [
                    new TextRun({
                      text: '________________________________________',
                      size: 18,
                      color: '475569',
                      font: 'Calibri',
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Vo. Bo. Coordinador/a de Comisión',
                      bold: true,
                      size: 19,
                      color: '0F172A',
                      font: 'Calibri',
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: request.targetCommissionName || 'Comisión competente (si aplica)',
                      size: 17,
                      color: '64748B',
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 2,
              margins: { top: 180, bottom: 160, left: 160, right: 160 },
              shading: { fill: 'F8FAFC', type: ShadingType.CLEAR },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                left: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
                right: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
              },
              children: [
                new Paragraph({
                  spacing: { after: 100 },
                  children: [
                    new TextRun({
                      text: 'DECISIÓN DE MESA DIRECTIVA (Presidencia · Vicepresidencia · Secretaría):',
                      bold: true,
                      size: 19,
                      color: '0F172A',
                      font: 'Calibri',
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { after: 100 },
                  children: [
                    new TextRun({
                      text: '[  ] APROBADO     [  ] RECHAZADO',
                      bold: true,
                      size: 20,
                      color: '047857',
                      font: 'Calibri',
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { after: 160 },
                  children: [
                    new TextRun({
                      text: 'Observaciones: ____________________________________________________________________________',
                      size: 18,
                      color: '475569',
                      font: 'Calibri',
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 160 },
                  children: [
                    new TextRun({
                      text: '_______________________       _______________________       _______________________',
                      size: 17,
                      color: '475569',
                      font: 'Calibri',
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: '          Presidencia                             Vicepresidencia                            Secretaría',
                      size: 16,
                      bold: true,
                      color: '334155',
                      font: 'Calibri',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1400, bottom: 1100, left: 1100, right: 1100 },
          },
        },
        headers: {
          default: new Header({ children: headerChildren }),
        },
        footers: {
          default: new Footer({ children: footerChildren }),
        },
        children: bodyChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const safeId = (request.id || 'solicitud').replace(/[^A-Za-z0-9_-]/g, '_');
  anchor.href = url;
  anchor.download = `Solicitud_Permiso_Especial_${safeId}.docx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
