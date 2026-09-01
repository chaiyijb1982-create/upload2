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
// =====================================================
//
// ★★★ 统一消费规则 ★★★
//
// 所有消费页面、信用卡页面、AI CFO
// 都必须使用本文件的统一规则。
//
// 1. 平账
//    → 不属于消费
//    → consumption_type = null
//
// 2. 收入
//    → 不属于消费
//
// 3. 资金账户名称包含「替别人先付」
//    → paid_for_others
//    → 替别人提前付
//
// 4. 其他非平账、非收入交易
//    → self
//    → 自己消费
//
// 5. 实际支出
//    = 自己消费 + 替别人提前付
//
// 6. 信用卡总消费
//    = 信用卡自己消费
//    + 信用卡替别人提前付
//
// =====================================================
//
// 设计原则：
//
// - Excel 可以反复上传
// - 同一笔交易不会重复保存
// - 原始数据尽量完整保存
// - 平账不计入消费
// - 收入不计入消费
// - 信用卡和非信用卡分开
// - 实际支出 = 自己支出 + 代付
// - source_file 不参与交易 Hash
// - source_sheet 不参与交易 Hash
// - consumption_type 不参与交易 Hash
// - 允许一次上传多个 Excel
//
// =====================================================
//
// ★ Supabase 默认单次查询最多返回 1000 条
//
// getExpenseTransactions() 使用自动分页，
// 因此 2023 年 1157 条等数据可以完整读取。
//
// =====================================================
//
// 注意：
// 本文件不要使用 "use server"
// =====================================================

import {
  supabase,
} from "@/lib/supabase";


// =====================================================
// 类型
// =====================================================

export type ConsumptionType =
  | "self"
  | "paid_for_others"
  | null;


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

  /**
   * 消费归属：
   *
   * self
   *      自己消费
   *
   * paid_for_others
   *      替别人提前付
   *
   * null
   *      平账 / 非消费
   */
  consumption_type:
    ConsumptionType;

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

  consumption_type?:
    ConsumptionType;

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
// ★ 统一消费统计结果
// =====================================================
//
// 所有页面需要消费拆分时，优先使用这个结构。
//
// actual_expense
//     全部实际支出
//
// self_expense
//     自己消费
//
// paid_for_others
//     替别人提前付
//
// credit_card
//     信用卡总消费
//
// credit_card_self
//     信用卡自己消费
//
// credit_card_paid_for_others
//     信用卡替别人提前付
//
// non_credit_card
//     非信用卡总消费
//
// settlement
//     平账
//
// income
//     收入
//
// =====================================================

export interface ExpenseConsumptionSummary {

  actual_expense: number;

  self_expense: number;

  paid_for_others: number;

  credit_card: number;

  credit_card_self: number;

  credit_card_paid_for_others: number;

  non_credit_card: number;

  settlement: number;

  income: number;

  transaction_count: number;

}


// =====================================================
// 工具函数：字符串标准化
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


// =====================================================
// 工具函数：金额标准化
// =====================================================

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
// 平账识别
//
// ★ 统一规则
//
// 平账不是消费。
//
// 明确出现：
// 「平账」
// 「平帐」
//
// 才自动判断为平账。
//
// 普通「转账」不会自动判断为平账。
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

    input.book_name,

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
// ★ 消费归属判断
//
// 统一规则：
//
// 1. 平账
//    → null
//
// 2. account_name 包含「替别人先付」
//    → paid_for_others
//
// 3. 其他
//    → self
//
// ★ 注意：
//
// 「替别人先付」必须检查：
// account_name = 资金账户名称
//
// 不是 book_name。
// =====================================================

