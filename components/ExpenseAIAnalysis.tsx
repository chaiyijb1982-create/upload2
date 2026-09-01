"use client";

import {
  useMemo,
  useState,
} from "react";

// =====================================================
// 类型
// =====================================================

type CategoryItem = {
  category: string;
  amount: number;
};

// =====================================================
// 真实 aiExpenseYears 中的账簿结构
// =====================================================

type AIExpenseBook = {
  bookName: string;
  amount: number;
  categories: CategoryItem[];
};

// =====================================================
// 真实 aiExpenseYears 中的年度结构
//
// 现在 ExpensePage 传进来的结构是：
//
// {
//   year: 2025,
//   xx: {
//     amount: xxx,
//     categories: []
//   },
//   other: {
//     amount: xxx,
//     books: []
//   },
//   total: xxx
// }
// =====================================================

type AIExpenseYear = {
  year: number;

  xx: {
    amount: number;
    categories: CategoryItem[];
  };

  other: {
    amount: number;
    books: AIExpenseBook[];
  };

  total: number;
};

// =====================================================
// 给 AI API 的统一结构
//
// 这里转换成 AI CFO 最容易理解的结构。
// =====================================================

type YearData = {
  year: number;

  xx: number;

  xxCategories: CategoryItem[];

  other: number;

  otherBooks: AIExpenseBook[];

  total: number;
};

