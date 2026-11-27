import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db, ensureDatabaseTables } from '../db/index.ts';
import {
  actas,
  auditLogs,
  callsSurveys,
  commissions,
  commissionTasks,
  commitments,
  contactMessages,
  deptOversight,
  deptProposals,
  deptReports,
  documents,
  galleryAlbums,
  galleryItems,
  grantedPermissions,
  ideasInbox,
  letterTemplates,
  newsEvents,
  notifications,
  permissionApprovalSteps,
  permissionRequests,
  portalSecurity,
  portalSettings,
  publicCouncilors,
  roleTerms,
  sessionAgendaProposals,
  sessions,
  users,
  votes,
  workPlans,
} from '../db/schema.ts';
import { syncElectionsAndTransitionsIfNeeded } from './services/roleTransitions.ts';
import {
  getInitialSecurityHashesFromEnvOrDefaults,
  hasEnvSessionSecret,
  isLeadershipTier,
  setRuntimeSessionSecret,
  verifySessionToken,
} from './security.ts';
import {
  getPermissionMeta,
  hasPermission,
  normalizeRoleLabel,
  resolveEffectivePermissions,
} from '../lib/permissions.ts';
import type {
  GrantedPermission,
  PermissionKey,
  PortalNotification,
  PrivateModule,
  RoleLabel,
} from '../types/cmj.ts';

export const COOKIE_NAME = 'cmj_session';

export const STRUCTURAL_COMMISSIONS_BASE = [
  {
    id: 'comision-1',
    number: 1,
    name: 'Comisión de Educación, Cultura y Deporte',
    iconName: 'BookOpen',
    accentColor: '#2563EB',
    description:
      'Espacio de trabajo del Consejo Municipal de Juventudes de Flandes para iniciativas educativas, culturales y deportivas.',
    coordinatorName: 'Por asignar',
  },
  {
    id: 'comision-2',
    number: 2,
    name: 'Comisión de Empleo, Emprendimiento e Innovación',
    iconName: 'Briefcase',
    accentColor: '#059669',
    description:
      'Espacio de trabajo juvenil enfocado en emprendimiento, formación laboral y desarrollo económico en Flandes.',
    coordinatorName: 'Por asignar',
  },
  {
    id: 'comision-3',
    number: 3,
    name: 'Comisión de Salud Mental, Bienestar y Recreación',
    iconName: 'HeartPulse',
    accentColor: '#E11D48',
    description:
      'Espacio de seguimiento a bienestar integral, salud mental y convivencia juvenil en el municipio.',
    coordinatorName: 'Por asignar',
  },
  {
    id: 'comision-4',
    number: 4,
    name: 'Comisión de Ambiente, Territorio y Sostenibilidad',
    iconName: 'Leaf',
    accentColor: '#0D9488',
    description:
      'Espacio de gestión ambiental, cuidado del entorno urbano y rural y participación territorial juvenil.',
    coordinatorName: 'Por asignar',
  },
  {
    id: 'comision-5',
    number: 5,
    name: 'Comisión de Derechos Humanos, Participación y Control Social',
    iconName: 'Scale',
    accentColor: '#4F46E5',
    description:
      'Espacio de control social, transparencia institucional, veeduría y derechos juveniles en Flandes.',
    coordinatorName: 'Por asignar',
  },
];

export type AffiliationType = '' | 'partido' | 'fundacion' | 'independiente';

export interface AuthedUser {
  uid: string;
  email: string;
  accessTier: string;
  roleLabel: RoleLabel;
  commissionId: string;
  phone: string;
  active: boolean;
  verificado: boolean;
  verificadoAt: string;
  cargoDeclarado: string;
  coordDeclaradaPendiente: boolean;
  mustChangePassword: boolean;
  fullName: string;
  coordinatorCommissionIds: string[];
  grantedPermissions: GrantedPermission[];
  effectivePermissions: PermissionKey[];
}

export interface AuthedRequest extends Request {
  authUser?: AuthedUser;
}

export function isSafeUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (trimmed.length > 2048) return false;
  return (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/')
  );
}

