import { NextResponse } from "next/server";


// =====================================================
// ★ 强制动态 Route
// =====================================================

export const dynamic = "force-dynamic";


// =====================================================
// DeepSeek 配置
// =====================================================

const deepseekApiKey =
  process.env.DEEPSEEK_API_KEY?.trim();

const deepseekBaseUrl =
  (
    process.env.DEEPSEEK_BASE_URL ||
    "https://api.deepseek.com"
  ).replace(/\/+$/, "");

const deepseekModel =
  (
    process.env.DEEPSEEK_MODEL ||
    "deepseek-chat"
  ).trim();


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


type ExpenseTransaction =
  Record<string, unknown>;


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
// 安全字符串
// =====================================================

function stringValue(
  value: unknown
): string {

  if (
    value === null ||
    value === undefined
  ) {

    return "";

  }

  return String(value).trim();
}


// =====================================================
// 清洗年度数据
// =====================================================

function cleanPayload(
  payload: ExpensePayload
): ExpensePayload {

  const sourceYears =
    Array.isArray(
      payload?.years
    )
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
                                    stringValue(
                                      category?.category
                                    ),

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
                          stringValue(
                            book?.bookName
                          ),

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
          a.year - b.year
      );


  return {
    years,
  };

}


// =====================================================
// ★ 清洗交易
// =====================================================

function cleanTransactions(
  value: unknown
): ExpenseTransaction[] {

  if (
    !Array.isArray(value)
  ) {

    return [];

  }


  return value.filter(
    (
      transaction
    ): transaction is ExpenseTransaction => {

      return (
        transaction !== null &&
        typeof transaction === "object" &&
        !Array.isArray(transaction)
      );

    }
  );

}


// =====================================================
// ★ 找交易时间字段
//
// 兼容可能存在的不同字段名。
// =====================================================

function getTransactionTime(
  transaction: ExpenseTransaction
): string {

  const possibleFields = [

    "transaction_time",

    "transactionTime",

    "trans_time",

    "transTime",

    "date",

    "transaction_date",

    "transactionDate",

    "created_at",

    "createdAt",

    "time",

    "datetime",

  ];


  for (
    const field
    of possibleFields
  ) {

    const value =
      transaction[field];

    if (
      value !== null &&
      value !== undefined &&
      String(value).trim()
    ) {

      return String(value).trim();

    }

  }


  return "";

}


// =====================================================
// ★ 从交易中得到日期
//
// 最终统一成：
// YYYY-MM-DD
//
// 注意：
// 这里专门处理 ISO 时间。
// =====================================================

function getTransactionDate(
  transaction: ExpenseTransaction
): string {

  const value =
    getTransactionTime(
      transaction
    );

  if (!value) {
    return "";
  }


  // ===================================================
  // ISO 时间
  //
  // 2026-08-31T12:25:00+00:00
  // ===================================================

  const isoMatch =
    value.match(
      /^(\d{4})-(\d{2})-(\d{2})/
    );


  if (isoMatch) {

    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  }


  // ===================================================
  // YYYY/MM/DD
  // ===================================================

  const slashMatch =
    value.match(
      /^(\d{4})\/(\d{1,2})\/(\d{1,2})/
    );


  if (slashMatch) {

    return [
      slashMatch[1],

      slashMatch[2].padStart(
        2,
        "0"
      ),

      slashMatch[3].padStart(
        2,
        "0"
      ),

    ].join("-");

  }


  // ===================================================
  // Date 对象格式
  // ===================================================

  const date =
    new Date(value);


  if (
    !Number.isNaN(
      date.getTime()
    )
  ) {

    return [
      date.getFullYear(),

      String(
        date.getMonth() + 1
      ).padStart(
        2,
        "0"
      ),

      String(
        date.getDate()
      ).padStart(
        2,
        "0"
      ),

    ].join("-");

  }


  return "";

}


// =====================================================
// ★ 读取金额
// =====================================================

function getTransactionAmount(
  transaction: ExpenseTransaction
): number {

  const possibleFields = [

    "amount",

    "money",

    "value",

    "transaction_amount",

    "transactionAmount",

    "total",

  ];


  for (
    const field
    of possibleFields
  ) {

    const value =
      transaction[field];

    if (
      value !== null &&
      value !== undefined &&
      value !== ""
    ) {

      const n =
        Number(value);

      if (
        Number.isFinite(n)
      ) {

        return n;

      }

    }

  }


  return 0;

}


