/**
 * O.R.C.A Demo Data Seeder
 * Inserts 180 realistic FIRs into Catalyst — Bengaluru Urban, Feb–Aug 2026.
 *
 * USAGE:
 *   node scripts/seed-demo-data.cjs            <- dry run (counts only)
 *   node scripts/seed-demo-data.cjs --confirm  <- inserts
 *   node scripts/seed-demo-data.cjs --purge    <- deletes all seeded cases
 */
"use strict";

const path = require("path");
const fs   = require("fs");
const ROOT = path.join(__dirname, "..");
const { createJiti } = require(path.join(ROOT, "node_modules/jiti"));
const jiti = createJiti(__filename, { alias: { "@": path.join(ROOT, "src") }, interopDefault: true });

const envLines = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").split("\n");
for (const l of envLines) {
  const t = l.trim(); if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("="); if (eq < 0) continue;
  const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  if (!process.env[k]) process.env[k] = v;
}

const CONFIRM = process.argv.includes("--confirm");
const PURGE   = process.argv.includes("--purge");

// ── Reference data (all real from Catalyst) ───────────────────────────────────
// Police stations — Bengaluru Urban (districtId 5), IDs 1-20
const STATIONS = [
  { id: 1,  name: "Halasuru Gate",       lat: 12.9716, lng: 77.6099 },
  { id: 2,  name: "Cubbon Park",         lat: 12.9763, lng: 77.5929 },
  { id: 3,  name: "Vidhana Soudha",      lat: 12.9799, lng: 77.5907 },
  { id: 4,  name: "High Grounds",        lat: 12.9865, lng: 77.5846 },
  { id: 5,  name: "Sadashivanagar",      lat: 13.0048, lng: 77.5797 },
  { id: 6,  name: "Rajajinagar",         lat: 12.9906, lng: 77.5543 },
  { id: 7,  name: "Malleswaram",         lat: 13.0028, lng: 77.5669 },
  { id: 8,  name: "Yeshwanthpur",        lat: 13.0245, lng: 77.5502 },
  { id: 9,  name: "Peenya",              lat: 13.0278, lng: 77.5170 },
  { id: 10, name: "Kamakshipalya",       lat: 12.9818, lng: 77.5432 },
  { id: 11, name: "Basaveshwaranagar",   lat: 12.9976, lng: 77.5290 },
  { id: 12, name: "Girinagar",           lat: 12.9427, lng: 77.5603 },
  { id: 13, name: "Banashankari",        lat: 12.9253, lng: 77.5469 },
  { id: 14, name: "Jayanagar",           lat: 12.9279, lng: 77.5828 },
  { id: 15, name: "J.P. Nagar",         lat: 12.9048, lng: 77.5851 },
  { id: 16, name: "Hanumanthanagar",     lat: 12.9522, lng: 77.5613 },
  { id: 17, name: "Chamarajpet",         lat: 12.9622, lng: 77.5633 },
  { id: 18, name: "Cottonpet",           lat: 12.9717, lng: 77.5738 },
  { id: 19, name: "Chickpet",            lat: 12.9675, lng: 77.5754 },
  { id: 20, name: "Upparpet",            lat: 12.9741, lng: 77.5805 },
];

const DISTRICT_ID   = 5;   // Bengaluru Urban
const CASE_CAT_FIR  = 1;
const CASE_CAT_UDR  = 3;
const GRAVITY_HEI   = 1;   // Heinous
const GRAVITY_NON   = 2;   // Non-Heinous
const STATUS_UI     = 1;   // Under Investigation
const STATUS_CS     = 2;   // Charge Sheeted
const STATUS_CL     = 3;   // Closed

// Officer employee IDs who are police (have actual PS unit assignments or ISD)
// Used as PolicePersonID on cases
const OFFICER_IDS = [12, 13, 14, 10, 11, 8, 9];

// Court IDs (District + Sessions courts in Karnataka)
const COURT_IDS = [9, 10, 11, 12, 13, 14, 15]; // Sessions courts for Bengaluru

