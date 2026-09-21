# Transactions Import API

Public REST endpoints for importing trades with a user API key. Session-cookie routes (`POST /api/transactions`) are unchanged and remain for the in-app UI.

Create and revoke keys in **Settings → Account & Security → API Management**. The plaintext secret is shown only once at creation.

## Auth

All `/api/v1/*` routes require:

```
Authorization: Bearer folio_sk_<secret>
```

Do not send session cookies. Invalid or revoked keys return:

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid or missing API key. Use Authorization: Bearer <api_key>."
  }
}
```

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/portfolios` | List portfolios owned by the key's user |
| `GET` | `/api/v1/transactions` | List recent trades in an owned portfolio |
| `POST` | `/api/v1/transactions/import` | Preview or write one or many BUY/SELL trades |
| `DELETE` | `/api/v1/transactions/imports/:batchId` | Undo one successful import batch |

There is a single write shape: `transactions` is always an array. A single trade is `transactions.length === 1`.

## `POST /api/v1/transactions/import`

### Body

```json
{
  "portfolioId": "clxxxxxxxx",
  "dryRun": false,
  "idempotencyKey": "optional-request-key",
  "transactions": [
    {
      "type": "BUY",
      "date": "2026-03-18",
      "quantity": 10,
      "price": 189.12,
      "ticker": "AAPL",
      "fee": 0.99,
      "currency": "USD",
      "notes": "optional",
      "clientKey": "optional-per-item-fingerprint"
    }
  ]
}
```

`symbol` is accepted as an alias of `ticker`. `fingerprint` is accepted as an alias of `clientKey`.

| Field | Required | Notes |
| --- | --- | --- |
| `portfolioId` | yes | Must belong to the API key's user |
| `transactions` | yes | Array, length 1–100 |
| `transactions[].type` | yes | `BUY` or `SELL` |
| `transactions[].date` | yes | ISO-8601 date or datetime |
| `transactions[].quantity` | yes | Positive number |
| `transactions[].price` | yes | Positive number |
| `transactions[].ticker` or `symbol` | yes | Resolved/created the same way as in-app sync (`Asset.ticker` upsert) |
| `transactions[].fee` | no | Non-negative, default `0` |
| `transactions[].currency` | no | 3-letter code; inferred from ticker suffix when omitted |
| `transactions[].notes` | no | Max 2000 characters |
| `transactions[].name` | no | Used only when creating a new asset |
| `transactions[].market` | no | Inferred from ticker suffix when omitted |
| `transactions[].clientKey` | no | Per-item idempotency fingerprint, unique per portfolio |
| `dryRun` | no | `true` validates and returns per-item results without writing |
| `idempotencyKey` | no | Same as the `Idempotency-Key` header |

Writes reuse the same ownership and numeric rules as in-app creates (`portfolio` must be owned; quantity/price > 0; fee ≥ 0; FX via `getPriceUSD`).

### Atomicity

When `dryRun` is omitted or `false`, the batch is **all-or-nothing**:

- Any validation error writes nothing and returns `400` with per-item `error.details`.
- A `clientKey` that already points at a *different* trade returns `409` and writes nothing.
- If every item is valid, all new rows are created in one database transaction.

`dryRun: true` never writes.

### Import batches

A successful non-dry-run import always includes `importBatchId` plus the existing per-item `results`.

- Newly created rows are stamped with that batch id.
- Exact `clientKey` matches (`status: "existing"`) keep their original batch; they are not moved onto the new one.
- Request-level `Idempotency-Key` replays return the original stored `importBatchId`.
- A full `clientKey` replay that creates nothing returns the shared original `importBatchId` when every existing row belongs to one batch; otherwise `importBatchId` is `null`.
- Dry-run responses do not include `importBatchId`.

`DELETE /api/v1/transactions/imports/:batchId` removes only rows with that stamp, and only if their portfolio is owned by the API key's user. Unrelated trades (UI entries, dividends, other import batches) are never deleted.

