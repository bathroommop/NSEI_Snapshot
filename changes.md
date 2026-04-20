# Backend Changes

## API updates completed

- Added realtime endpoint:
  - `GET /v1/realtime/{symbol}`
  - Optional query: `expiry=DD-MMM-YYYY`
- Added expiry list endpoint:
  - `GET /v1/expiries/{symbol}`
  - Returns all available expiries from NSE for the symbol.
- Added range download endpoint:
  - `GET /v1/download-range/{symbol}.csv?period=day|week|month&anchor_date=YYYY-MM-DD&expiry=DD-MMM-YYYY`

## Download behavior

- `period=day`
  - Returns a single CSV file.
- `period=week`
  - Returns a ZIP file with one CSV per available day.
- `period=month`
  - Returns a ZIP file with one CSV per available day.

## Existing endpoints retained

- `GET /health`
- `GET /v1/dates`
- `GET /v1/files?date=YYYY-MM-DD`
- `GET /v1/download/{date}/{symbol}.csv`

## Authentication

- Protected endpoints require:
  - `X-API-Key: <YOUR_API_KEY>`

## Docs updated

- `endpoints.md` updated with new endpoints and examples.
