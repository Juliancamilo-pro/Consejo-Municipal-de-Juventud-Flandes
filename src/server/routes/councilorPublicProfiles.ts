import type express from 'express';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  authRateLimits,
  commissions,
  commitments,
  councilorAchievements,
  councilorGoals,
  councilorHearts,
  publicCouncilors,
  roleTerms,
  sessions,
  votes,
  workPlans,
} from '../../db/schema.ts';
import { formatTermYearsLabel } from '../../lib/roleTerms.ts';
import { getRuntimeSessionSecret, sha256Hex } from '../security.ts';
import {
  type AuthedRequest,
  isSafeUrl,
  logServerAudit,
  newId,
  requireAuth,
  resolveAuthUser,
  userHasPermission,
} from '../helpers.ts';
import type {
  AchievementCategory,
  AttendanceSessionRecord,
  AttendanceStatus,
  CouncilorAchievementItem,
  CouncilorGoalItem,
  CouncilorPublicProfileResponse,
  ElectiveRoleLabel,
  PublicCouncilor,
  PublicVoteHistoryItem,
  RoleLabel,
  RoleTermHistoryItem,
  VoteMode,
  VoteStatus,
} from '../../types/cmj.ts';

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

export async function resolveHeartContext(req: express.Request): Promise<{
  voterKey: string;
  authUid: string | null;
}> {
  let authUid: string | null = null;
  try {
    const authUser = await resolveAuthUser(req);
    if (authUser?.uid) {
      authUid = authUser.uid;
    }
  } catch {
    authUid = null;
  }

  if (authUid) {
    return {
      voterKey: `uid:${authUid}`,
      authUid,
    };
  }

  const ip = getClientIp(req);
  const ua = String(req.headers['user-agent'] || 'unknown').slice(0, 180);
  const anonDigest = sha256Hex(`${getRuntimeSessionSecret()}:heart:${ip}:${ua}`);
  return {
    voterKey: `anon:${anonDigest}`,
    authUid: null,
  };
}

async function checkPublicRateLimit(
  req: express.Request,
  bucket: string,
  maxPerMinute: number
): Promise<boolean> {
  const ipHash = sha256Hex(getClientIp(req));
  const rateKey = `${bucket}:${ipHash}`;
  const nowMs = Date.now();
  const windowMs = 60 * 1000;

  try {
    const [row] = await db
      .select()
      .from(authRateLimits)
      .where(eq(authRateLimits.id, rateKey))
      .limit(1);

    if (row?.lockedUntil) {
      const lockedMs = Date.parse(row.lockedUntil);
      if (!Number.isNaN(lockedMs) && lockedMs > nowMs) {
        return false;
      }
    }

    const firstMs = row?.firstAttemptAt ? Date.parse(row.firstAttemptAt) : 0;
    const windowExpired = !firstMs || Number.isNaN(firstMs) || nowMs - firstMs > windowMs;
    const nextAttempts = windowExpired ? 1 : (row?.attempts || 0) + 1;
    const nextFirstIso = windowExpired ? new Date(nowMs).toISOString() : row!.firstAttemptAt;
    const nextLockedUntil =
      nextAttempts > maxPerMinute ? new Date(nowMs + windowMs).toISOString() : '';

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

    return nextAttempts <= maxPerMinute;
  } catch {
    // Nunca bloquear lectura pública ante fallo puntual de rate limit table
    return true;
  }
}

async function findActiveCouncilor(paramUid: string) {
  const cleanParam = sanitizePlainText(paramUid, 128);
  if (!cleanParam || cleanParam.length < 2) return null;

  const [row] = await db
    .select()
    .from(publicCouncilors)
    .where(
      and(
        eq(publicCouncilors.active, true),
        or(eq(publicCouncilors.uid, cleanParam), eq(publicCouncilors.id, cleanParam))
      )
    )
    .limit(1);

  return row || null;
}

