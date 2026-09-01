"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import TopBar from "@/components/TopBar";

import {
  getCreditCards,
  type CreditCard,
} from "@/lib/credit-card";

import {
  getExpenseTransactions,
  type ExpenseTransaction,
} from "@/lib/expense-transactions";

import { supabase } from "@/lib/supabase";


// =====================================================
// 类型
// =====================================================

interface LoanRow {
  id?: string;
  name?: string | null;
  type?: string | null;
  institution?: string | null;
  monthly_payment?: number | string | null;
  remaining_amount?: number | string | null;
  status?: string | null;
  [key: string]: any;
}


interface CreditCardWithExpense
  extends CreditCard {

  excelExpense: number;

  selfExpense: number;

  paidForOthersExpense: number;

  installmentExpense: number;

  estimatedExpense: number;

  transactionCount: number;

  cycleStart: Date | null;

  cycleEnd: Date | null;
}


// =====================================================
// 排序
// =====================================================

type SortKey =
  | "name"
  | "bank"
  | "billingDay"
  | "paymentDay"
  | "excelExpense"
  | "installmentExpense"
  | "estimatedExpense"
  | "transactionCount";


type SortDirection =
  | "asc"
  | "desc";


// =====================================================
// 工具
// =====================================================

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
// 排序按钮
// =====================================================

function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection;
}) {

  if (!active) {

    return (
      <span className="ml-1 text-gray-300">
        ↕
      </span>
    );

  }

  return (
    <span className="ml-1 text-gray-700">
      {direction === "asc"
        ? "↑"
        : "↓"}
    </span>
  );

}


// =====================================================
// LocalStorage
// =====================================================

function getFundingStorageKey(
  month: string
): string {

  return (
    `credit-card-from-yu-funding-${month}`
  );

}


// =====================================================
// 获取账单日
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

