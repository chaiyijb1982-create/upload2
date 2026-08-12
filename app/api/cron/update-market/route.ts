// =====================================================
// app/api/cron/update-market/route.ts
//
// 全球资产自动更新
//
// 功能：
// 1. 判断中国 / 美国 / 香港 / 卢森堡各自交易日
// 2. 只在对应市场有新交易数据时更新
// 3. 中国基金 → CNY
// 4. US / HK / LU → USD × USD/CNY → CNY
// 5. 更新 holdings
// 6. 每次运行后写入 holdings_history
// 7. holdings_history 按 snapshot_date + code 防止重复
// 8. 更新 asset_history
// 9. WELAB_GOLD / HK_CASH 跳过
// 10. shares = 0 的资产允许正常更新
// 11. 每次 Cron 执行写入 cron_logs
// 12. 记录 running / success / failed
// 13. 记录更新数量、失败数量、跳过数量、耗时、错误
//
// 注意：
// 本文件只能运行在服务器端
// =====================================================

import { NextResponse } from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  supabase,
} from "@/lib/supabase";

import {
  getMarketPrice,
  getUsdCny,
} from "@/lib/market-data";


// =====================================================
// Runtime
// =====================================================

export const runtime = "nodejs";


// =====================================================
// 防止 GET 被缓存
// =====================================================

export const dynamic = "force-dynamic";


// =====================================================
// 类型
// =====================================================

type Holding = {

  id: number;

  code: string;

  name: string;

  market?: string | null;

  category?: string | null;

  amount?: number | null;

  cost?: number | null;

  profit?: number | null;

  profit_rate?: number | null;

  currency?: string | null;

  nav?: number | null;

  shares?: number | null;

  updated_at?: string | null;

  snapshot_date?: string | null;

};


type MarketStatus = {

  shouldUpdate: boolean;

  date: string;

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
// 日期
// =====================================================

function formatDate(
  date: Date
): string {

  return date
    .toISOString()
    .slice(0, 10);

}


// =====================================================
// YYYY-MM-DD → Date
// =====================================================

function parseDate(
  value: string
): Date {

  const parts =
    value.split("-");

  return new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    Number(parts[2])
  );

}


// =====================================================
// 工作日
// =====================================================

function isWeekend(
  date: Date
): boolean {

  const day =
    date.getDay();

  return (
    day === 0 ||
    day === 6
  );

}


// =====================================================
// Service Role Supabase Client
//
// 专门用于服务器端历史数据写入
// 以及 Cron 日志写入。
//
// 不要放到客户端。
// =====================================================

function getAdminSupabase() {

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;


  if (
    !url
  ) {

    throw new Error(
      "SUPABASE_URL 未配置"
    );

  }


  if (
    !serviceRoleKey
  ) {

    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY 未配置"
    );

  }


  return createClient(
    url,
    serviceRoleKey,
    {

      auth: {

        autoRefreshToken:
          false,

        persistSession:
          false,

      },

    }
  );

}


// =====================================================
// Cron Log
//
// 用于确认 Vercel Cron 是否真正执行。
// =====================================================

async function startCronLog() {

  try {

    const adminSupabase =
      getAdminSupabase();


    const {
      data,
      error,
    } =
      await adminSupabase

        .from(
          "cron_logs"
        )

        .insert({

          job_name:
            "update-market",

          status:
            "running",

          started_at:
            new Date().toISOString(),

        })

        .select(
          "id"
        )

        .single();


    if (
      error
    ) {

      console.error(
        "Cron log start failed:",
        error
      );

      return null;

    }


    return data?.id ?? null;

  } catch (
    error
  ) {

    console.error(
      "Cron log start exception:",
      error
    );

    return null;

  }

}


// =====================================================
// 完成 Cron Log
// =====================================================

async function finishCronLog(
  logId: number | null,
  data: {

    status:
      "success" |
      "failed";

    startedAt:
      number;

    updated?:
      number;

    failed?:
      number;

    skipped?:
      number;

    message?:
      string;

    error?:
      string | null;

    details?:
      any;

  }
) {

  if (
    !logId
  ) {

    return;

  }


  try {

    const adminSupabase =
      getAdminSupabase();


    const {
      error,
    } =
      await adminSupabase

        .from(
          "cron_logs"
        )

        .update({

          status:
            data.status,

          finished_at:
            new Date().toISOString(),

          duration_ms:
            Date.now() -
            data.startedAt,

          message:
            data.message ??
            null,

          updated_count:
            data.updated ??
            0,

          failed_count:
            data.failed ??
            0,

          skipped_count:
            data.skipped ??
            0,

          error:
            data.error ??
            null,

          details:
            data.details ??
            null,

        })

        .eq(
          "id",
          logId
        );


    if (
      error
    ) {

      console.error(
        "Cron log finish failed:",
        error
      );

    }

  } catch (
    error
  ) {

    console.error(
      "Cron log finish exception:",
      error
    );

  }

}


