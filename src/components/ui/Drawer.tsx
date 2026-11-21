import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

interface DrawerProps {
  open: boolean;
  title: string;
  subtitle?: string;
  side?: 'right' | 'left';
  onClose: () => void;
  children: ReactNode;
}

export function Drawer({
  open,
  title,
  subtitle,
  side = 'right',
  onClose,
  children,
}: DrawerProps) {
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const offset = side === 'right' ? 320 : -320;

  return (
    <AnimatePresence>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-50 flex justify-end bg-stone-950/55 backdrop-blur-xs"
          onClick={onClose}
        >
          <motion.aside
            initial={prefersReduced ? false : { x: offset, opacity: 0.7 }}
            animate={{ x: 0, opacity: 1 }}
            exit={prefersReduced ? undefined : { x: offset, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className={`flex h-full w-full max-w-md flex-col border-stone-200 bg-[#FAFAF8] shadow-2xl dark:border-slate-800 dark:bg-slate-900 ${
              side === 'left' ? 'mr-auto border-r' : 'ml-auto border-l'
            }`}
          >
            <div className="cmj-tricolor-rule h-[3px] w-full shrink-0" />
            <div className="flex items-start justify-between gap-3 border-b border-stone-200 px-5 py-4 dark:border-slate-800">
              <div>
                <h2 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
                  {title}
                </h2>
                {subtitle && (
                  <p className="mt-0.5 text-xs text-stone-500 dark:text-slate-400">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar panel"
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
