import { NextRequest, NextResponse } from "next/server";
import { verifyOfficerRequest } from "@/lib/firebaseAdmin";
import { getAllRows, insertRows, isCatalystConfigured, invalidateTable } from "@/lib/catalyst";
function isAdmin(role: string): boolean {
  return ["admin_full", "command_admin", "scrb_officer", "admin_scrb", "admin_verification", "verification_admin", "it_admin", "orca_owner", "orca_engineer"].includes(role);
}

/**
 * POST /api/admin/seed/crime-heads
 *
 * Seeds CrimeHead and CrimeSubHead Catalyst tables with standard Karnataka
 * Police IPC crime classification groups. Safe to call multiple times —
 * skips insertion if rows already exist.
 */

const CRIME_HEADS: { id: number; name: string }[] = [
  { id: 1,  name: "Crimes Against Body" },
  { id: 2,  name: "Crimes Against Property" },
  { id: 3,  name: "Crimes Against Women" },
  { id: 4,  name: "Crimes Against Children" },
  { id: 5,  name: "Economic Offences" },
  { id: 6,  name: "Cybercrime" },
  { id: 7,  name: "Organised Crime" },
  { id: 8,  name: "Narcotics & Drugs" },
  { id: 9,  name: "Arms & Explosives" },
  { id: 10, name: "Public Order Offences" },
  { id: 11, name: "SC / ST Atrocities" },
  { id: 12, name: "Property & Environment" },
  { id: 13, name: "Traffic & Motor Vehicles" },
  { id: 14, name: "Other IPC Offences" },
  { id: 15, name: "Special & Local Laws" },
];

const CRIME_SUBHEADS: { id: number; headId: number; name: string; seq: number }[] = [
  // 1 — Crimes Against Body
  { id: 101, headId: 1, name: "Murder (IPC 302)",                seq: 1  },
  { id: 102, headId: 1, name: "Attempt to Murder (IPC 307)",     seq: 2  },
  { id: 103, headId: 1, name: "Culpable Homicide (IPC 304)",     seq: 3  },
  { id: 104, headId: 1, name: "Grievous Hurt (IPC 325/326)",     seq: 4  },
  { id: 105, headId: 1, name: "Simple Hurt (IPC 323/324)",       seq: 5  },
  { id: 106, headId: 1, name: "Kidnapping & Abduction (IPC 363–369)", seq: 6 },
  { id: 107, headId: 1, name: "Assault on Woman (IPC 354)",      seq: 7  },

  // 2 — Crimes Against Property
  { id: 201, headId: 2, name: "Robbery (IPC 392–394)",           seq: 1  },
  { id: 202, headId: 2, name: "Dacoity (IPC 395–398)",           seq: 2  },
  { id: 203, headId: 2, name: "Burglary (IPC 457–460)",          seq: 3  },
  { id: 204, headId: 2, name: "Theft (IPC 378–382)",             seq: 4  },
  { id: 205, headId: 2, name: "Extortion (IPC 383–389)",         seq: 5  },
  { id: 206, headId: 2, name: "Cheating (IPC 420)",              seq: 6  },
  { id: 207, headId: 2, name: "Criminal Misappropriation (IPC 403)", seq: 7 },
  { id: 208, headId: 2, name: "Arson (IPC 435–438)",             seq: 8  },

  // 3 — Crimes Against Women
  { id: 301, headId: 3, name: "Rape (IPC 376)",                  seq: 1  },
  { id: 302, headId: 3, name: "Domestic Violence (DV Act)",      seq: 2  },
  { id: 303, headId: 3, name: "Dowry Harassment (IPC 498A)",     seq: 3  },
  { id: 304, headId: 3, name: "Dowry Death (IPC 304B)",          seq: 4  },
  { id: 305, headId: 3, name: "Eve Teasing (IPC 509)",           seq: 5  },
  { id: 306, headId: 3, name: "Stalking (IPC 354D)",             seq: 6  },

  // 4 — Crimes Against Children
  { id: 401, headId: 4, name: "Child Abuse (POCSO)",             seq: 1  },
  { id: 402, headId: 4, name: "Child Labour",                    seq: 2  },
  { id: 403, headId: 4, name: "Child Kidnapping",                seq: 3  },

  // 5 — Economic Offences
  { id: 501, headId: 5, name: "Bank Fraud",                      seq: 1  },
  { id: 502, headId: 5, name: "Investment / Ponzi Fraud",        seq: 2  },
  { id: 503, headId: 5, name: "Forgery (IPC 463–471)",           seq: 3  },
  { id: 504, headId: 5, name: "Counterfeiting Currency",         seq: 4  },
  { id: 505, headId: 5, name: "GST / Tax Fraud",                 seq: 5  },

  // 6 — Cybercrime
  { id: 601, headId: 6, name: "Online Financial Fraud",          seq: 1  },
  { id: 602, headId: 6, name: "Cyber Harassment",                seq: 2  },
  { id: 603, headId: 6, name: "Identity Theft",                  seq: 3  },
  { id: 604, headId: 6, name: "Hacking / Data Breach",           seq: 4  },
  { id: 605, headId: 6, name: "Fake Social Media Profile",       seq: 5  },

  // 7 — Organised Crime
  { id: 701, headId: 7, name: "Gang / Syndicate Activity",       seq: 1  },
  { id: 702, headId: 7, name: "Human Trafficking",               seq: 2  },
  { id: 703, headId: 7, name: "Land Grabbing",                   seq: 3  },
  { id: 704, headId: 7, name: "Contract Killing",                seq: 4  },

  // 8 — Narcotics & Drugs
  { id: 801, headId: 8, name: "Ganja / Cannabis (NDPS)",         seq: 1  },
  { id: 802, headId: 8, name: "Heroin / Hard Drugs (NDPS)",      seq: 2  },
  { id: 803, headId: 8, name: "Psychotropic Substances",         seq: 3  },
  { id: 804, headId: 8, name: "Drug Trafficking",                seq: 4  },

  // 9 — Arms & Explosives
  { id: 901, headId: 9, name: "Unlicensed Arms (Arms Act)",      seq: 1  },
  { id: 902, headId: 9, name: "Explosives",                      seq: 2  },

  // 10 — Public Order
  { id: 1001, headId: 10, name: "Rioting (IPC 147–148)",         seq: 1  },
  { id: 1002, headId: 10, name: "Communal Violence",             seq: 2  },
  { id: 1003, headId: 10, name: "Unlawful Assembly (IPC 141)",   seq: 3  },

  // 11 — SC/ST
  { id: 1101, headId: 11, name: "Atrocity (SC/ST Act)",          seq: 1  },
  { id: 1102, headId: 11, name: "Discrimination",                seq: 2  },

  // 12 — Property & Environment
  { id: 1201, headId: 12, name: "Illegal Mining",                seq: 1  },
  { id: 1202, headId: 12, name: "Forest Offences",               seq: 2  },
  { id: 1203, headId: 12, name: "Encroachment",                  seq: 3  },

  // 13 — Traffic
  { id: 1301, headId: 13, name: "Drunk Driving",                 seq: 1  },
  { id: 1302, headId: 13, name: "Accident (Fatal)",              seq: 2  },
  { id: 1303, headId: 13, name: "Accident (Non-Fatal)",          seq: 3  },
  { id: 1304, headId: 13, name: "Motor Vehicles Act",            seq: 4  },

  // 14 — Other IPC
  { id: 1401, headId: 14, name: "Mischief (IPC 425–440)",        seq: 1  },
  { id: 1402, headId: 14, name: "Trespass (IPC 441–462)",        seq: 2  },
  { id: 1403, headId: 14, name: "Defamation (IPC 499–500)",      seq: 3  },
  { id: 1404, headId: 14, name: "Abetment (IPC 107–120)",        seq: 4  },

  // 15 — Special & Local Laws
  { id: 1501, headId: 15, name: "Karnataka Police Act",          seq: 1  },
  { id: 1502, headId: 15, name: "Prohibition Act",               seq: 2  },
  { id: 1503, headId: 15, name: "Gambling Act",                  seq: 3  },
  { id: 1504, headId: 15, name: "Other SLL",                     seq: 4  },
];

