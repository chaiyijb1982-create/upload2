import { supabase } from "@/lib/supabase";
import { getLatestAsset } from "@/lib/asset";

/**
 * ============================================================
 * Fixed Income
 * ============================================================
 *
 * 设计：
 *
 * 1. CNY 固收：
 *    amount 本身就是人民币
 *
 * 2. USD 固收：
 *    amount 保存美元原始金额
 *
 * 3. USD/CNY：
 *    不再以 fixed_income_assets.exchange_rate 作为当前汇率
 *    当前汇率统一使用 Dashboard 的 asset.usd_cny
 *
 * 4. exchange_rate：
 *    保留字段只是为了兼容旧数据。
 *    新数据不依赖它。
 *
 * ============================================================
 */

export type FixedIncomeType =
  | "万能险"
  | "活期"
  | "银行理财"
  | "定期存款"
  | "货币基金"
  | "债券"
  | "固收理财"
  | "其他";

export type FixedIncomeCurrency =
  | "CNY"
  | "USD";

export interface FixedIncomeAsset {
  id: string;

  type: FixedIncomeType | string;

  name: string;

  institution?: string | null;

  /**
   * 原始金额
   *
   * CNY：人民币
   * USD：美元
   */
  amount: number;


  /**
   * 所属市场
   *
   * CN 中国大陆
   * HK 香港
   */
  market: "CN" | "HK";


  /**
   * 原始币种
   */
  currency: FixedIncomeCurrency;


  /**
   * 历史字段
   * 不作为每日汇率来源
   */
  exchange_rate?: number | null;


  interest_rate: number | null;

  auto_interest: boolean;

  interest_date?: string | null;

  note?: string | null;

  group_id?: string | null;

  sort_order?: number | null;

  created_at?: string | null;

  updated_at?: string | null;
}

export interface FixedIncomeGroup {
  id: string;

  name: string;

  sort_order?: number | null;

  created_at?: string | null;

  updated_at?: string | null;
}


/**
 * ============================================================
 * 默认值
 * ============================================================
 */




/**
 * ============================================================
 * 工具函数
 * ============================================================
 */

export function toNumber(
  value: unknown
): number {
  const n = Number(value ?? 0);

  return Number.isFinite(n)
    ? n
    : 0;
}


/**
 * ============================================================
 * 币种标准化
 * ============================================================
 */

export function normalizeCurrency(
  value: unknown
): FixedIncomeCurrency {

  return String(value ?? "")
    .trim()
    .toUpperCase() === "USD"
    ? "USD"
    : "CNY";
}


/**
 * ============================================================
 * Dashboard 当前 USD/CNY
 *
 * 唯一来源：
 *
 * asset.usd_cny
 *
 * ============================================================
 */

export async function getDashboardUsdCnyRate(): Promise<number> {

  const asset = await getLatestAsset();

  const rate =
    toNumber(asset?.usd_cny);

  if(rate > 0){
    return rate;
  }

  throw new Error(
    "Dashboard USD/CNY unavailable"
  );
}


/**
 * ============================================================
 * 资产标准化
 * ============================================================
 */

export function normalizeAsset(
  row: any
): FixedIncomeAsset {

  const currency =
    normalizeCurrency(
      row?.currency
    );

  return {

    id:
      String(
        row?.id ?? ""
      ),

    type:
      String(
        row?.type ?? "其他"
      ),

    name:
      String(
        row?.name ?? ""
      ),

    institution:
      row?.institution ??
      null,

    amount:
      toNumber(
        row?.amount
      ),

    currency,

    exchange_rate:
      row?.exchange_rate !== null &&
      row?.exchange_rate !== undefined
        ? toNumber(
            row.exchange_rate
          )
        : null,

    interest_rate:
      toNumber(
        row?.interest_rate
      ),

    auto_interest:
      Boolean(
        row?.auto_interest
      ),

    interest_date:
      row?.interest_date ??
      null,

    note:
      row?.note ??
      null,

    group_id:
      row?.group_id ??
      null,

    sort_order:
      row?.sort_order !== null &&
      row?.sort_order !== undefined
        ? toNumber(
            row.sort_order
          )
        : null,

    created_at:
      row?.created_at ??
      null,

    updated_at:
      row?.updated_at ??
      null,

    market:
  row?.market === "HK"
    ? "HK"
    : "CN",  
  };
}


