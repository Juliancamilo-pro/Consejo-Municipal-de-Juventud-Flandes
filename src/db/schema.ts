import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// Cuentas de acceso interno (contraseña hasheada con scrypt en servidor, cero MFA/2FA)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  phone: text('phone').notNull().default(''),
  accessTier: text('access_tier').notNull().default('tier_4_member'),
  roleLabel: text('role_label').notNull().default('Consejero'),
  commissionId: text('commission_id').notNull().default(''),
  active: boolean('active').notNull().default(true),
  verificado: boolean('verificado').notNull().default(false),
  verificadoAt: text('verificado_at').notNull().default(''),
  cargoDeclarado: text('cargo_declarado').notNull().default(''),
  coordDeclaradaPendiente: boolean('coord_declarada_pendiente').notNull().default(false),
  coordDeclaradaComisionId: text('coord_declarada_comision_id').notNull().default(''),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Directorio de correos autorizados para activar o iniciar sesión
export const allowedAccounts = pgTable('allowed_accounts', {
  emailHash: text('email_hash').primaryKey(),
  email: text('email').notNull().unique(),
  active: boolean('active').notNull().default(true),
  accessTier: text('access_tier').notNull().default('tier_4_member'),
  roleLabel: text('role_label').notNull().default('Consejero'),
  commissionId: text('commission_id').notNull().default(''),
  affiliationType: text('affiliation_type').notNull().default(''),
  affiliationName: text('affiliation_name').notNull().default(''),
  accountProvisioned: boolean('account_provisioned').notNull().default(false),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Configuración de seguridad institucional (hashes salados scrypt/sha256, nunca texto plano)
export const portalSecurity = pgTable('portal_security', {
  id: text('id').primaryKey(),
  inviteCodeHash: text('invite_code_hash').notNull(),
  initialPasswordHash: text('initial_password_hash').notNull(),
  updatedByUid: text('updated_by_uid').notNull().default(''),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Configuración visual y contenido institucional del portal público
export const portalSettings = pgTable('portal_settings', {
  id: text('id').primaryKey(),
  heroTitle: text('hero_title').notNull(),
  heroSubtitle: text('hero_subtitle').notNull(),
  heroImageUrl: text('hero_image_url').notNull().default(''),
  heroStoragePath: text('hero_storage_path').notNull().default(''),
  aboutText: text('about_text').notNull().default(''),
  missionText: text('mission_text').notNull().default(''),
  visionText: text('vision_text').notNull().default(''),
  contactEmail: text('contact_email').notNull().default(''),
  contactAddress: text('contact_address').notNull().default(''),
  activeTheme: text('active_theme').notNull().default('default'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Perfiles públicos de consejeros
export const publicCouncilors = pgTable('public_councilors', {
  id: text('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  fullName: text('full_name').notNull(),
  roleLabel: text('role_label').notNull(),
  commissionId: text('commission_id').notNull().default(''),
  commissionName: text('commission_name').notNull().default('Sin comisión'),
  affiliationType: text('affiliation_type').notNull().default(''),
  affiliationName: text('affiliation_name').notNull().default(''),
  email: text('email').notNull().default(''),
  phone: text('phone').notNull().default(''),
  bio: text('bio').notNull().default(''),
  photoUrl: text('photo_url').notNull().default(''),
  photoThumbUrl: text('photo_thumb_url').notNull().default(''),
  photoMediumUrl: text('photo_medium_url').notNull().default(''),
  storagePath: text('storage_path').notNull().default(''),
  instagram: text('instagram').notNull().default(''),
  facebook: text('facebook').notNull().default(''),
  active: boolean('active').notNull().default(true),
  verificado: boolean('verificado').notNull().default(false),
  verificadoAt: text('verificado_at').notNull().default(''),
  cargoDeclarado: text('cargo_declarado').notNull().default(''),
  coordDeclaradaPendiente: boolean('coord_declarada_pendiente').notNull().default(false),
  coordDeclaradaComisionId: text('coord_declarada_comision_id').notNull().default(''),
  displayOrder: integer('display_order').notNull().default(50),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Las 5 comisiones oficiales del CMJ
export const commissions = pgTable('commissions', {
  id: text('id').primaryKey(),
  number: integer('number').notNull(),
  name: text('name').notNull(),
  iconName: text('icon_name').notNull().default('BookOpen'),
  accentColor: text('accent_color').notNull().default('#2563EB'),
  coverUrl: text('cover_url').notNull().default(''),
  storagePath: text('storage_path').notNull().default(''),
  description: text('description').notNull(),
  coordinatorName: text('coordinator_name').notNull(),
  coordinatorUid: text('coordinator_uid').notNull().default(''),
  workPlanSummary: text('work_plan_summary').notNull().default(''),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const commissionTasks = pgTable('commission_tasks', {
  id: text('id').primaryKey(),
  commissionId: text('commission_id').notNull(),
  title: text('title').notNull(),
  status: text('status').notNull().default('pendiente'),
  assignedName: text('assigned_name').notNull().default(''),
  dueDate: text('due_date').notNull().default(''),
  createdByUid: text('created_by_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const newsEvents = pgTable('news_events', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  type: text('type').notNull().default('noticia'),
  summary: text('summary').notNull(),
  content: text('content').notNull(),
  coverUrl: text('cover_url').notNull().default(''),
  storagePath: text('storage_path').notNull().default(''),
  commissionId: text('commission_id').notNull(),
  eventDate: text('event_date').notNull().default(''),
  location: text('location').notNull().default(''),
  authorUid: text('author_uid').notNull(),
  authorName: text('author_name').notNull(),
  status: text('status').notNull().default('publicado'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const galleryAlbums = pgTable('gallery_albums', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  commissionId: text('commission_id').notNull().default(''),
  eventDate: text('event_date').notNull().default(''),
  coverUrl: text('cover_url').notNull().default(''),
  authorUid: text('author_uid').notNull(),
  status: text('status').notNull().default('publicado'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const galleryItems = pgTable('gallery_items', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  mediaType: text('media_type').notNull().default('image'),
  videoSource: text('video_source').notNull().default('upload'),
  url: text('url').notNull(),
  thumbnailUrl: text('thumbnail_url').notNull().default(''),
  storagePath: text('storage_path').notNull().default(''),
  thumbnailStoragePath: text('thumbnail_storage_path').notNull().default(''),
  commissionId: text('commission_id').notNull(),
  albumId: text('album_id').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  eventDate: text('event_date').notNull().default(''),
  mimeType: text('mime_type').notNull().default(''),
  authorUid: text('author_uid').notNull(),
  authorName: text('author_name').notNull(),
  status: text('status').notNull().default('publicado'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const documents = pgTable('documents', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  folder: text('folder').notNull().default('General'),
  category: text('category').notNull(),
  version: text('version').notNull().default('1.0'),
  versionHistory: jsonb('version_history')
    .$type<
      Array<{
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
      }>
    >()
    .notNull()
    .default([]),
  fileUrl: text('file_url').notNull(),
  storagePath: text('storage_path').notNull().default(''),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull().default(0),
  visibility: text('visibility').notNull().default('privado'),
  commissionId: text('commission_id').notNull().default(''),
  uploadedByUid: text('uploaded_by_uid').notNull(),
  uploadedByName: text('uploaded_by_name').notNull(),
  approvedByPresidente: boolean('approved_by_presidente').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const callsSurveys = pgTable('calls_surveys', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  kind: text('kind').notNull().default('convocatoria'),
  description: text('description').notNull(),
  deadline: text('deadline').notNull(),
  status: text('status').notNull().default('abierta'),
  options: jsonb('options').$type<string[]>().notNull().default([]),
  responseCount: integer('response_count').notNull().default(0),
  createdByUid: text('created_by_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const surveyResponses = pgTable('survey_responses', {
  id: text('id').primaryKey(),
  surveyId: text('survey_id').notNull(),
  selectedOption: text('selected_option').notNull(),
  respondentName: text('respondent_name').notNull(),
  respondentEmail: text('respondent_email').notNull().default(''),
  comment: text('comment').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const contactMessages = pgTable('contact_messages', {
  id: text('id').primaryKey(),
  senderName: text('sender_name').notNull(),
  senderEmail: text('sender_email').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  category: text('category').notNull().default('Consulta'),
  status: text('status').notNull().default('nuevo'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  sessionType: text('session_type').notNull(),
  dateIso: text('date_iso').notNull(),
  timeRange: text('time_range').notNull().default(''),
  location: text('location').notNull(),
  agenda: text('agenda').notNull().default(''),
  status: text('status').notNull().default('programada'),
  actaUrl: text('acta_url').notNull().default(''),
  attendance: jsonb('attendance').$type<Record<string, string>>().notNull().default({}),
  excuses: jsonb('excuses')
    .$type<
      Record<
        string,
        {
          reason: string;
          attachmentUrl?: string;
          attachmentName?: string;
          submittedAt: string;
        }
      >
    >()
    .notNull()
    .default({}),
  checkInCode: text('check_in_code').notNull().default(''),
  checkInExpiresAt: text('check_in_expires_at').notNull().default(''),
  qrRotatedAt: text('qr_rotated_at').notNull().default(''),
  quorumRequired: integer('quorum_required').notNull().default(1),
  createdByUid: text('created_by_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const actas = pgTable('actas', {
  id: text('id').primaryKey(),
  consecutive: text('consecutive').notNull(),
  year: integer('year').notNull(),
  title: text('title').notNull(),
  sessionId: text('session_id').notNull().default(''),
  commissionId: text('commission_id').notNull().default(''),
  location: text('location').notNull().default(''),
  meetingDate: text('meeting_date').notNull().default(''),
  timeRange: text('time_range').notNull().default(''),
  quorumCount: integer('quorum_count').notNull().default(0),
  quorumRequired: integer('quorum_required').notNull().default(1),
  agenda: text('agenda').notNull().default(''),
  development: text('development').notNull().default(''),
  propositions: text('propositions').notNull().default(''),
  commitmentsSummary: text('commitments_summary').notNull().default(''),
  linkedVoteIds: jsonb('linked_vote_ids').$type<string[]>().notNull().default([]),
  status: text('status').notNull().default('borrador'),
  authorUid: text('author_uid').notNull(),
  authorName: text('author_name').notNull(),
  signatures: jsonb('signatures')
    .$type<
      Array<{
        uid: string;
        name: string;
        roleLabel: string;
        signedAt: string;
        hash: string;
      }>
    >()
    .notNull()
    .default([]),
  comments: jsonb('comments')
    .$type<
      Array<{
        id: string;
        authorUid: string;
        authorName: string;
        authorRoleLabel: string;
        body: string;
        createdAt: string;
      }>
    >()
    .notNull()
    .default([]),
  history: jsonb('history')
    .$type<Array<{ at: string; actorName: string; action: string }>>()
    .notNull()
    .default([]),
  verificationHash: text('verification_hash').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const votes = pgTable('votes', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  kind: text('kind').notNull().default('general'),
  targetRole: text('target_role').notNull().default(''),
  targetCommissionId: text('target_commission_id').notNull().default(''),
  candidates: jsonb('candidates')
    .$type<Array<{ uid: string; fullName: string }>>()
    .notNull()
    .default([]),
  allowSelfVote: boolean('allow_self_vote').notNull().default(true),
  winnerUid: text('winner_uid').notNull().default(''),
  winnerName: text('winner_name').notNull().default(''),
  tiedCandidateUids: jsonb('tied_candidate_uids').$type<string[]>().notNull().default([]),
  parentVoteId: text('parent_vote_id').notNull().default(''),
  commissionId: text('commission_id').notNull().default(''),
  sessionId: text('session_id').notNull().default(''),
  voteMode: text('vote_mode').notNull().default('nominal'),
  majorityType: text('majority_type').notNull().default('simple'),
  options: jsonb('options').$type<string[]>().notNull().default([]),
  tallies: jsonb('tallies').$type<Record<string, number>>().notNull().default({}),
  nominalBallots: jsonb('nominal_ballots').$type<Record<string, string>>().notNull().default({}),
  voterUids: jsonb('voter_uids').$type<string[]>().notNull().default([]),
  quorumRequired: integer('quorum_required').notNull().default(1),
  opensAt: text('opens_at').notNull().default(''),
  closesAt: text('closes_at').notNull().default(''),
  status: text('status').notNull().default('abierta'),
  resultSummary: text('result_summary').notNull().default(''),
  deadline: text('deadline').notNull().default(''),
  createdByUid: text('created_by_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const commitments = pgTable('commitments', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  responsibleUid: text('responsible_uid').notNull(),
  responsibleName: text('responsible_name').notNull(),
  commissionId: text('commission_id').notNull(),
  dueDate: text('due_date').notNull().default(''),
  status: text('status').notNull().default('pendiente'),
  progress: integer('progress').notNull().default(0),
  createdByUid: text('created_by_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const ideasInbox = pgTable('ideas_inbox', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  commissionId: text('commission_id').notNull().default(''),
  authorUid: text('author_uid').notNull(),
  authorName: text('author_name').notNull(),
  status: text('status').notNull().default('nueva'),
  upvoterUids: jsonb('upvoter_uids').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const letterTemplates = pgTable('letter_templates', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  headerText: text('header_text').notNull().default(''),
  bodyTemplate: text('body_template').notNull(),
  signatoryRole: text('signatory_role').notNull(),
  updatedByUid: text('updated_by_uid').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const workPlans = pgTable('work_plans', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  axis: text('axis').notNull(),
  commissionId: text('commission_id').notNull(),
  quarter: text('quarter').notNull(),
  status: text('status').notNull().default('planeado'),
  progress: integer('progress').notNull().default(0),
  evidenceCount: integer('evidence_count').notNull().default(0),
  updatedByUid: text('updated_by_uid').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  actorUid: text('actor_uid').notNull(),
  actorName: text('actor_name').notNull(),
  actorRoleLabel: text('actor_role_label').notNull(),
  action: text('action').notNull(),
  module: text('module').notNull(),
  targetTitle: text('target_title').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Almacenamiento persistente de archivos multimedia en Cloud SQL
export const mediaFiles = pgTable('media_files', {
  id: text('id').primaryKey(),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  fileSize: integer('file_size').notNull(),
  contentBase64: text('content_base64').notNull(),
  uploadedByUid: text('uploaded_by_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Solicitudes de permisos especiales con justificación obligatoria
export const permissionRequests = pgTable('permission_requests', {
  id: text('id').primaryKey(),
  requesterUid: text('requester_uid').notNull(),
  requesterName: text('requester_name').notNull(),
  requesterEmail: text('requester_email').notNull(),
  requesterRoleLabel: text('requester_role_label').notNull(),
  permissionKey: text('permission_key').notNull(),
  permissionLabel: text('permission_label').notNull(),
  targetModule: text('target_module').notNull(),
  targetCommissionId: text('target_commission_id').notNull().default(''),
  targetCommissionName: text('target_commission_name').notNull().default(''),
  reason: text('reason').notNull(),
  purpose: text('purpose').notNull().default(''),
  durationType: text('duration_type').notNull().default('temporal'),
  expiresAt: text('expires_at').notNull().default(''),
  attachmentUrl: text('attachment_url').notNull().default(''),
  attachmentName: text('attachment_name').notNull().default(''),
  status: text('status').notNull().default('pendiente_presidente'),
  currentStepOrder: integer('current_step_order').notNull().default(1),
  rejectionReason: text('rejection_reason').notNull().default(''),
  decidedByName: text('decided_by_name').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Cadena secuencial obligatoria de aprobación: 1 Presidente -> 2 Vicepresidente -> 3 Secretario
export const permissionApprovalSteps = pgTable('permission_approval_steps', {
  id: text('id').primaryKey(),
  requestId: text('request_id').notNull(),
  stepOrder: integer('step_order').notNull(),
  approverRole: text('approver_role').notNull(),
  expectedApproverUid: text('expected_approver_uid').notNull().default(''),
  expectedApproverName: text('expected_approver_name').notNull().default(''),
  delegatedFromUid: text('delegated_from_uid').notNull().default(''),
  delegatedReason: text('delegated_reason').notNull().default(''),
  status: text('status').notNull().default('pendiente'),
  decidedByUid: text('decided_by_uid').notNull().default(''),
  decidedByName: text('decided_by_name').notNull().default(''),
  comment: text('comment').notNull().default(''),
  reminderSentAt: text('reminder_sent_at').notNull().default(''),
  decidedAt: text('decided_at').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Permisos especiales otorgados tras completar la cadena 1 -> 2 -> 3
export const grantedPermissions = pgTable('granted_permissions', {
  id: text('id').primaryKey(),
  requestId: text('request_id').notNull(),
  userUid: text('user_uid').notNull(),
  userName: text('user_name').notNull(),
  userEmail: text('user_email').notNull(),
  permissionKey: text('permission_key').notNull(),
  permissionLabel: text('permission_label').notNull(),
  targetModule: text('target_module').notNull(),
  targetCommissionId: text('target_commission_id').notNull().default(''),
  durationType: text('duration_type').notNull().default('temporal'),
  expiresAt: text('expires_at').notNull().default(''),
  active: boolean('active').notNull().default(true),
  revokedAt: text('revoked_at').notNull().default(''),
  revokedByUid: text('revoked_by_uid').notNull().default(''),
  revokedByName: text('revoked_by_name').notNull().default(''),
  revocationReason: text('revocation_reason').notNull().default(''),
  grantedAt: timestamp('granted_at').defaultNow().notNull(),
});

// Notificaciones internas persistentes del portal
export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  userUid: text('user_uid').notNull(),
  type: text('type').notNull().default('general'),
  title: text('title').notNull(),
  message: text('message').notNull(),
  linkModule: text('link_module').notNull().default(''),
  relatedId: text('related_id').notNull().default(''),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Propuestas ante la administración y concertación juvenil (Consejero Departamental)
export const deptProposals = pgTable('dept_proposals', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  targetEntity: text('target_entity').notNull(),
  thematicAxis: text('thematic_axis').notNull().default('Política Pública de Juventud'),
  commissionId: text('commission_id').notNull().default(''),
  summary: text('summary').notNull(),
  justification: text('justification').notNull().default(''),
  status: text('status').notNull().default('borrador'),
  visibility: text('visibility').notNull().default('privado'),
  publicationStatus: text('publication_status').notNull().default('privado'),
  publicApproved: boolean('public_approved').notNull().default(false),
  rejectionReason: text('rejection_reason').notNull().default(''),
  approvedByUid: text('approved_by_uid').notNull().default(''),
  approvedByName: text('approved_by_name').notNull().default(''),
  approvedAt: text('approved_at').notNull().default(''),
  attachmentUrl: text('attachment_url').notNull().default(''),
  attachmentName: text('attachment_name').notNull().default(''),
  authorUid: text('author_uid').notNull(),
  authorName: text('author_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Registros de veeduría y control social sobre políticas de juventud
export const deptOversight = pgTable('dept_oversight', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  watchedEntity: text('watched_entity').notNull(),
  policyOrPlan: text('policy_or_plan').notNull(),
  commissionId: text('commission_id').notNull().default(''),
  findings: text('findings').notNull(),
  recommendations: text('recommendations').notNull().default(''),
  riskLevel: text('risk_level').notNull().default('medio'),
  status: text('status').notNull().default('en_seguimiento'),
  visibility: text('visibility').notNull().default('privado'),
  publicationStatus: text('publication_status').notNull().default('privado'),
  publicApproved: boolean('public_approved').notNull().default(false),
  rejectionReason: text('rejection_reason').notNull().default(''),
  approvedByUid: text('approved_by_uid').notNull().default(''),
  approvedByName: text('approved_by_name').notNull().default(''),
  approvedAt: text('approved_at').notNull().default(''),
  evidenceUrl: text('evidence_url').notNull().default(''),
  evidenceName: text('evidence_name').notNull().default(''),
  authorUid: text('author_uid').notNull(),
  authorName: text('author_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Informes periódicos de interlocución departamental (CDJ Tolima)
export const deptReports = pgTable('dept_reports', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  reportPeriod: text('report_period').notNull(),
  sessionDate: text('session_date').notNull().default(''),
  departamentalSpace: text('departamental_space').notNull().default('Consejo Departamental de Juventud del Tolima'),
  commissionId: text('commission_id').notNull().default(''),
  summary: text('summary').notNull(),
  agreements: text('agreements').notNull().default(''),
  participationStrategies: text('participation_strategies').notNull().default(''),
  visibility: text('visibility').notNull().default('privado'),
  publicationStatus: text('publication_status').notNull().default('privado'),
  publicApproved: boolean('public_approved').notNull().default(false),
  rejectionReason: text('rejection_reason').notNull().default(''),
  approvedByUid: text('approved_by_uid').notNull().default(''),
  approvedByName: text('approved_by_name').notNull().default(''),
  approvedAt: text('approved_at').notNull().default(''),
  attachmentUrl: text('attachment_url').notNull().default(''),
  attachmentName: text('attachment_name').notNull().default(''),
  authorUid: text('author_uid').notNull(),
  authorName: text('author_name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Propuestas de puntos al orden del día en sesiones plenarias
export const sessionAgendaProposals = pgTable('session_agenda_proposals', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  title: text('title').notNull(),
  justification: text('justification').notNull(),
  proposerUid: text('proposer_uid').notNull(),
  proposerName: text('proposer_name').notNull(),
  proposerRoleLabel: text('proposer_role_label').notNull(),
  status: text('status').notNull().default('pendiente'),
  decisionNotes: text('decision_notes').notNull().default(''),
  decidedByUid: text('decided_by_uid').notNull().default(''),
  decidedByName: text('decided_by_name').notNull().default(''),
  decidedAt: text('decided_at').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Control persistente de intentos fallidos por IP en registro / autenticación
export const authRateLimits = pgTable('auth_rate_limits', {
  id: text('id').primaryKey(),
  attempts: integer('attempts').notNull().default(0),
  firstAttemptAt: text('first_attempt_at').notNull().default(''),
  lockedUntil: text('locked_until').notNull().default(''),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Logros y reconocimientos de consejeros (visibles en el perfil público)
export const councilorAchievements = pgTable('councilor_achievements', {
  id: text('id').primaryKey(),
  councilorUid: text('councilor_uid').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  date: text('date').notNull().default(''),
  category: text('category').notNull().default('iniciativa'),
  evidenceUrl: text('evidence_url').notNull().default(''),
  createdByUid: text('created_by_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Metas individuales de período para cada consejero
export const councilorGoals = pgTable('councilor_goals', {
  id: text('id').primaryKey(),
  councilorUid: text('councilor_uid').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  status: text('status').notNull().default('pendiente'),
  progress: integer('progress').notNull().default(0),
  dueDate: text('due_date').notNull().default(''),
  createdByUid: text('created_by_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Corazones de apoyo ciudadano (1 por persona/navegador o cuenta autenticada por consejero)
export const councilorHearts = pgTable(
  'councilor_hearts',
  {
    id: text('id').primaryKey(),
    councilorUid: text('councilor_uid').notNull(),
    voterKey: text('voter_key').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('councilor_hearts_councilor_voter_idx').on(table.councilorUid, table.voterKey),
  ]
);

// Periodos de mandato y relevos programados de cargos directivos/electivos
export const roleTerms = pgTable('role_terms', {
  id: text('id').primaryKey(),
  councilorUid: text('councilor_uid').notNull(),
  councilorName: text('councilor_name').notNull().default(''),
  roleLabel: text('role_label').notNull(),
  commissionId: text('commission_id').notNull().default(''),
  status: text('status').notNull().default('vigente'),
  startDate: text('start_date').notNull().default(''),
  endDate: text('end_date').notNull().default(''),
  electedByVoteId: text('elected_by_vote_id').notNull().default(''),
  previousTermId: text('previous_term_id').notNull().default(''),
  handoverNotes: text('handover_notes').notNull().default(''),
  reprogramReason: text('reprogram_reason').notNull().default(''),
  cancelReason: text('cancel_reason').notNull().default(''),
  overdueNotifiedAt: text('overdue_notified_at').notNull().default(''),
  createdByUid: text('created_by_uid').notNull().default('system'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
