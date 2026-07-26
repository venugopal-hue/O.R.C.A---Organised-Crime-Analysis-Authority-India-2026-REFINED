// ORCA AI - State Crime Intelligence Console Databases & Interfaces

export interface BNSSection {
  code: string;
  title: string;
  desc: string;
}

export interface Suspect {
  id: string;
  name: string;
  age: number;
  role: string;
  record: string;
  confidence: string;
  photo: string;
  watchlistStatus: "CRITICAL" | "SURVEILLANCE" | "FLAGGED";
  aliases: string;
  associates: string;
}

export interface TimelineNode {
  time: string;
  desc: string;
  severe: boolean;
}

export interface ChainOfCustodyLog {
  timestamp: string;
  action: string;
  operator: string;
  hash: string;
}

export interface FIRCase {
  id: string;
  title: string;
  district: string;
  datetime: string;
  severity: "severe" | "high" | "moderate" | "low";
  category: string;
  summary: string;
  modusOperandi: string;
  legalSections: BNSSection[];
  suspects: Suspect[];
  timeline: TimelineNode[];
  confidenceScore: number;
  sha256Hash: string;
  forensicMetadata: {
    ingestTerminal: string;
    ocrConfidence: string;
    entityMatchWeight: string;
    validationStatus: string;
  };
  chainOfCustody: ChainOfCustodyLog[];
}

export interface DistrictTelemetry {
  name: string;
  level: "CRITICAL" | "HIGH" | "MODERATE" | "LOW";
  density: string;
  firs: string;
  dominant: string;
  patrol: string;
  squads: string;
  advisory: string;
  pulsatingHotspot: boolean;
  geofenceAlert?: string;
  patrolCoordinates: string;
}

export interface SuspectDossier {
  name: string;
  age: number;
  tier: string;
  status: string;
  modusOperandi: string;
  location: string;
  firs: string;
  contacts: string;
  vehicles: string;
  accounts: string;
  notes: string;
  aliases: string;
  knownAssociates: string;
  financialAnomaly: string;
  watchlistStatus: "CRITICAL" | "SURVEILLANCE" | "FLAGGED";
}

export interface AIPresetBrief {
  title: string;
  classification: string;
  content: string;
}

export interface TelemetryLogEntry {
  timestamp: string;
  source: string;
  message: string;
  type: "info" | "alert" | "success" | "danger";
}

