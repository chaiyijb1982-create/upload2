// =====================================================
// lib/loan-calculations.ts
//
// 贷款纯计算函数
//
// /loan 页面 与 loan-auto-payment Cron 共用。
//
// 来源：
// app/loan/page.tsx 原 calculateRemainingPeriods /
// calculateRemainingTotal / calculateFinalPaymentDate
//
// 原样抽取，未改变任何公式与计算结果。
//
// 注意：
// 本文件必须是纯函数，禁止引入 supabase。
// =====================================================

// =====================================================
// 剩余期数
//
// 逻辑：
// 1. 已有最后还款日期 → 按 end_date 与今天的月差
// 2. 否则根据本金、利率、月供反推剩余期数
// =====================================================

export function calculateRemainingPeriods(
  loan: any
) {
  const now = new Date();

  // ---------------------------------------------------
  // 1. 已有最后还款日期
  // ---------------------------------------------------

  if (loan.end_date) {
    const end = new Date(
      `${loan.end_date}T23:59:59`
    );

    if (end.getTime() <= now.getTime()) {
      return 0;
    }

    const yearDiff =
      end.getFullYear() -
      now.getFullYear();

    const monthDiff =
      end.getMonth() -
      now.getMonth();

    const months =
      yearDiff * 12 +
      monthDiff;

    return Math.max(
      0,
      months +
        (
          end.getDate() >=
          now.getDate()
            ? 1
            : 0
        )
    );
  }

  // ---------------------------------------------------
  // 2. 根据本金、利率、月供反推剩余期数
  // ---------------------------------------------------

  const balance =
    Number(
      loan.remaining_amount || 0
    );

  const payment =
    Number(
      loan.monthly_payment || 0
    );

  if (
    balance <= 0 ||
    payment <= 0
  ) {
    return 0;
  }

  const annualRate =
    Number(
      loan.interest_rate || 0
    );

  const monthlyRate =
    annualRate /
    100 /
    12;

  // ---------------------------------------------------
  // 3. 无利息
  // ---------------------------------------------------

  if (monthlyRate <= 0) {
    return Math.ceil(
      balance /
      payment
    );
  }

  // ---------------------------------------------------
  // 4. 月供不足以覆盖当月利息
  // ---------------------------------------------------

  if (
    payment <=
    balance *
    monthlyRate
  ) {
    return 0;
  }

  // ---------------------------------------------------
  // 5. 标准等额还款公式
  // ---------------------------------------------------

  const periods =
    -Math.log(
      1 -
        (
          balance *
          monthlyRate /
          payment
        )
    ) /
    Math.log(
      1 +
        monthlyRate
    );

  if (
    !Number.isFinite(
      periods
    )
  ) {
    return 0;
  }

  return Math.ceil(
    periods
  );
}

// =====================================================
// 剩余应还
//
// remaining_total = monthly_payment × remaining_periods
//
// 仅 loan_mode === "fixed" 且 payment > 0 时按此计算，
// 其余返回 remaining_amount。
// =====================================================

export function calculateRemainingTotal(
  loan: any
) {
  const periods =
    calculateRemainingPeriods(
      loan
    );

  const payment =
    Number(
      loan.monthly_payment || 0
    );

  if (
    loan.loan_mode === "fixed" &&
    payment > 0
  ) {
    return (
      payment *
      periods
    );
  }

  return Number(
    loan.remaining_amount || 0
  );
}

// =====================================================
// 最后还款日期
// =====================================================

export function calculateFinalPaymentDate(
  loan: any
) {
  if (loan.end_date) {
    return loan.end_date;
  }

  const periods =
    calculateRemainingPeriods(
      loan
    );

  if (
    periods <= 0
  ) {
    return "-";
  }

  const date =
    new Date();

  date.setMonth(
    date.getMonth() +
      periods
  );

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return (
    `${year}-${month}-${day}`
  );
}
