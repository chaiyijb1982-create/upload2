// =====================================================
// lib/expense-transactions.ts
//
// 家庭消费流水模块
//
// 数据来源：
// Excel「收入支出」Sheet
//
// 数据保存：
// expense_transactions
//
// 核心功能：
// 1. 消费流水读取
// 2. 消费流水写入
// 3. 批量导入
// 4. 自动去重
// 5. 自动识别信用卡
// 6. 自动标记平账
// 7. 消费统计
// 8. 信用卡消费统计
// 9. 分类统计
// 10. 账户统计
// 11. 成员统计
// 12. 月度统计
//
// 设计原则：
// - Excel 可以反复上传
// - 同一笔交易不会重复保存
// - 原始数据尽量完整保存
// - 平账不计入消费
// - 信用卡和非信用卡分开
// - source_file 不参与交易 Hash
// - 允许一次上传多个 Excel
//
// 注意：
// 本文件不要使用 "use server"
//
// 原因：
// 本文件既包含 async 数据函数，也包含同步工具函数。
// 同时会被 Client Component 使用。
// 因此这里作为普通 lib 模块处理。
// =====================================================

import {
  supabase,
} from "@/lib/supabase";


// =====================================================
// 类型
// =====================================================

export interface ExpenseTransaction {

  id: string;

  transaction_time: string | null;

  account_name: string | null;

  account_type: string | null;

  account_remark: string | null;

  income_expense_type: string | null;

  category: string | null;

  amount: number;

  member: string | null;

  remark: string | null;

  book_name: string | null;

  payment_method: string | null;

  is_credit_card: boolean;

  is_settlement: boolean;

  source_file: string | null;

  source_sheet: string | null;

  transaction_hash: string;

  created_at?: string;

}


export interface ExpenseTransactionInput {

  transaction_time?: string | Date | null;

  account_name?: string | null;

  account_type?: string | null;

  account_remark?: string | null;

  income_expense_type?: string | null;

  category?: string | null;

  amount?: number | string | null;

  member?: string | null;

  remark?: string | null;

  book_name?: string | null;

  payment_method?: string | null;

  is_credit_card?: boolean;

  is_settlement?: boolean;

  source_file?: string | null;

  source_sheet?: string | null;

  transaction_hash?: string | null;

}


export interface ExpenseImportResult {

  success: boolean;

  total: number;

  inserted: number;

  duplicated: number;

  failed: number;

  credit_card: number;

  non_credit_card: number;

  settlement: number;

  errors: string[];

}


// =====================================================
// 工具函数
// =====================================================

function normalizeString(
  value: unknown
): string | null {

  if (
    value === null ||
    value === undefined
  ) {

    return null;

  }

  const text =
    String(value).trim();

  return text || null;

}


function normalizeAmount(
  value: unknown
): number {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return 0;

  }

  if (
    typeof value === "number"
  ) {

    return Number.isFinite(value)
      ? value
      : 0;

  }

  const text =
    String(value)
      .replace(/,/g, "")
      .replace(/¥/g, "")
      .replace(/\s/g, "")
      .trim();

  const number =
    Number(text);

  return Number.isFinite(number)
    ? number
    : 0;

}


// =====================================================
// 信用卡识别
//
// 第一优先级：
// Excel 已经明确传入 is_credit_card = true
//
// 第二优先级：
// account_type
//
// 第三优先级：
// account_name
//
// 第四优先级：
// account_remark
//
// 不根据商户名称判断信用卡。
// =====================================================

export function detectCreditCard(
  input: ExpenseTransactionInput
): boolean {

  if (
    input.is_credit_card === true
  ) {

    return true;

  }

  const accountType =
    normalizeString(
      input.account_type
    ) || "";

  const accountName =
    normalizeString(
      input.account_name
    ) || "";

  const accountRemark =
    normalizeString(
      input.account_remark
    ) || "";

  if (
    accountType.includes("信用卡")
  ) {

    return true;

  }

  if (
    accountName.includes("信用卡")
  ) {

    return true;

  }

  if (
    accountRemark.includes("信用卡")
  ) {

    return true;

  }

  return false;

}


// =====================================================
// 平账识别
//
// 平账不是消费。
//
// 注意：
// 不把普通“转账”自动判断成平账。
// 只有明确出现：
// 平账 / 平帐
// 才自动标记。
// =====================================================

