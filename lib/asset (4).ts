import { supabase } from "./supabase";


// =====================================
// 类型
// =====================================

export type AssetHistory = {

  id?: number;

  snapshot_date?: string;

  total_asset?: number;

  total_wealth?: number;

  mainland_asset?: number;

  hk_asset?: number;

  usd_cny?: number;

  [key: string]: any;

};


export type Holding = {

  id?: string;

  name?: string;

  code?: string;

  category?: string;

  amount?: number;

  market_value?: number;

  quantity?: number;

  price?: number;

  platform?: string;

  cost?: number;

  profit?: number;

  profit_rate?: number;

  [key: string]: any;

};


export type FixedIncomeAsset = {

  id: string;

  type: string;

  name: string;

  institution?: string | null;

  amount: number;

  interest_rate?: number | null;

  auto_interest?: boolean;

  interest_date?: string | null;

  updated_at?: string | null;

  note?: string | null;

  created_at?: string | null;

  [key: string]: any;

};


// =====================================
// 工具
// =====================================

function toNumber(
  value: any
): number {

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : 0;

}


// =====================================
// 获取最新资产
// =====================================

export async function getLatestAsset(): Promise<AssetHistory | null> {

  console.log(
    "开始读取最新资产..."
  );


  const {
    data,
    error,
  } = await supabase

    .from("asset_history")

    .select("*")

    .order(
      "id",
      {
        ascending: false,
      }
    )

    .limit(1);


  console.log(
    "最新资产:",
    data
  );


  console.log(
    "资产错误:",
    error
  );


  if (error) {

    console.error(
      "getLatestAsset error:",
      error
    );

    return null;

  }


  const latest =
    data?.[0] ?? null;


  if (!latest) {

    return null;

  }


  return latest;

}


// =====================================
// 获取财富历史曲线
// =====================================

export async function getAssetHistory(): Promise<AssetHistory[]> {

  console.log(
    "开始读取财富历史..."
  );


  const {
    data,
    error,
  } = await supabase

    .from("asset_history")

    .select("*")

    .order(
      "snapshot_date",
      {
        ascending: true,
      }
    );


  console.log(
    "财富历史:",
    data
  );


  console.log(
    "历史错误:",
    error
  );


  if (error) {

    console.error(
      "getAssetHistory error:",
      error
    );

    return [];

  }


  return data ?? [];

}


// =====================================
// 获取全部持仓
// =====================================

export async function getHoldings(): Promise<Holding[]> {

  console.log(
    "开始读取 holdings..."
  );


  const {
    data,
    error,
  } = await supabase

    .from("holdings")

    .select("*")

    .order(
      "amount",
      {
        ascending: false,
      }
    );


  console.log(
    "HOLDINGS DATA:",
    data
  );


  console.log(
    "HOLDINGS ERROR:",
    error
  );


  if (error) {

    console.error(
      "getHoldings error:",
      error
    );

    return [];

  }


  return data ?? [];

}


// =====================================
// 获取固收资产
// =====================================

export async function getFixedIncomeAssets(): Promise<FixedIncomeAsset[]> {

  console.log(
    "开始读取 fixed_income_assets..."
  );


  const {
    data,
    error,
  } = await supabase

    .from("fixed_income_assets")

    .select("*")

    .order(
      "created_at",
      {
        ascending: false,
      }
    );


  console.log(
    "FIXED INCOME DATA:",
    data
  );


  console.log(
    "FIXED INCOME ERROR:",
    error
  );


  if (error) {

    console.error(
      "getFixedIncomeAssets error:",
      error
    );

    return [];

  }


  return data ?? [];

}


// =====================================
// 获取固收总资产
// =====================================

export async function getFixedIncomeTotal(): Promise<number> {

  const assets =
    await getFixedIncomeAssets();


  return assets.reduce(

    (
      total,
      asset
    ) => {

      return (
        total +
        toNumber(
          asset.amount
        )
      );

    },

    0

  );

}


// =====================================
// 计算真实资产配置比例
//
// holdings 本身的分类比例
// =====================================

