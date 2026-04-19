from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

from .client import NSEOptionChainClient
from .normalize import normalize_option_chain
from .storage import read_cached_expiry, snapshot_paths, write_cached_expiry, write_daily_csv, write_raw_json
from .validate import validate_daily_csv


def collect_option_chain_snapshot(base_dir: str | Path, symbol: str = "NIFTY") -> dict[str, Any]:
    base_path = Path(base_dir)
    captured_at = datetime.now()
    client = NSEOptionChainClient()
    cached_expiry = read_cached_expiry(base_path, symbol)
    payload = client.fetch_option_chain(symbol=symbol, expiry=cached_expiry)
    raw_path, csv_path = snapshot_paths(base_path, symbol=symbol, captured_at=captured_at)
    write_raw_json(raw_path, payload)

    raw_dir = raw_path.parent
    frames: list[pd.DataFrame] = []
    for snapshot_path in sorted(raw_dir.glob("*.json")):
        snapshot_time = datetime.strptime(
            f"{raw_dir.parent.name} {snapshot_path.stem}", "%Y-%m-%d %H%M%S"
        )
        snapshot_payload = json.loads(snapshot_path.read_text(encoding="utf-8"))
        frames.append(normalize_option_chain(snapshot_payload, captured_at=snapshot_time))

    frame = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()
    write_daily_csv(csv_path, frame)
    validate_daily_csv(csv_path)

    expiry = None
    records = payload.get("records", {})
    data = records.get("data") or []
    if data:
        first = data[0]
        expiry = first.get("expiryDates")
        if not expiry:
            leg = first.get("CE") or first.get("PE") or {}
            expiry = leg.get("expiryDate")
    if expiry:
        write_cached_expiry(base_path, symbol, str(expiry))

    return {
        "captured_at": captured_at.isoformat(),
        "symbol": symbol,
        "rows": int(len(frame)),
        "raw_path": str(raw_path),
        "csv_path": str(csv_path),
    }
