import { FormEvent, useState } from 'react';
import { addDocumentNewVersion, fetchDocumentVersions } from '../../services/documentsService';
import { uploadFileToFirebaseStorage } from '../../services/storageService';
import { DocumentVersion, InstitutionalDocument, UserProfile } from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { StorageDownloadButton, useResolvedStorageUrl } from '../../components/ui/StorageFileActions';

interface DocumentModalsProps {
  actor: UserProfile;
  canCreate: boolean;
  previewDoc: InstitutionalDocument | null;
  onClosePreview: () => void;
  versionsDoc: InstitutionalDocument | null;
  versionsList: DocumentVersion[];
  onVersionsUpdated: (list: DocumentVersion[]) => void;
  onCloseVersions: () => void;
  onReload: () => Promise<void>;
}

export function DocumentModals({
  actor,
  canCreate,
  previewDoc,
  onClosePreview,
  versionsDoc,
  versionsList,
  onVersionsUpdated,
  onCloseVersions,
  onReload,
}: DocumentModalsProps) {
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [changelog, setChangelog] = useState('');
  const [uploading, setUploading] = useState(false);

  const { url: previewUrl, loading: loadingPreview, errorMsg: previewError } =
    useResolvedStorageUrl(previewDoc, true);

  const handleUploadNewVersion = async (e: FormEvent) => {
    e.preventDefault();
    if (!versionsDoc || !newVersionFile) return;
    setUploading(true);
    try {
      const uploaded = await uploadFileToFirebaseStorage(
        newVersionFile,
        versionsDoc.visibility,
        'documents',
      );
      await addDocumentNewVersion(actor, versionsDoc, {
        ...uploaded,
        changelog,
        nextStatus: versionsDoc.status,
        nextVisibility: versionsDoc.visibility,
      });
      setNewVersionFile(null);
      setChangelog('');
      const updated = await fetchDocumentVersions(versionsDoc.id);
      onVersionsUpdated(updated);
      await onReload();
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Modal
        open={Boolean(previewDoc)}
        onClose={onClosePreview}
        title={previewDoc?.title || 'Visor documental'}
        maxWidth="xl"
      >
        {previewDoc && (
          <div className="space-y-4">
            <p className="text-xs text-stone-500 dark:text-slate-400">
              {previewDoc.fileName} · Versión {previewDoc.currentVersion}
            </p>
            {loadingPreview && (
              <p className="text-xs text-stone-500 dark:text-slate-400">
                Generando acceso seguro desde Firebase Storage…
              </p>
            )}
            {previewError && (
              <p role="alert" className="text-xs font-medium text-red-700 dark:text-red-400">
                {previewError}
              </p>
            )}
            {previewUrl &&
              (previewDoc.fileMime === 'application/pdf' ? (
                <iframe
                  title={previewDoc.title}
                  src={previewUrl}
                  className="h-[65vh] w-full rounded-lg border border-stone-200 dark:border-slate-700"
                />
              ) : previewDoc.fileMime.startsWith('image/') ? (
                <img
                  src={previewUrl}
                  alt={previewDoc.title}
                  className="max-h-[65vh] w-full rounded-lg border border-stone-200 object-contain dark:border-slate-700"
                />
              ) : previewDoc.fileMime.startsWith('video/') ? (
                <video
                  src={previewUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="max-h-[65vh] w-full rounded-lg border border-stone-200 bg-slate-950 dark:border-slate-700"
                />
              ) : (
                <div className="rounded-lg border border-stone-200 p-6 text-center dark:border-slate-700">
                  <p className="text-sm text-stone-600 dark:text-slate-300">
                    Los archivos Office ({previewDoc.fileName}) se descargan directamente para su apertura segura.
                  </p>
                  <div className="mt-4 flex justify-center">
                    <StorageDownloadButton item={previewDoc} label="Descargar archivo" />
                  </div>
                </div>
              ))}
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(versionsDoc)}
        onClose={onCloseVersions}
        title={`Versiones · ${versionsDoc?.title || ''}`}
      >
        {versionsDoc && (
          <div className="space-y-5">
            {canCreate && (
              <form
                onSubmit={handleUploadNewVersion}
                className="space-y-3 border-b border-stone-200 pb-4 dark:border-slate-800"
              >
                <Input
                  label="Nota de cambio"
                  required
                  maxLength={500}
                  value={changelog}
                  onChange={(e) => setChangelog(e.target.value)}
                  placeholder="Ej. Corrección de observaciones de plenaria"
                />
                <input
                  type="file"
                  required
                  accept=".pdf,.docx,.xlsx,.pptx,image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
                  onChange={(e) => setNewVersionFile(e.target.files?.[0] || null)}
                  className="block text-xs text-stone-600 dark:text-slate-300"
                />
                <Button type="submit" size="sm" loading={uploading}>
                  Cargar nueva versión
                </Button>
              </form>
            )}
            <ul className="space-y-2">
              {versionsList.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between rounded-lg border border-stone-200 px-3.5 py-2.5 text-xs dark:border-slate-700"
                >
                  <div>
                    <p className="font-semibold text-stone-900 dark:text-white">
                      Versión {v.versionNumber} · {v.fileName}
                    </p>
                    <p className="text-stone-500 dark:text-slate-400">
                      {v.uploadedByName} · {v.changelog || 'Sin nota'}
                    </p>
                  </div>
                  <StorageDownloadButton
                    compact
                    item={{
                      fileId: v.fileId,
                      storagePath: v.storagePath,
                      downloadUrl: v.downloadUrl,
                      visibility: versionsDoc.visibility,
                      fileName: v.fileName,
                    }}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </>
  );
}
