# Email verification and password reset

Off by default. Set:

| Variable | Value |
| --- | --- |
| `IDENTITY_MAIL_MODE` | `resend`, or `outbox` for development |
| `IDENTITY_MAIL_KEY` | A secret of 32 or more characters |
| `RESEND_API_KEY`, `MAIL_FROM` | For `resend`: an API key and a verified sender |

`outbox` writes each message to `.data/identity-mail-outbox/` instead of sending
it, and is refused in production.

Codes expire after 15 minutes and work once. A password reset signs out every
session. Each address gets at most 3 messages an hour.
