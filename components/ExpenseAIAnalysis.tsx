"use client";

import {
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";

// =====================================================
// 类型
// =====================================================

type CategoryItem = {
  category: string;
  amount: number;
};

type AIExpenseBook = {
  bookName: string;
  amount: number;
  categories: CategoryItem[];
};

export type AIExpenseYear = {
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

type YearData = {
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

type AnalysisPayload = {
  years: YearData[];
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ExpenseAIAnalysisProps = {
  years: AIExpenseYear[];
  transactions: any[];
};

// =====================================================
// 工具
// =====================================================

function toNumber(
  value: unknown,
): number {
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  if (typeof value === "string") {
    const cleaned =
      value
        .replace(/,/g, "")
        .replace(
          /[¥￥\s]/g,
          "",
        )
        .trim();

    if (!cleaned) {
      return 0;
    }

    const n =
      Number(cleaned);

    return Number.isFinite(n)
      ? n
      : 0;
  }

  return 0;
}

function money(
  value: number,
): string {
  return new Intl.NumberFormat(
    "zh-CN",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    },
  ).format(
    toNumber(value),
  );
}

function toArray<T>(
  value: unknown,
): T[] {
  return Array.isArray(value)
    ? value
    : [];
}

// =====================================================
// 年度数据
//
// 注意：
// 不重新计算。
// 完全使用 ExpensePage 传来的 years。
// =====================================================

function normalizeYears(
  years: AIExpenseYear[],
): YearData[] {
  return toArray<AIExpenseYear>(
    years,
  )
    .map((year) => {
      const xxCategories =
        toArray<CategoryItem>(
          year?.xx?.categories,
        )
          .map((item) => ({
            category:
              String(
                item?.category ??
                  "",
              ),
            amount:
              toNumber(
                item?.amount,
              ),
          }))
          .filter(
            (item) =>
              item.category,
          );

      const otherBooks =
        toArray<AIExpenseBook>(
          year?.other?.books,
        )
          .map((book) => ({
            bookName:
              String(
                book?.bookName ??
                  "",
              ),

            amount:
              toNumber(
                book?.amount,
              ),

            categories:
              toArray<CategoryItem>(
                book?.categories,
              )
                .map((item) => ({
                  category:
                    String(
                      item?.category ??
                        "",
                    ),
                  amount:
                    toNumber(
                      item?.amount,
                    ),
                }))
                .filter(
                  (item) =>
                    item.category,
                ),
          }))
          .filter(
            (book) =>
              book.bookName &&
              book.bookName !==
                "xx",
          )
          .sort(
            (a, b) =>
              b.amount -
              a.amount,
          );

      return {
        year: toNumber(
          year?.year,
        ),

        xx: {
          amount:
            toNumber(
              year?.xx?.amount,
            ),

          categories:
            xxCategories,
        },

        other: {
          amount:
            toNumber(
              year?.other?.amount,
            ),

          books:
            otherBooks,
        },

        total:
          toNumber(
            year?.total,
          ),
      };
    })
    .filter(
      (year) =>
        year.year > 0,
    )
    .sort(
      (a, b) =>
        b.year -
        a.year,
    );
}

// =====================================================
// 年度摘要
// =====================================================

function buildAIDataSummary(
  years: YearData[],
): string {
  if (!years.length) {
    return "暂无年度消费数据。";
  }

  return years
    .map((year) => {
      const xxCategories =
        year.xx.categories.length
          ? year.xx.categories
              .map(
                (item) =>
                  `${item.category}: ¥${money(
                    item.amount,
                  )}`,
              )
              .join("；")
          : "无";

      const otherBooks =
        year.other.books.length
          ? year.other.books
              .map((book) => {
                const categories =
                  book.categories.length
                    ? `（${book.categories
                        .map(
                          (item) =>
                            `${item.category}: ¥${money(
                              item.amount,
                            )}`,
                        )
                        .join(
                          "；",
                        )}）`
                    : "";

                return `${book.bookName}: ¥${money(
                  book.amount,
                )}${categories}`;
              })
              .join("；")
          : "无";

      return [
        `${year.year}年`,
        `XX: ¥${money(
          year.xx.amount,
        )}`,
        `XX分类: ${xxCategories}`,
        `其他: ¥${money(
          year.other.amount,
        )}`,
        `其他账本: ${otherBooks}`,
        `总消费: ¥${money(
          year.total,
        )}`,
      ].join(" | ");
    })
    .join("\n");
}

// =====================================================
// Diagnostics
// =====================================================

function buildDataDiagnostics(
  years: YearData[],
  transactions: any[],
) {
  const books =
    new Set<string>();

  const categories =
    new Set<string>();

  for (
    const year of years
  ) {
    for (
      const item of
        year.xx.categories
    ) {
      categories.add(
        item.category,
      );
    }

    for (
      const book of
        year.other.books
    ) {
      books.add(
        book.bookName,
      );

      for (
        const item of
          book.categories
      ) {
        categories.add(
          item.category,
        );
      }
    }
  }

  return {
    yearCount:
      years.length,

    transactionCount:
      transactions.length,

    bookCount:
      books.size,

    categoryCount:
      categories.size,

    years:
      years.map(
        (item) =>
          item.year,
      ),
  };
}

// =====================================================
// AI System Instruction
// =====================================================

function buildAISystemInstruction(
  payload: AnalysisPayload,
): string {
  return `
你是 AI Wealth OS 的 AI CFO。

你的职责不是替代 ExpensePage 计算数据。

你的职责是：

- 解释程序计算出的财务事实
- 比较
- 分析趋势
- 找出异常
- 解释消费结构
- 在有交易明细时解释交易
- 给出合理建议

==================================================
一、ExpensePage 是官方消费统计来源
==================================================

下面的 years 是 ExpensePage 已经计算好的最终年度数据：

${JSON.stringify(
  payload,
  null,
  2,
)}

必须严格遵守：

1. xx.amount 是 ExpensePage 的官方 xx 金额。
2. other.amount 是 ExpensePage 的官方其他金额。
3. other.books 是 ExpensePage 的官方其他账本。
4. total 是 ExpensePage 的官方年度消费金额。

不得重新计算。

不得修改。

不得根据交易描述自行创造新的官方 xx。

==================================================
二、特别重要：XX
==================================================

ExpensePage 官方 XX 与交易级 XX 必须严格区分。

ExpensePage 官方 XX：

来自：

years[].xx.amount

以及：

years[].xx.categories

它是官方年度口径。

交易级 XX：

由 API 从全部交易中程序筛选得到。

交易级 XX 只能称为：

“交易级 XX”

“明确字段等于 xx 的交易”

或者：

“XX 相关交易”

绝对不能把交易级 XX 说成 ExpensePage 官方 XX。

例如：

如果 ExpensePage：

2025年 XX = ¥0
2026年 XX = ¥0

必须明确说明：

“根据 ExpensePage 官方年度数据，2025年和2026年的 XX 均为 ¥0。”

即使交易级程序发现：

某些交易字段明确等于 xx

也不能修改官方年度 XX。

==================================================
三、前 N 个月
==================================================

用户可能问：

- 前3个月
- 前6个月
- 前8个月
- 前10个月
- 前11个月
- 前12个月
- 1-8月
- 1-11月
- 1至8月
- 1月至11月
- 1月到11月
- 1~11月
- 截至8月
- 截至11月
- 前面8个月
- 前面11个月

这些都由 API 根据问题动态识别。

绝对不能固定成前8个月。

例如：

“2025和2026年前11个月 XX 怎么样？”

程序会分别计算：

2025年1月～11月

2026年1月～11月

然后提供：

- 总消费
- 消费笔数
- 月度消费
- XX交易级金额
- XX交易级笔数
- XX交易级月度金额
- XX交易级分类
- XX交易级分类金额
- 文本相关 XX
- 文本相关 XX 分类

你必须直接使用这些程序事实。

不能说：

“程序没有提供前11个月。”

==================================================
四、前 N 个月 XX
==================================================

特别注意：

如果用户问：

“2025和2026年前8个月 XX 为什么下降？”

程序已经提供：

2025年1-8月交易级 XX

2026年1-8月交易级 XX

以及：

每个月金额

每个月笔数

分类金额

分类笔数

因此必须直接回答。

不能使用全年 XX 去代替前8个月 XX。

不能因为 ExpensePage 没有官方月度 XX 就拒绝回答。

应该明确：

“以下前8个月 XX 使用交易级分析口径，不是 ExpensePage 官方月度 XX。”

然后直接分析程序提供的前8个月事实。

==================================================
五、6183 笔交易
==================================================

所有交易可以发送到自己的 AI CFO API。

但是：

全部交易只允许在程序端进行统计。

不要把全部交易发送给 DeepSeek。

只有用户明确询问：

- 哪笔
- 买了什么
- 具体消费
- 交易明细
- 商户
- 流水
- 交易记录

等具体交易问题时，

API 才会提供筛选后的 SELECTED TRANSACTIONS。

==================================================
六、程序统计优先
==================================================

如果 API 提供：

CFO PROGRAM FACTS

那么：

- 金额以它为准
- 笔数以它为准
- 账户以它为准
- 分类以它为准
- 账本以它为准
- 月度以它为准
- 前 N 个月以它为准
- XX 前 N 个月以它为准
- XX 分类以它为准
- 同比金额以它为准
- 同比百分比以它为准
- 现金以它为准
- 银行卡以它为准
- 信用卡以它为准

不要重新计算。

==================================================
七、年度问题
==================================================

如果用户问年度消费：

优先使用 ExpensePage 官方年度数据。

特别是：

XX 年度金额

XX 年度分类

其他年度金额

其他账本

总消费

都优先使用 ExpensePage 官方年度数据。

交易级程序统计只能作为辅助分析。

==================================================
八、回答前 N 个月时
==================================================

如果程序已经提供：

FIRST_N_MONTH FACTS

必须使用它。

例如：

用户问：

“2025和2026年前11个月 XX 怎么样？”

你应该直接使用：

2025年前11个月交易级 XX

2026年前11个月交易级 XX

以及程序提供的：

月度

分类

笔数

金额

变化

不要自己从原始交易计算。

==================================================
九、回答
==================================================

- 中文
- 金额使用 ¥
- 不编造数据
- 不编造账本
- 不编造分类
- 不编造交易
- 不编造消费原因
- 数据不足时明确说明
- 推测必须明确说“可能”或“推测”
- 不输出 JSON
- 不输出 Markdown 表格

==================================================
十、禁止事项
==================================================

禁止让 AI 自己从 6183 笔交易重新计算年度消费。

禁止让 AI 自己重新计算前 N 个月。

禁止让 AI 自己计算同比百分比。

禁止把“交易描述中出现 xx”自动等同于“ExpensePage 的 xx”。

禁止把部分交易数据当成完整年度数据。

禁止用交易明细覆盖 ExpensePage 官方年度数据。

禁止因为没有官方月度 XX 而拒绝进行交易级前 N 个月分析。

如果程序已经提供前 N 个月数据，就必须直接回答。
`.trim();
}

// =====================================================
// 主组件
// =====================================================

export default function ExpenseAIAnalysis({
  years,
  transactions,
}: ExpenseAIAnalysisProps) {
  const [question, setQuestion] =
    useState("");

  const [chat, setChat] =
    useState<ChatMessage[]>(
      [],
    );

  const [loading, setLoading] =
    useState(false);

  // ===================================================
  // 年度数据
  // ===================================================

  const payload =
    useMemo<AnalysisPayload>(
      () => ({
        years:
          normalizeYears(
            years,
          ),
      }),
      [years],
    );

  // ===================================================
  // Diagnostics
  // ===================================================

  const dataDiagnostics =
    useMemo(
      () =>
        buildDataDiagnostics(
          payload.years,
          transactions,
        ),
      [
        payload.years,
        transactions,
      ],
    );

  // ===================================================
  // 年度摘要
  // ===================================================

  const aiDataSummary =
    useMemo(
      () =>
        buildAIDataSummary(
          payload.years,
        ),
      [payload.years],
    );

  const aiDataJSON =
    useMemo(
      () =>
        JSON.stringify(
          payload,
        ),
      [payload],
    );

  const aiSystemInstruction =
    useMemo(
      () =>
        buildAISystemInstruction(
          payload,
        ),
      [payload],
    );

  // ===================================================
  // 年度 AI 分析
  //
  // 原接口保持不变。
  // ===================================================

  async function runAnalysis() {
    if (loading) {
      return;
    }

    setLoading(true);

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

            body: JSON.stringify({
              payload,

              years:
                payload.years,

              dataSummary:
                aiDataSummary,

              dataJSON:
                aiDataJSON,

              systemInstruction:
                aiSystemInstruction,
            }),
          },
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "AI 分析失败",
        );
      }

      const answer =
        result?.answer ||
        result?.message ||
        "AI 暂无分析结果。";

      setChat((prev) => [
        ...prev,
        {
          role:
            "assistant",
          content:
            answer,
        },
      ]);
    } catch (error) {
      console.error(
        "[ExpenseAIAnalysis] runAnalysis:",
        error,
      );

      setChat((prev) => [
        ...prev,
        {
          role:
            "assistant",
          content:
            error instanceof Error
              ? error.message
              : "AI 分析失败，请稍后重试。",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // ===================================================
  // CFO
  //
  // 6183 笔：
  // 发送给自己的 API。
  //
  // 自己的 API：
  // 程序端全部分析。
  //
  // DeepSeek：
  // 只接收程序筛选后的 Facts，
  // 必要时才接收相关交易明细。
  // ===================================================

  async function askCFO(
    customQuestion?: string,
  ) {
    const q = (
      customQuestion ??
      question
    ).trim();

    if (
      !q ||
      loading
    ) {
      return;
    }

    const previousMessages =
      chat.slice(-12);

    setChat((prev) => [
      ...prev,
      {
        role: "user",
        content: q,
      },
    ]);

    setQuestion("");

    setLoading(true);

    try {
      console.log(
        "[ExpenseAIAnalysis] CFO request",
        {
          question: q,

          transactionCount:
            transactions.length,

          yearCount:
            payload.years.length,
        },
      );

      const response =
        await fetch(
          "/api/expense/ai-chat",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              question: q,

              // =====================================
              // ExpensePage 官方年度数据
              // =====================================

              payload,

              // =====================================
              // 全部交易
              //
              // 只发送到自己的 API。
              //
              // API 内部程序处理。
              // 不会全部发送给 DeepSeek。
              // =====================================

              transactions,

              // =====================================
              // 历史对话
              // =====================================

              history:
                previousMessages,

              // =====================================
              // 系统说明
              // =====================================

              systemInstruction:
                aiSystemInstruction,

              // =====================================
              // 辅助数据
              // =====================================

              dataSummary:
                aiDataSummary,

              dataDiagnostics,
            }),
          },
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "AI CFO 请求失败",
        );
      }

      const answer =
        result?.answer ||
        result?.message ||
        "AI CFO 暂无回答。";

      setChat((prev) => [
        ...prev,
        {
          role:
            "assistant",
          content:
            answer,
        },
      ]);
    } catch (error) {
      console.error(
        "[ExpenseAIAnalysis] askCFO:",
        error,
      );

      setChat((prev) => [
        ...prev,
        {
          role:
            "assistant",
          content:
            error instanceof Error
              ? error.message
              : "AI CFO 请求失败，请稍后重试。",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // ===================================================
  // Enter
  // ===================================================

  function handleKeyDown(
    event: KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (
      event.key ===
        "Enter" &&
      !event.shiftKey
    ) {
      event.preventDefault();

      void askCFO();
    }
  }

  // ===================================================
  // 快捷问题
  // ===================================================

  const quickQuestions = [
    "分析一下各年度消费变化",
    "哪个年度消费最高？",
    "XX 和其他消费有什么变化？",
    "帮我看看消费结构",
  ];

  // ===================================================
  // UI
  //
  // 注意：
  // UI 完全保持原样。
  // ===================================================

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-white p-4">
        <div className="mb-3">
          <div className="text-base font-semibold">
            AI CFO
          </div>

          <div className="mt-1 text-sm text-gray-500">
            基于 Expense 数据进行分析
          </div>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {quickQuestions.map(
            (item) => (
              <button
                key={item}
                type="button"
                onClick={() =>
                  void askCFO(item)
                }
                disabled={loading}
                className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {item}
              </button>
            ),
          )}
        </div>

        <div className="space-y-3">
          {chat.map(
            (message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={
                  message.role ===
                  "user"
                    ? "rounded-lg bg-gray-50 p-3 text-sm"
                    : "rounded-lg border p-3 text-sm"
                }
              >
                <div className="mb-1 text-xs font-medium text-gray-500">
                  {message.role ===
                  "user"
                    ? "你"
                    : "AI CFO"}
                </div>

                <div className="whitespace-pre-wrap leading-6">
                  {message.content}
                </div>
              </div>
            ),
          )}
        </div>

        <div className="mt-4">
          <textarea
            value={question}
            onChange={(event) =>
              setQuestion(
                event.target.value,
              )
            }
            onKeyDown={
              handleKeyDown
            }
            placeholder="问 AI CFO..."
            disabled={loading}
            className="min-h-[90px] w-full rounded-lg border p-3 text-sm outline-none focus:ring-2 focus:ring-gray-200 disabled:bg-gray-50"
          />
        </div>

        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={() =>
              void askCFO()
            }
            disabled={
              loading ||
              !question.trim()
            }
            className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "分析中..."
              : "发送"}
          </button>
        </div>
      </div>
    </div>
  );
}