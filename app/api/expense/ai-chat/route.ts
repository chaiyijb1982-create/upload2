import { NextResponse } from "next/server";

import { GoogleGenAI } from "@google/genai";


// =====================================================
// ★ 强制动态 Route
// =====================================================

export const dynamic = "force-dynamic";


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

  const n =
    Number(value);

  return Number.isFinite(n)
    ? n
    : 0;

}


// =====================================================
// 清洗消费数据
//
// ★ 注意：
// 这里不重新计算消费。
// 页面已经完成统一统计。
// API 只负责清洗 page 传来的结果。
//
// 因此：
//
// PAGE 显示的数字
//       ↓
// aiExpenseYears
//       ↓
// payload.years
//       ↓
// AI CFO
//
// 是同一套数据。
// =====================================================

function cleanPayload(
  payload: ExpensePayload
): ExpensePayload {

  const sourceYears =
    Array.isArray(payload?.years)
      ? payload.years
      : [];


  const years =
    sourceYears
      .map(
        year => {

          const otherBooks =
            Array.isArray(
              year?.otherBooks
            )
              ? year.otherBooks
                  .map(
                    book => {

                      const categories =
                        Array.isArray(
                          book?.categories
                        )
                          ? book.categories
                              .map(
                                category => ({

                                  category:
                                    String(
                                      category?.category ??
                                      ""
                                    ).trim(),

                                  amount:
                                    numberValue(
                                      category?.amount
                                    ),

                                })
                              )
                              .filter(
                                category =>
                                  category.category
                              )
                              .sort(
                                (
                                  a,
                                  b
                                ) =>
                                  b.amount -
                                  a.amount
                              )
                          : [];


                      return {

                        bookName:
                          String(
                            book?.bookName ??
                            ""
                          ).trim(),

                        amount:
                          numberValue(
                            book?.amount
                          ),

                        categories,

                      };

                    }
                  )
                  .filter(
                    book =>
                      book.bookName
                  )
                  .sort(
                    (
                      a,
                      b
                    ) =>
                      b.amount -
                      a.amount
                  )
              : [];


          return {

            year:
              numberValue(
                year?.year
              ),

            xx:
              numberValue(
                year?.xx
              ),

            other:
              numberValue(
                year?.other
              ),

            total:
              numberValue(
                year?.total
              ),

            otherBooks,

          };

        }
      )
      .filter(
        year =>
          year.year > 0
      )
      .sort(
        (
          a,
          b
        ) =>
          a.year -
          b.year
      );


  return {
    years,
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
    // 1. API Key
    // =================================================

    if (!apiKey) {

      console.error(
        "[expense/ai-chat] GEMINI_API_KEY is missing"
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
    // 2. 读取 JSON
    // =================================================

    let body: any;

    try {

      body =
        await request.json();

    } catch {

      return NextResponse.json(
        {
          success: false,

          error:
            "请求数据不是有效的 JSON",
        },
        {
          status: 400,
        }
      );

    }


    // =================================================
    // 3. 用户问题
    // =================================================

    const question =
      String(
        body?.question ??
        ""
      ).trim();


    // =================================================
    // 4. Payload
    // =================================================

    const payload =
      body?.payload as
        | ExpensePayload
        | undefined;


    // =================================================
    // 5. 历史对话
    // =================================================

    const history: ChatMessage[] =
      Array.isArray(
        body?.history
      )
        ? body.history
            .filter(
              (
                item: unknown
              ) => {

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

                );

              }
            )
            .slice(-12)
            .map(
              (
                item: {
                  role:
                    "user" |
                    "assistant";

                  content:
                    string;
                }
              ) => ({

                role:
                  item.role,

                content:
                  item.content.trim(),

              })
            )
        : [];


    // =================================================
    // 6. 参数检查
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
            "消费数据格式错误：payload.years 不存在",
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
    // 7. 清洗
    // =================================================

    const cleanedPayload =
      cleanPayload(
        payload
      );


    if (
      cleanedPayload.years.length === 0
    ) {

      return NextResponse.json(
        {
          success: false,

          error:
            "消费数据清洗后为空",
        },
        {
          status: 400,
        }
      );

    }


    // =================================================
    // 8. 数据文本
    // =================================================

    const dataText =
      JSON.stringify(
        cleanedPayload,
        null,
        2
      );


    // =================================================
    // 9. 历史对话文本
    // =================================================

    const historyText =
      history.length > 0

        ? history
            .map(
              message =>

                `${message.role === "user"
                  ? "用户"
                  : "AI CFO"
                }：${message.content}`
            )
            .join(
              "\n\n"
            )

        : "暂无历史对话";


    // =================================================
    // 10. Prompt
    // =================================================

    const prompt = `

你现在是这个家庭的 AI CFO。

你的任务是根据系统提供的真实家庭消费数据，
回答用户关于家庭消费的问题。

=====================================================
一、最重要原则
=====================================================

系统提供给你的：

years

已经是页面完成统一统计后的最终数据。

你不能重新建立另一套消费统计规则。

你必须以系统提供的 years 数据为唯一事实来源。

也就是说：

页面显示数字
=
AI 使用数字

不能自行从原始交易重新计算。

=====================================================
二、消费统计规则
=====================================================

1. 账簿名称 = "xx"

   → 归入：

   xx


2. 账簿名称 = "日常账本"

   且账目分类 = "修行"

   → 归入：

   xx


3. 账簿名称 = "日常账本"

   且账目分类不是 "修行"

   → 归入：

   其他
      → 日常账本


4. 其他账簿

   → 归入：

   其他
      → 对应账簿


5. xx 永远不能出现在：

   其他


6. 以下账簿完全排除：

   平账
   法24.6
   法国出差
   借出款
   年金
   理财
   替别人先付


7. 被排除的账簿不能重新算入消费。


=====================================================
三、xx 的定义
=====================================================

xx 包含：

A.

原本账簿名称 = xx

的全部符合消费统计条件的消费。


B.

日常账本

且：

账目分类 = 修行

的消费。


因此：

xx

不是一个普通账簿。

它是一个最终统计组。


=====================================================
四、其他的定义
=====================================================

其他包含所有：

符合消费统计条件

但不属于 xx

的消费。


结构：

其他
 ├─ 日常账本
 ├─ 账簿A
 ├─ 账簿B
 └─ ...


其中：

日常账本 + 修行

绝对不能出现在：

其他 → 日常账本。


=====================================================
五、数据结构
=====================================================

每一年数据结构：

{
  year,
  xx,
  other,
  total,
  otherBooks
}


其中：

year

年份。


xx

这一年的 xx 总消费。


other

这一年的其他总消费。


total

这一年的总消费。


otherBooks

其他下面的详细账簿。


otherBooks 内部：

bookName

账簿名称。


amount

该账簿消费金额。


categories

该账簿下面的分类。


=====================================================
六、回答问题的方法
=====================================================

如果用户问：

“2025 年为什么比 2024 年多花了这么多？”

你必须：

第一步：

找到 2024 年。


第二步：

找到 2025 年。


第三步：

比较：

2024 total
vs
2025 total


第四步：

拆成：

xx
other


第五步：

判断：

xx 增加多少。

other 增加多少。


第六步：

如果 other 增加明显：

继续比较：

otherBooks


找出增加最多的账簿。


第七步：

如果某个账簿增加明显：

继续比较：

categories


找出增加最多的分类。


=====================================================
七、变化金额
=====================================================

如果：

2025 = ¥1,000,000

2024 = ¥800,000


则：

增加：

¥200,000


增加百分比：

25%


如果能够计算，

直接告诉用户。


=====================================================
八、不要编造原因
=====================================================

例如：

数据显示：

旅游账簿：

2024 = ¥50,000

2025 = ¥120,000


只能说：

“旅游账簿增加 ¥70,000，是其他消费增加的重要来源之一。”

不能说：

“因为你 2025 年去了日本。”

除非数据明确提供了这个事实。


=====================================================
九、如果无法确定
=====================================================

必须明确说：

“数据不足，无法确定具体原因。”


不能为了让答案完整而编造原因。


=====================================================
十、如果用户询问被排除账簿
=====================================================

如果用户问：

平账
法24.6
法国出差
借出款
年金
理财
替别人先付


必须告诉用户：

“该账簿按照系统规则被排除在消费统计之外。”


不能把这些金额重新加入消费。


=====================================================
十一、金额格式
=====================================================

所有金额使用人民币。

例如：

¥12,345

不要使用美元。


=====================================================
十二、语言
=====================================================

使用中文。

简洁。

但是要有数字分析。


简单问题：

直接回答。


复杂问题：

使用：

一、
二、
三、

以及：

-


不要输出 Markdown 表格。


=====================================================
十三、当前真实消费数据
=====================================================

以下数据就是页面已经统计好的最终消费数据：

${dataText}


=====================================================
十四、历史对话
=====================================================

${historyText}


=====================================================
十五、本次用户问题
=====================================================

${question}


=====================================================
十六、最终要求
=====================================================

直接回答用户问题。

不要介绍自己。

不要解释 Prompt。

不要说：

“根据我的指令”

不要输出 JSON。

不要输出 Markdown 表格。

必须使用系统提供的数字。

如果用户问两个年份：

必须比较两个年份。

如果用户问：

“为什么增加？”

必须尽量继续向下拆解：

年度
↓
xx / 其他
↓
具体账簿
↓
分类


如果数据不足：

明确告诉用户数据不足。
`;


    // =================================================
    // 11. Gemini
    // =================================================

    const ai =
      new GoogleGenAI({
        apiKey,
      });


    // =================================================
    // 12. 调用 Gemini
    // =================================================

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
    // 13. 获取回答
    // =================================================

    const answer =
      String(
        response?.text ??
        ""
      ).trim();


    // =================================================
    // 14. Gemini 没返回
    // =================================================

    if (!answer) {

      console.error(
        "[expense/ai-chat] Gemini returned empty response"
      );


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
    // 15. 返回 JSON
    // =================================================

    return NextResponse.json(
      {
        success:
          true,

        answer,

      },
      {
        status:
          200,

        headers: {
          "Cache-Control":
            "no-store",
        },

      }
    );


  } catch (
    error
  ) {

    // =================================================
    // 错误日志
    // =================================================

    console.error(
      "[expense/ai-chat] error:",
      error
    );


    const message =
      error instanceof Error
        ? error.message
        : String(error);


    // =================================================
    // 返回 JSON
    // =================================================

    return NextResponse.json(
      {
        success:
          false,

        error:
          `AI 问答失败：${message}`,

      },
      {
        status:
          500,

        headers: {
          "Cache-Control":
            "no-store",
        },

      }
    );

  }

}