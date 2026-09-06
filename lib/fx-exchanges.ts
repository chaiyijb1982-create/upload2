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
// 工具
// =====================================================

function normalizeCurrency(
  currency: string
): string {
  return currency.trim().toUpperCase();
}

// =====================================================
// 获取换汇记录
// =====================================================

export async function getFxExchanges(): Promise<
  FxExchange[]
> {
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

  const fromCurrency =
    normalizeCurrency(
      payload.from_currency
    );

  const toCurrency =
    normalizeCurrency(
      payload.to_currency
    );

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
  //
  // CNY 100000
  // USD 13900
  //
  // 1 USD =
  // 100000 / 13900
  //
  // = 7.194245 CNY
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
          fromCurrency,

        from_amount:
          payload.from_amount,

        to_currency:
          toCurrency,

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
      Number(
        data.from_amount
      ),

    to_amount:
      Number(
        data.to_amount
      ),

    actual_rate:
      data.actual_rate === null ||
      data.actual_rate === undefined
        ? null
        : Number(
            data.actual_rate
          ),

    fee:
      Number(
        data.fee ?? 0
      ),
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
// 从实际换汇记录计算 Native → CNY
// =====================================================
//
// 返回：
// 1 Native = ? CNY
//
// 支持：
//
// CNY → USD
// USD → CNY
//
// CNY → HKD
// HKD → CNY
//
// 等。
// =====================================================

async function getRateFromFxExchanges(
  currency: string
): Promise<number | null> {
  const nativeCurrency =
    normalizeCurrency(currency);

  if (!nativeCurrency) {
    return null;
  }

  if (
    nativeCurrency === "CNY"
  ) {
    return 1;
  }

  // ===================================================
  // 先查询 Native → CNY
  // ===================================================

  const {
    data: nativeToCnyData,
    error: nativeToCnyError,
  } = await supabase
    .from("fx_exchanges")
    .select(
      `
      exchange_date,
      from_currency,
      from_amount,
      to_currency,
      to_amount,
      actual_rate,
      created_at
      `
    )
    .eq(
      "from_currency",
      nativeCurrency
    )
    .eq(
      "to_currency",
      "CNY"
    )
    .order(
      "exchange_date",
      {
        ascending: false,
      }
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .limit(1);

  if (nativeToCnyError) {
    console.error(
      "getRateFromFxExchanges Native → CNY error:",
      nativeToCnyError
    );

    throw nativeToCnyError;
  }

  const nativeToCnyRow =
    nativeToCnyData?.[0];

  if (nativeToCnyRow) {
    const fromAmount =
      Number(
        nativeToCnyRow.from_amount ??
          0
      );

    const toAmount =
      Number(
        nativeToCnyRow.to_amount ??
          0
      );

    if (
      fromAmount > 0 &&
      toAmount > 0
    ) {
      return (
        toAmount /
        fromAmount
      );
    }
  }

  // ===================================================
  // 再查询 CNY → Native
  // ===================================================

  const {
    data: cnyToNativeData,
    error: cnyToNativeError,
  } = await supabase
    .from("fx_exchanges")
    .select(
      `
      exchange_date,
      from_currency,
      from_amount,
      to_currency,
      to_amount,
      actual_rate,
      created_at
      `
    )
    .eq(
      "from_currency",
      "CNY"
    )
    .eq(
      "to_currency",
      nativeCurrency
    )
    .order(
      "exchange_date",
      {
        ascending: false,
      }
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    )
    .limit(1);

  if (cnyToNativeError) {
    console.error(
      "getRateFromFxExchanges CNY → Native error:",
      cnyToNativeError
    );

    throw cnyToNativeError;
  }

  const cnyToNativeRow =
    cnyToNativeData?.[0];

  if (cnyToNativeRow) {
    const fromAmount =
      Number(
        cnyToNativeRow.from_amount ??
          0
      );

    const toAmount =
      Number(
        cnyToNativeRow.to_amount ??
          0
      );

    if (
      fromAmount > 0 &&
      toAmount > 0
    ) {
      // CNY → Native
      //
      // 例如：
      //
      // CNY 100000
      // → HKD 109000
      //
      // 1 HKD =
      // 100000 / 109000 CNY

      return (
        fromAmount /
        toAmount
      );
    }
  }

  return null;
}

// =====================================================
// 从市场汇率 API 获取 Native → CNY
// =====================================================
//
// 使用 Frankfurter v2 API：
//
// https://api.frankfurter.dev/v2/rate/HKD/CNY
//
// 例如：
//
// HKD → CNY
// USD → CNY
// EUR → CNY
// GBP → CNY
// JPY → CNY
//
// 无需 API Key。
// =====================================================

async function getRateFromMarketApi(
  currency: string
): Promise<number | null> {
  const nativeCurrency =
    normalizeCurrency(currency);

  if (!nativeCurrency) {
    return null;
  }

  if (
    nativeCurrency === "CNY"
  ) {
    return 1;
  }

  // ===================================================
  // 第一种方式
  //
  // Native → CNY
  //
  // 例如：
  //
  // /rate/HKD/CNY
  // ===================================================

  try {
    const directUrl =
      `https://api.frankfurter.dev/v2/rate/${encodeURIComponent(
        nativeCurrency
      )}/CNY`;

    const response =
      await fetch(
        directUrl,
        {
          method: "GET",
          cache: "no-store",
        }
      );

    if (response.ok) {
      const result =
        await response.json();

      const rate =
        Number(
          result?.rate
        );

      if (
        Number.isFinite(rate) &&
        rate > 0
      ) {
        console.log(
          `[FX] Market rate ${nativeCurrency}/CNY = ${rate}`
        );

        return rate;
      }
    }
  } catch (error) {
    console.warn(
      `[FX] Direct market rate failed: ${nativeCurrency}/CNY`,
      error
    );
  }

  // ===================================================
  // 第二种方式
  //
  // CNY → Native
  //
  // 如果直接方向没有数据：
  //
  // /rate/CNY/HKD
  //
  // 再反算。
  // ===================================================

  try {
    const reverseUrl =
      `https://api.frankfurter.dev/v2/rate/CNY/${encodeURIComponent(
        nativeCurrency
      )}`;

    const response =
      await fetch(
        reverseUrl,
        {
          method: "GET",
          cache: "no-store",
        }
      );

    if (response.ok) {
      const result =
        await response.json();

      const reverseRate =
        Number(
          result?.rate
        );

      if (
        Number.isFinite(
          reverseRate
        ) &&
        reverseRate > 0
      ) {
        const rate =
          1 /
          reverseRate;

        console.log(
          `[FX] Market reverse rate ${nativeCurrency}/CNY = ${rate}`
        );

        return rate;
      }
    }
  } catch (error) {
    console.warn(
      `[FX] Reverse market rate failed: CNY/${nativeCurrency}`,
      error
    );
  }

  return null;
}

// =====================================================
// 获取某个本币 → CNY 的汇率
// =====================================================
//
// 优先级：
//
// 1. CNY
//    ↓
//    1
//
// 2. fx_exchanges
//    ↓
//    最近一笔真实换汇记录
//
// 3. 市场汇率 API
//    ↓
//    Frankfurter
//
// 4. 都失败
//    ↓
//    null
//
// =====================================================

export async function getNativeToCnyRate(
  nativeCurrency: string
): Promise<number | null> {
  const currency =
    normalizeCurrency(
      nativeCurrency
    );

  if (!currency) {
    return null;
  }

  // ===================================================
  // CNY 本身
  // ===================================================

  if (
    currency === "CNY"
  ) {
    return 1;
  }

  // ===================================================
  // 第一优先级：
  // 用户自己的实际换汇记录
  // ===================================================

  try {
    const exchangeRate =
      await getRateFromFxExchanges(
        currency
      );

    if (
      Number.isFinite(
        exchangeRate
      ) &&
      exchangeRate !== null &&
      exchangeRate > 0
    ) {
      console.log(
        `[FX] Using personal exchange rate ${currency}/CNY = ${exchangeRate}`
      );

      return exchangeRate;
    }
  } catch (error) {
    console.warn(
      `[FX] Failed to read personal exchange rate for ${currency}`,
      error
    );

    // =================================================
    // 注意：
    //
    // 即使 fx_exchanges 查询失败，
    // 也不要直接终止。
    //
    // 继续尝试市场汇率。
    // =================================================
  }

  // ===================================================
  // 第二优先级：
  // 市场汇率
  // ===================================================

  try {
    const marketRate =
      await getRateFromMarketApi(
        currency
      );

    if (
      Number.isFinite(
        marketRate
      ) &&
      marketRate !== null &&
      marketRate > 0
    ) {
      console.log(
        `[FX] Using market rate ${currency}/CNY = ${marketRate}`
      );

      return marketRate;
    }
  } catch (error) {
    console.error(
      `[FX] Market exchange rate failed for ${currency}`,
      error
    );
  }

  // ===================================================
  // 都失败
  // ===================================================

  console.error(
    `[FX] Unable to obtain ${currency}/CNY exchange rate`
  );

  return null;
}

