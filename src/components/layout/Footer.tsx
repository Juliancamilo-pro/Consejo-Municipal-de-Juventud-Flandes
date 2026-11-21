import { MapPin, Moon, ShieldCheck, Sun } from 'lucide-react';
import { AppRoute } from '../../types/navigation';
import { BrandEmblem } from '../ui/BrandEmblem';
import { PWAInstallButton } from '../ui/PWAInstallButton';

interface FooterProps {
  onNavigate: (path: AppRoute) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

const CITIZEN_LINKS: { label: string; path: AppRoute }[] = [
  { label: 'Inicio', path: '/' },
  { label: 'Consejo', path: '/consejo' },
  { label: 'Consejeros', path: '/consejeros' },
  { label: 'Comisiones', path: '/comisiones' },
];

const TRANSPARENCY_LINKS: { label: string; path: AppRoute }[] = [
  { label: 'Gestión y Actas', path: '/gestion' },
  { label: 'Actualidad y Datos', path: '/actualidad' },
  { label: 'Buzón e Iniciativas', path: '/participacion' },
  { label: 'Verificar Certificado', path: '/verificar' },
  { label: 'Contacto y PQRSD', path: '/contacto' },
];

export function Footer({ onNavigate, theme, onToggleTheme }: FooterProps) {
  return (
    <footer className="border-t border-stone-200 bg-white dark:border-slate-800 dark:bg-slate-900/85">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-3">
              <BrandEmblem className="h-10 w-10 shrink-0" />
              <div>
                <p className="font-display text-lg font-semibold text-stone-900 dark:text-slate-100">
                  Consejo Municipal de Juventud
                </p>
                <p className="text-xs text-stone-600 dark:text-slate-400">
                  Flandes, Tolima · Puerta de Oro del Tolima · Periodo 2026–2029
                </p>
              </div>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-stone-600 dark:text-slate-300">
              Mecanismo autónomo de representación, concertación, vigilancia y control social para
              las juventudes del Alto Magdalena en el municipio de Flandes, Tolima.
            </p>
            <div className="mt-4 space-y-1.5 text-xs text-stone-500 dark:text-slate-400">
              <p className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
                <span>Municipio de Flandes, Tolima · República de Colombia</span>
              </p>
              <p className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-[#1E3A8A] dark:text-[#60A5FA]" aria-hidden="true" />
                <span>Ley Estatutaria 1622 de 2013 · Ley 1885 de 2018 · Ley 1581 de 2012</span>
              </p>
            </div>
          </div>

          <div className="md:col-span-2">
            <h2 className="font-display text-sm font-semibold text-stone-900 dark:text-slate-100">
              Institución
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {CITIZEN_LINKS.map((item) => (
                <li key={item.path}>
                  <a
                    href={item.path}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(item.path);
                    }}
                    className="text-stone-600 transition-colors hover:text-[#7B1832] dark:text-slate-300 dark:hover:text-[#D9B245]"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-2">
            <h2 className="font-display text-sm font-semibold text-stone-900 dark:text-slate-100">
              Transparencia
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {TRANSPARENCY_LINKS.map((item) => (
                <li key={item.path}>
                  <a
                    href={item.path}
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate(item.path);
                    }}
                    className="text-stone-600 transition-colors hover:text-[#7B1832] dark:text-slate-300 dark:hover:text-[#D9B245]"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-3">
            <h2 className="font-display text-sm font-semibold text-stone-900 dark:text-slate-100">
              Gestión y Preferencias
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <a
                  href="/portal"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate('/portal');
                  }}
                  className="font-semibold text-[#7B1832] transition-colors hover:underline dark:text-[#D9B245]"
                >
                  Portal de Consejeros →
                </a>
              </li>
            </ul>
            <div className="mt-5 flex flex-col items-start gap-2.5">
              <button
                type="button"
                onClick={onToggleTheme}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-stone-200 bg-[#FAFAF8] px-3.5 py-2 text-xs font-medium text-stone-700 transition-colors hover:border-stone-300 hover:bg-stone-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="h-4 w-4 text-[#D9B245]" aria-hidden="true" />
                    <span>Cambiar a modo claro</span>
                  </>
                ) : (
                  <>
                    <Moon className="h-4 w-4 text-[#1E3A8A]" aria-hidden="true" />
                    <span>Cambiar a modo oscuro</span>
                  </>
                )}
              </button>
              <PWAInstallButton />
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-stone-200 pt-6 text-xs text-stone-500 dark:border-slate-800 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © 2026 Consejo Municipal de Juventud de Flandes, Tolima · República de Colombia.
          </p>
          <p>Accesibilidad WCAG AA · Protección de Datos Personales (Habeas Data).</p>
        </div>
      </div>
      <div className="cmj-tricolor-rule h-[3px] w-full" aria-hidden="true" />
    </footer>
  );
}
