import { Check, Minus } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';

interface RoleMatrixModalProps {
  open: boolean;
  onClose: () => void;
}

const CAPABILITIES: {
  capability: string;
  admin: boolean;
  board: boolean;
  leader: boolean;
  counselor: boolean;
}[] = [
  { capability: 'Editar ficha pública propia y seguridad', admin: true, board: true, leader: true, counselor: true },
  { capability: 'Marcar asistencia QR y votar en secreto', admin: true, board: true, leader: true, counselor: true },
  { capability: 'Subir documentos borrador y gestionar proyectos', admin: true, board: true, leader: true, counselor: false },
  { capability: 'Aprobar cuentas, fichas públicas y votaciones', admin: true, board: true, leader: false, counselor: false },
  { capability: 'Editar fotos y temas de temporada del portal', admin: true, board: true, leader: false, counselor: false },
  { capability: 'Rotar código de invitación y eliminar registros', admin: true, board: false, leader: false, counselor: false },
];

function Mark({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <Check className="mx-auto h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-label="Permitido" />
  ) : (
    <Minus className="mx-auto h-4 w-4 text-stone-300 dark:text-slate-700" aria-label="No permitido" />
  );
}

export function RoleMatrixModal({ open, onClose }: RoleMatrixModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Matriz de permisos por rol institucional" maxWidth="lg">
      <p className="text-xs text-stone-600 dark:text-slate-300">
        Los permisos se validan tanto en las reglas de seguridad de Firestore/Storage como en los endpoints protegidos del servidor.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-stone-200 text-stone-500 dark:border-slate-800 dark:text-slate-400">
              <th className="py-2 pr-3 font-semibold">Capacidad / Acción</th>
              <th className="px-2 py-2 text-center font-semibold">Secretario Admin</th>
              <th className="px-2 py-2 text-center font-semibold">Pres. / Vicepres.</th>
              <th className="px-2 py-2 text-center font-semibold">Líder Comisión</th>
              <th className="px-2 py-2 text-center font-semibold">Consejero</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200/70 dark:divide-slate-800">
            {CAPABILITIES.map((row) => (
              <tr key={row.capability}>
                <td className="py-2.5 pr-3 font-medium text-stone-800 dark:text-slate-200">{row.capability}</td>
                <td className="px-2 py-2.5"><Mark allowed={row.admin} /></td>
                <td className="px-2 py-2.5"><Mark allowed={row.board} /></td>
                <td className="px-2 py-2.5"><Mark allowed={row.leader} /></td>
                <td className="px-2 py-2.5"><Mark allowed={row.counselor} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
