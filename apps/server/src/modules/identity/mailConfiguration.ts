import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { resendMailSender, type MailSender } from './mail.js';

type Environment = Readonly<Record<string, string | undefined>>;

export interface MailConfiguration {
  readonly sender: MailSender;
  /** HMAC key for the mail queue's per-address index. */
  readonly key: string;
}
export interface MailConfigurationOptions {
  /** Where outbox mode writes messages. Outbox mode is refused without one. */
  readonly outboxDirectory?: string;
  /** True in production, where outbox mode is refused. */
  readonly production?: boolean;
}

function printable(value: string): boolean {
  return (
    value.trim() === value &&
    [...value].every((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127)
  );
}

function outboxSender(directory: string): MailSender {
  const folder = resolve(directory);
  return {
    async send(message): Promise<void> {
      await mkdir(folder, { recursive: true });
      await writeFile(
        resolve(folder, `${randomUUID()}.txt`),
        `To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`,
        { encoding: 'utf8', mode: 0o600, flag: 'wx' },
      );
    },
  };
}

/**
 * The process explicitly supplies its environment; the slice never reads ambient
 * secrets. Mail is off unless IDENTITY_MAIL_MODE chooses outbox or resend, and
 * any enabled mode needs IDENTITY_MAIL_KEY. Errors never contain the values.
 */
export function mailFromEnvironment(
  environment: Environment,
  options: MailConfigurationOptions,
): MailConfiguration | null {
  const mode = environment['IDENTITY_MAIL_MODE'] || 'off';
  if (mode === 'off') return null;
  if (mode !== 'outbox' && mode !== 'resend') {
    throw new Error('IDENTITY_MAIL_MODE must be off, outbox or resend');
  }
  const key = environment['IDENTITY_MAIL_KEY'];
  if (!key || key.length < 32 || !printable(key)) {
    throw new Error('IDENTITY_MAIL_KEY must be at least 32 printable characters');
  }
  if (mode === 'resend') {
    return {
      key,
      sender: resendMailSender({
        apiKey: environment['RESEND_API_KEY'] ?? '',
        from: environment['MAIL_FROM'] ?? '',
      }),
    };
  }
  if (options.production) throw new Error('Mail outbox is for local development only');
  if (!options.outboxDirectory) throw new Error('Mail outbox needs a local directory');
  return { key, sender: outboxSender(options.outboxDirectory) };
}