export function normalizeAffiliationType(value: unknown): AffiliationType {
  if (value === 'partido' || value === 'fundacion' || value === 'independiente') {
    return value;
  }
  return '';
}

export function roleDefaultDisplayOrder(roleLabel: RoleLabel): number {
  if (roleLabel === 'Presidente') return 1;
  if (roleLabel === 'Vicepresidente') return 2;
  if (roleLabel === 'Secretario') return 3;
  if (roleLabel === 'Consejero Departamental') return 4;
  return 20;
}

export function newId(prefix = 'id'): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function parseCookies(header?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

function isHttpsRequest(req: Request): boolean {
  if (req.secure) return true;
  if (process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV)) return true;
  const proto = String(req.headers['x-forwarded-proto'] || '').toLowerCase();
  if (proto.includes('https')) return true;
  const origin = String(req.headers.origin || '').toLowerCase();
  if (origin.startsWith('https://')) return true;
  const referer = String(req.headers.referer || '').toLowerCase();
  return referer.startsWith('https://');
}

function isIframeContext(req: Request): boolean {
  const ctxHeader = String(req.headers['x-cmj-context'] || '').toLowerCase();
  if (ctxHeader === 'iframe') return true;
  if (ctxHeader === 'top') return false;
  return String(req.headers['sec-fetch-dest'] || '').toLowerCase() === 'iframe';
}

function buildCookieAttributes(req: Request, maxAgeSeconds: number): string {
  const https = isHttpsRequest(req);
  const inIframe = isIframeContext(req);
  const expires =
    maxAgeSeconds <= 0
      ? 'Thu, 01 Jan 1970 00:00:00 GMT'
      : new Date(Date.now() + maxAgeSeconds * 1000).toUTCString();

  if (https) {
    return `Path=/; HttpOnly; Secure; SameSite=None${inIframe ? '; Partitioned' : ''}; Max-Age=${maxAgeSeconds}; Expires=${expires}`;
  }
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}; Expires=${expires}`;
}

export function setSessionCookie(req: Request, res: Response, token: string) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; ${buildCookieAttributes(req, 604800)}`
  );
}

