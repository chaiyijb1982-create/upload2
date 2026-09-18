"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import TopBar from "@/components/TopBar";

import {
  getExpenseOverview,
  getExpenseTransactions,
  type ExpenseTransaction,
} from "@/lib/expense-transactions";

import ExpenseAIAnalysis from "@/components/ExpenseAIAnalysis";

// =====================================================
// 类型
// =====================================================

type UnresolvedAccount = {
  source_name: string;
  account_type: string | null;
  mapping_id: string | null;
  standard_name: string | null;
  confirmed: boolean;
};

type CategoryStat = {
  category: string;
  amount: number;
};

type BookStat = {
  bookName: string;
  amount: number;
  categories: CategoryStat[];
};

type BudgetRow = {
  id?: string;
  year: number;
  category: string;
  budget_amount: number;
};

// =====================================================
// 年度账簿分组
// =====================================================

type AnnualBookGroup = {
  amount: number;

  // 整个分组的分类统计
  categories: Map<string, number>;

  // 其他 → 下面实际有哪些账簿
  books: Map<string, number>;

  // 其他 → 每一个账簿下面的分类
  bookCategories: Map<
    string,
    Map<string, number>
  >;
};

// =====================================================
// 工具
// =====================================================

function formatMoney(value: number): string {
  return `¥${Math.round(
    Number(value || 0)
  ).toLocaleString("zh-CN")}`;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return (
    `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")} ` +
    `${String(date.getHours()).padStart(2, "0")}:` +
    `${String(date.getMinutes()).padStart(2, "0")}`
  );
}

function getTransactionDate(
  item: ExpenseTransaction
): Date | null {
  if (!item.transaction_time) {
    return null;
  }

  const raw = String(
    item.transaction_time
  ).trim();

  if (!raw) {
    return null;
  }

  // Supabase 通常返回 ISO 时间。
  // 对历史数据中可能出现的
  // "YYYY-MM-DD HH:mm:ss" 也做兼容。
  const normalized =
    raw.includes("T")
      ? raw
      : raw.replace(" ", "T");

  const date = new Date(
    normalized
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

// =====================================================
// 取得稳定的年月
//
// 详细数字表和 AI 都使用这个函数，避免不同地方
// 因 Date 解析方式不同而出现月份错位或全部丢失。
// =====================================================

function getTransactionYearMonth(
  item: ExpenseTransaction
): {
  year: number;
  month: number;
} | null {
  const raw = String(
    item.transaction_time || ""
  ).trim();

  if (raw) {
    // 优先直接读取数据库时间字符串前面的年月日。
    // 兼容：2026-08-31、2026-08-31 12:30:00、
    // 2026-08-31T12:30:00+08:00 等。
    const match = raw.match(
      /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/
    );

    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]);

      if (
        Number.isInteger(year) &&
        Number.isInteger(month) &&
        month >= 1 &&
        month <= 12
      ) {
        return {
          year,
          month,
        };
      }
    }
  }

  const date = getTransactionDate(item);

  if (!date) {
    return null;
  }

  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}

// =====================================================
// ★ 统一消费统计规则
//
// 所有页面统计 + AI 都必须从这一套规则生成。
//
// 排除：
// 平账
// 法24.6
// 法国出差
// 借出款
// 年金
// 理财
// 替别人先付
//
// 分类：
// 1. 账簿 = xx
//      → xx
//
// 2. 日常账本 + 修行
//      → xx
//
// 3. 日常账本 + 其他分类
//      → 其他 / 日常账本
//
// 4. 其他账簿
//      → 其他 / 具体账簿
//
// xx 永远不会出现在「其他」下面。
// =====================================================

const EXCLUDED_BOOK_NAMES = new Set([
  "平账",
  "法24.6",
  "法国出差",
  "借出款",
  "年金",
  "理财",
  "替别人先付",
]);

function getNormalizedBookName(
  item: ExpenseTransaction
): string {
  return (
    item.book_name ||
    "未设置账本"
  ).trim() || "未设置账本";
}

function getNormalizedCategory(
  item: ExpenseTransaction
): string {
  return (
    item.category ||
    "未分类"
  ).trim() || "未分类";
}

function isConsumptionTransaction(
  item: ExpenseTransaction
): boolean {
  // 平账
  if (item.is_settlement) {
    return false;
  }

  // 必须是支出。
  // 正常导入的数据都会有「收入支出」字段。
  // 对历史记录中该字段为空的情况，不因为字段缺失
  // 把已经明确标记为 self 的消费流水全部过滤掉。
  const incomeExpenseType =
    (item.income_expense_type || "").trim();

  if (
    incomeExpenseType &&
    !incomeExpenseType.includes("支出")
  ) {
    return false;
  }

  // 替别人先付 / 代付
  if (
    item.consumption_type ===
    "paid_for_others"
  ) {
    return false;
  }

  // 只统计自己消费
  if (
    item.consumption_type &&
    item.consumption_type !== "self"
  ) {
    return false;
  }

  // 指定账簿完全排除
  const bookName =
    getNormalizedBookName(item);

  if (
    EXCLUDED_BOOK_NAMES.has(bookName)
  ) {
    return false;
  }

  return true;
}

type ExpenseGroup =
  | "xx"
  | "other";

function classifyExpense(
  item: ExpenseTransaction
): {
  group: ExpenseGroup;
  bookName: string;
} {
  const bookName =
    getNormalizedBookName(item);

  const category =
    getNormalizedCategory(item);

  // ① 账簿名称 = xx
  if (bookName === "xx") {
    return {
      group: "xx",
      bookName: "xx",
    };
  }

  // ② 日常账本 + 修行
  if (
    bookName === "日常账本" &&
    category === "修行"
  ) {
    return {
      group: "xx",
      bookName: "xx",
    };
  }

  // ③ 其余全部进入「其他」
  return {
    group: "other",
    bookName,
  };
}

// =====================================================
// 旅游账本标准化
//
// 仅用于「其他」内部显示。
// 不改变消费金额，只改变显示名称。
// =====================================================

function normalizeOtherBookName(
  bookName: string | null | undefined
): string {
  const value =
    (
      bookName ||
      "未设置账本"
    ).trim();

  if (!value) {
    return "未设置账本";
  }

  const tourismKeywords = [
    "旅游",
    "旅行",
    "自由行",
    "出境游",
    "境外游",
    "国内游",
    "亲子游",
    "周边游",
    "自驾游",
    "跟团游",
    "度假游",
    "海岛游",
  ];

  if (
    tourismKeywords.some(
      keyword =>
        value.includes(keyword)
    )
  ) {
    return "旅游";
  }

  if (
    value.endsWith("游")
  ) {
    return "旅游";
  }

  return value;
}

// =====================================================
// ★ 统一消费记录
//
// 这是页面和 AI 的共同数据源。
// =====================================================

type UnifiedExpenseRecord = {
  year: number;
  month: number;

  group:
    | "xx"
    | "其他";

  bookName: string;
  category: string;
  amount: number;
};

function buildUnifiedExpenseRecords(
  items: ExpenseTransaction[]
): UnifiedExpenseRecord[] {
  const result:
    UnifiedExpenseRecord[] = [];

  items.forEach(item => {
    if (
      !isConsumptionTransaction(item)
    ) {
      return;
    }

    const yearMonth =
      getTransactionYearMonth(item);

    if (!yearMonth) {
      return;
    }

    const amount =
      Math.abs(
        Number(
          item.amount || 0
        )
      );

    if (
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return;
    }

    const classification =
      classifyExpense(item);

    const category =
      getNormalizedCategory(item);

    const bookName =
      classification.group === "xx"
        ? "xx"
        : normalizeOtherBookName(
            classification.bookName
          );

    result.push({
      year:
        yearMonth.year,

      month:
        yearMonth.month,

      group:
        classification.group === "xx"
          ? "xx"
          : "其他",

      bookName,
      category,
      amount,
    });
  });

  return result;
}

// =====================================================
// ★ AI 数据结构
//
// ExpenseAIAnalysis 只接收这套已经统计好的结果。
// 它不需要重新查询 Supabase，也不需要重新判断消费。
// =====================================================

type AIExpenseCategory = {
  category: string;
  amount: number;
};

type AIExpenseBook = {
  bookName: string;
  amount: number;
  categories: AIExpenseCategory[];
};

type AIExpenseYear = {
  year: number;

  xx: {
    amount: number;
    categories: AIExpenseCategory[];
  };

  other: {
    amount: number;
    books: AIExpenseBook[];
  };

  total: number;
};

// =====================================================
// 页面
// =====================================================

export default function ExpensePage() {
  // ===================================================
  // 上传
  // ===================================================

  const [file, setFile] =
    useState<File | null>(null);

  const [uploading, setUploading] =
    useState(false);

  // ===================================================
  // 页面数据
  // ===================================================

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState("");

  const [overview, setOverview] =
    useState<any>(null);

  // 保存全部交易
  const [transactions, setTransactions] =
    useState<ExpenseTransaction[]>([]);

  // ===================================================
  // 未确认账户
  // ===================================================

  const [
    unresolvedAccounts,
    setUnresolvedAccounts,
  ] = useState<UnresolvedAccount[]>([]);

  // ===================================================
  // 统计显示 / 隐藏
  // ===================================================

  const [
    showStatistics,
    setShowStatistics,
  ] = useState(true);

  // ===================================================
  // 月份
  // ===================================================

  const [
    selectedMonthYear,
    setSelectedMonthYear,
  ] = useState<number | null>(null);

  const [
    selectedMonth,
    setSelectedMonth,
  ] = useState<number | null>(null);

  // ===================================================
  // 年份
  // ===================================================

  const [
    selectedYear,
    setSelectedYear,
  ] = useState<number | null>(null);

  // ===================================================
  // 按月 / 按年
  // ===================================================

  const [
    statisticsMode,
    setStatisticsMode,
  ] = useState<"month" | "year">("month");

  // xx / 其他详细数字表格模式
  const [
    expenseDetailMode,
    setExpenseDetailMode,
  ] = useState<"month" | "year">("month");

  const [
    expenseDetailYear,
    setExpenseDetailYear,
  ] = useState<number | null>(null);

  const [bookMonthlyYear, setBookMonthlyYear] = useState<number>(
  new Date().getFullYear()
);


const [exportStartYear, setExportStartYear] = useState<number>(2023);
  const [exportEndYear, setExportEndYear] = useState<number>(new Date().getFullYear());

  // 大消费表格独立选择的账本
  const [largeExpenseBook, setLargeExpenseBook] = useState<string>("日常账本");

  
  // ===================================================
  // 展开的项目
  //
  // 月度：
  //   monthly-xx
  //   monthly-其他
  //   monthly-other-book-日常账本
  //
  // 年度：
  //   annual-xx
  //   annual-其他
  //   annual-other-book-日常账本
  // ===================================================

  const [
    expandedBooks,
    setExpandedBooks,
  ] = useState<Set<string>>(
    new Set()
  );

  // ===================================================
  // 年度额度
  //
  // category 字段：
  //   xx
  //   其他
  // ===================================================

  const [
    budgets,
    setBudgets,
  ] = useState<BudgetRow[]>([]);

  const [
    budgetLoading,
    setBudgetLoading,
  ] = useState(false);

  const [
    budgetSaving,
    setBudgetSaving,
  ] = useState<
    "xx" | "其他" | null
  >(null);

  const [
    budgetError,
    setBudgetError,
  ] = useState<string | null>(null);

  // 流水表格独立的年份和月份选择
  const [tableYear, setTableYear] = useState<number | null>(null);
  const [tableMonth, setTableMonth] = useState<number | null>(null);
  // 流水表格独立账本选择

  const [tableBook, setTableBook] = useState<string>("ALL"); // 默认全部账本

 
// 将初始值设为当前年份（例如 2026），而不是 "ALL"
  const [largeExpenseYear, setLargeExpenseYear] = useState<string>(String(new Date().getFullYear()));


  
  // 选中的月份：支持具体月份（如 "09"）或选择全年（如 "ALL"）
  const [expenseDetailMonth, setExpenseDetailMonth] = useState<string>("ALL");
  
  // 选中的账本分类：支持具体分类（如 "餐饮"、"小宝"）或选择全部（"ALL"）
  const [expenseDetailCategory, setExpenseDetailCategory] = useState<string>("ALL");

  const [expenseDetailBook, setExpenseDetailBook] = useState<string>("ALL"); // 账本筛选
  
  // ===================================================
  // 加载消费数据
  // ===================================================

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const [
        overviewData,
        transactionData,
      ] = await Promise.all([
        getExpenseOverview(),
        getExpenseTransactions(),
      ]);

      setOverview(
        overviewData
      );

      setTransactions(
        transactionData
      );


      const validDates =
        transactionData
          .map(item =>
            getTransactionDate(item)
          )
          .filter(
            (
              date
            ): date is Date =>
              date !== null
          );

      if (validDates.length > 0) {
        validDates.sort(
          (a, b) =>
            b.getTime() -
            a.getTime()
        );

        const latestDate =
          validDates[0];

        const latestYear =
          latestDate.getFullYear();

        const latestMonth =
          latestDate.getMonth() + 1;

        setSelectedMonthYear(
          latestYear
        );

        setSelectedMonth(
          latestMonth
        );

        setSelectedYear(
          latestYear
        );

        setExpenseDetailYear(
          latestYear
        );

      setTableYear(latestYear);
      
      setTableMonth(latestMonth);
      setSelectedMonthYear(latestYear);
        setSelectedMonth(latestMonth);
        setSelectedYear(latestYear);
        setExpenseDetailYear(latestYear);
        
      }
    } catch (err) {
      console.error(
        "Expense load error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setLoading(false);
    }
  }

  // ===================================================
  // 加载年度额度
  // ===================================================

  async function loadBudgets(
    year: number
  ) {
    try {
      setBudgetLoading(true);
      setBudgetError(null);

      const response =
        await fetch(
          `/api/expense/budget?year=${encodeURIComponent(
            year
          )}`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      if (
        !contentType.includes(
          "application/json"
        )
      ) {
        const text =
          await response.text();

        console.error(
          "Budget API returned non-JSON:",
          text.slice(0, 500)
        );

        throw new Error(
          "年度额度接口没有返回 JSON，请检查 /api/expense/budget/route.ts"
        );
      }

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
          "年度额度加载失败"
        );
      }

      if (
        data?.success !== true
      ) {
        throw new Error(
          data?.error ||
          "年度额度加载失败"
        );
      }

      const rows =
        Array.isArray(data.data)
          ? data.data
          : [];

      setBudgets(
        rows.map(
          (row: any) => ({
            id: row.id,
            year: Number(row.year),
            category:
              String(
                row.category || ""
              ).trim(),
            budget_amount:
              Number(
                row.budget_amount || 0
              ),
          })
        )
      );
    } catch (err) {
      console.error(
        "loadBudgets error:",
        err
      );

      setBudgetError(
        err instanceof Error
          ? err.message
          : String(err)
      );

      setBudgets([]);
    } finally {
      setBudgetLoading(false);
    }
  }

  // ===================================================
  // 页面初始化
  // ===================================================

  useEffect(() => {
    loadData();
  }, []);

  // ===================================================
  // 年份变化 → 加载额度
  // ===================================================

  useEffect(() => {
    if (
      statisticsMode !== "year" ||
      selectedYear === null
    ) {
      return;
    }

    loadBudgets(
      selectedYear
    );
  }, [
    statisticsMode,
    selectedYear,
  ]);

  // ===================================================
  // 可选择年份
  // ===================================================

  const availableYears =
    useMemo(() => {
      const years =
        new Set<number>();

      transactions.forEach(
        item => {
          const date =
            getTransactionDate(
              item
            );

          if (date) {
            years.add(
              date.getFullYear()
            );
          }
        }
      );

      return Array.from(
        years
      ).sort(
        (a, b) => b - a
      );
    }, [
      transactions,
    ]);

  // ===================================================
  // 可选择月份
  // ===================================================

  const availableMonths =
    useMemo(() => {
      if (
        selectedMonthYear === null
      ) {
        return [];
      }

      const months =
        new Set<number>();

      transactions.forEach(
        item => {
          const date =
            getTransactionDate(
              item
            );

          if (
            date &&
            date.getFullYear() ===
              selectedMonthYear
          ) {
            months.add(
              date.getMonth() + 1
            );
          }
        }
      );

      return Array.from(
        months
      ).sort(
        (a, b) => a - b
      );
    }, [
      transactions,
      selectedMonthYear,
    ]);

  // ===================================================
  // 年份改变 → 月份自动选择
  // ===================================================

  useEffect(() => {
    if (
      selectedMonthYear === null
    ) {
      return;
    }

    if (
      availableMonths.length === 0
    ) {
      setSelectedMonth(null);
      return;
    }

    if (
      selectedMonth === null ||
      !availableMonths.includes(
        selectedMonth
      )
    ) {
      setSelectedMonth(
        availableMonths[
          availableMonths.length - 1
        ]
      );
    }
  }, [
    selectedMonthYear,
    availableMonths,
    selectedMonth,
  ]);

  // ===================================================
  // 年份初始化
  // ===================================================

  useEffect(() => {
    if (
      selectedYear === null &&
      availableYears.length > 0
    ) {
      setSelectedYear(
        availableYears[0]
      );
    }
  }, [
    availableYears,
    selectedYear,
  ]);

