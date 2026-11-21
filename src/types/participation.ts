export type PollQuestionType =
  | 'single_choice'
  | 'multiple_choice'
  | 'scale_1_5'
  | 'yes_no'
  | 'short_text';

export interface PollOptionItem {
  id: string;
  label: string;
  votes: number;
}

export interface PollQuestion {
  id: string;
  prompt: string;
  type: PollQuestionType;
  required: boolean;
  options: PollOptionItem[];
  textResponses?: string[];
}

export interface PublicPoll {
  id: string;
  title: string;
  description: string;
  options: PollOptionItem[];
  questions?: PollQuestion[];
  audience?: 'publica' | 'consejeros';
  anonymity?: 'anonima' | 'identificada';
  opensAt?: string;
  closesAt?: string;
  thankYouMessage?: string;
  responseCount?: number;
  status: 'borrador' | 'abierta' | 'cerrada' | 'archivada';
  createdByUid: string;
  createdByName: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CallExtraField {
  id: string;
  label: string;
  required: boolean;
}

export interface PublicCall {
  id: string;
  title: string;
  category: 'evento' | 'convocatoria' | 'taller' | 'cabildo';
  summary: string;
  eventDateIso: string;
  location: string;
  capacity?: number;
  extraFields?: CallExtraField[];
  status: 'borrador' | 'abierta' | 'cerrada' | 'archivada';
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CallRegistration {
  id: string;
  callId: string;
  callTitle: string;
  fullName: string;
  age: number;
  neighborhood: string;
  email: string;
  phone?: string;
  notes?: string;
  extraAnswers?: Record<string, string>;
  createdAt?: unknown;
}

export interface InternalNotification {
  id: string;
  title: string;
  body: string;
  category: 'aviso' | 'convocatoria_sesion' | 'alerta';
  sessionId?: string;
  readByUids: string[];
  createdByUid: string;
  createdByName: string;
  createdAt?: unknown;
}
