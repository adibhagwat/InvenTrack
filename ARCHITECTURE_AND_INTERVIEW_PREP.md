# InvenTrack — System Design & Interview Prep Guide

This is not a build doc — it's a *thinking* doc. Every section pairs a design
decision with the reasoning behind it, because in an interview you won't be
asked "what did you build," you'll be asked "why did you build it that way."

---

## 1. System Architecture

```
┌─────────────┐      HTTPS       ┌──────────────┐
│   Browser    │ ───────────────▶ │   Frontend    │
│  (React SPA) │ ◀─────────────── │ Nginx + React │
└─────────────┘                  └──────┬───────┘
                                          │ REST/JSON
                                          ▼
                                  ┌──────────────┐    SQLAlchemy   ┌──────────────┐
                                  │   Backend     │ ───────────────▶│  PostgreSQL  │
                                  │   FastAPI     │ ◀───────────────│   Database   │
                                  └──────────────┘                └──────────────┘
```

Three independent services, each in its own container, talking over a Docker
network. This is a **3-tier architecture**: presentation (React), application
(FastAPI), data (Postgres).

**Why FastAPI over Flask/Django?**
- Built-in request validation via Pydantic — invalid data gets rejected before
  it touches business logic, with zero manual `if` checks.
- Auto-generated OpenAPI docs (`/docs`) — a real artifact you can show in an
  interview as evidence of API design discipline, not just claim it.
- Async-native — even though this project doesn't lean on async heavily, it's
  the right default for an I/O-bound API talking to a database.
- *Counterpoint an interviewer might raise*: Django gives you an admin panel
  and ORM for free, faster for CRUD-heavy apps. Fair point — FastAPI was
  chosen here for explicit control over validation and because the spec asked
  for FastAPI/Flask specifically.

**Why PostgreSQL over MongoDB/NoSQL?**
- The data is inherently relational: an order *references* a customer and
  *references* products. Foreign keys and joins are the natural fit.
- ACID transactions matter here — stock deduction must be atomic with order
  creation. NoSQL databases either lack this or make you build it yourself.

**Why Docker Compose over Kubernetes?**
- Compose is the right tool for a single-host, 3-service app. Kubernetes
  solves problems (multi-node scheduling, rolling updates, service mesh) this
  project doesn't have. Reaching for k8s here would be over-engineering — and
  knowing when *not* to use a tool is itself a signal of seniority.

---

## 2. Folder Structure & the Pattern Behind It

```
backend/app/
├── main.py        # wires everything together, owns startup/CORS
├── database.py    # engine + session factory (infrastructure concern)
├── models.py       # SQLAlchemy ORM — the data layer
├── schemas.py       # Pydantic — the validation/contract layer
├── crud.py          # business logic / "service" layer
└── routers/         # HTTP layer — thin, just wiring requests to crud.py
```

This is a **layered architecture**, the same idea as MVC but renamed for an
API context:

| Layer       | Responsibility                          | Analogous to        |
|-------------|------------------------------------------|----------------------|
| `routers/`  | Parse HTTP request, call business logic | Controller           |
| `schemas.py`| Validate shape/types of data in & out   | DTO / View model      |
| `crud.py`   | Business rules, transactions             | Service layer         |
| `models.py` | Persistence, table structure             | Model / Repository     |

**Why this separation matters (interview-relevant):** routers never talk to
the database directly. If you swapped Postgres for MySQL, or REST for GraphQL,
only one layer changes at a time. That's the actual point of layered
architecture — not "clean code" for its own sake, but isolating the blast
radius of a future change.

Frontend mirrors the same instinct:
```
frontend/src/
├── api/client.js     # the ONLY place that knows about fetch() and the API URL
├── components/       # reusable, presentation-focused
└── pages/             # one per route, owns its own data-fetching
```
If the API URL or auth scheme changes, exactly one file (`client.js`) changes.

---

## 3. Database Schema

```
customers                  orders                    order_items                products
─────────                  ──────                    ───────────                ─────────
id (PK)                    id (PK)                    id (PK)                    id (PK)
name                       customer_id (FK) ─────▶    order_id (FK)  ─────▶      sku (unique)
email (unique)             status                     product_id (FK) ──────▶   name
phone                      total_amount               quantity                   price
created_at                 created_at                 unit_price                 stock_quantity
                                                                                   created_at
```

**Relationships:**
- `customers 1 ──── N orders` — one customer can place many orders.
- `orders N ──── N products` through `order_items` — a junction/association
  table, because an order can contain many products, and a product can
  appear on many orders.

**Why `order_items` exists as its own table (a classic interview question):**
Without it, you'd have to cram a list of products into a single column on
`orders` — denormalized, unqueryable, and impossible to validate. With a
junction table:
1. You can query "how many times has product X been ordered?" with a simple
   join, not string parsing.
