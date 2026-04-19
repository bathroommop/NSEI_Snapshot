from __future__ import annotations

from datetime import datetime
from typing import Any

import pandas as pd


def normalize_option_chain(payload: dict[str, Any], captured_at: datetime) -> pd.DataFrame:
    records: list[dict[str, Any]] = []
    timestamp = payload.get("records", {}).get("timestamp")
    data = payload.get("records", {}).get("data", [])

    for entry in data:
        strike = entry.get("strikePrice")
        for option_type in ("CE", "PE"):
            leg = entry.get(option_type)
            if not leg:
                continue
            records.append(
                {
                    "captured_at": captured_at.isoformat(),
                    "exchange_timestamp": timestamp,
                    "symbol": leg.get("underlying"),
                    "expiry": leg.get("expiryDate"),
                    "strike_price": strike,
                    "option_type": option_type,
                    "open_interest": leg.get("openInterest"),
                    "change_in_oi": leg.get("changeinOpenInterest"),
                    "pchange_in_oi": leg.get("pchangeinOpenInterest"),
                    "total_traded_volume": leg.get("totalTradedVolume"),
                    "implied_volatility": leg.get("impliedVolatility"),
                    "last_price": leg.get("lastPrice"),
                    "change": leg.get("change"),
                    "pchange": leg.get("pchange"),
                    "bid_qty": leg.get("buyQuantity1"),
                    "bid_price": leg.get("buyPrice1"),
                    "ask_qty": leg.get("sellQuantity1"),
                    "ask_price": leg.get("sellPrice1"),
                    "total_buy_quantity": leg.get("totalBuyQuantity"),
                    "total_sell_quantity": leg.get("totalSellQuantity"),
                    "underlying_value": leg.get("underlyingValue"),
                }
            )

    return pd.DataFrame.from_records(records)
