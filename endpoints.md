# NSEI Snapshot API Endpoints

Base URL (AWS EC2 example):

- `http://18.61.159.121:8080`

Authentication:

- Header: `X-API-Key: <YOUR_API_KEY>`
- If `NSEI_API_KEY` is set on server, protected endpoints require this header.

---

## 1) Health

### `GET /health`

Checks whether API is alive.

#### Example

```bash
curl http://18.61.159.121:8080/health
```

#### Response

```json
{"status":"ok"}
```

---

## 2) List Available Dates

### `GET /v1/dates`

Returns all available processed dates (`YYYY-MM-DD`).

#### Example

```bash
curl -H "X-API-Key: <YOUR_API_KEY>" "http://18.61.159.121:8080/v1/dates"
```

#### Response

```json
{"dates":["2026-04-20","2026-04-21"]}
```

---

## 2.1) List Available Expiry Dates

### `GET /v1/expiries/{symbol}`

Returns all expiry dates currently available on NSE for the symbol.

#### Example

```bash
curl -H "X-API-Key: <YOUR_API_KEY>" "http://18.61.159.121:8080/v1/expiries/NIFTY"
```

#### Response

```json
{"symbol":"NIFTY","expiries":["24-Apr-2026","30-Apr-2026","07-May-2026"]}
```

---

## 3) List Files for a Date

### `GET /v1/files?date=YYYY-MM-DD`

Returns available symbol CSVs for the requested date.

#### Example

```bash
curl -H "X-API-Key: <YOUR_API_KEY>" "http://18.61.159.121:8080/v1/files?date=2026-04-20"
```

#### Response

```json
{
  "files": [
    {"symbol":"BANKNIFTY","name":"BANKNIFTY.csv"},
    {"symbol":"FINNIFTY","name":"FINNIFTY.csv"},
    {"symbol":"NIFTY","name":"NIFTY.csv"}
  ]
}
```

---

## 4) Download One Day CSV (Symbol + Date)

### `GET /v1/download/{date}/{symbol}.csv`

Downloads one symbol CSV for one day.

#### Example

```bash
curl -H "X-API-Key: <YOUR_API_KEY>" -o NIFTY_2026-04-20.csv "http://18.61.159.121:8080/v1/download/2026-04-20/NIFTY.csv"
```

---

## 5) Realtime Snapshot for Symbol

### `GET /v1/realtime/{symbol}?expiry=DD-MMM-YYYY`

Returns latest `captured_at` snapshot rows for the symbol from the latest available date.
`expiry` is optional and filters rows to one expiry date.

#### Example

```bash
curl -H "X-API-Key: <YOUR_API_KEY>" "http://18.61.159.121:8080/v1/realtime/NIFTY"
```

```bash
curl -H "X-API-Key: <YOUR_API_KEY>" "http://18.61.159.121:8080/v1/realtime/NIFTY?expiry=24-Apr-2026"
```

#### Response Shape

```json
{
  "date":"2026-04-20",
  "symbol":"NIFTY",
  "captured_at":"2026-04-20T02:20:13",
  "rows":[
    {
      "captured_at":"2026-04-20T02:20:13",
      "exchange_timestamp":"17-Apr-2026 15:30:00",
      "symbol":"NIFTY",
      "expiry":"21-04-2026",
      "strike_price":24350,
      "option_type":"CE",
      "open_interest":123,
      "change_in_oi":4,
      "pchange_in_oi":3.2,
      "total_traded_volume":1000,
      "implied_volatility":12.3,
      "last_price":10.2,
      "change":-1.0,
      "pchange":-8.9,
      "bid_qty":50,
      "bid_price":10.1,
      "ask_qty":40,
      "ask_price":10.3,
      "total_buy_quantity":500,
      "total_sell_quantity":400,
      "underlying_value":24353.55
    }
  ]
}
```

---

## 6) Download Range CSV (Day / Week / Month)

### `GET /v1/download-range/{symbol}.csv?period=day|week|month&anchor_date=YYYY-MM-DD&expiry=DD-MMM-YYYY`

For requested period:

