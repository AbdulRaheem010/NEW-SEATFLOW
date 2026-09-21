# SeatFlow

Digital event seating & guest experience platform — marketing site, Phase 1.

## What's built

**Phase 1** — Design system: `css/style.css` (tokens, type, buttons, nav, cards, pricing, FAQ accordion, footer), `css/responsive.css`. Pages: `index.html`, `features.html`, `pricing.html`, `templates.html`, `faq.html`, `how-it-works.html`. `js/app.js`, `js/navigation.js`.

**Phase 2** — Auth: `login.html`, `register.html`, `forgot-password.html`. Dashboard shell: `dashboard/index.html`, `dashboard/events.html`, `dashboard/create-event.html` (7-step wizard). `css/dashboard.css`. `js/state.js` (demo-mode store), `js/api.js` (`apiRequest`, `DEMO_MODE`, `API_BASE_URL`), `js/auth.js`, `js/dashboard.js`, `js/events.js`, `js/utils.js`.

**Phase 3** — Guest management: `dashboard/guests.html` (search, add/edit/delete, check-in, export, CSV import). Table management: `dashboard/tables.html`. Visual seating builder: `dashboard/seating.html` (drag-and-drop, zoom, undo/redo, auto-arrange, accessible assignment fallback). `css/seating.css`. `js/guests.js`, `js/tables.js`, `js/seating.js`, `js/import.js` (CSV parser + column mapping + preview).

Vanilla HTML/CSS/JS only, ES modules, no frameworks, throughout.

Not yet built: `demo.html`, `contact.html`, `about.html`, `event/` (guest-facing pages), QR system, branding, schedule/menu/floorplan/countdown, check-in/photos/analytics dashboards, AI optimizer UI, `admin/`, billing — Phases 4–8 in the master spec.

## Backend

A companion Node/Express/PostgreSQL API lives alongside this folder in `seatflow-project/backend/` (delivered as `seatflow-fullstack.zip`). `js/api.js` has a `DEMO_MODE` flag — flip it to `false` and set `API_BASE_URL` to point the frontend at that live backend instead of the local demo state. See `DEPLOYMENT.md` at the project root for the full Git → GitHub → Vercel → Render walkthrough.

## Design direction

Concept: a digital place card. Warm ivory "card stock" background, deep pine-emerald as the primary color, a single brass-foil accent used sparingly (the way foil stamping is used on a real place card) — for prices, step numbers, and the one detail per section that matters most. Display type is Fraunces (serif), body is Work Sans.

## How to run

From the `seatflow/` folder:

```bash
python -m http.server 5500
```

Then open `http://localhost:5500`.

## Next phases

- Phase 2: login/register/forgot-password, dashboard shell, event list, create-event wizard
- Phase 3: guest management, CSV importer, tables, seating builder, drag-and-drop
- Phase 4: guest-facing event page, search, seating result, QR system
- Phase 5: branding, schedule, menu, floorplan, countdown, privacy mode
- Phase 6: check-in, photos, analytics
- Phase 7: AI optimizer, smart rules, admin, billing, plans

## Notes

- `DEMO_MODE` / mock data, the centralized `apiRequest()` utility, and the AI-optimizer client stub (`optimizeSeating()`) are introduced starting Phase 2–3, once `js/api.js` and `js/state.js` exist — no point stubbing them before there's a dashboard to use them.
- No secret keys of any kind belong in this frontend. Public config only (e.g. `PUBLIC_API_URL`).
