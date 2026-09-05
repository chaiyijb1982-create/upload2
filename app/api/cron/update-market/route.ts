// =====================================================
// app/api/cron/update-market/route.ts
//
// 全球资产自动更新
//
// 功能：
// 1. 判断中国 / 美国 / 香港 / 卢森堡各自交易日
// 2. 只在对应市场有新交易数据时更新
// 3. 中国基金 → CNY
// 4. 非大陆资产：
//      NAV × shares
//        ↓
//      holding_native_currency.native_amount
//        ↓
//      native currency → CNY
//        ↓
//      holdings
// 5. native_cost 不随市场价格变化
// 6. holdings.cost 根据 native_cost × 最新 FX 重新计算
// 7. 更新 holdings
// 8. 每次运行后写入 holdings_history
// 9. holdings_history 按 snapshot_date + code 防止重复
// 10. 更新 asset_history
// 11. WELAB_GOLD / HK_CASH 跳过
// 12. shares = 0 的资产允许正常更新
// 13. 每次 Cron 执行写入 cron_logs
// 14. 记录 running / success / failed
// 15. 记录更新数量、失败数量、跳过数量、耗时、错误
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

import {
  saveFinancialFreedomHistory,
} from "@/lib/financialFreedom";

import {
  getFinancialFreedomLoans,
} from "@/lib/loan";


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


type NativeHolding = {

  id: number;

  holding_id: number;

  native_currency: string;

  native_cost: number | null;

  native_amount: number | null;

  updated_at?: string | null;

};


