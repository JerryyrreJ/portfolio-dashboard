import { createHash, randomBytes } from 'node:crypto';

export const API_KEY_PREFIX = 'folio_sk_';
export const MAX_API_KEYS_PER_USER = 10;
export const MAX_API_KEY_NAME_LENGTH = 80;

export function hashApiKey(plaintext: string) {
  return createHash('sha256').update(plaintext).digest('hex');
}

export function generateApiKey() {
  const secret = randomBytes(32).toString('hex');
  const plaintext = `${API_KEY_PREFIX}${secret}`;
  return {
    plaintext,
    keyHash: hashApiKey(plaintext),
    prefix: plaintext.slice(0, API_KEY_PREFIX.length + 8),
    lastFour: secret.slice(-4),
  };
}

export function maskApiKey(prefix: string, lastFour: string) {
  return `${prefix}••••${lastFour}`;
}

export function looksLikeApiKey(value: string) {
  return value.startsWith(API_KEY_PREFIX) && value.length === API_KEY_PREFIX.length + 64;
}

export function normalizeApiKeyName(value: unknown, fallback = 'Default') {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }
  if (trimmed.length > MAX_API_KEY_NAME_LENGTH) {
    return null;
  }
  return trimmed;
}