// =====================================================
// ★ 消费归属判断
//
// 统一消费规则
//
// 1. 平账
//    → null
//
// 2. 「替别人先付」/「替别人先付款」
//    出现在：
//      - 资金账户名称 account_name
//      - 账簿 book_name
//
//    → paid_for_others
//
// 3. 其他所有非平账交易
//    → self
//
// 注意：
// - 不根据成员判断
// - 不根据账户类型判断
// - 不根据分类判断
// - 不根据商户判断
//
// ★ 特别注意：
// 「替别人先付款」有可能出现在“账簿”字段，
// 因此 account_name 和 book_name 都必须检查。
// =====================================================

export function detectConsumptionType(
  input: ExpenseTransactionInput
): ConsumptionType {

  // =================================================
  // 1. 平账
  //
  // 平账永远不是消费
  // =================================================

  if (
    detectSettlement(input)
  ) {

    return null;

  }


  // =================================================
  // 2. 资金账户名称
  // =================================================

  const accountName =
    normalizeString(
      input.account_name
    ) || "";


  // =================================================
  // 3. 账本名称
  // =================================================

  const bookName =
    normalizeString(
      input.book_name
    ) || "";


  // =================================================
  // 4. 统一检查“替别人先付”
  //
  // 只要：
  //
  // 资金账户名称
  // 或
  // 账本名称
  //
  // 出现以下任意表达：
  //
  // 替别人先付
  // 替别人先付款
  // 替别人先支付
  // 替别人付
  // 替别人付款
  // 替别人支付
  //
  // 就认定：
  //
  // consumption_type =
  // "paid_for_others"
  // =================================================

  const paidForOthersKeywords = [

    "替别人先付",

    "替别人先付款",

    "替别人先支付",

    "替别人付",

    "替别人付款",

    "替别人支付",

  ];


  const isPaidForOthers =
    paidForOthersKeywords.some(
      keyword =>
        accountName.includes(keyword) ||
        bookName.includes(keyword)
    );


  // =================================================
  // 5. 替别人提前付
  // =================================================

  if (
    isPaidForOthers
  ) {

    return "paid_for_others";

  }


  // =================================================
  // 6. 其他所有非平账交易
  //
  // = 自己消费
  // =================================================

  return "self";

}

// =====================================================
// 消费归属中文名称
// =====================================================

export function getConsumptionTypeLabel(
  type: ConsumptionType
): string {

  if (
    type ===
    "paid_for_others"
  ) {

    return "替别人提前付";

  }

  if (
    type ===
    "self"
  ) {

    return "自己消费";

  }

  return "—";

}


