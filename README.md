# TBS — Travel Buddy Service

TBS is a MERN-stack travel-planning application. Users chat through a trip-intake flow, and the app builds out a day-by-day itinerary for their destination. It consists of a React single-page frontend backed by an Express/MongoDB API, which in turn calls the separate [DS-Service](https://github.com/itjinshan/DS-Service) backend for LLM-powered trip planning and destination data.

## What it does

- **User accounts** — registration, login, password reset, and JWT-based session auth.
- **Trip intake** — a conversational flow that extracts trip details (destination, duration, travelers, budget) from user input.
- **Itinerary generation** — builds a day-by-day itinerary for the trip.
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
DEEPSEEK_JWT_SECRET=<shared secret with DS-Service>
GD_MAP_JWT_SECRET=<maps API secret>
DS_SERVICE_BASEURL=<base URL of the DS-Service instance to call>
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
  index.js           App entry point
  APIs/               Route handlers (auth, trip, DS-Service proxy)
  Config/             JWT generation, Passport setup
  DB_Models/          Mongoose schemas (User, Trip)
  Emails/             Transactional email templates
  Services/           Itinerary generation logic
  Validation/         Request validation helpers

react-frontend/
  src/
    actions/          Redux actions
    reducers/          Redux reducers
    components/        UI components
    hooks/              Custom React hooks
```