export function detectSettlement(
  input: ExpenseTransactionInput
): boolean {

  if (
    input.is_settlement === true
  ) {

    return true;

  }

  const values = [

    input.account_name,

    input.account_type,

    input.account_remark,

    input.income_expense_type,

    input.category,

    input.remark,

    input.payment_method,

  ];

  const text =
    values
      .filter(
        value =>
          value !== null &&
          value !== undefined
      )
      .map(
        value =>
          String(value).trim()
      )
      .join("|");

  if (!text) {

    return false;

  }

  return (
    text.includes("平账") ||
    text.includes("平帐")
  );

}


// =====================================================
// 日期标准化
// =====================================================

function normalizeDate(
  value: unknown
): string | null {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return null;

  }

  if (
    value instanceof Date
  ) {

    if (
      Number.isNaN(
        value.getTime()
      )
    ) {

      return null;

    }

    return value.toISOString();

  }

  const text =
    String(value).trim();

  if (!text) {

    return null;

  }

  const date =
    new Date(text);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return null;

  }

  return date.toISOString();

}


// =====================================================
// 交易 Hash
//
// source_file
// source_sheet
//
// 不参与 Hash。
// =====================================================

export function createTransactionHash(
  input: ExpenseTransactionInput
): string {

  const date =
    normalizeDate(
      input.transaction_time
    ) || "";

  const account =
    normalizeString(
      input.account_name
    ) || "";

  const accountType =
    normalizeString(
      input.account_type
    ) || "";

  const accountRemark =
    normalizeString(
      input.account_remark
    ) || "";

  const incomeExpenseType =
    normalizeString(
      input.income_expense_type
    ) || "";

  const category =
    normalizeString(
      input.category
    ) || "";

  const amount =
    normalizeAmount(
      input.amount
    );

  const member =
    normalizeString(
      input.member
    ) || "";

  const remark =
    normalizeString(
      input.remark
    ) || "";

  const book =
    normalizeString(
      input.book_name
    ) || "";

  const paymentMethod =
    normalizeString(
      input.payment_method
    ) || "";

  const raw = [

    date,

    account,

    accountType,

    accountRemark,

    incomeExpenseType,

    category,

    amount.toFixed(2),

    member,

    remark,

    book,

    paymentMethod,

  ].join("||");

  // -------------------------------------------------
  // FNV-1a 32bit
  // -------------------------------------------------

  let hash = 0x811c9dc5;

  for (
    let i = 0;
    i < raw.length;
    i++
  ) {

    hash ^=
      raw.charCodeAt(i);

    hash =
      Math.imul(
        hash,
        16777619
      );

  }

  return (
    (hash >>> 0)
      .toString(16)
      .padStart(8, "0")
  );

}


// =====================================================
// 标准化交易
// =====================================================

function normalizeTransaction(
  input: ExpenseTransactionInput
): ExpenseTransactionInput {

  const transaction:
    ExpenseTransactionInput = {

    transaction_time:
      normalizeDate(
        input.transaction_time
      ),

    account_name:
      normalizeString(
        input.account_name
      ),

    account_type:
      normalizeString(
        input.account_type
      ),

    account_remark:
      normalizeString(
        input.account_remark
      ),

    income_expense_type:
      normalizeString(
        input.income_expense_type
      ),

    category:
      normalizeString(
        input.category
      ),

    amount:
      normalizeAmount(
        input.amount
      ),

    member:
      normalizeString(
        input.member
      ),

    remark:
      normalizeString(
        input.remark
      ),

    book_name:
      normalizeString(
        input.book_name
      ),

    payment_method:
      normalizeString(
        input.payment_method
      ),

    is_credit_card:
      detectCreditCard(
        input
      ),

    is_settlement:
      detectSettlement(
        input
      ),

    source_file:
      normalizeString(
        input.source_file
      ),

    source_sheet:
      normalizeString(
        input.source_sheet
      ),

    transaction_hash:
      normalizeString(
        input.transaction_hash
      ),

  };

  if (
    !transaction.transaction_hash
  ) {

    transaction.transaction_hash =
      createTransactionHash(
        transaction
      );

  }

  return transaction;

}


// =====================================================
// 将数据库记录转换成 ExpenseTransaction
// =====================================================

