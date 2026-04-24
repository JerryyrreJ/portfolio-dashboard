'use client';

import type {
  CreateLedgerPortfolioInput,
  CreateLedgerTransactionInput,
  LedgerBootstrapPayload,
  LedgerNamespace,
  LedgerPortfolioRecord,
  LedgerSyncOperation,
  LedgerTransactionRecord,
  UpdateLedgerPortfolioInput,
  UpdateLedgerTransactionInput,
} from '@/lib/ledger/types';
import { USD_RATES } from '@/lib/currency';

const DB_NAME = 'folio-ledger';
const DB_VERSION = 1;
const META_STORE = 'meta';
const PORTFOLIOS_STORE = 'portfolios';
const TRANSACTIONS_STORE = 'transactions';
const SYNC_STORE = 'syncQueue';
const LEGACY_MIGRATION_KEY = 'legacy-migration-v1';
const DEFAULT_GUEST_PORTFOLIO_ID = 'local-portfolio';

const listeners = new Set<() => void>();

type MetaRecord = {
  key: string;
  value: string;
};

type LedgerDatabase = IDBDatabase;

function notifyLedgerListeners() {
  listeners.forEach((listener) => listener());
}

export function subscribeLedger(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function createStorageKey(namespace: LedgerNamespace, id: string) {
  return `${namespace}:${id}`;
}

function nowIso() {
  return new Date().toISOString();
}

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function openLedgerDb(): Promise<LedgerDatabase> {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is unavailable in this environment.');
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains(PORTFOLIOS_STORE)) {
        const store = db.createObjectStore(PORTFOLIOS_STORE, { keyPath: 'storageKey' });
        store.createIndex('namespace', 'namespace', { unique: false });
      }

      if (!db.objectStoreNames.contains(TRANSACTIONS_STORE)) {
        const store = db.createObjectStore(TRANSACTIONS_STORE, { keyPath: 'storageKey' });
        store.createIndex('namespace', 'namespace', { unique: false });
        store.createIndex('namespacePortfolio', ['namespace', 'portfolioId'], { unique: false });
      }

      if (!db.objectStoreNames.contains(SYNC_STORE)) {
        const store = db.createObjectStore(SYNC_STORE, { keyPath: 'id' });
        store.createIndex('namespace', 'namespace', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open ledger database.'));
  });
}

function runRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

async function readByIndex<T>(
  db: LedgerDatabase,
  storeName: string,
  indexName: string,
  query: IDBValidKey | IDBKeyRange,
): Promise<T[]> {
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const index = store.index(indexName);
  const result = await runRequest(index.getAll(query));
  return result as T[];
}

async function putMany<T extends object>(
  db: LedgerDatabase,
  storeName: string,
  rows: T[],
): Promise<void> {
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  rows.forEach((row) => store.put(row));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error(`Failed to write to ${storeName}.`));
  });
}

async function deleteMany(
  db: LedgerDatabase,
  storeName: string,
  keys: string[],
): Promise<void> {
  if (keys.length === 0) return;

  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  keys.forEach((key) => store.delete(key));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error(`Failed to delete from ${storeName}.`));
  });
}

async function getMetaValue(key: string): Promise<string | null> {
  const db = await openLedgerDb();
  const tx = db.transaction(META_STORE, 'readonly');
  const store = tx.objectStore(META_STORE);
  const record = await runRequest(store.get(key)) as MetaRecord | undefined;
  return record?.value ?? null;
}

async function setMetaValue(key: string, value: string): Promise<void> {
  const db = await openLedgerDb();
  const tx = db.transaction(META_STORE, 'readwrite');
  const store = tx.objectStore(META_STORE);
  store.put({ key, value } satisfies MetaRecord);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to persist ledger metadata.'));
  });
}

function toLedgerPortfolioRecord(input: CreateLedgerPortfolioInput): LedgerPortfolioRecord {
  const id = input.id ?? createId();
  const updatedAt = nowIso();
  return {
    storageKey: createStorageKey(input.namespace, id),
    namespace: input.namespace,
    id,
    name: input.name.trim(),
    currency: input.currency,
    preferences: input.preferences ?? null,
    settingsUpdatedAt: updatedAt,
    updatedAt,
    syncState: input.namespace === 'guest' ? 'synced' : 'pending',
  };
}

