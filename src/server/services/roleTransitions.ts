import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  allowedAccounts,
  auditLogs,
  commissions,
  grantedPermissions,
  notifications,
  publicCouncilors,
  roleTerms,
  users,
  votes,
} from '../../db/schema.ts';
import {
  BLANK_VOTE_OPTION,
  HANDOVER_DEADLINE_DAYS,
  formatBogotaDateTime,
  getStartOfTodayBogotaIso,
  isElectiveRole,
  isUniqueRole,
  requiresCommissionForRole,
} from '../../lib/roleTerms.ts';
import { roleLabelToAccessTier } from '../security.ts';
import {
  createPortalNotification,
  newId,
  roleDefaultDisplayOrder,
} from '../helpers.ts';
import type {
  ElectiveRoleLabel,
  MajorityType,
  RoleLabel,
  VoteCandidate,
} from '../../types/cmj.ts';

let transitionMutex: Promise<void> = Promise.resolve();

function withTransitionMutex<T>(fn: () => Promise<T>): Promise<T> {
  const run = transitionMutex.then(fn, fn);
  transitionMutex = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

export interface ElectionOutcomeResult {
  status: 'cerrada' | 'empate' | 'sin_resultado';
  winnerUid: string;
  winnerName: string;
  tiedCandidateUids: string[];
  resultSummary: string;
}

export function computeMajorityThreshold(totalVotes: number, majorityType: MajorityType): number {
  if (totalVotes <= 0) return 1;
  switch (majorityType) {
    case 'absoluta':
      return Math.floor(totalVotes / 2) + 1;
    case 'dos_tercios':
      return Math.ceil((totalVotes * 2) / 3);
    case 'unanimidad':
      return totalVotes;
    case 'simple':
    default:
      return 1;
  }
}

/**
 * Calcula autoritativamente en el servidor el resultado de una votación
 * (soporta votaciones generales y elecciones de cargo con Voto en blanco,
 * empates, quórum y reglas de mayoría).
 */
export function computeVoteOutcomeServer(
  voteRow: typeof votes.$inferSelect
): ElectionOutcomeResult {
  const voterUids = Array.isArray(voteRow.voterUids) ? voteRow.voterUids : [];
  const totalVotes = voterUids.length;
  const quorumReq = Math.max(1, Number(voteRow.quorumRequired) || 1);
  const tallies = (voteRow.tallies || {}) as Record<string, number>;
  const majorityType = (voteRow.majorityType || 'simple') as MajorityType;
  const options = Array.isArray(voteRow.options) ? voteRow.options : [];

  if (voteRow.kind !== 'eleccion_cargo') {
    if (totalVotes < quorumReq) {
      return {
        status: 'cerrada',
        winnerUid: '',
        winnerName: '',
        tiedCandidateUids: [],
        resultSummary: `Sin quórum (${totalVotes}/${quorumReq})`,
      };
    }
    const sorted = options
      .map((o) => ({ o, c: tallies[o] || 0 }))
      .sort((a, b) => b.c - a.c);
    const winner = sorted[0];
    const tie = sorted.length > 1 && sorted[0].c === sorted[1].c;
    const needed = computeMajorityThreshold(totalVotes, majorityType);
    const approved =
      Boolean(winner) &&
      !tie &&
      (majorityType === 'simple' ? winner.c > (sorted[1]?.c || 0) : winner.c >= needed);

    return {
      status: 'cerrada',
      winnerUid: '',
      winnerName: '',
      tiedCandidateUids: [],
      resultSummary: tie
        ? `Empate (${winner?.c || 0} votos)`
        : approved
          ? `Aprobada: "${winner.o}" (${winner.c}/${totalVotes})`
          : `No alcanzó mayoría requerida (${winner?.c || 0}/${totalVotes})`,
    };
  }

  // Elección de cargo
  if (totalVotes < quorumReq) {
    return {
      status: 'sin_resultado',
      winnerUid: '',
      winnerName: '',
      tiedCandidateUids: [],
      resultSummary: `Sin resultado: quórum insuficiente (${totalVotes}/${quorumReq} votos).`,
    };
  }

  const candidates = Array.isArray(voteRow.candidates)
    ? (voteRow.candidates as VoteCandidate[])
    : [];

  if (candidates.length === 0) {
    return {
      status: 'sin_resultado',
      winnerUid: '',
      winnerName: '',
      tiedCandidateUids: [],
      resultSummary: 'Sin resultado: no hay candidaturas registradas.',
    };
  }

  const candidateScores = candidates.map((c) => ({
    uid: c.uid,
    fullName: c.fullName,
    count: Number(tallies[c.fullName] || 0),
  }));

  const blankCount = Number(tallies[BLANK_VOTE_OPTION] || 0);
  const maxCandCount = Math.max(0, ...candidateScores.map((c) => c.count));

  if (maxCandCount === 0 && blankCount === 0) {
    return {
      status: 'sin_resultado',
      winnerUid: '',
      winnerName: '',
      tiedCandidateUids: [],
      resultSummary: 'Sin resultado: no se registraron votos válidos.',
    };
  }

  // Regla: si "Voto en blanco" gana o iguala a la candidatura más votada, no hay elección
  if (blankCount > maxCandCount) {
    return {
      status: 'sin_resultado',
      winnerUid: '',
      winnerName: '',
      tiedCandidateUids: [],
      resultSummary: `Sin resultado: ganó el ${BLANK_VOTE_OPTION} (${blankCount}/${totalVotes} votos). Debe repetirse la elección.`,
    };
  }

  const topCandidates = candidateScores.filter((c) => c.count === maxCandCount);

  if (blankCount === maxCandCount) {
    return {
      status: 'sin_resultado',
      winnerUid: '',
      winnerName: '',
      tiedCandidateUids: [],
      resultSummary: `Sin resultado: empate entre ${BLANK_VOTE_OPTION} y candidatura(s) con ${blankCount} votos.`,
    };
  }

  if (topCandidates.length > 1) {
    const names = topCandidates.map((c) => c.fullName).join(', ');
    return {
      status: 'empate',
      winnerUid: '',
      winnerName: '',
      tiedCandidateUids: topCandidates.map((c) => c.uid),
      resultSummary: `Empate entre ${names} (${maxCandCount} votos cada uno). Convoca desempate de segunda vuelta.`,
    };
  }

  const leader = topCandidates[0];
  const needed = computeMajorityThreshold(totalVotes, majorityType);
  const meetsMajority =
    majorityType === 'simple' ? true : leader.count >= needed;

  if (!meetsMajority) {
    return {
      status: 'sin_resultado',
      winnerUid: '',
      winnerName: '',
      tiedCandidateUids: [],
      resultSummary: `Sin resultado: ${leader.fullName} obtuvo ${leader.count}/${totalVotes} votos y no alcanzó la mayoría requerida (${needed}).`,
    };
  }

  return {
    status: 'cerrada',
    winnerUid: leader.uid,
    winnerName: leader.fullName,
    tiedCandidateUids: [],
    resultSummary: `Electo(a) para ${voteRow.targetRole}: ${leader.fullName} (${leader.count}/${totalVotes} votos). Relevo pendiente de fecha de entrega.`,
  };
}

/**
 * Asegura que los titulares actuales (Mesa Directiva, Consejero Departamental
 * y Coordinadores de Comisión) tengan un registro 'vigente' inicial en role_terms
 * si aún no existía uno, permitiendo relevos ordenados e historial completo.
 */
export async function bootstrapInitialRoleTermsIfEmpty(): Promise<void> {
  try {
    const [activeTerms, activeUsers, pubRows, commRows] = await Promise.all([
      db.select().from(roleTerms).where(eq(roleTerms.status, 'vigente')),
      db.select().from(users).where(eq(users.active, true)),
      db.select().from(publicCouncilors),
      db.select().from(commissions),
    ]);

    const nameByUid = new Map(pubRows.map((p) => [p.uid, p.fullName]));
    const activeByUid = new Map(activeUsers.map((u) => [u.uid, u]));
    const nowIso = new Date().toISOString();

    const uniqueBoardRoles: RoleLabel[] = [
      'Presidente',
      'Vicepresidente',
      'Secretario',
      'Consejero Departamental',
    ];

    for (const r of uniqueBoardRoles) {
      const hasVigente = activeTerms.some(
        (t) => t.roleLabel === r && (t.commissionId || '') === ''
      );
      if (hasVigente) continue;

      const holder = activeUsers.find((u) => u.roleLabel === r);
      if (!holder) continue;

      const startIso = holder.createdAt
        ? new Date(holder.createdAt).toISOString()
        : nowIso;
      await db
        .insert(roleTerms)
        .values({
          id: newId('term'),
          councilorUid: holder.uid,
          councilorName: nameByUid.get(holder.uid) || holder.email.split('@')[0],
          roleLabel: r,
          commissionId: '',
          status: 'vigente',
          startDate: startIso,
          endDate: '',
          electedByVoteId: '',
          previousTermId: '',
          handoverNotes: 'Periodo inicial reconocido en el sistema',
          createdByUid: 'system',
        })
        .onConflictDoNothing();
    }

    for (const c of commRows) {
      if (!c.coordinatorUid) continue;
      const coordUser = activeByUid.get(c.coordinatorUid);
      if (!coordUser) continue;

      const hasVigente = activeTerms.some(
        (t) => t.roleLabel === 'Coordinador de Comisión' && t.commissionId === c.id
      );
      if (hasVigente) continue;

      await db
        .insert(roleTerms)
        .values({
          id: newId('term'),
          councilorUid: coordUser.uid,
          councilorName:
            nameByUid.get(coordUser.uid) || c.coordinatorName || coordUser.email.split('@')[0],
          roleLabel: 'Coordinador de Comisión',
          commissionId: c.id,
          status: 'vigente',
          startDate: coordUser.createdAt
            ? new Date(coordUser.createdAt).toISOString()
            : nowIso,
          endDate: '',
          electedByVoteId: '',
          previousTermId: '',
          handoverNotes: `Coordinación inicial de ${c.name}`,
          createdByUid: 'system',
        })
        .onConflictDoNothing();
    }
  } catch (err) {
    console.error('Bootstrap initial role terms error:', err);
  }
}

async function getLeaderUids(txOrDb: typeof db): Promise<string[]> {
  const leaders = await txOrDb
    .select({ uid: users.uid, roleLabel: users.roleLabel })
    .from(users)
    .where(
      and(
        eq(users.active, true),
        inArray(users.roleLabel, ['Presidente', 'Vicepresidente', 'Secretario'])
      )
    );
  return leaders.map((l) => l.uid);
}

/**
 * Registra el periodo 'programado' al cerrarse una votación de elección con ganador
 * (sin otorgar permisos todavía). Notifica al ganador, al saliente y a Mesa Directiva.
 */
export async function handleElectionClosure(
  voteId: string,
  outcome: ElectionOutcomeResult,
  actorUid: string
): Promise<{ createdTermId: string | null }> {
  if (outcome.status !== 'cerrada' || !outcome.winnerUid) {
    return { createdTermId: null };
  }

  await bootstrapInitialRoleTermsIfEmpty();

  const [voteRow] = await db.select().from(votes).where(eq(votes.id, voteId)).limit(1);
  if (!voteRow || voteRow.kind !== 'eleccion_cargo' || !isElectiveRole(voteRow.targetRole)) {
    return { createdTermId: null };
  }

  const targetRole = voteRow.targetRole as ElectiveRoleLabel;
  const targetCommId = requiresCommissionForRole(targetRole)
    ? voteRow.targetCommissionId || ''
    : '';

  const [existingForVote] = await db
    .select()
    .from(roleTerms)
    .where(eq(roleTerms.electedByVoteId, voteRow.id))
    .limit(1);

  if (existingForVote && existingForVote.status !== 'cancelado') {
    return { createdTermId: existingForVote.id };
  }

  const [winnerPub] = await db
    .select({ fullName: publicCouncilors.fullName })
    .from(publicCouncilors)
    .where(eq(publicCouncilors.uid, outcome.winnerUid))
    .limit(1);

  const winnerName = winnerPub?.fullName || outcome.winnerName;

  // Buscar titular vigente actual si es cargo único
  let outgoingTerm: typeof roleTerms.$inferSelect | undefined;
  if (isUniqueRole(targetRole)) {
    const activeTerms = await db
      .select()
      .from(roleTerms)
      .where(
        and(
          eq(roleTerms.roleLabel, targetRole),
          eq(roleTerms.commissionId, targetCommId),
          eq(roleTerms.status, 'vigente')
        )
      )
      .orderBy(desc(roleTerms.createdAt));
    outgoingTerm = activeTerms[0];
  }

  const termId = newId('term');
  await db.insert(roleTerms).values({
    id: termId,
    councilorUid: outcome.winnerUid,
    councilorName: winnerName,
    roleLabel: targetRole,
    commissionId: targetCommId,
    status: 'programado',
    startDate: '',
    endDate: '',
    electedByVoteId: voteRow.id,
    previousTermId: outgoingTerm?.id || '',
    handoverNotes: '',
    createdByUid: actorUid || 'system',
  });

  // Notificar al ganador, al saliente y a Mesa Directiva
  const commLabel = targetCommId ? ` (${targetCommId})` : '';
  const notifyTargets = new Set<string>();
  notifyTargets.add(outcome.winnerUid);
  if (outgoingTerm?.councilorUid) notifyTargets.add(outgoingTerm.councilorUid);
  const leaderUids = await getLeaderUids(db);
  for (const lUid of leaderUids) notifyTargets.add(lUid);

  for (const targetUid of notifyTargets) {
    const isWinner = targetUid === outcome.winnerUid;
    const isOutgoing = outgoingTerm?.councilorUid === targetUid;
    await createPortalNotification({
      userUid: targetUid,
      type: isOutgoing ? 'relevo_pendiente' : 'eleccion_resultado',
      title: isWinner
        ? `¡Fuiste electo(a) como ${targetRole}!`
        : isOutgoing
          ? `Relevo pendiente: ${targetRole}${commLabel}`
          : `Elección cerrada: ${winnerName} electo(a) como ${targetRole}`,
      message: isOutgoing
        ? `${winnerName} fue electo(a) para sucederle en ${targetRole}${commLabel}. Registra la fecha de entrega del cargo en "Usuarios y Mesa → Relevos y Periodos".`
        : isWinner
          ? `Has sido electo(a) en la votación "${voteRow.title}". Tus nuevos permisos se activarán automáticamente cuando se cumpla la fecha de entrega del cargo.`
          : `${winnerName} resultó electo(a) en "${voteRow.title}". El periodo quedó programado pendiente de fecha de entrega.`,
      linkModule: isOutgoing ? 'usuarios' : 'votaciones',
      relatedId: termId,
    });
  }

  return { createdTermId: termId };
}

/**
 * Cierra automáticamente votaciones cuya fecha límite (closesAt) ya se cumplió.
 */
export async function closeExpiredVotes(): Promise<number> {
  const openVotes = await db.select().from(votes).where(eq(votes.status, 'abierta'));
  if (openVotes.length === 0) return 0;

  const nowMs = Date.now();
  let closedCount = 0;

  for (const v of openVotes) {
    if (!v.closesAt) continue;
    const closeMs = Date.parse(v.closesAt);
    if (Number.isNaN(closeMs) || closeMs > nowMs) continue;

    const outcome = computeVoteOutcomeServer(v);
    const [updated] = await db
      .update(votes)
      .set({
        status: outcome.status,
        winnerUid: outcome.winnerUid,
        winnerName: outcome.winnerName,
        tiedCandidateUids: outcome.tiedCandidateUids,
        resultSummary: outcome.resultSummary,
        updatedAt: new Date(),
      })
      .where(and(eq(votes.id, v.id), eq(votes.status, 'abierta')))
      .returning();

    if (!updated) continue;
    closedCount += 1;

    if (updated.kind === 'eleccion_cargo') {
      await handleElectionClosure(updated.id, outcome, 'system');
      if (outcome.status === 'empate' || outcome.status === 'sin_resultado') {
        const leaders = await getLeaderUids(db);
        for (const lUid of leaders) {
          await createPortalNotification({
            userUid: lUid,
            type: 'eleccion_resultado',
            title:
              outcome.status === 'empate'
                ? `Empate en elección: ${updated.title}`
                : `Elección sin resultado: ${updated.title}`,
            message: outcome.resultSummary,
            linkModule: 'votaciones',
            relatedId: updated.id,
          });
        }
      }
    }
  }

  return closedCount;
}

/**
 * Envía alerta si un periodo programado lleva más de 30 días sin fecha de entrega registrada.
 */
export async function syncOverdueHandoverAlerts(): Promise<void> {
  try {
    const scheduled = await db
      .select()
      .from(roleTerms)
      .where(eq(roleTerms.status, 'programado'));

    const thresholdMs = Date.now() - HANDOVER_DEADLINE_DAYS * 24 * 60 * 60 * 1000;
    const nowIso = new Date().toISOString();

    for (const term of scheduled) {
      if (term.startDate || term.overdueNotifiedAt) continue;
      const createdMs = new Date(term.createdAt).getTime();
      if (Number.isNaN(createdMs) || createdMs > thresholdMs) continue;

      await db
        .update(roleTerms)
        .set({ overdueNotifiedAt: nowIso, updatedAt: new Date() })
        .where(eq(roleTerms.id, term.id));

      const targets = new Set<string>(await getLeaderUids(db));
      if (term.previousTermId) {
        const [prev] = await db
          .select({ councilorUid: roleTerms.councilorUid })
          .from(roleTerms)
          .where(eq(roleTerms.id, term.previousTermId))
          .limit(1);
        if (prev?.councilorUid) targets.add(prev.councilorUid);
      }

      for (const targetUid of targets) {
        await createPortalNotification({
          userUid: targetUid,
          type: 'relevo_vencido',
          title: `Alerta (+${HANDOVER_DEADLINE_DAYS} días): Relevo sin fecha en ${term.roleLabel}`,
          message: `El relevo hacia ${term.councilorName} lleva más de ${HANDOVER_DEADLINE_DAYS} días sin fecha de entrega registrada.`,
          linkModule: 'usuarios',
          relatedId: term.id,
        });
      }
    }
  } catch (err) {
    console.error('Sync overdue handover alerts error:', err);
  }
}

/**
 * Procesa de forma atómica e idempotente todos los periodos 'programado'
 * cuya fecha de inicio ya se cumplió (startDate <= now).
 */
export async function processDueRoleTransitions(): Promise<number> {
  return withTransitionMutex(async () => {
    await bootstrapInitialRoleTermsIfEmpty();

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    let activatedCount = 0;

    // Primero detectamos IDs candidatos sin bloquear demasiado si no hay ninguno vencido
    const candidates = await db
      .select({ id: roleTerms.id, startDate: roleTerms.startDate })
      .from(roleTerms)
      .where(eq(roleTerms.status, 'programado'));

    const dueIds = candidates
      .filter((c) => c.startDate && !Number.isNaN(Date.parse(c.startDate)) && Date.parse(c.startDate) <= nowMs)
      .map((c) => c.id);

    if (dueIds.length === 0) return 0;

    for (const termId of dueIds) {
      const result = await db.transaction(async (tx) => {
        // Bloqueo FOR UPDATE para garantizar idempotencia ante ejecuciones concurrentes
        const lockedRes = await tx.execute<{
          id: string;
          councilor_uid: string;
          councilor_name: string;
          role_label: string;
          commission_id: string;
          status: string;
          start_date: string;
          previous_term_id: string;
          elected_by_vote_id: string;
        }>(
          sql`SELECT id, councilor_uid, councilor_name, role_label, commission_id, status, start_date, previous_term_id, elected_by_vote_id
              FROM role_terms
              WHERE id = ${termId}
              FOR UPDATE`
        );

        const raw = lockedRes.rows[0];
        if (!raw || raw.status !== 'programado' || !raw.start_date) {
          return null;
        }
        const startMs = Date.parse(raw.start_date);
        if (Number.isNaN(startMs) || startMs > Date.now()) {
          return null;
        }

        const targetRole = raw.role_label as ElectiveRoleLabel;
        const targetCommId = requiresCommissionForRole(targetRole) ? raw.commission_id || '' : '';

        const [incomingUser] = await tx
          .select()
          .from(users)
          .where(eq(users.uid, raw.councilor_uid))
          .limit(1);

        const [incomingPub] = await tx
          .select()
          .from(publicCouncilors)
          .where(eq(publicCouncilors.uid, raw.councilor_uid))
          .limit(1);

        if (!incomingUser || !incomingUser.active) {
          await tx
            .update(roleTerms)
            .set({
              status: 'cancelado',
              cancelReason: 'El consejero electo no se encuentra activo al momento del relevo.',
              updatedAt: new Date(),
            })
            .where(eq(roleTerms.id, raw.id));
          return null;
        }

        const incomingName =
          incomingPub?.fullName || raw.councilor_name || incomingUser.email.split('@')[0];

        // Buscar todos los periodos vigentes de ese mismo cargo (y comisión si aplica) con bloqueo FOR UPDATE
        const vigenteTermsRes = await tx.execute<{
          id: string;
          councilor_uid: string;
          councilor_name: string;
          role_label: string;
          commission_id: string;
        }>(
          sql`SELECT id, councilor_uid, councilor_name, role_label, commission_id
              FROM role_terms
              WHERE status = 'vigente'
                AND role_label = ${targetRole}
                AND commission_id = ${targetCommId}
              FOR UPDATE`
        );

        const outgoingTerms = isUniqueRole(targetRole)
          ? vigenteTermsRes.rows
          : raw.previous_term_id
            ? vigenteTermsRes.rows.filter((r) => r.id === raw.previous_term_id)
            : [];

        const outgoingUids = Array.from(
          new Set(
            outgoingTerms
              .map((o) => o.councilor_uid)
              .filter((u) => u && u !== incomingUser.uid)
          )
        );

        // Si el cargo es de Mesa/Departamental (no Coordinador de Comisión), también revisar si alguien más en `users` tenía ese rol único
        if (isUniqueRole(targetRole) && targetRole !== 'Coordinador de Comisión') {
          const usersHoldingRole = await tx
            .select({ uid: users.uid })
            .from(users)
            .where(and(eq(users.roleLabel, targetRole), eq(users.active, true)));
          for (const uh of usersHoldingRole) {
            if (uh.uid !== incomingUser.uid && !outgoingUids.includes(uh.uid)) {
              outgoingUids.push(uh.uid);
            }
          }
        }

        // Cerrar periodos salientes como 'finalizado'
        for (const outTerm of outgoingTerms) {
          await tx
            .update(roleTerms)
            .set({
              status: 'finalizado',
              endDate: raw.start_date || nowIso,
              updatedAt: new Date(),
            })
            .where(eq(roleTerms.id, outTerm.id));
        }

        // Procesar degradación y revocación de permisos temporales del saliente
        const demotedOutgoingUids: string[] = [];
        for (const outUid of outgoingUids) {
          const [outUser] = await tx
            .select()
            .from(users)
            .where(eq(users.uid, outUid))
            .limit(1);
          if (!outUser) continue;

          if (targetRole === 'Coordinador de Comisión') {
            // Quitar permisos temporales específicos de esa comisión si tenía
            await tx
              .update(grantedPermissions)
              .set({
                active: false,
                revokedAt: nowIso,
                revokedByUid: 'system',
                revokedByName: 'Relevo Automático CMJ',
                revocationReason: `Finalización de período como Coordinador de ${targetCommId}`,
              })
              .where(
                and(
                  eq(grantedPermissions.userUid, outUid),
                  eq(grantedPermissions.active, true),
                  eq(grantedPermissions.targetCommissionId, targetCommId)
                )
              );
          } else {
            // Verificar si conserva otro cargo vigente (ej. Consejero Departamental)
            const otherActiveTerms = await tx
              .select()
              .from(roleTerms)
              .where(and(eq(roleTerms.councilorUid, outUid), eq(roleTerms.status, 'vigente')));

            const preservedRole = otherActiveTerms.find(
              (t) =>
                t.roleLabel !== targetRole &&
                t.roleLabel !== 'Coordinador de Comisión' &&
                t.roleLabel !== 'Consejero'
            )?.roleLabel as RoleLabel | undefined;

            const nextOutRole: RoleLabel = preservedRole || 'Consejero';
            const nextOutTier = roleLabelToAccessTier(nextOutRole);

            // Guardia de seguridad: nunca dejar al portal sin Presidente activo
            let safeToUpdate = true;
            if (outUser.roleLabel === 'Presidente' && nextOutRole !== 'Presidente' && targetRole !== 'Presidente') {
              const otherPresidents = await tx
                .select({ uid: users.uid })
                .from(users)
                .where(and(eq(users.roleLabel, 'Presidente'), eq(users.active, true)));
              const remainingOther = otherPresidents.filter((p) => p.uid !== outUid);
              if (remainingOther.length === 0) {
                safeToUpdate = false;
              }
            }

            if (safeToUpdate) {
              await tx
                .update(users)
                .set({
                  roleLabel: nextOutRole,
                  accessTier: nextOutTier,
                  cargoDeclarado: nextOutRole,
                  updatedAt: new Date(),
                })
                .where(eq(users.uid, outUid));

              await tx
                .update(allowedAccounts)
                .set({
                  roleLabel: nextOutRole,
                  accessTier: nextOutTier,
                  updatedAt: new Date(),
                })
                .where(eq(allowedAccounts.email, outUser.email));

              await tx
                .update(publicCouncilors)
                .set({
                  roleLabel: nextOutRole,
                  cargoDeclarado: nextOutRole,
                  displayOrder: roleDefaultDisplayOrder(nextOutRole),
                  updatedAt: new Date(),
                })
                .where(eq(publicCouncilors.uid, outUid));

              // Revocar permisos temporales otorgados en el periodo del cargo anterior
              await tx
                .update(grantedPermissions)
                .set({
                  active: false,
                  revokedAt: nowIso,
                  revokedByUid: 'system',
                  revokedByName: 'Relevo Automático CMJ',
                  revocationReason: `Cierre de periodo en el cargo ${targetRole}`,
                })
                .where(
                  and(
                    eq(grantedPermissions.userUid, outUid),
                    eq(grantedPermissions.active, true)
                  )
                );

              demotedOutgoingUids.push(outUid);
            }
          }
        }

        // Promover al ganador entrante
        if (targetRole === 'Coordinador de Comisión') {
          const [commRow] = await tx
            .select()
            .from(commissions)
            .where(eq(commissions.id, targetCommId))
            .limit(1);

          if (commRow) {
            await tx
              .update(commissions)
              .set({
                coordinatorUid: incomingUser.uid,
                coordinatorName: incomingName,
                updatedAt: new Date(),
              })
              .where(eq(commissions.id, targetCommId));

            // Si el ganador no tenía comisión asignada o estaba en otra, vincularlo a la comisión coordinada
            if (incomingUser.commissionId !== targetCommId) {
              await tx
                .update(users)
                .set({ commissionId: targetCommId, updatedAt: new Date() })
                .where(eq(users.uid, incomingUser.uid));
              await tx
                .update(allowedAccounts)
                .set({ commissionId: targetCommId, updatedAt: new Date() })
                .where(eq(allowedAccounts.email, incomingUser.email));
              await tx
                .update(publicCouncilors)
                .set({
                  commissionId: targetCommId,
                  commissionName: commRow.name,
                  updatedAt: new Date(),
                })
                .where(eq(publicCouncilors.uid, incomingUser.uid));
            }
          }
        } else {
          const nextInRole = targetRole as RoleLabel;
          const nextInTier = roleLabelToAccessTier(nextInRole);

          await tx
            .update(users)
            .set({
              roleLabel: nextInRole,
              accessTier: nextInTier,
              cargoDeclarado: nextInRole,
              updatedAt: new Date(),
            })
            .where(eq(users.uid, incomingUser.uid));

          await tx
            .update(allowedAccounts)
            .set({
              roleLabel: nextInRole,
              accessTier: nextInTier,
              updatedAt: new Date(),
            })
            .where(eq(allowedAccounts.email, incomingUser.email));

          await tx
            .update(publicCouncilors)
            .set({
              roleLabel: nextInRole,
              cargoDeclarado: nextInRole,
              displayOrder: roleDefaultDisplayOrder(nextInRole),
              updatedAt: new Date(),
            })
            .where(eq(publicCouncilors.uid, incomingUser.uid));
        }

        // Activar el nuevo periodo como vigente
        await tx
          .update(roleTerms)
          .set({
            status: 'vigente',
            updatedAt: new Date(),
          })
          .where(eq(roleTerms.id, raw.id));

        await tx.insert(auditLogs).values({
          id: newId('audit'),
          actorUid: 'system',
          actorName: 'Sistema de Relevos CMJ',
          actorRoleLabel: 'Presidente',
          action: `Ejecutó relevo automático en ${targetRole}${targetCommId ? ` (${targetCommId})` : ''}`,
          module: 'Usuarios y Mesa',
          targetTitle: `${incomingName}${outgoingUids.length ? ` (relevo de ${outgoingTerms.map((o) => o.councilor_name).join(', ')})` : ''}`.slice(0, 180),
        });

        return {
          termId: raw.id,
          targetRole,
          targetCommId,
          incomingUid: incomingUser.uid,
          incomingName,
          outgoingUids,
          startDate: raw.start_date,
        };
      });

      if (result) {
        activatedCount += 1;
        const notifyUids = new Set<string>([
          result.incomingUid,
          ...result.outgoingUids,
          ...(await getLeaderUids(db)),
        ]);

        for (const targetUid of notifyUids) {
          const isIncoming = targetUid === result.incomingUid;
          const isOutgoing = result.outgoingUids.includes(targetUid);
          await createPortalNotification({
            userUid: targetUid,
            type: 'relevo_activado',
            title: isIncoming
              ? `¡Has asumido el cargo de ${result.targetRole}!`
              : isOutgoing
                ? `Cierre de periodo completado: ${result.targetRole}`
                : `Relevo activado: ${result.incomingName} asume ${result.targetRole}`,
            message: isIncoming
              ? `A partir de ${formatBogotaDateTime(result.startDate)} entraron en vigencia tus funciones y permisos de ${result.targetRole}.`
              : isOutgoing
                ? `Se completó tu entrega de cargo en ${result.targetRole} el ${formatBogotaDateTime(result.startDate)}. Gracias por tu gestión.`
                : `El relevo programado se aplicó automáticamente: ${result.incomingName} es ahora ${result.targetRole}.`,
            linkModule: 'usuarios',
            relatedId: result.termId,
          });
        }
      }
    }

    return activatedCount;
  });
}

let lastFastSyncMs = 0;

/**
 * Sincronización rápida segura para invocar en /api/auth/me, /api/auth/refresh y /api/private/state
 * sin penalizar lecturas repetidas en el mismo segundo, además del cron cada 60s.
 */
export async function syncElectionsAndTransitionsIfNeeded(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastFastSyncMs < 8000) return;
  lastFastSyncMs = now;
  try {
    await closeExpiredVotes();
    await processDueRoleTransitions();
    await syncOverdueHandoverAlerts();
  } catch (err) {
    console.error('Sync elections and transitions error:', err);
  }
}