/**
 * ============================================================
 * USD → CNY
 * ============================================================
 */

export function getFixedIncomeAssetCnyAmount(
  asset: FixedIncomeAsset,
  usdCnyRate: number = 0
): number {

  const amount =
    Number(asset.amount || 0);


  if (
    asset.currency === "USD"
  ) {

    const rate =
      Number(
        usdCnyRate ||
        asset.exchange_rate ||
        0
      );


    return amount * rate;
  }


  return amount;
}


/**
 * ============================================================
 * 每日利息
 *
 * 年利率 / 365
 * ============================================================
 */

export function getFixedIncomeAssetDailyInterest(
  asset: FixedIncomeAsset,
  usdCnyRate?: number
): number {

  const amountCny =
    getFixedIncomeAssetCnyAmount(
      asset,
      usdCnyRate
    );

  const interestRate =
    toNumber(
      asset?.interest_rate
    );

  if (
    amountCny <= 0 ||
    interestRate <= 0
  ) {

    return 0;

  }

  return (
    amountCny *
    interestRate /
    100 /
    365
  );
}


/**
 * ============================================================
 * 年利息
 * ============================================================
 */

export function getFixedIncomeAssetAnnualInterest(
  asset: FixedIncomeAsset,
  usdCnyRate?: number
): number {

  const amountCny =
    getFixedIncomeAssetCnyAmount(
      asset,
      usdCnyRate
    );

  const interestRate =
    toNumber(
      asset?.interest_rate
    );

  if (
    amountCny <= 0 ||
    interestRate <= 0
  ) {

    return 0;

  }

  return (
    amountCny *
    interestRate /
    100
  );
}


/**
 * ============================================================
 * 获取固收资产
 * ============================================================
 */

export async function getFixedIncomeAssets(): Promise<
  FixedIncomeAsset[]
> {

  const {
    data,
    error,
  } =
    await supabase

      .from(
        "fixed_income_assets"
      )

      .select("*")

      .order(
        "sort_order",
        {
          ascending: true,
        }
      )

      .order(
        "created_at",
        {
          ascending: true,
        }
      );

  if (
    error
  ) {

    console.error(
      "getFixedIncomeAssets error:",
      error
    );

    throw error;

  }

  return (
    Array.isArray(data)
      ? data
      : []
  )
    .map(
      normalizeAsset
    );

}


/**
 * ============================================================
 * 获取分组
 * ============================================================
 */

export async function getFixedIncomeGroups(): Promise<
  FixedIncomeGroup[]
> {

  const {
    data,
    error,
  } =
    await supabase

      .from(
        "fixed_income_groups"
      )

      .select("*")

      .order(
        "sort_order",
        {
          ascending: true,
        }
      )

      .order(
        "created_at",
        {
          ascending: true,
        }
      );

  if (
    error
  ) {

    console.error(
      "getFixedIncomeGroups error:",
      error
    );

    throw error;

  }

  return (
    Array.isArray(data)
      ? data
      : []
  )
    .map(
      (row: any) => ({

        id:
          String(
            row?.id ?? ""
          ),

        name:
          String(
            row?.name ?? ""
          ),

        sort_order:
          row?.sort_order !== null &&
          row?.sort_order !== undefined
            ? toNumber(
                row.sort_order
              )
            : null,

        created_at:
          row?.created_at ??
          null,

        updated_at:
          row?.updated_at ??
          null,

      })
    );

}


/**
 * ============================================================
 * 创建固收资产
 * ============================================================
 */

export async function createFixedIncomeAsset(
  input: Partial<FixedIncomeAsset>
) {

  const amount =
    toNumber(
      input.amount
    );

  if (
    amount <= 0
  ) {

    throw new Error(
      "资产金额必须大于 0"
    );

  }

  const interestRate =
    toNumber(
      input.interest_rate
    );

  if (
    interestRate < 0
  ) {

    throw new Error(
      "年利率不能小于 0"
    );

  }

  const currency =
    normalizeCurrency(
      input.currency
    );

  /**
   * 新版本：
   *
   * USD 不再保存每日汇率。
   *
   * exchange_rate 保留为 null。
   */
    const payload = {

    type:
      input.type ??
      "其他",


    name:
      String(
        input.name ?? ""
      )
        .trim(),


    institution:
      input.institution ??
      null,


    amount,


    currency,


    market:
  normalizeCurrency(input.currency) === "USD"
    ? "HK"
    : "CN",


    exchange_rate:
      null,


    interest_rate:
      interestRate,


    auto_interest:
      Boolean(
        input.auto_interest
      ),


    interest_date:
      input.interest_date ??
      null,


    note:
      input.note ??
      null,


    group_id:
      input.group_id ??
      null,


    sort_order:
      input.sort_order ??
      0,

  };


  const {
    data,
    error,
  } =
    await supabase

      .from(
        "fixed_income_assets"
      )

      .insert(
        payload
      )

      .select("*")

      .single();

  if (
    error
  ) {

    console.error(
      "createFixedIncomeAsset error:",
      error
    );

    throw error;

  }

  return normalizeAsset(
    data
  );

}


