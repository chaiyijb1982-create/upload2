import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// =====================================================
// DeepSeek
// =====================================================

const DEEPSEEK_API_KEY =
  process.env.DEEPSEEK_API_KEY;

const DEEPSEEK_BASE_URL =
  process.env.DEEPSEEK_BASE_URL ||
  "https://api.deepseek.com";

const DEEPSEEK_MODEL =
  process.env.DEEPSEEK_MODEL ||
  "deepseek-chat";

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

  xx: {
    amount: number;
    categories: CategoryItem[];
  };

  other: {
    amount: number;
    books: OtherBook[];
  };

  total: number;
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

type MonthlyFact = {
  month: string;
  amount: number;
  transactionCount: number;
};

type CategoryFact = {
  name: string;
  amount: number;
  transactionCount: number;
};

type YearFirstNFact = {
  year: number;
  months: number;
  amount: number;
  transactionCount: number;
  monthly: MonthlyFact[];
  categories: CategoryFact[];
};

type FirstNFacts = {
  months: number;
  years: YearFirstNFact[];
};


function normalizeQuestion(
  value: unknown,
): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}
// =====================================================
// 数字
// =====================================================

function numberValue(
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

    const n = Number(cleaned);

    return Number.isFinite(n)
      ? n
      : 0;
  }

  return 0;
}

// =====================================================
// 字符串
// =====================================================

function stringValue(
  value: unknown,
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
// Array
// =====================================================

function arrayValue<T>(
  value: unknown,
): T[] {
  return Array.isArray(value)
    ? value
    : [];
}

// =====================================================
// Field
// =====================================================

function getField(
  transaction: ExpenseTransaction,
  names: string[],
): unknown {
  for (const name of names) {
    if (
      transaction[name] !==
        undefined &&
      transaction[name] !== null
    ) {
      return transaction[name];
    }
  }

  return undefined;
}

// =====================================================
// Transaction time
// =====================================================

function getTransactionTime(
  transaction: ExpenseTransaction,
): string {
  return stringValue(
    getField(transaction, [
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
    ]),
  );
}

// =====================================================
// Date
// =====================================================

function getTransactionDate(
  transaction: ExpenseTransaction,
): string | null {
  const raw =
    getTransactionTime(
      transaction,
    );

  if (!raw) {
    return null;
  }

  const direct =
    raw.match(
      /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/,
    );

  if (direct) {
    return `${direct[1]}-${direct[2].padStart(
      2,
      "0",
    )}-${direct[3].padStart(
      2,
      "0",
    )}`;
  }

  const parsed =
    new Date(raw);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return null;
  }

  return `${parsed.getFullYear()}-${String(
    parsed.getMonth() + 1,
  ).padStart(
    2,
    "0",
  )}-${String(
    parsed.getDate(),
  ).padStart(
    2,
    "0",
  )}`;
}

// =====================================================
// Month
// =====================================================

function getTransactionMonth(
  transaction: ExpenseTransaction,
): string | null {
  const date =
    getTransactionDate(
      transaction,
    );

  return date
    ? date.slice(0, 7)
    : null;
}

// =====================================================
// Year
// =====================================================

function getTransactionYear(
  transaction: ExpenseTransaction,
): number | null {
  const date =
    getTransactionDate(
      transaction,
    );

  if (!date) {
    return null;
  }

  const year =
    Number(
      date.slice(0, 4),
    );

  return Number.isFinite(year)
    ? year
    : null;
}

// =====================================================
// Month number
// =====================================================

function getTransactionMonthNumber(
  transaction: ExpenseTransaction,
): number | null {
  const date =
    getTransactionDate(
      transaction,
    );

  if (!date) {
    return null;
  }

  const month =
    Number(
      date.slice(5, 7),
    );

  return Number.isFinite(month)
    ? month
    : null;
}

// =====================================================
// Amount
// =====================================================

function getTransactionAmount(
  transaction: ExpenseTransaction,
): number {
  return numberValue(
    getField(transaction, [
      "amount",
      "money",
      "value",
      "transaction_amount",
      "transactionAmount",
      "total",
    ]),
  );
}

// =====================================================
// Direction
// =====================================================

function getDirection(
  transaction: ExpenseTransaction,
): "inflow" | "outflow" | "unknown" {
  const raw =
    stringValue(
      getField(transaction, [
        "direction",
        "transaction_type",
        "transactionType",
        "flow_type",
        "flowType",
        "income_expense",
        "incomeExpense",
      ]),
    ).toLowerCase();

  if (
    [
      "income",
      "inflow",
      "credit",
      "收入",
      "入账",
      "流入",
    ].some((item) =>
      raw.includes(
        item.toLowerCase(),
      ),
    )
  ) {
    return "inflow";
  }

  if (
    [
      "expense",
      "outflow",
      "debit",
      "支出",
      "消费",
      "付款",
      "流出",
    ].some((item) =>
      raw.includes(
        item.toLowerCase(),
      ),
    )
  ) {
    return "outflow";
  }

  return "unknown";
}

// =====================================================
// Account
// =====================================================

function getAccountName(
  transaction: ExpenseTransaction,
): string {
  return stringValue(
    getField(transaction, [
      "account_name",
      "accountName",
      "account",
      "source_name",
      "sourceName",
      "bank_name",
      "bankName",
      "institution",
    ]),
  );
}

// =====================================================
// Account type
// =====================================================

function getAccountType(
  transaction: ExpenseTransaction,
): string {
  return stringValue(
    getField(transaction, [
      "account_type",
      "accountType",
      "payment_type",
      "paymentType",
      "source_type",
      "sourceType",
    ]),
  );
}

// =====================================================
// Book
// =====================================================

function getBookName(
  transaction: ExpenseTransaction,
): string {
  return stringValue(
    getField(transaction, [
      "book_name",
      "bookName",
      "ledger_name",
      "ledgerName",
      "book",
      "ledger",
    ]),
  );
}

// =====================================================
// Category
// =====================================================

function getCategory(
  transaction: ExpenseTransaction,
): string {
  return stringValue(
    getField(transaction, [
      "category",
      "category_name",
      "categoryName",
      "sub_category",
      "subCategory",
    ]),
  );
}

// =====================================================
// Merchant
// =====================================================

function getMerchant(
  transaction: ExpenseTransaction,
): string {
  return stringValue(
    getField(transaction, [
      "merchant",
      "merchant_name",
      "merchantName",
      "payee",
      "shop",
      "vendor",
    ]),
  );
}

// =====================================================
// Description
// =====================================================

function getDescription(
  transaction: ExpenseTransaction,
): string {
  return stringValue(
    getField(transaction, [
      "description",
      "memo",
      "note",
      "remark",
      "remarks",
      "title",
      "name",
    ]),
  );
}

// =====================================================
// Payment method text
// =====================================================

function getPaymentText(
  transaction: ExpenseTransaction,
): string {
  return [
    getAccountName(transaction),
    getAccountType(transaction),
    stringValue(
      getField(transaction, [
        "payment_method",
        "paymentMethod",
      ]),
    ),
  ].join(" ");
}

// =====================================================
// Contains
// =====================================================

function containsAny(
  value: string,
  words: string[],
): boolean {
  const text =
    value.toLowerCase();

  return words.some((word) =>
    text.includes(
      word.toLowerCase(),
    ),
  );
}

// =====================================================
// Cash
// =====================================================

function isCash(
  transaction: ExpenseTransaction,
): boolean {
  return containsAny(
    getPaymentText(transaction),
    [
      "cash",
      "现金",
      "现金账户",
    ],
  );
}

// =====================================================
// Bank Card
// =====================================================

function isBankCard(
  transaction: ExpenseTransaction,
): boolean {
  const text =
    getPaymentText(
      transaction,
    );

  return (
    containsAny(text, [
      "debit",
      "借记卡",
      "储蓄卡",
      "银行卡",
      "bank card",
      "bankcard",
    ]) &&
    !containsAny(text, [
      "credit",
      "信用卡",
    ])
  );
}

// =====================================================
// Credit Card
// =====================================================

function isCreditCard(
  transaction: ExpenseTransaction,
): boolean {
  return containsAny(
    getPaymentText(transaction),
    [
      "credit",
      "信用卡",
      "credit card",
      "creditcard",
    ],
  );
}

// =====================================================
// Existing excluded books
// =====================================================

const EXCLUDED_BOOKS = [
  "平账",
  "法24.6",
  "法国出差",
  "借出款",
  "年金",
  "理财",
  "替别人先付",
];

function isExcludedBook(
  bookName: string,
): boolean {
  return EXCLUDED_BOOKS.includes(
    bookName.trim(),
  );
}

// =====================================================
// Expense
// =====================================================

function isExpenseTransaction(
  transaction: ExpenseTransaction,
): boolean {
  const book =
    getBookName(transaction);

  if (
    book &&
    isExcludedBook(book)
  ) {
    return false;
  }

  const direction =
    getDirection(
      transaction,
    );

  if (direction === "inflow") {
    return false;
  }

  if (direction === "outflow") {
    return true;
  }

  return (
    Math.abs(
      getTransactionAmount(
        transaction,
      ),
    ) > 0
  );
}

// =====================================================
// Payload
// =====================================================

