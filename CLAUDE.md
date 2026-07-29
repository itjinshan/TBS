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
- `Validation/` — plain-function request-body validators (`login.js`, `register.js`, `resetPassword.js`, `isEmpty.js`).

**Conventions:**
- Route handlers use `.then()/.catch()` (not async/await) throughout `APIs/auth.js` and `APIs/trip.js`.
- DB model fields are PascalCase (`FirstName`, `Email`, `ResetToken`), matching DS-Service's convention — keep new fields consistent with this casing.
- User-facing auth routes issue tokens via `generateAccessToken(user, 'auth' | 'refresh' | 'deepseek')` in `Config/jwtgenerator.js`. The `'deepseek'` usage is what signs the `token` field DS-Service expects (60s expiry, secret `DEEPSEEK_JWT_SECRET` — must match DS-Service's copy of the same secret).
- Calls into DS-Service go through `axios` with the base URL `process.env.DS_SERVICE_BASEURL`; see `APIs/dsservice.js` for the current pattern (mint a `'deepseek'` token, attach it as `token` in the JSON body — not a header — then POST).

**Env vars** (`Node/.env`): `PORT`, `MONGODB_URL`, `ACCESSSECRETE`, `REFRESHSECRETE`, `RESETSECRET`, `DEEPSEEK_JWT_SECRET`, `GD_MAP_JWT_SECRET`, `DS_SERVICE_BASEURL`.

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
