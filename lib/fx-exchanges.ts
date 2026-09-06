import { supabase } from "@/lib/supabase";

// =====================================================
// 类型
// =====================================================

export type FxExchange = {
  id: string;

  exchange_date: string;

  from_currency: string;
  from_amount: number;

  to_currency: string;
  to_amount: number;

  actual_rate: number | null;

  fee: number;

  remark: string | null;

  created_at: string;
};

// =====================================================
// 获取换汇记录
// =====================================================

export async function getFxExchanges(): Promise<FxExchange[]> {
  const { data, error } = await supabase
    .from("fx_exchanges")
    .select("*")
    .order("exchange_date", {
      ascending: false,
    })
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error(
      "getFxExchanges error:",
      error
    );

    throw error;
  }

  return (data ?? []).map((item) => ({
    ...item,

    from_amount: Number(
      item.from_amount ?? 0
    ),

    to_amount: Number(
      item.to_amount ?? 0
    ),

    actual_rate:
      item.actual_rate === null ||
      item.actual_rate === undefined
        ? null
        : Number(item.actual_rate),

    fee: Number(
      item.fee ?? 0
    ),
  }));
}

// =====================================================
// 新增换汇
// =====================================================

export async function createFxExchange(
  payload: {
    exchange_date: string;

    from_currency: string;
    from_amount: number;

    to_currency: string;
    to_amount: number;

    fee?: number;

    remark?: string;
  }
): Promise<FxExchange> {

  if (
    !payload.exchange_date ||
    !payload.from_currency ||
    !payload.to_currency
  ) {
    throw new Error(
      "换汇日期和币种不能为空"
    );
  }

  if (
    !Number.isFinite(
      payload.from_amount
    ) ||
    payload.from_amount <= 0
  ) {
    throw new Error(
      "换出金额必须大于 0"
    );
  }

  if (
    !Number.isFinite(
      payload.to_amount
    ) ||
    payload.to_amount <= 0
  ) {
    throw new Error(
      "换入金额必须大于 0"
    );
  }

  // ===================================================
  // 实际汇率
  //
  // 例如：
  // CNY 100000
  // USD 13900
  //
  // = 100000 / 13900
  // = 7.194245
  // ===================================================

  const actualRate =
    payload.from_amount /
    payload.to_amount;

  const { data, error } =
    await supabase
      .from("fx_exchanges")
      .insert({
        exchange_date:
          payload.exchange_date,

        from_currency:
          payload.from_currency,

        from_amount:
          payload.from_amount,

        to_currency:
          payload.to_currency,

        to_amount:
          payload.to_amount,

        actual_rate:
          actualRate,

        fee:
          payload.fee ?? 0,

        remark:
          payload.remark?.trim() || null,
      })
      .select("*")
      .single();

  if (error) {
    console.error(
      "createFxExchange error:",
      error
    );

    throw error;
  }

  return {
    ...data,

    from_amount:
      Number(data.from_amount),

    to_amount:
      Number(data.to_amount),

    actual_rate:
      data.actual_rate === null
        ? null
        : Number(data.actual_rate),

    fee:
      Number(data.fee ?? 0),
  };
}

// =====================================================
// 删除
// =====================================================

export async function deleteFxExchange(
  id: string
): Promise<void> {

  const { error } =
    await supabase
      .from("fx_exchanges")
      .delete()
      .eq("id", id);

  if (error) {
    console.error(
      "deleteFxExchange error:",
      error
    );

    throw error;
  }
}

// =====================================================
// 获取某个本币 → CNY 的实际换汇汇率
// =====================================================
//
// 返回：
// 1 USD = ? CNY
//
// 例如：
// CNY 100000 → USD 13900
// 返回：7.194245
//
// 优先使用最近一笔实际换汇记录
// =====================================================

export async function getNativeToCnyRate(
  nativeCurrency: string
): Promise<number | null> {

  const currency =
    nativeCurrency
      .trim()
      .toUpperCase();

  if (!currency) {
    return null;
  }

  // CNY 本身不需要换算
  if (currency === "CNY") {
    return 1;
  }

  // ---------------------------------------------------
  // 找最近一笔：
  //
  // CNY → USD
  // 或
  // USD → CNY
  //
  // 两种方向都支持
  // ---------------------------------------------------

  const { data, error } =
    await supabase
      .from("fx_exchanges")
      .select(
        `
        exchange_date,
        from_currency,
        from_amount,
        to_currency,
        to_amount,
        actual_rate
        `
      )
      .or(
        `and(from_currency.eq.CNY,to_currency.eq.${currency}),and(from_currency.eq.${currency},to_currency.eq.CNY)`
      )
      .order(
        "exchange_date",
        {
          ascending: false,
        }
      )
      .limit(1);

  if (error) {
    console.error(
      "getNativeToCnyRate error:",
      error
    );

    throw error;
  }

  const row =
    data?.[0];

  if (!row) {
    return null;
  }

  // ---------------------------------------------------
  // CNY → Native
  //
  // 例如：
  // CNY 100000 → USD 13900
  //
  // Native → CNY：
  // 100000 / 13900
  // = 7.194245
  // ---------------------------------------------------

  if (
    row.from_currency === "CNY" &&
    row.to_currency === currency
  ) {
    const fromAmount =
      Number(row.from_amount ?? 0);

    const toAmount =
      Number(row.to_amount ?? 0);

    if (
      fromAmount <= 0 ||
      toAmount <= 0
    ) {
      return null;
    }

    return (
      fromAmount /
      toAmount
    );
  }

  // ---------------------------------------------------
  // Native → CNY
  //
  // 例如：
  // USD 13900 → CNY 100000
  //
  // 1 USD = 100000 / 13900 CNY
  // ---------------------------------------------------

  if (
    row.from_currency === currency &&
    row.to_currency === "CNY"
  ) {
    const fromAmount =
      Number(row.from_amount ?? 0);

    const toAmount =
      Number(row.to_amount ?? 0);

    if (
      fromAmount <= 0 ||
      toAmount <= 0
    ) {
      return null;
    }

    return (
      toAmount /
      fromAmount
    );
  }

  return null;
}