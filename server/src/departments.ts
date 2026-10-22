import type { RequestKind } from "./types.js";

/**
 * Who handles what. A request belongs to exactly one department, decided by
 * its kind, so every request has a home and a manager can see all of them.
 */

export const DEPARTMENTS = ["front_desk", "room_service", "restaurant", "housekeeping", "laundry", "maintenance"] as const;
export type Department = (typeof DEPARTMENTS)[number];

export const DEPARTMENT_LABEL: Record<Department, string> = {
  front_desk: "Front desk",
  room_service: "Room service",
  restaurant: "Restaurant",
  housekeeping: "Housekeeping",
  laundry: "Laundry",
  maintenance: "Maintenance",
};

const OF_KIND: Record<RequestKind, Department> = {
  room_service: "room_service",
  restaurant: "restaurant",
  housekeeping: "housekeeping",
  amenities: "housekeeping",
  laundry: "laundry",
  maintenance: "maintenance",
  transport: "front_desk",
  late_checkout: "front_desk",
  early_checkin: "front_desk",
  other: "front_desk",
};

export const departmentOf = (kind: RequestKind): Department => OF_KIND[kind];
export const kindsOf = (department: Department): RequestKind[] => (Object.keys(OF_KIND) as RequestKind[]).filter((k) => OF_KIND[k] === department);
export const isDepartment = (v: unknown): v is Department => typeof v === "string" && (DEPARTMENTS as readonly string[]).includes(v);

export type Role = "owner" | "manager" | "staff";

/** What someone may do at a hotel. `department` is set only for people who work one department. */
export interface Access {
  role: Role;
  department: Department | null;
}
/** A department member sees their department and nothing else. */
export const isScoped = (a: Access): a is Access & { department: Department } => a.role === "staff" && a.department !== null;
export const canManage = (a: Access): boolean => a.role === "owner" || a.role === "manager";
