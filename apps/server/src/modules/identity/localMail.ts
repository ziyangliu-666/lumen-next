import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resendMailSender, type MailSender } from './mail.js';

/** Local outbox by default; real email requires explicit opt-in and private keys. */
export function localMailSender(scratch: string): MailSender {
  const mode = process.env['IDENTITY_MAIL_MODE'] ?? 'outbox';
  if (mode === 'resend') {
    return resendMailSender({
      apiKey: process.env['RESEND_API_KEY'] ?? '',
      from: process.env['MAIL_FROM'] ?? '',
    });
  }
  if (mode !== 'outbox') throw new Error('Expected outbox or resend mail mode');
  const directory = resolve(scratch, 'identity-mail-outbox');
  return {
    async send(message): Promise<void> {
      await mkdir(directory, { recursive: true });
      await writeFile(
        resolve(directory, `${randomUUID()}.txt`),
        `To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`,
        { encoding: 'utf8', mode: 0o600, flag: 'wx' },
      );
    },
  };
}
