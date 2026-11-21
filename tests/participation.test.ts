import { describe, expect, it } from 'vitest';
import {
  computePollVoterFingerprint,
  sanitizePlainText,
} from '../server/utils/participationHelpers.ts';
import { PublicPoll } from '../src/types/participation';
import {
  buildPollShareUrl,
  getEffectivePollQuestions,
  getPollTotalResponses,
} from '../src/utils/participationExport';

describe('Bloque C · Encuestas multipregunta y participación ciudadana', () => {
  it('convierte una encuesta clásica (solo options) en una pregunta efectiva compatible', () => {
    const legacyPoll: PublicPoll = {
      id: 'legacy-1',
      title: 'Consulta parque juvenil',
      description: 'Prioridad',
      options: [
        { id: 'a', label: 'Deporte', votes: 4 },
        { id: 'b', label: 'Arte', votes: 6 },
      ],
      status: 'abierta',
      createdByUid: 'u1',
      createdByName: 'Secretario',
    };

    const questions = getEffectivePollQuestions(legacyPoll);
    expect(questions).toHaveLength(1);
    expect(questions[0].type).toBe('single_choice');
    expect(questions[0].options).toHaveLength(2);
    expect(getPollTotalResponses(legacyPoll)).toBe(10);
  });

  it('conserva preguntas múltiples y prioriza responseCount cuando existe', () => {
    const multiPoll: PublicPoll = {
      id: 'multi-1',
      title: 'Evaluación cabildo',
      description: 'Balance',
      options: [
        { id: 's_1', label: '1', votes: 1 },
        { id: 's_5', label: '5', votes: 9 },
      ],
      questions: [
        {
          id: 'q1',
          prompt: 'Califica el cabildo',
          type: 'scale_1_5',
          required: true,
          options: [
            { id: 's_1', label: '1 de 5', votes: 1 },
            { id: 's_5', label: '5 de 5', votes: 9 },
          ],
        },
        {
          id: 'q2',
          prompt: 'Propuesta breve',
          type: 'short_text',
          required: false,
          options: [],
          textResponses: ['Más espacios culturales'],
        },
      ],
      responseCount: 12,
      status: 'abierta',
      createdByUid: 'u1',
      createdByName: 'Secretario',
    };

    expect(getEffectivePollQuestions(multiPoll)).toHaveLength(2);
    expect(getPollTotalResponses(multiPoll)).toBe(12);
    expect(buildPollShareUrl('multi-1')).toContain('encuesta=multi-1');
  });

  it('genera huellas HMAC únicas y determinísticas para control de voto único', () => {
    const fpA = computePollVoterFingerprint({
      pollId: 'poll-100',
      ip: '190.10.20.30',
      userAgent: 'Mozilla/5.0',
      deviceToken: 'dev-abc',
    });
    const fpSame = computePollVoterFingerprint({
      pollId: 'poll-100',
      ip: '190.10.20.30',
      userAgent: 'Mozilla/5.0',
      deviceToken: 'dev-abc',
    });
    const fpOtherPoll = computePollVoterFingerprint({
      pollId: 'poll-200',
      ip: '190.10.20.30',
      userAgent: 'Mozilla/5.0',
      deviceToken: 'dev-abc',
    });
    const fpAuthenticated = computePollVoterFingerprint({
      pollId: 'poll-100',
      ip: '190.10.20.30',
      userAgent: 'Mozilla/5.0',
      sessionUid: 'uid-consejero-7',
    });

    expect(fpA).toHaveLength(32);
    expect(fpA).toBe(fpSame);
    expect(fpA).not.toBe(fpOtherPoll);
    expect(fpA).not.toBe(fpAuthenticated);
  });

  it('limpia etiquetas HTML y caracteres de control en entradas ciudadanas', () => {
    const clean = sanitizePlainText('  <script>alert(1)</script>\nPropuesta   cultural  ', 40);
    expect(clean).not.toContain('<');
    expect(clean).not.toContain('>');
    expect(clean.length).toBeLessThanOrEqual(40);
  });
});
