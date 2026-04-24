export type LedgerNamespace = 'guest' | `user:${string}`;

export type LedgerSyncState = 'synced' | 'pending';

export interface LedgerAssetSnapshot {
  ticker: string;
  name: string;
  market: string;
  currency: string;
  logo?: string | null;
}

export interface LedgerPortfolioRecord {
  storageKey: string;
  namespace: LedgerNamespace;
  id: string;
  name: string;
  currency: string;
  preferences?: string | null;
  settingsUpdatedAt?: string | null;
  updatedAt: string;
  syncState: LedgerSyncState;
}

export interface LedgerTransactionRecord {
  storageKey: string;
  namespace: LedgerNamespace;
  id: string;
  portfolioId: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND';
  eventId?: string | null;
  source?: string | null;
  subtype?: string | null;
  isSystemGenerated?: boolean;
  date: string;
  quantity: number;
  price: number;
  priceUSD: number;
  exchangeRate: number;
  fee: number;
  currency: string;
  notes?: string | null;
  asset: LedgerAssetSnapshot;
  updatedAt: string;
  syncState: LedgerSyncState;
}

export interface LedgerSyncOperation {
  id: string;
  namespace: LedgerNamespace;
  entity: 'portfolio' | 'transaction';
  action: 'upsert' | 'delete';
  recordId: string;
  payload: Record<string, unknown>;
  updatedAt: string;
}

export interface LedgerBootstrapPayload {
  portfolios: Array<{
    id: string;
    name: string;
    currency: string;
    preferences?: string | null;
    settingsUpdatedAt?: string | null;
    updatedAt?: string | null;
  }>;
  transactions: Array<{
    id: string;
    portfolioId: string;
    type: 'BUY' | 'SELL' | 'DIVIDEND';
    eventId?: string | null;
    source?: string | null;
    subtype?: string | null;
    isSystemGenerated?: boolean;
    date: string;
    quantity: number;
    price: number;
    priceUSD: number;
    exchangeRate: number;
    fee: number;
    currency: string;
    notes?: string | null;
    updatedAt?: string | null;
    asset: LedgerAssetSnapshot;
  }>;
}

export interface CreateLedgerPortfolioInput {
  namespace: LedgerNamespace;
  name: string;
  currency: string;
  preferences?: string | null;
  id?: string;
}

export interface UpdateLedgerPortfolioInput {
  id: string;
  namespace: LedgerNamespace;
  name?: string;
  currency?: string;
  preferences?: string | null;
  settingsUpdatedAt?: string | null;
}

export interface CreateLedgerTransactionInput {
  namespace: LedgerNamespace;
  portfolioId: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND';
  eventId?: string | null;
  source?: string | null;
  subtype?: string | null;
  isSystemGenerated?: boolean;
  date: string;
  quantity: number;
  price: number;
  priceUSD: number;
  exchangeRate: number;
  fee: number;
  currency: string;
  notes?: string | null;
  asset: LedgerAssetSnapshot;
  id?: string;
}

export interface UpdateLedgerTransactionInput {
  id: string;
  namespace: LedgerNamespace;
  date?: string;
  quantity?: number;
  price?: number;
  priceUSD?: number;
  exchangeRate?: number;
  fee?: number;
  notes?: string | null;
}
