import { NextRequest, NextResponse } from "next/server";

function upstreamBase() {
  const raw = process.env.NSEI_API_BASE_URL ?? "http://18.61.159.121:8080";
  return raw.replace(/\/+$/, "");
}

function upstreamKey() {
  return process.env.NSEI_API_KEY ?? "";
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path } = await context.params;
  const segments = path?.filter(Boolean) ?? [];
  const pathname = segments.length ? `/${segments.join("/")}` : "/";
  const target = new URL(pathname + request.nextUrl.search, `${upstreamBase()}/`);
  const headers = new Headers();
  const key = upstreamKey();
  if (key) headers.set("X-API-Key", key);
  const upstream = await fetch(target, {
    headers,
    cache: "no-store",
  });
  const out = new Headers(upstream.headers);
  out.delete("connection");
  out.delete("transfer-encoding");
  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: out,
  });
}
