import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileCheck2,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Share2,
  ShieldCheck,
  Target,
  Trash2,
  UserCheck,
  Vote,
  X,
} from 'lucide-react';
import { ApiRequestError, apiRequest } from '../../lib/apiClient';
import type {
  AchievementCategory,
  AttendanceStatus,
  Commission,
  CouncilorPublicProfileResponse,
  HeartToggleResponse,
  PublicCouncilor,
} from '../../types/cmj';
import { useToast } from '../ToastProvider';
import { VerifiedBadge } from '../VerifiedBadge';
import { SkeletonBlock } from '../ui/AnimatedPrimitives';
import { AvatarBadge } from './AvatarBadge';
import { HeartSupportButton } from './HeartSupportButton';

type ProfileTab = 'logros' | 'metas' | 'asistencias' | 'votaciones';

function buildSocialHref(raw: string | undefined, network: 'instagram' | 'facebook'): string | null {
  const val = (raw || '').trim();
  if (!val) return null;
  if (/^https?:\/\//i.test(val)) return val;
  const cleanHandle = val.replace(/^@+/, '').replace(/^\/+/, '');
  if (!cleanHandle) return null;
  return network === 'instagram'
    ? `https://www.instagram.com/${encodeURIComponent(cleanHandle)}`
    : `https://www.facebook.com/${encodeURIComponent(cleanHandle)}`;
}

function buildWhatsappHref(phone?: string): string | null {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 7) return null;
  const fullNumber = digits.length === 10 && digits.startsWith('3') ? `57${digits}` : digits;
  return `https://wa.me/${fullNumber}`;
}

function buildTelHref(phone?: string): string | null {
  const cleaned = (phone || '').replace(/[^\d+]/g, '');
  return cleaned.length >= 7 ? `tel:${cleaned}` : null;
}

function formatAffiliationLabel(type?: string): string {
  if (type === 'partido') return 'Partido político';
  if (type === 'fundacion') return 'Fundación / Organización';
  if (type === 'independiente') return 'Independiente';
  return '';
}

function categoryLabel(cat: AchievementCategory): string {
  switch (cat) {
    case 'iniciativa':
      return 'Iniciativa';
    case 'proyecto':
      return 'Proyecto';
    case 'reconocimiento':
      return 'Reconocimiento';
    case 'evento':
      return 'Evento';
    default:
      return 'General';
  }
}

function attendanceStatusMeta(status: AttendanceStatus): {
  label: string;
  badgeClass: string;
} {
  switch (status) {
    case 'presente':
      return {
        label: 'Presente',
        badgeClass:
          'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
      };
    case 'tarde':
      return {
        label: 'Tarde',
        badgeClass:
          'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
      };
    case 'excusa':
      return {
        label: 'Excusa',
        badgeClass:
          'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
      };
    default:
      return {
        label: 'Ausente',
        badgeClass:
          'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
      };
  }
}