// ----------------------------------------------------
// 1. Unified FIR Evidence Database
// ----------------------------------------------------
export const firDatabase: FIRCase[] = [
  {
    id: "FIR/2026/BLR/104",
    title: "Coordinated Cyber Ransomware & ATM Cash-Out Syndicate",
    district: "Bengaluru Urban",
    datetime: "2026-05-24 08:14",
    severity: "severe",
    category: "Cyber & Financial",
    summary: "A sophisticated cyber-physical operation executing ransomware lockdown on Karnataka State Financial Corp mainframes, simultaneously coordinating cash withdrawals of 4.2 Crores INR through 18 local ATMs across Bengaluru within a 45-minute window using cloned debit structures.",
    modusOperandi: "Spear-phishing + Synchronized ATM cash mules",
    sha256Hash: "d16c7a92fb08a34b22c8e9f1a0e9d9ef504d6a8f89e24b31a29ff0182bc8e92f",
    forensicMetadata: {
      ingestTerminal: "ISD-BLR-CYB-TERM-02",
      ocrConfidence: "99.4%",
      entityMatchWeight: "92.1%",
      validationStatus: "VERIFIED // ENCRYPTED"
    },
    chainOfCustody: [
      { timestamp: "2026-05-24 08:30", action: "Sealed digital packet received from ISD Cyber Dispatch", operator: "Sub-Inspector M. Gowda", hash: "d16c7a92..." },
      { timestamp: "2026-05-24 08:45", action: "Metadata validation & SHA-256 verification complete", operator: "Forensic Analyst S. Patil", hash: "504d6a8f..." },
      { timestamp: "2026-05-24 09:12", action: "Case transferred to ISD Command vault for AI cross-correlation", operator: "DSP R. K. Shastry", hash: "bc8e92f..." }
    ],
    legalSections: [
      { code: "BNS Section 308", title: "Extortion", desc: "Extortion by putting person in fear of injury." },
      { code: "BNS Section 111", title: "Organized Crime", desc: "Executing coordinated syndication threats." },
      { code: "IT Act Sec 66C", title: "Identity Theft", desc: "Fraudulent use of password structures." }
    ],
    suspects: [
      { id: "sus-01", name: "Vikram 'Ghost' Hegde", age: 34, role: "Cyber Coordinator / Infiltration", record: "Wanted in Mangaluru (2025 cyber infiltration case)", confidence: "96%", photo: "VH", watchlistStatus: "CRITICAL", aliases: "Ghost, V-Net", associates: "Gurudev Patil, Ramesh Gowda" },
      { id: "sus-02", name: "Ramesh 'Kolar' Gowda", age: 41, role: "Field Logistics / ATM Coordinator", record: "2 previous arrests for financial card cloning", confidence: "91%", photo: "RG", watchlistStatus: "SURVEILLANCE", aliases: "Kolar Ramesh", associates: "Vikram Hegde" },
      { id: "sus-03", name: "Priyanka Shenoy", age: 28, role: "Account Broker / Ledger Laundering", record: "Under surveillance for shell company transfers", confidence: "88%", photo: "PS", watchlistStatus: "FLAGGED", aliases: "Priya S.", associates: "Vikram Hegde" }
    ],
    timeline: [
      { time: "08:14", desc: "Administrator terminal executed suspicious invoice attachment downloaded via spoofed department address.", severe: false },
      { time: "08:42", desc: "Mainframes encrypted. Ransom demand of 40 XMR ($120K) displayed on internal displays.", severe: true },
      { time: "09:00", desc: "ATM cash withdrawals initiated in Koramangala, Indiranagar, and HSR Layout nodes simultaneously.", severe: false },
      { time: "09:30", desc: "Total 4.2 Crores dispersed. Cellular tower logs identify Vikram Hegde's active burner in Whitefield sector.", severe: true }
    ],
    confidenceScore: 94
  },
  {
    id: "FIR/2026/MYS/089",
    title: "Ancient Artifact Smuggling & Heritage Forgery Ring",
    district: "Mysuru",
    datetime: "2026-05-23 23:45",
    severity: "high",
    category: "Organized Smuggling",
    summary: "Infiltration of temple warehouses in Mysuru rural, replacing 14th-century Hoysala dynasty bronze statues with high-fidelity resin replicas, and organizing illicit shipment routes through Mangaluru Port.",
    modusOperandi: "Heritage forgery and domestic maritime smuggling",
    sha256Hash: "f3c2b8e90a12b34a56c78d9012f34e567890a12b34c56d78a901e234f56789c0",
    forensicMetadata: {
      ingestTerminal: "ISD-MYS-TERM-01",
      ocrConfidence: "98.2%",
      entityMatchWeight: "89.4%",
      validationStatus: "VERIFIED // ENCRYPTED"
    },
    chainOfCustody: [
      { timestamp: "2026-05-23 23:55", action: "Sealed visual exhibits ingested via forensic field scanner", operator: "Sub-Inspector K. Patil", hash: "f3c2b8e..." }
    ],
    legalSections: [
      { code: "BNS Section 303", title: "Theft", desc: "Dishonestly taking moveable property out of possession." },
      { code: "BNS Section 318", title: "Cheating", desc: "Cheating by pretending and replacing genuine articles." },
      { code: "Antiquities Act 1972", title: "Illegal Export", desc: "Unauthorized export of historical antiquities." }
    ],
    suspects: [
      { id: "sus-04", name: "Gurudev 'Dada' Patil", age: 49, role: "Syndicate Kingpin / Exporter", record: "3 prior convictions under Antiquities Export Act", confidence: "94%", photo: "GP", watchlistStatus: "CRITICAL", aliases: "Dada Patil, G-King", associates: "Vikram Hegde, Ramesh Gowda" },
      { id: "sus-05", name: "Naveen Prasad", age: 37, role: "Artisan / Resin Replica Fabricator", record: "No previous criminal record; skilled sculptor", confidence: "85%", photo: "NP", watchlistStatus: "FLAGGED", aliases: "Navi", associates: "Gurudev Patil" }
    ],
    timeline: [
      { time: "23:45", desc: "Security guard at Chennakeshava shrine drugged with sedated water supply.", severe: false },
      { time: "01:30", desc: "Bronze statues loaded onto modified transport carriage with forged local transit passes.", severe: false },
      { time: "04:15", desc: "Fake replicas mounted on temple pedestal. Alarms bypassed via electrical ground shorting.", severe: true },
      { time: "07:30", desc: "Morning priest detects subtle weight and texture variance in primary idol during ritual preparation.", severe: false }
    ],
    confidenceScore: 89
  },
  {
    id: "FIR/2026/HUB/078",
    title: "Petroleum Transit Hijacking & Adulteration Depot",
    district: "Hubballi-Dharwad",
    datetime: "2026-05-21 02:30",
    severity: "moderate",
    category: "Transit Theft",
    summary: "Diversion of state-allocated fuel tankers traveling on NH48 corridor into an isolated industrial godown in Dharwad, extracting 8,000 liters per truck, and replacing the volume with low-grade chemical solvents.",
    modusOperandi: "GPS jamming and industrial supply chain adulteration",
    sha256Hash: "a4b5c6d7e8f901a2b3c4d5e6f7a8b9c012345678901234567890abcdef123456",
    forensicMetadata: {
      ingestTerminal: "ISD-HUB-TERM-04",
      ocrConfidence: "97.1%",
      entityMatchWeight: "84.8%",
      validationStatus: "VERIFIED // ENCRYPTED"
    },
    chainOfCustody: [
      { timestamp: "2026-05-21 03:00", action: "GPS tracking anomaly auto-reported by transit monitor", operator: "HQ System Watchdog", hash: "a4b5c6d..." }
    ],
    legalSections: [
      { code: "BNS Section 303", title: "Theft", desc: "Theft in transit carriage." },
      { code: "Essential Commodities", title: "Adulteration", desc: "Hoarding or adulterating essential petroleum goods." }
    ],
    suspects: [
      { id: "sus-04", name: "Gurudev 'Dada' Patil", age: 49, role: "Financial Sponsor / Storage Owner", record: "Known operator of illegal blending stations", confidence: "78%", photo: "GP", watchlistStatus: "CRITICAL", aliases: "Dada Patil", associates: "Suresh Pujari" },
      { id: "sus-06", name: "Suresh Pujari", age: 43, role: "Tanker Logistics Dispatcher", record: "Involved in previous fuel siphoning allegations", confidence: "92%", photo: "SP", watchlistStatus: "SURVEILLANCE", aliases: "Pujari Suresh", associates: "Gurudev Patil" }
    ],
    timeline: [
      { time: "01:10", desc: "Tankers exit Mangaluru refinery gate heading toward North Karnataka depots.", severe: false },
      { time: "02:30", desc: "Tanker tracking GPS signals blacked out simultaneously using vehicle jams.", severe: true },
      { time: "03:15", desc: "Convoy diverted into an unauthorized logistics yard in Dharwad suburbs.", severe: false },
      { time: "05:00", desc: "GPS tracking reactivated at a decoy highway stop; tankers arrived with altered seals.", severe: true }
    ],
    confidenceScore: 85
  }
];

