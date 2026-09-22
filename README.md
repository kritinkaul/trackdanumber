# FedEx Shipment Dashboard

Internal dashboard for tracking daily FedEx shipments. Upload the daily shipment
spreadsheet (`.xlsx` or `.csv`), and the app fetches live tracking status for every
tracking number from the FedEx Track API, then presents everything in a filterable,
sortable dashboard.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

Credentials live in `.env.local` (git-ignored). Copy `.env.local.example` if you
need to recreate it:

| Variable | Description |
| --- | --- |
| `FEDEX_CLIENT_ID` | FedEx API key (project credentials from developer.fedex.com) |
| `FEDEX_CLIENT_SECRET` | FedEx secret key |
| `FEDEX_API_BASE_URL` | `https://apis.fedex.com` for production, `https://apis-sandbox.fedex.com` for test credentials |
| `DASHBOARD_USERNAME` | Shared username for the HTTP Basic Auth gate (see below). Optional locally. |
| `DASHBOARD_PASSWORD` | Shared password for the HTTP Basic Auth gate. Optional locally. |

Credentials are only used server-side (Next.js API routes); they are never sent to
the browser.

### Access control

Uploaded spreadsheets contain personal data (names, addresses), so the deployed
app is gated behind a shared HTTP Basic Auth login (`proxy.ts`) whenever
`DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` are set. If they're unset (e.g. local
dev), the app is open. This is a lightweight stopgap for short-term internal use —
for anything longer-lived, prefer Vercel's built-in deployment protection or
company SSO instead.

## Spreadsheet format

Columns are detected by header name — no manual mapping. Recognized headers
(case-insensitive, punctuation ignored):

| Field | Example accepted headers |
| --- | --- |
| Tracking Number (required) | "Tracking Number", "Tracking #", "Tracking No", "Airbill" |
| Deliver To | "Deliver To", "Recipient", "Consignee", "Customer Name" |
| City | "City", "Destination City", "Ship To City" |
| State | "State", "ST", "Destination State" |
| Address | "Address", "Street Address", "Address Line 1" |
| Carrier | "Carrier", "Shipper", "Ship Via" |
| ZIP Code (optional) | "Zip", "Zip Code", "Postal Code", "Ship To Zip" |
| Ship Date (optional) | "Ship Date", "Shipped Date", "Date Shipped" |

Only the Tracking Number column is required; missing optional columns produce a
warning and blank values. Rows without a tracking number are skipped. The
spreadsheet is the source of truth for destination info — FedEx data never
overwrites it.

The file is parsed in the browser (only the extracted rows are sent to the
server), so large workbooks aren't cut off by request-size limits. The header
row can sit below title rows and on any sheet. Tracking cells are cleaned
(apostrophes, spaces, dashes, several numbers in one cell); numbers Excel has
turned into scientific notation are skipped with a warning naming the rows.

## Duplicate tracking numbers

- **FedEx reused the number.** FedEx recycles tracking numbers, so one number
  can return several shipments (e.g. one delivered and one with no updates).
  Every record is kept and the one matching the row is chosen by ZIP, city /
  state (the A&M office location counts), ship date, recency and whether it has
  scans. The drawer lists all records with the reason; "This is ours" pins one.
- **Same number on several rows.** Rows are labelled *Identical rows*,
  *Same destination* (several items in one box) or *Conflict* (different
  people / places). For conflicts, FedEx's destination shows which row it
  actually matches. Use the **Duplicate check** filter or the KPI footer links
  ("Needs review") to work through them; the CSV export includes these columns.

## Features

- **KPI cards** — Total, Delivered, In Transit, Out for Delivery, Exception, Label
  Created. Click a card to filter the table by that status.
- **Destination summary** — shipments grouped by city; click a city chip to filter.
- **Search** — by tracking number, city, state, or recipient.
- **Filters** — status, city, state, carrier.
- **Table** — sortable columns, pagination, click a row for full details.
- **Detail drawer** — status, origin, destination, current scan, ETA, service,
  delivery exceptions, and the full transit history timeline (hidden when the API
  returns no scans).
- **Refresh Status** — re-queries FedEx for every loaded tracking number without
  re-uploading the file.

## How tracking works

1. The upload API route parses the spreadsheet once and extracts all tracking numbers.
2. A FedEx OAuth token is fetched and cached in memory (~1 hour TTL).
3. Tracking numbers are queried in batches of 30 (the Track API limit) with limited
   concurrency. A failed number or batch marks only those rows as "Unavailable" —
   the rest of the import always completes.
4. FedEx status codes are mapped to app statuses in `lib/status.ts`.

FedEx status data is held in browser memory for the session; there is no database.
Refreshing the page requires re-uploading the spreadsheet.

## Project structure

```
app/            Pages + API routes (/api/upload, /api/refresh)
components/     UI (shadcn primitives, dashboard, upload, shared)
hooks/          useShipments (state + derived data), useDebouncedValue
lib/            Excel parser, header aliases, status mapping, utils
services/fedex/ OAuth, tracking batching, response normalization
types/          Shared TypeScript types
```
