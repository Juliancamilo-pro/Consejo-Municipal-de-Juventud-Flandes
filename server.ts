import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { desc, eq, ne, sql } from 'drizzle-orm';
import { db } from './src/db/index.ts';
import {
  allowedAccounts,
  auditLogs,
  callsSurveys,
  commissions,
  commissionTasks,
  commitments,
  contactMessages,
  documents,
  galleryItems,
  ideasInbox,
  letterTemplates,
  mediaFiles,
  newsEvents,
  portalSecurity,
  portalSettings,
  publicCouncilors,
  sessions,
  surveyResponses,
  users,
  votes,
  workPlans,
} from './src/db/schema.ts';
import {
  getInitialSecurityHashesFromEnvOrDefaults,
  hashEmail,
  hashPasswordScrypt,
  isLeadershipTier,
  roleLabelToAccessTier,
  SECRETARY_BOOTSTRAP_EMAIL,
  signSessionToken,
  verifySecretHash,
  verifySessionToken,
} from './src/server/security.ts';
import type { RoleLabel } from './src/types/cmj.ts';

const PORT = Number(process.env.PORT || 3000);
const COOKIE_NAME = 'cmj_session';

const STRUCTURAL_COMMISSIONS_BASE = [
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

function isSafeUrl(url: unknown): boolean {
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

function newId(prefix = 'id'): string {
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

function setSessionCookie(res: Response, token: string) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=604800`
  );
}

function clearSessionCookie(res: Response) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=None; Partitioned; Max-Age=0`
  );
}

interface AuthedUser {
  uid: string;
  email: string;
  accessTier: string;
  roleLabel: RoleLabel;
  commissionId: string;
  phone: string;
  active: boolean;
  mustChangePassword: boolean;
  fullName: string;
}

interface AuthedRequest extends Request {
  authUser?: AuthedUser;
}

async function resolveAuthUser(req: Request): Promise<AuthedUser | null> {
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

  // CSRF check for cookie-authenticated mutations
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

  const [pub] = await db
    .select()
    .from(publicCouncilors)
    .where(eq(publicCouncilors.uid, u.uid))
    .limit(1);

  return {
    uid: u.uid,
    email: u.email,
    accessTier: u.accessTier,
    roleLabel: u.roleLabel as RoleLabel,
    commissionId: u.commissionId,
    phone: u.phone,
    active: u.active,
    mustChangePassword: u.mustChangePassword,
    fullName: pub?.fullName || u.email.split('@')[0] || 'Consejero CMJ',
  };
}

async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
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

function requireLeader(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.authUser || !isLeadershipTier(req.authUser.accessTier)) {
    res.status(403).json({
      error: 'Esta acción está reservada para Presidencia, Vicepresidencia o Secretaría.',
    });
    return;
  }
  next();
}

async function ensureMinimalStructure() {
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
        heroSubtitle: 'Participación, control social e iniciativas juveniles en Flandes, Tolima.',
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
}

async function getSecurityRecord() {
  await ensureMinimalStructure();
  const [sec] = await db
    .select()
    .from(portalSecurity)
    .where(eq(portalSecurity.id, 'main'))
    .limit(1);
  return sec;
}

