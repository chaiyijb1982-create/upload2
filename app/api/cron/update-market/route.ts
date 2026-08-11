// =====================================================
// app/api/cron/update-market/route.ts
//
// 全球资产自动更新
//
// 运行方式：
//
// GET /api/cron/update-market
//
// Vercel Cron：
// 每天 UTC 22:00
// = 中国时间每天 06:00
//
// 功能：
// 1. 获取 USD/CNY
// 2. 获取所有 active Holdings
// 3. 中国基金 → 天天基金 / 东方财富
// 4. 美股 / ETF → Finnhub
// 5. HK / LU → StockEvents
// 6. 计算人民币市值
// 7. 更新 Holdings
// 8. 创建 / 更新 holdings_history
// 9. 创建 / 更新 asset_history
//
// holdings_history 规则：
//
// - 当天至少有一个市场成功更新
//   → 创建当天历史快照
//
// - 同一个 code + snapshot_date
//   → 不重复 INSERT
//   → UPDATE
//
// - 如果当天没有任何市场更新
//   → 不创建 holdings_history
//
// 注意：
// 当前 route 不依赖 CRON_SECRET
// =====================================================

import {
  supabase,
} from "@/lib/supabase";

import {
  getMarketPrice,
  getUsdCny,
} from "@/lib/market-data";

import type {
  MarketSource,
} from "@/lib/market-data";


// =====================================================
// Next.js
// =====================================================

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";


// =====================================================
// 类型
// =====================================================

type Holding = {

  id: number;

  code?: string | null;

  name?: string | null;

  market?: string | null;

  category?: string | null;

  amount?: number | null;

  cost?: number | null;

  profit?: number | null;

  profit_rate?: number | null;

  currency?: string | null;

  nav?: number | null;

  shares?: number | null;

  platform?: string | null;

  active?: boolean | null;

};


// =====================================================
// 工具
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
// bigint 字段
// =====================================================

function toBigIntNumber(
  value: any
): number {

  const n =
    toNumber(value);

  if (
    !Number.isFinite(n)
  ) {

    return 0;

  }

  return Math.round(
    n
  );

}


// =====================================================
// 中国日期
//
// 所有历史记录统一使用中国日期
// =====================================================

function getChinaDate(): string {

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "Asia/Shanghai",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",

    }
  )
    .format(
      new Date()
    );

}


// =====================================================
// 判断 USD
// =====================================================

function isUsdAsset(
  source: MarketSource,
  currency?: string | null
): boolean {

  const curr =
    String(
      currency ?? ""
    )
      .trim()
      .toUpperCase();


  // 明确 USD
  if (
    curr === "USD"
  ) {

    return true;

  }


  // 明确 CNY
  if (
    curr === "CNY" ||
    curr === "RMB"
  ) {

    return false;

  }


  // Finnhub 默认 USD
  if (
    source === "finnhub"
  ) {

    return true;

  }


  // StockEvents 当前返回 USD
  if (
    source === "stockevents"
  ) {

    return true;

  }


  // 默认 CNY
  return false;

}


// =====================================================
// 获取 Active Holdings
// =====================================================

async function getActiveHoldings(): Promise<Holding[]> {

  const {
    data,
    error,
  } =
    await supabase

      .from(
        "holdings"
      )

      .select(
        "*"
      )

      .eq(
        "active",
        true
      )

      .order(
        "id",
        {
          ascending:
            true,
        }
      );


  if (
    error
  ) {

    console.error(
      "❌ 获取 Holdings 失败:",
      error
    );

    return [];

  }


  return (
    data ?? []
  ) as Holding[];

}


// =====================================================
// 更新单个 Holding
// =====================================================