// =====================================================
// 交易日 API
//
// 使用 Yahoo Finance chart 判断市场是否有当天数据。
// =====================================================

async function checkTradingDay(
  market: string
): Promise<MarketStatus> {

  const today =
    new Date();


  const todayStr =
    formatDate(
      today
    );


  // ===================================================
  // 周末
  // ===================================================

  if (
    isWeekend(
      today
    )
  ) {

    return {

      shouldUpdate:
        false,

      date:
        todayStr,

    };

  }


  // ===================================================
  // 市场参考代码
  // ===================================================

  let symbol = "";


  if (
    market === "china"
  ) {

    symbol =
      "000001.SS";

  }
  else if (
    market === "us"
  ) {

    symbol =
      "SPY";

  }
  else if (
    market === "hongkong"
  ) {

    symbol =
      "^HSI";

  }
  else if (
    market === "luxembourg"
  ) {

    symbol =
      "VGK";

  }
  else {

    return {

      shouldUpdate:
        false,

      date:
        todayStr,

    };

  }


  try {

    const start =
      Math.floor(
        new Date(
          todayStr
        ).getTime() /
        1000
      );


    const end =
      Math.floor(
        (
          new Date(
            todayStr
          ).getTime() +
          24 *
          60 *
          60 *
          1000
        ) /
        1000
      );


    const url =
      "https://query1.finance.yahoo.com/v8/finance/chart/" +
      encodeURIComponent(
        symbol
      ) +
      `?period1=${start}` +
      `&period2=${end}` +
      "&interval=1d";


    const response =
      await fetch(
        url,
        {

          cache:
            "no-store",

          headers: {

            "User-Agent":
              "Mozilla/5.0",

          },

        }
      );


    if (
      !response.ok
    ) {

      console.warn(
        "Trading day check HTTP error:",
        market,
        response.status
      );


      return {

        shouldUpdate:
          !isWeekend(
            today
          ),

        date:
          todayStr,

      };

    }


    const data =
      await response.json();


    const timestamps =
      data
        ?.chart
        ?.result?.[0]
        ?.timestamp;


    if (
      Array.isArray(
        timestamps
      ) &&
      timestamps.length > 0
    ) {

      return {

        shouldUpdate:
          true,

        date:
          todayStr,

      };

    }


    return {

      shouldUpdate:
        false,

      date:
        todayStr,

    };

  } catch (
    error
  ) {

    console.warn(
      "Trading day check error:",
      market,
      error
    );


    return {

      shouldUpdate:
        !isWeekend(
          today
        ),

      date:
        todayStr,

    };

  }

}


// =====================================================
// 获取市场交易状态
// =====================================================

async function getMarketStatuses() {

  const [
    china,
    us,
    hongkong,
    luxembourg,
  ] =
    await Promise.all([

      checkTradingDay(
        "china"
      ),

      checkTradingDay(
        "us"
      ),

      checkTradingDay(
        "hongkong"
      ),

      checkTradingDay(
        "luxembourg"
      ),

    ]);


  return {

    china,

    us,

    hongkong,

    luxembourg,

  };

}


// =====================================================
// 根据 holdings.market 判断所属市场
// =====================================================

function getHoldingMarket(
  holding: Holding
): string {

  const market =
    String(
      holding?.market ??
      ""
    )
      .trim()
      .toUpperCase();


  if (
    market === "CN" ||
    market === "CHINA"
  ) {

    return "china";

  }


  if (
    market === "HK" ||
    market === "HONGKONG"
  ) {

    return "hongkong";

  }


  if (
    market === "US" ||
    market === "USA"
  ) {

    return "us";

  }


  if (
    market === "LU" ||
    market === "LUXEMBOURG"
  ) {

    return "luxembourg";

  }


  // ===================================================
  // 根据 code 再判断
  // ===================================================

  const code =
    String(
      holding?.code ??
      ""
    )
      .trim()
      .toUpperCase();


  if (
    code.startsWith(
      "HK"
    )
  ) {

    return "hongkong";

  }


  if (
    code.startsWith(
      "LU"
    )
  ) {

    return "luxembourg";

  }


  if (
    /^\d{6}$/.test(
      code
    )
  ) {

    return "china";

  }


  return "us";

}