export function clearSessionCookie(req: Request, res: Response) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; ${buildCookieAttributes(req, 0)}`);
}

export async function buildAuthedUserProfile(userRow: typeof users.$inferSelect): Promise<AuthedUser> {
  const [pubRows, coordComms, grantRows] = await Promise.all([
    db.select().from(publicCouncilors).where(eq(publicCouncilors.uid, userRow.uid)).limit(1),
    db.select({ id: commissions.id }).from(commissions).where(eq(commissions.coordinatorUid, userRow.uid)),
    db
      .select()
      .from(grantedPermissions)
      .where(and(eq(grantedPermissions.userUid, userRow.uid), eq(grantedPermissions.active, true))),
  ]);

  const nowMs = Date.now();
  const activeGrants: GrantedPermission[] = [];
  for (const g of grantRows) {
    if (g.durationType === 'temporal' && g.expiresAt) {
      const exp = Date.parse(g.expiresAt);
      if (!Number.isNaN(exp) && exp <= nowMs) {
        await db
          .update(grantedPermissions)
          .set({ active: false })
          .where(eq(grantedPermissions.id, g.id))
          .catch(() => undefined);
        continue;
      }
    }
    activeGrants.push({
      id: g.id,
      requestId: g.requestId,
      userUid: g.userUid,
      userName: g.userName,
      userEmail: g.userEmail,
      permissionKey: g.permissionKey as PermissionKey,
      permissionLabel: g.permissionLabel,
      targetModule: g.targetModule,
      targetCommissionId: g.targetCommissionId || undefined,
      durationType: g.durationType as 'temporal' | 'permanente',
      expiresAt: g.expiresAt || undefined,
      active: g.active,
      revokedAt: g.revokedAt || undefined,
      revokedByUid: g.revokedByUid || undefined,
      revokedByName: g.revokedByName || undefined,
      revocationReason: g.revocationReason || undefined,
      grantedAt: g.grantedAt,
    });
  }

  const roleLabel = normalizeRoleLabel(userRow.roleLabel);
  const coordinatorCommissionIds = coordComms.map((c) => c.id);
  const effectivePermissions = resolveEffectivePermissions({
    roleLabel,
    active: userRow.active,
    coordinatorCommissionIds,
    grantedPermissions: activeGrants,
    nowMs,
  });

  return {
    uid: userRow.uid,
    email: userRow.email,
    accessTier: userRow.accessTier,
    roleLabel,
    commissionId: userRow.commissionId,
    phone: userRow.phone,
    active: userRow.active,
    verificado: Boolean(userRow.verificado),
    verificadoAt: userRow.verificadoAt || '',
    cargoDeclarado: userRow.cargoDeclarado || '',
    coordDeclaradaPendiente: Boolean(userRow.coordDeclaradaPendiente),
    mustChangePassword: userRow.mustChangePassword,
    fullName: pubRows[0]?.fullName || userRow.email.split('@')[0] || 'Consejero CMJ',
    coordinatorCommissionIds,
    grantedPermissions: activeGrants,
    effectivePermissions,
  };
}

export async function expireOutdatedGrantedPermissions(): Promise<void> {
  try {
    const activeTemporal = await db
      .select()
      .from(grantedPermissions)
      .where(and(eq(grantedPermissions.active, true), eq(grantedPermissions.durationType, 'temporal')));

    const nowMs = Date.now();
    for (const g of activeTemporal) {
      if (!g.expiresAt) continue;
      const expMs = Date.parse(g.expiresAt);
      if (!Number.isNaN(expMs) && expMs <= nowMs) {
        await db
          .update(grantedPermissions)
          .set({ active: false })
          .where(eq(grantedPermissions.id, g.id));
      }
    }
  } catch (err) {
    console.error('Expire outdated grants error:', err);
  }
}

export async function resolveAuthUser(req: Request): Promise<AuthedUser | null> {
  const authHeader = req.headers.authorization;
  let token = '';
  let usedCookie = false;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice('Bearer '.length).trim();
  } else {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies[COOKIE_NAME]) {
      token = cookies[COOKIE_NAME];
      usedCookie = true;
    }
  }

  if (!token) return null;

  if (usedCookie && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    const xRequestedWith = req.headers['x-requested-with'];
    const origin = req.headers.origin;
    const host = (req.headers['x-forwarded-host'] || req.headers.host || '') as string;
    const originMatchesHost =
      typeof origin === 'string' &&
      Boolean(host) &&
      (origin.endsWith(`://${host}`) || origin === `https://${host}` || origin === `http://${host}`);
    if (xRequestedWith !== 'CMJ-Flandes' && !originMatchesHost) {
      return null;
    }
  }

  const payload = verifySessionToken(token);
  if (!payload) return null;

  const [u] = await db.select().from(users).where(eq(users.uid, payload.uid)).limit(1);
  if (!u || !u.active) return null;

  return buildAuthedUserProfile(u);
}

export function userHasPermission(
  user: AuthedUser,
  permission: PermissionKey,
  targetCommissionId?: string
): boolean {
  return hasPermission(
    {
      roleLabel: user.roleLabel,
      active: user.active,
      coordinatorCommissionIds: user.coordinatorCommissionIds,
      grantedPermissions: user.grantedPermissions,
      effectivePermissions: user.effectivePermissions,
    },
    permission,
    targetCommissionId
  );
}

export function sendPermissionDenied(
  res: Response,
  permission: PermissionKey,
  commissionId?: string,
  customMessage?: string
) {
  const meta = getPermissionMeta(permission);
  res.status(403).json({
    error: customMessage || 'No tienes permiso para esta acción. Puedes solicitarlo aquí',
    code: 'PERMISSION_DENIED_REQUESTABLE',
    requiredPermission: permission,
    permissionLabel: meta.label,
    targetModule: meta.module,
    requestable: meta.requestable,
    commissionId: commissionId || '',
  });
}

