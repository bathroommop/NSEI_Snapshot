# Backend Changes (Round 3)

## Endpoint upgrades completed

- Extended range download endpoint:
  - `GET /v1/download-range/{symbol}.csv?period=day|week|month&anchor_date=YYYY-MM-DD&expiry=DD-MMM-YYYY`
  - Added `symbol=ALL` mode for bundled downloads.
- Added full export endpoint:
  - `GET /v1/download-all.zip?date=YYYY-MM-DD&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&period=day|week|month&anchor_date=YYYY-MM-DD&symbols=ALL|CSV&split_by_expiry=true|false`

## Download behavior updates

- `download-range` with single symbol:
  - `period=day` returns one CSV.
  - `period=week|month` returns ZIP with one CSV per available day.
- `download-range` with `symbol=ALL`:
  - Expands to `BANKNIFTY`, `FINNIFTY`, `NIFTY`.
  - `period=day` returns ZIP split by symbol and expiry.
  - `period=week|month` returns ZIP with one CSV per symbol per day.
- `download-all.zip`:
  - Exports all selected dates and symbols in one ZIP.
  - `split_by_expiry=true` writes separate files per expiry.
  - `split_by_expiry=false` writes one file per symbol/date.

## Query parameter behavior

- `date` selects one specific date.
- `period` + optional `anchor_date` selects day/week/month window.
- `start_date` and `end_date` select a custom date range.
- `symbols=ALL` maps to `BANKNIFTY, FINNIFTY, NIFTY`.
- `symbols=NIFTY,BANKNIFTY` style custom list is supported.
- In `download-range`, `expiry` cannot be combined with `symbol=ALL`.

## File naming in ZIP output

- Range bundle examples:
  - `NIFTY_2026-04-21.csv`
  - `BANKNIFTY_2026-04-21_2026-04-24.csv`
- Full export examples:
  - `date=2026-04-21/NIFTY.csv`
  - `date=2026-04-21/NIFTY_2026-04-24.csv`

## Documentation updates

- Updated `endpoints.md` with:
  - `symbol=ALL` behavior for `download-range`.
  - New `download-all.zip` endpoint.
  - Ready-to-run `curl` examples for full and filtered exports.

## Validation

- `api/main.py` compile check passed.
- Lint check passed for updated files.
