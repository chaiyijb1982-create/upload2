// =====================================================
// lib/retirement.ts
//
// 退休规划
//
// 当前资产：
// 1. 太平洋年金
// 2. 平安好福利
//
// 当前资产支持：
// - 当前实际价值
// - 是否计入退休总值
// - 编辑
//
// 年度历史支持：
// - 每年12月底记录
// - 新增
// - 编辑
// - 删除
//
// 数据表：
// retirement_assets
// retirement_asset_history
// =====================================================

import { supabase } from "@/lib/supabase";


// =====================================================
// 类型
// =====================================================

export type RetirementAssetType =
  | "太平洋年金"
  | "平安好福利";


export interface RetirementAsset {

  id: string;

  asset_type:
    RetirementAssetType;

  current_value:
    number;

  include_in_retirement_total:
    boolean;

  note:
    string;

  created_at?:
    string;

  updated_at?:
    string;

}


export interface RetirementAssetHistory {

  id: string;

  asset_type:
    RetirementAssetType;

  year:
    number;

  year_end_value:
    number;

  created_at?:
    string;

  updated_at?:
    string;

}


// =====================================================
// 合法资产类型
// =====================================================

export const RETIREMENT_ASSET_TYPES:
  RetirementAssetType[] = [

    "太平洋年金",

    "平安好福利",

  ];


// =====================================================
// 判断资产类型
// =====================================================

function isValidAssetType(
  value: any
): value is RetirementAssetType {

  return (
    value === "太平洋年金"
    ||
    value === "平安好福利"
  );

}


// =====================================================
// 数字安全转换
// =====================================================

function toNumber(
  value: any
): number {

  const n =
    Number(value);

  return Number.isFinite(n)
    ? n
    : 0;

}


// =====================================================
// Boolean 安全转换
// =====================================================

function toBoolean(
  value: any
): boolean {

  return value === true;

}


// =====================================================
// 获取全部退休资产
//
// retirement_assets
// =====================================================

export async function getRetirementAssets():

  Promise<RetirementAsset[]> {


  const {
    data,
    error,
  } = await supabase

    .from(
      "retirement_assets"
    )

    .select(
      "*"
    )

    .order(
      "asset_type",
      {
        ascending: true,
      }
    );


  if (error) {

    console.error(
      "获取退休资产失败:",
      JSON.stringify(
        error,
        null,
        2
      )
    );

    return [];

  }


  return (
    Array.isArray(data)
      ? data
      : []
  ).map(
    (item: any) => ({

      ...item,

      current_value:
        toNumber(
          item?.current_value
        ),

      include_in_retirement_total:
        toBoolean(
          item?.include_in_retirement_total
        ),

      note:
        item?.note || "",

    })
  );

}


// =====================================================
// 获取单个退休资产
// =====================================================

export async function getRetirementAsset(
  assetType: RetirementAssetType
): Promise<RetirementAsset | null> {


  if (
    !isValidAssetType(
      assetType
    )
  ) {

    console.error(
      "无效的退休资产类型:",
      assetType
    );

    return null;

  }


  const {
    data,
    error,
  } = await supabase

    .from(
      "retirement_assets"
    )

    .select(
      "*"
    )

    .eq(
      "asset_type",
      assetType
    )

    .maybeSingle();


  if (error) {

    console.error(
      "获取退休资产失败:",
      JSON.stringify(
        error,
        null,
        2
      )
    );

    return null;

  }


  if (!data) {

    return null;

  }


  return {

    ...data,

    current_value:
      toNumber(
        data.current_value
      ),

    include_in_retirement_total:
      toBoolean(
        data.include_in_retirement_total
      ),

    note:
      data.note || "",

  } as RetirementAsset;

}


// =====================================================
// 新增退休资产
//
// 如果已经存在相同 asset_type，
// 自动改为 update，避免重复。
// =====================================================

