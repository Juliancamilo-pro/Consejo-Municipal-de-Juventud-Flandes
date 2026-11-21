import { useMemo, useState } from 'react';
import { BookOpen, ChevronDown, Compass, KeyRound, QrCode, Scale, ShieldCheck, Users } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';

interface GuideTopic {
  id: string;
  roleScope: 'todos' | 'mesa' | 'lider';
  title: string;
  summary: string;
  steps: string[];
  icon: typeof BookOpen;
}

const TOPICS: GuideTopic[] = [
  {
    id: 'roles',
    roleScope: 'mesa',
    title: 'Roles y aprobación de cuentas',
    summary: 'Cómo funciona la jerarquía institucional dentro del CMJ de Flandes.',
    icon: Users,
    steps: [
      'Secretario(a) Técnico y Presidencia / Vicepresidencia integran la Mesa Directiva con acceso a aprobación de cuentas, edición pública y votaciones.',
      'Líderes de Comisión pueden publicar noticias, proyectos y agendar reuniones.',
      'Consejeros activos participan en sesiones, votaciones, compromisos y configuran su ficha pública.',
    ],
  },
  {
    id: 'seguridad',
    roleScope: 'todos',
    title: 'Seguridad de acceso y contraseña',
    summary: 'Protege tu cuenta con una contraseña robusta y cierre remoto de sesiones.',
    icon: KeyRound,
    steps: [
      'Ingresa a Resumen y Perfil → pestaña Seguridad.',
      'Usa una contraseña de mínimo 12 caracteres que no incluya tu nombre ni tu correo.',
      'Si accediste desde un equipo compartido, cierra sesión al terminar o revoca sesiones activas.',
    ],
  },
  {
    id: 'perfil',
    roleScope: 'todos',
    title: 'Tu ficha pública y Habeas Data',
    summary: 'Control granular bajo la Ley 1581 de 2012 y autorización de acudiente para menores.',
    icon: ShieldCheck,
    steps: [
      'Sube tu foto cuadrada en WebP desde Mi ficha pública.',
      'Activa en Privacidad únicamente los campos que deseas mostrar en /consejeros.',
      'Marca la autorización de Habeas Data y envía a revisión de la Mesa Directiva.',
    ],
  },
  {
    id: 'sesiones',
    roleScope: 'lider',
    title: 'Asistencia QR, actas y Google Workspace',
    summary: 'Registro de quórum, radicación directa de actas y hojas de cálculo en Google Sheets.',
    icon: QrCode,
    steps: [
      'Mesa Directiva genera el código QR en Sesiones y Asistencia para el quórum en tiempo real.',
      'Con "Radicar Acta" puedes crear el borrador PDF oficial directamente en Documentos con consecutivo.',
      'En Google Workspace puedes exportar tablas de Directorio, Asistencia y Compromisos hacia Google Sheets.',
    ],
  },
];

const GLOSSARY_LAWS: { term: string; detail: string }[] = [
  {
    term: 'Ley 1622 de 2013 (Estatuto de Ciudadanía Juvenil)',
    detail: 'Establece el marco institucional para garantizar a las y los jóvenes (14 a 28 años) el ejercicio pleno de su ciudadanía civil, social y pública.',
  },
  {
    term: 'Ley 1885 de 2018',
    detail: 'Modifica el Estatuto para reglamentar las elecciones directas y funciones de los Consejos Municipales de Juventud (CMJ), las mesas de concertación y la interlocución con alcaldías.',
  },
  {
    term: 'Quórum deliberatorio y decisorio',
    detail: 'El CMJ requiere la presencia de la mayoría simple de sus consejeros electos activos para adoptar decisiones y proposiciones válidas.',
  },
];

export function HelpGuidePanel({ onOpenTour }: { onOpenTour?: () => void }) {
  const [openId, setOpenId] = useState(TOPICS[0].id);
  const [search, setSearch] = useState('');
  const [roleScope, setRoleScope] = useState('todos');
  const [openGlossary, setOpenGlossary] = useState<string | null>(GLOSSARY_LAWS[0].term);

  const visibleTopics = useMemo(() => {
    const q = search.trim().toLowerCase();
    return TOPICS.filter((t) => {
      if (roleScope !== 'todos' && t.roleScope !== roleScope) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.summary.toLowerCase().includes(q) ||
        t.steps.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [search, roleScope]);

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#7B1832] uppercase dark:text-[#D9B245]">
              Manual operativo del consejero
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold text-stone-950 dark:text-white">
              Guía rápida y marco normativo · CMJ Flandes (2026–2029)
            </h2>
          </div>
          {onOpenTour && (
            <Button size="sm" variant="outline" onClick={onOpenTour}>
              <Compass className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Abrir tour interactivo</span>
            </Button>
          )}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Buscar en la guía" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ej. QR, Sheets, Habeas Data..." />
          <Select label="Filtrar por alcance" value={roleScope} onChange={(e) => setRoleScope(e.target.value)}>
            <option value="todos">Todos los temas</option>
            <option value="mesa">Mesa Directiva</option>
            <option value="lider">Líderes y gestión</option>
          </Select>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {visibleTopics.map((topic) => {
          const Icon = topic.icon;
          const isOpen = openId === topic.id;
          return (
            <Card key={topic.id}>
              <button type="button" onClick={() => setOpenId(topic.id)} className="flex w-full items-start gap-3 text-left">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#7B1832]/10 text-[#7B1832] dark:bg-[#D9B245]/15 dark:text-[#D9B245]">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-display text-base font-semibold text-stone-950 dark:text-white">{topic.title}</h3>
                  <p className="mt-0.5 text-xs text-stone-500 dark:text-slate-400">{topic.summary}</p>
                </div>
              </button>
              {isOpen && (
                <ol className="mt-4 list-decimal space-y-2 border-t border-stone-200/80 pt-3 pl-5 text-xs leading-relaxed text-stone-700 dark:border-slate-800 dark:text-slate-300">
                  {topic.steps.map((step) => <li key={step}>{step}</li>)}
                </ol>
              )}
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-[#1E3A8A] dark:text-[#60A5FA]" aria-hidden="true" />
          <h3 className="font-display text-base font-semibold text-stone-950 dark:text-white">
            Glosario normativo: Ley 1622 de 2013 y Ley 1885 de 2018
          </h3>
        </div>
        <div className="mt-3 divide-y divide-stone-200/80 dark:divide-slate-800">
          {GLOSSARY_LAWS.map((item) => {
            const expanded = openGlossary === item.term;
            return (
              <div key={item.term} className="py-2.5">
                <button
                  type="button"
                  onClick={() => setOpenGlossary(expanded ? null : item.term)}
                  className="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold text-stone-900 dark:text-slate-100"
                >
                  <span>{item.term}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                {expanded && (
                  <p className="mt-1.5 text-xs leading-relaxed text-stone-600 dark:text-slate-300">{item.detail}</p>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