/**
 * ============================================================
 * 更新固收资产
 * ============================================================
 */

export async function updateFixedIncomeAsset(
  id: string,
  input: Partial<FixedIncomeAsset>
) {

  const payload: any = {};


  if (
    input.type !== undefined
  ) {

    payload.type =
      input.type;

  }


  if (
    input.name !== undefined
  ) {

    payload.name =
      String(
        input.name
      )
        .trim();

  }


  if (
    input.institution !== undefined
  ) {

    payload.institution =
      input.institution;

  }


  if (
    input.amount !== undefined
  ) {

    const amount =
      toNumber(
        input.amount
      );

    if (
      amount <= 0
    ) {

      throw new Error(
        "资产金额必须大于 0"
      );

    }

    payload.amount =
      amount;

  }


  if (
    input.currency !== undefined
  ) {

    payload.currency =
      normalizeCurrency(
        input.currency
      );

  }

if (
 input.currency !== undefined
) {

  payload.market =
    normalizeCurrency(
      input.currency
    ) === "USD"
      ? "HK"
      : "CN";

}
  /**
   * 重要：
   *
   * 不再更新 exchange_rate。
   *
   * 统一使用 Dashboard asset.usd_cny。
   */
  if (
    input.currency !== undefined
  ) {

    payload.exchange_rate =
      null;

  }


  if (
    input.interest_rate !== undefined
  ) {

    const rate =
      toNumber(
        input.interest_rate
      );

    if (
      rate < 0
    ) {

      throw new Error(
        "年利率不能小于 0"
      );

    }

    payload.interest_rate =
      rate;

  }


  if (
    input.auto_interest !== undefined
  ) {

    payload.auto_interest =
      Boolean(
        input.auto_interest
      );

  }


  if (
    input.interest_date !== undefined
  ) {

    payload.interest_date =
      input.interest_date;

  }


  if (
    input.note !== undefined
  ) {

    payload.note =
      input.note;

  }


  if (
    input.group_id !== undefined
  ) {

    payload.group_id =
      input.group_id;

  }


  if (
    input.sort_order !== undefined
  ) {

    payload.sort_order =
      input.sort_order;

  }


  const {
    data,
    error,
  } =
    await supabase

      .from(
        "fixed_income_assets"
      )

      .update(
        payload
      )

      .eq(
        "id",
        id
      )

      .select("*")

      .single();

  if (
    error
  ) {

    console.error(
      "updateFixedIncomeAsset error:",
      error
    );

    throw error;

  }

  return normalizeAsset(
    data
  );

}


/**
 * ============================================================
 * 删除资产
 * ============================================================
 */

export async function deleteFixedIncomeAsset(
  id: string
) {

  const {
    error
  } =
    await supabase

      .from(
        "fixed_income_assets"
      )

      .delete()

      .eq(
        "id",
        id
      );

  if (
    error
  ) {

    console.error(
      "deleteFixedIncomeAsset error:",
      error
    );

    throw error;

  }

}


/**
 * ============================================================
 * 创建分组
 * ============================================================
 */

export async function createFixedIncomeGroup(
  name: string
) {

  const cleanName =
    String(
      name ?? ""
    )
      .trim();

  if (
    !cleanName
  ) {

    throw new Error(
      "分组名称不能为空"
    );

  }

  const {
    data: existing
  } =
    await supabase

      .from(
        "fixed_income_groups"
      )

      .select(
        "sort_order"
      )

      .order(
        "sort_order",
        {
          ascending: false,
        }
      )

      .limit(
        1
      )
      .maybeSingle();


  const nextSort =
    existing
      ? toNumber(
          existing.sort_order
        ) + 1
      : 0;


  const {
    data,
    error
  } =
    await supabase

      .from(
        "fixed_income_groups"
      )

      .insert({

        name:
          cleanName,

        sort_order:
          nextSort,

      })

      .select("*")

      .single();


  if (
    error
  ) {

    console.error(
      "createFixedIncomeGroup error:",
      error
    );

    throw error;

  }

  return data;

}