// ── Name pools — realistic Karnataka names ────────────────────────────────────
const FIRST_M = [
  "Rajesh","Suresh","Mahesh","Ramesh","Ganesh","Pradeep","Santosh","Vinod","Ravi","Arun",
  "Kiran","Sathish","Nagaraj","Manjunath","Srinivas","Venkatesh","Basavaraj","Girish","Lokesh",
  "Chandrashekar","Shivakumar","Prakash","Umesh","Dinesh","Harish","Naveen","Rohan","Vijay",
  "Mohammed","Abdul","Irfan","Imran","Saleem","Zaheer","Rauf","Rehman","Asif","Tariq",
  "Thomas","Anthony","Johnson","Peter","David","Joseph","Antony","Xavier",
  "Puttaswamy","Hanumaiah","Thimmaiah","Venkataramaiah","Siddaramaiah","Boraiah",
  "Shankara","Shivanand","Nagendra","Anand","Sunil","Ajay","Amit","Rohit","Sumit",
];
const FIRST_F = [
  "Lakshmi","Savitha","Rekha","Sunita","Kavitha","Geetha","Anitha","Padma","Radha","Usha",
  "Meena","Nirmala","Saroja","Pushpa","Sharada","Bharathi","Jyothi","Vasantha","Kamala","Ratna",
  "Fathima","Ayesha","Zainab","Rabia","Noor","Saleha","Rukhsana","Sabrina","Amina","Nasreen",
  "Mary","Rosamma","Stella","Leena","Priya","Deepa","Suma","Pooja","Sneha","Divya",
  "Shobha","Lalitha","Vijayalakshmi","Saraswathi","Manjula","Chandrakala","Hemavathi",
];
const SURNAMES = [
  "Gowda","Naidu","Rao","Sharma","Kumar","Reddy","Naik","Hegde","Shetty","Patil",
  "Nayak","Murthy","Swamy","Raju","Bhat","Kamath","Patel","Pai","Nair","Iyengar",
  "Khan","Sheikh","Shaikh","Siddiqui","Pasha","Ahmed","Ansari","Qureshi",
  "D'Souza","Fernandes","Pereira","Sequeira","Rodrigues",
  "Hanumaiah","Thimmaiah","Muniyappa","Boraiah","Lingaiah","Venkataramaiah",
  "Basappa","Shivappa","Manjappa","Rangappa","Siddappa","Nagappa",
];

const pick  = (arr) => arr[Math.floor(Math.random() * arr.length)];
const pickN = (arr, n) => { const a = [...arr].sort(() => Math.random() - 0.5); return a.slice(0, n); };