// ----------------------------------------------------
// 2. Geospatial District Telemetry Database
// ----------------------------------------------------
export const districtDatabase: Record<string, DistrictTelemetry> = {
  "BLR_U": {
    name: "BENGALURU URBAN",
    level: "CRITICAL",
    density: "9.4/10",
    firs: "1,482",
    dominant: "Cyber & Financial Frauds",
    patrol: "96% active coverage",
    squads: "18 Special Intelligence Units",
    advisory: "Organized digital phishing targeting corporate servers is projected high over coming 48 hours.",
    pulsatingHotspot: true,
    patrolCoordinates: "12.9716° N, 77.5946° E"
  },
  "MYS": {
    name: "MYSURU",
    level: "HIGH",
    density: "6.8/10",
    firs: "542",
    dominant: "Heritage Smuggling & Land Disputes",
    patrol: "88% active coverage",
    squads: "6 Regional Crime Units",
    advisory: "Increased surveillance ordered at border exit checkpoints near Chamrajnagar corridors.",
    pulsatingHotspot: true,
    geofenceAlert: "ALERT: Repeat offender device detected near Mysuru transport corridor.",
    patrolCoordinates: "12.2958° N, 76.6394° E"
  },
  "HUB_D": {
    name: "HUBBALLI-DHARWAD",
    level: "MODERATE",
    density: "5.1/10",
    firs: "394",
    dominant: "Transit & Highway Theft",
    patrol: "82% active coverage",
    squads: "4 Highway Patrol Divisions",
    advisory: "GPS tracking audit mandated for all chemical cargo transiting NH48 during night shifts.",
    pulsatingHotspot: false,
    patrolCoordinates: "15.3647° N, 75.1240° E"
  },
  "MNG": {
    name: "MANGALURU (DK)",
    level: "HIGH",
    density: "7.2/10",
    firs: "612",
    dominant: "Port Border Smuggling & Extremism",
    patrol: "91% active coverage",
    squads: "8 Coastal Policing Units",
    advisory: "Enhanced biometric logs screening implemented at cargo terminal entry gates.",
    pulsatingHotspot: true,
    patrolCoordinates: "12.9141° N, 74.8560° E"
  },
  "BEL": {
    name: "BELAGAVI",
    level: "MODERATE",
    density: "4.8/10",
    firs: "284",
    dominant: "Interstate Transit Scams",
    patrol: "78% active coverage",
    squads: "3 Border Checkpoint Teams",
    advisory: "Standard border monitoring protocols active. No major network alerts.",
    pulsatingHotspot: false,
    patrolCoordinates: "15.8497° N, 74.4977° E"
  },
  "KAL": {
    name: "KALABURAGI",
    level: "MODERATE",
    density: "5.3/10",
    firs: "318",
    dominant: "Agricultural Supply Swindles",
    patrol: "75% active coverage",
    squads: "4 Rural Action squads",
    advisory: "Monsoon subsidy disbursement tracking active to prevent cyber-spoofed farmer loans.",
    pulsatingHotspot: false,
    patrolCoordinates: "17.3297° N, 76.8343° E"
  }
};

