import type express from 'express';
import {
  and,
  eq,
  ne,
} from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  allowedAccounts,
  callsSurveys,
  commissions,
  commissionTasks,
  commitments,
  contactMessages,
  documents,
  galleryItems,
  grantedPermissions,
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
} from '../../db/schema.ts';
import {
  hashEmail,
  hashPasswordScrypt,
  roleLabelToAccessTier,
} from '../security.ts';
import {
  type AuthedRequest,
  getSecurityRecord,
  isSafeUrl,
  logServerAudit,
  newId,
  normalizeAffiliationType,
  requireAuth,
  requirePermission,
  roleDefaultDisplayOrder,
  sendPermissionDenied,
  STRUCTURAL_COMMISSIONS_BASE,
  userHasPermission,
} from '../helpers.ts';
import type { RoleLabel } from '../../types/cmj.ts';

const DANGEROUS_EXTENSIONS = new Set([
  '.exe',
  '.bat',
  '.cmd',
  '.sh',
  '.js',
  '.mjs',
  '.cjs',
  '.msi',
  '.scr',
  '.vbs',
  '.ps1',
  '.dll',
  '.com',
  '.pif',
  '.jar',
  '.php',
  '.html',
  '.htm',
  '.hta',
]);

function inspectMagicSignature(buf: Buffer, mimeType: string): { ok: boolean; reason?: string } {
  if (buf.length < 2) return { ok: false, reason: 'El archivo está vacío o dañado.' };
  if (buf[0] === 0x4d && buf[1] === 0x5a) {
    return { ok: false, reason: 'No se permiten archivos ejecutables (PE/MZ).' };
  }
  if (buf.length >= 4 && buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) {
    return { ok: false, reason: 'No se permiten binarios ejecutables (ELF).' };
  }
  if (buf[0] === 0x23 && buf[1] === 0x21) {
    return { ok: false, reason: 'No se permiten scripts ejecutables (#!).' };
  }
  const lowerMime = mimeType.toLowerCase();
  if (lowerMime.includes('pdf')) {
    const head = buf.subarray(0, 5).toString('ascii');
    if (head !== '%PDF-') return { ok: false, reason: 'El archivo no tiene firma PDF válida.' };
  } else if (lowerMime === 'image/png') {
    if (!(buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47)) {
      return { ok: false, reason: 'La firma del archivo no corresponde a PNG.' };
    }
  } else if (lowerMime === 'image/jpeg' || lowerMime === 'image/jpg') {
    if (!(buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)) {
      return { ok: false, reason: 'La firma del archivo no corresponde a JPEG.' };
    }
  } else if (lowerMime === 'image/webp') {
    if (
      buf.length < 12 ||
      buf.subarray(0, 4).toString('ascii') !== 'RIFF' ||
      buf.subarray(8, 12).toString('ascii') !== 'WEBP'
    ) {
      return { ok: false, reason: 'La firma del archivo no corresponde a WebP.' };
    }
  } else if (lowerMime === 'image/gif') {
    const head = buf.subarray(0, 4).toString('ascii');
    if (head !== 'GIF8') return { ok: false, reason: 'La firma del archivo no corresponde a GIF.' };
  }
  return { ok: true };
}

function sanitizeSvgBuffer(buf: Buffer): Buffer {
  const raw = buf.toString('utf8');
  const cleaned = raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
    .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript\s*:/gi, 'blocked:');
  return Buffer.from(cleaned, 'utf8');
}