// =====================================================
// 信用卡识别
//
// 第一优先级：
// Excel 已明确传入 true
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
// 以下字段不参与 Hash：
//
// source_file
// source_sheet
// consumption_type
//
// 这样同一个 Excel 重复上传不会产生重复交易。
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

  const normalizedSettlement =
    detectSettlement(
      input
    );


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

    // -----------------------------------------------
    // ★ 消费归属统一计算
    // -----------------------------------------------

    consumption_type:
      normalizedSettlement
        ? null
        : detectConsumptionType(
            input
          ),

    payment_method:
      normalizeString(
        input.payment_method
      ),

    // -----------------------------------------------
    // ★ 信用卡统一计算
    // -----------------------------------------------

    is_credit_card:
      detectCreditCard(
        input
      ),

    is_settlement:
      normalizedSettlement,

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

    consumption_type:
      item.consumption_type ??
      null,

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
//
// ★ 自动分页
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

  const PAGE_SIZE = 1000;


  const allTransactions:
    ExpenseTransaction[] = [];


  let from = 0;


  while (true) {

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
          consumption_type,
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
        )
        .range(
          from,
          from + PAGE_SIZE - 1
        );


    // -----------------------------------------------
    // 开始日期
    // -----------------------------------------------

    if (
      options?.startDate
    ) {

      query =
        query.gte(
          "transaction_time",
          options.startDate
        );

    }


    // -----------------------------------------------
    // 结束日期
    // -----------------------------------------------

    if (
      options?.endDate
    ) {

      query =
        query.lt(
          "transaction_time",
          options.endDate
        );

    }


    // -----------------------------------------------
    // 信用卡
    // -----------------------------------------------

    if (
      options?.creditCardOnly
    ) {

      query =
        query.eq(
          "is_credit_card",
          true
        );

    }


    // -----------------------------------------------
    // 排除平账
    // -----------------------------------------------

    if (
      options?.excludeSettlement
    ) {

      query =
        query.eq(
          "is_settlement",
          false
        );

    }


    // -----------------------------------------------
    // 指定账户
    // -----------------------------------------------

    if (
      options?.accountName
    ) {

      query =
        query.eq(
          "account_name",
          options.accountName
        );

    }


    // -----------------------------------------------
    // 指定分类
    // -----------------------------------------------

    if (
      options?.category
    ) {

      query =
        query.eq(
          "category",
          options.category
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

      return allTransactions;

    }


    const page:
      ExpenseTransaction[] =
      (
        data || []
      ).map(
        mapExpenseTransaction
      );


    allTransactions.push(
      ...page
    );


    // -----------------------------------------------
    // limit
    // -----------------------------------------------

    if (
      options?.limit &&
      allTransactions.length >=
        options.limit
    ) {

      break;

    }


    // -----------------------------------------------
    // 已经读取完
    // -----------------------------------------------

    if (
      page.length <
      PAGE_SIZE
    ) {

      break;

    }


    from +=
      PAGE_SIZE;

  }


  // -----------------------------------------------
  // 最终 limit
  // -----------------------------------------------

  if (
    options?.limit &&
    allTransactions.length >
      options.limit
  ) {

    return allTransactions.slice(
      0,
      options.limit
    );

  }


  return allTransactions;

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
        consumption_type,
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

      consumption_type:
        transaction.consumption_type,

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
          consumption_type,
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

      // ---------------------------------------------
      // Hash 唯一约束
      // ---------------------------------------------

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


    // ---------------------------------------------
    // 信用卡统计
    // ---------------------------------------------

    if (
      normalized.is_credit_card
    ) {

      result.credit_card++;

    } else {

      result.non_credit_card++;

    }


    // ---------------------------------------------
    // 平账统计
    // ---------------------------------------------

    if (
      normalized.is_settlement
    ) {

      result.settlement++;

    }


    // ---------------------------------------------
    // 正式创建
    // ---------------------------------------------

    const created =
      await createExpenseTransaction(
        normalized
      );


    // ---------------------------------------------
    // 重复
    // ---------------------------------------------

    if (
      created.duplicate
    ) {

      result.duplicated++;

      continue;

    }


    // ---------------------------------------------
    // 失败
    // ---------------------------------------------

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
// ★★★ 统一判断：是否为实际消费 ★★★
//
// 平账 → false
// 收入 → false
// 其他 → true
//
// 所有统计函数都使用这一规则。
// =====================================================

function isActualExpense(
  item: ExpenseTransaction
): boolean {

  // -----------------------------------------------
  // 平账
  // -----------------------------------------------

  if (
    item.is_settlement
  ) {

    return false;

  }


  // -----------------------------------------------
  // 收入
  // -----------------------------------------------

  const type =
    item.income_expense_type || "";


  if (
    type.includes("收入")
  ) {

    return false;

  }


  // -----------------------------------------------
  // 其他 = 实际支出
  // -----------------------------------------------

  return true;

}


// =====================================================
// ★★★ 单笔金额标准化 ★★★
// =====================================================

function getTransactionAmount(
  item: ExpenseTransaction
): number {

  return Math.abs(
    Number(
      item.amount || 0
    )
  );

}


// =====================================================
// ★★★ 统一消费分类核心函数 ★★★
//
// 这个函数是整个消费系统最重要的统一入口。
//
// 返回单笔交易应该进入哪些统计。
//
// 不再让不同页面自己重新判断。
// =====================================================

