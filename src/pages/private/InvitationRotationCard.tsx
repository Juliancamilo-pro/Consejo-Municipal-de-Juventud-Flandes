import { FormEvent, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { rotateInvitationCode } from '../../services/privateUsersService';
import { UserProfile } from '../../types/models';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { useToast } from '../../components/ui/Toast';

export function InvitationRotationCard({ actor }: { actor: UserProfile }) {
  const { showToast } = useToast();
  const [newInviteCode, setNewInviteCode] = useState('');
  const [rotating, setRotating] = useState(false);
  const [rotateMsg, setRotateMsg] = useState<string | null>(null);

  const handleRotate = async (e: FormEvent) => {
    e.preventDefault();
    setRotateMsg(null);
    setRotating(true);
    try {
      const version = await rotateInvitationCode(actor, newInviteCode);
      setNewInviteCode('');
      setRotateMsg(`Código rotado exitosamente (versión ${version}). El anterior ya no es válido.`);
      showToast('Código de invitación rotado correctamente.', 'success');
    } catch (err) {
      setRotateMsg(err instanceof Error ? err.message : 'No fue posible rotar el código.');
    } finally {
      setRotating(false);
    }
  };

  return (
    <Card>
      <div className="flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-[#7B1832] dark:text-[#D9B245]" aria-hidden="true" />
        <h2 className="font-display text-xl font-semibold text-stone-950 dark:text-white">
          Rotación del código de invitación
        </h2>
      </div>
      <p className="mt-2 text-sm text-stone-600 dark:text-slate-300">
        El nuevo código se cifra y almacena únicamente su hash criptográfico en Firestore.
        Compártelo por un canal interno seguro con los consejeros por registrar.
      </p>
      <form onSubmit={handleRotate} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            label="Nuevo código de invitación"
            type="password"
            required
            minLength={8}
            maxLength={64}
            value={newInviteCode}
            onChange={(e) => setNewInviteCode(e.target.value)}
            placeholder="Mínimo 8 caracteres"
          />
        </div>
        <Button type="submit" loading={rotating}>
          Rotar código
        </Button>
      </form>
      {rotateMsg && (
        <p className="mt-3 text-xs font-medium text-[#1E3A8A] dark:text-[#93C5FD]">{rotateMsg}</p>
      )}
    </Card>
  );
}
