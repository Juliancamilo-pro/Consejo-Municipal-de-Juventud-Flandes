import { Router } from 'express';
import {
  requireActiveAccount,
  requireAuth,
  requireCsrf,
  requireRoles,
} from '../middleware/auth.ts';
import { getAdminFirestore, isAdminCredentialConfigured } from '../utils/authHelpers.ts';

const documentsRouter = Router();

const ALLOWED_CATEGORIES: Record<string, string> = {
  acta: 'Acta',
  informe: 'Informe',
  resolucion: 'Resolución',
  oficio: 'Oficio',
  circular: 'Circular',
  convocatoria: 'Convocatoria',
  proposicion: 'Proposición',
  plan_accion: 'Plan',
  reglamento: 'Acuerdo',
  presupuesto: 'Certificado',
  otro: 'Documento',
};

documentsRouter.post(
  '/next-number',
  requireAuth,
  requireActiveAccount,
  requireRoles(['secretario_admin', 'presidente', 'vicepresidente', 'lider_comision']),
  requireCsrf,
  async (req, res) => {
    try {
      const category =
        typeof req.body?.category === 'string' ? req.body.category.trim() : '';
      const rawYear = Number(req.body?.year) || new Date().getFullYear();
      const year = Math.min(2040, Math.max(2020, Math.floor(rawYear)));

      if (!ALLOWED_CATEGORIES[category]) {
        res.status(400).json({ error: 'Categoría documental inválida.' });
        return;
      }

      if (!isAdminCredentialConfigured()) {
        res.status(503).json({
          error: 'Cuenta de servicio del servidor no configurada.',
          fallbackClientTransaction: true,
        });
        return;
      }

      const db = getAdminFirestore();
      const counterRef = db.collection('document_counters').doc(`${category}_${year}`);

      const seq = await db.runTransaction(async (tx) => {
        const snap = await tx.get(counterRef);
        const current = snap.exists ? Number(snap.data()?.seq || 0) : 0;
        const next = current + 1;
        tx.set(
          counterRef,
          {
            category,
            year,
            seq: next,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
        return next;
      });

      const consecutiveNumber = `${ALLOWED_CATEGORIES[category]} No. ${String(seq).padStart(3, '0')} de ${year}`;
      res.json({ consecutiveNumber, seq, year });
    } catch (err) {
      console.error('Error generando numeración consecutiva:', err);
      res.status(500).json({ error: 'No se pudo asignar el número consecutivo.' });
    }
  },
);

export default documentsRouter;
