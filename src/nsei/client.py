from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import requests

NSE_BASE = "https://www.nseindia.com"
OPTION_CHAIN_PAGE = f"{NSE_BASE}/option-chain?date=select&instrument=OPTIDX&segmentLink=17&symbol=NIFTY"
OPTION_CHAIN_CONTRACT_INFO = f"{NSE_BASE}/api/option-chain-contract-info"
OPTION_CHAIN_V3 = f"{NSE_BASE}/api/option-chain-v3"
DEFAULT_TIMEOUT = 20


@dataclass
class NSEClientConfig:
    symbol: str = "NIFTY"
    timeout: int = DEFAULT_TIMEOUT
    max_retries: int = 3
    sleep_between_retries: float = 1.5


class NSEOptionChainClient:
    def __init__(self, config: NSEClientConfig | None = None) -> None:
        self.config = config or NSEClientConfig()
        self.session = requests.Session()
        self.session.headers.update(
            {
                "user-agent": (
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/123.0.0.0 Safari/537.36"
                ),
                "accept": "application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "accept-language": "en-US,en;q=0.9",
                "referer": OPTION_CHAIN_PAGE,
                "cache-control": "no-cache",
                "pragma": "no-cache",
                "connection": "keep-alive",
            }
        )
        self._bootstrapped = False

    def bootstrap(self) -> None:
        response = self.session.get(OPTION_CHAIN_PAGE, timeout=self.config.timeout)
        response.raise_for_status()
        self._bootstrapped = True

    def _get_json(self, url: str, **params: Any) -> dict[str, Any]:
        response = self.session.get(url, params=params or None, timeout=self.config.timeout)
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise ValueError(f"Unexpected NSE payload type: {type(payload).__name__}")
        return payload

    def fetch_option_chain(self, symbol: str | None = None, expiry: str | None = None) -> dict[str, Any]:
        if not self._bootstrapped:
            self.bootstrap()

        symbol = symbol or self.config.symbol
        last_error: Exception | None = None

        for attempt in range(1, self.config.max_retries + 1):
            try:
                if expiry is None:
                    contract_info = self._get_json(OPTION_CHAIN_CONTRACT_INFO, symbol=symbol)
                    expiry_dates = contract_info.get("expiryDates") or []
                    if expiry_dates:
                        expiry = expiry_dates[0]
                    else:
                        raise ValueError(f"No expiry dates returned for symbol {symbol}")

                payload = self._get_json(
                    OPTION_CHAIN_V3,
                    type="Indices" if symbol in {"NIFTY", "FINNIFTY", "BANKNIFTY", "MIDCPNIFTY", "NIFTYNXT50"} else "Equity",
                    symbol=symbol,
                    expiry=expiry,
                )

                if payload == {}:
                    raise ValueError(
                        f"Empty NSE payload returned for symbol {symbol} and expiry {expiry}"
                    )

                return payload
            except Exception as exc:
                last_error = exc
                if attempt < self.config.max_retries:
                    time.sleep(self.config.sleep_between_retries)
                    self._bootstrapped = False
                    self.bootstrap()
                else:
                    break

        assert last_error is not None
        raise last_error
