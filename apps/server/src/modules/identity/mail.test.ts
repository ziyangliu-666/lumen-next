import { describe, expect, it, vi } from 'vitest';
import { resendMailSender } from './mail.js';

describe('identity: mail transport', () => {
  it('sends plain-text mail to the fixed provider with a server-side key', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('{}', { status: 200 }));
    await resendMailSender({ apiKey: 'private-key', from: 'lumen@example.test', fetcher }).send({
      to: 'user@example.test',
      subject: 'Verify email',
      text: 'test code',
    });
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        redirect: 'error',
        body: JSON.stringify({
          from: 'lumen@example.test',
          to: ['user@example.test'],
          subject: 'Verify email',
          text: 'test code',
        }),
      }),
    );
  });
  it.each([new Response('private details', { status: 500 }), new Error('private-key')])(
    'sanitizes provider failures',
    async (failure) => {
      const fetcher = vi.fn<typeof fetch>();
      if (failure instanceof Error) fetcher.mockRejectedValue(failure);
      else fetcher.mockResolvedValue(failure);
      await expect(
        resendMailSender({ apiKey: 'private-key', from: 'lumen@example.test', fetcher }).send({
          to: 'user@example.test',
          subject: 'Reset',
          text: 'test',
        }),
      ).rejects.toThrow('Mail delivery failed');
    },
  );
  it('refuses incomplete configuration and header-injection characters', () => {
    expect(() => resendMailSender({ apiKey: '', from: 'x@example.test' })).toThrow(
      'Invalid mail configuration',
    );
    expect(() =>
      resendMailSender({ apiKey: 'key', from: 'x@example.test\nBcc: other@example.test' }),
    ).toThrow('Invalid mail configuration');
  });
});