function classifyExpenseTransaction(
  item: ExpenseTransaction
) {

  const amount =
    getTransactionAmount(
      item
    );


  // -----------------------------------------------
  // 平账
  // -----------------------------------------------

  if (
    item.is_settlement
  ) {

    return {

      is_expense: false,

      is_income: false,

      is_settlement: true,

      amount,

      consumption_type:
        null as ConsumptionType,

      is_credit_card:
        item.is_credit_card,

    };

  }


  // -----------------------------------------------
  // 收入
  // -----------------------------------------------

  const type =
    item.income_expense_type || "";


  if (
    type.includes("收入")
  ) {

    return {

      is_expense: false,

      is_income: true,

      is_settlement: false,

      amount,

      consumption_type:
        null as ConsumptionType,

      is_credit_card:
        item.is_credit_card,

    };

  }


  // -----------------------------------------------
  // 实际消费
  // -----------------------------------------------

  const consumptionType =
    item.consumption_type ===
      "paid_for_others"
      ? "paid_for_others"
      : "self";


  return {

    is_expense: true,

    is_income: false,

    is_settlement: false,

    amount,

    consumption_type:
      consumptionType as ConsumptionType,

    is_credit_card:
      item.is_credit_card,

  };

}


// =====================================================
// ★★★ 统一消费汇总 ★★★
//
// 这是所有消费页面最应该使用的核心函数。
//
// 返回：
//
// actual_expense
// self_expense
// paid_for_others
//
// credit_card
// credit_card_self
// credit_card_paid_for_others
//
// non_credit_card
//
// settlement
// income
//
// transaction_count
//
// =====================================================

export async function getExpenseConsumptionSummary(
  startDate?: string,
  endDate?: string
): Promise<ExpenseConsumptionSummary> {

  const transactions =
    await getExpenseTransactions({

      startDate,

      endDate,

    });


  let actualExpense = 0;

  let selfExpense = 0;

  let paidForOthers = 0;

  let creditCard = 0;

  let creditCardSelf = 0;

  let creditCardPaidForOthers = 0;

  let nonCreditCard = 0;

  let settlement = 0;

  let income = 0;


  transactions.forEach(
    item => {

      const classified =
        classifyExpenseTransaction(
          item
        );


      // ---------------------------------------------
      // 平账
      // ---------------------------------------------

      if (
        classified.is_settlement
      ) {

        settlement +=
          classified.amount;

        return;

      }


      // ---------------------------------------------
      // 收入
      // ---------------------------------------------

      if (
        classified.is_income
      ) {

        income +=
          classified.amount;

        return;

      }


      // ---------------------------------------------
      // 实际消费
      // ---------------------------------------------

      if (
        !classified.is_expense
      ) {

        return;

      }


      actualExpense +=
        classified.amount;


      // ---------------------------------------------
      // 消费归属
      // ---------------------------------------------

      if (
        classified.consumption_type ===
        "paid_for_others"
      ) {

        paidForOthers +=
          classified.amount;

      } else {

        selfExpense +=
          classified.amount;

      }


      // ---------------------------------------------
      // 支付方式
      // ---------------------------------------------

      if (
        classified.is_credit_card
      ) {

        creditCard +=
          classified.amount;


        if (
          classified.consumption_type ===
          "paid_for_others"
        ) {

          creditCardPaidForOthers +=
            classified.amount;

        } else {

          creditCardSelf +=
            classified.amount;

        }

      } else {

        nonCreditCard +=
          classified.amount;

      }

    }
  );


  return {

    actual_expense:
      actualExpense,

    self_expense:
      selfExpense,

    paid_for_others:
      paidForOthers,

    credit_card:
      creditCard,

    credit_card_self:
      creditCardSelf,

    credit_card_paid_for_others:
      creditCardPaidForOthers,

    non_credit_card:
      nonCreditCard,

    settlement,

    income,

    transaction_count:
      transactions.length,

  };

}


