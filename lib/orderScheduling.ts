import { ordersRepo } from './data/repository';

const BASE_DAYS = 2;
const DAYS_PER_GARMENT = 1;
const BACKLOG_DAYS_PER_OPEN_ORDER = 0.5;

/** Advances a date by N calendar days, skipping Sundays (the shop's default off day). */
function addWorkingDays(start: Date, days: number): Date {
  const result = new Date(start);
  let remaining = Math.ceil(days);
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== 0) remaining -= 1;
  }
  return result;
}

/**
 * Suggests a delivery date from today based on garment count and the
 * assigned staff member's current open-order backlog. Always a suggestion —
 * the caller pre-fills the date picker with it but the user can override.
 */
export async function suggestDeliveryDate(
  shopId: string,
  garmentCount: number,
  assignedStaffId: string | null
): Promise<Date> {
  let backlogDays = 0;
  if (assignedStaffId) {
    const counts = await ordersRepo.openOrderCountByStaff(shopId);
    backlogDays = (counts[assignedStaffId] ?? 0) * BACKLOG_DAYS_PER_OPEN_ORDER;
  }
  const totalDays = BASE_DAYS + garmentCount * DAYS_PER_GARMENT + backlogDays;
  return addWorkingDays(new Date(), totalDays);
}