// ----------------------------------------------------
// 3. Suspect Dossiers Database
// ----------------------------------------------------
export const suspectDossiers: Record<string, SuspectDossier> = {
  "sus-01": {
    name: "Vikram 'Ghost' Hegde",
    age: 34,
    tier: "TIER 1 TARGET",
    status: "ACTIVE WARRANT",
    modusOperandi: "External Network Intrusion & Cryptographic Escrows",
    location: "Last registered near Whitefield, Bengaluru",
    firs: "FIR/2026/BLR/104, FIR/2025/MNG/301",
    contacts: "99450***12 (Burner), encrypted matrix node @ghost:isd",
    vehicles: "KA-03-MM-8924 (SUV - Linked)",
    accounts: "SBI Savings ending 2041 (Primary Mule account)",
    notes: "Extremely tech-literate. Uses high-grade VPN setups. Coordinates with local transport rings for physical cash collection.",
    aliases: "Ghost, V-Net, NetSpook",
    knownAssociates: "Gurudev 'Dada' Patil, Ramesh Gowda",
    financialAnomaly: "Incoming escrow of 4.2 Crores from Monero digital mixer; split ATM withdrawals across 18 ORR nodes.",
    watchlistStatus: "CRITICAL"
  },
  "sus-02": {
    name: "Ramesh 'Kolar' Gowda",
    age: 41,
    tier: "TIER 2 OPERATOR",
    status: "UNDER ACTIVE SURVEILLANCE",
    modusOperandi: "Physical Cash Mule Networks & Fuel Logistics",
    location: "Resident of Kolar; currently operating in Bengaluru Outer Ring",
    firs: "FIR/2026/BLR/104",
    contacts: "98860***49",
    vehicles: "KA-03-MM-8924 (SUV - Registered Owner)",
    accounts: "Canara Bank ending 8912",
    notes: "Maintains link between cyber-operators and physical withdrawal agents. Known associate of Gurudev Patil.",
    aliases: "Kolar Ramesh, M-Mule",
    knownAssociates: "Vikram Hegde, Gurudev Patil",
    financialAnomaly: "Synchronized cash-out logging 24 withdrawals within 15 minutes at Outer Ring Road ATM terminals.",
    watchlistStatus: "SURVEILLANCE"
  },
  "sus-03": {
    name: "Priyanka Shenoy",
    age: 28,
    tier: "TIER 2 OPERATOR",
    status: "INTERROGATED / ON BAIL",
    modusOperandi: "Shell Accounts Registration & Escrow Brokering",
    location: "Malleshwaram, Bengaluru",
    firs: "FIR/2026/BLR/104",
    contacts: "94480***88",
    vehicles: "KA-01-AB-1022 (Sedan)",
    accounts: "SBI Corporate ending 9015 (Shell entity registered as 'Pinnacle Trades')",
    notes: "Coordinates shell business accounts to funnel siphoned funds. Operates digital gateways.",
    aliases: "Priya S., LedgerQueen",
    knownAssociates: "Vikram Hegde",
    financialAnomaly: "Registered 'Pinnacle Trades' corporate entity 6 days prior to KPTCL server intrusion, acting as primary escrow broker.",
    watchlistStatus: "FLAGGED"
  },
  "sus-04": {
    name: "Gurudev 'Dada' Patil",
    age: 49,
    tier: "TIER 1 SYNDICATE LEADER",
    status: "ACTIVE WARRANTS (MULTIPLE)",
    modusOperandi: "Organized Interstate Smuggling & Commercial Hijacks",
    location: "Mobile across Karnataka-Maharashtra borders",
    firs: "FIR/2026/MYS/089, FIR/2026/HUB/078, FIR/2024/BEL/502",
    contacts: "90080***01 (Satellite link)",
    vehicles: "Multiple transport trucks, white Toyota Fortuner (unregistered)",
    accounts: "Cooperative bank entities linked to Hubballi agricultural trading",
    notes: "Highly influential ring leader. Funds antiquities theft and highway fuel siphoning. Employs security bypass experts.",
    aliases: "Dada Patil, G-King, The Baron",
    knownAssociates: "Vikram Hegde, Ramesh Gowda, Suresh Pujari",
    financialAnomaly: "Cash deposits of 78 Lakhs into rural co-op banking structures within 24 hours of Hoysala bronze statuary replacement.",
    watchlistStatus: "CRITICAL"
  },
  "sus-05": {
    name: "Naveen Prasad",
    age: 37,
    tier: "TIER 3 ASSOCIATE",
    status: "COOPERATING WITH ISD",
    modusOperandi: "Chemical Resins & Material Sculpting Forgery",
    location: "Mysuru Industrial Layout",
    firs: "FIR/2026/MYS/089",
    contacts: "94801***23",
    vehicles: "KA-09-H-4560 (Mini-truck)",
    accounts: "Syndicate Bank ending 1104",
    notes: "No criminal records prior. Provided the chemical composition knowledge for duplicating structural icons.",
    aliases: "Navi, The Sculptor",
    knownAssociates: "Gurudev Patil",
    financialAnomaly: "Received 12 Lakhs wire transfer from rural agricultural ledger for 'restoration consultancy'.",
    watchlistStatus: "FLAGGED"
  },
  "sus-06": {
    name: "Suresh Pujari",
    age: 43,
    tier: "TIER 2 OPERATOR",
    status: "DETAINED",
    modusOperandi: "Commercial Tanker Rerouting & Seals Tampering",
    location: "Dharwad Logistics Hub",
    firs: "FIR/2026/HUB/078",
    contacts: "96112***67",
    vehicles: "Various logistics tankers",
    accounts: "Karnataka Bank ending 3302",
    notes: "Corrupted dispatcher inside supply company. Provided internal GPS tracking schedules to Gurudev Patil's network.",
    aliases: "Pujari Suresh, ValveOperator",
    knownAssociates: "Gurudev Patil",
    financialAnomaly: "Correlated text transmissions mapping GPS blackout timestamps to mobile device coordinate updates.",
    watchlistStatus: "SURVEILLANCE"
  }
};