// =====================================================
// ★★★ 信用卡消费统一汇总 ★★★
//
// 专门供：
//
// /credit-card
// /credit-card-from-yu
// AI CFO
//
// 使用。
//
// 返回：
//
// credit_card
//     信用卡总消费
//
// self_expense
//     信用卡自己消费总共
//
// paid_for_others
//     信用卡替别人提前付总共
//
// actual_expense
//     信用卡实际消费
//
// settlement
//     信用卡平账
//
// income
//     信用卡收入
//
// transaction_count
//     信用卡交易数量
//
// =====================================================

export async function getCreditCardConsumptionSummary(
  startDate?: string,
  endDate?: string
): Promise<{

  credit_card: number;

  self_expense: number;

  paid_for_others: number;

  actual_expense: number;

  settlement: number;

  income: number;

  transaction_count: number;

}> {

  const summary =
    await getExpenseConsumptionSummary(

      startDate,

      endDate

    );


  return {

    // -----------------------------------------------
    // 信用卡总消费
    // -----------------------------------------------

    credit_card:
      summary.credit_card,

    // -----------------------------------------------
    // 信用卡自己消费
    // -----------------------------------------------

    self_expense:
      summary.credit_card_self,

    // -----------------------------------------------
    // 信用卡替别人提前付
    // -----------------------------------------------

    paid_for_others:
      summary.credit_card_paid_for_others,

    // -----------------------------------------------
    // 信用卡实际消费
    //
    // 与信用卡总消费相同
    // -----------------------------------------------

    actual_expense:
      summary.credit_card,

    settlement:
      summary.settlement,

    income:
      summary.income,

    transaction_count:
      summary.transaction_count,

  };

}


// =====================================================
// 获取消费总额
//
// 实际支出 = 自己消费 + 替别人提前付
//
// 不包含：
// - 平账
// - 收入
// =====================================================

export async function getExpenseTotal(
  options?: {

    startDate?: string;

    endDate?: string;

    creditCardOnly?: boolean;

  }
): Promise<number> {

  // -----------------------------------------------
  // 如果要求只看信用卡
  // -----------------------------------------------

  if (
    options?.creditCardOnly
  ) {

    const summary =
      await getCreditCardConsumptionSummary(

        options.startDate,

        options.endDate

      );


    return summary.credit_card;

  }


  const summary =
    await getExpenseConsumptionSummary(

      options?.startDate,

      options?.endDate

    );


  return summary.actual_expense;

}


// =====================================================
// 获取信用卡消费总额
//
// ★ 统一规则
// =====================================================

export async function getCreditCardExpenseTotal(
  startDate?: string,
  endDate?: string
): Promise<number> {

  const summary =
    await getCreditCardConsumptionSummary(

      startDate,

      endDate

    );


  return summary.credit_card;

}


// =====================================================
// 获取非信用卡消费总额
//
// ★ 统一规则
// =====================================================

