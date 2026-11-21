import { useState } from 'react';
import { Compass, X } from 'lucide-react';
import { ROLE_LABELS, UserProfile } from '../../types/models';
import { Button } from '../ui/Button';

interface RoleGuidedTourModalProps {
  profile: UserProfile;
  open: boolean;
  onClose: () => void;
}

function getTourSteps(role: UserProfile['role']) {
  const base = [
    {
      title: '1. Tu ficha pública y perfil institucional',
      body: 'En "Resumen y Perfil" puedes subir tu fotografía oficial, redactar tus propuestas y controlar qué datos personales se muestran al público.',
    },
    {
      title: '2. Seguridad de cuenta y contraseña',
      body: 'Desde "Mi perfil → Seguridad y contraseña" puedes actualizar tu contraseña y administrar tus sesiones activas.',
    },
  ];

  if (['secretario_admin', 'presidente', 'vicepresidente'].includes(role)) {
    return [
      ...base,
      {
        title: '3. Mesa Directiva: aprobaciones, certificados QR y plan anual',
        body: 'Aprueba cuentas de consejeros, expide certificados verificables por QR, gestiona el Plan de Acción Anual y publica documentos oficiales.',
      },
      {
        title: '4. Sesiones con QR y modo presentación',
        body: 'Convoca sesiones, proyecta el orden del día con cronómetro y quórum en tiempo real y genera actas PDF automáticas.',
      },
    ];
  }

  if (role === 'lider_comision') {
    return [
      ...base,
      {
        title: '3. Dirección de Comisión de Trabajo',
        body: 'Gestiona la misión, metas cuantitativas e integrantes de tu comisión, aprueba solicitudes de ingreso y sube actas con numeración consecutiva.',
      },
    ];
  }

  return [
    ...base,
    {
      title: '3. Trabajo en comisiones, asistencia y votaciones',
      body: 'Solicita ingreso a una comisión, registra tu asistencia con código QR en sesiones y participa en votaciones secretas del pleno.',
    },
  ];
}

export function RoleGuidedTourModal({ profile, open, onClose }: RoleGuidedTourModalProps) {
  const steps = getTourSteps(profile.role);
  const [idx, setIdx] = useState(0);

  if (!open) return null;

  const current = steps[idx] || steps[0];
  const isLast = idx >= steps.length - 1;

  const handleFinish = () => {
    localStorage.setItem(`cmj_tour_seen_${profile.uid}`, '1');
    setIdx(0);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tour guiado del portal CMJ"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
    >
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="cmj-tricolor-rule h-1" />
        <div className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#7B1832] dark:text-[#D9B245]">
              <Compass className="h-4 w-4" aria-hidden="true" />
              <span>Recorrido guiado · {ROLE_LABELS[profile.role]}</span>
            </div>
            <button
              type="button"
              onClick={handleFinish}
              aria-label="Cerrar recorrido guiado"
              className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <h2 className="mt-3 font-display text-xl font-semibold text-stone-950 dark:text-white">
            {current.title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-slate-300">
            {current.body}
          </p>

          <div className="mt-6 flex items-center justify-between border-t border-stone-200 pt-4 dark:border-slate-800">
            <span className="font-mono-tabular text-xs text-stone-500">
              Paso {idx + 1} de {steps.length}
            </span>
            <div className="flex gap-2">
              {idx > 0 && (
                <Button size="sm" variant="outline" onClick={() => setIdx((i) => i - 1)}>
                  Anterior
                </Button>
              )}
              {isLast ? (
                <Button size="sm" onClick={handleFinish}>
                  Finalizar tour
                </Button>
              ) : (
                <Button size="sm" onClick={() => setIdx((i) => i + 1)}>
                  Siguiente
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
