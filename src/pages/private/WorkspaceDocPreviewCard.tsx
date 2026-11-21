import { FormEvent } from 'react';
import { ExternalLink } from 'lucide-react';
import { GoogleDocSummary } from '../../services/workspaceApi';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Textarea } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';

export type PendingDocAction =
  | { kind: 'create'; title: string; body: string }
  | { kind: 'append'; doc: GoogleDocSummary; text: string }
  | null;

interface WorkspaceDocPreviewProps {
  accessToken: string | null;
  selectedDoc: GoogleDocSummary | null;
  loadingPreview: boolean;
  docPreview: string;
  appendText: string;
  onChangeAppendText: (val: string) => void;
  onRequestAppend: (e: FormEvent) => void;
  pendingAction: PendingDocAction;
  executing: boolean;
  onCloseModal: () => void;
  onConfirmModal: () => Promise<void>;
}

export function WorkspaceDocPreviewAndModal({
  accessToken,
  selectedDoc,
  loadingPreview,
  docPreview,
  appendText,
  onChangeAppendText,
  onRequestAppend,
  pendingAction,
  executing,
  onCloseModal,
  onConfirmModal,
}: WorkspaceDocPreviewProps) {
  return (
    <>
      {selectedDoc && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200 pb-3 dark:border-slate-800">
            <div>
              <p className="text-xs font-medium text-[#1E3A8A] dark:text-[#60A5FA]">
                Vista previa y edición de Google Doc
              </p>
              <h3 className="font-display text-lg font-semibold text-stone-950 dark:text-white">
                {selectedDoc.name}
              </h3>
            </div>
            <a
              href={
                selectedDoc.webViewLink || `https://docs.google.com/document/d/${selectedDoc.id}/edit`
              }
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#7B1832] hover:underline dark:text-[#D9B245]"
            >
              <span>Editar completo en Google Docs</span>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>

          <pre className="mt-4 max-h-60 overflow-y-auto whitespace-pre-wrap rounded-lg border border-stone-200 bg-[#FAFAF8] p-4 font-sans text-xs leading-relaxed text-stone-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200">
            {loadingPreview ? 'Leyendo contenido del documento…' : docPreview}
          </pre>

          <form onSubmit={onRequestAppend} className="mt-4 space-y-3">
            <Textarea
              label="Agregar párrafo o constancia al final del documento"
              required
              rows={3}
              value={appendText}
              onChange={(e) => onChangeAppendText(e.target.value)}
              placeholder="Texto que se insertará al final del Google Doc..."
            />
            <Button type="submit" variant="secondary" disabled={!accessToken}>
              Insertar texto en Google Doc
            </Button>
          </form>
        </Card>
      )}

      <Modal
        open={Boolean(pendingAction)}
        onClose={onCloseModal}
        title="Confirmar acción en Google Docs"
        maxWidth="md"
      >
        {pendingAction && (
          <div className="space-y-4 text-sm text-stone-700 dark:text-slate-300">
            {pendingAction.kind === 'create' ? (
              <p>
                ¿Confirmas crear un nuevo documento en tu cuenta de Google Docs titulado{' '}
                <strong>“{pendingAction.title}”</strong> y registrar su enlace en el portal del CMJ?
              </p>
            ) : (
              <p>
                ¿Confirmas insertar el texto indicado al final del documento de Google Docs{' '}
                <strong>“{pendingAction.doc.name}”</strong>?
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={onCloseModal}>
                Cancelar
              </Button>
              <Button loading={executing} onClick={() => void onConfirmModal()}>
                Confirmar y ejecutar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