function toLedgerTransactionRecord(input: CreateLedgerTransactionInput): LedgerTransactionRecord {
  const id = input.id ?? createId();
  const updatedAt = nowIso();
  return {
    storageKey: createStorageKey(input.namespace, id),
    namespace: input.namespace,
    id,
    portfolioId: input.portfolioId,
    type: input.type,
    eventId: input.eventId ?? null,
    source: input.source ?? null,
    subtype: input.subtype ?? null,
    isSystemGenerated: input.isSystemGenerated ?? false,
    date: input.date,
    quantity: input.quantity,
    price: input.price,
    priceUSD: input.priceUSD,
    exchangeRate: input.exchangeRate,
    fee: input.fee,
    currency: input.currency,
    notes: input.notes ?? null,
    asset: {
      ticker: input.asset.ticker.toUpperCase(),
      name: input.asset.name,
      market: input.asset.market || 'US',
      currency: input.asset.currency || input.currency,
      logo: input.asset.logo ?? null,
    },
    updatedAt,
    syncState: input.namespace === 'guest' ? 'synced' : 'pending',
  };
}

async function enqueueSyncOperation(operation: LedgerSyncOperation): Promise<void> {
  const db = await openLedgerDb();
  await putMany(db, SYNC_STORE, [operation]);
}

async function getQueuedOperations(namespace: LedgerNamespace): Promise<LedgerSyncOperation[]> {
  const db = await openLedgerDb();
  const rows = await readByIndex<LedgerSyncOperation>(db, SYNC_STORE, 'namespace', namespace);
  return rows.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
}

export async function clearQueuedOperations(ids: string[]): Promise<void> {
  const db = await openLedgerDb();
  await deleteMany(db, SYNC_STORE, ids);
}

export async function ensureLegacyMigration(): Promise<void> {
  if (typeof window === 'undefined') return;
  const migrated = await getMetaValue(LEGACY_MIGRATION_KEY);
  if (migrated === 'done') return;

  const db = await openLedgerDb();
  const existingGuestPortfolios = await readByIndex<LedgerPortfolioRecord>(db, PORTFOLIOS_STORE, 'namespace', 'guest');
  if (existingGuestPortfolios.length > 0) {
    await setMetaValue(LEGACY_MIGRATION_KEY, 'done');
    return;
  }

  const portfolioName = window.localStorage.getItem('portfolio_name')?.trim() || 'My Portfolio';
  const currency = window.localStorage.getItem('base_currency')?.trim() || 'USD';
  const preferences = window.localStorage.getItem('user_preferences');
  const settingsUpdatedAt = window.localStorage.getItem('settings_updated_at') || nowIso();
  const rawTransactions = window.localStorage.getItem('local_transactions');

  const guestPortfolio: LedgerPortfolioRecord = {
    storageKey: createStorageKey('guest', DEFAULT_GUEST_PORTFOLIO_ID),
    namespace: 'guest',
    id: DEFAULT_GUEST_PORTFOLIO_ID,
    name: portfolioName,
    currency,
    preferences,
    settingsUpdatedAt,
    updatedAt: settingsUpdatedAt,
    syncState: 'synced',
  };

  const parsedTransactions = rawTransactions ? JSON.parse(rawTransactions) as Array<Record<string, unknown>> : [];
  const migratedTransactions = parsedTransactions.map((transaction) => {
    const asset = (transaction.asset ?? {}) as Record<string, unknown>;
    const txCurrency = typeof transaction.currency === 'string' ? transaction.currency : currency;
    const exchangeRate = Number(transaction.exchangeRate ?? USD_RATES[txCurrency] ?? 1) || 1;
    const price = Number(transaction.price ?? 0) || 0;
    const id = typeof transaction.id === 'string' && !transaction.id.startsWith('local-')
      ? transaction.id
      : createId();
    return {
      storageKey: createStorageKey('guest', id),
      namespace: 'guest' as const,
      id,
      portfolioId: DEFAULT_GUEST_PORTFOLIO_ID,
      type: typeof transaction.type === 'string' && transaction.type === 'DIVIDEND' ? 'DIVIDEND' : typeof transaction.type === 'string' && transaction.type === 'SELL' ? 'SELL' : 'BUY',
      eventId: typeof transaction.eventId === 'string' ? transaction.eventId : null,
      source: typeof transaction.source === 'string' ? transaction.source : null,
      subtype: typeof transaction.subtype === 'string' ? transaction.subtype : null,
      isSystemGenerated: Boolean(transaction.isSystemGenerated),
      date: typeof transaction.date === 'string' ? transaction.date : nowIso(),
      quantity: Number(transaction.quantity ?? 0) || 0,
      price,
      priceUSD: Number(transaction.priceUSD ?? (exchangeRate ? price / exchangeRate : price)) || price,
      exchangeRate,
      fee: Number(transaction.fee ?? 0) || 0,
      currency: txCurrency,
      notes: typeof transaction.notes === 'string' ? transaction.notes : null,
      asset: {
        ticker: typeof asset.ticker === 'string' ? asset.ticker.toUpperCase() : 'UNKNOWN',
        name: typeof asset.name === 'string' ? asset.name : typeof asset.ticker === 'string' ? asset.ticker.toUpperCase() : 'Unknown Asset',
        market: typeof asset.market === 'string' ? asset.market : 'US',
        currency: typeof asset.currency === 'string' ? asset.currency : txCurrency,
        logo: typeof asset.logo === 'string' ? asset.logo : null,
      },
      updatedAt: typeof transaction.date === 'string' ? transaction.date : settingsUpdatedAt,
      syncState: 'synced' as const,
    } satisfies LedgerTransactionRecord;
  });

  await putMany(db, PORTFOLIOS_STORE, [guestPortfolio]);
  if (migratedTransactions.length > 0) {
    await putMany(db, TRANSACTIONS_STORE, migratedTransactions);
  }
  await setMetaValue(LEGACY_MIGRATION_KEY, 'done');
  notifyLedgerListeners();
}

