// 由 credit-card-from-yu 页面的「信用卡总消费」算法抽出，
// 供 CASHFLOW-SALARY 等页面复用，保证两个页面数字一致。
// 口径：账单周期 · CNY；自己消费 + 替别人先付 = 信用卡总消费；另加分期月供。

import {
  getCreditCards,
  type CreditCard,
} from "@/lib/credit-card";

import {
  getExpenseTransactions,
  type ExpenseTransaction,
} from "@/lib/expense-transactions";

import {
  calculateRemainingPeriods,
  calculateFinalPaymentDate,
} from "@/lib/loan-calculations";

import { supabase } from "@/lib/supabase";

interface LoanRow {
  id?: string;
  name?: string | null;
  type?: string | null;
  institution?: string | null;
  monthly_payment?: number | string | null;
  remaining_amount?: number | string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  remaining_periods?: number | string | null;
  total_periods?: number | string | null;
  [key: string]: any;
}

function formatMoney(
  value: number
): string {

  return `¥${Math.round(
    Number(value || 0)
  ).toLocaleString("zh-CN")}`;

}


// =====================================================
// 当前月份
// =====================================================

function getCurrentMonth(): string {

  const now =
    new Date();

  return (
    `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`
  );

}


// =====================================================
// 月份范围
// =====================================================

function getTransactionLoadRange(
  month: string
) {

  const match =
    /^(\d{4})-(\d{2})$/.exec(
      month
    );

  if (!match) {

    return null;

  }

  const year =
    Number(match[1]);

  const monthNumber =
    Number(match[2]);

  if (
    !year ||
    monthNumber < 1 ||
    monthNumber > 12
  ) {

    return null;

  }

  const start =
    new Date(
      year,
      monthNumber - 2,
      1
    );

  const end =
    new Date(
      year,
      monthNumber,
      1
    );

  return {
    start,
    end,
  };

}


// =====================================================
// 月份区间（用于判断某月是否在还款期内）
// =====================================================

function getMonthRange(
  month: string
): {
  start: Date;
  end: Date;
} | null {

  const match =
    /^(\d{4})-(\d{2})$/.exec(
      month
    );

  if (!match) {

    return null;

  }

  const year =
    Number(match[1]);

  const monthNumber =
    Number(match[2]);

  if (
    !year ||
    monthNumber < 1 ||
    monthNumber > 12
  ) {

    return null;

  }

  const start =
    new Date(
      year,
      monthNumber - 1,
      1
    );

  const end =
    new Date(
      year,
      monthNumber,
      0,
      23,
      59,
      59,
      999
    );

  return {
    start,
    end,
  };

}


// =====================================================
// 日期解析
// =====================================================

function parseDate(
  value: unknown
): Date | null {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return null;

  }

  if (
    value instanceof Date
  ) {

    return Number.isNaN(
      value.getTime()
    )
      ? null
      : new Date(value);

  }

  const text =
    String(value).trim();

  if (!text) {

    return null;

  }

  const dateOnlyMatch =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      text
    );

  if (dateOnlyMatch) {

    const date =
      new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3])
      );

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;

  }

  const parsed =
    new Date(text);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {

    return null;

  }

  return parsed;

}


// =====================================================
// 判断是否消费
// =====================================================

function isExpense(
  item: ExpenseTransaction
): boolean {

  if (item.is_settlement) {
    return false;
  }

  const type =
    item.income_expense_type ||
    "";

  if (type.includes("收入")) {
    return false;
  }

  return (
    item.consumption_type === "self" ||
    item.consumption_type === "paid_for_others"
  );
}


// =====================================================
// 信用卡名称
// =====================================================

function getAccountName(
  card: CreditCard
): string {

  const value =
    (card as any).card_name ??
    (card as any).account_name ??
    (card as any).name ??
    "";

  return String(
    value
  ).trim();

}


// =====================================================
// 信用卡银行
// =====================================================

function getCardBankName(
  card: CreditCard
): string {

  return String(
    (card as any).bank_name ??
    ""
  ).trim();

}


