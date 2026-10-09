# TrustSphere AI

TrustSphere AI is a modular trust and risk intelligence platform. This initial
project establishes the runnable full-stack foundation:

- React + TypeScript + Vite frontend in `client`
- Express + TypeScript API in `server`
- FastAPI AI service
- Tailwind CSS and TanStack Query
- ESLint and Prettier

## Prerequisites

- Node.js 22+
- npm 11+
- Python 3.13+
- Docker Desktop for MongoDB, Redis, and containerized services

## Local development

1. Copy `.env.example` to `.env`.
2. Install JavaScript dependencies:

   ```powershell
   npm install
   ```

3. Create the Python virtual environment and install AI dependencies:

   ```powershell
   py -3.13 -m venv .venv
   .\.venv\Scripts\python.exe -m pip install -r ai-service\requirements.txt
   ```

4. Start all practical development services from the repository root:

   ```powershell
   npm run dev
   ```

This starts the Vite client on `http://localhost:5173`, Express on
`http://localhost:4000`, and FastAPI on `http://localhost:8000`. Use separate
terminal commands if you need to start only one service:

```powershell
npm run dev:client
npm run dev:server
npm run dev:ai
```

## VS Code workflow

Open the repository root in VS Code. Use the integrated terminal and run
`npm install`, create `.venv`, install `ai-service\requirements.txt`, then run
`npm run dev`. Open `http://localhost:5173` in a browser.

If Docker Desktop is available, MongoDB and Redis can be started separately:

```powershell
docker compose -f infrastructure\docker-compose.yml up mongodb redis
```

## Verification

```powershell
npm run typecheck
npm run build
npm run lint
npm run format:check
.\.venv\Scripts\python.exe -m py_compile ai-service\app\main.py
.\.venv\Scripts\python.exe -m unittest discover -s ai-service -p "test_*.py"
```

API endpoints:

- `GET http://localhost:4000/api/health` checks that the backend is running.
- `GET http://localhost:8000/health` checks that the AI service is running.
- `GET http://localhost:5173` checks that the frontend is serving the landing page.

Use `curl.exe http://localhost:4000/api/health` and
`curl.exe http://localhost:8000/health` to test the HTTP services.

## MongoDB data layer

The Express service includes a persistence-ready Mongoose data layer under
`server/src/models`. It defines `User`, `Analysis`, `Entity`, `RiskFactor`,
`AnalysisResult`, `Notification`, `AuditLog`, `Alert`, and
`DomainConfiguration`. Analyses reference users and entities, while individual
result records remain separate so large or growing result sets do not create
unbounded embedded arrays.

REST endpoints are available under `/api/v1`:

- `GET|POST /users` and `GET /users/:id`
- `GET|POST /entities` and `GET /entities/:id`
- `GET|POST /analyses`, `GET /analyses/:id`, and `GET /analyses/history`
- `GET|POST /notifications` and `GET /notifications/:id`
- `GET|POST /audit-logs` and `GET /audit-logs/:id`
- `GET /domain-configurations`

List endpoints support `page`, `limit`, `sort`, `search`, and model-specific
filter query parameters. Validation errors return `400` with structured
details. MongoDB indexes cover identity lookups and the common entity,
domain, user, status, and timestamp access patterns.

Import `postman/TrustSphere AI.postman_collection.json` into Postman to exercise
the health check and the CRUD/list endpoints. Start MongoDB first, then start
the API with `npm run dev:server`.

The FastAPI AI service provides `/predict/risk`, `/predict/anomaly`, `/models`,
`/nlp/analyze`, and `/health`. Its Random Forest and XGBoost classifiers and Isolation Forest
anomaly detector are trained at startup from a deterministic, explicitly
labelled synthetic demo dataset. `/models` reports accuracy, precision, recall,
F1, ROC-AUC, and confusion matrices for the classifier comparison, but these
metrics are not production evidence. The selected classifier is chosen by
measured F1, then ROC-AUC, then recall. Replace the demo training provider with
a real labelled dataset before using model metrics operationally.

The NLP endpoint performs sentiment classification, entity extraction, keyword
extraction, suspicious phrase detection, claim extraction, semantic similarity,
and near-duplicate detection. It uses local Transformers, sentence-transformers,
and spaCy models when available; otherwise it reports the deterministic
fallback method in response metadata. It does not invoke an LLM.

