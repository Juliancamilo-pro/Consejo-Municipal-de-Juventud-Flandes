import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed || !deferredPrompt) return null;

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  };

  return (
    <button
      type="button"
      onClick={() => void handleInstall()}
      className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-[#7B1832]/30 bg-[#7B1832]/10 px-3.5 py-2 text-xs font-semibold text-[#7B1832] transition-colors hover:bg-[#7B1832]/15 dark:border-[#D9B245]/40 dark:bg-[#C59B27]/15 dark:text-[#E5C158]"
    >
      <Download className="h-3.5 w-3.5" aria-hidden="true" />
      <span>Instalar aplicación (PWA)</span>
    </button>
  );
}