export async function getHoldingsAllocation() {

  console.log(
    "开始计算资产配置..."
  );


  const {
    data,
    error,
  } = await supabase

    .from("holdings")

    .select("*");


  console.log(
    "配置原始数据:",
    data
  );


  console.log(
    "配置错误:",
    error
  );


  if (error) {

    console.error(
      "getHoldingsAllocation error:",
      error
    );

    return null;

  }


  const result: {

    fixed_income: number;

    global_stock: number;

    china_stock: number;

    gold: number;

  } = {

    fixed_income: 0,

    global_stock: 0,

    china_stock: 0,

    gold: 0,

  };


  (data ?? []).forEach(
    (
      item: any
    ) => {

      const category =
        item.category;


      if (

        category &&

        result[
          category as keyof typeof result
        ] !== undefined

      ) {

        result[
          category as keyof typeof result
        ] +=

          toNumber(
            item.amount
          );

      }

    }
  );


  const total =
    Object.values(
      result
    ).reduce(

      (
        sum,
        value
      ) =>
        sum + value,

      0

    );


  console.log(
    "分类金额:",
    result
  );


  console.log(
    "配置总金额:",
    total
  );


  if (
    total === 0
  ) {

    return null;

  }


  return {

    fixed_income:
      Number(
        (
          result.fixed_income /
          total *
          100
        ).toFixed(2)
      ),

    global_stock:
      Number(
        (
          result.global_stock /
          total *
          100
        ).toFixed(2)
      ),

    china_stock:
      Number(
        (
          result.china_stock /
          total *
          100
        ).toFixed(2)
      ),

    gold:
      Number(
        (
          result.gold /
          total *
          100
        ).toFixed(2)
      ),

    total_amount:
      total,

  };

}


// =====================================
// 获取 Dashboard Total Wealth
//
// 这里只返回 asset_history.total_asset
// 不额外加入 fixed_income_assets
// =====================================

export async function getDashboardTotalWealth(): Promise<number> {

  const asset =
    await getLatestAsset();


  if (!asset) {

    return 0;

  }


  return toNumber(
    asset.total_asset
  );

}


// =====================================
// 获取包含固收后的家庭总资产
//
// asset_history
// +
// fixed_income_assets
// =====================================

export async function getTotalWealthWithFixedIncome(): Promise<number> {

  const asset =
    await getLatestAsset();


  if (!asset) {

    return 0;

  }


  const baseAsset =
    toNumber(
      asset.total_asset
    );


  const fixedIncome =
    await getFixedIncomeTotal();


  return (
    baseAsset +
    fixedIncome
  );

}


// =====================================
// 获取资产平台汇总
//
// 返回：
//
// platform
// amount
// count
// rate
// =====================================

export async function getHoldingsPlatformAllocation() {

  console.log(
    "开始计算平台资产..."
  );


  const {
    data,
    error,
  } = await supabase

    .from("holdings")

    .select(
      "platform, amount"
    );


  if (error) {

    console.error(
      "getHoldingsPlatformAllocation error:",
      error
    );

    return [];

  }


  const platformMap: Record<

    string,

    {
      amount: number;

      count: number;

    }

  > = {};


  (data || []).forEach(
    (
      item: any
    ) => {

      const platform =
        String(
          item.platform ||
          "未设置"
        ).trim();


      const amount =
        Number(
          item.amount
        ) || 0;


      if (
        !platformMap[platform]
      ) {

        platformMap[platform] = {

          amount: 0,

          count: 0,

        };

      }


      platformMap[platform].amount +=
        amount;


      platformMap[platform].count +=
        1;

    }
  );


  const total =
    Object.values(
      platformMap
    ).reduce(

      (
        sum,
        item
      ) =>
        sum +
        item.amount,

      0

    );


  const result =
    Object.entries(
      platformMap
    )

      .map(
        ([
          platform,
          item,
        ]) => ({

          platform,

          amount:
            item.amount,

          count:
            item.count,

          rate:
            total > 0
              ? item.amount /
                total
              : 0,

        })
      )

      .sort(

        (
          a,
          b
        ) =>
          b.amount -
          a.amount

      );


  console.log(
    "Platform Allocation:",
    result
  );


  return result;

}
