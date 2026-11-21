import { Share2 } from 'lucide-react';

interface WhatsAppShareButtonProps {
  text: string;
  url?: string;
  label?: string;
}

export function WhatsAppShareButton({
  text,
  url,
  label = 'WhatsApp',
}: WhatsAppShareButtonProps) {
  const targetUrl =
    url || (typeof window !== 'undefined' ? window.location.href : 'https://cmj-flandes.app');
  const href = `https://wa.me/?text=${encodeURIComponent(`${text} ${targetUrl}`)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Compartir por WhatsApp: ${text}`}
      className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:border-emerald-400 hover:text-emerald-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-emerald-400"
    >
      <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{label}</span>
    </a>
  );
}