// ----------------------------------------------------
// 4. AI Copilot Workstation Presets
// ----------------------------------------------------
export const aiReportDatabase: Record<string, AIPresetBrief> = {
  "preset-1": {
    title: "EXEC QUERY: ORG_FINANCIAL_FLOW (SUSPECT: vikram_hegde)",
    classification: "SECRET // CONFIDENTIAL // INTERNAL SECURITY DIVISION",
    content: `<h4>1. Ground Audit Telemetry Summary</h4>
<p>Executed deep relational ledger tracking matching Target Vikram Hegde (alias 'Ghost') across commercial bank clearing nodes, following ransom transfers logged during FIR/2026/BLR/104.</p>
<h4>2. Ledger Audit Results</h4>
<p>Ransom flow originated from Monero (XMR) deposit addresses, routed through offshore peer-to-peer exchanges. The broker channels converted digital currency to domestic fiat inside 12 minutes, dispersing funds directly to:</p>
<table class="intel-table" style="margin: 10px 0; font-family:var(--font-mono); font-size:11px; width:100%; border-collapse:collapse;">
  <thead>
    <tr style="background:#f1f5f9; text-align:left;">
      <th style="padding:6px; border-bottom:1px solid #cbd5e1;">Launder Node</th>
      <th style="padding:6px; border-bottom:1px solid #cbd5e1;">Bank Entity</th>
      <th style="padding:6px; border-bottom:1px solid #cbd5e1;">Flow Weight</th>
      <th style="padding:6px; border-bottom:1px solid #cbd5e1;">Signatory / Owner</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">Acct #***2041</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">SBI Corporate</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">2.1 Crores</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">Pinnacle Trades (Priyanka Shenoy)</td>
    </tr>
    <tr>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">ATM Dispense Nodes</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">Canara Bank / SBI</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">1.8 Crores</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">Coordinated Mule cells (Ramesh Gowda)</td>
    </tr>
  </tbody>
</table>
<div class="report-citation-box" style="font-family:var(--font-mono); font-size:11px; border-left:3px solid #1e3a8a; padding-left:8px; margin:8px 0; background:#f8fafc;">
  <strong>Source Citation:</strong> Transaction logs extracted under secure warrants from SBI Outer Ring Road Branch (Ref: ISD-W-2026-092) and unified digital gateway records.
</div>
<h4>3. Actionable Directives</h4>
<ul class="report-bullet-list">
  <li>Issue an immediate freeze order to SBI Central Branch for Account #***2041 under Section 102 of Bharatiya Nagarik Suraksha Sanhita (BNSS).</li>
  <li>Transmit threat profile to Kempegowda International Airport and Cochin Port Border security databases to prevent target flight.</li>
  <li>Deploy immediate surveillance on Ramesh Gowda's primary communication channel: Cell Node tower tracking near Kolar limits.</li>
</ul>`
  },
  "preset-2": {
    title: "EXEC QUERY: MATCH_MODUS_OPERANDI (CASE: FIR/2026/BLR/104)",
    classification: "CONFIDENTIAL // LAW ENFORCEMENT INTERNAL ONLY",
    content: `<h4>1. Modus Operandi Matching System</h4>
<p>Cross-referencing the technical and physical operational signatures of <strong>FIR/2026/BLR/104</strong> against historical police registries inside the Karnataka State Crime Records Bureau (KSCERB).</p>
<h4>2. Technical and Operational Identifiers</h4>
<p>The attackers used a highly specific tactical combination: <strong>Spear-phishing + ATM Cash-Out</strong>. The malware strain identifies as a variant of 'LockBit-ISD', modified to bypass domestic government proxy firewalls. The physical cashout was conducted within a narrow 45-minute window, indicating local dispatch cells.</p>
<h4>3. Historical Match Database</h4>
<table class="intel-table" style="margin: 14px 0; width:100%; border-collapse:collapse;">
  <thead>
    <tr style="background:#f1f5f9; text-align:left;">
      <th style="padding:6px; border-bottom:1px solid #cbd5e1;">Case Ref</th>
      <th style="padding:6px; border-bottom:1px solid #cbd5e1;">Location</th>
      <th style="padding:6px; border-bottom:1px solid #cbd5e1;">Date</th>
      <th style="padding:6px; border-bottom:1px solid #cbd5e1;">Correlation %</th>
      <th style="padding:6px; border-bottom:1px solid #cbd5e1;">Identified Suspects</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">FIR/2025/MNG/301</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">Mangaluru Port</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">2025-08-11</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">94% (High)</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">Vikram Hegde</td>
    </tr>
    <tr>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">FIR/2024/MYS/441</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">Mysuru Urban</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">2024-12-04</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">81% (Med)</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">Gurudev Patil, Ramesh Gowda</td>
    </tr>
  </tbody>
</table>
<div class="report-citation-box" style="font-family:var(--font-mono); font-size:11px; border-left:3px solid #1e3a8a; padding-left:8px; margin:8px 0; background:#f8fafc;">
  <strong>Pattern Match Advisory:</strong> The dual participation of Hegde (technical deployment) and Gowda (logistical cashout) perfectly mirrors the 2025 Mangaluru Port custom server breach.
</div>`
  },
  "preset-3": {
    title: "EXEC QUERY: COMPILE_CHARGESHEET (BNS_CODES: FIR/104)",
    classification: "OFFICIAL REVIEW USE ONLY // SECURE COURT FORMAT",
    content: `<h4>1. Preliminary Case Briefing</h4>
<p>Drafting formal charge sheet structure for <strong>FIR/2026/BLR/104</strong> mapped against the modern <strong>Bharatiya Nyaya Sanhita (BNS)</strong> codifications which replaced the IPC.</p>
<h4>2. Legal Codification Mapping</h4>
<table class="intel-table" style="margin: 14px 0; width:100%; border-collapse:collapse;">
  <thead>
    <tr style="background:#f1f5f9; text-align:left;">
      <th style="padding:6px; border-bottom:1px solid #cbd5e1;">Accused Party</th>
      <th style="padding:6px; border-bottom:1px solid #cbd5e1;">Act / Description</th>
      <th style="padding:6px; border-bottom:1px solid #cbd5e1;">BNS Section</th>
      <th style="padding:6px; border-bottom:1px solid #cbd5e1;">IPC Equivalent</th>
      <th style="padding:6px; border-bottom:1px solid #cbd5e1;">Sentence</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">Vikram Hegde</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">Cyber Ransom & Extortion</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">BNS Section 308 (5)</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">IPC Section 384</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">Up to 7 Years Rigorous</td>
    </tr>
    <tr>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">Ramesh Gowda</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">Organized Action</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">BNS Section 111</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">Special Act KCOCA</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">Life Imprisonment</td>
    </tr>
    <tr>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">Priyanka Shenoy</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">Forgery & Abetment</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">BNS Section 318</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">IPC Section 420</td>
      <td style="padding:6px; border-bottom:1px solid #e2e8f0;">Up to 7 Years / Fine</td>
    </tr>
  </tbody>
</table>
<div class="report-citation-box" style="font-family:var(--font-mono); font-size:11px; border-left:3px solid #1e3a8a; padding-left:8px; margin:8px 0; background:#f8fafc;">
  <strong>Prosecution Strategy Note:</strong> BNS Section 111 provides the Internal Security Division with strong leverage to try this syndicate under organized crime parameters due to cross-district financial coordinating loops.
</div>
<h4>3. Recommended Exhibits for Charge Sheet</h4>
<ul class="report-bullet-list">
  <li>Exhibits A-C: Server intrusion reports verified by CERT-In forensic officers.</li>
  <li>Exhibits D-G: ATM CCTV capture footage mapping Ramesh Gowda's vehicle license KA-03-MM-8924.</li>
  <li>Exhibit H: Confessional statement of Priyanka Shenoy's bank registration.</li>
</ul>`
  }
};
export const initialTelemetryLogs: TelemetryLogEntry[] = [
  { timestamp: "22:11:04", source: "CYB-CELL-02", message: "CYBER CELL NODE BLR-CYB-02 REQUESTED FINANCIAL TRACE", type: "info" },
  { timestamp: "22:11:17", source: "DISPATCH-HQ", message: "THREAT INDEX — BENGALURU URBAN ↑ 2.1%", type: "alert" },
  { timestamp: "22:11:31", source: "BORDER-CTRL", message: "INTERSTATE TRAFFICKING WATCH ACTIVATED", type: "success" }
];

export const initialOfficerLogs = [
  { time: "22:14", message: "INSPECTOR R KUMAR ACCESSED NODE-41" },
  { time: "22:17", message: "MANGALURU CYBER UNIT FLAGGED NEW DEVICE CLUSTER" },
  { time: "22:19", message: "FIR-108/2026 ESCALATED TO ORGANIZED CRIME CELL" }
];

