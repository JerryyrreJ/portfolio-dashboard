import { NextResponse } from 'next/server';

export type ApiErrorDetail = {
  index?: number;
  field?: string;
  code: string;
  message: string;
};

export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
};

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: ApiErrorDetail[],
  headers?: HeadersInit
) {
  const body: ApiErrorPayload = {
    error: {
      code,
      message,
      ...(details && details.length > 0 ? { details } : {}),
    },
  };
  return NextResponse.json(body, { status, headers });
}