// =====================================================
// ★ 判断问题中是否包含明确日期
//
// 支持：
//
// 2026年8月31日
// 2026 年 8 月 31 日
// 2026-08-31
// 2026/08/31
// =====================================================

function extractDateFromQuestion(
  question: string
): string | null {

  // ===================================================
  // YYYY-MM-DD
  // ===================================================

  const iso =
    question.match(
      /(\d{4})[-/](\d{1,2})[-/](\d{1,2})/
    );


  if (iso) {

    return [
      iso[1],

      iso[2].padStart(
        2,
        "0"
      ),

      iso[3].padStart(
        2,
        "0"
      ),

    ].join("-");

  }


  // ===================================================
  // 中文日期
  // ===================================================

  const chinese =
    question.match(
      /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/
    );


  if (chinese) {

    return [
      chinese[1],

      chinese[2].padStart(
        2,
        "0"
      ),

      chinese[3].padStart(
        2,
        "0"
      ),

    ].join("-");

  }


  return null;

}


// =====================================================
// ★ 提取月份
//
// 支持：
//
// 2026年8月
// 2026-08
// 2026/08
// =====================================================

function extractMonthFromQuestion(
  question: string
): {
  year: number;
  month: number;
} | null {

  const iso =
    question.match(
      /(\d{4})[-/](\d{1,2})(?![-/]\d)/
    );


  if (iso) {

    return {

      year:
        Number(
          iso[1]
        ),

      month:
        Number(
          iso[2]
        ),

    };

  }


  const chinese =
    question.match(
      /(\d{4})\s*年\s*(\d{1,2})\s*月/
    );


  if (chinese) {

    return {

      year:
        Number(
          chinese[1]
        ),

      month:
        Number(
          chinese[2]
        ),

    };

  }


  return null;

}


// =====================================================
// ★ 提取年份
// =====================================================

function extractYearsFromQuestion(
  question: string
): number[] {

  const matches =
    question.match(
      /\b(20\d{2})\b/g
    ) || [];


  return [
    ...new Set(
      matches.map(
        value =>
          Number(value)
      )
    ),
  ];

}


// =====================================================
// ★ 判断是否需要逐笔交易
// =====================================================

function questionNeedsTransactions(
  question: string
): boolean {

  const keywords = [

    "花了什么",

    "消费记录",

    "消费明细",

    "交易",

    "哪笔",

    "这笔",

    "具体消费",

    "具体交易",

    "商户",

    "买了什么",

    "今天",

    "昨天",

    "明天",

    "当天",

    "日期",

    "哪一天",

    "哪天",

    "本月",

    "这个月",

    "上个月",

    "月份",

    "具体",

    "明细",

  ];


  return keywords.some(
    keyword =>
      question.includes(
        keyword
      )
  );

}


// =====================================================
// ★ 筛选交易
//
// 核心原则：
//
// 用户问具体日期
// → 只发送当天交易
//
// 用户问月份
// → 只发送该月交易
//
// 用户问两个年份
// → 只发送两个年份交易
//
// 普通年度分析
// → 不发送全部交易
// → 使用 years
// =====================================================