async function updateHolding(
  holding: Holding,
  usdCny: number
) {

  const id =
    holding.id;


  const code =
    String(
      holding.code ?? ""
    )
      .trim()
      .toUpperCase();


  const name =
    String(
      holding.name ?? ""
    )
      .trim();


  // ===================================================
  // 代码检查
  // ===================================================

  if (
    !code
  ) {

    return {

      id,

      code,

      name,

      status:
        "failed",

      reason:
        "代码为空",

    };

  }


  // ===================================================
  // 获取市场数据
  // ===================================================

  const {
    source,
    data,
  } =
    await getMarketPrice(
      code
    );


  // ===================================================
  // 特殊资产
  // ===================================================

  if (
    source === "skip"
  ) {

    return {

      id,

      code,

      name,

      source,

      status:
        "skipped",

      reason:
        "特殊资产，不自动更新",

    };

  }


  // ===================================================
  // 市场价格获取失败
  // ===================================================

  if (
    !data ||
    !data.price ||
    data.price <= 0
  ) {

    return {

      id,

      code,

      name,

      source,

      status:
        "failed",

      reason:
        "市场价格获取失败",

    };

  }


  const nav =
    toNumber(
      data.price
    );


  // ===================================================
  // Shares
  // ===================================================

  const shares =
    toNumber(
      holding.shares
    );


  if (
    shares <= 0
  ) {

    return {

      id,

      code,

      name,

      source,

      status:
        "failed",

      reason:
        "shares <= 0，无法计算市值",

    };

  }


  // ===================================================
  // 原始金额
  // ===================================================

  const rawAmount =
    nav *
    shares;


  // ===================================================
  // 转人民币
  // ===================================================

  const amountCny =
    isUsdAsset(
      source,
      holding.currency
    )

      ? rawAmount *
        usdCny

      : rawAmount;


  // ===================================================
  // 成本
  // ===================================================

  const cost =
    toNumber(
      holding.cost
    );


  // ===================================================
  // 利润
  // ===================================================

  const profit =
    amountCny -
    cost;


  // ===================================================
  // 收益率
  // ===================================================

  const profitRate =
    cost !== 0

      ? (
          profit /
          cost
        ) * 100

      : 0;


  // ===================================================
  // Supabase Payload
  // ===================================================

  const payload = {

    nav:
      Number(
        nav.toFixed(
          8
        )
      ),

    amount:
      toBigIntNumber(
        amountCny
      ),

    profit:
      toBigIntNumber(
        profit
      ),

    profit_rate:
      Number(
        profitRate.toFixed(
          4
        )
      ),

    updated_at:
      new Date()
        .toISOString(),

  };


  // ===================================================
  // 更新 Holdings
  // ===================================================

  const {
    data:
      updated,
    error,
  } =
    await supabase

      .from(
        "holdings"
      )

      .update(
        payload
      )

      .eq(
        "id",
        id
      )

      .select(
        "*"
      )

      .single();


  // ===================================================
  // 更新失败
  // ===================================================

  if (
    error
  ) {

    console.error(
      `❌ 更新失败 [${code}]:`,
      error
    );


    return {

      id,

      code,

      name,

      source,

      status:
        "failed",

      reason:
        error.message,

    };

  }


  // ===================================================
  // 成功
  // ===================================================

  console.log(
    `✅ ${code} | ${source} | NAV=${nav} | amount=${payload.amount}`
  );


  return {

    id,

    code,

    name,

    source,

    status:
      "updated",

    nav,

    amount:
      payload.amount,

    cost,

    profit:
      payload.profit,

    profit_rate:
      payload.profit_rate,

    currency:
      holding.currency ?? "CNY",

    market:
      holding.market ?? null,

    category:
      holding.category ?? null,

    shares,

    updated_at:
      updated?.updated_at ??
      payload.updated_at,

  };

}


// =====================================================
// 创建 / 更新 Holdings History
//
// 重要：
//
// holdings_history 是真正的每日持仓历史
//
// 每天：
// code + snapshot_date
// 最多一条
//
// 如果当天已经存在：
// UPDATE
//
// 如果不存在：
// INSERT
//
// 只有当天至少有一个 Holding 成功更新
// 才会执行这里
// =====================================================

