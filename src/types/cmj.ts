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
export type VoteMode = 'nominal' | 'secreto' | 'mano_alzada';
export type MajorityType = 'simple' | 'absoluta' | 'dos_tercios' | 'unanimidad';
export type ActaStatus = 'borrador' | 'revision' | 'aprobada' | 'firmada' | 'archivada';
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
  email?: string;
  phone?: string;
  bio?: string;
  photoUrl?: string;
  photoThumbUrl?: string;
  photoMediumUrl?: string;
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

export interface GalleryAlbum {
  id: string;
  title: string;
  description?: string;
  commissionId: string;
  eventDate?: string;
  coverUrl?: string;
  authorUid: string;
  status: 'publicado' | 'archivado';
  sortOrder?: number;
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
  albumId?: string;
  sortOrder?: number;
  eventDate?: string;
  mimeType?: string;
  authorUid: string;
  authorName: string;
  status: 'publicado' | 'archivado';
  createdAt?: unknown;
}

export interface DocumentVersionEntry {
  version: string;
  fileUrl: string;
  storagePath?: string;
  fileName: string;
  mimeType: string;
  fileSize?: number;
  uploadedByUid: string;
  uploadedByName: string;
  uploadedAt: string;
  notes?: string;
}

export interface PortalDocument {
  id: string;
  title: string;
  folder?: string;
  category: string;
  version: string;
  versionHistory?: DocumentVersionEntry[];
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

export interface SessionExcuse {
  reason: string;
  attachmentUrl?: string;
  attachmentName?: string;
  submittedAt: string;
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
  excuses?: Record<string, SessionExcuse>;
  checkInCode?: string;
  checkInExpiresAt?: string;
  qrRotatedAt?: string;
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
  sessionId?: string;
  voteMode?: VoteMode;
  majorityType?: MajorityType;
  options: string[];
  tallies?: Record<string, number>;
  nominalBallots?: Record<string, string>;
  voterUids: string[];
  quorumRequired?: number;
  opensAt?: string;
  closesAt?: string;
  status: 'abierta' | 'cerrada';
  resultSummary?: string;
  deadline?: string;
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ActaSignature {
  uid: string;
  name: string;
  roleLabel: RoleLabel;
  signedAt: string;
  hash: string;
}

export interface ActaComment {
  id: string;
  authorUid: string;
  authorName: string;
  authorRoleLabel: RoleLabel;
  body: string;
  createdAt: string;
}

export interface ActaHistoryEntry {
  at: string;
  actorName: string;
  action: string;
}

export interface PortalActa {
  id: string;
  consecutive: string;
  year: number;
  title: string;
  sessionId?: string;
  commissionId?: string;
  location: string;
  meetingDate: string;
  timeRange?: string;
  quorumCount: number;
  quorumRequired: number;
  agenda: string;
  development: string;
  propositions: string;
  commitmentsSummary: string;
  linkedVoteIds: string[];
  status: ActaStatus;
  authorUid: string;
  authorName: string;
  signatures: ActaSignature[];
  comments: ActaComment[];
  history: ActaHistoryEntry[];
  verificationHash?: string;
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
  | 'actas'
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
