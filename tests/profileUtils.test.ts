import { describe, expect, it, vi } from 'vitest';
import { UserProfile } from '../src/types/models';
import { evaluateProfileCompleteness } from '../src/utils/profileCompleteness';
import { normalizeAndValidateSocialUrl } from '../src/utils/socialLinks';

vi.mock('firebase/firestore', () => ({
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  serverTimestamp: () => 'SERVER_TS',
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  writeBatch: vi.fn(),
}));

vi.mock('../src/services/firebase', () => ({
  db: {},
}));

vi.mock('../src/services/auditService', () => ({
  recordAuditLog: vi.fn(),
}));

import { buildPublicDirectoryPayload } from '../src/services/publicDirectoryBuilder';

const BASE_COUNSELOR: UserProfile = {
  uid: 'uid-consejero-1',
  email: 'privado.consejero@correo.com',
  displayName: 'María Camila Ospina',
  slug: 'maria-camila-ospina',
  photoUrl: 'https://storage.example/avatar.webp',
  role: 'consejero',
  status: 'activo',
  period: '2026-2029',
  commissionId: 'com-educacion',
  positionTitle: 'Consejera de Juventud',
  sector: 'Jóvenes independientes',
  shortBio: 'Lideresa juvenil de Flandes comprometida con la educación pública.',
  fullBio: 'Trayectoria comunitaria en clubes de lectura y veeduría escolar del municipio de Flandes.',
  educationOccupation: 'Estudiante de Derecho',
  motivation: 'Fortalecer la participación juvenil en las veredas y barrios de Flandes.',
  proposals: 'Crear escuelas itinerantes de liderazgo juvenil y control social municipal.',
  workAxes: ['Educación', 'Cultura'],
  achievements: [{ year: '2026', title: 'Foro Juvenil Flandes', description: '120 asistentes.' }],
  skills: ['Oratoria', 'Gestión comunitaria'],
  featuredQuote: 'La juventud flanduna construye territorio.',
  projectIds: ['proj-1'],
  socialLinks: {
    instagram: '@camila_cmj',
    tiktok: '@camila.flandes',
    website: 'https://juventudflandes.org',
  },
  publicEmail: 'contacto.publico@flandes.org',
  fieldVisibility: {
    photo: true,
    shortBio: true,
    fullBio: true,
    education: true,
    motivation: true,
    proposals: true,
    projects: true,
    socials: true,
    workAxes: true,
    achievements: true,
    skills: true,
    featuredQuote: true,
    publicEmail: false,
  },
  habeasDataAccepted: true,
  habeasDataAcceptedAt: '2026-03-01T12:00:00.000Z',
  isMinor: true,
  guardianAuthorizationNote: 'Acta Acudiente #045 firmada en archivo reservado',
  profileReviewStatus: 'publicada',
  approvedByUid: 'admin-uid-1',
  showManagementKpis: false,
  createdAt: '2026-02-01T00:00:00.000Z',
  updatedAt: '2026-03-01T12:00:00.000Z',
};

