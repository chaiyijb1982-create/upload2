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
      const currentYear =
        new Date().getFullYear();

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
            ★ AI 消费分析
        ================================================= */}

        <div className="mb-6">
          <ExpenseAIAnalysis
            years={aiExpenseYears}
          />
        </div>

        {/* =================================================
            最近流水
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
              border-b
              px-5
              py-4
            "
          >
            <div className="font-semibold">
              最近消费流水
            </div>

            <div
              className="
                mt-1
                text-xs
                text-gray-500
              "
            >
              最新 100 笔
            </div>
          </div>

          <div
            className="
              overflow-x-auto
            "
          >
            <table
              className="
                w-full
                min-w-[1200px]
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
                    时间
                  </th>

                  <th className="px-5 py-3 text-left">
                    账本名称
                  </th>

                  <th className="px-5 py-3 text-left">
                    账户
                  </th>

                  <th className="px-5 py-3 text-left">
                    类型
                  </th>

                  <th className="px-5 py-3 text-left">
                    收支
                  </th>

                  <th className="px-5 py-3 text-left">
                    分类
                  </th>

                  <th className="px-5 py-3 text-right">
                    金额
                  </th>

                  <th className="px-5 py-3 text-left">
                    成员
                  </th>

                  <th className="px-5 py-3 text-left">
                    备注
                  </th>

                  <th className="px-5 py-3 text-center">
                    信用卡
                  </th>

                  <th className="px-5 py-3 text-center">
                    平账
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {loading && (
                  <tr>
                    <td
                      colSpan={11}
                      className="
                        px-5
                        py-12
                        text-center
                        text-gray-500
                      "
                    >
                      正在加载消费流水...
                    </td>
                  </tr>
                )}

                {!loading &&
                  recentTransactions.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={11}
                        className="
                          px-5
                          py-12
                          text-center
                          text-gray-500
                        "
                      >
                        暂无消费流水，请上传有鱼 Excel
                      </td>
                    </tr>
                  )}

                {!loading &&
                  recentTransactions.map(
                    item => (
                      <tr
                        key={item.id}
                        className="
                          hover:bg-gray-50
                        "
                      >
                        <td
                          className="
                            whitespace-nowrap
                            px-5
                            py-3
                          "
                        >
                          {formatDate(
                            item.transaction_time
                          )}
                        </td>

                        <td
                          className="
                            whitespace-nowrap
                            px-5
                            py-3
                            font-medium
                            text-gray-700
                          "
                        >
                          {item.book_name ||
                            "-"}
                        </td>

                        <td
                          className="
                            px-5
                            py-3
                            font-medium
                          "
                        >
                          {item.account_name ||
                            "-"}
                        </td>

                        <td className="px-5 py-3">
                          {item.account_type ||
                            "-"}
                        </td>

                        <td className="px-5 py-3">
                          {item.income_expense_type ||
                            "-"}
                        </td>

                        <td className="px-5 py-3">
                          {item.category ||
                            "-"}
                        </td>

                        <td
                          className={`px-5 py-3 text-right font-medium ${
                            Number(
                              item.amount
                            ) < 0
                              ? "text-red-600"
                              : "text-green-600"
                          }`}
                        >
                          {formatMoney(
                            item.amount
                          )}
                        </td>

                        <td className="px-5 py-3">
                          {item.member ||
                            "-"}
                        </td>

                        <td className="px-5 py-3">
                          {item.remark ||
                            "-"}
                        </td>

                        <td
                          className="
                            px-5
                            py-3
                            text-center
                          "
                        >
                          {item.is_credit_card
                            ? "✅"
                            : "-"}
                        </td>

                        <td
                          className="
                            px-5
                            py-3
                            text-center
                          "
                        >
                          {item.is_settlement
                            ? "✅"
                            : "-"}
                        </td>
                      </tr>
                    )
                  )}
              </tbody>
            </table>
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