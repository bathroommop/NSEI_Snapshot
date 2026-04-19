from __future__ import annotations

import io
import os
from datetime import date, datetime, timedelta
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
import pandas as pd

try:
    from google.cloud import storage
except ImportError:
    storage = None


def data_root() -> Path:
    return Path(os.environ.get("NSEI_DATA_ROOT", Path(__file__).resolve().parents[1]))


def gcs_bucket_name() -> str | None:
    v = os.environ.get("NSEI_GCS_BUCKET", "").strip()
    return v or None


def gcs_prefix() -> str:
    return os.environ.get("NSEI_GCS_PREFIX", "nsei/processed/option_chain").strip().strip("/")


def require_api_key(x_api_key: str | None = Header(None, alias="X-API-Key")) -> None:
    expected = os.environ.get("NSEI_API_KEY", "").strip()
    if not expected:
        return
    if (x_api_key or "").strip() != expected:
        raise HTTPException(status_code=401, detail="Unauthorized")


def processed_dir(base: Path) -> Path:
    return base / "data" / "processed" / "option_chain"


app = FastAPI(title="NSEI snapshot API")


class FileItem(BaseModel):
    symbol: str
    name: str


class RealtimeSnapshot(BaseModel):
    date: str
    symbol: str
    captured_at: str
    rows: list[dict]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


def parse_iso_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD") from exc


def iter_period_dates(period: str, anchor: date) -> list[str]:
    if period == "day":
        return [anchor.isoformat()]
    if period == "week":
        start = anchor - timedelta(days=anchor.weekday())
        return [(start + timedelta(days=i)).isoformat() for i in range(7)]
    if period == "month":
        start = anchor.replace(day=1)
        next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
        days = (next_month - start).days
        return [(start + timedelta(days=i)).isoformat() for i in range(days)]
    raise HTTPException(status_code=400, detail="period must be one of: day, week, month")


def list_available_dates_local() -> list[str]:
    root = processed_dir(data_root())
    if not root.exists():
        return []
    out: list[str] = []
    for p in sorted(root.iterdir()):
        if p.is_dir() and p.name.startswith("date="):
            out.append(p.name.removeprefix("date="))
    return out


def list_available_dates_gcs(client: "storage.Client", bucket: str) -> list[str]:
    b = client.bucket(bucket)
    prefix = gcs_prefix() + "/"
    dates: set[str] = set()
    for blob in client.list_blobs(b, prefix=prefix):
        name = blob.name
        if "/date=" not in name:
            continue
        part = name.split("date=", 1)[1]
        d = part.split("/", 1)[0]
        if len(d) == 10 and d[4] == "-" and d[7] == "-":
            dates.add(d)
    return sorted(dates)


def read_symbol_frame_local(d: str, symbol: str) -> pd.DataFrame | None:
    path = processed_dir(data_root()) / f"date={d}" / f"{symbol}.csv"
    if not path.is_file():
        return None
    return pd.read_csv(path)


def read_symbol_frame_gcs(client: "storage.Client", bucket: str, d: str, symbol: str) -> pd.DataFrame | None:
    b = client.bucket(bucket)
    key = f"{gcs_prefix()}/date={d}/{symbol}.csv"
    blob = b.blob(key)
    if not blob.exists():
        return None
    return pd.read_csv(io.BytesIO(blob.download_as_bytes()))


@app.get("/v1/dates", dependencies=[Depends(require_api_key)])
def list_dates() -> dict[str, list[str]]:
    bucket = gcs_bucket_name()
    if bucket:
        if storage is None:
            raise HTTPException(status_code=500, detail="google-cloud-storage not installed")
        client = storage.Client()
        return {"dates": list_available_dates_gcs(client, bucket)}
    return {"dates": list_available_dates_local()}


@app.get("/v1/files", dependencies=[Depends(require_api_key)])
def list_files(date: str) -> dict[str, list[FileItem]]:
    bucket = gcs_bucket_name()
    if bucket:
        if storage is None:
            raise HTTPException(status_code=500, detail="google-cloud-storage not installed")
        client = storage.Client()
        b = client.bucket(bucket)
        base = f"{gcs_prefix()}/date={date}/"
        items: list[FileItem] = []
        for blob in client.list_blobs(b, prefix=base):
            name = blob.name.rsplit("/", 1)[-1]
            if not name.endswith(".csv"):
                continue
            sym = name.removesuffix(".csv")
            items.append(FileItem(symbol=sym, name=name))
        return {"files": sorted(items, key=lambda x: x.symbol)}
    day_dir = processed_dir(data_root()) / f"date={date}"
    if not day_dir.is_dir():
        raise HTTPException(status_code=404, detail="Date not found")
    items = []
    for p in sorted(day_dir.glob("*.csv")):
        items.append(FileItem(symbol=p.stem, name=p.name))
    return {"files": items}


