import React, { useMemo, useRef, useState } from 'react';
import {
  Check,
  Download,
  FileSpreadsheet,
  Printer,
  Save,
  Upload,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { hashEmail, isLeadershipTier, roleLabelToAccessTier } from '../../lib/security';
import type {
  AccessTier,
  Commission,
  CommissionTask,
  Commitment,
  CouncilSession,
  CouncilVote,
  CouncilorPrivate,
  PublicCouncilor,
  RoleLabel,
} from '../../types/cmj';
import { useToast } from '../ToastProvider';
import { recordAudit } from './auditHelper';

type SheetTab = 'asistencia' | 'votaciones' | 'compromisos' | 'directorio';

interface ImportedRowPreview {
  fullName: string;
  email: string;
  roleLabel: RoleLabel;
  commissionId: string;
  phone: string;
  valid: boolean;
  reason?: string;
}

export function SpreadsheetsModule({
  uid,
  actorName,
  actorRoleLabel,
  accessTier,
  commissions,
  commissionTasks,
  publicCouncilors,
  privateCouncilors,
  sessions,
  votes,
  commitments,
}: {
  uid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  accessTier: AccessTier;
  commissions: Commission[];
  commissionTasks: CommissionTask[];
  publicCouncilors: PublicCouncilor[];
  privateCouncilors: CouncilorPrivate[];
  sessions: CouncilSession[];
  votes: CouncilVote[];
  commitments: Commitment[];
}) {
  const { showToast } = useToast();
  const isLeader = isLeadershipTier(accessTier);
  const [tab, setTab] = useState<SheetTab>('asistencia');
  const [commFilter, setCommFilter] = useState('todas');

  // Edición inline del directorio tipo hoja de cálculo
  const [draftEdits, setDraftEdits] = useState<
    Record<string, { fullName: string; roleLabel: RoleLabel; commissionId: string; phone: string }>
  >({});
  const [savingRowId, setSavingRowId] = useState<string | null>(null);

  // Importación desde Excel / CSV
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [importPreview, setImportPreview] = useState<ImportedRowPreview[]>([]);
  const [importing, setImporting] = useState(false);

  const activeCouncilors = useMemo(
    () =>
      publicCouncilors
        .filter((c) => c.active)
        .filter((c) => commFilter === 'todas' || c.commissionId === commFilter)
        .sort((a, b) => (a.displayOrder ?? 50) - (b.displayOrder ?? 50)),
    [publicCouncilors, commFilter]
  );

  // Matriz de asistencia
  const attendanceMatrix = useMemo(() => {
    return activeCouncilors.map((c) => {
      const cells = sessions.map((s) => s.attendance?.[c.uid] || '—');
      const recorded = sessions.filter((s) => s.attendance && c.uid in s.attendance);
      const presentCount = recorded.filter(
        (s) => s.attendance?.[c.uid] === 'presente' || s.attendance?.[c.uid] === 'tarde'
      ).length;
      const pct = recorded.length ? Math.round((presentCount / recorded.length) * 100) : 0;
      return { councilor: c, cells, pct, recordedCount: recorded.length, presentCount };
    });
  }, [activeCouncilors, sessions]);

  const buildRowsForExport = (): Record<string, string | number>[] => {
    if (tab === 'asistencia') {
      return attendanceMatrix.map((row) => {
        const obj: Record<string, string | number> = {
          Consejero: row.councilor.fullName,
          Cargo: row.councilor.roleLabel,
          Comision: row.councilor.commissionName,
        };
        sessions.forEach((s, i) => {
          obj[`${s.dateIso} ${s.title.slice(0, 18)}`] = row.cells[i];
        });
        obj['Asistencia (%)'] = `${row.pct}%`;
        return obj;
      });
    }
    if (tab === 'votaciones') {
      return votes.map((v) => {
        const obj: Record<string, string | number> = {
          Votacion: v.title,
          Modalidad: v.voteMode || 'nominal',
          Estado: v.status,
          Participantes: v.voterUids.length,
        };
        v.options.forEach((o) => {
          obj[o] = v.tallies?.[o] || 0;
        });
        return obj;
      });
    }
    if (tab === 'compromisos') {
      const list = [
        ...commitments.map((c) => ({
          Origen: 'Compromiso Plenaria',
          Titulo: c.title,
          Responsable: c.responsibleName,
          Comision: commissions.find((cm) => cm.id === c.commissionId)?.name || c.commissionId,
          Limite: c.dueDate || 'Sin fecha',
          Estado: c.status,
          Avance: `${c.progress}%`,
        })),
        ...commissionTasks.map((t) => ({
          Origen: 'Tarea de Comisión',
          Titulo: t.title,
          Responsable: t.assignedName || 'Sin asignar',
          Comision: commissions.find((cm) => cm.id === t.commissionId)?.name || t.commissionId,
          Limite: t.dueDate || 'Sin fecha',
          Estado: t.status,
          Avance: t.status === 'hecha' ? '100%' : t.status === 'en_curso' ? '50%' : '0%',
        })),
      ];
      return list;
    }
    return activeCouncilors.map((c) => {
      const priv = privateCouncilors.find((p) => p.uid === c.uid);
      return {
        Nombre: c.fullName,
        Correo: priv?.email || '',
        Telefono: priv?.phone || '',
        Cargo: c.roleLabel,
        Comision: c.commissionName,
      };
    });
  };

  const handleExport = (format: 'xlsx' | 'csv') => {
    const rows = buildRowsForExport();
    if (!rows.length) {
      showToast('No hay filas para exportar en esta planilla', 'info');
      return;
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tab.toUpperCase());
    const dateTag = new Date().toISOString().slice(0, 10);
    if (format === 'csv') {
      XLSX.writeFile(wb, `CMJ_Flandes_${tab}_${dateTag}.csv`, { bookType: 'csv' });
    } else {
      XLSX.writeFile(wb, `CMJ_Flandes_${tab}_${dateTag}.xlsx`);
    }
    showToast(`Planilla exportada en formato ${format.toUpperCase()}`, 'success');
  };

  const getDraft = (c: PublicCouncilor) => {
    if (draftEdits[c.id]) return draftEdits[c.id];
    const priv = privateCouncilors.find((p) => p.uid === c.uid);
    return {
      fullName: c.fullName,
      roleLabel: c.roleLabel,
      commissionId: c.commissionId,
      phone: priv?.phone || '',
    };
  };

  const handleSaveInlineRow = async (c: PublicCouncilor) => {
    const draft = getDraft(c);
    setSavingRowId(c.id);
    try {
      const commName =
        commissions.find((cm) => cm.id === draft.commissionId)?.name || draft.commissionId;
      await updateDoc(doc(db, 'public_councilors', c.id), {
        fullName: draft.fullName.trim() || c.fullName,
        roleLabel: draft.roleLabel,
        commissionId: draft.commissionId,
        commissionName: commName,
        updatedAt: serverTimestamp(),
      });

      const priv = privateCouncilors.find((p) => p.uid === c.uid);
      if (priv && !c.uid.startsWith('pending_')) {
        const tier = roleLabelToAccessTier(draft.roleLabel);
        await updateDoc(doc(db, 'roles', c.uid), {
          accessTier: tier,
          roleLabel: draft.roleLabel,
          updatedAt: serverTimestamp(),
        }).catch(() => {});
        await updateDoc(doc(db, 'councilor_private', c.uid), {
          accessTier: tier,
          roleLabel: draft.roleLabel,
          commissionId: draft.commissionId,
          phone: draft.phone.trim(),
          updatedAt: serverTimestamp(),
        }).catch(() => {});
        if (priv.email) {
          const eh = await hashEmail(priv.email);
          await updateDoc(doc(db, 'allowed_accounts', eh), {
            accessTier: tier,
            roleLabel: draft.roleLabel,
            commissionId: draft.commissionId,
            updatedAt: serverTimestamp(),
          }).catch(() => {});
        }
      }

      setDraftEdits((prev) => {
        const next = { ...prev };
        delete next[c.id];
        return next;
      });
      showToast('Fila guardada', 'success');
    } catch {
      showToast('No se pudo guardar la fila', 'error');
    } finally {
      setSavingRowId(null);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

      const parsed: ImportedRowPreview[] = rawRows.slice(0, 60).map((r) => {
        const name = String(r.Nombre || r.nombre || r.FullName || '').trim();
        const email = String(r.Correo || r.correo || r.Email || r.email || '')
          .trim()
          .toLowerCase();
        const rawRole = String(r.Cargo || r.cargo || 'Consejero').trim();
        const role: RoleLabel =
          rawRole === 'Presidente' ||
          rawRole === 'Vicepresidente' ||
          rawRole === 'Secretario'
            ? rawRole
            : 'Consejero';
        const rawComm = String(r.Comision || r.comision || 'comision-1').trim().toLowerCase();
        const matchedComm =
          commissions.find(
            (c) => c.id === rawComm || c.name.toLowerCase().includes(rawComm) || rawComm.includes(String(c.number))
          )?.id || 'comision-1';
        const phone = String(r.Telefono || r.telefono || r.Celular || '').trim();

        const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        const valid = Boolean(name.length >= 2 && validEmail);
        return {
          fullName: name || 'Sin nombre',
          email,
          roleLabel: role,
          commissionId: matchedComm,
          phone,
          valid,
          reason: !name ? 'Falta nombre' : !validEmail ? 'Correo inválido' : undefined,
        };
      });

      setImportPreview(parsed);
      showToast(`${parsed.length} fila(s) leídas para revisión`, 'info');
    } catch {
      showToast('No se pudo leer el archivo Excel/CSV', 'error');
    }
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    const valids = importPreview.filter((r) => r.valid);
    if (!valids.length) return;
    setImporting(true);
    try {
      let importedCount = 0;
      for (const row of valids) {
        const eh = await hashEmail(row.email);
        const tier = roleLabelToAccessTier(row.roleLabel);
        const commName =
          commissions.find((c) => c.id === row.commissionId)?.name || row.commissionId;
        const pendingId = `pending_${eh.slice(0, 16)}`;

        await setDoc(doc(db, 'allowed_accounts', eh), {
          active: true,
          accessTier: tier,
          roleLabel: row.roleLabel,
          commissionId: row.commissionId,
          accountProvisioned: false,
          mustChangePassword: true,
          updatedAt: serverTimestamp(),
        });

        await setDoc(doc(db, 'public_councilors', pendingId), {
          uid: pendingId,
          fullName: row.fullName,
          roleLabel: row.roleLabel,
          commissionId: row.commissionId,
          commissionName: commName,
          bio: '',
          photoUrl: '',
          active: true,
          displayOrder: publicCouncilors.length + importedCount + 1,
          updatedAt: serverTimestamp(),
        });
        importedCount++;
      }

      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: 'Importó consejeros desde planilla Excel/CSV',
        module: 'Planillas',
        targetTitle: `${importedCount} registros habilitados`,
      });
      setImportPreview([]);
      showToast(`${importedCount} consejero(s) habilitados correctamente`, 'success');
    } catch {
      showToast('Error al importar consejeros', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera e Impresión Institucional */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              Planillas, Matrices y Reportes CMJ
            </h2>
            <p className="text-xs text-slate-500">
              Visualiza consolidados tipo hoja de cálculo, edita el directorio en línea y exporta a Excel, CSV o PDF.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 no-print">
            <button
              type="button"
              onClick={() => handleExport('xlsx')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => handleExport('csv')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-3.5 py-2 text-xs font-semibold cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" /> Imprimir / PDF
            </button>
            {isLeader && (
              <>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleImportFile}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700 cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" /> Importar Excel/CSV
                </button>
              </>
            )}
          </div>
        </div>

        {/* Subpestañas + filtro */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800 no-print">
          <div className="inline-flex flex-wrap rounded-xl bg-slate-100 dark:bg-slate-800 p-1 gap-1">
            {(
              [
                { id: 'asistencia', label: 'Asistencia' },
                { id: 'votaciones', label: 'Votaciones' },
                { id: 'compromisos', label: 'Compromisos y Tareas' },
                { id: 'directorio', label: 'Directorio Editable' },
              ] as { id: SheetTab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer ${
                  tab === t.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <select
            value={commFilter}
            onChange={(e) => setCommFilter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
          >
            <option value="todas">Todas las comisiones</option>
            {commissions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Vista previa importación Excel */}
        {importPreview.length > 0 && (
          <div className="rounded-2xl border border-blue-200 dark:border-cyan-900/60 bg-blue-50/40 dark:bg-slate-950 p-4 space-y-3 no-print">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Vista previa de importación ({importPreview.filter((r) => r.valid).length} válidas de{' '}
                  {importPreview.length})
                </h3>
                <p className="text-[11px] text-slate-500">
                  Columnas soportadas: Nombre, Correo, Cargo, Comision, Telefono.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setImportPreview([])}
                  className="rounded-xl bg-slate-200 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold cursor-pointer"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  disabled={importing}
                  onClick={handleConfirmImport}
                  className="inline-flex items-center gap-1 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-60"
                >
                  <Check className="h-3.5 w-3.5" /> {importing ? 'Importando...' : 'Confirmar importación'}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-56">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="p-2">Nombre</th>
                    <th className="p-2">Correo</th>
                    <th className="p-2">Cargo</th>
                    <th className="p-2">Comisión</th>
                    <th className="p-2">Validación</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 dark:border-slate-800/70">
                      <td className="p-2">{r.fullName}</td>
                      <td className="p-2">{r.email || '—'}</td>
                      <td className="p-2">{r.roleLabel}</td>
                      <td className="p-2">{r.commissionId}</td>
                      <td className="p-2">
                        {r.valid ? (
                          <span className="text-emerald-600 font-semibold">Lista</span>
                        ) : (
                          <span className="text-rose-600 font-semibold">{r.reason}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Encabezado visible solo en impresión PDF */}
        <div className="hidden print:block border-b border-slate-400 pb-3 mb-4">
          <p className="text-xs font-bold uppercase">
            Consejo Municipal de Juventudes de Flandes · Tolima
          </p>
          <h3 className="text-lg font-extrabold capitalize">Planilla Institucional: {tab}</h3>
          <p className="text-xs text-slate-600">
            Generado el {new Date().toLocaleDateString('es-CO')}
          </p>
        </div>

        {/* Tabla 1: Matriz Asistencia */}
        {tab === 'asistencia' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-slate-200 dark:border-slate-800">
              <thead className="bg-slate-100 dark:bg-slate-800/80">
                <tr>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-700">Consejero</th>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-700">Cargo</th>
                  {sessions.map((s) => (
                    <th
                      key={s.id}
                      className="p-2.5 border border-slate-200 dark:border-slate-700 whitespace-nowrap"
                    >
                      <div className="font-mono-num text-[10px] text-slate-500">{s.dateIso}</div>
                      <div className="truncate max-w-[120px]">{s.title}</div>
                    </th>
                  ))}
                  <th className="p-2.5 border border-slate-200 dark:border-slate-700 text-right">
                    Consolidado %
                  </th>
                </tr>
              </thead>
              <tbody>
                {attendanceMatrix.map((row) => (
                  <tr key={row.councilor.uid} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="p-2.5 border border-slate-200 dark:border-slate-800 font-semibold">
                      {row.councilor.fullName}
                    </td>
                    <td className="p-2.5 border border-slate-200 dark:border-slate-800">
                      {row.councilor.roleLabel}
                    </td>
                    {row.cells.map((st, idx) => (
                      <td
                        key={idx}
                        className="p-2.5 border border-slate-200 dark:border-slate-800 capitalize text-center"
                      >
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                            st === 'presente'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                              : st === 'tarde'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                              : st === 'excusa'
                              ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                              : st === 'ausente'
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                              : 'text-slate-400'
                          }`}
                        >
                          {st}
                        </span>
                      </td>
                    ))}
                    <td className="p-2.5 border border-slate-200 dark:border-slate-800 text-right font-mono-num font-bold">
                      <span
                        className={
                          row.pct >= 80
                            ? 'text-emerald-600'
                            : row.pct >= 50
                            ? 'text-amber-600'
                            : 'text-rose-600'
                        }
                      >
                        {row.pct}%
                      </span>
                    </td>
                  </tr>
                ))}
                {attendanceMatrix.length === 0 && (
                  <tr>
                    <td colSpan={sessions.length + 3} className="p-6 text-center text-slate-500">
                      Sin consejeros activos para mostrar en la matriz.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tabla 2: Votaciones */}
        {tab === 'votaciones' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-slate-200 dark:border-slate-800">
              <thead className="bg-slate-100 dark:bg-slate-800/80">
                <tr>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-700">Votación</th>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-700">Modo</th>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-700">Estado</th>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-700">Votos</th>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-700">Resultados</th>
                </tr>
              </thead>
              <tbody>
                {votes.map((v) => (
                  <tr key={v.id}>
                    <td className="p-2.5 border border-slate-200 dark:border-slate-800 font-semibold">
                      {v.title}
                    </td>
                    <td className="p-2.5 border border-slate-200 dark:border-slate-800 capitalize">
                      {v.voteMode || 'nominal'}
                    </td>
                    <td className="p-2.5 border border-slate-200 dark:border-slate-800 capitalize">
                      {v.status}
                    </td>
                    <td className="p-2.5 border border-slate-200 dark:border-slate-800 font-mono-num">
                      {v.voterUids.length}
                    </td>
                    <td className="p-2.5 border border-slate-200 dark:border-slate-800">
                      {v.options.map((o) => `${o}: ${v.tallies?.[o] || 0}`).join(' · ')}
                    </td>
                  </tr>
                ))}
                {votes.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-slate-500">
                      No hay votaciones registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tabla 3: Compromisos y Tareas */}
        {tab === 'compromisos' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-slate-200 dark:border-slate-800">
              <thead className="bg-slate-100 dark:bg-slate-800/80">
                <tr>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-700">Origen</th>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-700">Actividad</th>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-700">Responsable</th>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-700">Comisión</th>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-700">Estado</th>
                  <th className="p-2.5 border border-slate-200 dark:border-slate-700 text-right">
                    Avance
                  </th>
                </tr>
              </thead>
              <tbody>
                {commitments
                  .filter((c) => commFilter === 'todas' || c.commissionId === commFilter)
                  .map((c) => (
                    <tr key={`c-${c.id}`}>
                      <td className="p-2.5 border border-slate-200 dark:border-slate-800">Plenaria</td>
                      <td className="p-2.5 border border-slate-200 dark:border-slate-800 font-semibold">
                        {c.title}
                      </td>
                      <td className="p-2.5 border border-slate-200 dark:border-slate-800">
                        {c.responsibleName}
                      </td>
                      <td className="p-2.5 border border-slate-200 dark:border-slate-800">
                        {commissions.find((cm) => cm.id === c.commissionId)?.name || c.commissionId}
                      </td>
                      <td className="p-2.5 border border-slate-200 dark:border-slate-800 capitalize">
                        {c.status.replace('_', ' ')}
                      </td>
                      <td className="p-2.5 border border-slate-200 dark:border-slate-800 text-right font-mono-num font-bold">
                        {c.progress}%
                      </td>
                    </tr>
                  ))}
                {commissionTasks
                  .filter((t) => commFilter === 'todas' || t.commissionId === commFilter)
                  .map((t) => (
                    <tr key={`t-${t.id}`}>
                      <td className="p-2.5 border border-slate-200 dark:border-slate-800">Comisión</td>
                      <td className="p-2.5 border border-slate-200 dark:border-slate-800 font-semibold">
                        {t.title}
                      </td>
                      <td className="p-2.5 border border-slate-200 dark:border-slate-800">
                        {t.assignedName || 'Sin asignar'}
                      </td>
                      <td className="p-2.5 border border-slate-200 dark:border-slate-800">
                        {commissions.find((cm) => cm.id === t.commissionId)?.name || t.commissionId}
                      </td>
                      <td className="p-2.5 border border-slate-200 dark:border-slate-800 capitalize">
                        {t.status.replace('_', ' ')}
                      </td>
                      <td className="p-2.5 border border-slate-200 dark:border-slate-800 text-right font-mono-num font-bold">
                        {t.status === 'hecha' ? '100%' : t.status === 'en_curso' ? '50%' : '0%'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tabla 4: Directorio Editable tipo Excel */}
        {tab === 'directorio' && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border border-slate-200 dark:border-slate-800">
              <thead className="bg-slate-100 dark:bg-slate-800/80">
                <tr>
                  <th className="p-2 border border-slate-200 dark:border-slate-700">Nombre</th>
                  <th className="p-2 border border-slate-200 dark:border-slate-700">Correo</th>
                  <th className="p-2 border border-slate-200 dark:border-slate-700">Teléfono</th>
                  <th className="p-2 border border-slate-200 dark:border-slate-700">Cargo</th>
                  <th className="p-2 border border-slate-200 dark:border-slate-700">Comisión</th>
                  {isLeader && (
                    <th className="p-2 border border-slate-200 dark:border-slate-700 text-right no-print">
                      Guardar
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {activeCouncilors.map((c) => {
                  const priv = privateCouncilors.find((p) => p.uid === c.uid);
                  const draft = getDraft(c);
                  const dirty = Boolean(draftEdits[c.id]);
                  return (
                    <tr key={c.id}>
                      <td className="p-1.5 border border-slate-200 dark:border-slate-800">
                        <input
                          type="text"
                          disabled={!isLeader}
                          value={draft.fullName}
                          onChange={(e) =>
                            setDraftEdits((prev) => ({
                              ...prev,
                              [c.id]: { ...draft, fullName: e.target.value },
                            }))
                          }
                          className="w-full rounded px-2 py-1 bg-transparent border border-transparent focus:border-blue-500"
                        />
                      </td>
                      <td className="p-2 border border-slate-200 dark:border-slate-800 text-slate-500">
                        {priv?.email || 'Pendiente'}
                      </td>
                      <td className="p-1.5 border border-slate-200 dark:border-slate-800">
                        <input
                          type="text"
                          disabled={!isLeader}
                          value={draft.phone}
                          onChange={(e) =>
                            setDraftEdits((prev) => ({
                              ...prev,
                              [c.id]: { ...draft, phone: e.target.value },
                            }))
                          }
                          className="w-full rounded px-2 py-1 bg-transparent border border-transparent focus:border-blue-500"
                        />
                      </td>
                      <td className="p-1.5 border border-slate-200 dark:border-slate-800">
                        <select
                          disabled={!isLeader}
                          value={draft.roleLabel}
                          onChange={(e) =>
                            setDraftEdits((prev) => ({
                              ...prev,
                              [c.id]: { ...draft, roleLabel: e.target.value as RoleLabel },
                            }))
                          }
                          className="rounded px-2 py-1 bg-transparent"
                        >
                          <option value="Consejero">Consejero</option>
                          <option value="Presidente">Presidente</option>
                          <option value="Vicepresidente">Vicepresidente</option>
                          <option value="Secretario">Secretario</option>
                        </select>
                      </td>
                      <td className="p-1.5 border border-slate-200 dark:border-slate-800">
                        <select
                          disabled={!isLeader}
                          value={draft.commissionId}
                          onChange={(e) =>
                            setDraftEdits((prev) => ({
                              ...prev,
                              [c.id]: { ...draft, commissionId: e.target.value },
                            }))
                          }
                          className="rounded px-2 py-1 bg-transparent max-w-[180px]"
                        >
                          {commissions.map((cm) => (
                            <option key={cm.id} value={cm.id}>
                              {cm.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      {isLeader && (
                        <td className="p-1.5 border border-slate-200 dark:border-slate-800 text-right no-print">
                          <button
                            type="button"
                            disabled={!dirty || savingRowId === c.id}
                            onClick={() => handleSaveInlineRow(c)}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-semibold cursor-pointer ${
                              dirty
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                            }`}
                          >
                            <Save className="h-3 w-3" /> Guardar
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