2. **`unit_price` is stored on the line item, not looked up from `products`
   live.** This is deliberate: if a product's price changes next week, past
   orders must still reflect what the customer actually paid. This is called
   **price snapshotting** and it's a real production pattern, not just an
   assessment detail — be ready to explain *why* you did it, not just *that*
   you did it.

**Constraints enforced at the database level, not just in application code:**
- `CHECK (stock_quantity >= 0)` and `CHECK (price >= 0)` on `products`.
- `UNIQUE` on `products.sku` and `customers.email`.

Why both DB-level *and* app-level checks? App-level checks give nice error
messages. DB-level constraints are the actual safety net — they catch bugs,
race conditions, or anyone who bypasses the API and hits the DB directly.
**Defense in depth.**

---

## 4. API Endpoint Design

| Resource   | Method | Path              | Status on success | Notes                          |
|------------|--------|--------------------|--------------------|----------------------------------|
| Products   | POST   | `/products/`       | 201                | Full CRUD — products are mutable |
|            | GET    | `/products/`       | 200                |                                  |
|            | GET    | `/products/{id}`   | 200                |                                  |
|            | PUT    | `/products/{id}`   | 200                |                                  |
|            | DELETE | `/products/{id}`   | 204                |                                  |
| Customers  | POST   | `/customers/`       | 201                | No PUT — see note below          |
|            | GET    | `/customers/`       | 200                |                                  |
|            | DELETE | `/customers/{id}`   | 204                |                                  |
| Orders     | POST   | `/orders/`           | 201                | No PUT — see note below          |
|            | GET    | `/orders/`           | 200                |                                  |
|            | DELETE | `/orders/{id}`       | 204                |                                  |
| Dashboard  | GET    | `/dashboard/`         | 200                | Aggregate/read-only              |

**Why no `PUT /orders/{id}`?** Orders are a record of a transaction that
already happened — like a receipt. Editing a placed order in-place would
corrupt the audit trail (what if you "edit" the quantity after stock was
already deducted?). The correct operations on an order are *create* and
*cancel*, never *mutate*. This is an intentional design choice, and a good
one to name explicitly in an interview — it shows you thought about orders as
**immutable events**, not just another row to update.

**HTTP status code choices that matter:**
- `400` — client sent invalid data, or violated a business rule (duplicate
  SKU, insufficient stock). The client can fix this by changing the request.
- `404` — resource doesn't exist. Different from 400: nothing about the
  request was wrong, the thing just isn't there.
- `204` — successful delete, intentionally empty body (nothing to return).

Be ready to explain *why* insufficient stock is `400` and not, say, `409
Conflict`. Reasonable answer: this is a validation failure from the client's
perspective ("you asked for more than exists"), and 409 is more conventionally
reserved for edit-conflict scenarios. Both are defensible — what matters in
an interview is that you can justify the choice, not that there's one true
answer.

---

## 5. Core Business Logic: the Order Creation Transaction

This is the heart of the project and the part most likely to get probed
deeply. Walk through it like this if asked "what happens when someone places
an order?":

1. **Validate the customer exists.** Fail fast with 404 if not.
2. **Validate every line item *before* changing anything.** Loop through
   requested products, check each one exists and has enough stock. If *any*
   item fails, the whole request is rejected — nothing is partially applied.
3. **Compute the total server-side.** Never trust a total sent by the client;
   it's recalculated from each product's current price × quantity.
4. **Create the order row, then the order_item rows, then deduct stock —
   all within one database transaction.** If anything fails partway, the
   whole transaction rolls back automatically.
5. **Commit.** Only now is the change durable.

**The interview-gold question: "What if two customers order the last unit of
the same product at the same time?"**
Honest answer: in the current implementation, there's a **race condition**.
Both requests could read `stock_quantity = 1` before either commits, and both
could succeed, overselling by one unit. The real fix is one of:
- A `SELECT ... FOR UPDATE` row lock when reading the product during order
  creation, so the second transaction blocks until the first commits.
- Or relying on the database `CHECK (stock_quantity >= 0)` constraint as a
  last line of defense — the second transaction's `UPDATE` would violate the
  constraint and fail, which at least prevents negative stock even if it
  doesn't give a clean error message.

**Naming this gap unprompted, with the fix you'd apply, is a stronger signal
than pretending the system is flawless.** Interviewers trust candidates who
know their own system's edges.

---

## 6. Frontend Architecture

- **State management: local component state (`useState`), no Redux.**
  Justification: the app has no state that needs to be shared across distant,
  unrelated components — each page owns and fetches its own data. Redux would
  add ceremony without solving a problem that exists here. *Know this
  trade-off*: if the app grew (e.g., a shopping-cart-style order builder
  shared across pages), a global store would start to make sense.
- **API client as a single module (`api/client.js`).** Every network call
  funnels through one `request()` helper that handles base URL, headers, and
  error parsing once. No component calls `fetch()` directly.
- **Optimistic vs. pessimistic UI updates:** this app re-fetches the list
  after every mutation (pessimistic — wait for the server to confirm) rather
  than updating local state immediately (optimistic). Simpler and safer for
  an app where business-rule rejections (insufficient stock) are common and
  must be reflected accurately.

