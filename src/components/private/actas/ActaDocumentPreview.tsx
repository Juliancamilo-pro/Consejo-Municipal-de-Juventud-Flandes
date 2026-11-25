import React from 'react';
import { QrCode, ShieldCheck } from 'lucide-react';
import type { CouncilVote, PortalActa, PublicCouncilor } from '../../../types/cmj';
import { BrandLogo } from '../../BrandLogo';
import { AvatarBadge } from '../../public/AvatarBadge';
import { ActaQrSvg } from './actasShared';

export function ActaDocumentPreview({
  acta,
  editConsecutive,
  editTitle,
  editMeetingDate,
  editTimeRange,
  editLocation,
  editQuorumCount,
  editQuorumRequired,
  editAgenda,
  editDevelopment,
  editPropositions,
  editCommitmentsSummary,
  editLinkedVoteIds,
  attendanceList,
  votes,
}: {
  acta: PortalActa;
  editConsecutive: string;
  editTitle: string;
  editMeetingDate: string;
  editTimeRange: string;
  editLocation: string;
  editQuorumCount: number;
  editQuorumRequired: number;
  editAgenda: string;
  editDevelopment: string;
  editPropositions: string;
  editCommitmentsSummary: string;
  editLinkedVoteIds: string[];
  attendanceList: { councilor: PublicCouncilor; status: string }[];
  votes: CouncilVote[];
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white text-slate-900 p-6 sm:p-10 space-y-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-emerald-700 pb-4">
        <div className="flex items-center gap-3">
          <BrandLogo size="md" />
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
              Consejo Municipal de Juventudes de Flandes, Tolima
            </p>
            <p className="text-[11px] text-slate-600">
              Ley Estatutaria 1622 de 2013 y Ley 1885 de 2018 · Documento Institucional
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono-num text-sm font-extrabold text-slate-900">{editConsecutive}</p>
          <p className="text-[11px] uppercase font-bold text-emerald-700">
            Estado: {acta.status}
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <h3 className="text-lg font-extrabold text-slate-900">{editTitle}</h3>
        <p className="text-xs text-slate-600">
          Fecha: <strong>{editMeetingDate || 'Por definir'}</strong>{' '}
          {editTimeRange ? `(${editTimeRange})` : ''} · Lugar: <strong>{editLocation}</strong> ·
          Quórum: <strong>{editQuorumCount}/{editQuorumRequired}</strong>
        </p>
      </div>

      {attendanceList.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
            Verificación de Asistencia
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {attendanceList.map(({ councilor, status }) => (
              <div
                key={councilor.uid}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <AvatarBadge
                    name={councilor.fullName}
                    photoUrl={councilor.photoUrl}
                    thumbUrl={councilor.photoThumbUrl}
                    size="xs"
                  />
                  <div className="min-w-0">
                    <p className="font-bold truncate">{councilor.fullName}</p>
                    <p className="text-[10px] text-slate-500">{councilor.roleLabel}</p>
                  </div>
                </div>
                <span className="font-semibold uppercase text-[10px] text-slate-700">
                  {status.replace('_', ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4 text-xs leading-relaxed">
        <div>
          <h4 className="font-extrabold uppercase tracking-wider text-emerald-800 mb-1">
            1. Orden del Día
          </h4>
          <p className="whitespace-pre-wrap text-slate-800">{editAgenda || 'Sin registrar.'}</p>
        </div>
        <div>
          <h4 className="font-extrabold uppercase tracking-wider text-emerald-800 mb-1">
            2. Desarrollo
          </h4>
          <p className="whitespace-pre-wrap text-slate-800">
            {editDevelopment || 'Sin registrar.'}
          </p>
        </div>
        <div>
          <h4 className="font-extrabold uppercase tracking-wider text-emerald-800 mb-1">
            3. Proposiciones y Decisiones
          </h4>
          <p className="whitespace-pre-wrap text-slate-800">
            {editPropositions || 'Sin registrar.'}
          </p>
        </div>
        <div>
          <h4 className="font-extrabold uppercase tracking-wider text-emerald-800 mb-1">
            4. Compromisos
          </h4>
          <p className="whitespace-pre-wrap text-slate-800">
            {editCommitmentsSummary || 'Sin registrar.'}
          </p>
        </div>
      </div>

      {editLinkedVoteIds.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">
            Resultados de Votaciones Vinculadas
          </h4>
          <div className="space-y-1.5">
            {votes
              .filter((v) => editLinkedVoteIds.includes(v.id))
              .map((v) => (
                <div
                  key={v.id}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs flex items-center justify-between gap-2"
                >
                  <span className="font-bold">{v.title}</span>
                  <span className="text-slate-600">{v.resultSummary || 'En curso'}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-2 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" /> Firmas Digitales y Verificación
          </p>
          {acta.signatures.length === 0 ? (
            <p className="text-xs text-slate-500">
              Pendiente de firma digital por Presidencia / Secretaría.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {acta.signatures.map((sig) => (
                <div
                  key={sig.uid}
                  className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-2 text-[11px]"
                >
                  <p className="font-bold text-slate-900">{sig.name}</p>
                  <p className="text-emerald-800 font-semibold">{sig.roleLabel}</p>
                  <p className="font-mono-num text-[10px] text-slate-600 mt-0.5">
                    Sello: {sig.hash} · {new Date(sig.signedAt).toLocaleDateString('es-CO')}
                  </p>
                </div>
              ))}
            </div>
          )}
          {acta.verificationHash && (
            <p className="font-mono-num text-[10px] text-slate-600">
              Hash de integridad documental: <strong>{acta.verificationHash}</strong>
            </p>
          )}
        </div>

        {acta.verificationHash && (
          <div className="flex flex-col items-center gap-1 shrink-0">
            <ActaQrSvg code={`${acta.consecutive}:${acta.verificationHash}`} />
            <span className="text-[9px] font-mono-num text-slate-500 flex items-center gap-1">
              <QrCode className="h-3 w-3" /> {acta.verificationHash.slice(0, 10)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
