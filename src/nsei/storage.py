from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd


def snapshot_paths(base_dir: Path, symbol: str, captured_at: datetime) -> tuple[Path, Path]:
    day = captured_at.strftime("%Y-%m-%d")
    stamp = captured_at.strftime("%H%M%S")
    raw_dir = base_dir / "data" / "raw" / "option_chain" / day / symbol
    processed_dir = base_dir / "data" / "processed" / "option_chain" / f"date={day}"
    raw_dir.mkdir(parents=True, exist_ok=True)
    processed_dir.mkdir(parents=True, exist_ok=True)
    return raw_dir / f"{stamp}.json", processed_dir / f"{symbol}.csv"


def write_raw_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_daily_csv(path: Path, frame: pd.DataFrame) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if frame.empty:
        return
    frame.to_csv(path, index=False)


def expiry_cache_path(base_dir: Path, symbol: str) -> Path:
    cache_dir = base_dir / "state"
    cache_dir.mkdir(parents=True, exist_ok=True)
    return cache_dir / f"option_chain_expiry_{symbol}.txt"


def read_cached_expiry(base_dir: Path, symbol: str) -> str | None:
    path = expiry_cache_path(base_dir, symbol)
    if not path.exists():
        return None
    expiry = path.read_text(encoding="utf-8").strip()
    return expiry or None


def write_cached_expiry(base_dir: Path, symbol: str, expiry: str) -> None:
    path = expiry_cache_path(base_dir, symbol)
    path.write_text(expiry.strip() + "\n", encoding="utf-8")
