import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { mailFromEnvironment } from './mailConfiguration.js';

const key = 'mail-queue-key-0123456789abcdef-xyz';
const directories: string[] = [];

async function outbox(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'identity-outbox-'));
  directories.push(directory);
  return directory;
}

describe('identity: mail configuration from explicit environment', () => {
  afterEach(async () => {
    await Promise.all(directories.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });

  it('is disabled unless a mode is chosen, even when provider keys are present', () => {
    expect(mailFromEnvironment({}, {})).toBeNull();
    expect(
      mailFromEnvironment({ IDENTITY_MAIL_MODE: 'off', IDENTITY_MAIL_KEY: key }, {}),
    ).toBeNull();
    expect(
      mailFromEnvironment(
        { RESEND_API_KEY: 're_x', MAIL_FROM: 'a@b.example', IDENTITY_MAIL_KEY: key },
        {},
      ),
    ).toBeNull();
  });

  it('rejects an unknown mode and a missing or short queue key without echoing values', () => {
    expect(() => mailFromEnvironment({ IDENTITY_MAIL_MODE: 'smtp' }, {})).toThrow(
      'IDENTITY_MAIL_MODE must be off, outbox or resend',
    );
    for (const bad of [undefined, 'short', ` ${key}`, `${key}\n`]) {
      let message = '';
      try {
        mailFromEnvironment(
          {
            IDENTITY_MAIL_MODE: 'resend',
            RESEND_API_KEY: 're_x',
            MAIL_FROM: 'a@b.example',
            IDENTITY_MAIL_KEY: bad,
          },
          {},
        );
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toBe('IDENTITY_MAIL_KEY must be at least 32 printable characters');
      if (bad) expect(message).not.toContain(bad.trim());
    }
  });

  it('builds a Resend sender and refuses a partial Resend configuration', () => {
    const resend = mailFromEnvironment(
      {
        IDENTITY_MAIL_MODE: 'resend',
        RESEND_API_KEY: 're_x',
        MAIL_FROM: 'a@b.example',
        IDENTITY_MAIL_KEY: key,
      },
      {},
    );
    expect(resend?.key).toBe(key);
    expect(typeof resend?.sender.send).toBe('function');
    expect(() =>
      mailFromEnvironment(
        { IDENTITY_MAIL_MODE: 'resend', MAIL_FROM: 'a@b.example', IDENTITY_MAIL_KEY: key },
        {},
      ),
    ).toThrow('Invalid mail configuration');
  });

  it('writes outbox mail to the given local folder only, never in production', async () => {
    const directory = await outbox();
    const config = mailFromEnvironment(
      { IDENTITY_MAIL_MODE: 'outbox', IDENTITY_MAIL_KEY: key },
      { outboxDirectory: directory },
    );
    await config!.sender.send({ to: 'u@example.test', subject: 'Subject', text: 'Body' });
    const files = await readdir(directory);
    expect(files).toHaveLength(1);
    expect(await readFile(join(directory, files[0]!), 'utf8')).toBe(
      'To: u@example.test\nSubject: Subject\n\nBody\n',
    );
    expect(() =>
      mailFromEnvironment({ IDENTITY_MAIL_MODE: 'outbox', IDENTITY_MAIL_KEY: key }, {}),
    ).toThrow('Mail outbox needs a local directory');
    expect(() =>
      mailFromEnvironment(
        { IDENTITY_MAIL_MODE: 'outbox', IDENTITY_MAIL_KEY: key },
        { outboxDirectory: directory, production: true },
      ),
    ).toThrow('Mail outbox is for local development only');
  });
});