export async function listPortfolios(namespace: LedgerNamespace): Promise<LedgerPortfolioRecord[]> {
  await ensureLegacyMigration();
  const db = await openLedgerDb();
  const portfolios = await readByIndex<LedgerPortfolioRecord>(db, PORTFOLIOS_STORE, 'namespace', namespace);
  if (portfolios.length === 0 && namespace === 'guest') {
    const fallback = toLedgerPortfolioRecord({
      namespace: 'guest',
      id: DEFAULT_GUEST_PORTFOLIO_ID,
      name: 'My Portfolio',
      currency: 'USD',
    });
    fallback.syncState = 'synced';
    fallback.settingsUpdatedAt = nowIso();
    await putMany(db, PORTFOLIOS_STORE, [fallback]);
    notifyLedgerListeners();
    return [fallback];
  }

  return portfolios.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listTransactions(namespace: LedgerNamespace, portfolioId?: string): Promise<LedgerTransactionRecord[]> {
  await ensureLegacyMigration();
  const db = await openLedgerDb();
  const transactions = portfolioId
    ? await readByIndex<LedgerTransactionRecord>(db, TRANSACTIONS_STORE, 'namespacePortfolio', [namespace, portfolioId])
    : await readByIndex<LedgerTransactionRecord>(db, TRANSACTIONS_STORE, 'namespace', namespace);
  return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getPortfolio(namespace: LedgerNamespace, id: string): Promise<LedgerPortfolioRecord | null> {
  const portfolios = await listPortfolios(namespace);
  return portfolios.find((portfolio) => portfolio.id === id) ?? null;
}

export async function createPortfolio(input: CreateLedgerPortfolioInput): Promise<LedgerPortfolioRecord> {
  const db = await openLedgerDb();
  const record = toLedgerPortfolioRecord(input);
  await putMany(db, PORTFOLIOS_STORE, [record]);

  if (input.namespace !== 'guest') {
    await enqueueSyncOperation({
      id: createId(),
      namespace: input.namespace,
      entity: 'portfolio',
      action: 'upsert',
      recordId: record.id,
      payload: {
        id: record.id,
        name: record.name,
        currency: record.currency,
        preferences: record.preferences ?? null,
        settingsUpdatedAt: record.settingsUpdatedAt ?? null,
        updatedAt: record.updatedAt,
      },
      updatedAt: record.updatedAt,
    });
  }

  notifyLedgerListeners();
  return record;
}

export async function updatePortfolio(input: UpdateLedgerPortfolioInput): Promise<LedgerPortfolioRecord | null> {
  const db = await openLedgerDb();
  const tx = db.transaction(PORTFOLIOS_STORE, 'readwrite');
  const store = tx.objectStore(PORTFOLIOS_STORE);
  const storageKey = createStorageKey(input.namespace, input.id);
  const existing = await runRequest(store.get(storageKey)) as LedgerPortfolioRecord | undefined;

  if (!existing) {
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    return null;
  }

  const updatedAt = nowIso();
  const next: LedgerPortfolioRecord = {
    ...existing,
    name: input.name?.trim() ?? existing.name,
    currency: input.currency ?? existing.currency,
    preferences: input.preferences === undefined ? existing.preferences : input.preferences,
    settingsUpdatedAt: input.settingsUpdatedAt ?? updatedAt,
    updatedAt,
    syncState: input.namespace === 'guest' ? 'synced' : 'pending',
  };
  store.put(next);

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to update portfolio.'));
  });

  if (input.namespace !== 'guest') {
    await enqueueSyncOperation({
      id: createId(),
      namespace: input.namespace,
      entity: 'portfolio',
      action: 'upsert',
      recordId: next.id,
      payload: {
        id: next.id,
        name: next.name,
        currency: next.currency,
        preferences: next.preferences ?? null,
        settingsUpdatedAt: next.settingsUpdatedAt ?? null,
        updatedAt: next.updatedAt,
      },
      updatedAt: next.updatedAt,
    });
  }

  notifyLedgerListeners();
  return next;
}