// =====================================================
// USD → CNY
//
// 中国资产：
// shares × nav
//
// 海外资产：
// shares × nav × USD/CNY
//
// 特别注意：
// shares = 0 是合法状态。
// 此时 amount = 0。
// 不应该把它当成更新失败。
// =====================================================

function calculateAmountCny(
  holding: Holding,
  nav: number,
  usdCny: number,
  market: string
): number {

  const shares =
    toNumber(
      holding?.shares
    );


  // ===================================================
  // 非法 shares
  //
  // shares < 0 才是非法。
  // shares = 0 是合法的。
  // ===================================================

  if (
    shares < 0
  ) {

    return 0;

  }


  // ===================================================
  // NAV 无效
  // ===================================================

  if (
    nav <= 0
  ) {

    return 0;

  }


  // ===================================================
  // 没有持仓
  //
  // 这是合法状态。
  // 返回 0。
  // 上层不会再因为 amount = 0 判定失败。
  // ===================================================

  if (
    shares === 0
  ) {

    return 0;

  }


  // ===================================================
  // 原始市值
  // ===================================================

  const rawAmount =
    shares *
    nav;


  // ===================================================
  // 中国资产
  //
  // NAV 本身就是 CNY。
  // ===================================================

  if (
    market === "china"
  ) {

    return rawAmount;

  }


  // ===================================================
  // 海外资产
  //
  // USD × USD/CNY
  // ===================================================

  return (
    rawAmount *
    usdCny
  );

}


// =====================================================
// Profit
// =====================================================

function calculateProfit(
  amount: number,
  cost: number
): number {

  return (
    amount -
    cost
  );

}


// =====================================================
// Profit Rate
// =====================================================

function calculateProfitRate(
  profit: number,
  cost: number
): number {

  if (
    cost === 0
  ) {

    return 0;

  }


  return (
    profit /
    cost
  ) *
  100;

}


// =====================================================
// holdings_history
//
// Service Role Client
//
// 今天已有：UPDATE
// 今天没有：INSERT
//
// 判断：snapshot_date + code
//
// 注意：
// 保存全部 holdings。
// 包括：
// - 正常更新资产
// - shares = 0 的资产
// - 特殊资产
// - 没有当天价格但数据库已有值的资产
// =====================================================

