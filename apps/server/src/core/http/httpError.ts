// The one way a handler says "not 200". Anything else that escapes a handler is
// a bug, and the router turns it into a 500 without leaking the message.
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message = 'bad request'): HttpError => new HttpError(400, message);
export const unauthorized = (message = 'sign in first'): HttpError => new HttpError(401, message);
export const forbidden = (message = 'not yours'): HttpError => new HttpError(403, message);
export const notFound = (message = 'no such thing'): HttpError => new HttpError(404, message);
