import { Lock, ShieldCheck } from 'lucide-react';
import { SiteAppearanceConfig } from '../../types/siteContent';
import { EditorialImage } from '../../components/ui/EditorialImage';

interface AuthInfoAsideProps {
  siteContent: SiteAppearanceConfig;
}

export function AuthInfoAside({ siteContent }: AuthInfoAsideProps) {
  return (
    <div className="flex flex-col justify-between lg:col-span-5">
      <div>
        <p className="text-xs font-semibold tracking-wider text-[#7B1832] uppercase dark:text-[#D9B245]">
          Acceso Institucional · CMJ Flandes 2026–2029
        </p>
        <h1 className="cmj-display-page mt-3 font-display font-semibold text-stone-950 dark:text-white">
          {siteContent.authTitle}
        </h1>
        <p className="cmj-prose mt-3 text-sm leading-relaxed text-stone-700 dark:text-slate-300">
          {siteContent.authSubtitle}
        </p>

        <EditorialImage
          src={siteContent.authImageUrl}
          alt="Mesa plenaria del Consejo Municipal de Juventud"
          width={1200}
          height={896}
          priority
          className="mt-6 shadow-sm"
          imgClassName="h-44 sm:h-52"
        />
      </div>

      <dl className="mt-6 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white/85 px-4 text-xs dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/75">
        <div className="flex items-start gap-2.5 py-3.5">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
          <div>
            <dt className="font-semibold text-stone-900 dark:text-slate-100">
              Sesión blindada en servidor
            </dt>
            <dd className="mt-0.5 text-stone-600 dark:text-slate-400">
              Cookie httpOnly firmada, protección CSRF y cierre automático por inactividad.
            </dd>
          </div>
        </div>
        <div className="flex items-start gap-2.5 py-3.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#1E3A8A] dark:text-[#60A5FA]" aria-hidden="true" />
          <div>
            <dt className="font-semibold text-stone-900 dark:text-slate-100">
              Aprobación por Mesa Directiva
            </dt>
            <dd className="mt-0.5 text-stone-600 dark:text-slate-400">
              Todo registro con código de invitación requiere validación antes de activar permisos.
            </dd>
          </div>
        </div>
      </dl>
    </div>
  );
}
