# 🚀 Next Gen Buildathon — Complete Platform Documentation

> **Version**: 1.0.0  
> **Last Updated**: September 16, 2026  
> **Tech Stack**: Express.js + Next.js 14 + PostgreSQL + Redis + Prisma + BullMQ

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [All Files & What They Do](#all-files--what-they-do)
4. [Data Flow & Workflow](#data-flow--workflow)
5. [API Endpoints Reference](#api-endpoints-reference)
6. [Database Schema](#database-schema)
7. [Security Architecture](#security-architecture)
8. [Background Jobs](#background-jobs)
9. [Setup & Running](#setup--running)

---

## 🏗️ Architecture Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        INTERNET                                  │
└──────────────┬───────────────────┬──────────────────────────────┘
               │                   │
    ┌──────────▼───────┐ ┌────────▼─────────┐
    │  Public Website  │ │  Admin Dashboard  │
    │  (Next.js :3000) │ │  (Next.js :3001)  │
    │  apps/public     │ │  apps/admin       │
    └──────────┬───────┘ └────────┬──────────┘
               │                   │
               │    HTTP/JSON      │
               └─────────┬────────┘
                          │
              ┌───────────▼───────────┐
              │     Express API       │
              │    (Node.js :4000)    │
              │     apps/api          │
              │                       │
              │  ┌──────────────────┐ │
              │  │  Middleware      │ │
              │  │  • Helmet       │ │
              │  │  • CORS         │ │
              │  │  • Rate Limit   │ │
              │  │  • Sessions     │ │
              │  │  • Auth Guard   │ │
              │  │  • CAPTCHA      │ │
              │  │  • Validation   │ │
              │  └──────────────────┘ │
              └───┬──────────┬────────┘
                  │          │
    ┌─────────────▼──┐  ┌───▼─────────────┐
    │  PostgreSQL    │  │  Redis           │
    │  (Prisma ORM)  │  │  (BullMQ Queues) │
    │  :5432         │  │  :6379           │
    └────────────────┘  └───┬─────────────┘
                            │
                  ┌─────────▼──────────┐
                  │  Background Workers │
                  │  • Email Worker     │
                  │  • Sheet Sync Worker│
                  └─────────┬──────────┘
                            │
              ┌─────────────▼──────────────┐
              │      Google APIs            │
              │  • Gmail (send emails)      │
              │  • Sheets (sync data)       │
              │  • Drive (file storage)     │
              │  • OAuth2 (admin login)     │
              └────────────────────────────┘
```

---

## 📁 Project Structure

```
d:\fusion x website\
├── pnpm-workspace.yaml          # Monorepo workspace config
├── package.json                 # Root scripts & dependencies
├── tsconfig.json                # Base TypeScript config
├── docker-compose.yml           # PostgreSQL + Redis containers
├── .env.example                 # Environment variables template
├── .gitignore                   # Git ignore rules
│
├── packages/
│   └── shared/                  # Shared types, constants, validators
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts         # Re-exports everything
│           ├── types.ts         # All TypeScript interfaces/enums
│           ├── constants.ts     # Platform constants & permissions
│           └── validators.ts    # Zod validation schemas
│
├── apps/
│   ├── api/                     # Express.js Backend API
│   │   ├── package.json         # API dependencies (40+ packages)
│   │   ├── tsconfig.json
│   │   ├── prisma/
│   │   │   ├── schema.prisma    # Database schema (17 models)
│   │   │   └── seed.ts          # Seed data (admin, domains, forms, registrations)
│   │   └── src/
│   │       ├── index.ts              # Express app entry point & route mounting
│   │       ├── utils/
│   │       │   ├── logger.ts         # Winston structured logging
│   │       │   ├── prisma.ts         # Prisma client singleton
│   │       │   ├── crypto.ts         # AES-256-GCM encryption + ID generation
│   │       │   └── redis.ts          # Redis connection manager
│   │       ├── middleware/
│   │       │   ├── auth.ts           # Session auth + role + permission guards
│   │       │   ├── validation.ts     # Zod body/query validation
│   │       │   ├── captcha.ts        # reCAPTCHA v3 verification
│   │       │   └── errorHandler.ts   # Global error handler + AppError class
│   │       ├── google/
│   │       │   ├── oauth.ts          # OAuth2 flow + token mgmt + auto-refresh
│   │       │   ├── sheets.ts         # Google Sheets CRUD operations
│   │       │   └── gmail.ts          # Gmail API email sending
│   │       ├── services/
│   │       │   ├── registration.service.ts  # Registration CRUD + duplicate check
│   │       │   ├── domain.service.ts        # Domain/event management
│   │       │   ├── form.service.ts          # Form builder + versioning
│   │       │   ├── email.service.ts         # Template engine (Handlebars)
│   │       │   ├── export.service.ts        # XLSX generation + parsing
│   │       │   └── audit.service.ts         # Audit log management
│   │       ├── jobs/
│   │       │   └── index.ts                 # BullMQ workers (email + sheet sync)
│   │       └── routes/
│   │           ├── auth.routes.ts           # Google OAuth + sessions
│   │           ├── public.routes.ts         # Public registration (no auth)
│   │           ├── domain.routes.ts         # Domain CRUD (admin)
│   │           ├── form.routes.ts           # Form builder (admin)
│   │           ├── registration.routes.ts   # Registration mgmt (admin)
│   │           ├── team.routes.ts           # Team management (admin)
│   │           ├── shortlist.routes.ts      # Shortlist import (admin)
│   │           ├── email.routes.ts          # Email templates + send (admin)
│   │           ├── export.routes.ts         # XLSX download (admin)
│   │           ├── admin.routes.ts          # Admin user management
│   │           ├── dashboard.routes.ts      # Dashboard statistics
│   │           ├── settings.routes.ts       # System settings
│   │           ├── google.routes.ts         # Google integration mgmt
│   │           └── audit.routes.ts          # Audit log viewer
│
│   ├── admin/                    # Next.js Admin Dashboard
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── next.config.js        # API proxy rewrites
│   │   └── src/
│   │       ├── lib/
│   │       │   └── api.ts              # Type-safe API client
│   │       ├── styles/
│   │       │   └── globals.css         # Complete design system (glassmorphism)
│   │       └── app/
│   │           ├── layout.tsx          # Root layout (noindex)
│   │           ├── page.tsx            # Auth redirect
│   │           ├── login/page.tsx      # Google OAuth login
│   │           └── dashboard/
│   │               ├── layout.tsx      # Sidebar + header shell
│   │               ├── page.tsx        # Dashboard overview
│   │               ├── domains/page.tsx       # Domain management
│   │               ├── forms/page.tsx         # Form builder
│   │               ├── registrations/page.tsx # Registration data grid
│   │               ├── teams/page.tsx         # Team management
│   │               ├── shortlist/page.tsx     # Shortlist import
│   │               ├── emails/page.tsx        # Email templates
│   │               ├── email-logs/page.tsx    # Email delivery logs
│   │               ├── exports/page.tsx       # XLSX export center
│   │               ├── admins/page.tsx        # Admin access control
│   │               ├── settings/page.tsx      # Google integration
│   │               └── audit-logs/page.tsx    # Security audit trail
│
│   └── public/                   # Next.js Public Registration Website
│       ├── package.json
│       ├── tsconfig.json
│       ├── next.config.js
│       └── src/
│           ├── styles/
│           │   └── globals.css         # Cinematic dark theme (aurora effects)
│           └── app/
│               ├── layout.tsx          # Root layout + SEO
│               ├── page.tsx            # Landing page + event listing
│               ├── register/
│               │   └── [slug]/page.tsx # Dynamic registration form
│               └── status/
│                   └── page.tsx        # Registration status checker
```

---

## 📄 All Files & What They Do

### Root Configuration

| File | Purpose |
|---|---|
| `pnpm-workspace.yaml` | Configures pnpm monorepo workspace with `apps/*` and `packages/*` |
| `package.json` | Root scripts: `dev` (runs all apps), `build`, `clean`, `docker:up` |
| `tsconfig.json` | Base TypeScript config (ES2022, strict, path resolution) |
| `docker-compose.yml` | Spins up PostgreSQL 16 and Redis 7 containers |
| `.env.example` | Template for all secrets (DB, Redis, Google, Session, reCAPTCHA) |
| `.gitignore` | Ignores node_modules, dist, .env, .next, etc. |

### Shared Package (`packages/shared/`)

| File | Purpose |
|---|---|
| `types.ts` | All TypeScript interfaces: `Admin`, `Domain`, `Registration`, `FormField`, `EmailTemplate`, etc. Enums: `AdminRole`, `RegistrationStatus`, `SyncStatus`, `FieldType`, `RegistrationState` |
| `constants.ts` | Platform name, role-based permissions matrix (SUPER_ADMIN→VIEWER), allowed registration statuses, system limits |
| `validators.ts` | Zod schemas for request validation: `createDomainSchema`, `updateDomainSchema`, `createFormSchema`, `updateFormSchema`, `registrationFilterSchema` |

### API Backend (`apps/api/`)

#### Utilities

| File | Purpose |
|---|---|
| `utils/logger.ts` | Winston logger with JSON format, request ID tracking, sensitive field redaction |
| `utils/prisma.ts` | Prisma client singleton with connection pooling |
| `utils/crypto.ts` | AES-256-GCM encryption (for Google tokens), secure token generation, registration ID generator (`NGB-YYMMDD-NNNNN`) |
| `utils/redis.ts` | Redis connection factory using ioredis |

#### Middleware

| File | Purpose |
|---|---|
| `middleware/auth.ts` | `requireAuth` (session check), `requireRole` (role-based), `requirePermission` (action-based using permission matrix) |
| `middleware/validation.ts` | `validateBody(schema)` and `validateQuery(schema)` middleware using Zod |
| `middleware/captcha.ts` | `verifyCaptcha` middleware — verifies reCAPTCHA v3 tokens with Google's API, checks score threshold |
| `middleware/errorHandler.ts` | `AppError` class with HTTP status codes, global error handler that sanitizes errors in production |

#### Google Integration

| File | Purpose |
|---|---|
| `google/oauth.ts` | Creates OAuth2 client, generates auth URLs (admin login vs API integration scopes), exchanges codes, stores encrypted tokens, auto-refreshes expired tokens, tests connections |
| `google/sheets.ts` | `appendToSheet`, `setSheetHeaders`, `readSheetData`, `updateSheetRow`, `createWorksheet` |
| `google/gmail.ts` | `sendEmail` — constructs MIME multipart messages, base64url encodes, sends via Gmail API |

#### Services (Business Logic)

| File | Purpose |
|---|---|
| `services/registration.service.ts` | `createRegistration` (atomic transaction with duplicate detection, field validation, generates sequential ID, queues background jobs), `getRegistrationStatus`, `listRegistrations` (pagination/filter/search), `updateRegistrationStatus` (shortlist count sync), `softDeleteRegistration`, `restoreRegistration` |
| `services/domain.service.ts` | `createDomain`, `listDomains`, `getDomain`, `getDomainBySlug`, `updateDomain`, `softDeleteDomain`, `getDomainStats` (status breakdown + recent registrations) |
| `services/form.service.ts` | `createForm` (with initial version), `listForms`, `getForm`, `updateForm` (creates new version if fields change — preserves historical data), `publishForm`, `unpublishForm`, `cloneForm`, `softDeleteForm` |
| `services/email.service.ts` | `createEmailTemplate` (with HTML sanitization via sanitize-html), `listEmailTemplates`, `getEmailTemplate`, `updateEmailTemplate`, `deleteEmailTemplate`, `renderTemplate` (Handlebars with XSS prevention), `getAvailableVariables` |
| `services/export.service.ts` | `exportRegistrations` (generates styled XLSX with ExcelJS — dynamic columns from form fields, auto-filter, colored headers), `parseExcelFile` (parses uploaded Excel for shortlist import) |
| `services/audit.service.ts` | `createAuditLog` (never throws — silently fails), `listAuditLogs` (paginated with search) |

#### Background Jobs

| File | Purpose |
|---|---|
| `jobs/index.ts` | **Email Worker**: Rate-limited (30/min), 3 retries with exponential backoff, renders templates, sends via Gmail, logs results. **Sheet Sync Worker**: 5 retries, sets headers, appends rows, updates sync status. **Queue Functions**: `queueEmailJob`, `queueSheetSyncJob`, `queueBulkEmailJobs` (staggered 2s delay) |

#### Routes (API Endpoints)

| File | Endpoints | Auth |
|---|---|---|
| `routes/auth.routes.ts` | `GET /api/auth/google`, `GET /api/auth/google/callback`, `GET /api/auth/me`, `POST /api/auth/logout`, `GET /api/auth/google/integrate`, `GET /api/auth/google/integrate/callback` | Public |
| `routes/public.routes.ts` | `GET /api/public/events`, `GET /api/public/domains/:slug`, `POST /api/public/register/:slug`, `POST /api/public/registration/status` | Public (rate limited + CAPTCHA) |
| `routes/dashboard.routes.ts` | `GET /api/dashboard` | Admin |
| `routes/domain.routes.ts` | `GET/POST /api/domains`, `GET/PUT/DELETE /api/domains/:id`, `GET /api/domains/:id/stats` | Admin |
| `routes/form.routes.ts` | `GET/POST /api/forms`, `GET/PUT/DELETE /api/forms/:id`, `POST /api/forms/:id/publish`, `POST /api/forms/:id/unpublish`, `POST /api/forms/:id/clone` | Admin |
| `routes/registration.routes.ts` | `GET /api/registrations`, `GET /api/registrations/:id`, `PUT /api/registrations/:id/status`, `DELETE /api/registrations/:id`, `POST /api/registrations/:id/restore`, `POST /api/registrations/:id/resend-email`, `POST /api/registrations/bulk/status`, `POST /api/registrations/bulk/delete` | Admin |
| `routes/team.routes.ts` | `GET /api/teams`, `GET/PUT /api/teams/:id` | Admin |
| `routes/shortlist.routes.ts` | `GET /api/shortlist`, `POST /api/shortlist/upload`, `POST /api/shortlist/map`, `POST /api/shortlist/validate`, `POST /api/shortlist/confirm` | Admin |
| `routes/email.routes.ts` | Templates CRUD, `POST /api/emails/preview`, `POST /api/emails/test`, `POST /api/emails/send`, `GET /api/emails/logs` | Admin |
| `routes/export.routes.ts` | `GET /api/exports/registrations`, `GET /api/exports/shortlist` | Admin |
| `routes/admin.routes.ts` | `GET/POST /api/admins`, `PUT/DELETE /api/admins/:id` | Super Admin |
| `routes/settings.routes.ts` | `GET/PUT /api/settings` | Admin |
| `routes/google.routes.ts` | `GET /api/google/status`, `POST /api/google/test`, `POST /api/google/disconnect` | Admin |
| `routes/audit.routes.ts` | `GET /api/audit` | Admin |

#### Database Schema (`prisma/schema.prisma`)

| Model | Records | Purpose |
|---|---|---|
| `Admin` | Admin users | Email, name, role, picture, active status, last login |
| `AdminSession` | Auth sessions | Token-based session tracking |
| `VerificationCode` | Email verification | Hashed codes with attempts + expiry |
| `Domain` | Hackathon events | Name, slug, dates, caps, Google Sheet/Drive links, email template links |
| `Form` | Registration forms | Title, status, versioning |
| `FormVersion` | Form snapshots | Immutable version record per publish |
| `FormField` | Form questions | 14 field types, validation, conditional logic, ordering |
| `Registration` | Team registrations | All data in JSONB `values`, status tracking, soft delete |
| `EmailTemplate` | Email templates | Handlebars templates with variable extraction |
| `EmailJob` | Email queue | Status tracking, retry count, rendered content |
| `EmailLog` | Delivery log | Sent/failed status, error messages |
| `GoogleIntegration` | API tokens | AES-256 encrypted OAuth tokens, scope tracking |
| `SheetSyncJob` | Sync queue | Spreadsheet sync status per registration |
| `ShortlistImport` | Bulk imports | Upload tracking with validation stats |
| `ShortlistImportRow` | Import rows | Per-row validation and matching |
| `AuditLog` | Activity trail | Admin action tracking with old/new values |
| `SystemSetting` | Config store | Key-value settings |

#### Seed Data (`prisma/seed.ts`)

Creates: 1 super admin, 2 email templates (registration + shortlist), 1 form (11 fields), 2 domains, 8 sample registrations with varied statuses, 7 system settings.

---

## 🔄 Data Flow & Workflow

### 1. Public Registration Flow

```
Participant visits /register/ai-innovation-buildathon-2026
           │
           ▼
Public Website fetches GET /api/public/domains/:slug
           │
           ▼
API returns domain info + published form fields
           │
           ▼
Website renders dynamic form (14 field types)
           │
           ▼
Participant fills form and submits
           │
           ▼
Client-side validation → reCAPTCHA v3 token generated
           │
           ▼
POST /api/public/register/:slug { values, captchaToken }
           │
           ▼
┌─── API Middleware Chain ───┐
│ Rate Limiter (10/15min)    │
│ CAPTCHA Verification       │
│ Field Validation           │
└────────────┬──────────────┘
             ▼
┌─── Atomic Transaction ────┐
│ 1. Check domain status    │
│ 2. Check duplicate email  │
│ 3. Check duplicate team   │
│ 4. Generate NGB-YYMMDD-N  │
│ 5. Create registration    │
│ 6. Increment domain count │
└────────────┬──────────────┘
             ▼
  ┌── Background Jobs (non-blocking) ──┐
  │ Queue: Email Confirmation          │
  │ Queue: Google Sheets Sync          │
  └────────────────────────────────────┘
             ▼
Response: { registrationId, teamName, status }
```

### 2. Admin Login Flow

```
Admin visits /login → Clicks "Continue with Google"
           │
           ▼
GET /api/auth/google → Returns Google OAuth URL with state token
           │
           ▼
Google OAuth consent screen → Redirects to /api/auth/google/callback
           │
           ▼
API validates state (CSRF), exchanges code for tokens
           │
           ▼
Gets user email → Checks against admins table
           │
           ▼
If authorized: Create session + Set cookie → Redirect to /dashboard
If not: Redirect to /login?error=unauthorized
```

### 3. Email Delivery Flow

```
Registration created OR Admin triggers send
           │
           ▼
Job queued to BullMQ "email" queue
           │
           ▼
Email Worker picks up job (concurrency: 5)
           │
           ▼
1. Fetch email template from DB
2. Fetch registration data
3. Render Handlebars template with registration values
4. Create EmailJob record (status: SENDING)
5. Send via Gmail API (MIME multipart)
6. Update EmailJob (status: SENT, sentAt)
7. Create EmailLog record
           │
   On failure:
           │
   Retry up to 3 times (exponential backoff: 5s, 10s, 20s)
   Log failure in EmailLog
   Rate limited: max 30 emails/minute
```

### 4. Google Sheets Sync Flow

```
New registration created
           │
           ▼
Job queued to BullMQ "sheet-sync" queue
           │
           ▼
Sheet Sync Worker (concurrency: 3)
           │
           ▼
1. Fetch registration + form fields
2. Set headers in sheet (if first row)
3. Append data row
4. Update registration syncStatus → SYNCED
5. Create SheetSyncJob record
           │
   On failure:
           │
   Retry up to 5 times (exponential backoff)
   Update syncStatus → SYNC_FAILED
```

### 5. Shortlist Import Flow

```
Admin uploads Excel file
           │
           ▼
POST /api/shortlist/upload (multipart)
           │
           ▼
Parse Excel → Return headers + sample rows + totalRows
           │
           ▼
Admin maps columns (email → email, team → team_name)
           │
           ▼
POST /api/shortlist/validate
           │
           ▼
Match against existing registrations by email/team
           │
           ▼
POST /api/shortlist/confirm { sendEmails: true }
           │
           ▼
Update matched registrations → SHORTLISTED
           │
           ▼
If sendEmails: Queue bulk shortlist notification emails
```

---

## 🔒 Security Architecture

| Layer | Protection |
|---|---|
| **Transport** | HTTPS (production), secure cookies |
| **Headers** | Helmet.js (CSP, X-Frame-Options, HSTS, etc.) |
| **CORS** | Whitelist: only public + admin origins |
| **Rate Limiting** | Global: 200 req/15min, Registration: 10/15min, Status: 20/15min |
| **Authentication** | Server-side sessions via express-session, httpOnly cookies |
| **Authorization** | Role-based (SUPER_ADMIN > ADMIN > EDITOR > VIEWER) + permission matrix |
| **CAPTCHA** | reCAPTCHA v3 on public registration (score threshold configurable) |
| **Input Validation** | Zod schemas on all admin endpoints |
| **SQL Injection** | Prisma ORM (parameterized queries) |
| **XSS** | HTML sanitization (sanitize-html) on email templates |
| **CSRF** | OAuth state parameter validation |
| **Encryption** | AES-256-GCM for Google tokens at rest |
| **Audit** | Every admin action logged with IP, user agent, old/new values |
| **Duplicates** | Atomic transactions with unique constraint checks |
| **Soft Delete** | Registrations and domains are never hard-deleted |
| **Secret Management** | All secrets in .env, never exposed to frontends |

---

## ⚙️ Setup & Running

### Prerequisites
- Node.js 20+, pnpm 9+, Docker (for PostgreSQL + Redis)

### Steps

```bash
# 1. Clone & install
cd "d:\fusion x website"
pnpm install

# 2. Start databases
docker compose up -d

# 3. Configure environment
cp .env.example .env
# Edit .env with your Google OAuth credentials, reCAPTCHA keys, etc.

# 4. Setup database
cd apps/api
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:seed

# 5. Run all apps
cd ../..
pnpm dev
```

### Ports
| Service | Port | URL |
|---|---|---|
| Public Website | 3000 | http://localhost:3000 |
| Admin Dashboard | 3001 | http://localhost:3001 |
| API Server | 4000 | http://localhost:4000 |
| PostgreSQL | 5432 | — |
| Redis | 6379 | — |

---

## 📊 Feature Checklist

- ✅ Public hackathon registration website
- ✅ Private admin dashboard (separate app)
- ✅ Google OAuth authentication for admins
- ✅ Google Sheets/Drive integration (encrypted tokens)
- ✅ Gmail API for automated emails
- ✅ reCAPTCHA v3 protection
- ✅ Domain-wise hackathon management
- ✅ Registration confirmation automation
- ✅ Shortlisted-team management (Excel import)
- ✅ Excel/XLSX export
- ✅ Template-based email management (Handlebars)
- ✅ Full CRUD from admin dashboard
- ✅ Secure audit logging
- ✅ Duplicate-registration prevention (email + team name)
- ✅ High-concurrency support (BullMQ workers)
- ✅ Dynamic form builder (14 field types, versioning)
- ✅ Bulk operations (status update, delete)
- ✅ Role-based access control (4 roles, permission matrix)
- ✅ Soft delete with restore
- ✅ Registration status check (public)
- ✅ Dashboard analytics (stats, charts, system health)
- ✅ Rate limiting (global + per-endpoint)
- ✅ Premium dark UI with glassmorphism + aurora effects

---

*Built with ❤️ for the Next Gen Buildathon platform*