export function requirePermission(permission: PermissionKey) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser || !userHasPermission(req.authUser, permission)) {
      sendPermissionDenied(res, permission);
      return;
    }
    next();
  };
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const user = await resolveAuthUser(req);
    if (!user) {
      res.status(401).json({ error: 'Sesión no válida o expirada. Inicia sesión nuevamente.' });
      return;
    }
    req.authUser = user;
    next();
  } catch (error) {
    console.error('Auth verification error:', error);
    res.status(500).json({ error: 'No fue posible verificar la sesión.' });
  }
}

export function requireLeader(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.authUser || !isLeadershipTier(req.authUser.accessTier)) {
    res.status(403).json({
      error: 'Esta acción está reservada para Presidencia, Vicepresidencia o Secretaría.',
    });
    return;
  }
  next();
}

export async function logServerAudit(
  actor: Pick<AuthedUser, 'uid' | 'fullName' | 'roleLabel'>,
  action: string,
  module: string,
  targetTitle: string
) {
  try {
    await db.insert(auditLogs).values({
      id: newId('audit'),
      actorUid: actor.uid,
      actorName: actor.fullName,
      actorRoleLabel: actor.roleLabel,
      action: action.slice(0, 180),
      module: module.slice(0, 80),
      targetTitle: targetTitle.slice(0, 180),
    });
  } catch (err) {
    console.error('Server audit log error:', err);
  }
}

export async function createPortalNotification(input: {
  userUid: string;
  type: PortalNotification['type'];
  title: string;
  message: string;
  linkModule?: PrivateModule;
  relatedId?: string;
}) {
  if (!input.userUid) return;
  try {
    await db.insert(notifications).values({
      id: newId('notif'),
      userUid: input.userUid,
      type: input.type,
      title: input.title.slice(0, 160),
      message: input.message.slice(0, 600),
      linkModule: input.linkModule || '',
      relatedId: input.relatedId || '',
      read: false,
    });
  } catch (err) {
    console.error('Create portal notification error:', err);
  }
}

export async function syncPendingReminders48h() {
  try {
    const thresholdMs = Date.now() - 48 * 60 * 60 * 1000;
    const pendingSteps = await db
      .select()
      .from(permissionApprovalSteps)
      .where(eq(permissionApprovalSteps.status, 'pendiente'));

    if (!pendingSteps.length) return;

    const allRequests = await db.select().from(permissionRequests);
    const reqMap = new Map(allRequests.map((r) => [r.id, r]));

    for (const step of pendingSteps) {
      if (step.reminderSentAt) continue;
      const reqRecord = reqMap.get(step.requestId);
      if (!reqRecord || reqRecord.currentStepOrder !== step.stepOrder) continue;
      const refTime = new Date(reqRecord.updatedAt || reqRecord.createdAt).getTime();
      if (Number.isNaN(refTime) || refTime > thresholdMs) continue;

      const targetUids: string[] = [];
      if (step.expectedApproverUid) {
        targetUids.push(step.expectedApproverUid);
      } else {
        const roleUsers = await db
          .select({ uid: users.uid })
          .from(users)
          .where(and(eq(users.roleLabel, step.approverRole), eq(users.active, true)));
        for (const ru of roleUsers) targetUids.push(ru.uid);
      }

      const nowIso = new Date().toISOString();
      await db
        .update(permissionApprovalSteps)
        .set({ reminderSentAt: nowIso })
        .where(eq(permissionApprovalSteps.id, step.id));

      for (const uid of targetUids) {
        if (uid === reqRecord.requesterUid) continue;
        await createPortalNotification({
          userUid: uid,
          type: 'permiso_recordatorio_48h',
          title: `Recordatorio (+48h): Solicitud pendiente de ${step.approverRole}`,
          message: `La solicitud de ${reqRecord.requesterName} para "${reqRecord.permissionLabel}" lleva más de 48 horas esperando tu decisión.`,
          linkModule: 'permisos',
          relatedId: reqRecord.id,
        });
      }
    }
  } catch (err) {
    console.error('48h reminder sync error:', err);
  }
}

let structureInitPromise: Promise<void> | null = null;

