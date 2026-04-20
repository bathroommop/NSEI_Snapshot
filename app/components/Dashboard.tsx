"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type ExpiriesResponse,
  fetchNseiJson,
  nseiDownloadUrl,
  type DatesResponse,
  type FilesResponse,
  type HealthResponse,
  type RealtimeResponse,
  type RealtimeRow,
} from "@/lib/nsei";

function formatNum(n: number | null | undefined, digits = 2) {
  const value = typeof n === "number" ? n : NaN;
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function cellNeg(n: number | null | undefined) {
  const value = typeof n === "number" ? n : NaN;
  if (!Number.isFinite(value)) return "";
  return value < 0 ? "text-red-400" : value > 0 ? "text-emerald-400/90" : "";
}

function noticeClass(message: string) {
  return message === "Not authorized"
    ? "border-red-500/40 bg-red-500/10 text-red-300"
    : "border-[var(--line)] bg-[var(--card)] text-[var(--muted)]";
}

function parseFileName(disposition: string | null, fallback: string) {
  if (!disposition) return fallback;
  const star = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (star) return decodeURIComponent(star);
  const plain = disposition.match(/filename="?([^"]+)"?/i)?.[1];
  return plain?.trim() || fallback;
}

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthErr, setHealthErr] = useState<string | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [datesErr, setDatesErr] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [files, setFiles] = useState<FilesResponse["files"]>([]);
  const [filesErr, setFilesErr] = useState<string | null>(null);
  const [filesLoading, setFilesLoading] = useState(false);
  const [symbol, setSymbol] = useState("NIFTY");
  const [expiries, setExpiries] = useState<string[]>([]);
  const [expiriesErr, setExpiriesErr] = useState<string | null>(null);
  const [expiriesLoading, setExpiriesLoading] = useState(false);
  const [selectedExpiry, setSelectedExpiry] = useState<string>("");
  const [symbolQuery, setSymbolQuery] = useState("");
  const [downloadState, setDownloadState] = useState<{
    day: boolean;
    week: boolean;
    month: boolean;
  }>({ day: false, week: false, month: false });
  const [downloadErr, setDownloadErr] = useState<string | null>(null);
  const [rt, setRt] = useState<RealtimeResponse | null>(null);
  const [rtErr, setRtErr] = useState<string | null>(null);
  const [rtLoading, setRtLoading] = useState(false);
  const [tablePage, setTablePage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const h = await fetchNseiJson<HealthResponse>("/health");
        if (!cancelled) {
          setHealth(h);
          setHealthErr(null);
        }
      } catch (e) {
        if (!cancelled) setHealthErr(e instanceof Error ? e.message : "Failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await fetchNseiJson<DatesResponse>("/v1/dates");
        if (cancelled) return;
        setDates(d.dates ?? []);
        setDatesErr(null);
        if (d.dates?.length) {
          setSelectedDate((prev) =>
            prev && d.dates.includes(prev) ? prev : d.dates[d.dates.length - 1]
          );
        }
      } catch (e) {
        if (!cancelled) setDatesErr(e instanceof Error ? e.message : "Failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    (async () => {
      setFilesLoading(true);
      setFilesErr(null);
      try {
        const f = await fetchNseiJson<FilesResponse>(
          `/v1/files?date=${encodeURIComponent(selectedDate)}`
        );
        if (cancelled) return;
        const list = f.files ?? [];
        setFiles(list);
        const syms = list.map((x) => x.symbol);
        setSymbol((prev) => (syms.includes(prev) ? prev : syms[0] ?? "NIFTY"));
      } catch (e) {
        if (!cancelled) {
          setFilesErr(e instanceof Error ? e.message : "Failed");
          setFiles([]);
        }
      } finally {
        if (!cancelled) setFilesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    (async () => {
      setExpiriesLoading(true);
      setExpiriesErr(null);
      try {
        const ex = await fetchNseiJson<ExpiriesResponse>(
          `/v1/expiries/${encodeURIComponent(symbol)}`
        );
        if (cancelled) return;
        const list = ex.expiries ?? [];
        setExpiries(list);
        setSelectedExpiry((prev) => (prev && list.includes(prev) ? prev : ""));
      } catch (e) {
        if (!cancelled) {
          setExpiriesErr(e instanceof Error ? e.message : "Failed");
          setExpiries([]);
          setSelectedExpiry("");
        }
      } finally {
        if (!cancelled) setExpiriesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setSelectedExpiry(""));
    return () => window.cancelAnimationFrame(id);
  }, [selectedDate, symbol]);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    (async () => {
      setRtLoading(true);
      setRtErr(null);
      try {
        const q = new URLSearchParams();
        if (selectedExpiry.trim()) q.set("expiry", selectedExpiry);
        const suffix = q.size ? `?${q.toString()}` : "";
        const r = await fetchNseiJson<RealtimeResponse>(
          `/v1/realtime/${encodeURIComponent(symbol)}${suffix}`
        );
        if (!cancelled) {
          setRt(r);
          setRtErr(null);
        }
      } catch (e) {
        if (!cancelled)
          setRtErr(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!cancelled) setRtLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, selectedExpiry, selectedDate]);

  const displayRows = useMemo(() => {
    const rows = rt?.rows ?? [];
    return [...rows].sort((a, b) => {
      if (a.strike_price !== b.strike_price)
        return a.strike_price - b.strike_price;
      return a.option_type.localeCompare(b.option_type);
    });
  }, [rt]);

  const tablePageCount = Math.max(1, Math.ceil(displayRows.length / pageSize));
  const safeTablePage = Math.min(tablePage, tablePageCount);

  const pagedRows = useMemo(() => {
    const start = (safeTablePage - 1) * pageSize;
    return displayRows.slice(start, start + pageSize);
  }, [displayRows, safeTablePage]);

  const filteredFiles = useMemo(() => {
    const q = symbolQuery.trim().toLowerCase();
    if (!q) return files;
    return files.filter(
      (f) => f.symbol.toLowerCase().includes(q) || f.name.toLowerCase().includes(q)
    );
  }, [files, symbolQuery]);

  async function runDownload(period: "day" | "week" | "month") {
    if (!symbol) return;
    if (period === "day" && !selectedDate) return;
    setDownloadErr(null);
    setDownloadState((prev) => ({ ...prev, [period]: true }));
    try {
      const url =
        period === "day"
          ? nseiDownloadUrl("range", {
              symbol,
              period: "day",
              anchor_date: selectedDate || undefined,
              expiry: selectedExpiry || undefined,
            })
          : nseiDownloadUrl("range", {
              symbol,
              period,
              anchor_date: selectedDate || undefined,
              expiry: selectedExpiry || undefined,
            });
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || "Download failed");
      }
      const blob = await res.blob();
      const fallback =
        period === "day"
          ? `${symbol}-${selectedDate || "latest"}.csv`
          : `${symbol}-${period}-${selectedDate || "latest"}.${period === "month" || period === "week" ? "zip" : "csv"}`;
      const fileName = parseFileName(res.headers.get("content-disposition"), fallback);
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      setDownloadErr(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloadState((prev) => ({ ...prev, [period]: false }));
    }
  }

  const th =
    "border-b border-[var(--line)] bg-[var(--card)] px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]";
  const td = "border-b border-[var(--line)]/50 px-2 py-1.5 tabular-nums text-[11px] text-[var(--fg)]";

  if (!mounted) {
    return (
      <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg)]">
        <header className="shrink-0 border-b border-[var(--line)] bg-[var(--card)]/60 px-4 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-[var(--fg)]">NSEI Snapshot</span>
          </div>
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-[var(--muted)]">
          Loading dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg)]">
      <header className="shrink-0 border-b border-[var(--line)] bg-[var(--card)]/60 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-[var(--fg)]">NSEI Snapshot</span>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="rounded border border-[var(--line)] px-2 py-1 text-[var(--muted)]">
              Rows {formatNum(rt?.row_count ?? displayRows.length, 0)}
            </span>
            <span className="rounded border border-[var(--line)] px-2 py-1 text-[var(--muted)]">
              Expiries {formatNum(rt?.expiry_count ?? rt?.expiries?.length ?? 0, 0)}
            </span>
            <span className="rounded border border-[var(--line)] px-2 py-1 text-[var(--muted)]">
              Strikes {formatNum(rt?.strike_count, 0)}
            </span>
            <span className="rounded border border-[var(--line)] px-2 py-1 text-[var(--muted)]">
              Filter {selectedExpiry || "All"}
            </span>
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row lg:items-stretch lg:gap-4 lg:p-4">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:min-w-0">
          <div className="mb-2 flex shrink-0 flex-wrap items-end justify-between gap-2 rounded-lg border border-[var(--line)] bg-[var(--card)] p-3">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                Realtime · {symbol}
              </div>
              <div className="text-xs text-[var(--muted)]">
                {rt?.captured_at ? (
                  <span className="tabular-nums text-[var(--fg)]">{rt.captured_at}</span>
                ) : rtLoading ? (
                  "Loading…"
                ) : (
                  "—"
                )}
                {rt?.date ? (
                  <span className="ml-2 tabular-nums">· {rt.date}</span>
                ) : null}
              </div>
            </div>
            {rt?.underlying_value != null ? (
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Underlying
                </div>
                <div className="text-lg font-semibold tabular-nums text-[var(--fg)]">
                  {formatNum(rt.underlying_value, 2)}
                </div>
              </div>
            ) : null}
          </div>

          <div className="mb-2 grid shrink-0 grid-cols-2 gap-2 rounded-lg border border-[var(--line)] bg-[var(--card)] p-2 text-xs md:grid-cols-4">
            <div className="rounded border border-[var(--line)] px-2 py-1.5">
              <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Underlying</div>
              <div className="mt-0.5 tabular-nums text-[var(--fg)]">{formatNum(rt?.underlying_value, 2)}</div>
            </div>
            <div className="rounded border border-[var(--line)] px-2 py-1.5">
              <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Rows</div>
              <div className="mt-0.5 tabular-nums text-[var(--fg)]">{formatNum(rt?.row_count ?? displayRows.length, 0)}</div>
            </div>
            <div className="rounded border border-[var(--line)] px-2 py-1.5">
              <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Strikes</div>
              <div className="mt-0.5 tabular-nums text-[var(--fg)]">{formatNum(rt?.strike_count, 0)}</div>
            </div>
            <div className="rounded border border-[var(--line)] px-2 py-1.5">
              <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">PCR OI / Vol</div>
              <div className="mt-0.5 tabular-nums text-[var(--fg)]">
                {formatNum(rt?.pcr_oi, 3)} / {formatNum(rt?.pcr_volume, 3)}
              </div>
            </div>
          </div>

          {rtErr ? (
            <div
              className={`mb-2 shrink-0 rounded border px-3 py-2 text-xs ${noticeClass(rtErr)}`}
            >
              {rtErr}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--card)]">
            <table className="w-full table-fixed border-collapse">
              <thead className="sticky top-0 z-10 shadow-[0_1px_0_var(--line)]">
                <tr>
                  <th className={`${th} w-[10%]`}>Strike</th>
                  <th className={`${th} w-[8%]`}>Type</th>
                  <th className={`${th} w-[10%] text-right`}>Last</th>
                  <th className={`${th} w-[8%] text-right`}>%</th>
                  <th className={`${th} w-[12%] text-right`}>OI</th>
                  <th className={`${th} w-[12%] text-right`}>Vol</th>
                  <th className={`${th} w-[12%] text-right`}>Bid</th>
                  <th className={`${th} w-[12%] text-right`}>Ask</th>
                  <th className={`${th} w-[16%]`}>Expiry</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.length ? (
                  pagedRows.map((r: RealtimeRow, idx: number) => (
                    <tr
                      key={`${r.strike_price}-${r.option_type}-${idx}`}
                      className="hover:bg-white/[0.03]"
                    >
                      <td className={`${td} whitespace-nowrap`}>
                        {formatNum(r.strike_price, 0)}
                      </td>
                      <td className={`${td} font-medium`}>{r.option_type}</td>
                      <td className={`${td} text-right`}>
                        {formatNum(r.last_price, 2)}
                      </td>
                      <td className={`${td} text-right ${cellNeg(r.pchange)}`}>
                        {formatNum(r.pchange, 2)}
                      </td>
                      <td className={`${td} text-right`}>
                        {formatNum(r.open_interest, 0)}
                      </td>
                      <td className={`${td} text-right`}>
                        {formatNum(r.total_traded_volume, 0)}
                      </td>
                      <td className={`${td} text-right text-[11px]`}>
                        {formatNum(r.bid_price, 2)} × {formatNum(r.bid_qty, 0)}
                      </td>
                      <td className={`${td} text-right text-[11px]`}>
                        {formatNum(r.ask_price, 2)} × {formatNum(r.ask_qty, 0)}
                      </td>
                      <td className={`${td} text-[var(--muted)]`}>{r.expiry}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      className="px-3 py-8 text-center text-xs text-[var(--muted)]"
                      colSpan={9}
                    >
                      {rtLoading ? "Loading…" : "No data available"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {displayRows.length > pageSize ? (
            <div className="mt-2 flex shrink-0 items-center justify-between gap-2 rounded border border-[var(--line)] bg-[var(--card)] px-3 py-2 text-xs text-[var(--muted)]">
              <span>
                Page {safeTablePage} / {tablePageCount}
              </span>
              <span>
                Showing {formatNum((safeTablePage - 1) * pageSize + 1, 0)}-
                {formatNum(Math.min(safeTablePage * pageSize, displayRows.length), 0)} of{" "}
                {formatNum(displayRows.length, 0)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={safeTablePage <= 1}
                  onClick={() => setTablePage((p) => Math.max(1, p - 1))}
                  className="rounded border border-[var(--line)] px-2 py-1 text-[var(--fg)] disabled:opacity-40"
                >
                  Prev
                </button>
                <button
                  type="button"
                  disabled={safeTablePage >= tablePageCount}
                  onClick={() => setTablePage((p) => Math.min(tablePageCount, p + 1))}
                  className="rounded border border-[var(--line)] px-2 py-1 text-[var(--fg)] disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-80">
          <section className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-3">
            <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
              Health
            </div>
            <div className="mt-1 text-lg font-semibold text-[var(--fg)]">
              {health?.status ?? (healthErr ? "—" : "…")}
            </div>
            {healthErr ? (
              <div
                className={`mt-1 text-xs ${healthErr === "Not authorized" ? "text-red-400" : "text-[var(--muted)]"}`}
              >
                {healthErr}
              </div>
            ) : null}
          </section>

          <section className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-3">
            <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
              Dates
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {datesErr ? (
                <span className={`text-xs ${datesErr === "Not authorized" ? "text-red-400" : "text-[var(--muted)]"}`}>
                  {datesErr}
                </span>
              ) : dates.length ? (
                dates.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDate(d)}
                    className={`rounded border px-2 py-0.5 text-xs tabular-nums ${
                      d === selectedDate
                        ? "border-white/40 bg-white text-black"
                        : "border-[var(--line)] text-[var(--muted)] hover:text-[var(--fg)]"
                    }`}
                  >
                    {d}
                  </button>
                ))
              ) : (
                <span className="text-xs text-[var(--muted)]">No data available</span>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Files
                </div>
                <div className="mt-1 text-sm tabular-nums text-[var(--fg)]">
                  {selectedDate || "—"}
                </div>
                {filesLoading ? (
                  <div className="mt-1 text-[10px] text-[var(--muted)]">Loading…</div>
                ) : null}
              </div>
            </div>
            <input
              value={symbolQuery}
              onChange={(e) => setSymbolQuery(e.target.value)}
              placeholder="Search symbol..."
              className="mt-2 w-full rounded border border-[var(--line)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--fg)] outline-none focus:border-white/40"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {filesErr ? (
                <span className={`text-xs ${filesErr === "Not authorized" ? "text-red-400" : "text-[var(--muted)]"}`}>
                  {filesErr}
                </span>
              ) : filteredFiles.length ? (
                filteredFiles.map((f) => (
                  <button
                    key={f.symbol}
                    type="button"
                    onClick={() => setSymbol(f.symbol)}
                    className={`rounded border px-2 py-0.5 text-xs font-medium ${
                      f.symbol === symbol
                        ? "border-white/40 bg-white/10 text-[var(--fg)]"
                        : "border-[var(--line)] text-[var(--muted)] hover:text-[var(--fg)]"
                    }`}
                  >
                    {f.symbol}
                  </button>
                ))
              ) : (
                <span className="text-xs text-[var(--muted)]">
                  {files.length ? "No matching symbol" : "No data available"}
                </span>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Expiry
                </div>
                {expiriesLoading ? (
                  <div className="mt-1 text-[10px] text-[var(--muted)]">Loading…</div>
                ) : null}
              </div>
            </div>
            <div className="mt-2">
              <select
                value={selectedExpiry}
                onChange={(e) => setSelectedExpiry(e.target.value)}
                className="w-full rounded border border-[var(--line)] bg-[var(--bg)] px-2 py-1.5 text-xs text-[var(--fg)]"
              >
                <option value="">All expiries</option>
                {expiries.map((expiry) => (
                  <option key={expiry} value={expiry}>
                    {expiry}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSelectedExpiry("")}
                className="mt-2 w-full rounded border border-[var(--line)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--fg)]"
              >
                Show all expiries
              </button>
              {expiriesErr ? (
                <div className={`mt-2 text-xs ${expiriesErr === "Not authorized" ? "text-red-400" : "text-[var(--muted)]"}`}>
                  {expiriesErr}
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-3">
            <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
              CSV
            </div>
            <div className="mt-2 flex flex-col gap-2">
              <button
                type="button"
                disabled={!selectedDate || !symbol || downloadState.day}
                onClick={() => void runDownload("day")}
                className="rounded border border-white/30 bg-white px-3 py-2 text-center text-xs font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {downloadState.day ? "Preparing day CSV..." : "Download day CSV"}
              </button>
              <button
                type="button"
                disabled={!symbol || downloadState.week}
                onClick={() => void runDownload("week")}
                className="rounded border border-[var(--line)] px-3 py-2 text-center text-xs text-[var(--fg)] transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {downloadState.week ? "Preparing week ZIP..." : "Download week ZIP"}
              </button>
              <button
                type="button"
                disabled={!symbol || downloadState.month}
                onClick={() => void runDownload("month")}
                className="rounded border border-[var(--line)] px-3 py-2 text-center text-xs text-[var(--fg)] transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {downloadState.month ? "Preparing month ZIP..." : "Download month ZIP"}
              </button>
              <div className="text-[10px] text-[var(--muted)]">
                {selectedExpiry ? `Filtered by ${selectedExpiry}` : "All expiries included"}
              </div>
              {downloadErr ? (
                <div className={`text-xs ${downloadErr === "Not authorized" ? "text-red-400" : "text-[var(--muted)]"}`}>
                  {downloadErr}
                </div>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
