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

type XxMonthlyItem = {
  month: string;
  amount: number;
  transactionCount: number;
};

type XxPeriodYearItem = {
  year: number;
  months: number;
  amount: number;
  transactionCount: number;
  monthly: XxMonthlyItem[];
};

type XxComparisonItem = {
  previousYear: number;
  currentYear: number;

  previousAmount: number;
  currentAmount: number;

  changeAmount: number;
  changeRate: number | null;
};

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
    getDirection(transaction);

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
// 前11个月
// 前3个月
// 前11月
// 1-11月
// 1~11月
// 1至11月
// 1月至11月
// 截至11月
// 到11月
// =====================================================

function extractFirstNMonthsFromQuestion(
  question: string,
): number | null {
  const q =
    question.replace(
      /\s+/g,
      "",
    );

  const patterns = [
    /前(\d{1,2})个月/,
    /前(\d{1,2})月/,
    /过去(\d{1,2})个月/,
    /截至(\d{1,2})月/,
    /到(\d{1,2})月/,
    /1[-~至到](\d{1,2})月/,
    /1月[-~至到](\d{1,2})月/,
  ];

  for (const pattern of patterns) {
    const match =
      q.match(pattern);

    if (!match) {
      continue;
    }

    const n =
      Number(match[1]);

    if (
      n >= 1 &&
      n <= 12
    ) {
      return n;
    }
  }

  return null;
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

    firstNMonths:
      extractFirstNMonthsFromQuestion(
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

  const firstNMonths =
    extractFirstNMonthsFromQuestion(
      question,
    );

  if (
    firstNMonths !== null ||
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
    ])
  ) {
    return "comparison";
  }

  if (
    years.length > 0 ||
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

function needsTransactionDetails(
  question: string,
): boolean {
  return containsAny(question, [
    "买了什么",
    "买了哪些",
    "具体买",
    "具体消费",
    "哪笔",
    "哪一笔",
    "交易明细",
    "消费明细",
    "交易记录",
    "流水",
    "商户",
    "花在哪里",
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
// 判断某交易是否“明确字段属于 xx”
//
// 注意：
// 这仍然是交易级数据。
// 它不是 ExpensePage 官方月度数据。
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
      ).toLowerCase();

    if (
      value === "xx"
    ) {
      return true;
    }
  }

  return false;
}

// =====================================================
// 判断交易文本是否出现 xx
//
// 不是官方 xx。
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
// 时间筛选
// =====================================================

function filterByScope(
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

  if (scope.years.length) {
    return transactions.filter(
      (transaction) => {
        const date =
          getTransactionDate(
            transaction,
          );

        if (!date) {
          return false;
        }

        return scope.years.includes(
          Number(
            date.slice(0, 4),
          ),
        );
      },
    );
  }

  return transactions;
}

// =====================================================
// 程序端交易查询
// =====================================================

function selectRelevantTransactions(
  transactions: ExpenseTransaction[],
  question: string,
): ExpenseTransaction[] {
  let result =
    filterByScope(
      transactions,
      question,
    );

  if (
    isXxQuestion(question)
  ) {
    result = result.filter(
      (transaction) =>
        isExplicitXxTransaction(
          transaction,
        ) ||
        hasXxText(transaction),
    );
  }

  if (
    containsAny(question, [
      "消费",
      "花了",
      "支出",
      "用了",
      "买",
    ])
  ) {
    result = result.filter(
      isExpenseTransaction,
    );
  }

  return result;
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
// Add monthly XX
// =====================================================

function addXxMonthly(
  map: Map<
    string,
    {
      amount: number;
      transactionCount: number;
    }
  >,
  month: string,
  amount: number,
) {
  const current =
    map.get(month) || {
      amount: 0,
      transactionCount: 0,
    };

  current.amount += amount;
  current.transactionCount += 1;

  map.set(
    month,
    current,
  );
}

// =====================================================
// Build first N month data
// =====================================================

function buildFirstNMonthData(
  monthlyMap: Map<
    string,
    {
      amount: number;
      transactionCount: number;
    }
  >,
  n: number | null,
): XxPeriodYearItem[] {
  if (
    n === null ||
    n < 1 ||
    n > 12
  ) {
    return [];
  }

  const byYear =
    new Map<
      number,
      XxMonthlyItem[]
    >();

  for (const [
    month,
    value,
  ] of monthlyMap.entries()) {
    const match =
      month.match(
        /^(\d{4})-(\d{2})$/,
      );

    if (!match) {
      continue;
    }

    const year =
      Number(match[1]);

    const monthNumber =
      Number(match[2]);

    if (
      monthNumber < 1 ||
      monthNumber > n
    ) {
      continue;
    }

    const items =
      byYear.get(year) || [];

    items.push({
      month,
      amount:
        value.amount,
      transactionCount:
        value.transactionCount,
    });

    byYear.set(
      year,
      items,
    );
  }

  return Array.from(
    byYear.entries(),
  )
    .map(
      ([year, monthly]) => ({
        year,
        months: n,
        amount:
          monthly.reduce(
            (sum, item) =>
              sum + item.amount,
            0,
          ),
        transactionCount:
          monthly.reduce(
            (sum, item) =>
              sum +
              item.transactionCount,
            0,
          ),
        monthly:
          monthly.sort(
            (a, b) =>
              a.month.localeCompare(
                b.month,
              ),
          ),
      }),
    )
    .sort(
      (a, b) =>
        a.year - b.year,
    );
}

// =====================================================
// Build comparison
// =====================================================

function buildYearComparison(
  items: XxPeriodYearItem[],
): XxComparisonItem[] {
  if (items.length < 2) {
    return [];
  }

  const sorted =
    [...items].sort(
      (a, b) =>
        a.year - b.year,
    );

  const result: XxComparisonItem[] =
    [];

  for (
    let i = 1;
    i < sorted.length;
    i += 1
  ) {
    const previous =
      sorted[i - 1];

    const current =
      sorted[i];

    const changeAmount =
      current.amount -
      previous.amount;

    const changeRate =
      previous.amount === 0
        ? null
        : (changeAmount /
            previous.amount) *
          100;

    result.push({
      previousYear:
        previous.year,

      currentYear:
        current.year,

      previousAmount:
        previous.amount,

      currentAmount:
        current.amount,

      changeAmount,

      changeRate,
    });
  }

  return result;
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

  monthly: {
    month: string;
    amount: number;
    transactionCount: number;
  }[];

  yearly: {
    year: number;
    amount: number;
    transactionCount: number;
  }[];

  xxRelated: {
    explicitFieldTransactionCount: number;
    explicitFieldAmount: number;

    explicitFieldByMonth: XxMonthlyItem[];
    explicitFieldFirstNMonthsByYear: XxPeriodYearItem[];
    explicitFieldFirstNMonthComparison: XxComparisonItem[];

    textRelatedTransactionCount: number;
    textRelatedAmount: number;

    textRelatedByYear: {
      year: number;
      amount: number;
      transactionCount: number;
    }[];

    textRelatedByMonth: XxMonthlyItem[];
    textRelatedFirstNMonthsByYear: XxPeriodYearItem[];
    textRelatedFirstNMonthComparison: XxComparisonItem[];
  };
};

// =====================================================
// Build CFO Facts
// =====================================================

function buildCFOFacts(
  transactions: ExpenseTransaction[],
  question: string,
): CFOFacts {
  const scoped =
    filterByScope(
      transactions,
      question,
    );

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
  // ===================================================

  let explicitXxAmount = 0;
  let explicitXxCount = 0;

  let textXxAmount = 0;
  let textXxCount = 0;

  const explicitXxMonth =
    new Map<
      string,
      {
        amount: number;
        transactionCount: number;
      }
    >();

  const textXxMonth =
    new Map<
      string,
      {
        amount: number;
        transactionCount: number;
      }
    >();

  const textXxYearAmount =
    new Map<number, number>();

  const textXxYearCount =
    new Map<number, number>();

  // ===================================================
  // 遍历全部程序数据
  // ===================================================

  for (
    const transaction of scoped
  ) {
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

    const isExpense =
      isExpenseTransaction(
        transaction,
      );

    const explicitXx =
      isExplicitXxTransaction(
        transaction,
      );

    const textXx =
      hasXxText(transaction);

    // =================================================
    // XX 只统计消费
    //
    // 这样“收入中出现 xx”不会被当作消费。
    // =================================================

    if (
      isExpense &&
      explicitXx
    ) {
      explicitXxAmount +=
        amount;

      explicitXxCount += 1;

      const month =
        getTransactionMonth(
          transaction,
        );

      if (month) {
        addXxMonthly(
          explicitXxMonth,
          month,
          amount,
        );
      }
    }

    if (
      isExpense &&
      textXx &&
      !explicitXx
    ) {
      textXxAmount +=
        amount;

      textXxCount += 1;

      const month =
        getTransactionMonth(
          transaction,
        );

      if (month) {
        addXxMonthly(
          textXxMonth,
          month,
          amount,
        );
      }

      const date =
        getTransactionDate(
          transaction,
        );

      if (date) {
        const year =
          Number(
            date.slice(0, 4),
          );

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
      }
    }

    // =================================================
    // 消费
    // =================================================

    if (!isExpense) {
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

    const date =
      getTransactionDate(
        transaction,
      );

    if (date) {
      const year =
        Number(
          date.slice(0, 4),
        );

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
  // map -> array
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

  const explicitFieldByMonth =
    Array.from(
      explicitXxMonth.entries(),
    )
      .map(
        ([month, value]) => ({
          month,
          amount:
            value.amount,
          transactionCount:
            value.transactionCount,
        }),
      )
      .sort(
        (a, b) =>
          a.month.localeCompare(
            b.month,
          ),
      );

  const textRelatedByMonth =
    Array.from(
      textXxMonth.entries(),
    )
      .map(
        ([month, value]) => ({
          month,
          amount:
            value.amount,
          transactionCount:
            value.transactionCount,
        }),
      )
      .sort(
        (a, b) =>
          a.month.localeCompare(
            b.month,
          ),
      );

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

  const scope =
    getQueryScope(question);

  const explicitFieldFirstNMonthsByYear =
    buildFirstNMonthData(
      explicitXxMonth,
      scope.firstNMonths,
    );

  const textRelatedFirstNMonthsByYear =
    buildFirstNMonthData(
      textXxMonth,
      scope.firstNMonths,
    );

  const explicitFieldFirstNMonthComparison =
    buildYearComparison(
      explicitFieldFirstNMonthsByYear,
    );

  const textRelatedFirstNMonthComparison =
    buildYearComparison(
      textRelatedFirstNMonthsByYear,
    );

  return {
    query: {
      question,
      intent:
        detectIntent(question),
      date: scope.date,
      month: scope.month,
      years: scope.years,
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
      explicitFieldTransactionCount:
        explicitXxCount,

      explicitFieldAmount:
        explicitXxAmount,

      explicitFieldByMonth,

      explicitFieldFirstNMonthsByYear,

      explicitFieldFirstNMonthComparison,

      textRelatedTransactionCount:
        textXxCount,

      textRelatedAmount:
        textXxAmount,

      textRelatedByYear,

      textRelatedByMonth,

      textRelatedFirstNMonthsByYear,

      textRelatedFirstNMonthComparison,
    },
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
    facts.query.firstNMonths !==
    null
  ) {
    lines.push(
      `用户要求前 ${facts.query.firstNMonths} 个月`,
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

  for (
    const item of facts.accounts
  ) {
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

  for (
    const item of facts.books
  ) {
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

  for (
    const item of facts.categories
  ) {
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

  for (
    const item of facts.monthly
  ) {
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

  lines.push(
    "【程序交易年度统计】",
  );

  for (
    const item of facts.yearly
  ) {
    lines.push(
      `${item.year}年: ¥${item.amount.toFixed(
        2,
      )} / ${item.transactionCount}笔`,
    );
  }

  lines.push("");

  // ===================================================
  // XX
  // ===================================================

  lines.push(
    "【XX交易级分析】",
  );

  lines.push(
    "注意：以下 XX 数据均来自交易级程序分析，不等于 ExpensePage 官方月度 XX。",
  );

  lines.push(
    `明确字段等于 xx 的消费：${facts.xxRelated.explicitFieldTransactionCount}笔`,
  );

  lines.push(
    `明确字段等于 xx 的消费金额：¥${facts.xxRelated.explicitFieldAmount.toFixed(
      2,
    )}`,
  );

  if (
    facts.xxRelated
      .explicitFieldByMonth.length
  ) {
    lines.push(
      "明确字段等于 xx 的月度消费：",
    );

    for (
      const item of facts.xxRelated
        .explicitFieldByMonth
    ) {
      lines.push(
        `${item.month}: ¥${item.amount.toFixed(
          2,
        )} / ${item.transactionCount}笔`,
      );
    }
  }

  if (
    facts.query.firstNMonths !==
      null &&
    facts.xxRelated
      .explicitFieldFirstNMonthsByYear
      .length
  ) {
    lines.push(
      `明确字段等于 xx 的前 ${facts.query.firstNMonths} 个月：`,
    );

    for (
      const item of facts.xxRelated
        .explicitFieldFirstNMonthsByYear
    ) {
      lines.push(
        `${item.year}年：¥${item.amount.toFixed(
          2,
        )} / ${item.transactionCount}笔`,
      );
    }
  }

  if (
    facts.xxRelated
      .explicitFieldFirstNMonthComparison
      .length
  ) {
    lines.push(
      `明确字段等于 xx 的前 ${facts.query.firstNMonths} 个月同比：`,
    );

    for (
      const item of facts.xxRelated
        .explicitFieldFirstNMonthComparison
    ) {
      lines.push(
        `${item.previousYear} → ${item.currentYear}：` +
          `前${facts.query.firstNMonths}个月 ` +
          `¥${item.previousAmount.toFixed(
            2,
          )} → ¥${item.currentAmount.toFixed(
            2,
          )}；` +
          `变化 ¥${item.changeAmount.toFixed(
            2,
          )}；` +
          `变化率 ${
            item.changeRate ===
            null
              ? "无法计算"
              : `${item.changeRate.toFixed(
                  2,
                )}%`
          }`,
      );
    }
  }

  lines.push("");

  lines.push(
    `交易文本中出现 xx、但字段不是 xx 的消费：${facts.xxRelated.textRelatedTransactionCount}笔`,
  );

  lines.push(
    `上述文本相关消费金额：¥${facts.xxRelated.textRelatedAmount.toFixed(
      2,
    )}`,
  );

  if (
    facts.xxRelated
      .textRelatedByYear.length
  ) {
    lines.push(
      "文本相关消费按年度：",
    );

    for (
      const item of facts.xxRelated
        .textRelatedByYear
    ) {
      lines.push(
        `${item.year}年：¥${item.amount.toFixed(
          2,
        )} / ${item.transactionCount}笔`,
      );
    }
  }

  if (
    facts.xxRelated
      .textRelatedByMonth.length
  ) {
    lines.push(
      "文本相关消费按月：",
    );

    for (
      const item of facts.xxRelated
        .textRelatedByMonth
    ) {
      lines.push(
        `${item.month}: ¥${item.amount.toFixed(
          2,
        )} / ${item.transactionCount}笔`,
      );
    }
  }

  if (
    facts.query.firstNMonths !==
      null &&
    facts.xxRelated
      .textRelatedFirstNMonthsByYear
      .length
  ) {
    lines.push(
      `文本相关消费前 ${facts.query.firstNMonths} 个月：`,
    );

    for (
      const item of facts.xxRelated
        .textRelatedFirstNMonthsByYear
    ) {
      lines.push(
        `${item.year}年：¥${item.amount.toFixed(
          2,
        )} / ${item.transactionCount}笔`,
      );
    }
  }

  if (
    facts.xxRelated
      .textRelatedFirstNMonthComparison
      .length
  ) {
    lines.push(
      `文本相关消费前 ${facts.query.firstNMonths} 个月同比：`,
    );

    for (
      const item of facts.xxRelated
        .textRelatedFirstNMonthComparison
    ) {
      lines.push(
        `${item.previousYear} → ${item.currentYear}：` +
          `前${facts.query.firstNMonths}个月 ` +
          `¥${item.previousAmount.toFixed(
            2,
          )} → ¥${item.currentAmount.toFixed(
            2,
          )}；` +
          `变化 ¥${item.changeAmount.toFixed(
            2,
          )}；` +
          `变化率 ${
            item.changeRate ===
            null
              ? "无法计算"
              : `${item.changeRate.toFixed(
                  2,
                )}%`
          }`,
      );
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

  for (
    const year of payload.years
  ) {
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

      for (
        const item of year.xx
          .categories
      ) {
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

      for (
        const book of year.other
          .books
      ) {
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
    // 全部交易
    //
    // 例如 6183 笔：
    // 全部进入程序端。
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

    const queryScope =
      getQueryScope(
        question,
      );

    // =================================================
    // CFO Facts
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

你是解释层和分析层，不是统计层。

程序已经完成统计。

你必须使用程序提供的事实。

绝对禁止：

- 自己重新统计
- 自己重新汇总交易
- 自己重新计算同比
- 修改程序金额
- 编造数据
- 编造交易
- 编造账本
- 编造分类
- 编造消费原因

==================================================
一、ExpensePage 官方年度数据
==================================================

ExpensePage 已经计算好的 years 是官方年度消费数据。

其中：

XX = ExpensePage 官方 XX
其他 = ExpensePage 官方其他
总消费 = ExpensePage 官方年度总消费

这些数据具有最高优先级。

如果：

2025 XX = ¥0
2026 XX = ¥0

必须明确说：

“根据 ExpensePage 官方年度数据，2025年和2026年的 XX 均为 ¥0。”

绝对不能因为交易描述里出现 xx，
就修改 ExpensePage 官方 XX。

==================================================
二、XX 必须分开理解
==================================================

XX 有三种口径：

1. ExpensePage 官方年度 XX

2. 交易字段明确等于 xx 的消费

3. 交易文本中出现 xx，但字段不是 xx 的消费

三者必须严格区分。

特别注意：

“xx换红包”

只能说明：

“这笔交易文本中出现 xx。”

不能直接说：

“这是 ExpensePage 的 XX 消费。”

==================================================
三、前 N 个月
==================================================

程序会动态识别用户的问题。

例如：

“前8个月”
→ N = 8

“前11个月”
→ N = 11

“前6个月”
→ N = 6

“1-11月”
→ N = 11

“1月至11月”
→ N = 11

“截至11月”
→ N = 11

因此不要把问题固定理解成前8个月。

如果 CFO PROGRAM FACTS 中出现：

“前 N 个月”

则必须使用程序已经计算好的前 N 个月数据。

例如：

2025年前11个月
2026年前11个月

程序已经给出了：

- 金额
- 笔数
- 每月金额
- 同比变化金额
- 同比变化率

你直接使用。

不要重新计算。

==================================================
四、前 N 个月的数据口径
==================================================

非常重要：

ExpensePage 当前提供的是官方年度 XX。

ExpensePage 当前没有提供按月拆分的官方 XX。

所以：

“前 N 个月 XX”

如果来自 CFO PROGRAM FACTS 的交易分析，

必须称为：

“交易级 XX 分析”

或者：

“交易数据口径下的 XX 相关分析”。

不能称为：

“ExpensePage 官方月度 XX”。

但是不要因为没有官方月度 XX 就拒绝回答。

应该直接给出程序已经计算的交易级结果。

==================================================
五、同比
==================================================

程序如果已经提供：

previousAmount
currentAmount
changeAmount
changeRate

直接使用。

不要自己计算。

例如程序给出：

2025年前11个月 ¥42,968.70
2026年前11个月 ¥1,768.65
变化 -¥41,200.05
变化率 -95.88%

就直接使用。

==================================================
六、分析下降原因
==================================================

如果用户问：

为什么下降？

为什么变化？

为什么今年比去年少？

你可以分析：

- 哪些月份变化最大
- 哪些账本变化最大
- 哪些分类变化最大
- 交易笔数变化
- 具体交易变化
- 消费结构变化

但这些结论必须来自程序提供的数据。

不能编造原因。

如果只是推测：

必须使用：

“可能”
“推测”

==================================================
七、交易明细
==================================================

只有程序明确提供的 SELECTED TRANSACTIONS
才能逐笔描述。

如果没有交易明细：

不要假装看到了具体交易。

SELECTED TRANSACTIONS 不是全部数据库。

==================================================
八、6183 笔交易
==================================================

全部交易只在程序端参与统计。

DeepSeek 不接收全部 6183 笔。

只有用户明确询问具体交易时，
程序才会筛选相关交易并发送给你。

==================================================
九、回答
==================================================

使用中文。

金额使用 ¥。

不要输出 JSON。

不要输出 Markdown 表格。

直接回答用户。

数据充足时不要反复说“数据不足”。

如果存在两个不同口径：

简短说明口径区别，然后继续回答。

不要因为口径不同而拒绝回答。

==================================================
十、最重要的回答优先级
==================================================

如果用户问年度 XX：

第一：
ExpensePage 官方年度 XX。

第二：
如果有需要，再补充交易级 XX 分析。

如果用户问：

“2025和2026年前11个月XX怎么样？”

回答顺序应该是：

第一：
说明 ExpensePage 官方年度 XX。

第二：
给出程序计算的前11个月交易级 XX。

第三：
给出同比变化。

第四：
如有数据，解释逐月/账本/分类变化。

第五：
用一句话说明：

“前11个月属于交易级分析口径，不是 ExpensePage 官方月度 XX。”

不要再回答：

“没有官方月度数据，所以无法分析。”

==================================================

外部说明：

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
查询范围
==================================================

年份：
${
  queryScope.years.length
    ? queryScope.years.join(
        "、",
      )
    : "未指定"
}

月份：
${queryScope.month || "未指定"}

日期：
${queryScope.date || "未指定"}

前 N 个月：
${
  queryScope.firstNMonths ??
  "未指定"
}

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

请直接回答用户问题。

如果用户问 XX：

必须首先遵守 ExpensePage 官方年度 XX。

如果用户问“前 N 个月”：

必须使用程序已经计算好的前 N 个月数据。

例如前11个月就使用前11个月，
不要只使用前8个月。

如果存在：

“交易级 XX”

必须明确它不是 ExpensePage 官方月度 XX。

但是要正常回答，不要因为缺少官方月度拆分而拒绝分析。

不要把交易文本中的 xx 自动等同于 ExpensePage XX。
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
    // Logs
    // =================================================

    console.log(
      "[expense/ai-chat] completed",
      {
        question,

        intent,

        firstNMonths:
          queryScope.firstNMonths,

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
          queryScope.firstNMonths,

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