export function registerMediaAndUsersRoutes(app: express.Express) {
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

      const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200) || 'archivo';
      const dotIdx = safeFileName.lastIndexOf('.');
      const ext = dotIdx >= 0 ? safeFileName.slice(dotIdx).toLowerCase() : '';
      if (DANGEROUS_EXTENSIONS.has(ext)) {
        res.status(400).json({ error: `Extensión no permitida por seguridad (${ext}).` });
        return;
      }

      const lowerMime = mimeType.toLowerCase().trim();
      const allowedPrefix = ['image/', 'video/', 'audio/', 'application/', 'text/'].some((p) =>
        lowerMime.startsWith(p)
      );
      if (!allowedPrefix || lowerMime === 'text/html' || lowerMime.includes('javascript')) {
        res.status(400).json({ error: 'Tipo de archivo no permitido.' });
        return;
      }

      let buffer: Buffer = Buffer.from(base64Data, 'base64');
      const actualSize = buffer.length || Number(fileSize) || Math.floor((base64Data.length * 3) / 4);
      const maxForType = lowerMime.startsWith('image/')
        ? 10 * 1024 * 1024
        : lowerMime.startsWith('video/')
        ? 20 * 1024 * 1024
        : 15 * 1024 * 1024;
      if (actualSize > maxForType || actualSize > 20 * 1024 * 1024) {
        res.status(400).json({
          error: `El archivo supera el límite permitido (${Math.round(maxForType / (1024 * 1024))} MB).`,
        });
        return;
      }

      const sigCheck = inspectMagicSignature(buffer, lowerMime);
      if (!sigCheck.ok) {
        res.status(400).json({ error: sigCheck.reason || 'Archivo rechazado por validación de contenido.' });
        return;
      }

      let storedBase64 = base64Data;
      if (lowerMime.includes('svg')) {
        buffer = sanitizeSvgBuffer(buffer);
        storedBase64 = buffer.toString('base64');
      }

      const id = newId('media');
      await db.insert(mediaFiles).values({
        id,
        fileName: safeFileName,
        mimeType: lowerMime.slice(0, 120),
        fileSize: buffer.length,
        contentBase64: storedBase64,
        uploadedByUid: req.authUser!.uid,
      });

      res.json({
        id,
        url: `/api/media/${id}`,
        storagePath: `db-media/${id}`,
        fileName: safeFileName,
        mimeType: lowerMime,
        fileSize: buffer.length,
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
      const mime = (file.mimeType || 'application/octet-stream').toLowerCase();
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Length', String(buffer.length));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      res.setHeader('Cache-Control', 'public, max-age=31536000');

      const inlineSafe =
        (mime.startsWith('image/') && !mime.includes('svg')) ||
        mime.startsWith('video/') ||
        mime.startsWith('audio/') ||
        mime === 'application/pdf';

      if (mime.includes('svg') || !inlineSafe) {
        res.setHeader('Content-Security-Policy', 'sandbox');
      }
      if (!inlineSafe) {
        const cleanName = (file.fileName || 'archivo').replace(/["\r\n]/g, '');
        res.setHeader('Content-Disposition', `attachment; filename="${cleanName}"`);
      }

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
      const me = req.authUser!;
      if (
        file.uploadedByUid !== me.uid &&
        !userHasPermission(me, 'documentos.eliminar') &&
        !userHasPermission(me, 'galeria.gestionar')
      ) {
        sendPermissionDenied(res, 'documentos.eliminar');
        return;
      }
      await db.delete(mediaFiles).where(eq(mediaFiles.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Media delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar el archivo.' });
    }
  });

  app.post('/api/councilors', requireAuth, requirePermission('usuarios.crear'), async (req: AuthedRequest, res) => {
    try {
      const {
        fullName,
        email,
        phone,
        roleLabel,
        commissionId,
        affiliationType,
        affiliationName,
      } = req.body || {};
      const cleanEmail = String(email || '').trim().toLowerCase();
      const cleanName = String(fullName || '').trim();
      if (!cleanEmail || !cleanName) {
        res.status(400).json({ error: 'Completa nombre y correo electrónico.' });
        return;
      }

      const validRole: RoleLabel = [
        'Presidente',
        'Vicepresidente',
        'Secretario',
        'Consejero Departamental',
        'Consejero',
      ].includes(roleLabel)
        ? roleLabel
        : 'Consejero';
      if (validRole === 'Presidente' && !userHasPermission(req.authUser!, 'usuarios.asignar_presidencia')) {
        const activePresidents = await db
          .select({ uid: users.uid })
          .from(users)
          .where(and(eq(users.roleLabel, 'Presidente'), eq(users.active, true)));
        if (activePresidents.length > 0) {
          sendPermissionDenied(
            res,
            'usuarios.asignar_presidencia',
            undefined,
            'Solo Presidencia puede autorizar o designar otra cuenta con cargo de Presidente.'
          );
          return;
        }
      }
      const accessTier = roleLabelToAccessTier(validRole);
      const commId = typeof commissionId === 'string' ? commissionId.trim() : '';
      const safeAffType = normalizeAffiliationType(affiliationType);
      const safeAffName =
        safeAffType === 'independiente' && !String(affiliationName || '').trim()
          ? 'Lista Independiente'
          : String(affiliationName || '').trim().slice(0, 120);
      const emailH = hashEmail(cleanEmail);
      const sec = await getSecurityRecord();

      const [comm] = commId
        ? await db.select().from(commissions).where(eq(commissions.id, commId)).limit(1)
        : [];
      const commName = commId ? comm?.name || commId : 'Sin comisión';
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
          affiliationType: safeAffType,
          affiliationName: safeAffName,
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
            affiliationType: safeAffType,
            affiliationName: safeAffName,
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

      const cleanPhone = String(phone || existingUser?.phone || '').trim().slice(0, 40);
      await db
        .insert(publicCouncilors)
        .values({
          id: uid,
          uid,
          fullName: cleanName,
          roleLabel: validRole,
          commissionId: commId,
          commissionName: commName,
          affiliationType: safeAffType,
          affiliationName: safeAffName,
          email: cleanEmail,
          phone: cleanPhone,
          bio: '',
          photoUrl: '',
          storagePath: '',
          active: true,
          displayOrder: roleDefaultDisplayOrder(validRole),
        })
        .onConflictDoUpdate({
          target: publicCouncilors.id,
          set: {
            fullName: cleanName,
            roleLabel: validRole,
            commissionId: commId,
            commissionName: commName,
            affiliationType: safeAffType,
            affiliationName: safeAffName,
            email: cleanEmail,
            phone: cleanPhone,
            displayOrder: roleDefaultDisplayOrder(validRole),
            active: true,
            updatedAt: new Date(),
          },
        });

      await logServerAudit(
        req.authUser!,
        `Autorizó usuario (${validRole})`,
        'Usuarios y Mesa',
        `${cleanName} (${cleanEmail})`
      );

      res.json({ uid, ok: true });
    } catch (error) {
      console.error('Create councilor failed:', error);
      res.status(500).json({ error: 'No fue posible registrar al consejero.' });
    }
  });

  app.post('/api/councilors/bulk', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      if (!userHasPermission(me, 'usuarios.crear')) {
        sendPermissionDenied(res, 'usuarios.crear');
        return;
      }
      if (!userHasPermission(me, 'planillas.importar')) {
        sendPermissionDenied(res, 'planillas.importar');
        return;
      }
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      if (!items.length) {
        res.status(400).json({ error: 'No hay filas válidas para importar.' });
        return;
      }

      const sec = await getSecurityRecord();
      const allComms = await db.select().from(commissions);
      const canAssignPres = userHasPermission(me, 'usuarios.asignar_presidencia');
      let imported = 0;

      for (const row of items.slice(0, 100)) {
        const cleanEmail = String(row.email || '').trim().toLowerCase();
        const cleanName = String(row.fullName || '').trim();
        if (!cleanEmail || !cleanEmail.includes('@') || !cleanName) continue;

        let validRole: RoleLabel = [
          'Presidente',
          'Vicepresidente',
          'Secretario',
          'Consejero Departamental',
          'Consejero',
        ].includes(row.roleLabel)
          ? row.roleLabel
          : 'Consejero';
        if (validRole === 'Presidente' && !canAssignPres) {
          validRole = 'Consejero';
        }
        const accessTier = roleLabelToAccessTier(validRole);
        const commId = typeof row.commissionId === 'string' ? row.commissionId.trim() : '';
        const commName = commId
          ? allComms.find((c) => c.id === commId)?.name || commId
          : 'Sin comisión';
        const safeAffType = normalizeAffiliationType(row.affiliationType);
        const safeAffName = String(row.affiliationName || '').trim().slice(0, 120);
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
            affiliationType: safeAffType,
            affiliationName: safeAffName,
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
              affiliationType: safeAffType,
              affiliationName: safeAffName,
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
        } else {
          await db
            .update(users)
            .set({
              phone: String(row.phone || existingUser.phone).trim(),
              accessTier,
              roleLabel: validRole,
              commissionId: commId,
              active: true,
              updatedAt: new Date(),
            })
            .where(eq(users.uid, uid));
        }

        const cleanBulkPhone = String(row.phone || existingUser?.phone || '').trim().slice(0, 40);
        await db
          .insert(publicCouncilors)
          .values({
            id: uid,
            uid,
            fullName: cleanName,
            roleLabel: validRole,
            commissionId: commId,
            commissionName: commName,
            affiliationType: safeAffType,
            affiliationName: safeAffName,
            email: cleanEmail,
            phone: cleanBulkPhone,
            bio: '',
            photoUrl: '',
            storagePath: '',
            active: true,
            displayOrder:
              validRole === 'Consejero' ? 20 + imported : roleDefaultDisplayOrder(validRole),
          })
          .onConflictDoUpdate({
            target: publicCouncilors.id,
            set: {
              fullName: cleanName,
              roleLabel: validRole,
              commissionId: commId,
              commissionName: commName,
              affiliationType: safeAffType,
              affiliationName: safeAffName,
              email: cleanEmail,
              phone: cleanBulkPhone,
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
      const me = req.authUser!;
      const canEditUsers = userHasPermission(me, 'usuarios.editar');
      const canToggleActive = userHasPermission(me, 'usuarios.desactivar');
      const isSelf = me.uid === targetUid;

      if (!canEditUsers && !canToggleActive && !isSelf) {
        sendPermissionDenied(res, 'usuarios.editar');
        return;
      }

      const body = req.body || {};
      const [existingPub] = await db
        .select()
        .from(publicCouncilors)
        .where(eq(publicCouncilors.uid, targetUid))
        .limit(1);
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.uid, targetUid))
        .limit(1);

      // Anti-escalación estricta: nadie puede cambiar su propio cargo, tier o estado activo
      if (isSelf) {
        if (typeof body.roleLabel === 'string' && existingUser && body.roleLabel !== existingUser.roleLabel) {
          res.status(403).json({ error: 'Seguridad RBAC: no puedes modificar tu propio cargo o nivel de acceso.' });
          return;
        }
        if (typeof body.active === 'boolean' && existingUser && body.active !== existingUser.active) {
          res.status(403).json({ error: 'Seguridad RBAC: no puedes activar o suspender tu propia cuenta.' });
          return;
        }
      }

      const pubPatch: Record<string, unknown> = { updatedAt: new Date() };
      const userPatch: Record<string, unknown> = { updatedAt: new Date() };
      const allowPatch: Record<string, unknown> = { updatedAt: new Date() };
      let shouldUpdateAllow = false;

      if (typeof body.fullName === 'string' && body.fullName.trim()) {
        pubPatch.fullName = body.fullName.trim().slice(0, 120);
      }
      if (typeof body.bio === 'string') pubPatch.bio = body.bio.trim().slice(0, 600);
      if (typeof body.instagram === 'string') pubPatch.instagram = body.instagram.trim().slice(0, 120);
      if (typeof body.facebook === 'string') pubPatch.facebook = body.facebook.trim().slice(0, 120);
      if (body.photoUrl === '') {
        pubPatch.photoUrl = '';
        pubPatch.photoThumbUrl = '';
        pubPatch.photoMediumUrl = '';
      } else if (typeof body.photoUrl === 'string' && isSafeUrl(body.photoUrl)) {
        pubPatch.photoUrl = body.photoUrl;
      }
      if (body.photoThumbUrl === '') {
        pubPatch.photoThumbUrl = '';
      } else if (typeof body.photoThumbUrl === 'string' && isSafeUrl(body.photoThumbUrl)) {
        pubPatch.photoThumbUrl = body.photoThumbUrl;
      }
      if (body.photoMediumUrl === '') {
        pubPatch.photoMediumUrl = '';
      } else if (typeof body.photoMediumUrl === 'string' && isSafeUrl(body.photoMediumUrl)) {
        pubPatch.photoMediumUrl = body.photoMediumUrl;
      }
      if (typeof body.storagePath === 'string') pubPatch.storagePath = body.storagePath.slice(0, 512);
      if (typeof body.phone === 'string') {
        const cleanPhone = body.phone.trim().slice(0, 40);
        userPatch.phone = cleanPhone;
        pubPatch.phone = cleanPhone;
      }

      if (typeof body.email === 'string' && body.email.trim()) {
        const nextEmail = body.email.trim().toLowerCase().slice(0, 180);
        if (nextEmail.includes('@')) {
          if (canEditUsers && existingUser && nextEmail !== existingUser.email) {
            const [collision] = await db
              .select({ uid: users.uid })
              .from(users)
              .where(eq(users.email, nextEmail))
              .limit(1);
            if (collision && collision.uid !== targetUid) {
              res.status(409).json({ error: 'Ese correo electrónico ya pertenece a otro consejero.' });
              return;
            }
            const oldHash = hashEmail(existingUser.email);
            const newHash = hashEmail(nextEmail);
            await db.delete(allowedAccounts).where(eq(allowedAccounts.emailHash, oldHash));
            await db
              .insert(allowedAccounts)
              .values({
                emailHash: newHash,
                email: nextEmail,
                active: typeof body.active === 'boolean' ? body.active : existingUser.active,
                accessTier: existingUser.accessTier,
                roleLabel: existingUser.roleLabel,
                commissionId: existingUser.commissionId,
                affiliationType: normalizeAffiliationType(existingPub?.affiliationType),
                affiliationName: String(existingPub?.affiliationName || ''),
                accountProvisioned: true,
                mustChangePassword: existingUser.mustChangePassword,
              })
              .onConflictDoUpdate({
                target: allowedAccounts.emailHash,
                set: { email: nextEmail, active: true, updatedAt: new Date() },
              });
            userPatch.email = nextEmail;
            pubPatch.email = nextEmail;
          } else {
            pubPatch.email = nextEmail;
          }
        }
      } else if (!canEditUsers && typeof body.email === 'string' && !body.email.trim()) {
        pubPatch.email = '';
      } else if (existingPub && !existingPub.email && existingUser?.email) {
        pubPatch.email = existingUser.email;
      }

      if (typeof body.affiliationType === 'string') {
        const safeAff = normalizeAffiliationType(body.affiliationType);
        pubPatch.affiliationType = safeAff;
        allowPatch.affiliationType = safeAff;
        shouldUpdateAllow = true;
      }
      if (typeof body.affiliationName === 'string') {
        const cleanAffName = body.affiliationName.trim().slice(0, 120);
        pubPatch.affiliationName = cleanAffName;
        allowPatch.affiliationName = cleanAffName;
        shouldUpdateAllow = true;
      }

      if (canEditUsers && !isSelf) {
        if (
          typeof body.roleLabel === 'string' &&
          [
            'Presidente',
            'Vicepresidente',
            'Secretario',
            'Consejero Departamental',
            'Consejero',
          ].includes(body.roleLabel)
        ) {
          const validRole = body.roleLabel as RoleLabel;
          const touchesPresidency =
            validRole === 'Presidente' || existingUser?.roleLabel === 'Presidente';
          if (touchesPresidency && !userHasPermission(me, 'usuarios.asignar_presidencia')) {
            const activePresidents = await db
              .select({ uid: users.uid })
              .from(users)
              .where(and(eq(users.roleLabel, 'Presidente'), eq(users.active, true)));
            const allowBootstrapPres = validRole === 'Presidente' && activePresidents.length === 0;
            if (!allowBootstrapPres) {
              sendPermissionDenied(
                res,
                'usuarios.asignar_presidencia',
                undefined,
                'Solo Presidencia puede asignar o relevar el cargo de Presidente.'
              );
              return;
            }
          }
          const tier = roleLabelToAccessTier(validRole);
          pubPatch.roleLabel = validRole;
          pubPatch.displayOrder = roleDefaultDisplayOrder(validRole);
          userPatch.roleLabel = validRole;
          userPatch.accessTier = tier;
          allowPatch.roleLabel = validRole;
          allowPatch.accessTier = tier;
          shouldUpdateAllow = true;
        }
        if (typeof body.commissionId === 'string') {
          const cleanCommId = body.commissionId.trim();
          const [comm] = cleanCommId
            ? await db
                .select()
                .from(commissions)
                .where(eq(commissions.id, cleanCommId))
                .limit(1)
            : [];
          pubPatch.commissionId = cleanCommId;
          pubPatch.commissionName = cleanCommId ? comm?.name || cleanCommId : 'Sin comisión';
          userPatch.commissionId = cleanCommId;
          allowPatch.commissionId = cleanCommId;
          shouldUpdateAllow = true;
        }
      }

      if (typeof body.active === 'boolean' && !isSelf) {
        if (!canToggleActive) {
          sendPermissionDenied(res, 'usuarios.desactivar');
          return;
        }
        if (existingUser?.roleLabel === 'Presidente' && !userHasPermission(me, 'usuarios.asignar_presidencia')) {
          sendPermissionDenied(res, 'usuarios.asignar_presidencia');
          return;
        }
        pubPatch.active = body.active;
        userPatch.active = body.active;
        allowPatch.active = body.active;
        shouldUpdateAllow = true;

        // Si se desactiva el usuario, revocar automáticamente cualquier coordinación de comisión y permisos especiales
        if (!body.active) {
          await db
            .update(commissions)
            .set({ coordinatorUid: '', coordinatorName: 'Por asignar', updatedAt: new Date() })
            .where(eq(commissions.coordinatorUid, targetUid));
          await db
            .update(grantedPermissions)
            .set({
              active: false,
              revokedAt: new Date().toISOString(),
              revokedByUid: me.uid,
              revokedByName: me.fullName,
              revocationReason: 'Cuenta suspendida en el directorio institucional.',
            })
            .where(and(eq(grantedPermissions.userUid, targetUid), eq(grantedPermissions.active, true)));
          await logServerAudit(
            me,
            'Suspendió cuenta y revocó coordinación/permisos especiales',
            'Usuarios y Mesa',
            existingPub?.fullName || existingUser?.email || targetUid
          );
        }
      }

      if (existingPub) {
        await db
          .update(publicCouncilors)
          .set(pubPatch)
          .where(eq(publicCouncilors.uid, targetUid));
      } else if (existingUser) {
        const fallbackRole = ((pubPatch.roleLabel as RoleLabel) ||
          (existingUser.roleLabel as RoleLabel) ||
          'Consejero') as RoleLabel;
        await db.insert(publicCouncilors).values({
          id: targetUid,
          uid: targetUid,
          fullName:
            (pubPatch.fullName as string) ||
            existingUser.email.split('@')[0] ||
            'Consejero CMJ',
          roleLabel: fallbackRole,
          commissionId: (pubPatch.commissionId as string) ?? existingUser.commissionId ?? '',
          commissionName: (pubPatch.commissionName as string) || 'Sin comisión',
          affiliationType: (pubPatch.affiliationType as string) || '',
          affiliationName: (pubPatch.affiliationName as string) || '',
          email: (pubPatch.email as string) || existingUser.email,
          phone: (pubPatch.phone as string) ?? existingUser.phone ?? '',
          bio: (pubPatch.bio as string) || '',
          photoUrl: (pubPatch.photoUrl as string) || '',
          photoThumbUrl: (pubPatch.photoThumbUrl as string) || '',
          photoMediumUrl: (pubPatch.photoMediumUrl as string) || '',
          storagePath: (pubPatch.storagePath as string) || '',
          instagram: (pubPatch.instagram as string) || '',
          facebook: (pubPatch.facebook as string) || '',
          active: existingUser.active,
          displayOrder: roleDefaultDisplayOrder(fallbackRole),
        });
      }

      if (existingPub && typeof pubPatch.photoUrl === 'string' && pubPatch.photoUrl !== existingPub.photoUrl) {
        const oldCandidates = [
          existingPub.storagePath,
          existingPub.photoUrl,
          existingPub.photoThumbUrl,
          existingPub.photoMediumUrl,
        ];
        for (const candidate of oldCandidates) {
          if (!candidate) continue;
          const m = String(candidate).match(/(?:db-media\/|\/api\/media\/)([A-Za-z0-9_-]+)/);
          if (m?.[1]) {
            await db.delete(mediaFiles).where(eq(mediaFiles.id, m[1])).catch(() => undefined);
          }
        }
      }

      if (existingUser) {
        await db.update(users).set(userPatch).where(eq(users.uid, targetUid));
        if (shouldUpdateAllow) {
          const emailForAllow = (userPatch.email as string) || existingUser.email;
          await db
            .update(allowedAccounts)
            .set(allowPatch)
            .where(eq(allowedAccounts.emailHash, hashEmail(emailForAllow)));
        }
      }

      res.json({ ok: true });
    } catch (error) {
      console.error('Update councilor failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar el consejero.' });
    }
  });

  app.delete('/api/councilors/:uid', requireAuth, requirePermission('usuarios.eliminar'), async (req: AuthedRequest, res) => {
    try {
      const targetUid = String(req.params.uid);
      if (targetUid === req.authUser!.uid) {
        res.status(400).json({ error: 'No puedes eliminar tu propia cuenta activa.' });
        return;
      }

      const [existingUser] = await db.select().from(users).where(eq(users.uid, targetUid)).limit(1);
      if (
        existingUser?.roleLabel === 'Presidente' &&
        !userHasPermission(req.authUser!, 'usuarios.asignar_presidencia')
      ) {
        sendPermissionDenied(
          res,
          'usuarios.asignar_presidencia',
          undefined,
          'Solo Presidencia puede eliminar una cuenta con cargo de Presidente.'
        );
        return;
      }

      // Desvincular coordinación de comisiones y permisos especiales antes de borrar
      await db
        .update(commissions)
        .set({ coordinatorUid: '', coordinatorName: 'Por asignar', updatedAt: new Date() })
        .where(eq(commissions.coordinatorUid, targetUid));
      await db.delete(grantedPermissions).where(eq(grantedPermissions.userUid, targetUid));

      if (existingUser) {
        await db
          .delete(allowedAccounts)
          .where(eq(allowedAccounts.emailHash, hashEmail(existingUser.email)));
        await db.delete(users).where(eq(users.uid, targetUid));
      }
      await db.delete(publicCouncilors).where(eq(publicCouncilors.uid, targetUid));

      await logServerAudit(
        req.authUser!,
        'Eliminó cuenta del directorio',
        'Usuarios y Mesa',
        existingUser?.email || targetUid
      );

      res.json({ ok: true });
    } catch (error) {
      console.error('Delete councilor failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar el registro.' });
    }
  });

  app.post('/api/security/rotate', requireAuth, requirePermission('usuarios.credenciales_rotar'), async (req: AuthedRequest, res) => {
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

      await logServerAudit(
        req.authUser!,
        'Rotó credenciales institucionales de activación',
        'Seguridad',
        'Código de invitación / clave inicial'
      );

      res.json({ ok: true });
    } catch (error) {
      console.error('Security rotation failed:', error);
      res.status(500).json({ error: 'No fue posible rotar las credenciales institucionales.' });
    }
  });

  app.post('/api/portal/purge-samples', requireAuth, requirePermission('usuarios.purgar_ejemplos'), async (req: AuthedRequest, res) => {
    try {

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
}