type AnalysisPayload = {
  years: YearData[];
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// =====================================================
// Props
// =====================================================

type ExpenseAIAnalysisProps = {
  years: AIExpenseYear[];
};

// =====================================================
// 金额格式
// =====================================================

function money(value: number): string {
  return `¥${Number(
    value || 0
  ).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// =====================================================
// 数字安全转换
// =====================================================

function toNumber(value: unknown): number {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return 0;
  }

  return n;
}

// =====================================================
// 数组安全转换
// =====================================================

function toArray<T>(
  value: unknown
): T[] {
  return Array.isArray(value)
    ? value
    : [];
}

// =====================================================
// 主组件
// =====================================================

export default function ExpenseAIAnalysis({
  years,
}: ExpenseAIAnalysisProps) {

  // ===================================================
  // AI 年度分析
  // ===================================================

  const [analysis, setAnalysis] =
    useState<string>("");

  const [analyzing, setAnalyzing] =
    useState(false);

  const [analysisError, setAnalysisError] =
    useState<string>("");

  // ===================================================
  // AI CFO Chat
  // ===================================================

  const [question, setQuestion] =
    useState("");

  const [chatMessages, setChatMessages] =
    useState<ChatMessage[]>([]);

  const [chatLoading, setChatLoading] =
    useState(false);

  const [chatError, setChatError] =
    useState<string>("");

  // ===================================================
  // ★ 核心：
  //
  // 把 ExpensePage 的真实 aiExpenseYears
  // 转换成 AI CFO 统一结构。
  //
  // 绝对不能再使用：
  //
  // year.xx
  // year.other
  // year.otherBooks
  //
  // 作为旧版结构。
  //
  // 现在必须使用：
  //
  // year.xx.amount
  // year.xx.categories
  // year.other.amount
  // year.other.books
  // ===================================================

  const payload = useMemo<AnalysisPayload>(() => {

    if (!Array.isArray(years)) {
      return {
        years: [],
      };
    }

    const normalizedYears: YearData[] =
      years.map((year) => {

        // =================================================
        // xx
        // =================================================

        const xxAmount =
          toNumber(
            year?.xx?.amount
          );

        const xxCategories =
          toArray<CategoryItem>(
            year?.xx?.categories
          )
            .map(
              (category) => ({
                category:
                  String(
                    category?.category ||
                    "未分类"
                  ),

                amount:
                  toNumber(
                    category?.amount
                  ),
              })
            )
            .sort(
              (a, b) =>
                b.amount -
                a.amount
            );

        // =================================================
        // other
        // =================================================

        const otherAmount =
          toNumber(
            year?.other?.amount
          );

        // =================================================
        // other.books
        // =================================================

        const otherBooks =
          toArray<AIExpenseBook>(
            year?.other?.books
          )
            .map(
              (book) => {

                const categories =
                  toArray<CategoryItem>(
                    book?.categories
                  )
                    .map(
                      (category) => ({
                        category:
                          String(
                            category?.category ||
                            "未分类"
                          ),

                        amount:
                          toNumber(
                            category?.amount
                          ),
                      })
                    )
                    .sort(
                      (a, b) =>
                        b.amount -
                        a.amount
                    );

                return {
                  bookName:
                    String(
                      book?.bookName ||
                      "未设置账本"
                    ),

                  amount:
                    toNumber(
                      book?.amount
                    ),

                  categories,
                };
              }
            )
            .filter(
              (book) =>
                book.bookName !== "xx"
            )
            .sort(
              (a, b) =>
                b.amount -
                a.amount
            );

        // =================================================
        // total
        //
        // 优先使用 ExpensePage 已经计算好的 total。
        // 不重新统计。
        // =================================================

        const total =
          toNumber(
            year?.total
          );

        return {
          year:
            toNumber(
              year?.year
            ),

          xx:
            xxAmount,

          xxCategories,

          other:
            otherAmount,

          otherBooks,

          total,
        };
      })
      .sort(
        (a, b) =>
          b.year -
          a.year
      );

    return {
      years:
        normalizedYears,
    };

  }, [years]);

  // ===================================================
  // ★ 数据完整性诊断
  // ===================================================

  const dataDiagnostics = useMemo(() => {

    const result = {
      yearCount:
        payload.years.length,

      yearsWithBooks:
        0,

      yearsWithoutBooks:
        0,

      totalBooks:
        0,

      totalCategories:
        0,

      booksWithCategories:
        0,

      categoriesWithAmount:
        0,

      hasDetailedData:
        false,

      totalAmount:
        0,
    };

    for (
      const year
      of payload.years
    ) {

      result.totalAmount +=
        year.total;

      if (
        year.otherBooks.length > 0
      ) {

        result.yearsWithBooks += 1;

        result.hasDetailedData =
          true;

      } else {

        result.yearsWithoutBooks +=
          1;
      }

      result.totalBooks +=
        year.otherBooks.length;

      // =================================================
      // otherBooks 分类
      // =================================================

      for (
        const book
        of year.otherBooks
      ) {

        if (
          book.categories.length > 0
        ) {

          result.booksWithCategories +=
            1;
        }

        result.totalCategories +=
          book.categories.length;

        for (
          const category
          of book.categories
        ) {

          if (
            category.amount !== 0
          ) {

            result.categoriesWithAmount +=
              1;
          }
        }
      }

      // =================================================
      // xx 分类也算入分类统计
      // =================================================

      for (
        const category
        of year.xxCategories
      ) {

        result.totalCategories +=
          1;

        if (
          category.amount !== 0
        ) {

          result.categoriesWithAmount +=
            1;
        }
      }
    }

    return result;

  }, [payload]);

  // ===================================================
  // ★ 给 AI 阅读的完整文字
  // ===================================================

  const aiDataSummary = useMemo(() => {

    if (
      !payload.years.length
    ) {

      return "暂无消费数据";
    }

    return payload.years
      .map(
        (year) => {

          // =================================================
          // xx 分类
          // =================================================

          const xxCategoryText =
            year.xxCategories.length > 0
              ? year.xxCategories
                  .map(
                    (category) =>
                      `${category.category}=${money(
                        category.amount
                      )}`
                  )
                  .join("，")
              : "无分类明细";

          // =================================================
          // 其他账簿
          // =================================================

          const bookText =
            year.otherBooks.length > 0
              ? year.otherBooks
                  .map(
                    (book) => {

                      const categoryText =
                        book.categories.length > 0
                          ? book.categories
                              .map(
                                (category) =>
                                  `${category.category}=${money(
                                    category.amount
                                  )}`
                              )
                              .join("，")
                          : "无分类明细";

                      return [
                        `账簿=${book.bookName}`,
                        `金额=${money(
                          book.amount
                        )}`,
                        `分类=${categoryText}`,
                      ].join("；");
                    }
                  )
                  .join("\n")
              : "无其他账簿明细";

          return [
            `========== ${year.year}年 ==========`,
            `xx=${money(year.xx)}`,
            `xx分类=${xxCategoryText}`,
            `其他=${money(year.other)}`,
            `总消费=${money(year.total)}`,
            `其他账簿：`,
            bookText,
          ].join("\n");
        }
      )
      .join("\n\n");

  }, [payload]);

  // ===================================================
  // ★ JSON
  // ===================================================

  const aiDataJSON =
    useMemo(() => {

      return JSON.stringify(
        payload,
        null,
        2
      );

    }, [payload]);

  // ===================================================
  // ★ AI CFO 系统规则
  // ===================================================

  const aiSystemInstruction =
    useMemo(() => {

      return [
        "你是 AI CFO，负责分析 ExpensePage 已经统计完成的真实消费数据。",

        "",

        "【最高优先级】",

        "你只能使用本次请求提供的 payload、years、dataSummary 和 dataJSON。",

        "禁止自行查询数据库。",

        "禁止重新读取 transactions。",

        "禁止重新统计交易。",

        "禁止猜测不存在的账簿。",

        "禁止编造分类。",

        "禁止修改 ExpensePage 已经计算好的金额。",

        "",

        "【真实数据结构】",

        "每一年包含：",

        "year",

        "xx",

        "xxCategories",

        "other",

        "otherBooks",

        "total",

        "",

        "其中：",

        "xx 是一个独立的大类。",

        "other 是另一个独立的大类。",

        "otherBooks 是 other 下面的具体账簿。",

        "xx 永远不能归入 otherBooks。",

        "",

        "【账簿规则】",

        "otherBooks 中出现的 bookName 才是真实存在的账簿。",

        "如果某个年份 otherBooks 为空，必须明确说明该年份没有提供账簿明细。",

        "绝对不能自行猜测账簿名称。",

        "",

        "【分类规则】",

        "分类必须来自 payload 中实际存在的 categories。",

        "不能自己创造不存在的分类。",

        "如果账簿存在分类，则可以按照分类分析该账簿消费。",

        "",

        "【年度比较】",

        "当用户比较两个年份时，必须按照以下顺序：",

        "1. total",

        "2. xx",

        "3. other",

        "4. otherBooks",

        "5. otherBooks.categories",

        "",

        "如果用户问哪个账簿变化最大，",

        "只能比较实际存在于 otherBooks 中的账簿。",

        "",

        "如果用户问哪个分类增加最多，",

        "只能使用实际提供的分类金额。",

        "",

        "【金额】",

        "所有金额必须来自 payload。",

        "金额必须保持页面原始金额。",

        "不要把 0 当成数据缺失。",

        "只有真正不存在的字段才属于数据缺失。",

        "",

        "【回答方式】",

        "先给结论。",

        "然后给出金额变化。",

        "然后拆解 xx 和其他。",

        "然后继续拆解具体账簿。",

        "如果存在分类数据，再继续拆解分类。",

        "",

        "【禁止幻觉】",

        "数据不足时必须明确说数据不足。",

        "不要为了给出原因而编造原因。",

      ].join("\n");

    }, []);

  // ===================================================
  // ★ 年度分析
  // ===================================================

  async function runAnalysis() {

    if (
      !payload.years.length
    ) {

      setAnalysisError(
        "没有可供分析的年度消费数据"
      );

      return;
    }

    setAnalyzing(true);

    setAnalysisError("");

    try {

      const response =
        await fetch(
          "/api/expense/ai-analysis",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({

                // =================================================
                // 标准结构
                // =================================================

                payload,

                // =================================================
                // ★ 同时发送 years
                //
                // 给旧 API / 新 API 做兼容。
                // =================================================

                years:
                  payload.years,

                // =================================================
                // AI 文字数据
                // =================================================

                dataSummary:
                  aiDataSummary,

                // =================================================
                // JSON
                // =================================================

                dataJSON:
                  aiDataJSON,

                // =================================================
                // AI 规则
                // =================================================

                systemInstruction:
                  aiSystemInstruction,
              }),
          }
        );

      const text =
        await response.text();

      let data:
        | {
            success?: boolean;
            analysis?: string;
            error?: string;
          }
        | null = null;

      try {

        data =
          text
            ? JSON.parse(text)
            : null;

      } catch {

        throw new Error(
          `服务器返回了无法解析的内容（HTTP ${response.status}）：${text.slice(
            0,
            500
          )}`
        );
      }

      if (
        !response.ok ||
        !data?.success
      ) {

        throw new Error(
          data?.error ||
          `AI 分析失败（HTTP ${response.status}）`
        );
      }

      setAnalysis(
        data.analysis || ""
      );

    } catch (error) {

      console.error(
        "Expense AI analysis error:",
        error
      );

      setAnalysisError(
        error instanceof Error
          ? error.message
          : String(error)
      );

    } finally {

      setAnalyzing(false);
    }
  }

  // ===================================================
  // ★ AI CFO 问答
  // ===================================================

  async function askCFO(
    customQuestion?: string
  ) {

    const q =
      (
        customQuestion ??
        question
      ).trim();

    if (!q) {
      return;
    }

    if (
      !payload.years.length
    ) {

      setChatError(
        "没有可供 AI 分析的消费数据"
      );

      return;
    }

    setChatLoading(true);

    setChatError("");

    // =================================================
    // 保存发送前历史
    // =================================================

    const previousMessages =
      chatMessages;

    const userMessage:
      ChatMessage = {
        role: "user",
        content: q,
      };

    // =================================================
    // 立即显示用户问题
    // =================================================

    setChatMessages(
      (prev) => [
        ...prev,
        userMessage,
      ]
    );

    setQuestion("");

    try {

      const response =
        await fetch(
          "/api/expense/ai-chat",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({

                // =================================================
                // 用户问题
                // =================================================

                question:
                  q,

                // =================================================
                // ★ 标准结构
                // =================================================

                payload,

                // =================================================
                // ★ 兼容字段
                //
                // 防止 API 仍然从 body.years 读取。
                // =================================================

                years:
                  payload.years,

                // =================================================
                // AI 阅读文本
                // =================================================

                dataSummary:
                  aiDataSummary,

                // =================================================
                // 原始 JSON
                // =================================================

                dataJSON:
                  aiDataJSON,

                // =================================================
                // 历史对话
                // =================================================

                history:
                  previousMessages,

                // =================================================
                // AI CFO 规则
                // =================================================

                systemInstruction:
                  aiSystemInstruction,
              }),
          }
        );

      const text =
        await response.text();

      let data:
        | {
            success?: boolean;
            answer?: string;
            error?: string;
          }
        | null = null;

      try {

        data =
          text
            ? JSON.parse(text)
            : null;

      } catch {

        if (
          response.status === 404
        ) {

          throw new Error(
            "AI CFO API 不存在（HTTP 404）。请确认项目中存在：app/api/expense/ai-chat/route.ts"
          );
        }

        throw new Error(
          `服务器返回了无法解析的内容（HTTP ${response.status}）：${text.slice(
            0,
            500
          )}`
        );
      }

      if (
        !response.ok ||
        !data?.success
      ) {

        throw new Error(
          data?.error ||
          `AI 问答失败（HTTP ${response.status}）`
        );
      }

      // =================================================
      // AI 回复
      // =================================================

      setChatMessages(
        (prev) => [
          ...prev,

          {
            role: "assistant",
            content:
              data.answer || "",
          },
        ]
      );

    } catch (error) {

      console.error(
        "Expense AI chat error:",
        error
      );

      setChatError(
        error instanceof Error
          ? error.message
          : String(error)
      );

      // =================================================
      // 请求失败恢复历史
      // =================================================

      setChatMessages(
        previousMessages
      );

    } finally {

      setChatLoading(false);
    }
  }

  // ===================================================
  // Enter
  // ===================================================

  function handleKeyDown(
    event:
      React.KeyboardEvent<HTMLTextAreaElement>
  ) {

    if (
      event.key === "Enter" &&
      !event.shiftKey
    ) {

      event.preventDefault();

      if (!chatLoading) {
        askCFO();
      }
    }
  }

  // ===================================================
  // 快捷问题
  // ===================================================

  const quickQuestions = [

    "为什么今年比去年多花了这么多？",

    "其他为什么增加？",

    "哪个账簿的消费变化最大？",

    "哪个分类的消费增加最多？",

    "分析近三年的消费趋势",

    "找出今年最值得关注的消费变化",

    "如果要降低10%的年度开销，应该从哪里下手？",

  ];

  // ===================================================
  // 没有数据
  // ===================================================

  if (
    !payload.years.length
  ) {

    return (
      <section
        style={{
          marginTop: 32,
          padding: 24,
          border:
            "1px solid #e5e7eb",
          borderRadius: 16,
          background:
            "#ffffff",
        }}
      >

        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          🤖 AI CFO
        </div>

        <div
          style={{
            marginTop: 8,
            color: "#6b7280",
          }}
        >
          暂无消费数据，暂时无法进行 AI 分析。
        </div>

      </section>
    );
  }

  // ===================================================
  // UI
  // ===================================================

  return (

    <section
      style={{
        marginTop: 32,
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >

      {/* =================================================
          AI 年度分析
      ================================================= */}

      <div
        style={{
          border:
            "1px solid #e5e7eb",
          borderRadius: 16,
          background:
            "#ffffff",
          overflow: "hidden",
        }}
      >

        <div
          style={{
            padding:
              "18px 20px",
            borderBottom:
              "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent:
              "space-between",
            gap: 12,
          }}
        >

          <div>

            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              🤖 AI 年度消费分析
            </div>

            <div
              style={{
                marginTop: 4,
                fontSize: 13,
                color: "#6b7280",
              }}
            >
              AI 自动分析各年度消费变化、账簿及分类
            </div>

          </div>

          <button
            type="button"
            onClick={
              runAnalysis
            }
            disabled={
              analyzing
            }
            style={{
              padding:
                "9px 16px",
              borderRadius: 10,
              border:
                "1px solid #d1d5db",
              background:
                analyzing
                  ? "#f3f4f6"
                  : "#111827",
              color:
                analyzing
                  ? "#6b7280"
                  : "#ffffff",
              cursor:
                analyzing
                  ? "not-allowed"
                  : "pointer",
              fontWeight: 600,
            }}
          >
            {analyzing
              ? "分析中..."
              : analysis
                ? "重新分析"
                : "开始 AI 分析"}
          </button>

        </div>

        <div
          style={{
            padding: 20,
          }}
        >

          {analysisError && (

            <div
              style={{
                padding: 12,
                marginBottom: 14,
                borderRadius: 10,
                background:
                  "#fef2f2",
                color: "#b91c1c",
                fontSize: 14,
              }}
            >
              {analysisError}
            </div>

          )}

          {!analysis &&
            !analysisError &&
            !analyzing && (

              <div
                style={{
                  color:
                    "#9ca3af",
                  fontSize: 14,
                }}
              >
                点击右上角「开始 AI 分析」，让 AI CFO 分析年度消费、账簿和分类。
              </div>
            )}

          {analyzing && (

            <div
              style={{
                padding:
                  "20px 0",
                color:
                  "#6b7280",
              }}
            >
              正在分析年度消费变化，请稍候……
            </div>
          )}

          {analysis && (

            <div
              style={{
                whiteSpace:
                  "pre-wrap",
                lineHeight: 1.8,
                fontSize: 14,
                color:
                  "#1f2937",
              }}
            >
              {analysis}
            </div>
          )}

        </div>

      </div>

      {/* =================================================
          AI CFO 问答
      ================================================= */}

      <div
        style={{
          border:
            "1px solid #e5e7eb",
          borderRadius: 16,
          background:
            "#ffffff",
          overflow: "hidden",
        }}
      >

        <div
          style={{
            padding:
              "18px 20px",
            borderBottom:
              "1px solid #e5e7eb",
          }}
        >

          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
            }}
          >
            💬 AI CFO 问答
          </div>

          <div
            style={{
              marginTop: 5,
              fontSize: 13,
              color:
                "#6b7280",
            }}
          >
            可以直接询问任何年度、账簿、分类或消费变化问题
          </div>

        </div>

        {/* =================================================
            快捷问题
        ================================================= */}

        <div
          style={{
            padding:
              "16px 20px 4px",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >

          {quickQuestions.map(
            (item) => (

              <button
                key={item}
                type="button"
                disabled={
                  chatLoading
                }
                onClick={() =>
                  askCFO(item)
                }
                style={{
                  border:
                    "1px solid #e5e7eb",
                  background:
                    "#f9fafb",
                  color:
                    "#374151",
                  borderRadius:
                    999,
                  padding:
                    "7px 12px",
                  fontSize: 13,
                  cursor:
                    chatLoading
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {item}
              </button>

            )
          )}

        </div>

        {/* =================================================
            Chat
        ================================================= */}

        <div
          style={{
            padding:
              "16px 20px",
            display: "flex",
            flexDirection:
              "column",
            gap: 14,
            minHeight: 100,
            maxHeight: 560,
            overflowY:
              "auto",
          }}
        >

          {chatMessages.length ===
            0 && (

            <div
              style={{
                padding:
                  "24px 0",
                textAlign:
                  "center",
                color:
                  "#9ca3af",
                fontSize: 14,
              }}
            >

              <div
                style={{
                  fontSize: 28,
                  marginBottom: 8,
                }}
              >
                💡
              </div>

              <div>
                你可以问我：
              </div>

              <div
                style={{
                  marginTop: 6,
                }}
              >
                「2025 年为什么比 2024 年多花了这么多？」
              </div>

              <div
                style={{
                  marginTop: 6,
                }}
              >
                「哪个账簿的消费增加最多？」
              </div>

              <div
                style={{
                  marginTop: 6,
                }}
              >
                「哪个分类增加最多？」
              </div>

            </div>
          )}

          {chatMessages.map(
            (
              message,
              index
            ) => (

              <div
                key={
                  `${message.role}-${index}`
                }
                style={{
                  display:
                    "flex",
                  flexDirection:
                    "column",
                  alignItems:
                    message.role ===
                    "user"
                      ? "flex-end"
                      : "flex-start",
                }}
              >

                <div
                  style={{
                    fontSize: 12,
                    color:
                      "#9ca3af",
                    marginBottom: 4,
                  }}
                >
                  {message.role ===
                  "user"
                    ? "你"
                    : "🤖 AI CFO"}
                </div>

                <div
                  style={{
                    maxWidth:
                      "85%",
                    padding:
                      "11px 14px",
                    borderRadius:
                      12,
                    background:
                      message.role ===
                      "user"
                        ? "#111827"
                        : "#f3f4f6",
                    color:
                      message.role ===
                      "user"
                        ? "#ffffff"
                        : "#1f2937",
                    whiteSpace:
                      "pre-wrap",
                    lineHeight:
                      1.7,
                    fontSize: 14,
                  }}
                >
                  {message.content}
                </div>

              </div>
            )
          )}

          {chatLoading && (

            <div
              style={{
                display:
                  "flex",
                flexDirection:
                  "column",
                alignItems:
                  "flex-start",
              }}
            >

              <div
                style={{
                  fontSize: 12,
                  color:
                    "#9ca3af",
                  marginBottom: 4,
                }}
              >
                🤖 AI CFO
              </div>

              <div
                style={{
                  padding:
                    "11px 14px",
                  borderRadius:
                    12,
                  background:
                    "#f3f4f6",
                  color:
                    "#6b7280",
                  fontSize: 14,
                }}
              >
                正在分析你的消费数据……
              </div>

            </div>
          )}

        </div>

        {/* =================================================
            Error
        ================================================= */}

        {chatError && (

          <div
            style={{
              margin:
                "0 20px 12px",
              padding: 12,
              borderRadius: 10,
              background:
                "#fef2f2",
              color:
                "#b91c1c",
              fontSize: 14,
            }}
          >
            {chatError}
          </div>
        )}

        {/* =================================================
            Input
        ================================================= */}

        <div
          style={{
            padding:
              "14px 20px 20px",
            borderTop:
              "1px solid #f3f4f6",
          }}
        >

          <div
            style={{
              display:
                "flex",
              gap: 10,
              alignItems:
                "flex-end",
            }}
          >

            <textarea
              value={
                question
              }
              onChange={(
                event
              ) =>
                setQuestion(
                  event.target.value
                )
              }
              onKeyDown={
                handleKeyDown
              }
              disabled={
                chatLoading
              }
              placeholder="例如：2025 年其他为什么比 2024 年增加这么多？"
              rows={3}
              style={{
                flex: 1,
                resize:
                  "vertical",
                minHeight: 76,
                maxHeight: 180,
                border:
                  "1px solid #d1d5db",
                borderRadius:
                  12,
                padding:
                  "11px 13px",
                fontSize: 14,
                lineHeight:
                  1.6,
                outline:
                  "none",
              }}
            />

            <button
              type="button"
              onClick={() =>
                askCFO()
              }
              disabled={
                chatLoading ||
                !question.trim()
              }
              style={{
                height: 44,
                padding:
                  "0 18px",
                borderRadius:
                  10,
                border:
                  "none",
                background:
                  chatLoading ||
                  !question.trim()
                    ? "#e5e7eb"
                    : "#111827",
                color:
                  chatLoading ||
                  !question.trim()
                    ? "#9ca3af"
                    : "#ffffff",
                cursor:
                  chatLoading ||
                  !question.trim()
                    ? "not-allowed"
                    : "pointer",
                fontWeight:
                  600,
                whiteSpace:
                  "nowrap",
              }}
            >
              {chatLoading
                ? "分析中"
                : "发送"}
            </button>

          </div>

          <div
            style={{
              marginTop: 7,
              fontSize: 12,
              color:
                "#9ca3af",
            }}
          >
            Enter 发送，Shift + Enter 换行
          </div>

        </div>

      </div>

      {/* =================================================
          当前 AI 数据状态
      ================================================= */}

      <div
        style={{
          border:
            "1px solid #e5e7eb",
          borderRadius: 16,
          background:
            "#f9fafb",
          padding:
            "14px 18px",
          fontSize: 13,
          color:
            "#6b7280",
        }}
      >

        <div>

          当前已提供给 AI CFO：

          <strong
            style={{
              color:
                "#374151",
              marginLeft: 5,
            }}
          >
            {
              dataDiagnostics.yearCount
            }
          </strong>

          年消费数据。

        </div>

        <div
          style={{
            marginTop: 6,
          }}
        >

          已提供：

          <strong
            style={{
              color:
                "#374151",
              marginLeft: 5,
            }}
          >
            {
              dataDiagnostics.totalBooks
            }
          </strong>

          个其他账簿，

          <strong
            style={{
              color:
                "#374151",
              marginLeft: 5,
            }}
          >
            {
              dataDiagnostics.booksWithCategories
            }
          </strong>

          个账簿有分类明细，

          <strong
            style={{
              color:
                "#374151",
              marginLeft: 5,
            }}
          >
            {
              dataDiagnostics.totalCategories
            }
          </strong>

          个分类。

        </div>

        <div
          style={{
            marginTop: 6,
          }}
        >

          其中：

          <strong
            style={{
              color:
                "#374151",
              marginLeft: 5,
            }}
          >
            {
              dataDiagnostics.categoriesWithAmount
            }
          </strong>

          个分类存在金额。

        </div>

        <div
          style={{
            marginTop: 6,
          }}
        >

          AI 数据总额：

          <strong
            style={{
              color:
                "#374151",
              marginLeft: 5,
            }}
          >
            {money(
              dataDiagnostics.totalAmount
            )}
          </strong>

        </div>

        {!dataDiagnostics.hasDetailedData && (

          <div
            style={{
              marginTop: 8,
              padding: 10,
              borderRadius: 8,
              background:
                "#fff7ed",
              color:
                "#c2410c",
            }}
          >
            ⚠️ 当前 ExpensePage 没有提供其他账簿明细。
            AI CFO 不会自行编造账簿数据。
          </div>
        )}

        {dataDiagnostics.hasDetailedData && (

          <div
            style={{
              marginTop: 8,
              color:
                "#166534",
            }}
          >
            ✓ AI CFO 已获得完整的
            「年度 → xx / 其他 → 账簿 → 分类」
            数据。
          </div>
        )}

      </div>

    </section>
  );
}

