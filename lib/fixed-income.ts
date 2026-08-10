import { supabase } from "./supabase";


// =====================================================
// 类型
// =====================================================

export type FixedIncomeAsset = {

  id: string;

  type: string;

  name: string;

  institution?: string | null;

  amount: number;

  interest_rate?: number | null;

  auto_interest: boolean;

  interest_date?: string | null;

  updated_at?: string | null;

  note?: string | null;

  created_at?: string | null;

};


// =====================================================
// 工具
// =====================================================

function toNumber(value: any): number {

  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : 0;

}


// =====================================================
// 日期
// =====================================================

function dateOnly(value: any): Date {

  if (!value) {

    const now = new Date();

    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

  }

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {

    const now = new Date();

    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

  }

  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate()
  );

}


// =====================================================
// 日期差
// =====================================================

function daysBetween(
  from: Date,
  to: Date
): number {

  const fromTime =
    new Date(
      from.getFullYear(),
      from.getMonth(),
      from.getDate()
    ).getTime();

  const toTime =
    new Date(
      to.getFullYear(),
      to.getMonth(),
      to.getDate()
    ).getTime();

  const diff =
    toTime -
    fromTime;

  return Math.max(
    0,
    Math.floor(
      diff /
      (1000 * 60 * 60 * 24)
    )
  );

}


// =====================================================
// 今天
// =====================================================

function todayString(): string {

  const today = new Date();

  const year =
    today.getFullYear();

  const month =
    String(
      today.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      today.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;

}


// =====================================================
// 每日计息
//
// 年化利率 / 365
// =====================================================

function calculateInterest(
  amount: number,
  annualRate: number,
  days: number
): number {

  if (
    amount <= 0 ||
    annualRate <= 0 ||
    days <= 0
  ) {

    return 0;

  }

  return (
    amount *
    (
      annualRate /
      100
    ) *
    days /
    365
  );

}


// =====================================================
// 自动计息
//
// 只计算：
// interest_date → 今天
//
// 已经计算过的不会再次计算
// =====================================================

async function applyAutoInterest(
  asset: FixedIncomeAsset
): Promise<FixedIncomeAsset> {

  // -----------------------------------------------
  // 不自动计息
  // -----------------------------------------------

  if (
    !asset.auto_interest
  ) {

    return asset;

  }


  const annualRate =
    toNumber(
      asset.interest_rate
    );


  if (
    annualRate <= 0
  ) {

    return asset;

  }


  const today =
    dateOnly(
      new Date()
    );


  const lastInterestDate =
    dateOnly(
      asset.interest_date ||
      asset.updated_at ||
      today
    );


  const days =
    daysBetween(
      lastInterestDate,
      today
    );


  // -----------------------------------------------
  // 今天已经计算过
  // -----------------------------------------------

  if (
    days <= 0
  ) {

    return asset;

  }


  const currentAmount =
    toNumber(
      asset.amount
    );


  const interest =
    calculateInterest(
      currentAmount,
      annualRate,
      days
    );


  if (
    interest <= 0
  ) {

    return asset;

  }


  const newAmount =
    currentAmount +
    interest;


  const todayText =
    todayString();


  // -----------------------------------------------
  // 写回 Supabase
  // -----------------------------------------------

  const {
    data,
    error
  } = await supabase

    .from(
      "fixed_income_assets"
    )

    .update({

      amount:
        Number(
          newAmount.toFixed(2)
        ),

      interest_date:
        todayText,

    })

    .eq(
      "id",
      asset.id
    )

    .select("*")

    .single();


  if (error) {

    console.error(
      "Fixed Income 自动计息失败:",
      error
    );

    return asset;

  }


  console.log(
    "Fixed Income 自动计息:",
    {
      id: asset.id,
      name: asset.name,
      days,
      annualRate,
      interest:
        Number(
          interest.toFixed(2)
        ),
      oldAmount:
        currentAmount,
      newAmount:
        Number(
          newAmount.toFixed(2)
        ),
    }
  );


  return data as FixedIncomeAsset;

}


// =====================================================
// 获取全部固收
//
// 每次读取时自动检查是否需要计息
// =====================================================

export async function getFixedIncomeAssets() {

  const {
    data,
    error
  } = await supabase

    .from(
      "fixed_income_assets"
    )

    .select("*")

    .order(
      "created_at",
      {
        ascending: true
      }
    );


  if (error) {

    console.error(
      "获取固收资产失败:",
      error
    );

    return [];

  }


  const assets =
    (data || []) as FixedIncomeAsset[];


  // =================================================
  // 自动计息
  // =================================================

  const updatedAssets:
    FixedIncomeAsset[] = [];


  for (
    const asset of assets
  ) {

    const updated =
      await applyAutoInterest(
        asset
      );

    updatedAssets.push(
      updated
    );

  }


  return updatedAssets;

}


// =====================================================
// 固收总资产
//
// Dashboard Total Wealth 使用
// =====================================================

export async function getFixedIncomeTotal() {

  const assets =
    await getFixedIncomeAssets();


  const total =
    assets.reduce(
      (
        sum,
        asset
      ) => {

        return (
          sum +
          toNumber(
            asset.amount
          )
        );

      },
      0
    );


  return total;

}


// =====================================================
// 新增
// =====================================================

export async function createFixedIncomeAsset(
  asset: {

    type: string;

    name: string;

    institution?: string;

    amount: number;

    interest_rate?: number | null;

    auto_interest?: boolean;

    interest_date?: string | null;

    note?: string;

  }
) {

  const today =
    todayString();


  const {
    data,
    error
  } = await supabase

    .from(
      "fixed_income_assets"
    )

    .insert({

      type:
        asset.type,

      name:
        asset.name,

      institution:
        asset.institution ||
        null,

      amount:
        toNumber(
          asset.amount
        ),

      interest_rate:
        asset.interest_rate ===
        undefined
          ?
            null
          :
            asset.interest_rate,

      auto_interest:
        asset.auto_interest ??
        false,

      interest_date:
        asset.interest_date ||
        today,

      note:
        asset.note ||
        null,

    })

    .select("*")

    .single();


  if (error) {

    console.error(
      "创建固收资产失败:",
      error
    );

    throw error;

  }


  return data;

}


// =====================================================
// 修改
// =====================================================

export async function updateFixedIncomeAsset(
  id: string,
  asset: {

    type: string;

    name: string;

    institution?: string;

    amount: number;

    interest_rate?: number | null;

    auto_interest?: boolean;

    interest_date?: string | null;

    note?: string;

  }
) {

  const {
    data,
    error
  } = await supabase

    .from(
      "fixed_income_assets"
    )

    .update({

      type:
        asset.type,

      name:
        asset.name,

      institution:
        asset.institution ||
        null,

      amount:
        toNumber(
          asset.amount
        ),

      interest_rate:
        asset.interest_rate ===
        undefined
          ?
            null
          :
            asset.interest_rate,

      auto_interest:
        asset.auto_interest ??
        false,

      interest_date:
        asset.interest_date ||
        todayString(),

      note:
        asset.note ||
        null,

    })

    .eq(
      "id",
      id
    )

    .select("*")

    .single();


  if (error) {

    console.error(
      "修改固收资产失败:",
      error
    );

    throw error;

  }


  return data;

}


// =====================================================
// 删除
// =====================================================

export async function deleteFixedIncomeAsset(
  id: string
) {

  const {
    error
  } = await supabase

    .from(
      "fixed_income_assets"
    )

    .delete()

    .eq(
      "id",
      id
    );


  if (error) {

    console.error(
      "删除固收资产失败:",
      error
    );

    throw error;

  }


  return true;

}