---

## 7. Containerization & Deployment Architecture

**Why a multi-stage Dockerfile for the frontend?**
Stage 1 (`node:20-alpine`) installs dependencies and runs `npm run build` —
needs Node, npm, and all dev dependencies. Stage 2 (`nginx:alpine`) copies
*only* the compiled static files (`dist/`) into a fresh, minimal image. The
final image never contains Node, npm, or `node_modules` — smaller image,
smaller attack surface. This is a standard production pattern, not specific
to this project — good to mention generically.

**Why does the backend Dockerfile install `gcc`/`libpq-dev`?**
`psycopg2` (the Postgres driver) has C extensions that need compiling against
`libpq` at install time. Using `-slim` base images means these aren't present
by default, so they're installed explicitly. A further optimization worth
mentioning if asked "how would you shrink this image further?" — removing
build tools in a later layer, or switching to `psycopg2-binary` wheels (which
this project already uses, avoiding the compile step in practice).

**Why environment variables instead of config files?**
This follows the 12-factor app principle: config that varies between
environments (dev/staging/prod) — like `DATABASE_URL` — must live in the
environment, never in code. This is also *why* `.env` is gitignored but
`.env.example` is committed: the example documents the shape of the config
without leaking real secrets.

---

## 8. Development Roadmap (and why this order)

1. **Database schema first.** Everything else depends on knowing the data
   shape.
2. **Backend models → business logic → routes, tested in isolation** (every
   business rule was verified with a scripted test pass before touching the
   frontend). Reasoning: the frontend is just a client of the API contract —
   building it against an unstable or unverified backend means re-doing UI
   work every time the API shape changes.
3. **docker-compose.yml**, to get the full stack running together locally.
4. **Frontend**, built against the now-stable, already-tested API.
5. **GitHub push → Docker Hub push → deploy (Render + Vercel) → wire up env
   vars for cross-origin communication.**

The general principle worth stating in an interview: **build and verify the
layer with the most dependents first.** The database schema has the most
downstream dependents (backend *and* frontend depend on it), so it's locked
in first; the frontend has the fewest dependents, so it comes last.

---

## 9. Known Limitations (own these — don't wait to be caught)

| Limitation                                   | Production fix                                  |
|-----------------------------------------------|----------------------------------------------|
| No authentication/authorization                | JWT-based auth, role checks (admin vs. staff) |
| Race condition on concurrent stock updates     | Row-level locking (`SELECT ... FOR UPDATE`)    |
| No automated test suite checked into the repo  | `pytest` suite with a test database fixture    |
| `skip`/`limit` pagination, no cursor            | Cursor-based pagination for large datasets      |
| No rate limiting                               | Middleware (e.g. `slowapi`) or API gateway       |
| No audit log of who changed/cancelled what      | An `audit_log` table or event-sourcing pattern  |

Listing these *unprompted* in an interview is almost always a better outcome
than an interviewer finding one and you not having an answer ready.

---

## 10. Anticipated Interview Questions — Crisp Answers

**"Walk me through your architecture."**
> Three-tier: React SPA served by Nginx, talking over REST to a FastAPI
> backend, backed by PostgreSQL. Each tier is its own Docker container,
> orchestrated with Docker Compose.

**"Why FastAPI?"**
> Built-in request validation via Pydantic, auto-generated API docs, and it
> was one of the two backend frameworks the assignment allowed.

**"How do you prevent overselling?"**
> Stock is validated against requested quantity before any database write,
> and the order, its line items, and the stock deduction all happen inside a
> single transaction — so a failure midway rolls everything back, never a
> partial state.

**"What's the biggest weakness in your design?"**
> No row-level locking yet, so two simultaneous orders for the last unit of
> a product could both pass validation before either commits. I'd add a
> `SELECT FOR UPDATE` lock on the product row during order creation to fix
> that properly.

**"Why a separate `order_items` table instead of a list field on `orders`?"**
> Lets an order contain multiple products, keeps the schema queryable and
> normalized, and — importantly — stores the unit price at time of purchase
> so historical orders stay accurate even if product prices change later.

**"How would you scale this to 10x traffic?"**
> Backend is stateless, so horizontal scaling behind a load balancer works
> immediately. The real bottleneck would be the single Postgres instance —
> I'd look at read replicas for `GET` traffic and connection pooling
> (PgBouncer) before considering anything more drastic.

**"Why Docker Compose and not Kubernetes?"**
> Compose fits a single-host, fixed number of services. Kubernetes solves
> multi-node orchestration and auto-scaling problems this project doesn't
> have — using it here would be solving a problem I don't have yet.

---

## How to use this doc

Don't memorize it word-for-word — that reads as rehearsed. Read it twice,
then try explaining section 5 (the order transaction) and section 9
(limitations) out loud from memory without looking. Those two sections are
where most real interview depth comes from.
