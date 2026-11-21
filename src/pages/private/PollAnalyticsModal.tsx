import { useEffect, useState } from 'react';
import { Download, FileSpreadsheet, QrCode, Share2 } from 'lucide-react';
import QRCode from 'qrcode';
import { PublicPoll } from '../../types/participation';
import {
  buildPollShareUrl,
  exportPollResultsCsv,
  exportPollResultsExcel,
  exportPollResultsPdf,
  getEffectivePollQuestions,
  getPollTotalResponses,
} from '../../utils/participationExport';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { WhatsAppShareButton } from '../../components/ui/WhatsAppShareButton';

interface PollAnalyticsModalProps {
  poll: PublicPoll | null;
  onClose: () => void;
}

export function PollAnalyticsModal({ poll, onClose }: PollAnalyticsModalProps) {
  const { showToast } = useToast();
  const [questionFilter, setQuestionFilter] = useState<string>('all');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    setQuestionFilter('all');
    if (!poll) {
      setQrDataUrl('');
      return;
    }
    const url = buildPollShareUrl(poll.id);
    void QRCode.toDataURL(url, { width: 160, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [poll]);

  if (!poll) return null;

  const questions = getEffectivePollQuestions(poll);
  const visibleQuestions =
    questionFilter === 'all' ? questions : questions.filter((q) => q.id === questionFilter);
  const totalParticipants = getPollTotalResponses(poll);
  const shareUrl = buildPollShareUrl(poll.id);

  return (
    <Modal open={Boolean(poll)} onClose={onClose} title={`Resultados: ${poll.title}`}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-stone-200 bg-[#FAF8F4] px-3.5 py-2.5 text-xs dark:border-slate-800 dark:bg-slate-900">
          <span>
            Total de participaciones reales:{' '}
            <strong className="font-mono-tabular text-sm text-[#7B1832] dark:text-[#D9B245]">
              {totalParticipants}
            </strong>
          </span>
          {questions.length > 1 && (
            <select
              aria-label="Filtrar por pregunta"
              value={questionFilter}
              onChange={(e) => setQuestionFilter(e.target.value)}
              className="rounded border border-stone-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="all">Todas las preguntas ({questions.length})</option>
              {questions.map((q, i) => (
                <option key={q.id} value={q.id}>
                  P{i + 1}. {q.prompt.slice(0, 42)}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="max-h-72 space-y-4 overflow-y-auto pr-1">
          {visibleQuestions.map((q, idx) => {
            const qTotal = q.options.reduce((s, o) => s + (o.votes || 0), 0);
            return (
              <div key={q.id} className="space-y-2 rounded-xl border border-stone-200 p-3 dark:border-slate-800">
                <p className="text-xs font-semibold text-stone-900 dark:text-white">
                  {idx + 1}. {q.prompt}
                </p>
                {q.type === 'short_text' ? (
                  (q.textResponses || []).length === 0 ? (
                    <p className="text-xs text-stone-500">Sin respuestas abiertas registradas aún.</p>
                  ) : (
                    <ul className="space-y-1 text-xs text-stone-700 dark:text-slate-300">
                      {(q.textResponses || []).map((txt, tIdx) => (
                        <li key={tIdx} className="rounded bg-stone-50 px-2.5 py-1 dark:bg-slate-900/70">
                          “{txt}”
                        </li>
                      ))}
                    </ul>
                  )
                ) : (
                  q.options.map((opt) => {
                    const pct = qTotal > 0 ? Math.round(((opt.votes || 0) / qTotal) * 100) : 0;
                    return (
                      <div key={opt.id} className="space-y-1 text-xs">
                        <div className="flex justify-between gap-2">
                          <span className="text-stone-800 dark:text-slate-200">{opt.label}</span>
                          <span className="font-mono-tabular font-semibold text-[#7B1832] dark:text-[#D9B245]">
                            {pct}% ({opt.votes || 0})
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-slate-800">
                          <div className="h-full bg-[#7B1832] dark:bg-[#D9B245]" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-stone-200 pt-3 dark:border-slate-800">
          <Button size="sm" variant="outline" onClick={() => exportPollResultsCsv(poll)}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>CSV</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => void exportPollResultsExcel(poll)}>
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            <span>Excel</span>
          </Button>
          <Button size="sm" variant="outline" onClick={() => void exportPollResultsPdf(poll)}>
            <Download className="h-3.5 w-3.5 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
            <span>PDF</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard?.writeText(shareUrl);
              showToast('Enlace de la encuesta copiado al portapapeles.', 'success');
            }}
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Copiar enlace</span>
          </Button>
          <WhatsAppShareButton text={`Participa en la consulta CMJ Flandes: ${poll.title}`} url={shareUrl} />
        </div>

        {qrDataUrl && (
          <div className="flex items-center gap-3 rounded-lg border border-stone-200 bg-[#FAF8F4] p-2.5 text-xs dark:border-slate-800 dark:bg-slate-900">
            <img src={qrDataUrl} alt={`QR de encuesta ${poll.title}`} className="h-16 w-16 rounded border border-stone-200" />
            <div>
              <p className="inline-flex items-center gap-1 font-semibold text-stone-900 dark:text-white">
                <QrCode className="h-3.5 w-3.5 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
                Código QR para difusión en cabildos y colegios
              </p>
              <p className="mt-0.5 text-stone-500">Escanea para responder directamente desde el celular.</p>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
