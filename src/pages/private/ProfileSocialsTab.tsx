import { ExternalLink, Mail } from 'lucide-react';
import { CounselorSocialLinks } from '../../types/models';
import { normalizeAndValidateSocialUrl, SOCIAL_PLATFORMS } from '../../utils/socialLinks';
import { Input } from '../../components/ui/Input';
import { SocialBrandIcon } from '../../components/ui/SocialBrandIcon';

interface ProfileSocialsTabProps {
  socials: CounselorSocialLinks;
  onChangeSocials: (next: CounselorSocialLinks) => void;
  publicEmail: string;
  onChangePublicEmail: (value: string) => void;
}

const PUBLIC_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function ProfileSocialsTab({
  socials,
  onChangeSocials,
  publicEmail,
  onChangePublicEmail,
}: ProfileSocialsTabProps) {
  const emailTrimmed = publicEmail.trim();
  const emailInvalid = emailTrimmed.length > 0 && !PUBLIC_EMAIL_REGEX.test(emailTrimmed);

  const handleBlurNormalize = (key: keyof CounselorSocialLinks) => {
    const raw = socials[key] || '';
    const checked = normalizeAndValidateSocialUrl(key, raw);
    if (checked.valid && checked.normalizedUrl && checked.normalizedUrl !== raw) {
      onChangeSocials({ ...socials, [key]: checked.normalizedUrl });
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-stone-200 bg-[#FAF8F4] p-4 dark:border-slate-800 dark:bg-slate-950/60">
        <p className="text-xs font-semibold tracking-wider text-stone-700 uppercase dark:text-slate-300">
          Redes sociales y enlaces verificados
        </p>
        <p className="mt-1 text-xs leading-relaxed text-stone-500 dark:text-slate-400">
          Puedes escribir solo tu <strong>@usuario</strong> o pegar la dirección completa. Al salir del campo se normaliza a <code>https://</code> automáticamente.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {SOCIAL_PLATFORMS.map((platform) => {
            const val = socials[platform.key] || '';
            const check = normalizeAndValidateSocialUrl(platform.key, val);
            const hasUrl = val.trim().length > 0 && check.valid && check.normalizedUrl;

            return (
              <div key={platform.key} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <label
                    htmlFor={`profile-social-${platform.key}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-800 dark:text-slate-200"
                  >
                    <SocialBrandIcon
                      platform={platform.key}
                      className="h-3.5 w-3.5 text-[#7B1832] dark:text-[#E5C158]"
                    />
                    <span>{platform.label}</span>
                  </label>
                  {hasUrl && (
                    <a
                      href={check.normalizedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#1E3A8A] hover:underline dark:text-blue-400"
                    >
                      <span>Probar enlace</span>
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    </a>
                  )}
                </div>

                <input
                  id={`profile-social-${platform.key}`}
                  type="text"
                  value={val}
                  onChange={(e) => onChangeSocials({ ...socials, [platform.key]: e.target.value })}
                  onBlur={() => handleBlurNormalize(platform.key)}
                  placeholder={platform.placeholder}
                  aria-invalid={!check.valid}
                  className={`min-h-[42px] w-full rounded-lg border bg-white px-3 py-2 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none dark:bg-slate-900 dark:text-slate-100 ${
                    !check.valid
                      ? 'border-red-500 focus:border-red-600'
                      : 'border-stone-300 focus:border-[#7B1832] dark:border-slate-700 dark:focus:border-[#D9B245]'
                  }`}
                />

                {!check.valid ? (
                  <p role="alert" className="text-[11px] font-medium text-red-700 dark:text-red-400">
                    {check.error}
                  </p>
                ) : (
                  <p className="text-[11px] text-stone-500 dark:text-slate-400">
                    {hasUrl ? `Enlace listo: ${check.normalizedUrl}` : platform.exampleHint}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-stone-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-2.5">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-[#7B1832] dark:text-[#E5C158]" aria-hidden="true" />
          <div className="min-w-0 flex-1 space-y-2">
            <Input
              id="profile-public-email"
              label="Correo público de contacto ciudadano (opcional)"
              type="email"
              value={publicEmail}
              onChange={(e) => onChangePublicEmail(e.target.value)}
              placeholder="contacto.comision@flandes-ejemplo.org"
              error={emailInvalid ? 'Formato de correo inválido.' : undefined}
              hint="Nunca pongas tu correo personal si no deseas mostrarlo; este campo solo se publica si activas su interruptor en Privacidad."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
