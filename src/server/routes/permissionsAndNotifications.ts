import type express from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  commissions,
  grantedPermissions,
  notifications,
  permissionApprovalSteps,
  permissionRequests,
  publicCouncilors,
  users,
} from '../../db/schema.ts';
import {
  getPermissionMeta,
  normalizeRealText,
  PERMISSION_CATALOG_MAP,
  validatePermissionJustification,
} from '../../lib/permissions.ts';
import {
  type AuthedRequest,
  createPortalNotification,
  expireOutdatedGrantedPermissions,
  isSafeUrl,
  logServerAudit,
  newId,
  requireAuth,
  requirePermission,
  sendPermissionDenied,
  syncPendingReminders48h,
  userHasPermission,
} from '../helpers.ts';
import { isLeadershipTier } from '../security.ts';
import type {
  ApprovalStepRole,
  PermissionDurationType,
  PermissionKey,
  PermissionRequestStatus,
} from '../../types/cmj.ts';

const ROLE_APPROVAL_PERMISSION: Record<ApprovalStepRole, PermissionKey> = {
  Presidente: 'permisos.aprobar_presidencia',
  Vicepresidente: 'permisos.aprobar_vicepresidencia',
  Secretario: 'permisos.aprobar_secretaria',
};

const STEP_TO_REQUEST_STATUS: Record<number, PermissionRequestStatus> = {
  1: 'pendiente_presidente',
  2: 'pendiente_vicepresidente',
  3: 'pendiente_secretario',
};

