import type express from 'express';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db, hasDatabaseConfig } from '../../db/index.ts';
import {
  actas,
  allowedAccounts,
  authRateLimits,
  callsSurveys,
  commissions,
  contactMessages,
  deptOversight,
  deptProposals,
  deptReports,
  documents,
  galleryAlbums,
  galleryItems,
  newsEvents,
  portalSettings,
  publicCouncilors,
  surveyResponses,
  users,
} from '../../db/schema.ts';
import {
  hashEmail,
  hashPasswordScrypt,
  roleLabelToAccessTier,
  SECRETARY_BOOTSTRAP_EMAIL,
  sha256Hex,
  signSessionToken,
  timingSafeEqualStrings,
  verifySecretHash,
} from '../security.ts';
import {
  type AuthedRequest,
  buildAuthedUserProfile,
  buildPrivatePayload,
  clearSessionCookie,
  createPortalNotification,
  ensureMinimalStructure,
  getSecurityRecord,
  logServerAudit,
  newId,
  normalizeAffiliationType,
  requireAuth,
  resolveAuthUser,
  roleDefaultDisplayOrder,
  setSessionCookie,
} from '../helpers.ts';
import type { RoleLabel } from '../../types/cmj.ts';

function sanitizePlainText(input: unknown, maxLen: number): string {
  return String(input || '')
    .replace(/[\u0000-\u001F\u007F<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function getClientIp(req: express.Request): string {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.socket.remoteAddress || req.ip || 'unknown';
}

export function registerAuthAndPublicRoutes(app: express.Express) {
  app.get('/api/health', async (req, res) => {
    const dbConfigured = hasDatabaseConfig();
    if (req.query.db === '1') {
      if (!dbConfigured) {
        res.status(503).json({
          ok: false,
          dbConfigured: false,
          error: 'Falta configurar DATABASE_URL o SQL_HOST en las variables de entorno.',
        });
        return;
      }
      try {
        await ensureMinimalStructure();
        res.json({ ok: true, dbConfigured: true, dbConnected: true });
      } catch (err) {
        console.error('DB health ping failed:', err);
        const pgErr = err as { code?: string };
        res.status(503).json({
          ok: false,
          dbConfigured: true,
          dbConnected: false,
          error: 'No se pudo conectar con la base de datos PostgreSQL.',
          errorCode: pgErr?.code || 'DB_CONNECT_ERROR',
        });
      }
      return;
    }
    res.json({ ok: true, dbConfigured });
  });

  app.use('/api', async (req, res, next) => {
    if (req.path === '/health' || req.path === '/auth/logout') {
      next();
      return;
    }
    if (!hasDatabaseConfig()) {
      res.status(503).json({
        error: 'La base de datos PostgreSQL aún no está conectada en este despliegue.',
        hint: 'En Vercel, ve a Settings → Environment Variables, agrega DATABASE_URL (o SQL_HOST, SQL_USER, SQL_PASSWORD, SQL_DB_NAME) y vuelve a desplegar.',
        code: 'DB_NOT_CONFIGURED',
      });
      return;
    }
    try {
      await ensureMinimalStructure();
      next();
    } catch (error) {
      console.error('Database initialization error:', error);
      res.status(503).json({
        error: 'No fue posible conectar con la base de datos del portal.',
        hint: 'Verifica que DATABASE_URL / credenciales PostgreSQL y las reglas de acceso estén activas.',
        code: 'DB_UNAVAILABLE',
      });
    }
  });

  app.get('/api/auth/me', async (req: AuthedRequest, res) => {
    try {
      const user = await resolveAuthUser(req);
      if (!user) {
        res.json({ user: null });
        return;
      }
      const token = signSessionToken(user.uid, user.email);
      setSessionCookie(req, res, token);
      res.json({ user, token });
    } catch (error) {
      console.error('Error checking current session:', error);
      res.status(503).json({
        error: 'No se pudo verificar la sesión temporalmente. Reintentando...',
        code: 'SESSION_CHECK_RETRY',
      });
    }
  });

  app.post('/api/auth/refresh', async (req: AuthedRequest, res) => {
    try {
      const user = await resolveAuthUser(req);
      if (!user) {
        clearSessionCookie(req, res);
        res.status(401).json({ error: 'Sesión no válida o expirada.' });
        return;
      }
      const token = signSessionToken(user.uid, user.email);
      setSessionCookie(req, res, token);
      res.json({ user, token });
    } catch (error) {
      console.error('Error refreshing session:', error);
      res.status(503).json({ error: 'No fue posible renovar la sesión.' });
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
            hint: 'Usa tu clave inicial institucional o ve a la pestaña "Activar clave" con el código de invitación.',
          });
          return;
        }

        const roleLabel: RoleLabel = isBootstrap
          ? 'Secretario'
          : ((allowRow?.roleLabel as RoleLabel) || 'Consejero');
        const accessTier = isBootstrap
          ? 'tier_3_sec'
          : allowRow?.accessTier || roleLabelToAccessTier(roleLabel);
        const commissionId = isBootstrap ? '' : (allowRow?.commissionId ?? '');
        const affiliationType = normalizeAffiliationType(allowRow?.affiliationType);
        const affiliationName = String(allowRow?.affiliationName || '').trim().slice(0, 120);
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
            verificado: isBootstrap,
            verificadoAt: isBootstrap ? new Date().toISOString() : '',
            mustChangePassword: !isBootstrap,
          })
          .onConflictDoNothing()
          .returning();

        if (inserted) {
          targetUser = inserted;
        } else {
          const [concurrentUser] = await db
            .select()
            .from(users)
            .where(eq(users.email, cleanEmail))
            .limit(1);
          if (!concurrentUser) {
            throw new Error('No fue posible aprovisionar el usuario.');
          }
          targetUser = concurrentUser;
        }

        await db
          .insert(allowedAccounts)
          .values({
            emailHash: emailH,
            email: cleanEmail,
            active: true,
            accessTier,
            roleLabel,
            commissionId,
            affiliationType,
            affiliationName,
            accountProvisioned: true,
            mustChangePassword: !isBootstrap,
          })
          .onConflictDoUpdate({
            target: allowedAccounts.emailHash,
            set: { accountProvisioned: true, updatedAt: new Date() },
          });

        const [comm] = commissionId
          ? await db
              .select()
              .from(commissions)
              .where(eq(commissions.id, commissionId))
              .limit(1)
          : [];

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
            commissionName: commissionId ? comm?.name || commissionId : 'Sin comisión',
            affiliationType,
            affiliationName,
            email: cleanEmail,
            phone: targetUser.phone || '',
            bio: isBootstrap
              ? 'Secretario del Consejo Municipal de Juventudes de Flandes, Tolima.'
              : pendingPub?.bio || '',
            photoUrl: pendingPub?.photoUrl || '',
            storagePath: pendingPub?.storagePath || '',
            active: true,
            verificado: isBootstrap,
            verificadoAt: isBootstrap ? new Date().toISOString() : '',
            displayOrder: isBootstrap
              ? 3
              : pendingPub?.displayOrder || roleDefaultDisplayOrder(roleLabel),
          })
          .onConflictDoNothing();
      }

      const [pub] = await db
        .select()
        .from(publicCouncilors)
        .where(eq(publicCouncilors.uid, targetUser.uid))
        .limit(1);

      if (pub && (!pub.email || (!pub.phone && targetUser.phone))) {
        await db
          .update(publicCouncilors)
          .set({
            email: pub.email || targetUser.email,
            phone: pub.phone || targetUser.phone || '',
          })
          .where(eq(publicCouncilors.uid, targetUser.uid));
      }

      const token = signSessionToken(targetUser.uid, targetUser.email);
      setSessionCookie(req, res, token);
      const userProfile = await buildAuthedUserProfile(targetUser);

      res.json({
        token,
        user: userProfile,
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
        const commissionId = isBootstrap ? '' : (allowRow?.commissionId ?? '');
        const affiliationType = normalizeAffiliationType(allowRow?.affiliationType);
        const affiliationName = String(allowRow?.affiliationName || '').trim().slice(0, 120);
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
            verificado: isBootstrap,
            verificadoAt: isBootstrap ? new Date().toISOString() : '',
            mustChangePassword: false,
          })
          .returning();
        finalUser = inserted;

        const [comm] = commissionId
          ? await db
              .select()
              .from(commissions)
              .where(eq(commissions.id, commissionId))
              .limit(1)
          : [];

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
            commissionName: commissionId ? comm?.name || commissionId : 'Sin comisión',
            affiliationType,
            affiliationName,
            email: targetEmail,
            phone: finalUser.phone || '',
            bio: isBootstrap
              ? 'Secretario del Consejo Municipal de Juventudes de Flandes, Tolima.'
              : pendingPub?.bio || '',
            photoUrl: pendingPub?.photoUrl || '',
            storagePath: pendingPub?.storagePath || '',
            active: true,
            verificado: isBootstrap,
            verificadoAt: isBootstrap ? new Date().toISOString() : '',
            displayOrder: isBootstrap
              ? 3
              : pendingPub?.displayOrder || roleDefaultDisplayOrder(roleLabel),
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
          affiliationType: normalizeAffiliationType(allowRow?.affiliationType),
          affiliationName: String(allowRow?.affiliationName || '').trim().slice(0, 120),
          accountProvisioned: true,
          mustChangePassword: false,
        })
        .onConflictDoUpdate({
          target: allowedAccounts.emailHash,
          set: { accountProvisioned: true, mustChangePassword: false, updatedAt: new Date() },
        });

      const token = signSessionToken(finalUser.uid, finalUser.email);
      setSessionCookie(req, res, token);
      const userProfile = await buildAuthedUserProfile(finalUser);

      res.json({
        token,
        user: userProfile,
      });
    } catch (error) {
      console.error('Activate/change password error:', error);
      res.status(500).json({ error: 'No fue posible actualizar la contraseña.' });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const ip = getClientIp(req);
      const rateKey = `register:${sha256Hex(ip)}`;
      const windowMs = 15 * 60 * 1000;
      const nowMs = Date.now();

      const [rateRow] = await db
        .select()
        .from(authRateLimits)
        .where(eq(authRateLimits.id, rateKey))
        .limit(1);

      if (rateRow?.lockedUntil) {
        const lockedMs = Date.parse(rateRow.lockedUntil);
        if (!Number.isNaN(lockedMs) && lockedMs > nowMs) {
          res.status(429).json({
            error:
              'Demasiados intentos fallidos desde esta dirección. Intenta nuevamente en 15 minutos.',
          });
          return;
        }
      }

      const expectedCode = (process.env.CMJ_ACTIVATION_CODE || '').trim();
      const expectedPassword = (process.env.CMJ_REGISTRATION_PASSWORD || '').trim();
      if (!expectedCode || !expectedPassword) {
        res.status(503).json({
          error:
            'El auto-registro público aún no está habilitado en este servidor. Solicita a la Secretaría que configure las variables de entorno de registro.',
        });
        return;
      }

      const body = req.body || {};
      const fullName = sanitizePlainText(body.fullName, 120);
      const cleanEmail = sanitizePlainText(body.email, 180).toLowerCase();
      const cargoDeclarado = sanitizePlainText(body.cargo || 'Consejero', 80) || 'Consejero';
      const commissionId = sanitizePlainText(body.commissionId, 64);
      const isCoordinatorDeclared = body.isCoordinator === true || body.isCoordinator === 'si';
      const initialPassword = typeof body.initialPassword === 'string' ? body.initialPassword.trim() : '';
      const activationCode = typeof body.activationCode === 'string' ? body.activationCode.trim() : '';

      if (fullName.length < 3) {
        res.status(400).json({ error: 'Ingresa tu nombre completo (mínimo 3 caracteres).' });
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        res.status(400).json({ error: 'Ingresa un correo electrónico válido.' });
        return;
      }
      if (!initialPassword || !activationCode) {
        res.status(400).json({
          error: 'Debes ingresar tanto la contraseña inicial como el código de activación.',
        });
        return;
      }

      // Evaluar ambos secretos en tiempo constante antes de decidir fallo (sin filtrar cuál falló)
      const codeOk = timingSafeEqualStrings(activationCode, expectedCode);
      const pwdOk = timingSafeEqualStrings(initialPassword, expectedPassword);

      if (!codeOk || !pwdOk) {
        const firstMs = rateRow?.firstAttemptAt ? Date.parse(rateRow.firstAttemptAt) : 0;
        const windowExpired = !firstMs || Number.isNaN(firstMs) || nowMs - firstMs > windowMs;
        const nextAttempts = windowExpired ? 1 : (rateRow?.attempts || 0) + 1;
        const nextFirstIso = windowExpired ? new Date(nowMs).toISOString() : rateRow!.firstAttemptAt;
        const nextLockedUntil =
          nextAttempts >= 5 ? new Date(nowMs + windowMs).toISOString() : '';

        await db
          .insert(authRateLimits)
          .values({
            id: rateKey,
            attempts: nextAttempts,
            firstAttemptAt: nextFirstIso,
            lockedUntil: nextLockedUntil,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: authRateLimits.id,
            set: {
              attempts: nextAttempts,
              firstAttemptAt: nextFirstIso,
              lockedUntil: nextLockedUntil,
              updatedAt: new Date(),
            },
          });

        await logServerAudit(
          { uid: 'public_register', fullName: fullName || cleanEmail, roleLabel: 'Consejero' },
          nextAttempts >= 5
            ? 'Intento fallido de auto-registro (bloqueo temporal IP 15m)'
            : 'Intento fallido de auto-registro (credenciales inválidas)',
          'Seguridad',
          cleanEmail
        );

        res.status(nextAttempts >= 5 ? 429 : 401).json({
          error:
            nextAttempts >= 5
              ? 'Demasiados intentos fallidos desde esta dirección. Intenta nuevamente en 15 minutos.'
              : 'Código de activación o contraseña inicial incorrectos.',
        });
        return;
      }

      const emailH = hashEmail(cleanEmail);
      const [existingUser, existingAllow] = await Promise.all([
        db.select({ uid: users.uid }).from(users).where(eq(users.email, cleanEmail)).limit(1),
        db
          .select({ emailHash: allowedAccounts.emailHash })
          .from(allowedAccounts)
          .where(eq(allowedAccounts.emailHash, emailH))
          .limit(1),
      ]);

      if (existingUser.length > 0 || existingAllow.length > 0) {
        res.status(409).json({
          error: 'Este correo electrónico ya está registrado en el portal. Inicia sesión o usa "Activar clave".',
        });
        return;
      }

      let commName = 'Sin comisión';
      if (commissionId) {
        const [commRow] = await db
          .select()
          .from(commissions)
          .where(eq(commissions.id, commissionId))
          .limit(1);
        if (!commRow) {
          res.status(400).json({ error: 'La comisión seleccionada no es válida.' });
          return;
        }
        commName = commRow.name;
      }

      // Asignar SIEMPRE el rol base más bajo ('Consejero') independientemente del cargo declarado
      const forcedRole: RoleLabel = 'Consejero';
      const forcedTier = roleLabelToAccessTier(forcedRole);
      const coordDeclaradaPendiente = Boolean(isCoordinatorDeclared && commissionId);
      const coordDeclaradaComisionId = coordDeclaradaPendiente ? commissionId : '';
      const uid = newId('uid');
      const passwordHash = hashPasswordScrypt(initialPassword);

      await db.insert(users).values({
        uid,
        email: cleanEmail,
        passwordHash,
        phone: '',
        accessTier: forcedTier,
        roleLabel: forcedRole,
        commissionId,
        active: true,
        verificado: false,
        verificadoAt: '',
        cargoDeclarado,
        coordDeclaradaPendiente,
        coordDeclaradaComisionId,
        mustChangePassword: true,
      });

      await db.insert(allowedAccounts).values({
        emailHash: emailH,
        email: cleanEmail,
        active: true,
        accessTier: forcedTier,
        roleLabel: forcedRole,
        commissionId,
        affiliationType: '',
        affiliationName: '',
        accountProvisioned: true,
        mustChangePassword: true,
      });

      await db.insert(publicCouncilors).values({
        id: uid,
        uid,
        fullName,
        roleLabel: forcedRole,
        commissionId,
        commissionName: commName,
        affiliationType: '',
        affiliationName: '',
        email: cleanEmail,
        phone: '',
        bio: '',
        photoUrl: '',
        storagePath: '',
        active: true,
        verificado: false,
        verificadoAt: '',
        cargoDeclarado,
        coordDeclaradaPendiente,
        coordDeclaradaComisionId,
        displayOrder: roleDefaultDisplayOrder(forcedRole),
      });

      await db.delete(authRateLimits).where(eq(authRateLimits.id, rateKey)).catch(() => undefined);

      // Notificar a toda la Mesa Directiva activa (Presidente, Vicepresidente, Secretario)
      const mesaMembers = await db
        .select({ uid: users.uid })
        .from(users)
        .where(
          and(
            eq(users.active, true),
            inArray(users.roleLabel, ['Presidente', 'Vicepresidente', 'Secretario'])
          )
        );
      const coordNote = coordDeclaradaPendiente
        ? ` Declaró coordinación en ${commName} (pendiente de confirmación).`
        : '';
      for (const m of mesaMembers) {
        await createPortalNotification({
          userUid: m.uid,
          type: 'general',
          title: 'Nuevo consejero auto-registrado (sin verificar)',
          message: `${fullName} (${cleanEmail}) se registró declarando cargo "${cargoDeclarado}".${coordNote} Revisa y verifica su perfil en Usuarios y Mesa.`,
          linkModule: 'usuarios',
          relatedId: uid,
        });
      }

      await logServerAudit(
        { uid, fullName, roleLabel: forcedRole },
        `Auto-registro completado (cargo declarado: ${cargoDeclarado}${coordDeclaradaPendiente ? ', coord. pendiente' : ''})`,
        'Usuarios y Mesa',
        `${fullName} (${cleanEmail})`
      );

      res.json({
        ok: true,
        email: cleanEmail,
        message: 'Registro exitoso. Por seguridad cambia tu contraseña al ingresar al portal privado.',
      });
    } catch (error) {
      console.error('Self-registration error:', error);
      res.status(500).json({ error: 'No fue posible completar el registro.' });
    }
  });

  app.post('/api/auth/change-password', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const currentPassword =
        typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
      const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
      const confirmPassword =
        typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';

      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: 'Completa tu contraseña actual y la nueva contraseña.' });
        return;
      }
      if (newPassword.length < 8) {
        res.status(400).json({
          error: 'La nueva contraseña debe tener al menos 8 caracteres.',
        });
        return;
      }
      if (newPassword !== confirmPassword) {
        res.status(400).json({ error: 'La confirmación no coincide con la nueva contraseña.' });
        return;
      }

      const [userRow] = await db
        .select()
        .from(users)
        .where(eq(users.uid, me.uid))
        .limit(1);
      if (!userRow) {
        res.status(404).json({ error: 'Cuenta de usuario no encontrada.' });
        return;
      }

      if (!verifySecretHash(currentPassword, userRow.passwordHash)) {
        res.status(401).json({ error: 'La contraseña actual es incorrecta.' });
        return;
      }
      if (currentPassword === newPassword) {
        res.status(400).json({ error: 'La nueva contraseña debe ser diferente a la actual.' });
        return;
      }

      const nextHash = hashPasswordScrypt(newPassword);
      const [updated] = await db
        .update(users)
        .set({
          passwordHash: nextHash,
          mustChangePassword: false,
          updatedAt: new Date(),
        })
        .where(eq(users.uid, me.uid))
        .returning();

      await db
        .update(allowedAccounts)
        .set({
          mustChangePassword: false,
          accountProvisioned: true,
          updatedAt: new Date(),
        })
        .where(eq(allowedAccounts.emailHash, hashEmail(userRow.email)));

      await logServerAudit(
        me,
        'Actualizó su contraseña personal',
        'Seguridad',
        userRow.email
      );

      const token = signSessionToken(updated.uid, updated.email);
      setSessionCookie(req, res, token);
      const userProfile = await buildAuthedUserProfile(updated);

      res.json({ ok: true, token, user: userProfile });
    } catch (error) {
      console.error('Change own password error:', error);
      res.status(500).json({ error: 'No fue posible actualizar tu contraseña.' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    clearSessionCookie(req, res);
    res.json({ ok: true });
  });

  app.get('/api/public/state', async (_req, res) => {
    try {
      await ensureMinimalStructure();
      const [
        settingsRows,
        commRows,
        pubRows,
        newsRows,
        galleryRows,
        albumRows,
        docRows,
        surveyRows,
        publicActaRows,
        publicDeptProposals,
        publicDeptOversight,
        publicDeptReports,
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
          .from(galleryAlbums)
          .where(eq(galleryAlbums.status, 'publicado'))
          .orderBy(desc(galleryAlbums.createdAt)),
        db
          .select()
          .from(documents)
          .where(eq(documents.visibility, 'publico'))
          .orderBy(desc(documents.createdAt)),
        db.select().from(callsSurveys).orderBy(desc(callsSurveys.createdAt)),
        db
          .select()
          .from(actas)
          .where(inArray(actas.status, ['aprobada', 'firmada', 'archivada']))
          .orderBy(desc(actas.year), desc(actas.createdAt)),
        db
          .select()
          .from(deptProposals)
          .where(and(eq(deptProposals.publicApproved, true), eq(deptProposals.visibility, 'publico')))
          .orderBy(desc(deptProposals.createdAt)),
        db
          .select()
          .from(deptOversight)
          .where(and(eq(deptOversight.publicApproved, true), eq(deptOversight.visibility, 'publico')))
          .orderBy(desc(deptOversight.createdAt)),
        db
          .select()
          .from(deptReports)
          .where(and(eq(deptReports.publicApproved, true), eq(deptReports.visibility, 'publico')))
          .orderBy(desc(deptReports.createdAt)),
      ]);

      const sortedGallery = [...galleryRows].sort((a, b) => {
        const orderDiff = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
        if (orderDiff !== 0) return orderDiff;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      const publicActas = publicActaRows.map((a) => ({
        ...a,
        comments: [],
        history: [],
      }));

      res.json({
        settings: settingsRows[0] || null,
        commissions: commRows.sort((a, b) => a.number - b.number),
        publicCouncilors: pubRows,
        newsEvents: newsRows,
        galleryItems: sortedGallery,
        galleryAlbums: albumRows,
        documents: docRows,
        callsSurveys: surveyRows,
        actas: publicActas,
        publicDepartamental: {
          proposals: publicDeptProposals.map(({ authorUid: _uid, ...rest }) => rest),
          oversight: publicDeptOversight.map(({ authorUid: _uid, ...rest }) => rest),
          reports: publicDeptReports.map(({ authorUid: _uid, ...rest }) => rest),
        },
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
}
