#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    try:
        from google.cloud import storage
    except ImportError as exc:
        raise SystemExit("Install google-cloud-storage: pip install google-cloud-storage") from exc

    parser = argparse.ArgumentParser(description="Upload processed daily CSV folders to GCS")
    parser.add_argument("--date", help="YYYY-MM-DD (default: today in Asia/Kolkata)")
    parser.add_argument("--all", action="store_true", help="Upload every date= folder under processed")
    args = parser.parse_args()

    bucket_name = os.environ.get("NSEI_GCS_BUCKET", "").strip()
    if not bucket_name:
        raise SystemExit("Set NSEI_GCS_BUCKET")

    prefix = os.environ.get("NSEI_GCS_PREFIX", "nsei/processed/option_chain").strip().strip("/")
    base = ROOT / "data" / "processed" / "option_chain"

    if args.all:
        if not base.is_dir():
            raise SystemExit(f"Missing {base}")
        dirs = sorted(p for p in base.iterdir() if p.is_dir() and p.name.startswith("date="))
        if not dirs:
            raise SystemExit("No date folders found")
    else:
        from datetime import datetime
        from zoneinfo import ZoneInfo

        d = args.date or datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%Y-%m-%d")
        dirs = [base / f"date={d}"]
        if not dirs[0].is_dir():
            raise SystemExit(f"No folder for date {d}: {dirs[0]}")

    client = storage.Client()
    bucket = client.bucket(bucket_name)

    for day_dir in dirs:
        rel = day_dir.relative_to(base)
        for path in day_dir.rglob("*"):
            if not path.is_file():
                continue
            blob_path = f"{prefix}/{rel.as_posix()}/{path.relative_to(day_dir).as_posix()}"
            blob = bucket.blob(blob_path)
            blob.upload_from_filename(str(path))
            print("uploaded", blob_path)

    print("done")


if __name__ == "__main__":
    main()
