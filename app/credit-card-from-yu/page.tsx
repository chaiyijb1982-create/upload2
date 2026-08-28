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
//
// 这个范围现在只用于：
// 从数据库 / Excel 一次性读取足够大的交易范围。
//
// 真正每张卡的消费周期，后面根据 billing_day
// 单独计算。
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

  /*
   * 读取：
   *
   * 上一个月1日
   * →
   * 下一个月1日
   *
   * 这样可以覆盖：
   *
   * 上个月账单日 + 1
   * 到
   * 本月账单日
   */

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

  // 平账不是消费
  if (item.is_settlement) {
    return false;
  }

  // 收入不是消费
  const type =
    item.income_expense_type ||
    "";

  if (type.includes("收入")) {
    return false;
  }

  // 消费归属已经由 expense_transactions.consumption_type
  // 明确确定：
  // self            = 自己消费
  // paid_for_others = 替别人先付
  // null            = 非消费
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
// 信用卡银行名称标准化
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

  // 去掉信用卡
  name =
    name.replace(
      /信用卡/g,
      ""
    );

  // 去掉银行
  name =
    name.replace(
      /银行/g,
      ""
    );

  // 工商银行 / 工行
  if (
    name === "工行"
  ) {

    return "工商";

  }

  // 建设银行 / 建行
  if (
    name === "建行"
  ) {

    return "建设";

  }

  // 中国银行 / 中行
  if (
    name === "中行"
  ) {

    return "中国";

  }

  // 交通银行 / 交行
  if (
    name === "交行"
  ) {

    return "交通";

  }

  // 招商银行 / 招行
  if (
    name === "招行"
  ) {

    return "招商";

  }

  // 中信银行 / 中信
  if (
    name === "中信"
  ) {

    return "中信";

  }

  // 宁波银行 / 宁波
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
// 资金安排 LocalStorage Key
//
// 每个月独立保存
//
// 例如：
// credit-card-from-yu-funding-2026-08
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
// 获取某个月的实际账单日
//
// 例如：
// billingDay = 31
//
// 2026-08 没有31日
// → 使用 2026-08-31
//
// 如果某月份不存在该日期，则使用该月最后一天。
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
// 获取某张卡在指定月份的账单周期
//
// 例如：
// 选择 2026-08
// 账单日 = 20
//
// 本月账单日：2026-08-20
// 上月账单日：2026-07-20
//
// 消费周期：
// 2026-07-21 ～ 2026-08-20
//
// 注意：
// 两端都包含。
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

  /*
   * 上个账单日 + 1 天
   */
  const start =
    new Date(
      previousBillingDate
    );

  start.setDate(
    start.getDate() + 1
  );

  /*
   * 本月账单日
   */
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
// 交易日期
//
// 兼容 expense_transactions 中可能存在的日期字段。
//
// 优先使用交易发生日期。
// =====================================================