export async function deletePortfolio(namespace: LedgerNamespace, id: string): Promise<void> {
  const db = await openLedgerDb();
  const portfolioStorageKey = createStorageKey(namespace, id);
  const transactions = await listTransactions(namespace, id);
  const txKeys = transactions.map((transaction) => transaction.storageKey);

  await deleteMany(db, PORTFOLIOS_STORE, [portfolioStorageKey]);
  await deleteMany(db, TRANSACTIONS_STORE, txKeys);

  if (namespace !== 'guest') {
    await enqueueSyncOperation({
      id: createId(),
      namespace,
      entity: 'portfolio',
      action: 'delete',
      recordId: id,
      payload: { id },
      updatedAt: nowIso(),
    });

    for (const transaction of transactions) {
      await enqueueSyncOperation({
        id: createId(),
        namespace,
        entity: 'transaction',
        action: 'delete',
        recordId: transaction.id,
        payload: { id: transaction.id },
        updatedAt: nowIso(),
      });
    }
  }

  notifyLedgerListeners();
}

export async function createTransaction(input: CreateLedgerTransactionInput): Promise<LedgerTransactionRecord> {
  const db = await openLedgerDb();
  const record = toLedgerTransactionRecord(input);
  await putMany(db, TRANSACTIONS_STORE, [record]);

  if (input.namespace !== 'guest') {
    await enqueueSyncOperation({
      id: createId(),
      namespace: input.namespace,
      entity: 'transaction',
      action: 'upsert',
      recordId: record.id,
      payload: serializeTransactionForSync(record),
      updatedAt: record.updatedAt,
    });
  }

  notifyLedgerListeners();
  return record;
}

function serializeTransactionForSync(record: LedgerTransactionRecord) {
  return {
    id: record.id,
    portfolioId: record.portfolioId,
    type: record.type,
    eventId: record.eventId ?? null,
    source: record.source ?? null,
    subtype: record.subtype ?? null,
    isSystemGenerated: record.isSystemGenerated ?? false,
    date: record.date,
    quantity: record.quantity,
    price: record.price,
    priceUSD: record.priceUSD,
    exchangeRate: record.exchangeRate,
    fee: record.fee,
    currency: record.currency,
    notes: record.notes ?? null,
    asset: record.asset,
    updatedAt: record.updatedAt,
  };
}

export async function updateTransaction(input: UpdateLedgerTransactionInput): Promise<LedgerTransactionRecord | null> {
  const db = await openLedgerDb();
  const tx = db.transaction(TRANSACTIONS_STORE, 'readwrite');
  const store = tx.objectStore(TRANSACTIONS_STORE);
  const storageKey = createStorageKey(input.namespace, input.id);
  const existing = await runRequest(store.get(storageKey)) as LedgerTransactionRecord | undefined;

  if (!existing) {
    await new Promise<void>((resolve) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
    return null;
  }

  const next: LedgerTransactionRecord = {
    ...existing,
    date: input.date ?? existing.date,
    quantity: input.quantity ?? existing.quantity,
    price: input.price ?? existing.price,
    priceUSD: input.priceUSD ?? existing.priceUSD,
    exchangeRate: input.exchangeRate ?? existing.exchangeRate,
    fee: input.fee ?? existing.fee,
    notes: input.notes === undefined ? existing.notes : input.notes,
    updatedAt: nowIso(),
    syncState: input.namespace === 'guest' ? 'synced' : 'pending',
  };
  store.put(next);

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Failed to update transaction.'));
  });

  if (input.namespace !== 'guest') {
    await enqueueSyncOperation({
      id: createId(),
      namespace: input.namespace,
      entity: 'transaction',
      action: 'upsert',
      recordId: next.id,
      payload: serializeTransactionForSync(next),
      updatedAt: next.updatedAt,
    });
  }

  notifyLedgerListeners();
  return next;
}

