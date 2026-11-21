import { useEffect, useState } from 'react';
import { Accessibility, Contrast, Moon, RotateCcw, Sparkles, Sun, Type, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AccessibilitySettings, FontScale } from '../../types/accessibility';

interface AccessibilityMenuProps {
  settings: AccessibilitySettings;
  onToggleTheme: () => void;
  onSetFontScale: (scale: FontScale) => void;
  onToggleHighContrast: () => void;
  onToggleReduceMotion: () => void;
  onToggleHideSeasonalOrnaments?: () => void;
  onReset: () => void;
}

export function AccessibilityMenu({
  settings,
  onToggleTheme,
  onSetFontScale,
  onToggleHighContrast,
  onToggleReduceMotion,
  onToggleHideSeasonalOrnaments,
  onReset,
}: AccessibilityMenuProps) {
  const [open, setOpen] = useState(false);
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <AnimatePresence>
        {open && (
          <motion.section
            id="accessibility-panel"
            aria-label="Opciones de accesibilidad y apariencia"
            initial={prefersReduced ? false : { opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReduced ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="mb-3 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-stone-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
          >
            <div className="flex items-center justify-between border-b border-stone-200 pb-3 dark:border-slate-800">
              <h2 className="font-display text-base font-semibold text-stone-900 dark:text-slate-100">
                Accesibilidad y Lectura
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar panel de accesibilidad"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Modo de color */}
              <div>
                <span className="block text-xs font-medium text-stone-600 dark:text-slate-300">
                  Tema de pantalla
                </span>
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="mt-1.5 flex min-h-[44px] w-full items-center justify-between rounded-lg border border-stone-200 bg-[#FAFAF8] px-3.5 py-2 text-sm font-medium text-stone-800 transition-colors hover:bg-stone-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                >
                  <span className="flex items-center gap-2">
                    {settings.theme === 'dark' ? (
                      <Moon className="h-4 w-4 text-[#D9B245]" aria-hidden="true" />
                    ) : (
                      <Sun className="h-4 w-4 text-[#7B1832]" aria-hidden="true" />
                    )}
                    <span>{settings.theme === 'dark' ? 'Modo oscuro (Pizarra)' : 'Modo claro (Marfil)'}</span>
                  </span>
                  <span className="text-xs text-stone-500 dark:text-slate-400">Cambiar</span>
                </button>
              </div>

              {/* Tamaño de fuente */}
              <div>
                <span className="flex items-center gap-1.5 text-xs font-medium text-stone-600 dark:text-slate-300">
                  <Type className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Tamaño de texto</span>
                </span>
                <div
                  role="group"
                  aria-label="Seleccionar tamaño de texto"
                  className="mt-1.5 grid grid-cols-3 gap-1 rounded-lg bg-stone-100 p-1 dark:bg-slate-800"
                >
                  {(
                    [
                      { key: 'normal', label: 'Normal' },
                      { key: 'large', label: 'Grande' },
                      { key: 'xlarge', label: 'Extra' },
                    ] as const
                  ).map((item) => {
                    const active = settings.fontScale === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => onSetFontScale(item.key)}
                        aria-pressed={active}
                        className={`min-h-[38px] rounded-md px-2 text-xs font-medium transition-colors ${
                          active
                            ? 'bg-white text-stone-900 shadow-sm dark:bg-slate-700 dark:text-white'
                            : 'text-stone-600 hover:text-stone-900 dark:text-slate-300 dark:hover:text-white'
                        }`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Interruptores WCAG */}
              <div className="space-y-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.highContrast}
                  onClick={onToggleHighContrast}
                  className="flex min-h-[44px] w-full items-center justify-between rounded-lg border border-stone-200 px-3.5 py-2 text-sm font-medium text-stone-800 transition-colors hover:bg-stone-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="flex items-center gap-2">
                    <Contrast className="h-4 w-4 text-[#1E3A8A] dark:text-[#60A5FA]" aria-hidden="true" />
                    <span>Alto contraste</span>
                  </span>
                  <span className="text-xs font-semibold text-[#7B1832] dark:text-[#D9B245]">
                    {settings.highContrast ? 'Activo' : 'Inactivo'}
                  </span>
                </button>

                <button
                  type="button"
                  role="switch"
                  aria-checked={settings.reduceMotion}
                  onClick={onToggleReduceMotion}
                  className="flex min-h-[44px] w-full items-center justify-between rounded-lg border border-stone-200 px-3.5 py-2 text-sm font-medium text-stone-800 transition-colors hover:bg-stone-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#C59B27]" aria-hidden="true" />
                    <span>Reducir animaciones</span>
                  </span>
                  <span className="text-xs font-semibold text-[#7B1832] dark:text-[#D9B245]">
                    {settings.reduceMotion ? 'Activo' : 'Inactivo'}
                  </span>
                </button>

                {onToggleHideSeasonalOrnaments && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!settings.hideSeasonalOrnaments}
                    onClick={onToggleHideSeasonalOrnaments}
                    className="flex min-h-[44px] w-full items-center justify-between rounded-lg border border-stone-200 px-3.5 py-2 text-sm font-medium text-stone-800 transition-colors hover:bg-stone-50 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800"
                  >
                    <span className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
                      <span>Adornos de temporada</span>
                    </span>
                    <span className="text-xs font-semibold text-[#7B1832] dark:text-[#D9B245]">
                      {settings.hideSeasonalOrnaments ? 'Ocultos' : 'Visibles'}
                    </span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={onReset}
                className="flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg border border-stone-200 px-3 py-2 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Restablecer valores</span>
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="accessibility-panel"
        aria-label="Abrir opciones de accesibilidad y modo oscuro"
        className="inline-flex h-12 items-center gap-2 rounded-full border border-stone-300 bg-white px-4 text-sm font-medium text-stone-900 shadow-lg transition-transform duration-150 hover:scale-[1.02] hover:border-[#7B1832] active:scale-[0.98] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-[#D9B245]"
      >
        <Accessibility className="h-5 w-5 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
        <span className="hidden sm:inline">Accesibilidad</span>
      </button>
    </div>
  );
}
