<div align="center">
  <img src="public/logo.png" alt="O.R.C.A Logo" width="110" />
  <h1>O.R.C.A — Organised Crime Analysis Authority</h1>
  <p><b>Secure Law Enforcement Intelligence Dashboard</b><br><i>Karnataka State Police • Internal Security Division (ISD)</i></p>
</div>

---

## 📌 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Architecture](#architecture)
- [Three-Layer RBAC System](#three-layer-rbac-system)
- [Officer Roles & Permissions](#officer-roles--permissions)
- [ISD Clearance Levels](#isd-clearance-levels)
- [VPN & Network Security](#vpn--network-security)
- [Firestore Security Rules](#firestore-security-rules)
- [API Routes](#api-routes)
- [Environment Variables](#environment-variables)
- [Firebase Setup](#firebase-setup)
- [Local Development](#local-development)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Security Notes](#security-notes)

---

## 🧭 Overview

**O.R.C.A** is a full-stack, secure law enforcement intelligence and administration platform built for the Karnataka State Police. It provides a unified dashboard for criminal investigation management, document verification, officer registration, and command administration — all backed by a multi-layer role-based access control system.

```
Platform : O.R.C.A v2.0
Codename : Internal Security Division Command Suite
Stack    : Next.js 15 + Firebase + TypeScript
Project  : orca-india2026
Agency   : Karnataka State Police / SCRB
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|---|---|
| 🖥️ **Frontend** | Next.js 15 (App Router, Turbopack) |
| 🎨 **UI** | Vanilla CSS · Lucide Icons · Custom Glassmorphism Design |
| 🔐 **Auth** | Firebase Authentication (JWT Custom Claims) |
| 🗄️ **Database** | Cloud Firestore |
| 🛡️ **Admin SDK** | Firebase Admin SDK (server-side API routes) |
| 🤖 **AI Engine** | GROQ API (llama-3.1-8b-instant) · NVIDIA API (fallback) |
| 🌐 **VPN Detection** | ip-api.com · Header-based Proxy Detection |
| 📦 **Type Safety** | TypeScript (strict mode) |

---

## ✨ Features

### 🔍 Investigation Suite
- **📁 Case Management** — File, track, and manage FIRs and criminal cases
- **🧠 AI Intelligence Copilot** — GROQ-powered assistant for criminal analysis
- **🕸️ Criminal Network Graphs** — Relationship mapping of suspects and syndicates
- **🗺️ Geospatial Crime Heatmaps** — Incident clustering and hotspot identification
- **📰 Intel News Feed** — Real-time law enforcement intelligence briefings

### 🏛️ Administration Suite
- **📋 Officer Registration** — Pending registration review and approval workflow
- **📂 Officer Directory** — Live directory with profile editing and deactivation
- **🔑 Role Assignment Manager** — Assign ISD clearance levels and dashboard roles
- **📊 Audit Logs** — Immutable system-wide action trail
- **🔒 Security Controls** — Session, access, and account management

### 📄 Verification Services
- **🔍 Document Verification** — OCR-powered ID and document authenticity checks
- **✅ Verified Document Registry** — Firestore-backed verification audit records
- **📜 Letterhead Generator** — Auto-registered PDF-style intelligence briefings

### 🤖 AI & Intelligence
- **💬 AI Chatbot** — Multilingual (English / Hindi / Kannada) via GROQ / NVIDIA
- **📡 Intel Copilot** — Context-aware case analysis and FIR forensic breakdowns
- **🧪 FastAPI Gateway** — Optional backend AI relay for advanced inference

### 🛡️ Security
- **🔐 Three-Layer RBAC** — Rank → ISD Level → Dashboard Role
- **🌐 VPN/Proxy Detection** — Real-time network threat monitoring and audit logging
- **🔒 Firestore Rules** — Custom claim-based collection-level access control
- **📝 Role Change Audit** — Immutable `roleChangeLog` Firestore collection

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                      │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │  Login   │  │  Dashboard   │  │  Admin Center   │   │
│  │  Page    │  │  RBAC-gated  │  │  Admin-only     │   │
│  └──────────┘  └──────────────┘  └─────────────────┘   │
└────────────────────────┬────────────────────────────────┘
                         │ Next.js App Router (Turbopack)
┌────────────────────────▼────────────────────────────────┐
│                  SERVER (API Routes)                      │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐ │
│  │ /api/auth  │  │ /api/admin │  │ /api/security      │ │
│  │ session    │  │ rbac/*     │  │ vpn-check (GET/POST)│ │
│  └────────────┘  └────────────┘  └────────────────────┘ │
│  ┌────────────┐  ┌──────────────────┐                   │
│  │ /api/chat  │  │ /api/verification │                   │
│  │ GROQ / NV  │  │ OCR documents     │                   │
│  └────────────┘  └──────────────────┘                   │
└────────────────────────┬────────────────────────────────┘
                         │ Firebase Admin SDK (server-side)
┌────────────────────────▼────────────────────────────────┐
│                  FIREBASE PLATFORM                        │
│  ┌──────────────────┐  ┌──────────────────────────────┐ │
│  │  Authentication  │  │  Cloud Firestore              │ │
│  │  Custom Claims   │  │  RBAC Rules (server-enforced) │ │
│  └──────────────────┘  └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 🔐 Three-Layer RBAC System

O.R.C.A enforces access control through **three independent, stacked layers**. All three must align for access to be granted.

```
Layer 1: RANK          → Organisational title (DGP, IGP, SP, Inspector...)
           ↓ determines defaults for ↓
Layer 2: ISD LEVEL     → Data clearance (ISD-LEVEL-I through IV)
           ↓ combined with ↓
Layer 3: DASHBOARD ROLE → Module access (which tabs/features are visible)
```

> **Rank** is **cosmetic** — used for org chart and default prefilling only.  
> **ISD Level** and **Dashboard Role** are **enforced** both client-side (UI gating) and server-side (Firebase Custom Claims + Firestore Security Rules).

---

## 👮 Officer Roles & Permissions

| Role String | Label | Module Access |
|---|---|---|
| `admin_full` / `admin_l2` | 🛡️ Full Command Administrator | **All modules** (unrestricted) |
| `admin_scrb` | 🏛️ SCRB Executive Administrator | AI Monitoring · Audit · Security · Telemetry |
| `admin_verification` / `admin_l1` | 📋 Verification Admin Officer | Applications · Directory · Verification · Roles |
| `it_admin` | 💻 IT Security Administrator | Telemetry · Audit Logs · Security Controls |
| `investigation_l2` | 🔍 Level II Investigation Officer | Full investigation + verification tools |
| `investigation_l1` | 🔍 Level I Operational Officer | Standard investigation tools |
| `investigation` | 🚔 Field Operational Officer | Base investigation dashboard + AI Chatbot |

### Rank → Default Role Mapping

| Rank | Default ISD Level | Default Dashboard Role |
|---|---|---|
| DGP / ADGP / IGP | `ISD-LEVEL-I` | `admin_l2` (Full Admin) |
| DIGP / SP | `ISD-LEVEL-I` | `admin_l1` (Verification Admin) |
| ASP | `ISD-LEVEL-II` | `admin_l1` |
| DSP | `ISD-LEVEL-II` | `investigation` |
| Inspector / SI / ASI | `ISD-LEVEL-IV` | `investigation` (Field) |

---

## 🔏 ISD Clearance Levels

| Level | Badge | Description | Rank Range |
|---|---|---|---|
| `ISD-LEVEL-I` | 🔴 Highest | Full executive command — all data access | DGP / ADGP / IGP / SP |
| `ISD-LEVEL-II` | 🟠 High | Administrative and oversight reviews | DIGP / ASP / DSP |
| `ISD-LEVEL-III` | 🟡 Medium | IT systems, auditing, and technical review | IT & Audit Officers |
| `ISD-LEVEL-IV` | 🟢 Standard | Field operational investigation | Inspector / SI / ASI |

---

## 🌐 VPN & Network Security

O.R.C.A includes a real-time **VPN and Proxy Detection System** to enforce network security policy and flag untrusted network connections.

### Detection Flow

```
Officer Login / Dashboard Load
        │
        ▼
 GET /api/security/vpn-check
        │
        ├──► 1. HTTP Header Detection
        │         x-vpn-detected, via, x-proxy-id,
        │         forwarded: vpn (case-insensitive)
        │
        ├──► 2. IP Geolocation Lookup (ip-api.com)
        │         Fields: ISP, ASN, org, country,
        │                 proxy flag, hosting flag
        │
        └──► 3. Keyword Matching on ISP/ASN/Org
                  vpn, proxy, hosting, datacenter,
                  nordvpn, expressvpn, protonvpn,
                  surfshark, mullvad, cyberghost,
                  cloudflare, digitalocean, AWS, OVH
```

### API Responses

| Condition | `vpnDetected` | `networkType` |
|---|---|---|
| ✅ Clean state network | `false` | `STATE_POLICE_INTRANET_SECURE` |
| ⚠️ VPN/Proxy detected | `true` | `UNTRUSTED_VPN_PROXY (ISP Name)` |

### VPN Security Actions
- 🔔 **Warning banner** shown on officer's dashboard
- 📝 **Automatically logged** to Firestore `audit_logs` with `severity: HIGH_SECURITY_ALERT`
- 🔎 Officer name, email, and source IP are captured for ISD audit

### Firestore Audit Entry (auto-written on detection)
```json
{
  "action": "VPN_PROXY_SECURITY_FLAGGED",
  "operator": "officer@orca.gov",
  "details": "UNTRUSTED NETWORK INGRESS: External VPN/Proxy detected from IP [X.X.X.X]. ISP: NordVPN",
  "severity": "HIGH_SECURITY_ALERT",
  "timestamp": "[Firestore server timestamp]"
}
```

### Testing VPN Detection (Dev)
```bash
GET /api/security/vpn-check?simulateVpn=true
```

---

## 🔒 Firestore Security Rules

Stored in [`firestore.rules`](./firestore.rules). Enforces collection-level access using **Firebase JWT custom claims** — not just authentication.

### Helper Functions

```javascript
isAuthenticated()   // request.auth != null
isAdmin()           // dashboardRole is admin_full/scrb/l2/l1 OR isdLevel is I/II
isExecutiveAdmin()  // dashboardRole is admin_full/scrb OR isdLevel is ISD-LEVEL-I
```

### Collection Access Matrix

| Collection | Read | Create | Update | Delete |
|---|---|---|---|---|
| `/users/{uid}` | Own + Admins | Admin only | Admin (role fields) | Exec Admin |
| `/officers/{uid}` | All auth | Admin | Admin | Exec Admin |
| `/audit_logs` | Admins | All auth | Exec Admin | Exec Admin |
| `/roleChangeLog` | Admins | Exec Admin | ❌ Never | ❌ Never |
| `/pendingRegistrations` | Admins | Own UID | Admins | Admins |
| `/admin_settings` | Admins | Exec Admin | Exec Admin | — |
| `/cases` | All auth | All auth | All auth | — |
| `/verified_documents` | All auth | Admin | Admin | — |
| **Everything else** | ❌ | ❌ | ❌ | ❌ |

> **Fallback rule: deny all** — nothing is accessible unless explicitly permitted above.

### Deploy / Update Rules
```bash
firebase deploy --only firestore:rules --project orca-india2026
```

---

## 🔌 API Routes

### 🔐 Authentication
| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/session` | `POST` | Validate ID token, set `authToken` cookie |
| `/api/auth/logout` | `POST` | Clear session cookie |

### 🏛️ Administration (Admin auth required)
| Endpoint | Method | Description |
|---|---|---|
| `/api/admin/approve-registration` | `POST` | Approve officer, set Firebase custom claims |
| `/api/admin/reject-registration` | `POST` | Reject officer, update registration status |
| `/api/admin/rbac/set-role` | `POST` | Assign `isdLevel` + `dashboardRole` to officer |
| `/api/admin/rbac/create-profile` | `POST` | Provision new Firebase Auth + Firestore officer profile |
| `/api/admin/rbac/logs` | `GET` | Fetch role change log + audit log entries |

### 🤖 AI
| Endpoint | Method | Description |
|---|---|---|
| `/api/chat` | `POST` | GROQ/NVIDIA AI chatbot — multilingual (EN/HI/KN) |

### 🛡️ Security
| Endpoint | Method | Description |
|---|---|---|
| `/api/security/vpn-check` | `GET` | Detect VPN/proxy on requesting IP |
| `/api/security/vpn-check` | `POST` | Write VPN detection alert to `audit_logs` |

### ✅ Verification
| Endpoint | Method | Description |
|---|---|---|
| `/api/verification/*` | Various | Document OCR and verification workflows |

---

## 🗝️ Environment Variables

Create `.env.local` in the root directory of the project:

```env
# ── Firebase Client SDK (safe to prefix NEXT_PUBLIC_) ─────────────
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=orca-india2026.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=orca-india2026
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=orca-india2026.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# ── Firebase Admin SDK (SERVER-ONLY — NEVER prefix with NEXT_PUBLIC_) ──
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"orca-india2026",...}

# ── AI Keys (SERVER-ONLY) ─────────────────────────────────────────
GROQ_API_KEY=gsk_your_groq_key
NVIDIA_API_KEY=nvapi_your_nvidia_key       # Optional — used as fallback

# ── Optional ──────────────────────────────────────────────────────
NEXT_PUBLIC_FASTAPI_API_URL=http://localhost:8000/api/v1
```

> ⚠️ **Never** use `NEXT_PUBLIC_` for `FIREBASE_SERVICE_ACCOUNT_KEY`, `GROQ_API_KEY`, or `NVIDIA_API_KEY`. They are server-only secrets.

---

## 🔥 Firebase Setup

### Step 1 — Create Firebase Project
[console.firebase.google.com](https://console.firebase.google.com) → **Add Project** → `orca-india2026`

### Step 2 — Enable Authentication
**Authentication** → **Sign-in method** → Enable **Email/Password**

### Step 3 — Create Firestore Database
**Firestore Database** → **Create Database** → **Production mode**

### Step 4 — Service Account Key
**Project Settings** → **Service Accounts** → **Generate new private key**  
Paste entire JSON content as one line into `FIREBASE_SERVICE_ACCOUNT_KEY` env variable.

### Step 5 — Deploy Security Rules
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules --project orca-india2026
```

### Step 6 — Create Developer Admin Account
1. In Firebase Console → Authentication → Add user: `developer@orca.gov`
2. Login to the dashboard
3. Use **Role Assignment Manager** → Assign:
   - UID: `8SdjZAbaVjNfssNuqHV627r52f32`
   - ISD Level: `ISD-LEVEL-I`
   - Dashboard Role: `admin_full`

---

## 🖥️ Local Development

```bash
# Install dependencies
npm install

# Start dev server (Turbopack HMR)
npm run dev
```

App available at **http://localhost:3000**

### Dev Login Aliases (badge map)

| Badge / Email | Resolves To | Role |
|---|---|---|
| `developer` or `dev` | `developer@orca.gov` | Full Command Admin |
| `admin_full` | `admin2@orca.gov` | Full Admin |
| `admin_verification` | `admin1@orca.gov` | Verification Admin |
| Full email address | Used directly | As configured in Firebase |

---

## 🚀 Deployment

### 1. Production Build Check
```bash
npm run build
```

### 2. Deploy to Vercel (Recommended)
```bash
npx vercel --prod
```
Set all environment variables in **Vercel Dashboard → Settings → Environment Variables**.

### 3. Deploy Firestore Rules
```bash
firebase deploy --only firestore:rules --project orca-india2026
```

### ✅ Pre-Deployment Checklist
- [ ] All `.env.local` variables mirrored in Vercel settings
- [ ] `FIREBASE_SERVICE_ACCOUNT_KEY` set as single-line JSON string
- [ ] `GROQ_API_KEY` set server-side (NOT `NEXT_PUBLIC_`)
- [ ] Firebase Auth email/password enabled
- [ ] Firestore rules deployed successfully (no warnings)
- [ ] `developer@orca.gov` has `admin_full` + `ISD-LEVEL-I` custom claims
- [ ] `firebase-key.json` confirmed in `.gitignore`
- [ ] `npm run build` completes with 0 TypeScript errors

---

## 📁 Project Structure

```
.
├── public/                           🖼️ Public assets & landing page (index.html, logo.png)
├── scripts/                          🛠️ Maintenance & seed utility scripts
├── src/                              ⚡ Next.js App router & React components
│   ├── app/
│   │   ├── api/
│   │   │   ├── admin/
│   │   │   │   ├── approve-registration/   🔐 Officer approval + custom claims
│   │   │   │   ├── reject-registration/    🔐 Officer rejection
│   │   │   │   └── rbac/
│   │   │   │       ├── set-role/           🔑 ISD + role assignment
│   │   │   │       ├── create-profile/     👤 New officer provisioning
│   │   │   │       └── logs/               📋 Audit log viewer
│   │   │   ├── auth/                       🔐 Session cookie management
│   │   │   ├── chat/                       🤖 GROQ/NVIDIA AI chatbot
│   │   │   ├── security/
│   │   │   │   └── vpn-check/              🌐 VPN/proxy detection
│   │   │   └── verification/               📄 Document OCR
│   │   ├── accessibility/                  ♿ Accessibility portal
│   │   ├── chatbot/                        🤖 Multilingual Chatbot module
│   │   ├── dashboard/                      📊 Main gated dashboard
│   │   ├── forgot-password/                🔑 Password recovery portal
│   │   ├── login/                          🔑 Officer login page
│   │   ├── privacy/                        🔒 Privacy policy page
│   │   ├── report-issue/                   🐛 Technical issue report page
│   │   ├── rti/                            📜 RTI compliance portal
│   │   ├── support/                        🛠️ Support portal
│   │   ├── terms/                          📄 Terms of service page
│   │   ├── unauthorized/                   ⛔ Unauthorized access page
│   │   └── verification/                   📄 Verification portal
│   ├── components/
│   │   ├── admin/
│   │   │   └── RoleAssignmentManager.tsx   🔑 Role assignment UI
│   │   ├── dynamic/
│   │   │   ├── CommandAdminCenter.tsx      🏛️ Full admin dashboard
│   │   │   ├── LiveNewsFeeds.tsx           📺 Live surveillance stream grid
│   │   │   └── Letterhead.tsx              📜 Report letterhead generator
│   │   └── layout/
│   │       ├── Topbar.tsx                  🧭 Navigation topbar
│   │       └── OrcaBrand.tsx               🏷️ Brand header
│   ├── context/
│   │   └── AuthContext.tsx                 🔐 Auth state + profile resolution
│   └── lib/
│       ├── firebase.ts                     🔥 Firebase client init
│       ├── firebaseAdmin.ts                🛡️ Admin SDK + checkAdminAuth
│       ├── permissions.ts                  📋 Roles, ISD levels, rank defaults
│       ├── rbac.ts                         🗂️ Tab/menu access config (RBAC)
│       ├── adminService.ts                 🗄️ Firestore data helpers
│       └── groq.ts                         🤖 AI intelligence gateway
├── .env.example                        🗝️ Environment template
├── .env.local                          🗝️ Local env vars (never commit)
├── .gitignore                          🚫 Git ignore config
├── app-config.json                     ⚙️ Application configuration
├── components.json                     🎨 Shadcn component registry
├── eslint.config.mjs                   🧹 ESLint code quality config
├── firebase-key.json                   🔑 Local Firebase service key (ignored)
├── firebase.json                       🔥 Firebase project config
├── firestore.indexes.json              🗄️ Firestore database index config
├── firestore.rules                     🔒 Firestore security rules
├── next-env.d.ts                       TS Next.js environment types
├── next.config.ts                      ⚡ Next.js configuration
├── package-lock.json                   📦 Lockfile
├── package.json                        📦 Dependencies & scripts
├── postcss.config.mjs                  🎨 PostCSS configuration
├── README.md                           📖 Documentation file
├── seedDemoUsers.js                    🌱 Demo database seeder script
├── tsconfig.json                       ⚙️ TypeScript configuration
└── tsconfig.tsbuildinfo                ⚡ Build info cache
```

---

## 🛡️ Security Notes

> ⛔ **Critical**: `FIREBASE_SERVICE_ACCOUNT_KEY` grants full Firebase Admin access. Rotate immediately if ever exposed.

> 🔒 **Immutable Audit Trail**: The `roleChangeLog` Firestore collection **cannot be updated or deleted** by anyone — Firestore rules explicitly deny these operations to ensure audit integrity.

> 🌐 **VPN Monitoring**: All VPN/proxy detections are stored in `audit_logs` with `HIGH_SECURITY_ALERT` severity and reviewed by ISD.

> 🔑 **Custom Claims**: ISD Level and Dashboard Role are stored as Firebase JWT custom claims (`isdLevel`, `dashboardRole`). These are verified server-side on every admin API call via `checkAdminAuth()`.

> 🧹 **Key Rotation**: After deployment, re-generate your Firebase service account key periodically and update the `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable on your hosting platform.

---

*🛡️ O.R.C.A — Classified Intelligence Platform*  
*Karnataka State Police · SCRB Division · Internal Security Division*  
*Built with security-first principles*

