export type CertificateType =
  | 'asistencia'
  | 'membresia'
  | 'participacion'
  | 'reconocimiento';

export interface CertificateRecord {
  id: string;
  code: string;
  recipientUid?: string;
  recipientName: string;
  certificateType: CertificateType;
  title: string;
  issuedFor: string;
  issuedAtIso: string;
  issuedByUid: string;
  issuedByName: string;
  status: 'vigente' | 'revocado';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ActionPlanAxis =
  | 'Participación Juvenil'
  | 'Educación y Cultura'
  | 'Ambiente y Ruralidad'
  | 'Deporte y Bienestar'
  | 'Control Social y Veeduría';

export interface AnnualActionPlanItem {
  id: string;
  year: number;
  axis: ActionPlanAxis;
  title: string;
  commissionId?: string;
  goalDescription: string;
  indicator: string;
  targetValue: number;
  executedValue: number;
  status: 'pendiente' | 'en_curso' | 'cumplido';
  responsibleName: string;
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type InitiativeStatus =
  | 'recibida'
  | 'en_evaluacion'
  | 'en_comision'
  | 'aprobada'
  | 'archivada';

export interface YouthInitiative {
  id: string;
  title: string;
  summary: string;
  neighborhood: string;
  thematicArea: string;
  proposerAlias: string;
  status: InitiativeStatus;
  boardResponse?: string;
  assignedCommissionId?: string;
  supportCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SiteAnalyticsRecord {
  id: string;
  route: string;
  dateKey: string;
  count: number;
  updatedAt?: unknown;
}
