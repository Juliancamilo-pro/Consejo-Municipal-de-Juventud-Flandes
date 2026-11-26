import type express from 'express';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db, hasDatabaseConfig } from '../../db/index.ts';
import {
  actas,
  allowedAccounts,
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
  signSessionToken,
  verifySecretHash,
} from '../security.ts';
import {
  type AuthedRequest,
  buildAuthedUserProfile,
  buildPrivatePayload,
  clearSessionCookie,
  ensureMinimalStructure,
  getSecurityRecord,
  newId,
  normalizeAffiliationType,
  requireAuth,
  resolveAuthUser,
  roleDefaultDisplayOrder,
  setSessionCookie,
} from '../helpers.ts';
import type { RoleLabel } from '../../types/cmj.ts';

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