// =====================================================
// 数字转换
// =====================================================

function toNumber(
  value: unknown
): number {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return 0;

  }

  if (
    typeof value === "number"
  ) {

    return Number.isFinite(value)
      ? value
      : 0;

  }

  const text =
    String(value)
      .replace(/,/g, "")
      .replace(/¥/g, "")
      .replace(/\s/g, "")
      .trim();

  const number =
    Number(text);

  return Number.isFinite(number)
    ? number
    : 0;

}


// =====================================================
// 名称标准化
// =====================================================

function normalizeName(
  value: unknown
): string {

  return String(
    value ?? ""
  )
    .trim()
    .replace(/\s+/g, "")
    .replace(
      /（/g,
      "("
    )
    .replace(
      /）/g,
      ")"
    )
    .toLowerCase();

}


// =====================================================
// 银行名称标准化
// =====================================================

function normalizeBankName(
  value: unknown
): string {

  let name =
    normalizeName(
      value
    );

  if (!name) {

    return "";

  }

  name =
    name.replace(
      /信用卡/g,
      ""
    );

  name =
    name.replace(
      /银行/g,
      ""
    );

  if (
    name === "工行"
  ) {

    return "工商";

  }

  if (
    name === "建行"
  ) {

    return "建设";

  }

  if (
    name === "中行"
  ) {

    return "中国";

  }

  if (
    name === "交行"
  ) {

    return "交通";

  }

  if (
    name === "招行"
  ) {

    return "招商";

  }

  if (
    name === "中信"
  ) {

    return "中信";

  }

  if (
    name === "宁波"
  ) {

    return "宁波";

  }

  return name;

}


// =====================================================
// LOANS：获取月供
// =====================================================

function getLoanMonthlyPayment(
  loan: LoanRow
): number {

  return Math.abs(
    toNumber(
      loan.monthly_payment
    )
  );

}


// =====================================================
// LOANS：判断信用卡分期
// =====================================================

function isCreditCardInstallment(
  loan: LoanRow
): boolean {

  return (
    String(
      loan.type ??
      ""
    ).trim() ===
    "信用卡分期"
  );

}


// =====================================================
// LOANS：银行匹配
// =====================================================

function loanMatchesCard(
  loan: LoanRow,
  card: CreditCard
): boolean {

  const loanInstitution =
    normalizeBankName(
      loan.institution
    );

  const cardBank =
    normalizeBankName(
      getCardBankName(
        card
      )
    );

  if (
    !loanInstitution ||
    !cardBank
  ) {

    return false;

  }

  return (
    loanInstitution ===
    cardBank
  );

}


// =====================================================
// LOANS：判断当前月份是否在还款期内
//
// 规则：
// 1. 有 start_date：month 月末 < start_date，说明还没开始，不计入
// 2. 有 end_date：month 月初 > end_date，说明已经结束，不计入
// 3. 没有 end_date：
//    优先使用 loan-calculations 的 calculateFinalPaymentDate
//    再用 calculateRemainingPeriods 兜底
// =====================================================

function isLoanActiveInMonth(
  loan: LoanRow,
  month: string
): boolean {

  const monthRange =
    getMonthRange(month);

  if (!monthRange) {

    return false;

  }

  const monthStart =
    monthRange.start;

  const monthEnd =
    monthRange.end;

  const startDate =
    parseDate(
      loan.start_date
    );

  const endDate =
    parseDate(
      loan.end_date
    );

  // 还没开始
  if (
    startDate &&
    monthEnd.getTime() <
      startDate.getTime()
  ) {

    return false;

  }

  // 已经结束（显式 end_date）
  if (
    endDate &&
    monthStart.getTime() >
      endDate.getTime()
  ) {

    return false;

  }

  // 没有 end_date：用 loan-calculations 反推
  if (!endDate) {

    try {

      const finalDateText =
        calculateFinalPaymentDate(
          loan
        );

      const finalDate =
        parseDate(
          finalDateText
        );

      if (
        finalDate &&
        monthStart.getTime() >
          finalDate.getTime()
      ) {

        return false;

      }

    } catch (error) {

      console.error(
        "calculateFinalPaymentDate 失败:",
        error,
        loan
      );

    }

    try {

      const remainingPeriods =
        calculateRemainingPeriods(
          loan
        );

      if (
        remainingPeriods <= 0
      ) {

        return false;

      }

    } catch (error) {

      console.error(
        "calculateRemainingPeriods 失败:",
        error,
        loan
      );

    }

  }

  return true;

}


