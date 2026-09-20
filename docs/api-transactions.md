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
| `POST` | `/api/v1/transactions/import` | Preview or write one or many BUY/SELL trades |

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

### Idempotency

Retries should not duplicate trades:

1. **Request key** — send `Idempotency-Key` (header or body). Folio reserves the key before writing so concurrent retries cannot double-insert. Replays of the same body return the original response for 24 hours (`Idempotency-Replayed: true`). A reused key with a different body returns `409 IDEMPOTENCY_KEY_REUSED`. A retry that arrives while the first request is still writing returns `409 IDEMPOTENCY_IN_PROGRESS`. Dry-run requests do not store the key.
2. **Per-item `clientKey`** — unique per `(portfolioId, clientKey)`. An exact match is returned as `status: "existing"` instead of inserting a second row.

### Limits

- Max `100` transactions per request (`413 TOO_MANY_TRANSACTIONS` if exceeded).
- 60 import requests / minute / API key (and a matching IP pre-auth limit).
- Structured errors use `{ error: { code, message, details? } }` so clients can fix the request.

## Examples

Replace `$FOLIO_API_KEY`, `$PORTFOLIO_ID`, and the origin as needed. Production origin is `https://folio.jerrylu.xyz`.

### List portfolios

```bash
curl -sS https://folio.jerrylu.xyz/api/v1/portfolios \
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

A successful dry-run returns `dryRun: true`, `imported: 0`, and per-item `status: "valid"` with the normalized payload. Nothing is persisted.
