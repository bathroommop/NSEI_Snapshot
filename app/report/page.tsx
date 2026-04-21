"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchNseiJson,
  type DatesResponse,
  type ExpiriesResponse,
  type FilesResponse,
  type RealtimeResponse,
} from "@/lib/nsei";

function fmt(n: number | null | undefined, d = 2) {
  const v = typeof n === "number" ? n : NaN;
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: d });
}

export default function ReportPage() {
  const [dates, setDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [files, setFiles] = useState<FilesResponse["files"]>([]);
  const [symbol, setSymbol] = useState("NIFTY");
  const [expiries, setExpiries] = useState<string[]>([]);
  const [selectedExpiry, setSelectedExpiry] = useState("");
  const [rt, setRt] = useState<RealtimeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await fetchNseiJson<DatesResponse>("/v1/dates");
        if (cancelled) return;
        setDates(d.dates ?? []);
        setSelectedDate(d.dates?.[d.dates.length - 1] ?? "");
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed");
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
      try {
        const f = await fetchNseiJson<FilesResponse>(`/v1/files?date=${encodeURIComponent(selectedDate)}`);
        if (cancelled) return;
        const list = f.files ?? [];
        setFiles(list);
        setSymbol((prev) => (list.some((x) => x.symbol === prev) ? prev : list[0]?.symbol ?? "NIFTY"));
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed");
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
      try {
        const ex = await fetchNseiJson<ExpiriesResponse>(`/v1/expiries/${encodeURIComponent(symbol)}`);
        if (cancelled) return;
        const list = ex.expiries ?? [];
        setExpiries(list);
        setSelectedExpiry((prev) => (prev && list.includes(prev) ? prev : ""));
      } catch {
        if (!cancelled) {
          setExpiries([]);
          setSelectedExpiry("");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const q = new URLSearchParams();
        if (selectedExpiry) q.set("expiry", selectedExpiry);
        const suffix = q.size ? `?${q.toString()}` : "";
        const r = await fetchNseiJson<RealtimeResponse>(`/v1/realtime/${encodeURIComponent(symbol)}${suffix}`);
        if (!cancelled) setRt(r);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, selectedExpiry, selectedDate]);

  const rows = useMemo(() => rt?.rows ?? [], [rt]);

  const expiryDist = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.expiry, (m.get(r.expiry) ?? 0) + 1));
    return [...m.entries()].map(([expiry, count]) => ({ expiry, count })).sort((a, b) => b.count - a.count);
  }, [rows]);

  const optionMix = useMemo(() => {
    let ce = 0;
    let pe = 0;
    let ceOi = 0;
    let peOi = 0;
    rows.forEach((r) => {
      if (r.option_type === "CE") {
        ce += 1;
        ceOi += r.open_interest ?? 0;
      } else {
        pe += 1;
        peOi += r.open_interest ?? 0;
      }
    });
    return { ce, pe, ceOi, peOi };
  }, [rows]);

  const topStrikesByOi = useMemo(() => {
    const m = new Map<number, number>();
    rows.forEach((r) => m.set(r.strike_price, (m.get(r.strike_price) ?? 0) + (r.open_interest ?? 0)));
    return [...m.entries()]
      .map(([strike, oi]) => ({ strike, oi }))
      .sort((a, b) => b.oi - a.oi)
      .slice(0, 12);
  }, [rows]);

  const expiryOiByType = useMemo(() => {
    const m = new Map<string, { ceOi: number; peOi: number }>();
    rows.forEach((r) => {
      const cur = m.get(r.expiry) ?? { ceOi: 0, peOi: 0 };
      if (r.option_type === "CE") cur.ceOi += r.open_interest ?? 0;
      else cur.peOi += r.open_interest ?? 0;
      m.set(r.expiry, cur);
    });
    return [...m.entries()]
      .map(([expiry, v]) => ({ expiry, ...v, total: v.ceOi + v.peOi }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [rows]);

  const strikeHeatExpiries = useMemo(() => expiryDist.slice(0, 8).map((x) => x.expiry), [expiryDist]);
  const strikeHeatStrikes = useMemo(() => topStrikesByOi.slice(0, 10).map((x) => x.strike), [topStrikesByOi]);

  const strikeExpiryHeat = useMemo(() => {
    const cells = new Map<string, number>();
    rows.forEach((r) => {
      if (!strikeHeatExpiries.includes(r.expiry)) return;
      if (!strikeHeatStrikes.includes(r.strike_price)) return;
      const k = `${r.strike_price}__${r.expiry}`;
      cells.set(k, (cells.get(k) ?? 0) + (r.open_interest ?? 0));
    });
    return cells;
  }, [rows, strikeHeatExpiries, strikeHeatStrikes]);

  const topMovers = useMemo(() => {
    const list = rows
      .filter((r) => typeof r.pchange === "number")
      .map((r) => ({
        strike: r.strike_price,
        type: r.option_type,
        expiry: r.expiry,
        pchange: r.pchange ?? 0,
        last: r.last_price ?? 0,
        oi: r.open_interest ?? 0,
      }));
    const gainers = [...list].sort((a, b) => b.pchange - a.pchange).slice(0, 6);
    const losers = [...list].sort((a, b) => a.pchange - b.pchange).slice(0, 6);
    return { gainers, losers };
  }, [rows]);

  const nearestToUnderlying = useMemo(() => {
    const u = rt?.underlying_value;
    if (typeof u !== "number") return [];
    return [...rows]
      .sort((a, b) => Math.abs(a.strike_price - u) - Math.abs(b.strike_price - u))
      .slice(0, 12)
      .map((r) => ({
        strike: r.strike_price,
        type: r.option_type,
        expiry: r.expiry,
        last: r.last_price ?? 0,
        iv: r.implied_volatility ?? 0,
        oi: r.open_interest ?? 0,
      }));
  }, [rows, rt?.underlying_value]);

  const volumeLeaders = useMemo(() => {
    return [...rows]
      .map((r) => ({
        strike: r.strike_price,
        type: r.option_type,
        expiry: r.expiry,
        vol: r.total_traded_volume ?? 0,
      }))
      .sort((a, b) => b.vol - a.vol)
      .slice(0, 10);
  }, [rows]);

  const maxExpiryCount = expiryDist[0]?.count ?? 1;
  const maxStrikeOi = topStrikesByOi[0]?.oi ?? 1;
  const maxExpiryOi = expiryOiByType[0]?.total ?? 1;
  const heatMax = useMemo(() => {
    let mx = 1;
    strikeExpiryHeat.forEach((v) => {
      if (v > mx) mx = v;
    });
    return mx;
  }, [strikeExpiryHeat]);
  const totalOptions = optionMix.ce + optionMix.pe;
  const cePct = totalOptions ? (optionMix.ce / totalOptions) * 100 : 0;
  const pePct = totalOptions ? (optionMix.pe / totalOptions) * 100 : 0;

  return (
    <div className="min-h-[100dvh] bg-[var(--bg)] p-4 text-[var(--fg)] lg:p-6">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Report</div>
              <div className="text-lg font-semibold">Big Picture View</div>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded border border-[var(--line)] bg-[var(--bg)] px-2 py-1 text-xs"
              >
                {dates.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="rounded border border-[var(--line)] bg-[var(--bg)] px-2 py-1 text-xs"
              >
                {files.map((f) => (
                  <option key={f.symbol} value={f.symbol}>
                    {f.symbol}
                  </option>
                ))}
              </select>
              <select
                value={selectedExpiry}
                onChange={(e) => setSelectedExpiry(e.target.value)}
                className="rounded border border-[var(--line)] bg-[var(--bg)] px-2 py-1 text-xs"
              >
                <option value="">All expiries</option>
                {expiries.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {err ? <div className="text-xs text-red-400">{err}</div> : null}
          {loading ? <div className="text-xs text-[var(--muted)]">Loading live view...</div> : null}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Metric label="Total rows" value={fmt(rt?.row_count ?? rows.length, 0)} />
          <Metric label="Total expiries" value={fmt(rt?.expiry_count ?? expiryDist.length, 0)} />
          <Metric label="Total strikes" value={fmt(rt?.strike_count, 0)} />
          <Metric label="Put/Call ratio" value={fmt(rt?.pcr_oi, 3)} />
          <Metric label="Current price" value={fmt(rt?.underlying_value, 2)} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
            <div className="mb-3 text-sm font-medium">How rows are spread by expiry</div>
            <div className="flex flex-col gap-2">
              {expiryDist.length ? (
                expiryDist.map((x) => (
                  <div key={x.expiry} className="grid grid-cols-[110px_1fr_56px] items-center gap-2 text-xs">
                    <span className="truncate text-[var(--muted)]">{x.expiry}</span>
                    <div className="h-2 rounded bg-white/10">
                      <div
                        className="h-2 rounded bg-cyan-400"
                        style={{ width: `${(x.count / maxExpiryCount) * 100}%` }}
                      />
                    </div>
                    <span className="text-right">{fmt(x.count, 0)}</span>
                  </div>
                ))
              ) : (
                <div className="text-xs text-[var(--muted)]">No data</div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
            <div className="mb-3 text-sm font-medium">Call vs Put split</div>
            <div className="mb-3 h-4 overflow-hidden rounded bg-white/10">
              <div className="h-4 bg-emerald-400" style={{ width: `${cePct}%` }} />
              <div className="h-4 bg-fuchsia-400" style={{ width: `${pePct}%`, marginTop: "-16px", marginLeft: `${cePct}%` }} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded border border-[var(--line)] p-2">
                <div className="text-[var(--muted)]">Calls: rows / OI</div>
                <div className="mt-1">{fmt(optionMix.ce, 0)} / {fmt(optionMix.ceOi, 0)}</div>
              </div>
              <div className="rounded border border-[var(--line)] p-2">
                <div className="text-[var(--muted)]">Puts: rows / OI</div>
                <div className="mt-1">{fmt(optionMix.pe, 0)} / {fmt(optionMix.peOi, 0)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
          <div className="mb-3 text-sm font-medium">Top strikes where money is parked (OI)</div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {topStrikesByOi.map((x) => (
              <div key={x.strike} className="grid grid-cols-[78px_1fr_90px] items-center gap-2 text-xs">
                <span className="text-[var(--muted)]">{fmt(x.strike, 0)}</span>
                <div className="h-2 rounded bg-white/10">
                  <div
                    className="h-2 rounded bg-amber-400"
                    style={{ width: `${(x.oi / maxStrikeOi) * 100}%` }}
                  />
                </div>
                <span className="text-right">{fmt(x.oi, 0)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
            <div className="mb-3 text-sm font-medium">Expiry wise OI split (Calls vs Puts)</div>
            <div className="flex flex-col gap-2">
              {expiryOiByType.map((x) => {
                const ceW = (x.ceOi / maxExpiryOi) * 100;
                const peW = (x.peOi / maxExpiryOi) * 100;
                return (
                  <div key={x.expiry} className="grid grid-cols-[110px_1fr_68px] items-center gap-2 text-xs">
                    <span className="truncate text-[var(--muted)]">{x.expiry}</span>
                    <div className="flex h-2 overflow-hidden rounded bg-white/10">
                      <div className="h-2 bg-emerald-400" style={{ width: `${ceW}%` }} />
                      <div className="h-2 bg-fuchsia-400" style={{ width: `${peW}%` }} />
                    </div>
                    <span className="text-right">{fmt(x.total, 0)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
            <div className="mb-3 text-sm font-medium">Fast movers right now (% change)</div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded border border-[var(--line)] p-2">
                <div className="mb-2 text-xs text-emerald-300">Top gainers</div>
                <div className="flex flex-col gap-1">
                  {topMovers.gainers.map((x) => (
                    <div key={`${x.strike}-${x.type}-${x.expiry}`} className="grid grid-cols-[68px_42px_1fr_52px] gap-2 text-[11px]">
                      <span>{fmt(x.strike, 0)}</span>
                      <span>{x.type}</span>
                      <span className="truncate text-[var(--muted)]">{x.expiry}</span>
                      <span className="text-right text-emerald-300">{fmt(x.pchange, 2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded border border-[var(--line)] p-2">
                <div className="mb-2 text-xs text-red-300">Top losers</div>
                <div className="flex flex-col gap-1">
                  {topMovers.losers.map((x) => (
                    <div key={`${x.strike}-${x.type}-${x.expiry}`} className="grid grid-cols-[68px_42px_1fr_52px] gap-2 text-[11px]">
                      <span>{fmt(x.strike, 0)}</span>
                      <span>{x.type}</span>
                      <span className="truncate text-[var(--muted)]">{x.expiry}</span>
                      <span className="text-right text-red-300">{fmt(x.pchange, 2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
          <div className="mb-3 text-sm font-medium">Heatmap: strike vs expiry (OI)</div>
          <div className="overflow-auto">
            <div className="grid min-w-[820px] grid-cols-[100px_repeat(8,minmax(80px,1fr))] gap-1 text-[10px]">
              <div />
              {strikeHeatExpiries.map((ex) => (
                <div key={ex} className="truncate px-1 text-center text-[var(--muted)]">
                  {ex}
                </div>
              ))}
              {strikeHeatStrikes.map((strike) => (
                <div key={`row-${strike}`} className="contents">
                  <div className="px-1 py-1 text-[var(--muted)]">
                    {fmt(strike, 0)}
                  </div>
                  {strikeHeatExpiries.map((ex) => {
                    const v = strikeExpiryHeat.get(`${strike}__${ex}`) ?? 0;
                    const alpha = Math.max(0.08, v / heatMax);
                    return (
                      <div
                        key={`${strike}-${ex}`}
                        className="rounded px-1 py-1 text-right tabular-nums"
                        style={{ backgroundColor: `rgba(251, 191, 36, ${alpha})`, color: alpha > 0.5 ? "#111" : "#f5f5f5" }}
                      >
                        {fmt(v, 0)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
            <div className="mb-3 text-sm font-medium">Closest strikes to current price</div>
            <div className="grid grid-cols-1 gap-1 text-xs">
              {nearestToUnderlying.map((x) => (
                <div key={`${x.strike}-${x.type}-${x.expiry}`} className="grid grid-cols-[68px_42px_1fr_72px_64px_76px] items-center gap-2">
                  <span>{fmt(x.strike, 0)}</span>
                  <span>{x.type}</span>
                  <span className="truncate text-[var(--muted)]">{x.expiry}</span>
                  <span className="text-right">{fmt(x.last, 2)}</span>
                  <span className="text-right">{fmt(x.iv, 2)}</span>
                  <span className="text-right">{fmt(x.oi, 0)}</span>
                </div>
              ))}
              {!nearestToUnderlying.length ? <div className="text-[var(--muted)]">No nearby strike data</div> : null}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-4">
            <div className="mb-3 text-sm font-medium">Most traded options (volume)</div>
            <div className="flex flex-col gap-2">
              {volumeLeaders.map((x) => {
                const maxVol = volumeLeaders[0]?.vol || 1;
                return (
                  <div key={`${x.strike}-${x.type}-${x.expiry}`} className="grid grid-cols-[72px_40px_1fr_70px] items-center gap-2 text-xs">
                    <span>{fmt(x.strike, 0)}</span>
                    <span>{x.type}</span>
                    <div className="h-2 rounded bg-white/10">
                      <div className="h-2 rounded bg-violet-400" style={{ width: `${(x.vol / maxVol) * 100}%` }} />
                    </div>
                    <span className="text-right">{fmt(x.vol, 0)}</span>
                  </div>
                );
              })}
              {!volumeLeaders.length ? <div className="text-xs text-[var(--muted)]">No volume data</div> : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--card)] p-3">
      <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-base font-semibold">{value}</div>
    </div>
  );
}