function mapExpenseTransaction(
  item: any
): ExpenseTransaction {

  return {

    id:
      item.id,

    transaction_time:
      item.transaction_time,

    account_name:
      item.account_name,

    account_type:
      item.account_type,

    account_remark:
      item.account_remark,

    income_expense_type:
      item.income_expense_type,

    category:
      item.category,

    amount:
      Number(
        item.amount || 0
      ),

    member:
      item.member,

    remark:
      item.remark,

    book_name:
      item.book_name,

    payment_method:
      item.payment_method,

    is_credit_card:
      Boolean(
        item.is_credit_card
      ),

    is_settlement:
      Boolean(
        item.is_settlement
      ),

    source_file:
      item.source_file,

    source_sheet:
      item.source_sheet,

    transaction_hash:
      item.transaction_hash,

    created_at:
      item.created_at,

  };

}


// =====================================================
// 获取全部消费流水
// =====================================================

export async function getExpenseTransactions(
  options?: {

    startDate?: string;

    endDate?: string;

    creditCardOnly?: boolean;

    excludeSettlement?: boolean;

    accountName?: string;

    category?: string;

    limit?: number;

  }
): Promise<ExpenseTransaction[]> {

  let query =
    supabase
      .from(
        "expense_transactions"
      )
      .select(
        `
        id,
        transaction_time,
        account_name,
        account_type,
        account_remark,
        income_expense_type,
        category,
        amount,
        member,
        remark,
        book_name,
        payment_method,
        is_credit_card,
        is_settlement,
        source_file,
        source_sheet,
        transaction_hash,
        created_at
        `
      )
      .order(
        "transaction_time",
        {
          ascending: false,
        }
      );

  if (
    options?.startDate
  ) {

    query =
      query.gte(
        "transaction_time",
        options.startDate
      );

  }

  if (
    options?.endDate
  ) {

    query =
      query.lt(
        "transaction_time",
        options.endDate
      );

  }

  if (
    options?.creditCardOnly
  ) {

    query =
      query.eq(
        "is_credit_card",
        true
      );

  }

  if (
    options?.excludeSettlement
  ) {

    query =
      query.eq(
        "is_settlement",
        false
      );

  }

  if (
    options?.accountName
  ) {

    query =
      query.eq(
        "account_name",
        options.accountName
      );

  }

  if (
    options?.category
  ) {

    query =
      query.eq(
        "category",
        options.category
      );

  }

  if (
    options?.limit
  ) {

    query =
      query.limit(
        options.limit
      );

  }

  const {
    data,
    error,
  } =
    await query;

  if (error) {

    console.error(
      "getExpenseTransactions error:",
      error
    );

    return [];

  }

  return (
    data || []
  ).map(
    mapExpenseTransaction
  );

}


// =====================================================
// 获取单笔交易
// =====================================================

export async function getExpenseTransactionById(
  id: string
): Promise<ExpenseTransaction | null> {

  if (!id) {

    return null;

  }

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "expense_transactions"
      )
      .select(
        `
        id,
        transaction_time,
        account_name,
        account_type,
        account_remark,
        income_expense_type,
        category,
        amount,
        member,
        remark,
        book_name,
        payment_method,
        is_credit_card,
        is_settlement,
        source_file,
        source_sheet,
        transaction_hash,
        created_at
        `
      )
      .eq(
        "id",
        id
      )
      .maybeSingle();

  if (error) {

    console.error(
      "getExpenseTransactionById error:",
      error
    );

    return null;

  }

  if (!data) {

    return null;

  }

  return mapExpenseTransaction(
    data
  );

}


// =====================================================
// 创建单笔消费
// =====================================================

