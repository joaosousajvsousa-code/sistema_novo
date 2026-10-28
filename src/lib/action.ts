import type { ZodError } from 'zod';

export type ActionState = {
  ok?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  data?: Record<string, unknown>;
  ts?: number;
};

export const initialState: ActionState = {};

export function fail(error: string, fieldErrors?: Record<string, string>): ActionState {
  return { ok: false, error, fieldErrors, ts: Date.now() };
}

export function done(message: string, data?: Record<string, unknown>): ActionState {
  return { ok: true, message, data, ts: Date.now() };
}

export function fromZod(err: ZodError): ActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.join('.');
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fail('Confira os campos destacados.', fieldErrors);
}
