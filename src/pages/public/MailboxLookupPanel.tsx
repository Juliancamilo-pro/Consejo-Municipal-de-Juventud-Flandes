import { FormEvent, useState } from 'react';
import { Search } from 'lucide-react';
import { lookupMailboxByCode } from '../../services/publicService';
import { MailboxTrackingPublic } from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { StatusText } from '../../components/ui/StatusText';

interface MailboxLookupPanelProps {
  initialCode?: string;
}

export function MailboxLookupPanel({ initialCode = '' }: MailboxLookupPanelProps) {
  const [queryCode, setQueryCode] = useState(initialCode);
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<MailboxTrackingPublic | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleLookup = async (e: FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    setSearchResult(null);
    setSearching(true);
    try {
      const found = await lookupMailboxByCode(queryCode);
      if (!found) {
        setSearchError(
          'No se encontró un radicado con ese código. Verifica el formato PJ-FLA-AAAA-XXXX.',
        );
      } else {
        setSearchResult(found);
      }
    } catch (err) {
      setSearchError(
        err instanceof Error ? err.message : 'Error al consultar el código.',
      );
    } finally {
      setSearching(false);
    }
  };

  return (
    <Card>
      <form onSubmit={handleLookup} className="space-y-4">
        <Input
          label="Código de seguimiento"
          value={queryCode}
          onChange={(e) => setQueryCode(e.target.value.toUpperCase())}
          placeholder="PJ-FLA-2026-XXXX"
          hint="Ingresa el código asignado al momento de radicar."
          required
        />
        <Button type="submit" loading={searching}>
          <Search className="h-4 w-4" aria-hidden="true" />
          <span>Consultar estado</span>
        </Button>
      </form>

      {searchError && (
        <p role="alert" className="mt-4 text-sm font-medium text-red-700 dark:text-red-400">
          {searchError}
        </p>
      )}

      {searchResult && (
        <div className="mt-6 border-t border-stone-200 pt-5 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono-tabular text-sm font-semibold text-stone-900 dark:text-white">
              {searchResult.trackingCode}
            </span>
            <StatusText
              label={`Estado: ${searchResult.status.replace('_', ' ')}`}
              tone={searchResult.status === 'respondido' ? 'success' : 'info'}
            />
          </div>
          <p className="mt-2 text-xs text-stone-500 dark:text-slate-400">
            Categoría: <span className="capitalize">{searchResult.category}</span>
          </p>
          <div className="mt-4 rounded-lg border border-stone-200 bg-[#FAFAF8] p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <p className="text-xs font-medium text-stone-500 dark:text-slate-400">
              Respuesta oficial
            </p>
            <p className="mt-1 whitespace-pre-line text-sm text-stone-800 dark:text-slate-200">
              {searchResult.officialResponse ||
                'Tu radicado se encuentra en trámite. Aún no se ha emitido respuesta oficial.'}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