export async function deleteTransaction(namespace: LedgerNamespace, id: string): Promise<void> {
  const db = await openLedgerDb();
  await deleteMany(db, TRANSACTIONS_STORE, [createStorageKey(namespace, id)]);

  if (namespace !== 'guest') {
    await enqueueSyncOperation({
      id: createId(),
      namespace,
      entity: 'transaction',
      action: 'delete',
      recordId: id,
      payload: { id },
      updatedAt: nowIso(),
    });
  }

  notifyLedgerListeners();
}

export async function replaceNamespaceData(namespace: LedgerNamespace, payload: LedgerBootstrapPayload): Promise<void> {
  const db = await openLedgerDb();
  const existingPortfolios = await listPortfolios(namespace);
  const existingTransactions = await listTransactions(namespace);

  await deleteMany(db, PORTFOLIOS_STORE, existingPortfolios.map((portfolio) => portfolio.storageKey));
  await deleteMany(db, TRANSACTIONS_STORE, existingTransactions.map((transaction) => transaction.storageKey));

  const portfolioRows = payload.portfolios.map((portfolio) => ({
    storageKey: createStorageKey(namespace, portfolio.id),
    namespace,
    id: portfolio.id,
    name: portfolio.name,
    currency: portfolio.currency,
    preferences: portfolio.preferences ?? null,
    settingsUpdatedAt: portfolio.settingsUpdatedAt ?? portfolio.updatedAt ?? nowIso(),
    updatedAt: portfolio.updatedAt ?? nowIso(),
    syncState: 'synced' as const,
  } satisfies LedgerPortfolioRecord));

  const transactionRows = payload.transactions.map((transaction) => ({
    storageKey: createStorageKey(namespace, transaction.id),
    namespace,
    id: transaction.id,
    portfolioId: transaction.portfolioId,
    type: transaction.type,
    eventId: transaction.eventId ?? null,
    source: transaction.source ?? null,
    subtype: transaction.subtype ?? null,
    isSystemGenerated: transaction.isSystemGenerated ?? false,
    date: transaction.date,
    quantity: transaction.quantity,
    price: transaction.price,
    priceUSD: transaction.priceUSD,
    exchangeRate: transaction.exchangeRate,
    fee: transaction.fee,
    currency: transaction.currency,
    notes: transaction.notes ?? null,
    asset: transaction.asset,
    updatedAt: transaction.updatedAt ?? nowIso(),
    syncState: 'synced' as const,
  } satisfies LedgerTransactionRecord));

  if (portfolioRows.length > 0) {
    await putMany(db, PORTFOLIOS_STORE, portfolioRows);
  }
  if (transactionRows.length > 0) {
    await putMany(db, TRANSACTIONS_STORE, transactionRows);
  }

  notifyLedgerListeners();
}

export async function markNamespaceSynced(namespace: LedgerNamespace, recordIds: string[], entity: 'portfolio' | 'transaction'): Promise<void> {
  if (recordIds.length === 0) return;
  const db = await openLedgerDb();
  const storeName = entity === 'portfolio' ? PORTFOLIOS_STORE : TRANSACTIONS_STORE;
  const rows = entity === 'portfolio'
    ? await listPortfolios(namespace)
    : await listTransactions(namespace);

  const nextRows = rows
    .filter((row) => recordIds.includes(row.id))
    .map((row) => ({ ...row, syncState: 'synced' as const }));

  if (nextRows.length > 0) {
    await putMany(db, storeName, nextRows);
    notifyLedgerListeners();
  }
}

