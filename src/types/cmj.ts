export type RoleLabel = 'Presidente' | 'Vicepresidente' | 'Secretario' | 'Consejero';

// Nivel técnico interno de permisos — nunca visible en la interfaz
export type AccessTier = 'tier_1_pres' | 'tier_2_vp' | 'tier_3_sec' | 'tier_4_member';

export type FestiveThemeId =
  | 'default'
  | 'san_pedro'
  | 'independencia'
  | 'semana_juventud'
  | 'amor_amistad'
  | 'navidad';

export type AttendanceStatus = 'presente' | 'tarde' | 'excusa' | 'ausente';
export type VoteMode = 'nominal' | 'secreto';
export type TaskStatus = 'pendiente' | 'en_curso' | 'hecha';
export type AffiliationType = '' | 'partido' | 'fundacion' | 'independiente';

export interface PublicCouncilor {
  id: string;
  uid: string;
  fullName: string;
  roleLabel: RoleLabel;
  commissionId: string;
  commissionName: string;
  affiliationType?: AffiliationType;
  affiliationName?: string;
  bio?: string;
  photoUrl?: string;
  storagePath?: string;
  instagram?: string;
  facebook?: string;
  active: boolean;
  displayOrder?: number;
  updatedAt?: unknown;
}

export interface CouncilorPrivate {
  uid: string;
  email: string;
  phone?: string;
  accessTier: AccessTier;
  roleLabel: RoleLabel;
  commissionId: string;
  active?: boolean;
  mustChangePassword: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AllowedAccount {
  id: string; // emailHash
  active: boolean;
  accessTier: AccessTier;
  roleLabel: RoleLabel;
  commissionId: string;
  affiliationType?: AffiliationType;
  affiliationName?: string;
  accountProvisioned: boolean;
  mustChangePassword: boolean;
  updatedAt?: unknown;
}

export interface Commission {
  id: string;
  number: number;
  name: string;
  iconName?: string;
  accentColor?: string;
  coverUrl?: string;
  storagePath?: string;
  description: string;
  coordinatorName: string;
  coordinatorUid?: string;
  workPlanSummary?: string;
  updatedAt?: unknown;
}

export interface CommissionTask {
  id: string;
  commissionId: string;
  title: string;
  status: TaskStatus;
  assignedName?: string;
  dueDate?: string;
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NewsEvent {
  id: string;
  title: string;
  type: 'noticia' | 'evento';
  summary: string;
  content: string;
  coverUrl?: string;
  storagePath?: string;
  commissionId: string;
  eventDate?: string;
  location?: string;
  authorUid: string;
  authorName: string;
  status: 'borrador' | 'pendiente' | 'publicado';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GalleryItem {
  id: string;
  title: string;
  description?: string;
  mediaType: 'image' | 'video';
  videoSource?: 'upload' | 'youtube' | 'vimeo';
  url: string;
  thumbnailUrl?: string;
  storagePath?: string;
  thumbnailStoragePath?: string;
  commissionId: string;
  authorUid: string;
  authorName: string;
  status: 'publicado' | 'archivado';
  createdAt?: unknown;
}

export interface PortalDocument {
  id: string;
  title: string;
  folder?: string;
  category: string;
  version: string;
  fileUrl: string;
  storagePath?: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
  visibility: 'publico' | 'privado';
  commissionId?: string;
  uploadedByUid: string;
  uploadedByName: string;
  approvedByPresidente: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CallOrSurvey {
  id: string;
  title: string;
  kind: 'convocatoria' | 'encuesta';
  description: string;
  deadline: string;
  status: 'abierta' | 'cerrada';
  options?: string[];
  responseCount: number;
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  selectedOption: string;
  respondentName: string;
  respondentEmail?: string;
  comment?: string;
  createdAt?: unknown;
}

export interface ContactMessage {
  id: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  message: string;
  category?: string;
  status: 'nuevo' | 'en_proceso' | 'respondido';
  createdAt?: unknown;
}

export interface CouncilSession {
  id: string;
  title: string;
  sessionType: string;
  dateIso: string;
  timeRange?: string;
  location: string;
  agenda?: string;
  status: 'programada' | 'en_curso' | 'finalizada';
  actaUrl?: string;
  attendance?: Record<string, AttendanceStatus>;
  checkInCode?: string;
  quorumRequired?: number;
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CouncilVote {
  id: string;
  title: string;
  description: string;
  commissionId?: string;
  voteMode?: VoteMode;
  options: string[];
  tallies?: Record<string, number>;
  nominalBallots?: Record<string, string>;
  voterUids: string[];
  quorumRequired?: number;
  opensAt?: string;
  closesAt?: string;
  status: 'abierta' | 'cerrada';
  deadline?: string;
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Commitment {
  id: string;
  title: string;
  description?: string;
  responsibleUid: string;
  responsibleName: string;
  commissionId: string;
  dueDate?: string;
  status: 'pendiente' | 'en_progreso' | 'cumplido';
  progress: number;
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface IdeaItem {
  id: string;
  title: string;
  description: string;
  category: string;
  commissionId?: string;
  authorUid: string;
  authorName: string;
  status: 'nueva' | 'en_revision' | 'aprobada';
  upvoterUids: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LetterTemplate {
  id: string;
  title: string;
  category: string;
  headerText?: string;
  bodyTemplate: string;
  signatoryRole: string;
  updatedByUid: string;
  updatedAt?: unknown;
}

export interface WorkPlanItem {
  id: string;
  title: string;
  axis: string;
  commissionId: string;
  quarter: string;
  status: 'planeado' | 'ejecucion' | 'completado';
  progress: number;
  evidenceCount?: number;
  updatedByUid: string;
  updatedAt?: unknown;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  action: string;
  module: string;
  targetTitle: string;
  createdAt?: unknown;
}

export interface PortalSettings {
  id: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImageUrl?: string;
  heroStoragePath?: string;
  aboutText?: string;
  missionText?: string;
  visionText?: string;
  contactEmail?: string;
  contactAddress?: string;
  activeTheme: FestiveThemeId;
  updatedAt?: unknown;
}

export type DashboardWidgetId =
  | 'role_panel'
  | 'commitments'
  | 'sessions'
  | 'notifications'
  | 'commissions_activity';

export interface DashboardPreferences {
  order: DashboardWidgetId[];
  hidden: DashboardWidgetId[];
  density: 'comodo' | 'compacto';
}

export type PublicSection =
  | 'inicio'
  | 'quienes_somos'
  | 'consejeros'
  | 'comisiones'
  | 'noticias'
  | 'galeria'
  | 'documentos'
  | 'convocatorias'
  | 'contacto';

export type PrivateModule =
  | 'resumen'
  | 'usuarios'
  | 'comisiones'
  | 'documentos'
  | 'sesiones'
  | 'votaciones'
  | 'planillas'
  | 'encuestas'
  | 'agenda'
  | 'buzon'
  | 'auditoria'
  | 'plantillas'
  | 'plan_trabajo'
  | 'guia'
  | 'portal_editor';