function normalizeAchievementCategory(raw: unknown): AchievementCategory {
  if (
    raw === 'iniciativa' ||
    raw === 'proyecto' ||
    raw === 'reconocimiento' ||
    raw === 'evento' ||
    raw === 'general'
  ) {
    return raw;
  }
  return 'iniciativa';
}

function normalizeGoalStatus(raw: unknown): 'pendiente' | 'en_curso' | 'hecha' {
  if (raw === 'hecha' || raw === 'cumplido' || raw === 'completado') return 'hecha';
  if (raw === 'en_curso' || raw === 'en_progreso' || raw === 'ejecucion') return 'en_curso';
  return 'pendiente';
}

function toSafePublicCouncilor(row: typeof publicCouncilors.$inferSelect): PublicCouncilor {
  return {
    id: row.id,
    uid: row.uid,
    fullName: row.fullName,
    roleLabel: row.roleLabel as RoleLabel,
    commissionId: row.commissionId,
    commissionName: row.commissionName,
    affiliationType: (row.affiliationType || '') as PublicCouncilor['affiliationType'],
    affiliationName: row.affiliationName,
    email: row.email,
    phone: row.phone,
    bio: row.bio,
    photoUrl: row.photoUrl,
    photoThumbUrl: row.photoThumbUrl,
    photoMediumUrl: row.photoMediumUrl,
    storagePath: row.storagePath,
    instagram: row.instagram,
    facebook: row.facebook,
    active: row.active,
    verificado: row.verificado,
    verificadoAt: row.verificadoAt,
    cargoDeclarado: row.cargoDeclarado,
    coordDeclaradaPendiente: row.coordDeclaradaPendiente,
    coordDeclaradaComisionId: row.coordDeclaradaComisionId,
    displayOrder: row.displayOrder,
    updatedAt: row.updatedAt,
  };
}