export async function addRetirementAsset(
  asset: {

    asset_type:
      RetirementAssetType;

    current_value?:
      number;

    include_in_retirement_total?:
      boolean;

    note?:
      string;

  }
): Promise<RetirementAsset | null> {


  if (
    !isValidAssetType(
      asset.asset_type
    )
  ) {

    throw new Error(
      "无效的退休资产类型"
    );

  }


  const existing =
    await getRetirementAsset(
      asset.asset_type
    );


  // ===================================================
  // 已经存在
  // ===================================================

  if (existing) {

    return await updateRetirementAsset(
      existing.id,
      {

        current_value:
          toNumber(
            asset.current_value
          ),

        include_in_retirement_total:
          toBoolean(
            asset.include_in_retirement_total
          ),

        note:
          asset.note || "",

      }
    );

  }


  // ===================================================
  // 新增
  // ===================================================

  const {
    data,
    error,
  } = await supabase

    .from(
      "retirement_assets"
    )

    .insert({

      asset_type:
        asset.asset_type,

      current_value:
        toNumber(
          asset.current_value
        ),

      include_in_retirement_total:
        toBoolean(
          asset.include_in_retirement_total
        ),

      note:
        asset.note || "",

      created_at:
        new Date()
          .toISOString(),

      updated_at:
        new Date()
          .toISOString(),

    })

    .select()
    .single();


  if (error) {

    console.error(
      "新增退休资产失败:",
      JSON.stringify(
        error,
        null,
        2
      )
    );

    throw error;

  }


  return data as RetirementAsset;

}


// =====================================================
// 修改退休资产
//
// 当前实际价值
// 是否计入退休总值
// 备注
// =====================================================

export async function updateRetirementAsset(
  id: string,
  asset: {

    current_value?:
      number;

    include_in_retirement_total?:
      boolean;

    note?:
      string;

  }
): Promise<RetirementAsset | null> {


  const updateData: any = {

    updated_at:
      new Date()
        .toISOString(),

  };


  if (
    asset.current_value !== undefined
  ) {

    updateData.current_value =
      toNumber(
        asset.current_value
      );

  }


  if (
    asset.include_in_retirement_total
    !== undefined
  ) {

    updateData.include_in_retirement_total =
      toBoolean(
        asset.include_in_retirement_total
      );

  }


  if (
    asset.note !== undefined
  ) {

    updateData.note =
      asset.note || "";

  }


  const {
    data,
    error,
  } = await supabase

    .from(
      "retirement_assets"
    )

    .update(
      updateData
    )

    .eq(
      "id",
      id
    )

    .select()
    .single();


  if (error) {

    console.error(
      "修改退休资产失败:",
      JSON.stringify(
        error,
        null,
        2
      )
    );

    throw error;

  }


  return data as RetirementAsset;

}


// =====================================================
// 删除退休资产
// =====================================================

export async function deleteRetirementAsset(
  id: string
): Promise<boolean> {


  const {
    error,
  } = await supabase

    .from(
      "retirement_assets"
    )

    .delete()

    .eq(
      "id",
      id
    );


  if (error) {

    console.error(
      "删除退休资产失败:",
      JSON.stringify(
        error,
        null,
        2
      )
    );

    throw error;

  }


  return true;

}


// =====================================================
// 更新当前实际价值
//
// 这个函数给页面的“编辑当前值”使用。
// =====================================================

export async function updateRetirementCurrentValue(
  assetType: RetirementAssetType,
  currentValue: number
): Promise<RetirementAsset | null> {


  const asset =
    await getRetirementAsset(
      assetType
    );


  if (!asset) {

    return await addRetirementAsset({

      asset_type:
        assetType,

      current_value:
        currentValue,

      include_in_retirement_total:
        false,

      note:
        "",

    });

  }


  return await updateRetirementAsset(
    asset.id,
    {

      current_value:
        currentValue,

    }
  );

}


// =====================================================
// 更新是否计入退休总值
// =====================================================

export async function updateRetirementIncludeTotal(
  assetType: RetirementAssetType,
  include: boolean
): Promise<RetirementAsset | null> {


  const asset =
    await getRetirementAsset(
      assetType
    );


  if (!asset) {

    return await addRetirementAsset({

      asset_type:
        assetType,

      current_value:
        0,

      include_in_retirement_total:
        include,

      note:
        "",

    });

  }


  return await updateRetirementAsset(
    asset.id,
    {

      include_in_retirement_total:
        include,

    }
  );

}