## Data ingestion

`POST /api/v1/ingestions` runs the modular ingestion pipeline for `url`, `text`,
`json`, `csv`, `pdf`, and image metadata inputs. Adapters validate and normalize
input, return structured extraction errors, persist an `IngestionRecord`, and
enqueue successful or partial records for analysis. URL fetching uses a
5-second timeout, a 2 MB response limit, and a descriptive demo user agent; it
does not bypass access restrictions or perform aggressive scraping. PDF content
is accepted as base64-encoded PDF bytes. Image ingestion intentionally stores
provided metadata only and does not download images or perform OCR.

## Folder guide

- `client`: React frontend, routes, Vite, Tailwind, and TanStack Query setup.
- `server`: Express application, TypeScript configuration, middleware, health
  route, and server Dockerfile.
- `ai-service`: FastAPI application, Python dependency manifest, virtual
  environment instructions, and AI service Dockerfile.
- `infrastructure`: Optional Docker Compose support for MongoDB, Redis, and
  containerized services.

## Frontend architecture

The client provides responsive routes for the landing page, login, registration,
dashboard, analysis creation, analysis history, entity details, notifications,
profile, and administration. Reusable UI primitives are defined in
`client/src/components.tsx`; request functions are centralized in
`client/src/api.ts`; and TanStack Query hooks are defined in
`client/src/hooks.ts`. Pages consume hooks rather than calling the API directly.

## Real-time events

The server validates Socket.IO credentials before accepting a connection. The
token format is an HMAC-signed `userId.role.signature` value generated by
`createSocketToken` in `server/src/realtime.ts`; set the same
`SOCKET_AUTH_SECRET` in the server environment and provide the token to the
client as `VITE_SOCKET_TOKEN` or in `localStorage` under
`trustsphere.socketToken`. Authenticated sockets automatically join their user
room (`user:<id>`) and role room (`role:<role>`), and can explicitly join
analysis/entity rooms.

Analysis creation performs real database lifecycle operations and emits
`analysis:created`, `analysis:started`, `analysis:progress`,
`analysis:completed` or `analysis:failed`. Notification, entity, alert, risk,
and dashboard events are emitted by their corresponding API operations. The
frontend realtime service in `client/src/realtime.ts` reconnects automatically;
`useRealtimeEvents` invalidates affected TanStack Query caches and exposes the
live event stream to the dashboard and admin pages.

## Deterministic risk rule engine

The modular rule engine is under `server/src/risk-engine`. It extracts features
from analysis input, evaluates the configured rules, applies severity
multipliers, calculates weighted risk/trust scores, and maps the score to a
risk level. The analysis API uses this engine before persisting an analysis;
controllers do not hardcode final scores.

Run its unit tests with:

```powershell
npm run test --workspace server
```

## Multi-domain plugins

The server exposes a plugin registry under `server/src/domain-plugins`. Each
`DomainPlugin` defines its accepted input types, validation, feature extraction,
domain-specific rules, scoring configuration, analysis pipeline, and output
schema. The initial registered domains are:

- `ecommerce`: product, seller, reviews, price, and website signals.
- `recruitment`: job, company, salary, contact, and application-process signals.
- `social-media`: account, followers, engagement, posts, and content signals.
- `website-business`: domain, company, contact, SSL, and business-information signals.

Use `GET http://localhost:4000/api/v1/domains` to inspect the registered
plugins, accepted inputs, rules, scoring configuration, and output schemas.
`POST /api/v1/analyses` selects a plugin by its `domain` value, validates the
input, extracts domain features, and evaluates only that plugin's rules. Unknown
domains retain the existing general-purpose rule-engine fallback.

## Trust and risk scoring

The TrustSphere scoring layer combines the deterministic rule score, optional ML
probability, NLP risk, anomaly score, data quality, and source reliability into
bounded `riskScore` and `trustScore` values from 0 to 100. Missing optional
signals use explicit deterministic defaults; identical inputs always produce
the same result. Risk levels are `low`, `medium`, `high`, or `critical`.

Each analysis also persists an `explainability` structure containing the overall
score, positive and negative signals, triggered rules, ML contribution, NLP and
anomaly indicators, data quality, source reliability, and recommendations.
Recommendations use cautious language: scores describe risk indicators and are
not guaranteed facts or definitive fraud determinations.