async function saveHoldingsHistory(
  holdings: Holding[],
  snapshotDate: string
) {

  let inserted = 0;

  let updated = 0;

  let failed = 0;


  // ===================================================
  // 获取后台 Client
  // ===================================================

  let adminSupabase;


  try {

    adminSupabase =
      getAdminSupabase();

  } catch (
    error: any
  ) {

    return {

      inserted:
        0,

      updated:
        0,

      failed:
        holdings.length,

      error: [

        {

          operation:
            "config",

          message:
            error?.message ??
            String(error),

        },

      ],

    };

  }


  const errors:
    any[] = [];


  // ===================================================
  // 一个一个处理
  // ===================================================

  for (
    const holding of holdings
  ) {

    try {

      const code =
        String(
          holding?.code ??
          ""
        )
          .trim()
          .toUpperCase();


      if (
        !code
      ) {

        continue;

      }


      // =================================================
      // 今天是否已经存在
      // =================================================

      const {
        data: existing,
        error: existingError,
      } =
        await adminSupabase

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

          .maybeSingle();


      if (
        existingError
      ) {

        failed++;


        errors.push({

          operation:
            "select",

          code,

          message:
            existingError.message,

        });


        continue;

      }


      // =================================================
      // 历史数据
      // =================================================

      const historyData = {

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
          toNumber(
            holding.amount
          ),

        updated_at:
          new Date()
            .toISOString(),

        cost:
          Math.round(
            toNumber(
              holding.cost
            )
          ),

        profit:
          Math.round(
            toNumber(
              holding.profit
            )
          ),

        profit_rate:
          toNumber(
            holding.profit_rate
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
      // UPDATE
      // =================================================

      if (
        existing?.id
      ) {

        const {
          error:
            updateError,
        } =
          await adminSupabase

            .from(
              "holdings_history"
            )

            .update(
              historyData
            )

            .eq(
              "id",
              existing.id
            );


        if (
          updateError
        ) {

          failed++;


          errors.push({

            operation:
              "update",

            code,

            message:
              updateError.message,

          });

        }
        else {

          updated++;

        }


        continue;

      }


      // =================================================
      // INSERT
      // =================================================

      const {
        error:
          insertError,
      } =
        await adminSupabase

          .from(
            "holdings_history"
          )

          .insert(
            historyData
          );


      if (
        insertError
      ) {

        failed++;


        errors.push({

          operation:
            "insert",

          code,

          message:
            insertError.message,

        });

      }
      else {

        inserted++;

      }

    } catch (
      error: any
    ) {

      failed++;


      errors.push({

        operation:
          "exception",

        code:
          holding?.code,

        message:
          error?.message ??
          String(error),

      });

    }

  }


  return {

    inserted,

    updated,

    failed,

    error:
      errors.length > 0
        ? errors
        : null,

  };

}


// =====================================================
// Asset History
// =====================================================

async function saveAssetHistory(
  snapshotDate: string,
  usdCny: number
) {

  try {

    const {
      data: holdings,
      error,
    } =
      await supabase

        .from(
          "holdings"
        )

        .select(
          "*"
        );


    if (
      error
    ) {

      return {

        success:
          false,

        action:
          "failed",

        error:
          error.message,

      };

    }


    const list =
      Array.isArray(
        holdings
      )
        ? holdings
        : [];


    let cnAsset = 0;

    let hkAsset = 0;

    let totalProfit = 0;

    let cnProfit = 0;

    let hkProfit = 0;


    for (
      const item of list
    ) {

      const amount =
        toNumber(
          item?.amount
        );


      const profit =
        toNumber(
          item?.profit
        );


      const market =
        String(
          item?.market ??
          ""
        )
          .trim()
          .toUpperCase();


      if (
        market === "CN"
      ) {

        cnAsset +=
          amount;

        cnProfit +=
          profit;

      }
      else {

        hkAsset +=
          amount;

        hkProfit +=
          profit;

      }


      totalProfit +=
        profit;

    }


    const totalAsset =
      cnAsset +
      hkAsset;


    const totalCost =
      totalAsset -
      totalProfit;


    const totalRate =
      totalCost > 0
        ? (
            totalProfit /
            totalCost
          ) *
          100
        : 0;


    const cnCost =
      cnAsset -
      cnProfit;


    const hkCost =
      hkAsset -
      hkProfit;


    const cnRate =
      cnCost > 0
        ? (
            cnProfit /
            cnCost
          ) *
          100
        : 0;


    const hkRate =
      hkCost > 0
        ? (
            hkProfit /
            hkCost
          ) *
          100
        : 0;


    const record = {

      snapshot_date:
        snapshotDate,

      usd_cny:
        usdCny,

      cn_asset:
        Math.round(
          cnAsset
        ),

      cn_rate:
        cnRate,

      cn_profit:
        Math.round(
          cnProfit
        ),

      hk_asset:
        Math.round(
          hkAsset
        ),

      hk_rate:
        hkRate,

      hk_profit:
        Math.round(
          hkProfit
        ),

      total_asset:
        Math.round(
          totalAsset
        ),

      total_profit:
        Math.round(
          totalProfit
        ),

    };


    // ===================================================
    // 查询今天
    // ===================================================

    const {
      data: existing,
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

        .maybeSingle();


    if (
      existingError
    ) {

      return {

        success:
          false,

        action:
          "failed",

        error:
          existingError.message,

      };

    }


    // ===================================================
    // UPDATE
    // ===================================================

    if (
      existing?.id
    ) {

      const {
        error:
          updateError,
      } =
        await supabase

          .from(
            "asset_history"
          )

          .update(
            record
          )

          .eq(
            "id",
            existing.id
          );


      if (
        updateError
      ) {

        return {

          success:
            false,

          action:
            "update",

          error:
            updateError.message,

        };

      }


      return {

        success:
          true,

        action:
          "update",

        error:
          null,

      };

    }


    // ===================================================
    // INSERT
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
          record
        );


    if (
      insertError
    ) {

      return {

        success:
          false,

        action:
          "insert",

        error:
          insertError.message,

      };

    }


    return {

      success:
        true,

      action:
        "insert",

      error:
        null,

    };

  } catch (
    error: any
  ) {

    return {

      success:
        false,

      action:
        "failed",

      error:
        error?.message ??
        String(error),

    };

  }

}


// =====================================================
// GET
// =====================================================

export async function GET(
  request: Request
) {

  const startedAt =
    Date.now();


  let cronLogId:
    number | null = null;


  try {

    // ===================================================
    // Cron Secret
    // ===================================================

    const cronSecret =
      process.env.CRON_SECRET;


    if (
      cronSecret
    ) {

      const auth =
        request.headers.get(
          "authorization"
        );


      if (
        auth !==
        `Bearer ${cronSecret}`
      ) {

        return NextResponse.json(

          {

            success:
              false,

            error:
              "Unauthorized",

          },

          {

            status:
              401,

          }

        );

      }

    }


    // ===================================================
    // 开始记录 Cron
    // ===================================================

    cronLogId =
      await startCronLog();


    // ===================================================
    // 今天
    // ===================================================

    const today =
      new Date();


    const snapshotDate =
      formatDate(
        today
      );


    // ===================================================
    // USD/CNY
    // ===================================================

    const usdCny =
      await getUsdCny();


    if (
      !usdCny ||
      usdCny <= 0
    ) {

      await finishCronLog(

        cronLogId,

        {

          status:
            "failed",

          startedAt,

          message:
            "USD/CNY 获取失败",

          error:
            "USD/CNY 获取失败",

        }

      );


      return NextResponse.json(

        {

          success:
            false,

          error:
            "USD/CNY 获取失败",

        },

        {

          status:
            500,

        }

      );

    }


    // ===================================================
    // 市场状态
    // ===================================================

    const marketStatus =
      await getMarketStatuses();


    // ===================================================
    // 获取 holdings
    // ===================================================

    const {
      data:
        holdingsData,
      error:
        holdingsError,
    } =
      await supabase

        .from(
          "holdings"
        )

        .select(
          "*"
        );


    if (
      holdingsError
    ) {

      await finishCronLog(

        cronLogId,

        {

          status:
            "failed",

          startedAt,

          message:
            "获取 holdings 失败",

          error:
            holdingsError.message,

        }

      );


      return NextResponse.json(

        {

          success:
            false,

          error:
            holdingsError.message,

        },

        {

          status:
            500,

        }

      );

    }


    const holdings =
      Array.isArray(
        holdingsData
      )
        ? (
            holdingsData as Holding[]
          )
        : [];


    // ===================================================
    // 统计
    // ===================================================

    let updated =
      0;

    let failed =
      0;

    let skipped =
      0;


    const results:
      any[] = [];


    // ===================================================
    // 更新 holdings
    // ===================================================

    for (
      const holding of holdings
    ) {

      const code =
        String(
          holding?.code ??
          ""
        )
          .trim()
          .toUpperCase();


      // =================================================
      // 特殊资产
      // =================================================

      if (
        code ===
        "WELAB_GOLD" ||
        code ===
        "HK_CASH"
      ) {

        skipped++;


        results.push({

          id:
            holding.id,

          code,

          name:
            holding.name,

          source:
            "skip",

          status:
            "skipped",

          reason:
            "特殊资产，不自动更新",

        });


        continue;

      }


      // =================================================
      // 市场
      // =================================================

      const market =
        getHoldingMarket(
          holding
        );


      const status =
        marketStatus[
          market as keyof typeof marketStatus
        ];


      // =================================================
      // 今天不交易
      // =================================================

      if (
        !status?.shouldUpdate
      ) {

        skipped++;


        results.push({

          id:
            holding.id,

          code,

          name:
            holding.name,

          market,

          status:
            "skipped",

          reason:
            "今天不是该市场交易日",

        });


        continue;

      }


      // =================================================
      // 获取价格
      // =================================================

      try {

        const {
          source,
          data,
        } =
          await getMarketPrice(
            code
          );


        // =================================================
        // 价格无效
        //
        // 注意：
        // 这里判断的是 NAV。
        // 不能判断 amount。
        //
        // shares = 0：
        // amount = 0
        // 这是合法的。
        // =================================================

        if (
          !data ||
          !data.price ||
          data.price <= 0
        ) {

          failed++;


          results.push({

            id:
              holding.id,

            code,

            name:
              holding.name,

            source,

            market,

            status:
              "failed",

            reason:
              "市场价格获取失败",

          });


          continue;

        }


        const nav =
          toNumber(
            data.price
          );


        const shares =
          toNumber(
            holding.shares
          );


        // =================================================
        // 非法 shares
        //
        // shares = 0 是合法的。
        // shares < 0 才是非法。
        // =================================================

        if (
          shares < 0
        ) {

          failed++;


          results.push({

            id:
              holding.id,

            code,

            name:
              holding.name,

            source,

            market,

            status:
              "failed",

            reason:
              "持仓数量无效",

            shares,

            nav,

          });


          continue;

        }


        // =================================================
        // CNY 市值
        //
        // shares = 0 时：
        // amount = 0
        //
        // 不再因为 amount = 0 判定失败。
        // =================================================

        const amount =
          calculateAmountCny(

            holding,

            nav,

            usdCny,

            market

          );


        // =================================================
        // 成本
        // =================================================

        const cost =
          toNumber(
            holding.cost
          );


        // =================================================
        // 收益
        // =================================================

        const profit =
          calculateProfit(
            amount,
            cost
          );


        const profitRate =
          calculateProfitRate(
            profit,
            cost
          );


        // =================================================
        // 更新 holdings
        // =================================================

        const {
          error:
            updateError,
        } =
          await supabase

            .from(
              "holdings"
            )

            .update({

              amount:
                Math.round(
                  amount
                ),

              profit:
                Math.round(
                  profit
                ),

              profit_rate:
                profitRate,

              nav,

              currency:
                "CNY",

              updated_at:
                new Date()
                  .toISOString(),

            })

            .eq(
              "id",
              holding.id
            );


        if (
          updateError
        ) {

          failed++;


          results.push({

            id:
              holding.id,

            code,

            name:
              holding.name,

            source,

            market,

            status:
              "failed",

            reason:
              updateError.message,

          });


          continue;

        }


        updated++;


        // =================================================
        // 结果
        // =================================================

        results.push({

          id:
            holding.id,

          code,

          name:
            holding.name,

          source,

          market,

          status:
            "updated",

          nav,

          amount:
            Math.round(
              amount
            ),

          cost:
            Math.round(
              cost
            ),

          profit:
            Math.round(
              profit
            ),

          profit_rate:
            profitRate,

          currency:
            "CNY",

          shares,

          updated_at:
            new Date()
              .toISOString(),

        });

      } catch (
        error: any
      ) {

        failed++;


        results.push({

          id:
            holding.id,

          code,

          name:
            holding.name,

          market,

          status:
            "failed",

          reason:
            error?.message ??
            String(error),

        });

      }

    }


    // ===================================================
    // 重新读取 holdings
    // ===================================================

    const {
      data:
        updatedHoldingsData,
      error:
        updatedHoldingsError,
    } =
      await supabase

        .from(
          "holdings"
        )

        .select(
          "*"
        );


    if (
      updatedHoldingsError
    ) {

      await finishCronLog(

        cronLogId,

        {

          status:
            "failed",

          startedAt,

          updated,

          failed,

          skipped,

          message:
            "重新读取 holdings 失败",

          error:
            updatedHoldingsError.message,

          details:
            results,

        }

      );


      return NextResponse.json({

        success:
          false,

        error:
          updatedHoldingsError.message,

        results,

      });

    }


    const updatedHoldings =
      Array.isArray(
        updatedHoldingsData
      )
        ? (
            updatedHoldingsData as Holding[]
          )
        : [];


    // ===================================================
    // holdings_history
    //
    // 保存全部 holdings。
    // 与原来的 Python 行为保持一致。
    // ===================================================

    let holdingsHistoryInserted =
      0;

    let holdingsHistoryUpdated =
      0;

    let holdingsHistoryFailed =
      0;

    let holdingsHistoryError:
      any = null;


    if (
      updated > 0
    ) {

      const historyResult =
        await saveHoldingsHistory(

          updatedHoldings,

          snapshotDate

        );


      holdingsHistoryInserted =
        historyResult.inserted;

      holdingsHistoryUpdated =
        historyResult.updated;

      holdingsHistoryFailed =
        historyResult.failed;

      holdingsHistoryError =
        historyResult.error ??
        null;

    }


    // ===================================================
    // Asset History
    // ===================================================

    let assetHistoryResult:
      any = {

        success:
          false,

        action:
          "skip",

        error:
          null,

      };


    if (
      updated > 0
    ) {

      assetHistoryResult =
        await saveAssetHistory(

          snapshotDate,

          usdCny

        );

    }


    // ===================================================
    // 最终资产
    // ===================================================

    let totalAsset =
      0;

    let cnAsset =
      0;

    let hkAsset =
      0;


    for (
      const item of
      updatedHoldings
    ) {

      const amount =
        toNumber(
          item?.amount
        );


      totalAsset +=
        amount;


      const market =
        String(
          item?.market ??
          ""
        )
          .trim()
          .toUpperCase();


      if (
        market ===
        "CN"
      ) {

        cnAsset +=
          amount;

      }
      else {

        hkAsset +=
          amount;

      }

    }


    // ===================================================
    // 最终 Success
    //
    // 注意：
    // TEST2 失败时 success = false
    // 这是正确行为。
    //
    // GLD shares = 0 不会导致 failed。
    // ===================================================

    const success =
      failed === 0 &&
      holdingsHistoryFailed === 0 &&
      assetHistoryResult.success;


    // ===================================================
    // Cron Log
    //
    // 正常结束后写入最终结果。
    // ===================================================

    await finishCronLog(

      cronLogId,

      {

        status:
          success
            ? "success"
            : "failed",

        startedAt,

        updated,

        failed:
          failed +
          holdingsHistoryFailed,

        skipped,

        message:
          success
            ? "全球资产自动更新成功"
            : "全球资产自动更新存在失败",

        error:
          success
            ? null
            : (
                assetHistoryResult.error ??
                (
                  holdingsHistoryError
                    ? JSON.stringify(
                        holdingsHistoryError
                      )
                    : null
                ) ??
                null
              ),

        details: {

          date:
            snapshotDate,

          usd_cny:
            usdCny,

          total:
            holdings.length,

          updated,

          failed,

          skipped,

          holdings_history_inserted:
            holdingsHistoryInserted,

          holdings_history_updated:
            holdingsHistoryUpdated,

          holdings_history_failed:
            holdingsHistoryFailed,

          asset_history_action:
            assetHistoryResult.action,

          asset_history_success:
            assetHistoryResult.success,

          total_asset:
            Math.round(
              totalAsset
            ),

          cn_asset:
            Math.round(
              cnAsset
            ),

          hk_asset:
            Math.round(
              hkAsset
            ),

          results,

        },

      }

    );


    // ===================================================
    // 最终 Response
    // ===================================================

    return NextResponse.json({

      success,

      date:
        snapshotDate,

      usd_cny:
        usdCny,

      total:
        holdings.length,

      updated,

      failed,

      skipped,

      // =================================================
      // Holdings History
      // =================================================

      holdings_history:
        updated > 0,

      holdings_history_saved:
        holdingsHistoryInserted +
        holdingsHistoryUpdated,

      holdings_history_inserted:
        holdingsHistoryInserted,

      holdings_history_updated:
        holdingsHistoryUpdated,

      holdings_history_failed:
        holdingsHistoryFailed,

      holdings_history_error:
        holdingsHistoryError,

      // =================================================
      // Asset History
      // =================================================

      asset_history:
        assetHistoryResult.success,

      asset_history_action:
        assetHistoryResult.action,

      asset_history_error:
        assetHistoryResult.error,

      // =================================================
      // Assets
      // =================================================

      total_asset:
        Math.round(
          totalAsset
        ),

      cn_asset:
        Math.round(
          cnAsset
        ),

      hk_asset:
        Math.round(
          hkAsset
        ),

      // =================================================
      // Cron Log
      // =================================================

      cron_log:
        cronLogId
          ? true
          : false,

      cron_log_id:
        cronLogId,

      duration_ms:
        Date.now() -
        startedAt,

      results,

    });

  } catch (
    error: any
  ) {

    console.error(
      "update-market fatal error:",
      error
    );


    // ===================================================
    // Fatal Error → Cron Log
    // ===================================================

    await finishCronLog(

      cronLogId,

      {

        status:
          "failed",

        startedAt,

        message:
          "update-market 发生致命错误",

        error:
          error?.message ??
          String(error),

      }

    );


    return NextResponse.json(

      {

        success:
          false,

        error:
          error?.message ??
          String(error),

        cron_log:
          cronLogId
            ? true
            : false,

        cron_log_id:
          cronLogId,

        duration_ms:
          Date.now() -
          startedAt,

      },

      {

        status:
          500,

      }

    );

  }

}