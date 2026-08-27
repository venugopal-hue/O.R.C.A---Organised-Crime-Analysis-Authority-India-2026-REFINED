/**
 * Lost, Stolen and Found property register.
 *
 * WHAT THIS IS, AND WHAT IT IS NOT
 *
 * A STANDALONE registry. A report here is not an FIR, is not linked to
 * `CaseMaster`, and creates no case. It records that someone reported property
 * missing or handed something in.
 *
 * `Seized` is deliberately NOT a status. Seizure happens under a case, with a
 * chain of custody, and that is the Evidence module. A seized item recorded
 * here as well would be a second record of the same object, free to disagree
 * with the first.
 *
 * EVERY MONETARY FIGURE IS DECLARED, NOT ASSESSED
 *
 * The value is what the owner said the item was worth. The column is named
 * `DeclaredUnitValue` so that even a reader of the raw table cannot mistake it
 * for a valuation the force stands behind. Nothing in this module computes,
 * verifies or endorses a price.
 */

export type ReportType = "LOST" | "STOLEN" | "FOUND";

export const REPORT_TYPES: readonly ReportType[] = ["LOST", "STOLEN", "FOUND"] as const;

export const REPORT_TYPE_LABELS: Record<string, string> = {
  LOST: "Lost — mislaid or missing, no offence alleged",
  STOLEN: "Stolen — taken unlawfully",
  FOUND: "Found — handed in or recovered without an owner",
};

/**
 * Report lifecycle. `WITHDRAWN` is separate from `CLOSED` on purpose: a report
 * the complainant took back is not the same as one the force finished with,
 * and collapsing them would lose why the file stopped.
 */
export const REPORT_STATUSES = [
  "OPEN",
  "UNDER_SEARCH",
  "PARTIALLY_RECOVERED",
  "RECOVERED",
  "CLOSED",
  "WITHDRAWN",
] as const;

export const REPORT_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  UNDER_SEARCH: "Under Search",
  PARTIALLY_RECOVERED: "Partially Recovered",
  RECOVERED: "Recovered",
  CLOSED: "Closed",
  WITHDRAWN: "Withdrawn",
};

/** Per-item state. The report says what happened; the item says where it is. */
export const ITEM_STATUSES = ["MISSING", "RECOVERED", "RETURNED"] as const;

export const ITEM_STATUS_LABELS: Record<string, string> = {
  MISSING: "Missing",
  RECOVERED: "Recovered",
  RETURNED: "Returned to owner",
};

// ── Categories and their identifiers ───────────────────────────────────────

export interface CategorySpec {
  /** Stored value. */
  name: string;
  /** What to call the identifier field when this category is chosen. */
  identifierLabel: string;
  /** Plain guidance for the officer filling it in. */
  identifierHint: string;
  /** Suggested identifier types for the dropdown. */
  identifierTypes: string[];
}

