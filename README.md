# NSEI Snapshot — Frontend

A small **Next.js** dashboard for the **NSEI Snapshot** HTTP API: health, available dates, per-day file listings, **realtime** option rows for a symbol, and **CSV** downloads. The UI is a two-pane layout (data table on the left, controls on the right) and keeps the upstream **API key on the server** when you use the built-in proxy.

The [`Frontend`](https://github.com/bathroommop/NSEI_Snapshot/tree/Frontend) branch of [`bathroommop/NSEI_Snapshot`](https://github.com/bathroommop/NSEI_Snapshot) mirrors this project at the repository root (no extra folder).

## Features

- **Dates** from `GET /v1/dates` with quick selection.
- **Files** for the selected date from `GET /v1/files?date=…`, plus symbol chips that drive the realtime view.
- **Realtime** option chain from `GET /v1/realtime/{symbol}`: sticky header, numeric alignment, and signed coloring on selected columns.
- **CSV exports** via the same proxy: single-day file and week/month range downloads.
- **Readable errors**: API JSON errors (for example `detail` from FastAPI-style responses) are turned into short messages such as **No data available** or **Not authorized** instead of raw JSON in the UI.

## Stack

- [Next.js](https://nextjs.org/) 16 (App Router)
- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/) v4

## Quick start

```bash
npm install
```

Create environment file (see below), then:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For a production build:

```bash
npm run build
npm run start
```

## Environment variables

The app talks to your snapshot API through **`/api/nsei/*`**. Configure the upstream server on the **Next.js server** only (do not expose secrets with `NEXT_PUBLIC_` unless you intentionally want them in the browser bundle).

| Variable | Required | Description |
|----------|----------|-------------|
| `NSEI_API_BASE_URL` | No | Base URL of the snapshot API (no trailing slash required). Defaults to `http://18.61.159.121:8080` if unset. |
| `NSEI_API_KEY` | For protected routes | Sent as `X-API-Key` on proxied requests when non-empty. If the upstream requires a key for `/v1/*`, this must match what the API expects. |

Use **`.env.local`** for local development (gitignored by default in Next projects). **`.env`** is also loaded by Next; prefer `.env.local` for secrets on your machine.

After changing env vars, **restart** the dev or production Node process so new values load.

## How the proxy works

All browser traffic goes to **same-origin** routes under `/api/nsei/…`. The route handler at `app/api/nsei/[[...path]]/route.ts`:

1. Builds the upstream URL: `{NSEI_API_BASE_URL}{path}{queryString}`.
2. Adds `X-API-Key: {NSEI_API_KEY}` when the key is set.
3. Streams the upstream response back (status, headers, body), with `cache: "no-store"`.

So the React dashboard calls **`/api/nsei/health`**, **`/api/nsei/v1/dates`**, and so on; those map to **`/health`**, **`/v1/dates`**, etc. on your API host.

## API surface (reference)

Authoritative contract documentation may live alongside your backend (for example `endpoints.md` in the snapshot repo). At a high level, this UI uses:

| Upstream (proxied path) | Purpose |
|-------------------------|---------|
| `GET /health` | Liveness |
| `GET /v1/dates` | List of `YYYY-MM-DD` dates with data |
| `GET /v1/files?date=…` | Symbols / filenames for that date |
| `GET /v1/realtime/{symbol}` | Latest snapshot rows for the symbol |
| `GET /v1/download/{date}/{symbol}.csv` | One symbol, one day CSV |
| `GET /v1/download-range/{symbol}.csv?period=day\|week\|month&anchor_date=…` | Merged range CSV |

From the browser, prefix paths with **`/api/nsei`** (the client helpers in `lib/nsei.ts` already do this).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Run production server (after `build`) |
| `npm run lint` | ESLint |

## Project layout

```
app/
  api/nsei/[[...path]]/route.ts   # GET proxy to snapshot API
  components/Dashboard.tsx        # Main dashboard (client)
  layout.tsx, page.tsx, globals.css
lib/
  nsei.ts                         # Types, fetch helper, download URLs, error copy
```

## Troubleshooting

- **`Not authorized`** on `/v1/*`: set `NSEI_API_KEY` to the value configured on the API server, then restart Next.
- **`No data available`** for realtime or empty dates: upstream may have no processed data for that symbol or date, or the symbol may not exist in the latest snapshot. Confirm with `curl` against the same base URL and key.
- **Health works but `/v1/dates` fails**: almost always missing or wrong API key for protected endpoints.
- **Env changes ignored**: restart `npm run dev` or the `next start` process.

## License

Private project (`"private": true` in `package.json`). Add a license file here if you open-source the repo.
