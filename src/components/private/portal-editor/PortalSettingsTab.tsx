import React, { useEffect, useState } from 'react';
import { ImageOff, Palette, Sparkles } from 'lucide-react';
import { apiRequest } from '../../../lib/apiClient';
import { FESTIVE_THEMES } from '../../../lib/seedData';
import { deleteStorageFile } from '../../../lib/storageUtils';
import type { FestiveThemeId, PortalSettings, RoleLabel } from '../../../types/cmj';
import { MediaUploader, type UploadedFileInfo } from '../../MediaUploader';
import { useToast } from '../../ToastProvider';
import { recordAudit } from '../auditHelper';

export function PortalSettingsTab({
  uid,
  actorName,
  actorRoleLabel,
  settings,
}: {
  uid: string;
  actorName: string;
  actorRoleLabel: RoleLabel;
  settings: PortalSettings;
}) {
  const { showToast } = useToast();

  const [heroTitle, setHeroTitle] = useState(settings.heroTitle);
  const [heroSubtitle, setHeroSubtitle] = useState(settings.heroSubtitle);
  const [aboutText, setAboutText] = useState(settings.aboutText || '');
  const [missionText, setMissionText] = useState(settings.missionText || '');
  const [visionText, setVisionText] = useState(settings.visionText || '');
  const [contactEmail, setContactEmail] = useState(settings.contactEmail || '');
  const [contactAddress, setContactAddress] = useState(settings.contactAddress || '');
  const [activeTheme, setActiveTheme] = useState<FestiveThemeId>(settings.activeTheme);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    setHeroTitle(settings.heroTitle);
    setHeroSubtitle(settings.heroSubtitle);
    setAboutText(settings.aboutText || '');
    setMissionText(settings.missionText || '');
    setVisionText(settings.visionText || '');
    setContactEmail(settings.contactEmail || '');
    setContactAddress(settings.contactAddress || '');
    setActiveTheme(settings.activeTheme);
  }, [settings]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await apiRequest('/api/portal-settings', {
        method: 'PUT',
        body: {
          heroTitle: heroTitle.trim(),
          heroSubtitle: heroSubtitle.trim(),
          heroImageUrl: settings.heroImageUrl || '',
          heroStoragePath: settings.heroStoragePath || '',
          aboutText: aboutText.trim(),
          missionText: missionText.trim(),
          visionText: visionText.trim(),
          contactEmail: contactEmail.trim(),
          contactAddress: contactAddress.trim(),
          activeTheme,
        },
      });
      await recordAudit({
        uid,
        actorName,
        actorRoleLabel,
        action: 'Actualizó configuración del portal público',
        module: 'Editor del Portal',
        targetTitle: `Tema ${activeTheme}`,
      });
      showToast('Portal público actualizado', 'success');
    } catch {
      showToast('No se pudieron guardar los cambios', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleHeroUpload = async (files: UploadedFileInfo[]) => {
    const f = files[0];
    if (!f) return;
    try {
      if (settings.heroStoragePath) {
        await deleteStorageFile(settings.heroStoragePath, settings.heroImageUrl);
      }
      await apiRequest('/api/portal-settings', {
        method: 'PUT',
        body: {
          heroImageUrl: f.url,
          heroStoragePath: f.storagePath || '',
        },
      });
      showToast('Portada del portal actualizada', 'success');
    } catch {
      showToast('No se pudo actualizar la portada', 'error');
    }
  };

  const handleRemoveHeroImage = async () => {
    try {
      if (settings.heroStoragePath || settings.heroImageUrl) {
        await deleteStorageFile(settings.heroStoragePath, settings.heroImageUrl);
      }
      await apiRequest('/api/portal-settings', {
        method: 'PUT',
        body: {
          heroImageUrl: '',
          heroStoragePath: '',
        },
      });
      showToast('Imagen de portada retirada', 'info');
    } catch {
      showToast('No se pudo retirar la portada', 'error');
    }
  };

  return (
    <form onSubmit={handleSaveSettings} className="cmj-card p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Palette className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Identidad, Temas Festivos y Portada Pública
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {FESTIVE_THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTheme(t.id)}
            className={`rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
              activeTheme === t.id
                ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-950/30'
                : 'border-slate-200 dark:border-slate-800'
            }`}
          >
            <div className={`h-2.5 w-full rounded-full bg-gradient-to-r ${t.accentGradient} mb-2`} />
            <p className="text-xs font-bold text-slate-900 dark:text-white">{t.name}</p>
            <p className="text-[11px] text-slate-500">{t.subtitle}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          type="text"
          required
          value={heroTitle}
          onChange={(e) => setHeroTitle(e.target.value)}
          placeholder="Título principal del portal"
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
        />
        <input
          type="text"
          required
          value={heroSubtitle}
          onChange={(e) => setHeroSubtitle(e.target.value)}
          placeholder="Subtítulo"
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2.5 text-sm"
        />
        <textarea
          rows={2}
          value={aboutText}
          onChange={(e) => setAboutText(e.target.value)}
          placeholder="¿Qué es el CMJ Flandes?"
          className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
        />
        <textarea
          rows={2}
          value={missionText}
          onChange={(e) => setMissionText(e.target.value)}
          placeholder="Misión"
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
        />
        <textarea
          rows={2}
          value={visionText}
          onChange={(e) => setVisionText(e.target.value)}
          placeholder="Visión"
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
        />
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="Correo público de contacto"
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
        />
        <input
          type="text"
          value={contactAddress}
          onChange={(e) => setContactAddress(e.target.value)}
          placeholder="Dirección física / punto de encuentro"
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 text-xs"
        />
      </div>

      <div className="space-y-2">
        {settings.heroImageUrl && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50 dark:bg-slate-950">
            <div className="flex items-center gap-3">
              <img
                src={settings.heroImageUrl}
                alt="Portada actual"
                className="h-14 w-24 rounded-xl object-cover"
              />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Portada institucional actual
              </span>
            </div>
            <button
              type="button"
              onClick={handleRemoveHeroImage}
              className="inline-flex items-center gap-1 rounded-xl border border-rose-200 dark:border-rose-900/50 px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer whitespace-nowrap"
            >
              <ImageOff className="h-3.5 w-3.5" /> Quitar imagen de portada
            </button>
          </div>
        )}
        <MediaUploader
          storageFolder="public/hero"
          imagePreset="cover"
          label="Imagen de portada institucional (opcional)"
          onUploaded={handleHeroUpload}
        />
      </div>

      <button
        type="submit"
        disabled={savingSettings}
        className="min-h-[42px] inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer disabled:opacity-60 whitespace-nowrap"
      >
        <Sparkles className="h-4 w-4" />
        {savingSettings ? 'Guardando...' : 'Guardar configuración pública'}
      </button>
    </form>
  );
}
