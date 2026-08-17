"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import TopBar from "@/components/TopBar";

import {
  getCreditCardOverview,
  getCreditCardFunding,
  saveCreditCardFunding,
} from "@/lib/credit-card";

import { supabase } from "@/lib/supabase";

import {
  getExpenseTransactions,
} from "@/lib/expense-transactions";


// =====================================================
// 类型
// =====================================================

type CardItem = {
  id: string;
  bank_name: string;
  card_name: string;
  billing_day: number;
  payment_day: number | null;
  monthly_estimate: number;
  actual_bill_amount: number;
  installment: number;
};


type ExpenseTransaction = Record<
  string,
  any
>;


type SortKey =
  | "bank_name"
  | "card_name"
  | "billing_day"
  | "payment_day"
  | "installment"
  | "monthly_estimate"
  | "yu_estimate"
  | "gap"
  | "total"
  | "actual_bill_amount";


type SortDirection =
  | "asc"
  | "desc";


// =====================================================
// 工具函数
// =====================================================

function toNumber(
  value: any
): number {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const n =
    Number(
      String(value)
        .replace(/,/g, "")
        .replace(/¥/g, "")
        .replace(/\s/g, "")
    );

  return Number.isFinite(n)
    ? n
    : 0;
}


// =====================================================
// 字符串标准化
// =====================================================

function normalizeText(
  value: any
): string {

  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/_/g, "")
    .replace(/银行/g, "")
    .replace(/信用卡/g, "");

}


// =====================================================
// 从对象中读取第一个存在的字段
// =====================================================

function getFirstValue(
  row: ExpenseTransaction,
  keys: string[]
): any {

  for (
    const key of keys
  ) {

    if (
      row[key] !== undefined &&
      row[key] !== null
    ) {

      return row[key];

    }

  }

  return null;

}


// =====================================================
// 有鱼交易日期
//
// expense_transactions 实际字段：
// transaction_time
// =====================================================

function getTransactionDate(
  row: ExpenseTransaction
): Date | null {

  const raw =
    row.transaction_time ??
    row.transaction_date ??
    row.expense_date ??
    row.date ??
    row.transactionDate ??
    row.occurred_at ??
    row.created_at;

  if (
    raw === null ||
    raw === undefined ||
    raw === ""
  ) {
    return null;
  }

  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime())
      ? null
      : new Date(raw);
  }

  const text = String(raw).trim();

  const dateOnlyMatch =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

  if (dateOnlyMatch) {
    const date = new Date(
      Number(dateOnlyMatch[1]),
      Number(dateOnlyMatch[2]) - 1,
      Number(dateOnlyMatch[3])
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dateTimeMatch =
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text);

  if (dateTimeMatch) {
    const date = new Date(
      Number(dateTimeMatch[1]),
      Number(dateTimeMatch[2]) - 1,
      Number(dateTimeMatch[3]),
      Number(dateTimeMatch[4]),
      Number(dateTimeMatch[5]),
      Number(dateTimeMatch[6] || 0)
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}


function normalizeName(value: any): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .toLowerCase();
}


function normalizeBankName(value: any): string {
  let name = normalizeText(value);
  if (!name) return "";

  if (name === "工行") return "工商";
  if (name === "建行") return "建设";
  if (name === "中行") return "中国";
  if (name === "农行") return "农业";
  if (name === "交行") return "交通";
  if (name === "招行") return "招商";
  if (name === "中信") return "中信";
  if (name === "宁波") return "宁波";

  return name;
}


function getBillingDay(card: CardItem): number {
  return Math.floor(toNumber(card.billing_day));
}


function getBillingDate(
  year: number,
  monthIndex: number,
  billingDay: number
): Date | null {
  if (!Number.isFinite(billingDay) || billingDay < 1) {
    return null;
  }

  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const actualDay = Math.min(billingDay, lastDay);
  return new Date(year, monthIndex, actualDay);
}


function getCardBillingCycle(
  month: string,
  billingDay: number
): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (!year || monthNumber < 1 || monthNumber > 12) return null;

  const currentBillingDate = getBillingDate(
    year,
    monthNumber - 1,
    billingDay
  );

  const previousBillingDate = getBillingDate(
    monthNumber === 1 ? year - 1 : year,
    monthNumber === 1 ? 11 : monthNumber - 2,
    billingDay
  );

  if (!currentBillingDate || !previousBillingDate) return null;

  const start = new Date(previousBillingDate);
  start.setDate(start.getDate() + 1);

  return {
    start,
    end: new Date(currentBillingDate),
  };
}


function startOfDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}


function isDateInBillingCycle(
  transactionDate: Date,
  cycleStart: Date,
  cycleEnd: Date
): boolean {
  const date = startOfDay(transactionDate).getTime();
  const start = startOfDay(cycleStart).getTime();
  const end = startOfDay(cycleEnd).getTime();
  return date >= start && date <= end;
}


// =====================================================
// 有鱼交易金额
//
// expense_transactions.amount
// 有鱼支出通常为负数
//
// 统一转换成正数消费金额
// =====================================================

function getTransactionAmount(
  row: ExpenseTransaction
): number {

  const value =
    getFirstValue(
      row,
      [
        "amount",
        "transaction_amount",
        "expense_amount",
        "money",
        "price",
        "total",
        "金额",
        "交易金额",
        "消费金额",
        "支出金额",
      ]
    );

  return Math.abs(
    toNumber(value)
  );

}


// =====================================================
// 页面
// =====================================================