After an undo, a replay of the same `Idempotency-Key` still returns the original stored response and does **not** recreate rows. Use a new `Idempotency-Key` to import again.

### Idempotency

Retries should not duplicate trades:

1. **Request key** — send `Idempotency-Key` (header or body). Folio reserves the key before writing so concurrent retries cannot double-insert. Replays of the same body return the original response for 24 hours (`Idempotency-Replayed: true`). A reused key with a different body returns `409 IDEMPOTENCY_KEY_REUSED`. A retry that arrives while the first request is still writing returns `409 IDEMPOTENCY_IN_PROGRESS`. Dry-run requests do not store the key.
2. **Per-item `clientKey`** — unique per `(portfolioId, clientKey)`. An exact match is returned as `status: "existing"` instead of inserting a second row.

### Limits

- Max `100` transactions per request (`413 TOO_MANY_TRANSACTIONS` if exceeded).
- 60 import requests / minute / API key (and a matching IP pre-auth limit).
- Structured errors use `{ error: { code, message, details? } }` so clients can fix the request.

## `GET /api/v1/transactions`

Read-only list of recent trades in one owned portfolio. Intended for reconciliation (see what is already stored, match `clientKey` / dates, avoid duplicates). Newest trade date first.

### Query

| Param | Required | Notes |
| --- | --- | --- |
| `portfolioId` | yes | Must belong to the API key's user (`404 PORTFOLIO_NOT_FOUND` otherwise) |
| `limit` | no | Positive integer, default `50`, max `100` |
| `since` | no | Inclusive lower bound on trade `date`. Date-only `YYYY-MM-DD` is start of that UTC day |
| `until` | no | Inclusive upper bound on trade `date`. Date-only `YYYY-MM-DD` is end of that UTC day |
| `cursor` | no | Opaque `nextCursor` from a previous response |

Returns every transaction the user owns in that portfolio (API imports, in-app BUY/SELL, dividends, and so on). There is no PATCH/update on this API.

### Response

```json
{
  "transactions": [
    {
      "id": "clxxxxxxxx",
      "portfolioId": "clxxxxxxxx",
      "type": "BUY",
      "date": "2026-03-18T00:00:00.000Z",
      "quantity": 10,
      "price": 189.12,
      "fee": 0.99,
      "currency": "USD",
      "notes": null,
      "clientKey": "broker-fill-123",
      "importBatchId": "imp_ab12...",
      "source": "api",
      "asset": {
        "ticker": "AAPL",
        "name": "Apple Inc.",
        "market": "US"
      }
    }
  ],
  "nextCursor": null
}
```

`nextCursor` is set when another page exists. Pass it as `cursor` unchanged, and repeat the same `portfolioId`, `since`, `until`, and `limit`. 60 list requests / minute / API key (and a matching IP pre-auth limit).

## `DELETE /api/v1/transactions/imports/:batchId`

Deletes only transactions that were created in that import batch and are owned by the API key's user.

| Outcome | Status |
| --- | --- |
| Batch exists and rows were removed | `200` with `{ success: true, importBatchId, deleted }` |
| Unknown batch, already undone, or owned by another user | `404 IMPORT_BATCH_NOT_FOUND` |
| Missing/invalid API key | `401 UNAUTHORIZED` |

`deleted` is the number of rows removed. A second undo of the same id is `404`. Wrong-user lookups are also `404` so batch existence is not leaked.

## Examples

Replace `$FOLIO_API_KEY`, `$PORTFOLIO_ID`, `$IMPORT_BATCH_ID`, and the origin as needed. Production origin is `https://folio.jerrylu.xyz`.

### List portfolios

```bash
curl -sS https://folio.jerrylu.xyz/api/v1/portfolios \
  -H "Authorization: Bearer $FOLIO_API_KEY"
```

### List recent trades

```bash
curl -sS "https://folio.jerrylu.xyz/api/v1/transactions?portfolioId=$PORTFOLIO_ID&limit=50" \
  -H "Authorization: Bearer $FOLIO_API_KEY"
```