type FxExchange = {

  id?: number;

  from_currency: string;

  to_currency: string;

  from_amount: number;

  to_amount: number;

  exchange_date: string;

  created_at?: string | null;

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
// 获取最新 Native → CNY 汇率
//
// 规则：
// 1. CNY = 1
// 2. 直接：USD → CNY / HKD → CNY
// 3. 反向：CNY → USD / CNY → HKD
//
// 注意：
// fx_exchanges 已经按照 exchange_date DESC
// + created_at DESC 排序。
//
// 本函数接收已经查询好的 exchanges，
// 避免每个 holding 重复查询数据库。
// =====================================================

function getNativeToCnyRate(
  nativeCurrency: string,
  exchanges: FxExchange[]
): number | null {

  const currency =
    String(
      nativeCurrency ?? ""
    )
      .trim()
      .toUpperCase();


  if (
    !currency
  ) {

    return null;

  }


  // ===================================================
  // CNY → CNY
  // ===================================================

  if (
    currency === "CNY"
  ) {

    return 1;

  }


  // ===================================================
  // 直接：
  //
  // native → CNY
  //
  // 例如：
  // USD → CNY
  // HKD → CNY
  // ===================================================

  const direct =
    exchanges.find(
      (
        item
      ) => {

        const from =
          String(
            item?.from_currency ?? ""
          )
            .trim()
            .toUpperCase();

        const to =
          String(
            item?.to_currency ?? ""
          )
            .trim()
            .toUpperCase();

        const fromAmount =
          Number(
            item?.from_amount
          );

        const toAmount =
          Number(
            item?.to_amount
          );

        return (
          from === currency &&
          to === "CNY" &&
          Number.isFinite(
            fromAmount
          ) &&
          fromAmount > 0 &&
          Number.isFinite(
            toAmount
          ) &&
          toAmount > 0
        );

      }
    );


  if (
    direct
  ) {

    return (
      Number(
        direct.to_amount
      ) /
      Number(
        direct.from_amount
      )
    );

  }


  // ===================================================
  // 反向：
  //
  // CNY → native
  //
  // 例如：
  // CNY → USD
  // CNY → HKD
  // ===================================================

  const reverse =
    exchanges.find(
      (
        item
      ) => {

        const from =
          String(
            item?.from_currency ?? ""
          )
            .trim()
            .toUpperCase();

        const to =
          String(
            item?.to_currency ?? ""
          )
            .trim()
            .toUpperCase();

        const fromAmount =
          Number(
            item?.from_amount
          );

        const toAmount =
          Number(
            item?.to_amount
          );

        return (
          from === "CNY" &&
          to === currency &&
          Number.isFinite(
            fromAmount
          ) &&
          fromAmount > 0 &&
          Number.isFinite(
            toAmount
          ) &&
          toAmount > 0
        );

      }
    );


  if (
    reverse
  ) {

    return (
      Number(
        reverse.from_amount
      ) /
      Number(
        reverse.to_amount
      )
    );

  }


  return null;

}


// =====================================================
// 获取全部 FX
//
// 一次查询。
// 不要在 holding 循环里面重复查询。
// =====================================================

async function getFxExchanges(): Promise<FxExchange[]> {

  const {
    data,
    error,
  } =
    await supabase

      .from(
        "fx_exchanges"
      )

      .select(
        "*"
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
      );


  if (
    error
  ) {

    throw new Error(
      `获取 fx_exchanges 失败：${error.message}`
    );

  }


  return (
    Array.isArray(
      data
    )
      ? (
          data as FxExchange[]
        )
      : []
  );

}


// =====================================================
// 获取 Holding Native Currency
//
// 非大陆资产必须存在 native row。
// =====================================================

async function getNativeHolding(
  holdingId: number
): Promise<NativeHolding | null> {

  const {
    data,
    error,
  } =
    await supabase

      .from(
        "holding_native_currency"
      )

      .select(
        "id, holding_id, native_currency, native_cost, native_amount, updated_at"
      )

      .eq(
        "holding_id",
        holdingId
      )

      .maybeSingle();


  if (
    error
  ) {

    throw new Error(
      `获取 holding_native_currency 失败：${error.message}`
    );

  }


  if (
    !data
  ) {

    return null;

  }


  return data as NativeHolding;

}


// =====================================================
// Cron Log
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
// 中国资产 CNY 市值
//
// shares × NAV
// =====================================================

function calculateChinaAmountCny(
  holding: Holding,
  nav: number
): number {

  const shares =
    toNumber(
      holding?.shares
    );


  if (
    shares < 0
  ) {

    return 0;

  }


  if (
    nav <= 0
  ) {

    return 0;

  }


  if (
    shares === 0
  ) {

    return 0;

  }


  return (
    shares *
    nav
  );

}


// =====================================================
// Native 市值
//
// 非大陆资产：
//
// shares × native NAV
//
// 注意：
// 这里不乘 USD/CNY。
// native_amount 必须保持本币。
// =====================================================

function calculateNativeAmount(
  holding: Holding,
  nav: number
): number {

  const shares =
    toNumber(
      holding?.shares
    );


  if (
    shares < 0
  ) {

    return 0;

  }


  if (
    nav <= 0
  ) {

    return 0;

  }


  if (
    shares === 0
  ) {

    return 0;

  }


  return (
    shares *
    nav
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
// 保存全部 holdings。
// =====================================================

async function saveHoldingsHistory(
  holdings: Holding[],
  snapshotDate: string
) {

  let inserted = 0;

  let updated = 0;

  let failed = 0;


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
    //
    // 保留原来的逻辑。
    //
    // asset_history 继续记录 USD/CNY。
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
    // 获取全部 FX
    //
    // 非大陆资产会使用这里的 FX。
    //
    // 一次查询，整个 Cron 共用。
    // ===================================================

    let fxExchanges:
      FxExchange[] = [];


    try {

      fxExchanges =
        await getFxExchanges();

    } catch (
      error: any
    ) {

      await finishCronLog(

        cronLogId,

        {

          status:
            "failed",

          startedAt,

          message:
            "获取 fx_exchanges 失败",

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

        },

        {

          status:
            500,

        }

      );

    }


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
        // 中国资产
        //
        // NAV 本身就是 CNY。
        // =================================================

        if (
          market === "china"
        ) {

          const amount =
            calculateChinaAmountCny(
              holding,
              nav
            );


          const cost =
            toNumber(
              holding.cost
            );


          const profit =
            calculateProfit(
              Math.round(
                amount
              ),
              Math.round(
                cost
              )
            );


          const profitRate =
            calculateProfitRate(
              profit,
              Math.round(
                cost
              )
            );


          const updateTime =
            new Date()
              .toISOString();


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
                  updateTime,

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
              updateTime,

          });


          continue;

        }


        // =================================================
        // 非大陆资产
        //
        // 关键逻辑：
        //
        // shares × NAV
        //        ↓
        // native_amount
        //
        // native_amount × FX
        //        ↓
        // CNY amount
        // =================================================

        const nativeHolding =
          await getNativeHolding(
            holding.id
          );


        // =================================================
        // native row 不存在
        //
        // 不从 holdings.amount 反推 native。
        //
        // 因为 native 是非大陆资产的 source of truth。
        // =================================================

        if (
          !nativeHolding
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
              "非大陆资产缺少 holding_native_currency 记录",

          });


          continue;

        }


        // =================================================
        // Native Currency
        // =================================================

        const nativeCurrency =
          String(
            nativeHolding.native_currency ??
            ""
          )
            .trim()
            .toUpperCase();


        if (
          !nativeCurrency
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
              "native_currency 为空",

          });


          continue;

        }


        // =================================================
        // Native amount
        //
        // shares × native NAV
        //
        // 例如：
        //
        // USD ETF
        // shares = 100
        // NAV = 650
        //
        // native_amount = 65000 USD
        // =================================================

        const nativeAmount =
          calculateNativeAmount(
            holding,
            nav
          );


        // =================================================
        // Native cost
        //
        // 每天不重新计算。
        //
        // 直接读取 native table。
        // =================================================

        const nativeCost =
          toNumber(
            nativeHolding.native_cost
          );


        // =================================================
        // Native → CNY FX
        //
        // 使用已经一次性获取的 fxExchanges。
        // =================================================

        const nativeToCnyRate =
          getNativeToCnyRate(
            nativeCurrency,
            fxExchanges
          );


        if (
          nativeToCnyRate === null ||
          !Number.isFinite(
            nativeToCnyRate
          ) ||
          nativeToCnyRate <= 0
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
              `无法获取 ${nativeCurrency} → CNY 汇率`,

            native_currency:
              nativeCurrency,

          });


          continue;

        }


        // =================================================
        // CNY amount
        //
        // holdings.amount 必须保持 INT。
        // =================================================

        const amountCny =
          Math.round(
            nativeAmount *
            nativeToCnyRate
          );


        // =================================================
        // CNY cost
        //
        // native_cost 是 source of truth。
        //
        // 每天按照当前 FX 转成 CNY。
        // =================================================

        const costCny =
          Math.round(
            nativeCost *
            nativeToCnyRate
          );


        // =================================================
        // Profit
        // =================================================

        const profit =
          calculateProfit(
            amountCny,
            costCny
          );


        const profitRate =
          calculateProfitRate(
            profit,
            costCny
          );


        const updateTime =
          new Date()
            .toISOString();


        // =================================================
        // 1. 更新 native table
        //
        // native_currency 不改变
        // native_cost 不改变
        // native_amount 更新
        //
        // 注意：
        // shares = 0 时 nativeAmount = 0，
        // 这里依然正常更新。
        // =================================================

        const {
          error:
            nativeUpdateError,
        } =
          await supabase

            .from(
              "holding_native_currency"
            )

            .update({

              native_amount:
                nativeAmount,

              updated_at:
                updateTime,

            })

            .eq(
              "holding_id",
              holding.id
            );


        if (
          nativeUpdateError
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
              `更新 holding_native_currency 失败：${nativeUpdateError.message}`,

            native_currency:
              nativeCurrency,

            native_amount:
              nativeAmount,

          });


          continue;

        }


        // =================================================
        // 2. 更新 holdings
        //
        // amount / cost / profit / profit_rate
        // 全部保持 CNY。
        //
        // amount / cost / profit 是 INT。
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
                amountCny,

              cost:
                costCny,

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
                updateTime,

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
              `更新 holdings 失败：${updateError.message}`,

            native_currency:
              nativeCurrency,

            native_amount:
              nativeAmount,

            native_cost:
              nativeCost,

            fx:
              nativeToCnyRate,

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

          shares,

          native_currency:
            nativeCurrency,

          native_amount:
            nativeAmount,

          native_cost:
            nativeCost,

          native_to_cny:
            nativeToCnyRate,

          amount:
            amountCny,

          cost:
            costCny,

          profit:
            Math.round(
              profit
            ),

          profit_rate:
            profitRate,

          currency:
            "CNY",

          updated_at:
            updateTime,

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
      holdings.length > 0
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


    assetHistoryResult =
      await saveAssetHistory(

        snapshotDate,

        usdCny

      );


    // ===================================================
    // Financial Freedom History Result
    // ===================================================

    let financialFreedomResult: {
      success: boolean;
      error?: string;
    } = {

      success:
        false,

    };


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
    // Financial Freedom History
    // ===================================================

    console.log(
      "before financial freedom",
      {
        updated,
        totalAsset,
      }
    );


    if (
      updated >= 0
    ) {

      // =================================================
      // 1. 固收资产
      // =================================================

      const {
        data: fixedIncomeData,
        error: fixedIncomeError,
      } =
        await supabase

          .from(
            "fixed_income_assets"
          )

          .select(
            "amount"
          );


      if (
        fixedIncomeError
      ) {

        console.error(
          "Financial Freedom fixed income error:",
          fixedIncomeError
        );

      }


      const fixedIncomeSum =
        (
          Array.isArray(
            fixedIncomeData
          )
            ? fixedIncomeData
            : []
        )
        .reduce(
          (
            sum: number,
            item: any
          ) => {

            return (
              sum +
              Number(
                item?.amount || 0
              )
            );

          },
          0
        );


      // =================================================
      // 2. Financial Freedom 贷款
      // =================================================

      const loanData =
        await getFinancialFreedomLoans();


      console.log(
        "Financial Freedom loan data:",
        loanData
      );


      const financialFreedomLoan =
        (
          Array.isArray(
            loanData
          )
            ? loanData
            : []
        )
        .reduce(
          (
            sum: number,
            loan: any
          ) => {

            const remaining =
              Number(
                loan?.remaining_amount ??
                loan?.balance ??
                loan?.amount ??
                0
              );


            return (
              sum +
              (
                Number.isFinite(
                  remaining
                )
                  ? remaining
                  : 0
              )
            );

          },
          0
        );


      // =================================================
      // 3. 当前家庭净资产
      // =================================================

      const familyNetAsset =
        totalAsset
        +
        fixedIncomeSum
        -
        financialFreedomLoan;


      // =================================================
      // 4. 当前财务自由目标
      //
      // 2027 - 2041
      // =================================================

      const BASE_EXPENSE_CRON: any = {

        2027:
          370000,

        2028:
          370000,

        2029:
          370000,

        2030:
          370000,

        2031:
          370000,

        2032:
          320000,

        2033:
          320000,

        2034:
          320000,

        2035:
          320000,

        2036:
          320000,

        2037:
          320000,

        2038:
          320000,

        2039:
          320000,

        2040:
          320000,

        2041:
          320000,

        2042:
          320000,

      };


      const freedomTarget =
        Object
          .entries(
            BASE_EXPENSE_CRON
          )
          .filter(
            ([year]) =>
              Number(year) >= 2027 &&
              Number(year) <= 2041
          )
          .reduce(
            (
              sum,
              [, value]
            ) =>
              sum +
              Number(value),
            0
          );


      // =================================================
      // 5. 财务自由差额
      // =================================================

      const freedomGap =
        Math.max(
          0,
          freedomTarget -
          familyNetAsset
        );


      // =================================================
      // 6. 财务自由完成率
      // =================================================

      const freedomRate =
        freedomTarget > 0
          ? (
              familyNetAsset /
              freedomTarget
            )
            *
            100
          : 0;


      console.log(
        "Financial Freedom save data:",
        {

          snapshotDate,

          totalAsset,

          fixedIncomeSum,

          financialFreedomLoan,

          familyNetAsset,

          freedomTarget,

          freedomGap,

          freedomRate,

        }
      );


      financialFreedomResult =
        await saveFinancialFreedomHistory({

          snapshot_date:
            snapshotDate,

          total_asset:
            Math.round(
              familyNetAsset
            ),

          freedom_target:
            Math.round(
              freedomTarget
            ),

          freedom_gap:
            Math.round(
              freedomGap
            ),

          freedom_rate:
            freedomRate,

        });

    }


    // ===================================================
    // 最终 Success
    // ===================================================

    const success =
      failed === 0 &&
      holdingsHistoryFailed === 0 &&
      assetHistoryResult.success;


    // ===================================================
    // Cron Log
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

      financial_freedom_history:
        financialFreedomResult,

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