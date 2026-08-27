/**
 * What a valid evidence registration looks like.
 *
 * Deliberately dependency-free so the SAME rules run in the browser and on the
 * server. The form used to check one field (`eventTypeId`) and the API checked
 * a different set, which is how a form can pass and a request still fail —
 * there was no single answer to "is this complete?".
 *
 * DECISION (user, 2026-08-24): every field on the register form is mandatory
 * for every evidence category. A partially recorded exhibit is the kind of gap
 * that gets an item excluded in court, so the form no longer accepts one.
 *
 * The single exception is Vehicle Number, which is conditional: mandatory when
 * the evidence IS a vehicle. A knife has no registration mark, and forcing a
 * placeholder into that column would put fiction into the record.
 *
 * The FORM shows that field only for the Vehicle type and clears it when the
 * type changes away, so a non-vehicle registered through the UI never carries
 * one. This module stays permissive rather than rejecting a mark on a
 * non-vehicle: the column already holds values written before the field was
 * conditional, and a validator that refused them would make those rows
 * un-editable. Absence is enforced by the form; presence is simply not an error.
 */

/** The evidence type whose registration mark is required. Matched by NAME. */
export const VEHICLE_TYPE_NAME = "Vehicle";

/**
 * Resolve "is this a vehicle" through the lookup table rather than a literal id.
 *
 * `EvidenceTypeID = 7` is Vehicle today, but the seed order is not a contract —
 * reloading reference data could renumber it, and then a hardcoded 7 would
 * silently start demanding a registration number for, say, narcotics.
 */
export function isVehicleType(
  evidenceTypeId: string | number | null | undefined,
  types: { id: number; name: string }[] | undefined | null
): boolean {
  if (evidenceTypeId === null || evidenceTypeId === undefined || evidenceTypeId === "") return false;
  const id = Number(evidenceTypeId);
  if (!Number.isFinite(id)) return false;
  const match = (types || []).find((t) => t.id === id);
  return (match?.name || "").trim().toLowerCase() === VEHICLE_TYPE_NAME.toLowerCase();
}

/** Field key -> the label the officer sees, so errors name the right control. */
export const EVIDENCE_FIELD_LABELS: Record<string, string> = {
  caseMasterId: "Linked Case / FIR",
  evidenceTypeId: "Evidence Type",
  collectedAt: "Collected On",
  sealNumber: "Seal / Packet Number",
  quantity: "Quantity / Count",
  collectedByEmployeeId: "Collected By",
  custodianEmployeeId: "Initial Custodian",
  eventTypeId: "Opening Custody Event",
  description: "Description",
  collectionPlace: "Place of Collection",
  latitude: "Latitude",
  longitude: "Longitude",
  vehicleNumber: "Vehicle Number",
};

/** Every field required regardless of category. Order matches the form. */
export const ALWAYS_REQUIRED = [
  "caseMasterId",
  "evidenceTypeId",
  "collectedAt",
  "sealNumber",
  "quantity",
  "collectedByEmployeeId",
  "custodianEmployeeId",
  "eventTypeId",
  "description",
  "collectionPlace",
  "latitude",
  "longitude",
] as const;

export interface EvidenceFormValues {
  [key: string]: string | number | null | undefined;
}

export interface ValidationResult {
  /** Field key -> message. Empty when the form is complete. */
  errors: Record<string, string>;
  ok: boolean;
  /** Whether Vehicle Number is required for the currently selected type. */
  vehicleRequired: boolean;
}

const blank = (v: unknown) => v === null || v === undefined || String(v).trim() === "";

/**
 * Coordinates are required, so they must also be VALID — a required field that
 * accepts "abc" is a required field in name only. Ranges are the real ones:
 * latitude is ±90, longitude ±180.
 */
const coordinateError = (raw: unknown, kind: "latitude" | "longitude"): string => {
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n)) return "Enter a number, or pick the point on the map.";
  const limit = kind === "latitude" ? 90 : 180;
  if (n < -limit || n > limit) return `Must be between -${limit} and ${limit}.`;
  return "";
};

export function validateEvidenceForm(
  form: EvidenceFormValues,
  types: { id: number; name: string }[] | undefined | null
): ValidationResult {
  const errors: Record<string, string> = {};

  for (const key of ALWAYS_REQUIRED) {
    if (blank(form[key])) {
      errors[key] = `${EVIDENCE_FIELD_LABELS[key]} is required.`;
    }
  }

  if (!errors.latitude) {
    const e = coordinateError(form.latitude, "latitude");
    if (e) errors.latitude = e;
  }
  if (!errors.longitude) {
    const e = coordinateError(form.longitude, "longitude");
    if (e) errors.longitude = e;
  }

  const vehicleRequired = isVehicleType(form.evidenceTypeId, types);
  if (vehicleRequired && blank(form.vehicleNumber)) {
    errors.vehicleNumber = "Vehicle Number is required when the evidence is a vehicle.";
  }

  return { errors, ok: Object.keys(errors).length === 0, vehicleRequired };
}