async function createHoldingsHistory(
  snapshotDate: string
) {

  // ===================================================
  // 获取当前全部 active holdings
  // ===================================================

  const {
    data,
    error,
  } =
    await supabase

      .from(
        "holdings"
      )

      .select(
        `
        code,
        name,
        market,
        category,
        amount,
        updated_at,
        cost,
        profit,
        profit_rate,
        currency,
        nav,
        shares,
        snapshot_date
        `
      )

      .eq(
        "active",
        true
      );


  if (
    error
  ) {

    console.error(
      "❌ 获取 Holdings History 数据失败:",
      error
    );

    return {

      success:
        false,

      inserted:
        0,

      updated:
        0,

      failed:
        0,

      error:
        error.message,

    };

  }


  const holdings =
    data ?? [];


  if (
    holdings.length === 0
  ) {

    return {

      success:
        false,

      inserted:
        0,

      updated:
        0,

      failed:
        0,

      error:
        "没有 active holdings",

    };

  }


  // ===================================================
  // 统计
  // ===================================================

  let inserted =
    0;

  let updated =
    0;

  let failed =
    0;


  // ===================================================
  // 逐个保存历史
  // ===================================================

  for (
    const holding
    of holdings
  ) {

    const code =
      String(
        holding.code ?? ""
      )
        .trim()
        .toUpperCase();


    if (
      !code
    ) {

      failed++;

      continue;

    }


    // =================================================
    // 历史 Payload
    // =================================================

    const payload = {

      code,

      name:
        holding.name ??
        null,

      market:
        holding.market ??
        null,

      category:
        holding.category ??
        null,

      amount:
        toBigIntNumber(
          holding.amount
        ),

      updated_at:
        holding.updated_at ??
        new Date()
          .toISOString(),

      cost:
        toBigIntNumber(
          holding.cost
        ),

      profit:
        toBigIntNumber(
          holding.profit
        ),

      profit_rate:
        Number(
          toNumber(
            holding.profit_rate
          ).toFixed(
            4
          )
        ),

      currency:
        holding.currency ??
        "CNY",

      nav:
        toNumber(
          holding.nav
        ),

      shares:
        toNumber(
          holding.shares
        ),

      snapshot_date:
        snapshotDate,

    };


    // =================================================
    // 查询当天该 code 是否已经存在
    // =================================================

    const {
      data:
        existing,
      error:
        existingError,
    } =
      await supabase

        .from(
          "holdings_history"
        )

        .select(
          "id"
        )

        .eq(
          "code",
          code
        )

        .eq(
          "snapshot_date",
          snapshotDate
        )

        .limit(
          1
        );


    // =================================================
    // 查询失败
    // =================================================

    if (
      existingError
    ) {

      console.error(
        `❌ Holdings History 查询失败 [${code}]:`,
        existingError
      );

      failed++;

      continue;

    }


    // =================================================
    // 已存在 → UPDATE
    // =================================================

    if (
      existing &&
      existing.length > 0
    ) {

      const historyId =
        existing[0].id;


      const {
        error:
          updateError,
      } =
        await supabase

          .from(
            "holdings_history"
          )

          .update(
            payload
          )

          .eq(
            "id",
            historyId
          );


      if (
        updateError
      ) {

        console.error(
          `❌ Holdings History 更新失败 [${code}]:`,
          updateError
        );

        failed++;

        continue;

      }


      updated++;

      console.log(
        `🔄 Holdings History 更新: ${code} | ${snapshotDate}`
      );


      continue;

    }


    // =================================================
    // 不存在 → INSERT
    // =================================================

    const {
      error:
        insertError,
    } =
      await supabase

        .from(
          "holdings_history"
        )

        .insert(
          payload
        );


    if (
      insertError
    ) {

      console.error(
        `❌ Holdings History 插入失败 [${code}]:`,
        insertError
      );

      failed++;

      continue;

    }


    inserted++;

    console.log(
      `📝 Holdings History 创建: ${code} | ${snapshotDate}`
    );

  }


  // ===================================================
  // 完成
  // ===================================================

  console.log(
    "======================================="
  );

  console.log(
    "Holdings History 完成"
  );

  console.log(
    "日期:",
    snapshotDate
  );

  console.log(
    "INSERT:",
    inserted
  );

  console.log(
    "UPDATE:",
    updated
  );

  console.log(
    "FAILED:",
    failed
  );

  console.log(
    "======================================="
  );


  return {

    success:
      failed === 0,

    inserted,

    updated,

    failed,

    error:
      failed > 0
        ? "部分 Holdings History 写入失败"
        : null,

  };

}


// =====================================================
// 创建 / 更新 Asset History
// =====================================================