// =====================================================
// 获取退休资产总值
//
// 只计算：
// include_in_retirement_total = true
//
// 当前实际价值
//
// 不使用年度历史。
// =====================================================

export async function getRetirementTotal():

  Promise<number> {


  const assets =
    await getRetirementAssets();


  return assets.reduce(

    (
      total: number,
      asset: RetirementAsset
    ) => {

      if (
        asset.include_in_retirement_total
        !== true
      ) {

        return total;

      }


      return (
        total +
        toNumber(
          asset.current_value
        )
      );

    },

    0

  );

}


// =====================================================
// 获取年度历史
//
// 可以指定：
// 太平洋年金
// 或
// 平安好福利
// =====================================================

export async function getRetirementAssetHistory(
  assetType?: RetirementAssetType
): Promise<RetirementAssetHistory[]> {


  let query =
    supabase

      .from(
        "retirement_asset_history"
      )

      .select(
        "*"
      );


  if (
    assetType
    &&
    isValidAssetType(
      assetType
    )
  ) {

    query =
      query.eq(
        "asset_type",
        assetType
      );

  }


  const {
    data,
    error,
  } =
    await query

      .order(
        "year",
        {
          ascending: true,
        }
      );


  if (error) {

    console.error(
      "获取退休年度历史失败:",
      JSON.stringify(
        error,
        null,
        2
      )
    );

    return [];

  }


  return (
    Array.isArray(data)
      ? data
      : []
  ).map(
    (item: any) => ({

      ...item,

      year:
        Number(
          item?.year
        ),

      year_end_value:
        toNumber(
          item?.year_end_value
        ),

    })
  );

}


// =====================================================
// 获取单个年度历史
// =====================================================

export async function getRetirementAssetHistoryByYear(
  assetType: RetirementAssetType,
  year: number
): Promise<RetirementAssetHistory | null> {


  if (
    !isValidAssetType(
      assetType
    )
  ) {

    return null;

  }


  const {
    data,
    error,
  } = await supabase

    .from(
      "retirement_asset_history"
    )

    .select(
      "*"
    )

    .eq(
      "asset_type",
      assetType
    )

    .eq(
      "year",
      year
    )

    .maybeSingle();


  if (error) {

    console.error(
      "获取年度退休资产失败:",
      JSON.stringify(
        error,
        null,
        2
      )
    );

    return null;

  }


  if (!data) {

    return null;

  }


  return {

    ...data,

    year:
      Number(
        data.year
      ),

    year_end_value:
      toNumber(
        data.year_end_value
      ),

  } as RetirementAssetHistory;

}


// =====================================================
// 新增年度历史
//
// 每年12月底记录
//
// 同一个：
// asset_type + year
//
// 只能存在一条。
// =====================================================

export async function addRetirementAssetHistory(
  history: {

    asset_type:
      RetirementAssetType;

    year:
      number;

    year_end_value:
      number;

  }
): Promise<RetirementAssetHistory | null> {


  if (
    !isValidAssetType(
      history.asset_type
    )
  ) {

    throw new Error(
      "无效的退休资产类型"
    );

  }


  const year =
    Number(
      history.year
    );


  if (
    !Number.isInteger(
      year
    )
  ) {

    throw new Error(
      "年度必须是整数"
    );

  }


  const value =
    toNumber(
      history.year_end_value
    );


  // ===================================================
  // 先检查是否已经存在
  // ===================================================

  const existing =
    await getRetirementAssetHistoryByYear(
      history.asset_type,
      year
    );


  // ===================================================
  // 已存在 → 更新
  // ===================================================

  if (existing) {

    return await updateRetirementAssetHistory(
      existing.id,
      {

        year_end_value:
          value,

      }
    );

  }


  // ===================================================
  // 新增
  // ===================================================

  const {
    data,
    error,
  } = await supabase

    .from(
      "retirement_asset_history"
    )

    .insert({

      asset_type:
        history.asset_type,

      year,

      year_end_value:
        value,

      created_at:
        new Date()
          .toISOString(),

      updated_at:
        new Date()
          .toISOString(),

    })

    .select()
    .single();


  if (error) {

    console.error(
      "新增退休年度历史失败:",
      JSON.stringify(
        error,
        null,
        2
      )
    );

    throw error;

  }


  return data as RetirementAssetHistory;

}