export default function CreditCardFromYuPage() {

  const [
    month,
    setMonth,
  ] =
    useState(
      getCurrentMonth()
    );


  const [
    cards,
    setCards,
  ] =
    useState<CreditCard[]>([]);


  const [
    transactions,
    setTransactions,
  ] =
    useState<ExpenseTransaction[]>([]);


  const [
    loans,
    setLoans,
  ] =
    useState<LoanRow[]>([]);


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );


  // ===================================================
  // 当前选中的信用卡
  // ===================================================

  const [
    selectedCardId,
    setSelectedCardId,
  ] =
    useState<string | null>(
      null
    );


  // ===================================================
  // 资金安排
  // ===================================================

  const [
    lpMoney,
    setLpMoney,
  ] =
    useState<number>(12000);


  const [
    ownMoney,
    setOwnMoney,
  ] =
    useState<number>(0);


  const [
    fundingLoaded,
    setFundingLoaded,
  ] =
    useState(false);


  // ===================================================
  // 排序状态
  // ===================================================

  const [
    sortKey,
    setSortKey,
  ] =
    useState<SortKey>(
      "name"
    );


  const [
    sortDirection,
    setSortDirection,
  ] =
    useState<SortDirection>(
      "asc"
    );


  // ===================================================
  // 当前选中信用卡
  // ===================================================

  const selectedCard =
    useMemo(() => {

      if (!selectedCardId) {

        return null;

      }

      return (
        cards.find(
          card =>
            String(
              (card as any).id ??
              getAccountName(card)
            ) ===
            selectedCardId
        ) ?? null
      );

    }, [
      cards,
      selectedCardId,
    ]);


  // ===================================================
  // 加载资金安排
  // ===================================================

  useEffect(() => {

    setFundingLoaded(false);

    try {

      const storageKey =
        getFundingStorageKey(
          month
        );

      const saved =
        localStorage.getItem(
          storageKey
        );

      if (saved) {

        const data =
          JSON.parse(
            saved
          );

        if (
          data &&
          typeof data === "object"
        ) {

          setLpMoney(
            toNumber(
              data.lpMoney
            )
          );

          setOwnMoney(
            toNumber(
              data.ownMoney
            )
          );

        }

      } else {

        setLpMoney(12000);

        setOwnMoney(0);

      }

    } catch (err) {

      console.error(
        "读取资金安排失败:",
        err
      );

      setLpMoney(12000);

      setOwnMoney(0);

    } finally {

      setFundingLoaded(true);

    }

  }, [
    month,
  ]);


  // ===================================================
  // 自动保存资金安排
  // ===================================================

  useEffect(() => {

    if (!fundingLoaded) {

      return;

    }

    try {

      const storageKey =
        getFundingStorageKey(
          month
        );

      const data = {

        lpMoney:
          Math.max(
            0,
            toNumber(
              lpMoney
            )
          ),

        ownMoney:
          Math.max(
            0,
            toNumber(
              ownMoney
            )
          ),

      };

      localStorage.setItem(
        storageKey,
        JSON.stringify(
          data
        )
      );

    } catch (err) {

      console.error(
        "自动保存资金安排失败:",
        err
      );

    }

  }, [
    month,
    lpMoney,
    ownMoney,
    fundingLoaded,
  ]);


  // ===================================================
  // 加载数据
  // ===================================================

  useEffect(() => {

    let cancelled =
      false;

    async function load() {

      try {

        setLoading(true);

        setError(null);

        const range =
          getTransactionLoadRange(
            month
          );

        if (!range) {

          throw new Error(
            "月份格式错误"
          );

        }

        const cardPromise =
          getCreditCards();

        const transactionPromise =
          getExpenseTransactions({

            startDate:
              range.start.toISOString(),

            endDate:
              range.end.toISOString(),

            creditCardOnly:
              true,

            excludeSettlement:
              true,

          });

        const loanPromise =
          supabase
            .from(
              "loans"
            )
            .select(
              "*"
            );

        const [
          cardData,
          transactionData,
          loanResult,
        ] =
          await Promise.all([

            cardPromise,

            transactionPromise,

            loanPromise,

          ]);

        if (
          cancelled
        ) {

          return;

        }

        setCards(
          Array.isArray(
            cardData
          )
            ? cardData
            : []
        );

        setTransactions(
          Array.isArray(
            transactionData
          )
            ? transactionData
            : []
        );

        if (
          loanResult.error
        ) {

          console.error(
            "读取 loans 失败:",
            loanResult.error
          );

          setLoans([]);

          setError(
            `LOANS读取失败：${loanResult.error.message}`
          );

        } else {

          setLoans(
            Array.isArray(
              loanResult.data
            )
              ? loanResult.data
              : []
          );

        }

      } catch (err) {

        console.error(
          "CreditCardFromYu load error:",
          err
        );

        if (
          !cancelled
        ) {

          setError(
            err instanceof Error
              ? err.message
              : String(err)
          );

          setCards([]);

          setTransactions([]);

          setLoans([]);

        }

      } finally {

        if (
          !cancelled
        ) {

          setLoading(false);

        }

      }

    }

    load();

    return () => {

      cancelled = true;

    };

  }, [
    month,
  ]);


  // ===================================================
  // 获取某张信用卡本期所有消费
  // ===================================================

  function getTransactionsForCard(
    card: CreditCard
  ): ExpenseTransaction[] {

    const accountName =
      getAccountName(
        card
      );

    const cardBank =
      getCardBankName(
        card
      );

    if (!accountName) {

      return [];

    }

    const billingDay =
      getBillingDay(
        card
      );

    const cycle =
      getCardBillingCycle(
        month,
        billingDay
      );

    if (!cycle) {

      return [];

    }

    const targetName =
      normalizeName(
        accountName
      );

    const targetBank =
      normalizeBankName(
        cardBank
      );

    const result:
      ExpenseTransaction[] =
      [];

    for (
      const item
      of transactions
    ) {

      if (
        !item.is_credit_card
      ) {

        continue;

      }

      if (
        !isExpense(item)
      ) {

        continue;

      }

      const transactionDate =
        getTransactionDate(
          item
        );

      if (!transactionDate) {

        continue;

      }

      if (
        !isDateInBillingCycle(
          transactionDate,
          cycle.start,
          cycle.end
        )
      ) {

        continue;

      }

      const transactionAccount =
        String(
          item.account_name ||
          ""
        ).trim();

      if (!transactionAccount) {

        continue;

      }

      const transactionName =
        normalizeName(
          transactionAccount
        );

      const transactionBank =
        normalizeBankName(
          transactionAccount
        );

      const nameMatched =
        transactionName ===
        targetName;

      const bankMatched =
        !!targetBank &&
        transactionBank ===
        targetBank;

      if (
        !nameMatched &&
        !bankMatched
      ) {

        continue;

      }

      const amount =
        Math.abs(
          Number(
            item.amount || 0
          )
        );

      if (
        !Number.isFinite(amount)
      ) {

        continue;

      }

      result.push(
        item
      );

    }

    // 日期倒序
    result.sort(
      (
        a,
        b
      ) => {

        const dateA =
          getTransactionDate(a);

        const dateB =
          getTransactionDate(b);

        if (
          !dateA &&
          !dateB
        ) {

          return 0;

        }

        if (!dateA) {

          return 1;

        }

        if (!dateB) {

          return -1;

        }

        return (
          dateB.getTime() -
          dateA.getTime()
        );

      }
    );

    return result;

  }


  // ===================================================
  // Excel 消费匹配信用卡
  // ===================================================

  function getExcelExpenseForCard(
    card: CreditCard
  ): {
    amount: number;
    selfAmount: number;
    paidForOthersAmount: number;
    count: number;
    cycleStart: Date | null;
    cycleEnd: Date | null;
  } {

    const accountName =
      getAccountName(
        card
      );

    const cardBank =
      getCardBankName(
        card
      );

    if (!accountName) {

      return {
        amount: 0,
        selfAmount: 0,
        paidForOthersAmount: 0,
        count: 0,
        cycleStart: null,
        cycleEnd: null,
      };

    }

    const billingDay =
      getBillingDay(
        card
      );

    const cycle =
      getCardBillingCycle(
        month,
        billingDay
      );

    if (!cycle) {

      return {
        amount: 0,
        selfAmount: 0,
        paidForOthersAmount: 0,
        count: 0,
        cycleStart: null,
        cycleEnd: null,
      };

    }

    const targetName =
      normalizeName(
        accountName
      );

    const targetBank =
      normalizeBankName(
        cardBank
      );

    let amount =
      0;

    let selfAmount =
      0;

    let paidForOthersAmount =
      0;

    let count =
      0;

    for (
      const item
      of transactions
    ) {

      if (
        !item.is_credit_card
      ) {

        continue;

      }

      if (
        !isExpense(item)
      ) {

        continue;

      }

      const transactionDate =
        getTransactionDate(
          item
        );

      if (!transactionDate) {

        continue;

      }

      if (
        !isDateInBillingCycle(
          transactionDate,
          cycle.start,
          cycle.end
        )
      ) {

        continue;

      }

      const transactionAccount =
        String(
          item.account_name ||
          ""
        ).trim();

      if (!transactionAccount) {

        continue;

      }

      const transactionName =
        normalizeName(
          transactionAccount
        );

      const transactionBank =
        normalizeBankName(
          transactionAccount
        );

      const nameMatched =
        transactionName ===
        targetName;

      const bankMatched =
        !!targetBank &&
        transactionBank ===
        targetBank;

      if (
        !nameMatched &&
        !bankMatched
      ) {

        continue;

      }

      const transactionAmount =
        Math.abs(
          Number(
            item.amount || 0
          )
        );

      if (
        !Number.isFinite(
          transactionAmount
        )
      ) {

        continue;

      }

      amount +=
        transactionAmount;

      if (
        item.consumption_type ===
        "paid_for_others"
      ) {

        paidForOthersAmount +=
          transactionAmount;

      } else if (
        item.consumption_type ===
        "self"
      ) {

        selfAmount +=
          transactionAmount;

      }

      count +=
        1;

    }

    return {

      amount,

      selfAmount,

      paidForOthersAmount,

      count,

      cycleStart:
        cycle.start,

      cycleEnd:
        cycle.end,

    };

  }


  // ===================================================
  // LOANS 分期月供
  // ===================================================

  function getInstallmentForCard(
    card: CreditCard
  ): number {

    const cardBank =
      getCardBankName(
        card
      );

    if (!cardBank) {

      return 0;

    }

    let total =
      0;

    for (
      const loan
      of loans
    ) {

      if (
        !isCreditCardInstallment(
          loan
        )
      ) {

        continue;

      }

      if (
        String(
          loan.status ??
          ""
        ).trim() !==
        "active"
      ) {

        continue;

      }

      if (
        !loanMatchesCard(
          loan,
          card
        )
      ) {

        continue;

      }

      total +=
        getLoanMonthlyPayment(
          loan
        );

    }

    return total;

  }


  // ===================================================
  // 页面行
  // ===================================================

  const rows =
    useMemo<
      CreditCardWithExpense[]
    >(() => {

      const result =
        cards.map(
          card => {

            const excel =
              getExcelExpenseForCard(
                card
              );

            const installment =
              getInstallmentForCard(
                card
              );

            return {

              ...card,

              excelExpense:
                excel.amount,

              selfExpense:
                excel.selfAmount,

              paidForOthersExpense:
                excel.paidForOthersAmount,

              installmentExpense:
                installment,

              estimatedExpense:
                excel.amount +
                installment,

              transactionCount:
                excel.count,

              cycleStart:
                excel.cycleStart,

              cycleEnd:
                excel.cycleEnd,

            };

          }
        );

      result.sort(
        (
          a,
          b
        ) => {

          let valueA:
            string | number;

          let valueB:
            string | number;

          switch (
            sortKey
          ) {

            case "name":

              valueA =
                getAccountName(
                  a
                ).toLowerCase();

              valueB =
                getAccountName(
                  b
                ).toLowerCase();

              break;

            case "bank":

              valueA =
                getCardBankName(
                  a
                ).toLowerCase();

              valueB =
                getCardBankName(
                  b
                ).toLowerCase();

              break;

            case "billingDay":

              valueA =
                getBillingDay(
                  a
                );

              valueB =
                getBillingDay(
                  b
                );

              break;

            case "paymentDay":

              valueA =
                getPaymentDay(
                  a
                );

              valueB =
                getPaymentDay(
                  b
                );

              break;

            case "excelExpense":

              valueA =
                a.excelExpense;

              valueB =
                b.excelExpense;

              break;

            case "installmentExpense":

              valueA =
                a.installmentExpense;

              valueB =
                b.installmentExpense;

              break;

            case "estimatedExpense":

              valueA =
                a.estimatedExpense;

              valueB =
                b.estimatedExpense;

              break;

            case "transactionCount":

              valueA =
                a.transactionCount;

              valueB =
                b.transactionCount;

              break;

          }

          if (
            typeof valueA ===
              "string" &&
            typeof valueB ===
              "string"
          ) {

            const compare =
              valueA.localeCompare(
                valueB,
                "zh-CN"
              );

            return sortDirection ===
              "asc"
              ? compare
              : -compare;

          }

          const numericA =
            Number(
              valueA
            );

          const numericB =
            Number(
              valueB
            );

          if (
            numericA ===
            numericB
          ) {

            return 0;

          }

          const compare =
            numericA >
            numericB
              ? 1
              : -1;

          return sortDirection ===
            "asc"
            ? compare
            : -compare;

        }
      );

      return result;

    }, [
      cards,
      transactions,
      loans,
      month,
      sortKey,
      sortDirection,
    ]);


  // ===================================================
  // 当前选中卡的交易明细
  // ===================================================

  const selectedTransactions =
    useMemo(() => {

      if (!selectedCard) {

        return [];

      }

      return getTransactionsForCard(
        selectedCard
      );

    }, [
      selectedCard,
      transactions,
      month,
    ]);


  // ===================================================
  // 当前选中卡明细合计
  // ===================================================

  const selectedTransactionSummary =
    useMemo(() => {

      let total =
        0;

      let self =
        0;

      let paidForOthers =
        0;

      for (
        const item
        of selectedTransactions
      ) {

        const amount =
          Math.abs(
            Number(
              item.amount || 0
            )
          );

        if (
          !Number.isFinite(amount)
        ) {

          continue;

        }

        total +=
          amount;

        if (
          item.consumption_type ===
          "self"
        ) {

          self +=
            amount;

        }

        if (
          item.consumption_type ===
          "paid_for_others"
        ) {

          paidForOthers +=
            amount;

        }

      }

      return {
        total,
        self,
        paidForOthers,
        count:
          selectedTransactions.length,
      };

    }, [
      selectedTransactions,
    ]);


  // ===================================================
  // 点击信用卡
  // ===================================================

  function handleCardClick(
    card: CreditCard
  ) {

    const id =
      String(
        (card as any).id ??
        getAccountName(card)
      );

    if (
      selectedCardId === id
    ) {

      setSelectedCardId(
        null
      );

      return;

    }

    setSelectedCardId(
      id
    );

  }


  // ===================================================
  // 排序
  // ===================================================

  function handleSort(
    key: SortKey
  ) {

    if (
      sortKey === key
    ) {

      setSortDirection(
        previous =>
          previous === "asc"
            ? "desc"
            : "asc"
      );

      return;

    }

    setSortKey(
      key
    );

    setSortDirection(
      "asc"
    );

  }


  // ===================================================
  // 合计
  // ===================================================

  const summary =
    useMemo(() => {

      let excel =
        0;

      let selfExpense =
        0;

      let paidForOthersExpense =
        0;

      let installment =
        0;

      let estimated =
        0;

      let transactionCount =
        0;

      for (
        const row
        of rows
      ) {

        excel +=
          row.excelExpense;

        selfExpense +=
          row.selfExpense;

        paidForOthersExpense +=
          row.paidForOthersExpense;

        installment +=
          row.installmentExpense;

        estimated +=
          row.estimatedExpense;

        transactionCount +=
          row.transactionCount;

      }

      return {

        excel,

        selfExpense,

        paidForOthersExpense,

        installment,

        estimated,

        transactionCount,

      };

    }, [
      rows,
    ]);


  // ===================================================
  // 资金安排
  // ===================================================

  const currentArrangedMoney =
    Math.max(
      0,
      toNumber(lpMoney)
    ) +
    Math.max(
      0,
      toNumber(ownMoney)
    );


  const needOwnMoney =
    Math.max(
      0,
      summary.estimated -
      currentArrangedMoney
    );


  const fundingEnough =
    currentArrangedMoney >=
    summary.estimated;


  // ===================================================
  // 月份切换
  // ===================================================

  function changeMonth(
    offset: number
  ) {

    const match =
      /^(\d{4})-(\d{2})$/.exec(
        month
      );

    if (!match) {

      return;

    }

    const year =
      Number(match[1]);

    const monthNumber =
      Number(match[2]);

    const date =
      new Date(
        year,
        monthNumber - 1,
        1
      );

    date.setMonth(
      date.getMonth() +
      offset
    );

    setMonth(
      `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`
    );

    setSelectedCardId(
      null
    );

  }


  // ===================================================
  // 渲染
  // ===================================================

  return (

    <div
      className="
        min-h-screen
        bg-gray-50
        text-gray-900
      "
    >

      <TopBar
        title="信用卡预估 FROM_有鱼"
      />


      <main
        className="
          mx-auto
          max-w-[1500px]
          px-6
          py-6
        "
      >

        {/* =================================================
            标题
        ================================================= */}

        <div
          className="
            mb-6
            flex
            items-center
            justify-between
            gap-4
          "
        >

          <div>

            <h1
              className="
                text-2xl
                font-bold
                tracking-tight
              "
            >
              信用卡预估 FROM_有鱼
            </h1>

            <p
              className="
                mt-1
                text-sm
                text-gray-500
              "
            >
              按信用卡账单周期统计 Excel 消费 + LOANS 信用卡分期月供
            </p>

          </div>


          <div
            className="
              flex
              items-center
              gap-2
            "
          >

            <button
              type="button"
              onClick={() =>
                changeMonth(-1)
              }
              className="
                rounded-lg
                border
                bg-white
                px-3
                py-2
                text-sm
                hover:bg-gray-50
              "
            >
              ←
            </button>


            <input
              type="month"
              value={month}
              onChange={event => {

                setMonth(
                  event.target.value
                );

                setSelectedCardId(
                  null
                );

              }}
              className="
                rounded-lg
                border
                bg-white
                px-3
                py-2
                text-sm
                outline-none
              "
            />


            <button
              type="button"
              onClick={() =>
                changeMonth(1)
              }
              className="
                rounded-lg
                border
                bg-white
                px-3
                py-2
                text-sm
                hover:bg-gray-50
              "
            >
              →
            </button>

          </div>

        </div>


        {/* =================================================
            消费总览
        ================================================= */}

        <div
          className="
            mb-6
            rounded-xl
            border
            bg-white
            px-5
            py-4
          "
        >

          <div
            className="
              grid
              grid-cols-1
              gap-4
              md:grid-cols-3
            "
          >

            <div>

              <div className="text-xs text-gray-500">
                信用卡总消费
              </div>

              <div className="mt-1 text-xl font-bold">
                {formatMoney(
                  summary.excel
                )}
              </div>

            </div>


            <div>

              <div className="text-xs text-gray-500">
                自己消费总共
              </div>

              <div className="mt-1 text-xl font-semibold">
                {formatMoney(
                  summary.selfExpense
                )}
              </div>

            </div>


            <div>

              <div className="text-xs text-gray-500">
                替别人提前付总共
              </div>

              <div className="mt-1 text-xl font-semibold">
                {formatMoney(
                  summary.paidForOthersExpense
                )}
              </div>

            </div>

          </div>

        </div>


        {/* =================================================
            错误
        ================================================= */}

        {error && (

          <div
            className="
              mb-6
              rounded-xl
              border
              border-yellow-200
              bg-yellow-50
              px-5
              py-4
              text-sm
              text-yellow-800
            "
          >
            {error}
          </div>

        )}


        {/* =================================================
            信用卡表格
        ================================================= */}

        <div
          className="
            overflow-hidden
            rounded-xl
            border
            bg-white
          "
        >

          <div
            className="
              overflow-x-auto
            "
          >

            <table
              className="
                w-full
                min-w-[1250px]
                text-sm
              "
            >

              <thead
                className="
                  border-b
                  bg-gray-50
                  text-gray-600
                "
              >

                <tr>

                  <th
                    onClick={() =>
                      handleSort("name")
                    }
                    className="
                      cursor-pointer
                      select-none
                      px-5
                      py-3
                      text-left
                      font-medium
                      hover:bg-gray-100
                    "
                  >
                    信用卡
                    <SortIcon
                      active={
                        sortKey === "name"
                      }
                      direction={
                        sortDirection
                      }
                    />
                  </th>


                  <th
                    onClick={() =>
                      handleSort("bank")
                    }
                    className="
                      cursor-pointer
                      select-none
                      px-4
                      py-3
                      text-center
                      font-medium
                      hover:bg-gray-100
                    "
                  >
                    银行
                    <SortIcon
                      active={
                        sortKey === "bank"
                      }
                      direction={
                        sortDirection
                      }
                    />
                  </th>


                  <th
                    onClick={() =>
                      handleSort("billingDay")
                    }
                    className="
                      cursor-pointer
                      select-none
                      px-4
                      py-3
                      text-center
                      font-medium
                      hover:bg-gray-100
                    "
                  >
                    账单日
                    <SortIcon
                      active={
                        sortKey === "billingDay"
                      }
                      direction={
                        sortDirection
                      }
                    />
                  </th>


                  <th
                    onClick={() =>
                      handleSort("paymentDay")
                    }
                    className="
                      cursor-pointer
                      select-none
                      px-4
                      py-3
                      text-center
                      font-medium
                      hover:bg-gray-100
                    "
                  >
                    还款日
                    <SortIcon
                      active={
                        sortKey === "paymentDay"
                      }
                      direction={
                        sortDirection
                      }
                    />
                  </th>


                  <th
                    className="
                      px-5
                      py-3
                      text-center
                      font-medium
                    "
                  >
                    本期消费周期
                  </th>


                  <th
                    onClick={() =>
                      handleSort("excelExpense")
                    }
                    className="
                      cursor-pointer
                      select-none
                      px-5
                      py-3
                      text-right
                      font-medium
                      hover:bg-gray-100
                    "
                  >
                    {month} 预估消费
                    <SortIcon
                      active={
                        sortKey === "excelExpense"
                      }
                      direction={
                        sortDirection
                      }
                    />
                  </th>


                  <th
                    onClick={() =>
                      handleSort(
                        "installmentExpense"
                      )
                    }
                    className="
                      cursor-pointer
                      select-none
                      px-5
                      py-3
                      text-right
                      font-medium
                      hover:bg-gray-100
                    "
                  >
                    分期月供
                    <SortIcon
                      active={
                        sortKey ===
                        "installmentExpense"
                      }
                      direction={
                        sortDirection
                      }
                    />
                  </th>


                  <th
                    onClick={() =>
                      handleSort(
                        "estimatedExpense"
                      )
                    }
                    className="
                      cursor-pointer
                      select-none
                      px-5
                      py-3
                      text-right
                      font-medium
                      hover:bg-gray-100
                    "
                  >
                    {month} 预计支出
                    <SortIcon
                      active={
                        sortKey ===
                        "estimatedExpense"
                      }
                      direction={
                        sortDirection
                      }
                    />
                  </th>


                  <th
                    onClick={() =>
                      handleSort(
                        "transactionCount"
                      )
                    }
                    className="
                      cursor-pointer
                      select-none
                      px-4
                      py-3
                      text-center
                      font-medium
                      hover:bg-gray-100
                    "
                  >
                    Excel笔数
                    <SortIcon
                      active={
                        sortKey ===
                        "transactionCount"
                      }
                      direction={
                        sortDirection
                      }
                    />
                  </th>

                </tr>

              </thead>


              <tbody
                className="
                  divide-y
                "
              >

                {loading && (

                  <tr>

                    <td
                      colSpan={9}
                      className="
                        px-5
                        py-12
                        text-center
                        text-gray-500
                      "
                    >
                      正在读取信用卡、Excel消费和LOANS分期数据……
                    </td>

                  </tr>

                )}


                {!loading &&
                  rows.length === 0 && (

                    <tr>

                      <td
                        colSpan={9}
                        className="
                          px-5
                          py-12
                          text-center
                          text-gray-500
                        "
                      >
                        暂无信用卡数据
                      </td>

                    </tr>

                  )}


                {!loading &&
                  rows.map(
                    row => {

                      const name =
                        getAccountName(
                          row
                        );

                      const bank =
                        getCardBankName(
                          row
                        );

                      const rowId =
                        String(
                          (row as any).id ??
                          name
                        );

                      const isSelected =
                        selectedCardId ===
                        rowId;

                      return (

                        <tr
                          key={
                            rowId
                          }
                          onClick={() =>
                            handleCardClick(
                              row
                            )
                          }
                          className={`
                            cursor-pointer
                            transition-colors
                            ${
                              isSelected
                                ? "bg-blue-50 hover:bg-blue-50"
                                : "hover:bg-gray-50"
                            }
                          `}
                        >

                          <td
                            className="
                              px-5
                              py-4
                            "
                          >

                            <div className="flex items-center gap-2">

                              <div
                                className={`
                                  h-2
                                  w-2
                                  rounded-full
                                  ${
                                    isSelected
                                      ? "bg-blue-500"
                                      : "bg-transparent"
                                  }
                                `}
                              />

                              <div>

                                <div className="font-medium">
                                  {name || "-"}
                                </div>

                                {isSelected && (
                                  <div
                                    className="
                                      mt-0.5
                                      text-[11px]
                                      text-blue-600
                                    "
                                  >
                                    已选择 · 点击查看本期全部消费
                                  </div>
                                )}

                              </div>

                            </div>

                          </td>


                          <td
                            className="
                              px-4
                              py-4
                              text-center
                            "
                          >
                            {bank || "-"}
                          </td>


                          <td
                            className="
                              px-4
                              py-4
                              text-center
                            "
                          >
                            {getBillingDay(row) || "-"}
                          </td>


                          <td
                            className="
                              px-4
                              py-4
                              text-center
                            "
                          >
                            {getPaymentDay(row) || "-"}
                          </td>


                          <td
                            className="
                              px-5
                              py-4
                              text-center
                              text-xs
                              text-gray-500
                            "
                          >

                            {row.cycleStart &&
                            row.cycleEnd ? (

                              <div>

                                {formatDate(
                                  row.cycleStart
                                )}

                                <span className="mx-1">
                                  →
                                </span>

                                {formatDate(
                                  row.cycleEnd
                                )}

                              </div>

                            ) : (

                              "-"

                            )}

                          </td>


                          <td
                            className="
                              px-5
                              py-4
                              text-right
                              font-semibold
                            "
                          >
                            {formatMoney(
                              row.excelExpense
                            )}
                          </td>


                          <td
                            className="
                              px-5
                              py-4
                              text-right
                              font-semibold
                            "
                          >
                            {formatMoney(
                              row.installmentExpense
                            )}
                          </td>


                          <td
                            className="
                              px-5
                              py-4
                              text-right
                              font-bold
                            "
                          >
                            {formatMoney(
                              row.estimatedExpense
                            )}
                          </td>


                          <td
                            className="
                              px-4
                              py-4
                              text-center
                              text-gray-500
                            "
                          >
                            {row.transactionCount}
                          </td>

                        </tr>

                      );

                    }
                  )}

              </tbody>


              {!loading &&
                rows.length > 0 && (

                  <tfoot
                    className="
                      border-t
                      bg-gray-50
                    "
                  >

                    <tr>

                      <td
                        colSpan={5}
                        className="
                          px-5
                          py-4
                          font-bold
                        "
                      >
                        合计
                      </td>


                      <td
                        className="
                          px-5
                          py-4
                          text-right
                          font-bold
                        "
                      >
                        {formatMoney(
                          summary.excel
                        )}
                      </td>


                      <td
                        className="
                          px-5
                          py-4
                          text-right
                          font-bold
                        "
                      >
                        {formatMoney(
                          summary.installment
                        )}
                      </td>


                      <td
                        className="
                          px-5
                          py-4
                          text-right
                          font-bold
                        "
                      >
                        {formatMoney(
                          summary.estimated
                        )}
                      </td>


                      <td
                        className="
                          px-4
                          py-4
                          text-center
                          font-bold
                        "
                      >
                        {summary.transactionCount}
                      </td>

                    </tr>

                  </tfoot>

                )}

            </table>

          </div>

        </div>


        {/* =================================================
            当前信用卡消费明细
        ================================================= */}

        {selectedCard && (

          <div
            className="
              mt-6
              overflow-hidden
              rounded-xl
              border
              bg-white
            "
          >

            {/* -------------------------------------------------
                明细标题
            ------------------------------------------------- */}

            <div
              className="
                border-b
                bg-gray-50
                px-5
                py-4
              "
            >

              <div
                className="
                  flex
                  items-start
                  justify-between
                  gap-4
                "
              >

                <div>

                  <div
                    className="
                      flex
                      items-center
                      gap-2
                    "
                  >

                    <h2
                      className="
                        text-lg
                        font-bold
                      "
                    >
                      {getAccountName(
                        selectedCard
                      )}
                    </h2>

                    <span
                      className="
                        rounded-md
                        bg-blue-100
                        px-2
                        py-0.5
                        text-xs
                        font-medium
                        text-blue-700
                      "
                    >
                      本期消费
                    </span>

                  </div>


                  <div
                    className="
                      mt-1
                      text-sm
                      text-gray-500
                    "
                  >

                    {selectedCard &&
                    getCardBillingCycle(
                      month,
                      getBillingDay(
                        selectedCard
                      )
                    ) ? (

                      <>
                        消费周期：
                        {formatDate(
                          getCardBillingCycle(
                            month,
                            getBillingDay(
                              selectedCard
                            )
                          )!.start
                        )}

                        <span className="mx-1">
                          →
                        </span>

                        {formatDate(
                          getCardBillingCycle(
                            month,
                            getBillingDay(
                              selectedCard
                            )
                          )!.end
                        )}

                      </>

                    ) : (

                      "无法计算账单周期"

                    )}

                  </div>

                </div>


                <button
                  type="button"
                  onClick={() =>
                    setSelectedCardId(
                      null
                    )
                  }
                  className="
                    rounded-lg
                    border
                    bg-white
                    px-3
                    py-1.5
                    text-sm
                    text-gray-600
                    hover:bg-gray-100
                  "
                >
                  收起
                </button>

              </div>


              {/* -------------------------------------------------
                  明细统计
              ------------------------------------------------- */}

              <div
                className="
                  mt-4
                  grid
                  grid-cols-2
                  gap-3
                  md:grid-cols-4
                "
              >

                <div
                  className="
                    rounded-lg
                    border
                    bg-white
                    px-4
                    py-3
                  "
                >

                  <div
                    className="
                      text-xs
                      text-gray-500
                    "
                  >
                    本期消费
                  </div>

                  <div
                    className="
                      mt-1
                      text-lg
                      font-bold
                    "
                  >
                    {formatMoney(
                      selectedTransactionSummary.total
                    )}
                  </div>

                </div>


                <div
                  className="
                    rounded-lg
                    border
                    bg-white
                    px-4
                    py-3
                  "
                >

                  <div
                    className="
                      text-xs
                      text-gray-500
                    "
                  >
                    自己消费
                  </div>

                  <div
                    className="
                      mt-1
                      text-lg
                      font-semibold
                    "
                  >
                    {formatMoney(
                      selectedTransactionSummary.self
                    )}
                  </div>

                </div>


                <div
                  className="
                    rounded-lg
                    border
                    bg-white
                    px-4
                    py-3
                  "
                >

                  <div
                    className="
                      text-xs
                      text-gray-500
                    "
                  >
                    替别人先付
                  </div>

                  <div
                    className="
                      mt-1
                      text-lg
                      font-semibold
                    "
                  >
                    {formatMoney(
                      selectedTransactionSummary.paidForOthers
                    )}
                  </div>

                </div>


                <div
                  className="
                    rounded-lg
                    border
                    bg-white
                    px-4
                    py-3
                  "
                >

                  <div
                    className="
                      text-xs
                      text-gray-500
                    "
                  >
                    消费笔数
                  </div>

                  <div
                    className="
                      mt-1
                      text-lg
                      font-bold
                    "
                  >
                    {selectedTransactionSummary.count}

                    <span
                      className="
                        ml-1
                        text-sm
                        font-normal
                        text-gray-500
                      "
                    >
                      笔
                    </span>

                  </div>

                </div>

              </div>

            </div>


            {/* -------------------------------------------------
                消费明细表
            ------------------------------------------------- */}

            <div
              className="
                overflow-x-auto
              "
            >

              {selectedTransactions.length === 0 ? (

                <div
                  className="
                    px-5
                    py-12
                    text-center
                    text-sm
                    text-gray-500
                  "
                >
                  这个账单周期没有找到消费记录
                </div>

              ) : (

                <table
                  className="
                    w-full
                    min-w-[1050px]
                    text-sm
                  "
                >

                  <thead
                    className="
                      border-b
                      bg-white
                      text-gray-500
                    "
                  >

                    <tr>

                      <th
                        className="
                          whitespace-nowrap
                          px-5
                          py-3
                          text-left
                          font-medium
                        "
                      >
                        消费日期
                      </th>


                      <th
                        className="
                          whitespace-nowrap
                          px-5
                          py-3
                          text-left
                          font-medium
                        "
                      >
                        消费账户
                      </th>


                      {/* 新增：账目分类 */}

                      <th
                        className="
                          whitespace-nowrap
                          px-5
                          py-3
                          text-left
                          font-medium
                        "
                      >
                        账目分类
                      </th>


                      <th
                        className="
                          px-5
                          py-3
                          text-left
                          font-medium
                        "
                      >
                        消费内容
                      </th>


                      <th
                        className="
                          whitespace-nowrap
                          px-5
                          py-3
                          text-center
                          font-medium
                        "
                      >
                        消费归属
                      </th>


                      <th
                        className="
                          whitespace-nowrap
                          px-5
                          py-3
                          text-right
                          font-medium
                        "
                      >
                        金额
                      </th>

                    </tr>

                  </thead>


                  <tbody
                    className="
                      divide-y
                    "
                  >

                    {selectedTransactions.map(
                      (
                        item,
                        index
                      ) => {

                        const transactionDate =
                          getTransactionDate(
                            item
                          );

                        const amount =
                          Math.abs(
                            Number(
                              item.amount || 0
                            )
                          );

                        const category =
                          getTransactionCategory(
                            item
                          );

                        const description =
                          getTransactionDescription(
                            item
                          );

                        const account =
                          String(
                            item.account_name ||
                            ""
                          ).trim();

                        const isPaidForOthers =
                          item.consumption_type ===
                          "paid_for_others";

                        return (

                          <tr
                            key={
                              String(
                                (item as any).id ??
                                `${transactionDate?.getTime() ?? index}-${index}`
                              )
                            }
                            className="
                              hover:bg-gray-50
                            "
                          >

                            {/* 消费日期 */}

                            <td
                              className="
                                whitespace-nowrap
                                px-5
                                py-3
                                text-gray-700
                              "
                            >
                              {formatTransactionDate(
                                transactionDate
                              )}
                            </td>


                            {/* 消费账户 */}

                            <td
                              className="
                                px-5
                                py-3
                                text-gray-700
                              "
                            >
                              {account || "-"}
                            </td>


                            {/* =================================================
                                新增：账目分类
                            ================================================= */}

                            <td
                              className="
                                whitespace-nowrap
                                px-5
                                py-3
                                text-gray-700
                              "
                            >

                              {category ? (

                                <span
                                  className="
                                    inline-flex
                                    rounded-md
                                    bg-gray-100
                                    px-2
                                    py-1
                                    text-xs
                                    font-medium
                                    text-gray-700
                                  "
                                >
                                  {category}
                                </span>

                              ) : (

                                "-"

                              )}

                            </td>


                            {/* 消费内容 */}

                            <td
                              className="
                                max-w-[450px]
                                px-5
                                py-3
                                text-gray-900
                              "
                            >

                              <div
                                className="
                                  truncate
                                "
                                title={
                                  description
                                }
                              >
                                {description || "-"}
                              </div>

                            </td>


                            {/* 消费归属 */}

                            <td
                              className="
                                whitespace-nowrap
                                px-5
                                py-3
                                text-center
                              "
                            >

                              <span
                                className={`
                                  inline-flex
                                  rounded-md
                                  px-2
                                  py-1
                                  text-xs
                                  font-medium
                                  ${
                                    isPaidForOthers
                                      ? "bg-orange-50 text-orange-700"
                                      : "bg-gray-100 text-gray-700"
                                  }
                                `}
                              >
                                {getConsumptionTypeLabel(
                                  item
                                )}
                              </span>

                            </td>


                            {/* 金额 */}

                            <td
                              className="
                                whitespace-nowrap
                                px-5
                                py-3
                                text-right
                                font-semibold
                              "
                            >
                              {formatMoney(
                                amount
                              )}
                            </td>

                          </tr>

                        );

                      }
                    )}

                  </tbody>


                  <tfoot
                    className="
                      border-t
                      bg-gray-50
                    "
                  >

                    <tr>

                      <td
                        colSpan={5}
                        className="
                          px-5
                          py-3
                          text-right
                          font-bold
                        "
                      >
                        本期合计
                      </td>


                      <td
                        className="
                          px-5
                          py-3
                          text-right
                          font-bold
                        "
                      >
                        {formatMoney(
                          selectedTransactionSummary.total
                        )}
                      </td>

                    </tr>

                  </tfoot>

                </table>

              )}

            </div>

          </div>

        )}


        {/* =================================================
            预估账单资金安排
        ================================================= */}

        <div
          className="
            mt-6
            rounded-xl
            border
            bg-white
            px-6
            py-5
          "
        >

          <div
            className="
              mb-5
            "
          >

            <h2
              className="
                text-lg
                font-bold
              "
            >
              {month} 预估账单资金安排
            </h2>


            <p
              className="
                mt-1
                text-sm
                text-gray-500
              "
            >
              提前安排，避免账单出来后资金不足
            </p>

          </div>


          <div
            className="
              grid
              grid-cols-1
              gap-5
              md:grid-cols-2
              lg:grid-cols-5
            "
          >

            <div>

              <div
                className="
                  text-xs
                  text-gray-500
                "
              >
                预估账单
              </div>


              <div
                className="
                  mt-2
                  text-2xl
                  font-bold
                "
              >
                {formatMoney(
                  summary.estimated
                )}
              </div>

            </div>


            <div>

              <div
                className="
                  text-xs
                  text-gray-500
                "
              >
                LP给我
              </div>


              <div
                className="
                  mt-2
                  flex
                  items-center
                "
              >

                <span
                  className="
                    mr-1
                    text-lg
                    text-gray-500
                  "
                >
                  ¥
                </span>


                <input
                  type="number"
                  min="0"
                  value={
                    lpMoney === 0
                      ? ""
                      : lpMoney
                  }
                  onChange={event =>
                    setLpMoney(
                      toNumber(
                        event.target.value
                      )
                    )
                  }
                  className="
                    w-full
                    rounded-lg
                    border
                    px-3
                    py-2
                    text-lg
                    font-semibold
                    outline-none
                    focus:border-gray-400
                  "
                  placeholder="0"
                />

              </div>

            </div>


            <div>

              <div
                className="
                  text-xs
                  text-gray-500
                "
              >
                我自己现在有
              </div>


              <div
                className="
                  mt-2
                  flex
                  items-center
                "
              >

                <span
                  className="
                    mr-1
                    text-lg
                    text-gray-500
                  "
                >
                  ¥
                </span>


                <input
                  type="number"
                  min="0"
                  value={
                    ownMoney === 0
                      ? ""
                      : ownMoney
                  }
                  onChange={event =>
                    setOwnMoney(
                      toNumber(
                        event.target.value
                      )
                    )
                  }
                  className="
                    w-full
                    rounded-lg
                    border
                    px-3
                    py-2
                    text-lg
                    font-semibold
                    outline-none
                    focus:border-gray-400
                  "
                  placeholder="0"
                />

              </div>


              <div
                className="
                  mt-1
                  text-[11px]
                  text-gray-400
                "
              >
                输入后自动保存
              </div>

            </div>


            <div>

              <div
                className="
                  text-xs
                  text-gray-500
                "
              >
                目前安排资金
              </div>


              <div
                className="
                  mt-2
                  text-2xl
                  font-bold
                "
              >
                {formatMoney(
                  currentArrangedMoney
                )}
              </div>

            </div>


            <div>

              <div
                className="
                  text-xs
                  text-gray-500
                "
              >
                还需要自己拿
              </div>


              <div
                className={`
                  mt-2
                  text-2xl
                  font-bold
                  ${
                    needOwnMoney > 0
                      ? "text-red-600"
                      : "text-gray-900"
                  }
                `}
              >
                {formatMoney(
                  needOwnMoney
                )}
              </div>

            </div>

          </div>


          <div
            className={`
              mt-5
              rounded-lg
              px-4
              py-3
              text-sm
              font-medium
              ${
                fundingEnough
                  ? "bg-green-50 text-green-700"
                  : "bg-red-50 text-red-700"
              }
            `}
          >

            {fundingEnough
              ? "✓ 预估资金已经足够"
              : `⚠ 还需要自己准备 ${formatMoney(
                  needOwnMoney
                )}`
            }

          </div>

        </div>


        {/* =================================================
            数据说明
        ================================================= */}

        <div
          className="
            mt-5
            rounded-xl
            border
            bg-white
            px-5
            py-4
            text-xs
            leading-6
            text-gray-500
          "
        >

          <div
            className="
              font-medium
              text-gray-700
            "
          >
            数据说明
          </div>


          <div>
            ① 信用卡名称来自 credit_cards.card_name。
          </div>


          <div>
            ② 银行来自 credit_cards.bank_name。
          </div>


          <div>
            ③ {month} 预估消费按照每张信用卡自己的账单周期计算。
          </div>


          <div>
            ④ 账单周期 = 上个账单日 + 1天 → 本月账单日，包含首尾两天。
          </div>


          <div>
            ⑤ 例如账单日为20日，{month}账单周期为上月21日 → 本月20日。
          </div>


          <div>
            ⑥ 信用卡总消费 = 自己消费 + 替别人先付。
          </div>


          <div>
            ⑦ 自己消费和替别人先付按照 consumption_type 区分。
          </div>


          <div>
            ⑧ 自动排除「平账 / 平帐」流水。
          </div>


          <div>
            ⑨ 分期月供来自 loans，不从 Excel 读取。
          </div>


          <div>
            ⑩ 只统计 loans.type =「信用卡分期」且 status =「active」的贷款。
          </div>


          <div>
            ⑪ loans.institution 与 credit_cards.bank_name 采用标准化银行名称匹配。
          </div>


          <div>
            ⑫ 分期月供使用 loans.monthly_payment。
          </div>


          <div>
            ⑬ {month} 预计支出 = 账单周期内 Excel 预估消费 + LOANS 分期月供。
          </div>


          <div>
            ⑭ 本页面不会修改 /credit-card 手工预估数据。
          </div>


          <div>
            ⑮ 点击表头可以对每一列进行升序 / 降序排序。
          </div>


          <div>
            ⑯ 资金安排 = LP给我 + 我自己现在有。
          </div>


          <div>
            ⑰ 还需要自己拿 = max(预估账单 - 目前安排资金, 0)。
          </div>


          <div>
            ⑱ LP给我、我自己有按月份自动保存到本机浏览器。
          </div>


          <div>
            ⑲ 点击任意信用卡，可以查看该信用卡本期账单周期内的全部消费明细。
          </div>


          <div>
            ⑳ 信用卡消费明细与上方预估消费使用相同的账单周期、账户匹配及消费过滤规则。
          </div>


          <div>
            ㉑ 消费明细中的「账目分类」来自 expense_transactions 的分类字段。
          </div>


          <div>
            ㉒ 账目分类字段兼容 account_category、category、category_name、expense_category。
          </div>

        </div>

      </main>

    </div>

  );

}

