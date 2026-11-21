import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { History, Save } from 'lucide-react';
import {
  fetchSiteAppearanceVersions,
  saveSiteAppearanceOnServer,
} from '../../services/siteContentService';
import { UserProfile } from '../../types/models';
import { SiteAppearanceConfig, SiteAppearanceVersion } from '../../types/siteContent';
import { MediaStudioModal, MediaStudioResult } from '../../components/media/MediaStudioModal';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Select } from '../../components/ui/Input';
import { Tabs } from '../../components/ui/Tabs';
import { SeasonalThemeCustomizer } from './SeasonalThemeCustomizer';
import { AppearanceImageField, SiteAppearancePhotosTab } from './SiteAppearancePhotosTab';
import { SiteAppearanceVersionsModal } from './SiteAppearanceVersionsModal';

interface SiteAppearancePanelProps {
  actor?: UserProfile;
  currentContent: SiteAppearanceConfig;
  onUpdated: () => Promise<void>;
}

export function SiteAppearancePanel({
  actor,
  currentContent,
  onUpdated,
}: SiteAppearancePanelProps) {
  const [subTab, setSubTab] = useState<'fotos' | 'temas'>('fotos');
  const [form, setForm] = useState<SiteAppearanceConfig>(currentContent);
  const [studioTarget, setStudioTarget] = useState<{
    field: AppearanceImageField;
    file: File | null;
    existingUrl?: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [versions, setVersions] = useState<SiteAppearanceVersion[]>([]);
  const [versionsOpen, setVersionsOpen] = useState(false);

  const loadVersions = async () => {
    setVersions(await fetchSiteAppearanceVersions());
  };

  useEffect(() => {
    void loadVersions();
  }, []);

  const handleFileChosen = (field: AppearanceImageField, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg(null);
    setNotice(null);
    setStudioTarget({ field, file });
  };

  const handleStudioComplete = (result: MediaStudioResult) => {
    if (!studioTarget) return;
    setForm((prev) => ({ ...prev, [studioTarget.field]: result.url }));
    setNotice('Fotografía ajustada y cargada. Guarda para publicar o mantener en borrador.');
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    setNotice(null);
    try {
      const saved = await saveSiteAppearanceOnServer(
        form,
        actor ? { uid: actor.uid, displayName: actor.displayName } : undefined,
        form.publishStatus === 'borrador' ? 'Borrador del portal' : 'Publicación oficial del portal',
      );
      setForm(saved);
      await Promise.all([onUpdated(), loadVersions()]);
      setNotice(
        form.publishStatus === 'borrador'
          ? 'Cambios respaldados en estado borrador e historial.'
          : 'Fotografías, textos accesibles y temas publicados correctamente.',
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudieron guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-[#7B1832] uppercase dark:text-[#D9B245]">
              Edición de Portal (Secretario Admin, Presidente y Vicepresidente)
            </p>
            <h2 className="mt-1 font-display text-xl font-semibold text-stone-950 dark:text-white">
              Fotografías, textos accesibles y temas de temporada
            </h2>
          </div>
          <Button size="sm" variant="outline" onClick={() => setVersionsOpen(true)}>
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Historial ({versions.length})</span>
          </Button>
        </div>

        <div className="mt-4">
          <Tabs
            ariaLabel="Secciones de apariencia del portal"
            activeId={subTab}
            onChange={setSubTab}
            options={[
              { id: 'fotos', label: 'Fotografías y textos' },
              { id: 'temas', label: 'Temas de temporada (Tolima y Flandes)' },
            ]}
          />
        </div>

        <form onSubmit={handleSave} className="mt-6 space-y-6">
          {subTab === 'temas' ? (
            <SeasonalThemeCustomizer form={form} onChange={setForm} />
          ) : (
            <SiteAppearancePhotosTab
              form={form}
              onChange={setForm}
              onFileChosen={handleFileChosen}
              onOpenStudio={(field, existingUrl) => setStudioTarget({ field, file: null, existingUrl })}
            />
          )}

          {notice && <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{notice}</p>}
          {errorMsg && <p className="text-xs font-medium text-red-700 dark:text-red-400">{errorMsg}</p>}

          <div className="flex flex-wrap items-end justify-between gap-3 border-t border-stone-200 pt-4 dark:border-slate-800">
            <div className="w-48">
              <Select
                label="Estado de guardado"
                value={form.publishStatus || 'publicado'}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    publishStatus: e.target.value as 'borrador' | 'publicado',
                  }))
                }
              >
                <option value="publicado">Publicado en vivo</option>
                <option value="borrador">Borrador de trabajo</option>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {currentContent.updatedByName && (
                <span className="text-xs text-stone-500 dark:text-slate-400">
                  Última edición: {currentContent.updatedByName}
                </span>
              )}
              <Button type="submit" loading={saving}>
                <Save className="h-4 w-4" aria-hidden="true" />
                <span>Guardar cambios en el portal</span>
              </Button>
            </div>
          </div>
        </form>
      </Card>

      <MediaStudioModal
        open={Boolean(studioTarget)}
        file={studioTarget?.file || null}
        existingImageUrl={studioTarget?.existingUrl}
        visibility="publico"
        title="Editar fotografía institucional"
        onClose={() => setStudioTarget(null)}
        onComplete={handleStudioComplete}
      />

      <SiteAppearanceVersionsModal
        open={versionsOpen}
        versions={versions}
        onRestore={(snapshot, label) => {
          setForm(snapshot);
          setVersionsOpen(false);
          setNotice(`Versión "${label}" cargada en el editor. Presiona Guardar para aplicarla.`);
        }}
        onClose={() => setVersionsOpen(false)}
      />
    </>
  );
}