describe('Normalización de redes sociales, completitud de ficha y privacidad pública', () => {
  it('convierte @usuarios a enlaces HTTPS válidos y rechaza dominios ajenos o esquemas peligrosos', () => {
    expect(normalizeAndValidateSocialUrl('instagram', '@cmj_flandes')).toEqual({
      valid: true,
      normalizedUrl: 'https://instagram.com/cmj_flandes',
    });
    expect(normalizeAndValidateSocialUrl('tiktok', '@juventud.tolima')).toEqual({
      valid: true,
      normalizedUrl: 'https://tiktok.com/@juventud.tolima',
    });
    expect(normalizeAndValidateSocialUrl('youtube', '@canalcmj')).toEqual({
      valid: true,
      normalizedUrl: 'https://youtube.com/@canalcmj',
    });
    expect(normalizeAndValidateSocialUrl('linkedin', 'maria-ospina')).toEqual({
      valid: true,
      normalizedUrl: 'https://linkedin.com/in/maria-ospina',
    });

    const wrongDomain = normalizeAndValidateSocialUrl('instagram', 'https://evil.example.com/phish');
    expect(wrongDomain.valid).toBe(false);

    const xssScheme = normalizeAndValidateSocialUrl('website', 'javascript:alert(1)');
    expect(xssScheme.valid).toBe(false);

    const localNet = normalizeAndValidateSocialUrl('website', 'http://localhost:3000/secret');
    expect(localNet.valid).toBe(false);
  });

  it('calcula correctamente el porcentaje de completitud y el primer requisito faltante', () => {
    const empty = evaluateProfileCompleteness({
      photoUrl: '',
      positionTitle: '',
      shortBio: '',
      fullBio: '',
      motivation: '',
      proposals: '',
      socialLinks: {},
      habeasDataAccepted: false,
    });
    expect(empty.percent).toBe(0);
    expect(empty.completedCount).toBe(0);
    expect(empty.firstMissing?.key).toBe('photo');

    const full = evaluateProfileCompleteness({
      photoUrl: 'https://storage.example/a.webp',
      positionTitle: 'Consejero',
      shortBio: 'Resumen suficientemente largo para la ficha.',
      fullBio: 'Biografía detallada con más de treinta caracteres de recorrido territorial.',
      motivation: 'Motivación auténtica por el bienestar juvenil.',
      proposals: 'Propuestas concretas para el periodo 2026-2029.',
      socialLinks: { instagram: '@cmjflandes' },
      habeasDataAccepted: true,
    });
    expect(full.percent).toBe(100);
    expect(full.completedCount).toBe(8);
    expect(full.firstMissing).toBeNull();
  });

  it('omite campos desactivados en fieldVisibility y jamás filtra PII en public_directory', () => {
    const restricted = buildPublicDirectoryPayload(
      {
        ...BASE_COUNSELOR,
        fieldVisibility: {
          photo: false,
          shortBio: false,
          fullBio: false,
          education: true,
          motivation: false,
          proposals: false,
          projects: false,
          socials: false,
          workAxes: false,
          achievements: false,
          skills: false,
          featuredQuote: false,
          publicEmail: false,
        },
      },
      { commissions: [{ id: 'com-educacion', name: 'Educación y Cultura' } as never] },
    );

    expect(restricted.photoUrl).toBeUndefined();
    expect(restricted.shortBio).toBeUndefined();
    expect(restricted.fullBio).toBeUndefined();
    expect(restricted.proposals).toBeUndefined();
    expect(restricted.workAxes).toBeUndefined();
    expect(restricted.achievements).toBeUndefined();
    expect(restricted.skills).toBeUndefined();
    expect(restricted.featuredQuote).toBeUndefined();
    expect(restricted.socialLinks).toBeUndefined();
    expect(restricted.publicEmail).toBeUndefined();
    expect(restricted.educationOccupation).toBe('Estudiante de Derecho');
    expect(restricted.commissionName).toBe('Educación y Cultura');

    // Verificación estricta de cero PII privada en el payload público
    const publicPayload = buildPublicDirectoryPayload(BASE_COUNSELOR);
    expect(publicPayload.email).toBeUndefined();
    expect(publicPayload.habeasDataAccepted).toBeUndefined();
    expect(publicPayload.habeasDataAcceptedAt).toBeUndefined();
    expect(publicPayload.isMinor).toBeUndefined();
    expect(publicPayload.guardianAuthorizationNote).toBeUndefined();
    expect(publicPayload.approvedByUid).toBeUndefined();
    expect(publicPayload.socialLinks).toEqual({
      instagram: 'https://instagram.com/camila_cmj',
      tiktok: 'https://tiktok.com/@camila.flandes',
      website: 'https://juventudflandes.org/',
    });
  });
});
