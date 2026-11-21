export interface EmailSendResult {
  delivered: boolean;
  provider?: 'resend' | 'webhook' | 'none';
  reason?: string;
}

export async function sendConfigurableEmail(input: {
  to: string[];
  subject: string;
  text: string;
}): Promise<EmailSendResult> {
  const cleanRecipients = input.to
    .map((e) => e.trim())
    .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    .slice(0, 50);

  if (cleanRecipients.length === 0) {
    return { delivered: false, provider: 'none', reason: 'NO_VALID_RECIPIENTS' };
  }

  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const fromAddress =
    process.env.EMAIL_FROM?.trim() || 'CMJ Flandes <notificaciones@cmj-flandes.local>';

  if (resendApiKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: cleanRecipients,
        subject: input.subject.slice(0, 180),
        text: input.text.slice(0, 4000),
      }),
    });
    if (!res.ok) {
      return { delivered: false, provider: 'resend', reason: `HTTP_${res.status}` };
    }
    return { delivered: true, provider: 'resend' };
  }

  const webhookUrl = process.env.SMTP_WEBHOOK_URL?.trim();
  if (webhookUrl) {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.SMTP_WEBHOOK_TOKEN
          ? { Authorization: `Bearer ${process.env.SMTP_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        from: fromAddress,
        to: cleanRecipients,
        subject: input.subject.slice(0, 180),
        text: input.text.slice(0, 4000),
      }),
    });
    return { delivered: res.ok, provider: 'webhook', reason: res.ok ? undefined : `HTTP_${res.status}` };
  }

  return { delivered: false, provider: 'none', reason: 'EMAIL_NOT_CONFIGURED' };
}
