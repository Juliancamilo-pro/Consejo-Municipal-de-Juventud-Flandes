import { RotateCcw } from 'lucide-react';
import { SiteAppearanceConfig, SiteAppearanceVersion } from '../../types/siteContent';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

interface SiteAppearanceVersionsModalProps {
  open: boolean;
  versions: SiteAppearanceVersion[];
  onRestore: (snapshot: SiteAppearanceConfig, label: string) => void;
  onClose: () => void;
}

export function SiteAppearanceVersionsModal({
  open,
  versions,
  onRestore,
  onClose,
}: SiteAppearanceVersionsModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Historial de versiones del portal" maxWidth="lg">
      {versions.length === 0 ? (
        <p className="text-xs text-stone-500 dark:text-slate-400">
          Aún no hay versiones guardadas en el historial. Cada vez que guardes un borrador o publiques cambios quedará una copia aquí.
        </p>
      ) : (
        <ul className="divide-y divide-stone-200 dark:divide-slate-800">
          {versions.map((ver) => (
            <li key={ver.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
              <div>
                <p className="font-semibold text-stone-900 dark:text-white">{ver.label}</p>
                <p className="text-stone-500 dark:text-slate-400">
                  {ver.savedByName} · <span className="font-mono-tabular">{ver.createdAtIso.slice(0, 16).replace('T', ' ')}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-stone-500 dark:text-slate-400">
                  Título: {ver.snapshot.heroTitle} · Tema: {ver.snapshot.activeThemeId || 'institucional'}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRestore(ver.snapshot, ver.label)}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Cargar esta versión</span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