async function syncSharedSessionSecret() {
  if (hasEnvSessionSecret()) return;
  const [existingKey] = await db
    .select()
    .from(portalSecurity)
    .where(eq(portalSecurity.id, 'session_key'))
    .limit(1);

  if (existingKey?.inviteCodeHash && existingKey.inviteCodeHash.length >= 32) {
    setRuntimeSessionSecret(existingKey.inviteCodeHash);
    return;
  }

  const generated = crypto.randomBytes(32).toString('hex');
  await db
    .insert(portalSecurity)
    .values({
      id: 'session_key',
      inviteCodeHash: generated,
      initialPasswordHash: 'hmac-sha256',
      updatedByUid: 'system',
    })
    .onConflictDoNothing();

  const [storedKey] = await db
    .select()
    .from(portalSecurity)
    .where(eq(portalSecurity.id, 'session_key'))
    .limit(1);
  if (storedKey?.inviteCodeHash) {
    setRuntimeSessionSecret(storedKey.inviteCodeHash);
  }
}

export async function ensureMinimalStructure() {
  if (structureInitPromise) {
    return structureInitPromise;
  }

  structureInitPromise = (async () => {
    try {
      await ensureDatabaseTables();
      await syncSharedSessionSecret();

      const existingSec = await db
        .select()
        .from(portalSecurity)
        .where(eq(portalSecurity.id, 'main'))
        .limit(1);
      if (!existingSec.length) {
        const defaults = getInitialSecurityHashesFromEnvOrDefaults();
        await db
          .insert(portalSecurity)
          .values({
            id: 'main',
            inviteCodeHash: defaults.inviteCodeHash,
            initialPasswordHash: defaults.initialPasswordHash,
            updatedByUid: 'system',
          })
          .onConflictDoNothing();
      }

      const existingSettings = await db
        .select()
        .from(portalSettings)
        .where(eq(portalSettings.id, 'site_content'))
        .limit(1);
      if (!existingSettings.length) {
        await db
          .insert(portalSettings)
          .values({
            id: 'site_content',
            heroTitle: 'Consejo Municipal de Juventudes de Flandes',
            heroSubtitle:
              'Participación, control social e iniciativas juveniles en Flandes, Tolima.',
            heroImageUrl: '',
            heroStoragePath: '',
            aboutText: '',
            missionText: '',
            visionText: '',
            contactEmail: '',
            contactAddress: 'Flandes, Tolima, Colombia',
            activeTheme: 'default',
          })
          .onConflictDoNothing();
      }

      const existingComms = await db.select().from(commissions).limit(1);
      if (!existingComms.length) {
        for (const c of STRUCTURAL_COMMISSIONS_BASE) {
          await db
            .insert(commissions)
            .values({
              id: c.id,
              number: c.number,
              name: c.name,
              iconName: c.iconName,
              accentColor: c.accentColor,
              coverUrl: '',
              storagePath: '',
              description: c.description,
              coordinatorName: c.coordinatorName,
              coordinatorUid: '',
              workPlanSummary: '',
            })
            .onConflictDoNothing();
        }
      }

      const allUsers = await db.select().from(users);
      if (allUsers.length > 0) {
        const allPubs = await db.select().from(publicCouncilors);
        const pubByUid = new Map(allPubs.map((p) => [p.uid, p]));
        for (const u of allUsers) {
          const pub = pubByUid.get(u.uid);
          if (pub && (!pub.email || (!pub.phone && u.phone))) {
            await db
              .update(publicCouncilors)
              .set({
                email: pub.email || u.email,
                phone: pub.phone || u.phone || '',
              })
              .where(eq(publicCouncilors.uid, u.uid));
          }
          if (u.uid === 'uid_secretario_bootstrap' && !u.verificado) {
            const nowIso = new Date().toISOString();
            await db
              .update(users)
              .set({ verificado: true, verificadoAt: nowIso })
              .where(eq(users.uid, u.uid));
            if (pub) {
              await db
                .update(publicCouncilors)
                .set({ verificado: true, verificadoAt: nowIso })
                .where(eq(publicCouncilors.uid, u.uid));
            }
          }
        }
      }
    } catch (error) {
      structureInitPromise = null;
      throw error;
    }
  })();

  return structureInitPromise;
}

export async function getSecurityRecord() {
  await ensureMinimalStructure();
  const [sec] = await db
    .select()
    .from(portalSecurity)
    .where(eq(portalSecurity.id, 'main'))
    .limit(1);
  return sec;
}

