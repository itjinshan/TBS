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
