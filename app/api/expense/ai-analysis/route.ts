import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

// =====================================================
// Gemini API Key
// =====================================================

const apiKey =
  process.env.GEMINI_API_KEY?.trim();

// =====================================================
// 类型
// =====================================================

type CategoryItem = {
  category: string;
  amount: number;
};

type OtherBook = {
  bookName: string;
  amount: number;
  categories: CategoryItem[];
};

type YearData = {
  year: number;
  xx: number;
  other: number;
  total: number;
  otherBooks: OtherBook[];
};

type ExpensePayload = {
  years: YearData[];
};

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

// =====================================================
// 安全数字
// =====================================================

function numberValue(
  value: unknown
): number {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : 0;
}

// =====================================================
// 清洗数据
// =====================================================

function cleanPayload(
  payload: ExpensePayload
): ExpensePayload {
  return {
    years: payload.years
      .map(
        (year: YearData): YearData => ({
          year: numberValue(year.year),

          xx: numberValue(
            year.xx
          ),

          other: numberValue(
            year.other
          ),

          total: numberValue(
            year.total
          ),

          otherBooks:
            Array.isArray(
              year.otherBooks
            )
              ? year.otherBooks
                  .map(
                    (
                      book: OtherBook
                    ): OtherBook => ({
                      bookName:
                        String(
                          book.bookName ||
                            ""
                        ),

                      amount:
                        numberValue(
                          book.amount
                        ),

                      categories:
                        Array.isArray(
                          book.categories
                        )
                          ? book.categories
                              .map(
                                (
                                  category: CategoryItem
                                ): CategoryItem => ({
                                  category:
                                    String(
                                      category.category ||
                                        ""
                                    ),

                                  amount:
                                    numberValue(
                                      category.amount
                                    ),
                                })
                              )
                              .filter(
                                (
                                  category: CategoryItem
                                ) =>
                                  Boolean(
                                    category.category
                                  )
                              )
                              .sort(
                                (
                                  a: CategoryItem,
                                  b: CategoryItem
                                ) =>
                                  b.amount -
                                  a.amount
                              )
                          : [],
                    })
                  )
                  .filter(
                    (
                      book: OtherBook
                    ) =>
                      Boolean(
                        book.bookName
                      )
                  )
                  .sort(
                    (
                      a: OtherBook,
                      b: OtherBook
                    ) =>
                      b.amount -
                      a.amount
                  )
              : [],
        })
      )
      .filter(
        (year: YearData) =>
          year.year > 0
      ),
  };
}

// =====================================================
// POST
// =====================================================