function selectRelevantTransactions(
  transactions: ExpenseTransaction[],
  question: string
): ExpenseTransaction[] {

  if (
    transactions.length === 0
  ) {

    return [];

  }


  const exactDate =
    extractDateFromQuestion(
      question
    );


  // ===================================================
  // 1. 精确日期
  // ===================================================

  if (
    exactDate
  ) {

    return transactions.filter(
      transaction =>
        getTransactionDate(
          transaction
        ) === exactDate
    );

  }


  // ===================================================
  // 2. 月份
  // ===================================================

  const month =
    extractMonthFromQuestion(
      question
    );


  if (
    month &&
    questionNeedsTransactions(
      question
    )
  ) {

    const prefix =
      `${month.year}-${String(
        month.month
      ).padStart(
        2,
        "0"
      )}`;

    return transactions.filter(
      transaction =>
        getTransactionDate(
          transaction
        ).startsWith(
          prefix
        )
    );

  }


  // ===================================================
  // 3. 明确年份
  // ===================================================

  const years =
    extractYearsFromQuestion(
      question
    );


  if (
    years.length > 0 &&
    questionNeedsTransactions(
      question
    )
  ) {

    const yearSet =
      new Set(
        years
      );

    return transactions.filter(
      transaction => {

        const date =
          getTransactionDate(
            transaction
          );

        if (!date) {
          return false;
        }

        const year =
          Number(
            date.slice(
              0,
              4
            )
          );

        return yearSet.has(
          year
        );

      }
    );

  }


  // ===================================================
  // 4. 普通年度问题
  //
  // 不把全部 6183 笔发送给 AI。
  //
  // 年度问题主要使用 years。
  // ===================================================

  return [];

}


// =====================================================
// ★ 压缩交易字段
//
// 不需要把数据库中的所有字段原样塞给 AI。
//
// 但仍然尽量保留真实信息。
// =====================================================

function compactTransaction(
  transaction: ExpenseTransaction
) {

  const result:
    Record<string, unknown> = {};


  // ===================================================
  // 优先字段
  // ===================================================

  const preferredFields = [

    "transaction_time",

    "transactionTime",

    "transaction_date",

    "transactionDate",

    "date",

    "account_name",

    "accountName",

    "account_type",

    "accountType",

    "book_name",

    "bookName",

    "category",

    "category_name",

    "categoryName",

    "merchant",

    "merchant_name",

    "merchantName",

    "description",

    "memo",

    "note",

    "amount",

    "money",

    "transaction_amount",

    "transactionAmount",

    "currency",

  ];


  for (
    const field
    of preferredFields
  ) {

    if (
      transaction[field] !==
        undefined
    ) {

      result[field] =
        transaction[field];

    }

  }


  // ===================================================
  // 如果没有任何优先字段，
  // 保留原始对象。
  // ===================================================

  if (
    Object.keys(
      result
    ).length === 0
  ) {

    return transaction;

  }


  return result;

}


// =====================================================
// ★ 构造交易文本
// =====================================================

