from __future__ import annotations

import io
import os
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/v1/dates", dependencies=[Depends(require_api_key)])
def list_dates() -> dict[str, list[str]]:
    bucket = gcs_bucket_name()
    if bucket:
        if storage is None:
            raise HTTPException(status_code=500, detail="google-cloud-storage not installed")
        client = storage.Client()
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
        return {"dates": sorted(dates)}
    root = processed_dir(data_root())
    if not root.exists():
        return {"dates": []}
    out: list[str] = []
    for p in sorted(root.iterdir()):
        if p.is_dir() and p.name.startswith("date="):
            out.append(p.name.removeprefix("date="))
    return {"dates": out}


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
