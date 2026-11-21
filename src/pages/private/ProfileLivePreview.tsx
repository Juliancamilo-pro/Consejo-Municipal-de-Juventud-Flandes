import { useState } from 'react';
import { Eye, Mail, Quote } from 'lucide-react';
import {
  CounselorAchievement,
  CounselorSocialLinks,
  ProjectItem,
  PublicFieldVisibility,
  ROLE_LABELS,
  UserRole,
} from '../../types/models';
import { SOCIAL_PLATFORMS } from '../../utils/socialLinks';
import { Avatar } from '../../components/ui/Avatar';
import { SocialBrandIcon } from '../../components/ui/SocialBrandIcon';

interface ProfileLivePreviewProps {
  displayName: string;
  role: UserRole;
  photoUrl: string;
  positionTitle: string;
  sector: string;
  commissionName?: string;
  educationOccupation: string;
  shortBio: string;
  fullBio: string;
  motivation: string;
  proposals: string;
  featuredQuote: string;
  workAxes: string[];
  skills: string[];
  achievements: CounselorAchievement[];
  projectIds: string[];
  projects: ProjectItem[];
  socials: CounselorSocialLinks;
  publicEmail: string;
  visibility: PublicFieldVisibility;
}

export function ProfileLivePreview(props: ProfileLivePreviewProps) {
  const [mode, setMode] = useState<'tarjeta' | 'ficha'>('tarjeta');
  const v = props.visibility;

  const visiblePhoto = v.photo !== false ? props.photoUrl : '';
  const visibleShortBio = v.shortBio !== false ? props.shortBio : '';
  const visibleQuote = v.featuredQuote !== false ? props.featuredQuote.trim() : '';
  const visibleAxes = v.workAxes !== false ? props.workAxes : [];
  const visibleSocials =
    v.socials !== false
      ? SOCIAL_PLATFORMS.filter((p) => Boolean(props.socials[p.key]?.trim()))
      : [];
  const linkedProjects =
    v.projects !== false
      ? props.projects.filter((p) => props.projectIds.includes(p.id))
      : [];

  return (
    <div className="rounded-xl border border-stone-200 bg-[#FAF8F4] p-4 dark:border-slate-800 dark:bg-slate-950/70">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-3 dark:border-slate-800">
        <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-stone-700 uppercase dark:text-slate-300">
          <Eye className="h-3.5 w-3.5 text-[#7B1832] dark:text-[#E5C158]" aria-hidden="true" />
          <span>Vista previa en vivo</span>
        </div>
        <div className="flex rounded-lg border border-stone-200 bg-white p-0.5 text-[11px] dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setMode('tarjeta')}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              mode === 'tarjeta'
                ? 'bg-[#7B1832] text-white dark:bg-[#C59B27] dark:text-slate-950'
                : 'text-stone-600 dark:text-slate-300'
            }`}
          >
            Tarjeta directorio
          </button>
          <button
            type="button"
            onClick={() => setMode('ficha')}
            className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
              mode === 'ficha'
                ? 'bg-[#7B1832] text-white dark:bg-[#C59B27] dark:text-slate-950'
                : 'text-stone-600 dark:text-slate-300'
            }`}
          >
            Ficha completa
          </button>
        </div>
      </div>

      {mode === 'tarjeta' ? (
        <div className="mt-4 rounded-xl border border-stone-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <Avatar src={visiblePhoto} name={props.displayName || 'Consejero'} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold tracking-wider text-[#1E3A8A] uppercase dark:text-[#60A5FA]">
                {ROLE_LABELS[props.role]}
                {props.commissionName ? ` · ${props.commissionName}` : ''}
              </p>
              <h3 className="mt-1 font-display text-base font-semibold text-stone-950 dark:text-white">
                {props.displayName || 'Tu nombre institucional'}
              </h3>
              <p className="text-xs font-medium text-stone-600 dark:text-slate-300">
                {props.positionTitle || ROLE_LABELS[props.role]}
                {props.sector ? ` · ${props.sector}` : ''}
              </p>
            </div>
          </div>

          {visibleQuote ? (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-[#C59B27]/25 bg-[#FAF8F4] px-3 py-2 text-xs italic text-stone-700 dark:border-[#C59B27]/30 dark:bg-slate-950/60 dark:text-slate-200">
              <Quote className="mt-0.5 h-3 w-3 shrink-0 text-[#C59B27]" aria-hidden="true" />
              <span>“{visibleQuote}”</span>
            </p>
          ) : visibleShortBio ? (
            <p className="mt-3 text-xs leading-relaxed text-stone-600 dark:text-slate-300">
              {visibleShortBio}
            </p>
          ) : (
            <p className="mt-3 text-xs italic text-stone-400 dark:text-slate-500">
              Sin reseña o frase destacada visible.
            </p>
          )}

          {visibleAxes.length > 0 && (
            <p className="mt-3 text-xs text-stone-500 dark:text-slate-400">
              {visibleAxes.slice(0, 4).join(' · ')}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 max-h-[540px] space-y-3 overflow-y-auto rounded-xl border border-stone-200 bg-white p-4 text-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <Avatar src={visiblePhoto} name={props.displayName || 'Consejero'} size="lg" />
            <div>
              <h3 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
                {props.displayName || 'Tu nombre'}
              </h3>
              <p className="text-stone-600 dark:text-slate-300">
                {props.positionTitle || ROLE_LABELS[props.role]}
                {props.commissionName ? ` · ${props.commissionName}` : ''}
              </p>
              {v.education !== false && props.educationOccupation && (
                <p className="mt-1 text-stone-500 dark:text-slate-400">{props.educationOccupation}</p>
              )}
            </div>
          </div>

          {visibleQuote && (
            <blockquote className="rounded-lg border border-stone-200 bg-[#FAF8F4] px-3 py-2 italic text-stone-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200">
              “{visibleQuote}”
            </blockquote>
          )}

          {v.fullBio !== false && props.fullBio && (
            <div>
              <p className="font-semibold text-stone-900 dark:text-white">Sobre mí</p>
              <p className="mt-0.5 whitespace-pre-line text-stone-600 dark:text-slate-300">{props.fullBio}</p>
            </div>
          )}

          {v.motivation !== false && props.motivation && (
            <div>
              <p className="font-semibold text-stone-900 dark:text-white">Por qué estoy en el CMJ</p>
              <p className="mt-0.5 whitespace-pre-line text-stone-600 dark:text-slate-300">{props.motivation}</p>
            </div>
          )}

          {v.proposals !== false && props.proposals && (
            <div>
              <p className="font-semibold text-stone-900 dark:text-white">Propuestas</p>
              <p className="mt-0.5 whitespace-pre-line text-stone-600 dark:text-slate-300">{props.proposals}</p>
            </div>
          )}

          {v.achievements !== false && props.achievements.length > 0 && (
            <div>
              <p className="font-semibold text-stone-900 dark:text-white">Logros e hitos</p>
              <ul className="mt-1 space-y-1">
                {props.achievements.map((a, idx) => (
                  <li key={`${a.year}-${idx}`} className="text-stone-600 dark:text-slate-300">
                    <strong className="text-[#7B1832] dark:text-[#E5C158]">{a.year}</strong> · {a.title}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {v.skills !== false && props.skills.length > 0 && (
            <p className="text-stone-600 dark:text-slate-300">
              <strong className="text-stone-900 dark:text-white">Habilidades:</strong>{' '}
              {props.skills.join(' · ')}
            </p>
          )}

          {linkedProjects.length > 0 && (
            <div>
              <p className="font-semibold text-stone-900 dark:text-white">Proyectos vinculados</p>
              <p className="mt-0.5 text-stone-600 dark:text-slate-300">
                {linkedProjects.map((p) => p.title).join(' · ')}
              </p>
            </div>
          )}

          {(visibleSocials.length > 0 || (v.publicEmail && props.publicEmail.trim())) && (
            <div className="flex flex-wrap gap-2 border-t border-stone-200 pt-2 dark:border-slate-800">
              {visibleSocials.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1 text-stone-700 dark:text-slate-300">
                  <SocialBrandIcon platform={s.key} className="h-3.5 w-3.5 text-[#7B1832] dark:text-[#E5C158]" />
                  <span>{s.label}</span>
                </span>
              ))}
              {v.publicEmail && props.publicEmail.trim() && (
                <span className="inline-flex items-center gap-1 text-stone-700 dark:text-slate-300">
                  <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{props.publicEmail.trim()}</span>
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