// 获取所有出现过的账本名称列表
  const availableBooks = useMemo(() => {
    const books = new Set<string>();
    transactions.forEach(item => {
      const name = getNormalizedBookName(item);
      if (name) books.add(name);
    });
    return Array.from(books).sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [transactions]);

  // 自由选择年月及账本的流水过滤逻辑
  const filteredTableTransactions = useMemo(() => {
    return transactions.filter(item => {
      const date = getTransactionDate(item);
      if (!date) return false;

      // 1. 年月过滤
      const matchYearMonth =
        tableYear === null ||
        tableMonth === null ||
        (date.getFullYear() === tableYear && date.getMonth() + 1 === tableMonth);

      if (!matchYearMonth) return false;

      // 2. 账本过滤
      if (tableBook !== "ALL") {
        const bookName = getNormalizedBookName(item);
        if (bookName !== tableBook) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, tableYear, tableMonth, tableBook]);


  // 大消费数据过滤（金额 >= 2000，可按账本和年份筛选，按年降序显示）
  const largeExpenseTransactions = useMemo(() => {
    return transactions
      .filter(item => {
        if (!isConsumptionTransaction(item)) {
          return false;
        }

        const amount = Math.abs(Number(item.amount || 0));
        if (!Number.isFinite(amount) || amount < 2000) {
          return false;
        }

        const date = getTransactionDate(item);
        if (!date) return false;
        const year = date.getFullYear();

        // 1. 年份筛选
        if (largeExpenseYear !== "ALL" && year !== Number(largeExpenseYear)) {
          return false;
        }

        // 2. 账本筛选
        if (largeExpenseBook !== "ALL") {
          const bookName = getNormalizedBookName(item);
          if (bookName !== largeExpenseBook) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = getTransactionDate(a)?.getTime() || 0;
        const dateB = getTransactionDate(b)?.getTime() || 0;
        return dateB - dateA;
      });
  }, [transactions, largeExpenseBook, largeExpenseYear]);




  // ===================================================
  // 月度交易
  // ===================================================

  const monthlyTransactions =
    useMemo(() => {
      if (
        selectedMonthYear === null ||
        selectedMonth === null
      ) {
        return [];
      }

      return transactions.filter(
        item => {
          if (
            !isConsumptionTransaction(
              item
            )
          ) {
            return false;
          }

          const date =
            getTransactionDate(
              item
            );

          if (!date) {
            return false;
          }

          return (
            date.getFullYear() ===
              selectedMonthYear &&
            date.getMonth() + 1 ===
              selectedMonth
          );
        }
      );
    }, [
      transactions,
      selectedMonthYear,
      selectedMonth,
    ]);

  // ===================================================
  // 年度交易
  // ===================================================

  const yearlyTransactions =
    useMemo(() => {
      if (
        selectedYear === null
      ) {
        return [];
      }

      return transactions.filter(
        item => {
          if (
            !isConsumptionTransaction(
              item
            )
          ) {
            return false;
          }

          const date =
            getTransactionDate(
              item
            );

          if (!date) {
            return false;
          }

          return (
            date.getFullYear() ===
            selectedYear
          );
        }
      );
    }, [
      transactions,
      selectedYear,
    ]);

  // ===================================================
  // ★ 统一消费数据
  //
  // 页面年度统计、AI、其他后续分析全部使用这里。
  // ===================================================

  const unifiedExpenseRecords =
    useMemo(
      () =>
        buildUnifiedExpenseRecords(
          transactions
        ),
      [transactions]
    );

  // 过滤后的消费明细流水
// 4. 最终过滤后的消费明细流水
  const filteredExpenseDetails = useMemo(() => {
    if (!Array.isArray(unifiedExpenseRecords)) return [];

    return unifiedExpenseRecords.filter(record => {
      const bookName = record.bookName || record.book_name || "";
      const rawYear = record.year || record.annee || "";
      const rawDate = record.transaction_time || record.date || "";
      const rawMonth = record.month || "";
      const rawCategory = record.category || record.type || "";

      // 1. 账本筛选
      if (expenseDetailBook && expenseDetailBook !== "ALL" && bookName !== expenseDetailBook) {
        return false;
      }

      // 2. 年份解析与筛选
      let recordYear = String(rawYear).trim();
      if (!recordYear && rawDate) {
        const matchYear = String(rawDate).match(/^(\d{4})/);
        if (matchYear) recordYear = matchYear[1];
      }
      if (expenseDetailYear && expenseDetailYear !== "ALL" && recordYear !== String(expenseDetailYear)) {
        return false;
      }

      // 3. 月份解析与筛选（全年 vs 单月）
      let recordMonth = String(rawMonth).trim();
      if (!recordMonth && rawDate) {
        const matchMonth = String(rawDate).match(/-(\d{1,2})-/);
        if (matchMonth) {
          recordMonth = matchMonth[1].padStart(2, "0");
        }
      } else if (recordMonth) {
        recordMonth = recordMonth.padStart(2, "0");
      }
      if (expenseDetailMonth && expenseDetailMonth !== "ALL" && recordMonth !== String(expenseDetailMonth)) {
        return false;
      }

      // 4. 分类筛选
      const recordCategory = String(rawCategory).trim();
      if (expenseDetailCategory && expenseDetailCategory !== "ALL" && recordCategory !== String(expenseDetailCategory)) {
        return false;
      }

      return true;
    });
  }, [unifiedExpenseRecords, expenseDetailBook, expenseDetailYear, expenseDetailMonth, expenseDetailCategory]);

  // 动态计算当前可选的分类列表（根据当前选中的年份/账本动态生成，方便下拉框选择）
const availableCategories = useMemo(() => {
    const set = new Set<string>();
    unifiedExpenseRecords.forEach(record => {
      const bName = record.bookName || record.book_name;
      const rYear = String(record.year || "");
      
      // 符合当前选中的账本和年份时，收集其分类
      const matchBook = expenseDetailBook === "ALL" || bName === expenseDetailBook;
      const matchYear = expenseDetailYear === "ALL" || rYear === expenseDetailYear;

      if (matchBook && matchYear && record.category) {
        set.add(record.category);
      }
    });
    return Array.from(set).sort();
  }, [unifiedExpenseRecords, expenseDetailBook, expenseDetailYear]);

    // 2. 计算各年度的大消费统计与占当年账本总消费的百分比
  const largeExpenseAnnualStats = useMemo(() => {
    const statsMap = new Map<number, { largeTotal: number; count: number }>();

    largeExpenseTransactions.forEach(item => {
      const date = getTransactionDate(item);
      if (!date) return;
      const year = date.getFullYear();
      const amount = Math.abs(Number(item.amount || 0));

      if (!statsMap.has(year)) {
        statsMap.set(year, { largeTotal: 0, count: 0 });
      }
      const entry = statsMap.get(year)!;
      entry.largeTotal += amount;
      entry.count += 1;
    });

    const result = Array.from(statsMap.entries()).map(([year, data]) => {
      const totalConsumption = unifiedExpenseRecords
        .filter(record => {
          if (Number(record.year) !== year) return false;
          if (largeExpenseBook !== "ALL" && record.bookName !== largeExpenseBook) {
            return false;
          }
          return true;
        })
        .reduce((sum, record) => sum + Number(record.amount || 0), 0);

      const percentage = totalConsumption > 0 ? (data.largeTotal / totalConsumption) * 100 : 0;

      return {
        year,
        largeTotal: data.largeTotal,
        count: data.count,
        totalConsumption,
        percentage,
      };
    });

    return result.sort((a, b) => b.year - a.year);
  }, [largeExpenseTransactions, unifiedExpenseRecords, largeExpenseBook]);


  // 按年、按账本、按分类汇总金额的表格数据
  const yearlyBookCategoryMatrix = useMemo(() => {
    // 结构: Map<year, Map<bookName, Map<category, amount>>>
    const map = new Map<number, Map<string, Map<number, number>>>(); // 为了精简，用 Map 嵌套

    unifiedExpenseRecords.forEach(record => {
      const year = Number(record.year);
      const bookName = record.bookName || "未设置账本";
      const category = record.category || "未分类";
      const amount = Number(record.amount || 0);

      if (!Number.isFinite(year) || amount <= 0) return;

      if (!map.has(year)) {
        map.set(year, new Map());
      }
      const yearMap = map.get(year)!;

      if (!yearMap.has(bookName)) {
        yearMap.set(bookName, new Map());
      }
      const bookMap = yearMap.get(bookName)!;

      const currentAmount = bookMap.get(category) || 0;
      bookMap.set(category, currentAmount + amount);
    });

    // 转换为便于渲染的结构
    const result: Array<{
      year: number;
      books: Array<{
        bookName: string;
        categories: Array<{ category: string; amount: number }>;
        bookTotal: number;
      }>;
      yearTotal: number;
    }> = [];

    map.forEach((yearMap, year) => {
      let yearTotal = 0;
      const books: Array<{
        bookName: string;
        categories: Array<{ category: string; amount: number }>;
        bookTotal: number;
      }> = [];

      yearMap.forEach((categoryMap, bookName) => {
        let bookTotal = 0;
        const categories: Array<{ category: string; amount: number }> = [];

        categoryMap.forEach((amount, category) => {
          bookTotal += amount;
          categories.push({ category, amount });
        });

        // 账本内分类按金额从大到小排序
        categories.sort((a, b) => b.amount - a.amount);
        yearTotal += bookTotal;

        books.push({
          bookName,
          categories,
          bookTotal,
        });
      });

      // 账本按总金额从大到小排序
      books.sort((a, b) => b.bookTotal - a.bookTotal);

      result.push({
        year,
        books,
        yearTotal,
      });
    });

    // 按年份降序排列（最近的年份在最上面）
    return result.sort((a, b) => b.year - a.year);
  }, [unifiedExpenseRecords]);
// =====================================================
// ★ 今年各账本月度统计
//
// 行 = 月份
// 列 = 实际账本
// 最后一列 = 月合计
// 最后一行 = 全年合计
//
// 直接使用 unifiedExpenseRecords，保证与页面和 AI
// 使用完全相同的消费口径。
// =====================================================
const yearlyBookMonthlyStats = useMemo(() => {
  const year = bookMonthlyYear;

  // 只取当前选择年份的数据
  const yearRecords = unifiedExpenseRecords.filter(
    record => Number(record.year) === year
  );

  // 只显示这个年份实际出现过的账本
  const bookSet = new Set<string>();

  for (const record of yearRecords) {
    if (record.bookName) {
      bookSet.add(record.bookName);
    }
  }

  const books = Array.from(bookSet).sort((a, b) =>
    a.localeCompare(b, "zh-CN")
  );

  // 12个月
  const rows = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;

    const amounts: Record<string, number> = {};

    for (const book of books) {
      amounts[book] = yearRecords
        .filter(
          record =>
            Number(record.month) === month &&
            record.bookName === book
        )
        .reduce(
          (sum, record) => sum + Number(record.amount || 0),
          0
        );
    }

    const total = Object.values(amounts).reduce(
      (sum, amount) => sum + amount,
      0
    );

    return {
      month,
      amounts,
      total,
    };
  });

  // 全年各账本合计
  const totals: Record<string, number> = {};

  for (const book of books) {
    totals[book] = yearRecords
      .filter(record => record.bookName === book)
      .reduce(
        (sum, record) => sum + Number(record.amount || 0),
        0
      );
  }

  // 全年总消费
  const grandTotal = Object.values(totals).reduce(
    (sum, amount) => sum + amount,
    0
  );

  return {
    year,
    books,
    rows,
    totals,
    grandTotal,
  };
}, [unifiedExpenseRecords, bookMonthlyYear]);
const handleExportExpenseAnalysisData = () => {
    try {
      const validRecords = unifiedExpenseRecords
        .map(record => ({
          ...record,
          year: Number(record.year),
          month: Number(record.month),
          amount: Number(record.amount || 0),
        }))
        .filter(
          record =>
            Number.isFinite(record.year) &&
            Number.isFinite(record.month) &&
            record.month >= 1 &&
            record.month <= 12
        );

      if (validRecords.length === 0) {
        alert("没有可导出的消费数据。");
        return;
      }

      const startYear = exportStartYear;
      const endYear = exportEndYear;
      const startMonth = 1;
      const endMonth = 12;

      // 根据选择的年份范围筛选数据
      const analysisRecords = validRecords.filter(record => {
        if (record.year < startYear || record.year > endYear) {
          return false;
        }
        return true;
      });

      const bookSet = new Set<string>();
      for (const record of analysisRecords) {
        if (record.bookName) {
          bookSet.add(record.bookName);
        }
      }
      const books = Array.from(bookSet).sort((a, b) =>
        a.localeCompare(b, "zh-CN")
      );

      const monthlyData: Record<string, Record<string, number>> = {};
      for (const record of analysisRecords) {
        const key = `${record.year}-${String(record.month).padStart(2, "0")}`;
        if (!monthlyData[key]) {
          monthlyData[key] = {};
        }
        monthlyData[key][record.bookName] =
          (monthlyData[key][record.bookName] || 0) + record.amount;
      }

      const monthlySummary = [];
      for (let year = startYear; year <= endYear; year++) {
        for (let month = 1; month <= 12; month++) {
          const key = `${year}-${String(month).padStart(2, "0")}`;
          const booksData: Record<string, number> = {};
          let total = 0;

          for (const book of books) {
            const amount = monthlyData[key]?.[book] || 0;
            booksData[book] = amount;
            total += amount;
          }

          monthlySummary.push({
            year,
            month,
            period: key,
            books: booksData,
            total,
          });
        }
      }

      const yearlySummary = [];
      for (let year = startYear; year <= endYear; year++) {
        const yearRecords = analysisRecords.filter(record => record.year === year);
        const booksData: Record<string, number> = {};
        let total = 0;

        for (const book of books) {
          const amount = yearRecords
            .filter(record => record.bookName === book)
            .reduce((sum, record) => sum + record.amount, 0);

          booksData[book] = amount;
          total += amount;
        }

        yearlySummary.push({
          year,
          books: booksData,
          total,
        });
      }

      const exportData = {
        exportedAt: new Date().toISOString(),
        source: "AI-Wealth-OS / expense",
        description: `${startYear}年至${endYear}年消费分析数据`,
        period: {
          startYear,
          endYear,
        },
        books,
        monthlySummary,
        yearlySummary,
        records: analysisRecords.map(record => ({
          year: record.year,
          month: record.month,
          bookName: record.bookName,
          category: record.category,
          group: record.group,
          amount: record.amount,
        })),
      };

      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `expense-analysis-${startYear}-to-${endYear}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("导出消费分析数据失败:", error);
      alert("导出消费分析数据失败，请查看控制台。");
    }
  };
const handleExportExpenseData = () => {
  try {
    const exportData = {
      exportedAt: new Date().toISOString(),
      source: "AI-Wealth-OS / expense",

      // 全部原始消费数据
      transactions,

      // 统一后的消费记录
      unifiedExpenseRecords,

      // 页面实际存在的年份
      availableYears,

      // 消费统计排除规则
      excludedBooks: Array.from(EXCLUDED_BOOK_NAMES),

      // 当前选择年份的账本月度统计
      bookMonthlyStats: yearlyBookMonthlyStats,
    };

    const json = JSON.stringify(exportData, null, 2);

    const blob = new Blob([json], {
      type: "application/json;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "expense-export.json";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("导出消费数据失败:", error);
    alert("导出消费数据失败，请查看控制台。");
  }
};


// 日常账本：行是年份，列是各项分类的矩阵数据（支持将其他带“游”的账本计入日常账本的“旅游”分类）
  const dailyBookYearlyMatrix = useMemo(() => {
    const yearsSet = new Set<number>();
    const categoriesSet = new Set<string>();
    
    const dailyYearCategoryMap = new Map<number, Map<string, number>>();
    const xiaoBaoBookYearMap = new Map<number, number>();

    unifiedExpenseRecords.forEach(record => {
      let bookName = (record.bookName || "").trim();
      const year = Number(record.year);
      const amount = Number(record.amount || 0);

      if (!Number.isFinite(year) || amount <= 0) return;
      yearsSet.add(year);

      let category = record.category || "未分类";

      // 🌟 核心新规则：如果账本名称带“游”（且不属于小宝2.7万这类特殊账本），
      // 我们将其视作日常账本的“旅游”支出归集进来
      const isTravelBook = bookName.includes("游") && !bookName.includes("小宝");

      if (bookName === "日常账本" || isTravelBook) {
        // 如果是带“游”的账本，或者日常账本里属于旅游/小宝的分类，做归一化处理
        if (isTravelBook) {
          category = "旅游";
        } else if (category.includes("小宝")) {
          category = "小宝";
        }

        categoriesSet.add(category);

        if (!dailyYearCategoryMap.has(year)) {
          dailyYearCategoryMap.set(year, new Map());
        }
        const catMap = dailyYearCategoryMap.get(year)!;
        catMap.set(category, (catMap.get(category) || 0) + amount);
      }

      // 收集“小宝2.7万”账本的年度统计数字（用于小宝无流水时的替补）
      if (bookName.includes("小宝") && (bookName.includes("2.7万") || bookName.includes("27000"))) {
        xiaoBaoBookYearMap.set(year, (xiaoBaoBookYearMap.get(year) || 0) + amount);
      }
    });

    // 确保核心分类展示
    categoriesSet.add("小宝");
    categoriesSet.add("旅游");

    if (yearsSet.size === 0) {
      yearsSet.add(new Date().getFullYear());
    }

    const categories = Array.from(categoriesSet).sort((a, b) => {
      if (a === "小宝") return -1;
      if (b === "小宝") return 1;
      if (a === "旅游") return -1;
      if (b === "旅游") return 1;
      return a.localeCompare(b, "zh-CN");
    });

    const years = Array.from(yearsSet).sort((a, b) => b - a);

    const rows: Array<{
      year: number;
      amounts: Record<string, number>;
      yearTotal: number;
    }> = [];

    years.forEach(year => {
      let yearTotal = 0;
      const amounts: Record<string, number> = {};
      const catMap = dailyYearCategoryMap.get(year) || new Map();

      categories.forEach(category => {
        let amt = catMap.get(category) || 0;

        // 如果日常账本（及合并进来的旅游）中小宝当年为0，读取“小宝2.7万”账本填补
        if (category === "小宝" && amt === 0) {
          amt = xiaoBaoBookYearMap.get(year) || 0;
        }

        amounts[category] = amt;
        yearTotal += amt;
      });

      rows.push({
        year,
        amounts,
        yearTotal,
      });
    });

    return { categories, rows };
  }, [unifiedExpenseRecords]);
  // ===================================================
  // ★ 生成 aiExpenseYears
  // ===================================================

  const aiExpenseYears =
    useMemo<AIExpenseYear[]>(
      () => {
        const yearMap =
          new Map<
            number,
            {
              xxAmount: number;
              xxCategories:
                Map<string, number>;

              otherAmount: number;

              otherBooks:
                Map<
                  string,
                  {
                    amount: number;
                    categories:
                      Map<string, number>;
                  }
                >;
            }
          >();

        unifiedExpenseRecords.forEach(
          record => {
            if (
              !yearMap.has(
                record.year
              )
            ) {
              yearMap.set(
                record.year,
                {
                  xxAmount: 0,
                  xxCategories:
                    new Map(),

                  otherAmount: 0,
                  otherBooks:
                    new Map(),
                }
              );
            }

            const yearData =
              yearMap.get(
                record.year
              )!;

            if (
              record.group === "xx"
            ) {
              yearData.xxAmount +=
                record.amount;

              yearData.xxCategories.set(
                record.category,
                (
                  yearData.xxCategories.get(
                    record.category
                  ) || 0
                ) +
                  record.amount
              );

              return;
            }

            // ★ xx 不允许进入其他
            if (
              record.bookName === "xx"
            ) {
              return;
            }

            yearData.otherAmount +=
              record.amount;

            if (
              !yearData.otherBooks.has(
                record.bookName
              )
            ) {
              yearData.otherBooks.set(
                record.bookName,
                {
                  amount: 0,
                  categories:
                    new Map(),
                }
              );
            }

            const bookData =
              yearData.otherBooks.get(
                record.bookName
              )!;

            bookData.amount +=
              record.amount;

            bookData.categories.set(
              record.category,
              (
                bookData.categories.get(
                  record.category
                ) || 0
              ) +
                record.amount
            );
          }
        );

        return Array.from(
          yearMap.entries()
        )
          .map(
            (
              [
                year,
                data,
              ]
            ) => {
              const xxCategories =
                Array.from(
                  data.xxCategories.entries()
                )
                  .map(
                    ([
                      category,
                      amount,
                    ]) => ({
                      category,
                      amount,
                    })
                  )
                  .sort(
                    (a, b) =>
                      b.amount -
                      a.amount
                  );

              const otherBooks =
                Array.from(
                  data.otherBooks.entries()
                )
                  .filter(
                    ([
                      bookName,
                    ]) =>
                      bookName !== "xx"
                  )
                  .map(
                    ([
                      bookName,
                      bookData,
                    ]) => ({
                      bookName,
                      amount:
                        bookData.amount,

                      categories:
                        Array.from(
                          bookData.categories.entries()
                        )
                          .map(
                            ([
                              category,
                              amount,
                            ]) => ({
                              category,
                              amount,
                            })
                          )
                          .sort(
                            (a, b) =>
                              b.amount -
                              a.amount
                          ),
                    })
                  )
                  .sort(
                    (a, b) =>
                      b.amount -
                      a.amount
                  );

              return {
                year,

                xx: {
                  amount:
                    data.xxAmount,

                  categories:
                    xxCategories,
                },

                other: {
                  amount:
                    data.otherAmount,

                  books:
                    otherBooks,
                },

                total:
                  data.xxAmount +
                  data.otherAmount,
              };
            }
          )
          .sort(
            (a, b) =>
              b.year -
              a.year
          );
      },
      [
        unifiedExpenseRecords,
      ]
    );

  // ===================================================
  // ★ xx / 其他详细数字表格
  //
  // 重要：
  // 1. 按月显示用户选择年份的 1–12 月，即使某个月没有消费也显示 ¥0。
  // 2. 按年显示全部历史年份。
  // 3. 金额只来自 unifiedExpenseRecords，和页面 / AI 使用完全相同的消费口径。
  // ===================================================

  const expenseDetailRows = useMemo(() => {
    type DetailRow = {
      period: string;
      xx: number;
      other: number;
    };

    // -------------------------------------------------
    // 按月：只显示当前自然年
    // -------------------------------------------------
if (expenseDetailMode === "month") {
      // 使用你选择的年份，若未选则回退到当年
      const currentYear = expenseDetailYear ?? new Date().getFullYear();

      // ★ 先无条件建立 1–12 月。
      // 这样即使 unifiedExpenseRecords 暂时为空，
      // 页面也不会出现「暂无消费数据」而是正常显示今年 12 个月。
      const monthRows: DetailRow[] = Array.from(
        { length: 12 },
        (_, index) => ({
          period:
            `${currentYear}-${String(index + 1).padStart(2, "0")}`,
          xx: 0,
          other: 0,
        })
      );

      const rowMap = new Map(
        monthRows.map(row => [row.period, row])
      );

      unifiedExpenseRecords.forEach(record => {
        // 只统计用户选择的年份
        if (
          Number(record.year) !==
          currentYear
        ) {
          return;
        }

        const month = Number(record.month);

        if (
          !Number.isInteger(month) ||
          month < 1 ||
          month > 12
        ) {
          return;
        }

        const period =
          `${currentYear}-${String(month).padStart(2, "0")}`;

        const row = rowMap.get(period);

        if (!row) {
          return;
        }

        const amount = Math.abs(
          Number(record.amount || 0)
        );

        if (
          !Number.isFinite(amount) ||
          amount <= 0
        ) {
          return;
        }

        // ★ xx 永远只进入 xx
        if (record.group === "xx") {
          row.xx += amount;
          return;
        }

        // ★ 其他中再保险排除 xx
        if (
          record.group === "其他" &&
          record.bookName !== "xx"
        ) {
          row.other += amount;
        }
      });

      return monthRows;
    }

    // -------------------------------------------------
    // 按年：全部历史年份
    // -------------------------------------------------
    const yearMap = new Map<
      string,
      DetailRow
    >();

    unifiedExpenseRecords.forEach(record => {
      const year = Number(record.year);

      if (!Number.isInteger(year)) {
        return;
      }

      const period = String(year);

      if (!yearMap.has(period)) {
        yearMap.set(period, {
          period,
          xx: 0,
          other: 0,
        });
      }

      const row = yearMap.get(period)!;
      const amount = Math.abs(
        Number(record.amount || 0)
      );

      if (
        !Number.isFinite(amount) ||
        amount <= 0
      ) {
        return;
      }

      if (record.group === "xx") {
        row.xx += amount;
      } else if (
        record.group === "其他" &&
        record.bookName !== "xx"
      ) {
        row.other += amount;
      }
    });

    return Array.from(
      yearMap.values()
    ).sort(
      (a, b) =>
        Number(b.period) -
        Number(a.period)
    );
  }, [
    unifiedExpenseRecords,
    expenseDetailMode,
    expenseDetailYear,
  ]);



  // ===================================================
  // ★ 月度 xx / 其他统计
  //
  // 月度统计与年度统计必须使用完全相同的统一消费规则。
  // 不再直接按原始账簿显示，统一为：
  //
  // xx：
  //   ▼ xx
  //       餐饮
  //       购物
  //       ...
  //
  // 其他：
  //   ▼ 其他
  //       ▶ 日常账本
  //       ▶ 家庭账本
  //       ▶ 旅游
  //
  // 再点击具体账簿：
  //       ▼ 日常账本
  //           餐饮
  //           交通
  //           购物
  //
  // ★ 数据直接来自 unifiedExpenseRecords，确保月度、年度、
  // AI 和「xx / 其他详细数字」完全使用同一套消费口径。
  // ===================================================

  const monthlyBookGroups =
    useMemo(() => {
      const groups: Record<
        "xx" | "其他",
        AnnualBookGroup
      > = {
        xx: {
          amount: 0,
          categories: new Map(),
          books: new Map(),
          bookCategories: new Map(),
        },

        其他: {
          amount: 0,
          categories: new Map(),
          books: new Map(),
          bookCategories: new Map(),
        },
      };

      unifiedExpenseRecords
        .filter(record =>
          selectedMonthYear !== null &&
          selectedMonth !== null &&
          record.year === selectedMonthYear &&
          record.month === selectedMonth
        )
        .forEach(record => {
          const group = record.group;

          // ★ 最后一道保险：xx 永远不能进入「其他」。
          if (
            group === "其他" &&
            record.bookName === "xx"
          ) {
            return;
          }

          const groupData = groups[group];
          groupData.amount += record.amount;

          // 分组内部的分类统计。
          // xx 直接按分类显示；其他仅作为统一数据结构保留。
          groupData.categories.set(
            record.category,
            (groupData.categories.get(record.category) || 0) +
              record.amount
          );

          if (group === "xx") {
            groupData.books.set(
              "xx",
              (groupData.books.get("xx") || 0) +
                record.amount
            );
            return;
          }

          // 其他 → 具体账簿。
          groupData.books.set(
            record.bookName,
            (groupData.books.get(record.bookName) || 0) +
              record.amount
          );

          // 其他 → 具体账簿 → 分类。
          if (!groupData.bookCategories.has(record.bookName)) {
            groupData.bookCategories.set(
              record.bookName,
              new Map()
            );
          }

          const bookCategoryMap =
            groupData.bookCategories.get(record.bookName)!;

          bookCategoryMap.set(
            record.category,
            (bookCategoryMap.get(record.category) || 0) +
              record.amount
          );
        });

      return groups;
    }, [
      unifiedExpenseRecords,
      selectedMonthYear,
      selectedMonth,
    ]);

  // ===================================================
  // 年度 xx / 其他统计
  //
  // ★ 这里增加：
  //
  // 其他
  //   ├── 日常账本
  //   │    ├── 餐饮
  //   │    ├── 交通
  //   │    └── 购物
  //   │
  //   ├── 家庭账本
  //   └── 旅游账本
  //
  // ===================================================

  const annualBookGroups =
    useMemo(() => {
      const groups: Record<
        "xx" | "其他",
        AnnualBookGroup
      > = {
        xx: {
          amount: 0,
          categories:
            new Map(),
          books:
            new Map(),
          bookCategories:
            new Map(),
        },

        其他: {
          amount: 0,
          categories:
            new Map(),
          books:
            new Map(),
          bookCategories:
            new Map(),
        },
      };

      unifiedExpenseRecords
        .filter(
          record =>
            selectedYear !== null &&
            record.year ===
              selectedYear
        )
        .forEach(
          record => {
            const group =
              record.group;

            // ★ 再保险：
            // xx 永远不进入其他
            if (
              group === "其他" &&
              record.bookName === "xx"
            ) {
              return;
            }

            const groupData =
              groups[group];

            groupData.amount +=
              record.amount;

            groupData.categories.set(
              record.category,
              (
                groupData.categories.get(
                  record.category
                ) || 0
              ) +
                record.amount
            );

            if (
              group === "xx"
            ) {
              groupData.books.set(
                "xx",
                (
                  groupData.books.get(
                    "xx"
                  ) || 0
                ) +
                  record.amount
              );

              return;
            }

            groupData.books.set(
              record.bookName,
              (
                groupData.books.get(
                  record.bookName
                ) || 0
              ) +
                record.amount
            );

            if (
              !groupData.bookCategories.has(
                record.bookName
              )
            ) {
              groupData.bookCategories.set(
                record.bookName,
                new Map()
              );
            }

            const bookCategoryMap =
              groupData.bookCategories.get(
                record.bookName
              )!;

            bookCategoryMap.set(
              record.category,
              (
                bookCategoryMap.get(
                  record.category
                ) || 0
              ) +
                record.amount
            );
          }
        );

      return groups;
    }, [
      unifiedExpenseRecords,
      selectedYear,
    ]);

  // ===================================================
  // 年度实际消费
  // ===================================================

  const annualXXActual =
    annualBookGroups.xx.amount;

  const annualOtherActual =
    annualBookGroups.其他.amount;

  const annualTotalActual =
    annualXXActual +
    annualOtherActual;

  // ===================================================
  // 取得额度
  // ===================================================

  function getBudgetAmount(
    category:
      | "xx"
      | "其他"
  ): number {
    const row =
      budgets.find(
        item =>
          item.category ===
          category
      );

    return Number(
      row?.budget_amount || 0
    );
  }

  const annualXXBudget =
    getBudgetAmount("xx");

  const annualOtherBudget =
    getBudgetAmount("其他");

  const annualTotalBudget =
    annualXXBudget +
    annualOtherBudget;

  // ===================================================
  // 差额
  //
  // 正数 = 剩余
  // 负数 = 超预算
  // ===================================================

  const annualXXGap =
    annualXXBudget -
    annualXXActual;

  const annualOtherGap =
    annualOtherBudget -
    annualOtherActual;

  const annualTotalGap =
    annualTotalBudget -
    annualTotalActual;

  // ===================================================
  // 保存年度额度
  // ===================================================

  async function saveBudget(
    category:
      | "xx"
      | "其他",
    value: string
  ) {
    if (
      selectedYear === null
    ) {
      return;
    }

    const amount =
      Number(value);

    if (
      !Number.isFinite(
        amount
      ) ||
      amount < 0
    ) {
      setBudgetError(
        "年度额度必须是大于等于 0 的数字"
      );

      return;
    }

    try {
      setBudgetSaving(
        category
      );

      setBudgetError(null);

      const response =
        await fetch(
          "/api/expense/budget",
          {
            method: "PUT",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                year:
                  selectedYear,
                category,
                budget_amount:
                  amount,
              }),
          }
        );

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      if (
        !contentType.includes(
          "application/json"
        )
      ) {
        const text =
          await response.text();

        console.error(
          "Budget PUT returned non-JSON:",
          text.slice(0, 500)
        );

        throw new Error(
          "年度额度保存接口没有返回 JSON"
        );
      }

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
          "年度额度保存失败"
        );
      }

      if (
        data?.success !== true
      ) {
        throw new Error(
          data?.error ||
          "年度额度保存失败"
        );
      }

      const saved =
        data.data;

      setBudgets(
        previous => {
          const exists =
            previous.some(
              item =>
                item.category ===
                category
            );

          if (exists) {
            return previous.map(
              item =>
                item.category ===
                category
                  ? {
                      ...item,
                      id:
                        saved?.id ??
                        item.id,
                      year:
                        Number(
                          saved?.year ??
                          selectedYear
                        ),
                      budget_amount:
                        Number(
                          saved?.budget_amount ??
                          amount
                        ),
                    }
                  : item
            );
          }

          return [
            ...previous,
            {
              id:
                saved?.id,
              year:
                Number(
                  saved?.year ??
                  selectedYear
                ),
              category,
              budget_amount:
                Number(
                  saved?.budget_amount ??
                  amount
                ),
            },
          ];
        }
      );
    } catch (err) {
      console.error(
        "saveBudget error:",
        err
      );

      setBudgetError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setBudgetSaving(null);
    }
  }

  // ===================================================
  // 展开 / 收起
  // ===================================================

  function toggleBook(
    bookName: string
  ) {
    setExpandedBooks(
      previous => {
        const next =
          new Set(
            previous
          );

        if (
          next.has(
            bookName
          )
        ) {
          next.delete(
            bookName
          );
        } else {
          next.add(
            bookName
          );
        }

        return next;
      }
    );
  }

  // ===================================================
  // 切换统计模式
  // ===================================================

  function changeStatisticsMode(
    mode:
      | "month"
      | "year"
  ) {
    setStatisticsMode(
      mode
    );

    setExpandedBooks(
      new Set()
    );

    if (
      mode === "year" &&
      selectedYear === null &&
      availableYears.length > 0
    ) {
      setSelectedYear(
        availableYears[0]
      );
    }
  }

  // ===================================================
  // 上传
  // ===================================================

  async function handleUpload() {
    if (!file) {
      setError(
        "请先选择 Excel 文件"
      );

      return;
    }

    const name =
      file.name.toLowerCase();

    if (
      !name.endsWith(
        ".xlsx"
      ) &&
      !name.endsWith(
        ".xls"
      )
    ) {
      setError(
        "只支持 .xlsx 或 .xls Excel 文件"
      );

      return;
    }

    try {
      setUploading(true);
      setError(null);
      setMessage("");
      setUnresolvedAccounts(
        []
      );

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      const response =
        await fetch(
          "/api/expense",
          {
            method: "POST",
            body: formData,
          }
        );

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      if (
        !contentType.includes(
          "application/json"
        )
      ) {
        const text =
          await response.text();

        throw new Error(
          `消费导入接口没有返回 JSON：${text.slice(
            0,
            300
          )}`
        );
      }

      const data =
        await response.json();

      if (
        data?.needs_confirmation ===
        true
      ) {
        const accounts =
          Array.isArray(
            data?.accounts
          )
            ? data.accounts
            : [];

        setUnresolvedAccounts(
          accounts
        );

        setMessage(
          data?.message ||
          "发现尚未确认的账户名称，请先完成账户名称对应。"
        );

        return;
      }

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.error ||
          "Excel 导入失败"
        );
      }

      const result =
        data.result;

      setMessage(
        `导入完成 · 新增 ${
          result?.inserted ??
          0
        } 笔 · 重复 ${
          result?.duplicated ??
          0
        } 笔 · 失败 ${
          result?.failed ??
          0
        } 笔`
      );

      setFile(null);

      setUnresolvedAccounts(
        []
      );

      await loadData();

      if (
        selectedYear !== null
      ) {
        await loadBudgets(
          selectedYear
        );
      }
    } catch (err) {
      console.error(
        "Expense upload error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setUploading(false);
    }
  }

  // ===================================================
  // 清除上传状态
  // ===================================================

  function clearUploadState() {
    setMessage("");
    setError(null);
    setUnresolvedAccounts(
      []
    );
  }

  // ===================================================
  // 最近100笔
  // ===================================================

  const recentTransactions =
    useMemo(
      () =>
        transactions.slice(
          0,
          100
        ),
      [transactions]
    );

  // ===================================================
  // 页面
  // ===================================================

  return (
    <div
      className="
        min-h-screen
        bg-gray-50
        text-gray-900
      "
    >
      <TopBar title="消费明细" />

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

        <div className="mb-6">
          <div
            className="
              flex
              flex-wrap
              items-center
              justify-between
              gap-3
            "
          >
            <div>
              <h1
                className="
                  text-2xl
                  font-bold
                "
              >
                家庭消费
              </h1>

              <p
                className="
                  mt-1
                  text-sm
                  text-gray-500
                "
              >
                上传有鱼 Excel「收入支出」数据，自动保存消费流水。
              </p>
            </div>

            <Link
              href="/expense-account-mappings"
              className="
                inline-flex
                items-center
                gap-2
                rounded-lg
                border
                border-gray-300
                bg-white
                px-4
                py-2
                text-sm
                font-medium
                text-gray-700
                hover:bg-gray-50
              "
            >
              <span>🔗</span>
              <span>账户名称映射</span>
            </Link>
          </div>
        </div>

        {/* =================================================
            上传
        ================================================= */}

        <div
          className="
            mb-6
            rounded-xl
            border
            bg-white
            p-6
          "
        >
          <div
            className="
              mb-4
              text-base
              font-semibold
            "
          >
            上传有鱼 Excel
          </div>

          <div
            className="
              flex
              flex-wrap
              items-center
              gap-3
            "
          >
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={event => {
                setFile(
                  event.target.files?.[0] ??
                  null
                );

                clearUploadState();
              }}
              className="
                block
                text-sm
              "
            />

            <button
              type="button"
              onClick={
                handleUpload
              }
              disabled={
                uploading ||
                !file
              }
              className={`rounded-lg px-5 py-2.5 text-sm font-medium text-white ${
                uploading ||
                !file
                  ? "cursor-not-allowed bg-gray-400"
                  : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              {uploading
                ? "正在检查并导入..."
                : "上传并导入"}
            </button>
          </div>

          {file && (
            <div
              className="
                mt-3
                text-sm
                text-gray-500
              "
            >
              已选择：
              <span
                className="
                  ml-1
                  font-medium
                  text-gray-700
                "
              >
                {file.name}
              </span>
            </div>
          )}

          {message &&
            unresolvedAccounts.length ===
              0 && (
              <div
                className="
                  mt-4
                  rounded-lg
                  bg-green-50
                  px-4
                  py-3
                  text-sm
                  text-green-700
                "
              >
                {message}
              </div>
            )}

          {error && (
            <div
              className="
                mt-4
                rounded-lg
                bg-red-50
                px-4
                py-3
                text-sm
                text-red-700
              "
            >
              {error}
            </div>
          )}
        </div>

        {/* =================================================
            未确认账户
        ================================================= */}

        {unresolvedAccounts.length >
          0 && (
          <div
            className="
              mb-6
              overflow-hidden
              rounded-xl
              border
              border-orange-200
              bg-white
            "
          >
            <div
              className="
                border-b
                border-orange-200
                bg-orange-50
                px-5
                py-4
              "
            >
              <div
                className="
                  flex
                  flex-wrap
                  items-center
                  justify-between
                  gap-3
                "
              >
                <div>
                  <div
                    className="
                      text-base
                      font-semibold
                      text-orange-800
                    "
                  >
                    ⚠️ 发现尚未确认的账户名称
                  </div>

                  <div
                    className="
                      mt-1
                      text-sm
                      text-orange-700
                    "
                  >
                    本次 Excel 暂未导入。请先完成账户名称对应，然后重新上传。
                  </div>
                </div>

                <Link
                  href="/expense-account-mappings"
                  className="
                    inline-flex
                    items-center
                    gap-2
                    rounded-lg
                    bg-orange-600
                    px-4
                    py-2
                    text-sm
                    font-medium
                    text-white
                    hover:bg-orange-700
                  "
                >
                  🔗 去账户名称映射
                </Link>
              </div>
            </div>

            <div className="divide-y">
              {unresolvedAccounts.map(
                account => (
                  <div
                    key={
                      account.source_name
                    }
                    className="
                      flex
                      flex-wrap
                      items-center
                      justify-between
                      gap-4
                      px-5
                      py-4
                    "
                  >
                    <div className="min-w-[220px]">
                      <div
                        className="
                          text-xs
                          text-gray-500
                        "
                      >
                        Excel 原始账户
                      </div>

                      <div
                        className="
                          mt-1
                          font-semibold
                          text-gray-900
                        "
                      >
                        {account.source_name}
                      </div>

                      {account.account_type && (
                        <div
                          className="
                            mt-1
                            text-xs
                            text-gray-500
                          "
                        >
                          资金类型：
                          {account.account_type}
                        </div>
                      )}
                    </div>

                    <div
                      className="
                        text-xl
                        text-gray-400
                      "
                    >
                      →
                    </div>

                    <div
                      className="
                        min-w-[220px]
                        flex-1
                      "
                    >
                      <div
                        className="
                          text-xs
                          text-gray-500
                        "
                      >
                        标准账户名称
                      </div>

                      {account.standard_name ? (
                        <div
                          className="
                            mt-1
                            font-medium
                            text-gray-700
                          "
                        >
                          {account.standard_name}
                        </div>
                      ) : (
                        <div
                          className="
                            mt-1
                            text-sm
                            text-orange-600
                          "
                        >
                          尚未设置
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
                      {account.confirmed ? (
                        <span
                          className="
                            inline-flex
                            rounded-full
                            bg-yellow-100
                            px-3
                            py-1
                            text-xs
                            font-medium
                            text-yellow-700
                          "
                        >
                          ⚠️ 未完成标准名称
                        </span>
                      ) : (
                        <span
                          className="
                            inline-flex
                            rounded-full
                            bg-red-100
                            px-3
                            py-1
                            text-xs
                            font-medium
                            text-red-700
                          "
                        >
                          ❌ 未确认
                        </span>
                      )}
                    </div>
                  </div>
                )
              )}
            </div>

            <div
              className="
                border-t
                border-orange-200
                bg-gray-50
                px-5
                py-4
                text-sm
                text-gray-600
              "
            >
              例如：
              <span
                className="
                  mx-1
                  font-medium
                  text-gray-900
                "
              >
                上行信用卡
              </span>
              →
              <span
                className="
                  mx-1
                  font-medium
                  text-blue-600
                "
              >
                上海银行信用卡
              </span>
              。
              确认后重新上传 Excel，系统才会正式写入消费流水。
            </div>
          </div>
        )}

        {/* =================================================
            消费统计
        ================================================= */}

        <div
          className="
            mb-6
            overflow-hidden
            rounded-xl
            border
            bg-white
          "
        >
          {/* 标题 */}

          <div
            className="
              flex
              flex-wrap
              items-center
              justify-between
              gap-3
              border-b
              px-5
              py-4
            "
          >
            <div>
              <div className="font-semibold">
                消费统计
              </div>

              <div
                className="
                  mt-1
                  text-xs
                  text-gray-500
                "
              >
                按月、按年使用完全相同的「xx + 其他」消费归类规则
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowStatistics(
                  value => !value
                )
              }
              className="
                rounded-lg
                border
                border-gray-300
                bg-white
                px-4
                py-2
                text-sm
                font-medium
                text-gray-700
                hover:bg-gray-50
              "
            >
              {showStatistics
                ? "隐藏统计"
                : "显示统计"}

              <span className="ml-2">
                {showStatistics
                  ? "▲"
                  : "▼"}
              </span>
            </button>
          </div>

          {showStatistics && (
            <div>
              {/* =================================================
                  模式切换
              ================================================= */}

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
                    flex-wrap
                    items-center
                    gap-3
                  "
                >
                  <button
                    type="button"
                    onClick={() =>
                      changeStatisticsMode(
                        "month"
                      )
                    }
                    className={`rounded-lg px-4 py-2 text-sm font-medium ${
                      statisticsMode ===
                      "month"
                        ? "bg-blue-600 text-white"
                        : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    按月统计
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      changeStatisticsMode(
                        "year"
                      )
                    }
                    className={`rounded-lg px-4 py-2 text-sm font-medium ${
                      statisticsMode ===
                      "year"
                        ? "bg-blue-600 text-white"
                        : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    按年统计
                  </button>

                  {/* 月份选择 */}

                  {statisticsMode ===
                    "month" && (
                    <>
                      <select
                        value={
                          selectedMonthYear ??
                          ""
                        }
                        onChange={event => {
                          const year =
                            Number(
                              event.target.value
                            );

                          setSelectedMonthYear(
                            year
                          );

                          setSelectedYear(
                            year
                          );
                        }}
                        className="
                          rounded-lg
                          border
                          border-gray-300
                          bg-white
                          px-3
                          py-2
                          text-sm
                          text-gray-700
                        "
                      >
                        {availableYears.length ===
                        0 ? (
                          <option value="">
                            暂无年份
                          </option>
                        ) : (
                          availableYears.map(
                            year => (
                              <option
                                key={year}
                                value={year}
                              >
                                {year}年
                              </option>
                            )
                          )
                        )}
                      </select>

                      <select
                        value={
                          selectedMonth ??
                          ""
                        }
                        onChange={event =>
                          setSelectedMonth(
                            Number(
                              event.target.value
                            )
                          )
                        }
                        className="
                          rounded-lg
                          border
                          border-gray-300
                          bg-white
                          px-3
                          py-2
                          text-sm
                          text-gray-700
                        "
                      >
                        {availableMonths.length ===
                        0 ? (
                          <option value="">
                            暂无月份
                          </option>
                        ) : (
                          availableMonths.map(
                            month => (
                              <option
                                key={month}
                                value={month}
                              >
                                {month}月
                              </option>
                            )
                          )
                        )}
                      </select>
                    </>
                  )}

                  {/* 年份选择 */}

                  {statisticsMode ===
                    "year" && (
                    <select
                      value={
                        selectedYear ??
                        ""
                      }
                      onChange={event => {
                        const year =
                          Number(
                            event.target.value
                          );

                        setSelectedYear(
                          year
                        );

                        setExpandedBooks(
                          new Set()
                        );
                      }}
                      className="
                        rounded-lg
                        border
                        border-gray-300
                        bg-white
                        px-3
                        py-2
                        text-sm
                        text-gray-700
                      "
                    >
                      {availableYears.length ===
                      0 ? (
                        <option value="">
                          暂无年份
                        </option>
                      ) : (
                        availableYears.map(
                          year => (
                            <option
                              key={year}
                              value={year}
                            >
                              {year}年
                            </option>
                          )
                        )
                      )}
                    </select>
                  )}
                </div>
              </div>

              {/* =================================================
                  按月
              ================================================= */}

              {statisticsMode ===
                "month" && (
                <>
                  {/* 月度总览 */}

                  <div
                    className="
                      border-b
                      px-5
                      py-4
                    "
                  >
                    <div
                      className="
                        flex
                        flex-wrap
                        items-end
                        justify-between
                        gap-4
                      "
                    >
                      <div>
                        <div
                          className="
                            text-xs
                            text-gray-500
                          "
                        >
                          选择月份消费
                        </div>

                        <div
                          className="
                            mt-1
                            text-2xl
                            font-bold
                          "
                        >
                          {loading
                            ? "-"
                            : formatMoney(
                                monthlyBookGroups.xx.amount +
                                  monthlyBookGroups.其他.amount
                              )}
                        </div>
                      </div>

                      <div
                        className="
                          text-right
                          text-xs
                          text-gray-500
                        "
                      >
                        {selectedMonthYear ?? "-"}
                        年
                        {selectedMonth ?? "-"}
                        月
                      </div>
                    </div>
                  </div>

                  {/* =================================================
                      月度 xx / 其他明细

                      与年度统计保持完全相同的层级结构：

                      xx
                        → 分类

                      其他
                        → 账簿
                          → 分类
                  ================================================= */}

                  <div className="divide-y">
                    {([
                      "xx",
                      "其他",
                    ] as const).map(group => {
                      const groupData =
                        monthlyBookGroups[group];

                      const expanded =
                        expandedBooks.has(
                          `monthly-${group}`
                        );

                      const categories =
                        Array.from(
                          groupData.categories.entries()
                        ).sort(
                          (a, b) => b[1] - a[1]
                        );

                      const books =
                        Array.from(
                          groupData.books.entries()
                        ).sort(
                          (a, b) => b[1] - a[1]
                        );

                      return (
                        <div key={group}>
                          {/* 第一层：xx / 其他 */}

                          <button
                            type="button"
                            onClick={() =>
                              toggleBook(
                                `monthly-${group}`
                              )
                            }
                            className="
                              flex
                              w-full
                              items-center
                              justify-start
                              gap-3
                              px-5
                              py-4
                              text-left
                              hover:bg-gray-50
                            "
                          >
                            <div
                              className="
                                flex
                                min-w-0
                                items-center
                                gap-3
                              "
                            >
                              <span
                                className="
                                  w-4
                                  shrink-0
                                  text-sm
                                  text-gray-500
                                "
                              >
                                {expanded ? "▼" : "▶"}
                              </span>

                              <span className="font-semibold">
                                {group}
                              </span>

                              {group === "其他" &&
                                books.length > 0 && (
                                  <span
                                    className="
                                      text-xs
                                      text-gray-400
                                    "
                                  >
                                    {books.length} 个账本
                                  </span>
                                )}
                            </div>

                            <span
                              className="
                                shrink-0
                                font-semibold
                              "
                            >
                              {formatMoney(
                                groupData.amount
                              )}
                            </span>
                          </button>

                          {expanded && (
                            <div
                              className="
                                border-t
                                bg-gray-50
                              "
                            >
                              {/* xx：展开后直接显示分类 */}

                              {group === "xx" && (
                                <div className="px-5 py-4">
                                  <div
                                    className="
                                      mb-3
                                      text-xs
                                      font-medium
                                      text-gray-500
                                    "
                                  >
                                    xx 消费分类构成
                                  </div>

                                  {categories.length === 0 ? (
                                    <div
                                      className="
                                        text-sm
                                        text-gray-400
                                      "
                                    >
                                      暂无消费
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      {categories.map(
                                        ([category, amount]) => (
                                          <div
                                            key={category}
                                            className="
                                              flex
                                              items-center
                                              justify-start
                                              gap-3
                                              rounded-lg
                                              bg-white
                                              px-4
                                              py-3
                                            "
                                          >
                                            <span
                                              className="
                                                text-sm
                                                text-gray-600
                                              "
                                            >
                                              {category}
                                            </span>

                                            <span
                                              className="
                                                text-sm
                                                font-medium
                                              "
                                            >
                                              {formatMoney(amount)}
                                            </span>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* 其他：展开后只显示账簿 */}

                              {group === "其他" && (
                                <div className="divide-y">
                                  {books.length === 0 ? (
                                    <div
                                      className="
                                        px-5
                                        py-6
                                        text-sm
                                        text-gray-400
                                      "
                                    >
                                      暂无消费
                                    </div>
                                  ) : (
                                    books.map(
                                      ([bookName, bookAmount]) => {
                                        const bookKey =
                                          `monthly-other-book-${bookName}`;

                                        const bookExpanded =
                                          expandedBooks.has(
                                            bookKey
                                          );

                                        const bookCategoryMap =
                                          groupData.bookCategories.get(
                                            bookName
                                          ) ?? new Map<string, number>();

                                        const bookCategories =
                                          Array.from(
                                            bookCategoryMap.entries()
                                          ).sort(
                                            (a, b) => b[1] - a[1]
                                          );

                                        return (
                                          <div key={bookName}>
                                            {/* 第二层：具体账簿 */}

                                            <button
                                              type="button"
                                              onClick={() =>
                                                toggleBook(bookKey)
                                              }
                                              className="
                                                flex
                                                w-full
                                                items-center
                                                justify-start
                                                gap-3
                                                px-5
                                                py-3.5
                                                pl-10
                                                text-left
                                                hover:bg-white
                                              "
                                            >
                                              <div
                                                className="
                                                  flex
                                                  min-w-0
                                                  items-center
                                                  gap-3
                                                "
                                              >
                                                <span
                                                  className="
                                                    w-4
                                                    shrink-0
                                                    text-sm
                                                    text-gray-500
                                                  "
                                                >
                                                  {bookExpanded
                                                    ? "▼"
                                                    : "▶"}
                                                </span>

                                                <span
                                                  className="
                                                    text-sm
                                                    font-medium
                                                    text-gray-700
                                                  "
                                                >
                                                  {bookName}
                                                </span>
                                              </div>

                                              <span
                                                className="
                                                  shrink-0
                                                  text-sm
                                                  font-semibold
                                                  text-gray-700
                                                "
                                              >
                                                {formatMoney(
                                                  bookAmount
                                                )}
                                              </span>
                                            </button>

                                            {/* 第三层：账簿分类 */}

                                            {bookExpanded && (
                                              <div
                                                className="
                                                  border-t
                                                  bg-white
                                                  px-5
                                                  py-3
                                                  pl-10
                                                "
                                              >
                                                {bookCategories.length === 0 ? (
                                                  <div
                                                    className="
                                                      text-sm
                                                      text-gray-400
                                                    "
                                                  >
                                                    暂无分类消费
                                                  </div>
                                                ) : (
                                                  <div className="space-y-2">
                                                    {bookCategories.map(
                                                      ([
                                                        category,
                                                        amount,
                                                      ]) => (
                                                        <div
                                                          key={category}
                                                          className="
                                                            flex
                                                            items-center
                                                            justify-start
                                                            gap-3
                                                            rounded-lg
                                                            bg-gray-50
                                                            px-4
                                                            py-2.5
                                                          "
                                                        >
                                                          <span
                                                            className="
                                                              text-sm
                                                              text-gray-600
                                                            "
                                                          >
                                                            {category}
                                                          </span>

                                                          <span
                                                            className="
                                                              text-sm
                                                              font-medium
                                                              text-gray-700
                                                            "
                                                          >
                                                            {formatMoney(
                                                              amount
                                                            )}
                                                          </span>
                                                        </div>
                                                      )
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      }
                                    )
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* =================================================
                  按年
              ================================================= */}

              {statisticsMode ===
                "year" && (
                <>
                  {/* 年度总览 */}

                  <div
                    className="
                      border-b
                      px-5
                      py-5
                    "
                  >
                    <div
                      className="
                        mb-4
                        text-lg
                        font-semibold
                      "
                    >
                      {selectedYear ??
                        "-"}
                      年消费
                    </div>

                    <div
                      className="
                        grid
                        grid-cols-1
                        gap-4
                        md:grid-cols-3
                      "
                    >
                      <div
                        className="
                          rounded-lg
                          border
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
                          年度总额度
                        </div>

                        <div
                          className="
                            mt-1
                            text-xl
                            font-bold
                          "
                        >
                          {formatMoney(
                            annualTotalBudget
                          )}
                        </div>
                      </div>

                      <div
                        className="
                          rounded-lg
                          border
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
                          实际消费
                        </div>

                        <div
                          className="
                            mt-1
                            text-xl
                            font-bold
                          "
                        >
                          {formatMoney(
                            annualTotalActual
                          )}
                        </div>
                      </div>

                      <div
                        className={`rounded-lg border p-4 ${
                          annualTotalGap >=
                          0
                            ? "bg-green-50"
                            : "bg-red-50"
                        }`}
                      >
                        <div
                          className="
                            text-xs
                            text-gray-500
                          "
                        >
                          {annualTotalGap >=
                          0
                            ? "剩余额度"
                            : "超出额度"}
                        </div>

                        <div
                          className={`mt-1 text-xl font-bold ${
                            annualTotalGap >=
                            0
                              ? "text-green-700"
                              : "text-red-700"
                          }`}
                        >
                          {formatMoney(
                            Math.abs(
                              annualTotalGap
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* =================================================
                      年度额度表
                  ================================================= */}

                  <div
                    className="
                      overflow-x-auto
                    "
                  >
                    <table
                      className="
                        w-full
                        min-w-[850px]
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
                          <th className="px-5 py-3 text-left">
                            账簿
                          </th>

                          <th className="px-5 py-3 text-right">
                            年度额度
                          </th>

                          <th className="px-5 py-3 text-right">
                            实际消费
                          </th>

                          <th className="px-5 py-3 text-right">
                            差额
                          </th>

                          <th className="px-5 py-3 text-center">
                            状态
                          </th>
                        </tr>
                      </thead>

                      <tbody className="divide-y">
                        {/* =================================================
                            xx
                        ================================================= */}

                        <tr className="hover:bg-gray-50">
                          <td
                            className="
                              px-5
                              py-4
                              font-semibold
                            "
                          >
                            xx
                          </td>

                          <td
                            className="
                              px-5
                              py-4
                              text-right
                            "
                          >
                            <input
                              key={`xx-${selectedYear}-${annualXXBudget}`}
                              type="number"
                              min="0"
                              step="1"
                              defaultValue={
                                annualXXBudget ||
                                ""
                              }
                              onBlur={event =>
                                saveBudget(
                                  "xx",
                                  event.target.value
                                )
                              }
                              className="
                                w-32
                                rounded-lg
                                border
                                border-gray-300
                                px-3
                                py-2
                                text-right
                                outline-none
                                focus:border-blue-500
                                focus:ring-1
                                focus:ring-blue-500
                              "
                              placeholder="填写额度"
                            />

                            {budgetSaving ===
                              "xx" && (
                              <span
                                className="
                                  ml-2
                                  text-xs
                                  text-gray-400
                                "
                              >
                                保存中...
                              </span>
                            )}
                          </td>

                          <td
                            className="
                              px-5
                              py-4
                              text-right
                              font-medium
                            "
                          >
                            {formatMoney(
                              annualXXActual
                            )}
                          </td>

                          <td
                            className={`px-5 py-4 text-right font-semibold ${
                              annualXXGap >=
                              0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {annualXXGap >=
                            0
                              ? formatMoney(
                                  annualXXGap
                                )
                              : `超出 ${formatMoney(
                                  Math.abs(
                                    annualXXGap
                                  )
                                )}`}
                          </td>

                          <td className="px-5 py-4 text-center">
                            {annualXXGap >=
                            0 ? (
                              <span
                                className="
                                  rounded-full
                                  bg-green-100
                                  px-3
                                  py-1
                                  text-xs
                                  font-medium
                                  text-green-700
                                "
                              >
                                正常
                              </span>
                            ) : (
                              <span
                                className="
                                  rounded-full
                                  bg-red-100
                                  px-3
                                  py-1
                                  text-xs
                                  font-medium
                                  text-red-700
                                "
                              >
                                超预算
                              </span>
                            )}
                          </td>
                        </tr>

                        {/* =================================================
                            其他
                        ================================================= */}

                        <tr className="hover:bg-gray-50">
                          <td
                            className="
                              px-5
                              py-4
                              font-semibold
                            "
                          >
                            其他
                          </td>

                          <td
                            className="
                              px-5
                              py-4
                              text-right
                            "
                          >
                            <input
                              key={`other-${selectedYear}-${annualOtherBudget}`}
                              type="number"
                              min="0"
                              step="1"
                              defaultValue={
                                annualOtherBudget ||
                                ""
                              }
                              onBlur={event =>
                                saveBudget(
                                  "其他",
                                  event.target.value
                                )
                              }
                              className="
                                w-32
                                rounded-lg
                                border
                                border-gray-300
                                px-3
                                py-2
                                text-right
                                outline-none
                                focus:border-blue-500
                                focus:ring-1
                                focus:ring-blue-500
                              "
                              placeholder="填写额度"
                            />

                            {budgetSaving ===
                              "其他" && (
                              <span
                                className="
                                  ml-2
                                  text-xs
                                  text-gray-400
                                "
                              >
                                保存中...
                              </span>
                            )}
                          </td>

                          <td
                            className="
                              px-5
                              py-4
                              text-right
                              font-medium
                            "
                          >
                            {formatMoney(
                              annualOtherActual
                            )}
                          </td>

                          <td
                            className={`px-5 py-4 text-right font-semibold ${
                              annualOtherGap >=
                              0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {annualOtherGap >=
                            0
                              ? formatMoney(
                                  annualOtherGap
                                )
                              : `超出 ${formatMoney(
                                  Math.abs(
                                    annualOtherGap
                                  )
                                )}`}
                          </td>

                          <td className="px-5 py-4 text-center">
                            {annualOtherGap >=
                            0 ? (
                              <span
                                className="
                                  rounded-full
                                  bg-green-100
                                  px-3
                                  py-1
                                  text-xs
                                  font-medium
                                  text-green-700
                                "
                              >
                                正常
                              </span>
                            ) : (
                              <span
                                className="
                                  rounded-full
                                  bg-red-100
                                  px-3
                                  py-1
                                  text-xs
                                  font-medium
                                  text-red-700
                                "
                              >
                                超预算
                              </span>
                            )}
                          </td>
                        </tr>

                        {/* =================================================
                            合计
                        ================================================= */}

                        <tr className="bg-gray-50">
                          <td
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
                              annualTotalBudget
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
                              annualTotalActual
                            )}
                          </td>

                          <td
                            className={`px-5 py-4 text-right font-bold ${
                              annualTotalGap >=
                              0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {annualTotalGap >=
                            0
                              ? formatMoney(
                                  annualTotalGap
                                )
                              : `超出 ${formatMoney(
                                  Math.abs(
                                    annualTotalGap
                                  )
                                )}`}
                          </td>

                          <td className="px-5 py-4 text-center">
                            {annualTotalGap >=
                            0 ? (
                              <span
                                className="
                                  rounded-full
                                  bg-green-100
                                  px-3
                                  py-1
                                  text-xs
                                  font-medium
                                  text-green-700
                                "
                              >
                                正常
                              </span>
                            ) : (
                              <span
                                className="
                                  rounded-full
                                  bg-red-100
                                  px-3
                                  py-1
                                  text-xs
                                  font-medium
                                  text-red-700
                                "
                              >
                                超预算
                              </span>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* =================================================
                      年度额度错误
                  ================================================= */}

                  {budgetError && (
                    <div
                      className="
                        border-t
                        bg-red-50
                        px-5
                        py-3
                        text-sm
                        text-red-700
                      "
                    >
                      年度额度：
                      {budgetError}
                    </div>
                  )}

                  {budgetLoading && (
                    <div
                      className="
                        border-t
                        px-5
                        py-3
                        text-xs
                        text-gray-400
                      "
                    >
                      正在加载{" "}
                      {selectedYear} 年度额度...
                    </div>
                  )}

                  {/* =================================================
                      年度账簿明细
                      
                      ★ 这里是本次核心修改
                      
                      xx：
                        ▼ xx
                            餐饮
                            购物
                            ...
                      
                      其他：
                        ▼ 其他
                            ▶ 日常账本
                            ▶ 家庭账本
                            ▶ 旅游账本
                      
                      再点日常账本：
                      
                        ▼ 日常账本
                            餐饮
                            交通
                            购物
                      
                  ================================================= */}

                  <div
                    className="
                      border-t
                      divide-y
                    "
                  >
                    {(
                      [
                        "xx",
                        "其他",
                      ] as const
                    ).map(
                      group => {
                        const expanded =
                          expandedBooks.has(
                            `annual-${group}`
                          );

                        const groupData =
                          annualBookGroups[
                            group
                          ];

                        const categories =
                          Array.from(
                            groupData.categories.entries()
                          ).sort(
                            (
                              a,
                              b
                            ) =>
                              b[1] -
                              a[1]
                          );

                        const books =
                          Array.from(
                            groupData.books.entries()
                          ).sort(
                            (
                              a,
                              b
                            ) =>
                              b[1] -
                              a[1]
                          );

                        return (
                          <div
                            key={group}
                          >
                            {/* -----------------------------------------
                                第一层：xx / 其他
                            ----------------------------------------- */}

                            <button
                              type="button"
                              onClick={() =>
                                toggleBook(
                                  `annual-${group}`
                                )
                              }
                              className="
                                flex
                                w-full
                                items-center
                                justify-start
                                gap-3
                                px-5
                                py-4
                                text-left
                                hover:bg-gray-50
                              "
                            >
                              <div
                                className="
                                  flex
                                  items-center
                                  gap-3
                                "
                              >
                                <span
                                  className="
                                    w-4
                                    text-sm
                                    text-gray-500
                                  "
                                >
                                  {expanded
                                    ? "▼"
                                    : "▶"}
                                </span>

                                <span
                                  className="
                                    font-semibold
                                  "
                                >
                                  {group}
                                </span>

                                {group ===
                                  "其他" &&
                                  books.length >
                                    0 && (
                                    <span
                                      className="
                                        text-xs
                                        text-gray-400
                                      "
                                    >
                                      {books.length} 个账本
                                    </span>
                                  )}
                              </div>

                              <span
                                className="
                                  font-semibold
                                "
                              >
                                {formatMoney(
                                  groupData.amount
                                )}
                              </span>
                            </button>

                            {expanded && (
                              <div
                                className="
                                  border-t
                                  bg-gray-50
                                "
                              >
                                {/* =================================================
                                    xx

                                    xx 本身只有一个账簿，
                                    所以展开后直接显示分类
                                ================================================= */}

                                {group ===
                                  "xx" && (
                                  <div className="px-5 py-4">
                                    <div
                                      className="
                                        mb-3
                                        text-xs
                                        font-medium
                                        text-gray-500
                                      "
                                    >
                                      xx 消费分类构成
                                    </div>

                                    {categories.length ===
                                    0 ? (
                                      <div
                                        className="
                                          text-sm
                                          text-gray-400
                                        "
                                      >
                                        暂无消费
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        {categories.map(
                                          ([
                                            category,
                                            amount,
                                          ]) => (
                                            <div
                                              key={
                                                category
                                              }
                                              className="
                                                flex
                                                items-center
                                                justify-start
                                                gap-3
                                                rounded-lg
                                                bg-white
                                                px-4
                                                py-3
                                              "
                                            >
                                              <span
                                                className="
                                                  text-sm
                                                  text-gray-600
                                                "
                                              >
                                                {
                                                  category
                                                }
                                              </span>

                                              <span
                                                className="
                                                  text-sm
                                                  font-medium
                                                "
                                              >
                                                {formatMoney(
                                                  amount
                                                )}
                                              </span>
                                            </div>
                                          )
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* =================================================
                                    其他

                                    ★ 第一层展开：
                                      只显示账簿

                                    不再把所有分类直接混在一起。
                                    
                                    每个账簿都可以继续点击展开。
                                ================================================= */}

                                {group ===
                                  "其他" && (
                                  <div className="divide-y">
                                    {books.length ===
                                    0 ? (
                                      <div
                                        className="
                                          px-5
                                          py-6
                                          text-sm
                                          text-gray-400
                                        "
                                      >
                                        暂无消费
                                      </div>
                                    ) : (
                                      books.map(
                                        ([
                                          bookName,
                                          bookAmount,
                                        ]) => {
                                          const bookKey =
                                            `annual-other-book-${bookName}`;

                                          const bookExpanded =
                                            expandedBooks.has(
                                              bookKey
                                            );

                                          const bookCategoryMap =
                                            groupData.bookCategories.get(
                                              bookName
                                            ) ??
                                            new Map<
                                              string,
                                              number
                                            >();

                                          const bookCategories =
                                            Array.from(
                                              bookCategoryMap.entries()
                                            ).sort(
                                              (
                                                a,
                                                b
                                              ) =>
                                                b[1] -
                                                a[1]
                                            );

                                          return (
                                            <div
                                              key={
                                                bookName
                                              }
                                            >
                                              {/* -----------------------------------------
                                                  第二层：具体账簿
                                              ----------------------------------------- */}

                                              <button
                                                type="button"
                                                onClick={() =>
                                                  toggleBook(
                                                    bookKey
                                                  )
                                                }
                                                className="
                                                  flex
                                                  w-full
                                                  items-center
                                                  justify-start
                                                  gap-3
                                                  px-5
                                                  py-3.5
                                                  pl-10
                                                  text-left
                                                  hover:bg-white
                                                "
                                              >
                                                <div
                                                  className="
                                                    flex
                                                    min-w-0
                                                    items-center
                                                    gap-3
                                                  "
                                                >
                                                  <span
                                                    className="
                                                      w-4
                                                      shrink-0
                                                      text-sm
                                                      text-gray-500
                                                    "
                                                  >
                                                    {bookExpanded
                                                      ? "▼"
                                                      : "▶"}
                                                  </span>

                                                  <span
                                                    className="
                                                      text-sm
                                                      font-medium
                                                      text-gray-700
                                                    "
                                                  >
                                                    {
                                                      bookName
                                                    }
                                                  </span>
                                                </div>

                                                <span
                                                  className="
                                                    shrink-0
                                                    text-sm
                                                    font-semibold
                                                    text-gray-700
                                                  "
                                                >
                                                  {formatMoney(
                                                    bookAmount
                                                  )}
                                                </span>
                                              </button>

                                              {/* -----------------------------------------
                                                  第三层：账簿分类
                                              ----------------------------------------- */}

                                              {bookExpanded && (
                                                <div
                                                  className="
                                                    border-t
                                                    bg-white
                                                    px-5
                                                    py-3
                                                    pl-10
                                                  "
                                                >
                                                  {bookCategories.length ===
                                                  0 ? (
                                                    <div
                                                      className="
                                                        text-sm
                                                        text-gray-400
                                                      "
                                                    >
                                                      暂无分类消费
                                                    </div>
                                                  ) : (
                                                    <div className="space-y-2">
                                                      {bookCategories.map(
                                                        ([
                                                          category,
                                                          amount,
                                                        ]) => (
                                                          <div
                                                            key={
                                                              category
                                                            }
                                                            className="
                                                              flex
                                                              items-center
                                                              justify-start
                                                              gap-3
                                                              rounded-lg
                                                              bg-gray-50
                                                              px-4
                                                              py-2.5
                                                            "
                                                          >
                                                            <span
                                                              className="
                                                                text-sm
                                                                text-gray-600
                                                              "
                                                            >
                                                              {
                                                                category
                                                              }
                                                            </span>

                                                            <span
                                                              className="
                                                                text-sm
                                                                font-medium
                                                                text-gray-700
                                                              "
                                                            >
                                                              {formatMoney(
                                                                amount
                                                              )}
                                                            </span>
                                                          </div>
                                                        )
                                                      )}
                                                    </div>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        }
                                      )
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* =================================================
            ★ xx / 其他详细数字
        ================================================= */}

        <div className="mb-6 overflow-hidden rounded-xl border bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
            <div>
              <div className="font-semibold">xx / 其他详细数字</div>
              <div className="mt-1 text-xs text-gray-500">
                按月仅显示今年；按年显示全部历史年份。与页面实际消费、AI 分析使用同一套统一消费统计结果
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {expenseDetailMode === "month" && (
                <select
                  value={
                    expenseDetailYear ??
                    ""
                  }
                  onChange={event => {
                    const value =
                      Number(event.target.value);

                    if (
                      Number.isInteger(value)
                    ) {
                      setExpenseDetailYear(
                        value
                      );
                    }
                  }}
                  className="rounded-lg border bg-white px-3 py-2 text-sm font-medium outline-none"
                >
                  {availableYears.length === 0 ? (
                    <option value="">
                      选择年份
                    </option>
                  ) : (
                    availableYears.map(year => (
                      <option
                        key={year}
                        value={year}
                      >
                        {year} 年
                      </option>
                    ))
                  )}
                </select>
              )}

              <div className="flex rounded-lg border bg-gray-50 p-1">
              <button
                type="button"
                onClick={() => setExpenseDetailMode("month")}
                className={`rounded-md px-4 py-1.5 text-sm ${
                  expenseDetailMode === "month"
                    ? "bg-white font-semibold shadow-sm"
                    : "text-gray-500"
                }`}
              >
                按月
              </button>
              <button
                type="button"
                onClick={() => setExpenseDetailMode("year")}
                className={`rounded-md px-4 py-1.5 text-sm ${
                  expenseDetailMode === "year"
                    ? "bg-white font-semibold shadow-sm"
                    : "text-gray-500"
                }`}
              >
                按年
              </button>
            </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b bg-gray-50">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold text-gray-600">
                    {expenseDetailMode === "month" ? "月份" : "年份"}
                  </th>
                  <th className="px-5 py-3 text-right font-semibold text-gray-600">xx</th>
                  <th className="px-5 py-3 text-right font-semibold text-gray-600">其他</th>
                  <th className="px-5 py-3 text-right font-semibold text-gray-600">合计</th>
                  <th className="px-5 py-3 text-right font-semibold text-gray-600">xx 占比</th>
                  <th className="px-5 py-3 text-right font-semibold text-gray-600">其他占比</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {expenseDetailRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-500">
                      暂无消费数据
                    </td>
                  </tr>
                ) : (
                  expenseDetailRows.map(row => {
                    const total = row.xx + row.other;
                    const xxRate = total > 0 ? (row.xx / total) * 100 : 0;
                    const otherRate = total > 0 ? (row.other / total) * 100 : 0;


                    return (
                      <tr key={row.period} className="hover:bg-gray-50">
                        <td className="px-5 py-3 font-medium">
                          {expenseDetailMode === "month" ? row.period : `${row.period} 年`}
                        </td>
                        <td className="px-5 py-3 text-right font-medium">{formatMoney(row.xx)}</td>
                        <td className="px-5 py-3 text-right font-medium">{formatMoney(row.other)}</td>
                        <td className="px-5 py-3 text-right font-semibold">{formatMoney(total)}</td>
                        <td className="px-5 py-3 text-right text-gray-600">{xxRate.toFixed(1)}%</td>
                        <td className="px-5 py-3 text-right text-gray-600">{otherRate.toFixed(1)}%</td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {expenseDetailRows.length > 0 && (
                <tfoot>
                  <tr className="border-t bg-gray-50">
                    <td className="px-5 py-3 font-bold">合计</td>
                    <td className="px-5 py-3 text-right font-bold">
                      {formatMoney(expenseDetailRows.reduce((sum, row) => sum + row.xx, 0))}
                    </td>
                    <td className="px-5 py-3 text-right font-bold">
                      {formatMoney(expenseDetailRows.reduce((sum, row) => sum + row.other, 0))}
                    </td>
                    <td className="px-5 py-3 text-right font-bold">
                      {formatMoney(expenseDetailRows.reduce((sum, row) => sum + row.xx + row.other, 0))}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-500">-</td>
                    <td className="px-5 py-3 text-right text-gray-500">-</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>


  {/* =================================================
    ★ 各账本月度消费
================================================= */}
<div className="rounded-xl border bg-white shadow-sm">
  <div className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4">
    <div>
      <div className="font-semibold">
        {yearlyBookMonthlyStats.year} 年各账本月度消费
      </div>

      <div className="mt-1 text-xs text-gray-500">
        行为月份，列为实际账本
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-gray-500">分析导出范围:</span>
      <select
        value={exportStartYear}
        onChange={e => setExportStartYear(Number(e.target.value))}
        className="rounded-lg border bg-white px-2 py-1.5 text-sm"
      >
        {availableYears.map(year => (
          <option key={year} value={year}>{year}年</option>
        ))}
      </select>
      <span className="text-xs text-gray-500">至</span>
      <select
        value={exportEndYear}
        onChange={e => setExportEndYear(Number(e.target.value))}
        className="rounded-lg border bg-white px-2 py-1.5 text-sm"
      >
        {availableYears.map(year => (
          <option key={year} value={year}>{year}年</option>
        ))}
      </select>

      <button
        type="button"
        onClick={handleExportExpenseAnalysisData}
        className="rounded-lg border bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        📊 导出消费分析
      </button>

      {/* 月度账本统计年份 */}
      <select
        value={bookMonthlyYear}
        onChange={e =>
          setBookMonthlyYear(Number(e.target.value))
        }
        className="rounded-lg border px-3 py-2 text-sm"
      >
        {availableYears.map(year => (
          <option key={year} value={year}>
            {year} 年
          </option>
        ))}
      </select>
    </div>
  </div>

  <div className="overflow-x-auto">
    <table className="w-full min-w-[900px] text-sm">
      <thead className="border-b bg-gray-50">
        <tr>
          <th className="sticky left-0 z-10 bg-gray-50 px-5 py-3 text-left font-semibold text-gray-600">
            月份
          </th>

          {yearlyBookMonthlyStats.books.map(book => (
            <th
              key={book}
              className="px-5 py-3 text-right font-semibold text-gray-600 whitespace-nowrap"
            >
              {book}
            </th>
          ))}

          <th className="px-5 py-3 text-right font-semibold text-gray-600 whitespace-nowrap">
            月合计
          </th>
        </tr>
      </thead>

      <tbody className="divide-y">
        {yearlyBookMonthlyStats.rows.map(row => (
          <tr
            key={row.month}
            className="hover:bg-gray-50"
          >
            <td className="sticky left-0 z-10 bg-white px-5 py-3 font-medium">
              {row.month}月
            </td>

            {yearlyBookMonthlyStats.books.map(book => (
              <td
                key={book}
                className="px-5 py-3 text-right font-medium whitespace-nowrap"
              >
                {formatMoney(
                  row.amounts[book] || 0
                )}
              </td>
            ))}

            <td className="px-5 py-3 text-right font-semibold whitespace-nowrap">
              {formatMoney(row.total)}
            </td>
          </tr>
        ))}
      </tbody>

      <tfoot>
        <tr className="border-t bg-gray-50">
          <td className="sticky left-0 z-10 bg-gray-50 px-5 py-3 font-bold">
            全年
          </td>

          {yearlyBookMonthlyStats.books.map(book => (
            <td
              key={book}
              className="px-5 py-3 text-right font-bold whitespace-nowrap"
            >
              {formatMoney(
                yearlyBookMonthlyStats.totals[book] || 0
              )}
            </td>
          ))}

          <td className="px-5 py-3 text-right font-bold whitespace-nowrap">
            {formatMoney(
              yearlyBookMonthlyStats.grandTotal
            )}
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</div>

{/* =================================================
            ★ 大消费清单与年度统计 (单笔 >= 2000)
        ================================================= */}
        <div className="mb-6 overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4">
            <div>
              <div className="font-semibold text-base">大消费清单与年度统计 (单笔 ¥2,000 及以上)</div>
              <div className="mt-1 text-xs text-gray-500">
                支持按年份和账本自由筛选，2000–4000元显示绿色，4000元以上显示红色
              </div>
            </div>

            {/* 年份与账本选择器 */}
            <div className="flex flex-wrap items-center gap-3">
              {/* 年份选择 */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">选择年份:</span>
                <select
                  value={largeExpenseYear}
                  onChange={e => setLargeExpenseYear(e.target.value)}
                  className="rounded-lg border bg-white px-3 py-1.5 text-sm font-medium"
                >
                  <option value="ALL">全部年份</option>
                  {availableYears.map(year => (
                    <option key={year} value={year}>
                      {year} 年
                    </option>
                  ))}
                </select>
              </div>

              {/* 账本选择 */}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500">选择账本:</span>
                <select
                  value={largeExpenseBook}
                  onChange={e => setLargeExpenseBook(e.target.value)}
                  className="rounded-lg border bg-white px-3 py-1.5 text-sm font-medium"
                >
                  <option value="ALL">全部账本</option>
                  {Array.from(new Set(transactions.map(item => getNormalizedBookName(item))))
                    .sort((a, b) => a.localeCompare(b, "zh-CN"))
                    .map(book => (
                      <option key={book} value={book}>
                        {book}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          {/* 年度大消费统计汇总卡片 */}
          <div className="border-b bg-gray-50 px-5 py-4">
            <div className="mb-3 text-xs font-semibold text-gray-600">📊 大消费统计与占比概览</div>
            {largeExpenseAnnualStats.length === 0 ? (
              <div className="text-sm text-gray-400">暂无大消费统计数据</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {largeExpenseAnnualStats.map(stat => (
                  <div key={stat.year} className="rounded-lg border bg-white p-3.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-800">{stat.year} 年</span>
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                        {stat.count} 笔大消费
                      </span>
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-xs text-gray-500">大消费总额:</span>
                      <span className="font-bold text-gray-900">{formatMoney(stat.largeTotal)}</span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-xs text-gray-500">占当年总消费:</span>
                      <span className="font-bold text-indigo-600">{stat.percentage.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 大消费明细表格 */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="border-b bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-5 py-3 text-left">时间 / 年份</th>
                  <th className="px-5 py-3 text-left">账本名称</th>
                  <th className="px-5 py-3 text-left">分类</th>
                  <th className="px-5 py-3 text-left">账户</th>
                  <th className="px-5 py-3 text-right">金额</th>
                  <th className="px-5 py-3 text-left">备注</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {largeExpenseTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">
                      暂无符合条件的大消费记录（单笔金额均低于 2,000 元或当前筛选条件无记录）
                    </td>
                  </tr>
                ) : (
                  largeExpenseTransactions.map(item => {
                    const amount = Math.abs(Number(item.amount || 0));
                    const isGreen = amount >= 2000 && amount < 4000;
                    const isRed = amount >= 4000;

                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-5 py-3 font-medium text-gray-700">
                          {formatDate(item.transaction_time)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3">
                          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                            {item.book_name || "-"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-600">{item.category || "-"}</td>
                        <td className="px-5 py-3 text-gray-600">{item.account_name || "-"}</td>
                        <td
                          className={`px-5 py-3 text-right font-bold ${
                            isGreen ? "text-green-600" : isRed ? "text-red-600" : "text-gray-900"
                          }`}
                        >
                          {formatMoney(amount)}
                          <span className="ml-1.5 text-xs font-normal">
                            {isGreen ? "(绿)" : isRed ? "(红)" : ""}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-gray-500">{item.remark || "-"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

{/* =================================================
            ★ 日常账本：跨年度分类金额对比表（行=年份，列=各项分类项目）
            [破框全屏变宽设计]
        ================================================= */}
        <div className="mb-6 overflow-hidden rounded-xl border bg-white shadow-sm lg:-mx-12 xl:-mx-24">
          <div className="border-b px-6 py-4">
            <div className="font-semibold text-base">📚 日常账本 - 各年度与消费项目矩阵对比</div>
            <div className="mt-1 text-xs text-gray-500">
              竖向显示年份，横向展开显示各项消费分类，小宝无真实流水时自动读取“小宝2.7万”账本（已解除全局宽度约束）
            </div>
          </div>

          <div className="overflow-x-auto">
            {/* 将最小宽度调得更宽，例如 1600px 或 1800px，确保横向展开时有足够的空间 */}
            <table className="w-full min-w-[1600px] text-sm">
              <thead className="border-b bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-6 py-3.5 text-left font-semibold">年份</th>
                  {dailyBookYearlyMatrix.categories.map(cat => (
                    <th key={cat} className="px-6 py-3.5 text-right font-semibold">
                      {cat}
                    </th>
                  ))}
                  <th className="px-6 py-3.5 text-right font-semibold text-blue-600">年 度 合 计</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {dailyBookYearlyMatrix.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={dailyBookYearlyMatrix.categories.length + 2}
                      className="px-6 py-12 text-center text-sm text-gray-400"
                    >
                      暂无“日常账本”的消费记录
                    </td>
                  </tr>
                ) : (
                  dailyBookYearlyMatrix.rows.map(row => (
                    <tr key={row.year} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-3.5 font-bold text-gray-800">
                        {row.year}年
                      </td>

                      {/* 循环渲染横向的各个分类项目金额 */}
                      {dailyBookYearlyMatrix.categories.map(cat => {
                        const val = row.amounts[cat] || 0;
                        return (
                          <td key={cat} className="px-6 py-3.5 text-right text-gray-600">
                            {val === 0 ? "0" : formatMoney(val)}
                          </td>
                        );
                      })}

                      {/* 年度总计 */}
                      <td className="px-6 py-3.5 text-right font-bold text-blue-600">
                        {formatMoney(row.yearTotal)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
{/* =================================================
            ★ 消费流水明细与多维筛选模块（采用大消费清单一致的格式）
        ================================================= */}
        <div className="mb-6 overflow-hidden rounded-xl border bg-white shadow-sm lg:-mx-12 xl:-mx-24">
          <div className="border-b px-6 py-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="font-semibold text-base">📋 消费流水明细与筛选</div>
                <div className="mt-1 text-xs text-gray-500">
                  支持按账本、年份、全年/单月、以及账本中的分类进行多维精准筛选
                </div>
              </div>

              {/* 多维筛选控制栏 */}
              <div className="flex flex-wrap items-center gap-3">
                {/* 1. 账本筛选 */}
                <select
                  value={expenseDetailBook || "ALL"}
                  onChange={e => setExpenseDetailBook(e.target.value)}
                  className="rounded-lg border px-3 py-1.5 text-sm bg-white"
                >
                  <option value="ALL">📚 全部账本</option>
                  {availableBooks.map(book => (
                    <option key={book} value={book}>
                      {book}
                    </option>
                  ))}
                </select>

                {/* 2. 年份选择 */}
                <select
                  value={expenseDetailYear || "ALL"}
                  onChange={e => setExpenseDetailYear(e.target.value)}
                  className="rounded-lg border px-3 py-1.5 text-sm bg-white"
                >
                  <option value="ALL">全部年份</option>
                  <option value="2026">2026年</option>
                  <option value="2025">2025年</option>
                </select>

                {/* 3. 月份选择（含“全年”） */}
                <select
                  value={expenseDetailMonth || "ALL"}
                  onChange={e => setExpenseDetailMonth(e.target.value)}
                  className="rounded-lg border px-3 py-1.5 text-sm bg-white"
                >
                  <option value="ALL">📅 全年统计</option>
                  <option value="01">1月</option>
                  <option value="02">2月</option>
                  <option value="03">3月</option>
                  <option value="04">4月</option>
                  <option value="05">5月</option>
                  <option value="06">6月</option>
                  <option value="07">7月</option>
                  <option value="08">8月</option>
                  <option value="09">9月</option>
                  <option value="10">10月</option>
                  <option value="11">11月</option>
                  <option value="12">12月</option>
                </select>

                {/* 4. 分类选择 */}
                <select
                  value={expenseDetailCategory || "ALL"}
                  onChange={e => setExpenseDetailCategory(e.target.value)}
                  className="rounded-lg border px-3 py-1.5 text-sm bg-white"
                >
                  <option value="ALL">🏷️ 全部分类</option>
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 表格区域（采用大消费清单一致的列结构与宽屏破框样式） */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1400px] text-sm border-collapse">
              <thead className="border-b bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-6 py-3.5 text-left font-semibold">交易时间 / 年份</th>
                  <th className="px-6 py-3.5 text-left font-semibold">账本名称</th>
                  <th className="px-6 py-3.5 text-left font-semibold">分类</th>
                  <th className="px-6 py-3.5 text-left font-semibold">账户</th>
                  <th className="px-6 py-3.5 text-right font-semibold">金额</th>
                  <th className="px-6 py-3.5 text-left font-semibold">备注</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {filteredExpenseDetails.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-gray-400">
                      没有找到符合条件的消费流水记录
                    </td>
                  </tr>
                ) : (
                  filteredExpenseDetails.map((item, index) => {
                    const amount = Math.abs(Number(item.amount || 0));
                    const isGreen = amount >= 2000 && amount < 4000;
                    const isRed = amount >= 4000;

                    return (
                      <tr key={item.id || index} className="hover:bg-gray-50">
                        {/* 1. 交易时间 / 年份 */}
                        <td className="whitespace-nowrap px-6 py-3.5 font-medium text-gray-700">
                          {formatDate(item.transaction_time || item.date || "-")}
                        </td>

                        {/* 2. 账本名称 */}
                        <td className="whitespace-nowrap px-6 py-3.5">
                          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                            {item.bookName || item.book_name || "-"}
                          </span>
                        </td>

                        {/* 3. 分类 */}
                        <td className="px-6 py-3.5 text-gray-800 font-medium">
                          {item.category || "-"}
                        </td>

                        {/* 4. 账户 */}
                        <td className="px-6 py-3.5 text-gray-600">
                          {item.account_name || "-"}
                        </td>

                        {/* 5. 金额（支持与大消费清单一致的高亮或常规展示） */}
                        <td className="px-6 py-3.5 text-right font-bold text-gray-900">
                          {formatMoney(amount)}
                        </td>

                        {/* 6. 备注 */}
                        <td className="px-6 py-3.5 text-gray-500">
                          {item.remark || "-"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>


        {/* =================================================
            ★ AI 消费分析
        ================================================= */}

        <div className="mb-6">
          <ExpenseAIAnalysis
            years={aiExpenseYears}
            transactions={transactions}
          />
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
              mb-1
              font-medium
              text-gray-700
            "
          >
            数据说明
          </div>

          <div>
            ① Excel 来源：有鱼「收入支出」Sheet。
          </div>

          <div>
            ② 上传前系统会检查「资金账户名称」是否已经完成标准名称对应。
          </div>

          <div>
            ③ 如果发现未确认账户，本次 Excel 不会写入数据库，需要先完成账户名称映射。
          </div>

          <div>
            ④ 系统根据「资金类型」自动识别信用卡。
          </div>

          <div>
            ⑤ 明确包含「平账 / 平帐」的流水自动标记为平账。
          </div>

          <div>
            ⑥ 相同交易 Hash 自动去重，重复上传 Excel 不会重复计算。
          </div>

          <div>
            ⑦ 消费统计按支出计算，不计入平账及替别人提前付。
          </div>

          <div>
            ⑧ 消费统计统一排除：平账、法24.6、法国出差、借出款、年金、理财、替别人先付。
          </div>

          <div>
            ⑨ 账簿名称 = "xx" → xx；日常账本 + 修行 → xx；日常账本其他分类 → 其他 / 日常账本。
          </div>

          <div>
            ⑩ 其他实际消费 = 所有符合消费统计条件、且不属于 xx 的消费。
          </div>

          <div>
            ⑪ 年度额度按照「xx」和「其他」分别保存。
          </div>

          <div>
            ⑫ 「其他」展开后，可以继续展开具体账簿，再查看该账簿下面的消费分类。
          </div>

          <div>
            ⑬ 页面年度统计与 AI 消费分析使用同一份统一消费统计结果，避免页面数字与 AI 数字不一致。
          </div>

          <div>
            ⑭ 最近流水只显示最新100笔，但年度统计与 AI 使用全部已读取的消费流水。
          </div>
        </div>

        {/* =================================================
            未确认账户底部提示
        ================================================= */}

        {unresolvedAccounts.length >
          0 && (
          <div
            className="
              mt-5
              flex
              flex-wrap
              items-center
              justify-between
              gap-3
              rounded-xl
              border
              border-blue-200
              bg-blue-50
              px-5
              py-4
            "
          >
            <div>
              <div
                className="
                  font-medium
                  text-blue-800
                "
              >
                完成账户映射后，请重新上传刚才的 Excel。
              </div>

              <div
                className="
                  mt-1
                  text-xs
                  text-blue-600
                "
              >
                系统不会保存本次未确认的 Excel 流水。
              </div>
            </div>

            <Link
              href="/expense-account-mappings"
              className="
                rounded-lg
                bg-blue-600
                px-4
                py-2
                text-sm
                font-medium
                text-white
                hover:bg-blue-700
              "
            >
              管理账户映射
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
