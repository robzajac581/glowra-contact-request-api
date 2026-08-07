# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this service is

Handles inbound contact requests for Glowra — consultation requests and clinic listing requests.
It persists each request to SQL Server, emails a forwarding address via SendGrid, and retries
failed sends on a schedule. Express + `mssql`.

## Project context

Glowra is a website platform for plastic surgery information: a landing page, a search page that
displays procedures, and clinic pages.

The project spans three repositories, normally cloned as siblings in the same parent directory:

| Repo | Role | Local port |
|---|---|---|
| `glowra-FE` | Frontend (Create React App) | 3000 |
| `glowra-search-api` | Search / clinics / blog backend | 3001 |
| `glowra-contact-request-api` | Consultation + clinic listing requests (this repo) | 3002 |

This service is called directly by the frontend via `REACT_APP_CONSULTATION_REQUEST_API_URL`.
Changing a request body shape or response contract requires a coordinated `glowra-FE` change.

## Commands

- Start server: `npm start` (listens on `PORT`, default 3002)
- Start with reload: `npm run dev` (nodemon)

There is no test script in this repo — verify changes by exercising the endpoints against a
locally running server.

## Setup

Copy `.env.example` to `.env` and fill in real values. Database credentials and the SendGrid API
key are not in the repo — get them from Rob. The server exits on startup if the database pool
cannot be established.

## Architecture

- `app.js` — Express setup, route mounting, error handling, graceful shutdown. Starts the retry
  processor before listening.
- `routes/` — `consultationRequests` mounted at `/api/consultation-requests`,
  `clinicListingRequests` mounted at `/api/clinic-listing-requests`
- `services/` — business logic and database access
- `utils/emailService.js` — all SendGrid sending; recipient addresses come from env with
  hardcoded fallbacks
- `jobs/retryProcessor.js` — `node-cron` job that retries failed email sends
- `middleware/` — request validation (`express-validator`)
- `db.js` — singleton connection pool, initialized on module load; use `getPool()`
- `database/` — schema and migration SQL

`/health` returns a JSON status object and is the endpoint to hit when checking whether the
service is up.

## Conventions

- `async`/`await`, with try/catch around every async operation
- Parameterized queries only — never concatenate user input into SQL
- Validate inputs at the route layer before touching services
- Return descriptive errors with appropriate status codes; internal error details are only
  exposed when `NODE_ENV=development`
- Log errors with enough context to debug from output alone

Because this service sends real email, be careful when testing: point
`CONSULTATION_REQUEST_EMAIL_TO` and `CLINIC_LISTING_EMAIL_TO` at an address you control before
exercising the send path locally.

## Docs

- `INTEGRATION_GUIDE.md` — how the frontend integrates with this service
- `CLINIC_LISTING_API_DOCUMENTATION.md` — clinic listing endpoint reference
- `CONSULTATION_REQUEST_API_SLA.md` — expected behavior and SLA for consultation requests
- `past_docs/` — historical, may be stale

## Deploys

Pushing to `main` triggers an automatic production deploy. Do not push until the change has been
reviewed running locally.

## Task tracking

Linear workspace `Glowra` (linear.app/glowra) is the primary tracker. A JIRA project `GLOW` at
`rob-zajac-glowra.atlassian.net` also exists and is mirrored.