export async function getNonCreditCardExpenseTotal(
  startDate?: string,
  endDate?: string
): Promise<number> {

  const summary =
    await getExpenseConsumptionSummary(

      startDate,

      endDate

    );


  return summary.non_credit_card;

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

      if (
        !isActualExpense(item)
      ) {

        return;

      }


      const category =
        item.category ||
        "未分类";


      const amount =
        getTransactionAmount(
          item
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

      if (
        !isActualExpense(item)
      ) {

        return;

      }


      const account =
        item.account_name ||
        "未知账户";


      const amount =
        getTransactionAmount(
          item
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

      if (
        !isActualExpense(item)
      ) {

        return;

      }


      const bank =
        item.account_name ||
        "未知信用卡";


      const amount =
        getTransactionAmount(
          item
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

      if (
        !isActualExpense(item)
      ) {

        return;

      }


      const member =
        item.member ||
        "未填写";


      const amount =
        getTransactionAmount(
          item
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
        !isActualExpense(item)
      ) {

        return;

      }


      if (
        !item.transaction_time
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
        getTransactionAmount(
          item
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
//
// 信用卡账单预测
//
// 上一个账单日后一天
// → 本账单日
//
// 底层自动分页。
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
// ★ 统一消费规则
//
// 返回：
//
// 自己消费
// + 替别人提前付
//
// 不包含：
//
// 平账
// 收入
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


  let total = 0;


  transactions.forEach(
    item => {

      if (
        !isActualExpense(item)
      ) {

        return;

      }


      total +=
        getTransactionAmount(
          item
        );

    }
  );


  return total;

}


// =====================================================
// ★★★ 指定信用卡消费拆分 ★★★
//
// 供 /credit-card-from-yu 使用。
//
// 返回：
//
// credit_card
//     信用卡总消费
//
// self_expense
//     自己消费总共
//
// paid_for_others
//     替别人提前付总共
//
// 三者关系：
//
// credit_card
// = self_expense
// + paid_for_others
//
// =====================================================

export async function getCreditCardConsumptionSummaryBetween(
  accountName: string,
  startDate: string,
  endDate: string
): Promise<{

  credit_card: number;

  self_expense: number;

  paid_for_others: number;

  transaction_count: number;

}> {

  const transactions =
    await getCreditCardTransactions({

      accountName,

      startDate,

      endDate,

    });


  let creditCard = 0;

  let selfExpense = 0;

  let paidForOthers = 0;


  transactions.forEach(
    item => {

      if (
        !isActualExpense(item)
      ) {

        return;

      }


      const amount =
        getTransactionAmount(
          item
        );


      creditCard +=
        amount;


      if (
        item.consumption_type ===
        "paid_for_others"
      ) {

        paidForOthers +=
          amount;

      } else {

        selfExpense +=
          amount;

      }

    }
  );


  return {

    credit_card:
      creditCard,

    self_expense:
      selfExpense,

    paid_for_others:
      paidForOthers,

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
// ★★★ 获取指定月份信用卡消费拆分 ★★★
//
// 以后如果需要信用卡页面按月份显示：
//
// 信用卡总消费
// 自己消费
// 替别人提前付
//
// 可以直接使用这个函数。
//
// =====================================================
export async function getMonthlyCreditCardConsumptionSummary(
  month: string
): Promise<{
  credit_card: number;
  self_expense: number;
  paid_for_others: number;
  transaction_count: number;
}> {

  if (
    !/^\d{4}-\d{2}$/.test(
      month
    )
  ) {

    return {
      credit_card: 0,
      self_expense: 0,
      paid_for_others: 0,
      transaction_count: 0,
    };

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

  const summary =
    await getCreditCardConsumptionSummary(
      start.toISOString(),
      end.toISOString()
    );

  return {
    credit_card:
      summary.credit_card,

    self_expense:
      summary.self_expense,

    paid_for_others:
      summary.paid_for_others,

    transaction_count:
      summary.transaction_count,
  };

}


// =====================================================
// ★★★ 消费总览 ★★★
//
// 统一返回：
//
// total
// expense
// actual_expense
//
// self_expense
// paid_for_others
//
// credit_card
// non_credit_card
//
// income
// settlement
//
// =====================================================

export async function getExpenseOverview(
  startDate?: string,
  endDate?: string
) {

  const summary =
    await getExpenseConsumptionSummary(

      startDate,

      endDate

    );


  return {

    // -----------------------------------------------
    // 实际支出
    // -----------------------------------------------

    total:
      summary.actual_expense,

    expense:
      summary.actual_expense,

    actual_expense:
      summary.actual_expense,

    // -----------------------------------------------
    // 消费归属
    // -----------------------------------------------

    self_expense:
      summary.self_expense,

    paid_for_others:
      summary.paid_for_others,

    // -----------------------------------------------
    // 支付方式
    // -----------------------------------------------

    credit_card:
      summary.credit_card,

    non_credit_card:
      summary.non_credit_card,

    // -----------------------------------------------
    // 其他
    // -----------------------------------------------

    income:
      summary.income,

    settlement:
      summary.settlement,

    transaction_count:
      summary.transaction_count,

  };

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
// 本文件采用 named exports。
// =====================================================