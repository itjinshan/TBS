# TBS (Travel Buddy Service)

A MERN-stack travel-planning app: a React SPA frontend backed by an Express/MongoDB API. TBS is the consumer ("project-A") of the separate **DS-Service** backend, which it calls for LLM-backed trip planning and (eventually) destination/spot data.

@../DS-Service/CLAUDE.md

> **DS-Service is the upstream data source — check its API contract (linked above, under "## API Contract") before creating DB models or making API calls to it.** Field-name casing, response shapes, and auth requirements there are authoritative; don't guess or re-derive them from TBS's own conventions.

This repo has two independent Node projects, each with its own `package.json`/`node_modules` — always `cd` into the relevant one before running scripts.

## `Node/` — Express API backend

Tech: Express, Mongoose, Passport (JWT strategy), bcryptjs, nodemailer, axios (for calling DS-Service).

**Commands** (run from `TBS/Node/`):
- `npm run dev` — `nodemon index.js` (auto-restart dev server)
- `npm start` — `node index.js` (no reload)
- No test script is defined.

**Structure:**
- `index.js` — app entry: Mongo connection, middleware, route mounting on port `process.env.PORT` (default 6666).
- `APIs/` — route modules: `auth.js` (register/login/current-user/password reset), `dsservice.js` (proxies to DS-Service), `token.js`, `trip.js` (trip intake, mock itinerary generation, CRUD on trips).
- `Config/` — `jwtgenerator.js` (mints access/refresh/DS-Service tokens), `passport.js` (JWT strategy setup).
- `DB_Models/` — Mongoose schemas: `DB_User.js`, `DB_Trip.js`.
- `Emails/` — nodemailer templates (welcome, confirmation, forgot/create password).
- `Services/mockItinerary.js` — **placeholder** itinerary generator; fakes what a real DS-Service integration (`/datasourcing/sourcespots` + a not-yet-built day-by-day planner) will eventually do. See the comment at the top of that file and DS-Service's API contract before replacing it.
- `Services/amapPlaces.js` — real place lookup against Amap's Web Service "place text search" API (`searchPlaces(query, city)`), used by `/trip/intake`'s accommodation-confirm stage. Requires `AMAP_WEB_SERVICE_KEY` — falls back to a single unverified candidate if unset or if the call fails.
- `Validation/` — plain-function request-body validators (`login.js`, `register.js`, `resetPassword.js`, `isEmpty.js`).