async function buildPrivatePayload(user: AuthedUser) {
  await ensureMinimalStructure();
  const isLeader = isLeadershipTier(user.accessTier);

  const [
    settingsRows,
    commRows,
    taskRows,
    pubRows,
    privUserRows,
    newsRows,
    galleryRows,
    docRows,
    surveyRows,
    contactRows,
    sessionRows,
    voteRows,
    commitmentRows,
    ideaRows,
    auditRows,
    tplRows,
    workPlanRows,
  ] = await Promise.all([
    db.select().from(portalSettings).where(eq(portalSettings.id, 'site_content')).limit(1),
    db.select().from(commissions),
    db.select().from(commissionTasks),
    db.select().from(publicCouncilors),
    isLeader ? db.select().from(users) : db.select().from(users).where(eq(users.uid, user.uid)),
    db.select().from(newsEvents).orderBy(desc(newsEvents.createdAt)),
    db.select().from(galleryItems).orderBy(desc(galleryItems.createdAt)),
    db.select().from(documents).orderBy(desc(documents.createdAt)),
    db.select().from(callsSurveys).orderBy(desc(callsSurveys.createdAt)),
    isLeader
      ? db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt))
      : Promise.resolve([]),
    db.select().from(sessions).orderBy(desc(sessions.createdAt)),
    db.select().from(votes).orderBy(desc(votes.createdAt)),
    db.select().from(commitments).orderBy(desc(commitments.createdAt)),
    db.select().from(ideasInbox).orderBy(desc(ideasInbox.createdAt)),
    isLeader ? db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(100) : Promise.resolve([]),
    db.select().from(letterTemplates),
    db.select().from(workPlans),
  ]);

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
      mustChangePassword: u.mustChangePassword,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    })),
    newsEvents: newsRows,
    galleryItems: galleryRows,
    documents: docRows,
    callsSurveys: surveyRows,
    contactMessages: contactRows,
    sessions: sessionRows,
    votes: voteRows,
    commitments: commitmentRows,
    ideas: ideaRows,
    auditLogs: auditRows,
    templates: tplRows,
    workPlans: workPlanRows,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // ==========================================
  // AUTENTICACIÓN DIRECTA SIN MFA / SIN 2FA
  // ==========================================
  app.get('/api/auth/me', async (req: AuthedRequest, res) => {
    try {
      const user = await resolveAuthUser(req);
      if (!user) {
        res.json({ user: null });
        return;
      }
      const token = signSessionToken(user.uid, user.email);
      res.json({ user, token });
    } catch (error) {
      console.error('Error checking current session:', error);
      res.json({ user: null });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const rawEmail = typeof req.body?.email === 'string' ? req.body.email : '';
      const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';
      const cleanEmail = rawEmail.trim().toLowerCase();

      if (!cleanEmail || !rawPassword) {
        res.status(400).json({ error: 'Ingresa tu correo electrónico y contraseña.' });
        return;
      }

      const sec = await getSecurityRecord();
      const emailH = hashEmail(cleanEmail);
      const isBootstrap = cleanEmail === SECRETARY_BOOTSTRAP_EMAIL;

      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, cleanEmail))
        .limit(1);

      let targetUser = existingUser;

      if (targetUser) {
        if (!targetUser.active) {
          res.status(403).json({
            error: 'Esta cuenta se encuentra deshabilitada temporalmente.',
            hint: 'Comunícate con el Secretario o Presidente del CMJ.',
          });
          return;
        }
        const ok = verifySecretHash(rawPassword, targetUser.passwordHash);
        if (!ok) {
          res.status(401).json({
            error: 'Correo o contraseña incorrectos.',
            hint: 'Si olvidaste tu clave o es tu primer ingreso, usa la pestaña "Activar / Cambiar clave" con el código institucional.',
          });
          return;
        }
      } else {
        // Cuenta no creada aún en users: permitir primer ingreso con clave inicial si es bootstrap o está en allowed_accounts
        const [allowRow] = await db
          .select()
          .from(allowedAccounts)
          .where(eq(allowedAccounts.emailHash, emailH))
          .limit(1);

        if (!isBootstrap && (!allowRow || !allowRow.active)) {
          res.status(403).json({
            error: 'Este correo no figura habilitado en el directorio oficial del CMJ Flandes.',
            hint: 'Solicita al Secretario, Presidente o Vicepresidente que agregue y active tu correo en "Usuarios y Mesa".',
          });
          return;
        }

        const initialOk = verifySecretHash(rawPassword, sec.initialPasswordHash);
        if (!initialOk) {
          res.status(401).json({
            error: 'Este correo aún no tiene clave personal activada o la contraseña inicial es incorrecta.',
            code: 'NEEDS_ACTIVATION_OR_WRONG_INITIAL',
            hint: 'Usa tu clave inicial institucional o ve a la pestaña "Activar cuenta" con el código de invitación.',
          });
          return;
        }

        const roleLabel: RoleLabel = isBootstrap
          ? 'Secretario'
          : ((allowRow?.roleLabel as RoleLabel) || 'Consejero');
        const accessTier = isBootstrap
          ? 'tier_3_sec'
          : allowRow?.accessTier || roleLabelToAccessTier(roleLabel);
        const commissionId = isBootstrap ? 'comision-5' : allowRow?.commissionId || 'comision-1';
        const uid = isBootstrap ? 'uid_secretario_bootstrap' : newId('uid');

        const [inserted] = await db
          .insert(users)
          .values({
            uid,
            email: cleanEmail,
            passwordHash: hashPasswordScrypt(rawPassword),
            phone: '',
            accessTier,
            roleLabel,
            commissionId,
            active: true,
            mustChangePassword: !isBootstrap,
          })
          .returning();
        targetUser = inserted;

        await db
          .insert(allowedAccounts)
          .values({
            emailHash: emailH,
            email: cleanEmail,
            active: true,
            accessTier,
            roleLabel,
            commissionId,
            accountProvisioned: true,
            mustChangePassword: !isBootstrap,
          })
          .onConflictDoUpdate({
            target: allowedAccounts.emailHash,
            set: { accountProvisioned: true, updatedAt: new Date() },
          });

        const [comm] = await db
          .select()
          .from(commissions)
          .where(eq(commissions.id, commissionId))
          .limit(1);

        const pendingId = `pending_${emailH.slice(0, 16)}`;
        const [pendingPub] = await db
          .select()
          .from(publicCouncilors)
          .where(eq(publicCouncilors.id, pendingId))
          .limit(1);

        const defaultName = isBootstrap
          ? 'Secretario General CMJ'
          : pendingPub?.fullName ||
            cleanEmail
              .split('@')[0]
              .replace(/[._-]+/g, ' ')
              .replace(/\b\w/g, (l: string) => l.toUpperCase());

        if (pendingPub) {
          await db.delete(publicCouncilors).where(eq(publicCouncilors.id, pendingId));
        }

        await db
          .insert(publicCouncilors)
          .values({
            id: uid,
            uid,
            fullName: defaultName,
            roleLabel,
            commissionId,
            commissionName: comm?.name || commissionId,
            bio: isBootstrap
              ? 'Secretario del Consejo Municipal de Juventudes de Flandes, Tolima.'
              : pendingPub?.bio || '',
            photoUrl: pendingPub?.photoUrl || '',
            storagePath: pendingPub?.storagePath || '',
            active: true,
            displayOrder: isBootstrap ? 3 : pendingPub?.displayOrder || 20,
          })
          .onConflictDoNothing();
      }

      const [pub] = await db
        .select()
        .from(publicCouncilors)
        .where(eq(publicCouncilors.uid, targetUser.uid))
        .limit(1);

      const token = signSessionToken(targetUser.uid, targetUser.email);
      setSessionCookie(res, token);

      res.json({
        token,
        user: {
          uid: targetUser.uid,
          email: targetUser.email,
          accessTier: targetUser.accessTier,
          roleLabel: targetUser.roleLabel,
          commissionId: targetUser.commissionId,
          phone: targetUser.phone,
          active: targetUser.active,
          mustChangePassword: targetUser.mustChangePassword,
          fullName: pub?.fullName || targetUser.email.split('@')[0],
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'No fue posible iniciar sesión. Intenta nuevamente.' });
    }
  });

  app.post('/api/auth/activate', async (req: AuthedRequest, res) => {
    try {
      const inviteCode = typeof req.body?.inviteCode === 'string' ? req.body.inviteCode.trim() : '';
      const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
      const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

      if (!inviteCode) {
        res.status(400).json({ error: 'Escribe el código de invitación institucional del CMJ.' });
        return;
      }
      if (newPassword.length < 6) {
        res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
        return;
      }

      const sec = await getSecurityRecord();
      if (!verifySecretHash(inviteCode, sec.inviteCodeHash)) {
        res.status(403).json({
          error: 'El código de invitación no es válido.',
          hint: 'Solicita el código vigente a la Secretaría o Presidencia del CMJ.',
        });
        return;
      }

      const currentSessionUser = await resolveAuthUser(req);
      const targetEmail = currentSessionUser ? currentSessionUser.email : rawEmail;

      if (!targetEmail) {
        res.status(400).json({ error: 'Ingresa tu correo electrónico registrado.' });
        return;
      }

      const emailH = hashEmail(targetEmail);
      const isBootstrap = targetEmail === SECRETARY_BOOTSTRAP_EMAIL;
      const [allowRow] = await db
        .select()
        .from(allowedAccounts)
        .where(eq(allowedAccounts.emailHash, emailH))
        .limit(1);

      if (!isBootstrap && (!allowRow || !allowRow.active)) {
        res.status(403).json({
          error: 'Tu correo no figura activo en el directorio de consejeros.',
          hint: 'Pide a la Secretaría que registre tu correo antes de activar tu cuenta.',
        });
        return;
      }

      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, targetEmail))
        .limit(1);

      const passwordHash = hashPasswordScrypt(newPassword);
      let finalUser = existingUser;

      if (existingUser) {
        const [updated] = await db
          .update(users)
          .set({ passwordHash, mustChangePassword: false, updatedAt: new Date() })
          .where(eq(users.uid, existingUser.uid))
          .returning();
        finalUser = updated;
      } else {
        const roleLabel: RoleLabel = isBootstrap
          ? 'Secretario'
          : ((allowRow?.roleLabel as RoleLabel) || 'Consejero');
        const accessTier = isBootstrap
          ? 'tier_3_sec'
          : allowRow?.accessTier || roleLabelToAccessTier(roleLabel);
        const commissionId = isBootstrap ? 'comision-5' : allowRow?.commissionId || 'comision-1';
        const uid = isBootstrap ? 'uid_secretario_bootstrap' : newId('uid');

        const [inserted] = await db
          .insert(users)
          .values({
            uid,
            email: targetEmail,
            passwordHash,
            phone: '',
            accessTier,
            roleLabel,
            commissionId,
            active: true,
            mustChangePassword: false,
          })
          .returning();
        finalUser = inserted;

        const [comm] = await db
          .select()
          .from(commissions)
          .where(eq(commissions.id, commissionId))
          .limit(1);

        const pendingId = `pending_${emailH.slice(0, 16)}`;
        const [pendingPub] = await db
          .select()
          .from(publicCouncilors)
          .where(eq(publicCouncilors.id, pendingId))
          .limit(1);

        const defaultName = isBootstrap
          ? 'Secretario General CMJ'
          : pendingPub?.fullName ||
            targetEmail
              .split('@')[0]
              .replace(/[._-]+/g, ' ')
              .replace(/\b\w/g, (l: string) => l.toUpperCase());

        if (pendingPub) {
          await db.delete(publicCouncilors).where(eq(publicCouncilors.id, pendingId));
        }

        await db
          .insert(publicCouncilors)
          .values({
            id: uid,
            uid,
            fullName: defaultName,
            roleLabel,
            commissionId,
            commissionName: comm?.name || commissionId,
            bio: isBootstrap
              ? 'Secretario del Consejo Municipal de Juventudes de Flandes, Tolima.'
              : pendingPub?.bio || '',
            photoUrl: pendingPub?.photoUrl || '',
            storagePath: pendingPub?.storagePath || '',
            active: true,
            displayOrder: isBootstrap ? 3 : pendingPub?.displayOrder || 20,
          })
          .onConflictDoNothing();
      }

      await db
        .insert(allowedAccounts)
        .values({
          emailHash: emailH,
          email: targetEmail,
          active: true,
          accessTier: finalUser.accessTier,
          roleLabel: finalUser.roleLabel,
          commissionId: finalUser.commissionId,
          accountProvisioned: true,
          mustChangePassword: false,
        })
        .onConflictDoUpdate({
          target: allowedAccounts.emailHash,
          set: { accountProvisioned: true, mustChangePassword: false, updatedAt: new Date() },
        });

      const [pub] = await db
        .select()
        .from(publicCouncilors)
        .where(eq(publicCouncilors.uid, finalUser.uid))
        .limit(1);

      const token = signSessionToken(finalUser.uid, finalUser.email);
      setSessionCookie(res, token);

      res.json({
        token,
        user: {
          uid: finalUser.uid,
          email: finalUser.email,
          accessTier: finalUser.accessTier,
          roleLabel: finalUser.roleLabel,
          commissionId: finalUser.commissionId,
          phone: finalUser.phone,
          active: finalUser.active,
          mustChangePassword: finalUser.mustChangePassword,
          fullName: pub?.fullName || finalUser.email.split('@')[0],
        },
      });
    } catch (error) {
      console.error('Activate/change password error:', error);
      res.status(500).json({ error: 'No fue posible actualizar la contraseña.' });
    }
  });

  app.post('/api/auth/logout', (_req, res) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  // ==========================================
  // DATOS PÚBLICOS Y PRIVADOS
  // ==========================================
  app.get('/api/public/state', async (_req, res) => {
    try {
      await ensureMinimalStructure();
      const [
        settingsRows,
        commRows,
        pubRows,
        newsRows,
        galleryRows,
        docRows,
        surveyRows,
      ] = await Promise.all([
        db.select().from(portalSettings).where(eq(portalSettings.id, 'site_content')).limit(1),
        db.select().from(commissions),
        db.select().from(publicCouncilors).where(eq(publicCouncilors.active, true)),
        db
          .select()
          .from(newsEvents)
          .where(eq(newsEvents.status, 'publicado'))
          .orderBy(desc(newsEvents.createdAt)),
        db
          .select()
          .from(galleryItems)
          .where(eq(galleryItems.status, 'publicado'))
          .orderBy(desc(galleryItems.createdAt)),
        db
          .select()
          .from(documents)
          .where(eq(documents.visibility, 'publico'))
          .orderBy(desc(documents.createdAt)),
        db.select().from(callsSurveys).orderBy(desc(callsSurveys.createdAt)),
      ]);

      res.json({
        settings: settingsRows[0] || null,
        commissions: commRows.sort((a, b) => a.number - b.number),
        publicCouncilors: pubRows,
        newsEvents: newsRows,
        galleryItems: galleryRows,
        documents: docRows,
        callsSurveys: surveyRows,
      });
    } catch (error) {
      console.error('Public state fetch failed:', error);
      res.status(500).json({ error: 'Error al cargar datos públicos del portal.' });
    }
  });

  app.get('/api/private/state', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const payload = await buildPrivatePayload(req.authUser!);
      res.json(payload);
    } catch (error) {
      console.error('Private state fetch failed:', error);
      res.status(500).json({ error: 'Error al cargar datos internos del portal.' });
    }
  });

  app.post('/api/public/survey-response', async (req, res) => {
    try {
      const { surveyId, selectedOption, respondentName, respondentEmail, comment } = req.body || {};
      if (!surveyId || !selectedOption || !respondentName) {
        res.status(400).json({ error: 'Completa nombre y opción seleccionada.' });
        return;
      }

      const [survey] = await db
        .select()
        .from(callsSurveys)
        .where(eq(callsSurveys.id, String(surveyId)))
        .limit(1);
      if (!survey || survey.status !== 'abierta') {
        res.status(400).json({ error: 'Esta convocatoria o encuesta ya está cerrada.' });
        return;
      }

      const id = newId('resp');
      await db.insert(surveyResponses).values({
        id,
        surveyId: survey.id,
        selectedOption: String(selectedOption).slice(0, 160),
        respondentName: String(respondentName).trim().slice(0, 120),
        respondentEmail: String(respondentEmail || '').trim().slice(0, 180),
        comment: String(comment || '').trim().slice(0, 600),
      });

      await db
        .update(callsSurveys)
        .set({
          responseCount: sql`${callsSurveys.responseCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(callsSurveys.id, survey.id));

      res.json({ id, ok: true });
    } catch (error) {
      console.error('Survey response failed:', error);
      res.status(500).json({ error: 'No se pudo registrar tu respuesta.' });
    }
  });

  app.post('/api/public/contact-message', async (req, res) => {
    try {
      const { senderName, senderEmail, subject, message, category } = req.body || {};
      if (!senderName || !senderEmail || !subject || !message) {
        res.status(400).json({ error: 'Todos los campos obligatorios deben estar completos.' });
        return;
      }

      const id = newId('msg');
      await db.insert(contactMessages).values({
        id,
        senderName: String(senderName).trim().slice(0, 120),
        senderEmail: String(senderEmail).trim().slice(0, 180),
        subject: String(subject).trim().slice(0, 180),
        message: String(message).trim().slice(0, 2000),
        category: String(category || 'Consulta').trim().slice(0, 64),
        status: 'nuevo',
      });

      res.json({ id, ok: true });
    } catch (error) {
      console.error('Contact message failed:', error);
      res.status(500).json({ error: 'No se pudo enviar el mensaje ciudadano.' });
    }
  });

  // ==========================================
  // MULTIMEDIA EN CLOUD SQL
  // ==========================================
  app.post('/api/media/upload', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { fileName, mimeType, fileSize, base64Data } = req.body || {};
      if (
        typeof fileName !== 'string' ||
        typeof mimeType !== 'string' ||
        typeof base64Data !== 'string' ||
        !base64Data
      ) {
        res.status(400).json({ error: 'Archivo inválido o incompleto.' });
        return;
      }

      const allowedPrefix = ['image/', 'video/', 'audio/', 'application/', 'text/'].some((p) =>
        mimeType.startsWith(p)
      );
      if (!allowedPrefix) {
        res.status(400).json({ error: 'Tipo de archivo no permitido.' });
        return;
      }

      const sizeBytes = Number(fileSize) || Math.floor((base64Data.length * 3) / 4);
      if (sizeBytes > 20 * 1024 * 1024) {
        res.status(400).json({ error: 'El archivo supera el límite permitido de 20 MB.' });
        return;
      }

      const id = newId('media');
      await db.insert(mediaFiles).values({
        id,
        fileName: fileName.slice(0, 200),
        mimeType: mimeType.slice(0, 120),
        fileSize: sizeBytes,
        contentBase64: base64Data,
        uploadedByUid: req.authUser!.uid,
      });

      res.json({
        id,
        url: `/api/media/${id}`,
        storagePath: `db-media/${id}`,
        fileName,
        mimeType,
        fileSize: sizeBytes,
      });
    } catch (error) {
      console.error('Media upload failed:', error);
      res.status(500).json({ error: 'No fue posible guardar el archivo.' });
    }
  });

  app.get('/api/media/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').replace(/^db-media\//, '');
      const [file] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, id)).limit(1);
      if (!file) {
        res.status(404).send('Archivo no encontrado');
        return;
      }
      const buffer = Buffer.from(file.contentBase64, 'base64');
      res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
      res.setHeader('Content-Length', String(buffer.length));
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.send(buffer);
    } catch (error) {
      console.error('Media fetch failed:', error);
      res.status(500).send('Error al leer el archivo');
    }
  });

  app.delete('/api/media/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id || '').replace(/^db-media\//, '');
      const [file] = await db.select().from(mediaFiles).where(eq(mediaFiles.id, id)).limit(1);
      if (!file) {
        res.json({ ok: true });
        return;
      }
      if (
        !isLeadershipTier(req.authUser!.accessTier) &&
        file.uploadedByUid !== req.authUser!.uid
      ) {
        res.status(403).json({ error: 'Sin permisos para eliminar este archivo.' });
        return;
      }
      await db.delete(mediaFiles).where(eq(mediaFiles.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Media delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar el archivo.' });
    }
  });

  // ==========================================
  // USUARIOS, DIRECTORIO Y SEGURIDAD
  // ==========================================
  app.post('/api/councilors', requireAuth, requireLeader, async (req: AuthedRequest, res) => {
    try {
      const { fullName, email, phone, roleLabel, commissionId } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanName = String(fullName || '').trim();
      if (!cleanEmail || !cleanName) {
        res.status(400).json({ error: 'Completa nombre y correo electrónico.' });
        return;
      }

      const validRole: RoleLabel = ['Presidente', 'Vicepresidente', 'Secretario', 'Consejero'].includes(
        roleLabel
      )
        ? roleLabel
        : 'Consejero';
      const accessTier = roleLabelToAccessTier(validRole);
      const commId = String(commissionId || 'comision-1');
      const emailH = hashEmail(cleanEmail);
      const sec = await getSecurityRecord();

      const [comm] = await db.select().from(commissions).where(eq(commissions.id, commId)).limit(1);
      const [existingUser] = await db.select().from(users).where(eq(users.email, cleanEmail)).limit(1);

      const uid = existingUser?.uid || newId('uid');

      await db
        .insert(allowedAccounts)
        .values({
          emailHash: emailH,
          email: cleanEmail,
          active: true,
          accessTier,
          roleLabel: validRole,
          commissionId: commId,
          accountProvisioned: true,
          mustChangePassword: true,
        })
        .onConflictDoUpdate({
          target: allowedAccounts.emailHash,
          set: {
            active: true,
            accessTier,
            roleLabel: validRole,
            commissionId: commId,
            accountProvisioned: true,
            updatedAt: new Date(),
          },
        });

      if (!existingUser) {
        await db.insert(users).values({
          uid,
          email: cleanEmail,
          passwordHash: sec.initialPasswordHash,
          phone: String(phone || '').trim(),
          accessTier,
          roleLabel: validRole,
          commissionId: commId,
          active: true,
          mustChangePassword: true,
        });
      } else {
        await db
          .update(users)
          .set({
            phone: String(phone || existingUser.phone).trim(),
            accessTier,
            roleLabel: validRole,
            commissionId: commId,
            active: true,
            updatedAt: new Date(),
          })
          .where(eq(users.uid, uid));
      }

      await db
        .insert(publicCouncilors)
        .values({
          id: uid,
          uid,
          fullName: cleanName,
          roleLabel: validRole,
          commissionId: commId,
          commissionName: comm?.name || commId,
          bio: '',
          photoUrl: '',
          storagePath: '',
          active: true,
          displayOrder: 20,
        })
        .onConflictDoUpdate({
          target: publicCouncilors.id,
          set: {
            fullName: cleanName,
            roleLabel: validRole,
            commissionId: commId,
            commissionName: comm?.name || commId,
            active: true,
            updatedAt: new Date(),
          },
        });

      res.json({ uid, ok: true });
    } catch (error) {
      console.error('Create councilor failed:', error);
      res.status(500).json({ error: 'No fue posible registrar al consejero.' });
    }
  });

  app.post('/api/councilors/bulk', requireAuth, requireLeader, async (req: AuthedRequest, res) => {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      if (!items.length) {
        res.status(400).json({ error: 'No hay filas válidas para importar.' });
        return;
      }

      const sec = await getSecurityRecord();
      const allComms = await db.select().from(commissions);
      let imported = 0;

      for (const row of items.slice(0, 100)) {
        const cleanEmail = String(row.email || '').trim().toLowerCase();
        const cleanName = String(row.fullName || '').trim();
        if (!cleanEmail || !cleanEmail.includes('@') || !cleanName) continue;

        const validRole: RoleLabel = ['Presidente', 'Vicepresidente', 'Secretario', 'Consejero'].includes(
          row.roleLabel
        )
          ? row.roleLabel
          : 'Consejero';
        const accessTier = roleLabelToAccessTier(validRole);
        const commId = String(row.commissionId || 'comision-1');
        const commName = allComms.find((c) => c.id === commId)?.name || commId;
        const emailH = hashEmail(cleanEmail);

        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, cleanEmail))
          .limit(1);
        const uid = existingUser?.uid || newId('uid');

        await db
          .insert(allowedAccounts)
          .values({
            emailHash: emailH,
            email: cleanEmail,
            active: true,
            accessTier,
            roleLabel: validRole,
            commissionId: commId,
            accountProvisioned: true,
            mustChangePassword: true,
          })
          .onConflictDoUpdate({
            target: allowedAccounts.emailHash,
            set: {
              active: true,
              accessTier,
              roleLabel: validRole,
              commissionId: commId,
              accountProvisioned: true,
              updatedAt: new Date(),
            },
          });

        if (!existingUser) {
          await db.insert(users).values({
            uid,
            email: cleanEmail,
            passwordHash: sec.initialPasswordHash,
            phone: String(row.phone || '').trim(),
            accessTier,
            roleLabel: validRole,
            commissionId: commId,
            active: true,
            mustChangePassword: true,
          });
        }

        await db
          .insert(publicCouncilors)
          .values({
            id: uid,
            uid,
            fullName: cleanName,
            roleLabel: validRole,
            commissionId: commId,
            commissionName: commName,
            bio: '',
            photoUrl: '',
            storagePath: '',
            active: true,
            displayOrder: 20 + imported,
          })
          .onConflictDoUpdate({
            target: publicCouncilors.id,
            set: {
              fullName: cleanName,
              roleLabel: validRole,
              commissionId: commId,
              commissionName: commName,
              active: true,
              updatedAt: new Date(),
            },
          });

        imported++;
      }

      res.json({ imported, ok: true });
    } catch (error) {
      console.error('Bulk import failed:', error);
      res.status(500).json({ error: 'Error al importar lote de consejeros.' });
    }
  });

  app.patch('/api/councilors/:uid', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const targetUid = String(req.params.uid);
      const isLeader = isLeadershipTier(req.authUser!.accessTier);
      const isSelf = req.authUser!.uid === targetUid;

      if (!isLeader && !isSelf) {
        res.status(403).json({ error: 'Sin permisos para modificar este perfil.' });
        return;
      }

      const body = req.body || {};
      const [existingPub] = await db
        .select()
        .from(publicCouncilors)
        .where(eq(publicCouncilors.uid, targetUid))
        .limit(1);

      const pubPatch: Record<string, unknown> = { updatedAt: new Date() };
      const userPatch: Record<string, unknown> = { updatedAt: new Date() };

      if (typeof body.fullName === 'string' && body.fullName.trim()) {
        pubPatch.fullName = body.fullName.trim().slice(0, 120);
      }
      if (typeof body.bio === 'string') pubPatch.bio = body.bio.trim().slice(0, 600);
      if (typeof body.instagram === 'string') pubPatch.instagram = body.instagram.trim().slice(0, 120);
      if (typeof body.facebook === 'string') pubPatch.facebook = body.facebook.trim().slice(0, 120);
      if (typeof body.photoUrl === 'string' && isSafeUrl(body.photoUrl)) {
        pubPatch.photoUrl = body.photoUrl;
      }
      if (typeof body.storagePath === 'string') pubPatch.storagePath = body.storagePath.slice(0, 512);
      if (typeof body.phone === 'string') userPatch.phone = body.phone.trim().slice(0, 40);

      if (isLeader) {
        if (
          typeof body.roleLabel === 'string' &&
          ['Presidente', 'Vicepresidente', 'Secretario', 'Consejero'].includes(body.roleLabel)
        ) {
          const validRole = body.roleLabel as RoleLabel;
          const tier = roleLabelToAccessTier(validRole);
          pubPatch.roleLabel = validRole;
          userPatch.roleLabel = validRole;
          userPatch.accessTier = tier;
        }
        if (typeof body.commissionId === 'string' && body.commissionId) {
          const [comm] = await db
            .select()
            .from(commissions)
            .where(eq(commissions.id, body.commissionId))
            .limit(1);
          pubPatch.commissionId = body.commissionId;
          pubPatch.commissionName = comm?.name || body.commissionId;
          userPatch.commissionId = body.commissionId;
        }
        if (typeof body.active === 'boolean') {
          pubPatch.active = body.active;
          userPatch.active = body.active;
        }
      }

      if (existingPub) {
        await db
          .update(publicCouncilors)
          .set(pubPatch)
          .where(eq(publicCouncilors.uid, targetUid));
      }

      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.uid, targetUid))
        .limit(1);
      if (existingUser) {
        await db.update(users).set(userPatch).where(eq(users.uid, targetUid));
        if (isLeader && (typeof body.active === 'boolean' || body.roleLabel || body.commissionId)) {
          await db
            .update(allowedAccounts)
            .set({
              active: typeof body.active === 'boolean' ? body.active : existingUser.active,
              roleLabel: (userPatch.roleLabel as string) || existingUser.roleLabel,
              accessTier: (userPatch.accessTier as string) || existingUser.accessTier,
              commissionId: (userPatch.commissionId as string) || existingUser.commissionId,
              updatedAt: new Date(),
            })
            .where(eq(allowedAccounts.emailHash, hashEmail(existingUser.email)));
        }
      }

      res.json({ ok: true });
    } catch (error) {
      console.error('Update councilor failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar el consejero.' });
    }
  });

  app.delete('/api/councilors/:uid', requireAuth, requireLeader, async (req: AuthedRequest, res) => {
    try {
      const targetUid = String(req.params.uid);
      if (targetUid === req.authUser!.uid) {
        res.status(400).json({ error: 'No puedes eliminar tu propia cuenta activa.' });
        return;
      }

      const [existingUser] = await db.select().from(users).where(eq(users.uid, targetUid)).limit(1);
      if (existingUser) {
        await db
          .delete(allowedAccounts)
          .where(eq(allowedAccounts.emailHash, hashEmail(existingUser.email)));
        await db.delete(users).where(eq(users.uid, targetUid));
      }
      await db.delete(publicCouncilors).where(eq(publicCouncilors.uid, targetUid));

      res.json({ ok: true });
    } catch (error) {
      console.error('Delete councilor failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar el registro.' });
    }
  });

  app.post('/api/security/rotate', requireAuth, requireLeader, async (req: AuthedRequest, res) => {
    try {
      const { inviteCode, initialPassword } = req.body || {};
      const sec = await getSecurityRecord();

      const nextInviteHash =
        typeof inviteCode === 'string' && inviteCode.trim().length >= 4
          ? hashPasswordScrypt(inviteCode.trim())
          : sec.inviteCodeHash;
      const nextInitialPwdHash =
        typeof initialPassword === 'string' && initialPassword.trim().length >= 6
          ? hashPasswordScrypt(initialPassword.trim())
          : sec.initialPasswordHash;

      await db
        .update(portalSecurity)
        .set({
          inviteCodeHash: nextInviteHash,
          initialPasswordHash: nextInitialPwdHash,
          updatedByUid: req.authUser!.uid,
          updatedAt: new Date(),
        })
        .where(eq(portalSecurity.id, 'main'));

      res.json({ ok: true });
    } catch (error) {
      console.error('Security rotation failed:', error);
      res.status(500).json({ error: 'No fue posible rotar las credenciales institucionales.' });
    }
  });

  app.post('/api/portal/purge-samples', requireAuth, async (req: AuthedRequest, res) => {
    try {
      if (
        req.authUser!.roleLabel !== 'Presidente' &&
        req.authUser!.roleLabel !== 'Secretario'
      ) {
        res.status(403).json({ error: 'Solo Presidente o Secretario pueden depurar datos.' });
        return;
      }

      await Promise.all([
        db.delete(newsEvents),
        db.delete(galleryItems),
        db.delete(documents),
        db.delete(callsSurveys),
        db.delete(surveyResponses),
        db.delete(contactMessages),
        db.delete(sessions),
        db.delete(votes),
        db.delete(commitments),
        db.delete(ideasInbox),
        db.delete(letterTemplates),
        db.delete(workPlans),
        db.delete(commissionTasks),
        db.delete(publicCouncilors).where(ne(publicCouncilors.uid, req.authUser!.uid)),
      ]);

      await db
        .update(portalSettings)
        .set({
          heroTitle: 'Consejo Municipal de Juventudes de Flandes',
          heroSubtitle: 'Participación, control social e iniciativas juveniles en Flandes, Tolima.',
          heroImageUrl: '',
          heroStoragePath: '',
          aboutText: '',
          missionText: '',
          visionText: '',
          updatedAt: new Date(),
        })
        .where(eq(portalSettings.id, 'site_content'));

      for (const c of STRUCTURAL_COMMISSIONS_BASE) {
        await db
          .update(commissions)
          .set({
            coverUrl: '',
            storagePath: '',
            coordinatorName: c.coordinatorName,
            coordinatorUid: '',
            workPlanSummary: '',
            updatedAt: new Date(),
          })
          .where(eq(commissions.id, c.id));
      }

      res.json({ ok: true });
    } catch (error) {
      console.error('Purge failed:', error);
      res.status(500).json({ error: 'No se pudo completar la limpieza.' });
    }
  });

  // ==========================================
  // COMISIONES Y TAREAS
  // ==========================================
  app.patch('/api/commissions/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id);
      const [existing] = await db.select().from(commissions).where(eq(commissions.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: 'Comisión no encontrada.' });
        return;
      }

      const isLeader = isLeadershipTier(req.authUser!.accessTier);
      const isCoord = existing.coordinatorUid === req.authUser!.uid;
      if (!isLeader && !isCoord) {
        res.status(403).json({ error: 'Sin permisos para editar esta comisión.' });
        return;
      }

      const body = req.body || {};
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof body.description === 'string') patch.description = body.description.slice(0, 800);
      if (typeof body.workPlanSummary === 'string') {
        patch.workPlanSummary = body.workPlanSummary.slice(0, 1200);
      }
      if (typeof body.coverUrl === 'string' && isSafeUrl(body.coverUrl)) {
        patch.coverUrl = body.coverUrl;
      }
      if (typeof body.storagePath === 'string') patch.storagePath = body.storagePath.slice(0, 512);
      if (isLeader) {
        if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim().slice(0, 120);
        if (typeof body.coordinatorName === 'string') {
          patch.coordinatorName = body.coordinatorName.trim().slice(0, 120);
        }
        if (typeof body.coordinatorUid === 'string') {
          patch.coordinatorUid = body.coordinatorUid.trim().slice(0, 128);
        }
      }

      await db.update(commissions).set(patch).where(eq(commissions.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Commission update failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar la comisión.' });
    }
  });

  app.post('/api/commission-tasks', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { commissionId, title, status, assignedName, dueDate } = req.body || {};
      if (!commissionId || !title) {
        res.status(400).json({ error: 'Faltan campos obligatorios.' });
        return;
      }
      const id = newId('task');
      await db.insert(commissionTasks).values({
        id,
        commissionId: String(commissionId),
        title: String(title).trim().slice(0, 180),
        status: ['pendiente', 'en_curso', 'hecha'].includes(status) ? status : 'pendiente',
        assignedName: String(assignedName || '').trim().slice(0, 120),
        dueDate: String(dueDate || '').trim().slice(0, 40),
        createdByUid: req.authUser!.uid,
      });
      res.json({ id, ok: true });
    } catch (error) {
      console.error('Task create failed:', error);
      res.status(500).json({ error: 'No fue posible crear la tarea.' });
    }
  });

  app.patch('/api/commission-tasks/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id);
      const body = req.body || {};
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (['pendiente', 'en_curso', 'hecha'].includes(body.status)) patch.status = body.status;
      if (typeof body.assignedName === 'string') patch.assignedName = body.assignedName.slice(0, 120);
      if (typeof body.dueDate === 'string') patch.dueDate = body.dueDate.slice(0, 40);
      if (isLeadershipTier(req.authUser!.accessTier) && typeof body.title === 'string') {
        patch.title = body.title.slice(0, 180);
      }
      await db.update(commissionTasks).set(patch).where(eq(commissionTasks.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Task update failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar la tarea.' });
    }
  });

  app.delete('/api/commission-tasks/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id);
      const [task] = await db
        .select()
        .from(commissionTasks)
        .where(eq(commissionTasks.id, id))
        .limit(1);
      if (!task) {
        res.json({ ok: true });
        return;
      }
      if (
        !isLeadershipTier(req.authUser!.accessTier) &&
        task.createdByUid !== req.authUser!.uid
      ) {
        res.status(403).json({ error: 'Sin permisos para eliminar esta tarea.' });
        return;
      }
      await db.delete(commissionTasks).where(eq(commissionTasks.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Task delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar la tarea.' });
    }
  });

  // ==========================================
  // NOTICIAS, GALERÍA, DOCUMENTOS
  // ==========================================
  app.post('/api/news', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { title, type, summary, content, coverUrl, storagePath, commissionId, eventDate, location, status } =
        req.body || {};
      if (!title || !summary || !content) {
        res.status(400).json({ error: 'Completa título, resumen y contenido.' });
        return;
      }
      const isLeader = isLeadershipTier(req.authUser!.accessTier);
      const safeStatus =
        isLeader && ['borrador', 'pendiente', 'publicado'].includes(status)
          ? status
          : status === 'borrador'
          ? 'borrador'
          : 'pendiente';
      const id = newId('news');
      await db.insert(newsEvents).values({
        id,
        title: String(title).trim().slice(0, 180),
        type: type === 'evento' ? 'evento' : 'noticia',
        summary: String(summary).trim().slice(0, 400),
        content: String(content).trim().slice(0, 5000),
        coverUrl: isSafeUrl(coverUrl) ? String(coverUrl || '') : '',
        storagePath: String(storagePath || '').slice(0, 512),
        commissionId: String(commissionId || 'comision-1'),
        eventDate: String(eventDate || '').slice(0, 40),
        location: String(location || '').slice(0, 160),
        authorUid: req.authUser!.uid,
        authorName: req.authUser!.fullName,
        status: safeStatus,
      });
      res.json({ id, ok: true });
    } catch (error) {
      console.error('News create failed:', error);
      res.status(500).json({ error: 'No fue posible crear la publicación.' });
    }
  });

  app.patch('/api/news/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id);
      const [item] = await db.select().from(newsEvents).where(eq(newsEvents.id, id)).limit(1);
      if (!item) {
        res.status(404).json({ error: 'Publicación no encontrada.' });
        return;
      }
      const isLeader = isLeadershipTier(req.authUser!.accessTier);
      if (!isLeader && item.authorUid !== req.authUser!.uid) {
        res.status(403).json({ error: 'Sin permisos para editar esta publicación.' });
        return;
      }
      const body = req.body || {};
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof body.title === 'string') patch.title = body.title.slice(0, 180);
      if (typeof body.summary === 'string') patch.summary = body.summary.slice(0, 400);
      if (typeof body.content === 'string') patch.content = body.content.slice(0, 5000);
      if (typeof body.coverUrl === 'string' && isSafeUrl(body.coverUrl)) patch.coverUrl = body.coverUrl;
      if (typeof body.storagePath === 'string') patch.storagePath = body.storagePath.slice(0, 512);
      if (typeof body.eventDate === 'string') patch.eventDate = body.eventDate.slice(0, 40);
      if (typeof body.location === 'string') patch.location = body.location.slice(0, 160);
      if (typeof body.status === 'string' && ['borrador', 'pendiente', 'publicado'].includes(body.status)) {
        if (isLeader || body.status !== 'publicado') patch.status = body.status;
      }
      await db.update(newsEvents).set(patch).where(eq(newsEvents.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('News update failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar la publicación.' });
    }
  });

  app.delete('/api/news/:id', requireAuth, requireLeader, async (req, res) => {
    try {
      await db.delete(newsEvents).where(eq(newsEvents.id, String(req.params.id)));
      res.json({ ok: true });
    } catch (error) {
      console.error('News delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar la publicación.' });
    }
  });

  app.post('/api/gallery', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const {
        title,
        description,
        mediaType,
        videoSource,
        url,
        thumbnailUrl,
        storagePath,
        thumbnailStoragePath,
        commissionId,
        status,
      } = req.body || {};
      if (!title || !url || !isSafeUrl(url)) {
        res.status(400).json({ error: 'Título y URL válidos son obligatorios.' });
        return;
      }
      const id = newId('gal');
      await db.insert(galleryItems).values({
        id,
        title: String(title).trim().slice(0, 160),
        description: String(description || '').trim().slice(0, 400),
        mediaType: mediaType === 'video' ? 'video' : 'image',
        videoSource: ['upload', 'youtube', 'vimeo'].includes(videoSource) ? videoSource : 'upload',
        url: String(url),
        thumbnailUrl: isSafeUrl(thumbnailUrl) ? String(thumbnailUrl || '') : '',
        storagePath: String(storagePath || '').slice(0, 512),
        thumbnailStoragePath: String(thumbnailStoragePath || '').slice(0, 512),
        commissionId: String(commissionId || 'comision-1'),
        authorUid: req.authUser!.uid,
        authorName: req.authUser!.fullName,
        status: status === 'archivado' ? 'archivado' : 'publicado',
      });
      res.json({ id, ok: true });
    } catch (error) {
      console.error('Gallery create failed:', error);
      res.status(500).json({ error: 'No fue posible publicar en galería.' });
    }
  });

  app.patch('/api/gallery/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id);
      const [item] = await db.select().from(galleryItems).where(eq(galleryItems.id, id)).limit(1);
      if (!item) {
        res.status(404).json({ error: 'Elemento no encontrado.' });
        return;
      }
      if (!isLeadershipTier(req.authUser!.accessTier) && item.authorUid !== req.authUser!.uid) {
        res.status(403).json({ error: 'Sin permisos.' });
        return;
      }
      const body = req.body || {};
      const patch: Record<string, unknown> = {};
      if (typeof body.title === 'string') patch.title = body.title.slice(0, 160);
      if (typeof body.status === 'string' && ['publicado', 'archivado'].includes(body.status)) {
        patch.status = body.status;
      }
      await db.update(galleryItems).set(patch).where(eq(galleryItems.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Gallery update failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar galería.' });
    }
  });

  app.delete('/api/gallery/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id);
      const [item] = await db.select().from(galleryItems).where(eq(galleryItems.id, id)).limit(1);
      if (!item) {
        res.json({ ok: true });
        return;
      }
      if (!isLeadershipTier(req.authUser!.accessTier) && item.authorUid !== req.authUser!.uid) {
        res.status(403).json({ error: 'Sin permisos para eliminar.' });
        return;
      }
      await db.delete(galleryItems).where(eq(galleryItems.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Gallery delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar.' });
    }
  });

  app.post('/api/documents', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const {
        title,
        folder,
        category,
        version,
        fileUrl,
        storagePath,
        fileName,
        mimeType,
        fileSize,
        visibility,
        commissionId,
      } = req.body || {};
      if (!title || !fileUrl || !isSafeUrl(fileUrl) || !fileName) {
        res.status(400).json({ error: 'Datos de documento inválidos.' });
        return;
      }
      const isLeader = isLeadershipTier(req.authUser!.accessTier);
      const id = newId('doc');
      await db.insert(documents).values({
        id,
        title: String(title).trim().slice(0, 180),
        folder: String(folder || 'General').trim().slice(0, 80),
        category: String(category || 'Acta').trim().slice(0, 60),
        version: String(version || '1.0').trim().slice(0, 24),
        fileUrl: String(fileUrl),
        storagePath: String(storagePath || '').slice(0, 512),
        fileName: String(fileName).slice(0, 200),
        mimeType: String(mimeType || 'application/octet-stream').slice(0, 120),
        fileSize: Number(fileSize || 0),
        visibility: isLeader && visibility === 'publico' ? 'publico' : 'privado',
        commissionId: String(commissionId || 'comision-1'),
        uploadedByUid: req.authUser!.uid,
        uploadedByName: req.authUser!.fullName,
        approvedByPresidente: isLeader && req.authUser!.roleLabel === 'Presidente',
      });
      res.json({ id, ok: true });
    } catch (error) {
      console.error('Document create failed:', error);
      res.status(500).json({ error: 'No fue posible registrar el documento.' });
    }
  });

  app.patch('/api/documents/:id', requireAuth, requireLeader, async (req, res) => {
    try {
      const id = String(req.params.id);
      const body = req.body || {};
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof body.approvedByPresidente === 'boolean') {
        patch.approvedByPresidente = body.approvedByPresidente;
      }
      if (body.visibility === 'publico' || body.visibility === 'privado') {
        patch.visibility = body.visibility;
      }
      if (typeof body.title === 'string') patch.title = body.title.slice(0, 180);
      if (typeof body.version === 'string') patch.version = body.version.slice(0, 24);
      await db.update(documents).set(patch).where(eq(documents.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Document update failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar el documento.' });
    }
  });

  app.delete('/api/documents/:id', requireAuth, requireLeader, async (req, res) => {
    try {
      await db.delete(documents).where(eq(documents.id, String(req.params.id)));
      res.json({ ok: true });
    } catch (error) {
      console.error('Document delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar el documento.' });
    }
  });

  // ==========================================
  // CONVOCATORIAS, MENSAJES, SESIONES, VOTOS, COMPROMISOS
  // ==========================================
  app.post('/api/calls-surveys', requireAuth, requireLeader, async (req: AuthedRequest, res) => {
    try {
      const { title, kind, description, deadline, options } = req.body || {};
      if (!title || !description || !deadline) {
        res.status(400).json({ error: 'Completa título, descripción y fecha límite.' });
        return;
      }
      const id = newId('call');
      await db.insert(callsSurveys).values({
        id,
        title: String(title).trim().slice(0, 180),
        kind: kind === 'encuesta' ? 'encuesta' : 'convocatoria',
        description: String(description).trim().slice(0, 1200),
        deadline: String(deadline).trim().slice(0, 40),
        status: 'abierta',
        options: Array.isArray(options) ? options.map(String).slice(0, 10) : [],
        responseCount: 0,
        createdByUid: req.authUser!.uid,
      });
      res.json({ id, ok: true });
    } catch (error) {
      console.error('Call/survey create failed:', error);
      res.status(500).json({ error: 'No fue posible crear la convocatoria.' });
    }
  });

  app.patch('/api/calls-surveys/:id', requireAuth, requireLeader, async (req, res) => {
    try {
      const id = String(req.params.id);
      const status = req.body?.status === 'cerrada' ? 'cerrada' : 'abierta';
      await db.update(callsSurveys).set({ status, updatedAt: new Date() }).where(eq(callsSurveys.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Call/survey update failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar.' });
    }
  });

  app.delete('/api/calls-surveys/:id', requireAuth, requireLeader, async (req, res) => {
    try {
      const id = String(req.params.id);
      await db.delete(callsSurveys).where(eq(callsSurveys.id, id));
      await db.delete(surveyResponses).where(eq(surveyResponses.surveyId, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Call/survey delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar.' });
    }
  });

  app.get('/api/survey-responses', requireAuth, async (_req, res) => {
    try {
      const rows = await db
        .select()
        .from(surveyResponses)
        .orderBy(desc(surveyResponses.createdAt))
        .limit(200);
      res.json({ responses: rows });
    } catch (error) {
      console.error('Survey responses fetch failed:', error);
      res.status(500).json({ error: 'Error al consultar respuestas.' });
    }
  });

  app.patch('/api/contact-messages/:id', requireAuth, requireLeader, async (req, res) => {
    try {
      const id = String(req.params.id);
      const status = ['nuevo', 'en_proceso', 'respondido'].includes(req.body?.status)
        ? req.body.status
        : 'nuevo';
      await db.update(contactMessages).set({ status }).where(eq(contactMessages.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Contact message update failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar el mensaje.' });
    }
  });

  app.delete('/api/contact-messages/:id', requireAuth, requireLeader, async (req, res) => {
    try {
      await db.delete(contactMessages).where(eq(contactMessages.id, String(req.params.id)));
      res.json({ ok: true });
    } catch (error) {
      console.error('Contact message delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar el mensaje.' });
    }
  });

  app.post('/api/sessions', requireAuth, requireLeader, async (req: AuthedRequest, res) => {
    try {
      const { title, sessionType, dateIso, timeRange, location, agenda, checkInCode, quorumRequired } =
        req.body || {};
      if (!title || !dateIso || !location) {
        res.status(400).json({ error: 'Título, fecha y lugar son obligatorios.' });
        return;
      }
      const id = newId('sess');
      await db.insert(sessions).values({
        id,
        title: String(title).trim().slice(0, 180),
        sessionType: String(sessionType || 'Ordinaria').slice(0, 64),
        dateIso: String(dateIso).slice(0, 40),
        timeRange: String(timeRange || '').slice(0, 64),
        location: String(location).trim().slice(0, 160),
        agenda: String(agenda || '').slice(0, 2000),
        status: 'programada',
        actaUrl: '',
        attendance: {},
        checkInCode: String(checkInCode || crypto.randomBytes(3).toString('hex').toUpperCase()).slice(0, 16),
        quorumRequired: Math.max(1, Number(quorumRequired || 1)),
        createdByUid: req.authUser!.uid,
      });
      res.json({ id, ok: true });
    } catch (error) {
      console.error('Session create failed:', error);
      res.status(500).json({ error: 'No fue posible convocar la sesión.' });
    }
  });

  app.patch('/api/sessions/:id', requireAuth, requireLeader, async (req, res) => {
    try {
      const id = String(req.params.id);
      const body = req.body || {};
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (['programada', 'en_curso', 'finalizada'].includes(body.status)) patch.status = body.status;
      if (typeof body.actaUrl === 'string' && isSafeUrl(body.actaUrl)) patch.actaUrl = body.actaUrl;
      if (typeof body.agenda === 'string') patch.agenda = body.agenda.slice(0, 2000);
      await db.update(sessions).set(patch).where(eq(sessions.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Session update failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar la sesión.' });
    }
  });

  app.post('/api/sessions/:id/attendance', requireAuth, requireLeader, async (req, res) => {
    try {
      const id = String(req.params.id);
      const { targetUid, status } = req.body || {};
      if (!targetUid || !['presente', 'tarde', 'excusa', 'ausente'].includes(status)) {
        res.status(400).json({ error: 'Datos de asistencia inválidos.' });
        return;
      }
      const [sess] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
      if (!sess) {
        res.status(404).json({ error: 'Sesión no encontrada.' });
        return;
      }
      const nextAttendance = { ...(sess.attendance || {}), [String(targetUid)]: String(status) };
      await db
        .update(sessions)
        .set({ attendance: nextAttendance, updatedAt: new Date() })
        .where(eq(sessions.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Attendance mark failed:', error);
      res.status(500).json({ error: 'No fue posible registrar asistencia.' });
    }
  });

  app.post('/api/sessions/:id/checkin', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id);
      const code = String(req.body?.code || '').trim().toUpperCase();
      const [sess] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
      if (!sess || sess.status === 'finalizada') {
        res.status(400).json({ error: 'La sesión no está abierta para registro.' });
        return;
      }
      if (!sess.checkInCode || sess.checkInCode.toUpperCase() !== code) {
        res.status(400).json({ error: 'El código de asistencia no coincide con la sesión.' });
        return;
      }
      const nextAttendance = { ...(sess.attendance || {}), [req.authUser!.uid]: 'presente' };
      await db
        .update(sessions)
        .set({ attendance: nextAttendance, updatedAt: new Date() })
        .where(eq(sessions.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Check-in failed:', error);
      res.status(500).json({ error: 'No fue posible registrar tu asistencia.' });
    }
  });

  app.delete('/api/sessions/:id', requireAuth, requireLeader, async (req, res) => {
    try {
      await db.delete(sessions).where(eq(sessions.id, String(req.params.id)));
      res.json({ ok: true });
    } catch (error) {
      console.error('Session delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar la sesión.' });
    }
  });

  app.post('/api/votes', requireAuth, requireLeader, async (req: AuthedRequest, res) => {
    try {
      const { title, description, voteMode, options, quorumRequired, deadline } = req.body || {};
      const cleanOpts = Array.isArray(options)
        ? options.map((o) => String(o).trim()).filter(Boolean).slice(0, 8)
        : [];
      if (!title || cleanOpts.length < 2) {
        res.status(400).json({ error: 'Agrega título y al menos 2 opciones de votación.' });
        return;
      }
      const tallies: Record<string, number> = {};
      for (const opt of cleanOpts) tallies[opt] = 0;

      const id = newId('vote');
      await db.insert(votes).values({
        id,
        title: String(title).trim().slice(0, 180),
        description: String(description || 'Votación plenaria CMJ').trim().slice(0, 1000),
        commissionId: '',
        voteMode: voteMode === 'secreto' ? 'secreto' : 'nominal',
        options: cleanOpts,
        tallies,
        nominalBallots: {},
        voterUids: [],
        quorumRequired: Math.max(1, Number(quorumRequired || 1)),
        opensAt: '',
        closesAt: '',
        status: 'abierta',
        deadline: String(deadline || '').slice(0, 40),
        createdByUid: req.authUser!.uid,
      });
      res.json({ id, ok: true });
    } catch (error) {
      console.error('Vote create failed:', error);
      res.status(500).json({ error: 'No fue posible abrir la votación.' });
    }
  });

  app.post('/api/votes/:id/cast', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id);
      const option = String(req.body?.option || '');
      const [vote] = await db.select().from(votes).where(eq(votes.id, id)).limit(1);
      if (!vote || vote.status !== 'abierta') {
        res.status(400).json({ error: 'La votación no está abierta.' });
        return;
      }
      if (!vote.options.includes(option)) {
        res.status(400).json({ error: 'Opción no válida.' });
        return;
      }
      if (vote.voterUids.includes(req.authUser!.uid)) {
        res.status(400).json({ error: 'Ya emitiste tu voto en esta moción.' });
        return;
      }

      const nextVoterUids = [...vote.voterUids, req.authUser!.uid];
      const nextTallies = { ...(vote.tallies || {}) };
      nextTallies[option] = (nextTallies[option] || 0) + 1;
      const nextNominal =
        vote.voteMode === 'secreto'
          ? vote.nominalBallots || {}
          : { ...(vote.nominalBallots || {}), [req.authUser!.uid]: option };

      await db
        .update(votes)
        .set({
          voterUids: nextVoterUids,
          tallies: nextTallies,
          nominalBallots: nextNominal,
          updatedAt: new Date(),
        })
        .where(eq(votes.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Cast vote failed:', error);
      res.status(500).json({ error: 'No fue posible registrar tu voto.' });
    }
  });

  app.patch('/api/votes/:id', requireAuth, requireLeader, async (req, res) => {
    try {
      const id = String(req.params.id);
      const status = req.body?.status === 'cerrada' ? 'cerrada' : 'abierta';
      await db.update(votes).set({ status, updatedAt: new Date() }).where(eq(votes.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Vote status update failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar la votación.' });
    }
  });

  app.delete('/api/votes/:id', requireAuth, requireLeader, async (req, res) => {
    try {
      await db.delete(votes).where(eq(votes.id, String(req.params.id)));
      res.json({ ok: true });
    } catch (error) {
      console.error('Vote delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar la votación.' });
    }
  });

  app.post('/api/commitments', requireAuth, requireLeader, async (req: AuthedRequest, res) => {
    try {
      const { title, description, responsibleUid, responsibleName, commissionId, dueDate } =
        req.body || {};
      if (!title || !responsibleUid || !responsibleName) {
        res.status(400).json({ error: 'Completa título y responsable.' });
        return;
      }
      const id = newId('commt');
      await db.insert(commitments).values({
        id,
        title: String(title).trim().slice(0, 180),
        description: String(description || '').slice(0, 800),
        responsibleUid: String(responsibleUid),
        responsibleName: String(responsibleName).slice(0, 120),
        commissionId: String(commissionId || 'comision-1'),
        dueDate: String(dueDate || '').slice(0, 40),
        status: 'pendiente',
        progress: 0,
        createdByUid: req.authUser!.uid,
      });
      res.json({ id, ok: true });
    } catch (error) {
      console.error('Commitment create failed:', error);
      res.status(500).json({ error: 'No fue posible crear el compromiso.' });
    }
  });

  app.patch('/api/commitments/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id);
      const [item] = await db.select().from(commitments).where(eq(commitments.id, id)).limit(1);
      if (!item) {
        res.status(404).json({ error: 'Compromiso no encontrado.' });
        return;
      }
      const isLeader = isLeadershipTier(req.authUser!.accessTier);
      if (!isLeader && item.responsibleUid !== req.authUser!.uid) {
        res.status(403).json({ error: 'Sin permisos para actualizar este compromiso.' });
        return;
      }
      const body = req.body || {};
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (['pendiente', 'en_progreso', 'cumplido'].includes(body.status)) patch.status = body.status;
      if (typeof body.progress === 'number') {
        patch.progress = Math.max(0, Math.min(100, Math.round(body.progress)));
      }
      await db.update(commitments).set(patch).where(eq(commitments.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Commitment update failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar el compromiso.' });
    }
  });

  app.delete('/api/commitments/:id', requireAuth, requireLeader, async (req, res) => {
    try {
      await db.delete(commitments).where(eq(commitments.id, String(req.params.id)));
      res.json({ ok: true });
    } catch (error) {
      console.error('Commitment delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar.' });
    }
  });

  // ==========================================
  // IDEAS, PLANTILLAS, PLAN DE TRABAJO, CONFIGURACIÓN, AUDITORÍA
  // ==========================================
  app.post('/api/ideas', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { title, description, category, commissionId } = req.body || {};
      if (!title || !description) {
        res.status(400).json({ error: 'Título y descripción obligatorios.' });
        return;
      }
      const id = newId('idea');
      await db.insert(ideasInbox).values({
        id,
        title: String(title).trim().slice(0, 160),
        description: String(description).trim().slice(0, 1500),
        category: String(category || 'Iniciativa').slice(0, 64),
        commissionId: String(commissionId || req.authUser!.commissionId || 'comision-1'),
        authorUid: req.authUser!.uid,
        authorName: req.authUser!.fullName,
        status: 'nueva',
        upvoterUids: [req.authUser!.uid],
      });
      res.json({ id, ok: true });
    } catch (error) {
      console.error('Idea create failed:', error);
      res.status(500).json({ error: 'No fue posible enviar la idea.' });
    }
  });

  app.post('/api/ideas/:id/upvote', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id);
      const [idea] = await db.select().from(ideasInbox).where(eq(ideasInbox.id, id)).limit(1);
      if (!idea) {
        res.status(404).json({ error: 'Idea no encontrada.' });
        return;
      }
      const exists = idea.upvoterUids.includes(req.authUser!.uid);
      const next = exists
        ? idea.upvoterUids.filter((u) => u !== req.authUser!.uid)
        : [...idea.upvoterUids, req.authUser!.uid];
      await db
        .update(ideasInbox)
        .set({ upvoterUids: next, updatedAt: new Date() })
        .where(eq(ideasInbox.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Idea upvote failed:', error);
      res.status(500).json({ error: 'No fue posible votar la idea.' });
    }
  });

  app.patch('/api/ideas/:id', requireAuth, requireLeader, async (req, res) => {
    try {
      const id = String(req.params.id);
      const status = ['nueva', 'en_revision', 'aprobada'].includes(req.body?.status)
        ? req.body.status
        : 'nueva';
      await db.update(ideasInbox).set({ status, updatedAt: new Date() }).where(eq(ideasInbox.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Idea update failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar.' });
    }
  });

  app.delete('/api/ideas/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id);
      const [idea] = await db.select().from(ideasInbox).where(eq(ideasInbox.id, id)).limit(1);
      if (!idea) {
        res.json({ ok: true });
        return;
      }
      if (!isLeadershipTier(req.authUser!.accessTier) && idea.authorUid !== req.authUser!.uid) {
        res.status(403).json({ error: 'Sin permisos.' });
        return;
      }
      await db.delete(ideasInbox).where(eq(ideasInbox.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Idea delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar.' });
    }
  });

  app.post('/api/templates', requireAuth, requireLeader, async (req: AuthedRequest, res) => {
    try {
      const { title, category, headerText, bodyTemplate, signatoryRole } = req.body || {};
      if (!title || !bodyTemplate) {
        res.status(400).json({ error: 'Completa título y cuerpo de la plantilla.' });
        return;
      }
      const id = newId('tpl');
      await db.insert(letterTemplates).values({
        id,
        title: String(title).trim().slice(0, 160),
        category: String(category || 'Oficio').slice(0, 64),
        headerText: String(headerText || '').slice(0, 500),
        bodyTemplate: String(bodyTemplate).slice(0, 5000),
        signatoryRole: String(signatoryRole || 'Secretario').slice(0, 64),
        updatedByUid: req.authUser!.uid,
      });
      res.json({ id, ok: true });
    } catch (error) {
      console.error('Template create failed:', error);
      res.status(500).json({ error: 'No fue posible guardar la plantilla.' });
    }
  });

  app.delete('/api/templates/:id', requireAuth, requireLeader, async (req, res) => {
    try {
      await db.delete(letterTemplates).where(eq(letterTemplates.id, String(req.params.id)));
      res.json({ ok: true });
    } catch (error) {
      console.error('Template delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar.' });
    }
  });

  app.post('/api/work-plans', requireAuth, requireLeader, async (req: AuthedRequest, res) => {
    try {
      const { title, axis, commissionId, quarter, status, progress, evidenceCount } = req.body || {};
      if (!title || !axis || !commissionId) {
        res.status(400).json({ error: 'Completa título, eje y comisión.' });
        return;
      }
      const id = newId('plan');
      await db.insert(workPlans).values({
        id,
        title: String(title).trim().slice(0, 180),
        axis: String(axis).trim().slice(0, 100),
        commissionId: String(commissionId),
        quarter: String(quarter || 'Q1-2026').slice(0, 24),
        status: ['planeado', 'ejecucion', 'completado'].includes(status) ? status : 'planeado',
        progress: Math.max(0, Math.min(100, Number(progress || 0))),
        evidenceCount: Math.max(0, Number(evidenceCount || 0)),
        updatedByUid: req.authUser!.uid,
      });
      res.json({ id, ok: true });
    } catch (error) {
      console.error('WorkPlan create failed:', error);
      res.status(500).json({ error: 'No fue posible crear la meta.' });
    }
  });

  app.patch('/api/work-plans/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id);
      const body = req.body || {};
      const patch: Record<string, unknown> = {
        updatedByUid: req.authUser!.uid,
        updatedAt: new Date(),
      };
      if (typeof body.progress === 'number') {
        patch.progress = Math.max(0, Math.min(100, Math.round(body.progress)));
      }
      if (typeof body.evidenceCount === 'number') {
        patch.evidenceCount = Math.max(0, Math.round(body.evidenceCount));
      }
      if (
        isLeadershipTier(req.authUser!.accessTier) &&
        ['planeado', 'ejecucion', 'completado'].includes(body.status)
      ) {
        patch.status = body.status;
      }
      await db.update(workPlans).set(patch).where(eq(workPlans.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('WorkPlan update failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar la meta.' });
    }
  });

  app.delete('/api/work-plans/:id', requireAuth, requireLeader, async (req, res) => {
    try {
      await db.delete(workPlans).where(eq(workPlans.id, String(req.params.id)));
      res.json({ ok: true });
    } catch (error) {
      console.error('WorkPlan delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar.' });
    }
  });

  app.put('/api/portal-settings', requireAuth, requireLeader, async (req, res) => {
    try {
      const body = req.body || {};
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof body.heroTitle === 'string' && body.heroTitle.trim()) {
        patch.heroTitle = body.heroTitle.trim().slice(0, 160);
      }
      if (typeof body.heroSubtitle === 'string' && body.heroSubtitle.trim()) {
        patch.heroSubtitle = body.heroSubtitle.trim().slice(0, 400);
      }
      if (typeof body.heroImageUrl === 'string' && isSafeUrl(body.heroImageUrl)) {
        patch.heroImageUrl = body.heroImageUrl;
      }
      if (typeof body.heroStoragePath === 'string') {
        patch.heroStoragePath = body.heroStoragePath.slice(0, 512);
      }
      if (typeof body.aboutText === 'string') patch.aboutText = body.aboutText.slice(0, 2000);
      if (typeof body.missionText === 'string') patch.missionText = body.missionText.slice(0, 1000);
      if (typeof body.visionText === 'string') patch.visionText = body.visionText.slice(0, 1000);
      if (typeof body.contactEmail === 'string') patch.contactEmail = body.contactEmail.slice(0, 180);
      if (typeof body.contactAddress === 'string') patch.contactAddress = body.contactAddress.slice(0, 240);
      if (
        ['default', 'san_pedro', 'independencia', 'semana_juventud', 'amor_amistad', 'navidad'].includes(
          body.activeTheme
        )
      ) {
        patch.activeTheme = body.activeTheme;
      }

      await ensureMinimalStructure();
      await db.update(portalSettings).set(patch).where(eq(portalSettings.id, 'site_content'));
      res.json({ ok: true });
    } catch (error) {
      console.error('Settings update failed:', error);
      res.status(500).json({ error: 'No fue posible guardar la configuración del portal.' });
    }
  });

  app.post('/api/audit', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { action, module, targetTitle } = req.body || {};
      const id = newId('audit');
      await db.insert(auditLogs).values({
        id,
        actorUid: req.authUser!.uid,
        actorName: req.authUser!.fullName,
        actorRoleLabel: req.authUser!.roleLabel,
        action: String(action || '').slice(0, 180),
        module: String(module || '').slice(0, 80),
        targetTitle: String(targetTitle || '').slice(0, 180),
      });
      res.json({ id, ok: true });
    } catch (error) {
      console.error('Audit log insert failed:', error);
      res.status(500).json({ error: 'No fue posible registrar auditoría.' });
    }
  });

  // ==========================================
  // VITE / STATIC SERVING
  // ==========================================
  const distDir = path.resolve(import.meta.dirname, 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distDir);

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CMJ Flandes server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
