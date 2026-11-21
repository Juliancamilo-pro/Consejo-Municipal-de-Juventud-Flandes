import { CheckCircle2, Lock, ShieldAlert, ShieldCheck } from 'lucide-react';
import { PublicFieldVisibility } from '../../types/models';
import { formatFirestoreDate } from '../../utils/formatDate';

interface ProfilePrivacyAndConsentProps {
  visibility: PublicFieldVisibility;
  onToggleVisibility: (key: keyof PublicFieldVisibility) => void;
  isMinor: boolean;
  onChangeIsMinor: (value: boolean) => void;
  guardianAuthorizationNote?: string;
  emailNotifications: boolean;
  onChangeEmailNotifications: (value: boolean) => void;
  habeasDataAccepted: boolean;
  habeasDataAcceptedAt?: string;
  onChangeHabeasData: (value: boolean) => void;
}

const VISIBILITY_SWITCHES: { key: keyof PublicFieldVisibility; label: string; desc: string }[] = [
  { key: 'photo', label: 'Fotografía de perfil', desc: 'Imagen cuadrada en directorio y ficha.' },
  { key: 'featuredQuote', label: 'Frase destacada', desc: 'Cita breve en tarjeta y cabecera.' },
  { key: 'shortBio', label: 'Reseña corta', desc: 'Resumen visible en el directorio.' },
  { key: 'fullBio', label: 'Biografía completa', desc: 'Trayectoria detallada en tu ficha.' },
  { key: 'education', label: 'Formación / ocupación', desc: 'Estudios u ocupación juvenil.' },
  { key: 'motivation', label: 'Motivación', desc: 'Por qué integras el CMJ Flandes.' },
  { key: 'proposals', label: 'Propuestas de trabajo', desc: 'Agenda y planteamientos prioritarios.' },
  { key: 'workAxes', label: 'Ejes de trabajo', desc: 'Etiquetas temáticas de gestión.' },
  { key: 'achievements', label: 'Logros e hitos', desc: 'Resultados publicados por año.' },
  { key: 'skills', label: 'Habilidades e intereses', desc: 'Fortalezas de trabajo juvenil.' },
  { key: 'projects', label: 'Proyectos vinculados', desc: 'Iniciativas del CMJ en las que participas.' },
  { key: 'socials', label: 'Redes sociales', desc: 'Enlaces verificados en tu ficha pública.' },
  { key: 'publicEmail', label: 'Correo público opcional', desc: 'Solo el correo alternativo de contacto.' },
];

export function ProfilePrivacyAndConsent({
  visibility,
  onToggleVisibility,
  isMinor,
  onChangeIsMinor,
  guardianAuthorizationNote,
  emailNotifications,
  onChangeEmailNotifications,
  habeasDataAccepted,
  habeasDataAcceptedAt,
  onChangeHabeasData,
}: ProfilePrivacyAndConsentProps) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-stone-200 bg-[#FAF8F4] p-4 dark:border-slate-800 dark:bg-slate-950/60">
        <div className="flex items-start gap-2.5">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#7B1832] dark:text-[#E5C158]" aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold tracking-wider text-stone-700 uppercase dark:text-slate-300">
              Visible en el directorio público (si el interruptor está activado)
            </p>
            <p className="mt-0.5 text-xs text-stone-500 dark:text-slate-400">
              Los campos desactivados se omiten físicamente de la colección pública al aprobarse tu ficha.
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {VISIBILITY_SWITCHES.map((item) => {
            const active = Boolean(visibility[item.key]);
            return (
              <div
                key={item.key}
                className="flex items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-stone-900 dark:text-white">{item.label}</p>
                  <p className="text-[11px] text-stone-500 dark:text-slate-400">{item.desc}</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={active}
                  aria-label={`Mostrar ${item.label} en directorio público`}
                  onClick={() => onToggleVisibility(item.key)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7B1832] ${
                    active
                      ? 'border-[#7B1832] bg-[#7B1832] dark:border-[#C59B27] dark:bg-[#C59B27]'
                      : 'border-stone-300 bg-stone-200 dark:border-slate-600 dark:bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow-xs transition-transform ${
                      active ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4 text-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-2.5">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#1E3A8A] dark:text-blue-400" aria-hidden="true" />
          <div>
            <p className="font-semibold text-stone-950 dark:text-white">
              Datos de uso exclusivamente interno (nunca públicos)
            </p>
            <p className="mt-1 leading-relaxed text-stone-600 dark:text-slate-300">
              Tu correo personal de acceso, contraseña, teléfono, documento de identidad, dirección y actas internas de autorización jamás se copian ni se muestran en el portal ciudadano.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 text-xs">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div>
            <p className="font-semibold text-stone-900 dark:text-white">
              Notificaciones institucionales por correo
            </p>
            <p className="mt-0.5 text-[11px] text-stone-500 dark:text-slate-400">
              Recibir avisos sobre sesiones, aprobaciones de cuenta y estado de tu ficha.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={emailNotifications}
            aria-label="Recibir notificaciones por correo electrónico"
            onClick={() => onChangeEmailNotifications(!emailNotifications)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors ${
              emailNotifications
                ? 'border-[#7B1832] bg-[#7B1832] dark:border-[#C59B27] dark:bg-[#C59B27]'
                : 'border-stone-300 bg-stone-200 dark:border-slate-600 dark:bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow-xs transition-transform ${
                emailNotifications ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-stone-900 dark:text-white">
                Consejero o consejera menor de 18 años
              </p>
              <p className="mt-0.5 text-[11px] text-stone-500 dark:text-slate-400">
                Ley de Infancia y Adolescencia: requiere autorización del acudiente registrada por la Mesa Directiva para publicar ficha.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isMinor}
              aria-label="Declarar que soy menor de 18 años"
              onClick={() => onChangeIsMinor(!isMinor)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors ${
                isMinor
                  ? 'border-[#7B1832] bg-[#7B1832] dark:border-[#C59B27] dark:bg-[#C59B27]'
                  : 'border-stone-300 bg-stone-200 dark:border-slate-600 dark:bg-slate-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow-xs transition-transform ${
                  isMinor ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {isMinor && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-semibold">Autorización de acudiente (registro interno de Mesa Directiva)</p>
                <p className="mt-0.5">
                  {guardianAuthorizationNote?.trim()
                    ? `Constancia registrada (confidencial): ${guardianAuthorizationNote}`
                    : 'Pendiente: solicita a la Mesa Directiva registrar el radicado o acta de autorización de tu acudiente antes de aprobar tu publicación.'}
                </p>
              </div>
            </div>
          )}
        </div>

        <label
          htmlFor="profile-habeas-checkbox"
          className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 bg-[#FAF8F4] p-4 text-stone-800 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200"
        >
          <input
            id="profile-habeas-checkbox"
            type="checkbox"
            checked={habeasDataAccepted}
            onChange={(e) => onChangeHabeasData(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#7B1832]"
          />
          <div>
            <p className="leading-relaxed">
              <strong>Consentimiento Habeas Data (Ley 1581 de 2012):</strong> Autorizo al Consejo Municipal de Juventud de Flandes, Tolima para tratar y publicar únicamente los campos marcados arriba durante el periodo constitucional 2026–2029.
            </p>
            {habeasDataAccepted && habeasDataAcceptedAt && (
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Consentimiento registrado el {formatFirestoreDate(habeasDataAcceptedAt)}</span>
              </p>
            )}
          </div>
        </label>
      </div>
    </div>
  );
}

