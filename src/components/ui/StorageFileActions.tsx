import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { resolveDocumentAccessUrl } from '../../services/storageService';
import { Button } from './Button';

interface StorageResourceRef {
  fileId?: string;
  storagePath?: string;
  downloadUrl?: string;
  visibility?: 'publico' | 'interno';
  fileName?: string;
}

export function useResolvedStorageUrl(item: StorageResourceRef | null, inline = true) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!item) {
      setUrl(null);
      setErrorMsg(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);

    void resolveDocumentAccessUrl(item, inline)
      .then((resolved) => {
        if (!cancelled) setUrl(resolved);
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMsg(
            err instanceof Error ? err.message : 'No fue posible cargar el documento.',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [item, inline]);

  return { url, loading, errorMsg };
}

export function StorageDownloadButton({
  item,
  label = 'Descargar',
  compact = false,
}: {
  item: StorageResourceRef;
  label?: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    setBusy(true);
    try {
      const targetUrl = await resolveDocumentAccessUrl(item, false);
      const a = document.createElement('a');
      a.href = targetUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      if (item.fileName) {
        a.download = item.fileName;
      }
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={busy}
        className="inline-flex items-center gap-1 text-xs font-medium text-[#7B1832] hover:underline disabled:opacity-60 dark:text-[#D9B245]"
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{busy ? 'Abriendo…' : label}</span>
      </button>
    );
  }

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      loading={busy}
      onClick={() => void handleDownload()}
    >
      <Download className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{label}</span>
    </Button>
  );
}
