import type express from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  allowedAccounts,
  commissions,
  commissionTasks,
  galleryAlbums,
  galleryItems,
  newsEvents,
  publicCouncilors,
  users,
} from '../../db/schema.ts';
import { hashEmail } from '../security.ts';
import {
  type AuthedRequest,
  createPortalNotification,
  isSafeUrl,
  logServerAudit,
  newId,
  requireAuth,
  sendPermissionDenied,
  userHasPermission,
} from '../helpers.ts';

export function registerCommissionsAndContentRoutes(app: express.Express) {
  // Editar comisión: Mesa (comision.editar_todas), Coordinador activo sobre SU comisión (comision.editar_propia) o delegado especial
  app.patch('/api/commissions/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id);
      const me = req.authUser!;
      const [existing] = await db.select().from(commissions).where(eq(commissions.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: 'Comisión no encontrada.' });
        return;
      }

      const canEditAll = userHasPermission(me, 'comision.editar_todas');
      const isActiveCoord = existing.coordinatorUid === me.uid;
      const canEditOwn = isActiveCoord && userHasPermission(me, 'comision.editar_propia', id);
      const canAssignCoord = userHasPermission(me, 'comision.coordinador_asignar');

      const body = req.body || {};
      const requestsCoordChange =
        typeof body.coordinatorUid === 'string' && body.coordinatorUid.trim() !== existing.coordinatorUid;

      if (requestsCoordChange && !canAssignCoord) {
        sendPermissionDenied(res, 'comision.coordinador_asignar', id);
        return;
      }

      if (!canEditAll && !canEditOwn && !(requestsCoordChange && canAssignCoord)) {
        sendPermissionDenied(
          res,
          'comision.editar_propia',
          id,
          'Solo Presidencia, Vicepresidencia o el coordinador activo de esta comisión pueden editarla. Puedes solicitarlo aquí.'
        );
        return;
      }

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (canEditAll || canEditOwn) {
        if (typeof body.description === 'string') patch.description = body.description.slice(0, 800);
        if (typeof body.workPlanSummary === 'string') {
          patch.workPlanSummary = body.workPlanSummary.slice(0, 1200);
        }
        if (typeof body.coverUrl === 'string' && isSafeUrl(body.coverUrl)) {
          patch.coverUrl = body.coverUrl;
        }
        if (typeof body.storagePath === 'string') patch.storagePath = body.storagePath.slice(0, 512);
        if (typeof body.accentColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(body.accentColor.trim())) {
          patch.accentColor = body.accentColor.trim();
        }
        if (
          typeof body.iconName === 'string' &&
          [
            'BookOpen',
            'Briefcase',
            'HeartPulse',
            'Leaf',
            'Scale',
            'Users',
            'Sparkles',
            'Shield',
            'Megaphone',
            'Globe',
          ].includes(body.iconName)
        ) {
          patch.iconName = body.iconName;
        }
        if (canEditAll && typeof body.name === 'string' && body.name.trim()) {
          patch.name = body.name.trim().slice(0, 120);
        }
      }

      // Asignación o cambio de coordinador validando usuario activo real
      if (canAssignCoord && typeof body.coordinatorUid === 'string') {
        const nextCoordUid = body.coordinatorUid.trim().slice(0, 128);
        if (!nextCoordUid) {
          patch.coordinatorUid = '';
          patch.coordinatorName = 'Por asignar';
          if (existing.coordinatorUid) {
            await createPortalNotification({
              userUid: existing.coordinatorUid,
              type: 'comision_coordinador',
              title: 'Actualización de coordinación',
              message: `${me.fullName} dejó vacante la coordinación de ${existing.name}.`,
              linkModule: 'comisiones',
              relatedId: id,
            });
          }
          await logServerAudit(me, 'Liberó coordinación de comisión', 'Comisiones', existing.name);
        } else {
          const [targetUser] = await db
            .select()
            .from(users)
            .where(and(eq(users.uid, nextCoordUid), eq(users.active, true)))
            .limit(1);
          if (!targetUser) {
            res.status(400).json({
              error: 'El coordinador seleccionado debe ser un usuario activo registrado en el portal.',
            });
            return;
          }
          const [pubTarget] = await db
            .select()
            .from(publicCouncilors)
            .where(eq(publicCouncilors.uid, nextCoordUid))
            .limit(1);
          const resolvedCoordName =
            pubTarget?.fullName ||
            (typeof body.coordinatorName === 'string' ? body.coordinatorName.trim() : '') ||
            targetUser.email.split('@')[0];

          patch.coordinatorUid = targetUser.uid;
          patch.coordinatorName = resolvedCoordName.slice(0, 120);

          await Promise.all([
            db
              .update(users)
              .set({ coordDeclaradaPendiente: false, coordDeclaradaComisionId: '', updatedAt: new Date() })
              .where(eq(users.uid, targetUser.uid)),
            db
              .update(publicCouncilors)
              .set({ coordDeclaradaPendiente: false, coordDeclaradaComisionId: '', updatedAt: new Date() })
              .where(eq(publicCouncilors.uid, targetUser.uid)),
          ]);

          if (existing.coordinatorUid !== targetUser.uid) {
            if (existing.coordinatorUid) {
              await createPortalNotification({
                userUid: existing.coordinatorUid,
                type: 'comision_coordinador',
                title: 'Relevo de coordinación de comisión',
                message: `Se reasignó la coordinación de ${existing.name} a ${resolvedCoordName}.`,
                linkModule: 'comisiones',
                relatedId: id,
              });
            }
            await createPortalNotification({
              userUid: targetUser.uid,
              type: 'comision_coordinador',
              title: `Designado coordinador: ${existing.name}`,
              message: `${me.fullName} te asignó como coordinador. Ya cuentas con permisos de gestión sobre integrantes, plan de trabajo y tareas de esta comisión.`,
              linkModule: 'comisiones',
              relatedId: id,
            });
            await logServerAudit(
              me,
              `Asignó coordinación a ${resolvedCoordName}`,
              'Comisiones',
              existing.name
            );
          }
        }
      }

      await db.update(commissions).set(patch).where(eq(commissions.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Commission update failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar la comisión.' });
    }
  });

  // Agregar o retirar integrantes de una comisión (Coordinador activo sobre su comisión o Presidencia/VP)
  app.patch('/api/commissions/:id/members', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const commissionId = String(req.params.id);
      const me = req.authUser!;
      const [comm] = await db
        .select()
        .from(commissions)
        .where(eq(commissions.id, commissionId))
        .limit(1);
      if (!comm) {
        res.status(404).json({ error: 'Comisión no encontrada.' });
        return;
      }

      const canAll = userHasPermission(me, 'comision.editar_todas');
      const isCoord = comm.coordinatorUid === me.uid && userHasPermission(me, 'comision.miembros_gestionar', commissionId);
      const hasScopedGrant = userHasPermission(me, 'comision.miembros_gestionar', commissionId);

      if (!canAll && !isCoord && !hasScopedGrant) {
        sendPermissionDenied(res, 'comision.miembros_gestionar', commissionId);
        return;
      }

      const action = req.body?.action === 'remove' ? 'remove' : 'add';
      const targetUid = String(req.body?.targetUid || '').trim();
      if (!targetUid) {
        res.status(400).json({ error: 'Selecciona el consejero.' });
        return;
      }

      const [targetUser] = await db
        .select()
        .from(users)
        .where(and(eq(users.uid, targetUid), eq(users.active, true)))
        .limit(1);
      if (!targetUser) {
        res.status(404).json({ error: 'El consejero no está activo en el sistema.' });
        return;
      }

      if (action === 'remove' && comm.coordinatorUid === targetUid) {
        res.status(400).json({
          error: 'No puedes retirar al coordinador actual sin antes relevar su coordinación.',
        });
        return;
      }

      const nextCommissionId = action === 'add' ? commissionId : '';
      const nextCommissionName = action === 'add' ? comm.name : 'Sin comisión';

      await db
        .update(users)
        .set({ commissionId: nextCommissionId, updatedAt: new Date() })
        .where(eq(users.uid, targetUid));
      await db
        .update(allowedAccounts)
        .set({ commissionId: nextCommissionId, updatedAt: new Date() })
        .where(eq(allowedAccounts.emailHash, hashEmail(targetUser.email)));
      await db
        .update(publicCouncilors)
        .set({
          commissionId: nextCommissionId,
          commissionName: nextCommissionName,
          updatedAt: new Date(),
        })
        .where(eq(publicCouncilors.uid, targetUid));

      const [pub] = await db
        .select()
        .from(publicCouncilors)
        .where(eq(publicCouncilors.uid, targetUid))
        .limit(1);

      await createPortalNotification({
        userUid: targetUid,
        type: 'comision_coordinador',
        title: action === 'add' ? `Vinculado a ${comm.name}` : `Desvinculado de ${comm.name}`,
        message:
          action === 'add'
            ? `${me.fullName} te vinculó como integrante de ${comm.name}.`
            : `${me.fullName} actualizó tu asignación fuera de ${comm.name}.`,
        linkModule: 'comisiones',
        relatedId: commissionId,
      });

      await logServerAudit(
        me,
        action === 'add' ? `Vinculó integrante a ${comm.name}` : `Retiró integrante de ${comm.name}`,
        'Comisiones',
        pub?.fullName || targetUser.email
      );

      res.json({ ok: true });
    } catch (error) {
      console.error('Commission member update failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar los integrantes de la comisión.' });
    }
  });

  app.post('/api/commission-tasks', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const { commissionId, title, status, assignedName, dueDate } = req.body || {};
      const cleanCommId = String(commissionId || '').trim();
      if (!cleanCommId || !title) {
        res.status(400).json({ error: 'Faltan campos obligatorios.' });
        return;
      }

      const canManageCommTasks =
        userHasPermission(me, 'comision.editar_todas') ||
        userHasPermission(me, 'comision.tareas_gestionar', cleanCommId) ||
        me.commissionId === cleanCommId;

      if (!canManageCommTasks) {
        sendPermissionDenied(
          res,
          'comision.tareas_gestionar',
          cleanCommId,
          'No perteneces a esta comisión ni eres su coordinador para crear tareas aquí.'
        );
        return;
      }

      const id = newId('task');
      await db.insert(commissionTasks).values({
        id,
        commissionId: cleanCommId,
        title: String(title).trim().slice(0, 180),
        status: ['pendiente', 'en_curso', 'hecha'].includes(status) ? status : 'pendiente',
        assignedName: String(assignedName || '').trim().slice(0, 120),
        dueDate: String(dueDate || '').trim().slice(0, 40),
        createdByUid: me.uid,
      });
      res.json({ id, ok: true });
    } catch (error) {
      console.error('Task create failed:', error);
      res.status(500).json({ error: 'No fue posible crear la tarea.' });
    }
  });

  app.patch('/api/commission-tasks/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const id = String(req.params.id);
      const [task] = await db
        .select()
        .from(commissionTasks)
        .where(eq(commissionTasks.id, id))
        .limit(1);
      if (!task) {
        res.status(404).json({ error: 'Tarea no encontrada.' });
        return;
      }

      const canManage =
        userHasPermission(me, 'comision.editar_todas') ||
        userHasPermission(me, 'comision.tareas_gestionar', task.commissionId) ||
        task.createdByUid === me.uid ||
        (task.assignedName &&
          me.fullName &&
          task.assignedName.toLowerCase().includes(me.fullName.toLowerCase()));

      if (!canManage) {
        sendPermissionDenied(res, 'comision.tareas_gestionar', task.commissionId);
        return;
      }

      const body = req.body || {};
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (['pendiente', 'en_curso', 'hecha'].includes(body.status)) patch.status = body.status;
      if (
        userHasPermission(me, 'comision.editar_todas') ||
        userHasPermission(me, 'comision.tareas_gestionar', task.commissionId) ||
        task.createdByUid === me.uid
      ) {
        if (typeof body.assignedName === 'string') patch.assignedName = body.assignedName.trim().slice(0, 120);
        if (typeof body.dueDate === 'string') patch.dueDate = body.dueDate.trim().slice(0, 40);
        if (typeof body.title === 'string' && body.title.trim()) {
          patch.title = body.title.trim().slice(0, 180);
        }
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
      const me = req.authUser!;
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
      const canDelete =
        userHasPermission(me, 'comision.editar_todas') ||
        userHasPermission(me, 'comision.tareas_gestionar', task.commissionId) ||
        task.createdByUid === me.uid;

      if (!canDelete) {
        sendPermissionDenied(res, 'comision.tareas_gestionar', task.commissionId);
        return;
      }
      await db.delete(commissionTasks).where(eq(commissionTasks.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Task delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar la tarea.' });
    }
  });

  app.post('/api/news', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const canCreate = userHasPermission(me, 'noticias.crear');
      const canPropose = userHasPermission(me, 'noticias.proponer');
      const canPublish = userHasPermission(me, 'noticias.publicar');

      if (!canCreate && !canPropose) {
        sendPermissionDenied(res, 'noticias.crear');
        return;
      }

      const { title, type, summary, content, coverUrl, storagePath, commissionId, eventDate, location, status } =
        req.body || {};
      if (!title || !summary || !content) {
        res.status(400).json({ error: 'Completa título, resumen y contenido.' });
        return;
      }
      const safeStatus =
        canPublish && ['borrador', 'pendiente', 'publicado'].includes(status)
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
        commissionId: typeof commissionId === 'string' ? commissionId.trim() : '',
        eventDate: String(eventDate || '').slice(0, 40),
        location: String(location || '').slice(0, 160),
        authorUid: me.uid,
        authorName: me.fullName,
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
      const me = req.authUser!;
      const id = String(req.params.id);
      const [item] = await db.select().from(newsEvents).where(eq(newsEvents.id, id)).limit(1);
      if (!item) {
        res.status(404).json({ error: 'Publicación no encontrada.' });
        return;
      }
      const canEditAny = userHasPermission(me, 'noticias.crear');
      const canPublish = userHasPermission(me, 'noticias.publicar');
      if (!canEditAny && !canPublish && item.authorUid !== me.uid) {
        sendPermissionDenied(res, 'noticias.crear');
        return;
      }
      const body = req.body || {};
      if (body.status === 'publicado' && !canPublish) {
        sendPermissionDenied(res, 'noticias.publicar');
        return;
      }
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (typeof body.title === 'string' && body.title.trim()) {
        patch.title = body.title.trim().slice(0, 180);
      }
      if (body.type === 'noticia' || body.type === 'evento') patch.type = body.type;
      if (typeof body.summary === 'string') patch.summary = body.summary.trim().slice(0, 400);
      if (typeof body.content === 'string') patch.content = body.content.trim().slice(0, 5000);
      if (typeof body.coverUrl === 'string' && isSafeUrl(body.coverUrl)) patch.coverUrl = body.coverUrl;
      if (typeof body.storagePath === 'string') patch.storagePath = body.storagePath.slice(0, 512);
      if (typeof body.commissionId === 'string') patch.commissionId = body.commissionId.trim();
      if (typeof body.eventDate === 'string') patch.eventDate = body.eventDate.slice(0, 40);
      if (typeof body.location === 'string') patch.location = body.location.slice(0, 160);
      if (typeof body.status === 'string' && ['borrador', 'pendiente', 'publicado'].includes(body.status)) {
        patch.status = body.status;
      }
      await db.update(newsEvents).set(patch).where(eq(newsEvents.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('News update failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar la publicación.' });
    }
  });

  app.delete('/api/news/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const id = String(req.params.id);
      const [item] = await db.select().from(newsEvents).where(eq(newsEvents.id, id)).limit(1);
      if (item && item.authorUid !== me.uid && !userHasPermission(me, 'noticias.eliminar')) {
        sendPermissionDenied(res, 'noticias.eliminar');
        return;
      }
      if (!item && !userHasPermission(me, 'noticias.eliminar')) {
        sendPermissionDenied(res, 'noticias.eliminar');
        return;
      }
      await db.delete(newsEvents).where(eq(newsEvents.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('News delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar la publicación.' });
    }
  });

  app.post('/api/gallery', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
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
        albumId,
        eventDate,
        mimeType,
        sortOrder,
        status,
      } = req.body || {};
      const cleanCommId = typeof commissionId === 'string' ? commissionId.trim() : '';
      const canManage = userHasPermission(me, 'galeria.gestionar', cleanCommId || undefined);
      const canUploadOwn = userHasPermission(me, 'galeria.subir_propia');
      if (!canManage && !canUploadOwn) {
        sendPermissionDenied(res, 'galeria.gestionar', cleanCommId || undefined);
        return;
      }
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
        commissionId: cleanCommId,
        albumId: typeof albumId === 'string' ? albumId.trim().slice(0, 64) : '',
        eventDate: typeof eventDate === 'string' ? eventDate.trim().slice(0, 40) : '',
        mimeType: typeof mimeType === 'string' ? mimeType.trim().slice(0, 120) : '',
        sortOrder: Number.isFinite(Number(sortOrder)) ? Math.round(Number(sortOrder)) : 0,
        authorUid: me.uid,
        authorName: me.fullName,
        status: canManage && status === 'archivado' ? 'archivado' : canManage ? 'publicado' : 'archivado',
      });
      res.json({ id, ok: true });
    } catch (error) {
      console.error('Gallery create failed:', error);
      res.status(500).json({ error: 'No fue posible publicar en galería.' });
    }
  });

  app.patch('/api/gallery/reorder', requireAuth, async (req: AuthedRequest, res) => {
    try {
      if (!userHasPermission(req.authUser!, 'galeria.gestionar')) {
        sendPermissionDenied(res, 'galeria.gestionar');
        return;
      }
      const { orderedIds } = req.body || {};
      if (!Array.isArray(orderedIds)) {
        res.status(400).json({ error: 'Lista de orden inválida.' });
        return;
      }
      await Promise.all(
        orderedIds.slice(0, 200).map((itemId, idx) =>
          db
            .update(galleryItems)
            .set({ sortOrder: idx })
            .where(eq(galleryItems.id, String(itemId)))
        )
      );
      res.json({ ok: true });
    } catch (error) {
      console.error('Gallery reorder failed:', error);
      res.status(500).json({ error: 'No fue posible guardar el orden de la galería.' });
    }
  });

  app.patch('/api/gallery/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const id = String(req.params.id);
      const [item] = await db.select().from(galleryItems).where(eq(galleryItems.id, id)).limit(1);
      if (!item) {
        res.status(404).json({ error: 'Elemento no encontrado.' });
        return;
      }
      const canManage = userHasPermission(me, 'galeria.gestionar', item.commissionId || undefined);
      if (!canManage && item.authorUid !== me.uid) {
        sendPermissionDenied(res, 'galeria.gestionar', item.commissionId || undefined);
        return;
      }
      const body = req.body || {};
      const patch: Record<string, unknown> = {};
      if (typeof body.title === 'string' && body.title.trim()) {
        patch.title = body.title.trim().slice(0, 160);
      }
      if (typeof body.description === 'string') {
        patch.description = body.description.trim().slice(0, 400);
      }
      if (typeof body.commissionId === 'string') {
        patch.commissionId = body.commissionId.trim();
      }
      if (typeof body.albumId === 'string') {
        patch.albumId = body.albumId.trim().slice(0, 64);
      }
      if (typeof body.eventDate === 'string') {
        patch.eventDate = body.eventDate.trim().slice(0, 40);
      }
      if (typeof body.sortOrder === 'number') {
        patch.sortOrder = Math.round(body.sortOrder);
      }
      if (typeof body.url === 'string' && body.url.trim() && isSafeUrl(body.url)) {
        patch.url = body.url.trim();
      }
      if (body.mediaType === 'image' || body.mediaType === 'video') {
        patch.mediaType = body.mediaType;
      }
      if (['upload', 'youtube', 'vimeo'].includes(body.videoSource)) {
        patch.videoSource = body.videoSource;
      }
      if (canManage && typeof body.status === 'string' && ['publicado', 'archivado'].includes(body.status)) {
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
      const me = req.authUser!;
      const id = String(req.params.id);
      const [item] = await db.select().from(galleryItems).where(eq(galleryItems.id, id)).limit(1);
      if (!item) {
        res.json({ ok: true });
        return;
      }
      const canManage = userHasPermission(me, 'galeria.gestionar', item.commissionId || undefined);
      if (!canManage && item.authorUid !== me.uid) {
        sendPermissionDenied(res, 'galeria.gestionar', item.commissionId || undefined);
        return;
      }
      await db.delete(galleryItems).where(eq(galleryItems.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Gallery delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar.' });
    }
  });

  app.post('/api/gallery-albums', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const { title, description, coverUrl, eventDate, commissionId, status } = req.body || {};
      const cleanCommId = typeof commissionId === 'string' ? commissionId.trim().slice(0, 64) : '';
      if (!userHasPermission(me, 'galeria.gestionar', cleanCommId || undefined)) {
        sendPermissionDenied(res, 'galeria.gestionar', cleanCommId || undefined);
        return;
      }
      if (!title || !String(title).trim()) {
        res.status(400).json({ error: 'El nombre del álbum es obligatorio.' });
        return;
      }
      const id = newId('album');
      await db.insert(galleryAlbums).values({
        id,
        title: String(title).trim().slice(0, 140),
        description: String(description || '').trim().slice(0, 400),
        coverUrl: isSafeUrl(coverUrl) ? String(coverUrl) : '',
        eventDate: String(eventDate || '').trim().slice(0, 40),
        commissionId: cleanCommId,
        status: status === 'archivado' ? 'archivado' : 'publicado',
        authorUid: me.uid,
      });
      res.json({ id, ok: true });
    } catch (error) {
      console.error('Album create failed:', error);
      res.status(500).json({ error: 'No fue posible crear el álbum.' });
    }
  });

  app.patch('/api/gallery-albums/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const id = String(req.params.id);
      const [existing] = await db.select().from(galleryAlbums).where(eq(galleryAlbums.id, id)).limit(1);
      if (!existing) {
        res.status(404).json({ error: 'Álbum no encontrado.' });
        return;
      }
      if (!userHasPermission(me, 'galeria.gestionar', existing.commissionId || undefined)) {
        sendPermissionDenied(res, 'galeria.gestionar', existing.commissionId || undefined);
        return;
      }
      const body = req.body || {};
      const patch: Record<string, unknown> = {};
      if (typeof body.title === 'string' && body.title.trim()) {
        patch.title = body.title.trim().slice(0, 140);
      }
      if (typeof body.description === 'string') patch.description = body.description.trim().slice(0, 400);
      if (typeof body.coverUrl === 'string' && (body.coverUrl === '' || isSafeUrl(body.coverUrl))) {
        patch.coverUrl = body.coverUrl;
      }
      if (typeof body.eventDate === 'string') patch.eventDate = body.eventDate.trim().slice(0, 40);
      if (typeof body.commissionId === 'string') patch.commissionId = body.commissionId.trim().slice(0, 64);
      if (body.status === 'publicado' || body.status === 'archivado') patch.status = body.status;
      await db.update(galleryAlbums).set(patch).where(eq(galleryAlbums.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Album update failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar el álbum.' });
    }
  });

  app.delete('/api/gallery-albums/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const id = String(req.params.id);
      const [existing] = await db.select().from(galleryAlbums).where(eq(galleryAlbums.id, id)).limit(1);
      if (existing && !userHasPermission(me, 'galeria.gestionar', existing.commissionId || undefined)) {
        sendPermissionDenied(res, 'galeria.gestionar', existing.commissionId || undefined);
        return;
      }
      if (!existing && !userHasPermission(me, 'galeria.gestionar')) {
        sendPermissionDenied(res, 'galeria.gestionar');
        return;
      }
      await db.update(galleryItems).set({ albumId: '' }).where(eq(galleryItems.albumId, id));
      await db.delete(galleryAlbums).where(eq(galleryAlbums.id, id));
      res.json({ ok: true });
    } catch (error) {
      console.error('Album delete failed:', error);
      res.status(500).json({ error: 'No fue posible eliminar el álbum.' });
    }
  });
}
