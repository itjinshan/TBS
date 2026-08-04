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

1. **Source real spots for the destination** (`Node/Services/spotSourcing.js`) — calls DS-Service's `POST /datasourcing/sourcespots`, requesting at least `max(6, duration × 3 × 1.3)` spots — the `× 3` is an average-case estimate (day-sizing is time-based, not a fixed per-day count, so the real number needed varies) and the `× 1.3` pads that estimate so a trip with slower-than-average spots is still likely to have enough to fill every day. DS-Service checks its own MongoDB for spots already sourced for that city before ever asking the LLM, and only tops up the shortfall — repeat requests for a popular city are cheap and don't create duplicate data. See DS-Service's README for the sourcing details.
2. **Arrange the spots into days** (`Node/Services/itineraryPlanner.js`) — real spots come back with real latitude/longitude, so instead of just slicing the list evenly, the spots are ordered into a **greedy nearest-neighbor tour** starting from an anchor point (the traveler's accommodation if it has real coordinates, otherwise the geographic centroid of all the spots). This keeps each day's plan geographically coherent — a day's spots cluster in the same part of the city rather than zigzagging across it. A day-by-day walk over that tour then decides how many spots each day actually holds against a **time budget**, accumulating each spot's own `AverageTimeSpent` plus an estimated travel time between spots (distance via `haversineDistance`, converted to minutes via an assumed speed for the traveler's transportation mode — currently always public transit, see "Known limitations" below) — so a day of quick, close-together spots naturally fits more than a day with a big museum or long transfers, instead of a flat count. The size of that budget itself comes from the traveler's chosen **vacation pace** — Relaxed, Standard, or Packed, asked during intake and editable as a chip in the Trip Brief panel (with a hover explanation of what each means) — so the same spot pool produces a noticeably lighter or fuller day depending on which one they picked; Standard (~7.5 active hours after a flat meal/rest allowance) matches this feature's original single fixed budget. The same walk also biases toward a **varied category mix per day**: each spot carries a `Category` from DS-Service's fixed vocabulary (museum, food, park, etc.), and if the next spot in tour order would repeat a category already placed that day, the day-builder looks a few spots ahead in the tour for a fresh-category one that still fits the remaining budget and pulls it forward instead — geography and time stay the primary signal, but a day doesn't end up three museums in a row just because they happened to be next to each other on the map.

If spot sourcing fails outright (DS-Service unreachable, or it returns zero spots), `/trip/generate` falls back to `Node/Services/fallbackItinerary.js` — a synthetic itinerary built from a small set of generic placeholder spots ("Old Town Walking Tour," etc.) jittered around the destination's approximate coordinates, so the user still gets *an* itinerary rather than an error page. A partial real result (fewer spots than requested, for an obscure destination) still proceeds with what came back, since the day-arrangement step degrades gracefully on its own rather than needing a full fallback.

### Known limitations

- **Day-sizing is time-budget- and pace-aware, but every trip is assumed to use public transit.** `itineraryPlanner.js` allocates each day against an active time budget sized by the traveler's chosen pace (Relaxed/Standard/Packed) rather than a flat spot count — it accounts for each spot's own `AverageTimeSpent` and estimates travel time between spots (via `haversineDistance` and a per-mode speed heuristic), so a day of quick, close-together spots naturally fits more than a day with a big museum or long transfers. What it doesn't do yet: ask the traveler's actual mode of transportation — every trip is arranged as if traveling by public transit, since there's no intake question for it yet, so a driving or walking trip's real day capacity may look different from what's shown.
- **Spots can occasionally get filed under a neighboring city.** DS-Service resolves each spot's city from the LLM's own response, which is sometimes more geographically precise than the requested destination (e.g. Lisbon's Cristo Rei landmark is technically across the river in Almada) — this doesn't affect what the traveler sees, but can make DS-Service's duplicate-avoidance slightly less effective than it looks. See DS-Service's `CLAUDE.md` for detail.
