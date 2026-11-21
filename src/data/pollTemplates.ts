import { PollQuestion, PollQuestionType } from '../types/participation';

export interface PollTemplateDefinition {
  id: string;
  label: string;
  title: string;
  description: string;
  questions: PollQuestion[];
}

export const POLL_TEMPLATES: PollTemplateDefinition[] = [
  {
    id: 'agenda_juvenil',
    label: 'Consulta juvenil rápida (Prioridades)',
    title: 'Prioridades de la Agenda Juvenil 2026–2029 en Flandes',
    description:
      'Cuéntanos qué líneas estratégicas debe priorizar el CMJ este trimestre en tu barrio o vereda.',
    questions: [
      {
        id: 'q_1',
        prompt: '¿Cuál es el eje más urgente para las juventudes de tu sector?',
        type: 'single_choice',
        required: true,
        options: [
          { id: 'o_1', label: 'Empleo joven y emprendimiento', votes: 0 },
          { id: 'o_2', label: 'Cultura, recreación y deporte', votes: 0 },
          { id: 'o_3', label: 'Salud mental y prevención', votes: 0 },
        ],
      },
      {
        id: 'q_2',
        prompt: '¿En qué horario te queda más fácil asistir a cabildos en Flandes?',
        type: 'single_choice',
        required: true,
        options: [
          { id: 'o_1', label: 'Mañanas (sábados)', votes: 0 },
          { id: 'o_2', label: 'Tardes (entre semana)', votes: 0 },
        ],
      },
    ],
  },
  {
    id: 'eval_evento',
    label: 'Evaluación de taller o sesión territorial',
    title: 'Evaluación de jornada juvenil en Flandes',
    description: 'Tu opinión nos ayuda a mejorar los próximos talleres y encuentros juveniles.',
    questions: [
      {
        id: 'q_1',
        prompt: 'Califica de 1 a 5 la utilidad del encuentro',
        type: 'scale_1_5',
        required: true,
        options: [1, 2, 3, 4, 5].map((n) => ({ id: `s_${n}`, label: `${n} de 5`, votes: 0 })),
      },
      {
        id: 'q_2',
        prompt: '¿Recomendarías estos espacios a otros jóvenes?',
        type: 'yes_no',
        required: true,
        options: [
          { id: 'si', label: 'Sí', votes: 0 },
          { id: 'no', label: 'No', votes: 0 },
        ],
      },
      {
        id: 'q_3',
        prompt: '¿Qué tema te gustaría abordar en el próximo encuentro?',
        type: 'short_text',
        required: false,
        options: [],
        textResponses: [],
      },
    ],
  },
];

export function buildDefaultOptionsForType(type: PollQuestionType): PollQuestion['options'] {
  if (type === 'scale_1_5') {
    return [1, 2, 3, 4, 5].map((n) => ({ id: `s_${n}`, label: `${n} de 5`, votes: 0 }));
  }
  if (type === 'yes_no') {
    return [
      { id: 'si', label: 'Sí', votes: 0 },
      { id: 'no', label: 'No', votes: 0 },
    ];
  }
  if (type === 'short_text') return [];
  return [
    { id: 'opt_1', label: 'Opción 1', votes: 0 },
    { id: 'opt_2', label: 'Opción 2', votes: 0 },
  ];
}
