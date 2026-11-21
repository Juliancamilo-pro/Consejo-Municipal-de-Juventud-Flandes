export type DocumentStatus = 'borrador' | 'revision' | 'aprobada' | 'publicada' | 'archivada';

export type DocumentCategory =
  | 'acta'
  | 'informe'
  | 'resolucion'
  | 'oficio'
  | 'circular'
  | 'convocatoria'
  | 'proposicion'
  | 'plan_accion'
  | 'reglamento'
  | 'presupuesto'
  | 'otro';

export interface InstitutionalDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  description?: string;
  tags?: string[];
  consecutiveNumber?: string;
  year?: number;
  status: DocumentStatus;
  visibility: 'publico' | 'interno';
  commissionId?: string;
  sessionId?: string;
  projectId?: string;
  downloadCount?: number;
  reviewComment?: string;
  reviewedByUid?: string;
  reviewedByName?: string;
  publishedByUid?: string;
  archivedByUid?: string;
  currentVersion: number;
  fileId: string;
  storagePath?: string;
  downloadUrl?: string;
  fileName: string;
  fileMime: string;
  fileSize: number;
  contentSha256?: string;
  authorUid: string;
  authorName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DocumentVersion {
  id: string;
  versionNumber: number;
  fileId: string;
  storagePath?: string;
  downloadUrl?: string;
  fileName: string;
  fileMime: string;
  fileSize: number;
  contentSha256?: string;
  changelog?: string;
  uploadedByUid: string;
  uploadedByName: string;
  createdAt?: unknown;
}

export interface DocumentComment {
  id: string;
  documentId: string;
  authorUid: string;
  authorName: string;
  authorRole?: string;
  comment: string;
  actionType?: 'comentario' | 'aprobacion' | 'devolucion';
  createdAt?: unknown;
}

export interface ElectionItem {
  id: string;
  title: string;
  description: string;
  options: string[];
  status: 'borrador' | 'abierta' | 'cerrada';
  closesAt?: string;
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CommitmentComment {
  id: string;
  authorUid: string;
  authorName: string;
  text: string;
  createdAtIso: string;
}

export interface CommitmentItem {
  id: string;
  title: string;
  description: string;
  commissionId?: string;
  assigneeUid: string;
  assigneeName: string;
  dueDate: string;
  progressPercent: number;
  status: 'pendiente' | 'en_progreso' | 'cumplido' | 'vencido';
  comments?: CommitmentComment[];
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CalendarEventItem {
  id: string;
  title: string;
  description?: string;
  eventType: 'sesion' | 'reunion' | 'actividad';
  startIso: string;
  endIso: string;
  location: string;
  visibility: 'publico' | 'interno';
  reminderNote?: string;
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MailboxHistoryItem {
  action: string;
  actorName: string;
  atIso: string;
}

export interface MailboxEntry {
  id: string;
  trackingCode: string;
  category: 'propuesta' | 'inquietud' | 'denuncia' | 'pqrsd';
  isAnonymous: boolean;
  senderName?: string;
  senderEmail?: string;
  senderNeighborhood?: string;
  subject: string;
  message: string;
  status: 'radicado' | 'en_revision' | 'respondido' | 'archivado';
  officialResponse?: string;
  respondedByUid?: string;
  assignedToUid?: string;
  assignedToName?: string;
  history?: MailboxHistoryItem[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MailboxTrackingPublic {
  trackingCode: string;
  category: 'propuesta' | 'inquietud' | 'denuncia' | 'pqrsd';
  status: 'radicado' | 'en_revision' | 'respondido' | 'archivado';
  officialResponse?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CouncilInfo {
  kind: 'council_info';
  mission: string;
  vision: string;
  address?: string;
  emailPublic?: string;
  schedule?: string;
  updatedAt?: unknown;
}

export interface AuditLogEntry {
  id: string;
  actorUid: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetCollection: string;
  targetId?: string;
  summary: string;
  createdAt?: unknown;
}
