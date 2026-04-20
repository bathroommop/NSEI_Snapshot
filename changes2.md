# Backend Refinements (Round 2)

## What was improved

- Expanded collection from single-expiry snapshots to multi-expiry snapshots per capture.
- Improved expiry filtering in API so switching expiry values is reliable.
- Normalized expiry input formats to avoid mismatches (for example `21-Apr-2026` and `21-04-2026`).
- Added safer handling for missing/blank expiry values during filtering.
- Stabilized realtime response ordering for cleaner table rendering.

## Code updates

- `src/nsei/client.py`
  - Added `list_expiries(symbol)` to fetch all available NSE expiries.
  - Added `fetch_option_chain_multi_expiry(symbol, expiries)` to merge rows across expiries.
- `src/nsei/collector.py`
  - Collector now attempts multi-expiry fetch first.
  - Falls back to previous single-expiry fetch if NSE multi-expiry path fails.
  - Cached expiry write logic now consistently stores a valid leg expiry.
- `api/main.py`
  - Added expiry normalization and reusable expiry-frame filter helpers.
  - Realtime endpoint now filters by expiry first, then picks latest capture.
  - Download-range endpoint now uses normalized expiry filtering.
  - Realtime rows are sorted by `strike_price` and `option_type`.

## Why this helps

- UI can display richer datasets from the latest capture (many expiries instead of one).
- Expiry dropdown changes no longer fail due to format differences.
- API behavior is more predictable for realtime and downloadable data.

## Validation run

- Python compile checks passed for `api` and `src`.
- Linter check passed for updated files.
- Fresh one-shot capture completed successfully with higher row count.
- Realtime smoke tests passed for multiple expiry formats and dates.

## Expected user-facing impact

- More complete option-chain table data visible per refresh.
- Expiry switch behavior is stable and returns matching rows.
- Cleaner and consistent row ordering in downstream views.