// =====================================================
// 排序按钮
// =====================================================


function getBillingDay(
  card: CreditCard
): number {

  return Math.floor(
    toNumber(
      (card as any).billing_day ??
      (card as any).bill_day
    )
  );

}


// =====================================================
// 获取还款日
// =====================================================

function getPaymentDay(
  card: CreditCard
): number {

  return Math.floor(
    toNumber(
      (card as any).payment_day ??
      (card as any).repayment_day
    )
  );

}


// =====================================================
// 获取实际账单日
// =====================================================

function getBillingDate(
  year: number,
  monthIndex: number,
  billingDay: number
): Date | null {

  if (
    !Number.isFinite(billingDay) ||
    billingDay < 1
  ) {

    return null;

  }

  const lastDay =
    new Date(
      year,
      monthIndex + 1,
      0
    ).getDate();

  const actualDay =
    Math.min(
      billingDay,
      lastDay
    );

  return new Date(
    year,
    monthIndex,
    actualDay
  );

}


// =====================================================
// 获取某张卡账单周期
// =====================================================

function getCardBillingCycle(
  month: string,
  billingDay: number
): {
  start: Date;
  end: Date;
} | null {

  const match =
    /^(\d{4})-(\d{2})$/.exec(
      month
    );

  if (!match) {

    return null;

  }

  const year =
    Number(match[1]);

  const monthNumber =
    Number(match[2]);

  if (
    !year ||
    monthNumber < 1 ||
    monthNumber > 12
  ) {

    return null;

  }

  const currentBillingDate =
    getBillingDate(
      year,
      monthNumber - 1,
      billingDay
    );

  if (!currentBillingDate) {

    return null;

  }

  const previousBillingDate =
    getBillingDate(
      monthNumber === 1
        ? year - 1
        : year,
      monthNumber === 1
        ? 11
        : monthNumber - 2,
      billingDay
    );

  if (!previousBillingDate) {

    return null;

  }

  const start =
    new Date(
      previousBillingDate
    );

  start.setDate(
    start.getDate() + 1
  );

  const end =
    new Date(
      currentBillingDate
    );

  return {
    start,
    end,
  };

}


// =====================================================
// 获取交易日期
// =====================================================

function getTransactionDate(
  item: ExpenseTransaction
): Date | null {

  const raw =
    (item as any).transaction_time ??
    (item as any).transaction_date ??
    (item as any).expense_date ??
    (item as any).date ??
    (item as any).transactionDate ??
    (item as any).occurred_at ??
    (item as any).created_at;

  if (
    raw === null ||
    raw === undefined ||
    raw === ""
  ) {

    return null;

  }

  if (
    raw instanceof Date
  ) {

    if (
      Number.isNaN(
        raw.getTime()
      )
    ) {

      return null;

    }

    return new Date(raw);

  }

  const text =
    String(raw).trim();

  if (!text) {

    return null;

  }

  const dateOnlyMatch =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      text
    );

  if (dateOnlyMatch) {

    const year =
      Number(
        dateOnlyMatch[1]
      );

    const month =
      Number(
        dateOnlyMatch[2]
      );

    const day =
      Number(
        dateOnlyMatch[3]
      );

    const date =
      new Date(
        year,
        month - 1,
        day
      );

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;

  }

  const dateTimeMatch =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(
      text
    );

  if (dateTimeMatch) {

    const year =
      Number(
        dateTimeMatch[1]
      );

    const month =
      Number(
        dateTimeMatch[2]
      );

    const day =
      Number(
        dateTimeMatch[3]
      );

    const hour =
      Number(
        dateTimeMatch[4]
      );

    const minute =
      Number(
        dateTimeMatch[5]
      );

    const second =
      Number(
        dateTimeMatch[6] || 0
      );

    const date =
      new Date(
        year,
        month - 1,
        day,
        hour,
        minute,
        second
      );

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;

  }

  const parsed =
    new Date(text);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {

    return null;

  }

  return parsed;

}