export const CATEGORIES: readonly CategorySpec[] = [
  {
    name: "Mobile Phones & Telephony",
    identifierLabel: "IMEI Number / SIM Serial",
    identifierHint: "15-digit IMEI 1 or IMEI 2, or the SIM card serial number.",
    identifierTypes: ["IMEI", "SIM Serial", "Serial Number"],
  },
  {
    name: "Electronics & Gadgets",
    identifierLabel: "Serial Number / Model",
    identifierHint: "Manufacturer serial number, model number, or engraved marks.",
    identifierTypes: ["Serial Number", "Model Number"],
  },
  {
    name: "Computers & IT Equipment",
    identifierLabel: "Serial No / Service Tag / MAC Address",
    identifierHint: "Manufacturer serial, service tag, or network interface MAC address.",
    identifierTypes: ["Serial Number", "Service Tag", "MAC Address"],
  },
  {
    name: "Vehicles & Motorized Transport",
    identifierLabel: "Registration / Chassis / Engine Number",
    identifierHint: "Registration number (e.g. KA-01-AB-1234), 17-character chassis/VIN, or engine number.",
    identifierTypes: ["Registration Number", "Chassis Number", "Engine Number"],
  },
  {
    name: "Jewellery, Precious Metals & Valuables",
    identifierLabel: "BIS Hallmark / Purity / Inscribed Marks",
    identifierHint: "Hallmark number, purity (22K / 24K), weight markings, or inscribed initials.",
    identifierTypes: ["Hallmark", "Purity", "Inscription"],
  },
  {
    name: "Cash & Financial Instruments",
    identifierLabel: "Denomination / Note Series & Prefix",
    identifierHint: "Denomination breakdown where known, and banknote prefix or serial sequence.",
    identifierTypes: ["Note Serial", "Cheque Number", "Instrument Number"],
  },
  {
    name: "Legal Documents & Certificates",
    identifierLabel: "Document Number / Issuing Authority",
    identifierHint: "Registration number, passport or PAN number, or certificate reference.",
    identifierTypes: ["Document Number", "Reference Number"],
  },
  {
    name: "Machinery & Industrial Equipment",
    identifierLabel: "Serial Number / Asset Tag",
    identifierHint: "Machine serial number, asset tag, or manufacturer plate details.",
    identifierTypes: ["Serial Number", "Asset Tag"],
  },
  {
    name: "Agricultural Property & Livestock",
    identifierLabel: "Tag / Brand / Registration",
    identifierHint: "Ear tag number, brand mark, or implement registration where one exists.",
    identifierTypes: ["Tag Number", "Registration Number"],
  },
  {
    name: "Weapons, Ammunition & Explosives",
    identifierLabel: "Weapon Serial / Licence Number",
    identifierHint: "Firearm serial number and the arms licence number it is held under.",
    identifierTypes: ["Serial Number", "Licence Number"],
  },
  {
    name: "Cyber & Digital Assets",
    identifierLabel: "Wallet Address / Transaction Hash",
    identifierHint: "Public wallet address, exchange account ID, or transaction hash.",
    identifierTypes: ["Wallet Address", "Transaction Hash", "Account ID"],
  },
  {
    name: "Household & Personal Belongings",
    identifierLabel: "Serial Number / Identifying Marks",
    identifierHint: "Any serial number, or distinctive marks, repairs or engravings.",
    identifierTypes: ["Serial Number", "Identifying Marks"],
  },
  {
    name: "Other Property",
    identifierLabel: "Serial Number / Identifying Marks",
    identifierHint: "Any number or physical mark that would distinguish this item from a similar one.",
    identifierTypes: ["Serial Number", "Identifying Marks"],
  },
] as const;

export const CATEGORY_NAMES: readonly string[] = CATEGORIES.map((c) => c.name);

export function categorySpec(name: string): CategorySpec | null {
  return CATEGORIES.find((c) => c.name === name) || null;
}

// ── Units ──────────────────────────────────────────────────────────────────

/**
 * Whether a unit can carry a fractional quantity.
 *
 * 2.5 kg of gold is a real entry; 2.5 mobile phones is not. A decimal count of
 * discrete items is rejected rather than rounded — rounding would silently
 * change what the complainant reported.
 */
export interface UnitSpec {
  name: string;
  decimal: boolean;
  hint: string;
}

export const UNITS: readonly UnitSpec[] = [
  { name: "Pieces", decimal: false, hint: "Whole numbers only — e.g. 3" },
  { name: "Nos.", decimal: false, hint: "Whole numbers only — e.g. 2" },
  { name: "Set", decimal: false, hint: "Whole numbers only — e.g. 1" },
  { name: "Pair", decimal: false, hint: "Whole numbers only — e.g. 1" },
  { name: "Units", decimal: false, hint: "Whole numbers only — e.g. 4" },
  { name: "Gram", decimal: true, hint: "Decimals allowed — e.g. 42.5 g" },
  { name: "Kg", decimal: true, hint: "Decimals allowed — e.g. 2.5 kg" },
  { name: "Litres", decimal: true, hint: "Decimals allowed — e.g. 12.75 L" },
  { name: "Metre", decimal: true, hint: "Decimals allowed — e.g. 3.4 m" },
] as const;

export const UNIT_NAMES: readonly string[] = UNITS.map((u) => u.name);

export function unitSpec(name: string): UnitSpec | null {
  return UNITS.find((u) => u.name === name) || null;
}

