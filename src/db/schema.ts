import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
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
  bio: text('bio').notNull().default(''),
  photoUrl: text('photo_url').notNull().default(''),
  storagePath: text('storage_path').notNull().default(''),
  instagram: text('instagram').notNull().default(''),
  facebook: text('facebook').notNull().default(''),
  active: boolean('active').notNull().default(true),
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
  checkInCode: text('check_in_code').notNull().default(''),
  quorumRequired: integer('quorum_required').notNull().default(1),
  createdByUid: text('created_by_uid').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const votes = pgTable('votes', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  commissionId: text('commission_id').notNull().default(''),
  voteMode: text('vote_mode').notNull().default('nominal'),
  options: jsonb('options').$type<string[]>().notNull().default([]),
  tallies: jsonb('tallies').$type<Record<string, number>>().notNull().default({}),
  nominalBallots: jsonb('nominal_ballots').$type<Record<string, string>>().notNull().default({}),
  voterUids: jsonb('voter_uids').$type<string[]>().notNull().default([]),
  quorumRequired: integer('quorum_required').notNull().default(1),
  opensAt: text('opens_at').notNull().default(''),
  closesAt: text('closes_at').notNull().default(''),
  status: text('status').notNull().default('abierta'),
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