// =====================================================
// 日期归一化
// =====================================================

function startOfDay(
  date: Date
): Date {

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );

}


// =====================================================
// 判断日期是否在周期内
// =====================================================

function isDateInBillingCycle(
  transactionDate: Date,
  cycleStart: Date,
  cycleEnd: Date
): boolean {

  const date =
    startOfDay(
      transactionDate
    );

  const start =
    startOfDay(
      cycleStart
    );

  const end =
    startOfDay(
      cycleEnd
    );

  return (
    date.getTime() >=
    start.getTime()
    &&
    date.getTime() <=
    end.getTime()
  );

}


// =====================================================
// 格式化日期
// =====================================================

function formatDate(
  date: Date | null
): string {

  if (!date) {

    return "-";

  }

  return (
    `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`
  );

}


// =====================================================
// 格式化交易日期
// =====================================================

function formatTransactionDate(
  date: Date | null
): string {

  if (!date) {

    return "-";

  }

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      date.getDate()
    ).padStart(2, "0");

  const hour =
    String(
      date.getHours()
    ).padStart(2, "0");

  const minute =
    String(
      date.getMinutes()
    ).padStart(2, "0");

  return `${year}-${month}-${day} ${hour}:${minute}`;

}


// =====================================================
// 获取账目分类
//
// 兼容 expense_transactions 中不同字段名称
// 优先级：
//
// account_category
// category
// category_name
// expense_category
// 账目分类
// =====================================================

function getTransactionCategory(
  item: ExpenseTransaction
): string {

  const value =
    (item as any).account_category ??
    (item as any).category ??
    (item as any).category_name ??
    (item as any).expense_category ??
    (item as any)["账目分类"] ??
    "";

  return String(
    value
  ).trim();

}


// =====================================================
// 获取交易描述
//
// 尽量兼容 expense_transactions 中不同字段
// =====================================================

function getTransactionDescription(
  item: ExpenseTransaction
): string {

  const value =
    (item as any).merchant_name ??
    (item as any).merchant ??
    (item as any).description ??
    (item as any).remark ??
    (item as any).memo ??
    (item as any).title ??
    (item as any).name ??
    "";

  return String(
    value
  ).trim();

}


// =====================================================
// 获取消费类型文字
// =====================================================

function getConsumptionTypeLabel(
  item: ExpenseTransaction
): string {

  if (
    item.consumption_type ===
    "paid_for_others"
  ) {

    return "替别人先付";

  }

  if (
    item.consumption_type ===
    "self"
  ) {

    return "自己消费";

  }

  return "-";

}


// =====================================================
// 页面

// =====================================================
// 单卡：账单周期内消费（自己 / 替别人先付）
// =====================================================

