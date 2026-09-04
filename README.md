<div align="center">
  <img src="public/logo.png" alt="O.R.C.A Logo" width="110" />
  <h1>O.R.C.A — Organised Crime Analysis Authority</h1>
  <p><b>Secure Law Enforcement Intelligence Command Portal</b><br><i>Karnataka State Police • Internal Security Division (ISD) • SCRB</i></p>
</div>

---

## 📌 Table of Contents

- [Demo Access](#demo-access)
- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Architecture](#architecture)
- [Three-Layer RBAC System](#three-layer-rbac-system)
- [Officer Roles & Permissions](#officer-roles--permissions)
- [ISD Clearance Levels](#isd-clearance-levels)
- [Authentication Flow](#authentication-flow)
- [Evidence Chain of Custody](#evidence-chain-of-custody)
- [VPN & Network Security](#vpn--network-security)
- [API Routes](#api-routes)
- [Environment Variables](#environment-variables)
- [Local Development](#local-development)
- [Deployment — Zoho AppSail](#deployment--zoho-appsail)
- [Scripts Reference](#scripts-reference)
- [Project Structure](#project-structure)
- [Security Notes](#security-notes)

---

## 🔓 Demo Access

> **For reviewers, evaluators, and authorised observers only.**

A read-only guest account is available to explore the O.R.C.A dashboard without affecting any live data.

```
Email     : demo@orca.gov
Password  : orca_@demo9854
Role      : orca_demo  (ORCA-LEVEL-IV — READ ONLY)
```

> 🟢 **What you can do:** Browse all dashboard modules, view cases, evidence, tasks, analytics, maps, accused profiles, arrest records, bail/remand orders, missing persons, wanted persons, watch list, general diary, court deadlines, and reports.

> 🔴 **What you cannot do:** Create, edit, or delete any record. All write operations (POST / PATCH / DELETE) are blocked at the API layer — not just hidden in the UI.

---

> ⚠️ **WARNING — MONITORED ACCESS**
>
> This account is strictly for **authorised viewing only**. Any attempt to misuse, probe, or exploit this access is a violation of the Information Technology Act, 2000 (India).
>
> **Your IP address, session activity, and all actions are logged in real time** to the ORCA audit system and are visible to the Internal Security Division (ISD). Misuse will be reported to the appropriate authorities.

---

## 🧭 Overview

**O.R.C.A** is a full-stack, classified law enforcement intelligence and administration platform built for the Karnataka State Police. It provides a unified command workspace for criminal investigation management, accused profiling, arrest and custody tracking, bail/remand monitoring, missing persons and wanted persons registers, watch list management, general diary, court deadline tracking, evidence custody, field task coordination, document verification, predictive analytics, and AI-powered criminal network analysis — all backed by a multi-layer role-based access control system.

```
Platform  : O.R.C.A India 2026
Codename  : Intelligence Command Suite
Stack     : Next.js 16 + Firebase Auth + Zoho Catalyst + TypeScript
Hosting   : Zoho AppSail (Node 24)
Agency    : Karnataka State Police / SCRB / ISD
Status    : RESTRICTED — Internal Use Only
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|---|---|
| 🖥️ **Framework** | Next.js 16.2 (App Router, Turbopack) |
| 🎨 **UI** | React 19 · Tailwind CSS v4 · shadcn/ui · Lucide Icons |
| 🔐 **Auth** | Firebase Authentication v12 (JWT Custom Claims + Cookie) |
| 🗄️ **Data Store** | Zoho Catalyst Data Store (single source of truth) |
| 🛡️ **Admin SDK** | Firebase Admin SDK (server-side API routes) |
| 🤖 **AI Engine** | NVIDIA NIM API (primary) · GROQ API (fallback) |
| 🗣️ **Voice AI** | Zoho Zia (primary TTS/STT) · Sarvam AI (fallback) — Indian-hosted, Kannada & Hindi |
| 🗺️ **Maps** | OpenStreetMap tiles — no Leaflet, no CDN dependency |
| 🕸️ **Graphs** | D3-force v3 (criminal network relation graph) |
| 📦 **Barcodes** | JsBarcode · @zxing/library (Code 128 generation & scan) · **Zoho Zia** (2nd-layer decode) |
| 📄 **PDF** | jsPDF · jspdf-autotable (letterhead, charge sheets) |
| 🌐 **VPN Detection** | Header-based proxy detection · ip-api.com geolocation |
| 🔷 **Type Safety** | TypeScript 5 (strict mode) |

---

## ✨ Features

### 🗂️ Case Management
- **📁 Case Registration** — File FIR, UDR, PAR, and Zero FIR with full multi-step form; IPC/BNS section lookup, GPS location picker, complainant/victim/accused capture
- **📋 Case Ledger** — Searchable, filterable list of all registered cases with expand, print, and barcode letterhead export
- **⏱️ Case Timeline Reconstructor** — Enter any Crime Number or Case ID to reconstruct the complete event history: registration, offence window, IPC sections, task activity, and document verification — displayed as a colour-coded, gradient-railed timeline
- **📊 FIR Live Analytics** — Hand-rolled SVG charts: case velocity, crime-type distribution, station breakdown, status pipeline — no third-party chart library
- **📈 Crime Analytics** — Aggregated statistics across all cases: trend lines, gravity breakdown, district comparison
- **⚖️ Court Deadlines** — Tracks the 60-day (heinous) and 90-day (non-heinous) charge-sheet filing deadlines per case; surfaces OVERDUE and CRITICAL cases with days-remaining count

### 👤 Accused & Custody
- **🧑‍💼 Accused Profile** — Browse all accused persons as clickable cards (with case count badge and REPEAT pill for multi-case offenders); open any profile for a full identity header, tabbed detail view (Cases / Arrests / Bail / Associates), and a one-hop associate graph
- **🚔 Arrest Register** — Log arrests with ArrestNo auto-number, linked FIR, sections invoked, grounds of arrest, medical examination, and court hearing date; status lifecycle: `IN_CUSTODY → BAILED → REMANDED → RELEASED`
- **⚖️ Bail / Remand Tracker** — Log bail and remand orders linked to ArrestNo; auto-derives the real Crime Number from the arrest record; expiry countdown with 3-day warning banner; status updates: `ACTIVE → EXPIRED / REVOKED`
- **🔁 Repeat Offenders** — Analytics view surfacing accused persons appearing across multiple cases; sorted by case count with gravity indicators

### 🔍 Intelligence & Investigation
- **🗺️ District Heatmap** — Inline SVG map of all 31 Karnataka districts coloured by real Threat Index from Catalyst. Empty means empty — no fabricated data
- **🕸️ Criminal Network Graph** — D3-force directed relation graph: enter a case number to see all accused, co-accused, and cross-case links in one hop
- **📂 District Dossier** — Per-district intelligence summary: threat index, open cases, officer roster
- **📰 Live News Feeds** — Curated intelligence briefings from authorised sources
- **📡 Intercepts** — Intercept records module with classification markings

### 📒 Registers & Records
- **📓 General Diary** — Station-level daily log of all events, complaints, and movements not amounting to an FIR; auto-numbered `GD/YYYY/NNNNN`
- **🔎 Missing Persons** — Register missing persons with description, last-seen location, and linked FIR; status lifecycle: `MISSING → FOUND → CLOSED`
- **🎯 Wanted Persons / Absconders** — Maintain a wanted persons register with threat level, reward amount, and issuing station; status lifecycle: `WANTED → APPREHENDED → CANCELLED`
- **👁️ Watch List** — Flag persons of interest for active monitoring; threat-level classification (HIGH / MEDIUM / LOW); status lifecycle: `ACTIVE → ESCALATED → CLOSED`

### 🧾 Evidence & Property
- **🔬 Evidence Registration** — Log collected evidence with type, description, GPS coordinates, seal number, and quantity; auto-numbered `EVD/YYYY/000001`
- **🔗 Evidence Trail** — SHA-256 hash-chained custody audit trail: every transfer is tamper-evident, chain verified on load, broken chain raises a tamper alert
- **🏠 Property Register** — Lost & Stolen property (standalone, no FIR link required); Seized property linked to Evidence module; declared value, not assessed

### ✅ Task & Assignment
- **📝 Task Assignment** — ORCA command creates tasks linked to cases; assign to officers by unit; set priority, sensitivity, due date, checklist, and deliverables
- **🔄 Task Lifecycle** — Full audit-logged lifecycle: `ASSIGNED → ACKNOWLEDGED → IN_PROGRESS → COMPLETED / CANCELLED / ON_HOLD`
- **🔗 Linked Tasks** — View all tasks associated with any case from the case detail panel

### 📊 Analytics & Intelligence
- **🔮 Predictive Analytics** — AI-powered forecast of case volume, crime hotspots, and district risk trends using historical Catalyst data
- **🏆 Station Performance** — Comparative performance metrics across police stations: case resolution rate, task completion, and pending workload
- **📡 Notifications** — Unified real-time alert panel: overdue tasks, bail orders expiring within 3 days, and case charge-sheet deadlines — all urgency-sorted, sourced live from Catalyst

### 🔐 Verification & Admin
- **📄 Document Verification** — Scan barcode/QR against the VerificationLedger in Catalyst; shows linked case record panel if matched
- **🏛️ Command Admin Centre** — Role assignment, account management, RBAC audit logs; ORCA-owner and ISD-Level-I only
- **📊 RBAC Audit Logs** — Immutable role change log with full actor, target, before/after state
- **📥 Reference Data Loader** — CSV bulk-import for master/reference tables; admin only
- **📡 Telemetry** — System health, session counts, API latency monitoring

### 🤖 AI & Intelligence
- **💬 AI Intelligence Chatbot** — Retrieval-augmented assistant querying live Catalyst records; citations come from retrieval — invented case numbers are flagged, not passed through. Supports image attachment: scanned FIRs, notices, and evidence photos are transcribed by a vision model before the question is answered
- **🔍 Live OSINT Engine** — The chatbot performs real-time open-source intelligence lookups when an officer mentions an IP, domain, email, or phone number with investigative intent. All lookups run in parallel server-side; no OSINT data is stored:
  - **IP addresses (IPv4 + IPv6)** — geolocation (ip-api.com), RDAP ownership & IP range, Tor exit node check (Tor Project bulk list, cached 6 h), URLhaus malware listing, VirusTotal (90+ AV engines), Shodan (open ports, banners, known CVEs), AbuseIPDB confidence score
  - **Domains** — DNS A records, RDAP registrar/nameservers/expiry, crt.sh certificate transparency (all certs ever issued, useful for hidden subdomain discovery), URLhaus, VirusTotal category & reputation
  - **Email addresses** — disposable-domain check, LeakCheck breach lookup (breach source names, data fields exposed)
  - **Phone numbers** — numverify carrier, country, line type (mobile / landline / VOIP), location
  - Sources are named explicitly in every OSINT reply; the chatbot is instructed never to claim a source was checked unless it appears in the retrieved block
- **🧠 Mini AI Assistant** — Compact embedded widget using the same retrieval and OSINT backend
- **🎙️ Voice Command Palette** — Speech-to-text dictation via **Zoho Zia** (primary) with **Sarvam AI** as fallback; supports Kannada and Hindi natively. Gated behind explicit user consent — audio leaves the device only after approval. Indian-hosted providers are used instead of Chrome's SpeechRecognition because Chrome streams audio to Google's servers, which is unacceptable for a restricted law enforcement deployment
- **🔊 Multilingual Narration** — Zoho Zia TTS (primary) / Sarvam AI (fallback) narrates AI responses in Kannada and Hindi. TTS audio is cached server-side by content hash so repeated demo runs bill once. Key rotation across up to 8 `SARVAM_API_KEY_1..8` slots handles per-account credit limits gracefully

### 🛡️ Security
- **🔐 Three-Layer RBAC** — Clearance namespace × ISD Level × Dashboard Role; tab-level enforcement at both UI and API route layer
- **🌐 VPN/Proxy Detection** — Real-time network threat monitoring with automatic audit log write to Catalyst
- **🔒 Cookie-based Auth** — Firebase ID token in `authToken` cookie (`SameSite=Strict`, `Secure` in prod); never localStorage
- **📝 Session Audit** — `OfficerSession` rows in Catalyst for every START / RESUME / END event; `pagehide` + `keepalive` closes sessions on tab close

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                             │
│  ┌─────────────┐   ┌───────────────────┐   ┌────────────────────┐  │
│  │  Login Page │   │  Dashboard (SPA)  │   │  Admin Centre      │  │
│  │  Badge/KGID │   │  Tab-based RBAC   │   │  ISD-LEVEL-I only  │  │
│  └─────────────┘   └───────────────────┘   └────────────────────┘  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │  Next.js App Router (Turbopack)
┌──────────────────────────▼──────────────────────────────────────────┐
│                     SERVER (API Routes)                               │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────────┐  │
│  │  /api/auth/    │  │  /api/admin/   │  │  /api/security/      │  │
│  │  session-log   │  │  rbac/*        │  │  vpn-check           │  │
│  └────────────────┘  └────────────────┘  └──────────────────────┘  │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────────┐  │
│  │  /api/fir/     │  │  /api/tasks/   │  │  /api/evidence/      │  │
│  │  register      │  │  status/       │  │  custody/            │  │
│  └────────────────┘  └────────────────┘  └──────────────────────┘  │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────────┐  │
│  │  /api/accused/ │  │  /api/arrest   │  │  /api/bail-remand    │  │
│  │  profile/browse│  │  PATCH status  │  │  PATCH status        │  │
│  └────────────────┘  └────────────────┘  └──────────────────────┘  │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────────┐  │
│  │ /api/missing-  │  │ /api/wanted-   │  │  /api/watch-list     │  │
│  │  persons PATCH │  │  persons PATCH │  │  PATCH status        │  │
│  └────────────────┘  └────────────────┘  └──────────────────────┘  │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────────────┐  │
│  │ /api/case/     │  │ /api/analytics/│  │  /api/notifications  │  │
│  │ timeline/      │  │ predictive/    │  │  unified alerts      │  │
│  │ deadlines/     │  │ stations/      │  │                      │  │
│  └────────────────┘  └────────────────┘  └──────────────────────┘  │
│  ┌────────────────┐  ┌────────────────┐                             │
│  │  /api/chat/    │  │  /api/         │                             │
│  │  NVIDIA/GROQ   │  │  verification/ │                             │
│  └────────────────┘  └────────────────┘                             │
└──────────────────────────┬──────────────────────────────────────────┘
              ┌────────────┴────────────┐
              │ Firebase Admin SDK       │ Zoho Catalyst SDK (OAuth2)
┌─────────────▼────────┐  ┌────────────▼──────────────────────────────┐
│   FIREBASE AUTH       │  │           ZOHO CATALYST DATA STORE         │
│  ┌─────────────────┐  │  │  ┌─────────────┐  ┌────────────────────┐ │
│  │ Authentication  │  │  │  │ Officer     │  │ Case Records       │ │
│  │ Custom Claims   │  │  │  │ Employee    │  │ CaseMaster         │ │
│  │ (fallback only) │  │  │  │ OfficerAcc  │  │ Accused / Arrest   │ │
│  └─────────────────┘  │  │  └─────────────┘  └────────────────────┘ │
└───────────────────────┘  │  ┌─────────────┐  ┌────────────────────┐ │
  Authentication only —     │  │ Evidence    │  │ Tasks              │ │
  no Firestore in use.      │  │ EvidCustody │  │ TaskAuditLog       │ │
                            │  └─────────────┘  └────────────────────┘ │
                            │  ┌─────────────┐  ┌────────────────────┐ │
                            │  │ BailRemand  │  │ MissingPerson      │ │
                            │  │ ArrestRecord│  │ WantedPerson       │ │
                            │  └─────────────┘  └────────────────────┘ │
                            │  ┌─────────────┐  ┌────────────────────┐ │
                            │  │ WatchList   │  │ GeneralDiary       │ │
                            │  │ Notifications│  │ VerifiedDocument   │ │
                            │  └─────────────┘  └────────────────────┘ │
                            │  ┌─────────────┐  ┌────────────────────┐ │
                            │  │Verification │  │ Reference Tables   │ │
                            │  │ Ledger      │  │ 31 Districts · Acts│ │
                            │  └─────────────┘  └────────────────────┘ │
                            └───────────────────────────────────────────┘
```

---

## 🔐 Three-Layer RBAC System

O.R.C.A enforces access control through **three independent, stacked layers**. All three must align for access to be granted.

```
Layer 1: CLEARANCE NAMESPACE  →  ORCA / ISD / CRB
             ↓ determines the role pool available ↓
Layer 2: ISD LEVEL            →  Data access tier (LEVEL-I through IV)
             ↓ combined with ↓
Layer 3: DASHBOARD ROLE       →  Module access (which tabs/features render)
```

> **Clearance** is **always derived from the role at runtime** — never stored independently. This prevents the historical bug where `ISD-LEVEL-I` (highest clearance) was persisted on a low-privilege account.

> **Tab-level enforcement**: `allowedTabs` per role is checked at the API route layer on every request — read-only roles cannot `POST/PATCH` even if they manipulate the UI.

---

## 👮 Officer Roles & Permissions

| Role | Label | Namespace | Module Access |
|---|---|---|---|
| `orca_owner` | 🔷 ORCA Owner | ORCA | Full platform including role assignment and config |
| `orca_engineer` | 🔷 ORCA Engineer | ORCA | Full + infrastructure |
| `orca_support` | 🔷 ORCA Support | ORCA | Operational write (cases, tasks, evidence) |
| `orca_demo` | 🔷 Demo Account | ORCA | Read-only — no POST/PATCH |
| `command_admin_l1` | 🛡️ District Command | ISD | Full write — district level |
| `command_admin_l2` | 🛡️ Unit Command | ISD | Full write — unit level |
| `verification_admin_l2` | 📋 Verification Lead | ISD | Verification + directory + roles |
| `admin_verification` | 📋 Verification Officer | ISD | Verification services + applications |
| `it_admin` | 💻 IT Security Admin | ISD | Telemetry · audit logs · security controls |
| `scrb_officer` | 🏛️ SCRB Officer | CRB | Operational write — SCRB scope |
| `field_officer_l3` | 🚔 Field Officer L3 | ISD | Investigation + evidence + tasks |
| `field_officer_l4` | 🚔 Field Officer L4 | ISD | Base investigation dashboard |
| `investigation_l2` *(legacy)* | 🔍 Investigation L2 | ISD | Full investigation + verification |
| `investigation_l1` *(legacy)* | 🔍 Investigation L1 | ISD | Standard investigation tools |

> ⚠️ `admin_full`, `admin_scrb`, and `investigation_l1` are deprecated roles — they still resolve to prevent lockout but cannot be newly assigned via the Role Assignment Manager.

---

## 🔏 ISD Clearance Levels

| Level | Badge | Description |
|---|---|---|
| `ORCA-LEVEL-I` | 🔷 Internal | ORCA platform owners — full access including deployment config |
| `ORCA-LEVEL-II` | 🔷 Internal | ORCA engineers — full + infrastructure |
| `ORCA-LEVEL-III` | 🔷 Internal | ORCA support — operational write |
| `ORCA-LEVEL-IV` | 🔷 Internal | Demo — read-only |
| `ISD-LEVEL-I` | 🔴 Highest | District command — all data access, role assignment |
| `ISD-LEVEL-II` | 🟠 High | Unit command — administrative and operational |
| `ISD-LEVEL-III` | 🟡 Medium | IT systems, verification, field investigation |
| `ISD-LEVEL-IV` | 🟢 Standard | Field operational — base investigation only |
| `CRB-LEVEL-I` | 🏛️ SCRB | SCRB operational write — crime records scope |

---

## 🔑 Authentication Flow

```
Officer enters Badge ID (KGID) or email + PIN
        │
        ▼
 Badge ID mapped to {badge}@karnatakapolice.gov.in
        │
        ▼
 Firebase signInWithEmailAndPassword
        │
        ▼
 ID Token written to authToken cookie
 (1 hr max-age · SameSite=Strict · Secure in prod)
        │
        ▼
 GET /api/officer/profile (cookie-authenticated)
        │
        ├──► Firebase Admin verifies ID token
        │
        └──► Catalyst OfficerAccount row fetched (role + clearance)
              │
              ├── Account NOT Active?  → Firebase sign-out immediately
              │
              └── Account Active?  → Dashboard renders for role
                        │
                        ▼
              OfficerSession START logged in Catalyst
                        │
                        ▼
              onIdTokenChanged rewrites cookie every ~1 hr
                        │
                        ▼
              pagehide + keepalive → OfficerSession END on tab close
```

> **Key rule:** Catalyst is the authoritative source for role and clearance. A stale Firebase custom claim **cannot** override a Catalyst role change — the profile fetch always wins.

---

## 🔗 Evidence Chain of Custody

Every `EvidenceCustody` row is cryptographically linked in a tamper-evident chain:

```
Genesis row:
  PrevHash = "0000...0000" (64 zeros)
  RowHash  = SHA-256(PrevHash + "\n" + canonical(row))

Each subsequent row:
  PrevHash = previous row's RowHash
  RowHash  = SHA-256(PrevHash + "\n" + canonical(row))

canonical(row) = EvidenceID|SeqNo|EventTypeID|FromEmpID|ToEmpID|EventAt|Location
```

When the Evidence Trail loads in the browser, the chain is re-verified locally. A broken hash anywhere in the chain raises a **tamper alert** — it is never silently passed or ignored.

**Custody event types:**

| Event | Meaning |
|---|---|
| `Collected at Scene` | Initial collection from crime scene |
| `Deposited in Malkhana` | Transferred to station strongroom |
| `Sent to FSL` | Dispatched to Forensic Science Laboratory |
| `Received from FSL` | Returned after forensic examination |
| `Produced in Court` | Produced before the Magistrate/Sessions Court |
| `Received from Court` | Returned from court post-hearing |
| `Released to Owner` | Returned to rightful owner after disposal order |
| `Disposed` | Permanently disposed per court order |

---

## 🌐 VPN & Network Security

O.R.C.A includes a real-time **VPN and Proxy Detection System** to enforce network security policy.

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
                  surfshark, mullvad, cloudflare,
                  digitalocean, AWS, OVH, Linode
```

### API Responses

| Condition | `vpnDetected` | `networkType` |
|---|---|---|
| ✅ Clean state network | `false` | `STATE_POLICE_INTRANET_SECURE` |
| ⚠️ VPN/Proxy detected | `true` | `UNTRUSTED_VPN_PROXY (ISP Name)` |

### VPN Security Actions
- 🔔 **Warning banner** shown on officer's dashboard
- 📝 **Automatically logged** to Catalyst `OfficerActivity` with `severity: HIGH_SECURITY_ALERT`
- 🔎 Officer UID, email, and source IP captured for ISD audit review

### Testing VPN Detection (Dev)
```bash
GET /api/security/vpn-check?simulateVpn=true
```

---

## 🔌 API Routes

### 🔐 Authentication & Session
| Endpoint | Method | Description |
|---|---|---|
| `/api/auth/session-log` | `POST` | Log session START / RESUME / END to Catalyst |
| `/api/officer/profile` | `GET` | Fetch officer profile + role from Catalyst |
| `/api/officer/telemetry` | `GET` | Officer session and system health metrics |
| `/api/officer/photo` | `GET` | Officer photo from Catalyst file store |

### 🏛️ Administration (Admin auth required)
| Endpoint | Method | Description |
|---|---|---|
| `/api/admin/approve-registration` | `POST` | Approve officer registration, set Firebase custom claims |
| `/api/admin/reject-registration` | `POST` | Reject officer, update registration status |
| `/api/admin/rbac/set-role` | `POST` | Assign `isdLevel` + `dashboardRole` to officer |
| `/api/admin/rbac/create-profile` | `POST` | Provision new officer account in Catalyst + Firebase |
| `/api/admin/rbac/logs` | `GET` | Fetch RBAC audit log entries from Catalyst |
| `/api/admin/overview` | `GET` | Platform summary statistics |
| `/api/admin/officer` | `GET / POST / PATCH` | Officer directory management |
| `/api/admin/application` | `GET / POST` | Pending registration review |

### 📁 Cases & FIR
| Endpoint | Method | Description |
|---|---|---|
| `/api/fir/register` | `POST` | Register new FIR / UDR / PAR |
| `/api/fir/cases` | `GET` | List cases; `?view=console` returns mapped shape |
| `/api/fir/masters` | `GET` | Reference master data for FIR form |
| `/api/fir/reference` | `GET` | IPC / BNS section and act lookup |
| `/api/case/timeline` | `GET` | Full event timeline for one case — registration, tasks, sections, documents |
| `/api/case/deadlines` | `GET` | Charge-sheet deadline status per open case (60d heinous / 90d others) |

### 👤 Accused & Custody
| Endpoint | Method | Description |
|---|---|---|
| `/api/accused/browse` | `GET` | Distinct accused person list with case counts (browse grid) |
| `/api/accused/profile` | `GET` | Full accused profile: cases, arrests, bail/remand, associates |
| `/api/accused/repeat` | `GET` | Repeat offenders — accused appearing in 2+ cases |
| `/api/arrest` | `GET / POST / PATCH` | Arrest records list / create / update status |
| `/api/bail-remand` | `GET / POST / PATCH` | Bail & remand orders / create / update status |

### 📒 Registers
| Endpoint | Method | Description |
|---|---|---|
| `/api/general-diary` | `GET / POST` | General diary entries / create |
| `/api/missing-persons` | `GET / POST / PATCH` | Missing persons list / register / update status |
| `/api/wanted-persons` | `GET / POST / PATCH` | Wanted persons list / register / update status |
| `/api/watch-list` | `GET / POST / PATCH` | Watch list entries / add / update status |
| `/api/property` | `GET / POST` | Property register (Lost & Stolen / Seized) |

### ✅ Tasks
| Endpoint | Method | Description |
|---|---|---|
| `/api/tasks` | `GET / POST` | List tasks / create task |
| `/api/tasks/status` | `PATCH` | Lifecycle transition (ACKNOWLEDGED / IN_PROGRESS / COMPLETED…) |
| `/api/tasks/reassign` | `PATCH` | Reassign task to different officer |
| `/api/tasks/assignable` | `GET` | Officers available for assignment (form lookup) |

### 🔬 Evidence
| Endpoint | Method | Description |
|---|---|---|
| `/api/evidence` | `GET / POST` | List evidence / register new item |
| `/api/evidence/custody` | `GET / POST` | Custody chain read / new custody event |
| `/api/evidence/file` | `GET / POST` | Attach / download evidence file |

### 📊 Analytics
| Endpoint | Method | Description |
|---|---|---|
| `/api/analytics/fir` | `GET` | FIR live analytics aggregation |
| `/api/analytics/crime` | `GET` | District-level crime and threat index |
| `/api/analytics/stations` | `GET` | Station performance metrics |
| `/api/analytics/predictive` | `GET` | AI-powered predictive crime analytics |

### 🔔 Notifications
| Endpoint | Method | Description |
|---|---|---|
| `/api/notifications` | `GET` | Unified urgent alerts: overdue tasks, bail expiry, case deadlines |

### 🤖 AI
| Endpoint | Method | Description |
|---|---|---|
| `/api/chat` | `POST` | NVIDIA NIM / GROQ AI chatbot with Catalyst retrieval |
| `/api/network/case` | `GET` | One-hop relation graph data for a case |

### 🛡️ Security
| Endpoint | Method | Description |
|---|---|---|
| `/api/security/vpn-check` | `GET` | Detect VPN/proxy on requesting IP |
| `/api/security/vpn-check` | `POST` | Write VPN detection alert to Catalyst audit |

### ✅ Verification & Voice
| Endpoint | Method | Description |
|---|---|---|
| `/api/verification/document` | `GET / POST` | Two-stage barcode decode: ZXing (Stage 1) → **Zoho Zia** (Stage 2) → verify hash against VerificationLedger |
| `/api/verification/register` | `POST` | Register new verification record |
| `/api/voice/tts` | `POST` | Text-to-speech via **Zoho Zia** (primary) / **Sarvam AI** fallback (Kannada / Hindi / English) |
| `/api/voice/stt` | `POST` | Speech-to-text transcription via **Zoho Zia** (primary) / **Sarvam AI** fallback |
| `/api/settings/voice` | `GET / POST` | Voice feature toggle and language settings |

### 🌐 Public
| Endpoint | Method | Description |
|---|---|---|
| `/api/support` | `POST` | Submit a support ticket (public — no auth) |
| `/api/bulletins` | `GET` | Security bulletins feed |

---

## 🗝️ Environment Variables

Create `.env.local` in the project root:

```env
# ── Zoho Catalyst (ORCA_DS_* preferred; CATALYST_* accepted locally) ──
ORCA_DS_CLIENT_ID=your_client_id
ORCA_DS_CLIENT_SECRET=your_client_secret
ORCA_DS_REFRESH_TOKEN=your_refresh_token
ORCA_DS_PROJECT_ID=42921000000067081
ORCA_DS_ENVIRONMENT=Development

# ── Firebase Client SDK (safe to prefix NEXT_PUBLIC_) ────────────────
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# ── Firebase Admin SDK (SERVER-ONLY — NEVER prefix with NEXT_PUBLIC_) ─
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}

# ── AI Keys (SERVER-ONLY) ────────────────────────────────────────────
NVIDIA_API_KEY=nvapi_your_nvidia_key        # Primary AI Engine
GROQ_API_KEY=gsk_your_groq_key             # Fallback AI Engine

# ── Sarvam AI — Indian TTS / STT (SERVER-ONLY) ───────────────────────
# Supports up to 8 keys; rotates automatically on quota/credit exhaustion.
# Each key has a small fixed credit balance — TTS bills per 1,000 chars,
# STT bills per hour. Audio responses are cached by content hash server-side.
SARVAM_API_KEY_1=your_sarvam_key_1
SARVAM_API_KEY_2=your_sarvam_key_2         # optional fallback slots 2-8

# ── OSINT API Keys (SERVER-ONLY, all optional) ───────────────────────
# Each key activates a live source inside the AI chatbot's OSINT engine.
# Missing keys are skipped gracefully — the chatbot states which sources
# were not checked rather than silently omitting them.
VIRUSTOTAL_API_KEY=your_vt_key             # virustotal.com — free, 4 req/min
SHODAN_API_KEY=your_shodan_key             # shodan.io — free basic; $49 one-time for full scan history
LEAKCHECK_API_KEY=your_leakcheck_key       # leakcheck.io — free, 50 lookups/day
NUMVERIFY_API_KEY=your_numverify_key       # numverify.com — free, 100 lookups/month
```

> ⚠️ **Never** prefix `ORCA_DS_*`, `FIREBASE_SERVICE_ACCOUNT_KEY`, `NVIDIA_API_KEY`, `GROQ_API_KEY`, or any OSINT key with `NEXT_PUBLIC_`. They are server-only secrets.

> ℹ️ AppSail console rejects env var names containing the reserved keyword `CATALYST`. Use `ORCA_DS_*` names in the AppSail environment config — the code accepts both.

---

## 🖥️ Local Development

```bash
# Install dependencies
npm install

# Start dev server (Turbopack HMR)
npm run dev
```

App available at **http://localhost:3000**

> The dev server uses `--max-old-space-size=8192` to accommodate Turbopack's memory usage during large cold starts.

### Dev Login (Badge ID aliases)

| Badge ID | Resolves To | Default Role |
|---|---|---|
| `ORCA-001` | `owner@orca.gov` | ORCA Owner (full) |
| `KA-10045` | `field1@orca.gov` | Field Officer L3 |
| Full email | Used directly | As configured in Catalyst |

> Always verify at **port 3000 only**. Do not start a second dev server — Chrome is already signed in on this port.

---

## 🚀 Deployment — Zoho AppSail

### 1. Production Build

```bash
npm run build
```

Produces `.next/standalone/` — a self-contained server with ~2,700 traced files (vs. 59,500 in full `node_modules`).

### 2. Pack for AppSail

```bash
npm run pack:appsail
```

Runs `scripts/pack-appsail.js` — bundles the standalone output into a zip ready for AppSail upload.

### 3. Upload via Catalyst Console

Upload the zip through the AppSail section of the Zoho Catalyst Console. AppSail calls `npm start` → `node scripts/start.js`.

### ✅ Pre-Deployment Checklist

- [ ] All `ORCA_DS_*` environment variables set in AppSail console
- [ ] `FIREBASE_SERVICE_ACCOUNT_KEY` set as a single-line JSON string
- [ ] `NVIDIA_API_KEY` and `GROQ_API_KEY` set server-side
- [ ] OSINT keys set server-side (`VIRUSTOTAL_API_KEY`, `SHODAN_API_KEY`, `LEAKCHECK_API_KEY`, `NUMVERIFY_API_KEY`) — optional but recommended; missing keys are skipped gracefully
- [ ] Firebase Auth email/password enabled in Firebase Console
- [ ] `npm run build` completes with 0 TypeScript errors
- [ ] Reference tables confirmed intact (should total ~1,278 rows)
- [ ] `owner@orca.gov` account has `orca_owner` claims set in Firebase
- [ ] **Never edit `app-config.json` or `catalyst.json`** — these trigger live redeployment

---

## 🛠️ Scripts Reference

| Script | Purpose |
|---|---|
| `scripts/start.js` | AppSail server entry point |
| `scripts/pack-appsail.js` | Bundle standalone output for AppSail upload |

---

## 📁 Project Structure

```
.
├── public/                                   🖼️  Public assets (logo, geo data)
├── scripts/                                  🛠️  Maintenance and utility scripts
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── admin/
│   │   │   │   ├── approve-registration/     🔐  Officer approval + custom claims
│   │   │   │   ├── reject-registration/      🔐  Officer rejection workflow
│   │   │   │   ├── application/              📋  Pending registration management
│   │   │   │   ├── officer/                  👤  Officer directory API
│   │   │   │   ├── overview/                 📊  Platform summary stats
│   │   │   │   ├── ai-models/                🤖  AI model config
│   │   │   │   └── rbac/
│   │   │   │       ├── set-role/             🔑  ISD level + role assignment
│   │   │   │       ├── create-profile/       👤  New officer provisioning
│   │   │   │       └── logs/                 📋  RBAC audit log viewer
│   │   │   ├── auth/
│   │   │   │   └── session-log/              🔐  Session lifecycle logging
│   │   │   ├── fir/
│   │   │   │   ├── register/                 📁  FIR / UDR / PAR registration
│   │   │   │   ├── cases/                    📋  Case list + console view
│   │   │   │   ├── masters/                  📦  Reference master data
│   │   │   │   └── reference/                📖  IPC / BNS section lookup
│   │   │   ├── case/
│   │   │   │   ├── timeline/                 ⏱️  Full event timeline per case
│   │   │   │   └── deadlines/                ⚖️  Charge-sheet deadline tracker
│   │   │   ├── accused/
│   │   │   │   ├── browse/                   🧑‍💼  Distinct accused browse grid
│   │   │   │   ├── profile/                  👤  Full accused profile + associates
│   │   │   │   └── repeat/                   🔁  Repeat offender analytics
│   │   │   ├── arrest/                       🚔  Arrest records (GET/POST/PATCH)
│   │   │   ├── bail-remand/                  ⚖️  Bail & remand orders (GET/POST/PATCH)
│   │   │   ├── general-diary/                📓  General diary entries (GET/POST)
│   │   │   ├── missing-persons/              🔎  Missing persons (GET/POST/PATCH)
│   │   │   ├── wanted-persons/               🎯  Wanted persons (GET/POST/PATCH)
│   │   │   ├── watch-list/                   👁️  Watch list (GET/POST/PATCH)
│   │   │   ├── property/                     🏠  Property register (GET/POST)
│   │   │   ├── notifications/                🔔  Unified urgent alerts
│   │   │   ├── tasks/
│   │   │   │   ├── route.ts                  ✅  Task list + create
│   │   │   │   ├── status/                   🔄  Lifecycle transitions
│   │   │   │   ├── reassign/                 🔄  Task reassignment
│   │   │   │   └── assignable/               👤  Assignable officers lookup
│   │   │   ├── evidence/
│   │   │   │   ├── route.ts                  🔬  Evidence list + register
│   │   │   │   ├── custody/                  🔗  Custody chain events
│   │   │   │   └── file/                     📎  File attachment / download
│   │   │   ├── analytics/
│   │   │   │   ├── fir/                      📊  FIR live analytics
│   │   │   │   ├── crime/                    📈  District crime + threat index
│   │   │   │   ├── stations/                 🏆  Station performance metrics
│   │   │   │   └── predictive/               🔮  AI-powered predictive analytics
│   │   │   ├── network/
│   │   │   │   └── case/                     🕸️  One-hop relation graph data
│   │   │   ├── chat/                         🤖  NVIDIA / GROQ AI chatbot
│   │   │   ├── voice/
│   │   │   │   ├── tts/                      🗣️  Sarvam AI text-to-speech
│   │   │   │   └── stt/                      🎙️  Sarvam AI speech-to-text
│   │   │   ├── settings/voice/               ⚙️  Voice feature toggle + language
│   │   │   ├── bulletins/                    📡  Security bulletins feed
│   │   │   ├── support/                      🛠️  Public support ticket submission
│   │   │   ├── security/
│   │   │   │   └── vpn-check/                🌐  VPN / proxy detection
│   │   │   └── verification/
│   │   │       ├── document/                 📄  Document hash verification
│   │   │       └── register/                 📄  Verification record creation
│   │   ├── dashboard/                        📊  Main gated dashboard (tab SPA)
│   │   ├── login/                            🔑  Officer login page
│   │   ├── verification/document/            📄  Document verification portal
│   │   ├── forgot-password/                  🔑  Password recovery
│   │   ├── report-issue/                     🐛  Issue reporting portal
│   │   ├── support/                          🛠️  Public support page
│   │   ├── rti/                              📜  RTI compliance portal
│   │   ├── privacy/                          🔒  Privacy policy
│   │   ├── terms/                            📄  Terms of service
│   │   ├── unauthorized/                     ⛔  Access denied page
│   │   └── accessibility/                    ♿  Accessibility statement
│   ├── components/
│   │   ├── admin/
│   │   │   └── RoleAssignmentManager.tsx     🔑  Role assignment UI
│   │   ├── dynamic/
│   │   │   ├── CaseRegistration.tsx          📁  FIR / UDR / PAR registration form
│   │   │   ├── CaseLedger.tsx                📋  Registered cases list + print
│   │   │   ├── CaseTimeline.tsx              ⏱️  Case event timeline reconstructor
│   │   │   ├── CourtDeadlines.tsx            ⚖️  Charge-sheet deadline tracker
│   │   │   ├── FirLiveAnalytics.tsx          📊  Live FIR SVG analytics charts
│   │   │   ├── CrimeAnalytics.tsx            📈  Aggregated crime statistics
│   │   │   ├── AccusedProfile.tsx            🧑‍💼  Accused browse grid + profile tabs
│   │   │   ├── ArrestRegister.tsx            🚔  Arrest record form + status controls
│   │   │   ├── BailRemandTracker.tsx         ⚖️  Bail/remand orders + expiry alerts
│   │   │   ├── RepeatOffenders.tsx           🔁  Repeat offender analytics view
│   │   │   ├── GeneralDiary.tsx              📓  General diary entries
│   │   │   ├── MissingPersons.tsx            🔎  Missing persons register
│   │   │   ├── WantedPersons.tsx             🎯  Wanted persons / absconders
│   │   │   ├── WatchList.tsx                 👁️  Watch list management
│   │   │   ├── EvidenceRegistration.tsx      🔬  Evidence intake form
│   │   │   ├── EvidenceTrail.tsx             🔗  SHA-256 custody audit trail
│   │   │   ├── PropertyRegister.tsx          🏠  Lost / Stolen / Seized property
│   │   │   ├── TaskAssignment.tsx            ✅  Task creation + assignment
│   │   │   ├── TaskSummaryCard.tsx           📋  Per-task status card
│   │   │   ├── LinkedTasks.tsx               🔗  Case-linked task viewer
│   │   │   ├── PredictiveAnalytics.tsx       🔮  AI predictive crime analytics
│   │   │   ├── StationPerformance.tsx        🏆  Station performance dashboard
│   │   │   ├── Network.tsx                   🕸️  D3-force criminal network graph
│   │   │   ├── MapGrid.tsx                   🗺️  Karnataka district SVG heatmap
│   │   │   ├── MapPicker.tsx                 📍  OpenStreetMap location picker
│   │   │   ├── DistrictDossier.tsx           📂  District intelligence dossier
│   │   │   ├── DocumentVerification.tsx      📄  Barcode / QR verification panel
│   │   │   ├── AIChatbotModule.tsx           💬  Full-page AI assistant
│   │   │   ├── MiniAIAssistant.tsx           🧠  Compact AI widget
│   │   │   ├── VoiceCommandPalette.tsx       🎙️  Voice dictation interface
│   │   │   ├── CommandAdminCenter.tsx        🏛️  Admin command panel
│   │   │   ├── Telemetry.tsx                 📡  System health monitoring
│   │   │   ├── LiveNewsFeeds.tsx             📰  Intelligence news grid
│   │   │   ├── Intercepts.tsx                📡  Intercept records module
│   │   │   ├── Letterhead.tsx                📜  Report letterhead + barcode
│   │   │   ├── FIRLetterhead.tsx             📜  FIR-specific letterhead
│   │   │   ├── Barcode128.tsx                🏷️  Code 128 barcode renderer
│   │   │   ├── OrcaLoader.tsx                ⏳  Full-page branded loading spinner
│   │   │   ├── ReferenceDataLoader.tsx       📥  CSV reference data importer
│   │   │   └── SearchableSelect.tsx          🔍  Type-to-filter dropdown primitive
│   │   └── layout/
│   │       ├── Sidebar.tsx                   🧭  Navigation sidebar
│   │       └── Topbar.tsx                    🔝  Top navigation bar
│   ├── context/
│   │   ├── AuthContext.tsx                   🔐  Auth state + Catalyst profile resolution
│   │   └── IntelligenceContext.tsx           🧠  Intelligence data context
│   ├── hooks/
│   │   └── useFIROptions.ts                  🔗  FIR crime-number options for form dropdowns
│   └── lib/
│       ├── catalyst.ts                       🗄️  Zoho Catalyst HTTP client (OAuth2 + nextId + cache)
│       ├── firebase.ts                       🔥  Firebase client init
│       ├── firebaseAdmin.ts                  🛡️  Firebase Admin SDK + auth helpers
│       ├── writeGuard.ts                     🔒  Write-operation guard — blocks read-only roles at API layer
│       ├── rbac.ts                           🗂️  Tab/menu access config per role
│       ├── permissions.ts                    📋  Role definitions and clearance map
│       ├── jurisdiction.ts                   🗺️  Officer jurisdiction scope (unit tree)
│       ├── threatIndex.ts                    📊  District Threat Index formula + GRAVITY_HEINOUS set
│       ├── networkGraph.ts                   🕸️  Criminal network graph data layer
│       ├── firCases.ts                       📁  FIR case data layer (analytics aggregation)
│       ├── firAnalytics.ts                   📈  FIR analytics helpers (date bucketing, age ranges)
│       ├── systemSettings.ts                 ⚙️  AI model runtime settings
│       ├── tasks.ts                          ✅  Task types, priorities, lifecycle enums
│       ├── evidence.ts                       🔬  Evidence data layer
│       ├── evidenceCustody.ts                🔗  SHA-256 custody chain logic
│       ├── evidenceValidation.ts             ✅  Evidence form validation
│       ├── verificationLedger.ts             📄  Verification ledger helpers (hash, register)
│       ├── sarvam.ts                         🗣️  Sarvam AI TTS/STT client (key rotation + cache)
│       ├── useVoice.ts                       🎙️  Voice hook (browser dictation gating)
│       ├── voiceCommands.ts                  🎙️  Voice command dispatch map
│       ├── adminService.ts                   🛠️  Admin data helpers
│       ├── chatService.ts                    💬  AI chat service
│       ├── documentService.ts                📄  Document verification (ZXing Stage 1 → Zia Stage 2)
│       ├── officerAccount.ts                 👤  OfficerAccount upsert helpers
│       └── adminData.ts                      🗄️  Employee creation helpers
├── .env.example                              🗝️  Environment variable template
├── .env.local                                🗝️  Local secrets (never commit)
├── .gitignore                                🚫  Git ignore config
├── app-config.json                           ⚙️  AppSail application config (do not edit)
├── catalyst.json                             ⚙️  Catalyst project config (do not edit)
├── next.config.ts                            ⚡  Next.js configuration (standalone output)
├── package.json                              📦  Dependencies and npm scripts
├── tailwind.config.ts                        🎨  Tailwind CSS v4 configuration
├── tsconfig.json                             🔷  TypeScript configuration
└── README.md                                 📖  This file
```

---

## 🛡️ Security Notes

> ⛔ **Critical**: `FIREBASE_SERVICE_ACCOUNT_KEY` grants full Firebase Admin access. Rotate immediately if ever exposed. Confirm `firebase-key.json` is in `.gitignore` before every commit.

> 🔒 **Catalyst is the authority**: Role and clearance are fetched from Catalyst on every authenticated request. A Firebase custom claim update alone does not change what a user can do — the Catalyst `OfficerAccount` row is always the source of truth.

> 🔗 **Evidence Chain Integrity**: The `EvidenceCustody` SHA-256 hash chain cannot be retroactively altered without breaking verification. A tampered chain is surfaced as a visible alert, not silently accepted.

> 📝 **Immutable Session Audit**: `OfficerSession` rows are written server-side in Catalyst via `keepalive` fetch — multi-device sessions are accurately tracked and cannot be spoofed from the client.

> 🌐 **VPN Monitoring**: All VPN/proxy detections are logged to Catalyst with `HIGH_SECURITY_ALERT` severity and visible in the ISD audit panel.

> ⚙️ **Never edit `app-config.json` or `catalyst.json`**: These are the AppSail deployment manifests. Any edit triggers a redeployment of the live production service.

> 🔑 **Key Rotation**: Regenerate your Firebase service account key and Zoho Catalyst Self-Client refresh token periodically. Update the corresponding environment variables in the AppSail console after each rotation.

> 🔒 **Write Guard**: Every mutating API route (`POST / PATCH / DELETE`) passes through `writeGuard.ts` before touching Catalyst. Read-only roles (`orca_demo`, `field_officer_l4`) are blocked at the route layer regardless of UI state.

> ⏱️ **nextId Race Mitigation**: The `nextId()` allocator serialises within a single server process via a per-table lock queue and adds randomised jitter (0–80 ms) before reading to reduce cross-instance collisions on AppSail multi-instance deployments.

---

*🛡️ O.R.C.A — Classified Intelligence Platform*  
*Karnataka State Police · SCRB Division · Internal Security Division*  
*Classification: RESTRICTED — Internal Use Only*