function mname() { return `${pick(FIRST_M)} ${pick(SURNAMES)}`; }
function fname() { return `${pick(FIRST_F)} ${pick(SURNAMES)}`; }
function person() { return Math.random() < 0.55 ? mname() : fname(); }
function gender(name) {
  const f = name.split(" ")[0];
  return FIRST_F.includes(f) ? "F" : "M";
}
// Numeric gender for ComplainantDetails / Victim (int columns)
function genderInt(name) { return gender(name) === "F" ? 2 : 1; }
function age(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// ── Recurring accused — appear in multiple cases (drives relation graph) ───────
const RECURRING = [
  mname(), mname(), mname(), mname(), mname(),
  mname(), mname(), mname(), mname(), mname(),
  mname(), mname(),
].map((name, i) => ({ name, id: `REC-${String(i+1).padStart(3,"0")}` }));

// ── Crime templates ───────────────────────────────────────────────────────────
// Each template has sections (IPC), gravity, typical victim/accused count, brief facts generator
const CRIME_TEMPLATES = [
  {
    type: "Theft",
    sections: [{ ActID: "IPC", SectionID: "379" }],
    gravity: GRAVITY_NON, cat: CASE_CAT_FIR, weight: 20,
    needsVictim: false,
    facts: (v, a, ps, date) =>
      `On ${date}, the complainant reported that accused ${a[0].AccusedName} trespassed into the premises located in the jurisdiction of ${ps} Police Station and committed theft of cash and valuables estimated at Rs. ${(Math.floor(Math.random()*45+5)*1000).toLocaleString('en-IN')}/-. The accused fled the scene before the arrival of the complainant. A case has been registered and investigation is underway.`,
  },
  {
    type: "House-Breaking Theft",
    sections: [{ ActID: "IPC", SectionID: "380" }, { ActID: "IPC", SectionID: "457" }],
    gravity: GRAVITY_NON, cat: CASE_CAT_FIR, weight: 12,
    needsVictim: false,
    facts: (v, a, ps, date) =>
      `On ${date}, accused ${a[0].AccusedName}${a[1] ? " and "+a[1].AccusedName : ""} broke into the residential premises of the complainant in the jurisdiction of ${ps} Police Station. Gold ornaments weighing approximately ${Math.floor(Math.random()*30+10)} grams and cash of Rs. ${(Math.floor(Math.random()*80+20)*1000).toLocaleString('en-IN')}/- were stolen. The accused committed the offence during night hours. Investigation initiated.`,
  },
  {
    type: "Robbery",
    sections: [{ ActID: "IPC", SectionID: "392" }, { ActID: "IPC", SectionID: "394" }],
    gravity: GRAVITY_HEI, cat: CASE_CAT_FIR, weight: 8,
    needsVictim: true,
    facts: (v, a, ps, date) =>
      `On ${date}, accused ${a[0].AccusedName}${a[1] ? " along with "+a[1].AccusedName : ""} accosted the complainant near the jurisdiction of ${ps} Police Station, threatened with knife, and robbed cash and mobile phone. The victim ${v[0] ? v[0].VictimName : "the complainant"} sustained minor injuries. An FIR has been registered and the accused are absconding.`,
  },
  {
    type: "Chain Snatching",
    sections: [{ ActID: "IPC", SectionID: "379" }, { ActID: "IPC", SectionID: "341" }],
    gravity: GRAVITY_NON, cat: CASE_CAT_FIR, weight: 10,
    needsVictim: true,
    facts: (v, a, ps, date) =>
      `On ${date}, accused ${a[0].AccusedName} rode a two-wheeler and snatched a gold chain weighing ${Math.floor(Math.random()*15+5)} grams (approx. Rs. ${(Math.floor(Math.random()*60+40)*1000).toLocaleString('en-IN')}/-) from the neck of ${v[0] ? v[0].VictimName : "the victim"} in the ${ps} police station limits. The accused fled on a motorcycle bearing unidentified registration. Case registered.`,
  },
  {
    type: "Assault / Hurt",
    sections: [{ ActID: "IPC", SectionID: "323" }, { ActID: "IPC", SectionID: "506" }],
    gravity: GRAVITY_NON, cat: CASE_CAT_FIR, weight: 14,
    needsVictim: true,
    facts: (v, a, ps, date) =>
      `On ${date}, accused ${a[0].AccusedName}${a[1] ? " and "+a[1].AccusedName : ""} quarrelled with the complainant over a dispute regarding ${pick(["property","money","personal enmity","a prior altercation","a land boundary"])} and assaulted ${v[0] ? v[0].VictimName : "the complainant"} causing hurt. The accused also issued criminal threats. The victim was examined at the government hospital and a medico-legal certificate has been obtained.`,
  },
  {
    type: "Grievous Hurt",
    sections: [{ ActID: "IPC", SectionID: "325" }, { ActID: "IPC", SectionID: "324" }],
    gravity: GRAVITY_HEI, cat: CASE_CAT_FIR, weight: 7,
    needsVictim: true,
    facts: (v, a, ps, date) =>
      `On ${date}, accused ${a[0].AccusedName}${a[1] ? " and "+a[1].AccusedName : ""} attacked ${v[0] ? v[0].VictimName : "the victim"} with ${pick(["a wooden log","an iron rod","a sharp object","a stone","a bicycle chain"])} in the jurisdiction of ${ps} Police Station, causing grievous injuries. The victim was admitted to Bowring & Lady Curzon Hospital, Bengaluru. The accused persons are known to the victim and a dispute over ${pick(["property","money","business","family matters"])} is suspected as the motive.`,
  },
  {
    type: "Murder",
    sections: [{ ActID: "IPC", SectionID: "302" }, { ActID: "IPC", SectionID: "201" }],
    gravity: GRAVITY_HEI, cat: CASE_CAT_FIR, weight: 3,
    needsVictim: true,
    facts: (v, a, ps, date) =>
      `On ${date}, the body of ${v[0] ? v[0].VictimName : "an unidentified person"} was found in the jurisdiction of ${ps} Police Station with fatal injuries. Post-mortem report confirms homicidal death. Accused ${a[0].AccusedName}${a[1] ? " and "+a[1].AccusedName : ""} have been identified through eyewitness accounts and CCTV footage. Motive is suspected to be ${pick(["enmity","money dispute","land dispute","domestic quarrel","gang rivalry"])}. A detailed investigation is in progress.`,
  },
  {
    type: "Cheating / Fraud",
    sections: [{ ActID: "IPC", SectionID: "420" }, { ActID: "IPC", SectionID: "406" }],
    gravity: GRAVITY_NON, cat: CASE_CAT_FIR, weight: 9,
    needsVictim: false,
    facts: (v, a, ps, date) =>
      `On ${date}, accused ${a[0].AccusedName} fraudulently induced the complainant to invest Rs. ${(Math.floor(Math.random()*400+100)*1000).toLocaleString('en-IN')}/- under the pretext of ${pick(["guaranteed high returns","a real estate scheme","a government tender contract","a job offer abroad","a chit fund"])}. The accused obtained the money through deception and failed to return it. A complaint was lodged at ${ps} Police Station and investigation is underway. Bank account details of the accused have been seized.`,
  },
  {
    type: "Domestic Violence",
    sections: [{ ActID: "IPC", SectionID: "498A" }, { ActID: "IPC", SectionID: "323" }],
    gravity: GRAVITY_NON, cat: CASE_CAT_FIR, weight: 8,
    needsVictim: true,
    facts: (v, a, ps, date) =>
      `On ${date}, complainant ${v[0] ? v[0].VictimName : "the wife"} lodged a complaint against her husband ${a[0].AccusedName}${a[1] ? " and his relative "+a[1].AccusedName : ""} alleging cruelty and physical abuse. The complainant states the accused subjected her to ${pick(["dowry harassment","continuous mental and physical torture","threats of divorce","denial of basic needs"])} within the matrimonial home in the jurisdiction of ${ps} Police Station. The matter has been referred to the Women's Protection Cell. Case registered under relevant provisions.`,
  },
  {
    type: "Kidnapping",
    sections: [{ ActID: "IPC", SectionID: "363" }, { ActID: "IPC", SectionID: "364" }],
    gravity: GRAVITY_HEI, cat: CASE_CAT_FIR, weight: 3,
    needsVictim: true,
    facts: (v, a, ps, date) =>
      `On ${date}, the complainant reported that ${v[0] ? v[0].VictimName+" (age "+v[0].AgeYear+")" : "a minor"} was forcibly taken away by accused ${a[0].AccusedName}${a[1] ? " along with "+a[1].AccusedName : ""} from the vicinity of ${ps} Police Station limits. The accused used ${pick(["a white Maruti Suzuki Omni","a red Mahindra Bolero","a dark-coloured SUV","a motorcycle"])} for committing the offence. An alert has been issued to all neighbouring police stations and the SIT is coordinating the search.`,
  },
  {
    type: "NDPS Act",
    sections: [{ ActID: "NDPS", SectionID: "20" }, { ActID: "NDPS", SectionID: "29" }],
    gravity: GRAVITY_NON, cat: CASE_CAT_FIR, weight: 6,
    needsVictim: false,
    facts: (v, a, ps, date) =>
      `On ${date}, based on specific intelligence, a team from ${ps} Police Station apprehended accused ${a[0].AccusedName}${a[1] ? " and "+a[1].AccusedName : ""} near ${pick(["the bus stand","the railway station","a market area","an under-construction site","a school road"])}. Upon search, ${pick(["ganja weighing 2.3 kg","heroin of commercial quantity","500 grams of ganja",`${Math.floor(Math.random()*200+50)} Clonazepam tablets`])} was recovered from their possession. The contraband has been seized and samples sent for forensic examination. Case registered under the NDPS Act.`,
  },
  {
    type: "Vehicle Theft",
    sections: [{ ActID: "IPC", SectionID: "379" }],
    gravity: GRAVITY_NON, cat: CASE_CAT_FIR, weight: 10,
    needsVictim: false,
    facts: (v, a, ps, date) =>
      `On ${date}, the complainant parked their ${pick(["Honda Activa","TVS Jupiter","Bajaj Pulsar 150","Hero Splendor Plus","Royal Enfield Classic 350","Maruti Suzuki Swift","Hyundai i20"])} bearing registration number KA-${String(Math.floor(Math.random()*99)+1).padStart(2,"0")}-${pick(["M","N","P","Q","R","S","T","U","V","W","X","Y","Z"])}-${String(Math.floor(Math.random()*9000)+1000)} in the parking area within ${ps} Police Station limits. The vehicle was found missing thereafter. The complainant states the vehicle is valued at approximately Rs. ${(Math.floor(Math.random()*6+1)*100000).toLocaleString('en-IN')}/-.`,
  },
  {
    type: "Cybercrime / Online Fraud",
    sections: [{ ActID: "IPC", SectionID: "420" }, { ActID: "ITACT", SectionID: "66C" }],
    gravity: GRAVITY_NON, cat: CASE_CAT_FIR, weight: 7,
    needsVictim: false,
    facts: (v, a, ps, date) =>
      `On ${date}, the complainant reported that an unknown accused posing as ${pick(["a bank official","a KYC verification officer","a customs officer","a CBI officer","an insurance agent"])} made contact via ${pick(["WhatsApp","a phone call","an SMS link","a phishing website"])} and induced the complainant to share their OTP and banking credentials. Subsequently, Rs. ${(Math.floor(Math.random()*200+20)*1000).toLocaleString('en-IN')}/- was fraudulently debited from their account. Complaint received at ${ps} Police Station and forwarded to the Cyber Crime Police Station for investigation. Bank has been requested to freeze the beneficiary account.`,
  },
  {
    type: "UDR – Unnatural Death",
    sections: [],
    gravity: GRAVITY_HEI, cat: CASE_CAT_UDR, weight: 2,
    needsVictim: true,
    facts: (v, a, ps, date) =>
      `On ${date}, the body of ${v[0] ? v[0].VictimName : "an unidentified individual"} was discovered in the jurisdiction of ${ps} Police Station. The cause of death is unascertained pending post-mortem report. No external injuries indicative of homicide were observed at the scene. The deceased has been identified by ${pick(["family members","Aadhar card found on person","fingerprint records"])}. Inquest proceedings conducted in the presence of the Executive Magistrate. The post-mortem report and toxicology reports are awaited.`,
  },
];

// Build weighted template array
const TEMPLATE_POOL = [];
for (const t of CRIME_TEMPLATES) {
  for (let i = 0; i < t.weight; i++) TEMPLATE_POOL.push(t);
}

// ── Date helpers ──────────────────────────────────────────────────────────────
function randomDate(startMs, endMs) {
  const d = new Date(startMs + Math.random() * (endMs - startMs));
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}
function randomDateTime(dateStr) {
  const h = String(Math.floor(Math.random() * 22) + 1).padStart(2, "0");
  const m = String(Math.floor(Math.random() * 60)).padStart(2, "0");
  return `${dateStr} ${h}:${m}:00`;
}

const START = new Date("2026-02-01").getTime();
const END   = new Date("2026-08-26").getTime();

// ── Status distribution ───────────────────────────────────────────────────────
// Older cases more likely to be charge-sheeted or closed
function statusFor(dateStr) {
  const d = new Date(dateStr).getTime();
  const ageMs = END - d;
  const ageDays = ageMs / 86400000;
  if (ageDays > 120) return Math.random() < 0.4 ? STATUS_CS : (Math.random() < 0.3 ? STATUS_CL : STATUS_UI);
  if (ageDays > 60)  return Math.random() < 0.2 ? STATUS_CS : STATUS_UI;
  return STATUS_UI;
}

// ── Pad helper (matches FIR registration route) ───────────────────────────────
function pad(value, width) {
  return String(value ?? "").replace(/\D/g, "").padStart(width, "0").slice(-width);
}
function buildCrimeNo(catId, districtId, unitId, year, serial) {
  const crimeNo = pad(catId,1) + pad(districtId,4) + pad(unitId,4) + pad(year,4) + pad(serial,5);
  return { crimeNo, caseNo: crimeNo.slice(-9) };
}

// ── Verification ledger helpers ───────────────────────────────────────────────
const crypto = require("crypto");
function verificationIdFor(crimeNo) {
  return crypto.createHash("sha256").update(`ORCA:${crimeNo}`).digest("hex").slice(0, 32).toUpperCase();
}
function documentHash(input) {
  const str = [input.crimeNo, input.caseNo, input.policeStationId, input.caseCategoryId, input.registeredDate, input.briefFacts].join("|");
  return crypto.createHash("sha256").update(str).digest("hex").toUpperCase();
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const { getAllRows, insertRows, nextId, deleteRow } = await jiti.import(path.join(ROOT, "src/lib/catalyst.ts"));

  // ── PURGE mode ──────────────────────────────────────────────────────────────
  if (PURGE) {
    console.log("Purging all case data from Catalyst…");
    const tables = ["ActSectionAssociation","ComplainantDetails","Victim","Accused","VerificationLedger","CaseMaster"];
    for (const table of tables) {
      let rows;
      try { rows = await getAllRows(table); } catch { rows = []; }
      const unwrap = (r) => (r && r[table]) || r || {};
      for (const r of rows) { const rec = unwrap(r); if (rec.ROWID) await deleteRow(table, rec.ROWID); }
      console.log(`  deleted ${rows.length} rows from ${table}`);
    }
    console.log("Purge complete.");
    return;
  }

  // ── BUILD 180 cases ─────────────────────────────────────────────────────────
  const TOTAL = 180;

  // Serial counter per station+category+year
  const serials = {};
  function nextSerial(stationId, catId, year) {
    const key = `${stationId}:${catId}:${year}`;
    serials[key] = (serials[key] || 0) + 1;
    return serials[key];
  }

  const cases = [];
  for (let i = 0; i < TOTAL; i++) {
    const template = pick(TEMPLATE_POOL);
    const station  = pick(STATIONS);
    const dateStr  = randomDate(START, END);
    const year     = Number(dateStr.slice(0, 4));
    const serial   = nextSerial(station.id, template.cat, year);
    const { crimeNo, caseNo } = buildCrimeNo(template.cat, DISTRICT_ID, station.id, year, serial);

    // Accused: mix of recurring (30% chance each slot) and fresh
    const numAccused = Math.random() < 0.4 ? 2 : 1;
    const accused = [];
    for (let j = 0; j < numAccused; j++) {
      if (Math.random() < 0.22 && RECURRING.length) {
        const r = pick(RECURRING);
        accused.push({ AccusedName: r.name, AgeYear: age(22, 48), GenderID: gender(r.name), PersonID: r.id });
      } else {
        const n = mname();
        accused.push({ AccusedName: n, AgeYear: age(18, 55), GenderID: gender(n), PersonID: `A${i+1}-${j+1}` });
      }
    }

    // Victims (only for crime types that need them)
    const victims = [];
    if (template.needsVictim) {
      const vn = person();
      victims.push({ VictimName: vn, AgeYear: age(16, 70), GenderID: genderInt(vn), VictimPolice: "0" });
    }

    // Complainant
    const cn = person();
    const complainants = [{
      ComplainantName: cn,
      AgeYear: age(20, 65),
      GenderID: genderInt(cn),
      OccupationID: Math.floor(Math.random() * 12) + 1,
      ReligionID:   Math.floor(Math.random() * 4) + 1,
    }];

    const briefFacts = template.facts(victims, accused, station.name, dateStr);
    const caseStatus = statusFor(dateStr);

    // Incident timestamp slightly before registration
    const incidentDate = randomDateTime(dateStr);
    const lat = station.lat + (Math.random() - 0.5) * 0.02;
    const lng = station.lng + (Math.random() - 0.5) * 0.02;

    cases.push({
      caseMaster: {
        CaseCategoryID: template.cat,
        PoliceStationID: station.id,
        DistrictID: DISTRICT_ID,
        PolicePersonID: pick(OFFICER_IDS),
        GravityOffenceID: template.gravity,
        CaseStatusID: caseStatus,
        CourtID: caseStatus !== STATUS_UI ? pick(COURT_IDS) : null,
        CrimeRegisteredDate: dateStr,
        IncidentFromDate: incidentDate,
        BriefFacts: briefFacts,
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
      },
      complainants,
      victims,
      accused,
      actSections: template.sections,
      // metadata for insertion
      _crimeNo: crimeNo,
      _caseNo: caseNo,
      _serial: serial,
      _stationName: station.name,
      _type: template.type,
      _date: dateStr,
    });
  }

  // ── DRY RUN ──────────────────────────────────────────────────────────────────
  if (!CONFIRM) {
    const byCrime = {};
    const byStation = {};
    for (const c of cases) {
      byCrime[c._type] = (byCrime[c._type] || 0) + 1;
      byStation[c._stationName] = (byStation[c._stationName] || 0) + 1;
    }
    console.log(`\nDRY RUN — ${TOTAL} cases to be inserted\n`);
    console.log("By crime type:");
    for (const [k, v] of Object.entries(byCrime).sort((a,b)=>b[1]-a[1])) {
      console.log(`  ${k.padEnd(30)} ${v}`);
    }
    console.log("\nBy police station (top 10):");
    for (const [k, v] of Object.entries(byStation).sort((a,b)=>b[1]-a[1]).slice(0,10)) {
      console.log(`  ${k.padEnd(35)} ${v}`);
    }
    // Recurring accused preview
    const recurringCounts = {};
    for (const c of cases) {
      for (const a of c.accused) {
        if (a.PersonID.startsWith("REC-")) recurringCounts[a.AccusedName] = (recurringCounts[a.AccusedName]||0) + 1;
      }
    }
    const multi = Object.entries(recurringCounts).filter(([,v])=>v>1).sort((a,b)=>b[1]-a[1]);
    if (multi.length) {
      console.log("\nRecurring accused (will link cases in Relation Graph):");
      for (const [n, v] of multi) console.log(`  ${n.padEnd(35)} ${v} cases`);
    }
    console.log(`\nRun with --confirm to insert all ${TOTAL} cases.`);
    return;
  }

  // ── LIVE INSERT ───────────────────────────────────────────────────────────────
  console.log(`\nInserting ${TOTAL} cases into Catalyst…\n`);
  let done = 0, errors = 0;

  for (const c of cases) {
    try {
      const caseMasterId = await nextId("CaseMaster", "CaseMasterID");
      const { crimeNo, caseNo } = { crimeNo: c._crimeNo, caseNo: c._caseNo };

      const num = (v) => (v === "" || v === null || v === undefined ? null : Number(v));
      const caseRow = {
        CaseMasterID: caseMasterId,
        CrimeNo: crimeNo,
        CaseNo: caseNo,
        CrimeRegisteredDate: c.caseMaster.CrimeRegisteredDate,
        PolicePersonID: c.caseMaster.PolicePersonID,
        PoliceStationID: c.caseMaster.PoliceStationID,
        CaseCategoryID: c.caseMaster.CaseCategoryID,
        GravityOffenceID: c.caseMaster.GravityOffenceID,
        CaseStatusID: c.caseMaster.CaseStatusID,
        BriefFacts: c.caseMaster.BriefFacts,
        latitude: c.caseMaster.latitude,
        longitude: c.caseMaster.longitude,
        IncidentFromDate: c.caseMaster.IncidentFromDate,
      };
      if (c.caseMaster.CourtID) caseRow.CourtID = c.caseMaster.CourtID;

      await insertRows("CaseMaster", [caseRow]);

      if (c.complainants.length) {
        let id = await nextId("ComplainantDetails", "ComplainantID");
        await insertRows("ComplainantDetails", c.complainants.map(x => ({
          ComplainantID: id++,
          CaseMasterID: caseMasterId,
          ComplainantName: x.ComplainantName,
          AgeYear: x.AgeYear,
          OccupationID: x.OccupationID,
          ReligionID: x.ReligionID,
          GenderID: Number(x.GenderID),
        })));
      }

      if (c.victims.length) {
        let id = await nextId("Victim", "VictimMasterID");
        await insertRows("Victim", c.victims.map(x => ({
          VictimMasterID: id++,
          CaseMasterID: caseMasterId,
          VictimName: x.VictimName,
          AgeYear: x.AgeYear,
          GenderID: x.GenderID,
          VictimPolice: "0",
        })));
      }

      if (c.accused.length) {
        let id = await nextId("Accused", "AccusedMasterID");
        await insertRows("Accused", c.accused.map((x, j) => ({
          AccusedMasterID: id++,
          CaseMasterID: caseMasterId,
          AccusedName: x.AccusedName,
          AgeYear: x.AgeYear,
          GenderID: x.GenderID,
          PersonID: x.PersonID,
        })));
      }

      if (c.actSections.length) {
        await insertRows("ActSectionAssociation", c.actSections.map((x, j) => ({
          CaseMasterID: caseMasterId,
          ActID: String(x.ActID),
          SectionID: String(x.SectionID),
          ActOrderID: j + 1,
          SectionOrderID: j + 1,
        })));
      }

      // Verification ledger
      const verificationId = verificationIdFor(crimeNo);
      const hash = documentHash({
        crimeNo, caseNo,
        policeStationId: c.caseMaster.PoliceStationID,
        caseCategoryId:  c.caseMaster.CaseCategoryID,
        registeredDate:  c.caseMaster.CrimeRegisteredDate,
        briefFacts:      c.caseMaster.BriefFacts,
      });
      const now = new Date().toISOString().slice(0,19).replace("T"," ");
      try {
        await insertRows("VerificationLedger", [{
          VerificationID: verificationId,
          CrimeNo: crimeNo,
          CaseMasterID: caseMasterId,
          DocumentHash: hash,
          IssuedBy: "System Seeder",
          IssuedAt: now,
          VerificationStatus: "VERIFIED",
        }]);
      } catch { /* ledger failure is non-fatal */ }

      done++;
      if (done % 20 === 0 || done === TOTAL) {
        process.stdout.write(`\r  ${done}/${TOTAL} cases inserted…`);
      }
    } catch (e) {
      errors++;
      console.error(`\n  ERROR on case ${done+1} (${c._type}): ${e.message}`);
    }
  }

  console.log(`\n\nDone. ${done} inserted, ${errors} errors.`);
  if (errors === 0) console.log("All 180 cases seeded successfully.");
}

main().catch(e => { console.error("FATAL:", e.message); process.exit(1); });