**Conventions:**
- Route handlers use `.then()/.catch()` (not async/await) throughout `APIs/auth.js` and `APIs/trip.js`.
- DB model fields are PascalCase (`FirstName`, `Email`, `ResetToken`), matching DS-Service's convention — keep new fields consistent with this casing.
- User-facing auth routes issue tokens via `generateAccessToken(user, 'auth' | 'refresh' | 'deepseek')` in `Config/jwtgenerator.js`. The `'deepseek'` usage is what signs the `token` field DS-Service expects (60s expiry, secret `DEEPSEEK_JWT_SECRET` — must match DS-Service's copy of the same secret).
- Calls into DS-Service go through `axios` with the base URL `process.env.DS_SERVICE_BASEURL`; see `APIs/dsservice.js` for the current pattern (mint a `'deepseek'` token, attach it as `token` in the JSON body — not a header — then POST).

**Env vars** (`Node/.env`): `PORT`, `MONGODB_URL`, `ACCESSSECRETE`, `REFRESHSECRETE`, `RESETSECRET`, `DEEPSEEK_JWT_SECRET`, `GD_MAP_JWT_SECRET`, `AMAP_WEB_SERVICE_KEY` (Amap Web service key for `Services/amapPlaces.js` — distinct from `GD_MAP_JWT_SECRET` and from the JS API key `useAmap.js` loads client-side), `DS_SERVICE_BASEURL`.

## `react-frontend/` — React SPA

Tech: React 19, Redux Toolkit + Redux Thunk, React Router v6, MUI + Emotion, axios.

**Commands** (run from `TBS/react-frontend/`):
- `npm start` — dev server (`react-scripts start`), proxies API calls to `http://localhost:6666` (see `"proxy"` in `package.json` — i.e. the `Node/` backend above, not DS-Service directly)
- `npm run build` — production build
- `npm test` — CRA/Jest test runner (`react-scripts test`)

**Structure:** standard Create React App layout — `src/actions`, `src/reducers`, `src/components`, `src/hooks`, `src/utils`, `src/store.js` (Redux store setup), `src/App.js`.

**Conventions:** the frontend never talks to DS-Service directly — it goes through the `Node/` backend (`/dsservice/*`, `/trip/*` routes), which in turn calls DS-Service. If you're adding a UI feature that needs DS-Service data, the new/changed logic belongs in `Node/APIs/dsservice.js` (or a new route module) first, following DS-Service's contract, then wired up to the frontend through the existing proxy.

## Test Accounts

A throwaway QA account exists in the dev MongoDB for testing authenticated UI flows (nav bar's logged-in dropdown, profile-gated features, etc.) without registering a new user every time: **`tbs-qa-tester@example.com`** (FirstName: QA, LastName: Tester, Phone: `0000000001`). Created via the real `POST /auth/register` flow, not inserted directly into Mongo.

**Password is intentionally not written here** — this file is git-tracked and pushed to GitHub, so credentials (even throwaway test ones) don't belong in it. It's saved in Claude's cross-session memory as a reference entry instead; ask Claude to recall it. If it's ever unavailable, just register a fresh replacement the same way (see `Node/Validation/register.js` for required fields, and note `Phone` must be unique per user — use a new synthetic value, not the schema's `"xxx"` default, to avoid a collision).

## Pending Tasks

**Before picking up a new task from this list:** (1) check that `main` is up to date (`git checkout main && git pull`), (2) check out a new branch for the task. Don't build on top of a stale `main` or an unrelated branch left over from a previous task.

Backlog items surfaced while working on other plans, deliberately kept out of the active plan's PR scope. Pick these up as their own future PRs.

- **Network-reachability-based provider routing.** Surfaced while testing the Amap place lookup used for the has-a-place accommodation flow: Amap's POI data/keyword matching is unreliable outside mainland China (English-language searches for well-known hotels in Paris/Tokyo returned irrelevant results even with correct city scoping). The routing needed here is two separate axes, not one "China vs. not" switch:
  - **User's network/region is the reachability gate, not a quality preference.** Google's services (Maps included) are blocked at the network level inside mainland China, so a China-network user planning a *non-China* trip still can't be routed to Google Maps — it simply won't load for them, regardless of match quality. Likewise ChatGPT/OpenAI's API is generally unreachable from mainland China. So:
    - **China network** → Amap (+ DS-Service `ds: 'deepseek'`) for **every** destination, for now — not because Amap is a good fit for e.g. a Tokyo search, but because it's the only reachable option. This is an accepted limitation, not a bug, until there's a real fix for the geofencing (e.g. a server-side proxy that calls Google Places from outside China on the user's behalf, so the client never talks to Google directly — worth designing later, not part of this item).
    - **Non-China network** → both Amap and Google Maps are reachable, so **destination-based** routing can apply within this group: Amap for China destinations (best data there), a new `Services/googlePlaces.js` (not yet built) + DS-Service `ds: 'chatgpt'` for non-China destinations (already scaffolded as a `501` stub in `POST /datasourcing/sourcespots` — see DS-Service's `CLAUDE.md` — but not yet implemented).
  - **Query-language translation follows whichever provider is active, not the user's own language.** Translating the query to Chinese is what actually fixed Amap's match quality in testing — that holds whenever Amap is in use, whether it was chosen because the destination is in China or because the user's network left no other option. No translation is expected to be needed for Google Maps queries (handles multi-language input more gracefully).
  - **UI language and LLM-backend selection are a separate, user-scoped concern**, independent of the above: default UI language from IP region (China IP → Chinese default, overridable via the language switcher — `react-i18next` + `components/layout/LanguageSwitcher.js` now built, currently defaulting to browser language rather than true IP-region detection), and LLM backend follows the same network-reachability gate as the maps provider (China network → Deepseek, regardless of destination).
  - Scope for the eventual PR: land the network-based reachability gate and the destination-based refinement within the non-China group. The non-China Google Maps/ChatGPT build-out and the China-network geofencing workaround are both separate follow-ups, not part of this either.
- **Translate the rest of the app beyond the homepage hero/nav.** Once the language-switcher wrapper lands, the auth modals (Login/Register/ForgotPassword), `Footer`, and the `Itinerary` page are all still English-only — extend the same `react-i18next` setup to cover them.
- **Translate the chatbot's dynamic conversation text.** Everything `Node/APIs/trip.js` generates (stage questions, the accommodation candidate/suggestion lists, error messages) is server-generated English text that mixes template wording with real dynamic data (hotel names, addresses) — the frontend `react-i18next` switcher can't cover this. Needs either server-side i18n on the reply templates or an LLM-based translation pass; a distinct, larger effort from the UI switcher.
- **End-to-end test coverage.** Neither `Node/` nor `react-frontend/` has real tests today — `Node/package.json` defines no test script at all, and `react-frontend/package.json`'s `npm test` is CRA's default (`react-scripts test`) with no test files beyond the untouched boilerplate `App.test.js`. Add e2e coverage for the trip-intake flow (stage machine + accommodation confirm/suggest branches) as a starting point — this session's verification of the lodging flow relied entirely on ad hoc manual simulation scripts, which don't persist as regression protection.
- **Caching layer for volatile external lookups (e.g. Redis).** Decided against storing a raw price field on the `Accommodation` sub-document (`DB_Trip.js`) since pricing is date/availability-dependent and goes stale almost immediately — it should be fetched live at suggestion/generation time, not persisted in Mongo. That means repeated fetches to `Services/amapPlaces.js` (and its future `googlePlaces.js` sibling) are expected by design, so a caching layer with a short TTL is needed in front of these lookups to avoid hammering the external API on every near-duplicate query. See DS-Service's `CLAUDE.md` for the matching need on its side (LLM-sourcing calls and any future live price fetches).