function AttendanceRingChart({
  percentage,
  totalRecorded,
}: {
  percentage: number;
  totalRecorded: number;
}) {
  const size = 128;
  const strokeWidth = 11;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percentage));
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Porcentaje de asistencia: ${clamped}%`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-slate-200 dark:text-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={totalRecorded > 0 ? strokeDashoffset : circumference}
          className="text-emerald-600 dark:text-emerald-400 transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-mono-num text-2xl font-extrabold text-slate-900 dark:text-white leading-none">
          {totalRecorded > 0 ? `${clamped}%` : '—'}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mt-1">
          Asistencia
        </span>
      </div>
    </div>
  );
}

export function CouncilorProfileModal({
  councilor,
  commissions,
  initialHeartCount,
  initialHearted,
  viewerUid,
  onClose,
  onHeartChange,
}: {
  councilor: PublicCouncilor;
  commissions: Commission[];
  initialHeartCount: number;
  initialHearted: boolean;
  viewerUid?: string | null;
  onClose: () => void;
  onHeartChange: (res: HeartToggleResponse) => void;
}) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<ProfileTab>('logros');
  const [profileData, setProfileData] = useState<CouncilorPublicProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  // Filtro de logros
  const [achFilter, setAchFilter] = useState<'todos' | AchievementCategory>('todos');

  // Formularios rápidos cuando el usuario autenticado gestiona su propio perfil o es Mesa
  const [showAddAchievement, setShowAddAchievement] = useState(false);
  const [achTitle, setAchTitle] = useState('');
  const [achDesc, setAchDesc] = useState('');
  const [achDate, setAchDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [achCat, setAchCat] = useState<AchievementCategory>('iniciativa');
  const [achEvidence, setAchEvidence] = useState('');
  const [savingAch, setSavingAch] = useState(false);

  const [showAddGoal, setShowAddGoal] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalDesc, setGoalDesc] = useState('');
  const [goalStatus, setGoalStatus] = useState<'pendiente' | 'en_curso' | 'hecha'>('en_curso');
  const [goalProgress, setGoalProgress] = useState(40);
  const [goalDueDate, setGoalDueDate] = useState('');
  const [savingGoal, setSavingGoal] = useState(false);

  const targetKey = councilor.uid || councilor.id;

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await apiRequest<CouncilorPublicProfileResponse>(
        `/api/public/councilors/${encodeURIComponent(targetKey)}/profile`,
        { skipRefresh: true }
      );
      setProfileData(data);
    } catch (err) {
      const msg =
        err instanceof ApiRequestError
          ? err.message
          : 'No se pudo cargar el detalle público del consejero.';
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, [targetKey]);

  useEffect(() => {
    setActiveTab('logros');
    setAchFilter('todos');
    setShowAddAchievement(false);
    setShowAddGoal(false);
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const activeCouncilor = profileData?.councilor || councilor;
  const accentColor = commissions.find((cm) => cm.id === activeCouncilor.commissionId)?.accentColor;
  const heartCount = profileData?.hearts.count ?? initialHeartCount;
  const viewerHasHearted = profileData?.hearts.viewerHasHearted ?? initialHearted;
  const isSelf =
    Boolean(viewerUid && viewerUid === activeCouncilor.uid) ||
    profileData?.hearts.canHeart === false;

  const handleHeartToggleResult = (res: HeartToggleResponse) => {
    setProfileData((prev) =>
      prev
        ? {
            ...prev,
            hearts: {
              ...prev.hearts,
              count: res.count,
              viewerHasHearted: res.hearted,
            },
          }
        : prev
    );
    onHeartChange(res);
  };

  const handleCopyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(true);
      window.setTimeout(() => setCopiedEmail(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleCopyShareLink = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}#consejero-${encodeURIComponent(
      activeCouncilor.id
    )}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedShareLink(true);
      showToast('Enlace directo del consejero copiado', 'success');
      window.setTimeout(() => setCopiedShareLink(false), 2000);
    } catch {
      showToast('No fue posible copiar el enlace al portapapeles.', 'error');
    }
  };

  const handleCreateAchievement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (achTitle.trim().length < 3) {
      showToast('Ingresa un título de logro de al menos 3 caracteres.', 'error');
      return;
    }
    setSavingAch(true);
    try {
      await apiRequest(`/api/councilors/${encodeURIComponent(activeCouncilor.uid)}/achievements`, {
        method: 'POST',
        body: {
          title: achTitle.trim(),
          description: achDesc.trim(),
          date: achDate,
          category: achCat,
          evidenceUrl: achEvidence.trim(),
        },
        skipRefresh: true,
      });
      setAchTitle('');
      setAchDesc('');
      setAchEvidence('');
      setShowAddAchievement(false);
      showToast('Logro agregado al perfil público', 'success');
      await fetchProfile();
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Error al guardar logro', 'error');
    } finally {
      setSavingAch(false);
    }
  };

  const handleDeleteAchievement = async (achId: string) => {
    try {
      await apiRequest(
        `/api/councilors/${encodeURIComponent(activeCouncilor.uid)}/achievements/${encodeURIComponent(
          achId
        )}`,
        { method: 'DELETE', skipRefresh: true }
      );
      showToast('Logro eliminado', 'info');
      await fetchProfile();
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Error al eliminar logro', 'error');
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (goalTitle.trim().length < 3) {
      showToast('Ingresa un título de meta de al menos 3 caracteres.', 'error');
      return;
    }
    setSavingGoal(true);
    try {
      await apiRequest(`/api/councilors/${encodeURIComponent(activeCouncilor.uid)}/goals`, {
        method: 'POST',
        body: {
          title: goalTitle.trim(),
          description: goalDesc.trim(),
          status: goalStatus,
          progress: goalStatus === 'hecha' ? 100 : goalProgress,
          dueDate: goalDueDate.trim(),
        },
        skipRefresh: true,
      });
      setGoalTitle('');
      setGoalDesc('');
      setGoalDueDate('');
      setShowAddGoal(false);
      showToast('Meta agregada al perfil público', 'success');
      await fetchProfile();
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Error al guardar meta', 'error');
    } finally {
      setSavingGoal(false);
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    try {
      await apiRequest(
        `/api/councilors/${encodeURIComponent(activeCouncilor.uid)}/goals/${encodeURIComponent(
          goalId
        )}`,
        { method: 'DELETE', skipRefresh: true }
      );
      showToast('Meta eliminada', 'info');
      await fetchProfile();
    } catch (err) {
      showToast(err instanceof ApiRequestError ? err.message : 'Error al eliminar meta', 'error');
    }
  };

  const filteredAchievements = useMemo(() => {
    const list = profileData?.achievements || [];
    if (achFilter === 'todos') return list;
    return list.filter((a) => a.category === achFilter);
  }, [profileData?.achievements, achFilter]);

  const goalsSummary = useMemo(() => {
    const list = profileData?.goals || [];
    return {
      total: list.length,
      done: list.filter((g) => g.status === 'hecha').length,
      inProgress: list.filter((g) => g.status === 'en_curso').length,
      pending: list.filter((g) => g.status === 'pendiente').length,
    };
  }, [profileData?.goals]);

  const igHref = buildSocialHref(activeCouncilor.instagram, 'instagram');
  const fbHref = buildSocialHref(activeCouncilor.facebook, 'facebook');
  const waHref = buildWhatsappHref(activeCouncilor.phone);
  const telHref = buildTelHref(activeCouncilor.phone);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="councilor-profile-title"
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-slate-950/75 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-4xl h-[100dvh] sm:h-auto sm:max-h-[92dvh] flex flex-col overflow-hidden rounded-none sm:rounded-3xl border-0 sm:border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl"
      >
        {/* Barra superior tricolor + barra sticky */}
        <div className="h-1 w-full cmj-tricolor-hairline shrink-0" aria-hidden="true" />
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 sm:px-7 py-3.5 border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 min-w-0">
            <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">Perfil Público · CMJ Flandes, Tolima</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {copiedShareLink ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Enlace copiado</span>
                </>
              ) : (
                <>
                  <Share2 className="h-3.5 w-3.5" />
                  <span className="hidden xs:inline">Compartir</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar ficha del consejero"
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Contenido scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-7 pb-safe-bottom space-y-6">
          {/* SECCIÓN 1: ENCABEZADO COMPLETO */}
          <div className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-gradient-to-br from-slate-50 via-white to-emerald-50/40 dark:from-slate-900 dark:via-slate-900 dark:to-emerald-950/20 p-5 sm:p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
              <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-5 min-w-0">
                <AvatarBadge
                  name={activeCouncilor.fullName}
                  photoUrl={activeCouncilor.photoUrl}
                  thumbUrl={activeCouncilor.photoThumbUrl}
                  mediumUrl={activeCouncilor.photoMediumUrl}
                  accentColor={accentColor}
                  statusIndicator={activeCouncilor.active ? 'active' : 'inactive'}
                  size="xl"
                />
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider ${
                        activeCouncilor.roleLabel === 'Consejero Departamental'
                          ? 'text-purple-700 dark:text-purple-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}
                    >
                      {activeCouncilor.roleLabel}
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">·</span>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {activeCouncilor.commissionName || 'Sin comisión asignada'}
                    </span>
                  </div>

                  <h2
                    id="councilor-profile-title"
                    className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white text-balance flex flex-wrap items-center gap-2"
                  >
                    <span>{activeCouncilor.fullName}</span>
                    {activeCouncilor.verificado && <VerifiedBadge size="md" />}
                  </h2>

                  {(activeCouncilor.affiliationType || activeCouncilor.affiliationName) && (
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">
                        {formatAffiliationLabel(activeCouncilor.affiliationType) || 'Representación'}
                      </span>
                      {activeCouncilor.affiliationName
                        ? ` · ${activeCouncilor.affiliationName}`
                        : ''}
                    </p>
                  )}

                  {activeCouncilor.verificado && (
                    <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      <UserCheck className="h-3.5 w-3.5" />
                      Consejero verificado del CMJ Flandes
                    </p>
                  )}

                  {profileData?.roleHistory && profileData.roleHistory.length > 0 && (
                    <div className="pt-1 flex flex-wrap items-center gap-1.5">
                      {profileData.roleHistory.map((item) => (
                        <span
                          key={item.id}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${
                            item.status === 'vigente'
                              ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <Award className="h-3 w-3 shrink-0" />
                          <span>
                            {item.roleLabel}
                            {item.commissionName ? ` (${item.commissionName})` : ''} ·{' '}
                            {item.periodLabel}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Corazón de apoyo ciudadano */}
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <HeartSupportButton
                  councilorUid={activeCouncilor.uid || activeCouncilor.id}
                  councilorName={activeCouncilor.fullName}
                  count={heartCount}
                  hearted={viewerHasHearted}
                  isSelf={isSelf}
                  variant="full"
                  onToggleResult={handleHeartToggleResult}
                />
              </div>
            </div>

            {activeCouncilor.bio && (
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap border-t border-slate-200/70 dark:border-slate-800 pt-4">
                {activeCouncilor.bio}
              </p>
            )}

            {/* Canales de contacto directo */}
            {(activeCouncilor.phone || activeCouncilor.email || igHref || fbHref) && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70 dark:border-slate-800">
                {waHref && (
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                  </a>
                )}
                {telHref && (
                  <a
                    href={telHref}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 font-mono-num"
                  >
                    <Phone className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    {activeCouncilor.phone}
                  </a>
                )}
                {activeCouncilor.email && (
                  <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                    <a
                      href={`mailto:${activeCouncilor.email}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 dark:text-cyan-400 hover:underline"
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate max-w-[200px] sm:max-w-xs">
                        {activeCouncilor.email}
                      </span>
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopyEmail(activeCouncilor.email!)}
                      aria-label="Copiar correo"
                      className="px-2.5 py-1.5 border-l border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    >
                      {copiedEmail ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                )}
                {igHref && (
                  <a
                    href={igHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Instagram
                  </a>
                )}
                {fbHref && (
                  <a
                    href={fbHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Facebook
                  </a>
                )}
              </div>
            )}
          </div>

          {/* PESTAÑAS DE GESTIÓN PÚBLICA */}
          <div
            role="tablist"
            aria-label="Secciones de la ficha del consejero"
            className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3"
          >
            {(
              [
                {
                  id: 'logros',
                  label: 'Logros',
                  icon: Award,
                  count: profileData?.achievements.length,
                },
                {
                  id: 'metas',
                  label: 'Metas',
                  icon: Target,
                  count: profileData?.goals.length,
                },
                {
                  id: 'asistencias',
                  label: 'Asistencias',
                  icon: Calendar,
                  count:
                    profileData && profileData.attendance.totalRecorded > 0
                      ? `${profileData.attendance.percentage}%`
                      : undefined,
                },
                {
                  id: 'votaciones',
                  label: 'Votaciones',
                  icon: Vote,
                  count: profileData?.votes.totalVotes,
                },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={selected}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                    selected
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`font-mono-num rounded-md px-1.5 py-0.5 text-[10px] ${
                        selected
                          ? 'bg-white/20 text-white'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* ESTADO DE CARGA / ERROR */}
          {loading ? (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <SkeletonBlock className="h-20 w-full" />
                <SkeletonBlock className="h-20 w-full" />
                <SkeletonBlock className="h-20 w-full" />
              </div>
              <SkeletonBlock className="h-32 w-full" />
              <SkeletonBlock className="h-32 w-full" />
            </div>
          ) : loadError ? (
            <div className="rounded-2xl border border-rose-200 dark:border-rose-900/70 bg-rose-50/70 dark:bg-rose-950/30 p-5 text-center space-y-3">
              <p className="text-sm font-semibold text-rose-800 dark:text-rose-200">{loadError}</p>
              <button
                type="button"
                onClick={fetchProfile}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-700 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-800 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reintentar
              </button>
            </div>
          ) : (
            profileData && (
              <div role="tabpanel">
                {/* SECCIÓN 2: LOGROS */}
                {activeTab === 'logros' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(
                          [
                            ['todos', 'Todos'],
                            ['iniciativa', 'Iniciativas'],
                            ['proyecto', 'Proyectos'],
                            ['reconocimiento', 'Reconocimientos'],
                            ['evento', 'Eventos'],
                          ] as const
                        ).map(([key, label]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setAchFilter(key)}
                            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                              achFilter === key
                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {profileData.canManageOwnContent && (
                        <button
                          type="button"
                          onClick={() => setShowAddAchievement((v) => !v)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Registrar logro
                        </button>
                      )}
                    </div>

                    {showAddAchievement && profileData.canManageOwnContent && (
                      <form
                        onSubmit={handleCreateAchievement}
                        className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <input
                            type="text"
                            value={achTitle}
                            onChange={(e) => setAchTitle(e.target.value)}
                            placeholder="Título del logro o gestión *"
                            required
                            className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                          />
                          <select
                            value={achCat}
                            onChange={(e) => setAchCat(e.target.value as AchievementCategory)}
                            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                          >
                            <option value="iniciativa">Iniciativa</option>
                            <option value="proyecto">Proyecto</option>
                            <option value="reconocimiento">Reconocimiento</option>
                            <option value="evento">Evento</option>
                            <option value="general">General</option>
                          </select>
                        </div>
                        <textarea
                          value={achDesc}
                          onChange={(e) => setAchDesc(e.target.value)}
                          rows={2}
                          placeholder="Descripción breve e impacto juvenil en Flandes..."
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="date"
                            value={achDate}
                            onChange={(e) => setAchDate(e.target.value)}
                            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                          />
                          <input
                            type="url"
                            value={achEvidence}
                            onChange={(e) => setAchEvidence(e.target.value)}
                            placeholder="Enlace de evidencia (https://... opcional)"
                            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowAddAchievement(false)}
                            className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={savingAch}
                            className="rounded-xl bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 cursor-pointer"
                          >
                            {savingAch ? 'Guardando...' : 'Guardar logro'}
                          </button>
                        </div>
                      </form>
                    )}

                    {filteredAchievements.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                        Aún no se han registrado logros públicos en esta categoría. Los compromisos cumplidos aparecerán aquí automáticamente.
                      </div>
                    ) : (
                      <div className="relative pl-5 space-y-4 before:content-[''] before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-0.5 before:bg-emerald-200 dark:before:bg-emerald-900">
                        {filteredAchievements.map((ach) => (
                          <div
                            key={ach.id}
                            className="relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-2"
                          >
                            <span
                              aria-hidden="true"
                              className="absolute -left-[18px] top-5 h-3 w-3 rounded-full bg-emerald-600 ring-4 ring-white dark:ring-slate-900"
                            />
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div className="space-y-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                  <span className="font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                                    {categoryLabel(ach.category)}
                                  </span>
                                  <span className="text-slate-400">·</span>
                                  <span className="font-mono-num text-slate-500 dark:text-slate-400">
                                    {ach.date || 'Período vigente'}
                                  </span>
                                  {ach.source === 'compromiso' && (
                                    <>
                                      <span className="text-slate-400">·</span>
                                      <span className="inline-flex items-center gap-1 font-semibold text-blue-700 dark:text-cyan-400">
                                        <FileCheck2 className="h-3 w-3" />
                                        Compromiso cumplido
                                      </span>
                                    </>
                                  )}
                                </div>
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                  {ach.title}
                                </h3>
                              </div>

                              {profileData.canManageOwnContent && ach.source === 'registro' && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAchievement(ach.id)}
                                  aria-label={`Eliminar logro ${ach.title}`}
                                  className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>

                            {ach.description && (
                              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                                {ach.description}
                              </p>
                            )}

                            {ach.evidenceUrl && (
                              <a
                                href={ach.evidenceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Ver evidencia
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SECCIÓN 3: METAS */}
                {activeTab === 'metas' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 flex-1">
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-3.5 py-2.5">
                          <p className="font-mono-num text-lg font-extrabold text-slate-900 dark:text-white">
                            {goalsSummary.total}
                          </p>
                          <p className="text-[11px] text-slate-500">Total metas</p>
                        </div>
                        <div className="rounded-2xl border border-emerald-200/80 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 px-3.5 py-2.5">
                          <p className="font-mono-num text-lg font-extrabold text-emerald-700 dark:text-emerald-400">
                            {goalsSummary.done}
                          </p>
                          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                            Hechas
                          </p>
                        </div>
                        <div className="rounded-2xl border border-amber-200/80 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 px-3.5 py-2.5">
                          <p className="font-mono-num text-lg font-extrabold text-amber-700 dark:text-amber-400">
                            {goalsSummary.inProgress}
                          </p>
                          <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                            En curso
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-3.5 py-2.5">
                          <p className="font-mono-num text-lg font-extrabold text-slate-700 dark:text-slate-300">
                            {goalsSummary.pending}
                          </p>
                          <p className="text-[11px] text-slate-500">Pendientes</p>
                        </div>
                      </div>

                      {profileData.canManageOwnContent && (
                        <button
                          type="button"
                          onClick={() => setShowAddGoal((v) => !v)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 cursor-pointer shrink-0"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Registrar meta
                        </button>
                      )}
                    </div>

                    {showAddGoal && profileData.canManageOwnContent && (
                      <form
                        onSubmit={handleCreateGoal}
                        className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 p-4 space-y-3"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <input
                            type="text"
                            value={goalTitle}
                            onChange={(e) => setGoalTitle(e.target.value)}
                            placeholder="Meta de período *"
                            required
                            className="sm:col-span-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                          />
                          <select
                            value={goalStatus}
                            onChange={(e) =>
                              setGoalStatus(e.target.value as 'pendiente' | 'en_curso' | 'hecha')
                            }
                            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                          >
                            <option value="pendiente">Pendiente</option>
                            <option value="en_curso">En curso</option>
                            <option value="hecha">Hecha</option>
                          </select>
                        </div>
                        <textarea
                          value={goalDesc}
                          onChange={(e) => setGoalDesc(e.target.value)}
                          rows={2}
                          placeholder="Descripción y alcance de la meta..."
                          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                          <label className="flex items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
                            <span>Avance ({goalStatus === 'hecha' ? 100 : goalProgress}%):</span>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              value={goalStatus === 'hecha' ? 100 : goalProgress}
                              onChange={(e) => setGoalProgress(Number(e.target.value))}
                              className="flex-1 accent-emerald-600"
                            />
                          </label>
                          <input
                            type="text"
                            value={goalDueDate}
                            onChange={(e) => setGoalDueDate(e.target.value)}
                            placeholder="Fecha límite o trimestre (ej. 2026-10-30)"
                            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs text-slate-900 dark:text-white"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setShowAddGoal(false)}
                            className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={savingGoal}
                            className="rounded-xl bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-60 cursor-pointer"
                          >
                            {savingGoal ? 'Guardando...' : 'Guardar meta'}
                          </button>
                        </div>
                      </form>
                    )}

                    {profileData.goals.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                        No hay metas o compromisos registrados para este consejero todavía.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {profileData.goals.map((g) => {
                          const statusInfo =
                            g.status === 'hecha'
                              ? {
                                  label: 'Hecha',
                                  cls: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
                                  barCls: 'bg-emerald-600 dark:bg-emerald-400',
                                  Icon: CheckCircle2,
                                }
                              : g.status === 'en_curso'
                                ? {
                                    label: 'En curso',
                                    cls: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
                                    barCls: 'bg-amber-500',
                                    Icon: Clock,
                                  }
                                : {
                                    label: 'Pendiente',
                                    cls: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
                                    barCls: 'bg-slate-400',
                                    Icon: Target,
                                  };
                          const StatusIcon = statusInfo.Icon;
                          const sourceLabel =
                            g.source === 'compromiso'
                              ? 'Compromiso'
                              : g.source === 'plan_trabajo'
                                ? 'Plan de trabajo'
                                : 'Meta personal';

                          return (
                            <div
                              key={g.id}
                              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50 p-4 space-y-2.5"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="space-y-0.5 min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                                      {sourceLabel}
                                    </span>
                                    {g.dueDate && (
                                      <>
                                        <span>·</span>
                                        <span className="font-mono-num">Plazo: {g.dueDate}</span>
                                      </>
                                    )}
                                  </div>
                                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                                    {g.title}
                                  </h3>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1 text-[11px] font-bold ${statusInfo.cls}`}
                                  >
                                    <StatusIcon className="h-3 w-3" />
                                    {statusInfo.label}
                                  </span>
                                  {profileData.canManageOwnContent && g.source === 'meta' && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteGoal(g.id)}
                                      aria-label={`Eliminar meta ${g.title}`}
                                      className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {g.description && (
                                <p className="text-xs text-slate-600 dark:text-slate-300">
                                  {g.description}
                                </p>
                              )}

                              <div className="flex items-center gap-3">
                                <div
                                  role="progressbar"
                                  aria-valuenow={g.progress}
                                  aria-valuemin={0}
                                  aria-valuemax={100}
                                  className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"
                                >
                                  <div
                                    className={`h-full rounded-full transition-all duration-300 ${statusInfo.barCls}`}
                                    style={{ width: `${g.progress}%` }}
                                  />
                                </div>
                                <span className="font-mono-num text-xs font-bold text-slate-700 dark:text-slate-200 w-10 text-right">
                                  {g.progress}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* SECCIÓN 4: ASISTENCIAS */}
                {activeTab === 'asistencias' && (
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-5 flex flex-col sm:flex-row items-center gap-6">
                      <AttendanceRingChart
                        percentage={profileData.attendance.percentage}
                        totalRecorded={profileData.attendance.totalRecorded}
                      />

                      <div className="flex-1 w-full space-y-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            Resumen de Asistencia a Sesiones
                          </h3>
                          <span className="font-mono-num text-xs text-slate-500 dark:text-slate-400">
                            {profileData.attendance.totalRecorded} de{' '}
                            {profileData.attendance.totalSessions} sesiones registradas
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-900/60 bg-white dark:bg-slate-900 p-2.5">
                            <p className="font-mono-num text-lg font-extrabold text-emerald-700 dark:text-emerald-400">
                              {profileData.attendance.presente}
                            </p>
                            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                              Presente
                            </p>
                          </div>
                          <div className="rounded-xl border border-amber-200/80 dark:border-amber-900/60 bg-white dark:bg-slate-900 p-2.5">
                            <p className="font-mono-num text-lg font-extrabold text-amber-600 dark:text-amber-400">
                              {profileData.attendance.tarde}
                            </p>
                            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                              Tarde
                            </p>
                          </div>
                          <div className="rounded-xl border border-sky-200/80 dark:border-sky-900/60 bg-white dark:bg-slate-900 p-2.5">
                            <p className="font-mono-num text-lg font-extrabold text-sky-600 dark:text-sky-400">
                              {profileData.attendance.excusa}
                            </p>
                            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                              Excusa
                            </p>
                          </div>
                          <div className="rounded-xl border border-rose-200/80 dark:border-rose-900/60 bg-white dark:bg-slate-900 p-2.5">
                            <p className="font-mono-num text-lg font-extrabold text-rose-600 dark:text-rose-400">
                              {profileData.attendance.ausente}
                            </p>
                            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
                              Ausente
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {profileData.attendance.recent.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                        Aún no hay registros de asistencia asociados a este consejero.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Historial Reciente de Sesiones
                        </h4>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50 overflow-hidden">
                          {profileData.attendance.recent.map((rec) => {
                            const meta = attendanceStatusMeta(rec.status);
                            return (
                              <div
                                key={rec.sessionId}
                                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs"
                              >
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900 dark:text-white truncate">
                                    {rec.title}
                                  </p>
                                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-num">
                                    {rec.dateIso} · {rec.sessionType}
                                  </p>
                                </div>
                                <span
                                  className={`rounded-xl border px-2.5 py-1 text-[11px] font-bold shrink-0 ${meta.badgeClass}`}
                                >
                                  {meta.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* SECCIÓN 5: VOTACIONES (con estricto secreto de voto) */}
                {activeTab === 'votaciones' && (
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          Participación en Votaciones del Consejo
                        </span>
                        <span className="font-mono-num text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                          {profileData.votes.participatedCount} de {profileData.votes.totalVotes}{' '}
                          ({profileData.votes.participationRate}%)
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-valuenow={profileData.votes.participationRate}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"
                      >
                        <div
                          className="h-full rounded-full bg-emerald-600 dark:bg-emerald-400 transition-all duration-500"
                          style={{ width: `${profileData.votes.participationRate}%` }}
                        />
                      </div>
                      <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                        En votaciones secretas se protege el sentido del voto: solo se informa si el consejero participó.
                      </p>
                    </div>

                    {profileData.votes.items.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                        No hay votaciones registradas en el portal todavía.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {profileData.votes.items.map((v) => {
                          const isSecret = v.voteMode === 'secreto';
                          const modeText =
                            v.voteMode === 'secreto'
                              ? 'Voto secreto'
                              : v.voteMode === 'mano_alzada'
                                ? 'Mano alzada'
                                : 'Nominal';

                          return (
                            <div
                              key={v.voteId}
                              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                                    {v.commissionName}
                                  </span>
                                  <span>·</span>
                                  <span className="font-mono-num">{v.date}</span>
                                  <span>·</span>
                                  <span className="inline-flex items-center gap-1">
                                    {isSecret && <Lock className="h-3 w-3 text-amber-600" />}
                                    {modeText}
                                  </span>
                                </div>
                                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                  {v.title}
                                </h4>
                              </div>

                              <div className="shrink-0">
                                {!v.participated ? (
                                  <span className="inline-flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    No participó
                                  </span>
                                ) : isSecret ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                    <Lock className="h-3 w-3" />
                                    Participó (voto reservado)
                                  </span>
                                ) : v.choice ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                    Votó: {v.choice}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                                    Participó
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