// =====================================================
// 交易日期
//
// expense_transactions 实际日期字段：
// transaction_time
//
// 兼容：
// transaction_time
// transaction_date
// expense_date
// date
// transactionDate
// occurred_at
// created_at
//
// 重要：
// transaction_time 是有鱼实际使用的字段。
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


  // ---------------------------------------------------
  // 如果本身就是 Date
  // ---------------------------------------------------

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


  // ---------------------------------------------------
  // YYYY-MM-DD
  //
  // 不直接：
  // new Date("2026-07-26")
  //
  // 避免 UTC 导致日期偏移。
  // ---------------------------------------------------

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


  // ---------------------------------------------------
  // YYYY-MM-DD HH:mm
  // YYYY-MM-DD HH:mm:ss
  //
  // 有鱼常见格式：
  //
  // 2026-07-26 06:20
  //
  // 直接按本地日期时间解析，
  // 不让浏览器自行当 UTC 处理。
  // ---------------------------------------------------

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


  // ---------------------------------------------------
  // ISO 时间
  //
  // 例如：
  // 2026-07-26T06:20:00
  // 2026-07-26T06:20:00+08:00
  // ---------------------------------------------------

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
//
// 只比较年月日，不比较时间。
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
// 判断交易是否在账单周期内
//
// 包含开始日
// 包含结束日
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
    useState<ExpenseTransaction[]>(
      []
    );


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


  // ===================================================
  // 资金保存状态
  // ===================================================

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
  // 加载当前月份的资金安排
  //
  // 页面进入 / 切换月份：
  //
  // 读取：
  //
  // LP给我
  // 我自己现在有
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

          const savedLpMoney =
            toNumber(
              data.lpMoney
            );

          const savedOwnMoney =
            toNumber(
              data.ownMoney
            );

          setLpMoney(
            savedLpMoney
          );

          setOwnMoney(
            savedOwnMoney
          );

        }

      } else {

        // 新月份没有保存记录
        // 使用默认值
        setLpMoney(12000);

        setOwnMoney(0);

      }

    } catch (err) {

      console.error(
        "读取资金安排失败:",
        err
      );

      // 如果本地数据损坏
      // 不影响页面正常使用
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
  //
  // 输入完成后自动保存
  //
  // 保存：
  // LP给我
  // 我自己现在有
  // ===================================================

  useEffect(() => {

    // 必须等当前月份的数据加载完成
    // 否则页面刚切换月份时可能把旧数据覆盖掉
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


        // -------------------------------------------------
        // 信用卡
        // -------------------------------------------------

        const cardPromise =
          getCreditCards();


        // -------------------------------------------------
        // Excel 消费
        //
        // 注意：
        // 这里故意扩大读取范围。
        //
        // 因为每张卡账单周期不同。
        //
        // 例如：
        // 账单日20日
        // 需要读取7/21～8/20
        //
        // 所以不能再只读取8/1～9/1。
        // -------------------------------------------------

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


        // -------------------------------------------------
        // LOANS
        // -------------------------------------------------

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

      } catch (
        err
      ) {

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
  // Excel 消费匹配信用卡
  //
  // 这里不再提前按照月份汇总。
  //
  // 因为每张卡账单周期不同。
  //
  // 所以保留原始 transactions，
  // 在 getExcelExpenseForCard() 中：
  //
  // 1. 匹配信用卡
  // 2. 获取账单日
  // 3. 计算账单周期
  // 4. 判断交易日期
  // 5. 最终汇总
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


    // -------------------------------------------------
    // 账单日
    // -------------------------------------------------

    const billingDay =
      getBillingDay(
        card
      );


    const cycle =
      getCardBillingCycle(
        month,
        billingDay
      );


    /*
     * 如果信用卡没有设置账单日，
     * 无法计算账单周期。
     *
     * 这里不再退回自然月，
     * 避免产生错误的预估。
     */

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


    let amount =
      0;

    let selfAmount =
      0;

    let paidForOthersAmount =
      0;

    let count =
      0;


    // -------------------------------------------------
    // 名称匹配
    // -------------------------------------------------

    const targetName =
      normalizeName(
        accountName
      );


    const targetBank =
      normalizeBankName(
        cardBank
      );


    for (
      const item
      of transactions
    ) {

      // 必须是信用卡
      if (
        !item.is_credit_card
      ) {

        continue;

      }


      // 排除收入、平账
      if (
        !isExpense(item)
      ) {

        continue;

      }


      // -------------------------------------------------
      // 交易日期
      // -------------------------------------------------

      const transactionDate =
        getTransactionDate(
          item
        );


      if (!transactionDate) {

        continue;

      }


      // -------------------------------------------------
      // 账单周期过滤
      //
      // 只有：
      //
      // 上个账单日 + 1
      // ≤ 消费日期 ≤ 本月账单日
      //
      // 才进入本张卡本月预估。
      // -------------------------------------------------

      if (
        !isDateInBillingCycle(
          transactionDate,
          cycle.start,
          cycle.end
        )
      ) {

        continue;

      }


      // -------------------------------------------------
      // 信用卡账户
      // -------------------------------------------------

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


      /*
       * 优先：
       * 信用卡名称精确 / 标准化匹配
       */
      const nameMatched =
        transactionName ===
        targetName;


      /*
       * 如果名称无法匹配，
       * 再使用银行名称匹配。
       *
       * 这样保持原来页面的匹配逻辑。
       */
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


      // -------------------------------------------------
      // 排序
      // -------------------------------------------------

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

  }


  // ===================================================
  // 渲染
  // =====================================================

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
              onChange={event =>
                setMonth(
                  event.target.value
                )
              }
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
                {formatMoney(summary.excel)}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500">
                自己消费总共
              </div>

              <div className="mt-1 text-xl font-semibold">
                {formatMoney(summary.selfExpense)}
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-500">
                替别人提前付总共
              </div>

              <div className="mt-1 text-xl font-semibold">
                {formatMoney(summary.paidForOthersExpense)}
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
            表格
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


                      return (

                        <tr
                          key={
                            String(
                              (row as any).id ??
                              name
                            )
                          }
                          className="
                            hover:bg-gray-50
                          "
                        >

                          <td
                            className="
                              px-5
                              py-4
                            "
                          >

                            <div className="font-medium">
                              {name || "-"}
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

            {/* 预估账单 */}

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


            {/* LP给我 */}

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


            {/* =================================================
                我自己现在有
                自动保存
            ================================================= */}

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


            {/* 目前安排资金 */}

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


            {/* 还需要自己拿 */}

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


          {/* =================================================
              状态
          ================================================= */}

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
            ⑱ LP给我、我自己现在有按月份自动保存到本机浏览器。
          </div>

        </div>

      </main>

    </div>

  );

}