function buildTransactionText(
  transactions: ExpenseTransaction[]
): string {

  if (
    transactions.length === 0
  ) {

    return "本次问题没有筛选出需要提供给 AI 的逐笔交易。";

  }


  const compacted =
    transactions.map(
      transaction =>
        compactTransaction(
          transaction
        )
    );


  return JSON.stringify(
    compacted,
    null,
    2
  );

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

    if (
      !deepseekApiKey
    ) {

      return NextResponse.json(
        {
          success: false,

          error:
            "DEEPSEEK_API_KEY 未配置。请检查 .env.local，并重启 npm run dev。",
        },
        {
          status: 500,
        }
      );

    }


    // =================================================
    // 2. JSON
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
      stringValue(
        body?.question
      );


    // =================================================
    // 4. Payload
    // =================================================

    const payload =
      body?.payload as
        | ExpensePayload
        | undefined;


    // =================================================
    // 5. ★ 接收真实交易
    //
    // 新版：
    //
    // body.transactions
    //
    // 旧版：
    //
    // body.payload.transactions
    //
    // 两个都兼容。
    // =================================================

    const rawTransactions =
      body?.transactions ??
      body?.payload?.transactions;


    const transactions =
      cleanTransactions(
        rawTransactions
      );


    // =================================================
    // 日志
    // =================================================

    console.log(
      "[expense/ai-chat] question:",
      question
    );

    console.log(
      "[expense/ai-chat] years:",
      payload?.years?.length || 0
    );

    console.log(
      "[expense/ai-chat] transactions received:",
      transactions.length
    );


    // =================================================
    // 6. 历史
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
    // 7. 参数检查
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
    // 8. 清洗年度数据
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
    // 9. 年度 JSON
    // =================================================

    const dataText =
      JSON.stringify(
        cleanedPayload,
        null,
        2
      );


    // =================================================
    // 10. ★ 筛选相关交易
    // =================================================

    const relevantTransactions =
      selectRelevantTransactions(
        transactions,
        question
      );


    console.log(
      "[expense/ai-chat] relevant transactions:",
      relevantTransactions.length
    );


    // =================================================
    // 11. ★ 交易文本
    // =================================================

    const transactionText =
      buildTransactionText(
        relevantTransactions
      );


    // =================================================
    // 12. 历史
    // =================================================

    const historyText =
      history.length > 0

        ? history
            .map(
              message =>
                `${
                  message.role ===
                  "user"
                    ? "用户"
                    : "AI CFO"
                }：${message.content}`
            )
            .join(
              "\n\n"
            )

        : "暂无历史对话";


    // =================================================
    // 13. 系统规则
    // =================================================

    const systemInstruction = `

你现在是这个家庭的 AI CFO。

你的任务是根据系统提供的真实家庭消费数据，
回答用户关于家庭消费的问题。

=====================================================
一、最高优先级
=====================================================

只能使用系统提供的数据。

不得编造：

- 交易
- 日期
- 金额
- 商户
- 账簿
- 分类
- 描述
- 消费原因

不得自行查询数据库。

=====================================================
二、年度数据
=====================================================

years 是 ExpensePage 已经计算完成的最终年度消费数据。

其中：

year
= 年份

xx
= xx 最终消费金额

other
= 其他最终消费金额

total
= 最终总消费

otherBooks
= 其他下面真实存在的账簿

otherBooks.bookName
= 真实账簿名称

otherBooks.amount
= 账簿消费金额

otherBooks.categories
= 账簿真实分类

=====================================================
三、逐笔交易
=====================================================

系统可能提供：

1. 全部真实交易数量
2. 本次问题筛选后的相关交易

注意：

如果本次筛选后的交易数量为 0，
并不代表系统没有真实交易。

必须区分：

“系统共有多少笔交易”

和

“本次问题筛选出了多少笔相关交易”。

=====================================================
四、具体日期
=====================================================

如果用户问：

2026年8月31日花了什么？

必须使用：

本次提供的相关逐笔交易。

如果存在：

列出真实交易。

如果不存在：

明确说该日期没有找到交易。

不能因为年度数据没有日期，
就说系统没有逐笔交易。

=====================================================
五、月份
=====================================================

如果用户问某个月：

优先使用本次提供的逐笔交易。

如果能够准确计算，
可以计算该月真实消费。

=====================================================
六、年度
=====================================================

如果用户问年度消费：

优先使用 years。

例如：

2025年比2024年多花多少？

先比较：

total

再比较：

xx

other

然后：

otherBooks

然后：

categories

=====================================================
七、账簿
=====================================================

只能使用 otherBooks 中真实存在的账簿。

不得自行创造账簿。

=====================================================
八、分类
=====================================================

只能使用数据中真实存在的分类。

不得自行创造分类。

=====================================================
九、交易字段
=====================================================

交易中可能存在：

transaction_time
account_name
account_type
book_name
category
merchant
description
amount

以及其他字段。

有什么字段就使用什么字段。

没有的字段不要编造。

=====================================================
十、排除账簿
=====================================================

以下账簿按照系统规则排除：

平账
法24.6
法国出差
借出款
年金
理财
替别人先付

如果用户询问这些账簿：

说明该账簿按照系统规则被排除在消费统计之外。

=====================================================
十一、不要编造原因
=====================================================

例如：

商户 = 某餐厅
金额 = ¥500

只能说：

存在一笔 ¥500 的餐饮消费。

不能自行说：

“这是和朋友聚餐”。

=====================================================
十二、回答原则
=====================================================

简单问题：

直接回答。

具体交易：

直接列交易。

年度比较：

给变化金额。

复杂分析：

使用：

一、
二、
三、

不要输出 Markdown 表格。

不要输出 JSON。

不要解释 Prompt。

不要介绍系统规则。

=====================================================
十三、最重要
=====================================================

具体日期：

优先使用 transactions。

具体月份：

优先使用 transactions。

具体交易：

优先使用 transactions。

年度：

优先使用 years。

年度原因：

years + transactions。

如果本次相关交易为 0：

不能说“系统没有逐笔交易”。

只能说：

“本次问题没有筛选出相关逐笔交易”。

`;


    // =================================================
    // 14. 最终 Prompt
    // =================================================

    const prompt = `

${systemInstruction}

=====================================================
当前年度消费数据
=====================================================

${dataText}

=====================================================
系统原始真实交易数量
=====================================================

${transactions.length}

=====================================================
本次问题筛选后的相关交易数量
=====================================================

${relevantTransactions.length}

=====================================================
本次问题相关交易
=====================================================

${transactionText}

=====================================================
历史对话
=====================================================

${historyText}

=====================================================
本次用户问题
=====================================================

${question}

=====================================================
最终要求
=====================================================

直接回答用户问题。

如果用户问具体日期：

必须检查相关交易。

如果用户问具体月份：

必须检查相关交易。

如果用户问具体交易：

必须检查相关交易。

如果用户问年度：

使用 years。

如果用户问年度为什么变化：

结合 years 和相关交易。

不要因为相关交易数量为 0，
就声称系统没有真实交易。

系统本次收到的真实交易总数：

${transactions.length}

`;


    // =================================================
    // 15. 日志
    // =================================================

    console.log(
      "[expense/ai-chat] sending to DeepSeek"
    );

    console.log(
      "[expense/ai-chat] model:",
      deepseekModel
    );

    console.log(
      "[expense/ai-chat] total transactions:",
      transactions.length
    );

    console.log(
      "[expense/ai-chat] relevant transactions:",
      relevantTransactions.length
    );

    console.log(
      "[expense/ai-chat] prompt length:",
      prompt.length
    );


    // =================================================
    // 16. DeepSeek
    // =================================================

    const deepseekResponse =
      await fetch(
        `${deepseekBaseUrl}/chat/completions`,
        {
          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${deepseekApiKey}`,

          },

          body:
            JSON.stringify({

              model:
                deepseekModel,

              messages: [

                {
                  role:
                    "user",

                  content:
                    prompt,

                },

              ],

              temperature:
                0.2,

              max_tokens:
                4000,

              stream:
                false,

            }),

          cache:
            "no-store",

        }
      );


    // =================================================
    // 17. 原始响应
    // =================================================

    const deepseekText =
      await deepseekResponse.text();


    // =================================================
    // 18. HTTP 错误
    // =================================================

    if (
      !deepseekResponse.ok
    ) {

      console.error(
        "[expense/ai-chat] DeepSeek HTTP error:",
        deepseekResponse.status,
        deepseekText.slice(
          0,
          2000
        )
      );


      return NextResponse.json(
        {
          success: false,

          error:
            `DeepSeek API 调用失败（HTTP ${deepseekResponse.status}）：${deepseekText.slice(
              0,
              1000
            )}`,
        },
        {
          status: 500,
        }
      );

    }


    // =================================================
    // 19. JSON
    // =================================================

    let deepseekData: any;

    try {

      deepseekData =
        JSON.parse(
          deepseekText
        );

    } catch {

      console.error(
        "[expense/ai-chat] DeepSeek returned invalid JSON:",
        deepseekText.slice(
          0,
          2000
        )
      );


      return NextResponse.json(
        {
          success: false,

          error:
            "DeepSeek API 返回了无法解析的 JSON",
        },
        {
          status: 500
        }
      );

    }


    // =================================================
    // 20. AI 回答
    // =================================================

    const answer =
      stringValue(
        deepseekData
          ?.choices?.[0]
          ?.message?.content
      );


    // =================================================
    // 21. 空回答
    // =================================================

    if (!answer) {

      console.error(
        "[expense/ai-chat] DeepSeek returned empty answer:",
        JSON.stringify(
          deepseekData
        ).slice(
          0,
          3000
        )
      );


      return NextResponse.json(
        {
          success: false,

          error:
            "DeepSeek 没有返回回答",
        },
        {
          status: 500
        }
      );

    }


    // =================================================
    // 22. 成功
    // =================================================

    return NextResponse.json(
      {
        success: true,

        answer,

      },
      {
        status: 200,

        headers: {

          "Cache-Control":
            "no-store",

        },

      }
    );


  } catch (
    error
  ) {

    console.error(
      "[expense/ai-chat] error:",
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

        headers: {

          "Cache-Control":
            "no-store",

        },

      }
    );

  }

}