Filter by trade date and continue with `nextCursor`:

```bash
curl -sS "https://folio.jerrylu.xyz/api/v1/transactions?portfolioId=$PORTFOLIO_ID&since=2026-01-01&until=2026-03-31&limit=50" \
  -H "Authorization: Bearer $FOLIO_API_KEY"

curl -sS "https://folio.jerrylu.xyz/api/v1/transactions?portfolioId=$PORTFOLIO_ID&limit=50&cursor=$NEXT_CURSOR" \
  -H "Authorization: Bearer $FOLIO_API_KEY"
```

### One trade

```bash
curl -sS https://folio.jerrylu.xyz/api/v1/transactions/import \
  -H "Authorization: Bearer $FOLIO_API_KEY" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: trade-aapl-2026-03-18" \
  -d '{
    "portfolioId": "'"$PORTFOLIO_ID"'",
    "transactions": [
      {
        "type": "BUY",
        "date": "2026-03-18",
        "quantity": 10,
        "price": 189.12,
        "ticker": "AAPL",
        "fee": 0.99,
        "currency": "USD",
        "clientKey": "broker-fill-123"
      }
    ]
  }'
```

A successful write looks like:

```json
{
  "success": true,
  "dryRun": false,
  "importBatchId": "imp_ab12...",
  "imported": 1,
  "replayed": 0,
  "results": [
    {
      "index": 0,
      "status": "created",
      "transaction": {
        "id": "clxxxxxxxx",
        "type": "BUY",
        "importBatchId": "imp_ab12...",
        "clientKey": "broker-fill-123"
      }
    }
  ]
}
```

### N trades

```bash
curl -sS https://folio.jerrylu.xyz/api/v1/transactions/import \
  -H "Authorization: Bearer $FOLIO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "portfolioId": "'"$PORTFOLIO_ID"'",
    "transactions": [
      {
        "type": "BUY",
        "date": "2026-03-18",
        "quantity": 10,
        "price": 189.12,
        "ticker": "AAPL"
      },
      {
        "type": "SELL",
        "date": "2026-04-02",
        "quantity": 4,
        "price": 201.5,
        "symbol": "AAPL",
        "fee": 1
      }
    ]
  }'
```

### Preview without writing (`dryRun`)

```bash
curl -sS https://folio.jerrylu.xyz/api/v1/transactions/import \
  -H "Authorization: Bearer $FOLIO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "portfolioId": "'"$PORTFOLIO_ID"'",
    "dryRun": true,
    "transactions": [
      {
        "type": "BUY",
        "date": "2026-03-18",
        "quantity": 10,
        "price": 189.12,
        "ticker": "AAPL"
      }
    ]
  }'
```

A successful dry-run returns `dryRun: true`, `imported: 0`, and per-item `status: "valid"` with the normalized payload. Nothing is persisted, and `importBatchId` is omitted.

### Undo an import batch

```bash
curl -sS -X DELETE https://folio.jerrylu.xyz/api/v1/transactions/imports/$IMPORT_BATCH_ID \
  -H "Authorization: Bearer $FOLIO_API_KEY"
```

```json
{
  "success": true,
  "importBatchId": "imp_ab12...",
  "deleted": 2
}
```

## Unsupported / out of scope

This public API is import + reconcile only. The following are **not** available on `/api/v1`:

- Updating trades (`PATCH` / `PUT`)
- Deleting arbitrary individual trades (only whole-batch undo via `DELETE /api/v1/transactions/imports/:batchId`)
- Importing `DIVIDEND` or any type other than `BUY` / `SELL`
- Creating, renaming, or deleting portfolios (list owned portfolios only)
- Broker / brokerage connections
- OCR or statement-file parsing
- MCP
- Webhooks
- Holdings, quotes, charts, or in-app dividend confirmation/sync
- Session-cookie auth on `/api/v1` (Bearer API keys only)
