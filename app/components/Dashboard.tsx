"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchNseiJson,
  nseiDownloadUrl,
  type DatesResponse,
  type FilesResponse,
  type HealthResponse,
  type RealtimeResponse,
  type RealtimeRow,
} from "@/lib/nsei";

function formatNum(n: number, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function cellNeg(n: number) {
  return n < 0 ? "text-red-400" : n > 0 ? "text-emerald-400/90" : "";
}

function noticeClass(message: string) {
  return message === "Not authorized"
    ? "border-red-500/40 bg-red-500/10 text-red-300"
    : "border-[var(--line)] bg-[var(--card)] text-[var(--muted)]";
}

export default function Dashboard() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthErr, setHealthErr] = useState<string | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [datesErr, setDatesErr] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [files, setFiles] = useState<FilesResponse["files"]>([]);
  const [filesErr, setFilesErr] = useState<string | null>(null);
  const [filesLoading, setFilesLoading] = useState(false);
  const [symbol, setSymbol] = useState("NIFTY");
  const [rt, setRt] = useState<RealtimeResponse | null>(null);
  const [rtErr, setRtErr] = useState<string | null>(null);
  const [rtLoading, setRtLoading] = useState(false);

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
      setRtLoading(true);
      setRtErr(null);
      try {
        const r = await fetchNseiJson<RealtimeResponse>(
          `/v1/realtime/${encodeURIComponent(symbol)}`
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
  }, [symbol]);

  const underlying = useMemo(() => {
    const rows = rt?.rows ?? [];
    const v = rows.find((x) => Number.isFinite(x.underlying_value))?.underlying_value;
    return v;
  }, [rt]);

  const displayRows = useMemo(() => {
    const rows = rt?.rows ?? [];
    return [...rows].sort((a, b) => {
      if (a.strike_price !== b.strike_price)
        return a.strike_price - b.strike_price;
      return a.option_type.localeCompare(b.option_type);
    });
  }, [rt]);

  const th =
    "border-b border-[var(--line)] bg-[var(--card)] px-2 py-2 text-left text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]";
  const td = "border-b border-[var(--line)]/50 px-2 py-1.5 tabular-nums text-[11px] text-[var(--fg)]";

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      <header className="shrink-0 border-b border-[var(--line)] px-4 py-3">
        <span className="text-sm font-medium text-[var(--fg)]">NSEI Snapshot</span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:flex-row lg:items-stretch lg:gap-4 lg:p-4">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:min-w-0">
          <div className="mb-2 flex shrink-0 flex-wrap items-end justify-between gap-2 border-b border-[var(--line)] pb-2">
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
            {underlying != null ? (
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Underlying
                </div>
                <div className="text-lg font-semibold tabular-nums text-[var(--fg)]">
                  {formatNum(underlying, 2)}
                </div>
              </div>
            ) : null}
          </div>

          {rtErr ? (
            <div
              className={`mb-2 shrink-0 rounded border px-3 py-2 text-xs ${noticeClass(rtErr)}`}
            >
              {rtErr}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[var(--line)] bg-[var(--card)]">
            <table className="w-full min-w-[900px] border-collapse">
              <thead className="sticky top-0 z-10 shadow-[0_1px_0_var(--line)]">
                <tr>
                  <th className={th}>Strike</th>
                  <th className={th}>Type</th>
                  <th className={`${th} text-right`}>Last</th>
                  <th className={`${th} text-right`}>Chg</th>
                  <th className={`${th} text-right`}>%</th>
                  <th className={`${th} text-right`}>IV</th>
                  <th className={`${th} text-right`}>OI</th>
                  <th className={`${th} text-right`}>ΔOI</th>
                  <th className={`${th} text-right`}>Vol</th>
                  <th className={`${th} text-right`}>Bid</th>
                  <th className={`${th} text-right`}>Ask</th>
                  <th className={th}>Expiry</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.length ? (
                  displayRows.map((r: RealtimeRow, idx: number) => (
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
                      <td className={`${td} text-right ${cellNeg(r.change)}`}>
                        {formatNum(r.change, 2)}
                      </td>
                      <td className={`${td} text-right ${cellNeg(r.pchange)}`}>
                        {formatNum(r.pchange, 2)}
                      </td>
                      <td className={`${td} text-right`}>
                        {formatNum(r.implied_volatility, 2)}
                      </td>
                      <td className={`${td} text-right`}>
                        {formatNum(r.open_interest, 0)}
                      </td>
                      <td className={`${td} text-right ${cellNeg(r.change_in_oi)}`}>
                        {formatNum(r.change_in_oi, 0)}
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
                      colSpan={12}
                    >
                      {rtLoading ? "Loading…" : "No data available"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
            <div className="mt-2 flex flex-wrap gap-1.5">
              {filesErr ? (
                <span className={`text-xs ${filesErr === "Not authorized" ? "text-red-400" : "text-[var(--muted)]"}`}>
                  {filesErr}
                </span>
              ) : files.length ? (
                files.map((f) => (
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
                <span className="text-xs text-[var(--muted)]">No data available</span>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-[var(--line)] bg-[var(--card)] p-3">
            <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
              CSV
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {selectedDate && symbol ? (
                <a
                  className="rounded border border-white/30 bg-white px-3 py-2 text-center text-xs font-medium text-black hover:bg-neutral-200"
                  href={nseiDownloadUrl("day", { date: selectedDate, symbol })}
                >
                  Day
                </a>
              ) : (
                <span className="rounded border border-[var(--line)] px-3 py-2 text-center text-xs text-[var(--muted)]">
                  Day
                </span>
              )}
              <a
                className="rounded border border-[var(--line)] px-3 py-2 text-center text-xs text-[var(--fg)] hover:border-white/30"
                href={nseiDownloadUrl("range", { symbol, period: "week", anchor_date: selectedDate })}
              >
                Week
              </a>
              <a
                className="rounded border border-[var(--line)] px-3 py-2 text-center text-xs text-[var(--fg)] hover:border-white/30"
                href={nseiDownloadUrl("range", { symbol, period: "month", anchor_date: selectedDate })}
              >
                Month
              </a>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
