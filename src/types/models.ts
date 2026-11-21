export type UserRole =
  | 'secretario_admin'
  | 'presidente'
  | 'vicepresidente'
  | 'lider_comision'
  | 'consejero';

export type UserStatus = 'pendiente' | 'activo' | 'suspendido';

export interface CounselorSocialLinks {
  instagram?: string;
  facebook?: string;
  x?: string;
  tiktok?: string;
  linkedin?: string;
  youtube?: string;
  website?: string;
}

export interface CounselorAchievement {
  year: string;
  title: string;
  description?: string;
}

export interface PublicFieldVisibility {
  photo?: boolean;
  shortBio?: boolean;
  fullBio?: boolean;
  education?: boolean;
  motivation?: boolean;
  proposals?: boolean;
  projects?: boolean;
  socials?: boolean;
  publicEmail?: boolean;
  workAxes?: boolean;
  achievements?: boolean;
  skills?: boolean;
  featuredQuote?: boolean;
}

export type ProfileReviewStatus = 'borrador' | 'revision' | 'publicada';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  slug?: string;
  photoUrl?: string;
  commissionId?: string;
  positionTitle?: string;
  sector?: string;
  bio?: string;
  shortBio?: string;
  fullBio?: string;
  educationOccupation?: string;
  motivation?: string;
  proposals?: string;
  workAxes?: string[];
  achievements?: CounselorAchievement[];
  skills?: string[];
  featuredQuote?: string;
  projectIds?: string[];
  period?: string;
  socialLinks?: CounselorSocialLinks;
  publicEmail?: string;
  fieldVisibility?: PublicFieldVisibility;
  habeasDataAccepted?: boolean;
  habeasDataAcceptedAt?: string;
  isMinor?: boolean;
  guardianAuthorizationNote?: string;
  profileReviewStatus?: ProfileReviewStatus;
  profileReviewComment?: string;
  profileReviewedByName?: string;
  profileReviewedAt?: string;
  showManagementKpis?: boolean;
  emailNotifications?: boolean;
  approvedByUid?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PublicDirectoryMember {
  uid: string;
  slug?: string;
  displayName: string;
  role: UserRole;
  status: 'activo' | 'inactivo';
  photoUrl?: string;
  commissionId?: string;
  commissionName?: string;
  positionTitle?: string;
  sector?: string;
  bio?: string;
  shortBio?: string;
  fullBio?: string;
  educationOccupation?: string;
  motivation?: string;
  proposals?: string;
  workAxes?: string[];
  achievements?: CounselorAchievement[];
  skills?: string[];
  featuredQuote?: string;
  projectIds?: string[];
  period?: string;
  socialLinks?: CounselorSocialLinks;
  publicEmail?: string;
  showManagementKpis?: boolean;
  kpiSessionsAttended?: number;
  kpiCommitmentsFulfilled?: number;
  updatedAt?: unknown;
}

export type CommissionIconName =
  | 'Building2'
  | 'Users'
  | 'Sprout'
  | 'Palette'
  | 'GraduationCap'
  | 'HeartHandshake'
  | 'Scale'
  | 'Globe';

export type CommissionMemberRole = 'lider' | 'secretario' | 'integrante';

export interface CommissionMemberEntry {
  uid: string;
  displayName: string;
  photoUrl?: string;
  role: CommissionMemberRole;
  joinedAtIso?: string;
}

export interface CommissionGoal {
  id: string;
  title: string;
  indicator: string;
  targetValue: string;
  currentValue: string;
  progressPercent: number;
  status: 'pendiente' | 'en_progreso' | 'cumplida';
}

export interface CommissionJoinRequest {
  id: string;
  commissionId: string;
  userUid: string;
  userName: string;
  userPhotoUrl?: string;
  message?: string;
  status: 'pendiente' | 'aprobada' | 'rechazada';
  reviewedByUid?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Commission {
  id: string;
  name: string;
  slug?: string;
  description: string;
  accentColor?: string;
  iconName?: CommissionIconName;
  coverImageUrl?: string;
  mission?: string;
  objectives?: string[];
  workLines?: string[];
  meetingPlace?: string;
  meetingSchedule?: string;
  leaderUid?: string;
  leaderName?: string;
  secretaryUid?: string;
  secretaryName?: string;
  memberUids?: string[];
  members?: CommissionMemberEntry[];
  goals?: CommissionGoal[];
  status: 'activa' | 'inactiva' | 'archivada';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NewsItem {
  id: string;
  title: string;
  type: 'noticia' | 'comunicado' | 'galeria';
  summary: string;
  content: string;
  imageUrl?: string;
  tags?: string[];
  seoTitle?: string;
  seoDescription?: string;
  status: 'borrador' | 'publicada' | 'archivada';
  scheduledPublishAt?: string;
  authorUid: string;
  authorName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ProjectItem {
  id: string;
  title: string;
  summary: string;
  objective: string;
  commissionId?: string;
  status: 'borrador' | 'publicada' | 'archivada';
  progressPercent: number;
  authorUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PlenarySession {
  id: string;
  title: string;
  sessionType: 'ordinaria' | 'extraordinaria' | 'comision';
  dateIso: string;
  location: string;
  agenda: string;
  status: 'borrador' | 'programada' | 'realizada' | 'cancelada';
  visibility: 'publico' | 'interno';
  checkinCode?: string;
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  userUid: string;
  userName: string;
  status: 'presente' | 'ausente' | 'justificada';
  recordedByUid: string;
  notes?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface JustificationRecord {
  id: string;
  sessionId: string;
  userUid: string;
  userName: string;
  reason: string;
  attachmentId?: string;
  attachmentName?: string;
  attachmentPath?: string;
  reviewStatus: 'pendiente' | 'aprobada' | 'rechazada';
  reviewedByUid?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  secretario_admin: 'Secretario Administrador',
  presidente: 'Presidente',
  vicepresidente: 'Vicepresidente',
  lider_comision: 'Líder de Comisión',
  consejero: 'Consejero',
};

export * from './blockD';
export * from './portalRecords';

