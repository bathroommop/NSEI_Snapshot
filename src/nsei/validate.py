from __future__ import annotations

from pathlib import Path

import pandas as pd

EXPECTED_COLUMNS = [
    "captured_at",
    "exchange_timestamp",
    "symbol",
    "expiry",
    "strike_price",
    "option_type",
    "open_interest",
    "change_in_oi",
    "pchange_in_oi",
    "total_traded_volume",
    "implied_volatility",
    "last_price",
    "change",
    "pchange",
    "bid_qty",
    "bid_price",
    "ask_qty",
    "ask_price",
    "total_buy_quantity",
    "total_sell_quantity",
    "underlying_value",
]


def validate_daily_csv(path: str | Path) -> None:
    csv_path = Path(path)
    frame = pd.read_csv(csv_path)
    columns = list(frame.columns)
    missing = [col for col in EXPECTED_COLUMNS if col not in columns]
    extra = [col for col in columns if col not in EXPECTED_COLUMNS]

    if missing or extra:
        raise ValueError(
            f"{csv_path} has unexpected columns. missing={missing}, extra={extra}, columns={columns}"
        )

    if frame.empty:
        raise ValueError(f"{csv_path} is empty")
