/**
 * Domain errors. The `code` is stable and is mapped to a plain-language, translated message
 * in the UI. `params` carry the values needed to fill that message. Raw SQL text never reaches users.
 */
export const ERROR_CODES = [
  'INVALID_INPUT',
  'NOT_FOUND',
  'NEGATIVE_STOCK',
  'DAY_CLOSED',
  'DAY_NOT_CLOSED',
  'CREDIT_LIMIT',
  'APPROVAL_REQUIRED',
  'ALREADY_VOID',
  'HAS_RETURNS',
  'OVER_RETURN',
  'OVER_PAYMENT',
  'PERMISSION',
  'READ_ONLY',
  'DUPLICATE',
  'IN_USE',
  'REASON_REQUIRED',
  'AUTH_FAILED',
  'LOCKED_OUT',
  'DB_NEWER',
  'IO_FAILED'
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class PetraError extends Error {
  readonly code: ErrorCode;
  readonly params: Record<string, string | number | boolean | null>;

  constructor(code: ErrorCode, message?: string, params: Record<string, string | number | boolean | null> = {}) {
    super(message ?? code);
    this.name = 'PetraError';
    this.code = code;
    this.params = params;
  }
}

export function isPetraError(e: unknown): e is PetraError {
  return e instanceof PetraError;
}