export async function runRoleTransitionJobOnce(): Promise<{
  closedVotes: number;
  activatedTransitions: number;
}> {
  const closedVotes = await closeExpiredVotes();
  const activatedTransitions = await processDueRoleTransitions();
  await syncOverdueHandoverAlerts();
  return { closedVotes, activatedTransitions };
}

export function validateHandoverExitDate(
  rawExitDate: string,
  voteDateIso?: string
): { ok: true; exitDateIso: string } | { ok: false; error: string } {
  const parsed = new Date(rawExitDate);
  if (!rawExitDate || Number.isNaN(parsed.getTime())) {
    return { ok: false, error: 'Ingresa una fecha y hora de entrega válida.' };
  }

  const exitIso = parsed.toISOString();
  const exitMs = parsed.getTime();
  const startOfTodayMs = Date.parse(getStartOfTodayBogotaIso());

  if (exitMs < startOfTodayMs) {
    return {
      ok: false,
      error: 'La fecha de entrega no puede ser anterior al día de hoy (hora Colombia).',
    };
  }

  if (voteDateIso) {
    const voteMs = Date.parse(voteDateIso);
    // Tolerancia de 65s para entradas datetime-local con precisión de minutos en el instante de cierre
    if (!Number.isNaN(voteMs) && exitMs < voteMs - 65_000) {
      return {
        ok: false,
        error: 'La fecha de entrega no puede ser anterior a la fecha de la votación.',
      };
    }
  }

  return { ok: true, exitDateIso: exitIso };
}
