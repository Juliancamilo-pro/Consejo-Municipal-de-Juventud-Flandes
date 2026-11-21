import { AttendanceRecord, PlenarySession, UserProfile } from '../types/models';
import {
  createDocumentWithVersion,
  reserveConsecutiveDocumentNumber,
} from '../services/documentsService';
import { uploadFileToFirebaseStorage } from '../services/storageService';
import { computeFileSha256 } from './fileValidation';
import { generateSessionMinutesBlob } from './pdfMinutesGenerator';

export async function createDraftMinutesDocumentFromSession(input: {
  actor: UserProfile;
  session: PlenarySession;
  attendance: AttendanceRecord[];
  activeCounselorsCount: number;
}): Promise<string> {
  const { actor, session, attendance, activeCounselorsCount } = input;
  const { blob, fileName } = await generateSessionMinutesBlob({
    session,
    attendance,
    activeCounselorsCount,
  });

  const file = new File([blob], fileName, { type: 'application/pdf' });
  const contentSha256 = await computeFileSha256(file);
  const year = new Date().getFullYear();
  const consecutiveNumber = await reserveConsecutiveDocumentNumber('acta', year);

  const uploaded = await uploadFileToFirebaseStorage(file, session.visibility, 'documents');

  await createDocumentWithVersion(actor, {
    title: `Acta — ${session.title}`,
    category: 'acta',
    description: `Borrador oficial generado desde la sesión "${session.title}" (${session.dateIso}).`,
    tags: ['acta', session.sessionType, String(year)],
    consecutiveNumber,
    year,
    sessionId: session.id,
    status: 'borrador',
    visibility: session.visibility,
    fileId: uploaded.fileId,
    storagePath: uploaded.storagePath,
    downloadUrl: uploaded.downloadUrl,
    fileName: uploaded.fileName,
    fileMime: 'application/pdf',
    fileSize: file.size,
    contentSha256,
  });

  return consecutiveNumber;
}
