import { supabase } from "@/lib/supabase";


// =====================================================
// 类型
// =====================================================

export type ExpenseAccountMapping = {
  id: string;

  // 有鱼 Excel 原始名称
  source_name: string;

  // 系统标准名称
  standard_name: string | null;

  // 信用卡 / 银行卡 / 现金等
  account_type: string | null;

  // 是否已经人工确认
  confirmed: boolean;

  created_at: string;
  updated_at: string;
};


// =====================================================
// 获取全部映射
// =====================================================

export async function getExpenseAccountMappings(): Promise<
  ExpenseAccountMapping[]
> {

  const { data, error } =
    await supabase
      .from("expense_account_mappings")
      .select("*")
      .order("source_name", {
        ascending: true,
      });


  if (error) {

    throw new Error(
      `读取账户名称映射失败：${error.message}`
    );

  }


  return (
    data ?? []
  ) as ExpenseAccountMapping[];

}


// =====================================================
// 根据有鱼原始名称获取映射
// =====================================================

export async function getExpenseAccountMapping(
  sourceName: string
): Promise<ExpenseAccountMapping | null> {

  const name =
    sourceName.trim();


  if (!name) {

    return null;

  }


  const { data, error } =
    await supabase
      .from("expense_account_mappings")
      .select("*")
      .eq(
        "source_name",
        name
      )
      .maybeSingle();


  if (error) {

    throw new Error(
      `读取账户名称映射失败：${error.message}`
    );

  }


  return data as
    | ExpenseAccountMapping
    | null;

}


// =====================================================
// 创建一个新的待确认映射
//
// 如果 Excel 出现一个新的账户名称：
//
// 上行信用卡
//
// 系统自动建立：
//
// source_name  = 上行信用卡
// standard_name = null
// confirmed = false
//
// 页面上再让你人工修改。
// =====================================================

export async function ensureExpenseAccountMapping(
  sourceName: string,
  accountType?: string | null
): Promise<ExpenseAccountMapping> {

  const name =
    sourceName.trim();


  if (!name) {

    throw new Error(
      "账户名称不能为空"
    );

  }


  const existing =
    await getExpenseAccountMapping(
      name
    );


  if (existing) {

    return existing;

  }


  const { data, error } =
    await supabase
      .from(
        "expense_account_mappings"
      )
      .insert({

        source_name:
          name,

        standard_name:
          null,

        account_type:
          accountType ?? null,

        confirmed:
          false,

      })
      .select("*")
      .single();


  if (error) {

    throw new Error(
      `创建账户名称映射失败：${error.message}`
    );

  }


  return data as ExpenseAccountMapping;

}


// =====================================================
// 批量建立映射
//
// 上传 Excel 时会调用。
// 例如 Excel 中出现：
//
// 上行信用卡
// 招行信用卡
// 工行信用卡
//
// 系统只建立不存在的名称。
// 已经存在的不会重复建立。
// =====================================================

export async function ensureExpenseAccountMappings(
  accounts: Array<{
    source_name: string;
    account_type?: string | null;
  }>
): Promise<ExpenseAccountMapping[]> {

  const uniqueMap =
    new Map<
      string,
      string | null
    >();


  for (const account of accounts) {

    const name =
      account.source_name?.trim();


    if (!name) {

      continue;

    }


    if (!uniqueMap.has(name)) {

      uniqueMap.set(
        name,
        account.account_type ?? null
      );

    }

  }


  const result: ExpenseAccountMapping[] =
    [];


  for (
    const [
      sourceName,
      accountType,
    ]
    of uniqueMap
  ) {

    const mapping =
      await ensureExpenseAccountMapping(
        sourceName,
        accountType
      );


    result.push(
      mapping
    );

  }


  return result;

}


// =====================================================
// 保存人工修改
//
// 例如：
//
// 上行信用卡
//       ↓
// 上海银行信用卡
//
// 保存后：
//
// confirmed = true
// =====================================================

export async function updateExpenseAccountMapping(
  id: string,
  values: {
    standard_name: string;
    account_type?: string | null;
    confirmed?: boolean;
  }
): Promise<ExpenseAccountMapping> {

  const standardName =
    values.standard_name.trim();


  if (!standardName) {

    throw new Error(
      "标准账户名称不能为空"
    );

  }


  const { data, error } =
    await supabase
      .from(
        "expense_account_mappings"
      )
      .update({

        standard_name:
          standardName,

        account_type:
          values.account_type ??
          null,

        confirmed:
          values.confirmed ??
          true,

      })
      .eq(
        "id",
        id
      )
      .select("*")
      .single();


  if (error) {

    throw new Error(
      `保存账户名称映射失败：${error.message}`
    );

  }


  return data as ExpenseAccountMapping;

}


// =====================================================
// 根据原始名称转换成标准名称
//
// 如果已经人工确认：
//
// 上行信用卡
//      ↓
// 上海银行信用卡
//
// 如果还没有确认：
//
// 上行信用卡
//      ↓
// 上行信用卡
//
// 这样系统不会因为没有映射而丢数据。
// =====================================================

export async function normalizeExpenseAccountName(
  sourceName: string | null
): Promise<string | null> {

  if (!sourceName) {

    return null;

  }


  const name =
    sourceName.trim();


  if (!name) {

    return null;

  }


  const mapping =
    await getExpenseAccountMapping(
      name
    );


  if (
    mapping &&
    mapping.confirmed &&
    mapping.standard_name
  ) {

    return mapping.standard_name;

  }


  return name;

}