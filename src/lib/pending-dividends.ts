export const PENDING_DIVIDEND_STATUS_PENDING = 'pending' as const;
export const PENDING_DIVIDEND_STATUS_CONFIRMED = 'confirmed' as const;
export const PENDING_DIVIDEND_STATUS_IGNORED = 'ignored' as const;
export const PENDING_DIVIDEND_STATUS_VOIDED = 'voided' as const;

export type PendingDividendStatus =
  | typeof PENDING_DIVIDEND_STATUS_PENDING
  | typeof PENDING_DIVIDEND_STATUS_CONFIRMED
  | typeof PENDING_DIVIDEND_STATUS_IGNORED
  | typeof PENDING_DIVIDEND_STATUS_VOIDED;

export const PENDING_DIVIDEND_CONFIRMATION_MODE_CASH = 'cash' as const;
export const PENDING_DIVIDEND_CONFIRMATION_MODE_REINVEST = 'reinvest' as const;

export type PendingDividendConfirmationMode =
  | typeof PENDING_DIVIDEND_CONFIRMATION_MODE_CASH
  | typeof PENDING_DIVIDEND_CONFIRMATION_MODE_REINVEST;

export function isPendingDividendPending(status: string) {
  return status === PENDING_DIVIDEND_STATUS_PENDING;
}

export function isPendingDividendFrozen(status: string) {
  return status !== PENDING_DIVIDEND_STATUS_PENDING;
}

export function toDateOnlyString(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return value.toISOString().slice(0, 10);
}

export function isDateOnlyAfter(
  value: Date | string | null | undefined,
  baseline: Date | string | null | undefined,
) {
  const left = toDateOnlyString(value);
  const right = toDateOnlyString(baseline);
  if (!left || !right) return false;
  return left > right;
}