/**
 * ============================================================
 * 更新分组
 * ============================================================
 */

export async function updateFixedIncomeGroup(
  id: string,
  name: string
) {

  const cleanName =
    String(
      name ?? ""
    )
      .trim();

  if (
    !cleanName
  ) {

    throw new Error(
      "分组名称不能为空"
    );

  }

  const {
    data,
    error
  } =
    await supabase

      .from(
        "fixed_income_groups"
      )

      .update({

        name:
          cleanName,

      })

      .eq(
        "id",
        id
      )

      .select("*")

      .single();


  if (
    error
  ) {

    console.error(
      "updateFixedIncomeGroup error:",
      error
    );

    throw error;

  }

  return data;

}


/**
 * ============================================================
 * 删除分组
 *
 * 删除分组前：
 * 将里面的资产 group_id 设为 null
 * ============================================================
 */

export async function deleteFixedIncomeGroup(
  id: string
) {

  const {
    error:
      assetError
  } =
    await supabase

      .from(
        "fixed_income_assets"
      )

      .update({

        group_id:
          null,

      })

      .eq(
        "group_id",
        id
      );

  if (
    assetError
  ) {

    console.error(
      "deleteFixedIncomeGroup asset update error:",
      assetError
    );

    throw assetError;

  }


  const {
    error
  } =
    await supabase

      .from(
        "fixed_income_groups"
      )

      .delete()

      .eq(
        "id",
        id
      );


  if (
    error
  ) {

    console.error(
      "deleteFixedIncomeGroup error:",
      error
    );

    throw error;

  }

}


/**
 * ============================================================
 * 分组排序
 * ============================================================
 */

export async function updateFixedIncomeGroupOrder(
  groups: FixedIncomeGroup[]
) {

  const updates = groups.map(
    (group) =>
      supabase
        .from("fixed_income_groups")
        .update({
          sort_order:
            group.sort_order,
        })
        .eq(
          "id",
          group.id
        )
  );


  const results =
    await Promise.all(
      updates
    );


  const error =
    results.find(
      (result) =>
        result.error
    )?.error;


  if (error) {
    throw error;
  }

}


/**
 * ============================================================
 * 资产所属分组
 * ============================================================
 */

export async function updateFixedIncomeAssetGroup(
  id: string,
  groupId: string | null
) {

  const { data, error } =
    await supabase
      .from("fixed_income_assets")
      .update({
        group_id: groupId,
      })
      .eq(
        "id",
        id
      )
      .select()
      .single();


  if (error) {
    throw error;
  }


  return data;
}


/**
 * ============================================================
 * 资产排序
 * ============================================================
 */
/**
 * 逐条更新资产排序。
 * 与 page.tsx 中 `updateFixedIncomeAssetOrder(item.id, index)` 调用匹配。
 */
export async function updateFixedIncomeAssetOrder(
  assets: FixedIncomeAsset[]
) {

  const updates = assets.map(
    (asset) =>
      supabase
        .from("fixed_income_assets")
        .update({
          sort_order:
            asset.sort_order,
        })
        .eq(
          "id",
          asset.id
        )
  );


  const results =
    await Promise.all(
      updates
    );


  const error =
    results.find(
      (result) =>
        result.error
    )?.error;


  if (error) {
    throw error;
  }

}


/**
 * ============================================================
 * 固收总额
 * ============================================================
 */

export async function getFixedIncomeTotal(
  usdCnyRate?: number
): Promise<number> {

  const [
    assets,
    rate,
  ] =
    await Promise.all([

      getFixedIncomeAssets(),

      usdCnyRate !== undefined
        ? Promise.resolve(
            usdCnyRate
          )
        : getDashboardUsdCnyRate(),

    ]);


  return assets.reduce(

    (
      sum,
      asset
    ) => {

      return (
        sum +
        getFixedIncomeAssetCnyAmount(
          asset,
          rate
        )
      );

    },

    0

  );

}