export function registerCouncilorPublicProfileRoutes(app: express.Express) {
  app.get('/api/public/councilors/:uid/profile', async (req, res) => {
    try {
      const allowed = await checkPublicRateLimit(req, 'pub_profile', 90);
      if (!allowed) {
        res.status(429).json({
          error: 'Demasiadas consultas en poco tiempo. Espera unos segundos e intenta nuevamente.',
        });
        return;
      }

      const target = await findActiveCouncilor(req.params.uid);
      if (!target) {
        res.status(404).json({ error: 'Consejero no encontrado o inactivo.' });
        return;
      }

      const [{ voterKey, authUid }, authUser] = await Promise.all([
        resolveHeartContext(req),
        resolveAuthUser(req).catch(() => null),
      ]);

      const [
        achievementRows,
        goalRows,
        commitmentRows,
        workPlanRows,
        sessionRows,
        voteRows,
        commissionRows,
        heartCountRows,
        myHeartRows,
        roleTermRows,
      ] = await Promise.all([
        db
          .select()
          .from(councilorAchievements)
          .where(eq(councilorAchievements.councilorUid, target.uid))
          .orderBy(desc(councilorAchievements.date), desc(councilorAchievements.createdAt)),
        db
          .select()
          .from(councilorGoals)
          .where(eq(councilorGoals.councilorUid, target.uid))
          .orderBy(desc(councilorGoals.createdAt)),
        db
          .select()
          .from(commitments)
          .where(eq(commitments.responsibleUid, target.uid))
          .orderBy(desc(commitments.createdAt)),
        target.commissionId
          ? db
              .select()
              .from(workPlans)
              .where(eq(workPlans.commissionId, target.commissionId))
              .orderBy(desc(workPlans.updatedAt))
          : Promise.resolve([]),
        db.select().from(sessions).orderBy(desc(sessions.dateIso)),
        db.select().from(votes).orderBy(desc(votes.createdAt)),
        db.select({ id: commissions.id, name: commissions.name }).from(commissions),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(councilorHearts)
          .where(eq(councilorHearts.councilorUid, target.uid)),
        db
          .select({ id: councilorHearts.id })
          .from(councilorHearts)
          .where(
            and(
              eq(councilorHearts.councilorUid, target.uid),
              eq(councilorHearts.voterKey, voterKey)
            )
          )
          .limit(1),
        db
          .select()
          .from(roleTerms)
          .where(eq(roleTerms.councilorUid, target.uid))
          .orderBy(desc(roleTerms.startDate), desc(roleTerms.createdAt)),
      ]);

      const commNameMap = new Map(commissionRows.map((c) => [c.id, c.name]));

      const roleHistory: RoleTermHistoryItem[] = roleTermRows
        .filter((t) => t.status === 'vigente' || t.status === 'finalizado')
        .sort((a, b) => {
          if (a.status === 'vigente' && b.status !== 'vigente') return -1;
          if (b.status === 'vigente' && a.status !== 'vigente') return 1;
          return (b.startDate || '').localeCompare(a.startDate || '');
        })
        .map((t) => ({
          id: t.id,
          roleLabel: t.roleLabel as ElectiveRoleLabel,
          commissionId: t.commissionId || undefined,
          commissionName: t.commissionId ? commNameMap.get(t.commissionId) || undefined : undefined,
          status: t.status as RoleTermHistoryItem['status'],
          startDate: t.startDate,
          endDate: t.endDate,
          periodLabel: formatTermYearsLabel(t.startDate, t.endDate, t.status),
          electedByVoteId: t.electedByVoteId || undefined,
        }));

      // 1) Logros: registros propios + compromisos cumplidos
      const achievements: CouncilorAchievementItem[] = [
        ...achievementRows.map((a) => ({
          id: a.id,
          title: a.title,
          description: a.description,
          date: a.date || new Date(a.createdAt).toISOString().slice(0, 10),
          category: normalizeAchievementCategory(a.category),
          evidenceUrl: a.evidenceUrl || undefined,
          source: 'registro' as const,
        })),
        ...commitmentRows
          .filter((c) => c.status === 'cumplido' || (c.status as string) === 'hecha')
          .map((c) => ({
            id: `comp_${c.id}`,
            title: c.title,
            description:
              c.description ||
              `Compromiso institucional cumplido en ${commNameMap.get(c.commissionId) || 'el CMJ'}.`,
            date: c.dueDate || new Date(c.updatedAt).toISOString().slice(0, 10),
            category: 'proyecto' as const,
            source: 'compromiso' as const,
          })),
      ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

      // 2) Metas: metas personales + compromisos asignados + metas del plan de trabajo de su comisión
      const goals: CouncilorGoalItem[] = [
        ...goalRows.map((g) => ({
          id: g.id,
          title: g.title,
          description: g.description,
          status: normalizeGoalStatus(g.status),
          progress: Math.max(0, Math.min(100, Number(g.progress) || 0)),
          dueDate: g.dueDate,
          source: 'meta' as const,
        })),
        ...commitmentRows.map((c) => ({
          id: `goal_comp_${c.id}`,
          title: c.title,
          description: c.description || 'Compromiso asignado en sesión o comisión.',
          status: normalizeGoalStatus(c.status),
          progress: Math.max(0, Math.min(100, Number(c.progress) || 0)),
          dueDate: c.dueDate || '',
          source: 'compromiso' as const,
          axis: commNameMap.get(c.commissionId) || undefined,
        })),
        ...workPlanRows.map((wp) => ({
          id: `goal_wp_${wp.id}`,
          title: wp.title,
          description: `Eje estratégico: ${wp.axis}`,
          status: normalizeGoalStatus(wp.status),
          progress: Math.max(0, Math.min(100, Number(wp.progress) || 0)),
          dueDate: wp.quarter || '',
          source: 'plan_trabajo' as const,
          axis: wp.axis,
        })),
      ];

      // 3) Asistencia: agregada desde sessions.attendance[target.uid]
      let presente = 0;
      let tarde = 0;
      let excusa = 0;
      let ausente = 0;
      const recentAttendance: AttendanceSessionRecord[] = [];

      for (const s of sessionRows) {
        const map = (s.attendance || {}) as Record<string, string>;
        const rawStatus = map[target.uid];
        if (
          rawStatus === 'presente' ||
          rawStatus === 'tarde' ||
          rawStatus === 'excusa' ||
          rawStatus === 'ausente'
        ) {
          const status: AttendanceStatus = rawStatus;
          if (status === 'presente') presente += 1;
          else if (status === 'tarde') tarde += 1;
          else if (status === 'excusa') excusa += 1;
          else ausente += 1;

          if (recentAttendance.length < 15) {
            recentAttendance.push({
              sessionId: s.id,
              title: s.title,
              sessionType: s.sessionType,
              dateIso: s.dateIso,
              status,
            });
          }
        }
      }

      const totalRecorded = presente + tarde + excusa + ausente;
      const attendancePercentage =
        totalRecorded > 0 ? Math.round(((presente + tarde) / totalRecorded) * 100) : 0;

      // 4) Votaciones: ESTRICTA PRIVACIDAD en voto secreto (cero nominalBallots en modo 'secreto')
      const voteItems: PublicVoteHistoryItem[] = [];
      let participatedCount = 0;

      for (const v of voteRows) {
        const voterList = Array.isArray(v.voterUids) ? v.voterUids : [];
        const participated = voterList.includes(target.uid);
        if (participated) participatedCount += 1;

        const mode = (
          v.voteMode === 'secreto' || v.voteMode === 'mano_alzada' ? v.voteMode : 'nominal'
        ) as VoteMode;

        // NUNCA leer ni exponer la opción votada cuando voteMode === 'secreto'
        let choice: string | null = null;
        if (mode !== 'secreto' && participated) {
          const ballots = (v.nominalBallots || {}) as Record<string, string>;
          const rawChoice = ballots[target.uid];
          if (typeof rawChoice === 'string' && rawChoice.trim()) {
            choice = rawChoice.trim();
          }
        }

        voteItems.push({
          voteId: v.id,
          title: v.title,
          date:
            v.closesAt ||
            v.deadline ||
            v.opensAt ||
            new Date(v.createdAt).toISOString().slice(0, 10),
          commissionName: v.commissionId
            ? commNameMap.get(v.commissionId) || 'Comisión'
            : 'Plenaria CMJ',
          voteMode: mode,
          status: (
            v.status === 'abierta' ||
            v.status === 'cerrada' ||
            v.status === 'empate' ||
            v.status === 'sin_resultado'
              ? v.status
              : 'cerrada'
          ) as VoteStatus,
          participated,
          choice,
        });
      }

      const totalVotes = voteRows.length;
      const participationRate =
        totalVotes > 0 ? Math.round((participatedCount / totalVotes) * 100) : 0;

      const canManageOwnContent = Boolean(
        authUser &&
          (authUser.uid === target.uid || userHasPermission(authUser, 'usuarios.editar'))
      );

      const response: CouncilorPublicProfileResponse = {
        councilor: toSafePublicCouncilor(target),
        achievements,
        goals,
        attendance: {
          totalSessions: sessionRows.length,
          totalRecorded,
          presente,
          tarde,
          excusa,
          ausente,
          percentage: attendancePercentage,
          recent: recentAttendance,
        },
        votes: {
          totalVotes,
          participatedCount,
          participationRate,
          items: voteItems,
        },
        hearts: {
          count: Number(heartCountRows[0]?.count || 0),
          viewerHasHearted: myHeartRows.length > 0,
          canHeart: authUid !== target.uid,
        },
        canManageOwnContent,
        roleHistory,
      };

      res.json(response);
    } catch (error) {
      console.error('Public councilor profile fetch failed:', error);
      res.status(500).json({ error: 'No se pudo cargar la ficha completa del consejero.' });
    }
  });

  app.post('/api/public/councilors/:uid/heart', async (req, res) => {
    try {
      const allowed = await checkPublicRateLimit(req, 'pub_heart', 30);
      if (!allowed) {
        res.status(429).json({
          error: 'Has enviado muchos apoyos seguidos. Espera un momento e intenta nuevamente.',
        });
        return;
      }

      const target = await findActiveCouncilor(req.params.uid);
      if (!target) {
        res.status(404).json({ error: 'Consejero no encontrado o inactivo.' });
        return;
      }

      const { voterKey, authUid } = await resolveHeartContext(req);
      if (authUid && authUid === target.uid) {
        res.status(400).json({
          error: 'No puedes enviarte un corazón de apoyo a ti mismo.',
        });
        return;
      }

      const [existing] = await db
        .select({ id: councilorHearts.id })
        .from(councilorHearts)
        .where(
          and(
            eq(councilorHearts.councilorUid, target.uid),
            eq(councilorHearts.voterKey, voterKey)
          )
        )
        .limit(1);

      let hearted = false;
      if (existing) {
        await db.delete(councilorHearts).where(eq(councilorHearts.id, existing.id));
        hearted = false;
      } else {
        await db
          .insert(councilorHearts)
          .values({
            id: newId('heart'),
            councilorUid: target.uid,
            voterKey,
          })
          .onConflictDoNothing();
        hearted = true;
      }

      const [countRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(councilorHearts)
        .where(eq(councilorHearts.councilorUid, target.uid));

      res.json({
        ok: true,
        councilorUid: target.uid,
        hearted,
        count: Number(countRow?.count || 0),
      });
    } catch (error) {
      console.error('Heart toggle failed:', error);
      res.status(500).json({ error: 'No se pudo registrar tu apoyo ciudadano.' });
    }
  });

  // Rutas autenticadas para que el consejero (o Mesa Directiva con usuarios.editar) gestione sus propios logros y metas
  app.post('/api/councilors/:uid/achievements', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const target = await findActiveCouncilor(req.params.uid);
      if (!target) {
        res.status(404).json({ error: 'Consejero no encontrado.' });
        return;
      }
      if (me.uid !== target.uid && !userHasPermission(me, 'usuarios.editar')) {
        res.status(403).json({ error: 'Solo puedes registrar logros en tu propio perfil.' });
        return;
      }

      const title = sanitizePlainText(req.body?.title, 160);
      const description = sanitizePlainText(req.body?.description, 800);
      const date = sanitizePlainText(req.body?.date, 32) || new Date().toISOString().slice(0, 10);
      const category = normalizeAchievementCategory(req.body?.category);
      const evidenceUrl = typeof req.body?.evidenceUrl === 'string' ? req.body.evidenceUrl.trim() : '';

      if (title.length < 3) {
        res.status(400).json({ error: 'El título del logro debe tener al menos 3 caracteres.' });
        return;
      }
      if (evidenceUrl && !isSafeUrl(evidenceUrl)) {
        res.status(400).json({ error: 'El enlace de evidencia debe ser una URL válida (https://).' });
        return;
      }

      const id = newId('ach');
      await db.insert(councilorAchievements).values({
        id,
        councilorUid: target.uid,
        title,
        description,
        date,
        category,
        evidenceUrl,
        createdByUid: me.uid,
      });

      await logServerAudit(me, 'Registró logro en perfil público', 'Perfil Consejero', title);
      res.json({ ok: true, id });
    } catch (error) {
      console.error('Create achievement failed:', error);
      res.status(500).json({ error: 'No se pudo guardar el logro.' });
    }
  });

  app.delete(
    '/api/councilors/:uid/achievements/:id',
    requireAuth,
    async (req: AuthedRequest, res) => {
      try {
        const me = req.authUser!;
        const target = await findActiveCouncilor(req.params.uid);
        if (!target) {
          res.status(404).json({ error: 'Consejero no encontrado.' });
          return;
        }
        if (me.uid !== target.uid && !userHasPermission(me, 'usuarios.editar')) {
          res.status(403).json({ error: 'No tienes permiso para eliminar este logro.' });
          return;
        }

        const [row] = await db
          .select()
          .from(councilorAchievements)
          .where(
            and(
              eq(councilorAchievements.id, String(req.params.id)),
              eq(councilorAchievements.councilorUid, target.uid)
            )
          )
          .limit(1);

        if (!row) {
          res.status(404).json({ error: 'Logro no encontrado.' });
          return;
        }

        await db.delete(councilorAchievements).where(eq(councilorAchievements.id, row.id));
        await logServerAudit(me, 'Eliminó logro de perfil público', 'Perfil Consejero', row.title);
        res.json({ ok: true });
      } catch (error) {
        console.error('Delete achievement failed:', error);
        res.status(500).json({ error: 'No se pudo eliminar el logro.' });
      }
    }
  );

  app.post('/api/councilors/:uid/goals', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const target = await findActiveCouncilor(req.params.uid);
      if (!target) {
        res.status(404).json({ error: 'Consejero no encontrado.' });
        return;
      }
      if (me.uid !== target.uid && !userHasPermission(me, 'usuarios.editar')) {
        res.status(403).json({ error: 'Solo puedes registrar metas en tu propio perfil.' });
        return;
      }

      const title = sanitizePlainText(req.body?.title, 160);
      const description = sanitizePlainText(req.body?.description, 800);
      const status = normalizeGoalStatus(req.body?.status);
      const rawProgress = Number(req.body?.progress);
      const progress = Number.isFinite(rawProgress)
        ? Math.max(0, Math.min(100, Math.round(rawProgress)))
        : status === 'hecha'
          ? 100
          : status === 'en_curso'
            ? 50
            : 0;
      const dueDate = sanitizePlainText(req.body?.dueDate, 40);

      if (title.length < 3) {
        res.status(400).json({ error: 'El título de la meta debe tener al menos 3 caracteres.' });
        return;
      }

      const id = newId('goal');
      await db.insert(councilorGoals).values({
        id,
        councilorUid: target.uid,
        title,
        description,
        status,
        progress,
        dueDate,
        createdByUid: me.uid,
      });

      await logServerAudit(me, 'Registró meta de período', 'Perfil Consejero', title);
      res.json({ ok: true, id });
    } catch (error) {
      console.error('Create goal failed:', error);
      res.status(500).json({ error: 'No se pudo guardar la meta.' });
    }
  });

  app.delete('/api/councilors/:uid/goals/:id', requireAuth, async (req: AuthedRequest, res) => {
    try {
      const me = req.authUser!;
      const target = await findActiveCouncilor(req.params.uid);
      if (!target) {
        res.status(404).json({ error: 'Consejero no encontrado.' });
        return;
      }
      if (me.uid !== target.uid && !userHasPermission(me, 'usuarios.editar')) {
        res.status(403).json({ error: 'No tienes permiso para eliminar esta meta.' });
        return;
      }

      const [row] = await db
        .select()
        .from(councilorGoals)
        .where(
          and(
            eq(councilorGoals.id, String(req.params.id)),
            eq(councilorGoals.councilorUid, target.uid)
          )
        )
        .limit(1);

      if (!row) {
        res.status(404).json({ error: 'Meta no encontrada.' });
        return;
      }

      await db.delete(councilorGoals).where(eq(councilorGoals.id, row.id));
      await logServerAudit(me, 'Eliminó meta de período', 'Perfil Consejero', row.title);
      res.json({ ok: true });
    } catch (error) {
      console.error('Delete goal failed:', error);
      res.status(500).json({ error: 'No se pudo eliminar la meta.' });
    }
  });
}