@app.get(
    "/v1/download/{date}/{symbol}.csv",
    dependencies=[Depends(require_api_key)],
    response_model=None,
)
def download_csv(date: str, symbol: str) -> FileResponse | StreamingResponse:
    bucket = gcs_bucket_name()
    if bucket:
        if storage is None:
            raise HTTPException(status_code=500, detail="google-cloud-storage not installed")
        client = storage.Client()
        b = client.bucket(bucket)
        key = f"{gcs_prefix()}/date={date}/{symbol}.csv"
        blob = b.blob(key)
        if not blob.exists():
            raise HTTPException(status_code=404, detail="File not found")
        data = blob.download_as_bytes()
        return StreamingResponse(
            io.BytesIO(data),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{symbol}_{date}.csv"'},
        )
    path = processed_dir(data_root()) / f"date={date}" / f"{symbol}.csv"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        path,
        media_type="text/csv",
        filename=f"{symbol}_{date}.csv",
    )


@app.get("/v1/realtime/{symbol}", dependencies=[Depends(require_api_key)], response_model=RealtimeSnapshot)
def realtime_snapshot(symbol: str) -> RealtimeSnapshot:
    symbol = symbol.upper()
    bucket = gcs_bucket_name()
    dates: list[str]
    latest_frame: pd.DataFrame | None = None
    latest_date: str | None = None

    if bucket:
        if storage is None:
            raise HTTPException(status_code=500, detail="google-cloud-storage not installed")
        client = storage.Client()
        dates = list_available_dates_gcs(client, bucket)
        for d in reversed(dates):
            frame = read_symbol_frame_gcs(client, bucket, d, symbol)
            if frame is not None and not frame.empty:
                latest_frame = frame
                latest_date = d
                break
    else:
        dates = list_available_dates_local()
        for d in reversed(dates):
            frame = read_symbol_frame_local(d, symbol)
            if frame is not None and not frame.empty:
                latest_frame = frame
                latest_date = d
                break

    if latest_frame is None or latest_date is None:
        raise HTTPException(status_code=404, detail="No data found for symbol")
    if "captured_at" not in latest_frame.columns:
        raise HTTPException(status_code=500, detail="captured_at column missing")

    latest_capture = str(latest_frame["captured_at"].max())
    rows = latest_frame[latest_frame["captured_at"] == latest_capture].to_dict(orient="records")
    return RealtimeSnapshot(date=latest_date, symbol=symbol, captured_at=latest_capture, rows=rows)


@app.get("/v1/download-range/{symbol}.csv", dependencies=[Depends(require_api_key)], response_model=None)
def download_range_csv(symbol: str, period: str, anchor_date: str | None = None) -> StreamingResponse:
    symbol = symbol.upper()
    bucket = gcs_bucket_name()
    period = period.lower().strip()

    if anchor_date:
        anchor = parse_iso_date(anchor_date)
    else:
        if bucket:
            if storage is None:
                raise HTTPException(status_code=500, detail="google-cloud-storage not installed")
            client = storage.Client()
            dates = list_available_dates_gcs(client, bucket)
        else:
            dates = list_available_dates_local()
        if not dates:
            raise HTTPException(status_code=404, detail="No data available")
        anchor = parse_iso_date(dates[-1])

    dates_for_period = iter_period_dates(period, anchor)
    frames: list[pd.DataFrame] = []

    if bucket:
        if storage is None:
            raise HTTPException(status_code=500, detail="google-cloud-storage not installed")
        client = storage.Client()
        for d in dates_for_period:
            frame = read_symbol_frame_gcs(client, bucket, d, symbol)
            if frame is not None and not frame.empty:
                frames.append(frame)
    else:
        for d in dates_for_period:
            frame = read_symbol_frame_local(d, symbol)
            if frame is not None and not frame.empty:
                frames.append(frame)

    if not frames:
        raise HTTPException(status_code=404, detail="No data found for requested range")

    merged = pd.concat(frames, ignore_index=True)
    buffer = io.StringIO()
    merged.to_csv(buffer, index=False)
    payload = buffer.getvalue().encode("utf-8")

    first_date = dates_for_period[0]
    last_date = dates_for_period[-1]
    filename = f"{symbol}_{period}_{first_date}_to_{last_date}.csv"
    return StreamingResponse(
        io.BytesIO(payload),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
