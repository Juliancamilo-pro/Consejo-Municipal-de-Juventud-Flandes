import crypto from 'crypto';

export function sanitizePlainText(input: string, maxLength: number): string {
  return input
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function computePollVoterFingerprint(params: {
  pollId: string;
  ip: string;
  userAgent: string;
  sessionUid?: string;
  deviceToken?: string;
}): string {
  const secret = process.env.SESSION_SECRET?.trim() || 'cmj-flandes-poll-salt-dev';
  const identity = params.sessionUid
    ? `uid:${params.sessionUid}`
    : `net:${params.ip}|ua:${params.userAgent.slice(0, 80)}|dev:${(params.deviceToken || '').slice(0, 64)}`;
  return crypto
    .createHmac('sha256', secret)
    .update(`${params.pollId}:${identity}`)
    .digest('hex')
    .slice(0, 32);
}

export function buildUpdatedPollTally(
  data: Record<string, unknown>,
  sanitizedAnswers: Record<string, string | string[]>,
): {
  voteReceipt: Record<string, unknown>;
  pollUpdate: Record<string, unknown>;
} {
  const rawQuestions =
    Array.isArray(data.questions) && data.questions.length > 0
      ? (data.questions as Record<string, unknown>[])
      : null;

  if (rawQuestions) {
    const nextQuestions: Record<string, unknown>[] = rawQuestions.map((q) => {
      const qId = String(q.id || '');
      const qType = String(q.type || 'single_choice');
      const answer = sanitizedAnswers[qId];
      const opts = Array.isArray(q.options) ? (q.options as Record<string, unknown>[]) : [];

      if (qType === 'short_text') {
        const text = typeof answer === 'string' ? answer.trim() : '';
        const prevTexts = Array.isArray(q.textResponses) ? (q.textResponses as string[]) : [];
        return { ...q, textResponses: text ? [...prevTexts, text].slice(-200) : prevTexts };
      }

      const selectedSet = new Set(Array.isArray(answer) ? answer : answer ? [answer] : []);
      const nextOpts = opts.map((opt) =>
        selectedSet.has(String(opt.id || ''))
          ? { ...opt, votes: Number(opt.votes || 0) + 1 }
          : opt,
      );
      return { ...q, options: nextOpts };
    });

    const firstOpts = (nextQuestions[0]?.options as Record<string, unknown>[]) || [];
    return {
      voteReceipt: { optionId: 'multi', answers: sanitizedAnswers, createdAt: new Date() },
      pollUpdate: {
        questions: nextQuestions,
        options: firstOpts.length >= 2 ? firstOpts : data.options,
        responseCount: Number(data.responseCount || 0) + 1,
        updatedAt: new Date(),
      },
    };
  }

  const firstChoice = Object.values(sanitizedAnswers)[0];
  const chosenId = Array.isArray(firstChoice) ? firstChoice[0] : firstChoice;
  const nextOpts = (Array.isArray(data.options) ? data.options : []).map(
    (opt: Record<string, unknown>) =>
      String(opt.id) === chosenId ? { ...opt, votes: Number(opt.votes || 0) + 1 } : opt,
  );
  return {
    voteReceipt: { optionId: String(chosenId || 'opt'), createdAt: new Date() },
    pollUpdate: {
      options: nextOpts,
      responseCount: Number(data.responseCount || 0) + 1,
      updatedAt: new Date(),
    },
  };
}