export async function POST(req: NextRequest) {
  const officer = await verifyOfficerRequest(req);
  if (!officer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isAdmin(officer.dashboardRole)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  if (!isCatalystConfigured()) {
    return NextResponse.json({ error: "Catalyst not configured" }, { status: 503 });
  }

  // Check existing rows to avoid duplicates
  const [existingHeads, existingSubHeads] = await Promise.all([
    getAllRows("CrimeHead"),
    getAllRows("CrimeSubHead"),
  ]);

  const existingHeadIds = new Set(
    existingHeads.map((r: any) => Number((r.CrimeHead || r).CrimeHeadID))
  );
  const existingSubIds = new Set(
    existingSubHeads.map((r: any) => Number((r.CrimeSubHead || r).CrimeSubHeadID))
  );

  const headsToInsert = CRIME_HEADS
    .filter((h) => !existingHeadIds.has(h.id))
    .map((h) => ({ CrimeHeadID: h.id, CrimeGroupName: h.name, Active: "true" }));

  const subHeadsToInsert = CRIME_SUBHEADS
    .filter((s) => !existingSubIds.has(s.id))
    .map((s) => ({
      CrimeSubHeadID: s.id,
      CrimeHeadID:    s.headId,
      CrimeHeadName:  s.name,
      SeqID:          s.seq,
    }));

  let headsInserted = 0;
  let subHeadsInserted = 0;

  if (headsToInsert.length > 0) {
    await insertRows("CrimeHead", headsToInsert);
    headsInserted = headsToInsert.length;
    invalidateTable("CrimeHead");
  }

  if (subHeadsToInsert.length > 0) {
    await insertRows("CrimeSubHead", subHeadsToInsert);
    subHeadsInserted = subHeadsToInsert.length;
    invalidateTable("CrimeSubHead");
  }

  return NextResponse.json({
    success: true,
    headsInserted,
    subHeadsInserted,
    headsSkipped: CRIME_HEADS.length - headsInserted,
    subHeadsSkipped: CRIME_SUBHEADS.length - subHeadsInserted,
  });
}