export async function createExpenseTransaction(
  input: ExpenseTransactionInput
): Promise<{

  success: boolean;

  inserted: boolean;

  duplicate: boolean;

  data: ExpenseTransaction | null;

  error?: string;

}> {

  try {

    const transaction =
      normalizeTransaction(
        input
      );

    if (
      !transaction.transaction_hash
    ) {

      return {

        success: false,

        inserted: false,

        duplicate: false,

        data: null,

        error:
          "无法生成交易 Hash",

      };

    }

    const payload = {

      transaction_time:
        transaction.transaction_time,

      account_name:
        transaction.account_name,

      account_type:
        transaction.account_type,

      account_remark:
        transaction.account_remark,

      income_expense_type:
        transaction.income_expense_type,

      category:
        transaction.category,

      amount:
        transaction.amount,

      member:
        transaction.member,

      remark:
        transaction.remark,

      book_name:
        transaction.book_name,

      payment_method:
        transaction.payment_method,

      is_credit_card:
        transaction.is_credit_card,

      is_settlement:
        transaction.is_settlement,

      source_file:
        transaction.source_file,

      source_sheet:
        transaction.source_sheet,

      transaction_hash:
        transaction.transaction_hash,

    };

    const {
      data,
      error,
    } =
      await supabase
        .from(
          "expense_transactions"
        )
        .insert(
          payload
        )
        .select(
          `
          id,
          transaction_time,
          account_name,
          account_type,
          account_remark,
          income_expense_type,
          category,
          amount,
          member,
          remark,
          book_name,
          payment_method,
          is_credit_card,
          is_settlement,
          source_file,
          source_sheet,
          transaction_hash,
          created_at
          `
        )
        .single();

    if (error) {

      if (
        error.code === "23505"
      ) {

        return {

          success: true,

          inserted: false,

          duplicate: true,

          data: null,

        };

      }

      console.error(
        "createExpenseTransaction error:",
        error
      );

      return {

        success: false,

        inserted: false,

        duplicate: false,

        data: null,

        error:
          error.message,

      };

    }

    return {

      success: true,

      inserted: true,

      duplicate: false,

      data:
        data
          ? mapExpenseTransaction(
              data
            )
          : null,

    };

  } catch (
    error
  ) {

    console.error(
      "createExpenseTransaction exception:",
      error
    );

    return {

      success: false,

      inserted: false,

      duplicate: false,

      data: null,

      error:
        error instanceof Error
          ? error.message
          : String(error),

    };

  }

}


// =====================================================
// 创建多笔消费
// =====================================================

export async function createExpenseTransactions(
  inputs: ExpenseTransactionInput[]
): Promise<ExpenseImportResult> {

  const result:
    ExpenseImportResult = {

    success: true,

    total:
      inputs.length,

    inserted: 0,

    duplicated: 0,

    failed: 0,

    credit_card: 0,

    non_credit_card: 0,

    settlement: 0,

    errors: [],

  };

  if (
    !inputs.length
  ) {

    return result;

  }

  for (
    const input of inputs
  ) {

    const normalized =
      normalizeTransaction(
        input
      );

    if (
      normalized.is_credit_card
    ) {

      result.credit_card++;

    } else {

      result.non_credit_card++;

    }

    if (
      normalized.is_settlement
    ) {

      result.settlement++;

    }

    const created =
      await createExpenseTransaction(
        normalized
      );

    if (
      created.duplicate
    ) {

      result.duplicated++;

      continue;

    }

    if (
      !created.success
    ) {

      result.failed++;

      if (
        created.error
      ) {

        result.errors.push(
          created.error
        );

      }

      continue;

    }

    result.inserted++;

  }

  result.success =
    result.failed === 0;

  console.log(
    "消费流水批量导入结果:",
    result
  );

  return result;

}


// =====================================================
// 兼容旧函数
// =====================================================

export async function insertExpenseTransaction(
  input: ExpenseTransactionInput
) {

  return createExpenseTransaction(
    input
  );

}


// =====================================================
// 兼容旧函数
// =====================================================

export async function importExpenseTransactions(
  inputs: ExpenseTransactionInput[]
) {

  return createExpenseTransactions(
    inputs
  );

}


// =====================================================
// 删除单笔交易
// =====================================================

export async function deleteExpenseTransaction(
  id: string
): Promise<boolean> {

  if (!id) {

    return false;

  }

  const {
    error,
  } =
    await supabase
      .from(
        "expense_transactions"
      )
      .delete()
      .eq(
        "id",
        id
      );

  if (error) {

    console.error(
      "deleteExpenseTransaction error:",
      error
    );

    return false;

  }

  return true;

}


// =====================================================
// 获取消费总额
// =====================================================

export async function getExpenseTotal(
  options?: {

    startDate?: string;

    endDate?: string;

    creditCardOnly?: boolean;

  }
): Promise<number> {

  const transactions =
    await getExpenseTransactions({

      startDate:
        options?.startDate,

      endDate:
        options?.endDate,

      creditCardOnly:
        options?.creditCardOnly,

      excludeSettlement:
        true,

    });

  return transactions.reduce(

    (
      sum,
      item
    ) => {

      const type =
        item.income_expense_type || "";

      if (
        type.includes("收入")
      ) {

        return sum;

      }

      return (
        sum +
        Math.abs(
          Number(
            item.amount || 0
          )
        )
      );

    },

    0

  );

}


// =====================================================
// 获取信用卡消费总额
// =====================================================