function cleanPayload(
  payload: unknown,
): ExpensePayload {
  const raw =
    payload &&
    typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : {};

  const years =
    arrayValue<any>(
      raw.years,
    )
      .map((year) => {
        const xx =
          year?.xx &&
          typeof year.xx === "object"
            ? year.xx
            : {};

        const other =
          year?.other &&
          typeof year.other ===
            "object"
            ? year.other
            : {};

        return {
          year: numberValue(
            year?.year,
          ),

          xx: {
            amount: numberValue(
              xx.amount,
            ),

            categories:
              arrayValue<any>(
                xx.categories,
              )
                .map((item) => ({
                  category:
                    stringValue(
                      item?.category,
                    ),
                  amount:
                    numberValue(
                      item?.amount,
                    ),
                }))
                .filter(
                  (item) =>
                    item.category,
                ),
          },

          other: {
            amount: numberValue(
              other.amount,
            ),

            books:
              arrayValue<any>(
                other.books,
              )
                .map((book) => ({
                  bookName:
                    stringValue(
                      book?.bookName,
                    ),

                  amount:
                    numberValue(
                      book?.amount,
                    ),

                  categories:
                    arrayValue<any>(
                      book?.categories,
                    )
                      .map(
                        (item) => ({
                          category:
                            stringValue(
                              item?.category,
                            ),
                          amount:
                            numberValue(
                              item?.amount,
                            ),
                        }),
                      )
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
                ),
          },

          total: numberValue(
            year?.total,
          ),
        };
      })
      .filter(
        (year) => year.year > 0,
      );

  return {
    years,
  };
}

// =====================================================
// Transactions
// =====================================================

function cleanTransactions(
  value: unknown,
): ExpenseTransaction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is ExpenseTransaction =>
      !!item &&
      typeof item === "object",
  );
}

// =====================================================
// Question date
// =====================================================

