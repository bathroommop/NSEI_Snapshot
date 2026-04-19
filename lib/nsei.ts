export type HealthResponse = { status: string };

export type DatesResponse = { dates: string[] };

export type FilesResponse = {
  files: { symbol: string; name: string }[];
};

export type RealtimeRow = {
  captured_at: string;
  exchange_timestamp: string;
  symbol: string;
  expiry: string;
  strike_price: number;
  option_type: string;
  open_interest: number;
  change_in_oi: number;
  pchange_in_oi: number;
  total_traded_volume: number;
  implied_volatility: number;
  last_price: number;
  change: number;
  pchange: number;
  bid_qty: number;
  bid_price: number;
  ask_qty: number;
  ask_price: number;
  total_buy_quantity: number;
  total_sell_quantity: number;
  underlying_value: number;
};

export type RealtimeResponse = {
  date: string;
  symbol: string;
  captured_at: string;
  rows: RealtimeRow[];
};

const prefix = "/api/nsei";

export function humanizeApiError(status: number, rawBody: string): string {
  let detail = "";
  try {
    const j = JSON.parse(rawBody) as { detail?: unknown };
    if (typeof j.detail === "string") detail = j.detail;
  } catch {
    detail = rawBody.trim();
  }
  const low = detail.toLowerCase();
  if (status === 401 || low.includes("unauthorized")) return "Not authorized";
  if (
    status === 404 ||
    low.includes("no data") ||
    low.includes("not found") ||
    low.includes("file not found")
  ) {
    return "No data available";
  }
  if (detail && !detail.startsWith("{")) {
    return detail.length > 160 ? "No data available" : detail;
  }
  return "No data available";
}

export async function fetchNseiJson<T>(path: string): Promise<T> {
  const res = await fetch(`${prefix}${path}`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(humanizeApiError(res.status, text || res.statusText));
  }
  return res.json() as Promise<T>;
}

export function nseiDownloadUrl(
  kind: "day" | "range",
  args: { date: string; symbol: string } | { symbol: string; period: string; anchor_date?: string }
) {
  if (kind === "day") {
    const a = args as { date: string; symbol: string };
    return `${prefix}/v1/download/${a.date}/${a.symbol}.csv`;
  }
  const a = args as { symbol: string; period: string; anchor_date?: string };
  const q = new URLSearchParams({ period: a.period });
  if (a.anchor_date) q.set("anchor_date", a.anchor_date);
  return `${prefix}/v1/download-range/${a.symbol}.csv?${q.toString()}`;
}