export const OWNER_ID_TYPES = [
  "Aadhaar",
  "PAN",
  "Voter ID",
  "Driving Licence",
  "Passport",
  "Ration Card",
  "Other",
] as const;

// ── Limits ─────────────────────────────────────────────────────────────────

export const LIMITS = {
  ownerName: 160,
  ownerContact: 60,
  ownerAddress: 400,
  ownerIdNumber: 60,
  place: 300,
  narrative: 6000,
  description: 2000,
  identifier: 120,
  remarks: 1000,
  firReference: 80,
  closureNote: 2000,
  itemsPerReport: 100,
} as const;

// ── Identifier normalisation and matching ──────────────────────────────────

/**
 * Strip an identifier to the form matching compares.
 *
 * Uppercased, with everything that is not a letter or digit removed, so
 * "KA-01-AB-1234", "KA 01 AB 1234" and "ka01ab1234" all reduce to the same
 * string. Stored alongside the raw value the officer typed, which is never
 * altered.
 */
export function normaliseIdentifier(value: string): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Identifiers too short or too generic to be evidence of anything.
 *
 * A four-character "serial" matches half the register by coincidence. Matching
 * on one would produce a confident-looking link between two unrelated reports,
 * which is the failure this whole platform has been removing.
 */
export const MIN_MATCHABLE_IDENTIFIER = 6;

export function isMatchable(normalised: string): boolean {
  if (normalised.length < MIN_MATCHABLE_IDENTIFIER) return false;
  // All-same-character strings ("000000", "AAAAAA") are placeholders, not ids.
  if (/^(.)\1*$/.test(normalised)) return false;
  return true;
}

// ── Money ──────────────────────────────────────────────────────────────────

/**
 * Format a declared value in Indian numbering.
 *
 * Takes a string because that is how the value is stored — parsing to a float
 * and back loses precision on large sums, and multi-crore totals are exactly
 * the case that matters.
 */
