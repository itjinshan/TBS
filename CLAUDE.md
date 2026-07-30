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

## Planned: Lodging Flow (branch: `lodgingFlow`)

Goal: settle accommodation early in the trip-intake flow (right after destination), since it determines the starting location for each day of the generated itinerary. Two branches:

1. **User already has a place** → confirm it (name + address) and use it as the anchor location.
2. **User has no place in mind** → gather budget + living preference, continue the rest of the existing trip-preference questions, then suggest lodging options at the end, ranked by budget and best fit for the generated itinerary's spot locations.

**Conversation stages** (`Node/APIs/trip.js`): replace the current flat `REQUIRED_FIELDS` missing-check with an explicit stage machine: `awaiting_destination → awaiting_accommodation_choice → (has_place: awaiting_confirmation | no_place: awaiting_budget_and_living_pref) → awaiting_other_prefs → (no_place only: suggest_accommodation) → ready`.

**Frontend flow is chat-first; the map is a reveal, not always-on:**
- Default state: intake is chat-only, no map, from the first message through the lodging question.
- **Has-a-place path:** user describes it in chat → backend runs a place-search lookup → frontend mounts the map and drops a marker for *every* candidate match returned (not just one) alongside a "is one of these yours?" chat prompt → user confirms via chat or by tapping a marker → map can then collapse or narrow to just the confirmed pin.
- **No-place path:** map stays hidden through budget/living-preference *and* every remaining trip-preference question. The map's first-ever appearance is the moment the recommended-lodging list is presented — that reveal and the markers for each suggested option happen together.
- Mechanically: map visibility is a derived boolean off the conversation stage (`awaiting_confirmation` or `suggest_accommodation` → on; every other stage → off), fed by new Redux state (`accommodationCandidates` for path A, `accommodationSuggestions` for path B) rather than the itinerary's spot list. The map/marker rendering currently only lives on the post-generation `Itinerary.js` page — it needs to become a component `TripIntakePanel.js` can also mount inline.

**Action items:**
1. Add the conversation stage machine to `Node/APIs/trip.js`, replacing the flat missing-field check.
2. Wire a real place lookup for the "I have a place" path — get a real Amap key (see `react-frontend/src/hooks/useAmap.js`, currently a placeholder `YOUR_AMAP_KEY`), call Amap's place-search/geocoding API, return `{name, address, lat, lng}` candidates for user confirmation.
3. Extend `DB_Trip` and `tripBrief` with an `Accommodation` field (`{ Name, Address, Latitude, Longitude, Source: "user-provided" | "suggested" }`) and a `LivingPreference`/lodging-budget field.
4. Add a "suggest accommodation" step for the no-place path — this is DS-Service's job: a new endpoint (e.g. `POST /datasourcing/sourceaccommodations`) parallel to `sourcespots`, taking destination + budget + (ideally) sourced spot coordinates, returning ranked lodging candidates. Requires a corresponding `DB_Accommodation` model in DS-Service. (See DS-Service's `CLAUDE.md` for its side of this item.)
5. Update `mockItinerary.js`/its real successor to use `tripBrief.Accommodation` coordinates as each day's start/end point instead of the current jittered city-center placeholder.
6. Update `TripIntakePanel.js` to implement the chat-first/map-reveal flow described above.

**Delete this plan when all items are executed and PRs are merged.**

## Pending Tasks

Backlog items surfaced while working on other plans, deliberately kept out of the active plan's PR scope. Pick these up as their own future PRs.

- **Network-reachability-based provider routing.** Surfaced while testing lodging-flow item #2: Amap's POI data/keyword matching is unreliable outside mainland China (English-language searches for well-known hotels in Paris/Tokyo returned irrelevant results even with correct city scoping). The routing needed here is two separate axes, not one "China vs. not" switch:
  - **User's network/region is the reachability gate, not a quality preference.** Google's services (Maps included) are blocked at the network level inside mainland China, so a China-network user planning a *non-China* trip still can't be routed to Google Maps — it simply won't load for them, regardless of match quality. Likewise ChatGPT/OpenAI's API is generally unreachable from mainland China. So:
    - **China network** → Amap (+ DS-Service `ds: 'deepseek'`) for **every** destination, for now — not because Amap is a good fit for e.g. a Tokyo search, but because it's the only reachable option. This is an accepted limitation, not a bug, until there's a real fix for the geofencing (e.g. a server-side proxy that calls Google Places from outside China on the user's behalf, so the client never talks to Google directly — worth designing later, not part of this item).
    - **Non-China network** → both Amap and Google Maps are reachable, so **destination-based** routing can apply within this group: Amap for China destinations (best data there), a new `Services/googlePlaces.js` (not yet built) + DS-Service `ds: 'chatgpt'` for non-China destinations (already scaffolded as a `501` stub in `POST /datasourcing/sourcespots` — see DS-Service's `CLAUDE.md` — but not yet implemented).
  - **Query-language translation follows whichever provider is active, not the user's own language.** Translating the query to Chinese is what actually fixed Amap's match quality in testing — that holds whenever Amap is in use, whether it was chosen because the destination is in China or because the user's network left no other option. No translation is expected to be needed for Google Maps queries (handles multi-language input more gracefully).
  - **UI language and LLM-backend selection are a separate, user-scoped concern**, independent of the above: default UI language from IP region (China IP → Chinese default, overridable via a language switcher), and LLM backend follows the same network-reachability gate as the maps provider (China network → Deepseek, regardless of destination).
  - Scope for the eventual PR: land the network-based reachability gate and the destination-based refinement within the non-China group. The non-China Google Maps/ChatGPT build-out and the China-network geofencing workaround are both separate follow-ups, not part of this either.
- **Language switcher wrapper for the UI.** A reusable language-switcher component/wrapper for `react-frontend`, supporting at least English/Chinese, to back the "default UI language from IP region, overridable via a language switcher" behavior described above.
- **End-to-end test coverage.** Neither `Node/` nor `react-frontend/` has real tests today — `Node/package.json` defines no test script at all, and `react-frontend/package.json`'s `npm test` is CRA's default (`react-scripts test`) with no test files beyond the untouched boilerplate `App.test.js`. Add e2e coverage for the trip-intake flow (stage machine + accommodation confirm/suggest branches) as a starting point — this session's verification of the lodging flow relied entirely on ad hoc manual simulation scripts, which don't persist as regression protection.
- **Caching layer for volatile external lookups (e.g. Redis).** Decided against storing a raw price field on `Accommodation` (see lodging-flow item #3) since pricing is date/availability-dependent and goes stale almost immediately — it should be fetched live at suggestion/generation time, not persisted in Mongo. That means repeated fetches to `Services/amapPlaces.js` (and its future `googlePlaces.js` sibling) are expected by design, so a caching layer with a short TTL is needed in front of these lookups to avoid hammering the external API on every near-duplicate query. See DS-Service's `CLAUDE.md` for the matching need on its side (LLM-sourcing calls and any future live price fetches).