function getExcelExpenseForCardPure(
  card: CreditCard,
  month: string,
  transactions: ExpenseTransaction[]
) {
  const accountName = getAccountName(card);
  const cardBank = getCardBankName(card);

  if (!accountName) {
    return { amount: 0, selfAmount: 0, paidForOthersAmount: 0, count: 0 };
  }

  const billingDay = getBillingDay(card);
  const cycle = getCardBillingCycle(month, billingDay);

  if (!cycle) {
    return { amount: 0, selfAmount: 0, paidForOthersAmount: 0, count: 0 };
  }

  const targetName = normalizeName(accountName);
  const targetBank = normalizeBankName(cardBank);

  let amount = 0;
  let selfAmount = 0;
  let paidForOthersAmount = 0;
  let count = 0;

  for (const item of transactions) {
    if (!item.is_credit_card) continue;
    if (!isExpense(item)) continue;

    const transactionDate = getTransactionDate(item);
    if (!transactionDate) continue;

    if (!isDateInBillingCycle(transactionDate, cycle.start, cycle.end)) {
      continue;
    }

    const transactionAccount = String(item.account_name || "").trim();
    if (!transactionAccount) continue;

    const nameMatched =
      normalizeName(transactionAccount) === targetName;
    const bankMatched =
      !!targetBank &&
      normalizeBankName(transactionAccount) === targetBank;

    if (!nameMatched && !bankMatched) continue;

    const transactionAmount = Math.abs(Number(item.amount || 0));
    if (!Number.isFinite(transactionAmount)) continue;

    amount += transactionAmount;

    if (item.consumption_type === "paid_for_others") {
      paidForOthersAmount += transactionAmount;
    } else if (item.consumption_type === "self") {
      selfAmount += transactionAmount;
    }

    count += 1;
  }

  return { amount, selfAmount, paidForOthersAmount, count };
}

// =====================================================
// 单卡：LOANS 分期月供
//
// 关键修复：
// 只有当前 month 在该分期还款期内，才计入。
// =====================================================

function getInstallmentForCardPure(
  card: CreditCard,
  loans: LoanRow[],
  month: string
): number {
  const cardBank = getCardBankName(card);
  if (!cardBank) return 0;

  let total = 0;

  for (const loan of loans) {
    if (!isCreditCardInstallment(loan)) continue;
    if (String(loan.status ?? "").trim() !== "active") continue;
    if (!loanMatchesCard(loan, card)) continue;

    // 关键：当前统计月份必须在还款期内
    if (!isLoanActiveInMonth(loan, month)) continue;

    total += getLoanMonthlyPayment(loan);
  }

  return total;
}

// =====================================================
// 对外：某月「信用卡总消费」汇总
// month 格式：YYYY-MM
// =====================================================

export type CreditCardFromYuSummary = {
  // 自己消费总共
  selfExpense: number;
  // 替别人提前付总共
  paidForOthersExpense: number;
  // 合计（信用卡总消费）= 自己 + 替别人先付
  excel: number;
  // 分期月供
  installment: number;
  // 信用卡总还款 = 信用卡总消费 + 分期月供
  totalRepay: number;
  transactionCount: number;
};

export async function getCreditCardFromYuSummary(
  month: string
): Promise<CreditCardFromYuSummary> {
  const range = getTransactionLoadRange(month);

  if (!range) {
    throw new Error("月份格式错误");
  }

  const [cardData, transactionData, loanResult] =
    await Promise.all([
      getCreditCards(),
      getExpenseTransactions({
        startDate: range.start.toISOString(),
        endDate: range.end.toISOString(),
        creditCardOnly: true,
        excludeSettlement: true,
      }),
      supabase.from("loans").select("*"),
    ]);

  const cards: CreditCard[] = Array.isArray(cardData) ? cardData : [];
  const transactions: ExpenseTransaction[] = Array.isArray(transactionData)
    ? transactionData
    : [];

  if (loanResult.error) {
    console.error("读取 loans 失败:", loanResult.error);
  }

  const loans: LoanRow[] =
    !loanResult.error && Array.isArray(loanResult.data)
      ? (loanResult.data as LoanRow[])
      : [];

  let excel = 0;
  let selfExpense = 0;
  let paidForOthersExpense = 0;
  let installment = 0;
  let transactionCount = 0;

  for (const card of cards) {
    const e = getExcelExpenseForCardPure(card, month, transactions);

    excel += e.amount;
    selfExpense += e.selfAmount;
    paidForOthersExpense += e.paidForOthersAmount;
    transactionCount += e.count;

    // 关键：把 month 传进去，用于过滤已结束的分期
    installment += getInstallmentForCardPure(card, loans, month);
  }

  return {
    selfExpense,
    paidForOthersExpense,
    excel,
    installment,
    totalRepay: excel + installment,
    transactionCount,
  };
}