export default function CreditCardPage() {

  // ===================================================
  // 信用卡
  // ===================================================

  const [
    cards,
    setCards,
  ] = useState<CardItem[]>([]);


  // ===================================================
  // 本月手动预估消费
  // ===================================================

  const [
    estimate,
    setEstimate,
  ] = useState<
    Record<string, number>
  >({});


  // ===================================================
  // 有鱼交易
  // ===================================================

  const [
    yuTransactions,
    setYuTransactions,
  ] = useState<
    ExpenseTransaction[]
  >([]);


  // ===================================================
  // 实际账单额
  // ===================================================

  const [
    actualBill,
    setActualBill,
  ] = useState<
    Record<string, number>
  >({});


  // ===================================================
  // Loading
  // ===================================================

  const [
    loading,
    setLoading,
  ] = useState(true);


  // ===================================================
  // 有鱼 Loading
  // ===================================================

  const [
    yuLoading,
    setYuLoading,
  ] = useState(true);


  // ===================================================
  // 保存信用卡字段状态
  // ===================================================

  const [
    savingId,
    setSavingId,
  ] = useState<string | null>(null);


  // ===================================================
  // 资金安排自动保存状态
  // ===================================================

  const [
    fundingSaving,
    setFundingSaving,
  ] = useState(false);


  const [
    fundingSaved,
    setFundingSaved,
  ] = useState(false);


  // ===================================================
  // 排序
  // ===================================================

  const [
    sortKey,
    setSortKey,
  ] = useState<SortKey>(
    "billing_day"
  );


  const [
    sortDirection,
    setSortDirection,
  ] = useState<SortDirection>(
    "asc"
  );


  // ===================================================
  // UI 显示字段
  // 仅控制界面显示，不影响任何计算 / 数据
  // ===================================================

  const [
    showFieldMenu,
    setShowFieldMenu,
  ] = useState(false);

  const [
    showYuEstimate,
    setShowYuEstimate,
  ] = useState(false);

  const [
    showGap,
    setShowGap,
  ] = useState(false);


  // ===================================================
  // 当前月份
  // ===================================================

  const now =
    new Date();


  const currentYear =
    now.getFullYear();


  const currentMonth =
    now.getMonth() + 1;


  const nextMonth =
    currentMonth === 12
      ? 1
      : currentMonth + 1;


  // ===================================================
  // 当前月份字符串
  // ===================================================

  const currentMonthPrefix =
    `${currentYear}-${String(
      currentMonth
    ).padStart(2, "0")}`;


  // ===================================================
  // 资金安排
  // ===================================================

  const [
    lpEstimate,
    setLpEstimate,
  ] = useState(0);


  const [
    myEstimate,
    setMyEstimate,
  ] = useState(0);


  const [
    lpActual,
    setLpActual,
  ] = useState(0);


  const [
    myActual,
    setMyActual,
  ] = useState(0);


  // ===================================================
  // 加载信用卡数据
  // ===================================================

  useEffect(() => {

    async function load() {

      try {

        setLoading(true);

        const data =
          await getCreditCardOverview();

        const cardData =
          (data || []) as CardItem[];

        setCards(
          cardData
        );

        const estimateMap:
          Record<string, number> = {};

        const actualBillMap:
          Record<string, number> = {};

        cardData.forEach(
          card => {

            estimateMap[
              card.id
            ] =
              Number(
                card.monthly_estimate || 0
              );

            actualBillMap[
              card.id
            ] =
              Number(
                card.actual_bill_amount || 0
              );

          }
        );

        setEstimate(
          estimateMap
        );

        setActualBill(
          actualBillMap
        );

      } catch (error) {

        console.error(
          "加载信用卡数据失败:",
          error
        );

      } finally {

        setLoading(false);

      }

    }

    load();

  }, []);


  // ===================================================
  // 加载有鱼交易
  //
  // 直接读取 expense_transactions
  //
  // 实际字段：
  //
  // transaction_time
  // account_name
  // account_type
  // amount
  // is_credit_card
  //
  // ===================================================

  useEffect(() => {

    async function loadYuTransactions() {

      try {

        setYuLoading(true);

        const match =
          /^(\d{4})-(\d{2})$/.exec(
            currentMonthPrefix
          );

        if (!match) {
          setYuTransactions([]);
          return;
        }

        const year = Number(match[1]);
        const monthNumber = Number(match[2]);

        const startDate = new Date(
          year,
          monthNumber - 2,
          1
        );

        const endDate = new Date(
          year,
          monthNumber,
          1
        );

        const transactions =
  await getExpenseTransactions({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    creditCardOnly: true,
    excludeSettlement: true,
  });

const data = Array.isArray(transactions)
  ? transactions
  : [];

console.log(
  "========== 有鱼 expense_transactions =========="
);

console.log(
  "交易数量:",
  data.length
);

console.log(
  "第一条:",
  data[0]
);

console.log(
  "字段:",
  data[0]
    ? Object.keys(data[0])
    : []
);

console.log(
  "=============================================="
);

setYuTransactions(
  data
);

        console.log(
          "========== 有鱼 expense_transactions =========="
        );

        console.log(
          "交易数量:",
          transactions.length
        );

        console.log(
          "第一条:",
          transactions[0]
        );

        console.log(
          "字段:",
          transactions[0]
            ? Object.keys(
                transactions[0]
              )
            : []
        );

        console.log(
          "=============================================="
        );

        setYuTransactions(
          transactions
        );

      } catch (error) {

        console.error(
          "loadYuTransactions error:",
          error
        );

        setYuTransactions(
          []
        );

      } finally {

        setYuLoading(false);

      }

    }

    loadYuTransactions();

  }, []);


  // ===================================================
  // 加载资金安排
  // ===================================================

  useEffect(() => {

    async function loadFunding() {

      try {

        const funding =
          await getCreditCardFunding();

        setLpEstimate(
          Number(
            funding.lp_estimate_amount || 0
          )
        );

        setMyEstimate(
          Number(
            funding.my_estimate_amount || 0
          )
        );

        setLpActual(
          Number(
            funding.lp_actual_amount || 0
          )
        );

        setMyActual(
          Number(
            funding.my_actual_amount || 0
          )
        );

      } catch (error) {

        console.error(
          "加载信用卡资金安排失败:",
          error
        );

      }

    }

    loadFunding();

  }, []);


  // ===================================================
  // 金额格式
  // ===================================================

  function money(
    value: number
  ): string {

    return (
      "¥ " +
      Number(
        value || 0
      ).toLocaleString(
        "zh-CN",
        {
          maximumFractionDigits: 0,
        }
      )
    );

  }


  // ===================================================
  // 修改手动预估消费
  // ===================================================

  function handleEstimateChange(
    cardId: string,
    value: string
  ) {

    const numberValue =
      value === ""
        ? 0
        : Number(value);

    setEstimate(
      prev => ({
        ...prev,
        [cardId]:
          Number.isFinite(
            numberValue
          )
            ? numberValue
            : 0,
      })
    );

  }


  // ===================================================
  // 保存手动预估消费
  // ===================================================

  async function saveMonthlyEstimate(
    cardId: string
  ) {

    const value =
      Number(
        estimate[cardId] || 0
      );

    try {

      setSavingId(
        cardId
      );

      const {
        error,
      } =
        await supabase
          .from(
            "credit_cards"
          )
          .update({
            monthly_estimate:
              value,
          })
          .eq(
            "id",
            cardId
          );

      if (error) {

        console.error(
          "保存 monthly_estimate 失败:",
          error
        );

        alert(
          "保存失败：\n" +
          error.message
        );

        return;

      }

      setCards(
        prev =>
          prev.map(
            card =>
              card.id === cardId
                ? {
                    ...card,
                    monthly_estimate:
                      value,
                  }
                : card
          )
      );

    } catch (error: any) {

      console.error(
        "saveMonthlyEstimate error:",
        error
      );

      alert(
        "保存失败：\n" +
        (
          error?.message ||
          "未知错误"
        )
      );

    } finally {

      setSavingId(
        null
      );

    }

  }


  // ===================================================
  // 修改实际账单
  // ===================================================

  function handleActualBillChange(
    cardId: string,
    value: string
  ) {

    const numberValue =
      value === ""
        ? 0
        : Number(value);

    setActualBill(
      prev => ({
        ...prev,
        [cardId]:
          Number.isFinite(
            numberValue
          )
            ? numberValue
            : 0,
      })
    );

  }


  // ===================================================
  // 保存实际账单
  // ===================================================

  async function saveActualBill(
    cardId: string
  ) {

    const value =
      Number(
        actualBill[cardId] || 0
      );

    try {

      setSavingId(
        cardId
      );

      const {
        error,
      } =
        await supabase
          .from(
            "credit_cards"
          )
          .update({
            actual_bill_amount:
              value,
          })
          .eq(
            "id",
            cardId
          );

      if (error) {

        console.error(
          "保存 actual_bill_amount 失败:",
          error
        );

        alert(
          "实际账单保存失败：\n" +
          error.message
        );

        return;

      }

      setCards(
        prev =>
          prev.map(
            card =>
              card.id === cardId
                ? {
                    ...card,
                    actual_bill_amount:
                      value,
                  }
                : card
          )
      );

    } catch (error: any) {

      console.error(
        "saveActualBill error:",
        error
      );

      alert(
        "实际账单保存失败：\n" +
        (
          error?.message ||
          "未知错误"
        )
      );

    } finally {

      setSavingId(
        null
      );

    }

  }


  // ===================================================
  // 数字输入
  // ===================================================

  function numberInput(
    value: string
  ): number {

    if (
      value === ""
    ) {
      return 0;
    }

    const number =
      Number(value);

    return Number.isFinite(
      number
    )
      ? number
      : 0;

  }


  // ===================================================
  // 自动保存资金安排
  // ===================================================

  async function autoSaveFunding(
    values: {
      lpEstimate?: number;
      myEstimate?: number;
      lpActual?: number;
      myActual?: number;
    }
  ) {

    try {

      setFundingSaving(
        true
      );

      setFundingSaved(
        false
      );

      const result =
        await saveCreditCardFunding({

          lp_estimate_amount:
            values.lpEstimate ??
            lpEstimate,

          my_estimate_amount:
            values.myEstimate ??
            myEstimate,

          lp_actual_amount:
            values.lpActual ??
            lpActual,

          my_actual_amount:
            values.myActual ??
            myActual,

        });

      if (!result) {

        console.error(
          "自动保存信用卡资金安排失败"
        );

        return;

      }

      setLpEstimate(
        Number(
          result.lp_estimate_amount || 0
        )
      );

      setMyEstimate(
        Number(
          result.my_estimate_amount || 0
        )
      );

      setLpActual(
        Number(
          result.lp_actual_amount || 0
        )
      );

      setMyActual(
        Number(
          result.my_actual_amount || 0
        )
      );

      setFundingSaved(
        true
      );

      window.setTimeout(
        () => {
          setFundingSaved(
            false
          );
        },
        2000
      );

    } catch (error: any) {

      console.error(
        "autoSaveFunding error:",
        error
      );

      alert(
        "资金安排自动保存失败：\n" +
        (
          error?.message ||
          "未知错误"
        )
      );

    } finally {

      setFundingSaving(
        false
      );

    }

  }


  // ===================================================
  // 有鱼预估消费
  //
  // 规则：
  //
  // 1. 只统计当前月份
  // 2. 只统计 is_credit_card = true
  // 3. 使用 transaction_time 判断月份
  // 4. 使用 account_name / account_type 匹配信用卡
  // 5. amount 自动取绝对值
  // 6. 不写回 credit_cards
  //
  // ===================================================

  const yuEstimateMap =
    useMemo(
      () => {

        const map: Record<string, number> = {};

        cards.forEach(card => {

          const targetName =
            normalizeName(card.card_name);

          const targetBank =
            normalizeBankName(card.bank_name);

          const billingDay =
            getBillingDay(card);

          const cycle =
            getCardBillingCycle(
              currentMonthPrefix,
              billingDay
            );

          if (!cycle) {
            map[card.id] = 0;
            return;
          }

          let total = 0;

          yuTransactions.forEach(transaction => {

            if (transaction.is_credit_card !== true) {
              return;
            }

            const transactionDate =
              getTransactionDate(transaction);

            if (!transactionDate) {
              return;
            }

            if (
              !isDateInBillingCycle(
                transactionDate,
                cycle.start,
                cycle.end
              )
            ) {
              return;
            }

            const transactionAccount =
              String(
                transaction.account_name ||
                ""
              ).trim();

            if (!transactionAccount) {
              return;
            }

            const transactionName =
              normalizeName(transactionAccount);

            const transactionBank =
              normalizeBankName(transactionAccount);

            const nameMatched =
              transactionName === targetName;

            const bankMatched =
              !!targetBank &&
              transactionBank === targetBank;

            if (!nameMatched && !bankMatched) {
              return;
            }

            const type =
              String(
                transaction.income_expense_type ||
                ""
              );

            if (type.includes("收入")) {
              return;
            }

            if (transaction.is_settlement === true) {
              return;
            }

            total +=
              getTransactionAmount(transaction);
          });

          map[card.id] = total;
        });

        return map;
      },
      [
        cards,
        yuTransactions,
        currentMonthPrefix,
      ]
    );

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
        prev =>
          prev === "asc"
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
  // 排序图标
  // ===================================================

  function sortIcon(
    key: SortKey
  ) {

    if (
      sortKey !== key
    ) {

      return (
        <span
          className="
            ml-1
            text-gray-300
          "
        >
          ↕
        </span>
      );

    }

    return (
      <span
        className="
          ml-1
          text-blue-600
        "
      >
        {
          sortDirection === "asc"
            ? "↑"
            : "↓"
        }
      </span>
    );

  }


  // ===================================================
  // 排序后的信用卡
  // ===================================================

  const sortedCards =
    useMemo(
      () => {

        const result =
          [...cards];

        result.sort(
          (a, b) => {

            let aValue: any;
            let bValue: any;

            if (
              sortKey ===
              "monthly_estimate"
            ) {

              aValue =
                Number(
                  estimate[a.id] || 0
                );

              bValue =
                Number(
                  estimate[b.id] || 0
                );

            }

            else if (
              sortKey ===
              "yu_estimate"
            ) {

              aValue =
                Number(
                  yuEstimateMap[
                    a.id
                  ] || 0
                );

              bValue =
                Number(
                  yuEstimateMap[
                    b.id
                  ] || 0
                );

            }

            else if (
              sortKey ===
              "gap"
            ) {

              aValue =
                Number(
                  estimate[a.id] || 0
                ) -
                Number(
                  yuEstimateMap[
                    a.id
                  ] || 0
                );

              bValue =
                Number(
                  estimate[b.id] || 0
                ) -
                Number(
                  yuEstimateMap[
                    b.id
                  ] || 0
                );

            }

            else if (
              sortKey ===
              "total"
            ) {

              aValue =
                Number(
                  a.installment || 0
                ) +
                Number(
                  yuEstimateMap[
                    a.id
                  ] || 0
                );

              bValue =
                Number(
                  b.installment || 0
                ) +
                Number(
                  yuEstimateMap[
                    b.id
                  ] || 0
                );

            }

            else if (
              sortKey ===
              "actual_bill_amount"
            ) {

              aValue =
                Number(
                  actualBill[
                    a.id
                  ] || 0
                );

              bValue =
                Number(
                  actualBill[
                    b.id
                  ] || 0
                );

            }

            else if (
              sortKey ===
                "bank_name" ||
              sortKey ===
                "card_name"
            ) {

              aValue =
                String(
                  a[
                    sortKey
                  ] || ""
                );

              bValue =
                String(
                  b[
                    sortKey
                  ] || ""
                );

            }

            else {

              aValue =
                Number(
                  a[
                    sortKey
                  ] || 0
                );

              bValue =
                Number(
                  b[
                    sortKey
                  ] || 0
                );

            }


            if (
              typeof aValue ===
                "string" &&
              typeof bValue ===
                "string"
            ) {

              const comparison =
                aValue.localeCompare(
                  bValue,
                  "zh-CN"
                );

              return (
                sortDirection ===
                "asc"
              )
                ? comparison
                : -comparison;

            }


            if (
              aValue <
              bValue
            ) {

              return (
                sortDirection ===
                "asc"
              )
                ? -1
                : 1;

            }


            if (
              aValue >
              bValue
            ) {

              return (
                sortDirection ===
                "asc"
              )
                ? 1
                : -1;

            }

            return 0;

          }
        );

        return result;

      },
      [
        cards,
        estimate,
        yuEstimateMap,
        actualBill,
        sortKey,
        sortDirection,
      ]
    );


  // ===================================================
  // 本月固定分期
  // ===================================================

  const installmentTotal =
    cards.reduce(
      (
        sum,
        card
      ) =>
        sum +
        Number(
          card.installment || 0
        ),
      0
    );


  // ===================================================
  // 手动预估消费
  // ===================================================

  const estimateTotal =
    cards.reduce(
      (
        sum,
        card
      ) =>
        sum +
        Number(
          estimate[
            card.id
          ] || 0
        ),
      0
    );


  // ===================================================
  // 有鱼预估消费
  // ===================================================

  const yuEstimateTotal =
    cards.reduce(
      (
        sum,
        card
      ) =>
        sum +
        Number(
          yuEstimateMap[
            card.id
          ] || 0
        ),
      0
    );


  // ===================================================
  // GAP
  //
  // 手动预估 - 有鱼预估
  // ===================================================

  const gapTotal =
    estimateTotal -
    yuEstimateTotal;


  // ===================================================
  // 本月预计支出
  //
  // 固定分期 + 手动预估消费
  // ===================================================

  const total =
    installmentTotal +
    estimateTotal;


  // ===================================================
  // 实际账单总额
  // ===================================================

  const actualBillTotal =
    cards.reduce(
      (
        sum,
        card
      ) =>
        sum +
        Number(
          actualBill[
            card.id
          ] || 0
        ),
      0
    );


  // ===================================================
  // 预估资金安排
  // ===================================================

  const estimateFundingTotal =
    lpEstimate +
    myEstimate;


  const estimateNeedMyself =
    Math.max(
      0,
      total -
      estimateFundingTotal
    );


  // ===================================================
  // 实际资金安排
  // ===================================================

  const actualFundingTotal =
    lpActual +
    myActual;


  const actualNeedMyself =
    Math.max(
      0,
      actualBillTotal -
      actualFundingTotal
    );


  // ===================================================
  // 是否足够
  // ===================================================

  const estimateFundingEnough =
    estimateFundingTotal >=
    total;


  const actualFundingEnough =
    actualFundingTotal >=
    actualBillTotal;


  // ===================================================
  // Loading
  // ===================================================

  if (
    loading
  ) {

    return (
      <>
        <TopBar
          title="Credit Card"
        />

        <main
          className="
            max-w-[1200px]
            mx-auto
            px-6
            py-8
          "
        >

          <div
            className="
              bg-white
              border
              border-gray-200
              rounded-xl
              p-8
              text-center
              text-gray-500
            "
          >

            正在加载信用卡数据...

          </div>

        </main>
      </>
    );

  }


  // ===================================================
  // 页面
  // ===================================================

  return (
    <>

      <TopBar
        title="Credit Card"
      />

      <main
        className="
          max-w-[1400px]
          mx-auto
          px-6
          py-6
          space-y-6
        "
      >

        {/* =================================================
            页面标题
        ================================================= */}

        <section>

          <h1
            className="
              text-2xl
              font-bold
              text-gray-900
            "
          >

            （{currentMonth}月）月账单 · （{nextMonth}月）月还

          </h1>

          <p
            className="
              text-base
              font-semibold
              text-gray-700
              mt-1
            "
          >

            信用卡消费预测

          </p>

          <p
            className="
              text-sm
              text-gray-500
              mt-1
            "
          >

            手动预估消费与有鱼消费数据同时对比，预计支出采用手动预估消费

          </p>

        </section>


        {/* =================================================
            汇总
        ================================================= */}

        <section
          className="
            grid
            grid-cols-1
            md:grid-cols-4
            gap-4
          "
        >

          <div
            className="
              bg-blue-50
              border
              border-blue-100
              rounded-xl
              p-5
            "
          >

            <div
              className="
                text-sm
                text-gray-500
              "
            >
              {currentMonth}月固定分期
            </div>

            <div
              className="
                text-2xl
                font-bold
                text-gray-900
                mt-2
              "
            >

              {money(
                installmentTotal
              )}

            </div>

          </div>


          <div
            className={`
              bg-green-50
              border
              border-green-100
              rounded-xl
              p-5
              ${showYuEstimate ? "" : "hidden"}`}
          >

            <div
              className="
                text-sm
                text-gray-500
              "
            >
              {currentMonth}月有鱼预估消费
            </div>

            <div
              className="
                text-2xl
                font-bold
                text-gray-900
                mt-2
              "
            >

              {
                yuLoading
                  ? "..."
                  : money(
                      yuEstimateTotal
                    )
              }

            </div>

          </div>


          <div
            className="
              bg-gray-100
              border
              border-gray-200
              rounded-xl
              p-5
            "
          >

            <div
              className="
                text-sm
                text-gray-500
              "
            >
              手动预估消费
            </div>

            <div
              className="
                text-2xl
                font-bold
                text-gray-900
                mt-2
              "
            >

              {money(
                estimateTotal
              )}

            </div>

          </div>


          <div
            className="
              bg-red-50
              border
              border-red-100
              rounded-xl
              p-5
            "
          >

            <div
              className="
                text-sm
                text-gray-500
              "
            >
              {currentMonth}月预计支出
            </div>

            <div
              className="
                text-2xl
                font-bold
                text-gray-900
                mt-2
              "
            >

              {money(
                total
              )}

            </div>

          </div>

        </section>


        {/* =================================================
            显示字段
            仅控制 UI，不影响任何数据和计算
        ================================================= */}
        <div className="flex justify-end">
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowFieldMenu(prev => !prev)}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50"
            >
              显示字段
              <span className="text-gray-400">▾</span>
            </button>

            {showFieldMenu && (
              <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-200 rounded-lg shadow-lg p-3 z-30">
                <div className="text-xs text-gray-400 mb-2">
                  可选显示字段
                </div>
                <label className="flex items-center gap-2 py-1.5 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showYuEstimate}
                    onChange={e => setShowYuEstimate(e.target.checked)}
                    className="rounded"
                  />
                  有鱼预估消费
                </label>
                <label className="flex items-center gap-2 py-1.5 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showGap}
                    onChange={e => setShowGap(e.target.checked)}
                    className="rounded"
                  />
                  GAP
                </label>
              </div>
            )}
          </div>
        </div>

        {/* =================================================
            信用卡表格
        ================================================= */}

        <section
          className="
            bg-white
            rounded-xl
            border
            border-gray-200
            overflow-hidden
          "
        >

          <div
            className="
              overflow-x-auto
            "
          >

            <table
              className={`
                w-full
                ${
                  showYuEstimate || showGap
                    ? "min-w-[1350px]"
                    : "min-w-[1050px]"
                }
                text-sm
              `}
            >

              <thead>

                <tr
                  className="
                    border-b
                    border-gray-200
                    bg-gray-50
                  "
                >

                  {/* 银行 */}

                  <th
                    className="
                      text-left
                      px-4
                      py-3
                      font-medium
                      text-gray-500
                    "
                  >

                    <button
                      type="button"
                      className="
                        inline-flex
                        items-center
                        hover:text-blue-600
                      "
                      onClick={() =>
                        handleSort(
                          "bank_name"
                        )
                      }
                    >

                      银行
                      {sortIcon(
                        "bank_name"
                      )}

                    </button>

                  </th>


                  {/* 信用卡 */}

                  <th
                    className="
                      text-left
                      px-4
                      py-3
                      font-medium
                      text-gray-500
                    "
                  >

                    <button
                      type="button"
                      className="
                        inline-flex
                        items-center
                        hover:text-blue-600
                      "
                      onClick={() =>
                        handleSort(
                          "card_name"
                        )
                      }
                    >

                      信用卡
                      {sortIcon(
                        "card_name"
                      )}

                    </button>

                  </th>


                  {/* 账单日 */}

                  <th
                    className="
                      text-right
                      px-4
                      py-3
                      font-medium
                      text-gray-500
                    "
                  >

                    <button
                      type="button"
                      className="
                        inline-flex
                        items-center
                        hover:text-blue-600
                      "
                      onClick={() =>
                        handleSort(
                          "billing_day"
                        )
                      }
                    >

                      {currentMonth}月账单日
                      {sortIcon(
                        "billing_day"
                      )}

                    </button>

                  </th>


                  {/* 还款日 */}

                  <th
                    className="
                      text-right
                      px-4
                      py-3
                      font-medium
                      text-gray-500
                    "
                  >

                    <button
                      type="button"
                      className="
                        inline-flex
                        items-center
                        hover:text-blue-600
                      "
                      onClick={() =>
                        handleSort(
                          "payment_day"
                        )
                      }
                    >

                      {nextMonth}月还款日
                      {sortIcon(
                        "payment_day"
                      )}

                    </button>

                  </th>


                  {/* 分期 */}

                  <th
                    className="
                      text-right
                      px-4
                      py-3
                      font-medium
                      text-gray-500
                    "
                  >

                    <button
                      type="button"
                      className="
                        inline-flex
                        items-center
                        hover:text-blue-600
                      "
                      onClick={() =>
                        handleSort(
                          "installment"
                        )
                      }
                    >

                      {currentMonth}月分期
                      {sortIcon(
                        "installment"
                      )}

                    </button>

                  </th>


                  {/* 手动预估 */}

                  <th
                    className="
                      text-right
                      px-4
                      py-3
                      font-medium
                      text-gray-500
                    "
                  >

                    <button
                      type="button"
                      className="
                        inline-flex
                        items-center
                        hover:text-blue-600
                      "
                      onClick={() =>
                        handleSort(
                          "monthly_estimate"
                        )
                      }
                    >

                      手动预估消费
                      {sortIcon(
                        "monthly_estimate"
                      )}

                    </button>

                  </th>


                  {/* 有鱼 */}

                  {showYuEstimate && (
                  <th
                    className="
                      text-right
                      px-4
                      py-3
                      font-medium
                      text-gray-500
                      bg-gray-100
                    "
                  >

                    <button
                      type="button"
                      className="
                        inline-flex
                        items-center
                        hover:text-blue-600
                      "
                      onClick={() =>
                        handleSort(
                          "yu_estimate"
                        )
                      }
                    >

                      有鱼预估消费
                      {sortIcon(
                        "yu_estimate"
                      )}

                    </button>

                  </th>
                  )}


                  {/* GAP */}

                  {showGap && (
                  <th
                    className="
                      text-right
                      px-4
                      py-3
                      font-medium
                      text-gray-500
                      bg-gray-100
                    "
                  >

                    <button
                      type="button"
                      className="
                        inline-flex
                        items-center
                        hover:text-blue-600
                      "
                      onClick={() =>
                        handleSort(
                          "gap"
                        )
                      }
                    >

                      GAP
                      {sortIcon(
                        "gap"
                      )}

                    </button>

                  </th>
                  )}


                  {/* 预计支出 */}

                  <th
                    className="
                      text-right
                      px-4
                      py-3
                      font-medium
                      text-gray-500
                    "
                  >

                    <button
                      type="button"
                      className="
                        inline-flex
                        items-center
                        hover:text-blue-600
                      "
                      onClick={() =>
                        handleSort(
                          "total"
                        )
                      }
                    >

                      预计支出
                      {sortIcon(
                        "total"
                      )}

                    </button>

                  </th>


                  {/* 实际账单 */}

                  <th
                    className="
                      text-right
                      px-4
                      py-3
                      font-medium
                      text-gray-500
                    "
                  >

                    <button
                      type="button"
                      className="
                        inline-flex
                        items-center
                        hover:text-blue-600
                      "
                      onClick={() =>
                        handleSort(
                          "actual_bill_amount"
                        )
                      }
                    >

                      实际账单
                      {sortIcon(
                        "actual_bill_amount"
                      )}

                    </button>

                  </th>

                </tr>

              </thead>


              <tbody>

                {
                  sortedCards.length === 0

                    ? (

                      <tr>

                        <td
                          colSpan={
                            9 +
                            (showYuEstimate ? 1 : 0) +
                            (showGap ? 1 : 0)
                          }
                          className="
                            px-4
                            py-12
                            text-center
                            text-gray-400
                          "
                        >

                          暂无信用卡

                        </td>

                      </tr>

                    )

                    : (

                      sortedCards.map(
                        card => {

                          const monthlyEstimate =
                            Number(
                              estimate[
                                card.id
                              ] || 0
                            );

                          const yuEstimate =
                            Number(
                              yuEstimateMap[
                                card.id
                              ] || 0
                            );

                          const gap =
                            monthlyEstimate -
                            yuEstimate;

                          const cardTotal =
                            Number(
                              card.installment || 0
                            ) +
                            monthlyEstimate;


                          return (

                            <tr
                              key={
                                card.id
                              }
                              className="
                                border-b
                                border-gray-100
                                last:border-b-0
                                hover:bg-gray-50
                              "
                            >

                              {/* 银行 */}

                              <td
                                className="
                                  px-4
                                  py-3.5
                                  font-medium
                                  text-gray-900
                                "
                              >

                                {
                                  card.bank_name
                                }

                              </td>


                              {/* 信用卡 */}

                              <td
                                className="
                                  px-4
                                  py-3.5
                                  text-gray-600
                                "
                              >

                                {
                                  card.card_name ||
                                  "-"
                                }

                              </td>


                              {/* 账单日 */}

                              <td
                                className="
                                  px-4
                                  py-3.5
                                  text-right
                                  text-gray-700
                                "
                              >

                                {
                                  card.billing_day
                                    ? `${card.billing_day}日`
                                    : "-"
                                }

                              </td>


                              {/* 还款日 */}

                              <td
                                className="
                                  px-4
                                  py-3.5
                                  text-right
                                  text-gray-700
                                "
                              >

                                {
                                  card.payment_day
                                    ? `${card.payment_day}日`
                                    : "-"
                                }

                              </td>


                              {/* 分期 */}

                              <td
                                className="
                                  px-4
                                  py-3.5
                                  text-right
                                  text-gray-700
                                "
                              >

                                {
                                  money(
                                    card.installment
                                  )
                                }

                              </td>


                              {/* 手动预估 */}

                              <td
                                className="
                                  px-4
                                  py-3.5
                                  text-right
                                "
                              >

                                <div
                                  className="
                                    flex
                                    items-center
                                    justify-end
                                    gap-2
                                  "
                                >

                                  <span
                                    className="
                                      text-gray-400
                                    "
                                  >
                                    ¥
                                  </span>

                                  <input
                                    type="number"
                                    min="0"
                                    step="100"
                                    className="
                                      w-28
                                      border
                                      border-gray-200
                                      rounded-md
                                      px-2.5
                                      py-1.5
                                      text-right
                                      text-sm
                                      outline-none
                                      focus:border-blue-500
                                      focus:ring-1
                                      focus:ring-blue-100
                                    "
                                    value={
                                      estimate[
                                        card.id
                                      ] ?? ""
                                    }
                                    onChange={
                                      e =>
                                        handleEstimateChange(
                                          card.id,
                                          e.target.value
                                        )
                                    }
                                    onBlur={() =>
                                      saveMonthlyEstimate(
                                        card.id
                                      )
                                    }
                                    onKeyDown={
                                      e => {

                                        if (
                                          e.key ===
                                          "Enter"
                                        ) {

                                          e.currentTarget.blur();

                                        }

                                      }
                                    }
                                  />

                                  {
                                    savingId ===
                                      card.id && (

                                      <span
                                        className="
                                          text-xs
                                          text-gray-400
                                        "
                                      >

                                        保存中

                                      </span>

                                    )
                                  }

                                </div>

                              </td>


                              {/* 有鱼预估 */}

                              {showYuEstimate && (
                              <td
                                className="
                                  px-4
                                  py-3.5
                                  text-right
                                  bg-gray-100
                                  font-medium
                                  text-gray-700
                                "
                              >

                                {
                                  yuLoading
                                    ? "..."
                                    : money(
                                        yuEstimate
                                      )
                                }

                              </td>
                              )}


                              {/* GAP */}

                              {showGap && (
                              <td
                                className={`
                                  px-4
                                  py-3.5
                                  text-right
                                  bg-gray-100
                                  font-medium
                                  ${
                                    gap > 0
                                      ? "text-red-600"
                                      : gap < 0
                                        ? "text-green-600"
                                        : "text-gray-700"
                                  }
                                `}
                              >

                                {money(
                                  gap
                                )}

                              </td>
                              )}


                              {/* 预计支出 */}

                              <td
                                className="
                                  px-4
                                  py-3.5
                                  text-right
                                  font-semibold
                                  text-gray-900
                                "
                              >

                                {
                                  money(
                                    cardTotal
                                  )
                                }

                              </td>


                              {/* 实际账单 */}

                              <td
                                className="
                                  px-4
                                  py-3.5
                                  text-right
                                "
                              >

                                <div
                                  className="
                                    flex
                                    items-center
                                    justify-end
                                    gap-2
                                  "
                                >

                                  <span
                                    className="
                                      text-gray-400
                                    "
                                  >
                                    ¥
                                  </span>

                                  <input
                                    type="number"
                                    min="0"
                                    step="100"
                                    className="
                                      w-28
                                      border
                                      border-gray-200
                                      rounded-md
                                      px-2.5
                                      py-1.5
                                      text-right
                                      text-sm
                                      outline-none
                                      focus:border-blue-500
                                      focus:ring-1
                                      focus:ring-blue-100
                                    "
                                    value={
                                      actualBill[
                                        card.id
                                      ] ?? ""
                                    }
                                    onChange={
                                      e =>
                                        handleActualBillChange(
                                          card.id,
                                          e.target.value
                                        )
                                    }
                                    onBlur={() =>
                                      saveActualBill(
                                        card.id
                                      )
                                    }
                                    onKeyDown={
                                      e => {

                                        if (
                                          e.key ===
                                          "Enter"
                                        ) {

                                          e.currentTarget.blur();

                                        }

                                      }
                                    }
                                  />

                                </div>

                              </td>

                            </tr>

                          );

                        }
                      )

                    )
                }

              </tbody>

            </table>

          </div>


          {/* =================================================
              合计
          ================================================= */}

          <div
            className="
              border-t
              border-gray-200
              bg-gray-50
              px-4
              py-4
            "
          >

            <div
              className="
                flex
                flex-wrap
                items-center
                justify-end
                gap-6
                text-sm
              "
            >

              <div>

                <span
                  className="
                    text-gray-500
                  "
                >
                  手动预估：
                </span>

                <span
                  className="
                    ml-2
                    font-semibold
                    text-gray-900
                  "
                >

                  {money(
                    estimateTotal
                  )}

                </span>

              </div>


              {showYuEstimate && (
              <div
                className="
                  bg-gray-100
                  px-3
                  py-1.5
                  rounded-md
                "
              >

                <span
                  className="
                    text-gray-500
                  "
                >
                  有鱼预估：
                </span>

                <span
                  className="
                    ml-2
                    font-semibold
                    text-gray-900
                  "
                >

                  {
                    yuLoading
                      ? "..."
                      : money(
                          yuEstimateTotal
                        )
                  }

                </span>

              </div>
              )}


              {showGap && (
              <div
                className="
                  bg-gray-100
                  px-3
                  py-1.5
                  rounded-md
                "
              >

                <span
                  className="
                    text-gray-500
                  "
                >
                  GAP：
                </span>

                <span
                  className={`
                    ml-2
                    font-semibold
                    ${
                      gapTotal > 0
                        ? "text-red-600"
                        : gapTotal < 0
                          ? "text-green-600"
                          : "text-gray-900"
                    }
                  `}
                >

                  {money(
                    gapTotal
                  )}

                </span>

              </div>
              )}


              <div>

                <span
                  className="
                    text-gray-500
                  "
                >
                  {currentMonth}月预计支出：
                </span>

                <span
                  className="
                    ml-2
                    font-semibold
                    text-gray-900
                  "
                >

                  {money(
                    total
                  )}

                </span>

              </div>


              <div>

                <span
                  className="
                    text-gray-500
                  "
                >
                  {currentMonth}月实际账单：
                </span>

                <span
                  className="
                    ml-2
                    font-semibold
                    text-gray-900
                  "
                >

                  {money(
                    actualBillTotal
                  )}

                </span>

              </div>

            </div>

          </div>

        </section>


        {/* =================================================
            信用卡资金安排
        ================================================= */}

        <section
          className="
            bg-white
            rounded-xl
            border
            border-gray-200
            p-6
          "
        >

          <div
            className="
              flex
              items-center
              justify-between
              mb-5
            "
          >

            <div>

              <h2
                className="
                  text-xl
                  font-bold
                  text-gray-900
                "
              >

                💰 信用卡资金安排

              </h2>

              <p
                className="
                  text-sm
                  text-gray-500
                  mt-1
                "
              >

                按全部信用卡合计安排资金，不按单张信用卡拆分

              </p>

            </div>


            <div
              className="
                text-sm
                min-w-[70px]
                text-right
              "
            >

              {
                fundingSaving && (

                  <span
                    className="
                      text-gray-400
                    "
                  >
                    保存中...
                  </span>

                )
              }

              {
                !fundingSaving &&
                fundingSaved && (

                  <span
                    className="
                      text-green-600
                    "
                  >
                    ✓ 已保存
                  </span>

                )
              }

            </div>

          </div>


          {/* =================================================
              两套资金安排
          ================================================= */}

          <div
            className="
              grid
              grid-cols-1
              lg:grid-cols-2
              gap-6
            "
          >

            {/* =================================================
                预估账单资金安排
            ================================================= */}

            <div
              className="
                border
                border-green-200
                rounded-xl
                p-5
                bg-green-50/50
              "
            >

              <div
                className="
                  flex
                  items-center
                  justify-between
                  mb-5
                "
              >

                <div>

                  <h3
                    className="
                      text-lg
                      font-semibold
                      text-gray-900
                    "
                  >

                    {currentMonth}月预估账单资金安排

                  </h3>

                  <p
                    className="
                      text-xs
                      text-gray-500
                      mt-1
                    "
                  >

                    以手动预估消费 + 固定分期提前安排

                  </p>

                </div>


                <div
                  className="
                    text-right
                  "
                >

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
                      font-bold
                      text-lg
                      text-gray-900
                    "
                  >

                    {money(
                      total
                    )}

                  </div>

                </div>

              </div>


              <div
                className="
                  grid
                  grid-cols-1
                  md:grid-cols-2
                  gap-4
                "
              >

                {/* LP */}

                <div>

                  <label
                    className="
                      block
                      text-sm
                      font-medium
                      text-gray-700
                      mb-2
                    "
                  >

                    LP给我

                  </label>

                  <div
                    className="
                      relative
                    "
                  >

                    <span
                      className="
                        absolute
                        left-3
                        top-1/2
                        -translate-y-1/2
                        text-gray-400
                      "
                    >

                      ¥

                    </span>

                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={
                        lpEstimate || ""
                      }
                      onChange={
                        e => {

                          setLpEstimate(
                            numberInput(
                              e.target.value
                            )
                          );

                          setFundingSaved(
                            false
                          );

                        }
                      }
                      onBlur={() =>
                        autoSaveFunding({
                          lpEstimate,
                        })
                      }
                      onKeyDown={
                        e => {

                          if (
                            e.key ===
                            "Enter"
                          ) {

                            e.currentTarget.blur();

                          }

                        }
                      }
                      className="
                        w-full
                        border
                        border-gray-200
                        rounded-lg
                        pl-8
                        pr-3
                        py-2.5
                        text-right
                        bg-white
                        outline-none
                        focus:border-green-500
                      "
                    />

                  </div>

                </div>


                {/* 自己现在有 */}

                <div>

                  <label
                    className="
                      block
                      text-sm
                      font-medium
                      text-gray-700
                      mb-2
                    "
                  >

                    我自己现在有

                  </label>

                  <div
                    className="
                      relative
                    "
                  >

                    <span
                      className="
                        absolute
                        left-3
                        top-1/2
                        -translate-y-1/2
                        text-gray-400
                      "
                    >

                      ¥

                    </span>

                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={
                        myEstimate || ""
                      }
                      onChange={
                        e => {

                          setMyEstimate(
                            numberInput(
                              e.target.value
                            )
                          );

                          setFundingSaved(
                            false
                          );

                        }
                      }
                      onBlur={() =>
                        autoSaveFunding({
                          myEstimate,
                        })
                      }
                      onKeyDown={
                        e => {

                          if (
                            e.key ===
                            "Enter"
                          ) {

                            e.currentTarget.blur();

                          }

                        }
                      }
                      className="
                        w-full
                        border
                        border-gray-200
                        rounded-lg
                        pl-8
                        pr-3
                        py-2.5
                        text-right
                        bg-white
                        outline-none
                        focus:border-green-500
                      "
                    />

                  </div>

                </div>

              </div>


              <div
                className="
                  mt-5
                  pt-4
                  border-t
                  border-green-200
                "
              >

                <div
                  className="
                    flex
                    items-center
                    justify-between
                  "
                >

                  <span
                    className="
                      text-sm
                      text-gray-600
                    "
                  >
                    目前安排资金
                  </span>

                  <span
                    className="
                      font-semibold
                      text-gray-900
                    "
                  >

                    {money(
                      estimateFundingTotal
                    )}

                  </span>

                </div>


                <div
                  className="
                    flex
                    items-center
                    justify-between
                    mt-3
                  "
                >

                  <span
                    className="
                      text-sm
                      text-gray-600
                    "
                  >
                    还需要自己拿
                  </span>

                  <span
                    className={`
                      text-xl
                      font-bold
                      ${
                        estimateFundingEnough
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    `}
                  >

                    {money(
                      estimateNeedMyself
                    )}

                  </span>

                </div>


                <div
                  className="
                    mt-3
                    text-right
                    text-xs
                  "
                >

                  {
                    estimateFundingEnough
                      ? (
                        <span
                          className="
                            text-green-600
                            font-medium
                          "
                        >
                          ✓ 预估资金已经足够
                        </span>
                      )
                      : (
                        <span
                          className="
                            text-red-600
                            font-medium
                          "
                        >
                          ⚠ 预估资金还不足
                        </span>
                      )
                  }

                </div>

              </div>

            </div>


            {/* =================================================
                实际账单资金安排
            ================================================= */}

            <div
              className="
                border
                border-blue-200
                rounded-xl
                p-5
                bg-blue-50/50
              "
            >

              <div
                className="
                  flex
                  items-center
                  justify-between
                  mb-5
                "
              >

                <div>

                  <h3
                    className="
                      text-lg
                      font-semibold
                      text-gray-900
                    "
                  >

                    {currentMonth}月实际账单资金安排

                  </h3>

                  <p
                    className="
                      text-xs
                      text-gray-500
                      mt-1
                    "
                  >

                    账单出来后，根据实际金额重新核算

                  </p>

                </div>


                <div
                  className="
                    text-right
                  "
                >

                  <div
                    className="
                      text-xs
                      text-gray-500
                    "
                  >
                    实际账单
                  </div>

                  <div
                    className="
                      font-bold
                      text-lg
                      text-gray-900
                    "
                  >

                    {money(
                      actualBillTotal
                    )}

                  </div>

                </div>

              </div>


              <div
                className="
                  grid
                  grid-cols-1
                  md:grid-cols-2
                  gap-4
                "
              >

                {/* LP */}

                <div>

                  <label
                    className="
                      block
                      text-sm
                      font-medium
                      text-gray-700
                      mb-2
                    "
                  >

                    LP给我

                  </label>

                  <div
                    className="
                      relative
                    "
                  >

                    <span
                      className="
                        absolute
                        left-3
                        top-1/2
                        -translate-y-1/2
                        text-gray-400
                      "
                    >

                      ¥

                    </span>

                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={
                        lpActual || ""
                      }
                      onChange={
                        e => {

                          setLpActual(
                            numberInput(
                              e.target.value
                            )
                          );

                          setFundingSaved(
                            false
                          );

                        }
                      }
                      onBlur={() =>
                        autoSaveFunding({
                          lpActual,
                        })
                      }
                      onKeyDown={
                        e => {

                          if (
                            e.key ===
                            "Enter"
                          ) {

                            e.currentTarget.blur();

                          }

                        }
                      }
                      className="
                        w-full
                        border
                        border-gray-200
                        rounded-lg
                        pl-8
                        pr-3
                        py-2.5
                        text-right
                        bg-white
                        outline-none
                        focus:border-blue-500
                      "
                    />

                  </div>

                </div>


                {/* 自己现在有 */}

                <div>

                  <label
                    className="
                      block
                      text-sm
                      font-medium
                      text-gray-700
                      mb-2
                    "
                  >

                    我自己现在有

                  </label>

                  <div
                    className="
                      relative
                    "
                  >

                    <span
                      className="
                        absolute
                        left-3
                        top-1/2
                        -translate-y-1/2
                        text-gray-400
                      "
                    >

                      ¥

                    </span>

                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={
                        myActual || ""
                      }
                      onChange={
                        e => {

                          setMyActual(
                            numberInput(
                              e.target.value
                            )
                          );

                          setFundingSaved(
                            false
                          );

                        }
                      }
                      onBlur={() =>
                        autoSaveFunding({
                          myActual,
                        })
                      }
                      onKeyDown={
                        e => {

                          if (
                            e.key ===
                            "Enter"
                          ) {

                            e.currentTarget.blur();

                          }

                        }
                      }
                      className="
                        w-full
                        border
                        border-gray-200
                        rounded-lg
                        pl-8
                        pr-3
                        py-2.5
                        text-right
                        bg-white
                        outline-none
                        focus:border-blue-500
                      "
                    />

                  </div>

                </div>

              </div>


              <div
                className="
                  mt-5
                  pt-4
                  border-t
                  border-blue-200
                "
              >

                <div
                  className="
                    flex
                    items-center
                    justify-between
                  "
                >

                  <span
                    className="
                      text-sm
                      text-gray-600
                    "
                  >
                    目前安排资金
                  </span>

                  <span
                    className="
                      font-semibold
                      text-gray-900
                    "
                  >

                    {money(
                      actualFundingTotal
                    )}

                  </span>

                </div>


                <div
                  className="
                    flex
                    items-center
                    justify-between
                    mt-3
                  "
                >

                  <span
                    className="
                      text-sm
                      text-gray-600
                    "
                  >
                    还需要自己拿
                  </span>

                  <span
                    className={`
                      text-xl
                      font-bold
                      ${
                        actualFundingEnough
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    `}
                  >

                    {money(
                      actualNeedMyself
                    )}

                  </span>

                </div>


                <div
                  className="
                    mt-3
                    text-right
                    text-xs
                  "
                >

                  {
                    actualFundingEnough
                      ? (
                        <span
                          className="
                            text-green-600
                            font-medium
                          "
                        >
                          ✓ 实际资金已经足够
                        </span>
                      )
                      : (
                        <span
                          className="
                            text-red-600
                            font-medium
                          "
                        >
                          ⚠ 实际资金还不足
                        </span>
                      )
                  }

                </div>

              </div>

            </div>

          </div>


          {/* =================================================
              预估 vs 实际
          ================================================= */}

          <div
            className="
              mt-6
              border-t
              border-gray-200
              pt-5
            "
          >

            <div
              className="
                text-sm
                font-medium
                text-gray-700
                mb-3
              "
            >

              资金安排对比

            </div>


            <div
              className={`
                grid
                grid-cols-1
                ${showYuEstimate ? "md:grid-cols-4" : "md:grid-cols-3"}
                gap-4
              `}
            >

              <div
                className="
                  rounded-lg
                  bg-green-50
                  p-4
                "
              >

                <div
                  className="
                    text-xs
                    text-gray-500
                  "
                >
                  {currentMonth}月预计账单
                </div>

                <div
                  className="
                    text-lg
                    font-bold
                    mt-1
                  "
                >

                  {money(
                    total
                  )}

                </div>

              </div>


              <div
                className={`
                  rounded-lg
                  bg-gray-100
                  p-4
                ${showYuEstimate ? "" : "hidden"}`}
              >

                <div
                  className="
                    text-xs
                    text-gray-500
                  "
                >
                  {currentMonth}月有鱼预估消费
                </div>

                <div
                  className="
                    text-lg
                    font-bold
                    mt-1
                  "
                >

                  {
                    yuLoading
                      ? "..."
                      : money(
                          yuEstimateTotal
                        )
                  }

                </div>

              </div>


              <div
                className="
                  rounded-lg
                  bg-blue-50
                  p-4
                "
              >

                <div
                  className="
                    text-xs
                    text-gray-500
                  "
                >
                  {currentMonth}月实际账单
                </div>

                <div
                  className="
                    text-lg
                    font-bold
                    mt-1
                  "
                >

                  {money(
                    actualBillTotal
                  )}

                </div>

              </div>


              <div
                className="
                  rounded-lg
                  bg-gray-50
                  p-4
                "
              >

                <div
                  className="
                    text-xs
                    text-gray-500
                  "
                >
                  实际 - 预计
                </div>

                <div
                  className={`
                    text-lg
                    font-bold
                    mt-1
                    ${
                      actualBillTotal >
                      total
                        ? "text-red-600"
                        : "text-green-600"
                    }
                  `}
                >

                  {
                    money(
                      actualBillTotal -
                      total
                    )
                  }

                </div>

              </div>

            </div>

          </div>

        </section>


        {/* =================================================
            底部说明
        ================================================= */}

        <div
          className="
            text-xs
            text-gray-400
            px-1
          "
        >

          信用卡资金安排为全部信用卡合计；手动预估消费来自信用卡设置，有鱼预估消费来自 expense_transactions。当前月份有鱼数据仅统计 is_credit_card = true 的消费交易，并根据 transaction_time 判断月份、account_name 匹配信用卡。GAP = 手动预估消费 − 有鱼预估消费。预计账单采用固定分期 + 有鱼预估消费，实际账单用于账单生成后重新核算。资金安排金额修改后会自动保存。

        </div>

      </main>

    </>
  );

}