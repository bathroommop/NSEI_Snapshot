# NSEI option-chain collector

This module collects NSE option-chain snapshots for one or more instruments at 1-minute frequency and stores:

- raw JSON snapshots for auditability
- one rolling CSV per instrument per day for analysis

## Structure

- `src/nsei/client.py` - NSE session/bootstrap and fetch logic
- `src/nsei/normalize.py` - JSON to flat tabular rows
- `src/nsei/storage.py` - raw/CSV storage paths
- `src/nsei/collector.py` - one snapshot collection entrypoint
- `scripts/run_option_chain_day.py` - market-hours polling loop

## Run once

```bash
python3 scripts/run_option_chain_day.py --symbol NIFTY --once
```

## Run for the day

```bash
python3 scripts/run_option_chain_day.py --symbol NIFTY
python3 scripts/run_option_chain_day.py --symbol NIFTY --symbol BANKNIFTY --symbol FINNIFTY
```

## Automate On macOS

Use the launchd wrapper:

- `scripts/run_option_chain_launchd.sh`
- `scripts/install_launchd.sh`
- `launchd/com.aryan.nsei_snapshot.plist`

The plist starts the collector at `09:15` on weekdays and the script keeps polling until market close.

Install and load it with:

```bash
scripts/install_launchd.sh
```

## Output layout

Raw snapshots:

- `data/raw/option_chain/YYYY-MM-DD/NIFTY/HHMMSS.json`

Processed snapshots:

- `data/processed/option_chain/date=YYYY-MM-DD/NIFTY.csv`
- `data/processed/option_chain/date=YYYY-MM-DD/BANKNIFTY.csv`

## Notes

- NSE may require cookie/bootstrap refreshes, so the client first hits the option-chain page before calling the JSON endpoint.
- The collector appends each minute's snapshot into the day's CSV for that instrument.
- For true daily automation on macOS, the next step is to wire this script into `launchd`.
