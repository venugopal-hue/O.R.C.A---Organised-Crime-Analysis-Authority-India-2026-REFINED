"use strict";
/**
 * Seed Tasks + Evidence (+ EvidenceCustody) into Catalyst.
 * Usage:
 *   node scripts/seed-tasks-evidence.cjs          -- dry preview
 *   node scripts/seed-tasks-evidence.cjs --run    -- insert
 *   node scripts/seed-tasks-evidence.cjs --purge  -- delete existing rows first, then insert
 */
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const ROOT = path.join(__dirname, "..");
const { createJiti } = require(path.join(ROOT, "node_modules/jiti"));
const jiti = createJiti(__filename, { alias: { "@": path.join(ROOT, "src") }, interopDefault: true });

const envLines = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n");
for (const l of envLines) { const t = l.trim(); if (!t || t.startsWith("#")) continue; const eq = t.indexOf("="); if (eq < 0) continue; const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, ""); if (!process.env[k]) process.env[k] = v; }

const RUN   = process.argv.includes("--run") || process.argv.includes("--purge");
const PURGE = process.argv.includes("--purge");

// ── helpers ──────────────────────────────────────────────────────────────────
const pad = (n, w) => String(n).padStart(w, "0");

function fmtDatetime(d) {
  // Catalyst datetime: "YYYY-MM-DD HH:MM:SS"
  const p = (n) => String(n).padStart(2,"0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function randDate(from, to) {
  return new Date(from + Math.random() * (to - from));
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN(arr, n) {
  const copy = [...arr]; const out = [];
  for (let i = 0; i < Math.min(n, copy.length); i++) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

// ── date range ────────────────────────────────────────────────────────────────
const START = new Date("2026-02-01T00:00:00+05:30").getTime();
const END   = new Date("2026-08-26T23:59:59+05:30").getTime();
const NOW   = new Date("2026-08-27T09:00:00+05:30");

// ── reference data ────────────────────────────────────────────────────────────
// Employees from DB (police officers, not ORCA internal)
const POLICE_EMP_IDS = [6,7,8,9,10,11,12,13,14,15]; // KA- KGID accounts
const ALL_EMP_IDS    = [1,2,3,4,6,7,8,9,10,11,12,13,14,15];
const ORCA_EMP_IDS   = [1,2,3,4]; // ORCA-00x, these assign tasks
const FIELD_EMP_IDS  = [6,7,8,9,10,11,12,13,14,15];

// Evidence type IDs and their names (from DB)
const EVD_TYPES = [
  { id: 1, name: "Physical Article" },
  { id: 2, name: "Document" },
  { id: 3, name: "Digital / Electronic" },
  { id: 4, name: "Biological / Forensic Sample" },
  { id: 5, name: "Weapon" },
  { id: 6, name: "Narcotic Substance" },
  { id: 7, name: "Vehicle" },
  { id: 8, name: "Currency / Valuables" },
  { id: 9, name: "Photograph / Video" },
  { id: 10, name: "Other" },
];

// Custody event types (from DB)
const CUSTODY_EVT = {
  COLLECTED: 1,
  MALKHANA:  2,
  TRANSFER:  3,
  FSL:       4,
  FSL_RET:   5,
  COURT:     6,
  COURT_RET: 7,
  RELEASED:  8,
  DISPOSED:  9,
};

// Evidence status IDs matching custody state
const EVD_STATUS = {
  COLLECTED: 1, MALKHANA: 2, FSL: 3, FSL_RET: 4,
  COURT: 5, COURT_RET: 6, RELEASED: 7, DISPOSED: 8,
};

// ── task description templates per type ──────────────────────────────────────
const TASK_TEMPLATES = {
  "Investigation": [
    { title: "Initial scene investigation", desc: "Conduct thorough investigation of the crime scene, collect preliminary statements, and document physical evidence. Submit situation report within 48 hours.", outcome: "Scene investigation report with evidence inventory and witness list." },
    { title: "Follow-up investigation – witness statements", desc: "Re-interview key witnesses identified in the FIR. Verify alibis and corroborate material facts. Record statements under Sec. 161 CrPC.", outcome: "Recorded statements from all primary witnesses." },
    { title: "Accused background verification", desc: "Verify antecedents of accused through district records, tenant verification register, and prior arrest history. Coordinate with local PS if accused belongs to another jurisdiction.", outcome: "Antecedent report with prior crime history if any." },
  ],
  "Evidence Collection": [
    { title: "Collect and seal physical evidence", desc: "Collect all physical articles from the scene. Seal, label, and photograph each article. Prepare mahazar with two independent witnesses.", outcome: "Sealed evidence articles with mahazar, deposited in station malkhana." },
    { title: "Seize electronic devices", desc: "Identify and seize mobile phones, laptops, and storage media belonging to accused. Maintain chain of custody documentation.", outcome: "Sealed electronic items with seizure memo." },
    { title: "CCTV footage collection", desc: "Identify CCTV cameras in the vicinity. Collect footage from the 6-hour window around the incident. Approach camera owners with proper authority letter.", outcome: "CCTV footage secured and preserved on sealed media." },
  ],
  "Evidence Review": [
    { title: "Review collected evidence before court production", desc: "Audit all sealed evidence items against the malkhana register. Confirm seals are intact. Prepare court production order.", outcome: "Evidence audit report and production order submitted to IO." },
    { title: "FSL report analysis", desc: "Review the FSL examination report received. Identify corroborating findings. Flag discrepancies for further investigation.", outcome: "Analysis note appended to case file." },
  ],
  "Forensic Follow-up": [
    { title: "Escort evidence to FSL Bangalore", desc: "Prepare transfer memo and escort sealed evidence items to Regional FSL, Madiwala. Obtain acknowledgement receipt.", outcome: "Evidence deposited at FSL with receipt." },
    { title: "Follow up on pending FSL report", desc: "Contact FSL Examination Division for status of pending examination. If delayed beyond 30 days, escalate through proper channel.", outcome: "Updated status from FSL on record." },
    { title: "Finger-print evidence follow-up", desc: "Submit lifted fingerprints to RFSL for comparison against State AFIS database. Collect and file comparison report.", outcome: "Fingerprint comparison report on record." },
  ],
  "Witness Follow-up": [
    { title: "Locate absconding witness", desc: "Conduct field enquiry to trace the whereabouts of the witness who failed to appear. Serve notice under Sec. 160 CrPC if located.", outcome: "Witness traced and statement recorded, or location report filed." },
    { title: "Witness protection assessment", desc: "Assess threats faced by key witnesses. Recommend protective measures if required. File assessment note with SP office.", outcome: "Witness protection assessment submitted." },
  ],
  "Accused Verification": [
    { title: "Verify identity of accused", desc: "Verify address and identity documents of arrested accused. Conduct neighbourhood enquiry and collect corroborating documents.", outcome: "Identity verification report with documents annexed." },
    { title: "Accused employment verification", desc: "Verify employment details furnished by accused during interrogation. Contact employer if required.", outcome: "Employment verification note annexed to case diary." },
  ],
  "Arrest / Surrender Follow-up": [
    { title: "Execute NBW against absconding accused", desc: "Locate absconding accused against whom Non-Bailable Warrant is issued. Effect arrest and produce before court within 24 hours.", outcome: "Accused arrested and produced, or warrant return filed." },
    { title: "Surrender hearing coordination", desc: "Coordinate with accused's counsel for voluntary surrender. Arrange court production on surrender date.", outcome: "Accused produced before Magistrate." },
  ],
  "Court Preparation": [
    { title: "Prepare witness list for court", desc: "Prepare final list of witnesses for prosecution. Serve summons through court process. Ensure all witnesses are prepared and briefed.", outcome: "Witness list filed with court; all summons served." },
    { title: "Compile court docket", desc: "Compile all documents for court production: FIR copy, mahazar, FSL report, medical certificate, charge sheet. Submit docket to IO.", outcome: "Complete court docket ready for filing." },
  ],
  "Chargesheet Preparation": [
    { title: "Draft chargesheet – review IO submission", desc: "Review the charge sheet prepared by the IO for completeness. Verify all sections applied are supported by evidence. Return with remarks for revision if required.", outcome: "Chargesheet reviewed, signed, and submitted to court within statutory deadline." },
  ],
  "Report Preparation": [
    { title: "Prepare monthly crime statistics report", desc: "Compile crime statistics for the station for the reporting month. Fill prescribed proforma and submit to District Crime Records Branch.", outcome: "Monthly report submitted to DCRB." },
    { title: "Prepare unit situation report", desc: "Compile pending cases, recent arrests, bail-outs, and escalations for the weekly situation report.", outcome: "SITREP submitted to Circle ACP." },
  ],
  "Field Verification": [
    { title: "Property verification – stolen vehicle check", desc: "Verify if recovered vehicle is reported stolen. Cross-check chassis and engine number against VAHAN database and SCRB stolen vehicle register.", outcome: "Verification report with SCRB confirmation." },
    { title: "Address verification – bail condition", desc: "Verify residence address declared by accused as bail condition. Submit verification report to court within stipulated time.", outcome: "Address verification report filed with court." },
    { title: "Spot enquiry – complaint verification", desc: "Visit the location mentioned in the complaint. Record spot observations and take photographs. Prepare spot enquiry report.", outcome: "Spot enquiry report submitted to IO." },
  ],
  "Administrative Work": [
    { title: "Update case diary entries", desc: "Compile and update Case Diary entries for all open cases. Ensure each operational day's proceedings are recorded. Submit for IO review.", outcome: "Case diary up to date and submitted." },
    { title: "Station diary reconciliation", desc: "Reconcile station diary entries with FIR register and arrest register for the month. Flag discrepancies.", outcome: "Reconciliation report submitted to SHO." },
  ],
};

// Evidence description templates per crime type
const EVD_BY_CRIME = {
  "Theft": [
    { typeId:1, desc:"Stolen articles recovered from accused – includes mobile phone and cash", seal:"PD/SEAL/2026/", qty:"1 bundle" },
    { typeId:8, desc:"Currency notes recovered from possession of accused at time of arrest", seal:"PD/SEAL/2026/", qty:"1 envelope" },
    { typeId:2, desc:"Pawn shop receipt found in possession of accused for articles matching complaint", seal:"PD/SEAL/2026/", qty:"1 document" },
    { typeId:9, desc:"CCTV footage showing accused at scene – extracted on pendrive, sealed", seal:"PD/SEAL/2026/", qty:"1 pendrive" },
  ],
  "Vehicle Theft": [
    { typeId:7, desc:"Stolen two-wheeler recovered from accused – engine number and chassis number verified", seal:"VHCL/SEAL/2026/", qty:"1 vehicle" },
    { typeId:2, desc:"Suspected forged vehicle ownership documents recovered from accused", seal:"PD/SEAL/2026/", qty:"3 documents" },
    { typeId:3, desc:"Mobile phone recovered from accused – used to sell stolen vehicle online", seal:"PD/SEAL/2026/", qty:"1 mobile phone" },
  ],
  "House-Breaking & Theft": [
    { typeId:5, desc:"Iron cutter and drill recovered – used to break into complainant's house", seal:"PD/SEAL/2026/", qty:"2 articles" },
    { typeId:1, desc:"Stolen articles including gold ornaments and cash recovered", seal:"PD/SEAL/2026/", qty:"1 bundle" },
    { typeId:4, desc:"Fingerprints lifted from point of entry – latent prints on window grille", seal:"FRNS/SEAL/2026/", qty:"2 lifted prints" },
    { typeId:9, desc:"CCTV footage from adjacent shop showing accused at scene", seal:"PD/SEAL/2026/", qty:"1 pendrive" },
  ],
  "Robbery": [
    { typeId:5, desc:"Country-made weapon used during robbery, recovered from accused", seal:"PD/SEAL/2026/", qty:"1 article" },
    { typeId:8, desc:"Stolen mobile phone and wallet recovered from accused", seal:"PD/SEAL/2026/", qty:"1 envelope" },
    { typeId:9, desc:"Video footage from traffic camera showing incident – extracted on sealed media", seal:"PD/SEAL/2026/", qty:"1 pendrive" },
    { typeId:4, desc:"Blood-stained clothing of accused seized for DNA analysis", seal:"BIO/SEAL/2026/", qty:"1 polythene bag" },
  ],
  "Assault": [
    { typeId:5, desc:"Weapon used in assault – iron rod recovered from scene", seal:"PD/SEAL/2026/", qty:"1 article" },
    { typeId:4, desc:"Blood-stained shirt of accused seized for FSL analysis", seal:"BIO/SEAL/2026/", qty:"1 polythene bag" },
    { typeId:2, desc:"Medical certificate of the injured victim issued by Government Hospital", seal:"DOC/SEAL/2026/", qty:"1 document" },
  ],
  "Murder": [
    { typeId:5, desc:"Suspected murder weapon – knife recovered from scene", seal:"WPN/SEAL/2026/", qty:"1 article" },
    { typeId:4, desc:"Blood samples collected from crime scene for FSL analysis", seal:"BIO/SEAL/2026/", qty:"3 swabs" },
    { typeId:4, desc:"Victim's clothing seized for examination", seal:"BIO/SEAL/2026/", qty:"1 bundle" },
    { typeId:9, desc:"Autopsy photographs and FSL report photographs – sealed", seal:"FRNS/SEAL/2026/", qty:"1 sealed envelope" },
  ],
  "Cheating/Fraud": [
    { typeId:2, desc:"Forged documents used by accused in the fraud – sealed", seal:"DOC/SEAL/2026/", qty:"7 documents" },
    { typeId:3, desc:"Laptop and mobile phone seized from accused – contain fraud communications", seal:"ELEC/SEAL/2026/", qty:"2 devices" },
    { typeId:8, desc:"Demand draft and receipts showing fraudulent transactions – seized", seal:"DOC/SEAL/2026/", qty:"1 envelope" },
  ],
  "NDPS": [
    { typeId:6, desc:"Narcotic substance (suspected ganja) recovered from accused – sealed and weighed", seal:"NRC/SEAL/2026/", qty:"2.5 kg" },
    { typeId:2, desc:"Packing material and weighing scale – paraphernalia recovered from accused's premises", seal:"PD/SEAL/2026/", qty:"3 articles" },
    { typeId:8, desc:"Cash recovered from accused – suspected proceeds of drug trade", seal:"PD/SEAL/2026/", qty:"1 envelope" },
  ],
};

// Fallback evidence for other crime types
const EVD_GENERIC = [
  { typeId:2, desc:"Relevant documents and records seized from accused pertaining to the offence", seal:"DOC/SEAL/2026/", qty:"5 documents" },
  { typeId:3, desc:"Mobile phone of accused seized – contains relevant communications", seal:"ELEC/SEAL/2026/", qty:"1 mobile phone" },
  { typeId:9, desc:"Photographs of scene and exhibits – printed and sealed", seal:"PD/SEAL/2026/", qty:"1 envelope" },
];

// Crime type from CrimeNo: we will load cases and derive type from case data
// Bengaluru Urban stations (IDs 1-20)
const STATION_LOCATIONS = {
  1:  { name: "Cubbon Park PS",         lat: 12.9762, lng: 77.5929 },
  2:  { name: "Shivajinagar PS",        lat: 12.9850, lng: 77.6010 },
  3:  { name: "Commercial Street PS",   lat: 12.9844, lng: 77.6078 },
  4:  { name: "Ulsoor PS",              lat: 12.9822, lng: 77.6179 },
  5:  { name: "Halasuru PS",            lat: 12.9806, lng: 77.6237 },
  6:  { name: "Whitefield PS",          lat: 12.9698, lng: 77.7499 },
  7:  { name: "KR Puram PS",            lat: 13.0097, lng: 77.6780 },
  8:  { name: "Marathahalli PS",        lat: 12.9591, lng: 77.7011 },
  9:  { name: "Bellandur PS",           lat: 12.9254, lng: 77.6769 },
  10: { name: "Electronic City PS",     lat: 12.8458, lng: 77.6703 },
  11: { name: "JP Nagar PS",            lat: 12.9063, lng: 77.5877 },
  12: { name: "Jayanagar PS",           lat: 12.9256, lng: 77.5831 },
  13: { name: "Banashankari PS",        lat: 12.9175, lng: 77.5463 },
  14: { name: "Vijayanagar PS",         lat: 12.9719, lng: 77.5368 },
  15: { name: "Rajajinagar PS",         lat: 13.0027, lng: 77.5561 },
  16: { name: "Yeshwanthpur PS",        lat: 13.0258, lng: 77.5358 },
  17: { name: "Hebbal PS",              lat: 13.0459, lng: 77.5953 },
  18: { name: "Yelahanka PS",           lat: 13.1004, lng: 77.5962 },
  19: { name: "Jalahalli PS",           lat: 13.0490, lng: 77.5391 },
  20: { name: "Sadashivanagar PS",      lat: 13.0094, lng: 77.5795 },
};

// ── SHA-256 chain for EvidenceCustody ────────────────────────────────────────
function hashChain(prevHash, row) {
  const canonical = `${row.EvidenceID}|${row.SeqNo}|${row.EventTypeID}|${row.FromEmployeeID ?? ""}|${row.ToEmployeeID ?? ""}|${row.EventAt}|${row.Location}`;
  return crypto.createHash("sha256").update(prevHash + "\n" + canonical).digest("hex");
}

// ── main ──────────────────────────────────────────────────────────────────────
(async () => {
  const { getAllRows, insertRows, deleteRow } = await jiti.import(path.join(ROOT, "src/lib/catalyst.ts"));
  const nextIdMod = await jiti.import(path.join(ROOT, "src/lib/catalyst.ts"));
  const nextId = nextIdMod.nextId || nextIdMod.default?.nextId;

  const unwrap = (r, t) => (r && r[t]) || r || {};

  // ── PURGE ──────────────────────────────────────────────────────────────────
  if (PURGE) {
    console.log("Purging existing Task / TaskAuditLog / Evidence / EvidenceCustody rows...");
    for (const table of ["TaskAuditLog","Task","EvidenceCustody","Evidence"]) {
      const rows = await getAllRows(table);
      let del = 0;
      for (const r of rows) {
        const x = unwrap(r, table);
        if (x.ROWID) { await deleteRow(table, x.ROWID); del++; }
      }
      console.log(`  Deleted ${del} rows from ${table}`);
    }
  }

  // ── Load cases ────────────────────────────────────────────────────────────
  const caseRows = await getAllRows("CaseMaster");
  const cases = caseRows.map(r => {
    const x = unwrap(r, "CaseMaster");
    return { id: Number(x.CaseMasterID), crimeNo: x.CrimeNo, unitId: Number(x.UnitID), crimeType: x.CrimeType || "", status: x.CaseStatus || "", date: x.DateOfOffence || x.CreatedAt || "" };
  }).filter(c => c.id);

  console.log(`Loaded ${cases.length} cases.`);
  if (cases.length === 0) { console.error("No cases found – run seed-demo-data.cjs first"); process.exit(1); }

  // ── Plan Tasks ────────────────────────────────────────────────────────────
  const TASK_TYPES_LIST = Object.keys(TASK_TEMPLATES);

  // Each case gets 1-3 tasks; total ~300-400 tasks
  const taskRows = [];
  const auditRows = [];
  let taskSerial = 0;

  for (const cas of cases) {
    const numTasks = 1 + Math.floor(Math.random() * 3); // 1-3
    const usedTypes = new Set();

    for (let t = 0; t < numTasks; t++) {
      // Pick a task type not already used on this case
      let ttype = pick(TASK_TYPES_LIST);
      let tries = 0;
      while (usedTypes.has(ttype) && tries < 10) { ttype = pick(TASK_TYPES_LIST); tries++; }
      usedTypes.add(ttype);

      const templates = TASK_TEMPLATES[ttype];
      const tmpl = pick(templates);

      taskSerial++;
      const taskNumber = `TASK-2026-${pad(taskSerial, 5)}`;
      const priority = pick(["URGENT","HIGH","NORMAL","NORMAL","LOW"]);

      // Assign: ORCA lead assigns to field officer
      const assignedBy = pick(ORCA_EMP_IDS);
      const assignedTo = pick(FIELD_EMP_IDS);

      // Status: varies by case age
      const caseDate = new Date(cas.date || "2026-02-01");
      const ageMs = NOW - caseDate;
      const ageDays = ageMs / 86400000;

      let status;
      if (ageDays < 14) {
        status = pick(["ASSIGNED","ASSIGNED","ACKNOWLEDGED"]);
      } else if (ageDays < 60) {
        status = pick(["ACKNOWLEDGED","IN_PROGRESS","IN_PROGRESS","COMPLETED"]);
      } else {
        status = pick(["IN_PROGRESS","COMPLETED","COMPLETED","CANCELLED"]);
      }

      const createdAt = randDate(caseDate.getTime(), Math.min(caseDate.getTime() + 3*86400000, END));
      const dueDate = new Date(createdAt.getTime() + (ageDays < 30 ? 7 : 14) * 86400000);
      const completedAt = status === "COMPLETED" ? new Date(Math.min(dueDate.getTime(), NOW.getTime())) : null;

      const checklist = [
        { id: "c1", title: "Brief senior officer", completed: status !== "ASSIGNED", completedAt: status !== "ASSIGNED" ? fmtDatetime(createdAt) : null, completedBy: null },
        { id: "c2", title: "Submit interim report", completed: status === "COMPLETED", completedAt: status === "COMPLETED" ? fmtDatetime(completedAt) : null, completedBy: null },
      ];

      const sensitivity = pick(["NORMAL","NORMAL","NORMAL","RESTRICTED","HIGHLY_SENSITIVE"]);

      const unitId = cas.unitId || pick([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20]);
      const stationInfo = STATION_LOCATIONS[unitId] || STATION_LOCATIONS[1];

      const row = {
        TaskNumber: taskNumber,
        Title: tmpl.title,
        TaskDescription: tmpl.desc,
        TaskType: ttype,
        TaskPriority: priority,
        TaskStatus: status,
        AssignedByEmployeeID: assignedBy,
        AssignedToEmployeeID: assignedTo,
        AssignedUnitID: unitId,
        ExpectedOutcome: tmpl.outcome,
        ChecklistJSON: JSON.stringify(checklist),
        DeliverablesJSON: JSON.stringify([]),
        Sensitivity: sensitivity,
        EstimatedEffort: pick(["Half Day","Full Day","2-3 Days","1 Week"]),
        LocationAddress: stationInfo.name + ", Bengaluru",
        LocationLatitude: String((stationInfo.lat + (Math.random()-0.5)*0.01).toFixed(6)),
        LocationLongitude: String((stationInfo.lng + (Math.random()-0.5)*0.01).toFixed(6)),
        CaseMasterID: cas.id,
        CreatedAt: fmtDatetime(createdAt),
        UpdatedAt: fmtDatetime(completedAt || createdAt),
      };
      if (completedAt) {
        row.CompletedAt = fmtDatetime(completedAt);
        row.CompletionNotes = "Task completed as directed. Report submitted to IO.";
      }
      // Only add DueDate if it's valid
      if (dueDate && dueDate <= NOW) {
        row.DueDate = fmtDatetime(dueDate);
      } else if (dueDate) {
        row.DueDate = fmtDatetime(dueDate);
      }

      taskRows.push(row);

      // Audit log: TASK_CREATED
      auditRows.push({
        TaskNumber: taskNumber,
        ActorEmployeeID: assignedBy,
        ActorName: `Officer #${assignedBy}`,
        AuditAction: "TASK_CREATED",
        PreviousState: "",
        NewState: "ASSIGNED",
        Remarks: `Task created and assigned for case ${cas.crimeNo}`,
        OccurredAt: fmtDatetime(createdAt),
      });

      // Additional audit entries for advanced statuses
      if (["ACKNOWLEDGED","IN_PROGRESS","COMPLETED","CANCELLED"].includes(status)) {
        const ackAt = new Date(createdAt.getTime() + 2*3600000);
        auditRows.push({
          TaskNumber: taskNumber,
          ActorEmployeeID: assignedTo,
          ActorName: `Officer #${assignedTo}`,
          AuditAction: "TASK_ACKNOWLEDGED",
          PreviousState: "ASSIGNED",
          NewState: "ACKNOWLEDGED",
          Remarks: "Task acknowledged.",
          OccurredAt: fmtDatetime(ackAt),
        });
      }
      if (["IN_PROGRESS","COMPLETED","CANCELLED"].includes(status)) {
        const startAt = new Date(createdAt.getTime() + 1*86400000);
        auditRows.push({
          TaskNumber: taskNumber,
          ActorEmployeeID: assignedTo,
          ActorName: `Officer #${assignedTo}`,
          AuditAction: "TASK_STARTED",
          PreviousState: "ACKNOWLEDGED",
          NewState: "IN_PROGRESS",
          Remarks: "Work commenced.",
          OccurredAt: fmtDatetime(startAt),
        });
      }
      if (status === "COMPLETED" && completedAt) {
        auditRows.push({
          TaskNumber: taskNumber,
          ActorEmployeeID: assignedTo,
          ActorName: `Officer #${assignedTo}`,
          AuditAction: "TASK_COMPLETED",
          PreviousState: "IN_PROGRESS",
          NewState: "COMPLETED",
          Remarks: "Task completed as directed. Report submitted to IO.",
          OccurredAt: fmtDatetime(completedAt),
        });
      }
      if (status === "CANCELLED") {
        auditRows.push({
          TaskNumber: taskNumber,
          ActorEmployeeID: assignedBy,
          ActorName: `Officer #${assignedBy}`,
          AuditAction: "TASK_CANCELLED",
          PreviousState: "IN_PROGRESS",
          NewState: "CANCELLED",
          Remarks: "Task cancelled – subsumed into broader investigation.",
          OccurredAt: fmtDatetime(new Date(createdAt.getTime() + 5*86400000)),
        });
      }
    }
  }

  // ── Plan Evidence ──────────────────────────────────────────────────────────
  // ~60% of cases get 1-3 evidence items
  const evidenceRows = [];
  const custodyRows  = [];
  let evdSerial = 0;

  const CRIME_TYPES_WITH_EVD = Object.keys(EVD_BY_CRIME);

  for (const cas of cases) {
    if (Math.random() > 0.60) continue; // 60% have evidence

    // Determine evidence templates
    const crimeKey = CRIME_TYPES_WITH_EVD.find(k => cas.crimeType && cas.crimeType.includes(k));
    const templates = crimeKey ? EVD_BY_CRIME[crimeKey] : EVD_GENERIC;
    const numEvd = 1 + Math.floor(Math.random() * Math.min(templates.length, 3));
    const chosen = pickN(templates, numEvd);

    const caseDate = new Date(cas.date || "2026-02-01");
    const ageDays = (NOW - caseDate) / 86400000;
    const collectedAt = randDate(caseDate.getTime(), Math.min(caseDate.getTime() + 2*86400000, END));
    const collectEmp = pick(FIELD_EMP_IDS);

    for (const tmpl of chosen) {
      evdSerial++;
      const year = 2026;
      const evdNo = `EVD/${year}/${pad(evdSerial, 6)}`;
      const sealNo = `${tmpl.seal}${pad(evdSerial, 4)}`;

      // Status lifecycle based on case age
      let finalStatus;
      if (ageDays < 14)     finalStatus = "COLLECTED";
      else if (ageDays < 45) finalStatus = pick(["MALKHANA","FSL"]);
      else if (ageDays < 90) finalStatus = pick(["MALKHANA","FSL","FSL_RET","COURT"]);
      else                   finalStatus = pick(["COURT","COURT_RET","MALKHANA"]);

      const statusId = EVD_STATUS[finalStatus] || 1;
      const stationInfo = STATION_LOCATIONS[cas.unitId] || STATION_LOCATIONS[1];

      evidenceRows.push({
        evdNo, sealNo, tmpl, cas, collectEmp, collectedAt,
        statusId, finalStatus, stationInfo, ageDays,
      });
    }
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log(`\nPlanned:`);
  console.log(`  Tasks:             ${taskRows.length}`);
  console.log(`  TaskAuditLog rows: ${auditRows.length}`);
  console.log(`  Evidence items:    ${evidenceRows.length}`);
  console.log(`  Evidence on cases: ${new Set(evidenceRows.map(e=>e.cas.id)).size} / ${cases.length}`);

  if (!RUN) {
    console.log("\nDry run — pass --run or --purge to insert.");
    return;
  }

  // ── INSERT Tasks ──────────────────────────────────────────────────────────
  console.log("\nInserting tasks...");
  let taskOk = 0, taskFail = 0;
  for (const row of taskRows) {
    try {
      const id = await nextId("Task", "TaskID");
      await insertRows("Task", [{ ...row, TaskID: id }]);
      taskOk++;
      if (taskOk % 50 === 0) console.log(`  ${taskOk}/${taskRows.length} tasks inserted`);
    } catch (e) {
      taskFail++;
      if (taskFail <= 3) console.error(`  TASK FAIL: ${row.TaskNumber} – ${e.message}`);
    }
  }
  console.log(`Tasks done: ${taskOk} ok, ${taskFail} failed`);

  // ── INSERT TaskAuditLog ───────────────────────────────────────────────────
  console.log("Inserting task audit logs...");
  let auditOk = 0, auditFail = 0;
  for (const row of auditRows) {
    try {
      const id = await nextId("TaskAuditLog", "AuditID");
      await insertRows("TaskAuditLog", [{ ...row, AuditID: id }]);
      auditOk++;
    } catch (e) {
      auditFail++;
      if (auditFail <= 3) console.error(`  AUDIT FAIL: ${row.TaskNumber} – ${e.message}`);
    }
  }
  console.log(`Audit logs done: ${auditOk} ok, ${auditFail} failed`);

  // ── INSERT Evidence ───────────────────────────────────────────────────────
  console.log("Inserting evidence...");
  let evdOk = 0, evdFail = 0;

  for (const e of evidenceRows) {
    try {
      const evdId = await nextId("Evidence", "EvidenceID");
      const evdRow = {
        EvidenceID: evdId,
        EvidenceNo: e.evdNo,
        CaseMasterID: e.cas.id,
        EvidenceTypeID: e.tmpl.typeId,
        Description: e.tmpl.desc,
        CollectedAt: fmtDatetime(e.collectedAt),
        CollectionPlace: e.stationInfo.name + " – Scene of Crime, Bengaluru Urban",
        latitude: Number((e.stationInfo.lat + (Math.random()-0.5)*0.01).toFixed(6)),
        longitude: Number((e.stationInfo.lng + (Math.random()-0.5)*0.01).toFixed(6)),
        SealNumber: e.sealNo,
        Quantity: e.tmpl.qty,
        CollectedByEmployeeID: e.collectEmp,
        CurrentCustodianEmployeeID: e.collectEmp,
        EvidenceStatusID: e.statusId,
        CreatedByUID: "seed",
        CreatedAt: fmtDatetime(e.collectedAt),
      };
      await insertRows("Evidence", [evdRow]);
      evdOk++;

      // ── Custody chain ──────────────────────────────────────────────────────
      const custodyChain = [];

      // Event 1: Collected at scene
      custodyChain.push({ EventTypeID: CUSTODY_EVT.COLLECTED, From: null, To: e.collectEmp, statusId: EVD_STATUS.COLLECTED, at: new Date(e.collectedAt), loc: e.stationInfo.name + " – Scene of Crime" });

      // Event 2: Deposited in Malkhana (always)
      const malkhanaAt = new Date(e.collectedAt.getTime() + 4*3600000);
      custodyChain.push({ EventTypeID: CUSTODY_EVT.MALKHANA, From: e.collectEmp, To: pick(FIELD_EMP_IDS), statusId: EVD_STATUS.MALKHANA, at: malkhanaAt, loc: e.stationInfo.name + " – Malkhana" });

      // Further events based on final status
      if (["FSL","FSL_RET","COURT","COURT_RET"].includes(e.finalStatus)) {
        const fslAt = new Date(malkhanaAt.getTime() + 3*86400000);
        custodyChain.push({ EventTypeID: CUSTODY_EVT.FSL, From: pick(FIELD_EMP_IDS), To: null, statusId: EVD_STATUS.FSL, at: fslAt, loc: "Regional FSL, Madiwala, Bengaluru" });
        if (["FSL_RET","COURT","COURT_RET"].includes(e.finalStatus)) {
          const fslRetAt = new Date(fslAt.getTime() + 15*86400000);
          custodyChain.push({ EventTypeID: CUSTODY_EVT.FSL_RET, From: null, To: pick(FIELD_EMP_IDS), statusId: EVD_STATUS.FSL_RET, at: fslRetAt, loc: e.stationInfo.name + " – Malkhana" });
        }
      }
      if (["COURT","COURT_RET"].includes(e.finalStatus)) {
        const courtAt = new Date(malkhanaAt.getTime() + 30*86400000);
        custodyChain.push({ EventTypeID: CUSTODY_EVT.COURT, From: pick(FIELD_EMP_IDS), To: null, statusId: EVD_STATUS.COURT, at: courtAt, loc: "JMFC Court, Bengaluru" });
        if (e.finalStatus === "COURT_RET") {
          const courtRetAt = new Date(courtAt.getTime() + 7*86400000);
          custodyChain.push({ EventTypeID: CUSTODY_EVT.COURT_RET, From: null, To: pick(FIELD_EMP_IDS), statusId: EVD_STATUS.COURT_RET, at: courtRetAt, loc: e.stationInfo.name + " – Malkhana" });
        }
      }

      // Insert custody events
      let prevHash = "0".repeat(64);
      for (let seq = 0; seq < custodyChain.length; seq++) {
        const ev = custodyChain[seq];
        const custId = await nextId("EvidenceCustody", "CustodyID");
        const custRow = {
          CustodyID: custId,
          EvidenceID: evdId,
          SeqNo: seq + 1,
          EventTypeID: ev.EventTypeID,
          FromEmployeeID: ev.From,
          ToEmployeeID: ev.To,
          EventAt: fmtDatetime(ev.at),
          Location: ev.loc,
          Remarks: `Custody transfer – seq ${seq+1}`,
          RecordedByUID: "seed",
          RecordedAt: fmtDatetime(ev.at),
          PrevHash: prevHash,
        };
        const rowHash = hashChain(prevHash, { EvidenceID: evdId, SeqNo: seq+1, EventTypeID: ev.EventTypeID, FromEmployeeID: ev.From, ToEmployeeID: ev.To, EventAt: custRow.EventAt, Location: ev.loc });
        custRow.RowHash = rowHash;
        prevHash = rowHash;
        // Remove null FK fields
        if (custRow.FromEmployeeID == null) delete custRow.FromEmployeeID;
        if (custRow.ToEmployeeID == null) delete custRow.ToEmployeeID;
        await insertRows("EvidenceCustody", [custRow]);
        custodyRows.push(custRow);
      }

      if (evdOk % 20 === 0) console.log(`  ${evdOk}/${evidenceRows.length} evidence items inserted`);
    } catch (e2) {
      evdFail++;
      if (evdFail <= 5) console.error(`  EVD FAIL: ${e.evdNo} – ${e2.message}`);
    }
  }

  console.log(`Evidence done: ${evdOk} ok, ${evdFail} failed`);
  console.log(`Custody events inserted: ${custodyRows.length}`);
  console.log("\nAll done.");
})().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
