export type RoleLabel =
  | 'Presidente'
  | 'Vicepresidente'
  | 'Secretario'
  | 'Consejero Departamental'
  | 'Consejero';

// Nivel técnico interno de permisos — nunca visible en la interfaz
export type AccessTier =
  | 'tier_1_pres'
  | 'tier_2_vp'
  | 'tier_3_sec'
  | 'tier_5_dept'
  | 'tier_4_member';

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
  verificado?: boolean;
  verificadoAt?: string;
  cargoDeclarado?: string;
  coordDeclaradaPendiente?: boolean;
  coordDeclaradaComisionId?: string;
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
  verificado?: boolean;
  verificadoAt?: string;
  cargoDeclarado?: string;
  coordDeclaradaPendiente?: boolean;
  coordDeclaradaComisionId?: string;
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
  | 'portal_editor'
  | 'permisos'
  | 'departamental';

export type PermissionKey =
  // Usuarios y Mesa
  | 'usuarios.ver'
  | 'usuarios.crear'
  | 'usuarios.editar'
  | 'usuarios.desactivar'
  | 'usuarios.eliminar'
  | 'usuarios.asignar_presidencia'
  | 'usuarios.credenciales_rotar'
  | 'usuarios.purgar_ejemplos'
  // Comisiones
  | 'comision.ver_todas'
  | 'comision.coordinador_asignar'
  | 'comision.editar_todas'
  | 'comision.editar_propia'
  | 'comision.miembros_gestionar'
  | 'comision.tareas_gestionar'
  | 'comision.reportes_exportar'
  // Sesiones
  | 'sesiones.ver'
  | 'sesiones.crear'
  | 'sesiones.editar'
  | 'sesiones.asistencia_gestionar'
  | 'sesiones.autoregistro'
  | 'sesiones.eliminar'
  | 'sesiones.exportar'
  | 'sesiones.proponer_agenda'
  // Actas
  | 'actas.ver'
  | 'actas.crear'
  | 'actas.editar'
  | 'actas.comentar'
  | 'actas.firmar'
  | 'actas.aprobar'
  | 'actas.eliminar'
  | 'actas.exportar'
  // Votaciones y Compromisos
  | 'votaciones.ver'
  | 'votaciones.crear'
  | 'votaciones.editar'
  | 'votaciones.cerrar'
  | 'votaciones.eliminar'
  | 'votaciones.votar'
  | 'compromisos.ver'
  | 'compromisos.crear'
  | 'compromisos.editar_todos'
  | 'compromisos.actualizar_propio'
  | 'compromisos.eliminar'
  | 'compromisos.exportar'
  // Documentos
  | 'documentos.ver'
  | 'documentos.subir'
  | 'documentos.editar'
  | 'documentos.aprobar'
  | 'documentos.eliminar'
  | 'documentos.exportar'
  // Planillas
  | 'planillas.ver'
  | 'planillas.importar'
  | 'planillas.exportar'
  // Portal, Noticias y Galería
  | 'portal.editar'
  | 'noticias.crear'
  | 'noticias.proponer'
  | 'noticias.publicar'
  | 'noticias.eliminar'
  | 'galeria.gestionar'
  | 'galeria.subir_propia'
  // Encuestas, Buzón e Ideas
  | 'encuestas.ver'
  | 'encuestas.crear'
  | 'encuestas.ver_respuestas'
  | 'encuestas.exportar'
  | 'buzon.ver'
  | 'buzon.responder'
  | 'ideas.crear'
  | 'ideas.votar'
  | 'ideas.moderar'
  // Plan de trabajo y Plantillas
  | 'plan_trabajo.ver'
  | 'plan_trabajo.crear'
  | 'plan_trabajo.editar'
  | 'plan_trabajo.eliminar'
  | 'plantillas.ver'
  | 'plantillas.gestionar'
  // Auditoría y Permisos Especiales
  | 'auditoria.ver'
  | 'auditoria.exportar'
  | 'permisos.solicitar'
  | 'permisos.aprobar_presidencia'
  | 'permisos.aprobar_vicepresidencia'
  | 'permisos.aprobar_secretaria'
  | 'permisos.delegar'
  | 'permisos.revocar'
  | 'permisos.exportar'
  // Gestión Departamental (Ley 1622 / Ley 1885)
  | 'departamental.ver'
  | 'departamental.propuestas_crear'
  | 'departamental.veeduria_gestionar'
  | 'departamental.informes_gestionar'
  | 'departamental.publicacion_aprobar';

export type PermissionRiskLevel = 'bajo' | 'medio' | 'alto';

export type PermissionDurationType = 'temporal' | 'permanente';

export type PermissionRequestStatus =
  | 'pendiente_presidente'
  | 'pendiente_vicepresidente'
  | 'pendiente_secretario'
  | 'aprobada'
  | 'rechazada'
  | 'cancelada';

export type ApprovalStepRole = 'Presidente' | 'Vicepresidente' | 'Secretario';