// =====================================================
// 修改年度历史
// =====================================================

export async function updateRetirementAssetHistory(
  id: string,
  history: {

    year?:
      number;

    year_end_value?:
      number;

  }
): Promise<RetirementAssetHistory | null> {


  const updateData: any = {

    updated_at:
      new Date()
        .toISOString(),

  };


  if (
    history.year !== undefined
  ) {

    const year =
      Number(
        history.year
      );


    if (
      !Number.isInteger(
        year
      )
    ) {

      throw new Error(
        "年度必须是整数"
      );

    }


    updateData.year =
      year;

  }


  if (
    history.year_end_value
    !== undefined
  ) {

    updateData.year_end_value =
      toNumber(
        history.year_end_value
      );

  }


  const {
    data,
    error,
  } = await supabase

    .from(
      "retirement_asset_history"
    )

    .update(
      updateData
    )

    .eq(
      "id",
      id
    )

    .select()
    .single();


  if (error) {

    console.error(
      "修改退休年度历史失败:",
      JSON.stringify(
        error,
        null,
        2
      )
    );

    throw error;

  }


  return data as RetirementAssetHistory;

}


// =====================================================
// 删除年度历史
// =====================================================

export async function deleteRetirementAssetHistory(
  id: string
): Promise<boolean> {


  const {
    error,
  } = await supabase

    .from(
      "retirement_asset_history"
    )

    .delete()

    .eq(
      "id",
      id
    );


  if (error) {

    console.error(
      "删除退休年度历史失败:",
      JSON.stringify(
        error,
        null,
        2
      )
    );

    throw error;

  }


  return true;

}


// =====================================================
// 获取太平洋年金年度历史
// =====================================================

export async function getPacificRetirementHistory() {

  return await getRetirementAssetHistory(
    "太平洋年金"
  );

}


// =====================================================
// 获取平安好福利年度历史
// =====================================================

export async function getPingAnRetirementHistory() {

  return await getRetirementAssetHistory(
    "平安好福利"
  );

}


// =====================================================
// 新增/修改太平洋年金年度历史
// =====================================================

export async function savePacificRetirementHistory(
  year: number,
  yearEndValue: number
) {

  return await addRetirementAssetHistory({

    asset_type:
      "太平洋年金",

    year,

    year_end_value:
      yearEndValue,

  });

}


// =====================================================
// 新增/修改平安好福利年度历史
// =====================================================

export async function savePingAnRetirementHistory(
  year: number,
  yearEndValue: number
) {

  return await addRetirementAssetHistory({

    asset_type:
      "平安好福利",

    year,

    year_end_value:
      yearEndValue,

  });

}


// =====================================================
// 获取完整退休页面数据
//
// 页面可以一次调用。
// =====================================================

export async function getRetirementOverview() {


  const [
    assets,
    history,
  ] =
    await Promise.all([

      getRetirementAssets(),

      getRetirementAssetHistory(),

    ]);


  const total =
    assets.reduce(

      (
        sum: number,
        asset: RetirementAsset
      ) => {

        if (
          asset.include_in_retirement_total
          !== true
        ) {

          return sum;

        }


        return (
          sum +
          toNumber(
            asset.current_value
          )
        );

      },

      0

    );


  const pacific =
    assets.find(
      (
        asset
      ) =>
        asset.asset_type
        === "太平洋年金"
    )
    || null;


  const pingAn =
    assets.find(
      (
        asset
      ) =>
        asset.asset_type
        === "平安好福利"
    )
    || null;


  const pacificHistory =
    history.filter(
      (
        item
      ) =>
        item.asset_type
        === "太平洋年金"
    );


  const pingAnHistory =
    history.filter(
      (
        item
      ) =>
        item.asset_type
        === "平安好福利"
    );


  return {

    assets,

    total,

    pacific,

    pingAn,

    history,

    pacificHistory,

    pingAnHistory,

  };

}