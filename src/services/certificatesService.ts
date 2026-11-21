import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { CertificateRecord, CertificateType, UserProfile } from '../types/models';
import { recordAuditLog } from './auditService';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreErrors';

export const CERTIFICATE_TYPE_LABELS: Record<CertificateType, string> = {
  asistencia: 'Constancia de asistencia a sesiones',
  membresia: 'Certificación de consejero electo',
  participacion: 'Certificado de participación juvenil',
  reconocimiento: 'Reconocimiento institucional CMJ',
};

export function generateCertificateCode(): string {
  const year = new Date().getFullYear();
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  return `CMJ-CERT-${year}-${suffix}`;
}

export async function verifyCertificateByCode(code: string): Promise<CertificateRecord | null> {
  const clean = code.trim().toUpperCase();
  if (!/^CMJ-CERT-20\d{2}-[A-Z0-9]{4,10}$/.test(clean)) return null;
  try {
    const snap = await getDoc(doc(db, 'certificates', clean));
    if (!snap.exists()) return null;
    return { ...(snap.data() as Omit<CertificateRecord, 'id'>), id: snap.id };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `certificates/${clean}`);
  }
}

export async function fetchAllCertificates(): Promise<CertificateRecord[]> {
  try {
    const q = query(collection(db, 'certificates'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...(d.data() as Omit<CertificateRecord, 'id'>), id: d.id }));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'certificates');
  }
}

export async function issueCertificate(
  actor: UserProfile,
  payload: {
    recipientUid?: string;
    recipientName: string;
    certificateType: CertificateType;
    title: string;
    issuedFor: string;
    issuedAtIso: string;
  },
): Promise<CertificateRecord> {
  const code = generateCertificateCode();
  try {
    const record: Omit<CertificateRecord, 'id'> = {
      code,
      ...(payload.recipientUid ? { recipientUid: payload.recipientUid } : {}),
      recipientName: payload.recipientName.trim().slice(0, 120),
      certificateType: payload.certificateType,
      title: payload.title.trim().slice(0, 180),
      issuedFor: payload.issuedFor.trim().slice(0, 500),
      issuedAtIso: payload.issuedAtIso,
      issuedByUid: actor.uid,
      issuedByName: actor.displayName,
      status: 'vigente',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'certificates', code), record);
    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'CERTIFICATE_ISSUED',
      targetCollection: 'certificates',
      targetId: code,
      summary: `Certificado ${code} emitido para ${record.recipientName}.`,
    });
    return { id: code, ...record };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `certificates/${code}`);
  }
}

export async function revokeCertificate(actor: UserProfile, code: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'certificates', code), {
      status: 'revocado',
      updatedAt: serverTimestamp(),
    });
    await recordAuditLog({
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: 'CERTIFICATE_REVOKED',
      targetCollection: 'certificates',
      targetId: code,
      summary: `Certificado ${code} revocado.`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `certificates/${code}`);
  }
}

export async function exportCertificatePdfWithQr(cert: CertificateRecord): Promise<void> {
  const [{ jsPDF }, QRCode] = await Promise.all([import('jspdf'), import('qrcode')]);
  const verifyUrl = `${window.location.origin}/verificar/${cert.code}`;
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    width: 180,
    margin: 1,
    color: { dark: '#7B1832', light: '#FFFFFF' },
  });

  const pdf = new jsPDF({ orientation: 'landscape' });
  pdf.setFillColor(123, 24, 50);
  pdf.rect(0, 0, 297, 10, 'F');
  pdf.setFillColor(197, 155, 39);
  pdf.rect(0, 10, 297, 2.5, 'F');

  pdf.setFontSize(11);
  pdf.setTextColor(123, 24, 50);
  pdf.text('CONSEJO MUNICIPAL DE JUVENTUD DE FLANDES, TOLIMA (2026–2029)', 20, 28);

  pdf.setFontSize(22);
  pdf.setTextColor(20, 20, 20);
  pdf.text(cert.title, 20, 46);

  pdf.setFontSize(12);
  pdf.setTextColor(80, 80, 80);
  pdf.text('Se certifica que:', 20, 62);

  pdf.setFontSize(20);
  pdf.setTextColor(30, 58, 138);
  pdf.text(cert.recipientName, 20, 74);

  pdf.setFontSize(11.5);
  pdf.setTextColor(50, 50, 50);
  const bodyLines = pdf.splitTextToSize(cert.issuedFor, 195);
  pdf.text(bodyLines, 20, 88);

  pdf.setFontSize(10);
  pdf.setTextColor(90, 90, 90);
  pdf.text(`Tipo: ${CERTIFICATE_TYPE_LABELS[cert.certificateType]}`, 20, 135);
  pdf.text(`Fecha de expedición: ${cert.issuedAtIso}`, 20, 142);
  pdf.text(`Expedido por: ${cert.issuedByName}`, 20, 149);
  pdf.text(`Código oficial: ${cert.code}`, 20, 156);

  pdf.addImage(qrDataUrl, 'PNG', 230, 122, 46, 46);
  pdf.setFontSize(8.5);
  pdf.text('Verifica autenticidad en:', 230, 173);
  pdf.text(`/verificar/${cert.code}`, 230, 178);

  pdf.save(`${cert.code}.pdf`);
}
