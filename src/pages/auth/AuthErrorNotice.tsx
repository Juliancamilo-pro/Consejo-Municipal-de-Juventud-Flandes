import { AlertTriangle, ShieldAlert } from 'lucide-react';

const FIREBASE_PROVIDERS_URL =
  'https://console.firebase.google.com/project/sixth-bridge-m01dl/authentication/providers';

interface AuthErrorNoticeProps {
  errorMsg: string | null;
  providerDisabledError: boolean;
  successMsg: string | null;
}

export function AuthErrorNotice({
  errorMsg,
  providerDisabledError,
  successMsg,
}: AuthErrorNoticeProps) {
  return (
    <>
      {errorMsg && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs leading-relaxed text-red-900 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
        >
          {providerDisabledError ? (
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-400" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-400" aria-hidden="true" />
          )}
          <div className="space-y-1.5">
            <p className="font-medium">{errorMsg}</p>
            {providerDisabledError && (
              <a
                href={FIREBASE_PROVIDERS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block font-semibold text-[#1E3A8A] underline dark:text-[#93C5FD]"
              >
                Habilitar Correo/Contraseña en Firebase Console (sixth-bridge-m01dl) →
              </a>
            )}
          </div>
        </div>
      )}

      {successMsg && (
        <p
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-medium text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          {successMsg}
        </p>
      )}
    </>
  );
}