export type ApprovalStepStatus = 'pendiente' | 'aprobado' | 'rechazado' | 'omitido';

export interface PermissionRequest {
  id: string;
  requesterUid: string;
  requesterName: string;
  requesterEmail: string;
  requesterRoleLabel: RoleLabel;
  permissionKey: PermissionKey;
  permissionLabel: string;
  targetModule: string;
  targetCommissionId?: string;
  targetCommissionName?: string;
  reason: string;
  purpose: string;
  durationType: PermissionDurationType;
  expiresAt?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  status: PermissionRequestStatus;
  currentStepOrder: number;
  rejectionReason?: string;
  decidedByName?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PermissionApprovalStep {
  id: string;
  requestId: string;
  stepOrder: number;
  approverRole: ApprovalStepRole;
  expectedApproverUid?: string;
  expectedApproverName?: string;
  delegatedFromUid?: string;
  delegatedReason?: string;
  status: ApprovalStepStatus;
  decidedByUid?: string;
  decidedByName?: string;
  comment?: string;
  reminderSentAt?: string;
  decidedAt?: string;
  createdAt?: unknown;
}

export interface GrantedPermission {
  id: string;
  requestId: string;
  userUid: string;
  userName: string;
  userEmail: string;
  permissionKey: PermissionKey;
  permissionLabel: string;
  targetModule: string;
  targetCommissionId?: string;
  durationType: PermissionDurationType;
  expiresAt?: string;
  active: boolean;
  revokedAt?: string;
  revokedByUid?: string;
  revokedByName?: string;
  revocationReason?: string;
  grantedAt?: unknown;
}

export interface PortalNotification {
  id: string;
  userUid: string;
  type:
    | 'permiso_solicitado'
    | 'permiso_turno'
    | 'permiso_aprobado'
    | 'permiso_rechazado'
    | 'permiso_revocado'
    | 'permiso_recordatorio_48h'
    | 'comision_coordinador'
    | 'agenda_propuesta'
    | 'departamental_publicacion'
    | 'general';
  title: string;
  message: string;
  linkModule?: PrivateModule;
  relatedId?: string;
  read: boolean;
  createdAt?: unknown;
}

export interface AuditComparisonRow {
  module: string;
  action: string;
  currentState: string;
  proposedPresidente: string;
  proposedVicepresidente: string;
  proposedSecretario: string;
  proposedConsejeroDepartamental: string;
  proposedConsejero: string;
  proposedCoordinador: string;
  specialRequestable: boolean;
  permissionKey: PermissionKey;
}

export type DeptPublicationStatus =
  | 'privado'
  | 'pendiente_presidencia'
  | 'publicado'
  | 'rechazado';

export interface DeptProposal {
  id: string;
  title: string;
  targetEntity: string;
  thematicAxis: string;
  commissionId?: string;
  summary: string;
  justification: string;
  status: 'borrador' | 'radicada' | 'en_concertacion' | 'aprobada' | 'archivada';
  visibility: 'privado' | 'publico';
  publicationStatus: DeptPublicationStatus;
  publicApproved: boolean;
  rejectionReason?: string;
  approvedByUid?: string;
  approvedByName?: string;
  approvedAt?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  authorUid: string;
  authorName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DeptOversightRecord {
  id: string;
  title: string;
  watchedEntity: string;
  policyOrPlan: string;
  commissionId?: string;
  findings: string;
  recommendations: string;
  riskLevel: 'bajo' | 'medio' | 'alto';
  status: 'en_seguimiento' | 'alerta' | 'subsanada' | 'cerrada';
  visibility: 'privado' | 'publico';
  publicationStatus: DeptPublicationStatus;
  publicApproved: boolean;
  rejectionReason?: string;
  approvedByUid?: string;
  approvedByName?: string;
  approvedAt?: string;
  evidenceUrl?: string;
  evidenceName?: string;
  authorUid: string;
  authorName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DeptInterlocutionReport {
  id: string;
  title: string;
  reportPeriod: string;
  sessionDate: string;
  departamentalSpace: string;
  commissionId?: string;
  summary: string;
  agreements: string;
  participationStrategies: string;
  visibility: 'privado' | 'publico';
  publicationStatus: DeptPublicationStatus;
  publicApproved: boolean;
  rejectionReason?: string;
  approvedByUid?: string;
  approvedByName?: string;
  approvedAt?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  authorUid: string;
  authorName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SessionAgendaProposal {
  id: string;
  sessionId: string;
  title: string;
  justification: string;
  proposerUid: string;
  proposerName: string;
  proposerRoleLabel: RoleLabel;
  status: 'pendiente' | 'aprobada' | 'rechazada';
  decisionNotes?: string;
  decidedByUid?: string;
  decidedByName?: string;
  decidedAt?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PublicDepartamentalBundle {
  proposals: Omit<DeptProposal, 'authorUid'>[];
  oversight: Omit<DeptOversightRecord, 'authorUid'>[];
  reports: Omit<DeptInterlocutionReport, 'authorUid'>[];
}