export function formatRupees(value: number): string {
  if (!Number.isFinite(value)) return "₹ 0";
  return "₹ " + value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

/** Parse a stored numeric string. Returns null when it is not a number. */
export function toNumber(value: unknown): number | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Row total = quantity x declared unit value. Never stored — always derived. */
export function rowTotal(quantity: unknown, unitValue: unknown): number {
  const q = toNumber(quantity);
  const v = toNumber(unitValue);
  if (q === null || v === null || q < 0 || v < 0) return 0;
  return q * v;
}

// ── Validation ─────────────────────────────────────────────────────────────

export interface PropertyItemInput {
  category: string;
  itemDescription: string;
  quantity: string;
  quantityUnit: string;
  declaredUnitValue: string;
  identifierType: string;
  identifierValue: string;
  remarks: string;
}

export interface ReportInput {
  reportType: ReportType;
  incidentFrom: string;
  incidentTo: string;
  placeOfIncident: string;
  districtId: string;
  unitId: string;
  ownerName: string;
  ownerContact: string;
  ownerAddress: string;
  ownerIdType: string;
  ownerIdNumber: string;
  narrative: string;
  firReference: string;
  items: PropertyItemInput[];
}

export interface Validation {
  ok: boolean;
  error?: string;
  /** Index of the offending item, when the failure is on a row. */
  itemIndex?: number;
  value?: ReportInput;
}

const clean = (v: unknown, max: number) =>
  String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

const cleanMultiline = (v: unknown, max: number) =>
  String(v ?? "").replace(/\r\n/g, "\n").trim().slice(0, max);

export function validateReport(body: Record<string, unknown>): Validation {
  const reportType = String(body.reportType ?? "").toUpperCase() as ReportType;
  if (!REPORT_TYPES.includes(reportType)) {
    return { ok: false, error: "Select whether the property was lost, stolen or found." };
  }

  const placeOfIncident = clean(body.placeOfIncident, LIMITS.place);
  const districtId = clean(body.districtId, 12);
  const unitId = clean(body.unitId, 12);
  const ownerName = clean(body.ownerName, LIMITS.ownerName);
  const ownerContact = clean(body.ownerContact, LIMITS.ownerContact);
  const ownerAddress = clean(body.ownerAddress, LIMITS.ownerAddress);
  const ownerIdType = clean(body.ownerIdType, 60);
  const ownerIdNumber = clean(body.ownerIdNumber, LIMITS.ownerIdNumber);
  const narrative = cleanMultiline(body.narrative, LIMITS.narrative);
  const firReference = clean(body.firReference, LIMITS.firReference);
  const incidentFrom = clean(body.incidentFrom, 32);
  const incidentTo = clean(body.incidentTo, 32);

  if (!placeOfIncident) {
    return { ok: false, error: "Place of incident is required." };
  }
  if (!districtId) return { ok: false, error: "Select a district." };
  if (!unitId) return { ok: false, error: "Select a police station." };

  /*
   * A FOUND report has no owner yet — that is the point of it. Requiring a
   * name would force the officer to invent one, so it is optional there and
   * required on a lost or stolen report, where someone is standing at the desk.
   */
  if (reportType !== "FOUND" && !ownerName) {
    return { ok: false, error: "Owner or complainant name is required." };
  }
  if (reportType !== "FOUND" && !ownerContact) {
    return { ok: false, error: "A contact number is required to reach the owner." };
  }

  if (!incidentFrom) {
    return { ok: false, error: "State when the property went missing or was found." };
  }
  if (incidentTo && incidentTo < incidentFrom) {
    return { ok: false, error: "The end of the window cannot be before its start." };
  }

  const rawItems = Array.isArray(body.items) ? body.items : [];
  if (!rawItems.length) {
    return { ok: false, error: "Add at least one item to the report." };
  }
  if (rawItems.length > LIMITS.itemsPerReport) {
    return { ok: false, error: `A report may hold at most ${LIMITS.itemsPerReport} items.` };
  }

  const items: PropertyItemInput[] = [];
  for (let i = 0; i < rawItems.length; i++) {
    const raw = (rawItems[i] || {}) as Record<string, unknown>;
    const category = clean(raw.category, 80);
    const itemDescription = cleanMultiline(raw.itemDescription, LIMITS.description);
    const quantity = clean(raw.quantity, 24);
    const quantityUnit = clean(raw.quantityUnit, 24);
    const declaredUnitValue = clean(raw.declaredUnitValue, 24);
    const identifierType = clean(raw.identifierType, 60);
    const identifierValue = clean(raw.identifierValue, LIMITS.identifier);
    const remarks = cleanMultiline(raw.remarks, LIMITS.remarks);

    if (!CATEGORY_NAMES.includes(category)) {
      return { ok: false, error: "Select a category for this item.", itemIndex: i };
    }
    if (itemDescription.length < 3) {
      return { ok: false, error: "Describe the item in at least 3 characters.", itemIndex: i };
    }

    const unit = unitSpec(quantityUnit);
    if (!unit) return { ok: false, error: "Select a unit for the quantity.", itemIndex: i };

    const q = toNumber(quantity);
    if (q === null) return { ok: false, error: "Quantity must be a number.", itemIndex: i };
    if (q <= 0) return { ok: false, error: "Quantity must be greater than zero.", itemIndex: i };
    if (!unit.decimal && !Number.isInteger(q)) {
      return {
        ok: false,
        error: `Quantity in ${unit.name} must be a whole number.`,
        itemIndex: i,
      };
    }

    const v = toNumber(declaredUnitValue);
    if (v === null) {
      return { ok: false, error: "Declared value must be a number.", itemIndex: i };
    }
    // Zero is allowed: an identity card or a deed has no market value, and
    // forcing a figure would invent one.
    if (v < 0) {
      return { ok: false, error: "Declared value cannot be negative.", itemIndex: i };
    }

    items.push({
      category, itemDescription, quantity, quantityUnit,
      declaredUnitValue, identifierType, identifierValue, remarks,
    });
  }

  return {
    ok: true,
    value: {
      reportType, incidentFrom, incidentTo, placeOfIncident, districtId, unitId,
      ownerName, ownerContact, ownerAddress, ownerIdType, ownerIdNumber,
      narrative, firReference, items,
    },
  };
}

/** Reference number: `PROP-2026-00001`. Officer-only registry, so no secret suffix. */
export function buildReference(serial: number, when: Date = new Date()): string {
  return `PROP-${when.getFullYear()}-${String(serial).padStart(5, "0")}`;
}