async function createAssetHistory(
  usdCny: number
) {

  // ===================================================
  // 获取当前 active Holdings
  // ===================================================

  const {
    data,
    error,
  } =
    await supabase

      .from(
        "holdings"
      )

      .select(
        "amount, market, code, active"
      )

      .eq(
        "active",
        true
      );


  if (
    error
  ) {

    console.error(
      "❌ 获取 Holdings 历史数据失败:",
      error
    );

    return {

      success:
        false,

      action:
        null,

      error:
        error.message,

      totalAsset:
        null,

      cnAsset:
        null,

      hkAsset:
        null,

    };

  }


  // ===================================================
  // 计算资产
  // ===================================================

  let totalAsset =
    0;

  let cnAsset =
    0;

  let hkAsset =
    0;


  (
    data ?? []
  ).forEach(
    (
      item: any
    ) => {

      const amount =
        toNumber(
          item.amount
        );


      totalAsset +=
        amount;


      const market =
        String(
          item.market ??
          ""
        )
          .trim()
          .toUpperCase();


      if (
        market === "CN" ||
        market === "CHINA"
      ) {

        cnAsset +=
          amount;

      } else {

        hkAsset +=
          amount;

      }

    }
  );


  // ===================================================
  // 中国日期
  // ===================================================

  const snapshotDate =
    getChinaDate();


  // ===================================================
  // Payload
  // ===================================================

  const payload = {

    snapshot_date:
      snapshotDate,

    total_asset:
      toBigIntNumber(
        totalAsset
      ),

    cn_asset:
      toBigIntNumber(
        cnAsset
      ),

    hk_asset:
      toBigIntNumber(
        hkAsset
      ),

    usd_cny:
      Number(
        usdCny.toFixed(
          4
        )
      ),

  };


  // ===================================================
  // 检查当天是否已经存在
  // ===================================================

  const {
    data:
      existing,
    error:
      existingError,
  } =
    await supabase

      .from(
        "asset_history"
      )

      .select(
        "id"
      )

      .eq(
        "snapshot_date",
        snapshotDate
      )

      .limit(
        1
      );


  if (
    existingError
  ) {

    console.error(
      "❌ 检查 asset_history 失败:",
      existingError
    );

    return {

      success:
        false,

      action:
        null,

      error:
        existingError.message,

      totalAsset,

      cnAsset,

      hkAsset,

    };

  }


  // ===================================================
  // 已存在 → UPDATE
  // ===================================================

  if (
    existing &&
    existing.length > 0
  ) {

    const historyId =
      existing[0].id;


    const {
      error:
        updateError,
    } =
      await supabase

        .from(
          "asset_history"
        )

        .update(
          payload
        )

        .eq(
          "id",
          historyId
        );


    if (
      updateError
    ) {

      console.error(
        "❌ 更新 asset_history 失败:",
        updateError
      );

      return {

        success:
          false,

        action:
          "update",

        error:
          updateError.message,

        totalAsset,

        cnAsset,

        hkAsset,

      };

    }


    console.log(
      "✅ asset_history 今日记录已更新"
    );


    return {

      success:
        true,

      action:
        "update",

      error:
        null,

      totalAsset,

      cnAsset,

      hkAsset,

    };

  }


  // ===================================================
  // 不存在 → INSERT
  // ===================================================

  const {
    error:
      insertError,
  } =
    await supabase

      .from(
        "asset_history"
      )

      .insert(
        payload
      );


  if (
    insertError
  ) {

    console.error(
      "❌ 插入 asset_history 失败:",
      insertError
    );

    return {

      success:
        false,

      action:
        "insert",

      error:
        insertError.message,

      totalAsset,

      cnAsset,

      hkAsset,

    };

  }


  console.log(
    "✅ asset_history 今日记录已创建"
  );


  return {

    success:
      true,

    action:
      "insert",

    error:
      null,

    totalAsset,

    cnAsset,

    hkAsset,

  };

}


// =====================================================
// GET
// =====================================================