- `day`: returns one merged CSV for `anchor_date`
- `week`: returns ZIP with one CSV per available day in that week
- `month`: returns ZIP with one CSV per available day in that month

`anchor_date` is optional. If omitted, API uses latest available date.
`expiry` is optional and filters merged CSV to one expiry.
`symbol=ALL` is supported and expands to `BANKNIFTY, FINNIFTY, NIFTY`.
For `symbol=ALL&period=day`, API returns ZIP split by symbol and expiry.

#### Day Example

```bash
curl -H "X-API-Key: <YOUR_API_KEY>" -o NIFTY_day.csv "http://18.61.159.121:8080/v1/download-range/NIFTY.csv?period=day&anchor_date=2026-04-20"
```

```bash
curl -H "X-API-Key: <YOUR_API_KEY>" -o ALL_day.zip "http://18.61.159.121:8080/v1/download-range/ALL.csv?period=day&anchor_date=2026-04-20"
```

#### Week Example

```bash
curl -H "X-API-Key: <YOUR_API_KEY>" -o NIFTY_week.zip "http://18.61.159.121:8080/v1/download-range/NIFTY.csv?period=week&anchor_date=2026-04-20"
```

#### Month Example

```bash
curl -H "X-API-Key: <YOUR_API_KEY>" -o NIFTY_month.zip "http://18.61.159.121:8080/v1/download-range/NIFTY.csv?period=month&anchor_date=2026-04-20"
```

#### Without Anchor Date (latest available date)

```bash
curl -H "X-API-Key: <YOUR_API_KEY>" -o NIFTY_latest_week.csv "http://18.61.159.121:8080/v1/download-range/NIFTY.csv?period=week"
```

---

## 7) Download Everything as ZIP

### `GET /v1/download-all.zip?date=YYYY-MM-DD&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&period=day|week|month&anchor_date=YYYY-MM-DD&symbols=ALL|CSV&split_by_expiry=true|false`

Flexible bulk export endpoint.

Date selection priority:

- if `date` is provided, export that single date
- else if `period` is provided, export dates in that period around `anchor_date` (or latest available date)
- else export from `start_date` to `end_date` (defaults to full available range)

Symbols:

- `symbols=ALL` exports `BANKNIFTY, FINNIFTY, NIFTY`
- You can pass custom symbols like `symbols=NIFTY,BANKNIFTY`

Expiry split:

- `split_by_expiry=true` creates separate files per expiry
- `split_by_expiry=false` keeps one CSV per symbol per date

Examples:

```bash
curl -H "X-API-Key: <YOUR_API_KEY>" -o all_everything.zip "http://18.61.159.121:8080/v1/download-all.zip"
```

```bash
curl -H "X-API-Key: <YOUR_API_KEY>" -o all_today_expiry.zip "http://18.61.159.121:8080/v1/download-all.zip?date=2026-04-21&symbols=ALL&split_by_expiry=true"
```

```bash
curl -H "X-API-Key: <YOUR_API_KEY>" -o all_week.zip "http://18.61.159.121:8080/v1/download-all.zip?period=week&anchor_date=2026-04-21"
```

```bash
curl -H "X-API-Key: <YOUR_API_KEY>" -o custom.zip "http://18.61.159.121:8080/v1/download-all.zip?start_date=2026-04-01&end_date=2026-04-21&symbols=NIFTY,BANKNIFTY"
```

---

## Error Responses

Common status codes:

- `400` invalid query or date format
- `401` missing or invalid API key
- `404` data/date/file not found
- `500` server-side issue

Example error:

```json
{"detail":"File not found"}
```

---

## Quick Windows PowerShell Commands

```powershell
curl.exe http://18.61.159.121:8080/health
curl.exe -H "X-API-Key: <YOUR_API_KEY>" "http://18.61.159.121:8080/v1/dates"
curl.exe -H "X-API-Key: <YOUR_API_KEY>" "http://18.61.159.121:8080/v1/realtime/NIFTY"
curl.exe -H "X-API-Key: <YOUR_API_KEY>" -o NIFTY_week.csv "http://18.61.159.121:8080/v1/download-range/NIFTY.csv?period=week&anchor_date=2026-04-20"
```
