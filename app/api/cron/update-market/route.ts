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
// 6. 每次成功更新后写入 holdings_history
// 7. holdings_history 按 snapshot_date + code 防止重复
// 8. 更新 asset_history
// 9. WELAB_GOLD / HK_CASH 跳过
//
// 注意：
// 本文件只能运行在服务器端
// =====================================================

import { NextResponse } from "next/server";

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
// YYYY-MM-DD
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
// 交易日 API
//
// 使用开放的交易日数据判断。
// 如果 API 不可用，则至少保证周末不更新。
//
// 这里分别处理：
// CN
// US
// HK
// LU
// =====================================================

async function checkTradingDay(
  market: string
): Promise<MarketStatus> {

  const today =
    new Date();

  const todayStr =
    formatDate(today);


  // ===================================================
  // 周末
  // ===================================================

  if (
    isWeekend(today)
  ) {

    return {

      shouldUpdate: false,

      date: todayStr,

    };

  }


  // ===================================================
  // 使用 Yahoo Finance chart 判断市场是否有当天数据
  //
  // 不直接使用价格，只判断是否存在最近交易数据。
  // ===================================================

  let symbol = "";


  if (
    market === "china"
  ) {

    // 中国市场使用上证指数
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

    // 卢森堡基金没有统一指数，
    // 使用欧洲市场 ETF 作为交易日参考。
    symbol =
      "VGK";

  }
  else {

    return {

      shouldUpdate: false,

      date: todayStr,

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
      encodeURIComponent(symbol) +
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


      // API 出问题：
      // 工作日允许继续尝试
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


    // 网络检查失败时：
    // 周末不更新
    // 工作日继续尝试
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
// amount = shares × NAV
//
// US / HK / LU：
// amount = shares × NAV × USD/CNY
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


  if (
    shares <= 0 ||
    nav <= 0
  ) {

    return 0;

  }


  const rawAmount =
    shares *
    nav;


  if (
    market === "china"
  ) {

    return rawAmount;

  }


  return (
    rawAmount *
    usdCny
  );

}


// =====================================================
// 计算 Profit
//
// 注意：
// cost 已经统一为 CNY
// amount 也统一为 CNY
//
// 所以：
// profit = amount - cost
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
// 今天已经存在：
// UPDATE
//
// 今天不存在：
// INSERT
//
// 唯一判断：
// snapshot_date + code
// =====================================================

async function saveHoldingsHistory(
  holdings: Holding[],
  snapshotDate: string
) {

  let inserted = 0;

  let updated = 0;

  let failed = 0;


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
      // 查询今天是否已有记录
      // =================================================

      const {
        data: existing,
        error: existingError,
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

          .maybeSingle();


      if (
        existingError
      ) {

        console.error(
          "holdings_history lookup error:",
          code,
          existingError
        );

        failed++;

        continue;

      }


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
          await supabase

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

          console.error(
            "holdings_history update error:",
            code,
            updateError
          );

          failed++;

        }
        else {

          updated++;

        }

      }


      // =================================================
      // INSERT
      // =================================================

      else {

        const {
          error:
            insertError,
        } =
          await supabase

            .from(
              "holdings_history"
            )

            .insert(
              historyData
            );


        if (
          insertError
        ) {

          console.error(
            "holdings_history insert error:",
            code,
            insertError
          );

          failed++;

        }
        else {

          inserted++;

        }

      }

    } catch (
      error
    ) {

      console.error(
        "holdings_history save error:",
        holding?.code,
        error
      );

      failed++;

    }

  }


  return {

    inserted,

    updated,

    failed,

  };

}


// =====================================================
// Asset History
//
// 每个有效市场日记录一次。
// 如果今天已有记录：UPDATE
// =====================================================

async function saveAssetHistory(
  snapshotDate: string,
  usdCny: number
) {

  try {

    // ===================================================
    // 获取当前 holdings
    // ===================================================

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


    // ===================================================
    // 计算 CN / HK
    // ===================================================

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


    // ===================================================
    // Return
    // ===================================================

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


  try {

    // ===================================================
    // 简单安全检查
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
    // 更新每一个 holding
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


      const market =
        getHoldingMarket(
          holding
        );


      // =================================================
      // 判断这个市场今天是否应该更新
      // =================================================

      const status =
        marketStatus[
          market as keyof typeof marketStatus
        ];


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
      // 获取市场价格
      // =================================================

      try {

        const {
          source,
          data,
        } =
          await getMarketPrice(
            code
          );


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


        // =================================================
        // 统一人民币
        // =================================================

        const amount =
          calculateAmountCny(

            holding,

            nav,

            usdCny,

            market

          );


        if (
          amount <= 0
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
              "无法计算人民币市值",

          });

          continue;

        }


        const cost =
          toNumber(
            holding.cost
          );


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
        // 保存到结果
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

          shares:
            toNumber(
              holding.shares
            ),

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


    // =====================================================
    // 重新读取 holdings
    //
    // 非常重要：
    // 这里不能使用旧数据
    // 必须读取更新后的数据
    // =====================================================

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


    // =====================================================
    // holdings_history
    //
    // 只有真正有市场更新时才保存
    // =====================================================

    let holdingsHistoryInserted =
      0;

    let holdingsHistoryUpdated =
      0;

    let holdingsHistoryFailed =
      0;

    let holdingsHistoryError:
      string | null =
      null;


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


      if (
        holdingsHistoryFailed > 0
      ) {

        holdingsHistoryError =
          "部分 holdings_history 写入失败";

      }

    }


    // =====================================================
    // Asset History
    // =====================================================

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


    // =====================================================
    // 最终资产
    // =====================================================

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


    // =====================================================
    // Success
    // =====================================================

    const success =
      failed === 0 &&
      holdingsHistoryFailed === 0;


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

      market_status:
        marketStatus,

      // =================================================
      // Holdings History
      // =================================================

      holdings_history:
        updated > 0,

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


    return NextResponse.json(

      {

        success:
          false,

        error:
          error?.message ??
          String(error),

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