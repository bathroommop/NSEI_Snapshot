export type HealthResponse = { status: string };

export type DatesResponse = { dates: string[] };

export type FilesResponse = {
  files: { symbol: string; name: string }[];
};

export type ExpiriesResponse = {
  symbol: string;
  expiries: string[];
};

export type RealtimeRow = {
  captured_at: string;
  exchange_timestamp: string;
  symbol: string;
  expiry: string;
  strike_price: number;
  option_type: "CE" | "PE";
  open_interest: number | null;
  change_in_oi: number | null;
  pchange_in_oi: number | null;
  total_traded_volume: number | null;
  implied_volatility: number | null;
  last_price: number | null;
  change: number | null;
  pchange: number | null;
  bid_qty: number | null;
  bid_price: number | null;
  ask_qty: number | null;
  ask_price: number | null;
  total_buy_quantity: number | null;
  total_sell_quantity: number | null;
  underlying_value: number | null;
};

export type RealtimeResponse = {
  date: string;
  symbol: string;
  captured_at: string;
  row_count: number;
  expiry_count: number;
  expiries: string[];
  strike_count: number;
  underlying_value: number | null;
  pcr_oi: number | null;
  pcr_volume: number | null;
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
  args:
    | { date: string; symbol: string }
    | { symbol: string; period: string; anchor_date?: string; expiry?: string }
) {
  if (kind === "day") {
    const a = args as { date: string; symbol: string };
    return `${prefix}/v1/download/${a.date}/${a.symbol}.csv`;
  }
  const a = args as { symbol: string; period: string; anchor_date?: string; expiry?: string };
  const q = new URLSearchParams({ period: a.period });
  if (a.anchor_date) q.set("anchor_date", a.anchor_date);
  if (a.expiry) q.set("expiry", a.expiry);
  return `${prefix}/v1/download-range/${a.symbol}.csv?${q.toString()}`;
}

export function nseiDownloadAllUrl(args: {
  date?: string;
  start_date?: string;
  end_date?: string;
  period?: "day" | "week" | "month";
  anchor_date?: string;
  symbols?: string;
  split_by_expiry?: boolean;
}) {
  const q = new URLSearchParams();
  if (args.date) q.set("date", args.date);
  if (args.start_date) q.set("start_date", args.start_date);
  if (args.end_date) q.set("end_date", args.end_date);
  if (args.period) q.set("period", args.period);
  if (args.anchor_date) q.set("anchor_date", args.anchor_date);
  if (args.symbols) q.set("symbols", args.symbols);
  if (typeof args.split_by_expiry === "boolean") {
    q.set("split_by_expiry", args.split_by_expiry ? "true" : "false");
  }
  return `${prefix}/v1/download-all.zip?${q.toString()}`;
}
