export interface IdentityMail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}
export interface MailSender {
  send(message: IdentityMail): Promise<void>;
}

/** Native HTTP adapter; no application dependency or browser-exposed API key. */
export function resendMailSender(options: {
  readonly apiKey: string;
  readonly from: string;
  readonly fetcher?: typeof fetch;
}): MailSender {
  if (!options.apiKey || !options.from || /[\r\n]/.test(options.from))
    throw new Error('Invalid mail configuration');
  const fetcher = options.fetcher ?? fetch;
  return {
    async send(message): Promise<void> {
      try {
        const response = await fetcher('https://api.resend.com/emails', {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(10_000),
          headers: {
            authorization: `Bearer ${options.apiKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            from: options.from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
          }),
        });
        await response.body?.cancel();
        if (!response.ok) throw new Error('Mail delivery failed');
      } catch {
        throw new Error('Mail delivery failed');
      }
    },
  };
}
