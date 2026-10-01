import {
  getLoans,
} from "@/lib/loan";

import {
  calculateRemainingPeriods,
} from "@/lib/loan-calculations";

// =====================================================
// 信用卡分期每月应还合计
//
// 返回：
// Map {
//   "2026-10" => 12345,
//   "2026-11" => 12345,
//   ...
// }
// =====================================================

export async function getCreditCardMonthlyMap() {
  const loans = await getLoans();

  const map = new Map<string, number>();

  const today = new Date();

  for (const loan of loans || []) {
    if (loan.type !== "信用卡分期") {
      continue;
    }

    const monthly = Number(
      loan.monthly_payment || 0
    );

    if (monthly <= 0) {
      continue;
    }

    let periods = 0;

    let startDate: Date | null = null;

    if (loan.start_date) {
      startDate = new Date(loan.start_date);
    }

    if (loan.end_date) {
      const end = new Date(loan.end_date);

      const start = startDate || today;

      periods =
        (end.getFullYear() -
          start.getFullYear()) *
          12 +
        (end.getMonth() -
          start.getMonth()) +
        1;
    } else {
      periods =
        calculateRemainingPeriods(loan);

      startDate = today;
    }

    if (!startDate || periods <= 0) {
      continue;
    }

    for (let i = 0; i < periods; i++) {
      const d = new Date(startDate);

      d.setMonth(d.getMonth() + i);

      const key = `${d.getFullYear()}-${String(
        d.getMonth() + 1
      ).padStart(2, "0")}`;

      map.set(
        key,
        (map.get(key) || 0) + monthly
      );
    }
  }

  return map;
}

// =====================================================
// 取某年某月的信用卡分期应还
// =====================================================

export async function getCreditCardMonthlyAmount(
  year: number,
  month: number
) {
  const map = await getCreditCardMonthlyMap();

  const key = `${year}-${String(month).padStart(
    2,
    "0"
  )}`;

  return map.get(key) || 0;
}