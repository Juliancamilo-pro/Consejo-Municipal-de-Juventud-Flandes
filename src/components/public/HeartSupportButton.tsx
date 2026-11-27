import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Heart } from 'lucide-react';
import { ApiRequestError, apiRequest } from '../../lib/apiClient';
import type { HeartToggleResponse } from '../../types/cmj';
import { useToast } from '../ToastProvider';

const HEART_PARTICLES = [
  { id: 1, x: -16, y: -22, delay: 0 },
  { id: 2, x: 14, y: -24, delay: 0.05 },
  { id: 3, x: -6, y: -30, delay: 0.09 },
  { id: 4, x: 20, y: -14, delay: 0.12 },
];

export function HeartSupportButton({
  councilorUid,
  councilorName,
  count,
  hearted,
  isSelf = false,
  variant = 'compact',
  onToggleResult,
}: {
  councilorUid: string;
  councilorName: string;
  count: number;
  hearted: boolean;
  isSelf?: boolean;
  variant?: 'compact' | 'full';
  onToggleResult?: (res: HeartToggleResponse) => void;
}) {
  const { showToast } = useToast();
  const prefersReducedMotion = useReducedMotion();
  const [optimisticHearted, setOptimisticHearted] = useState(hearted);
  const [optimisticCount, setOptimisticCount] = useState(count);
  const [submitting, setSubmitting] = useState(false);
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    if (!submitting) {
      setOptimisticHearted(hearted);
      setOptimisticCount(count);
    }
  }, [hearted, count, submitting]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (submitting) return;
    if (isSelf) {
      showToast('No puedes enviarte un corazón de apoyo a ti mismo.', 'info');
      return;
    }

    const prevHearted = optimisticHearted;
    const prevCount = optimisticCount;
    const nextHearted = !prevHearted;
    const nextCount = Math.max(0, prevCount + (nextHearted ? 1 : -1));

    setOptimisticHearted(nextHearted);
    setOptimisticCount(nextCount);
    if (nextHearted && !prefersReducedMotion) {
      setBurstKey((k) => k + 1);
    }
    setSubmitting(true);

    try {
      const res = await apiRequest<HeartToggleResponse>(
        `/api/public/councilors/${encodeURIComponent(councilorUid)}/heart`,
        {
          method: 'POST',
          skipRefresh: true,
        }
      );
      setOptimisticHearted(res.hearted);
      setOptimisticCount(res.count);
      onToggleResult?.(res);
    } catch (err) {
      setOptimisticHearted(prevHearted);
      setOptimisticCount(prevCount);
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : 'No se pudo registrar tu apoyo ciudadano.';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (variant === 'full') {
    return (
      <div className="relative inline-flex items-center">
        <button
          type="button"
          onClick={handleToggle}
          disabled={submitting || isSelf}
          aria-pressed={optimisticHearted}
          aria-label={
            isSelf
              ? `Apoyo ciudadano recibido: ${optimisticCount}`
              : optimisticHearted
                ? `Quitar corazón de apoyo a ${councilorName}. Total actual: ${optimisticCount}`
                : `Enviar corazón de apoyo a ${councilorName}. Total actual: ${optimisticCount}`
          }
          title={isSelf ? 'Tu perfil público' : optimisticHearted ? 'Quitar tu corazón' : 'Apoyar gestión'}
          className={`relative inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all cursor-pointer disabled:opacity-65 disabled:cursor-not-allowed ${
            optimisticHearted
              ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700/80 shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:border-rose-300 dark:hover:border-rose-700 hover:text-rose-600 dark:hover:text-rose-300'
          }`}
        >
          <motion.span
            animate={
              optimisticHearted && !prefersReducedMotion
                ? { scale: [1, 1.28, 0.95, 1.08, 1] }
                : { scale: 1 }
            }
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="inline-flex items-center justify-center"
          >
            <Heart
              className={`h-4 w-4 transition-colors ${
                optimisticHearted ? 'fill-rose-500 text-rose-500' : 'text-current'
              }`}
            />
          </motion.span>
          <span>
            {isSelf
              ? 'Tu perfil'
              : optimisticHearted
                ? 'Ya diste tu corazón'
                : 'Apoyar con corazón'}
          </span>
          <span
            className={`font-mono-num rounded-lg px-2 py-0.5 text-[11px] font-extrabold ${
              optimisticHearted
                ? 'bg-rose-500/15 text-rose-700 dark:text-rose-200'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            {optimisticCount}
          </span>
        </button>

        <AnimatePresence>
          {burstKey > 0 && !prefersReducedMotion && (
            <div key={burstKey} aria-hidden="true" className="pointer-events-none absolute left-5 top-1">
              {HEART_PARTICLES.map((p) => (
                <motion.span
                  key={p.id}
                  initial={{ opacity: 0.95, x: 0, y: 0, scale: 0.6 }}
                  animate={{ opacity: 0, x: p.x, y: p.y, scale: 1.1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.65, delay: p.delay, ease: 'easeOut' }}
                  className="absolute text-rose-500"
                >
                  <Heart className="h-3 w-3 fill-rose-500" />
                </motion.span>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleToggle}
        disabled={submitting || isSelf}
        aria-pressed={optimisticHearted}
        aria-label={
          isSelf
            ? `Apoyos ciudadanos: ${optimisticCount}`
            : optimisticHearted
              ? `Ya diste tu corazón a ${councilorName} (${optimisticCount})`
              : `Dar corazón de apoyo a ${councilorName} (${optimisticCount})`
        }
        title={
          isSelf
            ? 'Tu perfil'
            : optimisticHearted
              ? 'Ya diste tu corazón (clic para quitar)'
              : 'Enviar corazón de apoyo'
        }
        className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer disabled:opacity-65 disabled:cursor-not-allowed ${
          optimisticHearted
            ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/80'
            : 'bg-slate-100/90 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/80 hover:border-rose-300 dark:hover:border-rose-700 hover:text-rose-600 dark:hover:text-rose-300'
        }`}
      >
        <motion.span
          animate={
            optimisticHearted && !prefersReducedMotion
              ? { scale: [1, 1.32, 0.92, 1] }
              : { scale: 1 }
          }
          transition={{ duration: 0.38 }}
          className="inline-flex items-center justify-center"
        >
          <Heart
            className={`h-3.5 w-3.5 ${
              optimisticHearted ? 'fill-rose-500 text-rose-500' : 'text-current'
            }`}
          />
        </motion.span>
        <span className="font-mono-num font-bold">{optimisticCount}</span>
      </button>

      <AnimatePresence>
        {burstKey > 0 && !prefersReducedMotion && (
          <div key={burstKey} aria-hidden="true" className="pointer-events-none absolute left-3 top-0">
            {HEART_PARTICLES.map((p) => (
              <motion.span
                key={p.id}
                initial={{ opacity: 0.95, x: 0, y: 0, scale: 0.55 }}
                animate={{ opacity: 0, x: p.x, y: p.y, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, delay: p.delay, ease: 'easeOut' }}
                className="absolute text-rose-500"
              >
                <Heart className="h-2.5 w-2.5 fill-rose-500" />
              </motion.span>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