export function registerPermissionsAndNotificationsRoutes(app: express.Express) {
  // Listado de solicitudes, pasos de aprobación y permisos otorgados
  app.get('/api/permissions/requests', requireAuth, async (req: AuthedRequest, res) => {
    try {
      await Promise.all([syncPendingReminders48h(), expireOutdatedGrantedPermissions()]);

      const me = req.authUser!;
      const isApproverOrLeader =
        isLeadershipTier(me.accessTier) ||
        userHasPermission(me, 'permisos.aprobar_presidencia') ||
        userHasPermission(me, 'permisos.aprobar_vicepresidencia') ||
        userHasPermission(me, 'permisos.aprobar_secretaria') ||
        userHasPermission(me, 'permisos.revocar');

      const [allReqs, allSteps, allGrants] = await Promise.all([
        db.select().from(permissionRequests).orderBy(desc(permissionRequests.createdAt)),
        db.select().from(permissionApprovalSteps),
        isApproverOrLeader || userHasPermission(me, 'usuarios.ver')
          ? db.select().from(grantedPermissions).orderBy(desc(grantedPermissions.grantedAt))
          : db
              .select()
              .from(grantedPermissions)
              .where(eq(grantedPermissions.userUid, me.uid))
              .orderBy(desc(grantedPermissions.grantedAt)),
      ]);

      const delegatedReqIds = new Set(
        allSteps.filter((s) => s.expectedApproverUid === me.uid).map((s) => s.requestId)
      );
      const visibleRequests = isApproverOrLeader
        ? allReqs
        : allReqs.filter((r) => r.requesterUid === me.uid || delegatedReqIds.has(r.id));
      const visibleReqIds = new Set(visibleRequests.map((r) => r.id));
      const visibleSteps = allSteps.filter((s) => visibleReqIds.has(s.requestId));

      res.json({
        requests: visibleRequests,
        steps: visibleSteps,
        grants: allGrants,
      });
    } catch (error) {
      console.error('Fetch permission requests failed:', error);
      res.status(500).json({ error: 'No fue posible consultar las solicitudes de permisos.' });
    }
  });

  // Crear nueva solicitud de permiso especial con justificación obligatoria (>= 100 chars)
  app.post('/api/permissions/requests', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      if (!userHasPermission(me, 'permisos.solicitar')) {
        sendPermissionDenied(res, 'permisos.solicitar');
        return;
      }

      const body = req.body || {};
      const permissionKey = String(body.permissionKey || '').trim() as PermissionKey;
      const catalogItem = PERMISSION_CATALOG_MAP[permissionKey];
      if (!catalogItem) {
        res.status(400).json({ error: 'El permiso solicitado no existe en el catálogo oficial.' });
        return;
      }
      if (!catalogItem.requestable) {
        res.status(403).json({
          error:
            'Este permiso es exclusivo de Presidencia o del sistema de aprobaciones y no puede solicitarse.',
        });
        return;
      }

      const durationType: PermissionDurationType =
        body.durationType === 'permanente' ? 'permanente' : 'temporal';
      const expiresAt = typeof body.expiresAt === 'string' ? body.expiresAt.trim().slice(0, 40) : '';
      const targetModule = String(body.targetModule || catalogItem.moduleLabel).trim().slice(0, 120);
      const targetCommissionId =
        typeof body.targetCommissionId === 'string' ? body.targetCommissionId.trim().slice(0, 64) : '';
      const purpose = normalizeRealText(String(body.purpose || '')).slice(0, 240);
      const reason = normalizeRealText(String(body.reason || '')).slice(0, 2500);
      const attachmentUrl =
        typeof body.attachmentUrl === 'string' && isSafeUrl(body.attachmentUrl)
          ? body.attachmentUrl.trim()
          : '';
      const attachmentName =
        typeof body.attachmentName === 'string' ? body.attachmentName.trim().slice(0, 180) : '';

      const validation = validatePermissionJustification({
        reason,
        purpose,
        targetModule,
        durationType,
        expiresAt,
      });
      if (!validation.valid) {
        res.status(400).json({ error: validation.error || 'Justificación insuficiente.' });
        return;
      }

      // Verificar si ya lo posee activamente sin restricción
      if (userHasPermission(me, permissionKey, targetCommissionId || undefined)) {
        res.status(400).json({ error: 'Ya cuentas con este permiso activo en el alcance indicado.' });
        return;
      }

      // Evitar solicitudes duplicadas abiertas para el mismo permiso y comisión
      const existingReqs = await db
        .select()
        .from(permissionRequests)
        .where(
          and(
            eq(permissionRequests.requesterUid, me.uid),
            eq(permissionRequests.permissionKey, permissionKey)
          )
        );
      const hasOpenDuplicate = existingReqs.some(
        (r) =>
          (r.targetCommissionId || '') === targetCommissionId &&
          r.status.startsWith('pendiente_')
      );
      if (hasOpenDuplicate) {
        res.status(409).json({
          error: 'Ya tienes una solicitud pendiente en curso para este mismo permiso.',
        });
        return;
      }

      let targetCommissionName = '';
      if (targetCommissionId) {
        const [comm] = await db
          .select()
          .from(commissions)
          .where(eq(commissions.id, targetCommissionId))
          .limit(1);
        if (!comm) {
          res.status(404).json({ error: 'La comisión seleccionada no existe.' });
          return;
        }
        targetCommissionName = comm.name;
      }

      // Identificar titulares activos para Presidente, Vicepresidente y Secretario
      const [activeUsers, pubRows] = await Promise.all([
        db.select().from(users).where(eq(users.active, true)),
        db.select().from(publicCouncilors),
      ]);
      const nameByUid = new Map(pubRows.map((p) => [p.uid, p.fullName]));

      const stepRoles: Array<{ order: number; role: ApprovalStepRole }> = [
        { order: 1, role: 'Presidente' },
        { order: 2, role: 'Vicepresidente' },
        { order: 3, role: 'Secretario' },
      ];

      const requestId = newId('preq');
      const stepsToInsert: Array<typeof permissionApprovalSteps.$inferInsert> = [];
      let firstPendingOrder: number | null = null;

      for (const sr of stepRoles) {
        const candidates = activeUsers.filter((u) => u.roleLabel === sr.role && u.uid !== me.uid);
        const primary = candidates[0];
        // Si el solicitante ocupa exactamente ese rol (o no hay otro titular diferente para evitar autoaprobación cuando él mismo ostenta el cargo)
        const isSelfRole = me.roleLabel === sr.role && candidates.length === 0;
        const stepStatus = isSelfRole ? 'omitido' : 'pendiente';
        if (stepStatus === 'pendiente' && firstPendingOrder === null) {
          firstPendingOrder = sr.order;
        }
        stepsToInsert.push({
          id: newId('pstep'),
          requestId,
          stepOrder: sr.order,
          approverRole: sr.role,
          expectedApproverUid: primary ? primary.uid : '',
          expectedApproverName: primary
            ? nameByUid.get(primary.uid) || primary.email.split('@')[0]
            : `${sr.role} CMJ`,
          delegatedFromUid: '',
          delegatedReason: '',
          status: stepStatus,
          decidedByUid: isSelfRole ? 'system' : '',
          decidedByName: isSelfRole ? 'Sistema RBAC' : '',
          comment: isSelfRole
            ? 'Paso omitido automáticamente para evitar autoaprobación del solicitante.'
            : '',
          reminderSentAt: '',
          decidedAt: isSelfRole ? new Date().toISOString() : '',
        });
      }

      if (firstPendingOrder === null) {
        res.status(400).json({
          error:
            'No existen otros directivos activos distintos al solicitante para validar esta petición (bloqueo anti-autoaprobación).',
        });
        return;
      }

      const initialStatus: PermissionRequestStatus =
        STEP_TO_REQUEST_STATUS[firstPendingOrder] || 'pendiente_presidente';

      const [createdRequest] = await db
        .insert(permissionRequests)
        .values({
          id: requestId,
          requesterUid: me.uid,
          requesterName: me.fullName,
          requesterEmail: me.email,
          requesterRoleLabel: me.roleLabel,
          permissionKey,
          permissionLabel: catalogItem.label,
          targetModule,
          targetCommissionId,
          targetCommissionName,
          reason,
          purpose,
          durationType,
          expiresAt: durationType === 'temporal' ? expiresAt : '',
          attachmentUrl,
          attachmentName,
          status: initialStatus,
          currentStepOrder: firstPendingOrder,
          rejectionReason: '',
          decidedByName: '',
        })
        .returning();

      await db.insert(permissionApprovalSteps).values(stepsToInsert);

      // Notificar al primer aprobador en turno
      const firstStep = stepsToInsert.find((s) => s.stepOrder === firstPendingOrder);
      if (firstStep) {
        const notifyUids = activeUsers
          .filter((u) => u.roleLabel === firstStep.approverRole && u.uid !== me.uid)
          .map((u) => u.uid);
        for (const nUid of notifyUids) {
          await createPortalNotification({
            userUid: nUid,
            type: 'permiso_turno',
            title: `Nueva solicitud de permiso (${firstStep.approverRole})`,
            message: `${me.fullName} (${me.roleLabel}) solicita "${catalogItem.label}". Requiere tu revisión en el paso ${firstStep.stepOrder}/3.`,
            linkModule: 'permisos',
            relatedId: requestId,
          });
        }
      }

      await createPortalNotification({
        userUid: me.uid,
        type: 'permiso_solicitado',
        title: 'Solicitud de permiso radicada',
        message: `Tu solicitud para "${catalogItem.label}" inició el flujo secuencial (Presidente → Vicepresidente → Secretario).`,
        linkModule: 'permisos',
        relatedId: requestId,
      });

      await logServerAudit(
        me,
        `Solicitó permiso especial (${durationType}): ${catalogItem.key}`,
        'Permisos Especiales',
        `${me.fullName} → ${catalogItem.label}`
      );

      res.json({ id: requestId, status: initialStatus, request: createdRequest, ok: true });
    } catch (error) {
      console.error('Create permission request failed:', error);
      res.status(500).json({ error: 'No fue posible radicar la solicitud de permiso.' });
    }
  });

  // Decisión secuencial obligatoria: Presidente -> Vicepresidente -> Secretario
  app.post('/api/permissions/requests/:id/decide', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const id = String(req.params.id);
      const decision = req.body?.decision === 'rechazar' ? 'rechazar' : 'aprobar';
      const comment = String(req.body?.comment || '').trim().slice(0, 800);

      const [reqRow] = await db
        .select()
        .from(permissionRequests)
        .where(eq(permissionRequests.id, id))
        .limit(1);
      if (!reqRow) {
        res.status(404).json({ error: 'Solicitud de permiso no encontrada.' });
        return;
      }

      if (!reqRow.status.startsWith('pendiente_')) {
        res.status(400).json({ error: 'Esta solicitud ya fue resuelta o cancelada.' });
        return;
      }

      // Bloqueo estricto anti-autoaprobación
      if (reqRow.requesterUid === me.uid) {
        res.status(403).json({
          error: 'Seguridad RBAC: un usuario no puede aprobar ni decidir su propia solicitud.',
        });
        return;
      }

      const steps = await db
        .select()
        .from(permissionApprovalSteps)
        .where(eq(permissionApprovalSteps.requestId, id));
      const sortedSteps = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);
      const currentStep = sortedSteps.find((s) => s.stepOrder === reqRow.currentStepOrder);

      if (!currentStep || currentStep.status !== 'pendiente') {
        res.status(400).json({ error: 'No hay un paso pendiente válido para decidir.' });
        return;
      }

      const rolePerm = ROLE_APPROVAL_PERMISSION[currentStep.approverRole as ApprovalStepRole];
      const isExpectedRoleApprover = rolePerm && userHasPermission(me, rolePerm);
      const isDelegatedApprover =
        Boolean(currentStep.expectedApproverUid) && currentStep.expectedApproverUid === me.uid;

      if (!isExpectedRoleApprover && !isDelegatedApprover) {
        res.status(403).json({
          error: `Esta solicitud espera actualmente aprobación de ${currentStep.approverRole} (paso ${currentStep.stepOrder}/3).`,
        });
        return;
      }

      if (decision === 'rechazar' && comment.length < 10) {
        res.status(400).json({
          error: 'Debes escribir el motivo del rechazo (mínimo 10 caracteres).',
        });
        return;
      }

      const nowIso = new Date().toISOString();

      if (decision === 'rechazar') {
        await db
          .update(permissionApprovalSteps)
          .set({
            status: 'rechazado',
            decidedByUid: me.uid,
            decidedByName: me.fullName,
            comment,
            decidedAt: nowIso,
          })
          .where(eq(permissionApprovalSteps.id, currentStep.id));

        await db
          .update(permissionRequests)
          .set({
            status: 'rechazada',
            rejectionReason: comment,
            decidedByName: me.fullName,
            updatedAt: new Date(),
          })
          .where(eq(permissionRequests.id, id));

        await createPortalNotification({
          userUid: reqRow.requesterUid,
          type: 'permiso_rechazado',
          title: `Solicitud rechazada por ${currentStep.approverRole}`,
          message: `Tu solicitud para "${reqRow.permissionLabel}" fue rechazada: ${comment}`,
          linkModule: 'permisos',
          relatedId: id,
        });

        await logServerAudit(
          me,
          `Rechazó solicitud (${currentStep.approverRole}): ${comment.slice(0, 60)}`,
          'Permisos Especiales',
          `${reqRow.requesterName} · ${reqRow.permissionLabel}`
        );

        res.json({ ok: true, status: 'rechazada' });
        return;
      }

      // Aprobar paso actual
      await db
        .update(permissionApprovalSteps)
        .set({
          status: 'aprobado',
          decidedByUid: me.uid,
          decidedByName: me.fullName,
          comment: comment || `Aprobado en paso ${currentStep.stepOrder}/3.`,
          decidedAt: nowIso,
        })
        .where(eq(permissionApprovalSteps.id, currentStep.id));

      // Buscar siguiente paso pendiente
      const nextStep = sortedSteps.find(
        (s) => s.stepOrder > currentStep.stepOrder && s.status === 'pendiente'
      );

      if (!nextStep) {
        // Cadena completada: activar permiso especial
        await db
          .update(permissionRequests)
          .set({
            status: 'aprobada',
            decidedByName: me.fullName,
            updatedAt: new Date(),
          })
          .where(eq(permissionRequests.id, id));

        const grantId = newId('grant');
        await db.insert(grantedPermissions).values({
          id: grantId,
          requestId: id,
          userUid: reqRow.requesterUid,
          userName: reqRow.requesterName,
          userEmail: reqRow.requesterEmail,
          permissionKey: reqRow.permissionKey,
          permissionLabel: reqRow.permissionLabel,
          targetModule: reqRow.targetModule,
          targetCommissionId: reqRow.targetCommissionId || '',
          durationType: reqRow.durationType,
          expiresAt: reqRow.expiresAt || '',
          active: true,
          revokedAt: '',
          revokedByUid: '',
          revokedByName: '',
          revocationReason: '',
        });

        await createPortalNotification({
          userUid: reqRow.requesterUid,
          type: 'permiso_aprobado',
          title: 'Permiso especial aprobado y activado',
          message: `Se completaron las 3 firmas (Presidente → Vicepresidente → Secretario). Ya tienes activo "${reqRow.permissionLabel}".`,
          linkModule: 'permisos',
          relatedId: id,
        });

        await logServerAudit(
          me,
          `Aprobación final (${currentStep.approverRole}) y activación de ${reqRow.permissionKey}`,
          'Permisos Especiales',
          `${reqRow.requesterName} · ${reqRow.permissionLabel}`
        );

        res.json({ ok: true, status: 'aprobada', grantId });
        return;
      }

      // Avanzar al siguiente nivel secuencial
      const nextStatus = STEP_TO_REQUEST_STATUS[nextStep.stepOrder] || 'pendiente_secretario';
      await db
        .update(permissionRequests)
        .set({
          currentStepOrder: nextStep.stepOrder,
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(eq(permissionRequests.id, id));

      // Notificar al siguiente aprobador en turno
      const activeRoleApprovers = await db
        .select({ uid: users.uid })
        .from(users)
        .where(and(eq(users.roleLabel, nextStep.approverRole), eq(users.active, true)));

      const nextTargetUids = new Set<string>(
        nextStep.expectedApproverUid
          ? [nextStep.expectedApproverUid]
          : activeRoleApprovers.map((u) => u.uid)
      );
      for (const nUid of nextTargetUids) {
        if (nUid === reqRow.requesterUid) continue;
        await createPortalNotification({
          userUid: nUid,
          type: 'permiso_turno',
          title: `Tu turno de aprobación (${nextStep.approverRole})`,
          message: `${currentStep.approverRole} aprobó la solicitud de ${reqRow.requesterName} ("${reqRow.permissionLabel}"). Sigue tu revisión en el paso ${nextStep.stepOrder}/3.`,
          linkModule: 'permisos',
          relatedId: id,
        });
      }

      await logServerAudit(
        me,
        `Aprobó paso ${currentStep.stepOrder}/3 (${currentStep.approverRole}): ${reqRow.permissionKey}`,
        'Permisos Especiales',
        `${reqRow.requesterName} · ${reqRow.permissionLabel}`
      );

      res.json({ ok: true, status: nextStatus, currentStepOrder: nextStep.stepOrder });
    } catch (error) {
      console.error('Decide permission request failed:', error);
      res.status(500).json({ error: 'No fue posible registrar la decisión.' });
    }
  });

  // Delegar paso pendiente cuando el titular está ausente o inactivo (Presidente o VP)
  app.post(
    '/api/permissions/requests/:id/delegate',
    requireAuth,
    requirePermission('permisos.delegar'),
    async (req: AuthedRequest, res) => {
      try {
        const me = req.authUser!;
        const id = String(req.params.id);
        const delegateToUid = String(req.body?.delegateToUid || '').trim();
        const reason = String(req.body?.reason || '').trim().slice(0, 400);

        if (!delegateToUid || reason.length < 10) {
          res.status(400).json({
            error: 'Selecciona un directivo o consejero activo y explica la ausencia (mínimo 10 caracteres).',
          });
          return;
        }

        const [reqRow] = await db
          .select()
          .from(permissionRequests)
          .where(eq(permissionRequests.id, id))
          .limit(1);
        if (!reqRow || !reqRow.status.startsWith('pendiente_')) {
          res.status(400).json({ error: 'La solicitud no está en estado pendiente.' });
          return;
        }
        if (delegateToUid === reqRow.requesterUid) {
          res.status(400).json({
            error: 'No se puede delegar la aprobación al mismo solicitante.',
          });
          return;
        }

        const [targetUser] = await db
          .select()
          .from(users)
          .where(and(eq(users.uid, delegateToUid), eq(users.active, true)))
          .limit(1);
        if (!targetUser) {
          res.status(404).json({ error: 'El usuario suplente seleccionado no está activo.' });
          return;
        }

        const [pubTarget] = await db
          .select()
          .from(publicCouncilors)
          .where(eq(publicCouncilors.uid, delegateToUid))
          .limit(1);
        const targetName = pubTarget?.fullName || targetUser.email.split('@')[0];

        const steps = await db
          .select()
          .from(permissionApprovalSteps)
          .where(eq(permissionApprovalSteps.requestId, id));
        const currentStep = steps.find((s) => s.stepOrder === reqRow.currentStepOrder);
        if (!currentStep || currentStep.status !== 'pendiente') {
          res.status(400).json({ error: 'No hay paso pendiente para delegar.' });
          return;
        }

        await db
          .update(permissionApprovalSteps)
          .set({
            delegatedFromUid: currentStep.expectedApproverUid || me.uid,
            expectedApproverUid: targetUser.uid,
            expectedApproverName: targetName,
            delegatedReason: reason,
          })
          .where(eq(permissionApprovalSteps.id, currentStep.id));

        await createPortalNotification({
          userUid: targetUser.uid,
          type: 'permiso_turno',
          title: `Delegación de aprobación (${currentStep.approverRole})`,
          message: `${me.fullName} te delegó la revisión de "${reqRow.permissionLabel}" solicitada por ${reqRow.requesterName}. Motivo: ${reason}`,
          linkModule: 'permisos',
          relatedId: id,
        });

        await logServerAudit(
          me,
          `Delegó paso ${currentStep.stepOrder} (${currentStep.approverRole}) a ${targetName}`,
          'Permisos Especiales',
          `${reqRow.permissionLabel} · ${reason.slice(0, 60)}`
        );

        res.json({ ok: true });
      } catch (error) {
        console.error('Delegate approval step failed:', error);
        res.status(500).json({ error: 'No fue posible delegar el paso de aprobación.' });
      }
    }
  );

  // Cancelar solicitud propia mientras está pendiente
  app.post('/api/permissions/requests/:id/cancel', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const id = String(req.params.id);
      const [reqRow] = await db
        .select()
        .from(permissionRequests)
        .where(eq(permissionRequests.id, id))
        .limit(1);
      if (!reqRow) {
        res.status(404).json({ error: 'Solicitud no encontrada.' });
        return;
      }
      if (reqRow.requesterUid !== me.uid && !userHasPermission(me, 'permisos.revocar')) {
        res.status(403).json({ error: 'Solo el solicitante o Presidencia pueden cancelar esta petición.' });
        return;
      }
      if (!reqRow.status.startsWith('pendiente_')) {
        res.status(400).json({ error: 'Solo se pueden cancelar solicitudes pendientes.' });
        return;
      }

      await db
        .update(permissionRequests)
        .set({ status: 'cancelada', updatedAt: new Date() })
        .where(eq(permissionRequests.id, id));

      await logServerAudit(
        me,
        `Canceló solicitud de permiso ${reqRow.permissionKey}`,
        'Permisos Especiales',
        reqRow.permissionLabel
      );

      res.json({ ok: true });
    } catch (error) {
      console.error('Cancel permission request failed:', error);
      res.status(500).json({ error: 'No fue posible cancelar la solicitud.' });
    }
  });

  // Revocar permiso especial activo (solo Presidencia con motivo obligatorio)
  app.post(
    '/api/permissions/grants/:id/revoke',
    requireAuth,
    requirePermission('permisos.revocar'),
    async (req: AuthedRequest, res) => {
      try {
        const me = req.authUser!;
        const grantId = String(req.params.id);
        const reason = String(req.body?.reason || '').trim().slice(0, 600);
        if (reason.length < 10) {
          res.status(400).json({
            error: 'Debes indicar el motivo de la revocación (mínimo 10 caracteres).',
          });
          return;
        }

        const [grant] = await db
          .select()
          .from(grantedPermissions)
          .where(eq(grantedPermissions.id, grantId))
          .limit(1);
        if (!grant) {
          res.status(404).json({ error: 'Permiso otorgado no encontrado.' });
          return;
        }
        if (!grant.active) {
          res.status(400).json({ error: 'Este permiso ya fue revocado o expiró.' });
          return;
        }

        await db
          .update(grantedPermissions)
          .set({
            active: false,
            revokedAt: new Date().toISOString(),
            revokedByUid: me.uid,
            revokedByName: me.fullName,
            revocationReason: reason,
          })
          .where(eq(grantedPermissions.id, grantId));

        await createPortalNotification({
          userUid: grant.userUid,
          type: 'permiso_revocado',
          title: 'Permiso especial revocado',
          message: `Tu permiso "${grant.permissionLabel}" fue revocado por ${me.fullName}. Motivo: ${reason}`,
          linkModule: 'permisos',
          relatedId: grant.requestId,
        });

        await logServerAudit(
          me,
          `Revocó permiso especial ${grant.permissionKey}`,
          'Permisos Especiales',
          `${grant.userName} · ${reason.slice(0, 70)}`
        );

        res.json({ ok: true });
      } catch (error) {
        console.error('Revoke grant failed:', error);
        res.status(500).json({ error: 'No fue posible revocar el permiso.' });
      }
    }
  );

  // Notificaciones del usuario autenticado
  app.get('/api/notifications', requireAuth, async (req: AuthedRequest, res) => {
    try {
      await syncPendingReminders48h();
      const rows = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userUid, req.authUser!.uid))
        .orderBy(desc(notifications.createdAt))
        .limit(80);
      res.json({ notifications: rows });
    } catch (error) {
      console.error('Fetch notifications failed:', error);
      res.status(500).json({ error: 'No fue posible consultar las notificaciones.' });
    }
  });

  app.post('/api/notifications/read-all', requireAuth, async (req: AuthedRequest, res) => {
    try {
      await db
        .update(notifications)
        .set({ read: true })
        .where(eq(notifications.userUid, req.authUser!.uid));
      res.json({ ok: true });
    } catch (error) {
      console.error('Mark all notifications read failed:', error);
      res.status(500).json({ error: 'No fue posible marcar las notificaciones.' });
    }
  });

  app.patch('/api/notifications/:id/read', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const id = String(req.params.id);
      await db
        .update(notifications)
        .set({ read: true })
        .where(and(eq(notifications.id, id), eq(notifications.userUid, req.authUser!.uid)));
      res.json({ ok: true });
    } catch (error) {
      console.error('Mark notification read failed:', error);
      res.status(500).json({ error: 'No fue posible actualizar la notificación.' });
    }
  });

  // Helper de referencia rápida por si algún cliente consulta metadata de permiso
  app.get('/api/permissions/catalog', requireAuth, async (_req, res) => {
    res.json({ ok: true, metaSample: getPermissionMeta('permisos.solicitar') });
  });
}
