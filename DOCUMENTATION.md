# 🚀 Next Gen Buildathon — Streamlined Platform Documentation

> **Version**: 2.0.0 (Streamlined)  
> **Last Updated**: September 18, 2026  
> **Architecture**: Single Entry Point Web App + Express.js API + PostgreSQL + Google Sheets

---

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Project Structure](#project-structure)
3. [All Files & What They Do](#all-files--what-they-do)
4. [Data Flow & Workflow](#data-flow--workflow)
5. [API Endpoints Reference](#api-endpoints-reference)
6. [Database Schema](#database-schema)
7. [Administrator Authentication](#administrator-authentication)
8. [Setup & Running](#setup--running)

---

## 🏗️ Architecture Overview

```
                                ONE WEBSITE (Port 3000)
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    │                                             │
             PUBLIC VISITOR                                 ADMINISTRATOR
                    │                                             │
             [Register Now]                                 [ADMIN] button
                    │                                             │
             Select Track/Domain                           Password Dialog
                    │                                             │
             Dynamic Form                                    POST /api/auth/login
                    │                                             │
             POST /api/public/register/:slug                ADMIN PANEL
                    │                                       ├── Dashboard (counts)
                    ▼                                       ├── Domains (CRUD + Activate)
             Backend Express API                            ├── Forms (Builder + Apply to All)
                    │                                       ├── Export Excel (.xlsx)
        ┌───────────┴───────────┐                           ├── Settings (Google Sheets)
        ▼                       ▼                           └── Logout
  PostgreSQL (Truth)       Google Sheets
  - Duplicate check        - Append Row
  - Transaction            - Status: SYNCED/FAILED
  - Unique ID (NGB-...)         │
        │                       ▼
        └─────────────────► Excel Export
```

---

## 📁 Project Structure

```
d:\fusion x website\
├── pnpm-workspace.yaml          # Monorepo workspace config
├── package.json                 # Root scripts: dev (api + public), build
├── tsconfig.json                # Base TypeScript config
├── .env.example                 # Environment variables template
├── .gitignore                   # Git ignore rules
│
├── packages/
│   └── shared/                  # Shared types, constants, validators
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts         # Re-exports
│           ├── types.ts         # Domain, Form, Registration, Google types
│           ├── constants.ts     # FieldType, RegistrationState, Status enums
│           └── validators.ts    # Zod schemas (adminLogin, createDomain, createForm)
│
├── apps/
│   ├── api/                     # Express.js Backend API (:4000)
│   │   ├── prisma/
│   │   │   └── schema.prisma    # PostgreSQL schema (Admin, Domain, Form, Registration)
│   │   └── src/
│   │       ├── index.ts         # Express server & route mounting
│   │       ├── utils/
│   │       │   ├── logger.ts    # Winston structured logging
│   │       │   ├── prisma.ts    # Prisma Client singleton
│   │       │   └── crypto.ts    # Token generation & registration ID generator
│   │       ├── middleware/
│   │       │   ├── auth.ts      # requireAuth session guard
│   │       │   ├── validation.ts# Zod validation middleware
│   │       │   ├── captcha.ts   # reCAPTCHA v3 verification
│   │       │   └── errorHandler.ts # Global AppError handler
│   │       ├── google/
│   │       │   ├── oauth.ts     # Google OAuth2 for Google Sheets API
│   │       │   └── sheets.ts    # Google Sheets append & header management
│   │       ├── services/
│   │       │   ├── registration.service.ts # Registration transaction + duplicate check
│   │       │   ├── domain.service.ts       # Domain CRUD & registration state
│   │       │   ├── form.service.ts         # Form builder + apply to all domains
│   │       │   └── export.service.ts       # XLSX export via ExcelJS
│   │       ├── jobs/
│   │       │   └── index.ts     # Periodic Google Sheets sync retry
│   │       └── routes/
│   │           ├── auth.routes.ts      # Password login, session, Sheets OAuth
│   │           ├── public.routes.ts    # Public events list, domain info, registration
│   │           ├── domain.routes.ts    # Admin domain management
│   │           ├── form.routes.ts      # Admin form builder
│   │           ├── dashboard.routes.ts # Minimal overview counts
│   │           ├── export.routes.ts    # Real Excel export (.xlsx)
│   │           ├── google.routes.ts    # Google Sheets status & disconnect
│   │           └── settings.routes.ts  # System settings
│   │
│   └── public/                  # Unified Next.js Web Application (:3000)
│       ├── next.config.js       # API proxy rewrites
│       └── src/
│           ├── styles/globals.css
│           └── app/
│               ├── layout.tsx          # Root layout + branding
│               ├── page.tsx            # Homepage + Tracks list + ADMIN password modal
│               ├── admin/page.tsx      # Integrated Admin Panel (Dashboard/Domains/Forms/Export/Settings)
│               ├── register/page.tsx   # Portal redirect to active track
│               └── register/[slug]/page.tsx # Dynamic registration form & success screen
```

---

## 🔐 Administrator Authentication

* Exactly **one authentication method**: Administrator Password (`ADMIN_PASSWORD` in `.env`).
* No Google OAuth login for admins, no OTPs, no email codes.
* Password validation is performed server-side with strict rate limiting (max 5 attempts per 15 minutes).
* On successful authentication, an HttpOnly, SameSite-protected session cookie (`ngb.sid`) is issued.
* Logging out destroys the session and returns the user to the public homepage.

---

## 🔄 Data Flow & Workflows

### 1. Participant Registration Flow
1. Participant visits `http://localhost:3000` (or production domain).
2. Browses active tracks and clicks **Register Now →**.
3. Fills out dynamic form questions configured for that track.
4. Client validates inputs -> reCAPTCHA token generated.
5. `POST /api/public/register/:slug` receives submission.
6. Backend checks for duplicate email for that track in PostgreSQL.
   - If duplicate found: returns HTTP 409: `"This email address has already been used for registration."`
7. Atomic PostgreSQL transaction saves registration record and generates unique ID (`NGB-YYMMDD-NNNNN`).
8. Row is automatically appended to linked Google Sheet.
9. Participant sees clean Success Screen displaying their Registration ID (no email mentions).

### 2. Administrator Track & Form Management Flow
1. Organizer clicks **`ADMIN`** in header navigation on the homepage.
2. Enters administrator password.
3. Admin Panel opens:
   - **Domains**: Create or edit tracks, toggle open/closed, copy public registration link.
   - **Forms**: Customize questions with 8 field types (Short answer, Paragraph, Email, Phone, Number, Dropdown, Radio, Checkbox). Check **"Apply this form to all domains"** to share the form across every track. Save draft or publish.
   - **Export**: Generate real `.xlsx` files of all registrations or filtered by track.
   - **Settings**: View Google Sheets connection status and authorize account.

---

## 📡 API Endpoints Reference

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/auth/login` | POST | Public (Rate-limited) | Password authentication |
| `/api/auth/me` | GET | Public | Session verification |
| `/api/auth/logout` | POST | Public | Logout and clear cookie |
| `/api/auth/google/sheets/connect` | GET | Admin | Initiate Google Sheets OAuth |
| `/api/public/events` | GET | Public | Active tracks list |
| `/api/public/domains/:slug` | GET | Public | Track info & published form |
| `/api/public/register/:slug` | POST | Public (Rate-limited) | Submit registration |
| `/api/dashboard` | GET | Admin | Minimal counts & sync status |
| `/api/domains` | GET, POST | Admin | List / create tracks |
| `/api/domains/:id` | GET, PUT, DELETE | Admin | Track details, update, delete |
| `/api/domains/:id/status` | POST | Admin | Toggle track active/inactive |
| `/api/forms` | GET, POST | Admin | List / create forms |
| `/api/forms/:id` | GET, PUT, DELETE | Admin | Get, update, delete forms |
| `/api/forms/:id/publish` | POST | Admin | Publish form (with applyToAll) |
| `/api/exports/registrations` | GET | Admin | Download real `.xlsx` export |
| `/api/google/status` | GET | Admin | Google Sheets connection status |
| `/api/google/disconnect` | POST | Admin | Disconnect Google account |

---

## 🚀 Setup & Running

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start development servers (runs API on :4000 and Public Website on :3000)
pnpm dev
```
