import { describe, expect, it } from 'vitest';
import {
  escapeCsvValue,
  serializeTransactionExportCsv,
  type TransactionExportPayload,
} from '@/lib/export-core';

function payload(name: string, notes = ''): TransactionExportPayload {
  return {
    portfolio: { id: 'portfolio', name: 'Portfolio', currency: 'USD' },
    exportDate: '2026-09-22T00:00:00.000Z',
    range: 'all',
    filters: { ticker: null, type: null },
    transactionCount: 1,
    transactions: [{
      transactionId: 'transaction',
      portfolioId: 'portfolio',
      portfolioName: 'Portfolio',
      date: '2026-09-22',
      ticker: 'AAPL',
      name,
      market: 'US',
      type: 'BUY',
      quantity: 1,
      price: 10,
      priceUSD: 10,
      currency: 'USD',
      exchangeRate: 1,
      fee: 0,
      grossAmount: 10,
      grossAmountUSD: 10,
      totalValue: '10',
      totalValueUSD: '10',
      notes,
      createdAt: '2026-09-22T00:00:00.000Z',
      updatedAt: '2026-09-22T00:00:00.000Z',
    }],
  };
}

describe('CSV formula injection protection', () => {
  it.each(['=1+1', '+cmd', '-2+3', '@SUM(A1:A2)', '  =1+1'])(
    'neutralizes a dangerous text cell starting with %s',
    (value) => expect(escapeCsvValue(value)).toBe(`'${value}`),
  );

  it.each(['\t=1+1', '\r@SUM(A1:A2)', '\n-cmd', '\u0000+cmd'])(
    'neutralizes a leading control character',
    (value) => {
      const escaped = escapeCsvValue(value);
      expect(escaped.startsWith("'") || escaped.startsWith("\"'")).toBe(true);
    },
  );

  it('quotes after neutralizing and protects exported names and notes', () => {
    const csv = serializeTransactionExportCsv(payload('=SUM(1,2)', '\t@SUM(A1:A2)'));
    expect(csv).toContain('"\'=SUM(1,2)"');
    expect(csv).toContain("'\t@SUM(A1:A2)");
    expect(csv).not.toContain(',=SUM(1,2),');
  });

  it('does not turn numeric values into text', () => {
    expect(escapeCsvValue(-10)).toBe('-10');
    expect(escapeCsvValue(12.5)).toBe('12.5');
  });
});