export async function getCreditCardExpenseTotal(
  startDate?: string,
  endDate?: string
): Promise<number> {

  return getExpenseTotal({

    startDate,

    endDate,

    creditCardOnly:
      true,

  });

}


// =====================================================
// 获取非信用卡消费总额
// =====================================================

export async function getNonCreditCardExpenseTotal(
  startDate?: string,
  endDate?: string
): Promise<number> {

  const transactions =
    await getExpenseTransactions({

      startDate,

      endDate,

      excludeSettlement:
        true,

    });

  return transactions.reduce(

    (
      sum,
      item
    ) => {

      if (
        item.is_credit_card
      ) {

        return sum;

      }

      const type =
        item.income_expense_type || "";

      if (
        type.includes("收入")
      ) {

        return sum;

      }

      return (
        sum +
        Math.abs(
          Number(
            item.amount || 0
          )
        )
      );

    },

    0

  );

}


// =====================================================
// 分类统计
// =====================================================

export async function getExpenseCategorySummary(
  startDate?: string,
  endDate?: string
): Promise<Record<string, number>> {

  const transactions =
    await getExpenseTransactions({

      startDate,

      endDate,

      excludeSettlement:
        true,

    });

  const summary:
    Record<string, number> = {};

  transactions.forEach(
    item => {

      const type =
        item.income_expense_type || "";

      if (
        type.includes("收入")
      ) {

        return;

      }

      const category =
        item.category ||
        "未分类";

      const amount =
        Math.abs(
          Number(
            item.amount || 0
          )
        );

      summary[category] =
        (
          summary[category] || 0
        ) +
        amount;

    }
  );

  return summary;

}


// =====================================================
// 账户统计
// =====================================================

export async function getExpenseAccountSummary(
  startDate?: string,
  endDate?: string
): Promise<Record<string, number>> {

  const transactions =
    await getExpenseTransactions({

      startDate,

      endDate,

      excludeSettlement:
        true,

    });

  const summary:
    Record<string, number> = {};

  transactions.forEach(
    item => {

      const type =
        item.income_expense_type || "";

      if (
        type.includes("收入")
      ) {

        return;

      }

      const account =
        item.account_name ||
        "未知账户";

      const amount =
        Math.abs(
          Number(
            item.amount || 0
          )
        );

      summary[account] =
        (
          summary[account] || 0
        ) +
        amount;

    }
  );

  return summary;

}


// =====================================================
// 信用卡银行统计
// =====================================================

export async function getCreditCardBankSummary(
  startDate?: string,
  endDate?: string
): Promise<Record<string, number>> {

  const transactions =
    await getExpenseTransactions({

      startDate,

      endDate,

      creditCardOnly:
        true,

      excludeSettlement:
        true,

    });

  const summary:
    Record<string, number> = {};

  transactions.forEach(
    item => {

      const type =
        item.income_expense_type || "";

      if (
        type.includes("收入")
      ) {

        return;

      }

      const bank =
        item.account_name ||
        "未知信用卡";

      const amount =
        Math.abs(
          Number(
            item.amount || 0
          )
        );

      summary[bank] =
        (
          summary[bank] || 0
        ) +
        amount;

    }
  );

  return summary;

}


// =====================================================
// 成员统计
// =====================================================

export async function getExpenseMemberSummary(
  startDate?: string,
  endDate?: string
): Promise<Record<string, number>> {

  const transactions =
    await getExpenseTransactions({

      startDate,

      endDate,

      excludeSettlement:
        true,

    });

  const summary:
    Record<string, number> = {};

  transactions.forEach(
    item => {

      const type =
        item.income_expense_type || "";

      if (
        type.includes("收入")
      ) {

        return;

      }

      const member =
        item.member ||
        "未填写";

      const amount =
        Math.abs(
          Number(
            item.amount || 0
          )
        );

      summary[member] =
        (
          summary[member] || 0
        ) +
        amount;

    }
  );

  return summary;

}


// =====================================================
// 月度统计
// =====================================================

