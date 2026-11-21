import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { CounselorAchievement, ProjectItem } from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

const SUGGESTED_WORK_AXES = [
  'Educación y cultura',
  'Empleo y emprendimiento',
  'Deporte y recreación',
  'Ambiente y ruralidad',
  'Salud mental y bienestar',
  'Participación ciudadana',
  'Control social y veeduría',
];

interface ProfileExtendedFieldsProps {
  featuredQuote: string;
  onChangeFeaturedQuote: (v: string) => void;
  workAxes: string[];
  onChangeWorkAxes: (v: string[]) => void;
  skills: string[];
  onChangeSkills: (v: string[]) => void;
  achievements: CounselorAchievement[];
  onChangeAchievements: (v: CounselorAchievement[]) => void;
  projects: ProjectItem[];
  projectIds: string[];
  onToggleProject: (id: string) => void;
}

export function ProfileExtendedFields(props: ProfileExtendedFieldsProps) {
  const [customAxis, setCustomAxis] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [achYear, setAchYear] = useState(String(new Date().getFullYear()));
  const [achTitle, setAchTitle] = useState('');
  const [achDesc, setAchDesc] = useState('');

  const toggleWorkAxis = (axis: string) => {
    const exists = props.workAxes.includes(axis);
    if (exists) {
      props.onChangeWorkAxes(props.workAxes.filter((a) => a !== axis));
    } else if (props.workAxes.length < 8) {
      props.onChangeWorkAxes([...props.workAxes, axis]);
    }
  };

  const addCustomAxis = () => {
    const clean = customAxis.trim().slice(0, 60);
    if (!clean || props.workAxes.includes(clean) || props.workAxes.length >= 8) return;
    props.onChangeWorkAxes([...props.workAxes, clean]);
    setCustomAxis('');
  };

  const addSkill = () => {
    const clean = skillInput.trim().slice(0, 50);
    if (!clean || props.skills.includes(clean) || props.skills.length >= 12) return;
    props.onChangeSkills([...props.skills, clean]);
    setSkillInput('');
  };

  const addAchievement = () => {
    const title = achTitle.trim().slice(0, 120);
    const year = achYear.trim().slice(0, 12) || String(new Date().getFullYear());
    if (title.length < 2 || props.achievements.length >= 12) return;
    props.onChangeAchievements([
      ...props.achievements,
      { year, title, ...(achDesc.trim() ? { description: achDesc.trim().slice(0, 240) } : {}) },
    ]);
    setAchTitle('');
    setAchDesc('');
  };

  return (
    <div className="space-y-5 border-t border-stone-200 pt-5 dark:border-slate-800">
      <Input
        id="profile-featured-quote"
        label="Frase destacada o lema juvenil (máx. 140 caracteres)"
        maxLength={140}
        value={props.featuredQuote}
        onChange={(e) => props.onChangeFeaturedQuote(e.target.value)}
        placeholder="Ej. Juventud de Flandes construyendo oportunidades reales desde los barrios."
        hint={`${props.featuredQuote.length}/140 caracteres`}
      />

      <div>
        <p className="text-xs font-semibold text-stone-800 dark:text-slate-200">
          Ejes de trabajo prioritarios ({props.workAxes.length}/8)
        </p>
        <p className="mt-0.5 text-xs text-stone-500 dark:text-slate-400">
          Selecciona o agrega temas para que la ciudadanía te encuentre en el directorio.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SUGGESTED_WORK_AXES.map((axis) => {
            const active = props.workAxes.includes(axis);
            return (
              <button
                key={axis}
                type="button"
                onClick={() => toggleWorkAxis(axis)}
                className={`rounded-[4px] border px-2.5 py-1 text-xs font-medium transition-colors ${
                  active
                    ? 'border-[#7B1832] bg-[#7B1832] text-white dark:border-[#C59B27] dark:bg-[#C59B27] dark:text-slate-950'
                    : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                }`}
              >
                {axis}
              </button>
            );
          })}
          {props.workAxes
            .filter((a) => !SUGGESTED_WORK_AXES.includes(a))
            .map((axis) => (
              <button
                key={axis}
                type="button"
                onClick={() => toggleWorkAxis(axis)}
                className="inline-flex items-center gap-1 rounded-[4px] border border-[#7B1832] bg-[#7B1832] px-2.5 py-1 text-xs font-medium text-white dark:border-[#C59B27] dark:bg-[#C59B27] dark:text-slate-950"
              >
                <span>{axis}</span>
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={customAxis}
            maxLength={60}
            onChange={(e) => setCustomAxis(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomAxis())}
            placeholder="Agregar otro eje (ej. Juventud rural)"
            aria-label="Agregar otro eje de trabajo"
            className="min-h-[38px] flex-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900 focus:border-[#7B1832] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <Button type="button" size="sm" variant="outline" onClick={addCustomAxis}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Agregar</span>
          </Button>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-stone-800 dark:text-slate-200">
          Habilidades e intereses ({props.skills.length}/12)
        </p>
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={skillInput}
            maxLength={50}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
            placeholder="Ej. Gestión cultural, Oratoria, Formulación de proyectos"
            aria-label="Agregar habilidad o interés"
            className="min-h-[38px] flex-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs text-stone-900 focus:border-[#7B1832] focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <Button type="button" size="sm" variant="outline" onClick={addSkill}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Añadir</span>
          </Button>
        </div>
        {props.skills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {props.skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 rounded-[4px] border border-stone-200 bg-stone-100 px-2 py-0.5 text-xs text-stone-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <span>{skill}</span>
                <button
                  type="button"
                  onClick={() => props.onChangeSkills(props.skills.filter((s) => s !== skill))}
                  aria-label={`Quitar ${skill}`}
                  className="text-stone-500 hover:text-red-700 dark:text-slate-400 dark:hover:text-red-400"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2.5 rounded-xl border border-stone-200 bg-[#FAF8F4] p-3.5 dark:border-slate-800 dark:bg-slate-950/60">
        <p className="text-xs font-semibold text-stone-800 dark:text-slate-200">
          Logros e hitos ({props.achievements.length}/12)
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input
            type="text"
            value={achYear}
            maxLength={12}
            onChange={(e) => setAchYear(e.target.value)}
            placeholder="Año (2025)"
            aria-label="Año del logro"
            className="min-h-[38px] rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <input
            type="text"
            value={achTitle}
            maxLength={120}
            onChange={(e) => setAchTitle(e.target.value)}
            placeholder="Título del logro (ej. Primer festival juvenil del río)"
            aria-label="Título del logro"
            className="min-h-[38px] rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs sm:col-span-3 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={achDesc}
            maxLength={240}
            onChange={(e) => setAchDesc(e.target.value)}
            placeholder="Descripción breve opcional (ej. Convocó a más de 180 jóvenes de Flandes)"
            aria-label="Descripción del logro"
            className="min-h-[38px] flex-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <Button type="button" size="sm" variant="outline" onClick={addAchievement}>
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Agregar logro</span>
          </Button>
        </div>

        {props.achievements.length > 0 && (
          <ul className="space-y-1.5 pt-1">
            {props.achievements.map((item, idx) => (
              <li
                key={`${item.year}-${item.title}-${idx}`}
                className="flex items-start justify-between gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <span className="font-semibold tabular-nums text-[#7B1832] dark:text-[#E5C158]">
                    {item.year}
                  </span>{' '}
                  <span className="font-medium text-stone-900 dark:text-white">{item.title}</span>
                  {item.description && (
                    <p className="mt-0.5 text-[11px] text-stone-500 dark:text-slate-400">
                      {item.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    props.onChangeAchievements(props.achievements.filter((_, i) => i !== idx))
                  }
                  aria-label={`Eliminar logro ${item.title}`}
                  className="rounded p-1 text-stone-400 hover:text-red-700 dark:hover:text-red-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {props.projects.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-stone-700 dark:text-slate-300">
            Proyectos juveniles vinculados
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {props.projects.map((p) => {
              const selected = props.projectIds.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => props.onToggleProject(p.id)}
                  className={`rounded-[4px] border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    selected
                      ? 'border-[#7B1832] bg-[#7B1832]/10 text-[#7B1832] dark:border-[#D9B245] dark:bg-[#C59B27]/15 dark:text-[#E5C158]'
                      : 'border-stone-200 bg-white text-stone-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                  }`}
                >
                  {p.title}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
