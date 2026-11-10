/**
 * Who counts as CIG staff (spec 03, "Staff identification"): a member whose badges carry a staff
 * badge, or whose handle is on `staff.json`, kept by hand. Nothing is guessed from a name.
 */

/** Badge names Spectrum gives CIG staff; a badge is matched whole, case aside. */
export const STAFF_BADGES: readonly string[] = [
  "Staff",
  "CIG Staff",
  "Developer",
  "Community Manager",
  "Community Team",
];

export interface StaffList {
  readonly handles: readonly string[];
}

export function isStaff(
  member: { readonly handle: string; readonly badges: readonly string[] },
  list: StaffList,
): { readonly staff: boolean; readonly role: string | null } {
  const badge = member.badges.find((b) =>
    STAFF_BADGES.some((s) => s.toLowerCase() === b.trim().toLowerCase()),
  );
  if (badge !== undefined) return { staff: true, role: badge.trim() };
  const listed = list.handles.some(
    (h) => h.toLowerCase() === member.handle.toLowerCase(),
  );
  return { staff: listed, role: null };
}