export async function getExpenseMonthlySummary(
  startDate?: string,
  endDate?: string
): Promise<Record<string, number>> {

  const transactions =
    await getExpenseTransactions({

      startDate,

      endDate,

      excludeSettlement:
        true,

    });

  const summary:
    Record<string, number> = {};

  transactions.forEach(
    item => {

      if (
        !item.transaction_time
      ) {

        return;

      }

      const type =
        item.income_expense_type || "";

      if (
        type.includes("收入")
      ) {

        return;

      }

      const date =
        new Date(
          item.transaction_time
        );

      if (
        Number.isNaN(
          date.getTime()
        )
      ) {

        return;

      }

      const month =
        `${date.getFullYear()}-${String(
          date.getMonth() + 1
        ).padStart(2, "0")}`;

      const amount =
        Math.abs(
          Number(
            item.amount || 0
          )
        );

      summary[month] =
        (
          summary[month] || 0
        ) +
        amount;

    }
  );

  return summary;

}


// =====================================================
// 获取信用卡消费明细
//
// 专门供：
// 信用卡账单预测
//
// 上一个账单日后一天
// → 本账单日
// =====================================================

export async function getCreditCardTransactions(
  options?: {

    startDate?: string;

    endDate?: string;

    accountName?: string;

  }
): Promise<ExpenseTransaction[]> {

  return getExpenseTransactions({

    startDate:
      options?.startDate,

    endDate:
      options?.endDate,

    creditCardOnly:
      true,

    excludeSettlement:
      true,

    accountName:
      options?.accountName,

  });

}


// =====================================================
// 获取指定信用卡消费金额
//
// 这个函数就是：
//
// getCreditCardAmountBetween()
//
// 给 /credit-card
// /credit-card-from-yu
// 信用卡预测
//
// 使用。
// =====================================================

export async function getCreditCardAmountBetween(
  accountName: string,
  startDate: string,
  endDate: string
): Promise<number> {

  const transactions =
    await getCreditCardTransactions({

      accountName,

      startDate,

      endDate,

    });

  return transactions.reduce(

    (
      sum,
      item
    ) => {

      const type =
        item.income_expense_type || "";

      if (
        type.includes("收入")
      ) {

        return sum;

      }

      return (
        sum +
        Math.abs(
          Number(
            item.amount || 0
          )
        )
      );

    },

    0

  );

}


// =====================================================
// 消费分析总览
// =====================================================

export async function getExpenseOverview(
  startDate?: string,
  endDate?: string
) {

  const transactions =
    await getExpenseTransactions({

      startDate,

      endDate,

    });

  let creditCard = 0;

  let nonCreditCard = 0;

  let settlement = 0;

  let income = 0;

  let expense = 0;

  transactions.forEach(
    item => {

      const amount =
        Math.abs(
          Number(
            item.amount || 0
          )
        );

      if (
        item.is_settlement
      ) {

        settlement +=
          amount;

        return;

      }

      const type =
        item.income_expense_type || "";

      if (
        type.includes("收入")
      ) {

        income +=
          amount;

        return;

      }

      expense +=
        amount;

      if (
        item.is_credit_card
      ) {

        creditCard +=
          amount;

      } else {

        nonCreditCard +=
          amount;

      }

    }
  );

  return {

    total:
      expense,

    expense,

    income,

    credit_card:
      creditCard,

    non_credit_card:
      nonCreditCard,

    settlement,

    transaction_count:
      transactions.length,

  };

}


// =====================================================
// 获取指定月份消费
//
// month：
// 2026-08
// =====================================================

export async function getMonthlyExpense(
  month: string
): Promise<number> {

  if (
    !/^\d{4}-\d{2}$/.test(
      month
    )
  ) {

    return 0;

  }

  const [
    year,
    monthNumber,
  ] =
    month
      .split("-")
      .map(Number);

  const start =
    new Date(
      year,
      monthNumber - 1,
      1
    );

  const end =
    new Date(
      year,
      monthNumber,
      1
    );

  return getExpenseTotal({

    startDate:
      start.toISOString(),

    endDate:
      end.toISOString(),

  });

}


// =====================================================
// 获取指定月份信用卡消费
// =====================================================

export async function getMonthlyCreditCardExpense(
  month: string
): Promise<number> {

  if (
    !/^\d{4}-\d{2}$/.test(
      month
    )
  ) {

    return 0;

  }

  const [
    year,
    monthNumber,
  ] =
    month
      .split("-")
      .map(Number);

  const start =
    new Date(
      year,
      monthNumber - 1,
      1
    );

  const end =
    new Date(
      year,
      monthNumber,
      1
    );

  return getCreditCardExpenseTotal(

    start.toISOString(),

    end.toISOString()

  );

}


// =====================================================
// 注意
//
// 这里不要再写：
//
// export default {
//   ...
// }
//
// 因为本文件采用 named exports。
// =====================================================