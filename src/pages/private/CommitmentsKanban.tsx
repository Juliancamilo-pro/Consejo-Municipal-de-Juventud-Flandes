import { DragEvent, useState } from 'react';
import { AlertTriangle, MessageSquare } from 'lucide-react';
import { updateCommitmentProgress } from '../../services/electionsCommitmentsMailboxService';
import { CommitmentItem, UserProfile } from '../../types/models';
import { Badge, BadgeTone } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';

interface CommitmentsKanbanProps {
  actor: UserProfile;
  isLeaderOrBoard: boolean;
  commitments: CommitmentItem[];
  onOpenDetails?: (item: CommitmentItem) => void;
  onReload: () => Promise<void>;
}

const COLUMNS: {
  status: CommitmentItem['status'];
  label: string;
  tone: BadgeTone;
}[] = [
  { status: 'pendiente', label: 'Pendiente', tone: 'warning' },
  { status: 'en_progreso', label: 'En progreso', tone: 'info' },
  { status: 'cumplido', label: 'Cumplido', tone: 'success' },
  { status: 'vencido', label: 'Vencido', tone: 'danger' },
];

export function CommitmentsKanban({
  actor,
  isLeaderOrBoard,
  commitments,
  onOpenDetails,
  onReload,
}: CommitmentsKanbanProps) {
  const [movingId, setMovingId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTargetCol, setDropTargetCol] = useState<CommitmentItem['status'] | null>(null);
  const todayIso = new Date().toISOString().slice(0, 10);

  const handleMove = async (item: CommitmentItem, nextStatus: CommitmentItem['status']) => {
    if (item.status === nextStatus) return;
    setMovingId(item.id);
    const nextProgress =
      nextStatus === 'cumplido'
        ? 100
        : nextStatus === 'en_progreso'
          ? Math.max(50, item.progressPercent)
          : item.progressPercent;
    try {
      await updateCommitmentProgress(item.id, nextProgress, nextStatus);
      await onReload();
    } finally {
      setMovingId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => {
        const items = commitments.filter((c) => c.status === col.status);
        const isOver = dropTargetCol === col.status;
        return (
          <div
            key={col.status}
            onDragOver={(e) => {
              e.preventDefault();
              setDropTargetCol(col.status);
            }}
            onDragLeave={() => setDropTargetCol(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDropTargetCol(null);
              const id = e.dataTransfer.getData('text/plain') || draggedId;
              const found = commitments.find((c) => c.id === id);
              if (found && (isLeaderOrBoard || found.assigneeUid === actor.uid)) {
                void handleMove(found, col.status);
              }
              setDraggedId(null);
            }}
            className={`flex flex-col rounded-xl border p-3.5 transition-colors ${
              isOver
                ? 'border-[#7B1832] bg-[#7B1832]/5 dark:border-[#D9B245] dark:bg-[#D9B245]/10'
                : 'border-stone-200 bg-[#FAF8F4] dark:border-slate-800 dark:bg-slate-950/60'
            }`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <Badge tone={col.tone}>{col.label}</Badge>
              <span className="font-mono-tabular text-xs font-semibold text-stone-500 dark:text-slate-400">
                {items.length}
              </span>
            </div>

            {items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-stone-300 px-3 py-6 text-center text-xs text-stone-500 dark:border-slate-700 dark:text-slate-400">
                Arrastra aquí o sin compromisos
              </p>
            ) : (
              <div className="space-y-2.5">
                {items.map((item) => {
                  const canEdit = isLeaderOrBoard || item.assigneeUid === actor.uid;
                  const isOverdue = item.status !== 'cumplido' && Boolean(item.dueDate && item.dueDate < todayIso);
                  return (
                    <div
                      key={item.id}
                      draggable={canEdit}
                      onDragStart={(e: DragEvent<HTMLDivElement>) => {
                        setDraggedId(item.id);
                        e.dataTransfer.setData('text/plain', item.id);
                      }}
                    >
                      <Card
                        padding="sm"
                        className={`space-y-2 ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          {onOpenDetails ? (
                            <button
                              type="button"
                              onClick={() => onOpenDetails(item)}
                              className="text-left font-display text-sm font-semibold text-stone-950 hover:text-[#7B1832] dark:text-white dark:hover:text-[#D9B245]"
                            >
                              {item.title}
                            </button>
                          ) : (
                            <p className="font-display text-sm font-semibold text-stone-950 dark:text-white">
                              {item.title}
                            </p>
                          )}
                        {isOverdue && (
                          <span title="Plazo vencido" className="shrink-0 text-red-600 dark:text-red-400">
                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-stone-600 dark:text-slate-300">{item.assigneeName}</p>
                      <div className="flex items-center justify-between text-[11px] text-stone-500 dark:text-slate-400">
                        <span className={`font-mono-tabular ${isOverdue ? 'font-semibold text-red-700 dark:text-red-400' : ''}`}>
                          {item.dueDate}
                        </span>
                        <div className="flex items-center gap-2">
                          {(item.comments?.length || 0) > 0 && (
                            <span className="inline-flex items-center gap-0.5">
                              <MessageSquare className="h-3 w-3" aria-hidden="true" />
                              {item.comments?.length}
                            </span>
                          )}
                          <span className="font-mono-tabular font-semibold">{item.progressPercent}%</span>
                        </div>
                      </div>
                      {canEdit && (
                        <select
                          aria-label={`Cambiar estado de ${item.title}`}
                          disabled={movingId === item.id}
                          value={item.status}
                          onChange={(e) => void handleMove(item, e.target.value as CommitmentItem['status'])}
                          className="w-full rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                        >
                          {COLUMNS.map((opt) => (
                            <option key={opt.status} value={opt.status}>
                              Mover a: {opt.label}
                            </option>
                          ))}
                        </select>
                      )}
                      </Card>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
