import { ArrowRight, Building2, FileText, Megaphone, MessageSquarePlus, ShieldCheck, Users } from 'lucide-react';
import { PublicPortalState } from '../../hooks/usePublicPortalData';
import { AppRoute } from '../../types/navigation';
import { getCommissionSlug } from '../../utils/commissionUtils';

const SERVICE_CARDS = [
  {
    index: '01',
    title: 'Directorio de Consejeros',
    desc: 'Hojas de vida públicas, Mesa Directiva, comisiones y contacto institucional.',
    icon: Users,
    route: '/consejeros' as AppRoute,
    featured: true,
  },
  {
    index: '02',
    title: 'Gestión y Rendición',
    desc: 'Proyectos juveniles, sesiones, agenda .ics, actas e informes de gestión.',
    icon: FileText,
    route: '/gestion' as AppRoute,
    featured: false,
  },
  {
    index: '03',
    title: 'Actualidad y Consultas',
    desc: 'Noticias oficiales, encuestas juveniles, convocatorias y datos abiertos.',
    icon: Megaphone,
    route: '/actualidad' as AppRoute,
    featured: false,
  },
  {
    index: '04',
    title: 'Buzón de Participación',
    desc: 'Radica propuestas o PQRSD anónimas o identificadas con código único.',
    icon: MessageSquarePlus,
    route: '/participacion' as AppRoute,
    featured: true,
  },
];

export function HomeBentoChannels({
  portal,
  onNavigate,
}: {
  portal: PublicPortalState;
  onNavigate: (path: AppRoute) => void;
}) {
  const featuredCommissions = portal.commissions.slice(0, 3);

  return (
    <section className="bg-white dark:bg-slate-950/35">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-4 border-b border-stone-200 pb-5 dark:border-slate-800 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#7B1832] uppercase dark:text-[#D9B245]">
              Ventanilla Ciudadana · Flandes, Tolima
            </p>
            <h2 className="cmj-display-section mt-2 font-display font-semibold text-stone-950 dark:text-white">
              Canales directos y estructura temática
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => onNavigate('/portal')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E3A8A] hover:underline dark:text-[#60A5FA]"
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Portal de Consejeros</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('/contacto')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#7B1832] hover:underline dark:text-[#D9B245]"
            >
              <span>Atención y PQRSD</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Bento Grid Asimétrico */}
        <div className="mt-7 grid grid-cols-1 gap-5 md:grid-cols-12">
          {SERVICE_CARDS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.route}
                type="button"
                onClick={() => onNavigate(item.route)}
                className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border border-stone-200 bg-[#FAFAF8] p-6 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-[#7B1832]/50 hover:bg-white hover:shadow-md active:translate-y-0 dark:border-slate-800 dark:bg-slate-900/75 dark:hover:border-[#D9B245]/50 dark:hover:bg-slate-900 ${
                  item.featured ? 'md:col-span-7' : 'md:col-span-5'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-[3px] bg-transparent transition-colors duration-150 group-hover:bg-[#C59B27]"
                />
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono-tabular text-xs font-semibold text-[#C59B27] dark:text-[#D9B245]">
                      {item.index}
                    </span>
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-stone-200 bg-white text-[#7B1832] transition-colors group-hover:bg-[#7B1832] group-hover:text-white dark:border-slate-700 dark:bg-slate-800 dark:text-[#D9B245] dark:group-hover:bg-[#A62B4B] dark:group-hover:text-white">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                  </div>
                  <h3 className="mt-4 font-display text-xl font-semibold text-stone-900 dark:text-slate-100">
                    {item.title}
                  </h3>
                  <p className="cmj-prose mt-1.5 text-sm text-stone-600 dark:text-slate-300">
                    {item.desc}
                  </p>
                </div>
                <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#7B1832] dark:text-[#D9B245]">
                  <span>Ingresar</span>
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </button>
            );
          })}
        </div>

        {/* Enlaces cruzados a comisiones reales */}
        {featuredCommissions.length > 0 && (
          <div className="mt-8 rounded-xl border border-stone-200 bg-[#F7F4EE]/75 p-6 dark:border-slate-800 dark:bg-slate-900/55">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
                <h3 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
                  Comisiones activas del periodo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('/comisiones')}
                className="text-xs font-semibold text-[#7B1832] hover:underline dark:text-[#D9B245]"
              >
                Explorar todas las comisiones →
              </button>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {featuredCommissions.map((com) => (
                <button
                  key={com.id}
                  type="button"
                  onClick={() => onNavigate(`/comisiones/${getCommissionSlug(com)}`)}
                  className="rounded-lg border border-stone-200 bg-white p-4 text-left transition-colors hover:border-[#7B1832]/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-[#D9B245]/50"
                >
                  <p className="font-display text-sm font-semibold text-stone-950 dark:text-white">
                    {com.name}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-stone-600 dark:text-slate-300">
                    {com.mission || com.description}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
