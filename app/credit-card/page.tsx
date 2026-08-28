"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import TopBar from "@/components/TopBar";

import {
  getCreditCardOverview,
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
  source?: "credit_card" | "loan";
  loan_id?: string;
};


type ExpenseTransaction = Record<string, any>;


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


type NewCardForm = {
  bank_name: string;
  card_name: string;
  billing_day: string;
  payment_day: string;
  installment: string;
};


// =====================================================
// 工具函数
// =====================================================

function toNumber(value: any): number {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  const n = Number(
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

function normalizeText(value: any): string {
  return String(value ?? "")
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
  for (const key of keys) {
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

    return Number.isNaN(date.getTime())
      ? null
      : date;
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

    return Number.isNaN(date.getTime())
      ? null
      : date;
  }

  const parsed = new Date(text);

  return Number.isNaN(parsed.getTime())
    ? null
    : parsed;
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


function isLoanCard(card: CardItem): boolean {
  return card.source === "loan" || card.id.startsWith("loan:");
}


function normalizedEquals(a: any, b: any): boolean {
  const aa = normalizeName(a);
  const bb = normalizeName(b);
  return !!aa && !!bb && aa === bb;
}


function bankMatches(a: any, b: any): boolean {
  const aa = normalizeBankName(a);
  const bb = normalizeBankName(b);
  return !!aa && !!bb && aa === bb;
}


function findLoanMatchForCard(
  card: CardItem,
  loans: any[],
  cards: CardItem[]
): any[] {
  const exact = loans.filter(loan =>
    normalizedEquals(loan.name, card.card_name)
  );

  if (exact.length > 0) {
    return exact;
  }

  const sameBankCards = cards.filter(c =>
    bankMatches(c.bank_name, card.bank_name)
  );

  // 只有该银行只有一张卡时，才允许按银行归属分期，避免同银行多张卡被重复分配。
  if (sameBankCards.length === 1) {
    return loans.filter(loan =>
      bankMatches(loan.institution, card.bank_name)
    );
  }

  return loans.filter(loan => {
    if (!bankMatches(loan.institution, card.bank_name)) {
      return false;
    }

    const loanName = normalizeName(loan.name);
    const cardName = normalizeName(card.card_name);

    return (
      !!loanName &&
      !!cardName &&
      (loanName.includes(cardName) || cardName.includes(loanName))
    );
  });
}


function buildLoanCards(
  cards: CardItem[],
  loans: any[]
): CardItem[] {
  const result = cards.map(card => ({
    ...card,
    source: "credit_card" as const,
    installment: Number(card.installment || 0),
  }));

  const matchedLoanIds = new Set<string>();

  for (const card of result) {
    const matchedLoans = findLoanMatchForCard(
      card,
      loans,
      result
    );

    if (matchedLoans.length > 0) {
      card.installment = matchedLoans.reduce(
        (sum, loan) => {
          if (loan.id) matchedLoanIds.add(String(loan.id));
          return sum + Number(loan.monthly_payment || 0);
        },
        0
      );
    }
  }

  // loans 中存在但 credit_cards 尚未建立主卡记录的信用卡分期，
  // 直接显示在信用卡页面。账单日/还款日可在页面上填写，填写后会自动建立 credit_cards 主记录。
  for (const loan of loans) {
    const loanId = String(loan.id || "");
    if (!loanId || matchedLoanIds.has(loanId)) {
      continue;
    }

    result.push({
      id: `loan:${loanId}`,
      bank_name: String(loan.institution || ""),
      card_name: String(loan.name || "信用卡分期"),
      billing_day: 0,
      payment_day: null,
      monthly_estimate: 0,
      actual_bill_amount: 0,
      installment: Number(loan.monthly_payment || 0),
      source: "loan",
      loan_id: loanId,
    });
  }

  return result;
}


function getBillingDay(card: CardItem): number {
  return Math.floor(
    toNumber(card.billing_day)
  );
}


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


function getCardBillingCycle(
  month: string,
  billingDay: number
): {
  start: Date;
  end: Date;
} | null {

  const match =
    /^(\d{4})-(\d{2})$/.exec(month);

  if (!match) return null;

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

  if (
    !currentBillingDate ||
    !previousBillingDate
  ) {
    return null;
  }

  const start =
    new Date(previousBillingDate);

  start.setDate(
    start.getDate() + 1
  );

  return {
    start,
    end: new Date(currentBillingDate),
  };
}


function startOfDay(
  date: Date
): Date {
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

  const date =
    startOfDay(
      transactionDate
    ).getTime();

  const start =
    startOfDay(
      cycleStart
    ).getTime();

  const end =
    startOfDay(
      cycleEnd
    ).getTime();

  return (
    date >= start &&
    date <= end
  );
}


// =====================================================
// 有鱼交易金额
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
  ] = useState<Record<string, number>>({});


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
  // 删除信用卡状态
  // ===================================================

  const [
    deletingId,
    setDeletingId,
  ] = useState<string | null>(null);


  // ===================================================
  // 新增信用卡弹窗
  // ===================================================

  const [
    showAddCard,
    setShowAddCard,
  ] = useState(false);


  const [
    addingCard,
    setAddingCard,
  ] = useState(false);


  const [
    newCard,
    setNewCard,
  ] = useState<NewCardForm>({
    bank_name: "",
    card_name: "",
    billing_day: "",
    payment_day: "",
    installment: "",
  });


  // ===================================================
  // 资金安排自动保存
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


  const currentMonthPrefix =
    `${currentYear}-${String(
      currentMonth
    ).padStart(2, "0")}`;

  const [selectedBillMonth, setSelectedBillMonth] = useState<string>(currentMonthPrefix);
  const selectedBillMonthNumber = Number(selectedBillMonth.slice(5, 7)) || currentMonth;
  const selectedBillYear = Number(selectedBillMonth.slice(0, 4)) || currentYear;
  const selectedPaymentMonthNumber = new Date(selectedBillYear, selectedBillMonthNumber, 1).getMonth() + 1;
  const selectedBillMonthDate = `${selectedBillMonth}-01`;

  const billMonthOptions = useMemo(() => {
    const result: string[] = [];
    const base = new Date(currentYear, currentMonth - 1, 1);
    for (let offset = -12; offset <= 24; offset += 1) {
      const date = new Date(base.getFullYear(), base.getMonth() + offset, 1);
      result.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
    }
    if (!result.includes(selectedBillMonth)) result.push(selectedBillMonth);
    return Array.from(new Set(result)).sort();
  }, [currentYear, currentMonth, selectedBillMonth]);


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
  // 加载信用卡
  // ===================================================

  async function loadCards() {

    try {

      setLoading(true);

      const [cardDataRaw, loanDataRaw] =
        await Promise.all([
          getCreditCardOverview(),
          supabase
            .from("loans")
            .select(`
              id,
              name,
              type,
              institution,
              monthly_payment,
              status
            `)
            .eq("type", "信用卡分期")
            .eq("status", "active"),
        ]);

      const loanError = loanDataRaw.error;
      if (loanError) {
        console.error(
          "加载信用卡分期贷款失败:",
          loanError
        );
      }

      const baseCards =
        ((cardDataRaw || []) as CardItem[]).map(card => ({
          ...card,
          source: "credit_card" as const,
        }));

      const loans =
        loanError
          ? []
          : (loanDataRaw.data || []);

      const mergedCards =
        buildLoanCards(
          baseCards,
          loans
        );

      setCards(mergedCards);

      setEstimate({});
      setActualBill({});

    } catch (error) {

      console.error(
        "加载信用卡数据失败:",
        error
      );

    } finally {

      setLoading(false);

    }
  }

  useEffect(() => {

    loadCards();

  }, []);


  // ===================================================
  // 加载有鱼交易
  // ===================================================

  useEffect(() => {

    async function loadYuTransactions() {

      try {

        setYuLoading(true);

        const match =
          /^(\d{4})-(\d{2})$/.exec(
            selectedBillMonth
          );

        if (!match) {
          setYuTransactions([]);
          return;
        }

        const year =
          Number(match[1]);

        const monthNumber =
          Number(match[2]);

        const startDate =
          new Date(
            year,
            monthNumber - 2,
            1
          );

        const endDate =
          new Date(
            year,
            monthNumber,
            1
          );

        const transactions =
          await getExpenseTransactions({
            startDate:
              startDate.toISOString(),
            endDate:
              endDate.toISOString(),
            creditCardOnly: true,
            excludeSettlement: true,
          });

        const data =
          Array.isArray(
            transactions
          )
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

      } catch (error) {

        console.error(
          "loadYuTransactions error:",
          error
        );

        setYuTransactions([]);

      } finally {

        setYuLoading(false);

      }

    }

    loadYuTransactions();

  }, [selectedBillMonth]);


  // ===================================================
  // 加载月度账单
  // ===================================================
  useEffect(() => {
    async function loadMonthlyBillData() {
      if (!selectedBillMonth) return;
      try {
        const { data, error } = await supabase
          .from("credit_card_monthly_bills")
          .select("credit_card_id, bill_month, monthly_estimate, actual_bill_amount")
          .eq("bill_month", selectedBillMonthDate);
        if (error) throw error;
        const estimateMap: Record<string, number> = {};
        const actualBillMap: Record<string, number> = {};
        (data || []).forEach(row => {
          const id = String(row.credit_card_id || "");
          if (!id) return;
          estimateMap[id] = toNumber(row.monthly_estimate);
          actualBillMap[id] = toNumber(row.actual_bill_amount);
        });
        if (selectedBillMonth === currentMonthPrefix) {
          cards.forEach(card => {
            if (isLoanCard(card)) return;
            if (!(card.id in estimateMap) && toNumber(card.monthly_estimate) !== 0) estimateMap[card.id] = toNumber(card.monthly_estimate);
            if (!(card.id in actualBillMap) && toNumber(card.actual_bill_amount) !== 0) actualBillMap[card.id] = toNumber(card.actual_bill_amount);
          });
        }
        cards.forEach(card => {
          if (!(card.id in estimateMap)) estimateMap[card.id] = 0;
          if (!(card.id in actualBillMap)) actualBillMap[card.id] = 0;
        });
        setEstimate(estimateMap);
        setActualBill(actualBillMap);
      } catch (error) {
        console.error("加载月度信用卡账单失败:", error);
        setEstimate({});
        setActualBill({});
      }
    }
    loadMonthlyBillData();
  }, [selectedBillMonth, selectedBillMonthDate, currentMonthPrefix, cards]);

  // ===================================================
  // 加载月度资金安排
  // ===================================================
  useEffect(() => {
    async function loadFunding() {
      if (!selectedBillMonth) return;
      try {
        const { data, error } = await supabase
          .from("credit_card_monthly_funding")
          .select("bill_month, lp_actual_amount, my_actual_amount, lp_estimate_amount, my_estimate_amount")
          .eq("bill_month", selectedBillMonthDate)
          .maybeSingle();
        if (error) throw error;
        setLpEstimate(toNumber(data?.lp_estimate_amount));
        setMyEstimate(toNumber(data?.my_estimate_amount));
        setLpActual(toNumber(data?.lp_actual_amount));
        setMyActual(toNumber(data?.my_actual_amount));
        setFundingSaved(false);
      } catch (error) {
        console.error("加载月度信用卡资金安排失败:", error);
        setLpEstimate(0); setMyEstimate(0); setLpActual(0); setMyActual(0); setFundingSaved(false);
      }
    }
    loadFunding();
  }, [selectedBillMonth, selectedBillMonthDate]);


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
  // 新增信用卡：打开
  // ===================================================

  function openAddCard() {

    setNewCard({
      bank_name: "",
      card_name: "",
      billing_day: "",
      payment_day: "",
      installment: "",
    });

    setShowAddCard(true);
  }


  // ===================================================
  // 新增信用卡：关闭
  // ===================================================

  function closeAddCard() {

    if (addingCard) {
      return;
    }

    setShowAddCard(false);
  }


  // ===================================================
  // 新增信用卡
  // ===================================================

  async function handleAddCard() {

    const bankName =
      newCard.bank_name.trim();

    const cardName =
      newCard.card_name.trim();

    const billingDay =
      Number(
        newCard.billing_day
      );

    const paymentDay =
      newCard.payment_day === ""
        ? null
        : Number(
            newCard.payment_day
          );

    const installment =
      newCard.installment === ""
        ? 0
        : Number(
            newCard.installment
          );

    if (!bankName) {

      alert(
        "请输入银行名称"
      );

      return;
    }

    if (!cardName) {

      alert(
        "请输入信用卡名称"
      );

      return;
    }

    if (
      !Number.isInteger(
        billingDay
      ) ||
      billingDay < 1 ||
      billingDay > 31
    ) {

      alert(
        "账单日必须是 1～31"
      );

      return;
    }

    if (
      paymentDay !== null &&
      (
        !Number.isInteger(
          paymentDay
        ) ||
        paymentDay < 1 ||
        paymentDay > 31
      )
    ) {

      alert(
        "还款日必须是 1～31"
      );

      return;
    }

    if (
      !Number.isFinite(
        installment
      ) ||
      installment < 0
    ) {

      alert(
        "固定分期金额不能小于 0"
      );

      return;
    }

    try {

      setAddingCard(true);

      const {
        error,
      } =
        await supabase
          .from("credit_cards")
          .insert({
            bank_name:
              bankName,

            card_name:
              cardName,

            billing_day:
              billingDay,

            payment_day:
              paymentDay,

            installment:
              installment,

            monthly_estimate:
              0,

            actual_bill_amount:
              0,
          });

      if (error) {

        console.error(
          "新增信用卡失败:",
          error
        );

        alert(
          "新增信用卡失败：\n" +
          error.message
        );

        return;
      }

      setShowAddCard(false);

      setNewCard({
        bank_name: "",
        card_name: "",
        billing_day: "",
        payment_day: "",
        installment: "",
      });

      await loadCards();

    } catch (error: any) {

      console.error(
        "handleAddCard error:",
        error
      );

      alert(
        "新增信用卡失败：\n" +
        (
          error?.message ||
          "未知错误"
        )
      );

    } finally {

      setAddingCard(false);

    }
  }


  // ===================================================
  // 删除信用卡
  // ===================================================

  async function handleDeleteCard(
    card: CardItem
  ) {

    const confirmed =
      window.confirm(
        `确定要删除信用卡「${card.bank_name} ${card.card_name}」吗？\n\n删除后该信用卡将不会再显示。`
      );

    if (!confirmed) {
      return;
    }

    try {

      if (isLoanCard(card)) {
        alert("这张卡来自贷款中的“信用卡分期”。请到贷款页面管理分期记录；这里不能删除贷款。");
        return;
      }

      setDeletingId(
        card.id
      );

      const {
        error,
      } =
        await supabase
          .from("credit_cards")
          .delete()
          .eq(
            "id",
            card.id
          );

      if (error) {

        console.error(
          "删除信用卡失败:",
          error
        );

        alert(
          "删除失败：\n" +
          error.message
        );

        return;
      }

      setCards(
        prev =>
          prev.filter(
            item =>
              item.id !== card.id
          )
      );

      setEstimate(
        prev => {

          const next = {
            ...prev,
          };

          delete next[card.id];

          return next;
        }
      );

      setActualBill(
        prev => {

          const next = {
            ...prev,
          };

          delete next[card.id];

          return next;
        }
      );

    } catch (error: any) {

      console.error(
        "handleDeleteCard error:",
        error
      );

      alert(
        "删除失败：\n" +
        (
          error?.message ||
          "未知错误"
        )
      );

    } finally {

      setDeletingId(null);

    }
  }


  // ===================================================
  // 保存账单日 / 还款日
  //
  // loan:<id> 是 loans 中存在、但 credit_cards 尚未建立主卡记录的信用卡分期。
  // 第一次填写日期时自动创建 credit_cards 主记录。
  // 后续直接更新 credit_cards。
  // ===================================================

  async function saveCardSchedule(
    card: CardItem,
    field: "billing_day" | "payment_day",
    rawValue: string
  ) {

    const value =
      rawValue === ""
        ? null
        : Number(rawValue);

    if (
      value !== null &&
      (!Number.isInteger(value) || value < 1 || value > 31)
    ) {
      alert("日期必须是 1～31");
      return;
    }

    try {

      setSavingId(card.id);

      const payload: Record<string, any> = {
        [field]: value,
      };

      if (isLoanCard(card)) {

        if (
          field === "payment_day" &&
          (!card.billing_day || card.billing_day < 1)
        ) {
          alert("请先填写账单日，再填写还款日。");
          return;
        }

        const { data: existing, error: findError } =
          await supabase
            .from("credit_cards")
            .select("id")
            .eq("bank_name", card.bank_name)
            .eq("card_name", card.card_name)
            .limit(1);

        if (findError) {
          throw findError;
        }

        if (existing && existing.length > 0) {
          const { error } =
            await supabase
              .from("credit_cards")
              .update(payload)
              .eq("id", existing[0].id);

          if (error) throw error;
        } else {
          const { error } =
            await supabase
              .from("credit_cards")
              .insert({
                bank_name: card.bank_name,
                card_name: card.card_name,
                billing_day:
                  field === "billing_day"
                    ? value
                    : null,
                payment_day:
                  field === "payment_day"
                    ? value
                    : null,
                monthly_estimate: 0,
                actual_bill_amount: 0,
                installment: 0,
              });

          if (error) throw error;
        }
      } else {
        const { error } =
          await supabase
            .from("credit_cards")
            .update(payload)
            .eq("id", card.id);

        if (error) throw error;
      }

      setCards(prev =>
        prev.map(item =>
          item.id === card.id
            ? {
                ...item,
                [field]: value,
              }
            : item
        )
      );

    } catch (error: any) {

      console.error(
        `保存 ${field} 失败:`,
        error
      );

      alert(
        `保存${field === "billing_day" ? "账单日" : "还款日"}失败：\n` +
        (error?.message || "未知错误")
      );

    } finally {

      setSavingId(null);

    }
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
  async function saveMonthlyEstimate(cardId: string) {
    const value = Number(estimate[cardId] || 0);
    try {
      const targetCard = cards.find(card => card.id === cardId);
      if (!targetCard || isLoanCard(targetCard)) return;
      setSavingId(cardId);
      const { error } = await supabase.from("credit_card_monthly_bills").upsert({
        credit_card_id: cardId, bill_month: selectedBillMonthDate, monthly_estimate: value, actual_bill_amount: Number(actualBill[cardId] || 0),
      }, { onConflict: "credit_card_id,bill_month" });
      if (error) { alert("保存失败：\n" + error.message); return; }
      setCards(prev => prev.map(card => card.id === cardId ? { ...card, monthly_estimate: value } : card));
    } catch (error: any) {
      console.error("saveMonthlyEstimate error:", error);
      alert("保存失败：\n" + (error?.message || "未知错误"));
    } finally { setSavingId(null); }
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
  async function saveActualBill(cardId: string) {
    const value = Number(actualBill[cardId] || 0);
    try {
      const targetCard = cards.find(card => card.id === cardId);
      if (!targetCard || isLoanCard(targetCard)) return;
      setSavingId(cardId);
      const { error } = await supabase.from("credit_card_monthly_bills").upsert({
        credit_card_id: cardId, bill_month: selectedBillMonthDate, monthly_estimate: Number(estimate[cardId] || 0), actual_bill_amount: value,
      }, { onConflict: "credit_card_id,bill_month" });
      if (error) { alert("实际账单保存失败：\n" + error.message); return; }
      setCards(prev => prev.map(card => card.id === cardId ? { ...card, actual_bill_amount: value } : card));
    } catch (error: any) {
      console.error("saveActualBill error:", error);
      alert("实际账单保存失败：\n" + (error?.message || "未知错误"));
    } finally { setSavingId(null); }
  }


  // ===================================================
  // 数字输入
  // ===================================================

  function numberInput(
    value: string
  ): number {

    if (value === "") {
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
  async function autoSaveFunding(values: { lpEstimate?: number; myEstimate?: number; lpActual?: number; myActual?: number; }) {
    try {
      setFundingSaving(true); setFundingSaved(false);
      const { data, error } = await supabase.from("credit_card_monthly_funding").upsert({
        bill_month: selectedBillMonthDate,
        lp_estimate_amount: values.lpEstimate ?? lpEstimate,
        my_estimate_amount: values.myEstimate ?? myEstimate,
        lp_actual_amount: values.lpActual ?? lpActual,
        my_actual_amount: values.myActual ?? myActual,
      }, { onConflict: "bill_month" }).select("bill_month, lp_actual_amount, my_actual_amount, lp_estimate_amount, my_estimate_amount").single();
      if (error) { alert("资金安排自动保存失败：\n" + error.message); return; }
      setLpEstimate(toNumber(data?.lp_estimate_amount)); setMyEstimate(toNumber(data?.my_estimate_amount));
      setLpActual(toNumber(data?.lp_actual_amount)); setMyActual(toNumber(data?.my_actual_amount));
      setFundingSaved(true); window.setTimeout(() => setFundingSaved(false), 2000);
    } catch (error: any) {
      console.error("autoSaveFunding error:", error);
      alert("资金安排自动保存失败：\n" + (error?.message || "未知错误"));
    } finally { setFundingSaving(false); }
  }


  // ===================================================
  // 有鱼预估消费
  // ===================================================

  const yuEstimateMap =
    useMemo(
      () => {

        const map:
          Record<string, number> = {};

        cards.forEach(card => {

          const targetName =
            normalizeName(
              card.card_name
            );

          const targetBank =
            normalizeBankName(
              card.bank_name
            );

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

          yuTransactions.forEach(
            transaction => {

              if (
                transaction.is_credit_card !== true
              ) {
                return;
              }

              const transactionDate =
                getTransactionDate(
                  transaction
                );

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
                return;
              }

              const type =
                String(
                  transaction.income_expense_type ||
                  ""
                );

              if (
                type.includes("收入")
              ) {
                return;
              }

              if (
                transaction.is_settlement === true
              ) {
                return;
              }

              total +=
                getTransactionAmount(
                  transaction
                );
            }
          );

          map[card.id] =
            total;
        });

        return map;

      },
      [
        cards,
        yuTransactions,
        selectedBillMonth,
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

    setSortKey(key);
    setSortDirection("asc");
  }


  function sortIcon(
    key: SortKey
  ) {

    if (
      sortKey !== key
    ) {

      return (
        <span className="ml-1 text-gray-300">
          ↕
        </span>
      );
    }

    return (
      <span className="ml-1 text-blue-600">
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

            } else if (
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

            } else if (
              sortKey === "gap"
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

            } else if (
              sortKey === "total"
            ) {

              aValue =
                Number(
                  a.installment || 0
                ) +
                Number(
                  estimate[a.id] || 0
                );

              bValue =
                Number(
                  b.installment || 0
                ) +
                Number(
                  estimate[b.id] || 0
                );

            } else if (
              sortKey ===
              "actual_bill_amount"
            ) {

              aValue =
                Number(
                  actualBill[a.id] || 0
                );

              bValue =
                Number(
                  actualBill[b.id] || 0
                );

            } else if (
              sortKey ===
                "bank_name" ||
              sortKey ===
                "card_name"
            ) {

              aValue =
                String(
                  a[sortKey] || ""
                );

              bValue =
                String(
                  b[sortKey] || ""
                );

            } else {

              aValue =
                Number(
                  a[sortKey] || 0
                );

              bValue =
                Number(
                  b[sortKey] || 0
                );
            }

            if (
              typeof aValue === "string" &&
              typeof bValue === "string"
            ) {

              const comparison =
                aValue.localeCompare(
                  bValue,
                  "zh-CN"
                );

              return (
                sortDirection === "asc"
                  ? comparison
                  : -comparison
              );
            }

            if (
              aValue < bValue
            ) {

              return (
                sortDirection === "asc"
                  ? -1
                  : 1
              );
            }

            if (
              aValue > bValue
            ) {

              return (
                sortDirection === "asc"
                  ? 1
                  : -1
              );
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
  // 合计
  // ===================================================

  const installmentTotal =
    cards.reduce(
      (sum, card) =>
        sum +
        Number(
          card.installment || 0
        ),
      0
    );


  const estimateTotal =
    cards.reduce(
      (sum, card) =>
        sum +
        Number(
          estimate[
            card.id
          ] || 0
        ),
      0
    );


  const yuEstimateTotal =
    cards.reduce(
      (sum, card) =>
        sum +
        Number(
          yuEstimateMap[
            card.id
          ] || 0
        ),
      0
    );


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


  const actualBillTotal =
    cards.reduce(
      (sum, card) =>
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


  const estimateFundingEnough =
    estimateFundingTotal >=
    total;


  const actualFundingEnough =
    actualFundingTotal >=
    actualBillTotal;


  // ===================================================
  // Loading
  // ===================================================

  if (loading) {

    return (
      <>
        <TopBar
          title="Credit Card"
        />

        <main className="
          max-w-[1200px]
          mx-auto
          px-6
          py-8
        ">

          <div className="
            bg-white
            border
            border-gray-200
            rounded-xl
            p-8
            text-center
            text-gray-500
          ">
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

      <main className="
        max-w-[1400px]
        mx-auto
        px-6
        py-6
        space-y-6
      ">

        {/* =================================================
            页面标题
        ================================================= */}

        <section>

          <div className="
            flex
            items-start
            justify-between
            gap-4
          ">

            <div>

              <h1 className="
                text-2xl
                font-bold
                text-gray-900
              ">
                （{selectedBillMonthNumber}月）月账单 ·
                （{selectedPaymentMonthNumber}月）月还
              </h1>

              <p className="
                text-base
                font-semibold
                text-gray-700
                mt-1
              ">
                信用卡消费预测
              </p>

              <p className="
                text-sm
                text-gray-500
                mt-1
              ">
                手动预估消费与有鱼消费数据同时对比，
                预计支出采用手动预估消费
              </p>

            </div>


            {/* =================================================
                新增信用卡按钮
            ================================================= */}

            <button
              type="button"
              onClick={openAddCard}
              className="
                shrink-0
                inline-flex
                items-center
                gap-2
                px-4
                py-2.5
                rounded-lg
                bg-blue-600
                text-white
                text-sm
                font-medium
                hover:bg-blue-700
                transition
              "
            >
              <span className="text-lg leading-none">
                ＋
              </span>
              新增信用卡
            </button>

          </div>

        </section>

        {/* =================================================
            账单月份
        ================================================= */}
        <section className="bg-white rounded-xl border border-gray-200 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-gray-700">账单月份</div>
              <div className="text-xs text-gray-400 mt-1">手动预估、实际账单、资金安排均按月份独立保存</div>
            </div>
            <select value={selectedBillMonth} onChange={e => setSelectedBillMonth(e.target.value)} className="min-w-[150px] border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white outline-none focus:border-blue-500">
              {billMonthOptions.map(month => (
                <option key={month} value={month}>
                  {month.slice(0, 4)}年{Number(month.slice(5, 7))}月
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* =================================================
            汇总
        ================================================= */}

        <section className="
          grid
          grid-cols-1
          md:grid-cols-4
          gap-4
        ">

          <div className="
            bg-blue-50
            border
            border-blue-100
            rounded-xl
            p-5
          ">
            <div className="text-sm text-gray-500">
              {selectedBillMonthNumber}月固定分期
            </div>

            <div className="
              text-2xl
              font-bold
              text-gray-900
              mt-2
            ">
              {money(installmentTotal)}
            </div>
          </div>


          <div className={`
            bg-green-50
            border
            border-green-100
            rounded-xl
            p-5
            ${showYuEstimate ? "" : "hidden"}
          `}>
            <div className="text-sm text-gray-500">
              {selectedBillMonthNumber}月有鱼预估消费
            </div>

            <div className="
              text-2xl
              font-bold
              text-gray-900
              mt-2
            ">
              {
                yuLoading
                  ? "..."
                  : money(yuEstimateTotal)
              }
            </div>
          </div>


          <div className="
            bg-gray-100
            border
            border-gray-200
            rounded-xl
            p-5
          ">
            <div className="text-sm text-gray-500">
              手动预估消费
            </div>

            <div className="
              text-2xl
              font-bold
              text-gray-900
              mt-2
            ">
              {money(estimateTotal)}
            </div>
          </div>


          <div className="
            bg-red-50
            border
            border-red-100
            rounded-xl
            p-5
          ">
            <div className="text-sm text-gray-500">
              {selectedBillMonthNumber}月预计支出
            </div>

            <div className="
              text-2xl
              font-bold
              text-gray-900
              mt-2
            ">
              {money(total)}
            </div>
          </div>

        </section>


        {/* =================================================
            显示字段
        ================================================= */}

        <div className="flex justify-end">

          <div className="relative">

            <button
              type="button"
              onClick={() =>
                setShowFieldMenu(
                  prev => !prev
                )
              }
              className="
                inline-flex
                items-center
                gap-1
                px-3
                py-2
                text-sm
                border
                border-gray-200
                rounded-lg
                bg-white
                text-gray-700
                hover:bg-gray-50
              "
            >
              显示字段
              <span className="text-gray-400">
                ▾
              </span>
            </button>


            {showFieldMenu && (
              <div className="
                absolute
                right-0
                mt-2
                w-52
                bg-white
                border
                border-gray-200
                rounded-lg
                shadow-lg
                p-3
                z-30
              ">

                <div className="
                  text-xs
                  text-gray-400
                  mb-2
                ">
                  可选显示字段
                </div>

                <label className="
                  flex
                  items-center
                  gap-2
                  py-1.5
                  text-sm
                  text-gray-700
                  cursor-pointer
                ">

                  <input
                    type="checkbox"
                    checked={showYuEstimate}
                    onChange={e =>
                      setShowYuEstimate(
                        e.target.checked
                      )
                    }
                    className="rounded"
                  />

                  有鱼预估消费

                </label>


                <label className="
                  flex
                  items-center
                  gap-2
                  py-1.5
                  text-sm
                  text-gray-700
                  cursor-pointer
                ">

                  <input
                    type="checkbox"
                    checked={showGap}
                    onChange={e =>
                      setShowGap(
                        e.target.checked
                      )
                    }
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

        <section className="
          bg-white
          rounded-xl
          border
          border-gray-200
          overflow-hidden
        ">

          <div className="overflow-x-auto">

            <table className={`
              w-full
              ${
                showYuEstimate || showGap
                  ? "min-w-[1450px]"
                  : "min-w-[1150px]"
              }
              text-sm
            `}>

              <thead>

                <tr className="
                  border-b
                  border-gray-200
                  bg-gray-50
                ">

                  {/* 银行 */}

                  <th className="
                    text-left
                    px-4
                    py-3
                    font-medium
                    text-gray-500
                  ">

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
                      {sortIcon("bank_name")}
                    </button>

                  </th>


                  {/* 信用卡 */}

                  <th className="
                    text-left
                    px-4
                    py-3
                    font-medium
                    text-gray-500
                  ">

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
                      {sortIcon("card_name")}
                    </button>

                  </th>


                  {/* 账单日 */}

                  <th className="
                    text-right
                    px-4
                    py-3
                    font-medium
                    text-gray-500
                  ">

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
                      {selectedBillMonthNumber}月账单日
                      {sortIcon("billing_day")}
                    </button>

                  </th>


                  {/* 还款日 */}

                  <th className="
                    text-right
                    px-4
                    py-3
                    font-medium
                    text-gray-500
                  ">

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
                      {selectedPaymentMonthNumber}月还款日
                      {sortIcon("payment_day")}
                    </button>

                  </th>


                  {/* 分期 */}

                  <th className="
                    text-right
                    px-4
                    py-3
                    font-medium
                    text-gray-500
                  ">

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
                      {selectedBillMonthNumber}月分期
                      {sortIcon("installment")}
                    </button>

                  </th>


                  {/* 手动预估 */}

                  <th className="
                    text-right
                    px-4
                    py-3
                    font-medium
                    text-gray-500
                  ">

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
                      {sortIcon("monthly_estimate")}
                    </button>

                  </th>


                  {/* 有鱼 */}

                  {showYuEstimate && (
                    <th className="
                      text-right
                      px-4
                      py-3
                      font-medium
                      text-gray-500
                      bg-gray-100
                    ">

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
                        {sortIcon("yu_estimate")}
                      </button>

                    </th>
                  )}


                  {/* GAP */}

                  {showGap && (
                    <th className="
                      text-right
                      px-4
                      py-3
                      font-medium
                      text-gray-500
                      bg-gray-100
                    ">

                      <button
                        type="button"
                        className="
                          inline-flex
                          items-center
                          hover:text-blue-600
                        "
                        onClick={() =>
                          handleSort("gap")
                        }
                      >
                        GAP
                        {sortIcon("gap")}
                      </button>

                    </th>
                  )}


                  {/* 预计支出 */}

                  <th className="
                    text-right
                    px-4
                    py-3
                    font-medium
                    text-gray-500
                  ">

                    <button
                      type="button"
                      className="
                        inline-flex
                        items-center
                        hover:text-blue-600
                      "
                      onClick={() =>
                        handleSort("total")
                      }
                    >
                      预计支出
                      {sortIcon("total")}
                    </button>

                  </th>


                  {/* 实际账单 */}

                  <th className="
                    text-right
                    px-4
                    py-3
                    font-medium
                    text-gray-500
                  ">

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


                  {/* 操作 */}

                  <th className="
                    text-center
                    px-4
                    py-3
                    font-medium
                    text-gray-500
                  ">
                    操作
                  </th>

                </tr>

              </thead>


              <tbody>

                {sortedCards.length === 0 ? (

                  <tr>

                    <td
                      colSpan={
                        10 +
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

                ) : (

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
                          key={card.id}
                          className="
                            border-b
                            border-gray-100
                            last:border-b-0
                            hover:bg-gray-50
                          "
                        >

                          {/* 银行 */}

                          <td className="
                            px-4
                            py-3.5
                            font-medium
                            text-gray-900
                          ">
                            {card.bank_name}
                            {isLoanCard(card) && (
                              <span className="ml-2 text-xs text-orange-500">分期来源</span>
                            )}
                          </td>


                          {/* 信用卡 */}

                          <td className="
                            px-4
                            py-3.5
                            text-gray-600
                          ">
                            {card.card_name || "-"}
                          </td>


                          {/* 账单日 */}

                          <td className="
                            px-4
                            py-3.5
                            text-right
                            text-gray-700
                          ">
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                min="1"
                                max="31"
                                value={
                                  card.billing_day > 0
                                    ? card.billing_day
                                    : ""
                                }
                                onChange={e =>
                                  setCards(prev =>
                                    prev.map(item =>
                                      item.id === card.id
                                        ? {
                                            ...item,
                                            billing_day:
                                              e.target.value === ""
                                                ? 0
                                                : Number(e.target.value),
                                          }
                                        : item
                                    )
                                  )
                                }
                                onBlur={e =>
                                  saveCardSchedule(
                                    card,
                                    "billing_day",
                                    e.target.value
                                  )
                                }
                                onKeyDown={e => {
                                  if (e.key === "Enter") {
                                    e.currentTarget.blur();
                                  }
                                }}
                                placeholder="设置"
                                className="w-20 border border-gray-200 rounded-md px-2 py-1.5 text-right text-sm outline-none focus:border-blue-500"
                              />
                              <span className="text-gray-400 text-sm">日</span>
                            </div>
                          </td>


                          {/* 还款日 */}

                          <td className="
                            px-4
                            py-3.5
                            text-right
                            text-gray-700
                          ">
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                min="1"
                                max="31"
                                value={
                                  card.payment_day ?? ""
                                }
                                onChange={e =>
                                  setCards(prev =>
                                    prev.map(item =>
                                      item.id === card.id
                                        ? {
                                            ...item,
                                            payment_day:
                                              e.target.value === ""
                                                ? null
                                                : Number(e.target.value),
                                          }
                                        : item
                                    )
                                  )
                                }
                                onBlur={e =>
                                  saveCardSchedule(
                                    card,
                                    "payment_day",
                                    e.target.value
                                  )
                                }
                                onKeyDown={e => {
                                  if (e.key === "Enter") {
                                    e.currentTarget.blur();
                                  }
                                }}
                                placeholder="设置"
                                className="w-20 border border-gray-200 rounded-md px-2 py-1.5 text-right text-sm outline-none focus:border-blue-500"
                              />
                              <span className="text-gray-400 text-sm">日</span>
                            </div>
                          </td>


                          {/* 分期 */}

                          <td className="
                            px-4
                            py-3.5
                            text-right
                            text-gray-700
                          ">
                            {money(card.installment)}
                          </td>


                          {/* 手动预估 */}

                          <td className="
                            px-4
                            py-3.5
                            text-right
                          ">

                            <div className="
                              flex
                              items-center
                              justify-end
                              gap-2
                            ">

                              <span className="
                                text-gray-400
                              ">
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
                                disabled={isLoanCard(card)}
                                onChange={e =>
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
                                onKeyDown={e => {
                                  if (
                                    e.key ===
                                    "Enter"
                                  ) {
                                    e.currentTarget.blur();
                                  }
                                }}
                              />

                              {savingId ===
                                card.id && (
                                <span className="
                                  text-xs
                                  text-gray-400
                                ">
                                  保存中
                                </span>
                              )}

                            </div>

                          </td>


                          {/* 有鱼 */}

                          {showYuEstimate && (
                            <td className="
                              px-4
                              py-3.5
                              text-right
                              bg-gray-100
                              font-medium
                              text-gray-700
                            ">
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
                            <td className={`
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
                            `}>
                              {money(gap)}
                            </td>
                          )}


                          {/* 预计支出 */}

                          <td className="
                            px-4
                            py-3.5
                            text-right
                            font-semibold
                            text-gray-900
                          ">
                            {money(cardTotal)}
                          </td>


                          {/* 实际账单 */}

                          <td className="
                            px-4
                            py-3.5
                            text-right
                          ">

                            <div className="
                              flex
                              items-center
                              justify-end
                              gap-2
                            ">

                              <span className="
                                text-gray-400
                              ">
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
                                disabled={isLoanCard(card)}
                                onChange={e =>
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
                                onKeyDown={e => {
                                  if (
                                    e.key ===
                                    "Enter"
                                  ) {
                                    e.currentTarget.blur();
                                  }
                                }}
                              />

                            </div>

                          </td>


                          {/* 删除 */}

                          <td className="
                            px-4
                            py-3.5
                            text-center
                          ">

                            <button
                              type="button"
                              disabled={
                                deletingId ===
                                card.id
                              }
                              onClick={() =>
                                handleDeleteCard(
                                  card
                                )
                              }
                              className="
                                text-sm
                                text-red-500
                                hover:text-red-700
                                disabled:text-gray-300
                                disabled:cursor-not-allowed
                              "
                            >
                              {
                                isLoanCard(card)
                                  ? "贷款管理"
                                  : deletingId === card.id
                                    ? "删除中..."
                                    : "删除"
                              }
                            </button>

                          </td>

                        </tr>
                      );
                    }
                  )
                )}

              </tbody>

            </table>

          </div>


          {/* =================================================
              合计
          ================================================= */}

          <div className="
            border-t
            border-gray-200
            bg-gray-50
            px-4
            py-4
          ">

            <div className="
              flex
              flex-wrap
              items-center
              justify-end
              gap-6
              text-sm
            ">

              <div>
                <span className="text-gray-500">
                  手动预估：
                </span>

                <span className="
                  ml-2
                  font-semibold
                  text-gray-900
                ">
                  {money(estimateTotal)}
                </span>
              </div>


              {showYuEstimate && (
                <div className="
                  bg-gray-100
                  px-3
                  py-1.5
                  rounded-md
                ">
                  <span className="text-gray-500">
                    有鱼预估：
                  </span>

                  <span className="
                    ml-2
                    font-semibold
                    text-gray-900
                  ">
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
                <div className="
                  bg-gray-100
                  px-3
                  py-1.5
                  rounded-md
                ">
                  <span className="text-gray-500">
                    GAP：
                  </span>

                  <span className={`
                    ml-2
                    font-semibold
                    ${
                      gapTotal > 0
                        ? "text-red-600"
                        : gapTotal < 0
                          ? "text-green-600"
                          : "text-gray-900"
                    }
                  `}>
                    {money(gapTotal)}
                  </span>
                </div>
              )}


              <div>
                <span className="text-gray-500">
                  {selectedBillMonthNumber}月预计支出：
                </span>

                <span className="
                  ml-2
                  font-semibold
                  text-gray-900
                ">
                  {money(total)}
                </span>
              </div>


              <div>
                <span className="text-gray-500">
                  {selectedBillMonthNumber}月实际账单：
                </span>

                <span className="
                  ml-2
                  font-semibold
                  text-gray-900
                ">
                  {money(actualBillTotal)}
                </span>
              </div>

            </div>

          </div>

        </section>


        {/* =================================================
            信用卡资金安排
        ================================================= */}

        <section className="
          bg-white
          rounded-xl
          border
          border-gray-200
          p-6
        ">

          <div className="
            flex
            items-center
            justify-between
            mb-5
          ">

            <div>

              <h2 className="
                text-xl
                font-bold
                text-gray-900
              ">
                💰 信用卡资金安排
              </h2>

              <p className="
                text-sm
                text-gray-500
                mt-1
              ">
                按全部信用卡合计安排资金，不按单张信用卡拆分
              </p>

            </div>


            <div className="
              text-sm
              min-w-[70px]
              text-right
            ">

              {fundingSaving && (
                <span className="text-gray-400">
                  保存中...
                </span>
              )}

              {!fundingSaving &&
                fundingSaved && (
                <span className="text-green-600">
                  ✓ 已保存
                </span>
              )}

            </div>

          </div>


          <div className="
            grid
            grid-cols-1
            lg:grid-cols-2
            gap-6
          ">

            {/* =================================================
                预估账单资金安排
            ================================================= */}

            <div className="
              border
              border-green-200
              rounded-xl
              p-5
              bg-green-50/50
            ">

              <div className="
                flex
                items-center
                justify-between
                mb-5
              ">

                <div>

                  <h3 className="
                    text-lg
                    font-semibold
                    text-gray-900
                  ">
                    {selectedBillMonthNumber}月预估账单资金安排
                  </h3>

                  <p className="
                    text-xs
                    text-gray-500
                    mt-1
                  ">
                    以手动预估消费 + 固定分期提前安排
                  </p>

                </div>


                <div className="text-right">

                  <div className="
                    text-xs
                    text-gray-500
                  ">
                    预估账单
                  </div>

                  <div className="
                    font-bold
                    text-lg
                    text-gray-900
                  ">
                    {money(total)}
                  </div>

                </div>

              </div>


              <div className="
                grid
                grid-cols-1
                md:grid-cols-2
                gap-4
              ">

                <div>

                  <label className="
                    block
                    text-sm
                    font-medium
                    text-gray-700
                    mb-2
                  ">
                    LP给我
                  </label>

                  <div className="relative">

                    <span className="
                      absolute
                      left-3
                      top-1/2
                      -translate-y-1/2
                      text-gray-400
                    ">
                      ¥
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={
                        lpEstimate || ""
                      }
                      onChange={e => {

                        setLpEstimate(
                          numberInput(
                            e.target.value
                          )
                        );

                        setFundingSaved(false);

                      }}
                      onBlur={() =>
                        autoSaveFunding({
                          lpEstimate,
                        })
                      }
                      onKeyDown={e => {
                        if (
                          e.key ===
                          "Enter"
                        ) {
                          e.currentTarget.blur();
                        }
                      }}
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


                <div>

                  <label className="
                    block
                    text-sm
                    font-medium
                    text-gray-700
                    mb-2
                  ">
                    我自己现在有
                  </label>

                  <div className="relative">

                    <span className="
                      absolute
                      left-3
                      top-1/2
                      -translate-y-1/2
                      text-gray-400
                    ">
                      ¥
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={
                        myEstimate || ""
                      }
                      onChange={e => {

                        setMyEstimate(
                          numberInput(
                            e.target.value
                          )
                        );

                        setFundingSaved(false);

                      }}
                      onBlur={() =>
                        autoSaveFunding({
                          myEstimate,
                        })
                      }
                      onKeyDown={e => {
                        if (
                          e.key ===
                          "Enter"
                        ) {
                          e.currentTarget.blur();
                        }
                      }}
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


              <div className="
                mt-5
                pt-4
                border-t
                border-green-200
              ">

                <div className="
                  flex
                  items-center
                  justify-between
                ">
                  <span className="
                    text-sm
                    text-gray-600
                  ">
                    目前安排资金
                  </span>

                  <span className="
                    font-semibold
                    text-gray-900
                  ">
                    {money(
                      estimateFundingTotal
                    )}
                  </span>
                </div>


                <div className="
                  flex
                  items-center
                  justify-between
                  mt-3
                ">
                  <span className="
                    text-sm
                    text-gray-600
                  ">
                    还需要自己拿
                  </span>

                  <span className={`
                    text-xl
                    font-bold
                    ${
                      estimateFundingEnough
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  `}>
                    {money(
                      estimateNeedMyself
                    )}
                  </span>
                </div>


                <div className="
                  mt-3
                  text-right
                  text-xs
                ">
                  {
                    estimateFundingEnough
                      ? (
                        <span className="
                          text-green-600
                          font-medium
                        ">
                          ✓ 预估资金已经足够
                        </span>
                      )
                      : (
                        <span className="
                          text-red-600
                          font-medium
                        ">
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

            <div className="
              border
              border-blue-200
              rounded-xl
              p-5
              bg-blue-50/50
            ">

              <div className="
                flex
                items-center
                justify-between
                mb-5
              ">

                <div>

                  <h3 className="
                    text-lg
                    font-semibold
                    text-gray-900
                  ">
                    {selectedBillMonthNumber}月实际账单资金安排
                  </h3>

                  <p className="
                    text-xs
                    text-gray-500
                    mt-1
                  ">
                    账单出来后，根据实际金额重新核算
                  </p>

                </div>


                <div className="text-right">

                  <div className="
                    text-xs
                    text-gray-500
                  ">
                    实际账单
                  </div>

                  <div className="
                    font-bold
                    text-lg
                    text-gray-900
                  ">
                    {money(actualBillTotal)}
                  </div>

                </div>

              </div>


              <div className="
                grid
                grid-cols-1
                md:grid-cols-2
                gap-4
              ">

                <div>

                  <label className="
                    block
                    text-sm
                    font-medium
                    text-gray-700
                    mb-2
                  ">
                    LP给我
                  </label>

                  <div className="relative">

                    <span className="
                      absolute
                      left-3
                      top-1/2
                      -translate-y-1/2
                      text-gray-400
                    ">
                      ¥
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={
                        lpActual || ""
                      }
                      onChange={e => {

                        setLpActual(
                          numberInput(
                            e.target.value
                          )
                        );

                        setFundingSaved(false);

                      }}
                      onBlur={() =>
                        autoSaveFunding({
                          lpActual,
                        })
                      }
                      onKeyDown={e => {
                        if (
                          e.key ===
                          "Enter"
                        ) {
                          e.currentTarget.blur();
                        }
                      }}
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


                <div>

                  <label className="
                    block
                    text-sm
                    font-medium
                    text-gray-700
                    mb-2
                  ">
                    我自己现在有
                  </label>

                  <div className="relative">

                    <span className="
                      absolute
                      left-3
                      top-1/2
                      -translate-y-1/2
                      text-gray-400
                    ">
                      ¥
                    </span>

                    <input
                      type="number"
                      min="0"
                      step="100"
                      value={
                        myActual || ""
                      }
                      onChange={e => {

                        setMyActual(
                          numberInput(
                            e.target.value
                          )
                        );

                        setFundingSaved(false);

                      }}
                      onBlur={() =>
                        autoSaveFunding({
                          myActual,
                        })
                      }
                      onKeyDown={e => {
                        if (
                          e.key ===
                          "Enter"
                        ) {
                          e.currentTarget.blur();
                        }
                      }}
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


              <div className="
                mt-5
                pt-4
                border-t
                border-blue-200
              ">

                <div className="
                  flex
                  items-center
                  justify-between
                ">
                  <span className="
                    text-sm
                    text-gray-600
                  ">
                    目前安排资金
                  </span>

                  <span className="
                    font-semibold
                    text-gray-900
                  ">
                    {money(
                      actualFundingTotal
                    )}
                  </span>
                </div>


                <div className="
                  flex
                  items-center
                  justify-between
                  mt-3
                ">
                  <span className="
                    text-sm
                    text-gray-600
                  ">
                    还需要自己拿
                  </span>

                  <span className={`
                    text-xl
                    font-bold
                    ${
                      actualFundingEnough
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  `}>
                    {money(
                      actualNeedMyself
                    )}
                  </span>
                </div>


                <div className="
                  mt-3
                  text-right
                  text-xs
                ">
                  {
                    actualFundingEnough
                      ? (
                        <span className="
                          text-green-600
                          font-medium
                        ">
                          ✓ 实际资金已经足够
                        </span>
                      )
                      : (
                        <span className="
                          text-red-600
                          font-medium
                        ">
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

          <div className="
            mt-6
            border-t
            border-gray-200
            pt-5
          ">

            <div className="
              text-sm
              font-medium
              text-gray-700
              mb-3
            ">
              资金安排对比
            </div>


            <div className={`
              grid
              grid-cols-1
              ${
                showYuEstimate
                  ? "md:grid-cols-4"
                  : "md:grid-cols-3"
              }
              gap-4
            `}>

              <div className="
                rounded-lg
                bg-green-50
                p-4
              ">
                <div className="
                  text-xs
                  text-gray-500
                ">
                  {selectedBillMonthNumber}月预计账单
                </div>

                <div className="
                  text-lg
                  font-bold
                  mt-1
                ">
                  {money(total)}
                </div>
              </div>


              {showYuEstimate && (
                <div className="
                  rounded-lg
                  bg-gray-100
                  p-4
                ">
                  <div className="
                    text-xs
                    text-gray-500
                  ">
                    {selectedBillMonthNumber}月有鱼预估消费
                  </div>

                  <div className="
                    text-lg
                    font-bold
                    mt-1
                  ">
                    {
                      yuLoading
                        ? "..."
                        : money(
                            yuEstimateTotal
                          )
                    }
                  </div>
                </div>
              )}


              <div className="
                rounded-lg
                bg-blue-50
                p-4
              ">
                <div className="
                  text-xs
                  text-gray-500
                ">
                  {selectedBillMonthNumber}月实际账单
                </div>

                <div className="
                  text-lg
                  font-bold
                  mt-1
                ">
                  {money(
                    actualBillTotal
                  )}
                </div>
              </div>


              <div className="
                rounded-lg
                bg-gray-50
                p-4
              ">
                <div className="
                  text-xs
                  text-gray-500
                ">
                  实际 - 预计
                </div>

                <div className={`
                  text-lg
                  font-bold
                  mt-1
                  ${
                    actualBillTotal > total
                      ? "text-red-600"
                      : "text-green-600"
                  }
                `}>
                  {money(
                    actualBillTotal -
                    total
                  )}
                </div>
              </div>

            </div>

          </div>

        </section>


        {/* =================================================
            底部说明
        ================================================= */}

        <div className="
          text-xs
          text-gray-400
          px-1
        ">

          信用卡资金安排为全部信用卡合计；
          手动预估消费来自 credit_card_monthly_bills，
          有鱼预估消费来自 expense_transactions。
          当前月份有鱼数据仅统计
          is_credit_card = true 的消费交易，
          并根据 transaction_time 判断月份、
          account_name 匹配信用卡。
          GAP = 手动预估消费 − 有鱼预估消费。
          预计账单 = 固定分期 + 手动预估消费。
          实际账单用于账单生成后重新核算。
          资金安排金额修改后会自动保存。

        </div>

      </main>


      {/* =====================================================
          新增信用卡弹窗
      ===================================================== */}

      {showAddCard && (
        <div className="
          fixed
          inset-0
          z-50
          flex
          items-center
          justify-center
          bg-black/40
          px-4
        ">

          <div className="
            w-full
            max-w-lg
            bg-white
            rounded-2xl
            shadow-2xl
            overflow-hidden
          ">

            {/* 标题 */}

            <div className="
              px-6
              py-5
              border-b
              border-gray-200
              flex
              items-center
              justify-between
            ">

              <div>

                <h2 className="
                  text-xl
                  font-bold
                  text-gray-900
                ">
                  新增信用卡
                </h2>

                <p className="
                  text-sm
                  text-gray-500
                  mt-1
                ">
                  添加后会立即出现在信用卡列表
                </p>

              </div>


              <button
                type="button"
                disabled={addingCard}
                onClick={closeAddCard}
                className="
                  w-8
                  h-8
                  rounded-lg
                  text-gray-400
                  hover:bg-gray-100
                  hover:text-gray-700
                  disabled:opacity-40
                "
              >
                ✕
              </button>

            </div>


            {/* 表单 */}

            <div className="
              px-6
              py-6
              space-y-5
            ">

              {/* 银行 */}

              <div>

                <label className="
                  block
                  text-sm
                  font-medium
                  text-gray-700
                  mb-2
                ">
                  银行
                  <span className="text-red-500 ml-1">
                    *
                  </span>
                </label>

                <input
                  type="text"
                  value={
                    newCard.bank_name
                  }
                  onChange={e =>
                    setNewCard(
                      prev => ({
                        ...prev,
                        bank_name:
                          e.target.value,
                      })
                    )
                  }
                  placeholder="例如：招商银行"
                  className="
                    w-full
                    border
                    border-gray-200
                    rounded-lg
                    px-3
                    py-2.5
                    outline-none
                    focus:border-blue-500
                    focus:ring-1
                    focus:ring-blue-100
                  "
                />

              </div>


              {/* 信用卡 */}

              <div>

                <label className="
                  block
                  text-sm
                  font-medium
                  text-gray-700
                  mb-2
                ">
                  信用卡名称
                  <span className="text-red-500 ml-1">
                    *
                  </span>
                </label>

                <input
                  type="text"
                  value={
                    newCard.card_name
                  }
                  onChange={e =>
                    setNewCard(
                      prev => ({
                        ...prev,
                        card_name:
                          e.target.value,
                      })
                    )
                  }
                  placeholder="例如：经典白"
                  className="
                    w-full
                    border
                    border-gray-200
                    rounded-lg
                    px-3
                    py-2.5
                    outline-none
                    focus:border-blue-500
                    focus:ring-1
                    focus:ring-blue-100
                  "
                />

              </div>


              {/* 日期 */}

              <div className="
                grid
                grid-cols-2
                gap-4
              ">

                <div>

                  <label className="
                    block
                    text-sm
                    font-medium
                    text-gray-700
                    mb-2
                  ">
                    账单日
                    <span className="text-red-500 ml-1">
                      *
                    </span>
                  </label>

                  <div className="relative">

                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={
                        newCard.billing_day
                      }
                      onChange={e =>
                        setNewCard(
                          prev => ({
                            ...prev,
                            billing_day:
                              e.target.value,
                          })
                        )
                      }
                      placeholder="例如：15"
                      className="
                        w-full
                        border
                        border-gray-200
                        rounded-lg
                        px-3
                        py-2.5
                        pr-10
                        outline-none
                        focus:border-blue-500
                      "
                    />

                    <span className="
                      absolute
                      right-3
                      top-1/2
                      -translate-y-1/2
                      text-sm
                      text-gray-400
                    ">
                      日
                    </span>

                  </div>

                </div>


                <div>

                  <label className="
                    block
                    text-sm
                    font-medium
                    text-gray-700
                    mb-2
                  ">
                    还款日
                  </label>

                  <div className="relative">

                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={
                        newCard.payment_day
                      }
                      onChange={e =>
                        setNewCard(
                          prev => ({
                            ...prev,
                            payment_day:
                              e.target.value,
                          })
                        )
                      }
                      placeholder="例如：3"
                      className="
                        w-full
                        border
                        border-gray-200
                        rounded-lg
                        px-3
                        py-2.5
                        pr-10
                        outline-none
                        focus:border-blue-500
                      "
                    />

                    <span className="
                      absolute
                      right-3
                      top-1/2
                      -translate-y-1/2
                      text-sm
                      text-gray-400
                    ">
                      日
                    </span>

                  </div>

                </div>

              </div>


              {/* 固定分期 */}

              <div>

                <label className="
                  block
                  text-sm
                  font-medium
                  text-gray-700
                  mb-2
                ">
                  每月固定分期
                </label>

                <div className="relative">

                  <span className="
                    absolute
                    left-3
                    top-1/2
                    -translate-y-1/2
                    text-gray-400
                  ">
                    ¥
                  </span>

                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={
                      newCard.installment
                    }
                    onChange={e =>
                      setNewCard(
                        prev => ({
                          ...prev,
                          installment:
                            e.target.value,
                        })
                      )
                    }
                    placeholder="没有固定分期可填 0"
                    className="
                      w-full
                      border
                      border-gray-200
                      rounded-lg
                      pl-8
                      pr-3
                      py-2.5
                      outline-none
                      focus:border-blue-500
                    "
                  />

                </div>

                <p className="
                  text-xs
                  text-gray-400
                  mt-1.5
                ">
                  固定分期会自动计入每月预计支出。
                </p>

              </div>

            </div>


            {/* 底部 */}

            <div className="
              px-6
              py-4
              border-t
              border-gray-200
              bg-gray-50
              flex
              items-center
              justify-end
              gap-3
            ">

              <button
                type="button"
                disabled={addingCard}
                onClick={closeAddCard}
                className="
                  px-4
                  py-2.5
                  rounded-lg
                  border
                  border-gray-200
                  bg-white
                  text-gray-700
                  text-sm
                  hover:bg-gray-50
                  disabled:opacity-50
                "
              >
                取消
              </button>


              <button
                type="button"
                disabled={addingCard}
                onClick={handleAddCard}
                className="
                  px-5
                  py-2.5
                  rounded-lg
                  bg-blue-600
                  text-white
                  text-sm
                  font-medium
                  hover:bg-blue-700
                  disabled:bg-blue-300
                "
              >
                {
                  addingCard
                    ? "保存中..."
                    : "保存信用卡"
                }
              </button>

            </div>

          </div>

        </div>
      )}

    </>
  );
}