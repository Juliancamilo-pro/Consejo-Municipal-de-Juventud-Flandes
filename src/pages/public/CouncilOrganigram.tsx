import { useState } from 'react';
import { Network } from 'lucide-react';
import { Card } from '../../components/ui/Card';

interface CouncilOrganigramProps {
  directoryCount: number;
  boardCount: number;
  commissionsCount: number;
}

export function CouncilOrganigram({
  directoryCount,
  boardCount,
  commissionsCount,
}: CouncilOrganigramProps) {
  const [selectedNode, setSelectedNode] = useState<string>('pleno');

  return (
    <Card>
      <div className="flex items-center gap-2">
        <Network className="h-5 w-5 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
        <h2 className="font-display text-xl font-semibold text-stone-950 dark:text-white">
          Organigrama interactivo institucional
        </h2>
      </div>
      <p className="cmj-prose mt-2 text-sm text-stone-600 dark:text-slate-300">
        Selecciona cualquier instancia del Consejo para consultar su competencia y conformación actual.
      </p>

      <div className="mt-6 flex flex-col items-center gap-4">
        <button
          type="button"
          onClick={() => setSelectedNode('pleno')}
          className={`w-full max-w-md rounded-xl border px-5 py-4 text-left transition-colors ${
            selectedNode === 'pleno'
              ? 'border-[#7B1832] bg-[#7B1832]/5 dark:border-[#D9B245] dark:bg-[#D9B245]/10'
              : 'border-stone-200 hover:border-stone-300 dark:border-slate-700'
          }`}
        >
          <p className="text-xs font-medium text-[#7B1832] dark:text-[#D9B245]">
            Máxima autoridad colegiada
          </p>
          <p className="mt-1 font-display text-lg font-semibold text-stone-950 dark:text-white">
            Pleno del Consejo Municipal de Juventud
          </p>
        </button>

        <div className="h-6 w-px bg-stone-300 dark:bg-slate-700" aria-hidden="true" />

        <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { id: 'mesa', title: 'Mesa Directiva', sub: 'Presidencia, Vicepresidencia y Secretaría' },
            {
              id: 'comisiones',
              title: 'Comisiones de Trabajo',
              sub: commissionsCount > 0 ? `${commissionsCount} registradas` : 'Mesas temáticas del periodo',
            },
            { id: 'participacion', title: 'Control y Veeduría', sub: 'Buzón juvenil y datos abiertos' },
          ].map((node) => (
            <button
              key={node.id}
              type="button"
              onClick={() => setSelectedNode(node.id)}
              className={`rounded-xl border px-4 py-3.5 text-left transition-colors ${
                selectedNode === node.id
                  ? 'border-[#1E3A8A] bg-[#1E3A8A]/5 dark:border-[#60A5FA] dark:bg-[#60A5FA]/10'
                  : 'border-stone-200 hover:border-stone-300 dark:border-slate-700'
              }`}
            >
              <p className="font-display text-base font-semibold text-stone-900 dark:text-white">
                {node.title}
              </p>
              <p className="mt-1 text-xs text-stone-500 dark:text-slate-400">{node.sub}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-stone-200 bg-[#FAFAF8] p-4 text-sm text-stone-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        {selectedNode === 'pleno' && (
          <p className="cmj-prose">
            <strong>Pleno del CMJ:</strong> Integrado por los consejeros electos de Flandes
            {directoryCount > 0 ? ` (${directoryCount} publicados actualmente en el directorio)` : ''}.
            Aprueba actas, acuerdos y lineamientos juveniles del municipio.
          </p>
        )}
        {selectedNode === 'mesa' && (
          <p className="cmj-prose">
            <strong>Mesa Directiva:</strong> Coordina las sesiones del pleno, administra la
            aprobación de actas y valida las cuentas institucionales
            {boardCount > 0 ? ` (${boardCount} dignatarios publicados)` : ''}.
          </p>
        )}
        {selectedNode === 'comisiones' && (
          <p className="cmj-prose">
            <strong>Comisiones de Trabajo:</strong> Mesas temáticas encargadas de formular
            proyectos y ejecutar compromisos sectoriales.
          </p>
        )}
        {selectedNode === 'participacion' && (
          <p className="cmj-prose">
            <strong>Control Social y Participación:</strong> Canal ciudadano para propuestas,
            PQRSD y veeduría juvenil en el territorio de Flandes.
          </p>
        )}
      </div>
    </Card>
  );
}