export async function cloneGuestDataIntoUserNamespace(userId: string): Promise<void> {
  const namespace: LedgerNamespace = `user:${userId}`;
  const existing = await listPortfolios(namespace);
  if (existing.length > 0) return;

  const guestPortfolios = await listPortfolios('guest');
  const guestTransactions = await listTransactions('guest');
  if (guestPortfolios.length === 0) return;

  const idMap = new Map<string, string>();
  const clonedPortfolios: LedgerPortfolioRecord[] = guestPortfolios.map((portfolio) => {
    const nextId = createId();
    idMap.set(portfolio.id, nextId);
    return {
      ...portfolio,
      storageKey: createStorageKey(namespace, nextId),
      namespace,
      id: nextId,
      updatedAt: nowIso(),
      settingsUpdatedAt: nowIso(),
      syncState: 'pending',
    };
  });

  const clonedTransactions: LedgerTransactionRecord[] = guestTransactions.map((transaction) => {
    const nextId = createId();
    return {
      ...transaction,
      storageKey: createStorageKey(namespace, nextId),
      namespace,
      id: nextId,
      portfolioId: idMap.get(transaction.portfolioId) ?? transaction.portfolioId,
      updatedAt: nowIso(),
      syncState: 'pending',
    };
  });

  const db = await openLedgerDb();
  await putMany(db, PORTFOLIOS_STORE, clonedPortfolios);
  if (clonedTransactions.length > 0) {
    await putMany(db, TRANSACTIONS_STORE, clonedTransactions);
  }

  for (const portfolio of clonedPortfolios) {
    await enqueueSyncOperation({
      id: createId(),
      namespace,
      entity: 'portfolio',
      action: 'upsert',
      recordId: portfolio.id,
      payload: {
        id: portfolio.id,
        name: portfolio.name,
        currency: portfolio.currency,
        preferences: portfolio.preferences ?? null,
        settingsUpdatedAt: portfolio.settingsUpdatedAt ?? null,
        updatedAt: portfolio.updatedAt,
      },
      updatedAt: portfolio.updatedAt,
    });
  }

  for (const transaction of clonedTransactions) {
    await enqueueSyncOperation({
      id: createId(),
      namespace,
      entity: 'transaction',
      action: 'upsert',
      recordId: transaction.id,
      payload: serializeTransactionForSync(transaction),
      updatedAt: transaction.updatedAt,
    });
  }

  notifyLedgerListeners();
}

export async function pullRemoteLedger(userId: string): Promise<LedgerBootstrapPayload | null> {
  const response = await fetch('/api/sync/pull', {
    headers: {
      'X-Ledger-User': userId,
    },
  });

  if (!response.ok) {
    return null;
  }

  return response.json() as Promise<LedgerBootstrapPayload>;
}

export async function pushPendingLedgerChanges(userId: string): Promise<boolean> {
  const namespace: LedgerNamespace = `user:${userId}`;
  const operations = await getQueuedOperations(namespace);
  if (operations.length === 0) return true;

  const response = await fetch('/api/sync/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Ledger-User': userId,
    },
    body: JSON.stringify({ operations }),
  });

  if (!response.ok) {
    return false;
  }

  await clearQueuedOperations(operations.map((operation) => operation.id));
  await markNamespaceSynced(
    namespace,
    operations.filter((operation) => operation.entity === 'portfolio' && operation.action === 'upsert').map((operation) => operation.recordId),
    'portfolio',
  );
  await markNamespaceSynced(
    namespace,
    operations.filter((operation) => operation.entity === 'transaction' && operation.action === 'upsert').map((operation) => operation.recordId),
    'transaction',
  );
  return true;
}

export async function getDefaultActivePortfolioId(namespace: LedgerNamespace): Promise<string> {
  const portfolios = await listPortfolios(namespace);
  return portfolios[0]?.id ?? DEFAULT_GUEST_PORTFOLIO_ID;
}

export function getNamespaceForUser(userId?: string | null): LedgerNamespace {
  return userId ? `user:${userId}` : 'guest';
}

export function getGuestPortfolioId() {
  return DEFAULT_GUEST_PORTFOLIO_ID;
}

export async function getAllTransactions(namespace: LedgerNamespace) {
  return listTransactions(namespace);
}

export async function clearNamespace(namespace: LedgerNamespace): Promise<void> {
  const db = await openLedgerDb();
  const portfolios = await listPortfolios(namespace);
  const transactions = await listTransactions(namespace);
  const queue = await getQueuedOperations(namespace);
  await deleteMany(db, PORTFOLIOS_STORE, portfolios.map((portfolio) => portfolio.storageKey));
  await deleteMany(db, TRANSACTIONS_STORE, transactions.map((transaction) => transaction.storageKey));
  await deleteMany(db, SYNC_STORE, queue.map((item) => item.id));
  notifyLedgerListeners();
}

export async function readSyncQueueSize(namespace: LedgerNamespace) {
  const queue = await getQueuedOperations(namespace);
  return queue.length;
}

export async function getNamespaceSnapshot(namespace: LedgerNamespace) {
  const [portfolios, transactions] = await Promise.all([
    listPortfolios(namespace),
    listTransactions(namespace),
  ]);
  return { portfolios, transactions };
}