function extractDateFromQuestion(
  question: string,
): string | null {
  const match =
    question.match(
      /(20\d{2})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?/,
    );

  if (match) {
    return `${match[1]}-${match[2].padStart(
      2,
      "0",
    )}-${match[3].padStart(
      2,
      "0",
    )}`;
  }

  const slash =
    question.match(
      /(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/,
    );

  if (slash) {
    return `${slash[1]}-${slash[2].padStart(
      2,
      "0",
    )}-${slash[3].padStart(
      2,
      "0",
    )}`;
  }

  return null;
}

// =====================================================
// Question month
// =====================================================

function extractMonthFromQuestion(
  question: string,
): string | null {
  const match =
    question.match(
      /(20\d{2})\s*年\s*(\d{1,2})\s*月/,
    );

  if (match) {
    return `${match[1]}-${match[2].padStart(
      2,
      "0",
    )}`;
  }

  const slash =
    question.match(
      /(20\d{2})[-/](\d{1,2})(?![-/]\d)/,
    );

  if (slash) {
    return `${slash[1]}-${slash[2].padStart(
      2,
      "0",
    )}`;
  }

  return null;
}

// =====================================================
// Question years
// =====================================================

function extractYearsFromQuestion(
  question: string,
): number[] {
  const matches =
    question.match(
      /20\d{2}/g,
    ) || [];

  return Array.from(
    new Set(
      matches.map(Number),
    ),
  );
}

// =====================================================
// 前 N 个月
//
// 支持：
// 前8个月
// 前8月
// 前 8 个月
// 1-8月
// 1~8月
// 1至8月
// 1月到8月
// 截至8月
// 前面8个月
// =====================================================

function extractFirstNMonths(
  question: string,
): number | null {
  const normalized =
    question
      .replace(/\s+/g, "");

  // 前 N 个月
  const first =
    normalized.match(
      /前(?:面)?(\d{1,2})个?月/,
    );

  if (first) {
    const n =
      Number(first[1]);

    if (
      Number.isFinite(n) &&
      n >= 1
    ) {
      return Math.min(
        12,
        n,
      );
    }
  }

  // 1-N 月
  const range =
    normalized.match(
      /1(?:月)?[至到~～\-—](\d{1,2})个?月?/,
    );

  if (range) {
    const n =
      Number(range[1]);

    if (
      Number.isFinite(n) &&
      n >= 1
    ) {
      return Math.min(
        12,
        n,
      );
    }
  }

  // 截至 N 月
  const until =
    normalized.match(
      /截至(\d{1,2})个?月?/,
    );

  if (until) {
    const n =
      Number(until[1]);

    if (
      Number.isFinite(n) &&
      n >= 1
    ) {
      return Math.min(
        12,
        n,
      );
    }
  }

  return null;
}

// =====================================================
// Relative year
// =====================================================

function extractRelativeYears(
  question: string,
): number[] {
  const currentYear =
    new Date().getFullYear();

  if (
    question.includes("今年")
  ) {
    return [currentYear];
  }

  if (
    question.includes("去年")
  ) {
    return [
      currentYear - 1,
    ];
  }

  return [];
}

// =====================================================
// Query scope
// =====================================================

function getQueryScope(
  question: string,
) {
  return {
    date:
      extractDateFromQuestion(
        question,
      ),

    month:
      extractMonthFromQuestion(
        question,
      ),

    years:
      extractYearsFromQuestion(
        question,
      ),

    relativeYears:
      extractRelativeYears(
        question,
      ),

    firstNMonths:
      extractFirstNMonths(
        question,
      ),
  };
}

// =====================================================
// Intent
// =====================================================

type QueryIntent =
  | "annual"
  | "monthly"
  | "payment"
  | "account"
  | "book"
  | "category"
  | "transaction"
  | "comparison"
  | "general";

// =====================================================
// Detect intent
// =====================================================

function detectIntent(
  question: string,
): QueryIntent {
  if (
    containsAny(question, [
      "哪笔",
      "哪一笔",
      "交易明细",
      "消费明细",
      "买了什么",
      "买了哪些",
      "具体买",
      "具体消费",
      "流水",
      "商户",
      "交易记录",
      "具体花",
      "花了什么",
      "消费了什么",
    ])
  ) {
    return "transaction";
  }

  if (
    containsAny(question, [
      "现金",
      "银行卡",
      "借记卡",
      "信用卡",
    ])
  ) {
    return "payment";
  }

  if (
    containsAny(question, [
      "账户",
      "哪个账户",
      "账户消费",
    ])
  ) {
    return "account";
  }

  if (
    containsAny(question, [
      "账本",
      "哪个账本",
      "花在哪里",
    ])
  ) {
    return "book";
  }

  if (
    containsAny(question, [
      "分类",
      "类别",
      "消费结构",
    ])
  ) {
    return "category";
  }

  if (
    containsAny(question, [
      "月份",
      "月度",
      "这个月",
      "本月",
      "上个月",
    ])
  ) {
    return "monthly";
  }

  const years =
    extractYearsFromQuestion(
      question,
    );

  const firstN =
    extractFirstNMonths(
      question,
    );

  if (
    years.length >= 2 ||
    containsAny(question, [
      "同比",
      "相比",
      "下降",
      "上升",
      "变化",
      "趋势",
      "哪一年",
      "对比",
    ])
  ) {
    return "comparison";
  }

  if (
    years.length > 0 ||
    firstN !== null ||
    containsAny(question, [
      "年度",
      "每年",
      "一年",
    ])
  ) {
    return "annual";
  }

  return "general";
}

// =====================================================
// 是否需要交易明细
// =====================================================

function needsTransactionDetails(question: string): boolean {
  const q = normalizeQuestion(question);

  return containsAny(q, [
    "买了什么",
    "买了哪些",
    "具体买",
    "具体消费",
    "具体花",
    "花了什么",
    "消费了什么",
    "哪笔",
    "哪一笔",
    "哪些笔",
    "哪几笔",
    "这几笔",
    "这笔",
    "每一笔",
    "逐笔",
    "明细",
    "交易明细",
    "消费明细",
    "交易记录",
    "流水",
    "商户",
    "具体是哪",
    "分别是多少",
    "分别是哪",
    "详细",
    "详细明细",
  ]);
}

// =====================================================
// 是否询问 xx
// =====================================================

function isXxQuestion(
  question: string,
): boolean {
  const normalized =
    question
      .toLowerCase()
      .replace(/\s+/g, "");

  return (
    normalized.includes("xx") ||
    question.includes("XX")
  );
}

// =====================================================
// 判断某交易是否“明确属于 xx”
//
// 不能因为 description 中出现 xx
// 就直接算成 xx。
// =====================================================

function isExplicitXxTransaction(
  transaction: ExpenseTransaction,
): boolean {
  const exactFields = [
    "book_name",
    "bookName",
    "ledger_name",
    "ledgerName",
    "book",
    "ledger",
    "category",
    "category_name",
    "categoryName",
    "account_name",
    "accountName",
  ];

  for (const field of exactFields) {
    const value =
      stringValue(
        transaction[field],
      );

    if (
      value.toLowerCase() ===
      "xx"
    ) {
      return true;
    }
  }

  return false;
}

// =====================================================
// 判断某交易文本是否提到 xx
//
// 这是“相关交易”，不是官方 xx 消费。
// =====================================================

function hasXxText(
  transaction: ExpenseTransaction,
): boolean {
  const text = [
    getMerchant(transaction),
    getDescription(transaction),
    getBookName(transaction),
    getCategory(transaction),
    getAccountName(transaction),
  ]
    .join(" ")
    .toLowerCase();

  return text.includes("xx");
}

// =====================================================
// 普通时间筛选
// =====================================================

function filterByNormalScope(
  transactions: ExpenseTransaction[],
  question: string,
): ExpenseTransaction[] {
  const scope =
    getQueryScope(question);

  if (scope.date) {
    return transactions.filter(
      (transaction) =>
        getTransactionDate(
          transaction,
        ) === scope.date,
    );
  }

  if (scope.month) {
    return transactions.filter(
      (transaction) =>
        getTransactionMonth(
          transaction,
        ) === scope.month,
    );
  }

  const years =
    scope.years.length
      ? scope.years
      : scope.relativeYears;

  if (years.length) {
    return transactions.filter(
      (transaction) => {
        const year =
          getTransactionYear(
            transaction,
          );

        return (
          year !== null &&
          years.includes(year)
        );
      },
    );
  }

  return transactions;
}

// =====================================================
// 动态前 N 个月时间筛选
//
// 如果指定多个年份：
// 每个年份独立取 1-N 月。
//
// 例如：
// 2025和2026年前11个月
//
// = 2025-01~11
// + 2026-01~11
// =====================================================

function filterByQuestionPeriod(
  transactions: ExpenseTransaction[],
  question: string,
): ExpenseTransaction[] {
  const scope =
    getQueryScope(question);

  const firstN =
    scope.firstNMonths;

  if (!firstN) {
    return filterByNormalScope(
      transactions,
      question,
    );
  }

  const years =
    scope.years.length
      ? scope.years
      : scope.relativeYears;

  return transactions.filter(
    (transaction) => {
      const year =
        getTransactionYear(
          transaction,
        );

      const month =
        getTransactionMonthNumber(
          transaction,
        );

      if (
        year === null ||
        month === null
      ) {
        return false;
      }

      if (
        month < 1 ||
        month > firstN
      ) {
        return false;
      }

      if (
        years.length &&
        !years.includes(year)
      ) {
        return false;
      }

      return true;
    },
  );
}

function extractTransactionKeyword(
  question: string,
): string | null {
  const q = question.trim();

  // =====================================================
  // 明确标签
  // =====================================================

  const labeledPatterns = [
    /(?:账本|账本名称)[：:\s]*([^，。！？,!?；;]+)/,
    /(?:分类|类别)[：:\s]*([^，。！？,!?；;]+)/,
    /(?:商户|商家)[：:\s]*([^，。！？,!?；;]+)/,
  ];

  for (const pattern of labeledPatterns) {
    const match = q.match(pattern);

    if (match?.[1]) {
      const value = match[1]
        .trim()
        .replace(
          /(?:具体是哪几笔|具体是哪一笔|哪几笔|哪一笔|每一笔|逐笔|明细|交易明细|消费明细).*$/,
          "",
        )
        .trim();

      if (value.length >= 2) {
        return value;
      }
    }
  }

  // =====================================================
  // “法藏红包具体是哪11笔”
  // “法藏红包明细”
  // “法藏红包每一笔”
  // =====================================================

  const suffixPattern =
    /^(.{2,30}?)(?:具体是哪几笔|具体是哪一笔|哪几笔|哪一笔|每一笔|逐笔|交易明细|消费明细|明细|具体消费|具体花|具体买)/;

  const suffixMatch = q.match(
    suffixPattern,
  );

  if (suffixMatch?.[1]) {
    return suffixMatch[1].trim();
  }

  return null;
}

// =====================================================
// 程序端交易查询
// =====================================================

function selectRelevantTransactions(
  transactions: ExpenseTransaction[],
  question: string,
): ExpenseTransaction[] {
  // =====================================================
  // 第一步：
  // 先按照用户问题确定时间范围
  //
  // 例如：
  // 2025年前8个月
  // → 2025-01 ~ 2025-08
  //
  // 2025和2026年前8个月
  // → 分别筛选两个年份的 1~8 月
  // =====================================================

  let selected = filterByQuestionPeriod(
    transactions,
    question,
  );

  // =====================================================
  // 第二步：
  // XX 专用筛选
  //
  // 注意：
  // 这里仍然保持原来的 XX 规则。
  // 不把普通包含 "xx" 的文字误认为 ExpensePage
  // 官方 XX。
  // =====================================================

  if (isXxQuestion(question)) {
    const explicit = selected.filter(
      isExplicitXxTransaction,
    );

    const textRelated = selected.filter(
      hasXxText,
    );

    selected = Array.from(
      new Set([
        ...explicit,
        ...textRelated,
      ]),
    );
  }

  // =====================================================
  // 第三步：
  // 如果用户问的是消费 / 支出，
  // 只保留真正的消费交易。
  //
  // 继续使用原来的 isExpenseTransaction，
  // 不改变 ExpensePage 的消费规则。
  // =====================================================

  const normalizedQuestion =
    normalizeQuestion(question);

  if (
    containsAny(normalizedQuestion, [
      "消费",
      "花费",
      "支出",
      "用了多少",
      "花了多少",
      "多少钱",
      "花了",
      "用了",
      "消费了",
      "支出了",
    ])
  ) {
    selected = selected.filter(
      isExpenseTransaction,
    );
  }

  // =====================================================
  // 第四步：
  // 只有用户明确要求“明细”时，
  // 才根据问题中的具体对象继续筛选。
  //
  // 例如：
  //
  // “2025年前8个月法藏红包具体是哪11笔”
  //
  // 这里 keyword = “法藏红包”
  //
  // 然后从已经经过：
  //
  // 6183笔
  //   ↓
  // 2025年
  //   ↓
  // 1~8月
  //   ↓
  // 消费交易
  //
  // 的数据中继续筛选“法藏红包”。
  // =====================================================

  if (needsTransactionDetails(question)) {
    const keyword =
      extractTransactionKeyword(question);

    if (keyword) {
      const normalizedKeyword =
        normalizeQuestion(keyword);

      const candidates = selected.filter(
        (transaction) => {
          const fields = [
            getBookName(transaction),
            getCategory(transaction),
            getMerchant(transaction),
            getDescription(transaction),
            getAccountName(transaction),
          ]
            .filter(
              (value): value is string =>
                Boolean(value),
            )
            .map((value) =>
              normalizeQuestion(value),
            );

          return fields.some(
            (field) =>
              field.includes(
                normalizedKeyword,
              ) ||
              normalizedKeyword.includes(
                field,
              ),
          );
        },
      );

      // ===================================================
      // 只有确实找到匹配交易时才替换。
      //
      // 防止自然语言解析失败导致：
      //
      // selected = []
      //
      // ===================================================

      if (candidates.length > 0) {
        selected = candidates;
      }
    }
  }

  return selected;
}
// =====================================================
// Compact transaction
// =====================================================

function compactTransaction(
  transaction: ExpenseTransaction,
) {
  return {
    transactionTime:
      getTransactionTime(
        transaction,
      ),

    date:
      getTransactionDate(
        transaction,
      ),

    amount:
      getTransactionAmount(
        transaction,
      ),

    accountName:
      getAccountName(
        transaction,
      ),

    accountType:
      getAccountType(
        transaction,
      ),

    bookName:
      getBookName(
        transaction,
      ),

    category:
      getCategory(
        transaction,
      ),

    merchant:
      getMerchant(
        transaction,
      ),

    description:
      getDescription(
        transaction,
      ),

    explicitXx:
      isExplicitXxTransaction(
        transaction,
      ),

    xxTextMatch:
      hasXxText(transaction),
  };
}

// =====================================================
// Add map
// =====================================================

function addMap(
  map: Map<string, number>,
  key: string,
  value: number,
) {
  const safeKey =
    key || "未分类";

  map.set(
    safeKey,
    (map.get(safeKey) || 0) +
      value,
  );
}

// =====================================================
// Add nested year/category map
// =====================================================

function addNestedMap(
  map: Map<number, Map<string, number>>,
  year: number,
  key: string,
  value: number,
) {
  if (!map.has(year)) {
    map.set(
      year,
      new Map<string, number>(),
    );
  }

  addMap(
    map.get(year)!,
    key,
    value,
  );
}

// =====================================================
// Add nested year/category count
// =====================================================

function addNestedCountMap(
  map: Map<number, Map<string, number>>,
  year: number,
  key: string,
) {
  if (!map.has(year)) {
    map.set(
      year,
      new Map<string, number>(),
    );
  }

  const target =
    map.get(year)!;

  target.set(
    key || "未分类",
    (target.get(
      key || "未分类",
    ) || 0) + 1,
  );
}

// =====================================================
// Zero-filled months
// =====================================================

function buildZeroFilledMonths(
  year: number,
  maxMonth: number,
  monthAmount: Map<string, number>,
  monthCount: Map<string, number>,
): MonthlyFact[] {
  const result: MonthlyFact[] = [];

  for (
    let month = 1;
    month <= maxMonth;
    month += 1
  ) {
    const monthKey =
      `${year}-${String(
        month,
      ).padStart(2, "0")}`;

    result.push({
      month: monthKey,

      amount:
        monthAmount.get(
          monthKey,
        ) || 0,

      transactionCount:
        monthCount.get(
          monthKey,
        ) || 0,
    });
  }

  return result;
}

// =====================================================
// Build year first N fact
// =====================================================

function buildFirstNYearFact(
  year: number,
  months: number,
  monthAmount: Map<string, number>,
  monthCount: Map<string, number>,
  categoryAmount: Map<string, number>,
  categoryCount: Map<string, number>,
): YearFirstNFact {
  const monthly =
    buildZeroFilledMonths(
      year,
      months,
      monthAmount,
      monthCount,
    );

  const amount =
    monthly.reduce(
      (sum, item) =>
        sum + item.amount,
      0,
    );

  const transactionCount =
    monthly.reduce(
      (sum, item) =>
        sum +
        item.transactionCount,
      0,
    );

  const categories =
    Array.from(
      categoryAmount.entries(),
    )
      .map(
        ([name, value]) => ({
          name,
          amount: value,
          transactionCount:
            categoryCount.get(
              name,
            ) || 0,
        }),
      )
      .sort(
        (a, b) =>
          b.amount -
          a.amount,
      );

  return {
    year,
    months,
    amount,
    transactionCount,
    monthly,
    categories,
  };
}

// =====================================================
// CFO Facts
// =====================================================

type CFOFacts = {
  query: {
    question: string;
    intent: QueryIntent;
    date: string | null;
    month: string | null;
    years: number[];
    firstNMonths: number | null;
    isXxQuestion: boolean;
  };

  source: {
    totalTransactions: number;
    scopedTransactions: number;
    expenseTransactions: number;
  };

  flow: {
    inflow: number;
    outflow: number;
    netCashFlow: number;
  };

  expense: {
    total: number;
    transactionCount: number;
  };

  payment: {
    cash: number;
    bankCard: number;
    creditCard: number;
    other: number;
  };

  accounts: {
    name: string;
    amount: number;
    transactionCount: number;
  }[];

  books: {
    name: string;
    amount: number;
    transactionCount: number;
  }[];

  categories: {
    name: string;
    amount: number;
    transactionCount: number;
  }[];

  monthly: MonthlyFact[];

  yearly: {
    year: number;
    amount: number;
    transactionCount: number;
  }[];

  xxRelated: {
    explicitFieldXxTransactionCount: number;
    explicitFieldXxAmount: number;

    explicitFieldXxByYear: {
      year: number;
      amount: number;
      transactionCount: number;
    }[];

    explicitFieldXxByMonth: MonthlyFact[];

    explicitFieldXxFirstNMonthsByYear:
      YearFirstNFact[];

    explicitFieldXxCategoriesByYear: {
      year: number;
      categories: CategoryFact[];
    }[];

    textRelatedTransactionCount: number;
    textRelatedAmount: number;

    textRelatedByYear: {
      year: number;
      amount: number;
      transactionCount: number;
    }[];

    textRelatedByMonth: MonthlyFact[];

    textRelatedFirstNMonthsByYear:
      YearFirstNFact[];

    textRelatedCategoriesByYear: {
      year: number;
      categories: CategoryFact[];
    }[];
  };

  firstN: FirstNFacts | null;
};

// =====================================================
// Build CFO Facts
// =====================================================

function buildCFOFacts(
  transactions: ExpenseTransaction[],
  question: string,
): CFOFacts {
  const scoped =
    filterByQuestionPeriod(
      transactions,
      question,
    );

  const scope =
    getQueryScope(question);

  let inflow = 0;
  let outflow = 0;

  let expenseTotal = 0;
  let expenseCount = 0;

  let cash = 0;
  let bankCard = 0;
  let creditCard = 0;
  let other = 0;

  const accountAmount =
    new Map<string, number>();

  const accountCount =
    new Map<string, number>();

  const bookAmount =
    new Map<string, number>();

  const bookCount =
    new Map<string, number>();

  const categoryAmount =
    new Map<string, number>();

  const categoryCount =
    new Map<string, number>();

  const monthAmount =
    new Map<string, number>();

  const monthCount =
    new Map<string, number>();

  const yearAmount =
    new Map<number, number>();

  const yearCount =
    new Map<number, number>();

  // ===================================================
  // XX
  //
  // 这里只统计消费交易。
  //
  // 明确字段 = xx
  // 与
  // 文本出现 xx
  //
  // 分开。
  // ===================================================

  let explicitXxAmount = 0;
  let explicitXxCount = 0;

  let textXxAmount = 0;
  let textXxCount = 0;

  const explicitXxYearAmount =
    new Map<number, number>();

  const explicitXxYearCount =
    new Map<number, number>();

  const explicitXxMonthAmount =
    new Map<string, number>();

  const explicitXxMonthCount =
    new Map<string, number>();

  const explicitXxCategoryYearAmount =
    new Map<
      number,
      Map<string, number>
    >();

  const explicitXxCategoryYearCount =
    new Map<
      number,
      Map<string, number>
    >();

  const textXxYearAmount =
    new Map<number, number>();

  const textXxYearCount =
    new Map<number, number>();

  const textXxMonthAmount =
    new Map<string, number>();

  const textXxMonthCount =
    new Map<string, number>();

  const textXxCategoryYearAmount =
    new Map<
      number,
      Map<string, number>
    >();

  const textXxCategoryYearCount =
    new Map<
      number,
      Map<string, number>
    >();

  // ===================================================
  // 遍历全部程序筛选交易
  // ===================================================

  for (const transaction of scoped) {
    const rawAmount =
      getTransactionAmount(
        transaction,
      );

    const amount =
      Math.abs(rawAmount);

    if (!amount) {
      continue;
    }

    const direction =
      getDirection(
        transaction,
      );

    if (
      direction === "inflow"
    ) {
      inflow += amount;
    }

    if (
      direction === "outflow"
    ) {
      outflow += amount;
    }

    const expense =
      isExpenseTransaction(
        transaction,
      );

    // =================================================
    // XX
    //
    // 必须只针对消费交易。
    // =================================================

    if (expense) {
      const explicitXx =
        isExplicitXxTransaction(
          transaction,
        );

      const textXx =
        hasXxText(transaction);

      const year =
        getTransactionYear(
          transaction,
        );

      const month =
        getTransactionMonth(
          transaction,
        );

      const category =
        getCategory(
          transaction,
        ) ||
        "未分类";

      if (explicitXx) {
        explicitXxAmount += amount;
        explicitXxCount += 1;

        if (year !== null) {
          explicitXxYearAmount.set(
            year,
            (explicitXxYearAmount.get(
              year,
            ) || 0) + amount,
          );

          explicitXxYearCount.set(
            year,
            (explicitXxYearCount.get(
              year,
            ) || 0) + 1,
          );

          addNestedMap(
            explicitXxCategoryYearAmount,
            year,
            category,
            amount,
          );

          addNestedCountMap(
            explicitXxCategoryYearCount,
            year,
            category,
          );
        }

        if (month) {
          addMap(
            explicitXxMonthAmount,
            month,
            amount,
          );

          addMap(
            explicitXxMonthCount,
            month,
            1,
          );
        }
      }

      if (
        textXx &&
        !explicitXx
      ) {
        textXxAmount += amount;
        textXxCount += 1;

        if (year !== null) {
          textXxYearAmount.set(
            year,
            (textXxYearAmount.get(
              year,
            ) || 0) + amount,
          );

          textXxYearCount.set(
            year,
            (textXxYearCount.get(
              year,
            ) || 0) + 1,
          );

          addNestedMap(
            textXxCategoryYearAmount,
            year,
            category,
            amount,
          );

          addNestedCountMap(
            textXxCategoryYearCount,
            year,
            category,
          );
        }

        if (month) {
          addMap(
            textXxMonthAmount,
            month,
            amount,
          );

          addMap(
            textXxMonthCount,
            month,
            1,
          );
        }
      }
    }

    // =================================================
    // 消费
    // =================================================

    if (!expense) {
      continue;
    }

    expenseTotal += amount;
    expenseCount += 1;

    const account =
      getAccountName(
        transaction,
      ) ||
      "未分类账户";

    const book =
      getBookName(
        transaction,
      ) ||
      "未分类账本";

    const category =
      getCategory(
        transaction,
      ) ||
      "未分类";

    addMap(
      accountAmount,
      account,
      amount,
    );

    addMap(
      accountCount,
      account,
      1,
    );

    addMap(
      bookAmount,
      book,
      amount,
    );

    addMap(
      bookCount,
      book,
      1,
    );

    addMap(
      categoryAmount,
      category,
      amount,
    );

    addMap(
      categoryCount,
      category,
      1,
    );

    // =================================================
    // 支付方式
    // =================================================

    if (
      isCash(transaction)
    ) {
      cash += amount;
    } else if (
      isBankCard(transaction)
    ) {
      bankCard += amount;
    } else if (
      isCreditCard(transaction)
    ) {
      creditCard += amount;
    } else {
      other += amount;
    }

    // =================================================
    // 月
    // =================================================

    const month =
      getTransactionMonth(
        transaction,
      );

    if (month) {
      addMap(
        monthAmount,
        month,
        amount,
      );

      addMap(
        monthCount,
        month,
        1,
      );
    }

    // =================================================
    // 年
    // =================================================

    const year =
      getTransactionYear(
        transaction,
      );

    if (year !== null) {
      yearAmount.set(
        year,
        (yearAmount.get(
          year,
        ) || 0) + amount,
      );

      yearCount.set(
        year,
        (yearCount.get(
          year,
        ) || 0) + 1,
      );
    }
  }

  // ===================================================
  // Accounts
  // ===================================================

  const accounts =
    Array.from(
      accountAmount.entries(),
    )
      .map(
        ([name, amount]) => ({
          name,
          amount,
          transactionCount:
            accountCount.get(
              name,
            ) || 0,
        }),
      )
      .sort(
        (a, b) =>
          b.amount - a.amount,
      );

  // ===================================================
  // Books
  // ===================================================

  const books =
    Array.from(
      bookAmount.entries(),
    )
      .map(
        ([name, amount]) => ({
          name,
          amount,
          transactionCount:
            bookCount.get(
              name,
            ) || 0,
        }),
      )
      .sort(
        (a, b) =>
          b.amount - a.amount,
      );

  // ===================================================
  // Categories
  // ===================================================

  const categories =
    Array.from(
      categoryAmount.entries(),
    )
      .map(
        ([name, amount]) => ({
          name,
          amount,
          transactionCount:
            categoryCount.get(
              name,
            ) || 0,
        }),
      )
      .sort(
        (a, b) =>
          b.amount - a.amount,
      );

  // ===================================================
  // Monthly
  // ===================================================

  const monthly =
    Array.from(
      monthAmount.entries(),
    )
      .map(
        ([month, amount]) => ({
          month,
          amount,
          transactionCount:
            monthCount.get(
              month,
            ) || 0,
        }),
      )
      .sort(
        (a, b) =>
          a.month.localeCompare(
            b.month,
          ),
      );

  // ===================================================
  // Yearly
  // ===================================================

  const yearly =
    Array.from(
      yearAmount.entries(),
    )
      .map(
        ([year, amount]) => ({
          year,
          amount,
          transactionCount:
            yearCount.get(
              year,
            ) || 0,
        }),
      )
      .sort(
        (a, b) =>
          a.year - b.year,
      );

  // ===================================================
  // Explicit XX by year
  // ===================================================

  const explicitXxByYear =
    Array.from(
      explicitXxYearAmount.entries(),
    )
      .map(
        ([year, amount]) => ({
          year,
          amount,
          transactionCount:
            explicitXxYearCount.get(
              year,
            ) || 0,
        }),
      )
      .sort(
        (a, b) =>
          a.year - b.year,
      );

  // ===================================================
  // Explicit XX by month
  // ===================================================

  const explicitXxByMonth =
    Array.from(
      explicitXxMonthAmount.entries(),
    )
      .map(
        ([month, amount]) => ({
          month,
          amount,
          transactionCount:
            explicitXxMonthCount.get(
              month,
            ) || 0,
        }),
      )
      .sort(
        (a, b) =>
          a.month.localeCompare(
            b.month,
          ),
      );

  // ===================================================
  // Text XX by year
  // ===================================================

  const textRelatedByYear =
    Array.from(
      textXxYearAmount.entries(),
    )
      .map(
        ([year, amount]) => ({
          year,
          amount,
          transactionCount:
            textXxYearCount.get(
              year,
            ) || 0,
        }),
      )
      .sort(
        (a, b) =>
          a.year - b.year,
      );

  // ===================================================
  // Text XX by month
  // ===================================================

  const textRelatedByMonth =
    Array.from(
      textXxMonthAmount.entries(),
    )
      .map(
        ([month, amount]) => ({
          month,
          amount,
          transactionCount:
            textXxMonthCount.get(
              month,
            ) || 0,
        }),
      )
      .sort(
        (a, b) =>
          a.month.localeCompare(
            b.month,
          ),
      );

  // ===================================================
  // XX categories by year
  // ===================================================

  const explicitXxCategoriesByYear =
    Array.from(
      explicitXxCategoryYearAmount.entries(),
    )
      .map(
        ([year, amountMap]) => ({
          year,

          categories:
            Array.from(
              amountMap.entries(),
            )
              .map(
                ([name, amount]) => ({
                  name,
                  amount,
                  transactionCount:
                    explicitXxCategoryYearCount
                      .get(year)
                      ?.get(name) || 0,
                }),
              )
              .sort(
                (a, b) =>
                  b.amount -
                  a.amount,
              ),
        }),
      )
      .sort(
        (a, b) =>
          a.year - b.year,
      );

  const textRelatedCategoriesByYear =
    Array.from(
      textXxCategoryYearAmount.entries(),
    )
      .map(
        ([year, amountMap]) => ({
          year,

          categories:
            Array.from(
              amountMap.entries(),
            )
              .map(
                ([name, amount]) => ({
                  name,
                  amount,
                  transactionCount:
                    textXxCategoryYearCount
                      .get(year)
                      ?.get(name) || 0,
                }),
              )
              .sort(
                (a, b) =>
                  b.amount -
                  a.amount,
              ),
        }),
      )
      .sort(
        (a, b) =>
          a.year - b.year,
      );

  // ===================================================
  // First N months
  // ===================================================

  let firstN: FirstNFacts | null =
    null;

  if (
    scope.firstNMonths
  ) {
    const months =
      scope.firstNMonths;

    const availableYears =
      Array.from(
        new Set(
          scoped
            .map(
              getTransactionYear,
            )
            .filter(
              (
                year,
              ): year is number =>
                year !== null,
            ),
        ),
      ).sort(
        (a, b) =>
          a - b,
      );

    const targetYears =
      scope.years.length
        ? scope.years
        : scope.relativeYears.length
          ? scope.relativeYears
          : availableYears;

    const firstNYears =
      targetYears.map(
        (year) => {
          const monthlyAmount =
            new Map<
              string,
              number
            >();

          const monthlyCount =
            new Map<
              string,
              number
            >();

          const categoryAmount =
            new Map<
              string,
              number
            >();

          const categoryCount =
            new Map<
              string,
              number
            >();

          for (
            const transaction of scoped
          ) {
            if (
              getTransactionYear(
                transaction,
              ) !== year
            ) {
              continue;
            }

            const monthNumber =
              getTransactionMonthNumber(
                transaction,
              );

            if (
              monthNumber ===
                null ||
              monthNumber < 1 ||
              monthNumber > months
            ) {
              continue;
            }

            if (
              !isExpenseTransaction(
                transaction,
              )
            ) {
              continue;
            }

            const amount =
              Math.abs(
                getTransactionAmount(
                  transaction,
                ),
              );

            if (!amount) {
              continue;
            }

            const month =
              getTransactionMonth(
                transaction,
              );

            if (month) {
              addMap(
                monthlyAmount,
                month,
                amount,
              );

              addMap(
                monthlyCount,
                month,
                1,
              );
            }

            addMap(
              categoryAmount,
              getCategory(
                transaction,
              ) ||
                "未分类",
              amount,
            );

            addMap(
              categoryCount,
              getCategory(
                transaction,
              ) ||
                "未分类",
              1,
            );
          }

          return buildFirstNYearFact(
            year,
            months,
            monthlyAmount,
            monthlyCount,
            categoryAmount,
            categoryCount,
          );
        },
      );

    firstN = {
      months,
      years:
        firstNYears,
    };
  }

  // ===================================================
  // Explicit XX first N
  // ===================================================

  const explicitXxFirstNMonthsByYear: YearFirstNFact[] =
    [];

  const textRelatedFirstNMonthsByYear: YearFirstNFact[] =
    [];

  if (
    scope.firstNMonths
  ) {
    const months =
      scope.firstNMonths;

    const availableYears =
      Array.from(
        new Set(
          scoped
            .map(
              getTransactionYear,
            )
            .filter(
              (
                year,
              ): year is number =>
                year !== null,
            ),
        ),
      ).sort(
        (a, b) =>
          a - b,
      );

    const targetYears =
      scope.years.length
        ? scope.years
        : scope.relativeYears.length
          ? scope.relativeYears
          : availableYears;

    for (
      const year of targetYears
    ) {
      const explicitMonthAmount =
        new Map<
          string,
          number
        >();

      const explicitMonthCount =
        new Map<
          string,
          number
        >();

      const explicitCategoryAmount =
        new Map<
          string,
          number
        >();

      const explicitCategoryCount =
        new Map<
          string,
          number
        >();

      const textMonthAmount =
        new Map<
          string,
          number
        >();

      const textMonthCount =
        new Map<
          string,
          number
        >();

      const textCategoryAmount =
        new Map<
          string,
          number
        >();

      const textCategoryCount =
        new Map<
          string,
          number
        >();

      for (
        const transaction of scoped
      ) {
        if (
          getTransactionYear(
            transaction,
          ) !== year
        ) {
          continue;
        }

        const monthNumber =
          getTransactionMonthNumber(
            transaction,
          );

        if (
          monthNumber ===
            null ||
          monthNumber < 1 ||
          monthNumber > months
        ) {
          continue;
        }

        if (
          !isExpenseTransaction(
            transaction,
          )
        ) {
          continue;
        }

        const amount =
          Math.abs(
            getTransactionAmount(
              transaction,
            ),
          );

        if (!amount) {
          continue;
        }

        const month =
          getTransactionMonth(
            transaction,
          );

        const category =
          getCategory(
            transaction,
          ) ||
          "未分类";

        const explicitXx =
          isExplicitXxTransaction(
            transaction,
          );

        const textXx =
          hasXxText(transaction);

        if (
          explicitXx
        ) {
          if (month) {
            addMap(
              explicitMonthAmount,
              month,
              amount,
            );

            addMap(
              explicitMonthCount,
              month,
              1,
            );
          }

          addMap(
            explicitCategoryAmount,
            category,
            amount,
          );

          addMap(
            explicitCategoryCount,
            category,
            1,
          );
        }

        if (
          textXx &&
          !explicitXx
        ) {
          if (month) {
            addMap(
              textMonthAmount,
              month,
              amount,
            );

            addMap(
              textMonthCount,
              month,
              1,
            );
          }

          addMap(
            textCategoryAmount,
            category,
            amount,
          );

          addMap(
            textCategoryCount,
            category,
            1,
          );
        }
      }

      explicitXxFirstNMonthsByYear.push(
        buildFirstNYearFact(
          year,
          months,
          explicitMonthAmount,
          explicitMonthCount,
          explicitCategoryAmount,
          explicitCategoryCount,
        ),
      );

      textRelatedFirstNMonthsByYear.push(
        buildFirstNYearFact(
          year,
          months,
          textMonthAmount,
          textMonthCount,
          textCategoryAmount,
          textCategoryCount,
        ),
      );
    }
  }

  // ===================================================
  // Query
  // ===================================================

  return {
    query: {
      question,

      intent:
        detectIntent(question),

      date: scope.date,

      month: scope.month,

      years:
        scope.years.length
          ? scope.years
          : scope.relativeYears,

      firstNMonths:
        scope.firstNMonths,

      isXxQuestion:
        isXxQuestion(question),
    },

    source: {
      totalTransactions:
        transactions.length,

      scopedTransactions:
        scoped.length,

      expenseTransactions:
        expenseCount,
    },

    flow: {
      inflow,
      outflow,
      netCashFlow:
        inflow - outflow,
    },

    expense: {
      total: expenseTotal,
      transactionCount:
        expenseCount,
    },

    payment: {
      cash,
      bankCard,
      creditCard,
      other,
    },

    accounts,
    books,
    categories,
    monthly,
    yearly,

    xxRelated: {
      explicitFieldXxTransactionCount: explicitXxCount,
  explicitFieldXxAmount: explicitXxAmount,

  explicitFieldXxByYear: explicitXxByYear,
  explicitFieldXxByMonth: explicitXxByMonth,
  explicitFieldXxFirstNMonthsByYear: explicitXxFirstNMonthsByYear,
  explicitFieldXxCategoriesByYear: explicitXxCategoriesByYear,

  textRelatedTransactionCount: textXxCount,
  textRelatedAmount: textXxAmount,
  textRelatedByYear,
  textRelatedByMonth,
  textRelatedFirstNMonthsByYear,
  textRelatedCategoriesByYear,
    },

    firstN,
  };
}

// =====================================================
// CFO Facts 文本
// =====================================================

function buildCFOFactsText(
  facts: CFOFacts,
): string {
  const lines: string[] = [];

  lines.push(
    "========== CFO PROGRAM FACTS ==========",
  );

  lines.push(
    `问题：${facts.query.question}`,
  );

  lines.push(
    `问题类型：${facts.query.intent}`,
  );

  lines.push(
    `原始交易总数：${facts.source.totalTransactions}`,
  );

  lines.push(
    `本次程序时间范围筛选：${facts.source.scopedTransactions}笔`,
  );

  lines.push(
    `消费交易：${facts.source.expenseTransactions}笔`,
  );

  if (
    facts.query.firstNMonths
  ) {
    lines.push(
      `本次识别的前N个月：前${facts.query.firstNMonths}个月`,
    );
  }

  lines.push("");

  // ===================================================
  // Flow
  // ===================================================

  lines.push("【现金流】");

  lines.push(
    `收入：¥${facts.flow.inflow.toFixed(2)}`,
  );

  lines.push(
    `支出：¥${facts.flow.outflow.toFixed(2)}`,
  );

  lines.push(
    `净现金流：¥${facts.flow.netCashFlow.toFixed(2)}`,
  );

  lines.push("");

  // ===================================================
  // Expense
  // ===================================================

  lines.push("【消费】");

  lines.push(
    `消费总额：¥${facts.expense.total.toFixed(2)}`,
  );

  lines.push(
    `消费笔数：${facts.expense.transactionCount}`,
  );

  lines.push("");

  // ===================================================
  // Payment
  // ===================================================

  lines.push("【支付方式】");

  lines.push(
    `现金：¥${facts.payment.cash.toFixed(2)}`,
  );

  lines.push(
    `银行卡：¥${facts.payment.bankCard.toFixed(2)}`,
  );

  lines.push(
    `信用卡：¥${facts.payment.creditCard.toFixed(2)}`,
  );

  lines.push(
    `其他：¥${facts.payment.other.toFixed(2)}`,
  );

  lines.push("");

  // ===================================================
  // Accounts
  // ===================================================

  lines.push("【账户】");

  for (const item of facts.accounts) {
    lines.push(
      `${item.name}: ¥${item.amount.toFixed(
        2,
      )} / ${item.transactionCount}笔`,
    );
  }

  lines.push("");

  // ===================================================
  // Books
  // ===================================================

  lines.push("【账本】");

  for (const item of facts.books) {
    lines.push(
      `${item.name}: ¥${item.amount.toFixed(
        2,
      )} / ${item.transactionCount}笔`,
    );
  }

  lines.push("");

  // ===================================================
  // Categories
  // ===================================================

  lines.push("【分类】");

  for (const item of facts.categories) {
    lines.push(
      `${item.name}: ¥${item.amount.toFixed(
        2,
      )} / ${item.transactionCount}笔`,
    );
  }

  lines.push("");

  // ===================================================
  // Monthly
  // ===================================================

  lines.push("【月度消费】");

  for (const item of facts.monthly) {
    lines.push(
      `${item.month}: ¥${item.amount.toFixed(
        2,
      )} / ${item.transactionCount}笔`,
    );
  }

  lines.push("");

  // ===================================================
  // Yearly
  // ===================================================

  lines.push("【程序交易年度统计】");

  for (const item of facts.yearly) {
    lines.push(
      `${item.year}年: ¥${item.amount.toFixed(
        2,
      )} / ${item.transactionCount}笔`,
    );
  }

  lines.push("");

  // ===================================================
  // First N months
  // ===================================================

  if (
    facts.firstN
  ) {
    lines.push(
      `【前${facts.firstN.months}个月完整消费统计】`,
    );

    for (
      const year of facts.firstN.years
    ) {
      lines.push(
        `${year.year}年前${year.months}个月消费：¥${year.amount.toFixed(
          2,
        )} / ${year.transactionCount}笔`,
      );

      lines.push(
        "月度：",
      );

      for (
        const item of year.monthly
      ) {
        lines.push(
          `  ${item.month}: ¥${item.amount.toFixed(
            2,
          )} / ${item.transactionCount}笔`,
        );
      }

      lines.push(
        "分类：",
      );

      for (
        const item of year.categories
      ) {
        lines.push(
          `  ${item.name}: ¥${item.amount.toFixed(
            2,
          )} / ${item.transactionCount}笔`,
        );
      }
    }

    lines.push("");
  }

  // ===================================================
  // XX
  // ===================================================

  lines.push(
    "【XX交易级分析】",
  );

  lines.push(
    "注意：以下全部属于交易级程序分析，不是 ExpensePage 官方月度 XX。",
  );

  lines.push(
    `明确字段等于 xx 的消费交易：${facts.xxRelated.explicitFieldXxTransactionCount}笔`,
  );

  lines.push(
    `明确字段等于 xx 的消费金额：¥${facts.xxRelated.explicitFieldXxAmount.toFixed(
      2,
    )}`,
  );

  lines.push("");

  lines.push(
    "【明确字段等于 xx：按年度】",
  );

  for (
    const item of
      facts.xxRelated
        .explicitFieldXxByYear
  ) {
    lines.push(
      `${item.year}年：¥${item.amount.toFixed(
        2,
      )} / ${item.transactionCount}笔`,
    );
  }

  lines.push("");

  lines.push(
    "【明确字段等于 xx：按月份】",
  );

  for (
    const item of
      facts.xxRelated
        .explicitFieldXxByMonth
  ) {
    lines.push(
      `${item.month}: ¥${item.amount.toFixed(
        2,
      )} / ${item.transactionCount}笔`,
    );
  }

  lines.push("");

  lines.push(
    "【明确字段等于 xx：年度分类】",
  );

  for (
    const year of
      facts.xxRelated
        .explicitFieldXxCategoriesByYear
  ) {
    lines.push(
      `${year.year}年：`,
    );

    for (
      const category of
        year.categories
    ) {
      lines.push(
        `  ${category.name}: ¥${category.amount.toFixed(
          2,
        )} / ${category.transactionCount}笔`,
      );
    }
  }

  lines.push("");

  if (
    facts.query.firstNMonths
  ) {
    lines.push(
      `【XX交易级前${facts.query.firstNMonths}个月：按年份】`,
    );

    for (
      const year of
        facts.xxRelated
          .explicitFieldXxFirstNMonthsByYear
    ) {
      lines.push(
        `${year.year}年前${year.months}个月：¥${year.amount.toFixed(
          2,
        )} / ${year.transactionCount}笔`,
      );

      lines.push(
        "月度：",
      );

      for (
        const month of year.monthly
      ) {
        lines.push(
          `  ${month.month}: ¥${month.amount.toFixed(
            2,
          )} / ${month.transactionCount}笔`,
        );
      }

      lines.push(
        "分类：",
      );

      for (
        const category of year.categories
      ) {
        lines.push(
          `  ${category.name}: ¥${category.amount.toFixed(
            2,
          )} / ${category.transactionCount}笔`,
        );
      }
    }

    lines.push("");
  }

  // ===================================================
  // Text related XX
  // ===================================================

  lines.push(
    "【XX文本相关交易】",
  );

  lines.push(
    "这里指：交易文本中出现 xx，但明确字段不是 xx。",
  );

  lines.push(
    `文本相关交易：${facts.xxRelated.textRelatedTransactionCount}笔`,
  );

  lines.push(
    `文本相关交易金额：¥${facts.xxRelated.textRelatedAmount.toFixed(
      2,
    )}`,
  );

  lines.push("");

  lines.push(
    "【文本相关交易：按年度】",
  );

  for (
    const item of
      facts.xxRelated
        .textRelatedByYear
  ) {
    lines.push(
      `${item.year}年：¥${item.amount.toFixed(
        2,
      )} / ${item.transactionCount}笔`,
    );
  }

  lines.push("");

  lines.push(
    "【文本相关交易：年度分类】",
  );

  for (
    const year of
      facts.xxRelated
        .textRelatedCategoriesByYear
  ) {
    lines.push(
      `${year.year}年：`,
    );

    for (
      const category of
        year.categories
    ) {
      lines.push(
        `  ${category.name}: ¥${category.amount.toFixed(
          2,
        )} / ${category.transactionCount}笔`,
      );
    }
  }

  lines.push("");

  if (
    facts.query.firstNMonths
  ) {
    lines.push(
      `【XX文本相关交易前${facts.query.firstNMonths}个月】`,
    );

    for (
      const year of
        facts.xxRelated
          .textRelatedFirstNMonthsByYear
    ) {
      lines.push(
        `${year.year}年前${year.months}个月：¥${year.amount.toFixed(
          2,
        )} / ${year.transactionCount}笔`,
      );

      lines.push(
        "月度：",
      );

      for (
        const month of year.monthly
      ) {
        lines.push(
          `  ${month.month}: ¥${month.amount.toFixed(
            2,
          )} / ${month.transactionCount}笔`,
        );
      }

      lines.push(
        "分类：",
      );

      for (
        const category of year.categories
      ) {
        lines.push(
          `  ${category.name}: ¥${category.amount.toFixed(
            2,
          )} / ${category.transactionCount}笔`,
        );
      }
    }
  }

  lines.push("");

  lines.push(
    "========== END CFO PROGRAM FACTS ==========",
  );

  return lines.join("\n");
}

// =====================================================
// Annual ExpensePage facts
// =====================================================

function buildAnnualAuthorityText(
  payload: ExpensePayload,
): string {
  const lines: string[] = [];

  lines.push(
    "========== EXPENSEPAGE OFFICIAL ANNUAL DATA ==========",
  );

  for (const year of payload.years) {
    lines.push(
      `${year.year}年：`,
    );

    lines.push(
      `  XX：¥${year.xx.amount.toFixed(2)}`,
    );

    lines.push(
      `  其他：¥${year.other.amount.toFixed(2)}`,
    );

    lines.push(
      `  总消费：¥${year.total.toFixed(2)}`,
    );

    if (
      year.xx.categories.length
    ) {
      lines.push(
        "  XX分类：",
      );

      for (const item of year.xx
        .categories) {
        lines.push(
          `    ${item.category}: ¥${item.amount.toFixed(
            2,
          )}`,
        );
      }
    } else {
      lines.push(
        "  XX分类：空",
      );
    }

    if (
      year.other.books.length
    ) {
      lines.push(
        "  其他账本：",
      );

      for (const book of year.other
        .books) {
        lines.push(
          `    ${book.bookName}: ¥${book.amount.toFixed(
            2,
          )}`,
        );
      }
    } else {
      lines.push(
        "  其他账本：空",
      );
    }
  }

  lines.push(
    "========== END EXPENSEPAGE OFFICIAL ANNUAL DATA ==========",
  );

  return lines.join("\n");
}

// =====================================================
// Selected transaction text
// =====================================================

const MAX_DETAIL_TRANSACTIONS =
  300;

function buildSelectedTransactionText(
  transactions: ExpenseTransaction[],
  question: string,
): {
  count: number;
  totalSelected: number;
  text: string;
} {
  const selected =
    selectRelevantTransactions(
      transactions,
      question,
    );

  const limited =
    selected.slice(
      0,
      MAX_DETAIL_TRANSACTIONS,
    );

  const compact =
    limited.map(
      compactTransaction,
    );

  const totalSelected =
    selected.reduce(
      (sum, transaction) =>
        sum +
        Math.abs(
          getTransactionAmount(
            transaction,
          ),
        ),
      0,
    );

  if (!compact.length) {
    return {
      count: selected.length,
      totalSelected,
      text:
        "本问题没有提供交易级明细。",
    };
  }

  return {
    count: selected.length,
    totalSelected,

    text: JSON.stringify(
      compact,
      null,
      2,
    ),
  };
}

// =====================================================
// POST
// =====================================================

export async function POST(
  request: Request,
) {
  try {
    // =================================================
    // API Key
    // =================================================

    if (!DEEPSEEK_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error:
            "DEEPSEEK_API_KEY 未配置",
        },
        {
          status: 500,
        },
      );
    }

    // =================================================
    // Body
    // =================================================

    const body =
      await request.json();

    const question =
      stringValue(
        body?.question,
      );

    if (!question) {
      return NextResponse.json(
        {
          success: false,
          error:
            "请输入问题",
        },
        {
          status: 400,
        },
      );
    }

    // =================================================
    // 官方年度数据
    // =================================================

    const payload =
      cleanPayload(
        body?.payload,
      );

    // =================================================
    // 6183 笔
    //
    // 完整进入程序端。
    // =================================================

    const transactions =
      cleanTransactions(
        body?.transactions ??
          body?.payload?.transactions,
      );

    // =================================================
    // History
    // =================================================

    const history: ChatMessage[] =
      Array.isArray(body?.history)
        ? body.history
            .filter(
              (
                item: any,
              ) =>
                item &&
                (
                  item.role ===
                    "user" ||
                  item.role ===
                    "assistant"
                ) &&
                typeof item.content ===
                  "string",
            )
            .slice(-12)
        : [];

    // =================================================
    // Intent
    // =================================================

    const intent =
      detectIntent(
        question,
      );

    // =================================================
    // CFO Facts
    //
    // 这里使用全部交易。
    //
    // 所有统计在程序端完成。
    // =================================================

    const cfoFacts =
      buildCFOFacts(
        transactions,
        question,
      );

    const cfoFactsText =
      buildCFOFactsText(
        cfoFacts,
      );

    // =================================================
    // ExpensePage 官方数据
    // =================================================

    const annualAuthorityText =
      buildAnnualAuthorityText(
        payload,
      );

    // =================================================
    // 只有必要时才获取交易明细
    // =================================================

    const shouldSendDetails =
      needsTransactionDetails(
        question,
      );

    const selected =
      shouldSendDetails
        ? buildSelectedTransactionText(
            transactions,
            question,
          )
        : {
            count: 0,
            totalSelected: 0,
            text:
              "本问题不需要交易明细。程序没有向 DeepSeek 提供原始交易。",
          };

    // =================================================
    // 外部 systemInstruction
    // =================================================

    const externalInstruction =
      stringValue(
        body?.systemInstruction,
      );

    // =================================================
    // System Prompt
    // =================================================

    const systemPrompt = `
你是 AI Wealth OS 的 AI CFO。

==================================================
最高原则
==================================================

你是解释和决策层，不是统计层。

程序已经完成统计。

你必须使用程序提供的事实。

绝对禁止：

- 自己重新计算
- 从交易明细重新汇总
- 修改程序金额
- 编造数据
- 编造交易
- 编造账本
- 编造分类
- 编造消费原因
- 用全年数据回答前N个月的问题

==================================================
ExpensePage 官方年度数据
==================================================

ExpensePage 已经计算好的年度数据具有最高优先级。

其中：

years[].xx.amount

是 ExpensePage 官方年度 XX。

years[].xx.categories

是 ExpensePage 官方年度 XX 分类。

years[].other.amount

是 ExpensePage 官方其他。

years[].other.books

是 ExpensePage 官方其他账本。

years[].total

是 ExpensePage 官方年度总消费。

不得修改这些数据。

==================================================
XX 的三种口径
==================================================

程序严格区分：

1. ExpensePage 官方年度 XX

2. 明确字段等于 xx 的交易

3. 交易文本中出现 xx、但字段不是 xx 的交易

第二种和第三种都是交易级分析。

不能把交易级分析冒充 ExpensePage 官方 XX。

==================================================
前 N 个月
==================================================

程序支持动态前N个月。

例如：

前3个月

前6个月

前8个月

前10个月

前11个月

前12个月

1-8月

1-11月

1至11月

1月到11月

1~11月

截至11月

前面11个月

均由程序动态计算。

如果问题是：

“2025和2026年前11个月 XX 怎么样？”

程序事实中的：

XX交易级前11个月

就是：

2025年1-11月

2026年1-11月

不能把全年数据拿来回答。

==================================================
前 N 个月 XX
==================================================

如果用户问：

“2025和2026年前8个月 XX 为什么下降？”

必须使用：

【明确字段等于 xx：前8个月】

中的：

- 年度总额
- 年度笔数
- 每月金额
- 每月笔数
- 分类金额
- 分类笔数

直接回答。

如果某个分类导致下降，可以使用程序提供的分类数据解释。

不能说：

“需要程序进一步按月份+分类统计。”

因为程序已经统计。

==================================================
非常重要：没有官方月度 XX
==================================================

ExpensePage 官方数据只有官方年度 XX。

所以：

“前N个月 XX”

属于：

“交易级 XX 分析口径”。

不是：

“ExpensePage 官方月度 XX”。

回答时只需要简短说明一次口径即可。

然后直接回答数据问题。

不能因为没有官方月度 XX 就拒绝回答。

==================================================
6183 笔交易
==================================================

全部交易只在程序端统计。

DeepSeek 不接收全部交易。

只有用户明确询问：

- 哪笔
- 买了什么
- 具体买了什么
- 具体消费
- 具体花了什么
- 交易明细
- 商户
- 流水
- 交易记录

才使用 SELECTED TRANSACTIONS。

==================================================
CFO PROGRAM FACTS
==================================================

CFO PROGRAM FACTS 是程序统计结果。

以下内容必须以程序为准：

- 金额
- 笔数
- 月度
- 年度
- 前N个月
- XX前N个月
- XX分类
- 账本
- 分类
- 账户
- 现金
- 银行卡
- 信用卡

禁止重新计算。

==================================================
交易明细
==================================================

只有 SELECTED TRANSACTIONS 中提供的交易才可以逐笔描述。

如果没有提供交易明细：

不要假装看到了交易。

==================================================
回答
==================================================

中文。

金额使用 ¥。

直接回答。

不要输出 JSON。

不要输出 Markdown 表格。

不要重复冗长解释统计口径。

如果有数据：

直接给结论。

如果有前N个月：

优先给：

1. 前N个月总额
2. 同比变化
3. 月度变化
4. XX变化
5. XX分类变化
6. 最后给可能原因

原因必须区分：

“数据事实”

和

“可能原因”。

不能把推测说成事实。

==================================================
禁止
==================================================

禁止自己从原始交易重新统计。

禁止自己重新计算同比。

禁止把交易文本中的 xx 当成官方 XX。

禁止用全年数据代替前N个月。

禁止用部分交易明细代表完整数据。

禁止因为没有官方月度 XX 而拒绝交易级前N个月分析。

程序已经提供的数据必须直接使用。
==================================================

${externalInstruction || "无"}
`.trim();

    // =================================================
    // User Prompt
    // =================================================

    const userPrompt = `
用户问题：

${question}

==================================================
问题类型
==================================================

${intent}

==================================================
ExpensePage 官方年度数据
==================================================

${annualAuthorityText}

==================================================
CFO PROGRAM FACTS
==================================================

${cfoFactsText}

==================================================
交易明细状态
==================================================

是否需要交易明细：
${shouldSendDetails ? "是" : "否"}

程序筛选出的相关交易：
${selected.count}

实际发送给 DeepSeek：
${
  shouldSendDetails
    ? Math.min(
        selected.count,
        MAX_DETAIL_TRANSACTIONS,
      )
    : 0
}

==================================================
SELECTED TRANSACTIONS
==================================================

${selected.text}

==================================================
原始数据规模
==================================================

原始交易：
${transactions.length}笔

注意：

这些交易全部只在程序端参与分析。

本次 DeepSeek 请求没有接收全部原始交易。

==================================================
历史对话
==================================================

${history
  .map(
    (message) =>
      `${
        message.role ===
        "user"
          ? "用户"
          : "AI CFO"
      }：${message.content}`,
  )
  .join("\n")}

==================================================
现在回答
==================================================

请直接回答用户。

特别注意：

如果用户问 XX：

先区分 ExpensePage 官方年度 XX 与交易级 XX。

如果用户问前N个月：

必须使用 CFO PROGRAM FACTS 中已经计算好的前N个月数据。

如果用户问：

“2025和2026年前11个月 XX 为什么下降？”

必须使用：

2025年前11个月交易级 XX

2026年前11个月交易级 XX

以及前11个月月度和分类数据。

不能再回答：

“程序没有提供前11个月分类数据。”

因为程序已经提供。

如果官方年度 XX 与交易级前N个月 XX 不一致：

不要强行合并。

说明：

“这是不同统计口径。”

然后继续回答用户真正询问的前N个月问题。

`.trim();

    // =================================================
    // DeepSeek
    // =================================================

    const endpoint =
      `${DEEPSEEK_BASE_URL.replace(
        /\/$/,
        "",
      )}/chat/completions`;

    const deepseekResponse =
      await fetch(
        endpoint,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${DEEPSEEK_API_KEY}`,
          },

          body: JSON.stringify({
            model:
              DEEPSEEK_MODEL,

            temperature: 0.2,

            max_tokens: 4000,

            messages: [
              {
                role: "system",
                content:
                  systemPrompt,
              },

              ...history.map(
                (message) => ({
                  role:
                    message.role,
                  content:
                    message.content,
                }),
              ),

              {
                role: "user",
                content:
                  userPrompt,
              },
            ],
          }),
        },
      );

    // =================================================
    // Error
    // =================================================

    if (
      !deepseekResponse.ok
    ) {
      const errorText =
        await deepseekResponse.text();

      console.error(
        "[expense/ai-chat] DeepSeek error:",
        deepseekResponse.status,
        errorText,
      );

      return NextResponse.json(
        {
          success: false,
          error:
            `DeepSeek API 请求失败：${deepseekResponse.status}`,
        },
        {
          status: 502,
        },
      );
    }

    // =================================================
    // Result
    // =================================================

    const result =
      await deepseekResponse.json();

    const answer =
      result?.choices?.[0]
        ?.message?.content;

    if (
      typeof answer !==
        "string" ||
      !answer.trim()
    ) {
      console.error(
        "[expense/ai-chat] empty DeepSeek response:",
        result,
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "DeepSeek 返回内容为空",
        },
        {
          status: 502,
        },
      );
    }

    // =================================================
    // 日志
    // =================================================

    console.log(
      "[expense/ai-chat] completed",
      {
        question,

        intent,

        firstNMonths:
          cfoFacts.query
            .firstNMonths,

        totalTransactions:
          transactions.length,

        scopedTransactions:
          cfoFacts.source
            .scopedTransactions,

        expenseTransactions:
          cfoFacts.source
            .expenseTransactions,

        selectedTransactions:
          selected.count,

        sentToDeepSeek:
          shouldSendDetails
            ? Math.min(
                selected.count,
                MAX_DETAIL_TRANSACTIONS,
              )
            : 0,

        explicitXxTransactions:
          cfoFacts.xxRelated
            .explicitFieldXxTransactionCount,

        explicitXxAmount:
          cfoFacts.xxRelated
            .explicitFieldXxAmount,

        model:
          DEEPSEEK_MODEL,
      },
    );

    // =================================================
    // Response
    // =================================================

    return NextResponse.json({
      success: true,

      answer:
        answer.trim(),

      meta: {
        intent,

        firstNMonths:
          cfoFacts.query
            .firstNMonths,

        totalTransactions:
          transactions.length,

        scopedTransactions:
          cfoFacts.source
            .scopedTransactions,

        expenseTransactions:
          cfoFacts.source
            .expenseTransactions,

        selectedTransactions:
          selected.count,

        sentToDeepSeek:
          shouldSendDetails
            ? Math.min(
                selected.count,
                MAX_DETAIL_TRANSACTIONS,
              )
            : 0,

        hasOfficialXxData:
          payload.years.some(
            (year) =>
              year.xx.amount !== 0 ||
              year.xx.categories
                .length > 0,
          ),

        hasFirstNMonthFacts:
          cfoFacts.firstN !==
          null,

        model:
          DEEPSEEK_MODEL,
      },
    });
  } catch (error) {
    console.error(
      "[expense/ai-chat] fatal:",
      error,
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "AI CFO 服务异常",
      },
      {
        status: 500,
      },
    );
  }
}