export async function GET() {

  const startTime =
    Date.now();


  console.log();

  console.log(
    "======================================="
  );

  console.log(
    "开始自动更新全球资产"
  );

  console.log(
    "=======================================");


  // ===================================================
  // 1. USD/CNY
  // ===================================================

  const usdCny =
    await getUsdCny();


  if (
    !usdCny ||
    usdCny <= 0
  ) {

    return Response.json(

      {

        success:
          false,

        message:
          "USD/CNY 获取失败，本次停止更新",

      },

      {

        status:
          500,

      }

    );

  }


  console.log(
    "USD/CNY:",
    usdCny
  );


  // ===================================================
  // 2. Active Holdings
  // ===================================================

  const holdings =
    await getActiveHoldings();


  if (
    holdings.length === 0
  ) {

    return Response.json(

      {

        success:
          false,

        message:
          "没有找到 active holdings",

        usd_cny:
          usdCny,

      },

      {

        status:
          404,

      }

    );

  }


  console.log(
    "Active Holdings:",
    holdings.length
  );


  // ===================================================
  // 3. 更新全部资产
  // ===================================================

  const results:
    any[] =
    [];


  for (
    const holding
    of holdings
  ) {

    try {

      const result =
        await updateHolding(
          holding,
          usdCny
        );


      results.push(
        result
      );

    } catch (
      error: any
    ) {

      console.error(
        `❌ ${holding.code} 未知错误:`,
        error
      );


      results.push({

        id:
          holding.id,

        code:
          holding.code,

        name:
          holding.name,

        status:
          "failed",

        reason:
          error?.message ??
          "未知错误",

      });

    }

  }


  // ===================================================
  // 4. 统计
  // ===================================================

  const updated =
    results.filter(
      item =>
        item.status ===
        "updated"
    ).length;


  const failed =
    results.filter(
      item =>
        item.status ===
        "failed"
    ).length;


  const skipped =
    results.filter(
      item =>
        item.status ===
        "skipped"
    ).length;


  // ===================================================
  // 5. 中国日期
  // ===================================================

  const snapshotDate =
    getChinaDate();


  // ===================================================
  // 6. Holdings History
  //
  // 只要当天至少有一个资产成功更新
  // 就记录当天全部 active holdings
  //
  // 同一天重复执行：
  // UPDATE
  // 不重复 INSERT
  // ===================================================

  let holdingsHistory:
    any = {

      success:
        false,

      inserted:
        0,

      updated:
        0,

      failed:
        0,

      error:
        null,

    };


  if (
    updated > 0
  ) {

    holdingsHistory =
      await createHoldingsHistory(
        snapshotDate
      );

  }


  // ===================================================
  // 7. Asset History
  //
  // 只要有成功更新
  // 创建 / 更新当天资产历史
  // ===================================================

  let assetHistory:
    any = {

      success:
        false,

      action:
        null,

      error:
        null,

      totalAsset:
        null,

      cnAsset:
        null,

      hkAsset:
        null,

    };


  if (
    updated > 0
  ) {

    assetHistory =
      await createAssetHistory(
        usdCny
      );

  }


  // ===================================================
  // 8. 完成
  // ===================================================

  const duration =
    Date.now() -
    startTime;


  console.log();

  console.log(
    "======================================="
  );

  console.log(
    "全球资产自动更新完成"
  );

  console.log(
    "=======================================");


  console.log(
    "总资产:",
    holdings.length
  );


  console.log(
    "成功:",
    updated
  );


  console.log(
    "失败:",
    failed
  );


  console.log(
    "跳过:",
    skipped
  );


  console.log(
    "USD/CNY:",
    usdCny
  );


  console.log(
    "Holdings History:",
    holdingsHistory
  );


  console.log(
    "Asset History:",
    assetHistory
  );


  console.log(
    "耗时:",
    duration,
    "ms"
  );


  // ===================================================
  // 9. 返回结果
  // ===================================================

  return Response.json({

    success:
      failed === 0 &&
      (
        updated > 0 ||
        skipped > 0
      ) &&
      (
        assetHistory.success ||
        updated === 0
      ),

    date:
      snapshotDate,

    usd_cny:
      Number(
        usdCny.toFixed(
          4
        )
      ),

    total:
      holdings.length,

    updated,

    failed,

    skipped,

    holdings_history:
      holdingsHistory.success,

    holdings_history_inserted:
      holdingsHistory.inserted,

    holdings_history_updated:
      holdingsHistory.updated,

    holdings_history_failed:
      holdingsHistory.failed,

    holdings_history_error:
      holdingsHistory.error,

    asset_history:
      assetHistory.success,

    asset_history_action:
      assetHistory.action,

    asset_history_error:
      assetHistory.error,

    total_asset:
      assetHistory.totalAsset,

    cn_asset:
      assetHistory.cnAsset,

    hk_asset:
      assetHistory.hkAsset,

    duration_ms:
      duration,

    results,

  });

}