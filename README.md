# TBS — Travel Buddy Service

TBS is a MERN-stack travel-planning application. Users chat through a trip-intake flow, and the app builds out a day-by-day itinerary for their destination. It consists of a React single-page frontend backed by an Express/MongoDB API, which in turn calls the separate [DS-Service](https://github.com/itjinshan/DS-Service) backend for LLM-powered trip planning and destination data.

## What it does

- **User accounts** — registration (gated on email verification), login, password reset, and JWT-based session auth with silent access-token refresh. Login is protected against brute-forcing by both IP-based rate limiting and a per-account lockout after repeated failed attempts. See ["How Auth Works"](#how-auth-works) below.
- **Trip intake** — a conversational flow that extracts trip details (destination, duration, travelers, budget) from user input using real LLM-based language understanding (via DS-Service).
- **Itinerary generation** — sources real points of interest for the destination (via DS-Service) and arranges them into a geographically-clustered day-by-day itinerary. See ["How Itinerary Generation Works"](#how-itinerary-generation-works) below.
- **Trip storage** — saved trips are persisted per user and retrievable by ID.

## Architecture

This repo contains two independently run projects:

| Directory | What it is |
|---|---|
| `Node/` | Express API: auth, trip intake/storage, and the integration point with DS-Service |
| `react-frontend/` | React SPA — the user-facing app |

The frontend talks only to the `Node/` backend; the `Node/` backend is the one that calls out to DS-Service. See the root [`CLAUDE.md`](../CLAUDE.md) for how the two services relate.

## Tech stack

- **Backend:** Express, Mongoose, Passport (JWT strategy), bcryptjs, nodemailer, axios
- **Frontend:** React 19, Redux Toolkit, React Router, MUI

## Getting started

Each directory has its own dependencies and must be set up separately.

### Backend (`Node/`)

```bash
cd Node
npm install
```

Create a `.env` file in `Node/`:

```
PORT=6666
MONGODB_URL=<your MongoDB connection string>
ACCESSSECRETE=<JWT access token secret>
REFRESHSECRETE=<JWT refresh token secret>
RESETSECRET=<password reset token secret>
EMAIL_VERIFY_SECRET=<JWT email-verification token secret>
DEEPSEEK_JWT_SECRET=<shared secret with DS-Service>
GD_MAP_JWT_SECRET=<maps API secret>
DS_SERVICE_BASEURL=<base URL of the DS-Service instance to call>
EMAIL=<nodemailer SendinBlue account email, for verification/welcome/password-reset emails>
EMAILPASS=<nodemailer SendinBlue account password>
```

Run the server:

```bash
npm run dev   # auto-restarting dev server
npm start     # single run, no reload
```

The API listens on `PORT` (default `6666`).

### Frontend (`react-frontend/`)

```bash
cd react-frontend
npm install
npm start
```

The dev server proxies API requests to `http://localhost:6666` (the `Node/` backend above), so the backend should be running first.

Other available scripts: `npm run build` (production build), `npm test` (test runner).

## Project structure

```
Node/
  index.js               App entry point
  APIs/                   Route handlers (auth, trip, DS-Service proxy)
  Config/                 JWT generation, Passport setup
  DB_Models/              Mongoose schemas (User, Trip)
  Emails/                 Transactional email templates
  Services/
    spotSourcing.js       Real spot sourcing via DS-Service
    itineraryPlanner.js   Geographic day-clustering
    nluExtraction.js      Real LLM-based intake field extraction
    ruleBasedExtraction.js  Regex/keyword fallback for the above
    fallbackItinerary.js   Synthetic itinerary, used only if the real path fails
  Validation/             Request validation helpers

react-frontend/
  src/
    actions/          Redux actions
    reducers/          Redux reducers
    components/        UI components
    hooks/              Custom React hooks
```

## How Auth Works

### Registration and email verification

`POST /auth/register` creates the account with `IsVerified: false` and emails a verification link (`Node/Emails/verifyEmail.js`) containing a signed, 24-hour-expiry JWT — it does **not** auto-log the user in. The frontend shows a "check your email" notice instead of closing the modal (`components/auth/RegisterModal.js`).

Clicking the emailed link lands on `/verify-email`, which reads the token from the URL and calls `PUT /auth/verify-email` (`components/auth/VerifyEmail.js`). On success, the account is marked verified and a welcome email fires (`Node/Emails/welcomeEmail.js`). `POST /auth/login` rejects unverified accounts with `403`; the login form surfaces a "Resend verification email" link (`POST /auth/resend-verification`) whenever that specific error comes back.

Accounts that existed before this feature shipped default to `IsVerified: true` (`DB_Models/DB_User.js`), so nothing already registered is locked out retroactively — only new signups go through the gate.

### Brute-force protection

`POST /auth/login` is rate-limited per IP (`express-rate-limit`, 20 requests/15 min) and separately locks out per-account after 5 failed password attempts within that window, returning `423` with a minutes-remaining message until the lock expires. Both counters reset on a successful login.

### Access/refresh tokens

`AccessToken`s expire after 1 hour; `RefreshToken`s expire after 7 days (`Config/jwtgenerator.js`). The frontend's axios response interceptor (`react-frontend/src/utils/axiosInterceptors.js`) catches a `401`, redeems the stored `RefreshToken` via `POST /jwt/refresh` for a fresh token pair, and retries the original request — so a user's session survives past the 1-hour access-token expiry without forcing a re-login. If the refresh token itself is invalid or expired, the user is logged out client-side.

## How Itinerary Generation Works

Trip generation is a two-part pipeline: the conversational intake flow that collects the trip's parameters, and the itinerary-generation step that turns those parameters into a real day-by-day plan.

### 1. Trip intake — real NLU extraction

The chat-based intake flow (`Node/APIs/trip.js`'s `/trip/intake` route) walks the user through a fixed sequence of stages (destination → accommodation → budget/preferences → duration/travelers → ready to generate). At each stage, the user's free-text reply needs specific fields pulled out of it — e.g. "5 days, just the two of us" → `{ duration: 5, numOfTravelers: 2 }`.

This extraction is done for real: `Node/Services/nluExtraction.js` sends the message to DS-Service's `POST /nlu/extract` endpoint, which asks an LLM to pull out only the requested fields (destination, duration, traveler count, budget tier, or a yes/no answer) as structured JSON — not regex or keyword matching. A `context` hint is included for yes/no questions (e.g. "whether the traveler already has a place to stay") since a bare "yes"/"no" has no other way of being disambiguated.

If DS-Service is unreachable or the call otherwise fails, `nluExtraction.js` falls back internally to `Node/Services/ruleBasedExtraction.js` — the original regex/keyword matchers — so the conversation degrades gracefully instead of erroring out. This fallback is intentionally narrower than the LLM path (a small hardcoded destination list, simple pattern matching for duration/budget/traveler count), so real extraction is noticeably smarter, especially for destinations or phrasing the regex list was never written to expect.

### 2. Itinerary generation — real spot sourcing + geographic clustering

Once the user hits "Generate Itinerary," `Node/APIs/trip.js`'s `/trip/generate` route does two things in sequence:

1. **Source real spots for the destination** (`Node/Services/spotSourcing.js`) — calls DS-Service's `POST /datasourcing/sourcespots`, requesting at least `max(6, duration × 3)` spots. DS-Service checks its own MongoDB for spots already sourced for that city before ever asking the LLM, and only tops up the shortfall — repeat requests for a popular city are cheap and don't create duplicate data. See DS-Service's README for the sourcing details.
2. **Arrange the spots into days** (`Node/Services/itineraryPlanner.js`) — real spots come back with real latitude/longitude, so instead of just slicing the list evenly, the spots are ordered into a **greedy nearest-neighbor tour** starting from an anchor point (the traveler's accommodation if it has real coordinates, otherwise the geographic centroid of all the spots), then sliced into balanced day-sized chunks. This keeps each day's plan geographically coherent — a day's spots cluster in the same part of the city rather than zigzagging across it. The slicing step also biases toward a **varied category mix per day**: each spot carries a `Category` from DS-Service's fixed vocabulary (museum, food, park, etc.), and if the next spot in tour order would repeat a category already placed that day, the day-builder looks a few spots ahead in the tour for a fresh-category one and pulls it forward instead — geography stays the primary signal, but a day doesn't end up three museums in a row just because they happened to be next to each other on the map.

If spot sourcing fails outright (DS-Service unreachable, or it returns zero spots), `/trip/generate` falls back to `Node/Services/fallbackItinerary.js` — a synthetic itinerary built from a small set of generic placeholder spots ("Old Town Walking Tour," etc.) jittered around the destination's approximate coordinates, so the user still gets *an* itinerary rather than an error page. A partial real result (fewer spots than requested, for an obscure destination) still proceeds with what came back, since the day-arrangement step degrades gracefully on its own rather than needing a full fallback.

### Known limitations

- **"3 spots per day" is a fixed heuristic, not a time budget.** The system currently allocates a constant number of spots per day (`SPOTS_PER_DAY` in `itineraryPlanner.js`) rather than modeling how much a real day actually holds. It doesn't account for each spot's typical visit duration (already collected as `AverageTimeSpent` on every sourced spot, but currently unused for day-sizing), doesn't measure or budget actual travel time between spots (nearest-neighbor ordering *reduces* zigzagging but doesn't calculate travel time against a clock), and doesn't reserve time for meals or rest. It also doesn't yet ask the traveler's mode of transportation (public transit, taxi/rideshare, or driving), which meaningfully changes real travel time between the same two points — a good candidate to add to the intake flow alongside a real time-budget model.
- **Spots can occasionally get filed under a neighboring city.** DS-Service resolves each spot's city from the LLM's own response, which is sometimes more geographically precise than the requested destination (e.g. Lisbon's Cristo Rei landmark is technically across the river in Almada) — this doesn't affect what the traveler sees, but can make DS-Service's duplicate-avoidance slightly less effective than it looks. See DS-Service's `CLAUDE.md` for detail.
