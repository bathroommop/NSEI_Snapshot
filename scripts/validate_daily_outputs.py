#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))

from nsei.validate import validate_daily_csv


def main() -> None:
    parser = argparse.ArgumentParser(description="Validate per-instrument daily option-chain CSVs")
    parser.add_argument("--date", default=datetime.now().strftime("%Y-%m-%d"))
    args = parser.parse_args()

    day_dir = ROOT / "data" / "processed" / "option_chain" / f"date={args.date}"
    if not day_dir.exists():
        raise SystemExit(f"No daily output directory found: {day_dir}")

    failures: list[str] = []
    csvs = sorted(day_dir.glob("*.csv"))
    if not csvs:
        raise SystemExit(f"No CSV files found in {day_dir}")

    for csv_path in csvs:
        try:
            validate_daily_csv(csv_path)
            print(f"OK  {csv_path.name}")
        except Exception as exc:
            failures.append(f"{csv_path.name}: {exc}")
            print(f"ERR {csv_path.name}: {exc}")

    if failures:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
