import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, RefreshCw, Sparkles, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useUnsavedChangesFlag } from '../lib/unsavedChanges';
import { useToast } from './ToastProvider';

const UPDATE_POLL_INTERVAL_MS = 45 * 60 * 1000;
const VISIBILITY_THROTTLE_MS = 5 * 60 * 1000;
const SNOOZE_DURATION_MS = 5 * 60 * 1000;

export function PWAUpdatePrompt() {
  const { showToast } = useToast();
  const reduceMotion = useReducedMotion();
  const hasUnsavedChanges = useUnsavedChangesFlag();

  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [snoozedUntil, setSnoozedUntil] = useState<number>(0);
  const [updating, setUpdating] = useState(false);

  const lastVisibilityCheckRef = useRef<number>(0);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const updateButtonRef = useRef<HTMLButtonElement | null>(null);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, reg) {
      if (reg) setRegistration(reg);
    },
    onRegisterError() {
      // Silencioso en entornos sin soporte SW (p. ej. iframe sin HTTPS local)
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    showToast('Aplicación lista para uso sin conexión', 'success');
    setOfflineReady(false);
  }, [offlineReady, setOfflineReady, showToast]);

  useEffect(() => {
    if (!registration) return;

    const triggerCheck = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      registration.update().catch(() => undefined);
    };

    const intervalId = window.setInterval(triggerCheck, UPDATE_POLL_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastVisibilityCheckRef.current < VISIBILITY_THROTTLE_MS) return;
      lastVisibilityCheckRef.current = now;
      triggerCheck();
    };

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [registration]);

  const isSnoozed = snoozedUntil > Date.now();
  const showDialog = needRefresh && !isSnoozed;

  useEffect(() => {
    if (!snoozedUntil) return;
    const remaining = snoozedUntil - Date.now();
    if (remaining <= 0) {
      setSnoozedUntil(0);
      return;
    }
    const timer = window.setTimeout(() => {
      setSnoozedUntil(0);
    }, remaining + 50);
    return () => window.clearTimeout(timer);
  }, [snoozedUntil]);

  const handleSnooze = useCallback(() => {
    if (updating) return;
    setSnoozedUntil(Date.now() + SNOOZE_DURATION_MS);
  }, [updating]);

  const handleApplyUpdate = useCallback(async () => {
    setUpdating(true);
    try {
      await updateServiceWorker(true);
    } catch {
      setUpdating(false);
      showToast('No se pudo aplicar la actualización automáticamente. Recarga la página.', 'error');
    }
  }, [showToast, updateServiceWorker]);

  useEffect(() => {
    if (!showDialog) return;

    const prevFocused = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => {
      updateButtonRef.current?.focus();
    }, 30);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleSnooze();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', onKeyDown);
      prevFocused?.focus?.();
    };
  }, [showDialog, handleSnooze]);

  return (
    <AnimatePresence>
      {showDialog && (
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-update-title"
          aria-describedby="pwa-update-desc"
          initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: 12 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed bottom-20 lg:bottom-6 right-3 left-3 sm:left-auto sm:right-6 sm:w-full sm:max-w-sm z-[95] rounded-2xl border border-emerald-200 dark:border-emerald-800/80 bg-white dark:bg-slate-900 p-4 shadow-2xl space-y-3 no-print pb-safe-bottom"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2
                  id="pwa-update-title"
                  className="text-sm font-extrabold text-slate-900 dark:text-white"
                >
                  Nueva versión disponible
                </h2>
                <p
                  id="pwa-update-desc"
                  className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed"
                >
                  Hay mejoras y correcciones listas para el Portal CMJ Flandes. Actualiza cuando estés listo.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSnooze}
              disabled={updating}
              aria-label="Posponer aviso de actualización"
              className="min-h-[44px] min-w-[44px] sm:min-h-[36px] sm:min-w-[36px] -mt-1 -mr-1 flex items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {hasUnsavedChanges && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/70 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 flex items-start gap-2 text-[11px] font-medium text-amber-900 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <span>
                Tienes cambios sin guardar en un formulario o editor abierto. Si recargas ahora podrías perder lo que no hayas guardado.
              </span>
            </div>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={handleSnooze}
              disabled={updating}
              className="min-h-[44px] sm:min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
            >
              Más tarde (5 min)
            </button>
            <button
              ref={updateButtonRef}
              type="button"
              onClick={handleApplyUpdate}
              disabled={updating}
              className="min-h-[44px] sm:min-h-[38px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${updating ? 'animate-spin' : ''}`} />
              {updating ? 'Actualizando...' : 'Actualizar ahora'}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
