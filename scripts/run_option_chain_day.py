#!/usr/bin/env python3
from __future__ import annotations

import argparse
import logging
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from nsei.collector import collect_option_chain_snapshot

IST = ZoneInfo("Asia/Kolkata")


def is_weekday_ist(now: datetime) -> bool:
    return now.weekday() < 5


def within_market_hours(now: datetime, start_hhmm: str, end_hhmm: str) -> bool:
    current = now.strftime("%H:%M")
    return start_hhmm <= current <= end_hhmm


def seconds_until_next_weekday_open(now: datetime, start_hhmm: str) -> float:
    h, m = map(int, start_hhmm.split(":"))
    target = now.replace(hour=h, minute=m, second=0, microsecond=0)
    if now < target and is_weekday_ist(now):
        return max(0.0, (target - now).total_seconds())
    days_ahead = 0
    probe = now
    for _ in range(8):
        days_ahead += 1
        probe = now + timedelta(days=days_ahead)
        if is_weekday_ist(probe):
            open_day = probe.replace(hour=h, minute=m, second=0, microsecond=0)
            return max(0.0, (open_day - now).total_seconds())
    return 3600.0


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Collect NSE option-chain snapshots at 1-minute frequency and append daily CSVs"
    )
    parser.add_argument(
        "--symbol",
        action="append",
        dest="symbols",
        help="Instrument symbol to collect. Pass multiple times for multiple instruments.",
    )
    parser.add_argument("--interval-seconds", type=int, default=60)
    parser.add_argument("--start", default="09:00")
    parser.add_argument("--end", default="15:30")
    parser.add_argument("--weekdays-only", action="store_true", default=True)
    parser.add_argument("--no-weekdays-only", action="store_false", dest="weekdays_only")
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    symbols = args.symbols or ["NIFTY"]

    log_dir = ROOT / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / f"option_chain_{datetime.now(IST).strftime('%Y-%m-%d')}.log"

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s | %(levelname)s | %(message)s",
        handlers=[logging.FileHandler(log_path), logging.StreamHandler(sys.stdout)],
    )

    while True:
        now = datetime.now(IST)

        if args.once:
            for symbol in symbols:
                result = collect_option_chain_snapshot(ROOT, symbol=symbol)
                logging.info("Captured snapshot: %s", result)
            return

        if args.weekdays_only and not is_weekday_ist(now):
            wait = seconds_until_next_weekday_open(now, args.start)
            logging.info("Outside weekday IST window, sleeping %.0fs", wait)
            time.sleep(min(wait, 3600.0))
            continue

        if within_market_hours(now, args.start, args.end):
            for symbol in symbols:
                try:
                    result = collect_option_chain_snapshot(ROOT, symbol=symbol)
                    logging.info("Captured snapshot: %s", result)
                except Exception as exc:
                    logging.exception("Snapshot fetch failed for %s: %s", symbol, exc)
            time.sleep(args.interval_seconds)
            continue

        logging.info("Outside market window (IST), sleeping")
        time.sleep(args.interval_seconds)


if __name__ == "__main__":
    main()
