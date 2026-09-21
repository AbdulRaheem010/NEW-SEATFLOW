# SeatFlow API

Node.js + Express + PostgreSQL backend for the SeatFlow frontend.

## Endpoints

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
GET    /api/v1/auth/me                                   (auth)

GET    /api/v1/events                                    (auth)
POST   /api/v1/events                                    (auth)
GET    /api/v1/events/:id                                (auth)
PATCH  /api/v1/events/:id                                (auth)
DELETE /api/v1/events/:id                                (auth)
POST   /api/v1/events/:id/publish                        (auth)

GET    /api/v1/events/:eventId/tables                    (auth)
POST   /api/v1/events/:eventId/tables                    (auth)
PATCH  /api/v1/events/:eventId/tables/:tableId           (auth)
DELETE /api/v1/events/:eventId/tables/:tableId           (auth)

GET    /api/v1/events/:eventId/guests                    (auth)
POST   /api/v1/events/:eventId/guests                    (auth)
POST   /api/v1/events/:eventId/guests/import             (auth, bulk CSV import)
PATCH  /api/v1/events/:eventId/guests/:guestId           (auth)
POST   /api/v1/events/:eventId/guests/:guestId/check-in  (auth)
DELETE /api/v1/events/:eventId/guests/:guestId           (auth)

POST   /api/v1/events/:eventId/optimizer                 (auth, recommendations only — never auto-applies)

GET    /api/v1/public/events/:slug                       (public — event summary only)
GET    /api/v1/public/events/:slug/guest-lookup?name=... (public — single matching guest only, never a full list)
```

Auth uses a Bearer JWT (`Authorization: Bearer <token>`) returned from register/login.

## Local setup

```bash
npm install
cp .env.example .env     # then fill in DATABASE_URL and JWT_SECRET
npm run migrate          # creates tables from src/db/schema.sql
npm run dev               # starts on http://localhost:4000
```

You'll need a local Postgres instance, or point `DATABASE_URL` at a Render/Supabase Postgres instance during development.

## Security notes

- No Stripe secret key, Supabase service-role key, or AI provider key is ever sent to the frontend. They live only in this service's environment variables.
- The guest-lookup endpoint never returns a browsable guest list — only the single matching guest (see `guestController.publicGuestLookup`), and multiple-name-match handling asks for one more identifying detail before returning a result.
- The seating optimizer (`optimizerController.js`) only returns recommendations; it never writes to the database. Applying changes is a separate, explicit call the frontend makes per-change after the organizer reviews them.
- Passwords are hashed with bcrypt; nothing is stored in plaintext.

## Deploying to Render

See the root-level `DEPLOYMENT.md` for the full walkthrough. Short version: push this folder to GitHub, create a Render Web Service pointing at it (or use the included `render.yaml` blueprint), add a Render Postgres database, set the environment variables from `.env.example`, and run `npm run migrate` once via the Render shell.