export async function buildPrivatePayload(user: AuthedUser) {
  await ensureMinimalStructure();
  await Promise.all([
    syncElectionsAndTransitionsIfNeeded(),
    syncPendingReminders48h(),
    expireOutdatedGrantedPermissions(),
  ]);

  const canViewUsers = userHasPermission(user, 'usuarios.ver');
  const canViewBuzon = userHasPermission(user, 'buzon.ver');
  const canViewAudit = userHasPermission(user, 'auditoria.ver');
  const canViewDept =
    userHasPermission(user, 'departamental.ver') ||
    userHasPermission(user, 'departamental.publicacion_aprobar');
  const isApproverOrLeader =
    isLeadershipTier(user.accessTier) ||
    userHasPermission(user, 'permisos.aprobar_presidencia') ||
    userHasPermission(user, 'permisos.aprobar_vicepresidencia') ||
    userHasPermission(user, 'permisos.aprobar_secretaria') ||
    userHasPermission(user, 'permisos.revocar');

  const [
    settingsRows,
    commRows,
    taskRows,
    pubRows,
    privUserRows,
    newsRows,
    galleryRows,
    albumRows,
    docRows,
    surveyRows,
    contactRows,
    sessionRows,
    agendaPropRows,
    actaRows,
    voteRows,
    commitmentRows,
    ideaRows,
    auditRows,
    tplRows,
    workPlanRows,
    permRequestRows,
    permStepRows,
    grantRows,
    notifRows,
    deptProposalRows,
    deptOversightRows,
    deptReportRows,
    roleTermRows,
  ] = await Promise.all([
    db.select().from(portalSettings).where(eq(portalSettings.id, 'site_content')).limit(1),
    db.select().from(commissions),
    db.select().from(commissionTasks),
    db.select().from(publicCouncilors),
    canViewUsers ? db.select().from(users) : db.select().from(users).where(eq(users.uid, user.uid)),
    db.select().from(newsEvents).orderBy(desc(newsEvents.createdAt)),
    db.select().from(galleryItems).orderBy(desc(galleryItems.createdAt)),
    db.select().from(galleryAlbums).orderBy(desc(galleryAlbums.createdAt)),
    db.select().from(documents).orderBy(desc(documents.createdAt)),
    db.select().from(callsSurveys).orderBy(desc(callsSurveys.createdAt)),
    canViewBuzon
      ? db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt))
      : Promise.resolve([]),
    db.select().from(sessions).orderBy(desc(sessions.createdAt)),
    db.select().from(sessionAgendaProposals).orderBy(desc(sessionAgendaProposals.createdAt)),
    db.select().from(actas).orderBy(desc(actas.year), desc(actas.createdAt)),
    db.select().from(votes).orderBy(desc(votes.createdAt)),
    db.select().from(commitments).orderBy(desc(commitments.createdAt)),
    db.select().from(ideasInbox).orderBy(desc(ideasInbox.createdAt)),
    canViewAudit
      ? db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(150)
      : Promise.resolve([]),
    db.select().from(letterTemplates),
    db.select().from(workPlans),
    db.select().from(permissionRequests).orderBy(desc(permissionRequests.createdAt)),
    db.select().from(permissionApprovalSteps),
    canViewUsers || isApproverOrLeader
      ? db.select().from(grantedPermissions).orderBy(desc(grantedPermissions.grantedAt))
      : db
          .select()
          .from(grantedPermissions)
          .where(eq(grantedPermissions.userUid, user.uid))
          .orderBy(desc(grantedPermissions.grantedAt)),
    db
      .select()
      .from(notifications)
      .where(eq(notifications.userUid, user.uid))
      .orderBy(desc(notifications.createdAt))
      .limit(80),
    canViewDept
      ? db.select().from(deptProposals).orderBy(desc(deptProposals.createdAt))
      : Promise.resolve([]),
    canViewDept
      ? db.select().from(deptOversight).orderBy(desc(deptOversight.createdAt))
      : Promise.resolve([]),
    canViewDept
      ? db.select().from(deptReports).orderBy(desc(deptReports.createdAt))
      : Promise.resolve([]),
    db.select().from(roleTerms).orderBy(desc(roleTerms.createdAt)),
  ]);

  const sortedGallery = [...galleryRows].sort((a, b) => {
    const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  // Filtrar solicitudes si el usuario no es aprobador ni está delegado en ningún paso
  const delegatedReqIds = new Set(
    permStepRows.filter((s) => s.expectedApproverUid === user.uid).map((s) => s.requestId)
  );
  const visibleRequests = isApproverOrLeader
    ? permRequestRows
    : permRequestRows.filter((r) => r.requesterUid === user.uid || delegatedReqIds.has(r.id));
  const visibleReqIds = new Set(visibleRequests.map((r) => r.id));
  const visibleSteps = permStepRows.filter((s) => visibleReqIds.has(s.requestId));

  return {
    settings: settingsRows[0] || null,
    commissions: commRows.sort((a, b) => a.number - b.number),
    commissionTasks: taskRows,
    publicCouncilors: pubRows,
    privateCouncilors: privUserRows.map((u) => ({
      uid: u.uid,
      email: u.email,
      phone: u.phone,
      accessTier: u.accessTier,
      roleLabel: u.roleLabel,
      commissionId: u.commissionId,
      active: u.active,
      verificado: Boolean(u.verificado),
      verificadoAt: u.verificadoAt || '',
      cargoDeclarado: u.cargoDeclarado || '',
      coordDeclaradaPendiente: Boolean(u.coordDeclaradaPendiente),
      coordDeclaradaComisionId: u.coordDeclaradaComisionId || '',
      mustChangePassword: u.mustChangePassword,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    })),
    newsEvents: newsRows,
    galleryItems: sortedGallery,
    galleryAlbums: albumRows,
    documents: docRows,
    callsSurveys: surveyRows,
    contactMessages: contactRows,
    sessions: sessionRows,
    sessionAgendaProposals: agendaPropRows,
    actas: actaRows,
    votes: voteRows.map((v) =>
      v.voteMode === 'secreto' ? { ...v, nominalBallots: {} } : v
    ),
    commitments: commitmentRows,
    ideas: ideaRows,
    auditLogs: auditRows,
    templates: tplRows,
    workPlans: workPlanRows,
    permissionRequests: visibleRequests,
    permissionApprovalSteps: visibleSteps,
    grantedPermissions: grantRows,
    portalNotifications: notifRows,
    deptProposals: deptProposalRows,
    deptOversight: deptOversightRows,
    deptReports: deptReportRows,
    roleTerms: roleTermRows,
    effectivePermissions: user.effectivePermissions,
    coordinatorCommissionIds: user.coordinatorCommissionIds,
  };
}

export function ensureServerlessPath(req: { url?: string }) {
  if (!req.url) return;
  try {
    const parsed = new URL(req.url, 'http://localhost');
    const vercelPath = parsed.searchParams.get('__vercel_path');
    if (vercelPath !== null) {
      parsed.searchParams.delete('__vercel_path');
      const cleanedSubpath = vercelPath.replace(/^\/+/, '');
      const qs = parsed.searchParams.toString();
      req.url = `/api/${cleanedSubpath}${qs ? `?${qs}` : ''}`;
    }
  } catch {
    // Keep original url
  }
}

export function isAllowedCorsOrigin(origin: string, req: Request): boolean {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const reqHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    if (reqHost && parsed.host === reqHost) return true;

    const configuredUrls = [
      process.env.APP_URL,
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.VITE_APP_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '',
      process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : '',
      process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : '',
      ...(process.env.CORS_ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '').split(','),
    ];

    for (const candidate of configuredUrls) {
      const trimmed = String(candidate || '').trim();
      if (!trimmed) continue;
      try {
        if (new URL(trimmed).origin === parsed.origin) return true;
      } catch {
        if (trimmed === parsed.origin || trimmed === parsed.host) return true;
      }
    }

    if (
      (parsed.protocol === 'http:' &&
        (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) ||
      (parsed.protocol === 'https:' && parsed.hostname.endsWith('.vercel.app'))
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}
