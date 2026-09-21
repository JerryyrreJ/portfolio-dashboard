import { NextResponse } from 'next/server';

export const PUBLIC_API_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key',
  'Access-Control-Max-Age': '86400',
} as const;

export function publicApiOptionsResponse() {
  return new NextResponse(null, {
    status: 204,
    headers: PUBLIC_API_CORS_HEADERS,
  });
}

export function withPublicApiHeaders(headers?: HeadersInit) {
  return {
    ...PUBLIC_API_CORS_HEADERS,
    ...(headers ?? {}),
  };
}