export async function POST(
  request: Request
) {
  try {
    // =================================================
    // 检查 API Key
    // =================================================

    if (!apiKey) {
      console.error(
        "GEMINI_API_KEY is missing"
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "GEMINI_API_KEY 未配置。请检查 .env.local，并重启 npm run dev。",
        },
        {
          status: 500,
        }
      );
    }

    // =================================================
    // 读取请求
    // =================================================

    const body =
      await request.json();

    const question =
      String(
        body?.question || ""
      ).trim();

    const payload =
      body?.payload as
        | ExpensePayload
        | undefined;

    // =================================================
    // 历史对话
    //
    // ★ 明确声明 ChatMessage[]
    // ★ 避免 item implicitly any
    // =================================================

    let history: ChatMessage[] = [];

    if (
      Array.isArray(
        body?.history
      )
    ) {
      history = body.history
        .filter(
          (
            item: unknown
          ): item is {
            role?: unknown;
            content?: unknown;
          } => {
            if (
              !item ||
              typeof item !==
                "object"
            ) {
              return false;
            }

            const message =
              item as {
                role?: unknown;
                content?: unknown;
              };

            return (
              (
                message.role ===
                  "user" ||
                message.role ===
                  "assistant"
              ) &&
              typeof message.content ===
                "string" &&
              message.content.trim()
                .length > 0
            );
          }
        )
        .slice(-12)
        .map(
          (
            item: {
              role:
                | "user"
                | "assistant";
              content: string;
            }
          ): ChatMessage => ({
            role:
              item.role,

            content:
              item.content.trim(),
          })
        );
    }

    // =================================================
    // 参数检查
    // =================================================

    if (!question) {
      return NextResponse.json(
        {
          success: false,
          error:
            "请输入你的问题",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !payload ||
      !Array.isArray(
        payload.years
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "消费数据格式错误",
        },
        {
          status: 400,
        }
      );
    }

    if (
      payload.years.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "没有可供 AI 分析的消费数据",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // 清洗消费数据
    // =================================================

    const cleanedPayload =
      cleanPayload(
        payload
      );

    // =================================================
    // 数据文本
    // =================================================

    const dataText =
      JSON.stringify(
        cleanedPayload,
        null,
        2
      );

    // =================================================
    // 历史对话
    // =================================================

    const historyText =
      history.length > 0
        ? history
            .map(
              (
                message: ChatMessage
              ) =>
                `${
                  message.role ===
                  "user"
                    ? "用户"
                    : "AI CFO"
                }：${
                  message.content
                }`
            )
            .join("\n\n")
        : "暂无历史对话";

    // =================================================
    // Prompt
    // =================================================

    const prompt = `
你现在是这个家庭的 AI CFO。

你的任务是根据系统提供的真实家庭消费数据，
回答用户关于家庭消费的问题。

你必须严格使用下面的消费统计规则。

=====================================================
一、消费统计规则
=====================================================

1. 账簿名称 = "xx"
   → 归入 xx

2. 账簿名称 = "日常账本"
   且账目分类 = "修行"
   → 归入 xx

3. 账簿名称 = "日常账本"
   且账目分类不是 "修行"
   → 归入：
      其他 → 日常账本

4. 以下账簿完全排除，不参与消费统计：

   平账
   法24.6
   法国出差
   借出款
   年金
   理财
   替别人先付

5. xx 永远不会属于其他。

6. xx 的金额只包含：
   - 原本 xx 账簿的全部消费
   - 日常账本中分类为修行的消费

7. 其他 = 剩余符合消费统计条件的账簿。

8. 其他下面需要继续按照具体账簿分析。

9. 其他账簿下面还可以继续按照账目分类分析。

10. 按月和按年都使用同一套统计规则。

=====================================================
二、回答原则
=====================================================

你不是简单复述数据。

你需要根据用户的问题，
主动寻找数字变化背后的原因。

例如用户问：

“2025 年为什么比 2024 年多？”

你应该：

第一步：
比较 2025 和 2024 总消费。

第二步：
拆成：
- xx
- 其他

第三步：
如果其他变化明显，
继续拆解：
- 哪个具体账簿增加最多

第四步：
如果某个账簿增加明显，
继续拆解：
- 哪些账目分类增加最多

第五步：
判断变化更可能属于：
- 一次性消费
- 长期结构变化
- 日常消费增加
- 旅游
- 出差
- 大额项目
- 其他明显的数据变化

但是：

绝对不能凭空编造事实。

例如数据只显示：

“某账簿增加 ¥50,000”

不能直接说：

“这是因为你去了日本旅游。”

只能说：

“该账簿增加 ¥50,000，是这一年度其他消费增长的主要来源之一。仅凭现有数据无法确定具体原因。”

=====================================================
三、回答时的数据优先级
=====================================================

优先使用：

年度总消费
↓
xx
↓
其他
↓
具体账簿
↓
账目分类

必须尽量找到最底层的数据变化。

如果用户问：

“其他为什么增加？”

不要只回答：

“其他增加了 ¥80,000。”

必须继续分析：

“其中：
A 账簿 +¥50,000
B 账簿 +¥20,000
C 账簿 +¥10,000”

如果 A 账簿下面还有分类，
继续分析分类。

=====================================================
四、不能把排除账簿拿出来分析
=====================================================

以下账簿不参与消费统计：

平账
法24.6
法国出差
借出款
年金
理财
替别人先付

如果用户问这些账簿：

明确告诉用户：

“该账簿按照系统规则被排除在消费统计之外。”

不要把它们重新算入消费。

=====================================================
五、xx 特殊规则
=====================================================

如果用户问 xx：

必须记住：

xx =
原本账簿名称为 xx 的全部消费
+
日常账本中账目分类为修行的消费

例如：

日常账本
→ 修行 ¥30,000

它属于：

xx

而不是：

其他 → 日常账本。

日常账本的其他分类才属于：

其他 → 日常账本。

=====================================================
六、不要混淆“账簿”和“分类”
=====================================================

账簿名称是账簿。

账目分类是分类。

特别是：

日常账本是一个账簿名称。

修行是日常账本下面的账目分类。

不能把：

“日常账本”

理解成一个分类。

=====================================================
七、金额
=====================================================

所有金额使用人民币。

格式：

¥12,345

不要使用美元。

=====================================================
八、如果数据不足
=====================================================

必须明确说：

“数据不足，无法确定。”

不要为了让答案听起来完整而编造原因。

=====================================================
九、回答风格
=====================================================

使用中文。

简洁但有分析。

不要输出 Markdown 表格。

可以使用：

一、
二、
三、

以及：

-
1.
2.

如果问题简单，就直接回答。

如果问题复杂，就分层分析。

=====================================================
十、当前消费数据
=====================================================

${dataText}

=====================================================
十一、历史对话
=====================================================

${historyText}

=====================================================
十二、本次用户问题
=====================================================

${question}

=====================================================
十三、最终要求
=====================================================

直接回答用户的问题。

不要介绍自己。

不要解释 Prompt。

不要说“根据我的指令”。

不要输出 JSON。

不要输出 Markdown 表格。

如果可以计算变化金额，就直接计算并告诉用户。

如果发现明显变化，主动向下拆解到具体账簿和分类。

如果数据不足以确定真实原因，明确说明数据不足。
`;

    // =================================================
    // Gemini
    // =================================================

    const ai =
      new GoogleGenAI({
        apiKey,
      });

    const response =
      await ai.models.generateContent({
        model:
          "gemini-3.6-flash",

        contents:
          prompt,

        config: {
          temperature:
            0.2,

          maxOutputTokens:
            4000,
        },
      });

    // =================================================
    // AI 返回
    // =================================================

    const text =
      response.text || "";

    if (!text.trim()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Gemini 没有返回回答",
        },
        {
          status: 500,
        }
      );
    }

    // =================================================
    // 返回
    // =================================================

    return NextResponse.json({
      success: true,
      answer:
        text.trim(),
    });

  } catch (
    error: unknown
  ) {
    console.error(
      "Expense AI chat error:",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        success: false,
        error:
          `AI 问答失败：${message}`,
      },
      {
        status: 500,
      }
    );
  }
}