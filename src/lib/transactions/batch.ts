import { randomBytes } from 'node:crypto';

export const IMPORT_BATCH_ID_PREFIX = 'imp_';
export const IMPORT_BATCH_ID_PATTERN = /^imp_[a-f0-9]{32}$/;

export function createImportBatchId() {
  return `${IMPORT_BATCH_ID_PREFIX}${randomBytes(16).toString('hex')}`;
}

export function isImportBatchId(value: unknown): value is string {
  return typeof value === 'string' && IMPORT_BATCH_ID_PATTERN.test(value);
}
