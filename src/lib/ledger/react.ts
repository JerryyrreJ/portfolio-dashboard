'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  clearNamespace,
  cloneGuestDataIntoUserNamespace,
  createPortfolio,
  createTransaction,
  deletePortfolio,
  deleteTransaction,
  ensureLegacyMigration,
  getDefaultActivePortfolioId,
  getNamespaceForUser,
  getNamespaceSnapshot,
  pullRemoteLedger,
  pushPendingLedgerChanges,
  readSyncQueueSize,
  replaceNamespaceData,
  subscribeLedger,
  updatePortfolio,
  updateTransaction,
} from '@/lib/ledger/db';
import { derivePortfolioDashboard } from '@/lib/ledger/derive';
import type {
  CreateLedgerPortfolioInput,
  CreateLedgerTransactionInput,
  LedgerNamespace,
  LedgerPortfolioRecord,
  LedgerTransactionRecord,
  UpdateLedgerPortfolioInput,
  UpdateLedgerTransactionInput,
} from '@/lib/ledger/types';

type LedgerState = {
  ready: boolean;
  namespace: LedgerNamespace;
  portfolios: LedgerPortfolioRecord[];
  transactions: LedgerTransactionRecord[];
  hasPendingSync: boolean;
};

const EMPTY_STATE: LedgerState = {
  ready: false,
  namespace: 'guest',
  portfolios: [],
  transactions: [],
  hasPendingSync: false,
};

async function loadState(namespace: LedgerNamespace): Promise<LedgerState> {
  const { portfolios, transactions } = await getNamespaceSnapshot(namespace);
  const hasPendingSync = namespace === 'guest' ? false : (await readSyncQueueSize(namespace)) > 0;
  return {
    ready: true,
    namespace,
    portfolios,
    transactions,
    hasPendingSync,
  };
}

export function useLedger(user: User | null) {
  const namespace = getNamespaceForUser(user?.id);
  const [state, setState] = useState<LedgerState>(EMPTY_STATE);
  const isBootstrappingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const nextState = await loadState(namespace);
      if (!cancelled) setState(nextState);
    };

    void refresh();
    const unsubscribe = subscribeLedger(() => {
      void refresh();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [namespace]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (isBootstrappingRef.current) return;
      isBootstrappingRef.current = true;

      try {
        await ensureLegacyMigration();

        if (!user?.id) {
          if (!cancelled) {
            const nextState = await loadState(namespace);
            setState(nextState);
          }
          return;
        }

        await cloneGuestDataIntoUserNamespace(user.id);
        const remote = await pullRemoteLedger(user.id);
        const local = await loadState(namespace);

        if (remote && local.portfolios.length === 0 && remote.portfolios.length > 0) {
          await replaceNamespaceData(namespace, remote);
        }

        await pushPendingLedgerChanges(user.id);
        if (!cancelled) {
          const nextState = await loadState(namespace);
          setState(nextState);
        }
      } finally {
        isBootstrappingRef.current = false;
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [namespace, user?.id]);

  useEffect(() => {
    if (!user?.id) return undefined;

    const flush = () => {
      void pushPendingLedgerChanges(user.id);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') flush();
    };

    const intervalId = window.setInterval(flush, 15000);
    window.addEventListener('online', flush);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('online', flush);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [user?.id]);

  const actions = useMemo(() => ({
    createPortfolio: (input: Omit<CreateLedgerPortfolioInput, 'namespace'>) =>
      createPortfolio({ ...input, namespace }),
    updatePortfolio: (input: Omit<UpdateLedgerPortfolioInput, 'namespace'>) =>
      updatePortfolio({ ...input, namespace }),
    deletePortfolio: (id: string) => deletePortfolio(namespace, id),
    createTransaction: (input: Omit<CreateLedgerTransactionInput, 'namespace'>) =>
      createTransaction({ ...input, namespace }),
    updateTransaction: (input: Omit<UpdateLedgerTransactionInput, 'namespace'>) =>
      updateTransaction({ ...input, namespace }),
    deleteTransaction: (id: string) => deleteTransaction(namespace, id),
    syncNow: async () => {
      if (!user?.id) return false;
      const success = await pushPendingLedgerChanges(user.id);
      const nextState = await loadState(namespace);
      setState(nextState);
      return success;
    },
    resetUserNamespace: () => user?.id ? clearNamespace(namespace) : Promise.resolve(),
  }), [namespace, user?.id]);

  return {
    ...state,
    ...actions,
  };
}

export function usePortfolioLedger(user: User | null, portfolioId?: string) {
  const ledger = useLedger(user);
  const activePortfolioId = portfolioId || ledger.portfolios[0]?.id;
  const transactions = useMemo(
    () => ledger.transactions.filter((transaction) => !activePortfolioId || transaction.portfolioId === activePortfolioId),
    [activePortfolioId, ledger.transactions],
  );

  return {
    ...ledger,
    activePortfolioId,
    transactions,
  };
}

export function usePortfolioDashboard(user: User | null, portfolioId: string | undefined, livePrices: Record<string, number>, costBasisMethod: 'FIFO' | 'AVCO' = 'FIFO') {
  const ledger = usePortfolioLedger(user, portfolioId);
  const derived = useMemo(
    () => derivePortfolioDashboard(ledger.transactions, livePrices, costBasisMethod),
    [costBasisMethod, ledger.transactions, livePrices],
  );

  return {
    ...ledger,
    ...derived,
  };
}

export async function resolveActivePortfolioId(user: User | null) {
  const namespace = getNamespaceForUser(user?.id);
  return getDefaultActivePortfolioId(namespace);
}
